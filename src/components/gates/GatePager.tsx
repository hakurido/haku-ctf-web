import React from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { type GateNumber, type GateMeta, GATES } from "@/lib/gates";

const LINK =
  "inline-flex items-center gap-2 text-ui font-medium text-fg-secondary hover:text-fg rounded-xs";

export function GatePager({ current }: { current: GateNumber }) {
  const gatesList: readonly GateMeta[] = GATES;
  const prevGate = current > 1 ? gatesList[current - 2] : null;
  const nextGate = current < 8 ? gatesList[current] : null;

  // Gate 1 links back to the Overview and Gate 8 on to the Scoreboard (R-34).
  const prev = prevGate
    ? { href: `/gates/${prevGate.number}`, label: `Gate ${prevGate.number}: ${prevGate.name}` }
    : { href: "/", label: "Overview" };
  const next = nextGate
    ? { href: `/gates/${nextGate.number}`, label: `Gate ${nextGate.number}: ${nextGate.name}` }
    : { href: "/scoreboard", label: "Scoreboard" };

  return (
    <nav
      aria-label="Previous and next"
      className="mt-12 pt-6 border-t border-line flex flex-col sm:flex-row sm:items-center justify-between gap-4"
    >
      <Link href={prev.href} className={LINK}>
        <ArrowLeft className="size-4 shrink-0" aria-hidden="true" />
        <span>Previous: {prev.label}</span>
      </Link>
      <Link href={next.href} className={`${LINK} sm:ml-auto`}>
        <span>Next: {next.label}</span>
        <ArrowRight className="size-4 shrink-0" aria-hidden="true" />
      </Link>
    </nav>
  );
}
