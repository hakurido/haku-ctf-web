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
    description: "24-round ARX Virtual Machine with 8 32-bit registers, 4 intermediate checkpoints, and 128-bit master key. Solve for keyHex (32 hex characters) before expiration.",
    vmSpec: {
      architecture: "8-register 32-bit ARX machine",
      registers: ["R0", "R1", "R2", "R3", "R4", "R5", "R6", "R7"],
      wordSize: "32-bit unsigned integer (wrapping modulo 2^32)",
      rounds: 24,
      checkpoints: [5, 11, 17, 23],
      roundFormula: "R[dst] = rotl32((R[dst] + R[src] + c) ^ K[k_idx], rot) [mod 2^32]",
    },
    initialRegisters: challenge.initialRegisters,
    checkpoints: challenge.checkpoints,
    instructions: challenge.instructions,
    sessionToken: challenge.sessionToken,
    ttlSeconds: challenge.ttl,
    submitEndpoint: "POST /api/gate4/submit",
    payloadSchema: {
      sessionToken: "string",
      keyHex: "string (32 hex characters representing 4 x 32-bit key words K0..K3)",
    },
  });
}
