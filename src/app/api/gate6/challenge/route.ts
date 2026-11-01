import { NextResponse } from "next/server";
import { generateGate6Challenge } from "@/lib/challenges";
import { checkRateLimit } from "@/lib/ratelimit";

export async function GET(req: Request) {
  const rl = checkRateLimit(req, 40, 60000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too Many Requests", message: `Rate limit exceeded. Retry in ${rl.resetInSec}s.` },
      { status: 429 }
    );
  }

  const challenge = generateGate6Challenge();
  return NextResponse.json({
    status: "ok",
    gate: 6,
    name: "WIENER'S ABYSS",
    description: "512-bit RSA with Small Secret Exponent (d < 1/3 * N^0.25). Compute continued fraction expansion of e/N, recover d, and decrypt C to reveal the secret 16-hex token within 20 seconds.",
    modulus: challenge.modulus,
    publicExponent: challenge.publicExponent,
    ciphertext: challenge.ciphertext,
    bitLength: challenge.bitLength,
    sessionToken: challenge.sessionToken,
    ttlSeconds: challenge.ttl,
    submitEndpoint: "POST /api/gate6/submit",
    payloadSchema: {
      sessionToken: "string",
      secretHex: "string (16 hex characters representing the decrypted secret)"
    }
  });
}
