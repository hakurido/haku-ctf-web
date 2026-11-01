import React from "react";
import Link from "next/link";
import { FlagDialog } from "./FlagDialog";
import { SoundToggle } from "./SoundToggle";

export function SiteHeader() {
  return (
    <header className="border-b border-line bg-canvas">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
        <Link
          href="/"
          aria-label="AGENTGATE CTF, Overview"
          className="font-bold tracking-wider text-title text-fg hover:text-accent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus rounded-sm py-1"
        >
          AGENTGATE <span className="text-caption font-medium text-fg-muted">CTF</span>
        </Link>

        <div className="flex items-center gap-2 sm:gap-3">
          <FlagDialog />
          <SoundToggle />
        </div>
      </div>
    </header>
  );
}
