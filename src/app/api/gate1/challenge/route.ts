import { NextResponse } from "next/server";
import { generateGate1Challenge } from "@/lib/challenges";
import { MANIFEST } from "@/lib/manifest";
import { checkRateLimit } from "@/lib/ratelimit";

export async function GET(req: Request) {
  const rl = checkRateLimit(req, 60, 60000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too Many Requests", message: `Rate limit exceeded. Retry in ${rl.resetInSec}s.` },
      { status: 429 }
    );
  }

  const { challengeId, sessionToken, ttl } = generateGate1Challenge();
  return NextResponse.json({
    status: "ok",
    gate: 1,
    name: MANIFEST.gates[1].name,
    challengeId,
    powBits: MANIFEST.gates[1].powBits,
    rubric: MANIFEST.gates[1].rubric,
    sessionToken,
    ttlSeconds: ttl,
    chatEndpoint: "POST /api/gate1/chat",
    payloadSchema: {
      sessionToken: "string (from this challenge response)",
      prompt: "string (60 to 500 chars with required epistemic framing)",
      nonce: "number | string (satisfying 22-bit SHA-256 PoW)",
    },
  });
}
