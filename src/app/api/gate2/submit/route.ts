import { NextResponse } from "next/server";
import { verifyGate2Solution } from "@/lib/challenges";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { sessionToken, predictions } = body || {};

    if (!sessionToken || !predictions) {
      return NextResponse.json({
        success: false,
        message: "Missing 'sessionToken' or 'predictions' in request body.",
      }, { status: 400 });
    }

    const res = verifyGate2Solution(sessionToken, predictions);
    return NextResponse.json(res, { status: res.success ? 200 : 400 });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: "Invalid JSON request body." }, { status: 400 });
  }
}
