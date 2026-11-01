import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";

export const metadata: Metadata = {
  title: "Page not found",
};

const linkClass =
  "inline-flex items-center gap-2 h-9 px-4 rounded-md border border-line-control bg-surface text-ui font-medium text-fg hover:bg-surface-hover hover:border-fg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus";

export default function NotFound() {
  return (
    <div className="py-16 text-center space-y-4">
      <h1 className="text-page-title font-semibold text-fg">Page not found</h1>
      <p className="text-body text-fg-secondary max-w-md mx-auto">
        There is no page at this address. AGENTGATE has Gates 1 to 4.
      </p>
      <div className="pt-4 flex flex-wrap items-center justify-center gap-3">
        <Link href="/" className={linkClass}>
          <ArrowLeft className="size-4" aria-hidden="true" />
          <span>Go to Overview</span>
        </Link>
        <Link href="/gates/1" className={linkClass}>
          <span>Go to Gate 1</span>
          <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
      </div>
    </div>
  );
}
