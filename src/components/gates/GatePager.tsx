import React from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { GateNumber, GateMeta, GATES } from "@/lib/gates";

export function GatePager({ current }: { current: GateNumber }) {
  const gatesList: readonly GateMeta[] = GATES;
  const prevGate = current > 1 ? gatesList[current - 2] : null;
  const nextGate = current < 4 ? gatesList[current] : null;

  return (
    <nav aria-label="Previous and next gates" className="mt-12 pt-6 border-t border-line flex items-center justify-between gap-4">
      {prevGate ? (
        <Link
          href={`/gates/${prevGate.number}`}
          className="inline-flex items-center gap-2 text-ui font-medium text-fg-secondary hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus rounded-xs"
        >
          <ArrowLeft className="size-4 shrink-0" aria-hidden="true" />
          <span>Gate {prevGate.number}: {prevGate.name}</span>
        </Link>
      ) : (
        <div />
      )}

      {nextGate && (
        <Link
          href={`/gates/${nextGate.number}`}
          className="inline-flex items-center gap-2 text-ui font-medium text-fg-secondary hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus rounded-xs ml-auto"
        >
          <span>Gate {nextGate.number}: {nextGate.name}</span>
          <ArrowRight className="size-4 shrink-0" aria-hidden="true" />
        </Link>
      )}
    </nav>
  );
}
