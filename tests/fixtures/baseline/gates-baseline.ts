// Gate facts of the agent surface at HELL mode (8 Gates)
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
    ttlSeconds: 12,
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
  {
    number: 5,
    name: "Lattice Citadel",
    points: 3500,
    ttlSeconds: 15,
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
    ttlSeconds: 20,
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
    ttlSeconds: 20,
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
    ttlSeconds: 15,
    endpoints: [
      { method: "GET", path: "/api/gate8/challenge" },
      { method: "POST", path: "/api/gate8/submit" },
    ],
    requestFields: ["sessionToken", "predictedBits"],
  },
] satisfies GateBaseline[]);

/** 1,000 + 2,000 + 2,500 + 3,000 + 3,500 + 4,000 + 4,500 + 5,000 = 25,500 */
export const TOTAL_POINTS = 25500;

export const INSTANCE_BASELINE = Object.freeze({
  gate2: {
    sequenceLength: 4,
    predictions: 3,
    truncationBits: 16,
    multiplier: "6364136223846793005",
    increment: "1442695040888963407",
    modulus: "18446744073709551616",
  },
  gate3: { variables: 150, clauses: 640, literalsPerClause: 3 },
  gate4: {
    opcodes: ["0x01", "0x02", "0x03", "0x04", "0x05", "0x06", "0x07", "0x08", "0xFF"],
    bytecodeBytes: 151,
    keyHexLength: 16,
  },
});

export const GATE2_INCREMENT_BASELINE = "1442695040888963407";

export const URLS_BASELINE = Object.freeze({
  base: "https://ctf.hakudigital.tech",
  skill: "https://ctf.hakudigital.tech/skill.md",
});
