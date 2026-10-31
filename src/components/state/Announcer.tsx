"use client";

import React from "react";
import { useAppState } from "./AppStateProvider";

export function Announcer() {
  const { announcement } = useAppState();

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className="sr-only"
    >
      {announcement}
    </div>
  );
}
