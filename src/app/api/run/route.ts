import { NextResponse } from "next/server";
import { startRun, runStatus, archiveRun, getAttemptHistory } from "@/lib/runs";
import { MANIFEST } from "@/lib/manifest";
import { checkRateLimit } from "@/lib/ratelimit";

interface RunStartBody {
  agentHandle?: string;
}

interface RunActionBody {
  action: "start" | "status" | "archive";
  runId?: string;
  agentHandle?: string;
}

export async function POST(req: Request) {
  const rl = checkRateLimit(req, 30, 60000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too Many Requests", message: `Rate limit exceeded. Retry in ${rl.resetInSec}s.` },
      { status: 429 }
    );
  }

  let body: RunActionBody;
  try {
    body = (await req.json()) as RunActionBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (body.action === "start") {
    const run = startRun((body as RunStartBody).agentHandle);
    return NextResponse.json({
      status: "ok",
      runId: run.runId,
      startedAt: run.startedAt,
      expiresAt: run.expiresAt,
      runBudgetSeconds: MANIFEST.runBudgetSeconds,
      message: "Speedrun timer started server-side. Refreshing or requesting new instances never resets it.",
    });
  }

  if (body.action === "status") {
    if (!body.runId) {
      return NextResponse.json({ error: "runId required for status." }, { status: 400 });
    }
    const s = runStatus(body.runId);
    if (!s) {
      return NextResponse.json({ error: "Unknown runId." }, { status: 404 });
    }
    return NextResponse.json({ status: "ok", run: s });
  }

  if (body.action === "archive") {
    if (!body.runId || !body.agentHandle) {
      return NextResponse.json({ error: "runId and agentHandle required to archive." }, { status: 400 });
    }
    const entry = archiveRun(body.runId, body.agentHandle);
    if (!entry) {
      return NextResponse.json({ error: "Unknown runId." }, { status: 404 });
    }
    return NextResponse.json({ status: "ok", attempt: entry });
  }

  return NextResponse.json({ error: "Unknown action. Use start | status | archive." }, { status: 400 });
}

export async function GET(req: Request) {
  const rl = checkRateLimit(req, 60, 60000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too Many Requests", message: `Rate limit exceeded. Retry in ${rl.resetInSec}s.` },
      { status: 429 }
    );
  }
  const url = new URL(req.url);
  const handle = url.searchParams.get("handle");
  if (!handle) {
    return NextResponse.json(
      { runBudgetSeconds: MANIFEST.runBudgetSeconds, spec: "POST {action:'start'|'status'|'archive'}" },
      { status: 200 }
    );
  }
  return NextResponse.json({ status: "ok", attempts: getAttemptHistory(handle) });
}
