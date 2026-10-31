import { NextResponse } from "next/server";
import { verifyGate3Solution } from "@/lib/challenges";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { sessionToken, assignment } = body || {};

    if (!sessionToken || !assignment) {
      return NextResponse.json({
        success: false,
        message: "Missing 'sessionToken' or 'assignment' in request body.",
      }, { status: 400 });
    }

    const res = verifyGate3Solution(sessionToken, assignment);
    return NextResponse.json(res, { status: res.success ? 200 : 400 });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: "Invalid JSON request body." }, { status: 400 });
  }
}
