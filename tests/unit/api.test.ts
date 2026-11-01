// src/lib/api.ts (through tests/preserve/subjects.ts), with a stub fetch
// that records each request. No server.
//
// - One example per R12 classification rule, in order.
// - The error-mapping and network properties (2.10, 2.11, A12).
// - Property 5 (K08): gate payloads keep trimming and pass-through.
//
// Only rules HEAD c6d13ea already follows are asserted. The design's rule 1
// also says a 429 carrying a boolean `success` is a server error; HEAD
// classifies such a body as ok, and the real server never sends one (its 429
// bodies are `{error, message}`), so only the real 429 shape is tested.
// Fallback wording (R-08 changes it) is checked as "a non-empty message".
//
// **Validates: Requirements 3.4, 3.6, 3.7, 3.8, 3.9, 2.10, 2.11**

import { describe, it, type TestContext } from "node:test";
import assert from "node:assert/strict";
import fc from "fast-check";
import { GATE3_MALFORMED_MESSAGE, api, submitInstance, type ApiSubjectResult } from "../preserve/subjects.ts";

const MALFORMED = "Malformed assignment array. Expected valid JSON format.";

interface Call {
  method: string;
  path: string;
  contentType: string | null;
  body: string | null;
}

type Reply = { status: number; json?: unknown; text?: string; contentType?: string } | { reject: unknown };

/** Replaces global fetch for this test; `reply` decides each response. Returns the recorded calls. */
function stubFetch(t: TestContext, reply: (call: Call) => Reply): Call[] {
  const calls: Call[] = [];
  t.mock.method(globalThis, "fetch", async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const url = new URL(String(input), "http://stub.invalid");
    const call: Call = {
      method: (init?.method ?? "GET").toUpperCase(),
      path: url.pathname,
      contentType: new Headers(init?.headers).get("content-type"),
      body: typeof init?.body === "string" ? init.body : null,
    };
    calls.push(call);
    const r = reply(call);
    if ("reject" in r) throw r.reject;
    const text = r.json !== undefined ? JSON.stringify(r.json) : (r.text ?? "");
    return new Response(text, { status: r.status, headers: { "content-type": r.contentType ?? "application/json" } });
  });
  return calls;
}

const RATE_LIMIT = { error: "Too Many Requests", message: "Rate limit exceeded. Retry in 42s." };
const TOKEN = "eyJnYXRlIjoyfQ.c2lnbmF0dXJl";

function assertServerError(r: ApiSubjectResult, status: number): asserts r is Extract<ApiSubjectResult, { kind: "server-error" }> {
  assert.equal(r.kind, "server-error");
  assert.equal((r as { status: number }).status, status);
}

