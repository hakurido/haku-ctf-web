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

export function PrimaryNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Primary"
      className="border-b border-line bg-canvas/80 backdrop-blur-xs select-none"
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <ul className="flex items-center gap-1 sm:gap-2 h-11 flex-wrap sm:flex-nowrap">
          {navItems.map((item) => {
            const isExact = pathname === item.href;
            const isCurrent = item.match(pathname);

            return (
              <li key={item.key} className="flex-1 sm:flex-initial">
                <Link
                  href={item.href}
                  aria-current={isExact ? "page" : isCurrent ? "true" : undefined}
                  className={`relative flex items-center justify-center h-9 px-2 sm:px-3 rounded-md text-ui font-medium transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus ${
                    isCurrent
                      ? "text-fg bg-surface-hover font-semibold after:absolute after:inset-x-2 sm:after:inset-x-3 after:bottom-1 after:h-0.5 after:rounded-full after:bg-accent"
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
