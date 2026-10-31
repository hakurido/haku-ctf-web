import React from "react";
import Link from "next/link";
import { ArrowRight, Bot, Binary, Network, Terminal } from "lucide-react";
import { GateMeta } from "@/lib/gates";
import { formatPoints } from "@/lib/format";

const gateIcons = [
  Bot,       // Gate 1: Neural Sentry
  Binary,    // Gate 2: Entropy Fracture
  Network,   // Gate 3: Logic Maze
  Terminal,  // Gate 4: Bytecode Vault
];

export function GateProgression({ gates }: { gates: readonly GateMeta[] }) {
  return (
    <section aria-labelledby="gates-heading" className="w-full">
      <h2 id="gates-heading" className="text-title text-fg font-semibold mb-3">
        The four gates
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {gates.map((gate) => {
          const Icon = gateIcons[gate.number - 1] || Terminal;
          const ttlLabel = gate.ttlSeconds
            ? `Instance TTL: ${gate.ttlSeconds} s`
            : "No time limit";

          return (
            <div
              key={gate.number}
              className="flex flex-col justify-between rounded-lg border border-line bg-surface p-5 hover:border-line-control transition-colors"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-md border border-line bg-inset text-fg-secondary">
                      <Icon className="size-4" aria-hidden="true" />
                    </div>
                    <h3 className="text-title font-semibold text-fg">
                      <Link
                        href={`/gates/${gate.number}`}
                        className="hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus rounded-xs"
                      >
                        Gate {gate.number}: {gate.name}
                      </Link>
                    </h3>
                  </div>
                  <span className="font-mono text-caption font-medium text-accent">
                    {formatPoints(gate.points)} pts
                  </span>
                </div>

                <div className="flex items-center gap-2 text-caption font-mono text-fg-muted mb-2">
                  <span>{gate.topic}</span>
                  <span>·</span>
                  <span>{ttlLabel}</span>
                </div>

                <p className="text-ui text-fg-secondary leading-relaxed mb-4">
                  {gate.summary}
                </p>
              </div>

              <div className="pt-3 border-t border-line flex items-center justify-between">
                <span className="font-mono text-caption text-fg-muted">
                  {gate.endpoints[0].method} {gate.endpoints[0].path}
                </span>
                <Link
                  href={`/gates/${gate.number}`}
                  className="inline-flex items-center gap-1 text-ui font-medium text-accent hover:text-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus rounded-xs"
                >
                  <span>Open Gate {gate.number}</span>
                  <ArrowRight className="size-3.5" aria-hidden="true" />
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
