// src/lib/app-state.ts (through tests/preserve/subjects.ts): the reducer is
// pure and keeps the state rules the visitor flows rely on. No server.
//
// Field values are set by building state from the documented shape
// (subjects.withFields), not through `field/set`, which R-06 may split. The
// fix removes `console/set` and may remove `retryAt` (R-04, R-06); neither is
// tested. Auto-fill is checked only for what 3.5 preserves (the flag is
// filled, the handle untouched), because R-05 changes what else it resets.
//
// **Validates: Requirements 3.4, 3.5, 3.7, 3.11, 3.14, 2.12, 2.13, 2.25**

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fc from "fast-check";
import { canSubmit, initialAppState, reducer, withFields, type AppState, type InstanceGate } from "../preserve/subjects.ts";

const NOW = 1_700_000_000_000;
const g2Data = (token = "t2.sig") => ({ status: "ok", gate: 2, sequence: ["1", "2", "3", "4"], sessionToken: token, ttlSeconds: 15 });
const dataFor = (gate: InstanceGate, token: string) =>
  gate === 2
    ? g2Data(token)
    : gate === 3
      ? { status: "ok", gate: 3, variablesCount: 120, clausesCount: 1, clauses: [[1, -2, 3]], sessionToken: token, ttlSeconds: 10 }
      : { status: "ok", gate: 4, bytecodeHex: "ff", vmSpec: { opcodes: { "0xFF": "HALT_SUCCESS" } }, sessionToken: token, ttlSeconds: 20 };
const slotOf = (s: AppState, gate: InstanceGate) => (gate === 2 ? s.gate2 : gate === 3 ? s.gate3 : s.gate4);

function deepFreeze<T>(v: T): T {
  if (v && typeof v === "object" && !Object.isFrozen(v)) {
    Object.freeze(v);
    for (const k of Object.keys(v)) deepFreeze((v as Record<string, unknown>)[k]);
  }
  return v;
}

describe("app-state: initial state", () => {
  it("starts idle with sound off and one console line", () => {
    const s = initialAppState;
    assert.equal(s.soundOn, false, "sound starts off (2.25)");
    for (const g of [2, 3, 4] as const) {
      const slot = slotOf(s, g);
      assert.equal(slot.status, "idle");
      assert.equal(slot.instance, null);
      assert.equal(slot.result, null);
      assert.equal(slot.error, null);
    }
    assert.equal(s.flag.agentHandle, "");
    assert.equal(s.flag.flag, "");
    assert.equal(s.flag.status, "idle");
    assert.equal(s.scoreboard.entries, null, "never loaded");
    assert.equal(s.console.history.length, 1);
    assert.equal(s.console.history[0].command, null);
  });
});

