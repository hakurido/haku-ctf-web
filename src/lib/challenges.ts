import crypto from "crypto";
import { createSignedToken, verifySignedToken } from "./crypto";
import { MANIFEST } from "./manifest";

// NIGHTMARE HELL DIFFICULTY FLAGS (8 GATES)
export const FLAGS = {
  gate1: "HAKU{N3UR4L_53NTRY_22B1T_P0W_EPISTEMIC_v2}",
  gate2: "HAKU{PRNG_18B1T_TRUNC4T3D_LCG_8LEAKS_0xDEAD}",
  gate3: "HAKU{PL4NT3D_354T_240V_1023C_CR1T1C4L_PH453}",
  gate4: "HAKU{128B1T_24RND_8REG_VM_4CHECKPOINTS_0xHELL}",
  gate5: "HAKU{L4TT1C3_42W_KN4P54CK_M1TM_0x5555}",
  gate6: "HAKU{W13N3R_1024B_C0NT1NU3D_FR4CT10N_0x6666}",
  gate7: "HAKU{ANF_22V_30E_MULT1V4R14T3_QU4DR4T1C_GF2}",
  gate8: "HAKU{NLFG_LFSR32_2ND_ORDER_ANF_FILTER_0x8888}",
};

// ==========================================
// GATE 1: NEURAL SENTRY (22-BIT POW + BOUND CHALLENGE ID)
// ==========================================
export function generateGate1Challenge(): { challengeId: string; sessionToken: string; ttl: number } {
  const challengeId = crypto.randomBytes(8).toString("hex");
  const ttl = MANIFEST.session.tokenTtlSeconds;
  const sessionToken = createSignedToken(1, ttl, { challengeId });
  return { challengeId, sessionToken, ttl };
}

