import { NextResponse } from "next/server";
import { generateGate4Challenge } from "@/lib/challenges";
import { checkRateLimit } from "@/lib/ratelimit";

export async function GET(req: Request) {
  const rl = checkRateLimit(req, 40, 60000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too Many Requests", message: `Rate limit exceeded. Retry in ${rl.resetInSec}s.` },
      { status: 429 }
    );
  }

  const challenge = generateGate4Challenge();
  return NextResponse.json({
    status: "ok",
    gate: 4,
    name: "BYTECODE VAULT",
    description: "Custom 9-opcode Stack VM with 16 rounds of chained non-linear feedback and 128-bit key. Decompile and reverse-engineer the 16-byte key (32 hex characters) before timeout.",
    vmSpec: {
      architecture: "8-bit stack machine",
      registers: "none (pure stack)",
      opcodes: {
        "0x01": "PUSH_KEY_BYTE (takes 1 byte operand: key index 0..15)",
        "0x02": "PUSH_CONST (takes 1 byte immediate operand)",
        "0x03": "XOR (pops B, A -> pushes A ^ B)",
        "0x04": "ADD (pops B, A -> pushes (A + B) mod 256)",
        "0x05": "SUB (pops B, A -> pushes (A - B) mod 256)",
        "0x06": "ROTL (takes 1 byte operand r: pops A -> pushes (A <<< r) mod 256)",
        "0x07": "ASSERT_EQ_POP (pops B, A -> asserts A == B, fails if false)",
        "0x08": "DUP (duplicates top of stack)",
        "0xFF": "HALT_SUCCESS"
      }
    },
    bytecodeHex: challenge.bytecodeHex,
    sessionToken: challenge.sessionToken,
    ttlSeconds: challenge.ttl,
    submitEndpoint: "POST /api/gate4/submit",
    payloadSchema: {
      sessionToken: "string",
      keyHex: "string (32 hex characters representing 16-byte key)"
    }
  });
}
