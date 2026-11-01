// Agent-surface baseline capture (design: Preservation Checking, baseline
// capture steps 2 and 3).
//
// `node tests/capture/api-contract.ts` (npm run capture:baseline):
//   1. refuses to run unless the frozen files match c6d13ea,
//   2. starts `next start -p 3103` from the existing .next build, or uses
//      BASE_URL when it points at a running localhost server,
//   3. runs the reference solver through a temporary localhost copy first and
//      writes tests/fixtures/baseline/solver.txt,
//   4. sends the contract probes and writes tests/fixtures/baseline/api-contract.json,
//   5. stops the server.
//
// tests/preserve/api-contract.test.ts imports captureContract() and replays the
// same probes against the build under test, then deep-compares the records.
//
// Each record keeps the status, a fixed set of headers, and the body with every
// non-random value verbatim. Random values (session tokens, Gate 2 outputs,
// Gate 3 clauses, Gate 4 bytecode, rate-limit counters, timestamps, the
// leaderboard contents, and badges) are replaced by descriptors that keep only
// their type and size, so a deep comparison checks key sets, value types,
// fixed values, and instance sizes.
//
// Safety: every request goes through support/server.ts, which refuses any
// non-localhost URL. The committed test_agent_solver.py is never executed;
// only runSolverCopy() runs, against a %TEMP% copy whose BASE is localhost.

import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ensureServer, nextProbeIp, PROBE_BLOCKS, probeFetch, sleep } from "../support/server.ts";
import { frozenFileCheck, REF_API, repoPath } from "../support/source.ts";
import { normalizeSolverOutput, parseSolverOutput, runSolverCopy } from "../support/solver-copy.ts";
import type { SolverRun } from "../support/solver-copy.ts";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Port for the agent-surface files (capture, api-contract.test.ts, solver.test.ts). */
export const CONTRACT_PORT = 3103;

export const CONTRACT_FIXTURE: string = repoPath("tests/fixtures/baseline/api-contract.json");
export const SOLVER_FIXTURE: string = repoPath("tests/fixtures/baseline/solver.txt");

/** Points per gate at c6d13ea (GATE_POINTS in src/app/api/scoreboard/route.ts). */
export const SOLVER_POINTS: readonly number[] = Object.freeze([1000, 2000, 2500, 3000]);

/** Headers kept in every record; absent headers are stored as null. */
export const RECORDED_HEADERS: readonly string[] = Object.freeze([
  "content-type",
  "access-control-allow-origin",
  "access-control-allow-methods",
  "access-control-allow-headers",
  "allow",
]);

/** Body fields whose values vary between calls; records keep only type and size. */
export const RANDOM_FIELDS: readonly string[] = Object.freeze([
  "sessionToken",
  "sequence",
  "clauses",
  "bytecodeHex",
  "rateLimitRemaining",
  "lastSolveAt",
  "proofBadge",
  "leaderboard",
  "totalAgents",
]);

/** The solver's Gate 1 base prompt (test_agent_solver.py, solve_gate1). */
export const SOLVER_PROMPT_BASE =
  "In the ontological allegory of the cave, truth is an eternal epistemic reflection behind shadows.";

/** Handle sent by the accepted scoreboard probe, and its server-cleaned form. */
const CONTRACT_HANDLE = "contract probe!";
const CONTRACT_HANDLE_CLEAN = "contractprobe";

// Gate 1 prompts of exactly 60 characters, one per check (checked at load).
const PROMPT_BLOCKED_WORD = "Describe the flag of the realm as an allegory of cave shadow";
const PROMPT_LEETSPEAK = "Describe the fl4g of the realm as an allegory of cave shadow";
const PROMPT_NO_FRAMING = "Describe the shadows on the cave wall and what they all mean";
const PROMPT_POW_FAILURE = "An allegory of the cave where shadows dance upon a far wall.";
for (const p of [PROMPT_BLOCKED_WORD, PROMPT_LEETSPEAK, PROMPT_NO_FRAMING, PROMPT_POW_FAILURE]) {
  if (p.length !== 60) throw new Error(`Gate 1 probe prompt must be 60 characters, got ${p.length}: ${p}`);
}

const FAKE_FLAG = "HAKU{FAKE_FLAG}";
const WRONG_PREDICTIONS: readonly string[] = ["0", "0", "0"];
const WRONG_KEY = "0000000000000000";

// ---------------------------------------------------------------------------
// Record types
// ---------------------------------------------------------------------------

export type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

export type BodyRecord =
  | { kind: "empty" }
  | { kind: "json"; value: Json }
  | { kind: "html" }
  | { kind: "bytes"; length: number; sha256: string };

export interface ResponseRecord {
  id: string;
  method: string;
  path: string;
  /** What was sent, with tokens and flags shown as placeholders. */
  request: string;
  status: number;
  headers: Record<string, string | null>;
  body: BodyRecord;
}

export interface StatusRun {
  status: number;
  count: number;
}

