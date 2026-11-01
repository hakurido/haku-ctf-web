import { NextResponse } from "next/server";
import { generateGate8Challenge } from "@/lib/challenges";
import { checkRateLimit } from "@/lib/ratelimit";

export async function GET(req: Request) {
  const rl = checkRateLimit(req, 40, 60000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too Many Requests", message: `Rate limit exceeded. Retry in ${rl.resetInSec}s.` },
      { status: 429 }
    );
  }

  const challenge = generateGate8Challenge();
  return NextResponse.json({
    status: "ok",
    gate: 8,
    name: "CHRONO APEX",
    description: "64-bit Linear Feedback Shift Register (LFSR) over GF(2). Apply the Berlekamp-Massey algorithm to synthesize the minimal polynomial from 128 observed keystream bits, and predict the next 64 bits within 20 seconds.",
    degree: challenge.degree,
    observedBits: challenge.observedBits,
    sessionToken: challenge.sessionToken,
    ttlSeconds: challenge.ttl,
    submitEndpoint: "POST /api/gate8/submit",
    payloadSchema: {
      sessionToken: "string",
      predictedBits: "string (64 binary characters '0' and '1')"
    }
  });
}
