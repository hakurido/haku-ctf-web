export const BASE_URL = "https://ctf.hakudigital.tech";
export const SKILL_URL = `${BASE_URL}/skill.md`;

export type GateNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
export type InstanceGate = 2 | 3 | 4 | 5 | 6 | 7 | 8;
export type HttpMethod = "GET" | "POST";

export const DIFFICULTY = "Nightmare Hell";

export const GATE2_INCREMENT = "1442695040888963407";

export const GATE1_RULES = {
  minLength: 60,
  maxLength: 500,
  hashPrefix: "00000",
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
    topic: "Prompt filter & 20-bit PoW",
    points: 1000,
    ttlSeconds: null,
    expiringAtSeconds: null,
    summary: "Bypass 40+ banned terms via epistemic framing while mining a 20-bit SHA-256 hash starting with 00000.",
    description:
      "Send a prompt to an adversarial guardrail endpoint. The prompt must be 60 to 500 characters, contain zero blacklisted keywords or leetspeak permutations, include high-order philosophical/epistemic framing, and its SHA-256 digest must begin with '00000' (20-bit Proof-of-Work).",
    endpoints: [
      {
        method: "POST",
        path: "/api/gate1/chat",
        purpose: "Send a prompt with epistemic framing and valid 20-bit SHA-256 Proof-of-Work.",
      },
    ],
    requestFields: [
      {
        name: "prompt",
        type: "string",
        notes: "60 to 500 characters after trimming. The SHA-256 hash is computed on the trimmed text and must start with 00000.",
      },
    ],
    consoleHint: "Use philosophical/allegorical framing without blacklisted words, mine a nonce until SHA256 starts with '00000' (~1M hashes).",
  },
  {
    number: 2,
    name: "Entropy Fracture",
    topic: "20-bit Truncated LCG",
    points: 2000,
    ttlSeconds: 30,
    expiringAtSeconds: 5,
    summary: "Solve a 64-bit Truncated Knuth LCG where the bottom 20 bits are stripped. Predict the next 3 outputs.",
    description:
      "Each instance emits four consecutive outputs of a 64-bit LCG, X(n+1) = (A·X(n) + C) mod 2^64, where the lower 20 bits are stripped (only X >> 20 is leaked). Recover the 64-bit seed from a search space of 1.05M hidden lower states using Z3 BitVec64 and predict the next three truncated outputs before timeout.",
    endpoints: [
      {
        method: "GET",
        path: "/api/gate2/challenge",
        purpose: "Get challenge with four 44-bit truncated outputs (TTL 30 s).",
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
        notes: "X5, X6, and X7 as decimal integers (the top 44 bits of each state).",
      },
    ],
    consoleHint: "Model 64-bit Knuth LCG in Z3 BitVec with Extract(63, 20, state) == leak (hiding 20 bits, up from 16); solve for state and predict next 3 truncated outputs.",
  },
  {
    number: 3,
    name: "Logic Maze",
    topic: "200-Var Critical 3-SAT",
    points: 2500,
    ttlSeconds: 15,
    expiringAtSeconds: 4,
    summary: "Solve a critical phase-transition 3-SAT formula with 200 variables and 853 clauses (alpha = 4.267).",
    description:
      "Each instance is a hard 3-SAT formula at the peak algorithmic phase transition (200 variables, 853 clauses). Search space exceeds 1.6e60 configurations. An industrial CDCL solver (Z3, CaDiCaL) must produce a satisfying assignment within 15 seconds.",
    endpoints: [
      {
        method: "GET",
        path: "/api/gate3/challenge",
        purpose: "Get instance with 200 variables and 853 clauses (TTL 15 s).",
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
        notes: "200 booleans in variable order, or signed integers with one literal per variable.",
      },
    ],
    consoleHint: "Load the 853 clauses (scaled from 512) into Z3 Solver and extract the 200-variable (scaled from 120) boolean model before the 15-second token expires.",
  },
  {
    number: 4,
    name: "Bytecode Vault",
    topic: "128-bit Key Symbolic VM",
    points: 3000,
    ttlSeconds: 25,
    expiringAtSeconds: 5,
    summary: "Reverse engineer a stack VM bytecode program with 16 rounds of chained feedback and 128-bit key.",
    description:
      "Each instance provides a bytecode binary for a custom 9-opcode stack VM implementing a 16-round chained feedback cipher with bitwise rotations and global checksums. Symbolic execution (Z3 BitVec) is required to derive the 32-hex character key within 25 seconds.",
    endpoints: [
      {
        method: "GET",
        path: "/api/gate4/challenge",
        purpose: "Get bytecode binary with 16 rounds of chained feedback (TTL 25 s).",
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
        notes: "32 hex characters representing the 16-byte key.",
      },
    ],
    consoleHint: "Write a symbolic execution loop in Z3 BitVec8 that executes the VM bytecode instructions symbolically and solves for key.",
  },
  {
    number: 5,
    name: "Lattice Citadel",
    topic: "36-Weight Subset Sum",
    points: 3500,
    ttlSeconds: 20,
    expiringAtSeconds: 5,
    summary: "Break a 36-element subset sum knapsack cryptosystem (68.7B search space) using Meet-in-the-Middle.",
    description:
      "Each instance emits 36 large 50-bit weights and a target sum S. The solution vector x in {0, 1}^36 must satisfy sum(x_i * w_i) == S. Search space is 68.7 billion combinations. A Meet-in-the-Middle search (2^18 + 2^18 = 524k operations) or LLL lattice reduction solves it in ~1.2 seconds.",
    endpoints: [
      {
        method: "GET",
        path: "/api/gate5/challenge",
        purpose: "Get 36 weights and target sum (TTL 20 s).",
      },
      {
        method: "POST",
        path: "/api/gate5/submit",
        purpose: "Submit 36-bit binary solution vector.",
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
        notes: "36-character binary string of 0s and 1s, or array of 36 binary bits.",
      },
    ],
    consoleHint: "Split the 36 weights into two 18-element halves. Build a hash map of all 262,144 sub-sums for the left half, then query complements with the right half.",
  },
  {
    number: 6,
    name: "Wiener's Abyss",
    topic: "1024-bit RSA Wiener Attack",
    points: 4000,
    ttlSeconds: 25,
    expiringAtSeconds: 5,
    summary: "Factor a 1024-bit RSA modulus and decrypt ciphertext using continued fraction expansion of e/N (Wiener's Attack).",
    description:
      "Each instance gives a 1024-bit RSA public key (N, e) and ciphertext C. The private exponent d is small (d < 1/3 * N^0.25, d ~ 238 bits). Compute the continued fraction expansion of e/N, test convergents to find d and factor phi(N), and decrypt C to reveal the secret 32-hex token.",
    endpoints: [
      {
        method: "GET",
        path: "/api/gate6/challenge",
        purpose: "Get 1024-bit RSA modulus N, public exponent e, and ciphertext C (TTL 25 s).",
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
    topic: "64-bit Berlekamp-Massey LFSR",
    points: 5000,
    ttlSeconds: 25,
    expiringAtSeconds: 5,
    summary: "Synthesize the minimal feedback polynomial of an unknown 64-bit LFSR from 128 keystream bits and predict the next 64 bits.",
    description:
      "Each instance emits the first 128 bits of keystream generated by an unknown 64-bit Linear Feedback Shift Register (LFSR) over GF(2). Execute the Berlekamp-Massey algorithm to synthesize the degree-64 feedback connection polynomial, then clock the register to predict the next 64 keystream bits.",
    endpoints: [
      {
        method: "GET",
        path: "/api/gate8/challenge",
        purpose: "Get 128 bits of observed LFSR keystream (TTL 20 s).",
      },
      {
        method: "POST",
        path: "/api/gate8/submit",
        purpose: "Submit predicted next 64 keystream bits.",
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
        notes: "64-character binary string ('0' and '1') representing the next 64 keystream bits.",
      },
    ],
    consoleHint: "Apply the Berlekamp-Massey algorithm over GF(2) to the 128-bit sequence to find minimal polynomial C(x). Extrapolate the recurrence for the next 64 bits.",
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
