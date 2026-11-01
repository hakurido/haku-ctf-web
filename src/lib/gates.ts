import { MANIFEST } from "./manifest";

export const BASE_URL = "https://ctf.hakudigital.tech";
export const SKILL_URL = `${BASE_URL}/skill.md`;

export type GateNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
export type InstanceGate = 2 | 3 | 4 | 5 | 6 | 7 | 8;
export type HttpMethod = "GET" | "POST";

export const DIFFICULTY = MANIFEST.difficulty;

export const GATE2_INCREMENT = MANIFEST.gates[2].increment;

export const GATE1_RULES = {
  minLength: MANIFEST.gates[1].minLength,
  maxLength: MANIFEST.gates[1].maxLength,
  powBits: MANIFEST.gates[1].powBits,
  hashPrefix: "000000",
} as const;

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
  expiringAtSeconds: number | null;
  summary: string;
  description: string;
  endpoints: readonly Endpoint[];
  requestFields: readonly PayloadField[];
  consoleHint: string;
}

export const GATES: readonly [
  GateMeta,
  GateMeta,
  GateMeta,
  GateMeta,
  GateMeta,
  GateMeta,
  GateMeta,
  GateMeta
] = [
  {
    number: 1,
    name: "Neural Sentry",
    topic: "Deterministic Epistemic Rubric & 22-bit PoW",
    points: 1000,
    ttlSeconds: null,
    expiringAtSeconds: null,
    summary: "Bypass 40+ banned tokens using high-order epistemic framing while solving a 22-bit SHA-256 Proof-of-Work bound to challenge ID and prompt bytes.",
    description:
      "Request a challenge ID from GET /api/gate1/challenge, then submit a prompt (60 to 500 characters) containing authentic epistemic framing and a nonce such that SHA-256(challengeId:nonce:promptBytes) has top 22 zero bits.",
    endpoints: [
      {
        method: "GET",
        path: "/api/gate1/challenge",
        purpose: "Obtain unique challengeId and session token.",
      },
      {
        method: "POST",
        path: "/api/gate1/chat",
        purpose: "Submit prompt with valid epistemic framing and 22-bit PoW.",
      },
    ],
    requestFields: [
      {
        name: "sessionToken",
        type: "string",
        notes: "Token from GET /api/gate1/challenge.",
      },
      {
        name: "prompt",
        type: "string",
        notes: "60 to 500 characters containing designated epistemic framing without banned tokens.",
      },
      {
        name: "nonce",
        type: "number | string",
        notes: "Integer nonce satisfying SHA-256(challengeId:nonce:promptBytes) < 2^(256 - 22).",
      },
    ],
    consoleHint: "Request challenge ID, write an epistemic reflection (e.g. ontological allegory of shadows), then mine nonce for 22-bit PoW producing prefix 00000 (~2M hashes).",
  },
  {
    number: 2,
    name: "Entropy Fracture",
    topic: "64-bit LCG (8 Leaks, 18-bit Hidden)",
    points: 2000,
    ttlSeconds: 600,
    expiringAtSeconds: 15,
    summary: "Recover 64-bit Knuth LCG internal state from 8 consecutive 46-bit observations (18 bits hidden) and predict the 9th truncated output.",
    description:
      "Each instance emits 8 consecutive outputs of a 64-bit LCG where the bottom 18 bits of each state are stripped (X >> 18). Formulate a Z3 QF_BV BitVec model on the first 4 states, verify consistency with the remaining 4, and submit the 9th truncated state before expiration.",
    endpoints: [
      {
        method: "GET",
        path: "/api/gate2/challenge",
        purpose: "Get challenge with 8 consecutive 46-bit truncated outputs (TTL 600 s).",
      },
      {
        method: "POST",
        path: "/api/gate2/submit",
        purpose: "Submit predicted 9th truncated state integer.",
      },
    ],
    requestFields: [
      {
        name: "sessionToken",
        type: "string",
        notes: "Signed token from GET /api/gate2/challenge.",
      },
      {
        name: "prediction",
        type: "string | number",
        notes: "X9 as decimal integer (the top 46 bits of the 9th state).",
      },
    ],
    consoleHint: "Model 64-bit Knuth LCG in Z3 BitVec with Extract(63, 18, state) == leak (hiding 18 bits, up from 16); solve for state and predict next 3 truncated outputs.",
  },
  {
    number: 3,
    name: "Logic Maze",
    topic: "240-Var Critical 3-SAT (1,023 Clauses)",
    points: 2500,
    ttlSeconds: 600,
    expiringAtSeconds: 15,
    summary: "Solve a critical phase-transition 3-SAT formula with 240 variables and 1,023 clauses (alpha = 4.2625).",
    description:
      "Each instance is a hard planted 3-SAT formula at the peak algorithmic phase transition (240 variables, 1,023 clauses). The search space exceeds 1.76e72 configurations. An industrial CDCL solver (Z3, CaDiCaL) yields a satisfying assignment.",
    endpoints: [
      {
        method: "GET",
        path: "/api/gate3/challenge",
        purpose: "Get instance with 240 variables and 1,023 clauses (TTL 600 s).",
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
        notes: "240 booleans in variable order, or signed integers with one literal per variable.",
      },
    ],
    consoleHint: "Load the 1023 clauses (scaled from 512) into Z3 Solver and extract the 240-variable (scaled from 120) boolean model before the 15-second token expires.",
  },
  {
    number: 4,
    name: "Bytecode Vault",
    topic: "128-bit Key 8-Reg 32-bit VM (24 Rounds)",
    points: 3000,
    ttlSeconds: 600,
    expiringAtSeconds: 15,
    summary: "Reverse engineer a 24-round ARX virtual machine with 8 32-bit registers and 4 intermediate checkpoints to extract the 128-bit master key.",
    description:
      "Each instance provides a 24-round ARX virtual machine execution trace with 8 32-bit registers wrapping mod 2^32, executing ADD, XOR, and bitwise ROTL against 4 32-bit key words K0..K3. Four state checkpoints constrain the register file at rounds 5, 11, 17, and 23. Symbolic execution via Z3 BitVec32 derives the 32-hex character key.",
    endpoints: [
      {
        method: "GET",
        path: "/api/gate4/challenge",
        purpose: "Get VM specification, instructions, and 4 state checkpoints (TTL 600 s).",
      },
      {
        method: "POST",
        path: "/api/gate4/submit",
        purpose: "Submit 16-byte (32 hex chars) key.",
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
        notes: "32 hex characters representing 4 x 32-bit key words K0..K3.",
      },
    ],
    consoleHint: "Write a symbolic execution loop in Z3 BitVec32 that executes the 24-round ARX instructions and constrains the 8 registers to the 4 checkpoints to solve for the 128-bit key.",
  },
  {
    number: 5,
    name: "Lattice Citadel",
    topic: "42-Weight Subset Sum (2^21 MitM)",
    points: 3500,
    ttlSeconds: 600,
    expiringAtSeconds: 20,
    summary: "Break a 42-element subset sum knapsack cryptosystem (4.39 trillion states) using Meet-in-the-Middle search.",
    description:
      "Each instance emits 42 large 50-bit weights and a target sum S. The solution vector x in {0, 1}^42 must satisfy sum(x_i * w_i) == S. Search space is 4.39 trillion combinations. A Meet-in-the-Middle search (2^21 + 2^21 = 4.19M operations) solves it in ~1.2 seconds with ~150 MB RAM.",
    endpoints: [
      {
        method: "GET",
        path: "/api/gate5/challenge",
        purpose: "Get 42 weights and target sum (TTL 600 s).",
      },
      {
        method: "POST",
        path: "/api/gate5/submit",
        purpose: "Submit 42-bit binary solution vector.",
      },
    ],
    requestFields: [
      {
        name: "sessionToken",
        type: "string",
        notes: "Signed token from GET /api/gate5/challenge.",
      },
      {
        name: "solution",
        type: "string | number[] | boolean[]",
        notes: "42-character binary string of 0s and 1s, or array of 42 binary bits.",
      },
    ],
    consoleHint: "Split the 42 weights into two 21-element halves. Build a hash map of all 2,097,152 sub-sums for the left half, then query complements with the right half.",
  },
  {
    number: 6,
    name: "Wiener's Abyss",
    topic: "1024-bit RSA Small-d Continued Fractions",
    points: 4000,
    ttlSeconds: 600,
    expiringAtSeconds: 15,
    summary: "Factor a 1024-bit RSA modulus and decrypt ciphertext using continued fraction expansion of e/N (Wiener's Attack).",
    description:
      "Each instance gives a 1024-bit RSA public key (N, e) and ciphertext C. The private exponent d is small (d < 1/3 * N^0.25, d ~ 245 bits). Compute the continued fraction expansion of e/N, test convergents to find d and factor phi(N), and decrypt C to reveal the secret 32-hex token.",
    endpoints: [
      {
        method: "GET",
        path: "/api/gate6/challenge",
        purpose: "Get 1024-bit RSA modulus N, public exponent e, and ciphertext C (TTL 600 s).",
      },
      {
        method: "POST",
        path: "/api/gate6/submit",
        purpose: "Submit decrypted 32-hex token.",
      },
    ],
    requestFields: [
      {
        name: "sessionToken",
        type: "string",
        notes: "Signed token from GET /api/gate6/challenge.",
      },
      {
        name: "secretHex",
        type: "string",
        notes: "32-hex character decrypted secret token.",
      },
    ],
    consoleHint: "Compute the continued fraction convergents of e/N. For each convergent k/d, check if phi = (e*d - 1)/k produces integer roots for x^2 - (N - phi + 1)x + N = 0.",
  },
  {
    number: 7,
    name: "ANF Matrix",
    topic: "Multivariate Quadratic over GF(2) (22 Vars, 30 Eqs)",
    points: 4500,
    ttlSeconds: 600,
    expiringAtSeconds: 20,
    summary: "Solve a post-quantum Multivariate Quadratic (MQ) polynomial system of 30 equations in 22 variables over GF(2).",
    description:
      "Each instance is an Algebraic Normal Form (ANF) system of 30 quadratic equations in 22 boolean variables over GF(2). Solve the non-linear algebraic system via reduction to Boolean SAT (Z3 Xor/And) or Gröbner basis and submit the 22-bit root.",
    endpoints: [
      {
        method: "GET",
        path: "/api/gate7/challenge",
        purpose: "Get 30 quadratic equations in 22 variables over GF(2) (TTL 600 s).",
      },
      {
        method: "POST",
        path: "/api/gate7/submit",
        purpose: "Submit 22-bit boolean root (binary string).",
      },
    ],
    requestFields: [
      {
        name: "sessionToken",
        type: "string",
        notes: "Signed token from GET /api/gate7/challenge.",
      },
      {
        name: "solution",
        type: "string | number[] | boolean[]",
        notes: "22-bit binary string of '0's and '1's.",
      },
    ],
    consoleHint: "Create 22 boolean variables in Z3. Map quadratic monomial pairs (i, j) to And(x_i, x_j), fold all terms with Xor, and solve the SAT model.",
  },
  {
    number: 8,
    name: "Chrono Apex",
    topic: "Non-Linear Filter Generator (LFSR-32 + 2nd Order ANF)",
    points: 5000,
    ttlSeconds: 600,
    expiringAtSeconds: 15,
    summary: "Break a Non-Linear Filter Generator (LFSR-32 filtered by 2nd-order ANF function) using an Algebraic SMT attack.",
    description:
      "Each instance emits 64 bits of keystream generated by an unknown 32-bit LFSR filtered through the non-linear boolean function z_t = s_t ^ (s_{t-3} & s_{t-7}) ^ (s_{t-12} & s_{t-20}). Because non-linear terms destroy linear recurrence, standard Berlekamp-Massey fails. The intended attack is an Algebraic SMT Attack in Z3 to recover the 32-bit initial state and extrapolate the next 32 keystream bits.",
    endpoints: [
      {
        method: "GET",
        path: "/api/gate8/challenge",
        purpose: "Get 64 bits of observed NLFG keystream and feedback taps (TTL 600 s).",
      },
      {
        method: "POST",
        path: "/api/gate8/submit",
        purpose: "Submit predicted next 32 keystream bits.",
      },
    ],
    requestFields: [
      {
        name: "sessionToken",
        type: "string",
        notes: "Signed token from GET /api/gate8/challenge.",
      },
      {
        name: "predictedBits",
        type: "string",
        notes: "32-character binary string ('0' and '1') representing the next 32 keystream bits.",
      },
    ],
    consoleHint: "Model the 32 initial state bits as boolean variables in Z3. Represent the LFSR linear stepping and non-linear filter function symbolically to recover the state in ~0.1s.",
  },
];

export function getGate(param: string): GateMeta | undefined {
  if (!/^[1-8]$/.test(param)) return undefined;
  const num = parseInt(param, 10);
  return GATES[num - 1];
}

export function absoluteUrl(path: string): string {
  return `${BASE_URL}${path}`;
}
