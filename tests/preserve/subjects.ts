// Subjects: the implementations the module-level preservation and unit tests
// check (design, "Subjects"). This is the only file that switches between an
// oracle and a src/lib module. Tests import subjects from here, never from
// src/ directly, so a gap fix that renames an action or moves a function only
// changes the adapters below.
//
// Loading src/lib under `node --test`
// -----------------------------------
// Node's type stripping can't load every src/lib module at HEAD:
//   - api.ts, validation.ts, format.ts, gates.ts, markdown.ts load directly.
//   - console.ts and app-state.ts use extensionless relative imports ("./gates",
//     "./api") and import types without `import type`; challenges.ts imports
//     "./crypto". Node can't resolve the first, and the second names exports
//     that don't exist at runtime.
// So this file registers in-process module hooks (node:module registerHooks)
// that apply only to files under src/: extensionless and "@/..." specifiers
// resolve to the .ts file, and the source is transpiled with the TypeScript
// compiler (a devDependency), which drops type-only imports. Nothing in src/
// is edited. Modules outside src/ load normally.
//
// Oracles kept here (no src/lib module holds this logic at HEAD c6d13ea; each
// is tied to its source by tests/preserve/oracles.test.ts via SUBJECT_ORACLE_TIES):
//   - buildSubmitBody: the submit body mapping in AppStateProvider.submitInstance
//   - countdownRemaining: the seconds formula in components/gates/Countdown.tsx
//   - canSubmit: the Submit guard in AppStateProvider and InstanceTryIt
// When a fix moves one of these into src/lib, point the adapter at the module.

