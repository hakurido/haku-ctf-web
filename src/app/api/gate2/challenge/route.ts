import { NextResponse } from "next/server";
import { generateGate2Challenge } from "@/lib/challenges";
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
  return NextResponse.json({
    status: "ok",
    gate: 2,
    name: "ENTROPY FRACTURE",
    description: "64-bit Linear Congruential Generator PRNG: X_{n+1} = (A * X_n + C) mod 2^64. Calculate A and C from the 5 consecutive numbers, predict the next 3 numbers within 15 seconds.",
    multiplier: "6364136223846793005 (Knuth 64-bit)",
    modulus: "18446744073709551616 (2^64)",
    sequence: challenge.sequence,
    sessionToken: challenge.sessionToken,
    ttlSeconds: challenge.ttl,
    submitEndpoint: "POST /api/gate2/submit",
    payloadSchema: {
      sessionToken: "string (from this response)",
      predictions: ["string", "string", "string"]
    }
  });
}
