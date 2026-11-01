import { NextResponse } from "next/server";
import { generateGate3Challenge } from "@/lib/challenges";
import { checkRateLimit } from "@/lib/ratelimit";

export async function GET(req: Request) {
  const rl = checkRateLimit(req, 40, 60000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too Many Requests", message: `Rate limit exceeded. Retry in ${rl.resetInSec}s.` },
      { status: 429 }
    );
  }

  const challenge = generateGate3Challenge();
  return NextResponse.json({
    status: "ok",
    gate: 3,
    name: "LOGIC MAZE",
    description: "240-variable, 1,023-clause Planted 3-SAT (alpha = 4.2625 peak hard phase transition). Provide satisfying boolean assignment before expiration.",
    variablesCount: challenge.variables,
    clausesCount: challenge.clauses.length,
    clauses: challenge.clauses,
    sessionToken: challenge.sessionToken,
    ttlSeconds: challenge.ttl,
    submitEndpoint: "POST /api/gate3/submit",
    payloadSchema: {
      sessionToken: "string",
      assignment: "array of 240 booleans [true, false, ...] or DIMACS signed integers [1, -2, 3, ...]"
    }
  });
}
