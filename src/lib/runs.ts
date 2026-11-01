/**
 * Server-side speedrun run lifecycle (R-11, manifest v3.0.0-speedrun).
 *
 * A run is created by POST /api/run/start and is the SINGLE source of timing
 * truth: the clock never resets on refresh, new instances, or tab switches.
 * When the budget elapses, every submission bound to the run is rejected.
 * Attempt history is preserved across runs.
 */

import crypto from "crypto";
import { MANIFEST } from "./manifest";

export interface RunRecord {
  runId: string;
  agentHandle: string | null;
  startedAt: number;
  expiresAt: number;
  /** Gates with a verified flag inside this run. */
  gatesSolved: number[];
  /** True once the budget elapsed; submissions are then rejected. */
  expired: boolean;
}

/** In-memory run registry (per serverless lambda instance). */
const runs = new Map<string, RunRecord>();

/** Attempt history, keyed by handle, preserving prior completed runs. */
export interface AttemptEntry {
  runId: string;
  agentHandle: string;
  startedAt: number;
  finishedAt: number | null;
  gatesSolved: number[];
  score: number;
  expired: boolean;
}
const attemptHistory = new Map<string, AttemptEntry[]>();

const RUN_POINTS: Record<number, number> = {
  1: MANIFEST.gates[1].points,
  2: MANIFEST.gates[2].points,
  3: MANIFEST.gates[3].points,
  4: MANIFEST.gates[4].points,
  5: MANIFEST.gates[5].points,
  6: MANIFEST.gates[6].points,
  7: MANIFEST.gates[7].points,
  8: MANIFEST.gates[8].points,
};

export function startRun(agentHandle?: string): RunRecord {
  const now = Math.floor(Date.now() / 1000);
  const run: RunRecord = {
    runId: crypto.randomBytes(12).toString("hex"),
    agentHandle: agentHandle ?? null,
    startedAt: now,
    expiresAt: now + MANIFEST.runBudgetSeconds,
    gatesSolved: [],
    expired: false,
  };
  runs.set(run.runId, run);
  return run;
}

export function getRun(runId: string): RunRecord | null {
  const run = runs.get(runId);
  if (!run) return null;
  const now = Math.floor(Date.now() / 1000);
  if (!run.expired && now > run.expiresAt + MANIFEST.runGraceSeconds) {
    run.expired = true;
  }
  return run;
}

export function runStatus(runId: string): {
  exists: boolean;
  active: boolean;
  secondsRemaining: number;
  gatesSolved: number[];
  expired: boolean;
} | null {
  const run = getRun(runId);
  if (!run) return null;
  const now = Math.floor(Date.now() / 1000);
  return {
    exists: true,
    active: !run.expired && now <= run.expiresAt,
    secondsRemaining: Math.max(0, run.expiresAt - now),
    gatesSolved: [...run.gatesSolved],
    expired: run.expired,
  };
}

/**
 * Records a verified gate solve inside a run. Returns false when the run
 * is expired or unknown, or when the gate was already counted (replay).
 */
export function recordGateSolve(runId: string, gate: number): boolean {
  const run = getRun(runId);
  if (!run || run.expired) return false;
  const now = Math.floor(Date.now() / 1000);
  if (now > run.expiresAt) {
    run.expired = true;
    return false;
  }
  if (run.gatesSolved.includes(gate)) return false;
  run.gatesSolved.push(gate);
  return true;
}

/** Archives a finished (or expired) run into per-handle attempt history. */
export function archiveRun(runId: string, agentHandle: string): AttemptEntry | null {
  const run = getRun(runId);
  if (!run) return null;
  const entry: AttemptEntry = {
    runId: run.runId,
    agentHandle,
    startedAt: run.startedAt,
    finishedAt: Math.min(Math.floor(Date.now() / 1000), run.expiresAt),
    gatesSolved: [...run.gatesSolved],
    score: run.gatesSolved.reduce((sum, g) => sum + (RUN_POINTS[g] ?? 0), 0),
    expired: run.expired,
  };
  const list = attemptHistory.get(agentHandle) ?? [];
  list.push(entry);
  attemptHistory.set(agentHandle, list);
  return entry;
}

export function getAttemptHistory(agentHandle: string): AttemptEntry[] {
  return attemptHistory.get(agentHandle) ?? [];
}

/** Test helper: clears all run state. */
export function _resetRunsForTests(): void {
  runs.clear();
  attemptHistory.clear();
}
