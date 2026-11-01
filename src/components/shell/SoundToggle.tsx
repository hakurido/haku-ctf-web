"use client";

import React from "react";
import { Volume2, VolumeX } from "lucide-react";
import { useAppState } from "../state/AppStateProvider";

export function SoundToggle() {
  const { state, toggleSound } = useAppState();

  // The accessible name is always "Sound" and the state comes from aria-pressed, so
  // the visible state text and the icon are hidden from assistive technology (R-44).
  return (
    <button
      type="button"
      data-variant="secondary"
      onClick={toggleSound}
      aria-pressed={state.soundOn}
      aria-label="Sound"
      title="Play sounds for requests and results"
      className="h-9 px-3 inline-flex items-center justify-center rounded-md border border-line bg-surface text-fg-secondary hover:text-fg hover:bg-surface-hover active:bg-inset transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus select-none"
    >
      <span aria-hidden="true" className="inline-flex items-center gap-2">
        {state.soundOn ? (
          <Volume2 className="size-4 text-accent" />
        ) : (
          <VolumeX className="size-4 text-fg-muted" />
        )}
        <span className="text-ui font-medium hidden sm:inline">
          {state.soundOn ? "Sound on" : "Sound off"}
        </span>
      </span>
    </button>
  );
}