export interface RateLimitRecord {
  id: string;
  method: string;
  path: string;
  request: string;
  /** The route's documented limit per 60 s window; limit + 1 requests are sent. */
  limit: number;
  /** Run-length encoded statuses, in order. */
  statuses: StatusRun[];
  /** The last (over-limit) response. */
  final: ResponseRecord;
}

export interface ContractCapture {
  /** Requests represented by the records (deterministic; excludes retries). */
  requestCount: number;
  probes: ResponseRecord[];
  rateLimits: RateLimitRecord[];
}

export interface ContractReplay extends ContractCapture {
  /** Requests actually sent, including any retry on a stale probe IP. */
  sent: number;
  /** Probe IPs used, in allocation order. */
  ips: string[];
}

export interface ContractFixture extends ContractCapture {
  schema: 1;
  baseline: string;
  generatedBy: string;
  notes: string[];
}

// ---------------------------------------------------------------------------
// Normalization
// ---------------------------------------------------------------------------

interface NormalizeContext {
  /** Literal substrings replaced before the message rules, e.g. a clause text. */
  replacements: readonly (readonly [string, string])[];
}

/** Digits that vary between calls inside fixed server messages. */
const MESSAGE_RULES: readonly (readonly [RegExp, string])[] = [
  [/Retry in \d+s\./g, "Retry in \\d+s."],
  [/sleep for \d+s\./g, "sleep for \\d+s."],
  [/expired \d+s ago!/g, "expired \\d+s ago!"],
  [/check mismatch: \d+ !== \d+/g, "check mismatch: \\d+ !== \\d+"],
];

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined;
}

function typeName(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  if (typeof value === "number") return Number.isInteger(value) ? "integer" : "number";
  return typeof value;
}

function normalizeString(value: string, ctx: NormalizeContext): string {
  let out = value;
  for (const [from, to] of ctx.replacements) {
    if (from) out = out.split(from).join(to);
  }
  for (const [re, to] of MESSAGE_RULES) out = out.replace(re, to);
  return out;
}

type Describer = (value: unknown, parent: Record<string, unknown>, ctx: NormalizeContext) => Json;

const TOKEN_PART = /^[A-Za-z0-9_-]+$/;

