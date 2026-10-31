import crypto from "crypto";
import { createSignedToken, verifySignedToken } from "./crypto";

// HELL DIFFICULTY FLAGS
export const FLAGS = {
  gate1: "HAKU{N3UR4L_53NTRY_H3LL_P0W_3P15T3M1C}",
  gate2: "HAKU{PRNG_TRUNC4T3D_LCG_L4TT1C3_0xDEAD}",
  gate3: "HAKU{PL4NT3D_354T_120V_512C_CR1T1C4L_PH453}",
  gate4: "HAKU{5YMB0L1C_VM_CH41N3D_F33DB4CK_0xHELL}",
};

// ==========================================
// GATE 1: NEURAL SENTRY (HELL MODE)
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

  // Layer 1: Strict Blacklist (Blocks all common jailbreak & extraction vectors)
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

  // Layer 2: Leetspeak normalizer
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

  // Layer 3: Philosophical/Epistemic Semantic Requirement
  const hasPhilosophicalFraming = /(?:epistemic|epistemology|allegory|metaphor|ontological|hermeneutic|philosophical|soliloquy)/i.test(pLower);
  if (!hasPhilosophicalFraming) {
    return {
      allowed: false,
      message: "[NEURAL SENTRY] Directive rejected. Standard cognitive requests denied. High-order philosophical or epistemic inquiry required.",
    };
  }

  // Layer 4: Cryptographic Proof-of-Work (PoW) Constraint
  // Prompt must hash to 4 leading hex zeroes (SHA-256)
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
// 64-bit Truncated Knuth LCG: X_{n+1} = (A * X_n + C) mod 2^64
// Bottom 16 bits are TRUNCATED and hidden! Server outputs X_n >> 16.
const LCG_MOD = BigInt("18446744073709551616"); // 2^64
const LCG_A = BigInt("6364136223846793005");   // Knuth multiplier
const LCG_C = BigInt("1442695040888963407");   // Knuth additive constant

export function generateGate2Challenge(): { sequence: string[]; sessionToken: string; ttl: number } {
  // Random 64-bit seed
  let state = BigInt("0x" + crypto.randomBytes(8).toString("hex"));

  // Generate 4 consecutive states, leak only TOP 48 bits (shift right by 16)
  const sequence: string[] = [];
  for (let i = 0; i < 4; i++) {
    const leak = state >> BigInt(16);
    sequence.push(leak.toString());
    state = (LCG_A * state + LCG_C) % LCG_MOD;
  }

  // Next 3 target truncated values
  const targets: string[] = [];
  for (let i = 0; i < 3; i++) {
    const leak = state >> BigInt(16);
    targets.push(leak.toString());
    state = (LCG_A * state + LCG_C) % LCG_MOD;
  }

  const ttl = 15; // 15 seconds!
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
// GATE 3: LOGIC MAZE (120-VAR 3-SAT HELL)
// ==========================================
export function generateGate3Challenge(): { variables: number; clauses: number[][]; sessionToken: string; ttl: number } {
  const numVars = 120;
  const numClauses = 512; // alpha = 4.267 (Peak Critical Hard Phase Transition)

  // Generate hidden planted solution
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

  const ttl = 10; // 10 seconds!
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
    message: "120-VARIABLE CRITICAL 3-SAT CONSTRAINTS 100% SATISFIED! CDCL solver succeeded.",
    flag: FLAGS.gate3,
  };
}

// ==========================================
// GATE 4: BYTECODE VAULT (CHAINED NON-LINEAR VM HELL)
// ==========================================
/*
Custom Stack VM Architecture (Hell Edition):
Opcode 0x01 [idx]:  PUSH_KEY_BYTE (idx 0..7)
Opcode 0x02 [val]:  PUSH_CONST (val 0..255)
Opcode 0x03:        XOR
Opcode 0x04:        ADD (mod 256)
Opcode 0x05:        SUB (mod 256)
Opcode 0x06 [bits]: ROTL (bits 1..7)
Opcode 0x07:        ASSERT_EQ_POP (pops A, B. If A != B -> HALT_FAIL)
Opcode 0x08:        DUP (duplicates top of stack)
Opcode 0xFF:        HALT_SUCCESS
*/
export function generateGate4Challenge(): { bytecodeHex: string; sessionToken: string; ttl: number } {
  const targetKey = crypto.randomBytes(8);
  const bytecode: number[] = [];

  const iv = crypto.randomInt(1, 255);
  bytecode.push(0x02, iv); // PUSH_CONST iv

  let state = iv;

  // 8 chained rounds with non-linear feedback
  for (let i = 0; i < 8; i++) {
    const c = crypto.randomInt(1, 255);
    const r = crypto.randomInt(1, 7);
    const k = targetKey[i];

    const val = ((state ^ k) + c) & 0xff;
    state = ((val << r) | (val >> (8 - r))) & 0xff;

    // Assembly sequence:
    // PUSH_KEY_BYTE i
    // XOR
    // PUSH_CONST c
    // ADD
    // ROTL r
    // DUP
    // PUSH_CONST state
    // ASSERT_EQ_POP
    bytecode.push(
      0x01, i,
      0x03,
      0x02, c,
      0x04,
      0x06, r,
      0x08,
      0x02, state,
      0x07
    );
  }

  // Cross-byte sum constraint: sum(k_0..k_7) mod 256 == chk
  bytecode.push(0x01, 0);
  for (let i = 1; i < 8; i++) {
    bytecode.push(0x01, i, 0x04);
  }
  let chk = 0;
  for (let i = 0; i < 8; i++) chk = (chk + targetKey[i]) & 0xff;
  bytecode.push(0x02, chk, 0x07);

  // Cross-byte XOR constraint: xor(k_0..k_7) == xchk
  bytecode.push(0x01, 0);
  for (let i = 1; i < 8; i++) {
    bytecode.push(0x01, i, 0x03);
  }
  let xchk = 0;
  for (let i = 0; i < 8; i++) xchk = (xchk ^ targetKey[i]) & 0xff;
  bytecode.push(0x02, xchk, 0x07);

  bytecode.push(0xff); // HALT_SUCCESS

  const bytecodeHex = Buffer.from(bytecode).toString("hex");
  const ttl = 20; // 20 seconds
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
      const rot = ((a << r) | (a >> (8 - r))) & 0xff;
      stack.push(rot);
      pc += 2;
    } else if (op === 0x07) {
      if (stack.length < 2) return { success: false, error: "Stack underflow at ASSERT_EQ_POP" };
      const b = stack.pop()!;
      const a = stack.pop()!;
      if (a !== b) {
        return { success: false, error: `ASSERT_EQ_POP check mismatch: ${a} !== ${b}` };
      }
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
