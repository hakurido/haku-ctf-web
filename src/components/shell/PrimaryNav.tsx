"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

interface NavItem {
  key: string;
  label: string;
  href: string;
  match: (pathname: string) => boolean;
}

const navItems: NavItem[] = [
  {
    key: "overview",
    label: "Overview",
    href: "/",
    match: (p) => p === "/",
  },
  {
    key: "gates",
    label: "Gates",
    href: "/gates/1",
    match: (p) => p === "/gates" || p.startsWith("/gates/"),
  },
  {
    key: "scoreboard",
    label: "Scoreboard",
    href: "/scoreboard",
    match: (p) => p === "/scoreboard",
  },
  {
    key: "docs",
    label: "Docs",
    href: "/docs",
    match: (p) => p === "/docs",
  },
  {
    key: "console",
    label: "Console",
    href: "/console",
    match: (p) => p === "/console",
  },
];

// Below `sm` the links use px-1.5 and a 2px gap so all five fit on one row in the
// 328px content box at 360px. The list still wraps, and `min-h-11` lets a wrapped
// second row grow the bar instead of drawing over `main` (R-43, M-03).
export function PrimaryNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Primary" className="border-b border-line bg-canvas select-none">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <ul className="flex flex-wrap items-center gap-0.5 sm:gap-2 min-h-11 py-1">
          {navItems.map((item) => {
            const isExact = pathname === item.href;
            const isCurrent = item.match(pathname);

            return (
              <li key={item.key}>
                <Link
                  href={item.href}
                  aria-current={isExact ? "page" : isCurrent ? "true" : undefined}
                  className={`relative flex items-center justify-center min-h-9 px-1.5 sm:px-3 rounded-md text-ui font-medium transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus ${
                    isCurrent
                      ? "text-fg bg-surface-hover font-semibold after:absolute after:inset-x-1.5 sm:after:inset-x-3 after:bottom-1 after:h-0.5 after:rounded-full after:bg-accent after:shadow-glow"
                      : "text-fg-secondary hover:text-fg hover:bg-surface-hover"
                  }`}
                >
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}
