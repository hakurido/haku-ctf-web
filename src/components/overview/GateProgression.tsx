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
} from "lucide-react";
import { DIFFICULTY, type GateMeta } from "@/lib/gates";
import { formatPoints } from "@/lib/format";

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
  const total = gates.reduce((sum, g) => sum + g.points, 0);

  return (
    <section aria-labelledby="gates-heading" className="w-full">
      <h2 id="gates-heading" className="text-heading text-fg font-semibold mb-2">
        Gates
      </h2>
      <p className="text-ui text-fg-secondary mb-4 flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="px-2 py-0.5 rounded-sm bg-surface-hover border border-line-control text-fg font-medium">
          Difficulty: {DIFFICULTY}
        </span>
        <span>
          {formatPoints(total)} points in total. Points rise progressively from Gate 1 to Gate 8, and the gates
          can be solved in any order.
        </span>
      </p>
      <ol className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {gates.map((gate) => {
          const Icon = gateIcons[gate.number - 1] || Terminal;
          const ttlLabel = gate.ttlSeconds ? `Instance TTL: ${gate.ttlSeconds} s` : "No TTL";
          const ep = gate.endpoints[0];

          return (
            <li
              key={gate.number}
              className="flex flex-col justify-between rounded-lg border border-line border-t-2 border-t-accent/50 bg-surface p-5 hover:border-accent/50 hover:shadow-glow transition-[border-color,box-shadow]"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-md border border-line bg-inset text-fg-secondary">
                      <Icon className="size-4" aria-hidden="true" />
                    </div>
                    <h3 className="text-title font-semibold text-fg">
                      Gate {gate.number}: {gate.name}
                    </h3>
                  </div>
                  <span className="text-ui font-medium text-accent whitespace-nowrap">
                    {formatPoints(gate.points)} points
                  </span>
                </div>

                <p className="flex flex-wrap items-center gap-x-2 text-ui text-fg-muted mb-2">
                  <span>{gate.topic}</span>
                  <span aria-hidden="true">·</span>
                  <span>{ttlLabel}</span>
                </p>

                <p className="text-ui text-fg-secondary leading-relaxed mb-4">
                  {gate.summary}
                </p>
              </div>

              <div className="pt-3 border-t border-line flex flex-wrap items-center justify-between gap-2">
                <code className="font-mono text-code-sm text-fg-muted">
                  {ep.method} {ep.path}
                </code>
                <Link
                  href={`/gates/${gate.number}`}
                  className="inline-flex items-center gap-1 text-ui font-medium text-accent hover:text-accent-hover rounded-xs"
                >
                  <span>Open Gate {gate.number}</span>
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
