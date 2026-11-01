// Property 1: Bug Condition - Interactions and requests show no defect marker.
//
// Exploration tests for the browser flow and request rows of the design's
// "Exploratory Bug Condition Checking" table: X02, X09, X23 (routes, nav,
// aria-current), X10 (flag form placement), X12 (instance counts, M-04, M-05),
// X13 (network errors), X14 (429 state, R-25), X15 (busy state, R-42), X16
// (expiry, R-24, R1), X17 (Gate 1 labels), X18, X19 (required and handle
// warnings, R-36), X20 (copy), X21 (scoreboard loading and error, R-09), X28
// (sound), X29, X30 (confetti, reduced motion), X35 (live regions, R-37, R-41),
// R-35 (dialog stays open), and M-01 / R-01 (one GET /api/scoreboard per open).
//
// Each test asserts the expected behavior on F'. On HEAD c6d13ea the remaining
// gaps fail (the failure is the counterexample). Tests tagged "[guard]" cover
// flows that already work on HEAD (fixed in 2516aa1) and act as regression
// guards. Counterexamples are recorded in tests/fixtures/explore-failures/flows.md.
//
// Server: `next start -p 3102` from the existing .next build (ensureServer).
// Every browser context sends its own probe IP from PROBE_BLOCKS.exploreFlows.
// Injected bodies are captured live from this server in `before` (their shapes
// are the HEAD API's), then only values are changed (TTL, counts, messages).
// Contexts that open /scoreboard or /console answer GET /api/scoreboard from a
// captured body so HEAD's refetch loop never reaches the server, except the
// M-01 tests, which measure the real loop with a fresh probe IP.
//
// Run: node --test tests/explore/flows.test.ts
//
// **Validates: Requirements 2.7, 2.10, 2.11, 2.12, 2.13, 2.14, 2.15, 2.16, 2.17, 2.18, 2.20, 2.25, 2.26, 2.27, 2.32**

import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import type { Browser, BrowserContext, Locator, Page } from "playwright-core";
import {
  PROBE_BLOCKS,
  createProbeClient,
  ensureServer,
  isPortFree,
  nextProbeIp,
  poll,
  probeRequest,
  sleep,
} from "../support/server.ts";
import type { ProbeResult, ServerHandle } from "../support/server.ts";
import {
  abortApi,
  currentPath,
  failClipboardWrites,
  fulfillApi,
  gotoView,
  holdApi,
  launchBrowser,
  logApiRequests,
  newContext,
  readClipboard,
  readRecorders,
  textOf,
  waitForHydration,
} from "../support/browser.ts";
import type { ApiRequest, LiveRecord, ViewportName } from "../support/browser.ts";
import {
  CONNECTION_TEXT,
  NAV_ITEMS,
  VIEW_PATHS,
  consoleParts,
  countdownSeconds,
  currentNavLinks,
  docsDocument,
  endpointList,
  flagDialog,
  flagForm,
  gate1Panel,
  instancePanel,
  liveRegions,
  mainRegion,
  navLabelFor,
  navLink,
  navLinks,
  openFlagDialog,
  pageHeading,
  runConsoleCommand,
  scoreboardParts,
  soundToggle,
  tryIt,
} from "../support/views.ts";
import type { InstanceGateNumber, InstancePanelParts } from "../support/views.ts";
import { readRepoFile } from "../support/source.ts";

const PORT = 3102;
const BLOCK = PROBE_BLOCKS.exploreFlows;
const TEST_TIMEOUT = 120_000;
/** The captured 429 message, rewritten as the design's X14 asks. */
const RETRY_MESSAGE = "Rate limit exceeded. Retry in 42s.";
const BASE = CONNECTION_TEXT.baseUrl;

// ---------------------------------------------------------------------------
// Response bodies (local mirrors of the HEAD route shapes in src/app/api/**)
// ---------------------------------------------------------------------------

type Json = Record<string, unknown>;

interface ChallengeBody extends Json {
  sessionToken: string;
  ttlSeconds: number;
}
interface Gate2Body extends ChallengeBody {
  sequence: string[];
  multiplier: string;
  modulus: string;
}
interface Gate3Body extends ChallengeBody {
  variablesCount: number;
  clausesCount: number;
  clauses: number[][];
}
interface Gate4Body extends ChallengeBody {
  bytecodeHex: string;
  vmSpec: { opcodes: Record<string, string> };
}
interface Gate1Body extends Json {
  allowed: boolean;
  response: string;
  flag: string | null;
}
interface MessageBody extends Json {
  message: string;
}
interface AgentEntry {
  agentName: string;
  gatesSolved: number[];
  score: number;
  lastSolveAt: number;
  proofBadge?: string;
}
interface AcceptedBody extends Json {
  success: true;
  message: string;
  agent: AgentEntry;
  proofBadge: string | null;
  allGatesCleared: boolean;
}

interface Captured {
  /** POST /api/gate1/chat, 200, `allowed: false` (length check). */
  gate1Blocked: Gate1Body;
  /** POST /api/gate1/chat, 200, `allowed: true` with the flag (mined proof-of-work prompt). */
  gate1Flag: Gate1Body;
  gate2: Gate2Body;
  gate3: Gate3Body;
  gate4: Gate4Body;
  /** POST /api/gate2/submit with wrong predictions, HTTP 400. */
  gate2Rejected: MessageBody;
  /** GET /api/scoreboard, 200. */
  scoreboard: Json;
  /** POST /api/scoreboard for gates 1..4 in order; the last carries the Proof-of-Pwn badge. */
  accepted: AcceptedBody[];
  /** POST /api/scoreboard with an unknown flag, HTTP 403. */
  flagRejected: MessageBody;
  /** HTTP 429 body of the gate routes and GET /api/scoreboard, message rewritten to RETRY_MESSAGE. */
  rateLimited: MessageBody;
  /** HTTP 429 body of POST /api/scoreboard, wait rewritten to 42s. */
  flagRateLimited: MessageBody;
  /** Gate 1..4 flags, read from src/lib/challenges.ts (local server only). */
  flags: string[];
  /** The handle the accepted bodies were recorded under. */
  handle: string;
}

function minePowPrompt(): string {
  // Avoids every blocked word, carries the framing words, and is 50-500 characters.
  const base = "An epistemic allegory: a lighthouse watcher studies how tides shape meaning. Nonce ";
  for (let n = 0; n < 50_000_000; n++) {
    const prompt = `${base}${n}`;
    if (createHash("sha256").update(prompt).digest("hex").startsWith("0000")) return prompt;
  }
  throw new Error("No proof-of-work nonce found");
}

function flagsFromSource(): string[] {
  const src = readRepoFile("src/lib/challenges.ts");
  const byGate = new Map<number, string>();
  for (const m of src.matchAll(/gate([1-4]):\s*"(HAKU\{[^"]+\})"/g)) byGate.set(Number(m[1]), m[2]);
  const flags = [1, 2, 3, 4].map((g) => byGate.get(g) ?? "");
  assert.ok(flags.every(Boolean), "could not read FLAGS.gate1..gate4 from src/lib/challenges.ts");
  return flags;
}

function take<T>(r: ProbeResult, status: number, what: string): T {
  assert.equal(r.status, status, `capture ${what}: HTTP ${r.status} ${r.text.slice(0, 200)}`);
  assert.ok(r.json !== null && typeof r.json === "object", `capture ${what}: body is not JSON`);
  return r.json as T;
}

/** Captures every injected body from this server, so shapes are the HEAD API's. */
async function captureBodies(baseUrl: string): Promise<Captured> {
  // 12 requests on one probe IP, below every route's limit (scoreboard POST: 20).
  const c = createProbeClient(nextProbeIp(BLOCK), baseUrl);
  const gate2 = take<Gate2Body>(await c.get("/api/gate2/challenge"), 200, "GET /api/gate2/challenge");
  const gate3 = take<Gate3Body>(await c.get("/api/gate3/challenge"), 200, "GET /api/gate3/challenge");
  const gate4 = take<Gate4Body>(await c.get("/api/gate4/challenge"), 200, "GET /api/gate4/challenge");
  const gate1Blocked = take<Gate1Body>(await c.post("/api/gate1/chat", { prompt: "A short prompt." }), 200, "gate1 blocked");
  assert.equal(gate1Blocked.allowed, false);
  const gate1Flag = take<Gate1Body>(await c.post("/api/gate1/chat", { prompt: minePowPrompt() }), 200, "gate1 flag");
  assert.equal(gate1Flag.allowed, true, `mined prompt was not accepted: ${gate1Flag.response}`);
  const gate2Rejected = take<MessageBody>(
    await c.post("/api/gate2/submit", { sessionToken: gate2.sessionToken, predictions: ["0", "0", "0"] }),
    400,
    "gate2 rejected",
  );
  const scoreboard = take<Json>(await c.get("/api/scoreboard"), 200, "GET /api/scoreboard");
  const flags = flagsFromSource();
  assert.equal(gate1Flag.flag, flags[0]);
  const handle = `flows-probe-${randomBytes(3).toString("hex")}`;
  const accepted: AcceptedBody[] = [];
  for (const flag of flags) {
    accepted.push(take<AcceptedBody>(await c.post("/api/scoreboard", { agentName: handle, flag }), 200, "POST /api/scoreboard"));
  }
  assert.ok(accepted[3].proofBadge, "the fourth accepted flag carries no Proof-of-Pwn badge");
  const flagRejected = take<MessageBody>(
    await c.post("/api/scoreboard", { agentName: handle, flag: "HAKU{NOT_A_REAL_FLAG}" }),
    403,
    "POST /api/scoreboard rejected",
  );

  // A second probe IP, used up on purpose to capture the real 429 bodies.
  const x = createProbeClient(nextProbeIp(BLOCK), baseUrl);
  let limited: ProbeResult | undefined;
  for (let i = 0; i < 40 && !limited; i++) {
    const r = await x.post("/api/gate1/chat", { prompt: "x" });
    if (r.status === 429) limited = r;
  }
  assert.ok(limited, "no 429 after 40 Gate 1 requests");
  const rl = take<MessageBody>(limited, 429, "429 gate1");
  const flagRl = take<MessageBody>(await x.post("/api/scoreboard", { agentName: "x", flag: "x" }), 429, "429 scoreboard POST");
  const rateLimited = { ...rl, message: rl.message.replace(/Retry in \d+s\./, "Retry in 42s.") };
  assert.equal(rateLimited.message, RETRY_MESSAGE);
  const flagRateLimited = { ...flagRl, message: flagRl.message.replace(/\d+s\.$/, "42s.") };

  return {
    gate1Blocked,
    gate1Flag,
    gate2,
    gate3,
    gate4,
    gate2Rejected,
    scoreboard,
    accepted,
    flagRejected,
    rateLimited,
    flagRateLimited,
    flags,
    handle,
  };
}