import * as nodeModule from "node:module";
import { existsSync, readFileSync } from "node:fs";
import { dirname, extname, join, resolve as resolvePath, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "typescript";

// ---------------------------------------------------------------------------
// Module hooks for src/
// ---------------------------------------------------------------------------

const REPO_ROOT = join(import.meta.dirname, "..", "..");
const SRC_DIR = join(REPO_ROOT, "src");
const SRC_URL_PREFIX = pathToFileURL(SRC_DIR + sep).href;

interface ResolveResult {
  url: string;
  format?: string | null;
  shortCircuit?: boolean;
}
interface LoadResult {
  format: string;
  source?: string | ArrayBuffer | Uint8Array;
  shortCircuit?: boolean;
}
interface ResolveContext {
  parentURL?: string;
  conditions?: string[];
  importAttributes?: Record<string, string>;
}
interface LoadContext {
  format?: string | null;
  conditions?: string[];
  importAttributes?: Record<string, string>;
}
interface SyncHooks {
  resolve?(specifier: string, context: ResolveContext, next: (specifier: string, context?: ResolveContext) => ResolveResult): ResolveResult;
  load?(url: string, context: LoadContext, next: (url: string, context?: LoadContext) => LoadResult): LoadResult;
}

const isSrcUrl = (url: string | undefined): boolean => !!url && url.startsWith(SRC_URL_PREFIX);

function resolveSrcFile(target: string): string | null {
  if (extname(target) && existsSync(target)) return target;
  for (const candidate of [`${target}.ts`, `${target}.tsx`, join(target, "index.ts"), join(target, "index.tsx")]) {
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

const registerHooks = (nodeModule as unknown as { registerHooks?: (hooks: SyncHooks) => unknown }).registerHooks;
if (typeof registerHooks !== "function") {
  throw new Error(`tests/preserve/subjects.ts needs node:module registerHooks (Node >= 22.15); running ${process.version}`);
}

registerHooks({
  resolve(specifier, context, next) {
    if (isSrcUrl(context.parentURL)) {
      let target: string | null = null;
      if (specifier.startsWith("@/")) target = join(SRC_DIR, specifier.slice(2));
      else if (specifier.startsWith("./") || specifier.startsWith("../")) {
        target = resolvePath(dirname(fileURLToPath(context.parentURL as string)), specifier);
      }
      if (target) {
        const file = resolveSrcFile(target);
        if (file) return { url: pathToFileURL(file).href, shortCircuit: true };
      }
    }
    return next(specifier, context);
  },
  load(url, context, next) {
    if (isSrcUrl(url) && /\.tsx?$/.test(url)) {
      const file = fileURLToPath(url);
      const out = ts.transpileModule(readFileSync(file, "utf8"), {
        fileName: file,
        compilerOptions: {
          module: ts.ModuleKind.ESNext,
          target: ts.ScriptTarget.ES2022,
          jsx: ts.JsxEmit.ReactJSX,
          esModuleInterop: true,
          isolatedModules: true,
          verbatimModuleSyntax: false,
          inlineSourceMap: true,
        },
      });
      return { format: "module", source: out.outputText, shortCircuit: true };
    }
    return next(url, context);
  },
});

// ---------------------------------------------------------------------------
// Modules under test (HEAD c6d13ea, and the fixed modules later)
// ---------------------------------------------------------------------------

// The modules are imported through a computed URL and typed with the local
// interfaces below, so `tsc -p tests` never type-checks src/ (whose HEAD
// imports don't satisfy the tests' verbatimModuleSyntax) and a fix that
// retypes a module doesn't break the test build. The runtime tests check the
// behavior.

/** Imports a module under src/ (repo-relative to src, e.g. "lib/gates.ts"). */
async function importSrc<T>(relative: string): Promise<T> {
  const url: string = pathToFileURL(join(SRC_DIR, ...relative.split("/"))).href;
  return (await import(url)) as T;
}

interface GateMetaLike {
  number: number;
  name: string;
  points: number;
  ttlSeconds: number | null;
  endpoints: readonly { method: string; path: string }[];
  requestFields: readonly { name: string }[];
}
interface GatesModule {
  GATES: readonly GateMetaLike[];
  getGate(param: string): GateMetaLike | undefined;
  BASE_URL: string;
  SKILL_URL: string;
  absoluteUrl(path: string): string;
}
interface ConsoleModule {
  runConsoleCommand(
    input: string,
    context: { gates: readonly GateMetaLike[]; standings: readonly unknown[] | null },
  ): { kind: "none" } | { kind: "clear" } | { kind: "output"; command: string; output: string; tone: string };
}
interface ValidationModule {
  checkHandle(raw: string): { ok: true } | { ok: false; reason: "required" } | { ok: false; reason: "format"; recordedAs: string };
  cleanHandle(raw: string): string;
  parseGate3Assignment(text: string): { ok: true; value: unknown } | { ok: false; message: string };
  GATE3_MALFORMED_MESSAGE: string;
}
interface ApiModule {
  getScoreboard(): Promise<ApiSubjectResult>;
  postFlag(agentName: string, flag: string): Promise<ApiSubjectResult>;
  postGate1Prompt(prompt: string): Promise<ApiSubjectResult>;
  getChallenge(gate: 2 | 3 | 4): Promise<ApiSubjectResult>;
  submitGate(gate: 2 | 3 | 4, body: unknown): Promise<ApiSubjectResult>;
}
interface AppStateModule {
  initialAppState: AppState;
  appReducer(state: AppState, action: unknown): AppState;
}
interface FormatModule {
  formatPoints(n: number): string;
  formatResponseJson(v: unknown): string;
}
interface MarkdownModule {
  parseMarkdown(source: string): MarkdownBlock[];
  slugify(text: string): string;
  resetSlugCounts(): void;
  texToNodes(tex: string): MathNode[] | null;
}
export interface ChallengesModule {
  generateGate2Challenge(): { sequence: string[]; sessionToken: string; ttl: number };
  generateGate3Challenge(): { variables: number; clauses: number[][]; sessionToken: string; ttl: number };
  generateGate4Challenge(): { bytecodeHex: string; sessionToken: string; ttl: number };
  verifyGate2Solution(sessionToken: string, predictions: string[]): { success: boolean; message: string; flag?: string };
}

const gatesModule = await importSrc<GatesModule>("lib/gates.ts");
const consoleModule = await importSrc<ConsoleModule>("lib/console.ts");
const validationModule = await importSrc<ValidationModule>("lib/validation.ts");
const apiModule = await importSrc<ApiModule>("lib/api.ts");
const appStateModule = await importSrc<AppStateModule>("lib/app-state.ts");
const formatModule = await importSrc<FormatModule>("lib/format.ts");
const markdownModule = await importSrc<MarkdownModule>("lib/markdown.ts");

/** Which subjects come from a src/lib module and which from an oracle in this file. */
export const SUBJECT_SOURCES = Object.freeze({
  gates: "src/lib/gates.ts",
  console: "src/lib/console.ts",
  handle: "src/lib/validation.ts",
  assignment: "src/lib/validation.ts",
  api: "src/lib/api.ts",
  reducer: "src/lib/app-state.ts",
  format: "src/lib/format.ts",
  markdown: "src/lib/markdown.ts",
  submitBody: "oracle: AppStateProvider.submitInstance at c6d13ea (+ validation.parseGate3Assignment)",
  countdown: "oracle: components/gates/Countdown.tsx at c6d13ea",
  canSubmit: "oracle: AppStateProvider / InstanceTryIt guards at c6d13ea",
});

// ---------------------------------------------------------------------------
// gates.ts
// ---------------------------------------------------------------------------

export interface GateSubject {
  number: number;
  name: string;
  points: number;
  ttlSeconds: number | null;
  endpoints: { method: string; path: string }[];
  requestFields: string[];
}

/** GATES normalized to the facts K09 compares. */
export const GATES: readonly GateSubject[] = gatesModule.GATES.map((g) => ({
  number: g.number,
  name: g.name,
  points: g.points,
  ttlSeconds: g.ttlSeconds,
  endpoints: g.endpoints.map((e) => ({ method: e.method, path: e.path })),
  requestFields: g.requestFields.map((f) => f.name),
}));

/** The raw gates module, for exports the fix may add (GATE2_INCREMENT, DIFFICULTY). */
export const gatesExports: Readonly<Record<string, unknown>> = gatesModule as unknown as Record<string, unknown>;
export const getGate = (param: string): GateSubject | undefined => {
  const g = gatesModule.getGate(param);
  return g ? GATES[g.number - 1] : undefined;
};
export const BASE_URL: string = gatesModule.BASE_URL;
export const SKILL_URL: string = gatesModule.SKILL_URL;
export const absoluteUrl: (path: string) => string = gatesModule.absoluteUrl;

// ---------------------------------------------------------------------------
// console.ts
// ---------------------------------------------------------------------------

export interface StandingInput {
  agentName: string;
  gatesSolved: number[];
  score: number;
  lastSolveAt: number;
  proofBadge?: string;
}

export interface ConsoleSubjectResult {
  kind: "none" | "clear" | "output";
  /** The printed output without the `$ <command>` echo ("" for none and clear). */
  text: string;
}

/** runConsoleCommand with the app's own GATES, as the provider calls it. */
export function runConsole(cmd: string, standings: readonly StandingInput[] | null): ConsoleSubjectResult {
  const r = consoleModule.runConsoleCommand(cmd, { gates: gatesModule.GATES, standings });
  if (r.kind === "output") return { kind: "output", text: r.output };
  return { kind: r.kind, text: "" };
}

// ---------------------------------------------------------------------------
// validation.ts
// ---------------------------------------------------------------------------

export interface HandleSubjectResult {
  /** The client lets the handle through without a format message. */
  accepted: boolean;
  /** The "required" result (empty after trimming). */
  required: boolean;
  /** For a format message: the handle the server will record ("" = rejected). */
  recordedAs: string | null;
}

export function checkHandle(raw: string): HandleSubjectResult {
  const r = validationModule.checkHandle(raw);
  if (r.ok) return { accepted: true, required: false, recordedAs: null };
  if (r.reason === "required") return { accepted: false, required: true, recordedAs: null };
  return { accepted: false, required: false, recordedAs: r.recordedAs };
}

/** The client's copy of the server cleanup. */
export const cleanHandle: (raw: string) => string = validationModule.cleanHandle;

export type AssignmentSubjectResult = { ok: true; value: unknown } | { ok: false; message: string };

export function parseAssignment(text: string): AssignmentSubjectResult {
  const r = validationModule.parseGate3Assignment(text);
  return r.ok ? { ok: true, value: r.value } : { ok: false, message: r.message };
}

export const GATE3_MALFORMED_MESSAGE: string = validationModule.GATE3_MALFORMED_MESSAGE;

// ---------------------------------------------------------------------------
// api.ts
// ---------------------------------------------------------------------------

export type ApiSubjectResult =
  | { kind: "ok"; status: number; data: unknown }
  | { kind: "server-error"; status: number; message: string; retryAfterSec: number | null; body: unknown }
  | { kind: "network-error" };

export const api = {
  getScoreboard: (): Promise<ApiSubjectResult> => apiModule.getScoreboard(),
  postFlag: (agentName: string, flag: string): Promise<ApiSubjectResult> => apiModule.postFlag(agentName, flag),
  postGate1Prompt: (prompt: string): Promise<ApiSubjectResult> => apiModule.postGate1Prompt(prompt),
  getChallenge: (gate: 2 | 3 | 4): Promise<ApiSubjectResult> => apiModule.getChallenge(gate),
  submitGate2: (body: { sessionToken: string; predictions: [string, string, string] }): Promise<ApiSubjectResult> =>
    apiModule.submitGate(2, body),
  submitGate3: (body: { sessionToken: string; assignment: unknown }): Promise<ApiSubjectResult> =>
    apiModule.submitGate(3, { sessionToken: body.sessionToken, assignment: body.assignment }),
  submitGate4: (body: { sessionToken: string; keyHex: string }): Promise<ApiSubjectResult> => apiModule.submitGate(4, body),
};

// ---------------------------------------------------------------------------
// Submit body mapping (oracle of AppStateProvider.submitInstance at c6d13ea)
// ---------------------------------------------------------------------------

export type SubmitInputs = { 2: [string, string, string]; 3: string; 4: string };

export type SubmitBodyResult =
  | { ok: true; body: { sessionToken: string; predictions: string[] } | { sessionToken: string; assignment: unknown } | { sessionToken: string; keyHex: string } }
  | { ok: false; message: string };

/**
 * The body the provider sends for a gate's inputs. At c6d13ea this lives in
 * AppStateProvider.submitInstance (a client component); the expressions are
 * copied verbatim and tied by SUBJECT_ORACLE_TIES. Gate 3 calls the real
 * validation.parseGate3Assignment.
 */
export function buildSubmitBody<G extends 2 | 3 | 4>(gate: G, sessionToken: string, inputs: SubmitInputs[G]): SubmitBodyResult {
  if (gate === 2) {
    const preds = (inputs as [string, string, string]).map((s) => s.trim());
    return { ok: true, body: { sessionToken, predictions: preds } };
  }
  if (gate === 3) {
    const parsed = parseAssignment(inputs as string);
    if (!parsed.ok) return { ok: false, message: parsed.message };
    return { ok: true, body: { sessionToken, assignment: parsed.value } };
  }
  return { ok: true, body: { sessionToken, keyHex: (inputs as string).trim() } };
}

/** buildSubmitBody, then the api.ts submit helper. Resolves to what happened. */
export async function submitInstance<G extends 2 | 3 | 4>(
  gate: G,
  sessionToken: string,
  inputs: SubmitInputs[G],
): Promise<{ sent: false; message: string } | { sent: true; result: ApiSubjectResult }> {
  const built = buildSubmitBody(gate, sessionToken, inputs);
  if (!built.ok) return { sent: false, message: built.message };
  const b = built.body as Record<string, unknown>;
  const result =
    gate === 2
      ? await api.submitGate2(b as { sessionToken: string; predictions: [string, string, string] })
      : gate === 3
        ? await api.submitGate3(b as { sessionToken: string; assignment: unknown })
        : await api.submitGate4(b as { sessionToken: string; keyHex: string });
  return { sent: true, result };
}

// ---------------------------------------------------------------------------
// app-state.ts (reducer)
// ---------------------------------------------------------------------------

export type InstanceGate = 2 | 3 | 4;

/** An instance slot, as the design's State shape documents it (extra fields allowed). */
export interface InstanceSlotShape<I> {
  status: string;
  op: string | null;
  instance: { data: unknown; receivedAt: number; expiresAt: number; expired: boolean; [k: string]: unknown } | null;
  inputs: I;
  fieldError: string | null;
  result: { success: boolean; message: string; flag?: string } | null;
  error: { status: number; message: string; body?: unknown; [k: string]: unknown } | null;
  [k: string]: unknown;
}

/** The app state, as the design's State shape documents it (extra fields allowed). */
export interface AppState {
  gate1: { status: string; prompt: string; promptError: string | null; response: unknown; error: unknown; [k: string]: unknown };
  gate2: InstanceSlotShape<[string, string, string]>;
  gate3: InstanceSlotShape<string>;
  gate4: InstanceSlotShape<string>;
  flag: {
    agentHandle: string;
    flag: string;
    fieldErrors: { handle: string | null; flag: string | null };
    status: string;
    message: string | null;
    recordedHandle: string | null;
    proofBadge: string | null;
    [k: string]: unknown;
  };
  scoreboard: {
    status: string;
    entries: StandingInput[] | null;
    loadedAt: number | null;
    error: { status: number; message: string; [k: string]: unknown } | null;
    [k: string]: unknown;
  };
  console: { history: { id: number; command: string | null; output: string; tone: string }[]; input: string; nextId: number; [k: string]: unknown };
  soundOn: boolean;
  [k: string]: unknown;
}

export const initialAppState: AppState = appStateModule.initialAppState;

const dispatch = (state: AppState, action: Record<string, unknown>): AppState => appStateModule.appReducer(state, action);

export interface ServerErrorInput {
  status: number;
  message: string;
  body: unknown;
}

/**
 * Reducer events, by meaning. Field values are set by building state directly
 * (see withFields) because the fix may split the `field/set` action.
 */
export const reducer = {
  reduce: dispatch,
  requestStart: (s: AppState, gate: InstanceGate) => dispatch(s, { type: "instance/requestStart", gate }),
  requestSuccess: (s: AppState, gate: InstanceGate, data: unknown, now: number, ttl: number) =>
    dispatch(s, { type: "instance/requestSuccess", gate, data, now, ttl }),
  requestError: (s: AppState, gate: InstanceGate, error: ServerErrorInput) =>
    dispatch(s, { type: "instance/requestError", gate, status: "server-error", error: { retryAt: null, ...error } }),
  requestNetworkError: (s: AppState, gate: InstanceGate) =>
    dispatch(s, { type: "instance/requestError", gate, status: "network-error", error: null }),
  submitStart: (s: AppState, gate: InstanceGate) => dispatch(s, { type: "instance/submitStart", gate }),
  submitSuccess: (s: AppState, gate: InstanceGate, result: { success: boolean; message: string; flag?: string }) =>
    dispatch(s, { type: "instance/submitSuccess", gate, result }),
  submitError: (s: AppState, gate: InstanceGate, error: ServerErrorInput) =>
    dispatch(s, { type: "instance/submitError", gate, status: "server-error", error: { retryAt: null, ...error } }),
  fieldError: (s: AppState, gate: InstanceGate, error: string | null) => dispatch(s, { type: "instance/fieldError", gate, error }),
  expire: (s: AppState, gate: InstanceGate) => dispatch(s, { type: "instance/expired", gate }),
  gate1Start: (s: AppState) => dispatch(s, { type: "gate1/start" }),
  gate1Success: (s: AppState, response: { allowed: boolean; response: string; flag: string | null; [k: string]: unknown }) =>
    dispatch(s, { type: "gate1/success", response }),
  flagStart: (s: AppState) => dispatch(s, { type: "flag/start" }),
  flagSuccess: (s: AppState, data: { success: true; message: string; agent: StandingInput; proofBadge: string | null; allGatesCleared: boolean }) =>
    dispatch(s, { type: "flag/success", data }),
  flagRejected: (s: AppState, message: string) => dispatch(s, { type: "flag/rejected", message }),
  flagDismiss: (s: AppState) => dispatch(s, { type: "flag/dismiss" }),
  scoreboardStart: (s: AppState) => dispatch(s, { type: "scoreboard/start" }),
  scoreboardSuccess: (s: AppState, entries: StandingInput[], now: number) => dispatch(s, { type: "scoreboard/success", entries, now }),
  scoreboardError: (s: AppState, error: ServerErrorInput) =>
    dispatch(s, { type: "scoreboard/error", status: "server-error", error: { retryAt: null, ...error } }),
  consoleAdd: (s: AppState, entry: { command: string | null; output: string; tone: "normal" | "error" }) =>
    dispatch(s, { type: "console/add", entry }),
  consoleClear: (s: AppState) => dispatch(s, { type: "console/clear" }),
  toggleSound: (s: AppState) => dispatch(s, { type: "sound/toggle" }),
};

/** State with field values filled in, built directly from the documented state shape. */
export function withFields(
  s: AppState,
  fields: { handle?: string; flag?: string; prompt?: string; gate2?: [string, string, string]; gate3?: string; gate4?: string; consoleInput?: string },
): AppState {
  return {
    ...s,
    flag: { ...s.flag, agentHandle: fields.handle ?? s.flag.agentHandle, flag: fields.flag ?? s.flag.flag },
    gate1: { ...s.gate1, prompt: fields.prompt ?? s.gate1.prompt },
    gate2: { ...s.gate2, inputs: fields.gate2 ?? s.gate2.inputs },
    gate3: { ...s.gate3, inputs: fields.gate3 ?? s.gate3.inputs },
    gate4: { ...s.gate4, inputs: fields.gate4 ?? s.gate4.inputs },
    console: { ...s.console, input: fields.consoleInput ?? s.console.input },
  };
}

/**
 * Whether Submit is enabled for an instance slot (oracle). At c6d13ea the
 * provider returns early on `!slot.instance || slot.instance.expired ||
 * slot.status === "loading"`, and InstanceTryIt also disables it on "accepted".
 */
export function canSubmit(slot: { instance: { expired: boolean } | null; status: string }): boolean {
  const isSubmitDisabled = !slot.instance || slot.instance.expired || slot.status === "loading" || slot.status === "accepted";
  return !isSubmitDisabled;
}

// ---------------------------------------------------------------------------
// Countdown (oracle of components/gates/Countdown.tsx at c6d13ea)
// ---------------------------------------------------------------------------

/** Seconds the countdown shows; 0 means the instance shows "Expired". */
export function countdownRemaining(expiresAt: number, now: number): number {
  if (now >= expiresAt) return 0;
  const secondsLeft = Math.max(0, Math.ceil((expiresAt - now) / 1000));
  return secondsLeft;
}

// ---------------------------------------------------------------------------
// format.ts, markdown.ts
// ---------------------------------------------------------------------------

export const formatPoints: (n: number) => string = formatModule.formatPoints;
export const formatResponseJson: (v: unknown) => string = formatModule.formatResponseJson;

/** A parsed block or inline node: `type` plus its fields. */
export interface MarkdownBlock {
  type: string;
  [k: string]: unknown;
}
/** A typeset math node: `type` plus its fields. */
export interface MathNode {
  type: string;
  [k: string]: unknown;
}
export const parseMarkdown: (source: string) => MarkdownBlock[] = markdownModule.parseMarkdown;
export const slugify: (text: string) => string = markdownModule.slugify;
export const resetSlugCounts: () => void = markdownModule.resetSlugCounts;
export const texToNodes: (tex: string) => MathNode[] | null = markdownModule.texToNodes;

// ---------------------------------------------------------------------------
// challenges.ts (frozen API logic, imported read-only for K09)
// ---------------------------------------------------------------------------

/** Loads src/lib/challenges.ts (frozen at c6d13ea). Read-only: tests only call its generators. */
export async function loadChallenges(): Promise<ChallengesModule> {
  return importSrc<ChallengesModule>("lib/challenges.ts");
}

// ---------------------------------------------------------------------------
// Source ties for the oracles in this file
// ---------------------------------------------------------------------------

/** Verbatim expressions the oracles above copy, with the c6d13ea file they come from. */
export const SUBJECT_ORACLE_TIES: readonly { ref: "c6d13ea"; path: string; literal: string; oracle: string }[] = Object.freeze([
  {
    ref: "c6d13ea",
    path: "src/components/state/AppStateProvider.tsx",
    literal: "const preds = (slot.inputs as [string, string, string]).map((s) => s.trim());",
    oracle: "buildSubmitBody gate 2",
  },
  { ref: "c6d13ea", path: "src/components/state/AppStateProvider.tsx", literal: "predictions: preds,", oracle: "buildSubmitBody gate 2" },
  {
    ref: "c6d13ea",
    path: "src/components/state/AppStateProvider.tsx",
    literal: "const parsed = parseGate3Assignment(slot.inputs as string);",
    oracle: "buildSubmitBody gate 3",
  },
  { ref: "c6d13ea", path: "src/components/state/AppStateProvider.tsx", literal: "assignment: parsed.value,", oracle: "buildSubmitBody gate 3" },
  {
    ref: "c6d13ea",
    path: "src/components/state/AppStateProvider.tsx",
    literal: "keyHex: (slot.inputs as string).trim(),",
    oracle: "buildSubmitBody gate 4",
  },
  {
    ref: "c6d13ea",
    path: "src/components/state/AppStateProvider.tsx",
    literal: 'if (!slot.instance || slot.instance.expired || slot.status === "loading") return;',
    oracle: "canSubmit",
  },
  {
    ref: "c6d13ea",
    path: "src/components/gates/InstanceTryIt.tsx",
    literal: 'slot.status === "loading" ||\n    slot.status === "accepted";',
    oracle: "canSubmit",
  },
  { ref: "c6d13ea", path: "src/components/gates/Countdown.tsx", literal: "if (expired || now >= expiresAt) {", oracle: "countdownRemaining" },
  {
    ref: "c6d13ea",
    path: "src/components/gates/Countdown.tsx",
    literal: "const secondsLeft = Math.max(0, Math.ceil((expiresAt - now) / 1000));",
    oracle: "countdownRemaining",
  },
]);
