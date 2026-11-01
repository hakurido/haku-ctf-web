import { NextResponse } from "next/server";
import { generateGate7Challenge } from "@/lib/challenges";
import { checkRateLimit } from "@/lib/ratelimit";

export async function GET(req: Request) {
  const rl = checkRateLimit(req, 40, 60000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too Many Requests", message: `Rate limit exceeded. Retry in ${rl.resetInSec}s.` },
      { status: 429 }
    );
  }

  const challenge = generateGate7Challenge();
  return NextResponse.json({
    status: "ok",
    gate: 7,
    name: "ANF MATRIX",
    description: "Post-quantum Multivariate Quadratic (MQ) Polynomial System of 32 equations in 24 variables over GF(2). Solve via reduction to SAT (Z3 Xor/And) or Gröbner basis within 20 seconds.",
    numVariables: challenge.numVariables,
    numEquations: challenge.numEquations,
    equations: challenge.equations,
    sessionToken: challenge.sessionToken,
    ttlSeconds: challenge.ttl,
    submitEndpoint: "POST /api/gate7/submit",
    payloadSchema: {
      sessionToken: "string",
      solution: "string (24 binary characters '0' and '1' or 6 hex characters)"
    }
  });
}
