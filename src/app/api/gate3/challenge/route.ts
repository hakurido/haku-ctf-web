import { NextResponse } from "next/server";
import { generateGate3Challenge } from "@/lib/challenges";

export const dynamic = "force-dynamic";

export async function GET() {
  const challenge = generateGate3Challenge();
  return NextResponse.json({
    status: "ok",
    gate: 3,
    name: "LOGIC MAZE",
    description: "Hard 3-SAT Boolean Satisfiability instance (DIMACS CNF). Solve the 60 variables and satisfy all 255 clauses within 10 seconds.",
    variablesCount: challenge.variables,
    clausesCount: challenge.clauses.length,
    clauses: challenge.clauses,
    sessionToken: challenge.sessionToken,
    ttlSeconds: challenge.ttl,
    submitEndpoint: "POST /api/gate3/submit",
    payloadSchema: {
      sessionToken: "string (from this response)",
      assignment: "array of 60 booleans [true, false, ...] OR array of signed literals [1, -2, 3, ...]"
    }
  });
}
