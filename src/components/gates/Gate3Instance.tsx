"use client";

import React from "react";
import type { Gate3Challenge } from "@/lib/api";
import { TextAreaField } from "../ui/Field";
import { useAppState } from "../state/AppStateProvider";

export interface Gate3InstanceProps {
  data: Gate3Challenge;
  readOnly: boolean;
}

const PREVIEW_CLAUSES = 5;

export function Gate3Instance({ data, readOnly }: Gate3InstanceProps) {
  const { state, setField } = useAppState();
  const shownClauses = data.clauses.slice(0, PREVIEW_CLAUSES);
  const remainingCount = Math.max(0, data.clausesCount - shownClauses.length);

  return (
    <div className="space-y-5">
      <dl className="flex flex-wrap items-center gap-x-6 gap-y-1 p-3 rounded-md border border-line bg-surface text-ui">
        <div className="flex gap-1.5">
          <dt className="font-medium text-fg">Variables:</dt>
          <dd data-mono="" className="font-mono text-code text-fg-secondary">{data.variablesCount}</dd>
        </div>
        <div className="flex gap-1.5">
          <dt className="font-medium text-fg">Clauses:</dt>
          <dd data-mono="" className="font-mono text-code text-fg-secondary">{data.clausesCount}</dd>
        </div>
      </dl>

      <div>
        <h3 className="text-ui font-semibold text-fg mb-1">Clause preview</h3>
        <p className="text-ui text-fg-muted mb-2">
          First {shownClauses.length} of {data.clausesCount} clauses. A negative number is a
          negated variable.
        </p>

        <ol className="p-3 rounded-md border border-line bg-inset space-y-1">
          {shownClauses.map((c, idx) => (
            <li key={idx} className="flex gap-4">
              <span className="text-ui text-fg-muted w-8 shrink-0">C{idx + 1}</span>
              <code className="font-mono text-code text-fg select-all">{c.join("  ")}</code>
            </li>
          ))}
        </ol>
        {remainingCount > 0 && (
          <p className="text-ui text-fg-muted pt-1.5">
            {remainingCount} more clauses in the full response
          </p>
        )}
      </div>

      <div>
        <TextAreaField
          label="Assignment (JSON array)"
          description={`Either ${data.variablesCount} booleans in variable order, such as [true, false, ...], or signed literals with one per variable, such as [1, -2, 3, ...].`}
          mono
          rows={3}
          spellCheck={false}
          value={state.gate3.inputs}
          onChange={(e) => setField("gate3.inputs", e.target.value)}
          error={state.gate3.fieldError}
          disabled={readOnly}
        />
      </div>
    </div>
  );
}
