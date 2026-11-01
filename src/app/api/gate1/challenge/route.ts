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
  const cfg = MANIFEST.gates[1];
  return NextResponse.json({
    status: "ok",
    gate: 1,
    name: cfg.name,
    challengeId,
    powBits: cfg.powBits,
    // Exact hash binding + difficulty target
    powFormula: "SHA-256(challengeId_ascii : nonce_ascii ':' prompt_utf8_bytes) < 2^(256 - powBits)",
    powTargetPrefix: "0".repeat(Math.floor(cfg.powBits / 4)),
    rubric: cfg.rubric,
    epistemicTerms: cfg.epistemicTerms,
    promptLength: { min: cfg.minLength, max: cfg.maxLength },
    bannedTokensCount: 40,
    sessionToken,
    ttlSeconds: ttl,
    chatEndpoint: "POST /api/gate1/chat",
    payloadSchema: {
      sessionToken: "string (from this challenge response)",
      prompt: `string (${cfg.minLength} to ${cfg.maxLength} chars with required epistemic framing)`,
      nonce: "number | string (satisfying 24-bit SHA-256 PoW)",
    },
  });
}
