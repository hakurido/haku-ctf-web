"use client";

import React, { useEffect, useRef } from "react";
import { GATES, type InstanceGate } from "@/lib/gates";
import { serverErrorLabel } from "@/lib/format";
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

const SUBMIT_LABEL: Record<InstanceGate, string> = {
  2: "Submit predictions",
  3: "Submit assignment",
  4: "Submit key",
};

const IDLE_TEXT: Record<InstanceGate, string> = {
  2: "No instance yet. Request one to see the sequence, multiplier, and modulus.",
  3: "No instance yet. Request one to see the clauses.",
  4: "No instance yet. Request one to see the bytecode and opcode table.",
};

export function InstanceTryIt({ gate }: { gate: InstanceGate }) {
  const { state, requestInstance, submitInstance } = useAppState();
  const meta = GATES[gate - 1];

  const requestFirstRef = useRef<HTMLButtonElement>(null);
  const requestNewRef = useRef<HTMLButtonElement>(null);
  // Set when a request starts from a control that unmounts during the swap
  // between the idle and instance panels (R-26).
  const restoreFocus = useRef(false);

  const slot =
    gate === 2 ? state.gate2 : gate === 3 ? state.gate3 : state.gate4;
  const instance = slot.instance;

  const isRequestBusy = slot.status === "loading" && slot.op === "request";
  const isSubmitBusy = slot.status === "loading" && slot.op === "submit";

  // The provider's ticker announces the expiry once per instance (R-24), so
  // this view doesn't announce it again.

  useEffect(() => {
    if (!restoreFocus.current) return;
    // Only steps in when the focused control unmounted (focus fell to body).
    const lost = !document.activeElement || document.activeElement === document.body;
    if (lost) {
      const target = instance ? requestNewRef.current : requestFirstRef.current;
      target?.focus();
    }
    if (!isRequestBusy) restoreFocus.current = false;
  }, [instance, isRequestBusy]);

  const request = () => {
    restoreFocus.current = true;
    void requestInstance(gate);
  };

  const isSubmitDisabled =
    !instance || instance.expired || slot.status === "loading" || slot.status === "accepted";

  const retry = () => {
    if (slot.op === "submit" && instance && !instance.expired) {
      void submitInstance(gate);
    } else {
      request();
    }
  };

  const tryAgain = (
    <Button variant="secondary" size="sm" onClick={retry}>
      Try again
    </Button>
  );

  return (
    <section
      aria-labelledby="tryit-heading"
      className="w-full rounded-lg border border-line bg-surface p-5 sm:p-6"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 mb-5 border-b border-line">
        <h2 id="tryit-heading" className="text-heading font-semibold text-fg">
          Try it
        </h2>

        {/* The countdown stops showing once the answer is accepted (R-24). */}
        {instance && slot.status !== "accepted" && (
          <Countdown
            expiresAt={instance.expiresAt}
            expired={instance.expired}
            expiringAt={meta.expiringAtSeconds ?? 5}
          />
        )}
      </div>

      {!instance ? (
        <div className="py-8 px-4 text-center rounded-md border border-line bg-inset mb-6">
          <p className="text-ui text-fg-muted mb-4">{IDLE_TEXT[gate]}</p>
          <Button
            ref={requestFirstRef}
            variant="primary"
            busy={isRequestBusy}
            onClick={request}
          >
            {isRequestBusy ? "Requesting…" : "Request instance"}
          </Button>
        </div>
      ) : (
        <div className="space-y-6 mb-6">
          {gate === 2 && state.gate2.instance && (
            <Gate2Instance data={state.gate2.instance.data} readOnly={isSubmitDisabled} />
          )}
          {gate === 3 && state.gate3.instance && (
            <Gate3Instance data={state.gate3.instance.data} readOnly={isSubmitDisabled} />
          )}
          {gate === 4 && state.gate4.instance && (
            <Gate4Instance data={state.gate4.instance.data} readOnly={isSubmitDisabled} />
          )}

          <div className="flex flex-wrap items-center gap-3 pt-4 border-t border-line">
            <Button
              // One primary per gate: the inline flag form takes it once a flag shows (R-27).
              variant={slot.status === "accepted" ? "secondary" : "primary"}
              busy={isSubmitBusy}
              disabled={isSubmitDisabled && !isSubmitBusy}
              onClick={() => submitInstance(gate)}
            >
              {isSubmitBusy ? "Submitting…" : SUBMIT_LABEL[gate]}
            </Button>

            <Button
              ref={requestNewRef}
              variant="secondary"
              busy={isRequestBusy}
              disabled={isSubmitBusy}
              onClick={request}
            >
              {isRequestBusy ? "Requesting…" : "Request new instance"}
            </Button>
          </div>

          <JsonDisclosure value={instance.data} />
        </div>
      )}

      {slot.status === "accepted" && slot.result && (
        <StatusMessage tone="success" badgeLabel="Accepted" badgeIcon="accepted">
          <p className="font-medium text-fg mb-3">{slot.result.message}</p>
          {slot.result.flag && (
            <div className="p-3 rounded-md border border-line bg-surface mb-4">
              <div className="text-ui font-medium text-fg-muted mb-1">Flag</div>
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
        <StatusMessage tone="error" badgeLabel="Rejected" badgeIcon="rejected">
          <p className="text-fg">{slot.result.message}</p>
          <p className="text-fg-secondary mt-2">
            {instance && !instance.expired
              ? "Change your answer and submit again before the instance expires."
              : "Request a new instance to try again."}
          </p>
        </StatusMessage>
      )}

      {slot.status === "server-error" && (
        <StatusMessage
          tone="error"
          badgeLabel={serverErrorLabel(slot.error)}
          badgeIcon="server-error"
          action={tryAgain}
        >
          <p className="text-fg">{slot.error?.message}</p>
        </StatusMessage>
      )}

      {slot.status === "network-error" && (
        <StatusMessage
          tone="error"
          badgeLabel="Not sent"
          badgeIcon="network-error"
          action={tryAgain}
        >
          <p className="text-fg">
            {"The request didn't reach the server. Check your connection and try again."}
          </p>
        </StatusMessage>
      )}
    </section>
  );
}
