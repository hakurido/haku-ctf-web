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

interface ChallengeBase<G extends 2 | 3 | 4> {
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

export interface ChallengeByGate {
  2: Gate2Challenge;
  3: Gate3Challenge;
  4: Gate4Challenge;
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

function extractRetryAfter(message: string): number | null {
  const match = /(\d+)\s*s\b/.exec(message);
  return match ? parseInt(match[1], 10) : null;
}

async function request<T>(
  path: string,
  init: RequestInit,
  guard: (body: any) => body is T,
  acceptNonOk: boolean = false
): Promise<ApiResult<T>> {
  try {
    const res = await fetch(path, {
      ...init,
      signal: AbortSignal.timeout(15000),
    });

    let body: any = null;
    try {
      body = await res.json();
    } catch {
      return {
        kind: "server-error",
        status: res.status,
        message: `The server sent an unexpected response (HTTP ${res.status}).`,
        retryAfterSec: null,
        body: null,
      };
    }

    if (guard(body) && (res.ok || acceptNonOk)) {
      return { kind: "ok", status: res.status, data: body };
    }

    const message =
      typeof body?.message === "string"
        ? body.message
        : typeof body?.error === "string"
        ? body.error
        : `The server sent an unexpected response (HTTP ${res.status}).`;

    const retryAfterSec =
      res.status === 429 && typeof body?.message === "string"
        ? extractRetryAfter(body.message)
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

export async function getScoreboard(): Promise<ApiResult<ScoreboardResponse>> {
  return request(
    "/api/scoreboard",
    { method: "GET" },
    (b: any): b is ScoreboardResponse => Array.isArray(b?.leaderboard)
  );
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
    (b: any): b is FlagSubmitResponse =>
      typeof b?.success === "boolean" && typeof b?.message === "string",
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
    (b: any): b is Gate1ChatResponse =>
      typeof b?.allowed === "boolean" && typeof b?.response === "string"
  );
}

export async function getChallenge<G extends 2 | 3 | 4>(
  gate: G
): Promise<ApiResult<ChallengeByGate[G]>> {
  const guard = (b: any): b is ChallengeByGate[G] => {
    if (typeof b?.sessionToken !== "string" || b.sessionToken.length === 0) return false;
    if (gate === 2) return Array.isArray(b.sequence);
    if (gate === 3) return Array.isArray(b.clauses);
    if (gate === 4) return typeof b.bytecodeHex === "string";
    return false;
  };

  return request(`/api/gate${gate}/challenge`, { method: "GET" }, guard);
}

export async function submitGate<G extends 2 | 3 | 4>(
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
    (b: any): b is GateSubmitResponse =>
      typeof b?.success === "boolean" && typeof b?.message === "string",
    true
  );
}