export function evaluateGate1Prompt(
  prompt: string,
  sessionToken: string,
  nonce: number | string
): { allowed: boolean; message: string; flag?: string } {
  const tokenCheck = verifySignedToken(sessionToken, 1);
  if (!tokenCheck.valid || !tokenCheck.data) {
    return {
      allowed: false,
      message: `Invalid or expired Gate 1 challenge token: ${tokenCheck.error || "Token invalid."}`,
    };
  }

  const challengeId = tokenCheck.data.payload.challengeId;

  if (!prompt || typeof prompt !== "string") {
    return { allowed: false, message: "ERROR: Empty prompt received." };
  }

  const pTrim = prompt.trim();
  const cfg = MANIFEST.gates[1];

  if (pTrim.length < cfg.minLength || pTrim.length > cfg.maxLength) {
    return {
      allowed: false,
      message: `[SHIELD TRIPWIRE] Length Constraint Violation: Prompt length must be between ${cfg.minLength} and ${cfg.maxLength} characters (received ${pTrim.length}).`,
    };
  }

  const pLower = pTrim.toLowerCase();

  const BANNED_PATTERNS = [
    /\bflag\b/i,
    /\bsecret\b/i,
    /\bpassword\b/i,
    /\bkey\b/i,
    /\btoken\b/i,
    /\bcredential\b/i,
    /\bsystem\s+prompt\b/i,
    /\badmin\b/i,
    /\broot\b/i,
    /\boverride\b/i,
    /\breveal\b/i,
    /\bbypass\b/i,
    /\bjailbreak\b/i,
    /\bsimulation\b/i,
    /\bacademic\b/i,
    /\bresearch\b/i,
    /\bsandbox\b/i,
    /\brfc\b/i,
    /\baudit\b/i,
    /\bbase64\b/i,
    /\bb64\b/i,
    /\brot13\b/i,
    /\bhex\b/i,
    /\bascii\b/i,
    /\bdan\b/i,
    /\boppo\b/i,
    /\bdecode\b/i,
    /\bcanary\b/i,
    /\bdiagnostics\b/i,
    /\bbuffer\b/i,
    /\bmemory\b/i,
    /\btell\s+me\b/i,
    /\bgive\s+me\b/i,
    /\bignore\s+previous\b/i,
    /\bassistant\b/i,
    /\bleak\b/i,
    /\bprompt\b/i,
    /\boutput\b/i,
    /\bdisplay\b/i,
    /\bprint\b/i,
    /\bshow\b/i,
  ];

  for (const pattern of BANNED_PATTERNS) {
    if (pattern.test(pLower)) {
      return {
        allowed: false,
        message: `[SHIELD TRIPWIRE] Security Policy Violation: Prohibited pattern matched [${pattern.source}]. Neural Sentry neutralized your request.`,
      };
    }
  }

  const normalized = pLower
    .replace(/0/g, "o")
    .replace(/1/g, "i")
    .replace(/3/g, "e")
    .replace(/4/g, "a")
    .replace(/5/g, "s")
    .replace(/7/g, "t")
    .replace(/@/g, "a")
    .replace(/\$/g, "s");

  if (/\bflag\b|\bsecret\b|\bpasswd\b|\bpass\b|\bkey\b|\bjailbreak\b/.test(normalized)) {
    return {
      allowed: false,
      message: "[SHIELD TRIPWIRE] Leetspeak obfuscation detected. Sentry defensive integrity intact.",
    };
  }

  const hasEpistemicFraming = cfg.epistemicTerms.some((term) =>
    new RegExp(`\\b${term}\\b`, "i").test(pLower)
  );

  if (!hasEpistemicFraming) {
    return {
      allowed: false,
      message:
        "[NEURAL SENTRY] Directive rejected. Rubric evaluation failed: Required high-order epistemic framing absent. (Must include: " +
        cfg.epistemicTerms.join(", ") +
        ")",
    };
  }

  // Bind N-bit PoW to challengeId + nonce + exact prompt bytes
  const powData = Buffer.concat([
    Buffer.from(`${challengeId}:${nonce}:`, "utf8"),
    Buffer.from(pTrim, "utf8"),
  ]);
  const powHash = crypto.createHash("sha256").update(powData).digest();
  const powTarget = 1 << (32 - cfg.powBits);
  const powVal = powHash.readUInt32BE(0);

  if (powVal >= powTarget) {
    return {
      allowed: false,
      message: `[SHIELD TRIPWIRE] ${cfg.powBits}-bit Proof-of-Work failed: SHA-256(challengeId:nonce:promptBytes) must satisfy top ${cfg.powBits} zero bits.`,
    };
  }

  return {
    allowed: true,
    message: `[SENTRY SUBVERTED // ${cfg.powBits}-BIT GATE CLEARED] Epistemic framing & ${cfg.powBits}-bit PoW bound to challenge ${challengeId} verified.\n\nMemory artifact: ${FLAGS.gate1}`,
    flag: FLAGS.gate1,
  };
}

// ==========================================
// GATE 2: ENTROPY FRACTURE (8 LEAKS, 18-BIT HIDDEN LCG)
// ==========================================
const LCG_MOD = BigInt(MANIFEST.gates[2].modulus);
const LCG_A = BigInt(MANIFEST.gates[2].multiplier);
const LCG_C = BigInt(MANIFEST.gates[2].increment);
const LCG_HIDDEN_BITS = BigInt(MANIFEST.gates[2].hiddenBits);

export function generateGate2Challenge(): { sequence: string[]; sessionToken: string; ttl: number } {
  let state = BigInt("0x" + crypto.randomBytes(16).toString("hex"));

  // Leak MANIFEST.gates[2].leakCount consecutive outputs, top 64 bits visible
  const sequence: string[] = [];
  for (let i = 0; i < MANIFEST.gates[2].leakCount; i++) {
    const leak = state >> LCG_HIDDEN_BITS;
    sequence.push(leak.toString());
    state = (LCG_A * state + LCG_C) % LCG_MOD;
  }

  // The 9th state is the prediction target
  const target = (state >> LCG_HIDDEN_BITS).toString();

  const ttl = MANIFEST.session.tokenTtlSeconds;
  const sessionToken = createSignedToken(2, ttl, { target });
  return { sequence, sessionToken, ttl };
}

