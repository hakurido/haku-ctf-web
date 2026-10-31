"use client";

import React from "react";
import { Volume2, VolumeX } from "lucide-react";
import { useAppState } from "../state/AppStateProvider";

export function SoundToggle() {
  const { state, toggleSound } = useAppState();

  return (
    <button
      type="button"
      onClick={toggleSound}
      aria-pressed={state.soundOn}
      aria-label="Sound effects"
      className="h-9 px-3 gap-2 inline-flex items-center justify-center rounded-md border border-line bg-surface text-fg-secondary hover:text-fg hover:bg-surface-hover active:bg-inset transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus select-none"
    >
      {state.soundOn ? (
        <>
          <Volume2 className="size-4 text-accent" aria-hidden="true" />
          <span className="text-caption font-medium hidden sm:inline">Sound on</span>
        </>
      ) : (
        <>
          <VolumeX className="size-4 text-fg-muted" aria-hidden="true" />
          <span className="text-caption font-medium hidden sm:inline">Sound off</span>
        </>
      )}
    </button>
  );
}
