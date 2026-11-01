// Countdown math (2.13, 3.7, 3.14). At HEAD c6d13ea the seconds formula sits
// inline in components/gates/Countdown.tsx, so the subject is the oracle in
// tests/preserve/subjects.ts (tied to that file by oracles.test.ts); the
// expiry time comes from the real reducer. No server.
//
// **Validates: Requirements 2.13, 3.7, 3.14**

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fc from "fast-check";
import { countdownRemaining, initialAppState, reducer } from "../preserve/subjects.ts";
import { GATES_BASELINE } from "../fixtures/baseline/gates-baseline.ts";

describe("countdown math", () => {
  it("remaining = max(0, ceil((expiresAt - now) / 1000)), never negative, 0 exactly when now >= expiresAt (property)", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 4_000_000_000_000 }), fc.integer({ min: -100_000, max: 100_000 }), (expiresAt, delta) => {
        const now = expiresAt - delta;
        const remaining = countdownRemaining(expiresAt, now);
        assert.equal(remaining, Math.max(0, Math.ceil((expiresAt - now) / 1000)));
        assert.ok(remaining >= 0);
        assert.equal(remaining === 0, now >= expiresAt);
      }),
      { numRuns: 500 },
    );
  });

  it("starts at the TTL, reaches 0 exactly at expiry, and only goes down", () => {
    for (const g of GATES_BASELINE.filter((x) => x.ttlSeconds !== null)) {
      const gate = g.number as 2 | 3 | 4;
      const ttl = g.ttlSeconds as number;
      const receivedAt = 1_700_000_000_000;
      const s = reducer.requestSuccess(reducer.requestStart(initialAppState, gate), gate, { sessionToken: "t.s", sequence: [], clauses: [], bytecodeHex: "" }, receivedAt, ttl);
      const slot = gate === 2 ? s.gate2 : gate === 3 ? s.gate3 : s.gate4;
      const expiresAt = slot.instance?.expiresAt as number;
      assert.equal(countdownRemaining(expiresAt, receivedAt), ttl, `Gate ${gate} starts at ${ttl}`);
      assert.equal(countdownRemaining(expiresAt, expiresAt - 1), 1);
      assert.equal(countdownRemaining(expiresAt, expiresAt), 0);
      let prev = Infinity;
      for (let t = receivedAt; t <= expiresAt + 1000; t += 250) {
        const r = countdownRemaining(expiresAt, t);
        assert.ok(r <= prev, "never goes up");
        prev = r;
      }
    }
  });

  it("depends only on the absolute expiry, so leaving and returning doesn't reset it (3.14)", () => {
    fc.assert(
      fc.property(fc.constantFrom(10, 15, 20), fc.integer({ min: 0, max: 25_000 }), (ttl, elapsed) => {
        const receivedAt = 1_700_000_000_000;
        const expiresAt = receivedAt + ttl * 1000;
        assert.equal(countdownRemaining(expiresAt, receivedAt + elapsed), Math.max(0, Math.ceil((ttl * 1000 - elapsed) / 1000)));
      }),
    );
  });
});
