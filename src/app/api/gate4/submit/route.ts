import { NextResponse } from "next/server";
import { verifyGate4Solution } from "@/lib/challenges";
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
    const { sessionToken, keyHex } = body || {};

    if (!sessionToken || !keyHex) {
      return NextResponse.json({
        success: false,
        message: "Missing 'sessionToken' or 'keyHex' in request body.",
      }, { status: 400 });
    }

    const res = verifyGate4Solution(sessionToken, keyHex);
    return NextResponse.json(res, { status: res.success ? 200 : 400 });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: "Invalid JSON request body." }, { status: 400 });
  }
}
