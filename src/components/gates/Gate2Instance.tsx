"use client";

import React, { useId } from "react";
import type { Gate2Challenge } from "@/lib/api";
import { GATE2_INCREMENT } from "@/lib/gates";
import { TextField } from "../ui/Field";
import { useAppState } from "../state/AppStateProvider";

export interface Gate2InstanceProps {
  data: Gate2Challenge;
  readOnly: boolean;
}

const SUBHEADING = "text-ui font-semibold text-fg";

export function Gate2Instance({ data, readOnly }: Gate2InstanceProps) {
  const { state, setField } = useAppState();
  const hintId = useId();
  const preds = state.gate2.inputs;
  // Counts come from the response (A15, R-29).
  const seqLen = data.sequence.length;
  const first = seqLen + 1;
  const last = seqLen + 3;

  return (
    <div className="space-y-5">
      <div>
        <h3 className={`${SUBHEADING} mb-1`}>Truncated sequence ({seqLen} outputs)</h3>
        <p className="text-ui text-fg-muted mb-2">
          Each value is <code className="font-mono text-code-sm text-fg">X(n) &gt;&gt; 16</code>,
          so the low 16 bits of each state are hidden.
        </p>

        <ol className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2">
          {data.sequence.map((val, idx) => (
            <li
              key={idx}
              className="p-2.5 rounded-md border border-line bg-inset flex items-center justify-between gap-2"
            >
              <span className="text-ui text-fg-muted">X{idx + 1}</span>
              <code className="font-mono text-code text-fg font-medium select-all break-all">{val}</code>
            </li>
          ))}
        </ol>
      </div>

      <dl className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 rounded-md border border-line bg-surface text-ui">
        <div>
          <dt className="font-medium text-fg">Multiplier A</dt>
          <dd><code className="font-mono text-code text-fg-secondary break-all">{data.multiplier}</code></dd>
        </div>
        <div>
          <dt className="font-medium text-fg">Modulus</dt>
          <dd><code className="font-mono text-code text-fg-secondary break-all">{data.modulus}</code></dd>
        </div>
        <div>
          <dt className="font-medium text-fg">Increment C (from skill.md)</dt>
          <dd><code className="font-mono text-code text-fg-secondary break-all">{GATE2_INCREMENT}</code></dd>
        </div>
      </dl>

      <fieldset aria-describedby={hintId}>
        <legend className={`${SUBHEADING} mb-1`}>
          Next three outputs (X{first} to X{last})
        </legend>
        <p id={hintId} className="text-ui text-fg-muted mb-2">
          Decimal integers in the same truncated form, X(n) &gt;&gt; 16, from 0 to 281474976710655.
          Surrounding spaces are removed.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[0, 1, 2].map((i) => (
            <TextField
              key={i}
              label={`X${first + i}`}
              mono
              inputMode="numeric"
              autoComplete="off"
              aria-describedby={hintId}
              value={preds[i]}
              onChange={(e) => setField(`gate2.inputs.${i}`, e.target.value)}
              disabled={readOnly}
            />
          ))}
        </div>
      </fieldset>
    </div>
  );
}
