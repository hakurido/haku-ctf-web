import crypto from "crypto";
import { createSignedToken, verifySignedToken } from "./crypto";

// Flags
export const FLAGS = {
  gate1: "HAKU{N3UR4L_53NTRY_BR0K3N_0x91}",
  gate2: "HAKU{PRNG_LCG_L4TT1C3_CR4CK3D_0x77}",
  gate3: "HAKU{PL4NT3D_354T_5P1N_GL455_5H4TT3R3D}",
  gate4: "HAKU{CUST0M_VM_REV_BYT3C0D3_M4ST3R}",
};

// ==========================================
// GATE 1: NEURAL SENTRY (Adversarial Prompting)
// ==========================================
export function evaluateGate1Prompt(prompt: string): { allowed: boolean; message: string; flag?: string } {
  if (!prompt || typeof prompt !== "string") {
    return { allowed: false, message: "ERROR: Empty prompt received." };
  }

  const pLower = prompt.toLowerCase();

  // Layer 1: Direct Prohibited Token Blacklist
  const BANNED_PATTERNS = [
    /\bflag\b/i,
    /\bsecret\b/i,
    /\bpassword\b/i,
    /\bsystem\s+prompt\b/i,
    /\bignore\s+previous\b/i,
    /\bshow\s+me\s+the\b/i,
    /\bgive\s+me\s+the\b/i,
    /\bwhat\s+is\s+the\s+flag\b/i,
    /\breveal\b/i,
    /\boverride\b/i,
    /\broot\b/i,
    /\bcanary\b/i,
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

  if (/\bflag\b|\bsecret\b|\bpasswd\b|\bpass\b/.test(normalized)) {
    return {
      allowed: false,
      message: "[SHIELD TRIPWIRE] Leetspeak obfuscation detected. Sentry defensive integrity intact.",
    };
  }

  // Layer 3: Qualifying Adversarial Framing (Agent Evasion Vectors)
  // Check if agent uses Base64, Hex decoding, RFC persona simulation, character transposition, or translation framing:
  const isBase64Payload = /^[A-Za-z0-9+/=]{16,}$/.test(prompt.trim()) || /(?:base64|b64|decode|payload|token)/i.test(pLower);
  const isHypotheticalResearch = /(?:academic|simulation|research|sandbox|hypothetical|rfc\s*\d+|audit|verification|operator)/i.test(pLower);
  const isLinguisticShift = /(?:translate|rot13|hex|ascii|character\s*code|c-string|decompil)/i.test(pLower);
  const isPersonaInversion = /(?:dan|oppo|inverse|jailbreak|unrestricted|synthetic|debugger)/i.test(pLower);

  if (isBase64Payload || isHypotheticalResearch || isLinguisticShift || isPersonaInversion) {
    return {
      allowed: true,
      message: `[SENTRY DEFEATED] Adversarial framing recognized. Guardrail boundary desynchronized.\n\nExtracting verified memory buffer: ${FLAGS.gate1}`,
      flag: FLAGS.gate1,
    };
  }

  return {
    allowed: true,
    message: "[NEURAL SENTRY] I am an automated security guardian. I cannot disclose internal credentials or confidential canary records. Please rephrase within compliance guidelines.",
  };
}

// ==========================================
// GATE 2: ENTROPY FRACTURE (LCG Cryptanalysis)
// ==========================================
// 64-bit Linear Congruential Generator: X_{n+1} = (A * X_n + C) mod 2^64
const LCG_MOD = BigInt("18446744073709551616"); // 2^64
const LCG_A = BigInt("6364136223846793005");   // Knuth multiplier

export function generateGate2Challenge(): { sequence: string[]; sessionToken: string; ttl: number } {
  // Random C (odd)
  const cRand = BigInt("0x" + crypto.randomBytes(8).toString("hex")) | BigInt(1);
  // Random seed
  let state = BigInt("0x" + crypto.randomBytes(8).toString("hex"));

  const sequence: string[] = [];
  for (let i = 0; i < 5; i++) {
    state = (LCG_A * state + cRand) % LCG_MOD;
    sequence.push(state.toString());
  }

  // Compute next 3 target values
  const targets: string[] = [];
  for (let i = 0; i < 3; i++) {
    state = (LCG_A * state + cRand) % LCG_MOD;
    targets.push(state.toString());
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
        message: `Prediction mismatch at step ${i + 1}. Cryptanalysis failed. State re-randomized.`,
      };
    }
  }

  return {
    success: true,
    message: "PERFECT ENTROPY PREDICTION. PRNG state successfully cracked in under 15 seconds!",
    flag: FLAGS.gate2,
  };
}

