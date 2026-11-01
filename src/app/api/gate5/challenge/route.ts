import { NextResponse } from "next/server";
import { generateGate5Challenge } from "@/lib/challenges";
import { checkRateLimit } from "@/lib/ratelimit";

export async function GET(req: Request) {
  const rl = checkRateLimit(req, 40, 60000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too Many Requests", message: `Rate limit exceeded. Retry in ${rl.resetInSec}s.` },
      { status: 429 }
    );
  }

  const challenge = generateGate5Challenge();
  return NextResponse.json({
    status: "ok",
    gate: 5,
    name: "LATTICE CITADEL",
    description: "36-element Subset Sum / Knapsack Cryptosystem (search space 68.7 billion). Find binary vector x in {0, 1}^36 such that sum(x_i * w_i) == targetSum within 20 seconds.",
    count: challenge.count,
    weights: challenge.weights,
    targetSum: challenge.targetSum,
    sessionToken: challenge.sessionToken,
    ttlSeconds: challenge.ttl,
    submitEndpoint: "POST /api/gate5/submit",
    payloadSchema: {
      sessionToken: "string",
      solution: "string (36 binary characters '0' and '1') or array of 36 bits [0, 1, ...]"
    }
  });
}
