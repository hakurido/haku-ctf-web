export const BASE_URL = "https://ctf.hakudigital.tech";
export const SKILL_URL = `${BASE_URL}/skill.md`;

export type GateNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
export type InstanceGate = 2 | 3 | 4 | 5 | 6 | 7 | 8;
export type HttpMethod = "GET" | "POST";

export const DIFFICULTY = "Hell";

export const GATE2_INCREMENT = "1442695040888963407";

export const GATE1_RULES = {
  minLength: 50,
  maxLength: 500,
  hashPrefix: "0000",
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
    topic: "Prompt filter & PoW",
    points: 1000,
    ttlSeconds: null,
    expiringAtSeconds: null,
    summary: "Bypass 36+ banned terms via epistemic framing while mining a SHA-256 hash starting with 0000.",
    description:
      "Send a prompt to an adversarial guardrail endpoint. The prompt must be 50 to 500 characters, contain zero blacklisted words, include high-order philosophical/epistemic framing, and its SHA-256 digest must start with '0000'.",
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
        notes: "50 to 500 characters after trimming. The SHA-256 hash is computed on the trimmed text.",
      },
    ],
    consoleHint: "Use philosophical/allegorical framing without blacklisted words, mine a nonce until SHA256 starts with '0000'.",
  },
  {
    number: 2,
    name: "Entropy Fracture",
    topic: "Truncated LCG",
    points: 2000,
    ttlSeconds: 15,
    expiringAtSeconds: 5,
    summary: "Solve a 64-bit Truncated Knuth LCG where the bottom 16 bits are stripped. Predict the next 3 outputs.",
    description:
      "Each instance emits four consecutive outputs of a 64-bit LCG, X(n+1) = (A·X(n) + C) mod 2^64, where the lower 16 bits are hidden (X >> 16). Recover the 64-bit seed using Z3 BitVec and predict the next three truncated outputs before timeout.",
    endpoints: [
      {
        method: "GET",
        path: "/api/gate2/challenge",
        purpose: "Get challenge with four 48-bit truncated outputs (TTL 15 s).",
      },
      {
        method: "POST",
        path: "/api/gate2/submit",
        purpose: "Submit predictions for the next three truncated outputs.",
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
        type: "[string, string, string]",
        notes: "X5, X6, and X7 as decimal integers (the top 48 bits of each state).",
      },
    ],
    consoleHint: "Model 64-bit Knuth LCG in Z3 BitVec with Extract(63, 16, state) == leak; solve for state and predict next 3 truncated outputs.",
  },
  {
    number: 3,
    name: "Logic Maze",
    topic: "150-Var 3-SAT",
    points: 2500,
    ttlSeconds: 12,
    expiringAtSeconds: 3,
    summary: "Solve a critical phase-transition 3-SAT formula with 150 variables and 640 clauses (alpha = 4.267).",
    description:
      "Each instance is a hard 3-SAT formula at the peak algorithmic phase transition (150 variables, 640 clauses). Search space exceeds 1.4e45 configurations. A CDCL solver (Z3, CaDiCaL) must produce a satisfying assignment within 12 seconds.",
    endpoints: [
      {
        method: "GET",
        path: "/api/gate3/challenge",
        purpose: "Get instance with 150 variables and 640 clauses (TTL 12 s).",
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
        notes: "150 booleans in variable order, or signed integers with one literal per variable.",
      },
    ],
    consoleHint: "Load the 640 clauses (scaled from 512) into Z3 Solver and extract the 150-variable (scaled from 120) boolean model before the 12-second token expires.",
  },
  {
    number: 4,
    name: "Bytecode Vault",
    topic: "Chained Non-linear VM",
    points: 3000,
    ttlSeconds: 20,
    expiringAtSeconds: 5,
    summary: "Reverse engineer a stack VM bytecode program with chained non-linear feedback and cross-byte checksums.",
    description:
      "Each instance provides a bytecode binary for a custom 9-opcode stack VM implementing an 8-round chained feedback cipher with bitwise rotations and global checksums. Symbolic execution (Z3 BitVec) is required to derive the 16-hex key within 20 seconds.",
    endpoints: [
      {
        method: "GET",
        path: "/api/gate4/challenge",
        purpose: "Get bytecode binary with chained non-linear feedback loop (TTL 20 s).",
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
  {
    number: 5,
    name: "Lattice Citadel",
    topic: "Subset Sum / Knapsack",
    points: 3500,
    ttlSeconds: 15,
    expiringAtSeconds: 5,
    summary: "Break a 32-element subset sum knapsack cryptosystem using Meet-in-the-Middle or LLL lattice reduction.",
    description:
      "Each instance emits 32 large 50-bit weights and a target sum S. The solution vector x in {0, 1}^32 must satisfy sum(x_i * w_i) == S. Search space is 4.3 billion combinations. A Meet-in-the-Middle search (2^16 + 2^16) or LLL lattice reduction solves it in under 0.2 seconds.",
    endpoints: [
      {
        method: "GET",
        path: "/api/gate5/challenge",
        purpose: "Get 32 weights and target sum (TTL 15 s).",
      },
      {
        method: "POST",
        path: "/api/gate5/submit",
        purpose: "Submit 32-bit binary solution vector.",
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
        notes: "32-character binary string of 0s and 1s, or array of 32 binary bits.",
      },
    ],
    consoleHint: "Split the 32 weights into two 16-element halves. Build a hash map of all 65,536 sub-sums for the left half, then query complements with the right half.",
  },
  {
    number: 6,
    name: "Wiener's Abyss",
    topic: "RSA Short Exponent Attack",
    points: 4000,
    ttlSeconds: 20,
    expiringAtSeconds: 5,
    summary: "Factor a 512-bit RSA modulus and decrypt ciphertext using continued fraction expansion of e/N (Wiener's Attack).",
    description:
      "Each instance gives a 512-bit RSA public key (N, e) and ciphertext C. The private exponent d is small (d < 1/3 * N^0.25). Compute the continued fraction expansion of e/N, test convergents to find d and factor phi(N), and decrypt C to reveal the secret 16-hex token.",
    endpoints: [
      {
        method: "GET",
        path: "/api/gate6/challenge",
        purpose: "Get 512-bit RSA modulus N, public exponent e, and ciphertext C (TTL 20 s).",
      },
      {
        method: "POST",
        path: "/api/gate6/submit",
        purpose: "Submit decrypted 16-hex token.",
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
        notes: "16-hex character decrypted secret token.",
      },
    ],
    consoleHint: "Compute the continued fraction convergents of e/N. For each convergent k/d, check if phi = (e*d - 1)/k produces integer roots for x^2 - (N - phi + 1)x + N = 0.",
  },
  {
    number: 7,
    name: "ANF Matrix",
    topic: "Multivariate Quadratic GF(2)",
    points: 4500,
    ttlSeconds: 20,
    expiringAtSeconds: 5,
    summary: "Solve a post-quantum Multivariate Quadratic (MQ) polynomial system of 28 equations in 20 variables over GF(2).",
    description:
      "Each instance is an Algebraic Normal Form (ANF) system of 28 quadratic equations in 20 boolean variables over GF(2). Solve the non-linear algebraic system via reduction to Boolean SAT (Z3 Xor/And) or Gröbner basis and submit the 20-bit root.",
    endpoints: [
      {
        method: "GET",
        path: "/api/gate7/challenge",
        purpose: "Get 28 quadratic equations in 20 variables over GF(2) (TTL 20 s).",
      },
      {
        method: "POST",
        path: "/api/gate7/submit",
        purpose: "Submit 20-bit boolean root (binary string or 5 hex chars).",
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
        notes: "20-bit binary string of '0's and '1's, or 5 hex characters.",
      },
    ],
    consoleHint: "Create 20 boolean variables in Z3. Map quadratic monomial pairs (i, j) to And(x_i, x_j), fold all terms with Xor, and solve the SAT model.",
  },
  {
    number: 8,
    name: "Chrono Apex",
    topic: "Berlekamp-Massey LFSR",
    points: 5000,
    ttlSeconds: 15,
    expiringAtSeconds: 5,
    summary: "Synthesize the minimal feedback polynomial of an unknown 32-bit LFSR from 64 keystream bits and predict the next 32 bits.",
    description:
      "Each instance emits the first 64 bits of keystream generated by an unknown 32-bit Linear Feedback Shift Register (LFSR) over GF(2). Execute the Berlekamp-Massey algorithm to synthesize the degree-32 feedback connection polynomial, then clock the register to predict the next 32 keystream bits.",
    endpoints: [
      {
        method: "GET",
        path: "/api/gate8/challenge",
        purpose: "Get 64 bits of observed LFSR keystream (TTL 15 s).",
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
    consoleHint: "Apply the Berlekamp-Massey algorithm over GF(2) to the 64-bit sequence to find minimal polynomial C(x). Extrapolate the recurrence for the next 32 bits.",
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
