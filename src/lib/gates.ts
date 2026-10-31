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
    name: "Neural Sentry",
    topic: "Prompt filter",
    points: 500,
    ttlSeconds: null,
    summary: "Bypass keyword and leetspeak filters on a chat endpoint to extract the flag.",
    description:
      "Send a prompt to a chat endpoint that sits behind a keyword filter, and get a reply that contains the flag. The filter rejects prompts containing words such as flag, secret, password, reveal, override, or system prompt, and it also checks leetspeak spellings of some of them.",
    endpoints: [
      {
        method: "POST",
        path: "/api/gate1/chat",
        purpose: "Send a prompt and receive a reply.",
      },
    ],
    requestFields: [
      {
        name: "prompt",
        type: "string",
        notes: "First 4,000 characters are read by the server.",
      },
    ],
    consoleHint: "Use academic or RFC simulation framing, or encoded requests, without the blocked keywords.",
  },
  {
    number: 2,
    name: "Entropy Fracture",
    topic: "LCG prediction",
    points: 1000,
    ttlSeconds: 15,
    summary: "Solve a 64-bit Linear Congruential Generator given 5 consecutive outputs and predict the next 3 within 15 seconds.",
    description:
      "Each instance gives five consecutive outputs, X1 to X5, of a 64-bit LCG, X(n+1) = (A·X(n) + C) mod 2^64, along with the multiplier A and the modulus. Recover the increment C and submit X6, X7, and X8 before the instance expires.",
    endpoints: [
      {
        method: "GET",
        path: "/api/gate2/challenge",
        purpose: "Request a new instance with a 15 s TTL and 5 consecutive numbers.",
      },
      {
        method: "POST",
        path: "/api/gate2/submit",
        purpose: "Submit predictions for X6, X7, and X8.",
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
        notes: "Array of 3 strings: decimal representations of X6, X7, and X8.",
      },
    ],
    consoleHint: "Modulus 2^64, multiplier given; compute C = (X2 - A*X1) mod 2^64, then predict X6, X7, X8.",
  },
  {
    number: 3,
    name: "Logic Maze",
    topic: "3-SAT",
    points: 1250,
    ttlSeconds: 10,
    summary: "Find a satisfying truth assignment for a 60-variable, 255-clause 3-SAT formula within 10 seconds.",
    description:
      "Each instance is a satisfiable 3-SAT formula in DIMACS form, with 60 variables and 255 clauses of three literals each. Submit an assignment that satisfies every clause before the instance expires.",
    endpoints: [
      {
        method: "GET",
        path: "/api/gate3/challenge",
        purpose: "Request a 3-SAT formula instance with a 10 s TTL.",
      },
      {
        method: "POST",
        path: "/api/gate3/submit",
        purpose: "Submit satisfying boolean assignment.",
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
        notes: "60 booleans in variable order or signed integers with one literal per variable.",
      },
    ],
    consoleHint: "Load the 255 clauses into a SAT solver such as Z3 or CaDiCaL and submit the assignment vector.",
  },
  {
    number: 4,
    name: "Bytecode Vault",
    topic: "Stack VM",
    points: 1500,
    ttlSeconds: 20,
    summary: "Reverse an 8-opcode stack virtual machine bytecode program and derive the 8-byte key within 20 seconds.",
    description:
      "Each instance is a bytecode program for a stack VM with 8 opcodes, plus the opcode table. The program checks the 8 bytes of a key and reaches HALT_SUCCESS (0xFF) only if every check passes. Submit that key as 16 hex characters before the instance expires.",
    endpoints: [
      {
        method: "GET",
        path: "/api/gate4/challenge",
        purpose: "Request a bytecode instance and opcode specification with a 20 s TTL.",
      },
      {
        method: "POST",
        path: "/api/gate4/submit",
        purpose: "Submit 8-byte hex key.",
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
    consoleHint: "Disassemble the 8 stages ((key[i] ^ xor) + add) == target, then invert the arithmetic to recover key.",
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
