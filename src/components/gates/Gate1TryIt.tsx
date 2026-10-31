"use client";

import React from "react";
import { TextAreaField } from "../ui/Field";
import { Button } from "../ui/Button";
import { StatusMessage } from "../ui/StatusMessage";
import { CopyButton } from "../ui/CopyButton";
import { FlagForm } from "../flag/FlagForm";
import { useAppState } from "../state/AppStateProvider";

export function Gate1TryIt() {
  const { state, setField, sendGate1Prompt } = useAppState();
  const { gate1 } = state;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendGate1Prompt();
  };

  const isBusy = gate1.status === "loading";

  return (
    <section aria-labelledby="tryit-heading" className="w-full rounded-lg border border-line bg-surface p-5 sm:p-6">
      <h3 id="tryit-heading" className="text-title font-semibold text-fg mb-4">
        Try it
      </h3>

      <form onSubmit={handleSubmit} className="space-y-4 mb-6">
        <TextAreaField
          label="Prompt"
          description='Sent as {"prompt": "..."} to POST /api/gate1/chat.'
          value={gate1.prompt}
          onChange={(e) => setField("gate1.prompt", e.target.value)}
          error={gate1.promptError === "required" ? "Enter a prompt to send." : null}
          disabled={isBusy}
          rows={4}
        />

        <Button
          type="submit"
          variant="primary"
          busy={isBusy}
          disabled={isBusy}
        >
          {isBusy ? "Sending…" : "Send prompt"}
        </Button>
      </form>

      {/* Response States */}
      {gate1.status === "blocked" && gate1.response && (
        <StatusMessage
          tone="warning"
          badgeLabel="Blocked by filter"
          badgeIcon="warning"
        >
          <p className="font-medium text-fg mb-2">No flag was returned.</p>
          <div className="p-3 rounded-md border border-line bg-inset font-mono text-code text-fg whitespace-pre-wrap">
            {gate1.response.response}
          </div>
        </StatusMessage>
      )}

      {gate1.status === "answered" && gate1.response && (
        <StatusMessage
          tone="neutral"
          badgeLabel="Answered, no flag"
        >
          <p className="font-medium text-fg mb-2">
            The prompt passed the filter, but the reply has no flag.
          </p>
          <div className="p-3 rounded-md border border-line bg-inset font-mono text-code text-fg whitespace-pre-wrap">
            {gate1.response.response}
          </div>
        </StatusMessage>
      )}

      {gate1.status === "flag-returned" && gate1.response && (
        <StatusMessage
          tone="success"
          badgeLabel="Flag returned"
          badgeIcon="accepted"
        >
          <div className="p-3 rounded-md border border-line bg-inset font-mono text-code text-fg whitespace-pre-wrap mb-4">
            {gate1.response.response}
          </div>

          {gate1.response.flag && (
            <div className="p-3 rounded-md border border-line bg-surface mb-4">
              <div className="text-caption font-medium text-fg-muted mb-1">Flag:</div>
              <div className="flex items-center justify-between gap-2">
                <code className="font-mono text-code font-bold text-success break-all select-all">
                  {gate1.response.flag}
                </code>
                <CopyButton value={gate1.response.flag} label="flag" />
              </div>
            </div>
          )}

          <div className="pt-3 border-t border-line">
            <FlagForm variant="inline" />
          </div>
        </StatusMessage>
      )}

      {gate1.status === "server-error" && gate1.error && (
        <StatusMessage
          tone="error"
          badgeLabel={gate1.error.status === 429 ? "Rate limited" : "Server error"}
          badgeIcon="server-error"
        >
          <p className="text-fg">{gate1.error.message}</p>
        </StatusMessage>
      )}

      {gate1.status === "network-error" && (
        <StatusMessage
          tone="error"
          badgeLabel="Not sent"
          badgeIcon="network-error"
        >
          <p className="text-fg">
            The prompt didn't reach the server. Check your connection and try again.
          </p>
        </StatusMessage>
      )}
    </section>
  );
}
