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
    description: "Degree-32 Linear Feedback Shift Register with quadratic non-linear filter generator z_t = s_t ^ (s_{t-3} & s_{t-7}) ^ (s_{t-12} & s_{t-20}). Solvable via Algebraic SMT Attack (Z3) in < 0.2s; immune to standard Berlekamp-Massey.",
    degree: challenge.degree,
    filterFormula: challenge.filterFormula,
    feedbackTaps: challenge.feedbackTaps,
    observedBits: challenge.observedBits,
    sessionToken: challenge.sessionToken,
    ttlSeconds: challenge.ttl,
    submitEndpoint: "POST /api/gate8/submit",
    payloadSchema: {
      sessionToken: "string",
      predictedBits: "string (32 binary characters '0' and '1' representing next 32 keystream bits)"
    }
  });
}
