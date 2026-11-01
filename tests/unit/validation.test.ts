// src/lib/validation.ts (through tests/preserve/subjects.ts).
// Property 4 (K07): the handle check agrees with the server cleanup.
// Gate 3 assignment parsing (3.9). No server.
//
// **Validates: Requirements 2.15, 2.16, 3.4, 3.9**

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fc from "fast-check";
import { GATE3_MALFORMED_MESSAGE, checkHandle, cleanHandle, parseAssignment } from "../preserve/subjects.ts";
import { ACCEPTED_HANDLE, serverCleanHandle, serverKeepsHandle } from "../fixtures/baseline/handle-oracle.ts";

const MALFORMED = "Malformed assignment array. Expected valid JSON format.";

describe("validation: handle examples", () => {
  it("accepts a handle the server keeps unchanged", () => {
    assert.deepEqual(checkHandle("HAKU_PRIME_AGENT"), { accepted: true, required: false, recordedAs: null });
    assert.equal(checkHandle("a.b-c_9").accepted, true);
    assert.equal(checkHandle("  JABRIK  ").accepted, true, "surrounding spaces are trimmed by the server");
  });

  it("flags a handle the server would alter, with the handle it records", () => {
    assert.deepEqual(checkHandle("my agent!"), { accepted: false, required: false, recordedAs: "myagent" });
    assert.deepEqual(checkHandle("!!!"), { accepted: false, required: false, recordedAs: "" });
  });

  it("allows 24 characters and flags 25", () => {
    assert.equal(checkHandle("a".repeat(24)).accepted, true);
    assert.deepEqual(checkHandle("a".repeat(25)), { accepted: false, required: false, recordedAs: "a".repeat(24) });
  });

  it("gives the required result for empty or whitespace-only input, distinct from the format result", () => {
    for (const raw of ["", "   ", "\t", "\u00a0"]) {
      const r = checkHandle(raw);
      assert.equal(r.required, true, JSON.stringify(raw));
      assert.equal(r.accepted, false);
      assert.equal(r.recordedAs, null);
    }
  });

  it("the client cleanup is the server cleanup", () => {
    for (const raw of ["contract probe!", "  JABRIK  ", "!!!", "ünïcödé", "a".repeat(40), "x\ty"]) {
      assert.equal(cleanHandle(raw), serverCleanHandle(raw), JSON.stringify(raw));
    }
  });
});

// ---------------------------------------------------------------------------
// Property 4
// ---------------------------------------------------------------------------

const whitespace = fc.constantFrom(" ", "\t", "\u00a0", "\ufeff");
const pad = fc.array(whitespace, { maxLength: 3 }).map((ws) => ws.join(""));
const wrapped = (inner: fc.Arbitrary<string>): fc.Arbitrary<string> => fc.tuple(pad, inner, pad).map(([a, s, b]) => `${a}${s}${b}`);
const fullUnicode = fc.string({ unit: "binary", maxLength: 40 });
const handleLike = fc.stringMatching(/^[A-Za-z0-9_.-]{1,30}$/);
const handleInput = fc.oneof(fullUnicode, handleLike, wrapped(fullUnicode), wrapped(handleLike));

describe("Property 4: Preservation - the handle check agrees with the server cleanup", () => {
  it("accepts exactly when the server records the trimmed handle unchanged and non-empty (500 runs)", () => {
    fc.assert(
      fc.property(handleInput, (s) => {
        const r = checkHandle(s);
        assert.equal(r.accepted, serverKeepsHandle(s));
        assert.equal(r.accepted, ACCEPTED_HANDLE.test(s.trim()), "closed form ^[A-Za-z0-9_.-]{1,24}$ on the trimmed input");
        assert.equal(r.required, s.trim() === "");
        if (!r.accepted && !r.required) assert.equal(r.recordedAs, serverCleanHandle(s), "the format result names the recorded handle");
        assert.equal(cleanHandle(s), serverCleanHandle(s));
      }),
      { numRuns: 500 },
    );
  });
});

// ---------------------------------------------------------------------------
// Gate 3 assignment parsing
// ---------------------------------------------------------------------------

describe("validation: Gate 3 assignment", () => {
  it("the malformed message is the exact 3.9 text", () => {
    assert.equal(GATE3_MALFORMED_MESSAGE, MALFORMED);
  });

  it("parses boolean and signed-literal arrays as sent", () => {
    assert.deepEqual(parseAssignment("[true, false, true]"), { ok: true, value: [true, false, true] });
    assert.deepEqual(parseAssignment("[1, -2, 3]"), { ok: true, value: [1, -2, 3] });
    assert.deepEqual(parseAssignment("  [true]\n"), { ok: true, value: [true] }, "surrounding JSON whitespace");
    assert.deepEqual(parseAssignment('{"a":1}'), { ok: true, value: { a: 1 } }, "non-array JSON passes through");
  });

  it("rejects input that isn't JSON with the exact message", () => {
    for (const text of ["[true,", "true false", "[1, -2, 3", "", "   ", "{'a':1}"]) {
      assert.deepEqual(parseAssignment(text), { ok: false, message: MALFORMED }, JSON.stringify(text));
    }
  });
});