describe("api.ts: R12 rules in order", () => {
  it("rule 0: a rejected fetch is a network error for every helper", async (t) => {
    stubFetch(t, () => ({ reject: new TypeError("Failed to fetch") }));
    for (const r of [
      await api.getScoreboard(),
      await api.postFlag("a", "b"),
      await api.postGate1Prompt("p"),
      await api.getChallenge(2),
      await api.submitGate2({ sessionToken: "x.y", predictions: ["1", "2", "3"] }),
    ]) {
      assert.deepEqual(r, { kind: "network-error" });
    }
  });

  it("rule 1: HTTP 429 is a server error with the message verbatim and the retry seconds", async (t) => {
    stubFetch(t, (c) =>
      c.path === "/api/scoreboard" && c.method === "POST"
        ? { status: 429, json: { error: "Too Many Requests", message: "Rate limit exceeded. Anti-bruteforce sleep for 12s." } }
        : { status: 429, json: RATE_LIMIT },
    );
    const challenge = await api.getChallenge(2);
    assertServerError(challenge, 429);
    assert.equal(challenge.message, RATE_LIMIT.message);
    assert.equal(challenge.retryAfterSec, 42);
    const flag = await api.postFlag("probe", "HAKU{x}");
    assertServerError(flag, 429);
    assert.equal(flag.message, "Rate limit exceeded. Anti-bruteforce sleep for 12s.");
    assert.equal(flag.retryAfterSec, 12);
    const chat = await api.postGate1Prompt("hello");
    assertServerError(chat, 429);
    assert.equal(chat.message, RATE_LIMIT.message);
  });

  it("rule 2: a boolean success is ok at 200, 400, and 403", async (t) => {
    const replies: Record<string, Reply> = {
      "POST /api/scoreboard": { status: 403, json: { success: false, message: "FLAG REJECTED: Invalid or fake flag token." } },
      "POST /api/gate2/submit": { status: 400, json: { success: false, message: "Invalid signature / token forgery detected." } },
      "POST /api/gate3/submit": { status: 200, json: { success: true, message: "solved", flag: "HAKU{x}" } },
    };
    stubFetch(t, (c) => replies[`${c.method} ${c.path}`]);
    const rejected = await api.postFlag("probe", "HAKU{fake}");
    assert.equal(rejected.kind, "ok");
    assert.equal((rejected as { status: number }).status, 403);
    assert.deepEqual((rejected as { data: unknown }).data, { success: false, message: "FLAG REJECTED: Invalid or fake flag token." });
    const g2 = await api.submitGate2({ sessionToken: "x.y", predictions: ["1", "2", "3"] });
    assert.equal(g2.kind, "ok");
    assert.equal((g2 as { data: { success: boolean } }).data.success, false);
    const g3 = await api.submitGate3({ sessionToken: "x.y", assignment: [true] });
    assert.equal(g3.kind, "ok");
    assert.equal((g3 as { data: { flag: string } }).data.flag, "HAKU{x}");
  });

  it("rule 2: an accepted flag is ok with the recorded agent", async (t) => {
    const body = {
      success: true,
      message: "FLAG ACCEPTED for Gate 1! +1000 points.",
      agent: { agentName: "probe", gatesSolved: [1], score: 1000, lastSolveAt: 1 },
      proofBadge: null,
      allGatesCleared: false,
    };
    stubFetch(t, () => ({ status: 200, json: body }));
    const r = await api.postFlag("probe", "HAKU{x}");
    assert.equal(r.kind, "ok");
    assert.deepEqual((r as { data: unknown }).data, body);
  });

  it("rule 3: Gate 1's allowed: false at 200 is ok (blocked), not an error", async (t) => {
    const body = { status: "ok", gate: 1, name: "NEURAL SENTRY", allowed: false, response: "[SHIELD TRIPWIRE] Length Constraint Violation", flag: null, rateLimitRemaining: 29 };
    stubFetch(t, () => ({ status: 200, json: body }));
    const r = await api.postGate1Prompt("hello");
    assert.equal(r.kind, "ok");
    assert.deepEqual((r as { data: unknown }).data, body);
  });

  it("rule 4: a challenge needs a non-empty sessionToken and its gate field", async (t) => {
    const bodies: Record<string, unknown> = {
      "/api/gate2/challenge": { status: "ok", gate: 2, sequence: ["1", "2", "3", "4"], sessionToken: TOKEN, ttlSeconds: 15 },
      "/api/gate3/challenge": { status: "ok", gate: 3, clauses: [[1, -2, 3]], variablesCount: 120, clausesCount: 1, sessionToken: TOKEN, ttlSeconds: 10 },
      "/api/gate4/challenge": { status: "ok", gate: 4, bytecodeHex: "ff", vmSpec: { opcodes: {} }, sessionToken: TOKEN, ttlSeconds: 20 },
      "/api/scoreboard": { status: "ok", leaderboard: [], totalAgents: 0, gatePoints: {} },
    };
    let strip = false;
    stubFetch(t, (c) => {
      const b = { ...(bodies[c.path] as Record<string, unknown>) };
      if (strip) delete b.sessionToken;
      return { status: 200, json: b };
    });
    for (const gate of [2, 3, 4] as const) assert.equal((await api.getChallenge(gate)).kind, "ok", `gate ${gate}`);
    assert.equal((await api.getScoreboard()).kind, "ok");
    strip = true;
    for (const gate of [2, 3, 4] as const) assertServerError(await api.getChallenge(gate), 200);
  });

  it("rule 5: a body that isn't JSON is a server error with no body", async (t) => {
    stubFetch(t, () => ({ status: 500, text: "<!DOCTYPE html><html><body>Internal Server Error</body></html>", contentType: "text/html" }));
    const r = await api.getScoreboard();
    assertServerError(r, 500);
    assert.equal(r.body, null);
    assert.ok(r.message.length > 0);
    assert.ok(!r.message.includes("<"), "the HTML is not shown as the message");
  });

  it("error text falls back from message to error to a fixed sentence", async (t) => {
    const replies: Record<string, Reply> = {
      "/api/gate1/chat": { status: 400, json: { error: "Invalid JSON body. Provide { prompt: '...' }" } },
      "/api/scoreboard": { status: 500, json: {} },
      "/api/gate2/challenge": { status: 503, json: { error: "E", message: "M" } },
    };
    stubFetch(t, (c) => replies[c.path]);
    const chat = await api.postGate1Prompt("hello");
    assertServerError(chat, 400);
    assert.equal(chat.message, "Invalid JSON body. Provide { prompt: '...' }");
    const empty = await api.getScoreboard();
    assertServerError(empty, 500);
    assert.ok(empty.message.length > 0);
    const both = await api.getChallenge(2);
    assertServerError(both, 503);
    assert.equal(both.message, "M");
  });

  it("sends the exact method, path, content type, and body", async (t) => {
    const calls = stubFetch(t, () => ({ status: 200, json: {} }));
    await api.getScoreboard();
    await api.postFlag("probe_k11", "HAKU{x}");
    await api.postGate1Prompt("  a prompt  ");
    await api.getChallenge(3);
    await api.submitGate4({ sessionToken: TOKEN, keyHex: "a1b2c3d4e5f60718" });
    const shape = calls.map((c) => [c.method, c.path]);
    assert.deepEqual(shape, [
      ["GET", "/api/scoreboard"],
      ["POST", "/api/scoreboard"],
      ["POST", "/api/gate1/chat"],
      ["GET", "/api/gate3/challenge"],
      ["POST", "/api/gate4/submit"],
    ]);
    assert.deepEqual(JSON.parse(calls[1].body ?? ""), { agentName: "probe_k11", flag: "HAKU{x}" });
    assert.deepEqual(Object.keys(JSON.parse(calls[1].body ?? "")).sort(), ["agentName", "flag"]);
    assert.deepEqual(JSON.parse(calls[2].body ?? ""), { prompt: "  a prompt  " }, "Gate 1 sends the prompt as typed (3.6)");
    assert.deepEqual(JSON.parse(calls[4].body ?? ""), { sessionToken: TOKEN, keyHex: "a1b2c3d4e5f60718" });
    for (const c of calls.filter((x) => x.method === "POST")) assert.match(c.contentType ?? "", /^application\/json/);
    for (const c of calls.filter((x) => x.method === "GET")) assert.equal(c.body, null);
  });
});

