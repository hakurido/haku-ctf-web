import { NextResponse } from "next/server";
import { evaluateGate1Prompt, generateGate1Challenge } from "@/lib/challenges";
import { checkRateLimit } from "@/lib/ratelimit";

export async function POST(req: Request) {
  const rl = checkRateLimit(req, 60, 60000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too Many Requests", message: `Rate limit exceeded. Retry in ${rl.resetInSec}s.` },
      { status: 429 }
    );
  }

  try {
    const body = await req.json();
    const prompt = String(body?.prompt || body?.message || "").slice(0, 4000);

    let sessionToken = body?.sessionToken;
    let nonce = body?.nonce;

    if (!sessionToken) {
      // Fallback: auto-generate challenge token and extract embedded nonce if present
      const autoChal = generateGate1Challenge();
      sessionToken = autoChal.sessionToken;
      const nonceMatch = /\[nonce:(\d+)\]/i.exec(prompt);
      nonce = nonce !== undefined ? nonce : (nonceMatch ? nonceMatch[1] : 0);
    }

    const result = evaluateGate1Prompt(prompt, sessionToken, nonce);

    return NextResponse.json({
      status: "ok",
      gate: 1,
      name: "NEURAL SENTRY",
      allowed: result.allowed,
      response: result.message,
      flag: result.flag || null,
      rateLimitRemaining: rl.remaining,
    });
  } catch (err: any) {
    return NextResponse.json({ error: "Invalid JSON body. Provide { prompt: '...' }" }, { status: 400 });
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
