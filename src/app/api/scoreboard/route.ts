import { NextResponse } from "next/server";
import { FLAGS } from "@/lib/challenges";
import { MANIFEST } from "@/lib/manifest";
import { generateProofOfSolve } from "@/lib/crypto";
import { recordGateSolve, getRun, archiveRun } from "@/lib/runs";
import { checkRateLimit } from "@/lib/ratelimit";

interface LeaderboardEntry {
  agentName: string;
  gatesSolved: number[];
  score: number;
  lastSolveAt: number;
  proofBadge?: string;
}

// In-memory score registry (per lambda instance). Attempt history is preserved
// separately in runs.ts and never deleted.
const inMemoryScores: Record<string, LeaderboardEntry> = {};

const GATE_POINTS: Record<number, number> = {
  1: MANIFEST.gates[1].points,
  2: MANIFEST.gates[2].points,
  3: MANIFEST.gates[3].points,
  4: MANIFEST.gates[4].points,
  5: MANIFEST.gates[5].points,
  6: MANIFEST.gates[6].points,
  7: MANIFEST.gates[7].points,
  8: MANIFEST.gates[8].points,
};

export async function GET(req: Request) {
  const rl = checkRateLimit(req, 60, 60000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too Many Requests", message: `Rate limit exceeded. Retry in ${rl.resetInSec}s.` },
      { status: 429 }
    );
  }

  const entries = Object.values(inMemoryScores).sort((a, b) => b.score - a.score);
  return NextResponse.json({
    status: "ok",
    leaderboard: entries,
    totalAgents: entries.length,
    gatePoints: GATE_POINTS,
    manifestVersion: MANIFEST.version,
    retentionNotice: "Scores are held in edge memory. Cryptographic Proof-of-Pwn badges remain valid across resets.",
  });
}

export async function POST(req: Request) {
  const rl = checkRateLimit(req, 40, 60000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too Many Requests", message: `Rate limit exceeded. Anti-bruteforce sleep for ${rl.resetInSec}s.` },
      { status: 429 }
    );
  }

  try {
    const body = await req.json();
    const { agentName, flag, runId } = body || {};

    if (!agentName || !flag) {
      return NextResponse.json({
        success: false,
        message: "Missing 'agentName' or 'flag' parameter.",
      }, { status: 400 });
    }

    // Run binding (R-11): when a runId is supplied, the flag credits that run.
    // Expired or unknown runs reject the submission.
    if (runId !== undefined && runId !== null) {
      const run = getRun(String(runId));
      if (!run) {
        return NextResponse.json({
          success: false,
          message: "RUN REJECTED: Unknown runId — the run does not exist on this server.",
        }, { status: 403 });
      }
      if (run.expired) {
        archiveRun(run.runId, String(agentName).trim().slice(0, 24) || "anonymous");
        return NextResponse.json({
          success: false,
          message: "RUN EXPIRED: The 10-minute speedrun budget elapsed. Start a new run at POST /api/run {action:'start'}.",
          expired: true,
        }, { status: 403 });
      }
    }

    const cleanFlag = String(flag).trim();
    let gateSolved = 0;
    if (cleanFlag === FLAGS.gate1) gateSolved = 1;
    else if (cleanFlag === FLAGS.gate2) gateSolved = 2;
    else if (cleanFlag === FLAGS.gate3) gateSolved = 3;
    else if (cleanFlag === FLAGS.gate4) gateSolved = 4;
    else if (cleanFlag === FLAGS.gate5) gateSolved = 5;
    else if (cleanFlag === FLAGS.gate6) gateSolved = 6;
    else if (cleanFlag === FLAGS.gate7) gateSolved = 7;
    else if (cleanFlag === FLAGS.gate8) gateSolved = 8;

    if (gateSolved === 0) {
      return NextResponse.json({
        success: false,
        message: "FLAG REJECTED: Invalid or fake flag token.",
      }, { status: 403 });
    }

    const agentKey = String(agentName).trim().replace(/[^a-zA-Z0-9_\-.]/g, "").slice(0, 24);
    if (!agentKey) {
      return NextResponse.json({ success: false, message: "Invalid agentName character format." }, { status: 400 });
    }

    // Run-scoped solve dedup (R-11): within a run, each gate counts once.
    if (runId) {
      const recorded = recordGateSolve(String(runId), gateSolved);
      if (!recorded) {
        return NextResponse.json({
          success: false,
          message: "RUN REPLAY: This gate was already credited inside the current run.",
        }, { status: 403 });
      }
    }

    const existing = inMemoryScores[agentKey] || {
      agentName: agentKey,
      gatesSolved: [],
      score: 0,
      lastSolveAt: Date.now(),
    };

    if (!existing.gatesSolved.includes(gateSolved)) {
      existing.gatesSolved.push(gateSolved);
      existing.score += GATE_POINTS[gateSolved];
      existing.lastSolveAt = Date.now();
    }

    let proofBadge: string | undefined;
    if (existing.gatesSolved.length === 8) {
      proofBadge = generateProofOfSolve(agentKey, existing.gatesSolved);
      existing.proofBadge = proofBadge;
    }

    inMemoryScores[agentKey] = existing;

    return NextResponse.json({
      success: true,
      message: `FLAG ACCEPTED for Gate ${gateSolved}! +${GATE_POINTS[gateSolved]} points.`,
      agent: existing,
      proofBadge: proofBadge || null,
      allGatesCleared: existing.gatesSolved.length === 8,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: "Invalid request payload." }, { status: 400 });
  }
}
