import React, { ReactNode } from "react";
import { StatusBadge, BadgeTone } from "./StatusBadge";

export interface StatusMessageProps {
  tone?: BadgeTone;
  badgeLabel?: string;
  badgeIcon?: any;
  children: React.ReactNode;
  action?: ReactNode;
  className?: string;
}

export function StatusMessage({
  tone = "neutral",
  badgeLabel,
  badgeIcon,
  children,
  action,
  className = "",
}: StatusMessageProps) {
  let borderBg = "border-line bg-inset";
  if (tone === "success") {
    borderBg = "border-success/50 bg-success-subtle/40";
  } else if (tone === "error") {
    borderBg = "border-error/50 bg-error-subtle/40";
  } else if (tone === "warning") {
    borderBg = "border-warning/50 bg-warning-subtle/40";
  }

  return (
    <div
      role="status"
      className={`rounded-lg border p-4 transition-all ${borderBg} ${className}`}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
        {badgeLabel && (
          <StatusBadge tone={tone} icon={badgeIcon}>
            {badgeLabel}
          </StatusBadge>
        )}
        {action && <div className="shrink-0">{action}</div>}
      </div>
      <div className="text-ui text-fg leading-relaxed">{children}</div>
    </div>
  );
}
