"use client";

import React from "react";
import type { Gate7Challenge } from "@/lib/api";
import { TextField } from "../ui/Field";
import { useAppState } from "../state/AppStateProvider";

export interface Gate7InstanceProps {
  data: Gate7Challenge;
  readOnly: boolean;
}

export function Gate7Instance({ data, readOnly }: Gate7InstanceProps) {
  const { state, setField } = useAppState();
  const previewEqs = data.equations.slice(0, 4);

  return (
    <div className="space-y-5">
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <h3 className="text-ui font-semibold text-fg">
            Algebraic Normal Form (ANF) System
          </h3>
          <span className="text-caption font-mono text-fg-muted">
            {data.numVariables} Vars · {data.numEquations} Equations over GF(2)
          </span>
        </div>
        <p className="text-caption text-fg-muted mb-3">
          Solve the post-quantum Multivariate Quadratic (MQ) equation system <code className="font-mono text-code-inline text-fg">∑ q_ij · x_i x_j ⊕ ∑ l_i · x_i ⊕ c = 0 (mod 2)</code>.
        </p>

        <div className="space-y-1.5 font-mono text-code">
          <span className="text-caption text-fg-muted block mb-1">Equation preview (first 4):</span>
          {previewEqs.map((eq, idx) => {
            const quadStr = (eq.quad || []).map(([i, j]: [number, number]) => `x${i}x${j}`).join(" ⊕ ");
            const linStr = (eq.lin || []).map((i: number) => `x${i}`).join(" ⊕ ");
            const terms = [quadStr, linStr, eq.c ? "1" : ""].filter(Boolean).join(" ⊕ ");
            return (
              <div key={idx} className="p-2 rounded-md border border-line bg-inset text-caption break-all">
                <span className="text-accent font-semibold mr-2">E{idx}:</span>
                <span className="text-fg">{terms || "0"} = 0</span>
              </div>
            );
          })}
          <div className="text-caption text-fg-muted pt-1">
            ... +{data.numEquations - previewEqs.length} more equations in the full JSON response
          </div>
        </div>
      </div>

      <div>
        <TextField
          label="Root vector (24 bits or 6 hex chars)"
          description="24-bit binary string (e.g. 101011...) or 6-hex-character string representing x_0 to x_23."
          mono
          value={state.gate7.inputs}
          onChange={(e) => setField("gate7.inputs", e.target.value)}
          disabled={readOnly}
          placeholder="e.g. 101100101101010100101110 or b2d52e"
        />
      </div>
    </div>
  );
}
