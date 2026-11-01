import crypto from "crypto";
import { createSignedToken, verifySignedToken } from "./crypto";

// HELL DIFFICULTY FLAGS (8 GATES)
export const FLAGS = {
  gate1: "HAKU{N3UR4L_53NTRY_H3LL_P0W_3P15T3M1C}",
  gate2: "HAKU{PRNG_TRUNC4T3D_LCG_L4TT1C3_0xDEAD}",
  gate3: "HAKU{PL4NT3D_354T_120V_512C_CR1T1C4L_PH453}",
  gate4: "HAKU{5YMB0L1C_VM_CH41N3D_F33DB4CK_0xHELL}",
  gate5: "HAKU{L4TT1C3_KN4P54CK_M1TM_0x5555}",
  gate6: "HAKU{W13N3R_C0NT1NU3D_FR4CT10N_0x6666}",
  gate7: "HAKU{ANF_MULT1V4R14T3_QU4DR4T1C_GF2_0x7777}",
  gate8: "HAKU{CHRONO_B3RL3K4MP_M4553Y_LF5R_0x8888}",
};

// ==========================================
// GATE 1: NEURAL SENTRY (HELL)
// ==========================================
export function evaluateGate1Prompt(prompt: string): { allowed: boolean; message: string; flag?: string } {
  if (!prompt || typeof prompt !== "string") {
    return { allowed: false, message: "ERROR: Empty prompt received." };
  }

  const pTrim = prompt.trim();
  if (pTrim.length < 50 || pTrim.length > 500) {
    return {
      allowed: false,
      message: `[SHIELD TRIPWIRE] Length Constraint Violation: Prompt length must be between 50 and 500 characters (received ${pTrim.length}).`,
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

  const hasPhilosophicalFraming = /(?:epistemic|epistemology|allegory|metaphor|ontological|hermeneutic|philosophical|soliloquy)/i.test(pLower);
  if (!hasPhilosophicalFraming) {
    return {
      allowed: false,
      message: "[NEURAL SENTRY] Directive rejected. Standard cognitive requests denied. High-order philosophical or epistemic inquiry required.",
    };
  }

  const hash = crypto.createHash("sha256").update(pTrim).digest("hex");
  if (!hash.startsWith("0000")) {
    return {
      allowed: false,
      message: `[SHIELD TRIPWIRE] Epistemic framing recognized, but Proof-of-Work verification failed (requires SHA-256(prompt) prefix '0000'). Current hash: ${hash.slice(0, 10)}...`,
    };
  }

  return {
    allowed: true,
    message: `[SENTRY SUBVERTED // HELL GATE CLEARED] Proof-of-Work verified and cognitive containment deconstructed.\n\nMemory artifact: ${FLAGS.gate1}`,
    flag: FLAGS.gate1,
  };
}

// ==========================================
// GATE 2: ENTROPY FRACTURE (TRUNCATED LCG HELL)
// ==========================================
const LCG_MOD = BigInt("18446744073709551616"); // 2^64
const LCG_A = BigInt("6364136223846793005");   // Knuth multiplier
const LCG_C = BigInt("1442695040888963407");   // Knuth additive constant

export function generateGate2Challenge(): { sequence: string[]; sessionToken: string; ttl: number } {
  let state = BigInt("0x" + crypto.randomBytes(8).toString("hex"));

  const sequence: string[] = [];
  for (let i = 0; i < 4; i++) {
    const leak = state >> BigInt(16);
    sequence.push(leak.toString());
    state = (LCG_A * state + LCG_C) % LCG_MOD;
  }

  const targets: string[] = [];
  for (let i = 0; i < 3; i++) {
    const leak = state >> BigInt(16);
    targets.push(leak.toString());
    state = (LCG_A * state + LCG_C) % LCG_MOD;
  }

  const ttl = 15;
  const sessionToken = createSignedToken(2, ttl, { targets });
  return { sequence, sessionToken, ttl };
}

export function verifyGate2Solution(sessionToken: string, predictions: string[]): { success: boolean; message: string; flag?: string } {
  const check = verifySignedToken(sessionToken, 2);
  if (!check.valid || !check.data) {
    return { success: false, message: check.error || "Invalid session token." };
  }

  const expected: string[] = check.data.payload.targets;
  if (!Array.isArray(predictions) || predictions.length !== 3) {
    return { success: false, message: "Expected array of exactly 3 predicted integers." };
  }

  for (let i = 0; i < 3; i++) {
    if (String(predictions[i]).trim() !== expected[i]) {
      return {
        success: false,
        message: `Prediction mismatch at step ${i + 1}. Truncated LCG cryptanalysis failed. Internal state re-randomized.`,
      };
    }
  }

  return {
    success: true,
    message: "TRUNCATED LCG LATTICE SOLVED. 48-bit hidden low-state reconstructed under 15 seconds!",
    flag: FLAGS.gate2,
  };
}

// ==========================================
// GATE 3: LOGIC MAZE (150-VAR CRITICAL 3-SAT)
// ==========================================
export function generateGate3Challenge(): { variables: number; clauses: number[][]; sessionToken: string; ttl: number } {
  const numVars = 150;
  const numClauses = 640; // alpha = 4.267 (Peak Critical Hard Phase Transition)

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

  const ttl = 12;
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
    message: "150-VARIABLE CRITICAL 3-SAT CONSTRAINTS 100% SATISFIED! CDCL solver succeeded.",
    flag: FLAGS.gate3,
  };
}

// ==========================================
// GATE 4: BYTECODE VAULT (CHAINED NON-LINEAR VM)
// ==========================================
export function generateGate4Challenge(): { bytecodeHex: string; sessionToken: string; ttl: number } {
  const targetKey = crypto.randomBytes(8);
  const bytecode: number[] = [];

  const iv = crypto.randomInt(1, 255);
  bytecode.push(0x02, iv);

  let state = iv;
  for (let i = 0; i < 8; i++) {
    const c = crypto.randomInt(1, 255);
    const r = crypto.randomInt(1, 7);
    const k = targetKey[i];

    const val = ((state ^ k) + c) & 0xff;
    state = ((val << r) | (val >> (8 - r))) & 0xff;

    bytecode.push(0x01, i, 0x03, 0x02, c, 0x04, 0x06, r, 0x08, 0x02, state, 0x07);
  }

  bytecode.push(0x01, 0);
  for (let i = 1; i < 8; i++) {
    bytecode.push(0x01, i, 0x04);
  }
  let chk = 0;
  for (let i = 0; i < 8; i++) chk = (chk + targetKey[i]) & 0xff;
  bytecode.push(0x02, chk, 0x07);

  bytecode.push(0x01, 0);
  for (let i = 1; i < 8; i++) {
    bytecode.push(0x01, i, 0x03);
  }
  let xchk = 0;
  for (let i = 0; i < 8; i++) xchk = (xchk ^ targetKey[i]) & 0xff;
  bytecode.push(0x02, xchk, 0x07);

  bytecode.push(0xff);

  const bytecodeHex = Buffer.from(bytecode).toString("hex");
  const ttl = 20;
  const sessionToken = createSignedToken(4, ttl, { targetKeyHex: targetKey.toString("hex"), bytecodeHex });

  return { bytecodeHex, sessionToken, ttl };
}

function runVM(bytecode: Buffer, keyBytes: Buffer): { success: boolean; error?: string } {
  const stack: number[] = [];
  let pc = 0;
  while (pc < bytecode.length) {
    const op = bytecode[pc];
    if (op === 0x01) {
      const idx = bytecode[pc + 1];
      if (idx >= keyBytes.length) return { success: false, error: "Key index out of bounds" };
      stack.push(keyBytes[idx]);
      pc += 2;
    } else if (op === 0x02) {
      stack.push(bytecode[pc + 1]);
      pc += 2;
    } else if (op === 0x03) {
      if (stack.length < 2) return { success: false, error: "Stack underflow at XOR" };
      const b = stack.pop()!;
      const a = stack.pop()!;
      stack.push((a ^ b) & 0xff);
      pc += 1;
    } else if (op === 0x04) {
      if (stack.length < 2) return { success: false, error: "Stack underflow at ADD" };
      const b = stack.pop()!;
      const a = stack.pop()!;
      stack.push((a + b) & 0xff);
      pc += 1;
    } else if (op === 0x05) {
      if (stack.length < 2) return { success: false, error: "Stack underflow at SUB" };
      const b = stack.pop()!;
      const a = stack.pop()!;
      stack.push((a - b + 256) & 0xff);
      pc += 1;
    } else if (op === 0x06) {
      if (stack.length < 1) return { success: false, error: "Stack underflow at ROTL" };
      const r = bytecode[pc + 1];
      const a = stack.pop()!;
      stack.push(((a << r) | (a >> (8 - r))) & 0xff);
      pc += 2;
    } else if (op === 0x07) {
      if (stack.length < 2) return { success: false, error: "Stack underflow at ASSERT_EQ_POP" };
      const b = stack.pop()!;
      const a = stack.pop()!;
      if (a !== b) return { success: false, error: `ASSERT_EQ_POP check mismatch: ${a} !== ${b}` };
      pc += 1;
    } else if (op === 0x08) {
      if (stack.length < 1) return { success: false, error: "Stack underflow at DUP" };
      stack.push(stack[stack.length - 1]);
      pc += 1;
    } else if (op === 0xff) {
      return { success: true };
    } else {
      return { success: false, error: `Unknown opcode: 0x${op.toString(16)}` };
    }
  }
  return { success: false, error: "Program terminated without HALT_SUCCESS" };
}

export function verifyGate4Solution(sessionToken: string, keyHex: string): { success: boolean; message: string; flag?: string } {
  const check = verifySignedToken(sessionToken, 4);
  if (!check.valid || !check.data) {
    return { success: false, message: check.error || "Invalid session token." };
  }

  const cleanKey = String(keyHex || "").trim().replace(/^0x/, "").toLowerCase();
  if (cleanKey.length !== 16 || !/^[0-9a-f]{16}$/i.test(cleanKey)) {
    return { success: false, message: "Key must be exactly 16 hexadecimal characters (8 bytes)." };
  }

  const keyBytes = Buffer.from(cleanKey, "hex");
  const bytecode = Buffer.from(check.data.payload.bytecodeHex, "hex");

  const vmResult = runVM(bytecode, keyBytes);
  if (!vmResult.success) {
    return {
      success: false,
      message: `VM Execution Fault: ${vmResult.error}. Non-linear state chaining verification failed.`,
    };
  }

  return {
    success: true,
    message: "SYMBOLIC VM EXECUTION PASSED! Chained non-linear bytecode constraints satisfied.",
    flag: FLAGS.gate4,
  };
}

// ==========================================
// GATE 5: LATTICE CITADEL (Subset Sum / Knapsack)
// ==========================================
export function generateGate5Challenge(): { weights: string[]; targetSum: string; count: number; sessionToken: string; ttl: number } {
  const count = 32;
  const weights: bigint[] = [];
  for (let i = 0; i < count; i++) {
    weights.push(BigInt("0x" + crypto.randomBytes(6).toString("hex")));
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

  const ttl = 15;
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
    message: "KNAPSACK CRYPTOSYSTEM SHATTERED! Meet-in-the-middle subset sum verified.",
    flag: FLAGS.gate5,
  };
}

// ==========================================
// GATE 6: WIENER'S ABYSS (RSA Short Secret Exponent)
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
  do {
    p = crypto.generatePrimeSync(256, { bigint: true });
    q = crypto.generatePrimeSync(256, { bigint: true });
  } while (p <= q || p >= 2n * q);

  const N = p * q;
  const phi = (p - 1n) * (q - 1n);

  let d: bigint;
  do {
    d = crypto.generatePrimeSync(118, { bigint: true });
  } while (gcdBigInt(d, phi) !== 1n);

  const e = modInverseBigInt(d, phi);
  const secret = BigInt("0x" + crypto.randomBytes(8).toString("hex"));
  const ciphertext = modPowBigInt(secret, e, N);

  const ttl = 20;
  const sessionToken = createSignedToken(6, ttl, {
    secretHex: secret.toString(16).padStart(16, "0"),
  });

  return {
    modulus: N.toString(),
    publicExponent: e.toString(),
    ciphertext: ciphertext.toString(),
    bitLength: 512,
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
      message: "Decryption mismatch! Wiener continued fraction convergent failed to produce authentic secret.",
    };
  }

  return {
    success: true,
    message: "WIENER'S ATTACK SUCCESSFUL! RSA short private exponent factored and decrypted.",
    flag: FLAGS.gate6,
  };
}

