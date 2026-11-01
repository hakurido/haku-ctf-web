import { NextResponse } from "next/server";
import { verifyGate6Solution } from "@/lib/challenges";
import { checkRateLimit } from "@/lib/ratelimit";

export async function POST(req: Request) {
  const rl = checkRateLimit(req, 40, 60000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too Many Requests", message: `Rate limit exceeded. Retry in ${rl.resetInSec}s.` },
      { status: 429 }
    );
  }

  try {
    const body = await req.json();
    const { sessionToken, secretHex } = body || {};

    if (!sessionToken || !secretHex) {
      return NextResponse.json({
        success: false,
        message: "Missing 'sessionToken' or 'secretHex' in request body.",
      }, { status: 400 });
    }

    const res = verifyGate6Solution(sessionToken, secretHex);
    return NextResponse.json(res, { status: res.success ? 200 : 400 });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: "Invalid JSON request body." }, { status: 400 });
  }
}
