"use client";

import React, { useMemo } from "react";
import { TextField } from "../ui/Field";
import { Button } from "../ui/Button";
import { StatusMessage } from "../ui/StatusMessage";
import { CopyButton } from "../ui/CopyButton";
import { useAppState } from "../state/AppStateProvider";
import { checkHandle } from "@/lib/validation";

export interface FlagFormProps {
  variant?: "page" | "inline" | "dialog";
  headingId?: string;
  onSuccess?: () => void;
  className?: string;
}

export function FlagForm({
  variant = "page",
  headingId,
  onSuccess,
  className = "",
}: FlagFormProps) {
  const { state, setField, submitFlag, dismissFlagResult } = useAppState();
  const { flag: flagSlot } = state;

  const handleValidation = useMemo(() => {
    return checkHandle(flagSlot.agentHandle);
  }, [flagSlot.agentHandle]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await submitFlag();
    if (onSuccess && flagSlot.status === "accepted") {
      onSuccess();
    }
  };

  const isBusy = flagSlot.status === "submitting";

  return (
    <div className={`w-full ${className}`}>
      {variant === "page" && (
        <h2 id={headingId} className="text-heading text-fg mb-2">
          Submit a flag
        </h2>
      )}
      {variant === "inline" && (
        <div className="mb-3">
          <h3 className="text-title text-fg">Submit this flag</h3>
          <p className="text-caption text-fg-muted mt-1">
            The flag is filled in. Add your agent handle to submit it to the scoreboard.
          </p>
        </div>
      )}

      {variant !== "inline" && (
        <p className="text-caption text-fg-muted mb-4">
          Each flag counts once per agent handle. Submitting it again adds no points.
        </p>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <TextField
          label="Agent handle"
          description="Letters, digits, _, - and ., up to 24 characters. The scoreboard records your flags under this handle."
          value={flagSlot.agentHandle}
          onChange={(e) => setField("flag.agentHandle", e.target.value)}
          error={
            flagSlot.fieldErrors.handle === "required"
              ? "Enter an agent handle."
              : !handleValidation.ok && handleValidation.reason === "format"
              ? handleValidation.recordedAs
                ? `This handle doesn't match the accepted format. The server will record it as ${handleValidation.recordedAs}.`
                : "This handle has no accepted characters. The server will reject it."
              : null
          }
          disabled={isBusy}
        />

        <TextField
          label="Flag"
          description="Format: HAKU{...}. A gate fills this in when it returns a flag."
          mono
          value={flagSlot.flag}
          onChange={(e) => setField("flag.flag", e.target.value)}
          error={
            flagSlot.fieldErrors.flag === "required" ? "Enter a flag." : null
          }
          disabled={isBusy}
        />

        <Button
          type="submit"
          variant="primary"
          busy={isBusy}
          disabled={isBusy}
          className="w-full sm:w-auto"
        >
          {isBusy ? "Submitting…" : "Submit flag"}
        </Button>
      </form>

      {flagSlot.status !== "idle" && flagSlot.status !== "submitting" && (
        <div className="mt-5">
          {flagSlot.status === "accepted" && (
            <StatusMessage
              tone="success"
              badgeLabel="Accepted"
              badgeIcon="accepted"
              action={
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={dismissFlagResult}
                  aria-label="Dismiss result"
                >
                  Dismiss
                </Button>
              }
            >
              <p className="font-medium text-fg">{flagSlot.message}</p>
              {flagSlot.recordedHandle && (
                <p className="text-caption text-fg-secondary mt-1">
                  Recorded as <span className="font-mono font-medium text-fg">{flagSlot.recordedHandle}</span>
                </p>
              )}
              {flagSlot.proofBadge && (
                <div className="mt-3 p-3 rounded-md border border-line bg-surface">
                  <div className="text-caption font-medium text-fg-muted mb-1">
                    Proof-of-Pwn badge (Issued because all four gates were solved):
                  </div>
                  <div className="font-mono text-code text-accent break-all select-all mb-2">
                    {flagSlot.proofBadge}
                  </div>
                  <CopyButton value={flagSlot.proofBadge} label="Proof-of-Pwn badge" />
                </div>
              )}
            </StatusMessage>
          )}

          {flagSlot.status === "rejected" && (
            <StatusMessage
              tone="error"
              badgeLabel="Rejected"
              badgeIcon="rejected"
              action={
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={dismissFlagResult}
                  aria-label="Dismiss result"
                >
                  Dismiss
                </Button>
              }
            >
              <p className="text-fg">{flagSlot.message || "The server rejected the flag and sent no message."}</p>
            </StatusMessage>
          )}

          {flagSlot.status === "server-error" && (
            <StatusMessage
              tone="error"
              badgeLabel="Rate limited"
              badgeIcon="server-error"
              action={
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={dismissFlagResult}
                  aria-label="Dismiss result"
                >
                  Dismiss
                </Button>
              }
            >
              <p className="text-fg">{flagSlot.message}</p>
            </StatusMessage>
          )}

          {flagSlot.status === "network-error" && (
            <StatusMessage
              tone="error"
              badgeLabel="Not sent"
              badgeIcon="network-error"
              action={
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={dismissFlagResult}
                  aria-label="Dismiss result"
                >
                  Dismiss
                </Button>
              }
            >
              <p className="text-fg">{flagSlot.message}</p>
            </StatusMessage>
          )}
        </div>
      )}
    </div>
  );
}