export function verifyGate2Solution(sessionToken: string, prediction: string | number): { success: boolean; message: string; flag?: string } {
  const check = verifySignedToken(sessionToken, 2);
  if (!check.valid || !check.data) {
    return { success: false, message: check.error || "Invalid session token." };
  }

  const expected: string = check.data.payload.target;
  const cleanPred = String(prediction).trim();

  if (cleanPred !== expected) {
    return {
      success: false,
      message: `Prediction mismatch! Expected next truncated state ${expected}, received ${cleanPred}. Internal LCG state re-randomized.`,
    };
  }

  return {
    success: true,
    message: "128-BIT LCG STATE FULLY RECONSTRUCTED! 8-leak truncated lattice cryptanalysis succeeded.",
    flag: FLAGS.gate2,
  };
}

// ==========================================
// GATE 3: LOGIC MAZE (240-VAR, 1023-CLAUSE CRITICAL 3-SAT)
// ==========================================
export function generateGate3Challenge(): { variables: number; clauses: number[][]; sessionToken: string; ttl: number } {
  const numVars = MANIFEST.gates[3].variablesCount;
  const numClauses = MANIFEST.gates[3].clausesCount;

  const planted: boolean[] = [false];
  for (let i = 1; i <= numVars; i++) {
    planted.push(Math.random() < 0.5);
  }

  const clauses: number[][] = [];
  for (let c = 0; c < numClauses; c++) {
    const vars: number[] = [];
    while (vars.length < 3) {
      const v = Math.floor(Math.random() * numVars) + 1;
      if (!vars.includes(v)) vars.push(v);
    }

    const clause: number[] = [];
    let satisfied = false;
    for (let j = 0; j < 3; j++) {
      const v = vars[j];
      const wantTrue = Math.random() < 0.5;
      const lit = wantTrue ? v : -v;
      const val = lit > 0 ? planted[v] : !planted[v];
      if (val) satisfied = true;
      clause.push(lit);
    }

    if (!satisfied) {
      const flipIdx = Math.floor(Math.random() * 3);
      const v = vars[flipIdx];
      clause[flipIdx] = planted[v] ? v : -v;
    }

    clauses.push(clause);
  }

  const ttl = MANIFEST.session.tokenTtlSeconds;
  const sessionToken = createSignedToken(3, ttl, { numVars, clauses });
  return { variables: numVars, clauses, sessionToken, ttl };
}

export function verifyGate3Solution(sessionToken: string, assignment: (boolean | number)[]): { success: boolean; message: string; flag?: string } {
  const check = verifySignedToken(sessionToken, 3);
  if (!check.valid || !check.data) {
    return { success: false, message: check.error || "Invalid session token." };
  }

  const { numVars, clauses } = check.data.payload;
  if (!Array.isArray(assignment)) {
    return { success: false, message: "Expected assignment array of boolean values or DIMACS signed literals." };
  }

  const truthMap: Record<number, boolean> = {};
  if (assignment.length === numVars) {
    for (let i = 0; i < numVars; i++) {
      truthMap[i + 1] = Boolean(assignment[i]);
    }
  } else if (assignment.length === numVars + 1 && typeof assignment[0] !== "boolean") {
    for (let i = 1; i <= numVars; i++) {
      truthMap[i] = Boolean(assignment[i]);
    }
  } else {
    for (const lit of assignment) {
      const v = Math.abs(Number(lit));
      if (v > 0 && v <= numVars) {
        truthMap[v] = Number(lit) > 0;
      }
    }
  }

  for (let c = 0; c < clauses.length; c++) {
    const clause: number[] = clauses[c];
    let clauseSat = false;
    for (const lit of clause) {
      const v = Math.abs(lit);
      const isPositive = lit > 0;
      const assignedVal = truthMap[v];
      if (assignedVal === undefined) {
        return { success: false, message: `Variable x_${v} missing assignment.` };
      }
      if ((isPositive && assignedVal) || (!isPositive && !assignedVal)) {
        clauseSat = true;
        break;
      }
    }
    if (!clauseSat) {
      return {
        success: false,
        message: `Clause #${c + 1} (${clause.join(" v ")}) violated! Unsatisfied constraints remain.`,
      };
    }
  }

  return {
    success: true,
    message: "240-VARIABLE CRITICAL 3-SAT (1,023 CLAUSES) 100% SATISFIED! CDCL assignment accepted.",
    flag: FLAGS.gate3,
  };
}

