// src/lib/format.ts (through tests/preserve/subjects.ts). No server.
//
// Only behavior that survives the gap fixes is tested: R-50 deletes
// formatClause and may delete formatTime, so neither is tested here, and the
// design's "primitive arrays on one line" rule for formatResponseJson isn't
// HEAD behavior (its replacer is a no-op), so the JSON test checks the
// round trip and the two-space indent only.
//
// **Validates: Requirements 3.16**

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fc from "fast-check";
import { formatPoints, formatResponseJson } from "../preserve/subjects.ts";

describe("formatPoints", () => {
  it("formats the gate points and the total with en-US separators", () => {
    assert.deepEqual([1000, 2000, 2500, 3000, 8500].map(formatPoints), ["1,000", "2,000", "2,500", "3,000", "8,500"]);
    assert.equal(formatPoints(0), "0");
    assert.equal(formatPoints(999), "999");
  });

  it("reads back as the same integer, grouped by thousands (property)", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 2_000_000_000 }), (n) => {
        const s = formatPoints(n);
        assert.match(s, /^\d{1,3}(,\d{3})*$/);
        assert.equal(Number(s.replace(/,/g, "")), n);
      }),
    );
  });
});

describe("formatResponseJson", () => {
  it("indents objects by two spaces", () => {
    assert.equal(formatResponseJson({ a: { b: 1 } }), '{\n  "a": {\n    "b": 1\n  }\n}');
  });

  it("round-trips any JSON value (property)", () => {
    fc.assert(
      fc.property(fc.jsonValue(), (v) => {
        assert.deepEqual(JSON.parse(formatResponseJson(v)), JSON.parse(JSON.stringify(v)));
      }),
    );
  });
});
