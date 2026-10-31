import React from "react";
import Link from "next/link";
import { GateNumber, GATES } from "@/lib/gates";

export function GateStepper({ current }: { current: GateNumber }) {
  return (
    <nav aria-label="Gate pages" className="w-full mb-6">
      <ol className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {GATES.map((gate) => {
          const isCurrent = gate.number === current;
          return (
            <li key={gate.number}>
              <Link
                href={`/gates/${gate.number}`}
                aria-current={isCurrent ? "page" : undefined}
                className={`flex flex-col p-3 rounded-md border text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus ${
                  isCurrent
                    ? "border-accent bg-surface-hover text-fg"
                    : "border-line bg-surface text-fg-secondary hover:border-line-control hover:text-fg"
                }`}
              >
                <span className="font-mono text-caption text-fg-muted">
                  Gate {gate.number}
                </span>
                <span className="text-ui font-medium truncate">
                  {gate.name}
                </span>
              </Link>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
