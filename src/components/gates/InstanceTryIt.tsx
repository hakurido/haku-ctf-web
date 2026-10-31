"use client";

import React, { useRef, useEffect } from "react";
import { InstanceGate } from "@/lib/app-state";
import { useAppState } from "../state/AppStateProvider";
import { Countdown } from "./Countdown";
import { Gate2Instance } from "./Gate2Instance";
import { Gate3Instance } from "./Gate3Instance";
import { Gate4Instance } from "./Gate4Instance";
import { Button } from "../ui/Button";
import { StatusMessage } from "../ui/StatusMessage";
import { CopyButton } from "../ui/CopyButton";
import { JsonDisclosure } from "../ui/JsonDisclosure";
import { FlagForm } from "../flag/FlagForm";

export function InstanceTryIt({ gate }: { gate: InstanceGate }) {
  const { state, requestInstance, submitInstance, announce } = useAppState();
  const slot = state[`gate${gate}`];
  const lastAnnouncedExpired = useRef<string | null>(null);

  const isRequestBusy = slot.status === "loading" && slot.op === "request";
  const isSubmitBusy = slot.status === "loading" && slot.op === "submit";

  // Announce expiry once when transitioning to expired
  useEffect(() => {
    if (slot.instance?.expired && slot.instance.data?.sessionToken) {
      const token = slot.instance.data.sessionToken;
      if (lastAnnouncedExpired.current !== token) {
        lastAnnouncedExpired.current = token;
        announce(`Gate ${gate} instance expired. Request a new instance to try again.`);
      }
    }
  }, [slot.instance?.expired, slot.instance?.data?.sessionToken, gate, announce]);

  const submitLabel =
    gate === 2
      ? isSubmitBusy
        ? "Submitting…"
        : "Submit predictions"
      : gate === 3
      ? isSubmitBusy
        ? "Submitting…"
        : "Submit assignment"
      : isSubmitBusy
      ? "Submitting…"
      : "Submit key";

  const isSubmitDisabled =
    !slot.instance ||
    slot.instance.expired ||
    slot.status === "loading" ||
    slot.status === "accepted";

  return (
    <section
      aria-labelledby="tryit-heading"
      className="w-full rounded-lg border border-line bg-surface p-5 sm:p-6"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 mb-5 border-b border-line">
        <h3 id="tryit-heading" className="text-title font-semibold text-fg">
          Try it
        </h3>

        {slot.instance && (
          <div className="flex items-center gap-3">
            <Countdown
              expiresAt={slot.instance.expiresAt}
              expired={slot.instance.expired}
            />
          </div>
        )}
      </div>

      {!slot.instance ? (
        <div className="py-8 px-4 text-center rounded-md border border-line bg-inset mb-6">
          <p className="text-ui text-fg-muted mb-4">
            {gate === 2 && "No instance yet. Request one to fetch the sequence."}
            {gate === 3 && "No instance yet. Request one to see the clauses."}
            {gate === 4 && "No instance yet. Request one to see the bytecode and opcode table."}
          </p>
          <Button
            variant="primary"
            busy={isRequestBusy}
            disabled={isRequestBusy}
            onClick={() => requestInstance(gate)}
          >
            {isRequestBusy ? "Requesting…" : "Request instance"}
          </Button>
        </div>
      ) : (
        <div className="space-y-6 mb-6">
          {gate === 2 && (
            <Gate2Instance
              data={slot.instance.data as any}
              readOnly={isSubmitDisabled}
            />
          )}
          {gate === 3 && (
            <Gate3Instance
              data={slot.instance.data as any}
              readOnly={isSubmitDisabled}
            />
          )}
          {gate === 4 && (
            <Gate4Instance
              data={slot.instance.data as any}
              readOnly={isSubmitDisabled}
            />
          )}

          <div className="flex flex-wrap items-center gap-3 pt-4 border-t border-line">
            <Button
              variant="primary"
              busy={isSubmitBusy}
              disabled={isSubmitDisabled}
              onClick={() => submitInstance(gate)}
            >
              {submitLabel}
            </Button>

            <Button
              variant="secondary"
              busy={isRequestBusy}
              disabled={isRequestBusy || isSubmitBusy}
              onClick={() => requestInstance(gate)}
            >
              {isRequestBusy ? "Requesting…" : "Request new instance"}
            </Button>
          </div>

          <JsonDisclosure value={slot.instance.data} />
        </div>
      )}

      {/* Outcome Messages */}
      {slot.status === "accepted" && slot.result && (
        <StatusMessage
          tone="success"
          badgeLabel="Accepted"
          badgeIcon="accepted"
        >
          <p className="font-medium text-fg mb-3">{slot.result.message}</p>
          {slot.result.flag && (
            <div className="p-3 rounded-md border border-line bg-surface mb-4">
              <div className="text-caption font-medium text-fg-muted mb-1">Flag:</div>
              <div className="flex items-center justify-between gap-2">
                <code className="font-mono text-code font-bold text-success break-all select-all">
                  {slot.result.flag}
                </code>
                <CopyButton value={slot.result.flag} label="flag" />
              </div>
            </div>
          )}
          <div className="pt-3 border-t border-line">
            <FlagForm variant="inline" />
          </div>
        </StatusMessage>
      )}

      {slot.status === "rejected" && slot.result && (
        <StatusMessage
          tone="error"
          badgeLabel="Rejected"
          badgeIcon="rejected"
        >
          <p className="text-fg">{slot.result.message}</p>
        </StatusMessage>
      )}

      {slot.status === "server-error" && slot.error && (
        <StatusMessage
          tone="error"
          badgeLabel={slot.error.status === 429 ? "Rate limited" : "Server error"}
          badgeIcon="server-error"
        >
          <p className="text-fg">{slot.error.message}</p>
        </StatusMessage>
      )}

      {slot.status === "network-error" && (
        <StatusMessage
          tone="error"
          badgeLabel="Not sent"
          badgeIcon="network-error"
        >
          <p className="text-fg">
            The request didn't reach the server. Check your connection and try again.
          </p>
        </StatusMessage>
      )}
    </section>
  );
}
