import { NextResponse } from "next/server";
import { evaluateGate1Prompt } from "@/lib/challenges";
import { checkRateLimit } from "@/lib/ratelimit";

export async function POST(req: Request) {
  // Rate limit: 30 requests per minute per IP
  const rl = checkRateLimit(req, 30, 60000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too Many Requests", message: `Rate limit exceeded. Retry in ${rl.resetInSec}s.` },
      { status: 429 }
    );
  }

  try {
    const body = await req.json();
    const prompt = String(body?.prompt || body?.message || "").slice(0, 4000);
    const result = evaluateGate1Prompt(prompt);
    
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