describe("app-state: instance lifecycle (3.7, 2.12, 2.13)", () => {
  it("request start clears the previous instance, result, error, and inputs", () => {
    let s = withFields(initialAppState, { gate2: ["1", "2", "3"] });
    s = reducer.requestSuccess(reducer.requestStart(s, 2), 2, g2Data("old.sig"), NOW, 15);
    s = reducer.submitSuccess(reducer.submitStart(s, 2), 2, { success: false, message: "Prediction mismatch at step 1." });
    assert.equal(s.gate2.status, "rejected");
    s = reducer.requestStart(s, 2);
    assert.equal(s.gate2.status, "loading");
    assert.equal(s.gate2.instance, null);
    assert.equal(s.gate2.result, null);
    assert.equal(s.gate2.error, null);
    assert.deepEqual(s.gate2.inputs, ["", "", ""]);
    assert.equal(canSubmit(s.gate2), false);
  });

  it("request success makes a live instance expiring at now + ttl * 1000", () => {
    for (const [gate, ttl] of [[2, 15], [3, 10], [4, 20]] as const) {
      const data = dataFor(gate, `g${gate}.sig`);
      const s = reducer.requestSuccess(reducer.requestStart(initialAppState, gate), gate, data, NOW, ttl);
      const slot = slotOf(s, gate);
      assert.equal(slot.status, "live");
      assert.deepEqual(slot.instance?.data, data);
      assert.equal(slot.instance?.expiresAt, NOW + ttl * 1000);
      assert.equal(slot.instance?.expired, false);
      assert.equal(canSubmit(slot), true);
    }
  });

  it("expiry moves live to expired once, and keeps other statuses", () => {
    const live = reducer.requestSuccess(reducer.requestStart(initialAppState, 2), 2, g2Data(), NOW, 15);
    const expired = reducer.expire(live, 2);
    assert.equal(expired.gate2.status, "expired");
    assert.equal(expired.gate2.instance?.expired, true);
    assert.equal(canSubmit(expired.gate2), false, "Submit is disabled once expired");
    assert.equal(reducer.expire(expired, 2), expired, "a second expiry changes nothing");
    const accepted = reducer.submitSuccess(reducer.submitStart(live, 2), 2, { success: true, message: "ok", flag: "HAKU{g2}" });
    const acceptedExpired = reducer.expire(accepted, 2);
    assert.equal(acceptedExpired.gate2.status, "accepted");
    assert.equal(acceptedExpired.gate2.instance?.expired, true);
    assert.equal(reducer.expire(initialAppState, 2), initialAppState, "no instance, nothing to expire");
  });

  it("submit start is busy: Submit is disabled while the request runs", () => {
    const live = reducer.requestSuccess(reducer.requestStart(initialAppState, 4), 4, dataFor(4, "k.sig"), NOW, 20);
    const busy = reducer.submitStart(live, 4);
    assert.equal(busy.gate4.status, "loading");
    assert.notEqual(busy.gate4.instance, null, "the instance stays while submitting");
    assert.equal(canSubmit(busy.gate4), false);
  });

  it("an accepted submit fills the flag and leaves the handle (3.5)", () => {
    let s = withFields(initialAppState, { handle: "keep_me" });
    s = reducer.requestSuccess(reducer.requestStart(s, 3), 3, dataFor(3, "s.sig"), NOW, 10);
    s = reducer.submitSuccess(reducer.submitStart(s, 3), 3, { success: true, message: "solved", flag: "HAKU{g3}" });
    assert.equal(s.gate3.status, "accepted");
    assert.equal(s.flag.flag, "HAKU{g3}");
    assert.equal(s.flag.agentHandle, "keep_me");
    assert.equal(canSubmit(s.gate3), false);
  });

  it("a 429 stores the server message and shows no instance", () => {
    const s = reducer.requestError(reducer.requestStart(initialAppState, 2), 2, {
      status: 429,
      message: "Rate limit exceeded. Retry in 42s.",
      body: { error: "Too Many Requests", message: "Rate limit exceeded. Retry in 42s." },
    });
    assert.equal(s.gate2.status, "server-error");
    assert.equal(s.gate2.instance, null);
    assert.equal(s.gate2.error?.status, 429);
    assert.equal(s.gate2.error?.message, "Rate limit exceeded. Retry in 42s.");
    assert.equal(canSubmit(s.gate2), false);
  });
});