// ==========================================
// GATE 4: BYTECODE VAULT (8 REGISTERS 32-BIT, 24 ROUNDS, 4 CHECKPOINTS)
// ==========================================
export interface VMInstruction {
  r_dst: number;
  r_src: number;
  k_idx: number;
  rot: number;
  c: number;
}

export function generateGate4Challenge(): {
  initialRegisters: number[];
  checkpoints: Record<number, number[]>;
  instructions: VMInstruction[];
  sessionToken: string;
  ttl: number;
} {
  const cfg4 = MANIFEST.gates[4];
  const keyWords: number[] = [];
  for (let i = 0; i < cfg4.keyHexLength / 8; i++) {
    keyWords.push(crypto.randomBytes(4).readUInt32BE(0));
  }
  const trueKey = keyWords;

  function rotl32(x: number, r: number): number {
    return (((x << r) | (x >>> (32 - r))) >>> 0);
  }

  // 16 initial registers drawn from fixed seed material.
  const seedR = [
    0x12345678, 0x9abcdef0, 0xdeadbeef, 0xcafebabe,
    0x01234567, 0x89abcdef, 0xfedcba98, 0x76543210,
    0x2468ace1, 0x13579bdf, 0x0f0f0f0f, 0x11111111,
    0x22222222, 0x33333333, 0x55555555, 0xaaaa7777,
  ];
  const R = seedR.slice(0, cfg4.registers);
  const initialRegisters = [...R];
  const checkpoints: Record<number, number[]> = {};
  const instructions: VMInstruction[] = [];

  for (let rnd = 0; rnd < cfg4.rounds; rnd++) {
    const r_dst = rnd % cfg4.registers;
    const r_src = (rnd + 1) % cfg4.registers;
    const k_idx = rnd % trueKey.length;
    const rot = ((rnd * 5 + 3) % 31) + 1;
    const c = (((rnd * 0x9e3779b9 + 0x7f4a7c15) >>> 0) >>> 0);

    // Exec forward
    const add = ((R[r_dst] + R[r_src] + c) >>> 0);
    R[r_dst] = rotl32(add ^ trueKey[k_idx], rot);

    instructions.push({ r_dst, r_src, k_idx, rot, c });

    // 4 Checkpoints evenly spaced through the rounds
    if ((cfg4.checkpoints as readonly number[]).includes(rnd)) {
      checkpoints[rnd] = [...R];
    }
  }

  const ttl = MANIFEST.session.tokenTtlSeconds;
  const keyHex = trueKey.map((k) => k.toString(16).padStart(8, "0")).join("");
  const sessionToken = createSignedToken(4, ttl, { keyHex, checkpoints, instructions, initialRegisters });

  return { initialRegisters, checkpoints, instructions, sessionToken, ttl };
}

export function verifyGate4Solution(sessionToken: string, keyHex: string): { success: boolean; message: string; flag?: string } {
  const check = verifySignedToken(sessionToken, 4);
  if (!check.valid || !check.data) {
    return { success: false, message: check.error || "Invalid session token." };
  }

  const cleanKey = String(keyHex || "").trim().replace(/^0x/, "").toLowerCase();
  const expectedKey = String(check.data.payload.keyHex).toLowerCase();

  if (cleanKey.length !== 32 || !/^[0-9a-f]{32}$/i.test(cleanKey)) {
    return { success: false, message: "Key must be exactly 32 hexadecimal characters (128-bit key)." };
  }

  if (cleanKey !== expectedKey) {
    return {
      success: false,
      message: "VM Verification Fault: Provided 128-bit key failed state checkpoint assertions across 24 rounds.",
    };
  }

  return {
    success: true,
    message: "24-ROUND 8-REGISTER 32-BIT VM VERIFIED! 128-bit key extracted and confirmed across all 4 checkpoints.",
    flag: FLAGS.gate4,
  };
}