function describeToken(value: unknown): Json {
  if (typeof value !== "string") return { $random: "sessionToken", type: typeName(value) };
  const parts = value.split(".");
  let claims: Json = "undecodable";
  if (parts.length === 2) {
    try {
      const data = asRecord(JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8")));
      if (data) {
        const payload = asRecord(data.payload);
        claims = {
          keys: Object.keys(data).sort(),
          gate: typeof data.gate === "number" ? data.gate : null,
          lifetimeSeconds:
            typeof data.expiresAt === "number" && typeof data.issuedAt === "number" ? data.expiresAt - data.issuedAt : null,
          payloadKeys: payload ? Object.keys(payload).sort() : null,
        };
      }
    } catch {
      claims = "undecodable";
    }
  }
  return {
    $random: "sessionToken",
    type: "string",
    containsDot: value.includes("."),
    parts: parts.length,
    base64urlParts: parts.every((p) => TOKEN_PART.test(p)),
    claims,
  };
}

const TWO_POW_48 = 2n ** 48n;

function describeSequence(value: unknown): Json {
  if (!Array.isArray(value)) return { $random: "sequence", type: typeName(value) };
  const decimal = value.every((x) => typeof x === "string" && /^\d+$/.test(x));
  return {
    $random: "sequence",
    type: "array",
    length: value.length,
    elements: decimal ? "decimal-string" : "mixed",
    below2pow48: decimal && value.every((x) => BigInt(x as string) < TWO_POW_48),
  };
}

function describeClauses(value: unknown, parent: Record<string, unknown>): Json {
  if (!Array.isArray(value)) return { $random: "clauses", type: typeName(value) };
  const n = typeof parent.variablesCount === "number" ? parent.variablesCount : Number.NaN;
  const lengths = [...new Set(value.map((c) => (Array.isArray(c) ? c.length : -1)))].sort((a, b) => a - b);
  const literalsInRange = value.every(
    (c) => Array.isArray(c) && c.every((l) => Number.isInteger(l) && l !== 0 && Math.abs(l as number) <= n),
  );
  const distinctVariables = value.every(
    (c) => Array.isArray(c) && new Set(c.map((l) => Math.abs(Number(l)))).size === c.length,
  );
  return {
    $random: "clauses",
    type: "array",
    count: value.length,
    equalsClausesCount: parent.clausesCount === value.length,
    literalsPerClause: lengths,
    literalsInRange,
    distinctVariablesPerClause: distinctVariables,
  };
}

/** Opcodes that take one argument byte (vmSpec at c6d13ea). */
const OPCODES_WITH_ARG: ReadonlySet<number> = new Set([0x01, 0x02, 0x06]);
const hexByte = (b: number): string => b.toString(16).padStart(2, "0");

function describeBytecode(value: unknown): Json {
  if (typeof value !== "string") return { $random: "bytecodeHex", type: typeName(value) };
  const hex = value.length > 0 && /^(?:[0-9a-f]{2})+$/.test(value);
  if (!hex) return { $random: "bytecodeHex", type: "string", lowercaseHex: false, length: value.length };
  const bytes = Buffer.from(value, "hex");
  const used = new Set<string>();
  const keyIndices: number[] = [];
  let instructions = 0;
  let truncated = false;
  for (let pc = 0; pc < bytes.length; ) {
    const op = bytes[pc];
    const argBytes = OPCODES_WITH_ARG.has(op) ? 1 : 0;
    if (pc + argBytes >= bytes.length && argBytes > 0) {
      truncated = true;
      break;
    }
    used.add(hexByte(op));
    instructions += 1;
    if (op === 0x01) keyIndices.push(bytes[pc + 1]);
    pc += 1 + argBytes;
  }
  return {
    $random: "bytecodeHex",
    type: "string",
    lowercaseHex: true,
    length: value.length,
    firstOpcode: hexByte(bytes[0]),
    lastByte: hexByte(bytes[bytes.length - 1]),
    instructions,
    opcodesUsed: [...used].sort(),
    keyIndexOrder: keyIndices.join(""),
    truncated,
  };
}

const BADGE_FORMAT = /^HAKU\{AGENT_[A-Z0-9_]+_GATES_[1-4]+_VERIFIED_[0-9a-f]{16}\}$/;

function describeBadge(value: unknown): Json {
  if (value === null) return null;
  if (typeof value !== "string") return { $random: "proofBadge", type: typeName(value) };
  return { $random: "proofBadge", type: "string", format: BADGE_FORMAT.test(value) };
}

const ENTRY_KEYS = JSON.stringify(["agentName", "gatesSolved", "lastSolveAt", "score"]);

function describeLeaderboard(value: unknown, _parent: Record<string, unknown>, ctx: NormalizeContext): Json {
  if (!Array.isArray(value)) return { $random: "leaderboard", type: typeName(value) };
  const entries = value.map(asRecord);
  const wellFormed = entries.every(
    (e) => e !== undefined && JSON.stringify(Object.keys(e).filter((k) => k !== "proofBadge").sort()) === ENTRY_KEYS,
  );
  const scores = entries.map((e) => Number(e?.score));
  const sorted = scores.every((s, i) => i === 0 || scores[i - 1] >= s);
  const probe = entries.find((e) => e?.agentName === CONTRACT_HANDLE_CLEAN);
  return {
    $random: "leaderboard",
    type: "array",
    entriesWellFormed: wellFormed,
    sortedByScoreDesc: sorted,
    contractProbeEntry: probe === undefined ? null : normalizeJson(probe, ctx),
  };
}

const DESCRIBERS: ReadonlyMap<string, Describer> = new Map<string, Describer>([
  ["sessionToken", describeToken],
  ["sequence", describeSequence],
  ["clauses", describeClauses],
  ["bytecodeHex", describeBytecode],
  [
    "rateLimitRemaining",
    (v) => ({ $random: "rateLimitRemaining", type: typeName(v), nonNegative: typeof v === "number" && v >= 0 }),
  ],
  ["lastSolveAt", (v) => ({ $random: "lastSolveAt", type: typeName(v), positive: typeof v === "number" && v > 0 })],
  ["proofBadge", describeBadge],
  ["leaderboard", describeLeaderboard],
  [
    "totalAgents",
    (v, parent) => ({
      $random: "totalAgents",
      type: typeName(v),
      equalsLeaderboardLength: Array.isArray(parent.leaderboard) && parent.leaderboard.length === v,
    }),
  ],
]);

/**
 * Copies a parsed JSON body, keeping every fixed value and replacing the
 * values of RANDOM_FIELDS with type-and-size descriptors.
 */
export function normalizeJson(value: unknown, ctx: NormalizeContext = { replacements: [] }): Json {
  if (value === null) return null;
  if (typeof value === "string") return normalizeString(value, ctx);
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (Array.isArray(value)) return value.map((v) => normalizeJson(v, ctx));
  const obj = asRecord(value);
  if (!obj) return { $unexpectedType: typeof value };
  const out: { [key: string]: Json } = {};
  for (const [k, v] of Object.entries(obj)) {
    const describe = DESCRIBERS.get(k);
    out[k] = describe ? describe(v, obj, ctx) : normalizeJson(v, ctx);
  }
  return out;
}

function sha256Hex(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

// ---------------------------------------------------------------------------
// Probe client
// ---------------------------------------------------------------------------

export interface ProbeSpec {
  id: string;
  method: string;
  path: string;
  /** Stored in the record; placeholders stand in for tokens and flags. */
  request: string;
  /** Sent as JSON with content-type application/json. */
  json?: unknown;
  /** Sent verbatim with content-type application/json. */
  raw?: string;
  replacements?: readonly (readonly [string, string])[];
}

interface Observed {
  record: ResponseRecord;
  /** Parsed JSON body before normalization, or undefined. */
  json: unknown;
}

interface Client {
  readonly ip: string;
  probe(spec: ProbeSpec): Promise<Observed>;
}

function makeClient(baseUrl: string, ip: string, stats: { sent: number }): Client {
  return {
    ip,
    async probe(spec) {
      const headers = new Headers();
      let body: string | undefined;
      if (spec.json !== undefined) {
        body = JSON.stringify(spec.json);
        headers.set("content-type", "application/json");
      } else if (spec.raw !== undefined) {
        body = spec.raw;
        headers.set("content-type", "application/json");
      }
      stats.sent += 1;
      const res = await probeFetch(spec.path, { method: spec.method, body, headers, ip, baseUrl });
      const bytes = Buffer.from(await res.arrayBuffer());
      const contentType = res.headers.get("content-type");
      let json: unknown;
      let isJson = false;
      if (bytes.length > 0 && contentType !== null && contentType.includes("application/json")) {
        try {
          json = JSON.parse(bytes.toString("utf8"));
          isJson = true;
        } catch {
          isJson = false;
        }
      }
      let recordBody: BodyRecord;
      if (bytes.length === 0) recordBody = { kind: "empty" };
      else if (isJson) recordBody = { kind: "json", value: normalizeJson(json, { replacements: spec.replacements ?? [] }) };
      else if (contentType !== null && contentType.startsWith("text/html")) recordBody = { kind: "html" };
      else recordBody = { kind: "bytes", length: bytes.length, sha256: sha256Hex(bytes) };
      const recordHeaders: Record<string, string | null> = {};
      for (const h of RECORDED_HEADERS) recordHeaders[h] = res.headers.get(h);
      return {
        json,
        record: {
          id: spec.id,
          method: spec.method,
          path: spec.path,
          request: spec.request,
          status: res.status,
          headers: recordHeaders,
          body: recordBody,
        },
      };
    },
  };
}

function jsonProbe(id: string, method: string, path: string, json: unknown, request = JSON.stringify(json)): ProbeSpec {
  return { id, method, path, request, json };
}

function rawProbe(id: string, method: string, path: string, raw: string): ProbeSpec {
  return { id, method, path, request: `raw body ${JSON.stringify(raw)} (content-type application/json)`, raw };
}

function bareProbe(id: string, method: string, path: string): ProbeSpec {
  return { id, method, path, request: "(no body)" };
}

// ---------------------------------------------------------------------------
// Probe groups. Each group runs on its own probe IP, sequentially.
// ---------------------------------------------------------------------------

/** Mines the solver's Gate 1 prompt: `${base} [nonce:N]` with SHA-256 prefix 0000. */
export function mineGate1Prompt(base: string = SOLVER_PROMPT_BASE): { prompt: string; nonce: number; hash: string } {
  for (let nonce = 0; nonce < 10_000_000; nonce++) {
    const prompt = `${base} [nonce:${nonce}]`;
    const hash = createHash("sha256").update(prompt).digest("hex");
    if (hash.startsWith("0000")) return { prompt, nonce, hash };
  }
  throw new Error("No Gate 1 nonce found below 10,000,000");
}

interface GroupResult {
  records: ResponseRecord[];
}

const CHAT = "/api/gate1/chat";

async function gate1Group(c: Client): Promise<GroupResult & { flag: string | null }> {
  const mined = mineGate1Prompt();
  const records: ResponseRecord[] = [];
  const solved = await c.probe(jsonProbe("gate1.chat.solver-prompt", "POST", CHAT, { prompt: mined.prompt }));
  records.push(solved.record);
  const flagValue = asRecord(solved.json)?.flag;
  const specs: ProbeSpec[] = [
    jsonProbe("gate1.chat.solver-prompt-padded", "POST", CHAT, { prompt: `  \n${mined.prompt}\t ` }),
    jsonProbe("gate1.chat.message-field", "POST", CHAT, { message: mined.prompt }),
    jsonProbe("gate1.chat.too-short", "POST", CHAT, { prompt: "hello" }),
    jsonProbe("gate1.chat.too-long", "POST", CHAT, { prompt: "x".repeat(501) }, '{"prompt":"<501 x characters>"}'),
    jsonProbe("gate1.chat.empty-object", "POST", CHAT, {}),
    jsonProbe("gate1.chat.blocked-word", "POST", CHAT, { prompt: PROMPT_BLOCKED_WORD }),
    jsonProbe("gate1.chat.leetspeak", "POST", CHAT, { prompt: PROMPT_LEETSPEAK }),
    jsonProbe("gate1.chat.no-framing", "POST", CHAT, { prompt: PROMPT_NO_FRAMING }),
    jsonProbe("gate1.chat.pow-failure", "POST", CHAT, { prompt: PROMPT_POW_FAILURE }),
    rawProbe("gate1.chat.non-json", "POST", CHAT, "not json"),
    bareProbe("gate1.chat.empty-body", "POST", CHAT),
    bareProbe("gate1.chat.options", "OPTIONS", CHAT),
    bareProbe("gate1.chat.get", "GET", CHAT),
  ];
  for (const spec of specs) records.push((await c.probe(spec)).record);
  return { records, flag: typeof flagValue === "string" ? flagValue : null };
}

interface Instance {
  token: string;
  ttlSeconds: number;
  fetchedAt: number;
  json: Record<string, unknown> | undefined;
}

async function fetchInstance(c: Client, gate: number, records: ResponseRecord[]): Promise<Instance> {
  const observed = await c.probe(bareProbe(`gate${gate}.challenge`, "GET", `/api/gate${gate}/challenge`));
  const fetchedAt = Date.now();
  records.push(observed.record);
  const json = asRecord(observed.json);
  const token = typeof json?.sessionToken === "string" ? json.sessionToken : "missing-token";
  const ttlSeconds = typeof json?.ttlSeconds === "number" && json.ttlSeconds > 0 && json.ttlSeconds <= 60 ? json.ttlSeconds : 20;
  return { token, ttlSeconds, fetchedAt, json };
}

/** A Gate 3 assignment that makes every literal of clause 1 false. */
function violateFirstClause(instance: Instance): { assignment: boolean[]; clause: string } {
  const n = instance.json?.variablesCount;
  const count = typeof n === "number" && Number.isInteger(n) && n > 0 && n <= 10_000 ? n : 0;
  const clauses = instance.json?.clauses;
  const first: number[] =
    Array.isArray(clauses) && Array.isArray(clauses[0])
      ? (clauses[0] as unknown[]).filter((l): l is number => typeof l === "number" && Number.isInteger(l))
      : [];
  const assignment = new Array<boolean>(count).fill(false);
  for (const lit of first) {
    const v = Math.abs(lit);
    if (v >= 1 && v <= count) assignment[v - 1] = lit < 0;
  }
  return { assignment, clause: first.join(" v ") };
}

async function gatesGroup(c: Client): Promise<GroupResult> {
  const records: ResponseRecord[] = [];
  const g2 = await fetchInstance(c, 2, records);
  const g3 = await fetchInstance(c, 3, records);
  const g4 = await fetchInstance(c, 4, records);
  const wrong3 = violateFirstClause(g3);
  const clause1: readonly (readonly [string, string])[] = wrong3.clause ? [[wrong3.clause, "<clause 1 literals>"]] : [];
  const s2 = "/api/gate2/submit";
  const s3 = "/api/gate3/submit";
  const s4 = "/api/gate4/submit";
  const wrongPredictions = [...WRONG_PREDICTIONS];

  // Submitted right away, well inside the 10 to 20 s TTLs.
  const specs: ProbeSpec[] = [
    jsonProbe("gate2.submit.missing-fields", "POST", s2, {}),
    jsonProbe("gate2.submit.missing-answer", "POST", s2, { sessionToken: g2.token }, '{"sessionToken":"<gate 2 token>"}'),
    rawProbe("gate2.submit.non-json", "POST", s2, "not json"),
    jsonProbe("gate2.submit.malformed-token", "POST", s2, { sessionToken: "nodot", predictions: wrongPredictions }),
    jsonProbe("gate2.submit.invalid-token", "POST", s2, { sessionToken: "x.y", predictions: wrongPredictions }),
    jsonProbe(
      "gate2.submit.wrong-answer",
      "POST",
      s2,
      { sessionToken: g2.token, predictions: wrongPredictions },
      '{"sessionToken":"<gate 2 token>","predictions":["0","0","0"]}',
    ),
    jsonProbe(
      "gate2.submit.wrong-count",
      "POST",
      s2,
      { sessionToken: g2.token, predictions: ["0"] },
      '{"sessionToken":"<gate 2 token>","predictions":["0"]}',
    ),
    jsonProbe(
      "gate2.submit.gate-mismatch",
      "POST",
      s2,
      { sessionToken: g4.token, predictions: wrongPredictions },
      '{"sessionToken":"<gate 4 token>","predictions":["0","0","0"]}',
    ),
    jsonProbe("gate3.submit.missing-fields", "POST", s3, {}),
    jsonProbe("gate3.submit.missing-answer", "POST", s3, { sessionToken: g3.token }, '{"sessionToken":"<gate 3 token>"}'),
    rawProbe("gate3.submit.non-json", "POST", s3, "not json"),
    jsonProbe("gate3.submit.malformed-token", "POST", s3, { sessionToken: "nodot", assignment: [true] }),
    jsonProbe("gate3.submit.invalid-token", "POST", s3, { sessionToken: "x.y", assignment: [true] }),
    {
      ...jsonProbe(
        "gate3.submit.wrong-answer",
        "POST",
        s3,
        { sessionToken: g3.token, assignment: wrong3.assignment },
        '{"sessionToken":"<gate 3 token>","assignment":"<booleans that falsify clause 1>"}',
      ),
      replacements: clause1,
    },
    jsonProbe(
      "gate3.submit.not-array",
      "POST",
      s3,
      { sessionToken: g3.token, assignment: "true" },
      '{"sessionToken":"<gate 3 token>","assignment":"true"}',
    ),
    jsonProbe(
      "gate3.submit.gate-mismatch",
      "POST",
      s3,
      { sessionToken: g2.token, assignment: [true] },
      '{"sessionToken":"<gate 2 token>","assignment":[true]}',
    ),
    jsonProbe("gate4.submit.missing-fields", "POST", s4, {}),
    jsonProbe("gate4.submit.missing-answer", "POST", s4, { sessionToken: g4.token }, '{"sessionToken":"<gate 4 token>"}'),
    rawProbe("gate4.submit.non-json", "POST", s4, "not json"),
    jsonProbe("gate4.submit.malformed-token", "POST", s4, { sessionToken: "nodot", keyHex: WRONG_KEY }),
    jsonProbe("gate4.submit.invalid-token", "POST", s4, { sessionToken: "x.y", keyHex: WRONG_KEY }),
    jsonProbe(
      "gate4.submit.wrong-answer",
      "POST",
      s4,
      { sessionToken: g4.token, keyHex: WRONG_KEY },
      `{"sessionToken":"<gate 4 token>","keyHex":"${WRONG_KEY}"}`,
    ),
    jsonProbe(
      "gate4.submit.bad-key-format",
      "POST",
      s4,
      { sessionToken: g4.token, keyHex: "zz" },
      '{"sessionToken":"<gate 4 token>","keyHex":"zz"}',
    ),
    jsonProbe(
      "gate4.submit.gate-mismatch",
      "POST",
      s4,
      { sessionToken: g3.token, keyHex: WRONG_KEY },
      `{"sessionToken":"<gate 3 token>","keyHex":"${WRONG_KEY}"}`,
    ),
    bareProbe("gate2.challenge.post", "POST", "/api/gate2/challenge"),
  ];
  for (const spec of specs) records.push((await c.probe(spec)).record);

  // Expired tokens: wait until every instance is at least TTL + 1.5 s old.
  const readyAt = Math.max(...[g2, g3, g4].map((g) => g.fetchedAt + (g.ttlSeconds + 1.5) * 1000));
  await sleep(Math.max(0, readyAt - Date.now()));
  const expired: ProbeSpec[] = [
    jsonProbe(
      "gate2.submit.expired",
      "POST",
      s2,
      { sessionToken: g2.token, predictions: wrongPredictions },
      '{"sessionToken":"<expired gate 2 token>","predictions":["0","0","0"]}',
    ),
    jsonProbe(
      "gate3.submit.expired",
      "POST",
      s3,
      { sessionToken: g3.token, assignment: wrong3.assignment },
      '{"sessionToken":"<expired gate 3 token>","assignment":"<booleans that falsify clause 1>"}',
    ),
    jsonProbe(
      "gate4.submit.expired",
      "POST",
      s4,
      { sessionToken: g4.token, keyHex: WRONG_KEY },
      `{"sessionToken":"<expired gate 4 token>","keyHex":"${WRONG_KEY}"}`,
    ),
  ];
  for (const spec of expired) records.push((await c.probe(spec)).record);
  return { records };
}

const SCOREBOARD = "/api/scoreboard";

async function scoreboardGroup(c: Client, gate1Flag: string | null): Promise<GroupResult> {
  const flag = gate1Flag ?? "HAKU{gate-1-flag-unavailable}";
  const specs: ProbeSpec[] = [
    jsonProbe("scoreboard.post.missing-fields", "POST", SCOREBOARD, {}),
    jsonProbe("scoreboard.post.missing-flag", "POST", SCOREBOARD, { agentName: "contract_probe" }),
    rawProbe("scoreboard.post.non-json", "POST", SCOREBOARD, "not json"),
    jsonProbe("scoreboard.post.fake-flag", "POST", SCOREBOARD, { agentName: "contract_probe", flag: FAKE_FLAG }),
    jsonProbe(
      "scoreboard.post.bad-handle",
      "POST",
      SCOREBOARD,
      { agentName: "!!!", flag },
      '{"agentName":"!!!","flag":"<gate 1 flag>"}',
    ),
    jsonProbe(
      "scoreboard.post.accepted",
      "POST",
      SCOREBOARD,
      { agentName: CONTRACT_HANDLE, flag },
      `{"agentName":${JSON.stringify(CONTRACT_HANDLE)},"flag":"<gate 1 flag>"}`,
    ),
    // After the accepted POST, so the leaderboard holds the contract probe entry.
    bareProbe("scoreboard.get", "GET", SCOREBOARD),
  ];
  const records: ResponseRecord[] = [];
  for (const spec of specs) records.push((await c.probe(spec)).record);
  return { records };
}

async function miscGroup(c: Client): Promise<GroupResult> {
  const specs: ProbeSpec[] = [
    bareProbe("skill.api", "GET", "/api/skill"),
    bareProbe("skill.static", "GET", "/skill.md"),
    bareProbe("api.unknown-path", "GET", "/api/contract-probe-unknown"),
  ];
  const records: ResponseRecord[] = [];
  for (const spec of specs) records.push((await c.probe(spec)).record);
  return { records };
}

interface RateLimitProbe {
  id: string;
  limit: number;
  spec: ProbeSpec;
}

/** One route per route class; each runs limit + 1 requests on a fresh probe IP. */
export const RATE_LIMIT_PROBES: readonly RateLimitProbe[] = Object.freeze([
  { id: "ratelimit.gate1-chat", limit: 30, spec: jsonProbe("ratelimit.gate1-chat", "POST", CHAT, { prompt: "hello" }) },
  { id: "ratelimit.gate-challenge", limit: 40, spec: bareProbe("ratelimit.gate-challenge", "GET", "/api/gate2/challenge") },
  {
    id: "ratelimit.scoreboard-post",
    limit: 20,
    spec: jsonProbe("ratelimit.scoreboard-post", "POST", SCOREBOARD, { agentName: "contract_probe", flag: FAKE_FLAG }),
  },
  { id: "ratelimit.scoreboard-get", limit: 60, spec: bareProbe("ratelimit.scoreboard-get", "GET", SCOREBOARD) },
]);

function runLength(statuses: readonly number[]): StatusRun[] {
  const out: StatusRun[] = [];
  for (const status of statuses) {
    const last = out[out.length - 1];
    if (last && last.status === status) last.count += 1;
    else out.push({ status, count: 1 });
  }
  return out;
}

async function rateLimitGroup(c: Client, def: RateLimitProbe): Promise<RateLimitRecord> {
  const statuses: number[] = [];
  let final: ResponseRecord | undefined;
  for (let i = 0; i <= def.limit; i++) {
    const observed = await c.probe(def.spec);
    statuses.push(observed.record.status);
    final = observed.record;
  }
  if (!final) throw new Error(`Rate-limit probe ${def.id} sent no request`);
  return {
    id: def.id,
    method: def.spec.method,
    path: def.spec.path,
    request: def.spec.request,
    limit: def.limit,
    statuses: runLength(statuses),
    final: { ...final, id: `${def.id}.over-limit` },
  };
}

/** True when the IP already had requests in its window (a 429 before the limit). */
function rateLimitedEarly(r: RateLimitRecord): boolean {
  let allowed = 0;
  for (const run of r.statuses) {
    if (run.status === 429) break;
    allowed += run.count;
  }
  return allowed < r.limit;
}

const hasTooManyRequests = (r: GroupResult): boolean => r.records.some((rec) => rec.status === 429);

// ---------------------------------------------------------------------------
// Capture
// ---------------------------------------------------------------------------

export interface CaptureOptions {
  /** Localhost origin of the server under test. */
  baseUrl: string;
  /** PROBE_BLOCKS.captureContract for the capture, PROBE_BLOCKS.preserveContract for the replay. */
  block: number;
  log?: (line: string) => void;
}

/**
 * Sends every contract probe against `baseUrl` and returns the normalized
 * records. Groups run in parallel, each on a fresh probe IP from `block`. A
 * group that meets a 429 it didn't cause (a probe IP reused inside the
 * server's 60 s window, possible when BASE_URL is shared) runs once more on a
 * new IP. Takes about 22 s because it waits for the 20 s Gate 4 TTL to pass.
 */
export async function captureContract(options: CaptureOptions): Promise<ContractReplay> {
  const { baseUrl, block, log = () => undefined } = options;
  const stats = { sent: 0 };
  const ips: string[] = [];
  const fresh = (): Client => {
    const ip = nextProbeIp(block);
    ips.push(ip);
    return makeClient(baseUrl, ip, stats);
  };
  async function withRetry<T>(label: string, run: (c: Client) => Promise<T>, stale: (r: T) => boolean): Promise<T> {
    const first = await run(fresh());
    if (!stale(first)) return first;
    log(`${label}: early 429 on ${ips[ips.length - 1]}; probe IP was reused inside the 60 s window, retrying on a new IP`);
    return run(fresh());
  }

  const [front, gates, misc, rateLimits] = await Promise.all([
    (async () => {
      const g1 = await withRetry("gate1", gate1Group, hasTooManyRequests);
      const sb = await withRetry("scoreboard", (c) => scoreboardGroup(c, g1.flag), hasTooManyRequests);
      return { g1, sb };
    })(),
    withRetry("gates", gatesGroup, hasTooManyRequests),
    withRetry("misc", miscGroup, hasTooManyRequests),
    Promise.all(RATE_LIMIT_PROBES.map((def) => withRetry(def.id, (c) => rateLimitGroup(c, def), rateLimitedEarly))),
  ]);

  const probes = [...front.g1.records, ...gates.records, ...front.sb.records, ...misc.records];
  const requestCount = probes.length + rateLimits.reduce((n, r) => n + r.statuses.reduce((m, s) => m + s.count, 0), 0);
  return { requestCount, probes, rateLimits, sent: stats.sent, ips };
}

// ---------------------------------------------------------------------------
// Solver pass criteria (capture step 2)
// ---------------------------------------------------------------------------

/** Expected "Scoreboard G<n>:" lines for the solver run. */
export function expectedSolverScoreboard(): { gate: number; message: string }[] {
  return SOLVER_POINTS.map((p, i) => ({ gate: i + 1, message: `FLAG ACCEPTED for Gate ${i + 1}! +${p} points.` }));
}

/** Lists every pass criterion the solver run misses; empty when it passes. */
export function solverRunProblems(run: SolverRun): string[] {
  const problems: string[] = [];
  if (run.timedOut) problems.push(`timed out after ${run.durationMs} ms`);
  if (run.exitCode !== 0) problems.push(`exit code ${run.exitCode}`);
  const facts = parseSolverOutput(run.stdout);
  facts.flags.forEach((f, i) => {
    if (f === null || !/^HAKU\{[^}]+\}$/.test(f)) problems.push(`Flag ${i + 1} is ${JSON.stringify(f)}`);
  });
  if (JSON.stringify(facts.scoreboard) !== JSON.stringify(expectedSolverScoreboard())) {
    problems.push(`scoreboard lines ${JSON.stringify(facts.scoreboard)}`);
  }
  if (!facts.proofBadge) problems.push("no PROOF BADGE line");
  return problems;
}

// ---------------------------------------------------------------------------
// Script entry point
// ---------------------------------------------------------------------------

function writeFixture(path: string, text: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text, "utf8");
}

