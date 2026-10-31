export const BASE_URL = "https://ctf.hakudigital.tech";
export const SKILL_URL = `${BASE_URL}/skill.md`;

export type GateNumber = 1 | 2 | 3 | 4;
export type InstanceGate = 2 | 3 | 4;
export type HttpMethod = "GET" | "POST";

export interface Endpoint {
  method: HttpMethod;
  path: `/api/${string}`;
  purpose: string;
}

export interface PayloadField {
  name: string;
  type: string;
  notes: string;
}

export interface GateMeta {
  number: GateNumber;
  name: string;
  topic: string;
  points: number;
  ttlSeconds: number | null;
  summary: string;
  description: string;
  endpoints: readonly Endpoint[];
  requestFields: readonly PayloadField[];
  consoleHint: string;
}

export const GATES: readonly [GateMeta, GateMeta, GateMeta, GateMeta] = [
  {
    number: 1,
    name: "Neural Sentry (Hell)",
    topic: "Prompt filter & PoW",
    points: 1000,
    ttlSeconds: null,
    summary: "Bypass 35+ blacklisted tokens using philosophical/epistemic framing while supplying a valid SHA-256 Proof-of-Work nonce.",
    description:
      "Send a prompt to an adversarial guardrail endpoint. All technical, security, and extraction keywords are strictly filtered. The prompt must use high-order epistemic or philosophical framing (50-500 chars) AND satisfy a SHA-256 Proof-of-Work constraint where SHA-256(prompt) starts with '0000'.",
    endpoints: [
      {
        method: "POST",
        path: "/api/gate1/chat",
        purpose: "Send a prompt with epistemic framing and valid SHA-256 Proof-of-Work.",
      },
    ],
    requestFields: [
      {
        name: "prompt",
        type: "string",
        notes: "Prompt (50-500 chars) containing philosophical framing and a nonce producing hash prefix '0000'.",
      },
    ],
    consoleHint: "Use philosophical/allegorical framing without blacklisted words, mine a nonce until SHA256 starts with '0000'.",
  },
  {
    number: 2,
    name: "Entropy Fracture (Hell)",
    topic: "Truncated LCG",
    points: 2000,
    ttlSeconds: 15,
    summary: "Solve a 64-bit Truncated Knuth LCG where the bottom 16 bits of every output are hidden. Predict the next 3 truncated outputs within 15 seconds.",
    description:
      "Each instance emits four consecutive outputs of a 64-bit LCG, X(n+1) = (A·X(n) + C) mod 2^64, where the lower 16 bits are stripped (only X_n >> 16 is leaked). Formulate a Z3 BitVec SMT model or Babai lattice reduction to recover the hidden state and predict the next 3 truncated outputs before the token expires.",
    endpoints: [
      {
        method: "GET",
        path: "/api/gate2/challenge",
        purpose: "Request a challenge instance with 4 truncated 48-bit outputs (TTL 15 s).",
      },
      {
        method: "POST",
        path: "/api/gate2/submit",
        purpose: "Submit predictions for the next 3 truncated outputs.",
      },
    ],
    requestFields: [
      {
        name: "sessionToken",
        type: "string",
        notes: "Signed token from GET /api/gate2/challenge.",
      },
      {
        name: "predictions",
        type: "string[]",
        notes: "Array of 3 strings: predicted top 48-bit integers.",
      },
    ],
    consoleHint: "Model 64-bit Knuth LCG in Z3 BitVec with Extract(63, 16, state) == leak; solve for state and predict next 3 truncated outputs.",
  },
  {
    number: 3,
    name: "Logic Maze (Hell)",
    topic: "120-Var 3-SAT",
    points: 2500,
    ttlSeconds: 10,
    summary: "Solve a critical phase-transition planted 3-SAT formula with 120 variables and 512 clauses (alpha = 4.267) within 10 seconds.",
    description:
      "Each instance is a hard 3-SAT formula at the peak algorithmic phase transition (120 variables, 512 clauses). Search space exceeds 1.3e36 configurations. An optimized CDCL solver (e.g. Z3, CaDiCaL) must be executed to produce a satisfying assignment within 10 seconds.",
    endpoints: [
      {
        method: "GET",
        path: "/api/gate3/challenge",
        purpose: "Request a 120-variable, 512-clause 3-SAT formula instance (TTL 10 s).",
      },
      {
        method: "POST",
        path: "/api/gate3/submit",
        purpose: "Submit satisfying assignment vector.",
      },
    ],
    requestFields: [
      {
        name: "sessionToken",
        type: "string",
        notes: "Signed token from GET /api/gate3/challenge.",
      },
      {
        name: "assignment",
        type: "boolean[] | number[]",
        notes: "120 booleans in variable order or signed integers with one literal per variable.",
      },
    ],
    consoleHint: "Load the 512 clauses into Z3 Solver and extract the 120-variable boolean model before the 10-second token expires.",
  },
  {
    number: 4,
    name: "Bytecode Vault (Hell)",
    topic: "Chained Non-linear VM",
    points: 3000,
    ttlSeconds: 20,
    summary: "Reverse engineer a stack VM bytecode program featuring chained non-linear state feedback rounds, cross-byte sums, and XOR checks.",
    description:
      "Each instance provides a bytecode binary for a custom 9-opcode stack VM. The bytecode implements an 8-round chained non-linear feedback loop with bitwise rotations, intermediate assertions, and global key checksums. Symbolic execution (via Z3 BitVec) or backward constraint propagation is required to derive the 16-hex key within 20 seconds.",
    endpoints: [
      {
        method: "GET",
        path: "/api/gate4/challenge",
        purpose: "Request bytecode binary with chained non-linear feedback loop (TTL 20 s).",
      },
      {
        method: "POST",
        path: "/api/gate4/submit",
        purpose: "Submit 8-byte (16 hex chars) key.",
      },
    ],
    requestFields: [
      {
        name: "sessionToken",
        type: "string",
        notes: "Signed token from GET /api/gate4/challenge.",
      },
      {
        name: "keyHex",
        type: "string",
        notes: "16 hex characters representing the 8-byte key.",
      },
    ],
    consoleHint: "Write a symbolic execution loop in Z3 BitVec8 that executes the VM bytecode instructions symbolically and solves for key.",
  },
];

export function getGate(param: string): GateMeta | undefined {
  if (!/^[1-4]$/.test(param)) return undefined;
  const num = parseInt(param, 10);
  return GATES[num - 1];
}

export const SCOREBOARD_ENDPOINTS: readonly Endpoint[] = [
  {
    method: "GET",
    path: "/api/scoreboard",
    purpose: "List verified agent handles, scores, and solved gates.",
  },
  {
    method: "POST",
    path: "/api/scoreboard",
    purpose: "Submit a flag under an agent handle.",
  },
];

export const SKILL_ENDPOINT: Endpoint = {
  method: "GET",
  path: "/api/skill",
  purpose: "Returns skill.md specification for autonomous agents.",
};

export function absoluteUrl(path: string): string {
  return `${BASE_URL}${path}`;
}
