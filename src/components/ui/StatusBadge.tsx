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

export interface StatusBadgeProps {
  tone?: BadgeTone;
  icon?: "solved" | "unsolved" | "live" | "expired" | "accepted" | "rejected" | "warning" | "server-error" | "network-error" | ReactNode;
  children: React.ReactNode;
  className?: string;
}

export function StatusBadge({
  tone = "neutral",
  icon,
  children,
  className = "",
}: StatusBadgeProps) {
  let toneClasses = "bg-inset text-fg-secondary border-line";
  if (tone === "success") {
    toneClasses = "bg-success-subtle text-success border-success/35";
  } else if (tone === "error") {
    toneClasses = "bg-error-subtle text-error border-error/35";
  } else if (tone === "warning") {
    toneClasses = "bg-warning-subtle text-warning border-warning/35";
  } else if (tone === "accent") {
    toneClasses = "bg-accent-subtle text-accent border-accent/35";
  }

  const renderIcon = () => {
    if (!icon) return null;
    if (typeof icon !== "string") return icon;
    switch (icon) {
      case "solved":
        return <CircleCheck className="size-3.5 shrink-0" aria-hidden="true" />;
      case "unsolved":
        return <Circle className="size-3.5 shrink-0" aria-hidden="true" />;
      case "live":
        return <Timer className="size-3.5 shrink-0" aria-hidden="true" />;
      case "expired":
        return <TimerOff className="size-3.5 shrink-0" aria-hidden="true" />;
      case "accepted":
        return <Check className="size-3.5 shrink-0" aria-hidden="true" />;
      case "rejected":
        return <X className="size-3.5 shrink-0" aria-hidden="true" />;
      case "warning":
        return <TriangleAlert className="size-3.5 shrink-0" aria-hidden="true" />;
      case "server-error":
        return <CircleX className="size-3.5 shrink-0" aria-hidden="true" />;
      case "network-error":
        return <WifiOff className="size-3.5 shrink-0" aria-hidden="true" />;
      default:
        return null;
    }
  };

  return (
    <span
      className={`inline-flex h-6 items-center gap-1.5 rounded-sm border px-2 text-caption font-medium select-none ${toneClasses} ${className}`}
    >
      {renderIcon()}
      <span>{children}</span>
    </span>
  );
}
