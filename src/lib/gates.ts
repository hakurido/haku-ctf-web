export const BASE_URL = "https://ctf.hakudigital.tech";
export const SKILL_URL = `${BASE_URL}/skill.md`;

export type GateNumber = 1 | 2 | 3 | 4;
export type InstanceGate = 2 | 3 | 4;
export type HttpMethod = "GET" | "POST";

/** The difficulty name, shown once per page as "Difficulty: Hell" (A14). Gate names carry no suffix. */
export const DIFFICULTY = "Hell";

/**
 * Gate 2's increment C. The challenge response doesn't include it; skill.md
 * gives it, and it equals LCG_C in src/lib/challenges.ts. A string, because it
 * is larger than Number.MAX_SAFE_INTEGER.
 */
export const GATE2_INCREMENT = "1442695040888963407";

/**
 * Gate 1's length and proof-of-work rules, as evaluateGate1Prompt in
 * src/lib/challenges.ts applies them. Both apply to the trimmed prompt, and the
 * hash is the hex SHA-256 digest of the trimmed prompt.
 */
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
  /** The countdown shows "Expiring" at or below this many seconds (R1). null for Gate 1, which has no instance. */
  expiringAtSeconds: number | null;
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
    topic: "Prompt filter and proof of work",
    points: 1000,
    ttlSeconds: null,
    expiringAtSeconds: null,
    summary: "Get a filtered chat endpoint to return its flag with a prompt whose SHA-256 hash starts with 0000.",
    description:
      "Send a prompt to a chat endpoint that checks it four times, in this order. " +
      "The prompt must be 50 to 500 characters long after whitespace at both ends is removed. " +
      'It must not contain any of 36 blocked words and phrases, such as flag, secret, key, token, reveal, academic, research, hex, base64, memory, and "tell me", and leetspeak spellings such as fl4g are caught too. ' +
      "It must contain one of these words: epistemic, epistemology, allegory, metaphor, ontological, hermeneutic, philosophical, or soliloquy. " +
      "Finally, the SHA-256 hash of the trimmed prompt, written in hex, must start with 0000. " +
      "A prompt that passes all four checks gets the flag in the reply.",
    endpoints: [
      {
        method: "POST",
        path: "/api/gate1/chat",
        purpose: "Send a prompt and get the reply.",
      },
    ],
    requestFields: [
      {
        name: "prompt",
        type: "string",
        notes: "50 to 500 characters after trimming. The SHA-256 hash is computed on the trimmed text.",
      },
    ],
    consoleHint:
      "Write 50 to 500 characters that use a framing word such as allegory or epistemic and none of the blocked words, such as flag, key, secret, or hex. " +
      "Then add a nonce and change it until the SHA-256 hash of the trimmed prompt starts with 0000. " +
      "That takes about 65,536 tries on average.",
  },
  {
    number: 2,
    name: "Entropy Fracture",
    topic: "Truncated LCG",
    points: 2000,
    ttlSeconds: 15,
    expiringAtSeconds: 5,
    summary: "Predict the next three outputs of a 64-bit LCG when only the top 48 bits of each are shown.",
    description:
      "Each instance gives four consecutive outputs, X1 to X4, of a 64-bit LCG, X(n+1) = (A·X(n) + C) mod 2^64. " +
      "Each output is X(n) >> 16, the top 48 bits of the state, so the low 16 bits are hidden. " +
      "The response includes the multiplier A = 6364136223846793005 and the modulus 2^64, and skill.md gives the increment C = 1442695040888963407. " +
      "Recover the hidden bits of one state, for example by trying all 65,536 values against the other outputs or with a Z3 bit-vector model. " +
      "Then submit X5, X6, and X7, in the same truncated form, before the instance expires.",
    endpoints: [
      {
        method: "GET",
        path: "/api/gate2/challenge",
        purpose: "Get an instance with four truncated outputs.",
      },
      {
        method: "POST",
        path: "/api/gate2/submit",
        purpose: "Submit the next three outputs.",
      },
    ],
    requestFields: [
      {
        name: "sessionToken",
        type: "string",
        notes: "The session token from GET /api/gate2/challenge.",
      },
      {
        name: "predictions",
        type: "[string, string, string]",
        notes: "X5, X6, and X7 as decimal integers from 0 to 281474976710655 (the top 48 bits of each state).",
      },
    ],
    consoleHint:
      "A = 6364136223846793005, C = 1442695040888963407, and the modulus 2^64 are given, and each output is X >> 16. " +
      "Try all 65,536 values for the hidden low 16 bits of the first state, keep the one whose next states match X2 to X4, then step forward to get X5, X6, and X7. " +
      "A Z3 bit-vector model of the same steps also works.",
  },
  {
    number: 3,
    name: "Logic Maze",
    topic: "3-SAT",
    points: 2500,
    ttlSeconds: 10,
    expiringAtSeconds: 3,
    summary: "Satisfy a 3-SAT formula with 120 variables and 512 clauses.",
    description:
      "Each instance is a satisfiable 3-SAT formula in DIMACS form, with 120 variables and 512 clauses of three literals each, about 4.27 clauses per variable. " +
      "There are 2^120 possible assignments, too many to try one by one, so give the clauses to a SAT solver such as Z3 or CaDiCaL. " +
      "Submit an assignment that satisfies every clause before the instance expires.",
    endpoints: [
      {
        method: "GET",
        path: "/api/gate3/challenge",
        purpose: "Get an instance with 120 variables and 512 clauses.",
      },
      {
        method: "POST",
        path: "/api/gate3/submit",
        purpose: "Submit an assignment.",
      },
    ],
    requestFields: [
      {
        name: "sessionToken",
        type: "string",
        notes: "The session token from GET /api/gate3/challenge.",
      },
      {
        name: "assignment",
        type: "boolean[] | number[]",
        notes:
          "120 booleans in variable order, x1 first. The server also takes signed literals such as [1, -2, 3, ...], " +
          "but it reads any array of exactly 120 or 121 entries by position, so send booleans.",
      },
    ],
    consoleHint: "Load the 512 clauses into a SAT solver such as Z3 or CaDiCaL, and submit the model as 120 booleans in variable order.",
  },
  {
    number: 4,
    name: "Bytecode Vault",
    topic: "Stack VM",
    points: 3000,
    ttlSeconds: 20,
    expiringAtSeconds: 5,
    summary: "Find the 8-byte key that a 9-opcode stack VM program checks.",
    description:
      "Each instance is a bytecode program for a stack VM with 9 opcodes, plus the opcode table. " +
      "The program runs 8 rounds, one per key byte. " +
      "Each round XORs a running value with the key byte, adds a constant, rotates the result left, and compares it with a target. " +
      "The last two checks compare the sum of all 8 bytes mod 256 and their XOR with constants. " +
      "The program reaches HALT_SUCCESS (0xFF) only if every check passes. " +
      "Submit the key as 16 hex characters before the instance expires.",
    endpoints: [
      {
        method: "GET",
        path: "/api/gate4/challenge",
        purpose: "Get an instance with the bytecode and opcode table.",
      },
      {
        method: "POST",
        path: "/api/gate4/submit",
        purpose: "Submit the key.",
      },
    ],
    requestFields: [
      {
        name: "sessionToken",
        type: "string",
        notes: "The session token from GET /api/gate4/challenge.",
      },
      {
        name: "keyHex",
        type: "string",
        notes: "16 hex characters for the 8-byte key. Upper or lower case works, and a lowercase 0x prefix is accepted.",
      },
    ],
    consoleHint:
      "The bytecode runs 8 rounds, one per key byte. " +
      "Round i computes t[i] = rotl(((t[i-1] ^ key[i]) + c) mod 256, r), where t[-1] is the first constant pushed, and checks it against a constant. " +
      "Invert each round with key[i] = ((rotr(t[i], r) - c) mod 256) ^ t[i-1], or run the program symbolically with Z3, then submit the 8 bytes as 16 hex characters.",
  },
];

export function getGate(param: string): GateMeta | undefined {
  if (!/^[1-4]$/.test(param)) return undefined;
  const num = parseInt(param, 10);
  return GATES[num - 1];
}

export function absoluteUrl(path: string): string {
  return `${BASE_URL}${path}`;
}