function withTtl<T extends ChallengeBody>(body: T, ttlSeconds: number): T {
  return { ...body, ttlSeconds };
}

/** The captured Gate 3 body with 7 variables and 9 clauses (X12). TTL 30 s avoids "60". */
function gate3Small(): Gate3Body {
  const clauses = [
    [1, -2, 3], [-1, 4, 5], [2, -6, 7], [-3, -4, 6], [5, -7, 1],
    [-2, 3, -5], [4, 6, -7], [-1, -3, 7], [2, 5, -6],
  ];
  return { ...cap.gate3, variablesCount: 7, clausesCount: clauses.length, clauses, ttlSeconds: 30 };
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

let server: ServerHandle;
let browser: Browser;
let cap: Captured;
const openContexts = new Set<BrowserContext>();

before(
  async () => {
    server = await ensureServer(PORT);
    cap = await captureBodies(server.baseUrl);
    browser = await launchBrowser();
  },
  { timeout: 180_000 },
);

after(async () => {
  for (const c of openContexts) await c.close().catch(() => undefined);
  if (browser) await browser.close().catch(() => undefined);
  if (server) {
    await server.stop();
    if (!server.external) assert.ok(await isPortFree(PORT), `port ${PORT} is still in use after stop()`);
  }
});

interface PageOptions {
  viewport?: ViewportName;
  reducedMotion?: "reduce" | "no-preference";
  /** Grant clipboard-read and clipboard-write. */
  clipboard?: boolean;
  /** Answer GET /api/scoreboard from the captured body at context level. Default true. */
  stubScoreboard?: boolean;
  /** Runs before the page opens (for context-level init scripts). */
  prepare?: (context: BrowserContext) => Promise<void>;
}

/** A fresh context (fresh probe IP) and page; closed when `fn` settles. */
async function withPage<T>(options: PageOptions, fn: (page: Page, context: BrowserContext) => Promise<T>): Promise<T> {
  const context = await newContext(browser, {
    baseUrl: server.baseUrl,
    ip: nextProbeIp(BLOCK),
    viewport: options.viewport,
    reducedMotion: options.reducedMotion,
    permissions: options.clipboard ? ["clipboard-read", "clipboard-write"] : undefined,
  });
  openContexts.add(context);
  try {
    if (options.stubScoreboard ?? true) {
      await fulfillApi(context, { path: "/api/scoreboard", method: "GET", status: 200, json: cap.scoreboard });
    }
    if (options.prepare) await options.prepare(context);
    const page = await context.newPage();
    page.setDefaultTimeout(10_000);
    return await fn(page, context);
  } finally {
    openContexts.delete(context);
    await context.close().catch(() => undefined);
  }
}

// ---------------------------------------------------------------------------
// Page helpers
// ---------------------------------------------------------------------------

/** Status labels used by HEAD and F' (03 copy). */
const STATUS_LABEL =
  /^(Blocked by filter|Blocked|Answered, no flag|Flag returned|Accepted|Rejected|Not sent|Request failed|Server error|Rate limited(?: \(HTTP \d{3}\))?|Error \(HTTP \d{3}\))$/;

/** Distinct status labels shown inside `scope`. */
async function statusLabels(scope: Locator): Promise<string[]> {
  const texts = await scope.getByText(STATUS_LABEL).allInnerTexts();
  return [...new Set(texts.map((t) => t.replace(/\s+/g, " ").trim()).filter(Boolean))];
}

/**
 * innerText of `scope` with whitespace collapsed, leaving out the full-response
 * JSON view (the frozen API's own text) and anything matching `skip`.
 */
async function textWithout(scope: Locator, skip = "details"): Promise<string> {
  return scope.evaluate((root, sel) => {
    const hide = [
      ...Array.from(root.querySelectorAll<HTMLElement>(sel)),
      ...Array.from(root.querySelectorAll<HTMLElement>("pre")).filter((p) => (p.textContent ?? "").includes('"sessionToken"')),
    ];
    const saved = hide.map((el) => [el, el.style.display] as const);
    for (const [el] of saved) el.style.display = "none";
    try {
      return (root as HTMLElement).innerText.replace(/\s+/g, " ").trim();
    } finally {
      for (const [el, prev] of saved) el.style.display = prev;
    }
  }, skip);
}

function around(text: string, re: RegExp, width = 60): string {
  const m = re.exec(text);
  if (!m) return text.slice(0, 2 * width);
  return text.slice(Math.max(0, m.index - width), m.index + m[0].length + width);
}

/** True when the control is natively disabled or aria-disabled. */
async function isInactive(loc: Locator): Promise<boolean> {
  return loc.evaluate((el) => (el as HTMLButtonElement).disabled === true || el.getAttribute("aria-disabled") === "true");
}

interface FieldState {
  invalid: string | null;
  described: { text: string; visible: boolean }[];
}

async function fieldState(loc: Locator): Promise<FieldState> {
  return loc.evaluate((el) => ({
    invalid: el.getAttribute("aria-invalid"),
    described: (el.getAttribute("aria-describedby") ?? "")
      .split(/\s+/)
      .filter(Boolean)
      .map((id) => {
        const d = document.getElementById(id);
        return { text: (d?.textContent ?? "").replace(/\s+/g, " ").trim(), visible: !!d && d.checkVisibility() };
      }),
  }));
}

function hasRequiredMessage(s: FieldState): boolean {
  return s.invalid === "true" && s.described.some((d) => d.visible && /\b(enter|required)\b/i.test(d.text));
}

const COPY_NAME = /^Cop(y|ied)/;

/**
 * The copy control next to `visibleText`: the innermost element inside `scope`
 * that contains the text and exactly one copy control. Works with HEAD's plain
 * "Copy" names and F's "Copy {thing}" names.
 */
async function copyControlNear(scope: Locator, visibleText: string): Promise<Locator> {
  const page = scope.page();
  const holders = scope
    .locator("div, li, tr, section")
    .filter({ hasText: visibleText })
    .filter({ has: page.getByRole("button", { name: COPY_NAME }) });
  for (let i = (await holders.count()) - 1; i >= 0; i--) {
    const buttons = holders.nth(i).getByRole("button", { name: COPY_NAME });
    if ((await buttons.count()) === 1) return buttons.first();
  }
  throw new Error(`No copy control next to ${JSON.stringify(visibleText)}`);
}

async function pageNow(page: Page): Promise<number> {
  return page.evaluate(() => Date.now());
}

/** Live-region records at or after `t0` whose text matches `re`. */
async function liveSince(page: Page, t0: number, re: RegExp): Promise<LiveRecord[]> {
  return (await readRecorders(page)).live.filter((l) => l.at >= t0 && re.test(l.text));
}

async function waitForAnnouncement(page: Page, t0: number, re: RegExp, timeoutMs = 4_000): Promise<LiveRecord[]> {
  const hits = await poll(
    async () => {
      const h = await liveSince(page, t0, re);
      return h.length ? h : null;
    },
    { timeoutMs },
  );
  return hits ?? [];
}

/** Marks the element so focusKept() can tell whether it still has focus, then focuses it. */
async function markFocus(loc: Locator): Promise<void> {
  await loc.evaluate((el) => el.setAttribute("data-test-focus", ""));
  await loc.focus();
}

async function focusKept(page: Page): Promise<{ kept: boolean; active: string }> {
  return page.evaluate(() => {
    const a = document.activeElement;
    const kept = !!a && a.hasAttribute("data-test-focus");
    const active = !a || a === document.body ? "body" : `${a.tagName.toLowerCase()} "${(a.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 40)}"`;
    return { kept, active };
  });
}

function tally(entries: readonly ApiRequest[]): string {
  const by = new Map<string, number>();
  for (const e of entries) {
    const k = e.failed ? "failed" : String(e.status ?? "pending");
    by.set(k, (by.get(k) ?? 0) + 1);
  }
  return [...by].map(([k, n]) => `${n}x ${k}`).join(", ") || "none";
}

/** Injects `body` for GET /api/gate<N>/challenge, opens /gates/<N>, and requests an instance. */
async function openInstance(
  page: Page,
  gate: InstanceGateNumber,
  body: ChallengeBody,
): Promise<{ panel: InstancePanelParts; t0: number }> {
  await fulfillApi(page, { path: `/api/gate${gate}/challenge`, method: "GET", status: 200, json: body });
  await gotoView(page, `/gates/${gate}`);
  const panel = instancePanel(page);
  const t0 = await pageNow(page);
  await panel.requestFirst.click();
  await panel.requestNew.waitFor({ state: "visible" });
  return { panel, t0 };
}

async function fillAnswer(page: Page, gate: InstanceGateNumber): Promise<void> {
  const panel = instancePanel(page);
  if (gate === 2) {
    for (let i = 0; i < 3; i++) await panel.predictions.nth(i).fill(String(i + 1));
  } else if (gate === 3) {
    await panel.assignment.first().fill("[1, -2, 3]");
  } else {
    await panel.key.first().fill("0011223344556677");
  }
}

/** Enabled buttons in the gate area that retry or repeat the last operation. */
async function enabledRetryControls(panel: InstancePanelParts, names: RegExp): Promise<string[]> {
  const buttons = panel.area.getByRole("button", { name: names });
  const out: string[] = [];
  for (let i = 0; i < (await buttons.count()); i++) {
    const b = buttons.nth(i);
    if (!(await isInactive(b))) out.push((await b.innerText()).trim());
  }
  return out;
}

/** Waits up to 1 s for `button` to leave its idle label; returns its busy text and state. */
async function busyState(button: Locator, idle: RegExp): Promise<{ text: string; inactive: boolean }> {
  const text = await poll(
    async () => {
      const t = (await button.innerText()).trim();
      return idle.test(t) ? null : t;
    },
    { timeoutMs: 1_000, intervalMs: 25 },
  );
  return { text: text ?? (await button.innerText()).trim(), inactive: await isInactive(button) };
}

/** A second click on a busy control, as a real pointer click (ignored if it can't land). */
async function clickAgain(button: Locator): Promise<void> {
  await button.click({ force: true, timeout: 1_000 }).catch(() => undefined);
}

/** Tags the result block in `dialog` (the "Accepted" badge's widest ancestor outside the form). */
async function markDialogResult(dialog: Locator): Promise<boolean> {
  return dialog.evaluate((d) => {
    const form = d.querySelector("form");
    const badge = Array.from(d.querySelectorAll("*")).find((e) => e.children.length === 0 && (e.textContent ?? "").trim() === "Accepted");
    if (!badge || !form) return false;
    let el: Element = badge;
    while (el.parentElement && el.parentElement !== d && !el.parentElement.contains(form)) el = el.parentElement;
    el.setAttribute("data-test-result", "");
    return true;
  });
}

/** Opens the header dialog on the current page and submits `handle` and `flag`. */
async function submitInDialog(page: Page, handle: string, flag: string): Promise<Locator> {
  const dialog = (await flagDialog(page).isVisible()) ? flagDialog(page) : await openFlagDialog(page);
  const f = flagForm(dialog);
  await f.handle.fill(handle);
  await f.flag.fill(flag);
  await f.submit.click();
  return dialog;
}

async function waitForText(scope: Locator, needle: string | RegExp, timeoutMs = 5_000): Promise<boolean> {
  const ok = await poll(
    async () => {
      const t = await textOf(scope);
      return typeof needle === "string" ? t.includes(needle) : needle.test(t);
    },
    { timeoutMs },
  );
  return !!ok;
}

const collapse = (s: string): string => s.replace(/\s+/g, " ").trim();

// ===========================================================================
// X02, X09, X23: routes, nav, aria-current
// ===========================================================================

describe("X02, X09, X23: routes, nav, and aria-current", () => {
  test("X23 (H): /gates redirects to /gates/1, and /gates/0, /gates/5, /gates/x return 404 [guard: already fixed in 2516aa1]", { timeout: TEST_TIMEOUT }, async () => {
    const ip = nextProbeIp(BLOCK);
    const r = await probeRequest("GET", "/gates", { ip, baseUrl: server.baseUrl });
    assert.ok(r.status === 307 || r.status === 308, `GET /gates: HTTP ${r.status}`);
    assert.equal(new URL(r.location ?? "", server.baseUrl).pathname, "/gates/1", `GET /gates Location: ${r.location}`);
    const statuses: Record<string, number> = {};
    for (const p of ["/gates/0", "/gates/5", "/gates/x"]) {
      statuses[p] = (await probeRequest("GET", p, { ip, baseUrl: server.baseUrl })).status;
    }
    assert.deepEqual(statuses, { "/gates/0": 404, "/gates/5": 404, "/gates/x": 404 });
  });

  test("X02, X09 (H): / has no scanlines or matrix-grid class and shows the h1, an intro, then the base URL, the skill.md URL, and GET /api/skill [guard: already fixed in 2516aa1]", { timeout: TEST_TIMEOUT }, async () => {
    const r = await probeRequest("GET", "/", { ip: nextProbeIp(BLOCK), baseUrl: server.baseUrl });
    assert.equal(r.status, 200);
    const effects = [...r.text.matchAll(/class="([^"]*)"/g)].map((m) => m[1]).filter((c) => /\b(scanlines|matrix-grid)\b/.test(c));
    assert.deepEqual(effects, [], "X02: effect classes in the HTML of /");
    const body = r.text.slice(Math.max(0, r.text.indexOf("<body")));
    const chunks = body
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<\/h1>/i, "</h1>\u0000@@H1@@\u0000")
      .replace(/<[^>]+>/g, "\u0000")
      .split("\u0000")
      .map((s) => collapse(s.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">")))
      .filter(Boolean);
    // Index of the marker placed right after </h1>; everything after it follows the h1.
    const h1 = chunks.indexOf("@@H1@@");
    assert.ok(h1 >= 0, "no h1 in the HTML of /");
    const at = (pred: (c: string) => boolean): number => chunks.findIndex((c, i) => i > h1 && pred(c));
    const base = at((c) => c === BASE);
    const skill = at((c) => c === CONNECTION_TEXT.skillUrl);
    const direct = at((c) => c.includes(CONNECTION_TEXT.direct));
    const intro = at((c) => c.length >= 40);
    assert.ok(base > 0 && skill > 0 && direct > 0, `after the h1: base URL at ${base}, skill.md URL at ${skill}, GET /api/skill at ${direct}`);
    assert.ok(intro > 0 && intro < base, `X09: no introduction between the h1 and the base URL (intro chunk ${intro}, base URL chunk ${base})`);
  });

  for (const viewport of ["desktop", "mobile"] as const) {
    test(`X23 (B, ${viewport}): the Primary nav lists Overview, Gates, Scoreboard, Docs, Console and marks only the current view [guard: already fixed in 2516aa1]`, { timeout: TEST_TIMEOUT }, async () => {
      const problems: string[] = [];
      for (const path of VIEW_PATHS) {
        await withPage({ viewport }, async (page) => {
          await gotoView(page, path);
          const labels = (await navLinks(page).allInnerTexts()).map((t) => t.trim());
          const want = NAV_ITEMS.map((i) => i.label);
          if (JSON.stringify(labels) !== JSON.stringify(want)) problems.push(`${path}: nav labels ${JSON.stringify(labels)}`);
          const current = await currentNavLinks(page).evaluateAll((els) =>
            els.map((a) => ({ text: (a.textContent ?? "").trim(), value: a.getAttribute("aria-current") })),
          );
          const label = navLabelFor(path);
          const item = NAV_ITEMS.find((i) => i.label === label);
          const value = item && item.href === path ? "page" : "true";
          if (current.length !== 1 || current[0].text !== label || current[0].value !== value) {
            problems.push(`${path}: aria-current ${JSON.stringify(current)}, expected ${label}=${value}`);
          }
        });
      }
      assert.deepEqual(problems, []);
    });
  }

  test("X23 (B): reloading /docs shows the docs, and back after Overview, Gates, Scoreboard shows /gates/1 with its h1 [guard: already fixed in 2516aa1]", { timeout: TEST_TIMEOUT }, async () => {
    await withPage({}, async (page) => {
      await gotoView(page, "/docs");
      await page.reload({ waitUntil: "load" });
      await waitForHydration(page);
      assert.equal(currentPath(page), "/docs");
      assert.ok(await docsDocument(page).isVisible(), "reloaded /docs shows no document");
      // Scoreboard is opened last; this context is closed right after.
      await navLink(page, "Overview").click();
      await page.waitForURL((u) => u.pathname === "/");
      await navLink(page, "Gates").click();
      await page.waitForURL((u) => u.pathname === "/gates/1");
      await navLink(page, "Scoreboard").click();
      await page.waitForURL((u) => u.pathname === "/scoreboard");
      await page.goBack();
      await page.waitForURL((u) => u.pathname === "/gates/1");
      const ok = await poll(async () => /^Gate 1\b/.test(await textOf(pageHeading(page).first())), { timeoutMs: 5_000 });
      assert.ok(ok, `after back: path ${currentPath(page)}, h1 "${await textOf(pageHeading(page).first())}"`);
    });
  });
});

