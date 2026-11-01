"use client";

import React from "react";
import type { Gate5Challenge } from "@/lib/api";
import { TextField } from "../ui/Field";
import { useAppState } from "../state/AppStateProvider";

export interface Gate5InstanceProps {
  data: Gate5Challenge;
  readOnly: boolean;
}

export function Gate5Instance({ data, readOnly }: Gate5InstanceProps) {
  const { state, setField } = useAppState();

  return (
    <div className="space-y-5">
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <h3 className="text-ui font-semibold text-fg">
            Knapsack Weights ({data.count} integers)
          </h3>
          <span className="text-caption font-mono text-fg-muted">
            Search space: 2^42 ≈ 4.39 Trillion (2^21 MitM per side)
          </span>
        </div>
        <p className="text-caption text-fg-muted mb-2">
          Find a binary vector <code className="font-mono text-code-inline text-fg">x ∈ {"{0, 1}"}^42</code> such that <code className="font-mono text-code-inline text-fg">∑ x_i · w_i = S</code>.
        </p>

        <div className="max-h-60 overflow-y-auto rounded-md border border-line bg-inset p-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 font-mono text-code">
            {data.weights.map((w, idx) => (
              <div
                key={idx}
                className="p-1.5 rounded-sm border border-line/60 bg-surface/50 flex items-center justify-between gap-2"
              >
                <span className="text-fg-muted text-caption">w_{idx}</span>
                <span className="text-fg text-caption truncate select-all">{w}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="p-3 rounded-md border border-line bg-surface">
        <div className="text-caption font-medium text-fg-muted mb-0.5">Target Sum (S):</div>
        <div className="font-mono text-code font-bold text-accent select-all break-all">
          {data.targetSum}
        </div>
      </div>

      <div>
        <TextField
          label="Solution vector (42 binary bits)"
          description="42-character string of '0's and '1's representing x_0 to x_41."
          mono
          value={state.gate5.inputs}
          onChange={(e) => setField("gate5.inputs", e.target.value)}
          disabled={readOnly}
          placeholder="e.g. 101001101011010010101100101011010011010110"
        />
      </div>
    </div>
  );
}
