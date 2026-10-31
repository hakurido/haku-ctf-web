"use client";

import React from "react";
import { Timer, TriangleAlert, TimerOff } from "lucide-react";
import { useNow } from "../state/AppStateProvider";

export interface CountdownProps {
  expiresAt: number;
  expired: boolean;
  className?: string;
}

export function Countdown({ expiresAt, expired, className = "" }: CountdownProps) {
  const now = useNow();

  if (expired || now >= expiresAt) {
    return (
      <div className={`inline-flex items-center gap-1.5 font-mono text-code text-warning font-medium ${className}`}>
        <TimerOff className="size-4 shrink-0" aria-hidden="true" />
        <span>Expired</span>
      </div>
    );
  }

  const secondsLeft = Math.max(0, Math.ceil((expiresAt - now) / 1000));
  const isExpiring = secondsLeft <= 5;

  return (
    <div
      className={`inline-flex items-center gap-1.5 font-mono text-code tabular-nums font-medium ${
        isExpiring ? "text-warning" : "text-fg"
      } ${className}`}
    >
      {isExpiring ? (
        <TriangleAlert className="size-4 shrink-0 text-warning" aria-hidden="true" />
      ) : (
        <Timer className="size-4 shrink-0 text-fg-muted" aria-hidden="true" />
      )}
      <span>{isExpiring ? `Expiring, ${secondsLeft} s left` : `Expires in ${secondsLeft} s`}</span>
    </div>
  );
}
