"use client";

import React, { useEffect, useState, useSyncExternalStore } from "react";
import { Copy, Check, CircleX } from "lucide-react";
import { useAppState } from "../state/AppStateProvider";
import { Button } from "./Button";

export interface CopyButtonProps {
  value: string;
  /** What is copied, e.g. "base URL" or "URL for GET /api/gate2/challenge". The accessible name is "Copy {label}". */
  label: string;
  disabled?: boolean;
  iconOnly?: boolean;
  className?: string;
}

type CopyState = "idle" | "copied" | "failed";

const STATE_MS: Record<Exclude<CopyState, "idle">, number> = { copied: 2000, failed: 4000 };

// false during server rendering and hydration, true once the client has hydrated.
const subscribeNever = () => () => {};
const useHydrated = () =>
  useSyncExternalStore(
    subscribeNever,
    () => true,
    () => false
  );

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function CopyButton({
  value,
  label,
  disabled = false,
  iconOnly = false,
  className = "",
}: CopyButtonProps) {
  const hydrated = useHydrated();
  const [state, setState] = useState<CopyState>("idle");
  const { announce } = useAppState();

  useEffect(() => {
    if (state === "idle") return;
    const timer = setTimeout(() => setState("idle"), STATE_MS[state]);
    return () => clearTimeout(timer);
  }, [state]);

  const handleCopy = async () => {
    if (!hydrated || disabled || state !== "idle") return;
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard API unavailable");
      // Report success only after the write has resolved.
      await navigator.clipboard.writeText(value);
      setState("copied");
      announce(`${capitalize(label)} copied to the clipboard.`);
    } catch {
      setState("failed");
      announce(`Couldn't copy ${label}. Select the text and copy it manually.`);
    }
  };

  const icon =
    state === "copied" ? (
      <Check className="size-4 shrink-0 text-success" aria-hidden="true" />
    ) : state === "failed" ? (
      <CircleX className="size-4 shrink-0 text-error" aria-hidden="true" />
    ) : (
      <Copy className="size-4 shrink-0" aria-hidden="true" />
    );

  if (iconOnly) {
    return (
      <span className="inline-flex items-center gap-1.5">
        <button
          type="button"
          data-variant="icon"
          disabled={!hydrated || disabled}
          onClick={handleCopy}
          aria-label={`Copy ${label}`}
          className={`size-8 inline-flex shrink-0 items-center justify-center rounded-md bg-transparent text-fg-secondary transition-colors duration-120 ease-standard hover:bg-surface-hover hover:text-fg active:bg-line active:text-fg disabled:bg-transparent disabled:text-fg-disabled disabled:cursor-not-allowed ${className}`}
        >
          {icon}
        </button>
        {state !== "idle" && (
          <span
            aria-hidden="true"
            className={`text-ui font-medium whitespace-nowrap ${state === "copied" ? "text-success" : "text-error"}`}
          >
            {state === "copied" ? "Copied" : "Copy failed"}
          </span>
        )}
      </span>
    );
  }

  // The accessible name is "Copy" plus the sr-only label in every state. While
  // "Copied" or "Copy failed" shows, "Copy" is only visually hidden. The three
  // words share one grid cell and the unused status words stay invisible, so
  // the button keeps the width of the widest word.
  return (
    <Button
      type="button"
      variant="secondary"
      size="sm"
      disabled={!hydrated || disabled}
      onClick={handleCopy}
      className={`min-w-24 ${className}`}
    >
      {icon}
      <span className="grid justify-items-center">
        <span className={`col-start-1 row-start-1 ${state === "idle" ? "" : "sr-only"}`}>
          Copy<span className="sr-only">{` ${label}`}</span>
        </span>
        <span
          aria-hidden="true"
          className={`col-start-1 row-start-1 text-success ${state === "copied" ? "" : "invisible"}`}
        >
          Copied
        </span>
        <span
          aria-hidden="true"
          className={`col-start-1 row-start-1 text-error ${state === "failed" ? "" : "invisible"}`}
        >
          Copy failed
        </span>
      </span>
    </Button>
  );
}
