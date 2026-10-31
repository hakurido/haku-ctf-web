"use client";

import React from "react";
import { Gate2Challenge } from "@/lib/api";
import { TextField } from "../ui/Field";
import { useAppState } from "../state/AppStateProvider";

export interface Gate2InstanceProps {
  data: Gate2Challenge;
  readOnly: boolean;
}

export function Gate2Instance({ data, readOnly }: Gate2InstanceProps) {
  const { state, setField } = useAppState();
  const preds = state.gate2.inputs;
  const seqLen = data.sequence?.length || 4;

  return (
    <div className="space-y-5">
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <h4 className="text-caption font-semibold uppercase tracking-label text-fg-muted">
            Truncated Sequence ({seqLen} outputs)
          </h4>
          <span className="text-caption text-warning font-mono">
            Low 16 bits stripped
          </span>
        </div>
        <p className="text-caption text-fg-muted mb-2">
          Outputs represent <code className="font-mono text-code-inline text-fg">X_n &gt;&gt; 16</code>. The lower 16 bits are unknown and hidden.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 font-mono text-code">
          {data.sequence.map((val, idx) => (
            <div
              key={idx}
              className="p-2.5 rounded-md border border-line bg-inset flex items-center justify-between"
            >
              <span className="text-fg-muted">X{idx + 1}</span>
              <span className="text-fg font-medium select-all">{val}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-caption font-mono text-fg-muted p-3 rounded-md border border-line bg-surface">
        <div>
          <span className="font-semibold text-fg">Multiplier (A):</span> 6364136223846793005
        </div>
        <div>
          <span className="font-semibold text-fg">Increment (C):</span> 1442695040888963407
        </div>
      </div>

      <div>
        <h4 className="text-caption font-semibold uppercase tracking-label text-fg-muted mb-2">
          Next three truncated outputs
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[0, 1, 2].map((i) => (
            <TextField
              key={i}
              label={`X${seqLen + i + 1}`}
              mono
              value={preds[i]}
              onChange={(e) => setField(`gate2.inputs.${i}`, e.target.value)}
              disabled={readOnly}
              placeholder="Predicted top 48-bit value"
            />
          ))}
        </div>
      </div>
    </div>
  );
}
