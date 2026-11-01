"use client";

import React, { useMemo } from "react";
import { TextField } from "../ui/Field";
import { Button } from "../ui/Button";
import { StatusMessage } from "../ui/StatusMessage";
import { CopyButton } from "../ui/CopyButton";
import { useAppState } from "../state/AppStateProvider";
import { checkHandle } from "@/lib/validation";
import { formatPoints, serverErrorLabel } from "@/lib/format";

export interface FlagFormProps {
  variant?: "page" | "inline" | "dialog";
  headingId?: string;
  /** Heading level for the "page" and "inline" headings (inline sits under an h3 result, 04). */
  headingLevel?: 2 | 3 | 4;
  /** Ids for the two fields, so a dialog can focus the first empty one (R-38). */
  handleId?: string;
  flagId?: string;
  className?: string;
}

function handleWarning(raw: string): string | null {
  const check = checkHandle(raw);
  if (check.ok || check.reason !== "format") return null;
  return check.recordedAs
    ? `This handle doesn't match the accepted format (letters, digits, _, - and ., up to 24 characters). The server will record it as ${check.recordedAs}.`
    : "This handle has no accepted characters (letters, digits, _, - and .). The server will reject it.";
}

export function FlagForm({
  variant = "page",
  headingId,
  headingLevel,
  handleId,
  flagId,
  className = "",
}: FlagFormProps) {
  const { state, setField, submitFlag, dismissFlagResult } = useAppState();
  const { flag: flagSlot } = state;

  // A warning, not an error: the request still goes out (2.16, R-36).
  const warning = useMemo(() => handleWarning(flagSlot.agentHandle), [flagSlot.agentHandle]);

  // The dialog stays open and shows every result (R-35), so there is no onSuccess.
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void submitFlag();
  };

  const isBusy = flagSlot.status === "submitting";
  const Heading = `h${headingLevel ?? (variant === "inline" ? 4 : 2)}` as "h2" | "h3" | "h4";

  const dismiss = (
    <Button variant="ghost" size="sm" onClick={dismissFlagResult} aria-label="Dismiss result">
      Dismiss
    </Button>
  );

  return (
    <div className={`w-full ${className}`}>
      {variant === "page" && (
        <Heading id={headingId} className="text-heading font-semibold text-fg mb-2">
          Submit a flag
        </Heading>
      )}
      {variant === "inline" && (
        <div className="mb-3">
          <Heading id={headingId} className="text-title font-semibold text-fg">
            Submit this flag
          </Heading>
          <p className="text-ui text-fg-muted mt-1">
            The flag is filled in. Add your agent handle to submit it to the scoreboard.
          </p>
        </div>
      )}

      {variant !== "inline" && (
        <p className="text-ui text-fg-muted mb-4">
          Each flag counts once per agent handle. Submitting it again adds no points.
        </p>
      )}

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <TextField
          id={handleId}
          label="Agent handle"
          description="Letters, digits, _, - and ., up to 24 characters. The scoreboard records your flags under this handle."
          autoComplete="off"
          value={flagSlot.agentHandle}
          onChange={(e) => setField("flag.agentHandle", e.target.value)}
          error={flagSlot.fieldErrors.handle === "required" ? "Enter an agent handle." : null}
          warning={warning}
        />

        <TextField
          id={flagId}
          label="Flag"
          description="Format: HAKU{...}. A gate fills this in when it returns a flag."
          mono
          autoComplete="off"
          spellCheck={false}
          value={flagSlot.flag}
          onChange={(e) => setField("flag.flag", e.target.value)}
          error={flagSlot.fieldErrors.flag === "required" ? "Enter a flag." : null}
        />

        <Button type="submit" variant="primary" busy={isBusy} className="w-full sm:w-auto">
          {isBusy ? "Submitting…" : "Submit flag"}
        </Button>
      </form>

      {flagSlot.status !== "idle" && flagSlot.status !== "submitting" && (
        <div className="mt-5">
          {flagSlot.status === "accepted" && (
            <StatusMessage tone="success" badgeLabel="Accepted" badgeIcon="accepted" action={dismiss}>
              <p className="font-medium text-fg">{flagSlot.message}</p>
              {flagSlot.agent && (
                <>
                  <p className="text-ui text-fg-secondary mt-1">
                    Recorded as{" "}
                    <code className="font-mono text-code font-medium text-fg">{flagSlot.agent.agentName}</code>
                  </p>
                  <p className="text-ui text-fg-secondary mt-1">
                    Score: {formatPoints(flagSlot.agent.score)} points. Gates solved:{" "}
                    {flagSlot.agent.gatesSolved.length > 0
                      ? [...flagSlot.agent.gatesSolved].sort((a, b) => a - b).join(", ")
                      : "none"}
                    .
                  </p>
                </>
              )}
              {!flagSlot.agent && flagSlot.recordedHandle && (
                <p className="text-ui text-fg-secondary mt-1">
                  Recorded as{" "}
                  <code className="font-mono text-code font-medium text-fg">{flagSlot.recordedHandle}</code>
                </p>
              )}
              {flagSlot.proofBadge && (
                <div className="mt-3 p-3 rounded-md border border-line bg-surface">
                  <div className="text-ui font-medium text-fg">Proof-of-Pwn badge</div>
                  <p className="text-ui text-fg-muted mb-2">
                    Issued because {flagSlot.recordedHandle ?? "this agent handle"} has solved all eight
                    gates.
                  </p>
                  <code className="block font-mono text-code text-accent break-all select-all mb-2">
                    {flagSlot.proofBadge}
                  </code>
                  <CopyButton value={flagSlot.proofBadge} label="badge" />
                </div>
              )}
              <div className="mt-3 pt-3 border-t border-line flex flex-wrap items-center justify-between gap-2">
                <span className="text-caption text-fg-muted">
                  Edge memory note: Standings are held in serverless edge memory. Save your Proof-of-Pwn badge for permanent verification.
                </span>
              </div>
            </StatusMessage>
          )}

          {flagSlot.status === "rejected" && (
            <StatusMessage tone="error" badgeLabel="Rejected" badgeIcon="rejected" action={dismiss}>
              <p className="text-fg">
                {flagSlot.message || "The server rejected the flag and sent no message."}
              </p>
            </StatusMessage>
          )}

          {flagSlot.status === "server-error" && (
            <StatusMessage
              tone="error"
              badgeLabel={serverErrorLabel(flagSlot.error)}
              badgeIcon="server-error"
              action={dismiss}
            >
              <p className="text-fg">{flagSlot.message}</p>
            </StatusMessage>
          )}

          {flagSlot.status === "network-error" && (
            <StatusMessage tone="error" badgeLabel="Not sent" badgeIcon="network-error" action={dismiss}>
              <p className="text-fg">{flagSlot.message}</p>
            </StatusMessage>
          )}
        </div>
      )}
    </div>
  );
}
