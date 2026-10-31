import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function NotFound() {
  return (
    <div className="py-16 text-center space-y-4">
      <div className="font-mono text-heading text-accent font-semibold">404</div>
      <h1 className="text-display font-semibold text-fg">Page not found</h1>
      <p className="text-body text-fg-secondary max-w-md mx-auto">
        The requested path does not exist on this capture-the-flag proving ground.
      </p>
      <div className="pt-4">
        <Link
          href="/"
          className="inline-flex items-center gap-2 h-9 px-4 rounded-md border border-line-control bg-surface text-ui font-medium text-fg hover:bg-surface-hover hover:border-fg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          <span>Return to Overview</span>
        </Link>
      </div>
    </div>
  );
}