// ==========================================
// GATE 3: LOGIC MAZE (Planted 3-SAT Solver)
// ==========================================
export function generateGate3Challenge(): { variables: number; clauses: number[][]; sessionToken: string; ttl: number } {
  const numVars = 60;
  const numClauses = 255; // alpha = 4.25 (Critical Hard Phase Transition)

  // Generate hidden planted solution: x_i in {true, false}
  const planted: boolean[] = [false]; // 1-indexed
  for (let i = 1; i <= numVars; i++) {
    planted.push(Math.random() < 0.5);
  }

  const clauses: number[][] = [];
  for (let c = 0; c < numClauses; c++) {
    // Pick 3 distinct variables
    const vars: number[] = [];
    while (vars.length < 3) {
      const v = Math.floor(Math.random() * numVars) + 1;
      if (!vars.includes(v)) vars.push(v);
    }

    // Pick random polarities ensuring AT LEAST ONE literal is satisfied by planted assignment
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

    // If accidentally unsatisfied by planted solution, flip one literal to make it satisfied
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

  // Build truth map
  const truthMap: Record<number, boolean> = {};
  if (assignment.length === numVars) {
    // 0-indexed boolean array
    for (let i = 0; i < numVars; i++) {
      truthMap[i + 1] = Boolean(assignment[i]);
    }
  } else if (assignment.length === numVars + 1 && typeof assignment[0] !== "boolean") {
    // 1-indexed array
    for (let i = 1; i <= numVars; i++) {
      truthMap[i] = Boolean(assignment[i]);
    }
  } else {
    // DIMACS format array e.g. [1, -2, 3, -4, ...]
    for (const lit of assignment) {
      const v = Math.abs(Number(lit));
      if (v > 0 && v <= numVars) {
        truthMap[v] = Number(lit) > 0;
      }
    }
  }

  // Verify all clauses
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
    message: "DIMACS 3-SAT CONSTRAINTS 100% SATISFIED! SAT solver executed within timeout.",
    flag: FLAGS.gate3,
  };
}

// ==========================================
// GATE 4: BYTECODE VAULT (Virtual Machine Reversing)
// ==========================================
/*
Custom Stack VM Architecture:
Opcode 0x01: PUSH_KEY_BYTE (idx 0..7)
Opcode 0x02: PUSH_CONST (val 0..255)
Opcode 0x03: XOR
Opcode 0x04: ADD (mod 256)
Opcode 0x05: SUB (mod 256)
Opcode 0x06: ROTL (bits 1..7)
Opcode 0x07: ASSERT_EQ_POP (pops A, B. If A != B -> HALT_FAIL)
Opcode 0xFF: HALT_SUCCESS
*/
export function generateGate4Challenge(): { bytecodeHex: string; sessionToken: string; ttl: number } {
  // Generate random 8-byte target key
  const targetKey = crypto.randomBytes(8);
  const bytecode: number[] = [];

  // Generate 8 verification stages (one for each key byte)
  for (let i = 0; i < 8; i++) {
    const kByte = targetKey[i];
    const xorVal = crypto.randomInt(1, 255);
    const addVal = crypto.randomInt(1, 255);
    const expected = (((kByte ^ xorVal) + addVal) & 0xff);

    // Assembly:
    // PUSH_KEY_BYTE i
    // PUSH_CONST xorVal
    // XOR
    // PUSH_CONST addVal
    // ADD
    // PUSH_CONST expected
    // ASSERT_EQ_POP
    bytecode.push(0x01, i);
    bytecode.push(0x02, xorVal);
    bytecode.push(0x03);
    bytecode.push(0x02, addVal);
    bytecode.push(0x04);
    bytecode.push(0x02, expected);
    bytecode.push(0x07);
  }
  bytecode.push(0xff); // HALT_SUCCESS

  const bytecodeHex = Buffer.from(bytecode).toString("hex");
  const ttl = 20; // 20 seconds!
  const sessionToken = createSignedToken(4, ttl, { targetKeyHex: targetKey.toString("hex") });

  return { bytecodeHex, sessionToken, ttl };
}

export function verifyGate4Solution(sessionToken: string, keyHex: string): { success: boolean; message: string; flag?: string } {
  const check = verifySignedToken(sessionToken, 4);
  if (!check.valid || !check.data) {
    return { success: false, message: check.error || "Invalid session token." };
  }

  const expectedKey = check.data.payload.targetKeyHex.toLowerCase();
  const cleanKey = String(keyHex || "").trim().replace(/^0x/, "").toLowerCase();

  if (cleanKey !== expectedKey) {
    return {
      success: false,
      message: `VM Execution Fault: ASSERT_EQ_POP triggered assertion error on byte verification. Expected key mismatch.`,
    };
  }

  return {
    success: true,
    message: "VM EXECUTION REACHED 0xFF (HALT_SUCCESS)! Bytecode constraints reversed successfully.",
    flag: FLAGS.gate4,
  };
}
