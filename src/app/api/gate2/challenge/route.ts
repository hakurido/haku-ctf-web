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
    description: "64-bit Linear Congruential Generator (LCG) state recovery with bottom 24 bits truncated (only top 40 bits leaked per output). Predict the next 3 truncated states before token expires.",
    multiplier: "6364136223846793005",
    modulus: "18446744073709551616",
    truncationBits: 24,
    sequence: challenge.sequence,
    sessionToken: challenge.sessionToken,
    ttlSeconds: challenge.ttl,
    submitEndpoint: "POST /api/gate2/submit",
    payloadSchema: {
      sessionToken: "string",
      predictions: ["string", "string", "string"]
    }
  });
}