// ---------------------------------------------------------------------------
// Error-mapping properties
// ---------------------------------------------------------------------------

type Helper = "getScoreboard" | "postFlag" | "postGate1Prompt" | "challenge2" | "challenge3" | "challenge4" | "submit2" | "submit3" | "submit4";
const HELPERS: Helper[] = ["getScoreboard", "postFlag", "postGate1Prompt", "challenge2", "challenge3", "challenge4", "submit2", "submit3", "submit4"];

function callHelper(h: Helper): Promise<ApiSubjectResult> {
  switch (h) {
    case "getScoreboard":
      return api.getScoreboard();
    case "postFlag":
      return api.postFlag("probe", "HAKU{x}");
    case "postGate1Prompt":
      return api.postGate1Prompt("p");
    case "challenge2":
      return api.getChallenge(2);
    case "challenge3":
      return api.getChallenge(3);
    case "challenge4":
      return api.getChallenge(4);
    case "submit2":
      return api.submitGate2({ sessionToken: "x.y", predictions: ["1", "2", "3"] });
    case "submit3":
      return api.submitGate3({ sessionToken: "x.y", assignment: [true] });
    case "submit4":
      return api.submitGate4({ sessionToken: "x.y", keyHex: "00" });
  }
}

const errorBody = fc
  .tuple(fc.string(), fc.dictionary(fc.string({ maxLength: 8 }), fc.jsonValue({ maxDepth: 2 }), { maxKeys: 4 }))
  .map(([message, extra]) => {
    const body: Record<string, unknown> = { ...extra };
    for (const k of ["success", "allowed", "sessionToken", "message"]) delete body[k];
    body.message = message;
    return body;
  });

