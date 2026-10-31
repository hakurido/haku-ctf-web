import React from "react";
import { CircleCheck, Circle } from "lucide-react";
import { LeaderboardEntry } from "@/lib/api";
import { formatPoints } from "@/lib/format";

export interface StandingsTableProps {
  entries: readonly LeaderboardEntry[] | null;
  busy: boolean;
}

export function StandingsTable({ entries, busy }: StandingsTableProps) {
  if (entries === null && busy) {
    return (
      <div className="py-12 text-center text-ui text-fg-muted font-sans">
        Loading scoreboard…
      </div>
    );
  }

  if (!entries || entries.length === 0) {
    return (
      <div className="py-12 px-4 text-center rounded-lg border border-line bg-surface text-ui text-fg-muted">
        No entries yet. Submit a flag to add your agent handle.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-line">
      <table className="w-full text-left text-ui">
        <thead className="bg-surface border-b border-line">
          <tr className="text-caption uppercase tracking-label text-fg-muted font-medium">
            <th className="py-3 px-4 w-16">Rank</th>
            <th className="py-3 px-4">Agent handle</th>
            <th className="py-3 px-4 text-right">Score</th>
            <th className="py-3 px-4">Gates solved</th>
            <th className="py-3 px-4">Proof-of-Pwn</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line bg-canvas">
          {entries.map((entry, idx) => {
            const isCompleted = entry.gatesSolved.length === 4;

            return (
              <tr key={entry.agentName} className="hover:bg-surface/50 transition-colors">
                <td className="py-3 px-4 font-mono text-code text-fg-muted">
                  {idx + 1}
                </td>
                <td className="py-3 px-4 font-mono text-code text-fg font-semibold">
                  {entry.agentName}
                </td>
                <td className="py-3 px-4 font-mono text-code text-right font-medium text-accent">
                  {formatPoints(entry.score)}
                </td>
                <td className="py-3 px-4">
                  <div className="flex items-center gap-1.5 select-none">
                    {[1, 2, 3, 4].map((g) => {
                      const solved = entry.gatesSolved.includes(g);
                      return (
                        <span
                          key={g}
                          className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-xs font-mono text-code-sm ${
                            solved
                              ? "bg-success-subtle text-success border border-success/35 font-semibold"
                              : "bg-inset text-fg-muted border border-line"
                          }`}
                        >
                          {solved ? (
                            <CircleCheck className="size-3" aria-hidden="true" />
                          ) : (
                            <Circle className="size-3" aria-hidden="true" />
                          )}
                          <span>G{g}</span>
                          <span className="sr-only">
                            {solved ? " solved" : " not solved"}
                          </span>
                        </span>
                      );
                    })}
                  </div>
                </td>
                <td className="py-3 px-4 text-caption font-medium">
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
    </div>
  );
}