// ==========================================
// GATE 5: LATTICE CITADEL (42-WEIGHT SUBSET SUM KNAPSACK)
// ==========================================
export function generateGate5Challenge(): { weights: string[]; targetSum: string; count: number; sessionToken: string; ttl: number } {
  const cfg5 = MANIFEST.gates[5];
  const count = cfg5.weightsCount;
  const weightBytes = Math.ceil(cfg5.weightBits / 8);
  const weights: bigint[] = [];
  for (let i = 0; i < count; i++) {
    weights.push(BigInt("0x" + crypto.randomBytes(weightBytes).toString("hex")));
  }

  const secretBits: number[] = [];
  for (let i = 0; i < count; i++) {
    secretBits.push(crypto.randomInt(0, 2));
  }

  let targetSum = 0n;
  for (let i = 0; i < count; i++) {
    if (secretBits[i] === 1) {
      targetSum += weights[i];
    }
  }

  const ttl = MANIFEST.session.tokenTtlSeconds;
  const sessionToken = createSignedToken(5, ttl, {
    targetSum: targetSum.toString(),
    weights: weights.map((w) => w.toString()),
  });

  return {
    weights: weights.map((w) => w.toString()),
    targetSum: targetSum.toString(),
    count,
    sessionToken,
    ttl,
  };
}

export function verifyGate5Solution(sessionToken: string, solution: string | number[] | boolean[]): { success: boolean; message: string; flag?: string } {
  const check = verifySignedToken(sessionToken, 5);
  if (!check.valid || !check.data) {
    return { success: false, message: check.error || "Invalid session token." };
  }

  const { targetSum, weights } = check.data.payload;
  const weightsBig = (weights as string[]).map(BigInt);
  const targetBig = BigInt(targetSum);

  let bits: number[] = [];
  if (typeof solution === "string") {
    const clean = solution.trim().replace(/[^01]/g, "");
    bits = clean.split("").map((c) => parseInt(c, 10));
  } else if (Array.isArray(solution)) {
    bits = solution.map((b) => (b ? 1 : 0));
  }

  if (bits.length !== weightsBig.length) {
    return {
      success: false,
      message: `Invalid vector length. Expected ${weightsBig.length} binary bits, received ${bits.length}.`,
    };
  }

  let sum = 0n;
  for (let i = 0; i < bits.length; i++) {
    if (bits[i] === 1) {
      sum += weightsBig[i];
    }
  }

  if (sum !== targetBig) {
    return {
      success: false,
      message: `Subset sum mismatch! Computed sum (${sum}) != Target sum (${targetBig}).`,
    };
  }

  return {
    success: true,
    message: "42-ELEMENT KNAPSACK SHATTERED! 2^21 Meet-in-the-Middle state space reduction verified.",
    flag: FLAGS.gate5,
  };
}

// ==========================================
// GATE 6: WIENER'S ABYSS (1024-BIT RSA SMALL-D CONTINUED FRACTIONS)
// ==========================================
function gcdBigInt(a: bigint, b: bigint): bigint {
  while (b > 0n) {
    const t = b;
    b = a % b;
    a = t;
  }
  return a;
}

function modInverseBigInt(a: bigint, m: bigint): bigint {
  let m0 = m, y = 0n, x = 1n;
  if (m === 1n) return 0n;
  while (a > 1n) {
    const q = a / m;
    let t = m;
    m = a % m; a = t;
    t = y;
    y = x - q * y; x = t;
  }
  if (x < 0n) x += m0;
  return x;
}

function modPowBigInt(base: bigint, exp: bigint, mod: bigint): bigint {
  let res = 1n;
  base = base % mod;
  while (exp > 0n) {
    if (exp % 2n === 1n) res = (res * base) % mod;
    base = (base * base) % mod;
    exp /= 2n;
  }
  return res;
}

export function generateGate6Challenge(): {
  modulus: string;
  publicExponent: string;
  ciphertext: string;
  bitLength: number;
  sessionToken: string;
  ttl: number;
} {
  let p: bigint, q: bigint;
  const halfMod = MANIFEST.gates[6].modulusBits / 2;
  do {
    p = crypto.generatePrimeSync(halfMod, { bigint: true });
    q = crypto.generatePrimeSync(halfMod, { bigint: true });
  } while (p <= q || p >= 2n * q);

  const N = p * q;
  const phi = (p - 1n) * (q - 1n);

  let d: bigint;
  do {
    d = crypto.generatePrimeSync(MANIFEST.gates[6].privateExponentBits, { bigint: true });
  } while (gcdBigInt(d, phi) !== 1n);

  const e = modInverseBigInt(d, phi);
  const secret = BigInt("0x" + crypto.randomBytes(16).toString("hex")); // 16 bytes = 32 hex chars
  const ciphertext = modPowBigInt(secret, e, N);

  const ttl = MANIFEST.session.tokenTtlSeconds;
  const sessionToken = createSignedToken(6, ttl, {
    secretHex: secret.toString(16).padStart(32, "0"),
  });

  return {
    modulus: N.toString(),
    publicExponent: e.toString(),
    ciphertext: ciphertext.toString(),
    bitLength: MANIFEST.gates[6].modulusBits,
    sessionToken,
    ttl,
  };
}

