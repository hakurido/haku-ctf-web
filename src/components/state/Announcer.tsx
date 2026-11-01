"use client";

import React from "react";
import { useAppState } from "./AppStateProvider";

/**
 * The live region. It is rendered twice: once in the page and once inside the
 * flag dialog, because an open modal makes the page inert (R-37). Only the
 * region for the current scope holds the text, so every message is spoken once.
 */
export function Announcer({ scope = "page" }: { scope?: "page" | "dialog" }) {
  const { announcement, flagDialogOpen } = useAppState();
  const active = (scope === "dialog") === flagDialogOpen;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className="sr-only"
    >
      {active ? announcement : ""}
    </div>
  );
}
