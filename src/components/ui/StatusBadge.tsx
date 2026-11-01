import React, { ReactNode } from "react";
import {
  CircleCheck,
  Circle,
  Timer,
  TimerOff,
  Check,
  X,
  TriangleAlert,
  CircleX,
  WifiOff,
} from "lucide-react";

export type BadgeTone = "neutral" | "success" | "error" | "warning" | "accent";

export type BadgeIconName =
  | "solved"
  | "unsolved"
  | "live"
  | "expired"
  | "accepted"
  | "rejected"
  | "warning"
  | "server-error"
  | "network-error";

export interface StatusBadgeProps {
  tone?: BadgeTone;
  /** A named status icon, or a custom aria-hidden icon element. */
  icon?: BadgeIconName | ReactNode;
  children: React.ReactNode;
  className?: string;
}

const TONE: Record<BadgeTone, string> = {
  neutral: "bg-inset text-fg-secondary border-line",
  success: "bg-success-subtle text-success border-success/35",
  error: "bg-error-subtle text-error border-error/35",
  warning: "bg-warning-subtle text-warning border-warning/35",
  accent: "bg-accent-subtle text-accent border-accent/35",
};

const ICON_CLASS = "size-3.5 shrink-0";

function renderIcon(icon: StatusBadgeProps["icon"]): ReactNode {
  if (!icon) return null;
  if (typeof icon !== "string") return icon;
  switch (icon) {
    case "solved":
      return <CircleCheck className={ICON_CLASS} aria-hidden="true" />;
    case "unsolved":
      return <Circle className={ICON_CLASS} aria-hidden="true" />;
    case "live":
      return <Timer className={ICON_CLASS} aria-hidden="true" />;
    case "expired":
      return <TimerOff className={ICON_CLASS} aria-hidden="true" />;
    case "accepted":
      return <Check className={ICON_CLASS} aria-hidden="true" />;
    case "rejected":
      return <X className={ICON_CLASS} aria-hidden="true" />;
    case "warning":
      return <TriangleAlert className={ICON_CLASS} aria-hidden="true" />;
    case "server-error":
      return <CircleX className={ICON_CLASS} aria-hidden="true" />;
    case "network-error":
      return <WifiOff className={ICON_CLASS} aria-hidden="true" />;
    default:
      return null;
  }
}

export function StatusBadge({
  tone = "neutral",
  icon,
  children,
  className = "",
}: StatusBadgeProps) {
  return (
    <span
      className={`inline-flex h-6 items-center gap-1 rounded-sm border px-2 text-caption font-medium ${TONE[tone]} ${className}`}
    >
      {renderIcon(icon)}
      <span>{children}</span>
    </span>
  );
}