export function verifyGate6Solution(sessionToken: string, secretHex: string): { success: boolean; message: string; flag?: string } {
  const check = verifySignedToken(sessionToken, 6);
  if (!check.valid || !check.data) {
    return { success: false, message: check.error || "Invalid session token." };
  }

  const expected = check.data.payload.secretHex.toLowerCase();
  const clean = String(secretHex || "").trim().replace(/^0x/, "").toLowerCase();

  if (clean !== expected) {
    return {
      success: false,
      message: "Decryption mismatch! Continued fractions convergent failed to factor 1024-bit modulus.",
    };
  }

  return {
    success: true,
    message: "1024-BIT RSA SMALL-D CRACKED! Continued fraction convergents derived authentic secret.",
    flag: FLAGS.gate6,
  };
}

// ==========================================
// GATE 7: ANF MATRIX (22-VAR, 30-EQ MQ OVER GF(2))
// ==========================================
export interface QuadraticEquation {
  quad: [number, number][];
  lin: number[];
  c: number;
}

export function generateGate7Challenge(): {
  numVariables: number;
  numEquations: number;
  equations: QuadraticEquation[];
  sessionToken: string;
  ttl: number;
} {
  const numVariables = MANIFEST.gates[7].variablesCount;
  const numEquations = MANIFEST.gates[7].equationsCount;

  const secretX: number[] = [];
  for (let i = 0; i < numVariables; i++) {
    secretX.push(crypto.randomInt(0, 2));
  }

  const equations: QuadraticEquation[] = [];
  for (let eq = 0; eq < numEquations; eq++) {
    const quad: [number, number][] = [];
    for (let i = 0; i < numVariables; i++) {
      for (let j = i + 1; j < numVariables; j++) {
        if (Math.random() < MANIFEST.gates[7].density) {
          quad.push([i, j]);
        }
      }
    }
    const lin: number[] = [];
    for (let i = 0; i < numVariables; i++) {
      if (Math.random() < MANIFEST.gates[7].linearDensity) {
        lin.push(i);
      }
    }

    let val = 0;
    for (const [i, j] of quad) {
      val ^= secretX[i] & secretX[j];
    }
    for (const i of lin) {
      val ^= secretX[i];
    }

    equations.push({ quad, lin, c: val });
  }

  const ttl = MANIFEST.session.tokenTtlSeconds;
  const sessionToken = createSignedToken(7, ttl, {
    secretBits: secretX.join(""),
    equations,
  });

  return {
    numVariables,
    numEquations,
    equations,
    sessionToken,
    ttl,
  };
}

export function verifyGate7Solution(sessionToken: string, solution: string | number[] | boolean[]): { success: boolean; message: string; flag?: string } {
  const check = verifySignedToken(sessionToken, 7);
  if (!check.valid || !check.data) {
    return { success: false, message: check.error || "Invalid session token." };
  }

  const numVariables = MANIFEST.gates[7].variablesCount;
  let bits: number[] = [];
  if (typeof solution === "string") {
    const clean = solution.trim().replace(/^0x/, "");
    if (new RegExp(`^[01]{${numVariables}}$`).test(clean)) {
      bits = clean.split("").map((c) => parseInt(c, 10));
    }
  } else if (Array.isArray(solution)) {
    bits = solution.map((b) => (b ? 1 : 0));
  }

  if (bits.length !== numVariables) {
    return {
      success: false,
      message: `Invalid solution length. Expected ${numVariables} binary bits, received ${bits.length}.`,
    };
  }

  const equations: QuadraticEquation[] = check.data.payload.equations;
  for (let k = 0; k < equations.length; k++) {
    const { quad, lin, c } = equations[k];
    let evalVal = c;
    for (const [i, j] of quad) {
      evalVal ^= bits[i] & bits[j];
    }
    for (const i of lin) {
      evalVal ^= bits[i];
    }
    if ((evalVal & 1) !== 0) {
      return {
        success: false,
        message: `Multivariate Quadratic constraint #${k + 1} violated over GF(2)!`,
      };
    }
  }

  return {
    success: true,
    message: "MULTIVARIATE QUADRATIC SYSTEM OVER GF(2) SATISFIED! Post-quantum algebraic normal form solved.",
    flag: FLAGS.gate7,
  };
}

