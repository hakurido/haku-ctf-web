import React from "react";
import Link from "next/link";
import { BASE_URL } from "@/lib/gates";

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-line bg-canvas py-6">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-caption text-fg-muted font-sans">
        <div>
          AGENTGATE is built by{" "}
          <a
            href="https://hakudigital.tech"
            target="_blank"
            rel="noopener noreferrer"
            className="text-fg-secondary hover:text-accent underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus rounded-xs"
          >
            Haku Digital
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
          .
        </div>

        <div className="flex items-center gap-4">
          <Link
            href="/docs"
            className="text-fg-secondary hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus rounded-xs"
          >
            Docs
          </Link>
          <a
            href="/skill.md"
            className="text-fg-secondary hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus rounded-xs font-mono"
          >
            skill.md
          </a>
          <span className="font-mono text-fg-muted select-all">
            Base URL: {BASE_URL}
          </span>
        </div>
      </div>
    </footer>
  );
}
