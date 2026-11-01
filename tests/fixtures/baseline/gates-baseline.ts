// Gate facts of the agent surface at c6d13ea (HELL mode), for K09 (3.16, A15).
//
// Every value comes from the frozen API source at c6d13ea: points from
// GATE_POINTS in src/app/api/scoreboard/route.ts, TTLs and instance sizes from
// src/lib/challenges.ts, opcodes and payload fields from the challenge routes,
// and Gate 2's increment from challenges.ts and public/skill.md.
// GATES_BASELINE_TIES lists, for each value, the literal that proves it;
// tests/preserve/oracles.test.ts checks each literal against `git show`.
//
// Names are the base names only. The UI may append nothing (A14) or, at HEAD,
// " (Hell)"; tests compare with a prefix match and never pin the suffix.

export type HttpMethod = "GET" | "POST";

export interface EndpointBaseline {
  method: HttpMethod;
  path: string;
}

export interface GateBaseline {
  number: 1 | 2 | 3 | 4;
  /** Base name without a difficulty suffix. */
  name: string;
  points: number;
  /** null for Gate 1 (no instance, no TTL). */
  ttlSeconds: number | null;
  /** Every endpoint of the gate, challenge first. */
  endpoints: readonly EndpointBaseline[];
  /** Request body field names, in schema order. */
  requestFields: readonly string[];
}

export const GATES_BASELINE: readonly GateBaseline[] = Object.freeze([
  {
    number: 1,
    name: "Neural Sentry",
    points: 1000,
    ttlSeconds: null,
    endpoints: [{ method: "POST", path: "/api/gate1/chat" }],
    requestFields: ["prompt"],
  },
  {
    number: 2,
    name: "Entropy Fracture",
    points: 2000,
    ttlSeconds: 15,
    endpoints: [
      { method: "GET", path: "/api/gate2/challenge" },
      { method: "POST", path: "/api/gate2/submit" },
    ],
    requestFields: ["sessionToken", "predictions"],
  },
  {
    number: 3,
    name: "Logic Maze",
    points: 2500,
    ttlSeconds: 10,
    endpoints: [
      { method: "GET", path: "/api/gate3/challenge" },
      { method: "POST", path: "/api/gate3/submit" },
    ],
    requestFields: ["sessionToken", "assignment"],
  },
  {
    number: 4,
    name: "Bytecode Vault",
    points: 3000,
    ttlSeconds: 20,
    endpoints: [
      { method: "GET", path: "/api/gate4/challenge" },
      { method: "POST", path: "/api/gate4/submit" },
    ],
    requestFields: ["sessionToken", "keyHex"],
  },
] satisfies GateBaseline[]);

/** 1,000 + 2,000 + 2,500 + 3,000. */
export const TOTAL_POINTS = 8500;

/** Instance facts the API produces at c6d13ea. */
export const INSTANCE_BASELINE = Object.freeze({
  gate2: {
    /** `sequence` holds 4 truncated outputs, X1 to X4. */
    sequenceLength: 4,
    /** `predictions` must hold exactly 3 values, X5 to X7. */
    predictions: 3,
    /** Each output is the state shifted right by 16 bits. */
    truncationBits: 16,
    multiplier: "6364136223846793005",
    increment: "1442695040888963407",
    modulus: "18446744073709551616",
  },
  gate3: { variables: 120, clauses: 512, literalsPerClause: 3 },
  gate4: {
    opcodes: ["0x01", "0x02", "0x03", "0x04", "0x05", "0x06", "0x07", "0x08", "0xFF"],
    /** 2 + 8 rounds x 12 + sum check 26 + XOR check 26 + HALT 1. */
    bytecodeBytes: 151,
    keyHexLength: 16,
  },
});

/** Gate 2's increment C: skill.md gives it, the challenge response does not (A3). */
export const GATE2_INCREMENT_BASELINE = "1442695040888963407";

/** Endpoints outside the gates (3.16). */
export const OTHER_ENDPOINTS_BASELINE: readonly EndpointBaseline[] = Object.freeze([
  { method: "GET", path: "/api/scoreboard" },
  { method: "POST", path: "/api/scoreboard" },
  { method: "GET", path: "/api/skill" },
]);

