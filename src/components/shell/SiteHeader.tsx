import React from "react";
import Link from "next/link";
import { Terminal } from "lucide-react";
import { FlagDialog } from "./FlagDialog";
import { SoundToggle } from "./SoundToggle";

export function SiteHeader() {
  return (
    <header className="border-b border-line bg-canvas">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-2 sm:gap-4">
        {/* Below `sm` the icon and the "//" are dropped so the wordmark and both
            header controls fit on one row at 360px. */}
        <Link
          href="/"
          aria-label="AGENTGATE CTF, Overview"
          className="group inline-flex min-w-0 items-center gap-1.5 sm:gap-2.5 rounded-sm py-1 text-fg"
        >
          <span
            aria-hidden="true"
            className="hidden sm:flex size-7 items-center justify-center rounded-sm border border-accent/60 bg-accent-subtle text-accent shadow-glow transition-shadow group-hover:shadow-glow-strong"
          >
            <Terminal className="size-4" />
          </span>
          <span className="font-bold tracking-wider text-title group-hover:text-accent transition-colors">
            AGENTGATE
          </span>
          <span aria-hidden="true" className="hidden sm:inline text-fg-muted">{"//"}</span>
          <span className="text-ui font-semibold text-accent">CTF</span>
        </Link>

        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <FlagDialog />
          <SoundToggle />
        </div>
      </div>
    </header>
  );
}