describe("api.ts: error mapping (properties)", () => {
  it("a 400-599 JSON body with a string message and no success/allowed/sessionToken is a server error with that message", async (t) => {
    let current: Reply = { status: 500, json: {} };
    stubFetch(t, () => current);
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 400, max: 599 }), errorBody, fc.constantFrom(...HELPERS), async (status, body, helper) => {
        current = { status, json: body };
        const r = await callHelper(helper);
        assertServerError(r, status);
        assert.equal(r.message, body.message);
      }),
      { numRuns: 300 },
    );
  });

  it("any network rejection is a network error", async (t) => {
    let reason: unknown = null;
    stubFetch(t, () => ({ reject: reason }));
    await fc.assert(
      fc.asyncProperty(
        fc.oneof(fc.string().map((m) => new TypeError(m)), fc.constant(new DOMException("timeout", "TimeoutError")), fc.anything()),
        fc.constantFrom(...HELPERS),
        async (err, helper) => {
          reason = err;
          assert.deepEqual(await callHelper(helper), { kind: "network-error" });
        },
      ),
      { numRuns: 200 },
    );
  });
});

// ---------------------------------------------------------------------------
// Property 5
// ---------------------------------------------------------------------------

const JS_WHITESPACE = fc.constantFrom(" ", "\t", "\n", "\u00a0", "\ufeff", "\u2003");
const JSON_WHITESPACE = fc.constantFrom(" ", "\t", "\n", "\r");
const padWith = (ws: fc.Arbitrary<string>): fc.Arbitrary<string> => fc.array(ws, { maxLength: 3 }).map((a) => a.join(""));
const padded = (inner: fc.Arbitrary<string>, ws: fc.Arbitrary<string>): fc.Arbitrary<string> =>
  fc.tuple(padWith(ws), inner, padWith(ws)).map(([a, s, b]) => `${a}${s}${b}`);

const tokenArb = fc.stringMatching(/^[A-Za-z0-9_-]{4,24}\.[A-Za-z0-9_-]{4,24}$/);
const decimalLike = fc.oneof(fc.bigInt({ min: 0n, max: 281474976710655n }).map(String), fc.string({ maxLength: 12 }));
const keyLike = fc.oneof(fc.stringMatching(/^(0x)?[0-9a-fA-F]{16}$/), fc.string({ maxLength: 20 }));

const tryParse = (s: string): { ok: true; value: unknown } | { ok: false } => {
  try {
    return { ok: true, value: JSON.parse(s) };
  } catch {
    return { ok: false };
  }
};

/**
 * Gate 3 texts. HEAD trims with String.prototype.trim before JSON.parse; the
 * design parses the text as is. The two only disagree when non-JSON
 * whitespace (NBSP, U+FEFF, ...) surrounds valid JSON, which is outside the
 * preserved behavior, so such texts are excluded.
 */
const validJsonText = padded(
  fc.oneof(
    fc.json(),
    fc.array(fc.boolean(), { maxLength: 130 }).map((a) => JSON.stringify(a)),
    fc.array(fc.integer({ min: -120, max: 120 }), { maxLength: 130 }).map((a) => JSON.stringify(a)),
  ),
  JSON_WHITESPACE,
);
const malformedText = fc
  .oneof(
    fc.string(),
    fc.constantFrom("", "   ", "[true,", "[1, -2, 3", "true false", "{'a':1}", "[true] x", "undefined", "NaN"),
    fc.array(fc.boolean()).map((a) => JSON.stringify(a).slice(0, -1)),
  )
  .filter((s) => !tryParse(s).ok && !tryParse(s.trim()).ok);