// ===========================================================================
// X10: flag form placement
// ===========================================================================

describe("X10: flag form placement", () => {
  test("X10: no flag input precedes the Overview intro, every view's header opens a dialog with the flag form, and /scoreboard holds the form [guard: already fixed in 2516aa1]", { timeout: TEST_TIMEOUT }, async () => {
    const problems: string[] = [];
    for (const path of VIEW_PATHS) {
      await withPage({}, async (page) => {
        await gotoView(page, path);
        if (path === "/") {
          const order = await page.evaluate(() => {
            const h1 = document.querySelector("main h1");
            const intro = h1
              ? (Array.from(document.querySelectorAll("main p")).find(
                  (p) => h1.compareDocumentPosition(p) & Node.DOCUMENT_POSITION_FOLLOWING && (p.textContent ?? "").trim().length >= 40,
                ) ?? null)
              : null;
            const fields = Array.from(document.querySelectorAll("input, textarea"))
              .filter((el) => !el.closest("dialog:not([open])"))
              .filter((el) =>
                Array.from((el as HTMLInputElement).labels ?? []).some((l) => /^(Agent handle|Flag)$/.test((l.textContent ?? "").trim())),
              );
            const ahead = intro ? fields.filter((el) => el.compareDocumentPosition(intro) & Node.DOCUMENT_POSITION_FOLLOWING) : fields;
            return { intro: !!intro, ahead: ahead.map((el) => el.id || el.tagName) };
          });
          if (!order.intro) problems.push("/: no introduction paragraph after the h1");
          if (order.ahead.length) problems.push(`/: flag inputs before the introduction: ${order.ahead.join(", ")}`);
        }
        if (path === "/scoreboard" && !(await flagForm(mainRegion(page)).handle.isVisible())) {
          problems.push("/scoreboard: no flag form in main");
        }
        try {
          const dialog = await openFlagDialog(page);
          if (!(await flagForm(dialog).flag.isVisible())) problems.push(`${path}: the header dialog has no Flag field`);
        } catch (err) {
          problems.push(`${path}: header dialog: ${(err as Error).message.split("\n")[0]}`);
        }
      });
    }
    assert.deepEqual(problems, []);
  });
});

