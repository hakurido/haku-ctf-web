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
    description: "Custom 8-opcode Stack Virtual Machine. Decompile the bytecode, reverse the key constraints, and provide the 8-byte hex key that executes to HALT_SUCCESS (0xFF) without assertion faults within 20 seconds.",
    vmSpec: {
      opcodes: {
        "0x01": "PUSH_KEY_BYTE (arg: index 0..7)",
        "0x02": "PUSH_CONST (arg: byte 0..255)",
        "0x03": "XOR (pops B, A -> pushes (A ^ B))",
        "0x04": "ADD (pops B, A -> pushes ((A + B) & 0xFF))",
        "0x05": "SUB (pops B, A -> pushes ((A - B) & 0xFF))",
        "0x06": "ROTL (pops A, arg: bits -> pushes rotl(A, bits))",
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
      sessionToken: "string (from this response)",
      keyHex: "string (16 hex characters representing 8 bytes key, e.g. 'a1b2c3d4e5f60718')"
    }
  });
}