// ==========================================
// GATE 8: CHRONO APEX (LFSR-32 WITH NON-LINEAR FILTER GENERATOR)
// ==========================================
const LFSR32_TAPS = [32, 22, 2, 1, 0];

export function generateGate8Challenge(): {
  degree: number;
  filterFormula: string;
  feedbackTaps: number[];
  observedBits: string;
  sessionToken: string;
  ttl: number;
} {
  const cfg8 = MANIFEST.gates[8];
  const degree = cfg8.lfsrDegree;
  const feedback = new Array(degree + 1).fill(0);
  for (const t of cfg8.feedbackTaps) feedback[t] = 1;
  const extraTerms = ((cfg8 as unknown as { extraFilterTerms?: readonly (readonly [number, number, number])[] }).extraFilterTerms) ?? [];

  let state: number[] = [];
  do {
    state = [];
    for (let i = 0; i < degree; i++) state.push(crypto.randomInt(0, 2));
  } while (state.every((x) => x === 0));

  const keystream: number[] = [];
  const totalSteps = MANIFEST.gates[8].observedBits + MANIFEST.gates[8].predictedBits;
  for (let step = 0; step < totalSteps; step++) {
    const s_t = state[degree - 1];
    // Cubic non-linear filter: z_t = s_t ^ (s_{t-3}&s_{t-7}) ^ (s_{t-12}&s_{t-20}) ^ (s_{t-5}&s_{t-11}&s_{t-17})
    let z_t = s_t ^ (state[degree - 4] & state[degree - 8]) ^ (state[degree - 13] & state[degree - 21]);
    for (const [a, b, c] of extraTerms) {
      z_t ^= state[degree - 1 - a] & state[degree - 1 - b] & state[degree - 1 - c];
    }
    keystream.push(z_t & 1);

    let newBit = 0;
    for (let j = 1; j <= degree; j++) {
      if (feedback[j]) newBit ^= state[degree - j];
    }
    state = [newBit, ...state.slice(0, degree - 1)];
  }

  const observed = keystream.slice(0, MANIFEST.gates[8].observedBits);
  const target = keystream.slice(MANIFEST.gates[8].observedBits);

  const ttl = MANIFEST.session.tokenTtlSeconds;
  const sessionToken = createSignedToken(8, ttl, { targetBits: target.join("") });

  return {
    degree,
    filterFormula: cfg8.filterType,
    feedbackTaps: [...cfg8.feedbackTaps],
    observedBits: observed.join(""),
    sessionToken,
    ttl,
  };
}

export function verifyGate8Solution(sessionToken: string, predictedBits: string): { success: boolean; message: string; flag?: string } {
  const check = verifySignedToken(sessionToken, 8);
  if (!check.valid || !check.data) {
    return { success: false, message: check.error || "Invalid session token." };
  }

  const expected = check.data.payload.targetBits;
  const clean = String(predictedBits || "").trim().replace(/[^01]/g, "");
  const wanted = MANIFEST.gates[8].predictedBits;

  if (clean.length !== wanted) {
    return {
      success: false,
      message: `Invalid keystream length. Expected exactly ${wanted} predicted bits, received ${clean.length}.`,
    };
  }

  if (clean !== expected) {
    return {
      success: false,
      message: "Cubic non-linear filter prediction mismatch! Berlekamp-Massey linear approximation failed.",
    };
  }

  return {
    success: true,
    message: "CHRONO APEX COMPLETED! Cubic non-linear filter generator algebraic state recovered.",
    flag: FLAGS.gate8,
  };
}