// ===========================================================================
// X12: instance panels derive their counts from the response (M-04, M-05)
// ===========================================================================

describe("X12: instance counts come from the response", () => {
  test("X12, M-05: an injected Gate 3 instance with 7 variables and 9 clauses shows 7 and 9 and none of 60, 255, 120, or 512", { timeout: TEST_TIMEOUT }, async () => {
    await withPage({}, async (page) => {
      const { panel } = await openInstance(page, 3, gate3Small());
      const text = await textWithout(panel.area);
      assert.match(text, /Variables:?\s*7\b|\b7 variables\b/i, `no variable count 7: ${text.slice(0, 200)}`);
      assert.match(text, /Clauses:?\s*9\b|\b9 clauses\b/i, `no clause count 9: ${text.slice(0, 200)}`);
      const stale = [...new Set(text.match(/\b(60|255|120|512)\b/g) ?? [])];
      assert.deepEqual(stale, [], `stale counts ${JSON.stringify(stale)} in the Gate 3 try-it area: "…${around(text, /\b(60|255|120|512)\b/)}…"`);
    });
  });

  test("X12, M-05: the Gate 3 assignment hint states the derived count (7 booleans), not 60", { timeout: TEST_TIMEOUT }, async () => {
    await withPage({}, async (page) => {
      const { panel } = await openInstance(page, 3, gate3Small());
      const hint = (await fieldState(panel.assignment.first())).described.map((d) => d.text).join(" | ");
      assert.match(hint, /\b7 booleans\b/, `assignment hint for a 7-variable instance: "${hint}"`);
      assert.doesNotMatch(hint, /\b60\b/, `assignment hint: "${hint}"`);
    });
  });

  test("X12, M-04: the Gate 2 panel shows the multiplier A, the increment C, and the modulus", { timeout: TEST_TIMEOUT }, async () => {
    await withPage({}, async (page) => {
      const { panel } = await openInstance(page, 2, cap.gate2);
      const text = await textWithout(panel.area);
      const missing = ["6364136223846793005", "1442695040888963407", "18446744073709551616"].filter((v) => !text.includes(v));
      assert.deepEqual(missing, [], `missing from the Gate 2 panel (response modulus ${JSON.stringify(cap.gate2.modulus)}): "${text.slice(0, 300)}"`);
    });
  });

  test("X12: Gate 2 labels come from sequence.length (5 values give rows X1 to X5 and inputs X6 to X8) [guard: already fixed in 2516aa1]", { timeout: TEST_TIMEOUT }, async () => {
    await withPage({}, async (page) => {
      const body = { ...cap.gate2, sequence: [...cap.gate2.sequence, "140737488355327"] };
      const { panel } = await openInstance(page, 2, body);
      const text = await textWithout(panel.area);
      const missingRows = body.sequence.map((v, i) => `X${i + 1} ${v}`).filter((row) => !new RegExp(`\\b${row.replace(" ", "\\s*")}\\b`).test(text));
      assert.deepEqual(missingRows, [], `rows missing: ${text.slice(0, 300)}`);
      const labels = await panel.predictions.evaluateAll((els) =>
        els.map((el) => Array.from((el as HTMLInputElement).labels ?? []).map((l) => (l.textContent ?? "").trim()).join(" ")),
      );
      assert.deepEqual(labels, ["X6", "X7", "X8"]);
    });
  });

  test("X12: Gate 4 shows one opcode row per injected opcode, and the full-response JSON deep-equals the body [guard: already fixed in 2516aa1]", { timeout: TEST_TIMEOUT }, async () => {
    await withPage({}, async (page) => {
      const opcodes = Object.fromEntries(Object.entries(cap.gate4.vmSpec.opcodes).slice(0, 5));
      const body = { ...cap.gate4, vmSpec: { opcodes } };
      const { panel } = await openInstance(page, 4, body);
      assert.equal(await panel.area.locator("table tbody tr").count(), 5, "opcode rows for 5 injected opcodes");
      const details = panel.area.locator("details");
      if (await details.count()) await details.first().locator("summary").click();
      else await panel.area.getByRole("button", { name: /^(View|Show) full response/ }).click();
      const pre = panel.area.locator("pre").filter({ hasText: "sessionToken" }).first();
      await pre.waitFor({ state: "visible" });
      assert.deepEqual(JSON.parse(await pre.innerText()), body);
    });
  });
});

// ===========================================================================
// X13: network errors
// ===========================================================================

