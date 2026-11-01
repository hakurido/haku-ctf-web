import React, { ReactNode } from "react";
import { CopyButton } from "./CopyButton";

export interface CopyFieldProps {
  label: string;
  value: string;
  display?: ReactNode;
  className?: string;
}

/**
 * The label starts a sentence here but sits mid-sentence in the copy control's
 * name, so "Base URL" becomes "Copy base URL". Labels that start with an
 * acronym or a lowercase word ("URL for …", "skill.md URL") are kept as is.
 */
function copyThing(label: string): string {
  return /^[A-Z][a-z]/.test(label) ? label.charAt(0).toLowerCase() + label.slice(1) : label;
}

export function CopyField({ label, value, display, className = "" }: CopyFieldProps) {
  return (
    <div
      className={`flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-md border border-line bg-surface ${className}`}
    >
      <div className="flex-1 min-w-0">
        <div className="text-ui font-medium text-fg-muted mb-0.5">{label}</div>
        <div data-mono="" className="font-mono text-code text-fg break-all select-all">
          {display || value}
        </div>
      </div>
      <div className="shrink-0 self-start sm:self-center">
        <CopyButton value={value} label={copyThing(label)} />
      </div>
    </div>
  );
}
