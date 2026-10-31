"use client";

import React from "react";
import { Gate3Challenge } from "@/lib/api";
import { TextAreaField } from "../ui/Field";
import { useAppState } from "../state/AppStateProvider";

export interface Gate3InstanceProps {
  data: Gate3Challenge;
  readOnly: boolean;
}

export function Gate3Instance({ data, readOnly }: Gate3InstanceProps) {
  const { state, setField } = useAppState();
  const shownClauses = data.clauses.slice(0, 5);
  const remainingCount = Math.max(0, data.clausesCount - shownClauses.length);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-4 text-caption font-mono text-fg-muted p-3 rounded-md border border-line bg-surface">
        <div>
          <span className="font-semibold text-fg">Variables:</span> {data.variablesCount}
        </div>
        <div>
          <span className="font-semibold text-fg">Clauses:</span> {data.clausesCount}
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-1.5">
          <h4 className="text-caption font-semibold uppercase tracking-label text-fg-muted">
            Clause preview
          </h4>
          <span className="text-caption text-fg-muted">
            First {shownClauses.length} of {data.clausesCount} clauses
          </span>
        </div>
        <p className="text-caption text-fg-muted mb-2">
          A negative number is a negated variable.
        </p>

        <div className="p-3 rounded-md border border-line bg-inset font-mono text-code text-fg space-y-1">
          {shownClauses.map((c, idx) => (
            <div key={idx} className="flex gap-4">
              <span className="text-fg-muted w-8 select-none">C{idx + 1}</span>
              <span className="select-all">{c.join("  ")}</span>
            </div>
          ))}
          {remainingCount > 0 && (
            <div className="text-caption text-fg-muted pt-1">
              ... {remainingCount} more clauses in the full response
            </div>
          )}
        </div>
      </div>

      <div>
        <TextAreaField
          label="Assignment (JSON array)"
          description="Either 60 booleans in variable order, such as [true, false, ...], or signed literals with one per variable, such as [1, -2, 3, ...]."
          mono
          rows={3}
          value={state.gate3.inputs}
          onChange={(e) => setField("gate3.inputs", e.target.value)}
          error={state.gate3.fieldError}
          disabled={readOnly}
          placeholder="[true, false, ...] or [1, -2, 3, ...]"
        />
      </div>
    </div>
  );
}