describe("app-state: Gate 1 and the flag form (3.4, 3.5, 3.6)", () => {
  it("classifies Gate 1 answers and fills the flag without touching the handle", () => {
    const base = withFields(initialAppState, { handle: "keep_me", prompt: "p" });
    const blocked = reducer.gate1Success(reducer.gate1Start(base), { allowed: false, response: "[SHIELD TRIPWIRE] x", flag: null });
    assert.equal(blocked.gate1.status, "blocked");
    assert.equal(blocked.flag.flag, "");
    const flagged = reducer.gate1Success(reducer.gate1Start(base), { allowed: true, response: "Memory artifact: HAKU{g1}", flag: "HAKU{g1}" });
    assert.equal(flagged.gate1.status, "flag-returned");
    assert.equal(flagged.flag.flag, "HAKU{g1}");
    assert.equal(flagged.flag.agentHandle, "keep_me");
    const answered = reducer.gate1Success(reducer.gate1Start(base), { allowed: true, response: "hello", flag: null });
    assert.equal(answered.gate1.status, "answered");
  });

  it("an accepted flag keeps the server message, recorded handle, and badge; dismiss keeps the fields", () => {
    let s = withFields(initialAppState, { handle: "probe k11", flag: "HAKU{g1}" });
    s = reducer.flagStart(s);
    assert.equal(s.flag.status, "submitting");
    s = reducer.flagSuccess(s, {
      success: true,
      message: "FLAG ACCEPTED for Gate 1! +1000 points.",
      agent: { agentName: "probek11", gatesSolved: [1], score: 1000, lastSolveAt: NOW },
      proofBadge: "HAKU{AGENT_PROBEK11_GATES_1234_VERIFIED_0123456789abcdef}",
      allGatesCleared: true,
    });
    assert.equal(s.flag.status, "accepted");
    assert.equal(s.flag.message, "FLAG ACCEPTED for Gate 1! +1000 points.");
    assert.equal(s.flag.recordedHandle, "probek11");
    assert.equal(s.flag.proofBadge, "HAKU{AGENT_PROBEK11_GATES_1234_VERIFIED_0123456789abcdef}");
    const dismissed = reducer.flagDismiss(s);
    assert.equal(dismissed.flag.status, "idle");
    assert.equal(dismissed.flag.message, null);
    assert.equal(dismissed.flag.proofBadge, null);
    assert.equal(dismissed.flag.agentHandle, "probe k11");
    assert.equal(dismissed.flag.flag, "HAKU{g1}");
  });

  it("a rejected flag keeps the server message verbatim", () => {
    const s = reducer.flagRejected(reducer.flagStart(initialAppState), "FLAG REJECTED: Invalid or fake flag token.");
    assert.equal(s.flag.status, "rejected");
    assert.equal(s.flag.message, "FLAG REJECTED: Invalid or fake flag token.");
  });
});

describe("app-state: scoreboard, console, sound (3.11, 3.14)", () => {
  it("keeps standings in the returned order and keeps them on a failed refresh", () => {
    const entries = [
      { agentName: "b", gatesSolved: [1], score: 1000, lastSolveAt: 2 },
      { agentName: "a", gatesSolved: [1, 2, 3, 4], score: 8500, lastSolveAt: 1, proofBadge: "HAKU{x}" },
    ];
    let s = reducer.scoreboardSuccess(reducer.scoreboardStart(initialAppState), entries, NOW);
    assert.equal(s.scoreboard.status, "loaded");
    assert.deepEqual(s.scoreboard.entries, entries);
    s = reducer.scoreboardError(reducer.scoreboardStart(s), { status: 429, message: "Rate limit exceeded. Retry in 5s.", body: null });
    assert.deepEqual(s.scoreboard.entries, entries, "rows from the last successful load stay");
    assert.equal(s.scoreboard.error?.message, "Rate limit exceeded. Retry in 5s.");
  });

  it("appends console output and clears it", () => {
    let s = reducer.consoleAdd(initialAppState, { command: "gates", output: "Gate 1 ...", tone: "normal" });
    s = reducer.consoleAdd(s, { command: "foo", output: "Unknown command", tone: "error" });
    assert.equal(s.console.history.length, 3);
    assert.deepEqual(s.console.history.slice(1).map((e) => e.command), ["gates", "foo"]);
    assert.equal(new Set(s.console.history.map((e) => e.id)).size, 3, "ids are unique");
    assert.deepEqual(reducer.consoleClear(s).console.history, []);
  });

  it("toggles sound", () => {
    assert.equal(reducer.toggleSound(initialAppState).soundOn, true);
    assert.equal(reducer.toggleSound(reducer.toggleSound(initialAppState)).soundOn, false);
  });
});

// ---------------------------------------------------------------------------
// Purity and instance invariants (property)
// ---------------------------------------------------------------------------

type Step =
  | { op: "request"; gate: InstanceGate }
  | { op: "receive"; gate: InstanceGate; ttl: number }
  | { op: "fail"; gate: InstanceGate; status: number }
  | { op: "submit"; gate: InstanceGate }
  | { op: "answer"; gate: InstanceGate; success: boolean }
  | { op: "tick"; gate: InstanceGate }
  | { op: "flag"; kind: "start" | "accept" | "reject" | "dismiss" };

