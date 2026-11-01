"use client";

import React, { useEffect, useState } from "react";
import { GATE1_RULES } from "@/lib/gates";
import { TextAreaField } from "../ui/Field";
import { Button } from "../ui/Button";
import { StatusMessage } from "../ui/StatusMessage";
import { CopyButton } from "../ui/CopyButton";
import { FlagForm } from "../flag/FlagForm";
import { useAppState } from "../state/AppStateProvider";
import { serverErrorLabel } from "@/lib/format";

const HINT =
  `The server trims the prompt, then requires ${GATE1_RULES.minLength} to ${GATE1_RULES.maxLength} characters ` +
  `and a SHA-256 hash that starts with ${GATE1_RULES.hashPrefix}. ` +
  "Agents usually append a nonce and increment it until the hash matches.";

/** First 8 hex characters of SHA-256 of `text`, computed locally (no request). */
async function sha256Prefix(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest).slice(0, 4), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Live trimmed length and hash prefix of the prompt (R-21). Sends nothing. */
function PromptReadout({ prompt }: { prompt: string }) {
  const trimmed = prompt.trim();
  const [hash, setHash] = useState<{ text: string; prefix: string } | null>(null);

  useEffect(() => {
    if (typeof crypto === "undefined" || !crypto.subtle) return;
    let cancelled = false;
    sha256Prefix(trimmed).then((prefix) => {
      if (!cancelled) setHash({ text: trimmed, prefix });
    });
    return () => {
      cancelled = true;
    };
  }, [trimmed]);

  const length = trimmed.length;
  const lengthOk = length >= GATE1_RULES.minLength && length <= GATE1_RULES.maxLength;
  const prefix = hash && hash.text === trimmed ? hash.prefix : null;
  const hashOk = prefix?.startsWith(GATE1_RULES.hashPrefix) ?? false;

  return (
    <dl className="flex flex-wrap gap-x-6 gap-y-1 text-ui text-fg-muted">
      <div className="flex gap-1.5">
        <dt>Trimmed length:</dt>
        <dd className={lengthOk ? "text-fg" : "text-warning"}>
          <span className="tabular-nums">{length}</span>{" "}
          {lengthOk ? "(in range)" : `(needs ${GATE1_RULES.minLength} to ${GATE1_RULES.maxLength})`}
        </dd>
      </div>
      <div className="flex gap-1.5">
        <dt>SHA-256 starts:</dt>
        <dd className={hashOk ? "text-fg" : "text-warning"}>
          {prefix ? (
            <>
              <code className="font-mono text-code">{prefix}</code>{" "}
              {hashOk ? "(matches)" : `(needs ${GATE1_RULES.hashPrefix})`}
            </>
          ) : (
            "…"
          )}
        </dd>
      </div>
    </dl>
  );
}

export function Gate1TryIt() {
  const { state, setField, sendGate1Prompt } = useAppState();
  const { gate1 } = state;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void sendGate1Prompt();
  };

  const isBusy = gate1.status === "loading";
  const flagShowing = gate1.status === "flag-returned";

  return (
    <section aria-labelledby="tryit-heading" className="w-full rounded-lg border border-line bg-surface p-5 sm:p-6">
      <h2 id="tryit-heading" className="text-heading font-semibold text-fg mb-4">
        Try it
      </h2>

      <form onSubmit={handleSubmit} className="space-y-4 mb-6">
        <div className="space-y-2">
          <TextAreaField
            label="Prompt"
            description={`Sent as {"prompt": "..."} to POST /api/gate1/chat. ${HINT}`}
            value={gate1.prompt}
            onChange={(e) => setField("gate1.prompt", e.target.value)}
            error={gate1.promptError === "required" ? "Enter a prompt to send." : null}
            rows={4}
          />
          <PromptReadout prompt={gate1.prompt} />
        </div>

        <Button
          type="submit"
          // One primary per gate: the inline flag form takes it once a flag shows (R-27).
          variant={flagShowing ? "secondary" : "primary"}
          busy={isBusy}
        >
          {isBusy ? "Sending…" : "Send prompt"}
        </Button>
      </form>

      {gate1.status === "blocked" && gate1.response && (
        <StatusMessage tone="warning" badgeLabel="Blocked" badgeIcon="warning">
          <p className="font-medium text-fg mb-2">No flag was returned. The server said:</p>
          <div className="p-3 rounded-md border border-line bg-inset font-mono text-code text-fg whitespace-pre-wrap">
            {gate1.response.response}
          </div>
        </StatusMessage>
      )}

      {gate1.status === "answered" && gate1.response && (
        <StatusMessage tone="neutral" badgeLabel="Answered, no flag">
          <p className="font-medium text-fg mb-2">
            The prompt passed the checks, but the reply has no flag.
          </p>
          <div className="p-3 rounded-md border border-line bg-inset font-mono text-code text-fg whitespace-pre-wrap">
            {gate1.response.response}
          </div>
        </StatusMessage>
      )}

      {flagShowing && gate1.response && (
        <StatusMessage tone="success" badgeLabel="Flag returned" badgeIcon="accepted">
          <div className="p-3 rounded-md border border-line bg-inset font-mono text-code text-fg whitespace-pre-wrap mb-4">
            {gate1.response.response}
          </div>

          {gate1.response.flag && (
            <div className="p-3 rounded-md border border-line bg-surface mb-4">
              <div className="text-ui font-medium text-fg-muted mb-1">Flag</div>
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

      {gate1.status === "server-error" && (
        <StatusMessage
          tone="error"
          badgeLabel={serverErrorLabel(gate1.error)}
          badgeIcon="server-error"
          action={
            <Button variant="secondary" size="sm" onClick={() => void sendGate1Prompt()}>
              Try again
            </Button>
          }
        >
          <p className="text-fg">{gate1.error?.message}</p>
        </StatusMessage>
      )}

      {gate1.status === "network-error" && (
        <StatusMessage
          tone="error"
          badgeLabel="Not sent"
          badgeIcon="network-error"
          action={
            <Button variant="secondary" size="sm" onClick={() => void sendGate1Prompt()}>
              Try again
            </Button>
          }
        >
          <p className="text-fg">
            {"The prompt didn't reach the server. Check your connection and try again."}
          </p>
        </StatusMessage>
      )}
    </section>
  );
}
