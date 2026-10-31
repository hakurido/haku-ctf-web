import React, { ReactNode } from "react";
import { CopyButton } from "./CopyButton";

export interface CopyFieldProps {
  label: string;
  value: string;
  display?: ReactNode;
  className?: string;
}

export function CopyField({ label, value, display, className = "" }: CopyFieldProps) {
  return (
    <div
      className={`flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-md border border-line bg-surface ${className}`}
    >
      <div className="flex-1 min-w-0">
        <div className="text-caption font-medium text-fg-muted mb-0.5">{label}</div>
        <div className="font-mono text-code text-fg break-all select-all">
          {display || value}
        </div>
      </div>
      <div className="shrink-0 self-start sm:self-center">
        <CopyButton value={value} label={label} />
      </div>
    </div>
  );
}
