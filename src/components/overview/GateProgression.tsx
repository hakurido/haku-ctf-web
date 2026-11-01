"use client";

import React from "react";
import Link from "next/link";
import {
  ArrowRight,
  Bot,
  Binary,
  Network,
  Terminal,
  Grid3X3,
  Key,
  Cpu,
  Zap,
  CircleCheck,
  Clock,
  Compass,
  Trophy,
} from "lucide-react";
import { type GateMeta, type InstanceGate } from "@/lib/gates";
import { formatPoints } from "@/lib/format";
import { useAppState } from "../state/AppStateProvider";
import { getInstanceSlot } from "@/lib/app-state";

const gateIcons = [
  Bot,       // Gate 1: Neural Sentry
  Binary,    // Gate 2: Entropy Fracture
  Network,   // Gate 3: Logic Maze
  Terminal,  // Gate 4: Bytecode Vault
  Grid3X3,   // Gate 5: Lattice Citadel
  Key,       // Gate 6: Wiener's Abyss
  Cpu,       // Gate 7: ANF Matrix
  Zap,       // Gate 8: Chrono Apex
];

export function GateProgression({ gates }: { gates: readonly GateMeta[] }) {
  const { state } = useAppState();
  const total = gates.reduce((sum, g) => sum + g.points, 0);

  const registeredAgent = state.flag.agent;
  const recordedHandle = state.flag.recordedHandle;
  const agentName = registeredAgent?.agentName || recordedHandle || null;

  // Determine which gates are verified solved in the session
  const solvedGates: number[] = registeredAgent?.gatesSolved || [];
  if (state.gate1.status === "flag-returned" && !solvedGates.includes(1)) {
    solvedGates.push(1);
  }
  for (let g = 2; g <= 8; g++) {
    const slot = getInstanceSlot(state, g as InstanceGate);
    if (slot.status === "accepted" && !solvedGates.includes(g)) {
      solvedGates.push(g);
    }
  }

  const solvedCount = solvedGates.length;
  const currentScore = registeredAgent?.score || 0;

  // Recommend the next unsolved gate
  const nextTarget = gates.find((g) => !solvedGates.includes(g.number));

  return (
    <section id="arena-gates" aria-labelledby="gates-heading" className="w-full space-y-6">
      {/* Player Arena HUD Banner */}
      <div className="rounded-lg border border-accent/40 bg-surface/80 p-4 sm:p-5 shadow-glow">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="flex size-2 rounded-full bg-accent animate-pulse" aria-hidden="true" />
              <span className="font-mono text-caption text-accent uppercase tracking-wider font-semibold">
                Player Arena Dashboard
              </span>
              <span className="text-fg-muted font-mono text-caption">·</span>
              <span className="text-fg-muted text-caption">
                {agentName ? `Agent: ${agentName}` : "Session: Unregistered Agent"}
              </span>
            </div>

            <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
              <div className="text-heading font-semibold text-fg">
                {solvedCount === 8 ? (
                  <span className="text-accent flex items-center gap-2">
                    <Trophy className="size-5" /> Arena Cleared — All 8 Gates Solved!
                  </span>
                ) : (
                  <span>
                    Progress: <strong className="text-accent">{solvedCount}</strong> of 8 Gates Cleared
                  </span>
                )}
              </div>
              <div className="text-ui text-fg-secondary font-mono">
                Score: <strong className="text-accent">{formatPoints(currentScore)}</strong> / {formatPoints(total)} pts
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {nextTarget ? (
              <Link
                href={`/gates/${nextTarget.number}`}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-md bg-accent text-canvas font-semibold text-ui shadow-glow hover:bg-accent-hover transition-colors"
              >
                <span>Recommended: Gate {nextTarget.number} ({nextTarget.name})</span>
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            ) : (
              <Link
                href="/scoreboard"
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-md bg-accent text-canvas font-semibold text-ui shadow-glow hover:bg-accent-hover transition-colors"
              >
                <span>View Final Standing</span>
                <Trophy className="size-4" aria-hidden="true" />
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Arena Map Header */}
      <div>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
          <h2 id="gates-heading" className="text-heading text-fg font-semibold">
            Arena Gate Map
          </h2>
          <span className="text-caption font-mono px-2 py-0.5 rounded-sm bg-surface-hover border border-line-control text-fg-muted">
            Order: Non-Linear (Tackle any gate first)
          </span>
        </div>
        <p className="text-ui text-fg-secondary">
          Select any challenge to enter. Each gate operates autonomously with its own mathematical constraints and proof of completion.
        </p>
      </div>

      {/* 8-Gate Interactive Arena Grid */}
      <ol className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {gates.map((gate) => {
          const Icon = gateIcons[gate.number - 1] || Terminal;
          const isSolved = solvedGates.includes(gate.number);

          // Check live runtime status from app state
          let isLive = false;
          let isExpired = false;
          if (gate.number > 1) {
            const slot = getInstanceSlot(state, gate.number as InstanceGate);
            isLive = slot.status === "live";
            isExpired = slot.status === "expired";
          }

          const ep = gate.endpoints[0];

          return (
            <li
              key={gate.number}
              className={`flex flex-col justify-between rounded-lg border p-5 transition-[border-color,box-shadow] ${
                isSolved
                  ? "border-success/60 bg-surface/90 shadow-sm"
                  : isLive
                  ? "border-warning/60 bg-surface shadow-glow"
                  : "border-line bg-surface hover:border-accent/60 hover:shadow-glow"
              }`}
            >
              <div>
                {/* Card Top: Number, Icon, Name, Status Badge */}
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className={`flex size-8 shrink-0 items-center justify-center rounded-md border ${
                        isSolved
                          ? "border-success/40 bg-success-subtle text-success"
                          : "border-line bg-inset text-fg-secondary"
                      }`}
                    >
                      <Icon className="size-4" aria-hidden="true" />
                    </div>
                    <h3 className="text-title font-semibold text-fg truncate">
                      Gate {gate.number}: {gate.name}
                    </h3>
                  </div>

                  {/* Status Badge */}
                  <div className="shrink-0">
                    {isSolved ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-xs text-caption font-semibold bg-success-subtle text-success border border-success/35">
                        <CircleCheck className="size-3.5" aria-hidden="true" />
                        <span>Solved</span>
                      </span>
                    ) : isLive ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-xs text-caption font-semibold bg-warning-subtle text-warning border border-warning/35">
                        <Clock className="size-3.5" aria-hidden="true" />
                        <span>In Progress</span>
                      </span>
                    ) : isExpired ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-xs text-caption font-medium bg-inset text-fg-muted border border-line">
                        <span>Expired</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-xs text-caption font-medium bg-inset text-fg-muted border border-line">
                        <Compass className="size-3" aria-hidden="true" />
                        <span>Available</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Topic & Points Row */}
                <div className="flex flex-wrap items-center justify-between gap-x-2 text-ui mb-2 pb-2 border-b border-line/60">
                  <span className="text-fg-muted font-medium">{gate.topic}</span>
                  <span className="font-mono font-bold text-accent">
                    {formatPoints(gate.points)} pts
                  </span>
                </div>

                {/* Summary */}
                <p className="text-ui text-fg-secondary leading-relaxed mb-4">
                  {gate.summary}
                </p>
              </div>

              {/* Bottom Action Footer */}
              <div className="pt-3 border-t border-line flex flex-wrap items-center justify-between gap-2">
                <code className="font-mono text-code-sm text-fg-muted">
                  {ep.method} {ep.path}
                </code>

                <Link
                  href={`/gates/${gate.number}`}
                  className={`inline-flex items-center gap-1 text-ui font-semibold rounded-xs transition-colors ${
                    isSolved
                      ? "text-success hover:text-success/80"
                      : isLive
                      ? "text-warning hover:text-warning/80"
                      : "text-accent hover:text-accent-hover"
                  }`}
                >
                  <span>{isSolved ? "Review Gate" : isLive ? "Resume Gate" : `Enter Gate ${gate.number}`}</span>
                  <ArrowRight className="size-3.5" aria-hidden="true" />
                </Link>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
