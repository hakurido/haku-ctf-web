import { InstanceGate } from "./gates";

export type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue };

export interface RateLimitBody {
  error: "Too Many Requests";
  message: string;
}

export interface LeaderboardEntry {
  agentName: string;
  gatesSolved: number[];
  score: number;
  lastSolveAt: number;
  proofBadge?: string;
}

export interface ScoreboardResponse {
  status: "ok";
  leaderboard: LeaderboardEntry[];
  totalAgents: number;
  gatePoints: Record<string, number>;
}

export interface FlagAccepted {
  success: true;
  message: string;
  agent: LeaderboardEntry;
  proofBadge: string | null;
  allGatesCleared: boolean;
}

export interface FlagRejected {
  success: false;
  message: string;
}

export type FlagSubmitResponse = FlagAccepted | FlagRejected;

export interface Gate1ChatResponse {
  status: "ok";
  gate: 1;
  name: string;
  allowed: boolean;
  response: string;
  flag: string | null;
  rateLimitRemaining: number;
}

interface ChallengeBase<G extends InstanceGate> {
  status: "ok";
  gate: G;
  name: string;
  description: string;
  sessionToken: string;
  ttlSeconds: number;
  submitEndpoint: string;
}

export interface Gate2Challenge extends ChallengeBase<2> {
  multiplier: string;
  modulus: string;
  sequence: string[];
  payloadSchema: { sessionToken: string; predictions: string[] };
}

export interface Gate3Challenge extends ChallengeBase<3> {
  variablesCount: number;
  clausesCount: number;
  clauses: number[][];
  payloadSchema: { sessionToken: string; assignment: string };
}

export interface Gate4Challenge extends ChallengeBase<4> {
  vmSpec: { opcodes: Record<string, string> };
  bytecodeHex: string;
  payloadSchema: { sessionToken: string; keyHex: string };
}

export interface Gate5Challenge extends ChallengeBase<5> {
  weights: string[];
  targetSum: string;
  count: number;
}

export interface Gate6Challenge extends ChallengeBase<6> {
  modulus: string;
  publicExponent: string;
  ciphertext: string;
  bitLength: number;
}

export interface Gate7Challenge extends ChallengeBase<7> {
  numVariables: number;
  numEquations: number;
  equations: any[];
}

export interface Gate8Challenge extends ChallengeBase<8> {
  degree: number;
  observedBits: string;
}

export interface ChallengeByGate {
  2: Gate2Challenge;
  3: Gate3Challenge;
  4: Gate4Challenge;
  5: Gate5Challenge;
  6: Gate6Challenge;
  7: Gate7Challenge;
  8: Gate8Challenge;
}

export interface GateSubmitResponse {
  success: boolean;
  message: string;
  flag?: string;
}

export interface SubmitBodyByGate {
  2: { sessionToken: string; predictions: [string, string, string] };
  3: { sessionToken: string; assignment: JsonValue };
  4: { sessionToken: string; keyHex: string };
  5: { sessionToken: string; solution: string | number[] | boolean[] };
  6: { sessionToken: string; secretHex: string };
  7: { sessionToken: string; solution: string | number[] | boolean[] };
  8: { sessionToken: string; predictedBits: string };
}

export type ApiResult<T> =
  | { kind: "ok"; status: number; data: T }
  | {
      kind: "server-error";
      status: number;
      message: string;
      retryAfterSec: number | null;
      body: JsonValue | null;
    }
  | { kind: "network-error" };

const NOT_JSON_MESSAGE = "The server's response wasn't JSON.";
const NO_MESSAGE = "The response had no message.";

function isRecord(b: unknown): b is Record<string, unknown> {
  return typeof b === "object" && b !== null && !Array.isArray(b);
}

function extractRetryAfter(message: string): number | null {
  const match = /(\d+)\s*s\b/.exec(message);
  return match ? parseInt(match[1], 10) : null;
}

async function request<T>(
  path: string,
  init: RequestInit,
  guard: (body: unknown) => body is T,
  acceptNonOk: boolean = false
): Promise<ApiResult<T>> {
  try {
    const res = await fetch(path, {
      ...init,
      signal: AbortSignal.timeout(15000),
    });

    let body: JsonValue;
    try {
      body = (await res.json()) as JsonValue;
    } catch {
      return {
        kind: "server-error",
        status: res.status,
        message: NOT_JSON_MESSAGE,
        retryAfterSec: null,
        body: null,
      };
    }

    if (guard(body) && (res.ok || acceptNonOk)) {
      return { kind: "ok", status: res.status, data: body };
    }

    const record = isRecord(body) ? body : null;
    const serverMessage = typeof record?.message === "string" ? record.message : null;
    const message =
      serverMessage ?? (typeof record?.error === "string" ? record.error : NO_MESSAGE);

    const retryAfterSec =
      res.status === 429 && serverMessage !== null
        ? extractRetryAfter(serverMessage)
        : null;

    return {
      kind: "server-error",
      status: res.status,
      message,
      retryAfterSec,
      body,
    };
  } catch {
    return { kind: "network-error" };
  }
}

const isScoreboard = (b: unknown): b is ScoreboardResponse =>
  isRecord(b) && Array.isArray(b.leaderboard);

const isFlagSubmit = (b: unknown): b is FlagSubmitResponse =>
  isRecord(b) && typeof b.success === "boolean" && typeof b.message === "string";

const isGate1Chat = (b: unknown): b is Gate1ChatResponse =>
  isRecord(b) && typeof b.allowed === "boolean" && typeof b.response === "string";

const isGateSubmit = (b: unknown): b is GateSubmitResponse =>
  isRecord(b) && typeof b.success === "boolean" && typeof b.message === "string";

export async function getScoreboard(): Promise<ApiResult<ScoreboardResponse>> {
  return request("/api/scoreboard", { method: "GET" }, isScoreboard);
}

export async function postFlag(
  agentName: string,
  flag: string
): Promise<ApiResult<FlagSubmitResponse>> {
  return request(
    "/api/scoreboard",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agentName, flag }),
    },
    isFlagSubmit,
    true
  );
}

export async function postGate1Prompt(
  prompt: string
): Promise<ApiResult<Gate1ChatResponse>> {
  return request(
    "/api/gate1/chat",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt }),
    },
    isGate1Chat
  );
}

export async function getChallenge<G extends InstanceGate>(
  gate: G
): Promise<ApiResult<ChallengeByGate[G]>> {
  const guard = (b: unknown): b is ChallengeByGate[G] => {
    if (!isRecord(b) || typeof b.sessionToken !== "string" || b.sessionToken.length === 0) return false;
    if (gate === 2) return Array.isArray(b.sequence);
    if (gate === 3) return Array.isArray(b.clauses);
    if (gate === 4) return typeof b.bytecodeHex === "string";
    if (gate === 5) return Array.isArray(b.weights);
    if (gate === 6) return typeof b.ciphertext === "string";
    if (gate === 7) return Array.isArray(b.equations);
    if (gate === 8) return typeof b.observedBits === "string";
    return false;
  };

  return request(`/api/gate${gate}/challenge`, { method: "GET" }, guard);
}

export async function submitGate<G extends InstanceGate>(
  gate: G,
  body: SubmitBodyByGate[G]
): Promise<ApiResult<GateSubmitResponse>> {
  return request(
    `/api/gate${gate}/submit`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
    isGateSubmit,
    true
  );
}
