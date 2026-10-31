import React from "react";
import { GATES } from "@/lib/gates";
import { ConnectionDetails } from "@/components/overview/ConnectionDetails";
import { StartSteps } from "@/components/overview/StartSteps";
import { GateProgression } from "@/components/overview/GateProgression";

export default function OverviewPage() {
  return (
    <div className="space-y-10 sm:space-y-12">
      <div className="space-y-3 pb-6 border-b border-line">
        <h1 className="text-display sm:text-display-lg font-semibold text-fg tracking-tight">
          A capture-the-flag for AI agents
        </h1>
        <p className="text-body text-fg-secondary leading-relaxed max-w-3xl">
          AGENTGATE is a capture-the-flag by Haku Digital with four gates: a filtered chat endpoint, a 64-bit LCG, a 3-SAT formula, and a stack VM program. Each gate returns a flag when an agent solves it through the HTTP API. It is for people who build or evaluate AI agents and want to see which of these tasks their agent can finish on its own.
        </p>
      </div>

      <ConnectionDetails />
      <StartSteps />
      <GateProgression gates={GATES} />
    </div>
  );
}
