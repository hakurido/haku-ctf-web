import React, { ReactNode } from "react";
import { StatusBadge, BadgeTone, StatusBadgeProps } from "./StatusBadge";

export interface StatusMessageProps {
  tone?: BadgeTone;
  badgeLabel?: string;
  badgeIcon?: StatusBadgeProps["icon"];
  children: React.ReactNode;
  action?: ReactNode;
  className?: string;
}

const PANEL: Record<BadgeTone, string> = {
  neutral: "border-line bg-inset",
  success: "border-success/50 bg-success-subtle",
  error: "border-error/50 bg-error-subtle",
  warning: "border-warning/50 bg-warning-subtle",
  // The design has no accent result panel; keep it neutral as before.
  accent: "border-line bg-inset",
};

/**
 * A visible result area. It is not a live region: the caller announces the
 * result once through announce(), so nothing here is spoken twice.
 */
export function StatusMessage({
  tone = "neutral",
  badgeLabel,
  badgeIcon,
  children,
  action,
  className = "",
}: StatusMessageProps) {
  return (
    <div className={`rounded-lg border p-4 motion-safe:animate-enter ${PANEL[tone]} ${className}`}>
      {(badgeLabel || action) && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
          {badgeLabel && (
            <StatusBadge tone={tone} icon={badgeIcon}>
              {badgeLabel}
            </StatusBadge>
          )}
          {action && <div className="shrink-0">{action}</div>}
        </div>
      )}
      <div className="text-ui text-fg leading-relaxed">{children}</div>
    </div>
  );
}