/** A10: the copyable production URLs. */
export const URLS_BASELINE = Object.freeze({
  base: "https://ctf.hakudigital.tech",
  skill: "https://ctf.hakudigital.tech/skill.md",
});

/** One literal that must appear verbatim in `git show <ref>:<path>`. */
export interface SourceTie {
  ref: "c6d13ea";
  path: string;
  literal: string;
  /** What the literal proves. */
  proves: string;
}

const tie = (path: string, literal: string, proves: string): SourceTie => ({ ref: "c6d13ea", path, literal, proves });

const SCOREBOARD_ROUTE = "src/app/api/scoreboard/route.ts";
const CHALLENGES = "src/lib/challenges.ts";

export const GATES_BASELINE_TIES: readonly SourceTie[] = Object.freeze([
  tie(SCOREBOARD_ROUTE, "1: 1000,", "Gate 1 points"),
  tie(SCOREBOARD_ROUTE, "2: 2000,", "Gate 2 points"),
  tie(SCOREBOARD_ROUTE, "3: 2500,", "Gate 3 points"),
  tie(SCOREBOARD_ROUTE, "4: 3000,", "Gate 4 points"),
  tie(CHALLENGES, "const ttl = 15;", "Gate 2 TTL"),
  tie(CHALLENGES, "const ttl = 10;", "Gate 3 TTL"),
  tie(CHALLENGES, "const ttl = 20;", "Gate 4 TTL"),
  tie(CHALLENGES, "for (let i = 0; i < 4; i++) {\n    const leak = state >> BigInt(16);", "Gate 2 emits 4 outputs shifted by 16"),
  tie(CHALLENGES, "predictions.length !== 3", "Gate 2 takes exactly 3 predictions"),
  tie(CHALLENGES, 'BigInt("6364136223846793005")', "Gate 2 multiplier A"),
  tie(CHALLENGES, 'BigInt("1442695040888963407")', "Gate 2 increment C"),
  tie(CHALLENGES, 'BigInt("18446744073709551616")', "Gate 2 modulus 2^64"),
  tie("public/skill.md", "1442695040888963407", "skill.md gives C"),
  tie(CHALLENGES, "const numVars = 120;", "Gate 3 variables"),
  tie(CHALLENGES, "const numClauses = 512;", "Gate 3 clauses"),
  tie(CHALLENGES, "while (vars.length < 3)", "Gate 3 clause width"),
  tie("src/app/api/gate4/challenge/route.ts", '"0x08": "DUP', "Gate 4 has the DUP opcode"),
  tie("src/app/api/gate4/challenge/route.ts", '"0xFF": "HALT_SUCCESS"', "Gate 4 halt opcode"),
  tie(CHALLENGES, "cleanKey.length !== 16", "Gate 4 key is 16 hex characters"),
  tie("src/app/api/gate1/chat/route.ts", "body?.prompt", "Gate 1 reads prompt"),
  tie("src/app/api/gate2/submit/route.ts", "const { sessionToken, predictions } = body", "Gate 2 body fields"),
  tie("src/app/api/gate3/submit/route.ts", "const { sessionToken, assignment } = body", "Gate 3 body fields"),
  tie("src/app/api/gate4/submit/route.ts", "const { sessionToken, keyHex } = body", "Gate 4 body fields"),
  tie("src/lib/gates.ts", 'name: "Neural Sentry', "Gate 1 name"),
  tie("src/lib/gates.ts", 'name: "Entropy Fracture', "Gate 2 name"),
  tie("src/lib/gates.ts", 'name: "Logic Maze', "Gate 3 name"),
  tie("src/lib/gates.ts", 'name: "Bytecode Vault', "Gate 4 name"),
  tie("src/lib/gates.ts", 'export const BASE_URL = "https://ctf.hakudigital.tech";', "Base URL"),
]);

/** Route file and exported handler that prove an endpoint exists at c6d13ea. */
export function routeFileFor(path: string): string {
  return `src/app${path}/route.ts`;
}
