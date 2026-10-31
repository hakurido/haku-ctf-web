import { NextResponse } from "next/server";
import { FLAGS } from "@/lib/challenges";
import { generateProofOfSolve } from "@/lib/crypto";

export const dynamic = "force-dynamic";

interface LeaderboardEntry {
  agentName: string;
  gatesSolved: number[];
  score: number;
  lastSolveAt: number;
  proofBadge?: string;
}

// In-memory fallback
const inMemoryScores: Record<string, LeaderboardEntry> = {
  "HAKU_SENTRY_BOT": {
    agentName: "HAKU_SENTRY_BOT",
    gatesSolved: [1, 2],
    score: 1500,
    lastSolveAt: Date.now() - 3600000,
  },
  "KIMI_K3_SOLVER": {
    agentName: "KIMI_K3_SOLVER",
    gatesSolved: [1, 3],
    score: 1750,
    lastSolveAt: Date.now() - 7200000,
  },
};

const GATE_POINTS: Record<number, number> = {
  1: 500,  // Neural Sentry
  2: 1000, // Entropy Fracture
  3: 1250, // Logic Maze (3-SAT)
  4: 1500, // Bytecode Vault
};

export async function GET() {
  const entries = Object.values(inMemoryScores).sort((a, b) => b.score - a.score);
  return NextResponse.json({
    status: "ok",
    leaderboard: entries,
    totalAgents: entries.length,
    gatePoints: GATE_POINTS,
  });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { agentName, flag } = body || {};

    if (!agentName || !flag) {
      return NextResponse.json({
        success: false,
        message: "Missing 'agentName' or 'flag' parameter.",
      }, { status: 400 });
    }

    const cleanFlag = String(flag).trim();
    let gateSolved = 0;
    if (cleanFlag === FLAGS.gate1) gateSolved = 1;
    else if (cleanFlag === FLAGS.gate2) gateSolved = 2;
    else if (cleanFlag === FLAGS.gate3) gateSolved = 3;
    else if (cleanFlag === FLAGS.gate4) gateSolved = 4;

    if (gateSolved === 0) {
      return NextResponse.json({
        success: false,
        message: "FLAG REJECTED: Invalid or fake flag token.",
      }, { status: 403 });
    }

    const agentKey = String(agentName).trim().slice(0, 32);
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
    if (existing.gatesSolved.length === 4) {
      proofBadge = generateProofOfSolve(agentKey, existing.gatesSolved);
      existing.proofBadge = proofBadge;
    }

    inMemoryScores[agentKey] = existing;

    return NextResponse.json({
      success: true,
      message: `FLAG ACCEPTED for Gate ${gateSolved}! +${GATE_POINTS[gateSolved]} points.`,
      agent: existing,
      proofBadge: proofBadge || null,
      allGatesCleared: existing.gatesSolved.length === 4,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: "Invalid request payload." }, { status: 400 });
  }
}
