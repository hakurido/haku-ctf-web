"use client";

import React, { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { formatResponseJson } from "@/lib/format";

export interface JsonDisclosureProps {
  value: unknown;
  summary?: string;
  className?: string;
}

export function JsonDisclosure({
  value,
  summary = "View full response (JSON)",
  className = "",
}: JsonDisclosureProps) {
  const [open, setOpen] = useState(false);

  return (
    <details
      open={open}
      onToggle={(e) => setOpen(e.currentTarget.open)}
      className={`group rounded-md border border-line bg-surface ${className}`}
    >
      <summary className="cursor-pointer list-none select-none px-3 py-2 text-caption font-medium text-fg-secondary hover:text-fg hover:bg-surface-hover rounded-md flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus">
        {open ? (
          <ChevronDown className="size-3.5 text-fg-muted shrink-0" aria-hidden="true" />
        ) : (
          <ChevronRight className="size-3.5 text-fg-muted shrink-0" aria-hidden="true" />
        )}
        <span>{summary}</span>
      </summary>
      <div className="p-3 border-t border-line bg-inset overflow-hidden rounded-b-md">
        <pre
          tabIndex={0}
          role="region"
          aria-label="JSON response payload"
          className="max-h-96 overflow-auto font-mono text-code text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus whitespace-pre"
        >
          {formatResponseJson(value)}
        </pre>
      </div>
    </details>
  );
}