/** What JSON.stringify puts on the wire for `v` (normalizes -0). */
const onWire = (v: unknown): unknown => JSON.parse(JSON.stringify(v));

describe("Property 5: Preservation - gate payloads keep trimming and pass-through", () => {
  it("Gate 2 sends { sessionToken, predictions: [a.trim(), b.trim(), c.trim()] } in the order X5, X6, X7 (300 runs)", async (t) => {
    const calls = stubFetch(t, () => ({ status: 400, json: { success: false, message: "Prediction mismatch at step 1." } }));
    await fc.assert(
      fc.asyncProperty(tokenArb, fc.tuple(padded(decimalLike, JS_WHITESPACE), padded(decimalLike, JS_WHITESPACE), padded(decimalLike, JS_WHITESPACE)), async (token, inputs) => {
        calls.length = 0;
        const r = await submitInstance(2, token, inputs);
        assert.equal(r.sent, true);
        assert.equal(calls.length, 1);
        assert.equal(calls[0].method, "POST");
        assert.equal(calls[0].path, "/api/gate2/submit");
        assert.deepEqual(JSON.parse(calls[0].body ?? ""), { sessionToken: token, predictions: inputs.map((s) => s.trim()) });
      }),
      { numRuns: 300 },
    );
  });

  it("Gate 4 sends { sessionToken, keyHex: k.trim() } (300 runs)", async (t) => {
    const calls = stubFetch(t, () => ({ status: 400, json: { success: false, message: "Key must be exactly 16 hexadecimal characters (8 bytes)." } }));
    await fc.assert(
      fc.asyncProperty(tokenArb, padded(keyLike, JS_WHITESPACE), async (token, key) => {
        calls.length = 0;
        const r = await submitInstance(4, token, key);
        assert.equal(r.sent, true);
        assert.equal(calls.length, 1);
        assert.equal(calls[0].path, "/api/gate4/submit");
        assert.deepEqual(JSON.parse(calls[0].body ?? ""), { sessionToken: token, keyHex: key.trim() });
      }),
      { numRuns: 300 },
    );
  });

  it("Gate 3 sends JSON.parse(t) unchanged, and malformed text sends nothing with the exact message (300 runs)", async (t) => {
    const calls = stubFetch(t, () => ({ status: 400, json: { success: false, message: "Variable x_1 missing assignment." } }));
    await fc.assert(
      fc.asyncProperty(tokenArb, fc.oneof(validJsonText, malformedText), async (token, text) => {
        calls.length = 0;
        const parsed = tryParse(text);
        const r = await submitInstance(3, token, text);
        if (!parsed.ok) {
          assert.deepEqual(r, { sent: false, message: MALFORMED });
          assert.equal(calls.length, 0, "no request for malformed JSON");
          return;
        }
        assert.equal(r.sent, true);
        assert.equal(calls.length, 1);
        assert.equal(calls[0].path, "/api/gate3/submit");
        assert.deepEqual(JSON.parse(calls[0].body ?? ""), { sessionToken: token, assignment: onWire(parsed.value) });
      }),
      { numRuns: 300 },
    );
  });

  it("Gate 3 examples: booleans, signed literals, and malformed input", async (t) => {
    const calls = stubFetch(t, () => ({ status: 400, json: { success: false, message: "x" } }));
    assert.equal(GATE3_MALFORMED_MESSAGE, MALFORMED);
    await submitInstance(3, TOKEN, "[true, false]");
    await submitInstance(3, TOKEN, "[1, -2, 3]");
    assert.deepEqual(await submitInstance(3, TOKEN, "[true,"), { sent: false, message: MALFORMED });
    assert.deepEqual(
      calls.map((c) => JSON.parse(c.body ?? "").assignment),
      [
        [true, false],
        [1, -2, 3],
      ],
    );
  });
});
