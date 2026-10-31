"use client";

import React, { useState, useEffect } from "react";
import { Copy, Check, CircleX } from "lucide-react";
import { useAppState } from "../state/AppStateProvider";

export interface CopyButtonProps {
  value: string;
  label: string;
  disabled?: boolean;
  iconOnly?: boolean;
  className?: string;
}

export function CopyButton({
  value,
  label,
  disabled = false,
  iconOnly = false,
  className = "",
}: CopyButtonProps) {
  const [hydrated, setHydrated] = useState(false);
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  const { announce } = useAppState();

  useEffect(() => {
    setHydrated(true);
  }, []);

  const handleCopy = async () => {
    if (!hydrated || disabled || state !== "idle") return;
    try {
      await navigator.clipboard.writeText(value);
      setState("copied");
      announce(`Copied ${label} to clipboard.`);
      setTimeout(() => setState("idle"), 2000);
    } catch {
      setState("failed");
      announce(`Failed to copy ${label} to clipboard.`);
      setTimeout(() => setState("idle"), 4000);
    }
  };

  if (iconOnly) {
    return (
      <div className="inline-flex items-center gap-1.5">
        <button
          type="button"
          disabled={!hydrated || disabled}
          onClick={handleCopy}
          aria-label={`Copy ${label}`}
          className={`size-8 inline-flex items-center justify-center rounded-md text-fg-secondary hover:bg-surface-hover hover:text-fg active:bg-line transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:opacity-40 disabled:cursor-not-allowed ${className}`}
        >
          {state === "copied" ? (
            <Check className="size-4 text-success" aria-hidden="true" />
          ) : state === "failed" ? (
            <CircleX className="size-4 text-error" aria-hidden="true" />
          ) : (
            <Copy className="size-4" aria-hidden="true" />
          )}
        </button>
        {state === "copied" && (
          <span className="text-caption text-success font-medium">Copied</span>
        )}
        {state === "failed" && (
          <span className="text-caption text-error font-medium">Copy failed</span>
        )}
      </div>
    );
  }

  return (
    <button
      type="button"
      disabled={!hydrated || disabled}
      onClick={handleCopy}
      className={`h-8 px-3 min-w-24 inline-flex items-center justify-center gap-1.5 rounded-md border border-line-control bg-surface text-caption font-medium text-fg hover:bg-surface-hover hover:border-fg-muted active:bg-inset transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:bg-surface-hover disabled:text-fg-disabled disabled:border-line disabled:cursor-not-allowed ${className}`}
    >
      {state === "copied" ? (
        <>
          <Check className="size-4 text-success" aria-hidden="true" />
          <span className="text-success">Copied</span>
        </>
      ) : state === "failed" ? (
        <>
          <CircleX className="size-4 text-error" aria-hidden="true" />
          <span className="text-error">Copy failed</span>
        </>
      ) : (
        <>
          <Copy className="size-4 text-fg-secondary" aria-hidden="true" />
          <span>Copy</span>
        </>
      )}
    </button>
  );
}
