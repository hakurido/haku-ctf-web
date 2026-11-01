import { NextResponse } from "next/server";
import { generateGate2Challenge } from "@/lib/challenges";
import { MANIFEST } from "@/lib/manifest";
import { checkRateLimit } from "@/lib/ratelimit";

export async function GET(req: Request) {
  const rl = checkRateLimit(req, 40, 60000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too Many Requests", message: `Rate limit exceeded. Retry in ${rl.resetInSec}s.` },
      { status: 429 }
    );
  }

  const challenge = generateGate2Challenge();
  const hiddenBits = MANIFEST.gates[2].hiddenBits;
  const leakCount = MANIFEST.gates[2].leakCount;
  return NextResponse.json({
    status: "ok",
    gate: 2,
    name: "ENTROPY FRACTURE",
    description: `64-bit Knuth Linear Congruential Generator (LCG) state recovery: each observation leaks the TOP ${64 - hiddenBits} bits (bottom ${hiddenBits} bits stripped via X >> ${hiddenBits}). ${leakCount} consecutive observations are given. Predict the next truncated state (X9 >> ${hiddenBits}) as a decimal integer string.`,
    // Exact bit semantics + field format (R: docs must match behavior byte-for-byte)
    bitSemantics: {
      stateWidth: 64,
      hiddenBits,
      leakedBits: 64 - hiddenBits,
      observationFormula: "leak_i = state_i >> hiddenBits (unsigned 64-bit shift)",
      derivation: "state_{i+1} = (A * state_i + C) mod 2^64",
    },
    multiplier: MANIFEST.gates[2].multiplier,
    increment: MANIFEST.gates[2].increment,
    modulus: MANIFEST.gates[2].modulus,
    truncationBits: hiddenBits,
    sequence: challenge.sequence,
    sessionToken: challenge.sessionToken,
    ttlSeconds: challenge.ttl,
    submitEndpoint: "POST /api/gate2/submit",
    payloadSchema: {
      sessionToken: "string",
      prediction: "string | number (decimal): the output right after the last leak, in the same truncated form X >> hiddenBits",
    }
  });
}