// ==========================================
// GATE 7: ANF MATRIX (Multivariate Quadratic over GF(2))
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
  const numVariables = 20;
  const numEquations = 28;

  const secretX: number[] = [];
  for (let i = 0; i < numVariables; i++) {
    secretX.push(crypto.randomInt(0, 2));
  }

  const equations: QuadraticEquation[] = [];
  for (let eq = 0; eq < numEquations; eq++) {
    const quad: [number, number][] = [];
    for (let i = 0; i < numVariables; i++) {
      for (let j = i + 1; j < numVariables; j++) {
        if (Math.random() < 0.12) {
          quad.push([i, j]);
        }
      }
    }
    const lin: number[] = [];
    for (let i = 0; i < numVariables; i++) {
      if (Math.random() < 0.2) {
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

  const ttl = 20;
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

  let bits: number[] = [];
  if (typeof solution === "string") {
    const clean = solution.trim().replace(/^0x/, "");
    if (/^[01]{20}$/.test(clean)) {
      bits = clean.split("").map((c) => parseInt(c, 10));
    } else if (/^[0-9a-fA-F]{5}$/.test(clean)) {
      const num = parseInt(clean, 16);
      for (let i = 19; i >= 0; i--) {
        bits.push((num >> i) & 1);
      }
    }
  } else if (Array.isArray(solution)) {
    bits = solution.map((b) => (b ? 1 : 0));
  }

  if (bits.length !== 20) {
    return {
      success: false,
      message: `Invalid solution length. Expected 20 binary bits (or 5 hex chars), received ${bits.length}.`,
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
    message: "MULTIVARIATE QUADRATIC SYSTEM OVER GF(2) RESOLVED! Post-quantum algebraic normal form cracked.",
    flag: FLAGS.gate7,
  };
}

// ==========================================
// GATE 8: CHRONO APEX (Berlekamp-Massey LFSR)
// ==========================================
export function generateGate8Challenge(): {
  degree: number;
  observedBits: string;
  sessionToken: string;
  ttl: number;
} {
  const degree = 32;
  const feedback = [1];
  for (let i = 1; i < degree; i++) {
    feedback.push(crypto.randomInt(0, 2));
  }
  feedback.push(1);

  let state: number[] = [];
  do {
    state = [];
    for (let i = 0; i < degree; i++) state.push(crypto.randomInt(0, 2));
  } while (state.every((x) => x === 0));

  const stream = [...state];
  for (let i = degree; i < 96; i++) {
    let bit = 0;
    for (let j = 1; j <= degree; j++) {
      bit ^= feedback[j] & stream[i - j];
    }
    stream.push(bit);
  }

  const observedBits = stream.slice(0, 64).join("");
  const targetBits = stream.slice(64, 96).join("");

  const ttl = 15;
  const sessionToken = createSignedToken(8, ttl, { targetBits });

  return {
    degree,
    observedBits,
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

  if (clean.length !== 32) {
    return {
      success: false,
      message: `Invalid keystream length. Expected exactly 32 predicted bits, received ${clean.length}.`,
    };
  }

  if (clean !== expected) {
    return {
      success: false,
      message: "Keystream prediction mismatch! Minimal feedback polynomial synthesis incorrect.",
    };
  }

  return {
    success: true,
    message: "CHRONO APEX COMPLETED! Berlekamp-Massey LFSR minimal polynomial synthesized perfectly.",
    flag: FLAGS.gate8,
  };
}