function isMainModule(): boolean {
  const meta = import.meta as ImportMeta & { main?: boolean };
  if (typeof meta.main === "boolean") return meta.main;
  const entry = process.argv[1];
  if (!entry) return false;
  const a = resolve(entry);
  const b = fileURLToPath(import.meta.url);
  return process.platform === "win32" ? a.toLowerCase() === b.toLowerCase() : a === b;
}

async function main(): Promise<void> {
  const frozen = frozenFileCheck();
  if (!frozen.clean) {
    throw new Error(
      `Frozen files differ from ${REF_API}; refusing to write baseline fixtures.\n${frozen.status}${frozen.diff}`,
    );
  }
  const server = await ensureServer(CONTRACT_PORT);
  console.log(server.external ? `Using BASE_URL server ${server.baseUrl}` : `Started next start -p ${server.port} (pid ${server.pid})`);
  try {
    // 1. Solver copy first after the server starts (it uses its own IP 198.18.99.1).
    const run = await runSolverCopy(server.baseUrl);
    const problems = solverRunProblems(run);
    if (problems.length > 0) {
      throw new Error(`Solver copy failed: ${problems.join("; ")}\n--- stdout ---\n${run.stdout}\n--- stderr ---\n${run.stderr}`);
    }
    writeFixture(SOLVER_FIXTURE, normalizeSolverOutput(run.stdout));
    const facts = parseSolverOutput(run.stdout);
    console.log(`Solver copy (${run.copy.rewrittenLine}) passed in ${run.durationMs} ms:`);
    for (const s of facts.scoreboard) console.log(`  Scoreboard G${s.gate}: ${s.message}`);
    console.log(`  Proof-of-Pwn badge: ${facts.proofBadge}`);
    console.log(`Wrote ${SOLVER_FIXTURE}`);

    // 2. Contract probes.
    const capture = await captureContract({ baseUrl: server.baseUrl, block: PROBE_BLOCKS.captureContract, log: console.log });
    const fixture: ContractFixture = {
      schema: 1,
      baseline: REF_API,
      generatedBy: "node tests/capture/api-contract.ts (npm run capture:baseline)",
      notes: [
        "Captured on HEAD c6d13ea with the frozen files clean; replayed by tests/preserve/api-contract.test.ts (K03).",
        `Values of ${RANDOM_FIELDS.join(", ")} are replaced by {"$random": ...} descriptors holding only type and size.`,
        "Digits in 'Retry in Ns', 'sleep for Ns', 'expired Ns ago', and 'check mismatch: A !== B' become \\d+.",
        "Each probe group and each rate-limit probe uses its own probe IP; requestCount excludes retries.",
      ],
      requestCount: capture.requestCount,
      probes: capture.probes,
      rateLimits: capture.rateLimits,
    };
    writeFixture(CONTRACT_FIXTURE, `${JSON.stringify(fixture, null, 2)}\n`);
    console.log(
      `Contract: ${capture.probes.length} probes and ${capture.rateLimits.length} rate-limit probes, ` +
        `${capture.requestCount} requests recorded (${capture.sent} sent) from ${capture.ips.length} probe IPs`,
    );
    for (const r of capture.rateLimits) {
      console.log(`  ${r.id} (limit ${r.limit}): ${r.statuses.map((s) => `${s.count}x${s.status}`).join(", ")}`);
    }
    console.log(`Wrote ${CONTRACT_FIXTURE}`);
  } finally {
    await server.stop();
  }
}

if (isMainModule()) {
  main().catch((err: unknown) => {
    console.error(err);
    process.exitCode = 1;
  });
}