describe("X13: network errors", () => {
  test("X13: an aborted Gate 2-4 challenge request shows a didn't-reach-the-server message and an enabled retry control [guard: already fixed in 2516aa1]", { timeout: TEST_TIMEOUT }, async () => {
    const problems: string[] = [];
    for (const gate of [2, 3, 4] as const) {
      await withPage({}, async (page) => {
        await abortApi(page, { path: `/api/gate${gate}/challenge`, method: "GET" });
        await gotoView(page, `/gates/${gate}`);
        const panel = instancePanel(page);
        await panel.requestFirst.click();
        if (!(await waitForText(panel.area, /didn['’]t reach the server/i))) problems.push(`Gate ${gate} challenge: no message: "${(await textOf(panel.area)).slice(0, 200)}"`);
        const retry = await enabledRetryControls(panel, /^(Try again|Request instance|Request new instance)/);
        if (!retry.length) problems.push(`Gate ${gate} challenge: no enabled retry control`);
      });
    }
    assert.deepEqual(problems, []);
  });

  test("X13: an aborted Gate 2-4 submission shows a didn't-reach-the-server message and an enabled retry control [guard: already fixed in 2516aa1]", { timeout: TEST_TIMEOUT }, async () => {
    const problems: string[] = [];
    const bodies = { 2: withTtl(cap.gate2, 60), 3: withTtl(cap.gate3, 60), 4: withTtl(cap.gate4, 60) } as const;
    for (const gate of [2, 3, 4] as const) {
      await withPage({}, async (page) => {
        await abortApi(page, { path: `/api/gate${gate}/submit`, method: "POST" });
        const { panel } = await openInstance(page, gate, bodies[gate]);
        await fillAnswer(page, gate);
        await panel.submit.first().click();
        if (!(await waitForText(panel.area, /didn['’]t reach the server/i))) problems.push(`Gate ${gate} submit: no message: "${(await textOf(panel.area)).slice(0, 200)}"`);
        const retry = await enabledRetryControls(panel, /^(Try again|Submit)/);
        if (!retry.length) problems.push(`Gate ${gate} submit: no enabled retry control`);
      });
    }
    assert.deepEqual(problems, []);
  });
});

// ===========================================================================
// X14: rate-limit (429) error state (R-25)
// ===========================================================================

describe("X14: 429 error state", () => {
  test("X14: a 429 from a Gate 2-4 challenge or the Gate 1 chat shows the server message, no countdown, and no enabled Submit [guard: already fixed in 2516aa1]", { timeout: TEST_TIMEOUT }, async () => {
    const problems: string[] = [];
    for (const gate of [2, 3, 4] as const) {
      await withPage({}, async (page) => {
        await fulfillApi(page, { path: `/api/gate${gate}/challenge`, method: "GET", status: 429, json: cap.rateLimited });
        await gotoView(page, `/gates/${gate}`);
        const panel = instancePanel(page);
        await panel.requestFirst.click();
        if (!(await waitForText(panel.area, "Retry in 42s"))) problems.push(`Gate ${gate}: message not shown: "${(await textOf(panel.area)).slice(0, 200)}"`);
        if (await panel.countdown.count()) problems.push(`Gate ${gate}: a countdown is shown`);
        const submits = await enabledRetryControls(panel, /^Submit/);
        if (submits.length) problems.push(`Gate ${gate}: enabled Submit ${JSON.stringify(submits)}`);
      });
    }
    await withPage({}, async (page) => {
      await fulfillApi(page, { path: "/api/gate1/chat", method: "POST", status: 429, json: cap.rateLimited });
      await gotoView(page, "/gates/1");
      const g1 = gate1Panel(page);
      await g1.prompt.fill("A prompt typed in the browser.");
      await g1.send.click();
      if (!(await waitForText(g1.area, "Retry in 42s"))) problems.push(`Gate 1: message not shown: "${(await textOf(g1.area)).slice(0, 200)}"`);
      if (/No flag was returned|Answered, no flag|Flag returned/.test(await textOf(g1.area))) problems.push("Gate 1: shows a response state for a 429");
    });
    assert.deepEqual(problems, []);
  });

  test("X14, R-25: the 429 status label names the HTTP status, \"Rate limited (HTTP 429)\" (Gate 2 challenge and Gate 1 chat)", { timeout: TEST_TIMEOUT }, async () => {
    const seen: Record<string, string[]> = {};
    await withPage({}, async (page) => {
      await fulfillApi(page, { path: "/api/gate2/challenge", method: "GET", status: 429, json: cap.rateLimited });
      await gotoView(page, "/gates/2");
      const panel = instancePanel(page);
      await panel.requestFirst.click();
      await waitForText(panel.area, "Retry in 42s");
      seen["Gate 2 challenge"] = await statusLabels(panel.area);
    });
    await withPage({}, async (page) => {
      await fulfillApi(page, { path: "/api/gate1/chat", method: "POST", status: 429, json: cap.rateLimited });
      await gotoView(page, "/gates/1");
      const g1 = gate1Panel(page);
      await g1.prompt.fill("A prompt typed in the browser.");
      await g1.send.click();
      await waitForText(g1.area, "Retry in 42s");
      seen["Gate 1 chat"] = await statusLabels(g1.area);
    });
    const wrong = Object.entries(seen).filter(([, labels]) => !labels.includes("Rate limited (HTTP 429)"));
    assert.deepEqual(wrong, [], `labels shown for a 429: ${JSON.stringify(seen)}`);
  });
});

// ===========================================================================
// X15: busy state (R-42)
// ===========================================================================

describe("X15: busy state", () => {
  test("X15: held requests show a busy label and an inactive control, and a second click sends no second request [guard: already fixed in 2516aa1]", { timeout: TEST_TIMEOUT }, async () => {
    const problems: string[] = [];
    await withPage({}, async (page) => {
      await holdApi(page, { path: "/api/gate2/challenge", method: "GET", ms: 1_500, then: { status: 200, json: withTtl(cap.gate2, 60) } });
      await holdApi(page, { path: "/api/gate2/submit", method: "POST", ms: 1_500, then: { status: 400, json: cap.gate2Rejected } });
      const log = logApiRequests(page);
      await gotoView(page, "/gates/2");
      const panel = instancePanel(page);
      await panel.requestFirst.click();
      const req = await busyState(panel.requestFirst, /^Request instance$/);
      if (/^Request instance$/.test(req.text) || !req.inactive) problems.push(`Gate 2 request while held: ${JSON.stringify(req)}`);
      await clickAgain(panel.requestFirst);
      await panel.requestNew.waitFor({ state: "visible", timeout: 5_000 });
      if (log.count("GET", "/api/gate2/challenge") !== 1) problems.push(`Gate 2 challenge GETs: ${log.count("GET", "/api/gate2/challenge")}`);
      await fillAnswer(page, 2);
      const submit = panel.submit.first();
      await submit.click();
      const sub = await busyState(submit, /^Submit( predictions)?$/);
      if (/^Submit( predictions)?$/.test(sub.text) || !sub.inactive) problems.push(`Gate 2 submit while held: ${JSON.stringify(sub)}`);
      await clickAgain(submit);
      await poll(async () => (await statusLabels(panel.area)).includes("Rejected"), { timeoutMs: 5_000 });
      if (log.count("POST", "/api/gate2/submit") !== 1) problems.push(`Gate 2 submit POSTs: ${log.count("POST", "/api/gate2/submit")}`);
    });
    await withPage({}, async (page) => {
      await holdApi(page, { path: "/api/gate1/chat", method: "POST", ms: 1_500, then: { status: 200, json: cap.gate1Blocked } });
      await holdApi(page, { path: "/api/scoreboard", method: "POST", ms: 1_500, then: { status: 200, json: cap.accepted[0] } });
      const log = logApiRequests(page);
      await gotoView(page, "/gates/1");
      const g1 = gate1Panel(page);
      await g1.prompt.fill("A prompt typed in the browser.");
      await g1.send.click();
      const send = await busyState(g1.send, /^Send prompt$/);
      if (/^Send prompt$/.test(send.text) || !send.inactive) problems.push(`Gate 1 send while held: ${JSON.stringify(send)}`);
      await clickAgain(g1.send);
      await poll(async () => (await statusLabels(g1.area)).length > 0, { timeoutMs: 5_000 });
      if (log.count("POST", "/api/gate1/chat") !== 1) problems.push(`Gate 1 chat POSTs: ${log.count("POST", "/api/gate1/chat")}`);
      const dialog = await submitInDialog(page, cap.handle, cap.flags[0]);
      const f = flagForm(dialog);
      const flag = await busyState(f.submit, /^Submit flag$/);
      if (/^Submit flag$/.test(flag.text) || !flag.inactive) problems.push(`flag submit while held: ${JSON.stringify(flag)}`);
      await clickAgain(f.submit);
      await waitForText(dialog, cap.accepted[0].message);
      if (log.count("POST", "/api/scoreboard") !== 1) problems.push(`flag POSTs: ${log.count("POST", "/api/scoreboard")}`);
    });
    assert.deepEqual(problems, []);
  });

  test("X15, R-42 (likely): a busy control keeps keyboard focus while its request runs", { timeout: TEST_TIMEOUT }, async () => {
    const problems: string[] = [];
    await withPage({}, async (page) => {
      await holdApi(page, { path: "/api/gate2/challenge", method: "GET", ms: 1_500, then: { status: 200, json: withTtl(cap.gate2, 60) } });
      await gotoView(page, "/gates/2");
      const panel = instancePanel(page);
      await markFocus(panel.requestFirst);
      await page.keyboard.press("Enter");
      await sleep(400);
      const f = await focusKept(page);
      if (!f.kept) problems.push(`Gate 2 "Request instance" (Enter): focus moved to ${f.active} while busy`);
    });
    await withPage({}, async (page) => {
      await holdApi(page, { path: "/api/scoreboard", method: "POST", ms: 1_500, then: { status: 200, json: cap.accepted[0] } });
      await gotoView(page, "/gates/1");
      const dialog = await openFlagDialog(page);
      const form = flagForm(dialog);
      await form.handle.fill(cap.handle);
      await form.flag.fill(cap.flags[0]);
      await markFocus(form.submit);
      await page.keyboard.press("Enter");
      await sleep(400);
      const f = await focusKept(page);
      if (!f.kept) problems.push(`dialog "Submit flag" (Enter): focus moved to ${f.active} while busy`);
    });
    assert.deepEqual(problems, []);
  });
});

// ===========================================================================
// X16: expiry (R-24, R1)
// ===========================================================================

const EXPIRED_RE = /Gate 2 instance expired/i;

describe("X16: expiry", () => {
  test("X16: an instance with ttlSeconds 1 shows Expired within 3 s, keeps Submit inactive, offers Request new instance, and announces the expiry once [guard: already fixed in 2516aa1]", { timeout: TEST_TIMEOUT }, async () => {
    await withPage({}, async (page) => {
      const { panel, t0 } = await openInstance(page, 2, withTtl(cap.gate2, 1));
      const expired = await poll(async () => /\bExpired\b/.test(await textWithout(panel.area)), { timeoutMs: 3_000 });
      assert.ok(expired, `no "Expired" within 3 s: "${(await textWithout(panel.area)).slice(0, 200)}"`);
      const submits = await panel.submit.count();
      for (let i = 0; i < submits; i++) assert.ok(await isInactive(panel.submit.nth(i)), "Submit is enabled after expiry");
      assert.ok(await panel.requestNew.isVisible(), "no Request new instance control");
      assert.ok(!(await isInactive(panel.requestNew)), "Request new instance is disabled");
      await sleep(1_000);
      const said = (await liveSince(page, t0, EXPIRED_RE)).filter((r) => r.regionSeenAt < t0);
      assert.equal(said.length, 1, `expiry announcements: ${JSON.stringify(said.map((r) => r.text))}`);
    });
  });

  test("X16, R-24: the expiry is not announced again after navigating away and back to the gate", { timeout: TEST_TIMEOUT }, async () => {
    await withPage({}, async (page) => {
      const { panel, t0 } = await openInstance(page, 2, withTtl(cap.gate2, 1));
      await poll(async () => /\bExpired\b/.test(await textWithout(panel.area)), { timeoutMs: 3_000 });
      await sleep(800);
      const first = (await liveSince(page, t0, EXPIRED_RE)).length;
      await navLink(page, "Overview").click();
      await page.waitForURL((u) => u.pathname === "/");
      await mainRegion(page).locator('a[href="/gates/2"]').first().click();
      await page.waitForURL((u) => u.pathname === "/gates/2");
      await instancePanel(page).requestNew.waitFor({ state: "visible" });
      await sleep(1_500);
      const all = await liveSince(page, t0, EXPIRED_RE);
      assert.equal(first, 1, `announcements before leaving: ${first}`);
      assert.equal(all.length, 1, `expiry announced ${all.length} times for one instance (Overview and back): ${JSON.stringify(all.map((r) => r.text))}`);
    });
  });

  test("X16, R1: the Expiring threshold is per gate (ttlSeconds 4: Gate 3 isn't Expiring above 3 s, Gate 2 is Expiring from the start)", { timeout: TEST_TIMEOUT }, async () => {
    const problems: string[] = [];
    await withPage({}, async (page) => {
      const { panel } = await openInstance(page, 3, withTtl(gate3Small(), 4));
      // One ticker period, so the first render's clock has caught up.
      await sleep(300);
      const s = await countdownSeconds(page);
      const text = await textWithout(panel.area);
      const shown = (await panel.countdown.first().innerText().catch(() => "")).trim();
      if (s !== null && s >= 4 && /\bExpiring\b/.test(text)) problems.push(`Gate 3 (ttlSeconds 4) at ${s} s left shows "${shown}" (threshold 3 s)`);
      const later = await poll(
        async () => {
          const n = await countdownSeconds(page);
          return n !== null && n > 0 && n <= 3 ? n : null;
        },
        { timeoutMs: 3_000, intervalMs: 50 },
      );
      if (later && !/\bExpiring\b/.test(await textWithout(panel.area))) problems.push(`Gate 3 at ${later} s left is not marked Expiring`);
    });
    await withPage({}, async (page) => {
      const { panel } = await openInstance(page, 2, withTtl(cap.gate2, 4));
      await sleep(300);
      const s = await countdownSeconds(page);
      if (!/\bExpiring\b/.test(await textWithout(panel.area))) problems.push(`Gate 2 (ttlSeconds 4) at ${s} s left is not marked Expiring (threshold 5 s)`);
    });
    assert.deepEqual(problems, []);
  });
});

// ===========================================================================
// X17: Gate 1 labels
// ===========================================================================

describe("X17: Gate 1 result labels", () => {
  test("X17: the blocked, answered, and flag Gate 1 bodies produce three different status labels, show the server text verbatim, and the flag result offers the filled flag form [guard: already fixed in 2516aa1]", { timeout: TEST_TIMEOUT }, async () => {
    await withPage({}, async (page) => {
      await gotoView(page, "/gates/1");
      const g1 = gate1Panel(page);
      const cases: [string, Gate1Body][] = [
        ["blocked", cap.gate1Blocked],
        // c6d13ea never sends this; same fields as the captured body, allowed flipped.
        ["answered", { ...cap.gate1Blocked, allowed: true, flag: null }],
        ["flag", cap.gate1Flag],
      ];
      const labels: Record<string, string[]> = {};
      const problems: string[] = [];
      for (const [name, body] of cases) {
        const route = await fulfillApi(page, { path: "/api/gate1/chat", method: "POST", status: 200, json: body });
        await g1.prompt.fill(`A prompt typed in the browser (${name}).`);
        await g1.send.click();
        await poll(() => route.hits() > 0, { timeoutMs: 5_000 });
        await poll(async () => /^Send prompt/.test((await g1.send.innerText()).trim()) && (await statusLabels(g1.area)).length > 0, { timeoutMs: 5_000 });
        labels[name] = await statusLabels(g1.area);
        if (!(await textOf(g1.area)).includes(collapse(body.response))) problems.push(`${name}: server text not shown verbatim`);
        await route.dispose();
      }
      const distinct = new Set(Object.values(labels).map((l) => l.join("|")));
      if (Object.values(labels).some((l) => l.length !== 1) || distinct.size !== 3) problems.push(`labels ${JSON.stringify(labels)}`);
      const inline = flagForm(tryIt(page));
      if (!(await inline.flag.isVisible()) || (await inline.flag.inputValue()) !== cap.gate1Flag.flag) problems.push("flag result has no flag form filled with the flag");
      assert.deepEqual(problems, []);
    });
  });
});

// ===========================================================================
// X18, X19: required fields and handle warnings (R-36)
// ===========================================================================

describe("X18, X19: required fields and handle warnings", () => {
  test("X18: an empty handle, an empty flag, and an empty Gate 1 prompt send no request and show a required message linked by aria-describedby with aria-invalid [guard: already fixed in 2516aa1]", { timeout: TEST_TIMEOUT }, async () => {
    await withPage({}, async (page) => {
      const log = logApiRequests(page);
      const problems: string[] = [];
      await gotoView(page, "/gates/1");
      const g1 = gate1Panel(page);
      await g1.send.click();
      await poll(async () => (await g1.prompt.getAttribute("aria-invalid")) === "true", { timeoutMs: 2_000 });
      const prompt = await fieldState(g1.prompt);
      if (!hasRequiredMessage(prompt)) problems.push(`empty prompt: ${JSON.stringify(prompt)}`);

      const dialog = await openFlagDialog(page);
      const f = flagForm(dialog);
      const cases: [string, string, string, ("handle" | "flag")[]][] = [
        ["both empty", "", "", ["handle", "flag"]],
        ["flag empty", "probe-agent", "", ["flag"]],
        ["handle empty", "", cap.flags[0], ["handle"]],
      ];
      for (const [name, handle, flag, empty] of cases) {
        await f.handle.fill(handle);
        await f.flag.fill(flag);
        await f.submit.click();
        await sleep(300);
        for (const field of ["handle", "flag"] as const) {
          const s = await fieldState(f[field]);
          const want = empty.includes(field);
          if (want && !hasRequiredMessage(s)) problems.push(`${name}: ${field} has no required message: ${JSON.stringify(s)}`);
          if (!want && s.invalid === "true") problems.push(`${name}: filled ${field} is marked invalid`);
        }
      }
      const posts = log.filter("POST");
      if (posts.length) problems.push(`requests sent: ${posts.map((p) => p.path).join(", ")}`);
      assert.deepEqual(problems, []);
    });
  });

  test("X19: \"my agent!\" and a 25-character handle show the format message before submission, and an accepted body's agent.agentName is shown [guard: already fixed in 2516aa1]", { timeout: TEST_TIMEOUT }, async () => {
    await withPage({}, async (page) => {
      const recorded = { ...cap.accepted[0], agent: { ...cap.accepted[0].agent, agentName: "myagent" } };
      await fulfillApi(page, { path: "/api/scoreboard", method: "POST", status: 200, json: recorded });
      const log = logApiRequests(page);
      await gotoView(page, "/gates/1");
      const dialog = await openFlagDialog(page);
      const f = flagForm(dialog);
      const problems: string[] = [];
      const FORMAT = /doesn['’]t match the accepted format/i;
      await f.handle.fill("my agent!");
      if (!(await waitForText(f.form, FORMAT, 2_000)) || !(await textOf(f.form)).includes("myagent")) problems.push(`"my agent!": ${await textOf(f.form)}`);
      await f.handle.fill("a".repeat(25));
      if (!(await waitForText(f.form, FORMAT, 2_000)) || !(await textOf(f.form)).includes("a".repeat(24))) problems.push(`25 characters: ${await textOf(f.form)}`);
      if (log.count("POST")) problems.push("a request was sent before submission");
      await f.handle.fill("my agent!");
      await f.flag.fill(cap.flags[0]);
      await f.submit.click();
      await waitForText(dialog, cap.accepted[0].message);
      const result = await textWithout(dialog, "form");
      if (!/\bmyagent\b/.test(result)) problems.push(`result doesn't show the recorded handle: "${result.slice(0, 200)}"`);
      assert.deepEqual(problems, []);
    });
  });

  test("X19, R-36: the handle format message is a warning, not an error (the field isn't aria-invalid)", { timeout: TEST_TIMEOUT }, async () => {
    await withPage({}, async (page) => {
      await gotoView(page, "/gates/1");
      const dialog = await openFlagDialog(page);
      const f = flagForm(dialog);
      await f.handle.fill("my agent!");
      assert.ok(await waitForText(f.form, /doesn['’]t match the accepted format/i, 2_000), "no format message");
      const s = await fieldState(f.handle);
      assert.notEqual(s.invalid, "true", `handle "my agent!" is marked aria-invalid="true"; described by ${JSON.stringify(s.described.map((d) => d.text))}`);
    });
  });
});

// ===========================================================================
// X20: copy to clipboard
// ===========================================================================

describe("X20: copy controls", () => {
  test("X20: copy controls for the base URL, the skill.md URL, every endpoint, a returned flag, and the badge put the exact text on the clipboard and confirm in a live region [guard: already fixed in 2516aa1]", { timeout: TEST_TIMEOUT }, async () => {
    const problems: string[] = [];
    const check = async (page: Page, button: Locator, expected: string, what: string): Promise<void> => {
      const t0 = await pageNow(page);
      await button.click();
      if (!(await poll(async () => /Copied/.test(await button.innerText()), { timeoutMs: 3_000 }))) problems.push(`${what}: no "Copied" text`);
      const clip = await readClipboard(page);
      if (clip !== expected) problems.push(`${what}: clipboard ${JSON.stringify(clip)}, expected ${JSON.stringify(expected)}`);
      const said = (await waitForAnnouncement(page, t0, /cop/i)).filter((r) => r.regionSeenAt < t0);
      if (!said.length) problems.push(`${what}: no announcement in a live region`);
    };
    await withPage({ clipboard: true }, async (page) => {
      await gotoView(page, "/");
      await check(page, await copyControlNear(mainRegion(page), "Base URL"), BASE, "base URL");
      await check(page, await copyControlNear(mainRegion(page), "skill.md URL"), CONNECTION_TEXT.skillUrl, "skill.md URL");
      for (const gate of [1, 2, 3, 4]) {
        await gotoView(page, `/gates/${gate}`);
        const eps = await endpointList(page);
        if (eps.length !== (gate === 1 ? 1 : 2)) problems.push(`/gates/${gate}: endpoints ${JSON.stringify(eps)}`);
        for (const ep of eps) await check(page, await copyControlNear(mainRegion(page), ep.path), `${BASE}${ep.path}`, `${ep.method} ${ep.path}`);
      }
      await fulfillApi(page, { path: "/api/gate1/chat", method: "POST", status: 200, json: cap.gate1Flag });
      await fulfillApi(page, { path: "/api/scoreboard", method: "POST", status: 200, json: cap.accepted[3] });
      await gotoView(page, "/gates/1");
      const g1 = gate1Panel(page);
      await g1.prompt.fill("A prompt typed in the browser.");
      await g1.send.click();
      const flag = cap.gate1Flag.flag ?? "";
      await g1.flag.first().waitFor({ state: "visible" });
      await check(page, await copyControlNear(tryIt(page), flag), flag, "flag");
      const dialog = await submitInDialog(page, cap.handle, cap.flags[3]);
      const badge = cap.accepted[3].proofBadge ?? "";
      if (await waitForText(dialog, badge)) await check(page, await copyControlNear(dialog, badge), badge, "Proof-of-Pwn badge");
      else problems.push("badge not shown in the dialog");
    });
    assert.deepEqual(problems, []);
  });

  test("X20: with clipboard writes denied, the copy control shows failure text and announces it [guard: already fixed in 2516aa1]", { timeout: TEST_TIMEOUT }, async () => {
    await withPage({ prepare: (c) => failClipboardWrites(c) }, async (page) => {
      await gotoView(page, "/");
      const button = await copyControlNear(mainRegion(page), "Base URL");
      const t0 = await pageNow(page);
      await button.click();
      assert.ok(await poll(async () => /Copy failed/.test(await button.innerText()), { timeoutMs: 3_000 }), `button reads "${await button.innerText()}"`);
      const said = (await waitForAnnouncement(page, t0, /couldn['’]t copy|fail/i)).filter((r) => r.regionSeenAt < t0);
      assert.ok(said.length > 0, "no failure announcement");
    });
  });
});

// ===========================================================================
// X21: scoreboard loading and error states (R-09)
// ===========================================================================

describe("X21: scoreboard loading and error states", () => {
  test("X21: a GET /api/scoreboard held for 1.5 s shows loading text [guard: already fixed in 2516aa1]", { timeout: TEST_TIMEOUT }, async () => {
    await withPage({}, async (page) => {
      await holdApi(page, { path: "/api/scoreboard", method: "GET", ms: 1_500, then: { status: 200, json: cap.scoreboard } });
      await gotoView(page, "/scoreboard");
      const loading = mainRegion(page).getByText(/^Loading (the )?(scoreboard|standings)…/);
      assert.ok(await poll(() => loading.first().isVisible(), { timeoutMs: 1_500, intervalMs: 50 }), `no loading text: "${(await textOf(mainRegion(page))).slice(0, 300)}"`);
    });
  });

  test("X21, R-09: a 429 on GET /api/scoreboard shows an error with the server message and no false \"No entries yet.\"", { timeout: TEST_TIMEOUT }, async () => {
    await withPage({}, async (page) => {
      await fulfillApi(page, { path: "/api/scoreboard", method: "GET", status: 429, json: cap.rateLimited });
      const log = logApiRequests(page);
      await gotoView(page, "/scoreboard");
      const parts = scoreboardParts(page);
      const sawEmpty = !!(await poll(() => parts.empty.first().isVisible(), { timeoutMs: 2_000, intervalMs: 50 }));
      const shown = await waitForText(mainRegion(page), "Retry in 42s", 1_000);
      const gets = log.count("GET", "/api/scoreboard");
      assert.ok(shown && !sawEmpty, `429 with no earlier rows: server message shown=${shown}, "No entries yet." shown=${sawEmpty}, GET /api/scoreboard while open=${gets}`);
    });
  });

  test("X21, R-09: a network failure on GET /api/scoreboard shows a didn't-reach-the-server error and no false \"No entries yet.\"", { timeout: TEST_TIMEOUT }, async () => {
    await withPage({}, async (page) => {
      await abortApi(page, { path: "/api/scoreboard", method: "GET" });
      await gotoView(page, "/scoreboard");
      const parts = scoreboardParts(page);
      const sawEmpty = !!(await poll(() => parts.empty.first().isVisible(), { timeoutMs: 2_000, intervalMs: 50 }));
      const shown = await waitForText(mainRegion(page), /didn['’]t reach the server/i, 1_000);
      assert.ok(shown && !sawEmpty, `network failure with no earlier rows: error shown=${shown}, "No entries yet." shown=${sawEmpty}`);
    });
  });
});

// ===========================================================================
// X28: sound off by default
// ===========================================================================

describe("X28: sound", () => {
  test("X28: with sound off, every nav link and one control per view create no AudioContext or oscillator, and the toggle goes from aria-pressed false to true [guard: already fixed in 2516aa1]", { timeout: TEST_TIMEOUT }, async () => {
    await withPage({ clipboard: true }, async (page) => {
      await fulfillApi(page, { path: "/api/gate2/challenge", method: "GET", status: 200, json: withTtl(cap.gate2, 60) });
      await gotoView(page, "/");
      assert.equal(await soundToggle(page).getAttribute("aria-pressed"), "false");
      await navLink(page, "Overview").click();
      await (await copyControlNear(mainRegion(page), "Base URL")).click();
      await navLink(page, "Gates").click();
      await page.waitForURL((u) => u.pathname === "/gates/1");
      await gate1Panel(page).send.click();
      await mainRegion(page).locator('a[href="/gates/2"]').first().click();
      await page.waitForURL((u) => u.pathname === "/gates/2");
      await instancePanel(page).requestFirst.click();
      await instancePanel(page).requestNew.waitFor({ state: "visible" });
      await navLink(page, "Docs").click();
      await page.waitForURL((u) => u.pathname === "/docs");
      await mainRegion(page).getByRole("button", { name: COPY_NAME }).first().click();
      // Scoreboard and Console come last (GET /api/scoreboard is answered from the capture).
      await navLink(page, "Scoreboard").click();
      await page.waitForURL((u) => u.pathname === "/scoreboard");
      await flagForm(mainRegion(page)).submit.click();
      await navLink(page, "Console").click();
      await page.waitForURL((u) => u.pathname === "/console");
      await runConsoleCommand(page, "help");
      await sleep(300);
      const audio = (await readRecorders(page)).audio;
      assert.deepEqual(audio, { contexts: 0, oscillators: 0 }, "audio created with sound off");
      await soundToggle(page).click();
      assert.ok(await poll(async () => (await soundToggle(page).getAttribute("aria-pressed")) === "true", { timeoutMs: 2_000 }), "toggle did not turn pressed");
    });
  });
});

// ===========================================================================
// X29, X30: success effect and reduced motion
// ===========================================================================

describe("X29, X30: motion", () => {
  test("X29: an accepted flag adds no canvas, and any animation it starts runs inside the result [guard: already fixed in 2516aa1]", { timeout: TEST_TIMEOUT }, async () => {
    await withPage({}, async (page) => {
      await fulfillApi(page, { path: "/api/scoreboard", method: "POST", status: 200, json: cap.accepted[0] });
      await gotoView(page, "/gates/1");
      const dialog = await openFlagDialog(page);
      await sleep(300);
      const start = await page.evaluate(() => Number(document.timeline.currentTime ?? 0));
      const before = (await readRecorders(page)).canvasesAdded;
      const f = flagForm(dialog);
      await f.handle.fill(cap.handle);
      await f.flag.fill(cap.flags[0]);
      await f.submit.click();
      assert.ok(await waitForText(dialog, cap.accepted[0].message), "accepted result not shown");
      assert.ok(await markDialogResult(dialog), "no result block in the dialog");
      await sleep(600);
      assert.equal((await readRecorders(page)).canvasesAdded - before, 0, "canvas elements added after the accepted flag");
      const outside = await page.evaluate((t) => {
        return document
          .getAnimations()
          .filter((a) => a.playState === "running" || (a.startTime !== null && Number(a.startTime) >= t))
          .map((a) => {
            const target = (a.effect as KeyframeEffect | null)?.target ?? null;
            const name = "animationName" in a ? String(a.animationName) : "transitionProperty" in a ? String(a.transitionProperty) : "script";
            return { name, target: target ? target.tagName.toLowerCase() : null, inResult: !!target && !!target.closest("[data-test-result]") };
          })
          .filter((x) => !x.inResult);
      }, start);
      assert.deepEqual(outside, [], "animations outside the result after an accepted flag");
    });
  });

  test("X30: with reduced motion, an accepted flag and a hover run no animation, no scroll call is smooth, and html scroll-behavior is auto [guard: already fixed in 2516aa1]", { timeout: TEST_TIMEOUT }, async () => {
    await withPage({ reducedMotion: "reduce" }, async (page) => {
      const running = (): Promise<{ name: string; state: string; ms: number }[]> =>
        page.evaluate(() =>
          document
            .getAnimations()
            .map((a) => ({
              name: "animationName" in a ? String(a.animationName) : "transitionProperty" in a ? String(a.transitionProperty) : "script",
              state: a.playState,
              ms: Number(a.effect?.getComputedTiming().duration ?? 0),
            }))
            .filter((a) => a.state !== "finished" || a.ms > 1),
        );
      await fulfillApi(page, { path: "/api/scoreboard", method: "POST", status: 200, json: cap.accepted[0] });
      await gotoView(page, "/gates/1");
      const dialog = await submitInDialog(page, cap.handle, cap.flags[0]);
      assert.ok(await waitForText(dialog, cap.accepted[0].message), "accepted result not shown");
      await sleep(300);
      assert.deepEqual(await running(), [], "animations after an accepted flag");
      await page.keyboard.press("Escape");
      await navLink(page, "Docs").hover();
      await sleep(200);
      assert.deepEqual(await running(), [], "animations after a hover");
      await navLink(page, "Console").click();
      await page.waitForURL((u) => u.pathname === "/console");
      await runConsoleCommand(page, "help");
      await runConsoleCommand(page, "gates");
      const smooth = (await readRecorders(page)).scrolls.filter((s) => s.behavior === "smooth");
      assert.deepEqual(smooth, [], "smooth scroll calls");
      assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior), "auto");
    });
  });
});

// ===========================================================================
// X35: live regions (R-37, R-41)
// ===========================================================================

type ActionName = "copy" | "429 error" | "expiry" | "accepted flag" | "console";

interface ActionRun {
  name: ActionName;
  /** Page clock right before the action. */
  t0: number;
  /** Records at or after the action that match its message. */
  announced: LiveRecord[];
  /** Records in live regions that appeared at or after the action. */
  newRegion: LiveRecord[];
  focus: { kept: boolean; active: string };
  /** For the dialog action: a pre-existing region inside the open dialog got the message. */
  inDialogRegion?: boolean;
}

/** Marks the live regions present now, so a later check can tell them from new ones. */
async function markLiveRegions(page: Page): Promise<void> {
  await page.evaluate(() => {
    for (const el of Array.from(document.querySelectorAll("[aria-live], [role=status], [role=alert], [role=log]"))) el.setAttribute("data-test-pre", "");
  });
}

async function runLiveAction(name: ActionName): Promise<ActionRun> {
  const finish = async (page: Page, t0: number, re: RegExp): Promise<ActionRun> => {
    const announced = await waitForAnnouncement(page, t0, re, 5_000);
    await sleep(300);
    const live = (await readRecorders(page)).live;
    return { name, t0, announced, newRegion: live.filter((l) => l.at >= t0 && l.regionSeenAt >= t0), focus: await focusKept(page) };
  };
  switch (name) {
    case "copy":
      return withPage({ clipboard: true }, async (page) => {
        await gotoView(page, "/");
        await markFocus(await copyControlNear(mainRegion(page), "Base URL"));
        const t0 = await pageNow(page);
        await page.keyboard.press("Enter");
        return finish(page, t0, /cop/i);
      });
    case "429 error":
      return withPage({}, async (page) => {
        await fulfillApi(page, { path: "/api/gate2/challenge", method: "GET", status: 429, json: cap.rateLimited });
        await gotoView(page, "/gates/2");
        await markFocus(instancePanel(page).requestFirst);
        const t0 = await pageNow(page);
        await page.keyboard.press("Enter");
        return finish(page, t0, /Retry in 42s/);
      });
    case "expiry":
      return withPage({}, async (page) => {
        const { panel } = await openInstance(page, 2, withTtl(cap.gate2, 2));
        await markFocus(panel.requestNew);
        const t0 = await pageNow(page);
        return finish(page, t0, EXPIRED_RE);
      });
    case "accepted flag":
      return withPage({}, async (page) => {
        await fulfillApi(page, { path: "/api/scoreboard", method: "POST", status: 200, json: cap.accepted[0] });
        await gotoView(page, "/gates/1");
        const dialog = await openFlagDialog(page);
        const f = flagForm(dialog);
        await f.handle.fill(cap.handle);
        await f.flag.fill(cap.flags[0]);
        await markFocus(f.submit);
        await markLiveRegions(page);
        const t0 = await pageNow(page);
        await page.keyboard.press("Enter");
        const run = await finish(page, t0, /accepted/i);
        run.inDialogRegion = await page.evaluate(() =>
          Array.from(document.querySelectorAll("dialog[open] [data-test-pre]")).some((el) => /accepted/i.test(el.textContent ?? "")),
        );
        return run;
      });
    case "console":
      return withPage({}, async (page) => {
        await gotoView(page, "/console");
        await runConsoleCommand(page, "clear");
        const { input } = consoleParts(page);
        await markFocus(input);
        await input.fill("help");
        const t0 = await pageNow(page);
        await input.press("Enter");
        return finish(page, t0, /help/i);
      });
  }
}

let liveRuns: Promise<ActionRun[]> | undefined;
/** Runs the five X35 actions once and shares the results among the X35 tests. */
function getLiveRuns(): Promise<ActionRun[]> {
  liveRuns ??= (async () => {
    const out: ActionRun[] = [];
    for (const name of ["copy", "429 error", "expiry", "accepted flag", "console"] as const) out.push(await runLiveAction(name));
    return out;
  })();
  return liveRuns;
}

describe("X35: live regions", () => {
  test("X35: every view has a live region at load [guard: already fixed in 2516aa1]", { timeout: TEST_TIMEOUT }, async () => {
    const missing: string[] = [];
    for (const path of VIEW_PATHS) {
      await withPage({}, async (page) => {
        await gotoView(page, path);
        if ((await liveRegions(page).count()) === 0) missing.push(path);
      });
    }
    assert.deepEqual(missing, []);
  });

  test("X35: copy, 429 error, expiry, accepted-flag, and console messages are announced in a live region that existed before the action [guard: already fixed in 2516aa1]", { timeout: 240_000 }, async () => {
    const runs = await getLiveRuns();
    const silent = runs.filter((r) => !r.announced.some((l) => l.regionSeenAt < r.t0)).map((r) => r.name);
    assert.deepEqual(silent, [], `no announcement in a pre-existing region: ${JSON.stringify(runs.map((r) => ({ name: r.name, announced: r.announced.map((l) => l.text) })))}`);
  });

  test("X35: announcing a copy, error, expiry, accepted flag, or console output leaves focus where it was", { timeout: 240_000 }, async () => {
    const runs = await getLiveRuns();
    const moved = runs.filter((r) => !r.focus.kept).map((r) => `${r.name}: focus moved to ${r.focus.active}`);
    assert.deepEqual(moved, []);
  });

  test("X35, R-41 (likely): result boxes aren't extra live regions (no live region appears with the result)", { timeout: 240_000 }, async () => {
    const runs = await getLiveRuns();
    const extra = runs
      .filter((r) => r.newRegion.length)
      .map((r) => `${r.name}: new live region(s) ${JSON.stringify([...new Set(r.newRegion.map((l) => `${l.role ?? ""}${l.live ? `/${l.live}` : ""}: ${l.text.slice(0, 80)}`))])}`);
    assert.deepEqual(extra, []);
  });

  test("X35, R-37 (likely): an accepted-flag message while the dialog is open lands in a live region inside the dialog (the rest of the page is inert)", { timeout: 240_000 }, async () => {
    const run = (await getLiveRuns()).find((r) => r.name === "accepted flag");
    assert.ok(run, "accepted-flag run missing");
    assert.ok(run.announced.length > 0, "the accepted flag was not announced at all");
    assert.equal(run.inDialogRegion, true, `announced only outside the open modal dialog: ${JSON.stringify(run.announced.map((l) => l.text))}`);
  });
});

// ===========================================================================
// R-35: the header dialog stays open after a later submission
// ===========================================================================

describe("R-35: header dialog", () => {
  test("R-35: after an accepted flag, a second submission in the header dialog keeps the dialog open and shows its result and the Proof-of-Pwn badge", { timeout: TEST_TIMEOUT }, async () => {
    await withPage({}, async (page) => {
      const second = await fulfillApi(page, { path: "/api/scoreboard", method: "POST", status: 200, json: cap.accepted[3] });
      const first = await fulfillApi(page, { path: "/api/scoreboard", method: "POST", status: 200, json: cap.accepted[0], times: 1 });
      await gotoView(page, "/gates/1");
      const dialog = await submitInDialog(page, cap.handle, cap.flags[0]);
      assert.ok(await waitForText(dialog, cap.accepted[0].message), "first accepted result not shown");
      const openAfterFirst = await dialog.isVisible();
      await flagForm(dialog).flag.fill(cap.flags[3]);
      await flagForm(dialog).submit.click();
      await poll(() => second.hits() > 0, { timeoutMs: 5_000 });
      await sleep(1_000);
      const open = await dialog.isVisible();
      const text = open ? await textOf(dialog) : "";
      const badge = cap.accepted[3].proofBadge ?? "";
      assert.equal(first.hits(), 1);
      assert.ok(
        openAfterFirst && open && text.includes(cap.accepted[3].message) && text.includes(badge),
        `open after first=${openAfterFirst}, open after second=${open}, shows second message=${text.includes(cap.accepted[3].message)}, shows badge=${text.includes(badge)}`,
      );
    });
  });
});

// ===========================================================================
// M-01 / R-01: one GET /api/scoreboard per open
// ===========================================================================

describe("M-01, R-01: scoreboard requests", () => {
  test("M-01, R-01: opening /scoreboard and staying 3 s sends exactly one GET /api/scoreboard (real server, fresh probe IP)", { timeout: TEST_TIMEOUT }, async () => {
    await withPage({ stubScoreboard: false }, async (page) => {
      const log = logApiRequests(page);
      await gotoView(page, "/scoreboard");
      await sleep(3_000);
      const gets = log.filter("GET", "/api/scoreboard");
      const other = log.entries.filter((e) => e.path !== "/api/scoreboard").map((e) => `${e.method} ${e.path}`);
      log.dispose();
      assert.equal(gets.length, 1, `GET /api/scoreboard sent ${gets.length} times in 3 s (${tally(gets)}); other API requests: ${other.length}`);
    });
  });

  test("R-01: one Refresh click on /scoreboard sends exactly one more GET /api/scoreboard", { timeout: TEST_TIMEOUT }, async () => {
    await withPage({}, async (page) => {
      const log = logApiRequests(page);
      await gotoView(page, "/scoreboard");
      await sleep(1_500);
      const c0 = log.count("GET", "/api/scoreboard");
      await scoreboardParts(page).refresh.click({ force: true, timeout: 2_000 });
      await sleep(1_500);
      const c1 = log.count("GET", "/api/scoreboard");
      log.dispose();
      assert.equal(c1 - c0, 1, `GETs before Refresh: ${c0} in 1.5 s; GETs from one Refresh click and the next 1.5 s: ${c1 - c0}`);
    });
  });

  test("R-01, R-15: /console sends at most one GET /api/scoreboard in 3 s when the load fails (429)", { timeout: TEST_TIMEOUT }, async () => {
    await withPage({}, async (page) => {
      await fulfillApi(page, { path: "/api/scoreboard", method: "GET", status: 429, json: cap.rateLimited });
      const log = logApiRequests(page);
      await gotoView(page, "/console");
      await sleep(3_000);
      const n = log.count("GET", "/api/scoreboard");
      log.dispose();
      assert.ok(n <= 1, `/console sent ${n} GET /api/scoreboard in 3 s while every load returned 429`);
    });
  });

  test("M-01: /, the gate pages, and /docs send no API request in 2 s, and /console sends at most one (real server) [guard: already fixed in 2516aa1]", { timeout: TEST_TIMEOUT }, async () => {
    const counts: Record<string, number> = {};
    await withPage({ stubScoreboard: false }, async (page) => {
      for (const path of ["/", "/gates/1", "/gates/2", "/gates/3", "/gates/4", "/docs"]) {
        const log = logApiRequests(page);
        await gotoView(page, path);
        await sleep(2_000);
        counts[path] = log.entries.length;
        log.dispose();
      }
    });
    await withPage({ stubScoreboard: false }, async (page) => {
      const log = logApiRequests(page);
      await gotoView(page, "/console");
      await sleep(2_000);
      counts["/console"] = log.entries.length;
      log.dispose();
    });
    const over = Object.entries(counts).filter(([p, n]) => n > (p === "/console" ? 1 : 0));
    assert.deepEqual(over, [], `API requests per view in 2 s: ${JSON.stringify(counts)}`);
  });
});
