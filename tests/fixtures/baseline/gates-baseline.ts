// Gate facts of the agent surface at NIGHTMARE HELL mode (8 Gates)
export type HttpMethod = "GET" | "POST";

export interface EndpointBaseline {
  method: HttpMethod;
  path: string;
}

export interface GateBaseline {
  number: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
  name: string;
  points: number;
  ttlSeconds: number | null;
  endpoints: readonly EndpointBaseline[];
  requestFields: readonly string[];
}

export const GATES_BASELINE: readonly GateBaseline[] = Object.freeze([
  {
    number: 1,
    name: "Neural Sentry",
    points: 1000,
    ttlSeconds: null,
    endpoints: [
      { method: "GET", path: "/api/gate1/challenge" },
      { method: "POST", path: "/api/gate1/chat" },
    ],
    requestFields: ["sessionToken", "prompt", "nonce"],
  },
  {
    number: 2,
    name: "Entropy Fracture",
    points: 2000,
    ttlSeconds: 600,
    endpoints: [
      { method: "GET", path: "/api/gate2/challenge" },
      { method: "POST", path: "/api/gate2/submit" },
    ],
    requestFields: ["sessionToken", "prediction"],
  },
  {
    number: 3,
    name: "Logic Maze",
    points: 2500,
    ttlSeconds: 600,
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
    ttlSeconds: 600,
    endpoints: [
      { method: "GET", path: "/api/gate4/challenge" },
      { method: "POST", path: "/api/gate4/submit" },
    ],
    requestFields: ["sessionToken", "keyHex"],
  },
  {
    number: 5,
    name: "Lattice Citadel",
    points: 3500,
    ttlSeconds: 600,
    endpoints: [
      { method: "GET", path: "/api/gate5/challenge" },
      { method: "POST", path: "/api/gate5/submit" },
    ],
    requestFields: ["sessionToken", "solution"],
  },
  {
    number: 6,
    name: "Wiener's Abyss",
    points: 4000,
    ttlSeconds: 600,
    endpoints: [
      { method: "GET", path: "/api/gate6/challenge" },
      { method: "POST", path: "/api/gate6/submit" },
    ],
    requestFields: ["sessionToken", "secretHex"],
  },
  {
    number: 7,
    name: "ANF Matrix",
    points: 4500,
    ttlSeconds: 600,
    endpoints: [
      { method: "GET", path: "/api/gate7/challenge" },
      { method: "POST", path: "/api/gate7/submit" },
    ],
    requestFields: ["sessionToken", "solution"],
  },
  {
    number: 8,
    name: "Chrono Apex",
    points: 5000,
    ttlSeconds: 600,
    endpoints: [
      { method: "GET", path: "/api/gate8/challenge" },
      { method: "POST", path: "/api/gate8/submit" },
    ],
    requestFields: ["sessionToken", "predictedBits"],
  },
] satisfies GateBaseline[]);

export const TOTAL_POINTS = 25500;

export const INSTANCE_BASELINE = Object.freeze({
  gate2: {
    sequenceLength: 8,
    predictions: 1,
    truncationBits: 18,
    multiplier: "6364136223846793005",
    increment: "1442695040888963407",
    modulus: "18446744073709551616",
  },
  gate3: { variables: 240, clauses: 1023, literalsPerClause: 3 },
  gate4: {
    keyHexLength: 32,
    rounds: 24,
    registers: 8,
    checkpoints: 4,
  },
});

export const GATE2_INCREMENT_BASELINE = "1442695040888963407";

export const GATES_BASELINE_TIES = Object.freeze([]);

export const OTHER_ENDPOINTS_BASELINE = Object.freeze([
  { method: "POST", path: "/api/run" },
  { method: "GET", path: "/api/run" },
  { method: "GET", path: "/api/skill" },
]);

export const URLS_BASELINE = Object.freeze({
  base: "https://ctf.hakudigital.tech",
  skill: "https://ctf.hakudigital.tech/skill.md",
});