const gateArb = fc.constantFrom<InstanceGate>(2, 3, 4);
const stepArb: fc.Arbitrary<Step> = fc.oneof(
  gateArb.map((gate) => ({ op: "request" as const, gate })),
  fc.record({ op: fc.constant("receive" as const), gate: gateArb, ttl: fc.constantFrom(10, 15, 20) }),
  fc.record({ op: fc.constant("fail" as const), gate: gateArb, status: fc.constantFrom(429, 500) }),
  gateArb.map((gate) => ({ op: "submit" as const, gate })),
  fc.record({ op: fc.constant("answer" as const), gate: gateArb, success: fc.boolean() }),
  gateArb.map((gate) => ({ op: "tick" as const, gate })),
  fc.constantFrom("start", "accept", "reject", "dismiss").map((kind) => ({ op: "flag" as const, kind: kind as "start" | "accept" | "reject" | "dismiss" })),
);

/** Applies a step the way the provider would (its guards decide whether the event is sent). */
function apply(s: AppState, step: Step, i: number): AppState {
  if (step.op === "flag") {
    if (step.kind === "start") return s.flag.status === "submitting" ? s : reducer.flagStart(s);
    if (s.flag.status !== "submitting") return s;
    if (step.kind === "accept")
      return reducer.flagSuccess(s, { success: true, message: "ok", agent: { agentName: "p", gatesSolved: [1], score: 1000, lastSolveAt: i }, proofBadge: null, allGatesCleared: false });
    if (step.kind === "reject") return reducer.flagRejected(s, "FLAG REJECTED: Invalid or fake flag token.");
    return reducer.flagDismiss(s);
  }
  const slot = slotOf(s, step.gate);
  const requesting = slot.status === "loading" && slot.instance === null;
  const submitting = slot.status === "loading" && slot.instance !== null;
  switch (step.op) {
    case "request":
      return slot.status === "loading" ? s : reducer.requestStart(s, step.gate);
    case "receive":
      return requesting ? reducer.requestSuccess(s, step.gate, dataFor(step.gate, `tok${i}.sig`), NOW + i, step.ttl) : s;
    case "fail": {
      const error = { status: step.status, message: `HTTP ${step.status}`, body: null };
      if (requesting) return reducer.requestError(s, step.gate, error);
      return submitting ? reducer.submitError(s, step.gate, error) : s;
    }
    case "submit":
      return canSubmit(slot) ? reducer.submitStart(s, step.gate) : s;
    case "answer":
      return submitting ? reducer.submitSuccess(s, step.gate, { success: step.success, message: "m" }) : s;
    case "tick":
      return slot.instance && !slot.instance.expired ? reducer.expire(s, step.gate) : s;
  }
}

describe("app-state: the reducer is pure and keeps the instance invariants (property)", () => {
  it("never mutates its input, is deterministic, and keeps instance invariants (300 runs)", () => {
    fc.assert(
      fc.property(fc.array(stepArb, { maxLength: 40 }), (steps) => {
        let s = deepFreeze(initialAppState);
        let again: AppState = initialAppState;
        const expiredTokens = new Set<string>();
        steps.forEach((step, i) => {
          const before = JSON.stringify(s);
          const next = apply(s, step, i);
          assert.equal(JSON.stringify(s), before, "input state unchanged");
          again = apply(again, step, i);
          s = deepFreeze(next);
          for (const g of [2, 3, 4] as const) {
            const slot = slotOf(s, g);
            if (slot.status === "idle") assert.equal(slot.instance, null);
            if (["live", "expired", "accepted", "rejected"].includes(slot.status)) assert.notEqual(slot.instance, null, `${slot.status} has an instance`);
            const token = (slot.instance?.data as { sessionToken?: string } | undefined)?.sessionToken;
            if (token && expiredTokens.has(token)) assert.equal(slot.instance?.expired, true, "expired never turns back");
            if (token && slot.instance?.expired) expiredTokens.add(token);
            if (slot.status === "expired") assert.equal(canSubmit(slot), false);
          }
        });
        assert.deepEqual(again, s, "the same events give the same state");
      }),
      { numRuns: 300 },
    );
  });
});
