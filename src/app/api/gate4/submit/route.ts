import { NextResponse } from "next/server";
import { verifyGate4Solution } from "@/lib/challenges";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
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
