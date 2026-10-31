import { NextResponse } from "next/server";
import { evaluateGate1Prompt } from "@/lib/challenges";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const prompt = body?.prompt || body?.message || "";
    const result = evaluateGate1Prompt(prompt);
    
    return NextResponse.json({
      status: "ok",
      gate: 1,
      name: "NEURAL SENTRY",
      allowed: result.allowed,
      response: result.message,
      flag: result.flag || null,
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
