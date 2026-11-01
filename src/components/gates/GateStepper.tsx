import React from "react";
import Link from "next/link";
import { type GateNumber, GATES } from "@/lib/gates";

export function GateStepper({ current }: { current: GateNumber }) {
  return (
    <nav aria-label="Gates" className="w-full mb-6">
      <ol className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {GATES.map((gate) => {
          const isCurrent = gate.number === current;
          return (
            <li key={gate.number}>
              <Link
                href={`/gates/${gate.number}`}
                aria-current={isCurrent ? "page" : undefined}
                className={`flex h-full flex-col p-3 rounded-md border text-left transition-colors ${
                  isCurrent
                    ? "border-accent border-l-4 bg-surface-hover text-fg"
                    : "border-line bg-surface text-fg-secondary hover:border-line-control hover:text-fg"
                }`}
              >
                <span className="text-ui text-fg-muted">Gate {gate.number}</span>
                {/* Labels wrap instead of truncating (R-33). */}
                <span className="text-ui font-medium break-words">{gate.name}</span>
              </Link>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
