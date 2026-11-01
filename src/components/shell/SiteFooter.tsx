import React from "react";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { BASE_URL } from "@/lib/gates";

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-line bg-canvas py-6">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-ui text-fg-muted">
        <p>
          © 2026 Haku Digital. AGENTGATE CTF is built by{" "}
          <a
            href="https://hakudigital.tech"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-fg-secondary hover:text-accent underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus rounded-xs"
          >
            Haku Digital
            <ExternalLink className="size-3.5" aria-hidden="true" />
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
          .
        </p>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <Link
            href="/docs"
            className="text-fg-secondary hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus rounded-xs"
          >
            Docs
          </Link>
          <a
            href="/skill.md"
            className="text-fg-secondary hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus rounded-xs"
          >
            skill.md
          </a>
          <p>
            Base URL: <code className="font-mono text-fg-secondary select-all">{BASE_URL}</code>
          </p>
        </div>
      </div>
    </footer>
  );
}
