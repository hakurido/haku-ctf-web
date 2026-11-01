import React from "react";
import { CircleCheck, Minus } from "lucide-react";
import type { LeaderboardEntry } from "@/lib/api";
import { formatPoints } from "@/lib/format";

export interface StandingsTableProps {
  entries: readonly LeaderboardEntry[] | null;
  busy: boolean;
  /** Show the empty state only after a successful load (R-09). */
  showEmpty: boolean;
  /** Id of the heading that names the table (R-11). */
  labelledBy?: string;
}

export function StandingsTable({ entries, busy, showEmpty, labelledBy }: StandingsTableProps) {
  if (entries === null) {
    if (busy) {
      return (
        <div aria-busy="true" className="py-12 text-center text-ui text-fg-muted">
          Loading scoreboard…
        </div>
      );
    }
    return null;
  }

  if (entries.length === 0) {
    if (!showEmpty) return null;
    return (
      <div className="py-12 px-4 text-center rounded-lg border border-line bg-surface text-ui text-fg-muted">
        No entries yet. Submit a flag to add your agent handle.
      </div>
    );
  }

  return (
    <div aria-busy={busy} className="overflow-x-auto rounded-lg border border-line">
      <table aria-labelledby={labelledBy} className="w-full text-left text-ui">
        <thead className="bg-surface border-b border-line">
          <tr className="text-ui text-fg-muted">
            <th scope="col" className="py-3 px-4 w-16 font-medium">Rank</th>
            <th scope="col" className="py-3 px-4 font-medium">Agent handle</th>
            <th scope="col" className="py-3 px-4 text-right font-medium">Score</th>
            <th scope="col" className="py-3 px-4 font-medium">Gates solved</th>
            <th scope="col" className="py-3 px-4 font-medium">Proof-of-Pwn</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line bg-canvas">
          {entries.map((entry, idx) => {
            const isCompleted = !!entry.proofBadge || entry.gatesSolved.length === 4;

            return (
              <tr key={entry.agentName} className="hover:bg-surface/50 transition-colors">
                <td className="py-3 px-4 tabular-nums text-fg-muted">{idx + 1}</td>
                <td className="py-3 px-4">
                  <code className="font-mono text-code text-fg font-semibold">{entry.agentName}</code>
                </td>
                <td className="py-3 px-4 tabular-nums text-right font-medium text-accent">
                  {formatPoints(entry.score)}
                </td>
                <td className="py-3 px-4">
                  <div className="flex items-center gap-1.5">
                    {[1, 2, 3, 4].map((g) => {
                      const solved = entry.gatesSolved.includes(g);
                      return (
                        <span
                          key={g}
                          className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-xs text-ui ${
                            solved
                              ? "bg-success-subtle text-success border border-success/35 font-semibold"
                              : "bg-inset text-fg-muted border border-line"
                          }`}
                        >
                          {solved ? (
                            <CircleCheck className="size-3.5" aria-hidden="true" />
                          ) : (
                            <Minus className="size-3.5" aria-hidden="true" />
                          )}
                          <span>G{g}</span>
                          <span className="sr-only">{solved ? " solved" : " not solved"}</span>
                        </span>
                      );
                    })}
                  </div>
                </td>
                <td className="py-3 px-4 font-medium">
                  {isCompleted ? (
                    <span className="text-success inline-flex items-center gap-1">
                      <CircleCheck className="size-3.5" aria-hidden="true" />
                      <span>Complete</span>
                    </span>
                  ) : (
                    <span className="text-fg-muted">In progress</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="px-4 py-2 border-t border-line text-ui text-fg-muted">
        A check mark means the gate is solved. A dash means it isn&apos;t.
      </p>
    </div>
  );
}
