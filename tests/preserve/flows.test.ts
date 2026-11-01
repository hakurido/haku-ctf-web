// Visitor-flow and site-invariant preservation tests (Property 2, K09-K20),
// plus the measured.md "Passing" list as regression checks. They observe HEAD
// c6d13ea and must pass there and after the gap fixes, so they compare
// behavior and information, not wording: no "(Hell)", no exact labels where
// the fix rewords them, and server messages verbatim (they come from the
// frozen API).
//
// Server: `ensureServer(3104)` reuses the existing `.next` build (or BASE_URL).
// Every browser context gets a fresh probe IP from PROBE_BLOCKS.preserveFlows.
// HEAD's /scoreboard refetch loop (M-01) never settles, so every context that
// can open /scoreboard answers GET /api/scoreboard locally (page.route) and no
// request of that loop reaches the server. The "exactly one GET" count is an
// exploration check (tests/explore/flows.test.ts); here the scoreboard is
// held to "at least one GET, and nothing but GET /api/scoreboard".
//
// **Validates: Requirements 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 3.11, 3.12, 3.13, 3.14, 3.15, 3.16, 3.17, 3.18, 2.16**

import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import type { Browser, BrowserContext, Locator, Page, Route } from "playwright-core";
import { PROBE_BLOCKS, createProbeClient, ensureServer, isPortFree, nextProbeIp, poll, probeRequest, sleep, type ServerHandle } from "../support/server.ts";
import {
  fulfillApi,
  holdApi,
  launchBrowser,
  logApiRequests,
  newContext,
  gotoView,
  readClipboard,
  readRecorders,
  surveyPage,
  type ViewportName,
} from "../support/browser.ts";
import {
  NAV_ITEMS,
  VIEW_PATHS,
  closeFlagDialog,
  consoleParts,
  copyButtonFor,
  countdownSeconds,
  endpointList,
  flagDialog,
  flagForm,
  gate1Panel,
  instancePanel,
  mainRegion,
  navLabelFor,
  navLink,
  openFlagDialog,
  readStandings,
  runConsoleCommand,
  scoreboardParts,
  soundToggle,
  tryIt,
} from "../support/views.ts";
import { readRepoFile } from "../support/source.ts";
import { GATES_BASELINE, INSTANCE_BASELINE } from "../fixtures/baseline/gates-baseline.ts";
import { checksFor, failedChecks } from "../fixtures/baseline/console-facts.ts";

const PORT = 3104;
const BLOCK = PROBE_BLOCKS.preserveFlows;
const SOLVER_PROMPT_BASE = "In the ontological allegory of the cave, truth is an eternal epistemic reflection behind shadows.";
const FAKE_FLAG_MESSAGE = "FLAG REJECTED: Invalid or fake flag token.";
const MALFORMED = "Malformed assignment array. Expected valid JSON format.";
/** Time after an instance arrives before its countdown is read (one 250 ms tick plus margin). */
const COUNTDOWN_SETTLE_MS = 500;

let server: ServerHandle;
let browser: Browser;
let solverPrompt = "";
let gate1Flag = "";
let scoreboardShape: Record<string, unknown> = {};
const openContexts = new Set<BrowserContext>();

/** test_agent_solver.py's Gate 1 prompt: the first nonce whose SHA-256 starts with 0000. */
function mineSolverPrompt(): string {
  for (let nonce = 0; ; nonce++) {
    const prompt = `${SOLVER_PROMPT_BASE} [nonce:${nonce}]`;
    if (createHash("sha256").update(prompt).digest("hex").startsWith("0000")) return prompt;
  }
}

interface CtxOptions {
  viewport?: ViewportName;
  permissions?: string[];
  reducedMotion?: "reduce" | "no-preference";
  /** Answer GET /api/scoreboard locally with this body (default: the server's own shape, empty list). */
  scoreboard?: unknown | false;
}

async function context(options: CtxOptions = {}): Promise<BrowserContext> {
  const ctx = await newContext(browser, {
    baseUrl: server.baseUrl,
    ip: nextProbeIp(BLOCK),
    viewport: options.viewport ?? "desktop",
    permissions: options.permissions,
    reducedMotion: options.reducedMotion,
  });
  openContexts.add(ctx);
  if (options.scoreboard !== false) {
    await fulfillApi(ctx, { path: "/api/scoreboard", method: "GET", status: 200, json: options.scoreboard ?? { ...scoreboardShape, leaderboard: [], totalAgents: 0 } });
  }
  return ctx;
}

async function closeContext(ctx: BrowserContext): Promise<void> {
  openContexts.delete(ctx);
  await ctx.close().catch(() => undefined);
}

const norm = (s: string): string => s.replace(/\s+/g, " ").trim();
const noCommas = (s: string): string => s.replace(/(\d),(?=\d{3}\b)/g, "$1");

async function isBusyOrDisabled(loc: Locator): Promise<boolean> {
  return (await loc.isDisabled()) || (await loc.getAttribute("aria-disabled")) === "true";
}

async function fontsReady(page: Page): Promise<void> {
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
}

/** Waits for the next response on `path` and returns its JSON. */
async function nextJson(page: Page, method: string, path: string, action: () => Promise<unknown>): Promise<{ status: number; json: Record<string, unknown> }> {
  const [res] = await Promise.all([
    page.waitForResponse((r) => r.request().method() === method && new URL(r.url()).pathname === path, { timeout: 20_000 }),
    action(),
  ]);
  return { status: res.status(), json: (await res.json()) as Record<string, unknown> };
}

before(async () => {
  server = await ensureServer(PORT);
  browser = await launchBrowser();
  solverPrompt = mineSolverPrompt();
  const client = createProbeClient(nextProbeIp(BLOCK), server.baseUrl);
  const chat = await client.post<{ flag: string | null; allowed: boolean }>("/api/gate1/chat", { prompt: solverPrompt });
  assert.equal(chat.status, 200, chat.text);
  assert.equal(chat.json?.allowed, true, chat.text);
  gate1Flag = chat.json?.flag ?? "";
  assert.match(gate1Flag, /^HAKU\{.+\}$/);
  const board = await client.get<Record<string, unknown>>("/api/scoreboard");
  assert.equal(board.status, 200, board.text);
  scoreboardShape = board.json ?? {};
  assert.ok(Array.isArray(scoreboardShape.leaderboard), "scoreboard body has a leaderboard array");
});

after(async () => {
  for (const ctx of openContexts) await ctx.close().catch(() => undefined);
  await browser?.close().catch(() => undefined);
  await server?.stop();
  if (server && !server.external) assert.ok(await isPortFree(PORT), `port ${PORT} is free after the run`);
});

// ---------------------------------------------------------------------------
// HTTP: routes, metadata, credit (Passing list; K16)
// ---------------------------------------------------------------------------

describe("HTTP: routes, metadata, and credit", () => {
  it("/gates redirects to /gates/1; /gates/0, /gates/5, and /gates/x are 404", async () => {
    const ip = nextProbeIp(BLOCK);
    const r = await probeRequest("GET", "/gates", { ip, baseUrl: server.baseUrl });
    assert.ok(r.status === 307 || r.status === 308, `status ${r.status}`);
    assert.match(r.location ?? "", /\/gates\/1$/);
    for (const bad of ["/gates/0", "/gates/5", "/gates/x"]) {
      assert.equal((await probeRequest("GET", bad, { ip, baseUrl: server.baseUrl })).status, 404, bad);
    }
  });

  it("every view returns 200 with its own title, a description, the site icon, lang en, and a zoomable viewport", async () => {
    const ip = nextProbeIp(BLOCK);
    const titles = new Map<string, string>();
    for (const path of VIEW_PATHS) {
      const r = await probeRequest("GET", path, { ip, baseUrl: server.baseUrl });
      assert.equal(r.status, 200, path);
      const title = /<title>([^<]*)<\/title>/.exec(r.text)?.[1] ?? "";
      assert.match(title, /AGENTGATE/, `${path} title`);
      titles.set(path, title);
      const gate = /^\/gates\/(\d)$/.exec(path);
      if (gate) assert.match(title, new RegExp(`Gate ${gate[1]}\\b`), `${path} title names the gate`);
      const viewNames: Record<string, string> = { "/scoreboard": "Scoreboard", "/docs": "Docs", "/console": "Console" };
      const viewName = viewNames[path];
      if (viewName) assert.ok(title.includes(viewName), `${path} title names the view`);
      const description = /<meta name="description" content="([^"]*)"/.exec(r.text)?.[1] ?? "";
      assert.ok(description.trim().length > 20, `${path} has a description`);
      assert.match(r.text, /<html lang="en"/, `${path} lang`);
      assert.match(r.text, /<link rel="icon" href="\/icon\.svg/, `${path} icon`);
      const viewport = /<meta name="viewport" content="([^"]*)"/.exec(r.text)?.[1] ?? "";
      assert.match(viewport, /width=device-width/);
      assert.match(viewport, /initial-scale=1/);
      assert.doesNotMatch(viewport, /maximum-scale|user-scalable\s*=\s*(no|0)/, `${path} allows zoom`);
    }
    assert.equal(new Set(titles.values()).size, titles.size, `titles are distinct: ${JSON.stringify([...titles])}`);
  });

  it("K16: every view credits Haku Digital and names it as author", async () => {
    const ip = nextProbeIp(BLOCK);
    for (const path of VIEW_PATHS) {
      const r = await probeRequest("GET", path, { ip, baseUrl: server.baseUrl });
      assert.equal(r.status, 200, path);
      assert.ok(r.text.includes('<a href="https://hakudigital.tech"'), `${path} links https://hakudigital.tech`);
      assert.ok(r.text.includes('<meta name="author" content="Haku Digital"'), `${path} author meta`);
    }
  });
});

// ---------------------------------------------------------------------------
// Rendered shell on every view (Passing list; K20; K09 integration)
// ---------------------------------------------------------------------------

/** Views in survey order: /scoreboard last, because its effect loops at HEAD. */
const SURVEY_ORDER = [...VIEW_PATHS.filter((p) => p !== "/scoreboard"), "/scoreboard"];

for (const viewport of ["desktop", "mobile"] as const) {
  describe(`rendered views at ${viewport === "desktop" ? "1280x900" : "360x780"}`, () => {
    it("landmarks, nav state, headings, labels, live regions, contrast, and page width hold on every view", { timeout: 180_000 }, async () => {
      // Reduced motion makes color transitions instant, so a control's color is
      // read in its current state (HEAD's scoreboard loop flips Refresh between
      // disabled and enabled many times a second).
      const ctx = await context({ viewport, reducedMotion: "reduce" });
      const page = await ctx.newPage();
      const problems: string[] = [];
      for (const path of SURVEY_ORDER) {
        await gotoView(page, path);
        await fontsReady(page);
        await sleep(300);
        const s = await surveyPage(page);
        const where = `${viewport} ${path}`;
        if (s.docScrollWidth !== s.innerWidth) problems.push(`${where}: scrollWidth ${s.docScrollWidth} != ${s.innerWidth} (K20/3.18)`);
        const lm = s.landmarks;
        if (lm.header !== 1 || lm.main !== 1 || lm.footer !== 1) problems.push(`${where}: landmarks ${JSON.stringify(lm)}`);
        if (!lm.siblings || lm.parents[0]?.split(".")[0] !== "body") problems.push(`${where}: header, nav, main, footer not siblings under body ${JSON.stringify(lm.parents)}`);
        const navCount = await page.locator('nav[aria-label="Primary"]').count();
        if (navCount !== 1) problems.push(`${where}: ${navCount} Primary navs`);
        const expectedNavs = path.startsWith("/gates/") ? 3 : 1;
        if (lm.nav !== expectedNavs) problems.push(`${where}: ${lm.nav} navs, expected ${expectedNavs}`);
        if (s.h1 !== 1) problems.push(`${where}: ${s.h1} h1`);
        if (!path.startsWith("/gates/") && s.skips.length) problems.push(`${where}: heading skips ${s.skips.join("; ")}`);
        const current = s.navLinks.filter((l) => l.ariaCurrent !== null);
        const label = navLabelFor(path);
        const href = NAV_ITEMS.find((n) => n.label === label)?.href;
        const allowed = href === path ? ["page"] : ["page", "true"];
        if (current.length !== 1 || current[0].text !== label || !allowed.includes(current[0].ariaCurrent as string)) {
          problems.push(`${where}: aria-current ${JSON.stringify(current.map((c) => [c.text, c.ariaCurrent]))}`);
        }
        if (s.navLinks.map((l) => l.text).join("|") !== NAV_ITEMS.map((n) => n.label).join("|")) problems.push(`${where}: nav labels ${s.navLinks.map((l) => l.text)}`);
        for (const l of s.navLinks) if (l.lines !== 1 || l.clipped) problems.push(`${where}: nav label ${l.text} wraps or is clipped`);
        if (s.unlabeled.length) problems.push(`${where}: unlabeled inputs ${s.unlabeled.join(", ")}`);
        if (!s.live.length) problems.push(`${where}: no live region`);
        if (path === "/console" && !s.live.some((l) => l.role === "log")) problems.push(`${where}: no role=log`);
        const low = s.lowContrast.filter((c) => !c.disabled);
        if (low.length) problems.push(`${where}: low contrast ${JSON.stringify(low.slice(0, 3))}`);
      }
      await closeContext(ctx);
      assert.deepEqual(problems, []);
    });
  });
}

describe("K09 (integration): gate facts shown on / and /gates/N equal the c6d13ea API", () => {
  it("points, TTLs, and endpoints", { timeout: 60_000 }, async () => {
    const ctx = await context();
    const page = await ctx.newPage();
    await gotoView(page, "/");
    const overview = noCommas(norm(await mainRegion(page).innerText()));
    for (const g of GATES_BASELINE) {
      assert.ok(overview.includes(String(g.points)), `/ shows ${g.points} points`);
      assert.ok(overview.includes(g.endpoints[0].path), `/ shows ${g.endpoints[0].path}`);
      if (g.ttlSeconds !== null) assert.match(overview, new RegExp(`\\b${g.ttlSeconds} ?s\\b`), `/ shows TTL ${g.ttlSeconds} s`);
    }
    for (const g of GATES_BASELINE) {
      await gotoView(page, `/gates/${g.number}`);
      const text = noCommas(norm(await mainRegion(page).innerText()));
      assert.ok(text.includes(String(g.points)), `/gates/${g.number} points`);
      if (g.ttlSeconds !== null) assert.match(text, new RegExp(`\\b${g.ttlSeconds} ?s\\b`), `/gates/${g.number} TTL`);
      assert.deepEqual(await endpointList(page), g.endpoints, `/gates/${g.number} endpoints`);
      for (const field of g.requestFields) assert.ok(text.includes(field), `/gates/${g.number} payload field ${field}`);
    }
    await closeContext(ctx);
  });
});

// ---------------------------------------------------------------------------
// Sound off (Passing list; 2.25)
// ---------------------------------------------------------------------------

describe("sound", () => {
  it("starts off: nav clicks create no audio; turning it on is exposed and plays", { timeout: 60_000 }, async () => {
    const ctx = await context();
    const page = await ctx.newPage();
    await gotoView(page, "/");
    const toggle = soundToggle(page);
    assert.equal(await toggle.getAttribute("aria-pressed"), "false");
    for (const label of ["Gates", "Docs", "Console", "Scoreboard", "Overview"] as const) {
      await navLink(page, label).click();
      await page.waitForURL((u) => u.pathname === NAV_ITEMS.find((n) => n.label === label)?.href);
    }
    let rec = await readRecorders(page);
    assert.deepEqual(rec.audio, { contexts: 0, oscillators: 0 }, "no audio before the visitor turns sound on");
    await toggle.click();
    await poll(async () => (await toggle.getAttribute("aria-pressed")) === "true", { timeoutMs: 3_000 });
    assert.equal(await toggle.getAttribute("aria-pressed"), "true");
    rec = await readRecorders(page);
    assert.ok(rec.audio.oscillators >= 1, "sound plays once it is on");
    await closeContext(ctx);
  });
});

// ---------------------------------------------------------------------------
// Instance counts, countdown lifecycle, announcements (Passing list; 3.7, 2.13)
// ---------------------------------------------------------------------------

interface Sample {
  at: number;
  text: string | null;
}

async function instanceLifecycle(page: Page, gate: 2 | 3 | 4): Promise<string[]> {
  const problems: string[] = [];
  const ttl = GATES_BASELINE[gate - 1].ttlSeconds as number;
  await gotoView(page, `/gates/${gate}`);
  const panel = instancePanel(page);
  const { json, status } = await nextJson(page, "GET", `/api/gate${gate}/challenge`, () => panel.requestFirst.click());
  const t0 = Date.now();
  if (status !== 200) return [`gate ${gate}: challenge status ${status}`];
  const area = panel.area;
  await panel.countdown.first().waitFor({ timeout: 5_000 });

  // Instance counts, derived from the response.
  const text = norm(await area.innerText());
  if (gate === 2) {
    const seq = json.sequence as string[];
    if (seq.length !== INSTANCE_BASELINE.gate2.sequenceLength) problems.push(`gate 2: sequence length ${seq.length}`);
    for (let i = 1; i <= seq.length; i++) if ((await area.getByText(`X${i}`, { exact: true }).count()) < 1) problems.push(`gate 2: no X${i} label`);
    for (const v of seq) if (!text.includes(v)) problems.push(`gate 2: output ${v} not shown`);
    if (!text.includes(INSTANCE_BASELINE.gate2.multiplier)) problems.push("gate 2: multiplier A not shown");
  } else if (gate === 3) {
    if (json.variablesCount !== INSTANCE_BASELINE.gate3.variables || json.clausesCount !== INSTANCE_BASELINE.gate3.clauses) problems.push(`gate 3: response counts ${json.variablesCount}/${json.clausesCount}`);
    if (!new RegExp(`variables\\W+${INSTANCE_BASELINE.gate3.variables}\\b`).test(text)) problems.push(`gate 3: ${INSTANCE_BASELINE.gate3.variables} variables not shown`);
    if (!new RegExp(`clauses\\W+${INSTANCE_BASELINE.gate3.clauses}\\b`).test(text)) problems.push(`gate 3: ${INSTANCE_BASELINE.gate3.clauses} clauses not shown`);
  } else {
    // Gate 4 at HEAD is the 24-round 8-register ARX VM: the challenge exposes
    // instructions + checkpoints instead of stack bytecode.
    const instrs = json.instructions as unknown[] | undefined;
    if (!Array.isArray(instrs) || instrs.length !== INSTANCE_BASELINE.gate4.rounds) {
      problems.push(`gate 4: ${Array.isArray(instrs) ? instrs.length : "no"} instruction rounds`);
    }
    const ckpts = json.checkpoints as Record<string, number[]> | undefined;
    if (!ckpts || Object.keys(ckpts).length !== INSTANCE_BASELINE.gate4.checkpoints) {
      problems.push("gate 4: checkpoint count mismatch");
    }
  }

  // Countdown lifecycle: starts at the TTL, only goes down, warns, then expires at the TTL.
  // Sampling starts after the provider's first 250 ms tick: at HEAD the first
  // frame divides by a `now` taken at page load, so it can read above the TTL.
  await sleep(Math.max(0, t0 + COUNTDOWN_SETTLE_MS - Date.now()));
  const samples: Sample[] = [];
  const deadline = t0 + ttl * 1000 + 4_000;
  while (Date.now() < deadline) {
    const c = panel.countdown.first();
    const txt = (await c.count()) ? norm(await c.innerText().catch(() => "")) : null;
    samples.push({ at: Date.now(), text: txt });
    if (txt === "Expired") break;
    await sleep(200);
  }
  const secs = samples.map((s) => (s.text === "Expired" ? 0 : Number(/(\d+) s/.exec(s.text ?? "")?.[1] ?? NaN)));
  const first = samples[0]?.text ?? "";
  if (!/^Expires in \d+ s$/.test(first) || secs[0] > ttl || secs[0] < ttl - 2) problems.push(`gate ${gate}: first countdown ${JSON.stringify(first)}`);
  for (let i = 1; i < secs.length; i++) if (!Number.isNaN(secs[i]) && secs[i] > secs[i - 1]) problems.push(`gate ${gate}: countdown went up at ${samples[i].text}`);
  if (!samples.some((s) => /^Expiring/.test(s.text ?? ""))) problems.push(`gate ${gate}: no expiring state`);
  const expiredAt = samples.find((s) => s.text === "Expired")?.at;
  if (expiredAt === undefined) problems.push(`gate ${gate}: never expired`);
  else if (expiredAt - t0 < ttl * 1000 - 600 || expiredAt - t0 > ttl * 1000 + 2_000) problems.push(`gate ${gate}: expired after ${expiredAt - t0} ms (TTL ${ttl} s)`);

  // After expiry: Submit and inputs off, a new instance available.
  await sleep(600);
  if (!(await isBusyOrDisabled(panel.submit.first()))) problems.push(`gate ${gate}: Submit enabled after expiry`);
  const inputs = gate === 2 ? panel.predictions : gate === 3 ? panel.assignment : panel.key;
  for (let i = 0; i < (await inputs.count()); i++) if (await inputs.nth(i).isEditable()) problems.push(`gate ${gate}: input ${i} editable after expiry`);
  if (!(await panel.requestNew.isEnabled())) problems.push(`gate ${gate}: Request new instance disabled after expiry`);

  // Announcements: ready once near the response, expired once near the TTL.
  const live = (await readRecorders(page)).live;
  const ready = live.filter((l) => new RegExp(`Gate ${gate}\\b`).test(l.text) && /ready|expires in/i.test(l.text) && new RegExp(`\\b${ttl}\\b`).test(l.text));
  if (!ready.length || ready[0].at - t0 > 3_000) problems.push(`gate ${gate}: ready announcement ${JSON.stringify(ready)}`);
  const expired = live.filter((l) => new RegExp(`Gate ${gate}\\b`).test(l.text) && /expired/i.test(l.text));
  const perRegion = new Map<number, number>();
  for (const e of expired) perRegion.set(e.regionId, (perRegion.get(e.regionId) ?? 0) + 1);
  if (!expired.length) problems.push(`gate ${gate}: expiry not announced`);
  if ([...perRegion.values()].some((n) => n > 1)) problems.push(`gate ${gate}: expiry announced ${expired.length} times`);
  if (expired.length && (expired[0].at - t0 < ttl * 1000 - 600 || expired[0].at - t0 > ttl * 1000 + 2_500)) problems.push(`gate ${gate}: expiry announced at ${expired[0].at - t0} ms`);
  return problems;
}

describe("instances: counts, countdown lifecycle, and announcements", () => {
  it("Gates 2, 3, and 4 (real instances, TTLs 15, 10, and 20 s)", { timeout: 90_000 }, async () => {
    const ctx = await context();
    const pages = await Promise.all([2, 3, 4].map(() => ctx.newPage()));
    const results = await Promise.all(([2, 3, 4] as const).map((g, i) => instanceLifecycle(pages[i], g)));
    await closeContext(ctx);
    assert.deepEqual(results.flat(), []);
  });
});

// ---------------------------------------------------------------------------
// Gate 1 (K12, K10)
// ---------------------------------------------------------------------------

describe("K12: Gate 1 send", () => {
  it("POSTs {prompt} as typed, shows the server text verbatim, and shows a returned flag", { timeout: 60_000 }, async () => {
    const ctx = await context();
    const page = await ctx.newPage();
    await gotoView(page, "/gates/1");
    const log = logApiRequests(page);
    const panel = gate1Panel(page);

    const short = "This prompt is far too short.";
    await panel.prompt.fill(short);
    const blocked = await nextJson(page, "POST", "/api/gate1/chat", () => panel.send.click());
    const sent = log.filter("POST", "/api/gate1/chat")[0];
    assert.deepEqual(JSON.parse(sent.postData ?? ""), { prompt: short });
    assert.equal(blocked.json.allowed, false);
    await poll(async () => norm(await panel.area.innerText()).includes(norm(String(blocked.json.response))), { timeoutMs: 5_000 });
    assert.ok(norm(await panel.area.innerText()).includes(norm(String(blocked.json.response))), "blocked message verbatim");
    assert.equal(await panel.flag.count(), 0, "no flag shown when none is returned");

    await panel.prompt.fill(solverPrompt);
    const flagged = await nextJson(page, "POST", "/api/gate1/chat", () => panel.send.click());
    assert.deepEqual(JSON.parse(log.filter("POST", "/api/gate1/chat")[1].postData ?? ""), { prompt: solverPrompt });
    assert.equal(flagged.json.flag, gate1Flag);
    await panel.flag.first().waitFor({ timeout: 5_000 });
    assert.equal(norm(await panel.flag.first().innerText()), gate1Flag);
    assert.ok(norm(await panel.area.innerText()).includes(norm(String(flagged.json.response))), "flag response verbatim");
    log.dispose();
    await closeContext(ctx);
  });
});

describe("K10: a returned flag fills the flag field and leaves the handle", () => {
  it("handle keep_me survives the Gate 1 auto-fill", { timeout: 60_000 }, async () => {
    const ctx = await context();
    const page = await ctx.newPage();
    await gotoView(page, "/gates/1");
    const dialog = await openFlagDialog(page);
    await flagForm(dialog).handle.fill("keep_me");
    await closeFlagDialog(page);
    const panel = gate1Panel(page);
    await panel.prompt.fill(solverPrompt);
    await nextJson(page, "POST", "/api/gate1/chat", () => panel.send.click());
    const inline = flagForm(tryIt(page));
    await inline.flag.waitFor({ timeout: 5_000 });
    assert.equal(await inline.flag.inputValue(), gate1Flag);
    assert.equal(await inline.handle.inputValue(), "keep_me");
    await closeContext(ctx);
  });
});

// ---------------------------------------------------------------------------
// K11: flag submit and feedback
// ---------------------------------------------------------------------------

describe("K11: flag submission", () => {
  it("POSTs {agentName, flag}, shows server messages verbatim, refreshes the scoreboard, shows a badge, and dismisses", { timeout: 60_000 }, async () => {
    const ctx = await context({ scoreboard: false });
    const page = await ctx.newPage();
    await gotoView(page, "/");
    const log = logApiRequests(page);
    const dialog = await openFlagDialog(page);
    const form = flagForm(dialog);
    const submit = async (): Promise<{ status: number; json: Record<string, unknown> }> => nextJson(page, "POST", "/api/scoreboard", () => form.submit.click());
    // The result area after the form, so a live region the fix adds to the
    // dialog (R-37) can't stand in for the visible result.
    const dialogText = async (): Promise<string> => ((await flagDialog(page).isVisible()) ? norm((await form.after.allInnerTexts()).join(" ")) : "");
    const dismiss = async (gone: string): Promise<void> => {
      await form.dismiss.first().click();
      await poll(async () => !(await dialogText()).includes(gone), { timeoutMs: 3_000 });
      assert.ok(!(await dialogText()).includes(gone), `dismiss removes ${JSON.stringify(gone)}`);
    };

    // Accepted, from the real server.
    await form.handle.fill("probe_k11");
    await form.flag.fill(gate1Flag);
    const accepted = await submit();
    const acceptedAt = Date.now();
    assert.equal(accepted.status, 200);
    assert.equal(accepted.json.success, true);
    const post = log.filter("POST", "/api/scoreboard")[0];
    const body = JSON.parse(post.postData ?? "") as Record<string, unknown>;
    assert.deepEqual(Object.keys(body).sort(), ["agentName", "flag"]);
    assert.deepEqual(body, { agentName: "probe_k11", flag: gate1Flag });
    const message = String(accepted.json.message);
    assert.match(message, /^FLAG ACCEPTED for Gate 1! \+1000 points\.$/);
    await poll(async () => (await dialogText()).includes(message), { timeoutMs: 5_000 });
    assert.ok((await dialogText()).includes(message), "accepted message verbatim");
    await poll(() => log.filter("GET", "/api/scoreboard").length > 0, { timeoutMs: 2_000 });
    const refresh = log.filter("GET", "/api/scoreboard")[0];
    assert.ok(refresh && refresh.at - acceptedAt <= 2_000, "GET /api/scoreboard follows within 2 s");
    await dismiss(message);

    // Accepted with a Proof-of-Pwn badge (the real body, completed to four gates).
    const agent = accepted.json.agent as Record<string, unknown>;
    const badge = "HAKU{AGENT_PROBE_K11_GATES_1234_VERIFIED_0123456789abcdef}";
    const badgeBody = { ...accepted.json, agent: { ...agent, gatesSolved: [1, 2, 3, 4], score: 8500, proofBadge: badge }, proofBadge: badge, allGatesCleared: true };
    await fulfillApi(page, { path: "/api/scoreboard", method: "POST", times: 1, status: 200, json: badgeBody });
    await form.submit.click();
    await poll(async () => (await dialogText()).includes(badge), { timeoutMs: 5_000 });
    assert.ok((await dialogText()).includes(badge), "badge shown");
    await dismiss(badge);

    // Rejected, from the real server.
    await form.flag.fill("HAKU{FAKE_K11}");
    const rejected = await submit();
    assert.equal(rejected.status, 403);
    assert.equal(rejected.json.message, FAKE_FLAG_MESSAGE);
    await poll(async () => (await dialogText()).includes(FAKE_FLAG_MESSAGE), { timeoutMs: 5_000 });
    assert.ok((await dialogText()).includes(FAKE_FLAG_MESSAGE), "rejected message verbatim");
    await dismiss(FAKE_FLAG_MESSAGE);
    log.dispose();
    await closeContext(ctx);
  });
});

// ---------------------------------------------------------------------------
// K13: Gate 2 instance; K08 in the browser
// ---------------------------------------------------------------------------

describe("K13: Gate 2 instance lifecycle", () => {
  it("GETs the challenge, counts down from 15, POSTs the token with trimmed predictions, clears the result, and disables Submit when held or expired", { timeout: 90_000 }, async () => {
    const ctx = await context();
    const page = await ctx.newPage();
    await gotoView(page, "/gates/2");
    const log = logApiRequests(page);
    const panel = instancePanel(page);

    const first = await nextJson(page, "GET", "/api/gate2/challenge", () => panel.requestFirst.click());
    assert.equal(first.status, 200);
    assert.equal(log.count("GET", "/api/gate2/challenge"), 1);
    await panel.countdown.first().waitFor({ timeout: 5_000 });
    await sleep(COUNTDOWN_SETTLE_MS);
    const s0 = (await countdownSeconds(page)) as number;
    assert.ok(s0 <= 15 && s0 >= 13, `countdown starts at 15 (read ${s0})`);
    await sleep(1_600);
    const s1 = (await countdownSeconds(page)) as number;
    assert.ok(s1 < s0, `countdown decreases (${s0} -> ${s1})`);

    const typed: [string, string, string] = ["  1 ", "\t2", " 3  "];
    for (let i = 0; i < 3; i++) await panel.predictions.nth(i).fill(typed[i]);
    await holdApi(page, { path: "/api/gate2/submit", method: "POST", times: 1, ms: 1_500 });
    const submitted = nextJson(page, "POST", "/api/gate2/submit", () => panel.submit.first().click());
    await poll(async () => isBusyOrDisabled(panel.submit.first()), { timeoutMs: 1_000 });
    assert.ok(await isBusyOrDisabled(panel.submit.first()), "Submit is disabled while the request is held");
    const result = await submitted;
    const post = log.filter("POST", "/api/gate2/submit")[0];
    assert.deepEqual(JSON.parse(post.postData ?? ""), { sessionToken: first.json.sessionToken, predictions: ["1", "2", "3"] });
    const message = String(result.json.message);
    await poll(async () => norm(await panel.area.innerText()).includes(message), { timeoutMs: 5_000 });
    assert.ok(norm(await panel.area.innerText()).includes(message), "server message verbatim");

    const second = await nextJson(page, "GET", "/api/gate2/challenge", () => panel.requestNew.click());
    assert.equal(second.status, 200);
    assert.equal(log.count("GET", "/api/gate2/challenge"), 2);
    await panel.countdown.first().waitFor({ timeout: 5_000 });
    assert.ok(!norm(await panel.area.innerText()).includes(message), "the previous result is cleared");
    for (let i = 0; i < 3; i++) assert.equal(await panel.predictions.nth(i).inputValue(), "", "inputs are cleared");

    await fulfillApi(page, { path: "/api/gate2/challenge", method: "GET", times: 1, status: 200, json: { ...second.json, ttlSeconds: 1 } });
    await panel.requestNew.click();
    await poll(async () => (await countdownSeconds(page)) === 0, { timeoutMs: 4_000 });
    assert.equal(await countdownSeconds(page), 0, "an injected 1 s TTL expires");
    await sleep(400);
    assert.ok(await isBusyOrDisabled(panel.submit.first()), "Submit is disabled at zero");
    assert.ok(await panel.requestNew.isEnabled());
    log.dispose();
    await closeContext(ctx);
  });
});

describe("K08 (browser): Gate 3 JSON pass-through and Gate 4 trimming", () => {
  it("malformed Gate 3 JSON sends nothing and shows the exact message; valid JSON and a padded key are sent as parsed and trimmed", { timeout: 60_000 }, async () => {
    const ctx = await context();
    const [p3, p4] = [await ctx.newPage(), await ctx.newPage()];
    await Promise.all([gotoView(p3, "/gates/3"), gotoView(p4, "/gates/4")]);
    const log3 = logApiRequests(p3);
    const log4 = logApiRequests(p4);
    const g3 = instancePanel(p3);
    const g4 = instancePanel(p4);
    const [c3, c4] = await Promise.all([
      nextJson(p3, "GET", "/api/gate3/challenge", () => g3.requestFirst.click()),
      nextJson(p4, "GET", "/api/gate4/challenge", () => g4.requestFirst.click()),
    ]);
    assert.equal(c3.status, 200);
    assert.equal(c4.status, 200);

    await g3.assignment.fill("[true, false,");
    await g3.submit.first().click();
    await poll(async () => norm(await g3.area.innerText()).includes(MALFORMED), { timeoutMs: 3_000 });
    assert.ok(norm(await g3.area.innerText()).includes(MALFORMED), "exact malformed message");
    assert.equal(log3.count("POST", "/api/gate3/submit"), 0, "no request for malformed JSON");
    await g3.assignment.fill(" [1, -2, 3] ");
    await nextJson(p3, "POST", "/api/gate3/submit", () => g3.submit.first().click());
    assert.deepEqual(JSON.parse(log3.filter("POST", "/api/gate3/submit")[0].postData ?? ""), { sessionToken: c3.json.sessionToken, assignment: [1, -2, 3] });

    await g4.key.fill("  a1b2c3d4e5f60718\t");
    await nextJson(p4, "POST", "/api/gate4/submit", () => g4.submit.first().click());
    assert.deepEqual(JSON.parse(log4.filter("POST", "/api/gate4/submit")[0].postData ?? ""), { sessionToken: c4.json.sessionToken, keyHex: "a1b2c3d4e5f60718" });
    log3.dispose();
    log4.dispose();
    await closeContext(ctx);
  });
});

// ---------------------------------------------------------------------------
// K14: scoreboard listing
// ---------------------------------------------------------------------------

describe("K14: scoreboard listing", () => {
  it("lists entries in the returned order with rank, handle, score, gates, and proof status; shows the empty state; GETs on open and on refresh", { timeout: 60_000 }, async () => {
    const entries = [
      { agentName: "k14_low", gatesSolved: [1], score: 1000, lastSolveAt: 1 },
      { agentName: "k14_full", gatesSolved: [4, 2, 1, 3], score: 8500, lastSolveAt: 2, proofBadge: "HAKU{AGENT_K14_FULL_GATES_1234_VERIFIED_0123456789abcdef}" },
      { agentName: "k14_mid", gatesSolved: [3, 2], score: 4500, lastSolveAt: 3 },
    ];
    let current: unknown = { ...scoreboardShape, leaderboard: entries, totalAgents: entries.length };
    const ctx = await context({ scoreboard: false });
    await ctx.route(
      (u) => u.pathname === "/api/scoreboard",
      (route: Route) => (route.request().method() === "GET" ? route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(current) }) : route.fallback()),
    );
    const page = await ctx.newPage();
    const log = logApiRequests(page);
    await gotoView(page, "/scoreboard");
    const parts = scoreboardParts(page);
    await poll(async () => (await parts.rows.count()) === 3, { timeoutMs: 5_000 });
    assert.ok(log.count("GET", "/api/scoreboard") >= 1, "opening the view GETs /api/scoreboard");
    const rows = await readStandings(page);
    assert.equal(rows.length, 3);
    rows.forEach((cells, i) => {
      const e = entries[i];
      const line = cells.join(" | ");
      assert.match(cells[0], new RegExp(`^#?${i + 1}$`), `rank ${line}`);
      assert.ok(cells.some((c) => c === e.agentName), `handle ${line}`);
      assert.ok(cells.some((c) => noCommas(c) === String(e.score)), `score ${line}`);
      for (const g of [1, 2, 3, 4]) {
        const m = new RegExp(`(?:\\bG|\\bGate\\s*)${g}\\b[:\\s]*(not solved|solved)`, "i").exec(line);
        assert.equal(m?.[1].toLowerCase(), e.gatesSolved.includes(g) ? "solved" : "not solved", `gate ${g} status in ${line}`);
      }
    });
    const proof = rows.map((r) => r[r.length - 1]);
    assert.notEqual(proof[1], proof[0], "the badge row's proof cell differs");
    assert.equal(proof[0], proof[2]);

    const before = log.count("GET", "/api/scoreboard");
    current = { ...scoreboardShape, leaderboard: [], totalAgents: 0 };
    await parts.refresh.first().click({ timeout: 10_000 });
    await poll(() => log.count("GET", "/api/scoreboard") > before, { timeoutMs: 3_000 });
    assert.ok(log.count("GET", "/api/scoreboard") > before, "Refresh GETs /api/scoreboard");
    await parts.empty.first().waitFor({ timeout: 5_000 });
    assert.equal(await parts.rows.count(), 0);
    assert.ok(log.entries.every((e) => e.method === "GET" && e.path === "/api/scoreboard"), "the scoreboard sends nothing else");
    log.dispose();
    await closeContext(ctx);
  });
});

// ---------------------------------------------------------------------------
// K15: skill.md copy
// ---------------------------------------------------------------------------

describe("K15: copy skill.md", () => {
  it("puts the exact file on the clipboard", { timeout: 60_000 }, async (t) => {
    const ctx = await context({ permissions: ["clipboard-read", "clipboard-write"] });
    const page = await ctx.newPage();
    await gotoView(page, "/docs");
    const button = await copyButtonFor(mainRegion(page), "skill.md");
    await button.click();
    await poll(async () => /Copied/.test(norm(await button.innerText())), { timeoutMs: 3_000 });
    const file = readRepoFile("public/skill.md");
    let clip = await readClipboard(page);
    if (clip !== file && clip.replace(/\r\n/g, "\n") === file) {
      t.diagnostic("clipboard returned CRLF line endings; normalized the read side (the file has no CR)");
      clip = clip.replace(/\r\n/g, "\n");
    }
    assert.ok(!file.includes("\r"));
    assert.equal(clip, file);
    await closeContext(ctx);
  });
});

// ---------------------------------------------------------------------------
// K17: state across client navigation
// ---------------------------------------------------------------------------

describe("K17: state survives client navigation", () => {
  it("handle, flag, live instance with its countdown, gate input, and console history persist without a reload", { timeout: 90_000 }, async () => {
    const ctx = await context();
    const page = await ctx.newPage();
    await gotoView(page, "/");
    await page.evaluate(() => {
      (window as unknown as { __k17: string }).__k17 = "marker";
    });
    const dialog = await openFlagDialog(page);
    await flagForm(dialog).handle.fill("k17_handle");
    await flagForm(dialog).flag.fill("HAKU{K17}");
    await closeFlagDialog(page);

    const toGate2 = async (): Promise<void> => {
      await navLink(page, "Gates").click();
      await page.waitForURL((u) => u.pathname === "/gates/1");
      await mainRegion(page).locator('a[href="/gates/2"]').first().click();
      await page.waitForURL((u) => u.pathname === "/gates/2");
    };
    await toGate2();
    const panel = instancePanel(page);
    await nextJson(page, "GET", "/api/gate2/challenge", () => panel.requestFirst.click());
    await panel.countdown.first().waitFor({ timeout: 5_000 });
    await sleep(COUNTDOWN_SETTLE_MS);
    const t0 = Date.now();
    const s0 = (await countdownSeconds(page)) as number;
    await panel.predictions.nth(0).fill("12345");

    await navLink(page, "Console").click();
    await page.waitForURL((u) => u.pathname === "/console");
    await consoleParts(page).input.waitFor();
    await runConsoleCommand(page, "gates");
    await navLink(page, "Docs").click();
    await page.waitForURL((u) => u.pathname === "/docs");
    await navLink(page, "Overview").click();
    await page.waitForURL((u) => u.pathname === "/");
    await toGate2();

    assert.equal(await page.evaluate(() => (window as unknown as { __k17?: string }).__k17), "marker", "no full reload");
    const elapsed = (Date.now() - t0) / 1000;
    const s1 = (await countdownSeconds(page)) as number;
    const expected = Math.max(0, s0 - elapsed);
    assert.ok(Math.abs(s1 - expected) <= 1.5, `countdown kept running: ${s0} s, ${elapsed.toFixed(1)} s later ${s1} s`);
    if (elapsed >= 2) assert.ok(s1 < s0, "the countdown was not reset");
    assert.equal(await panel.predictions.nth(0).inputValue(), "12345");

    const d2 = await openFlagDialog(page);
    assert.equal(await flagForm(d2).handle.inputValue(), "k17_handle");
    assert.equal(await flagForm(d2).flag.inputValue(), "HAKU{K17}");
    await closeFlagDialog(page);

    await navLink(page, "Console").click();
    await page.waitForURL((u) => u.pathname === "/console");
    const out = await consoleParts(page).output.innerText();
    assert.deepEqual(failedChecks(out, checksFor("gates", null)), [], "console history kept");
    await closeContext(ctx);
  });
});

// ---------------------------------------------------------------------------
// Console output in the browser (K06 integration; Passing list)
// ---------------------------------------------------------------------------

describe("K06 (integration): console commands in the browser", () => {
  it("help, GATES, and solve 2 print the baseline facts", { timeout: 60_000 }, async () => {
    const ctx = await context();
    const page = await ctx.newPage();
    await gotoView(page, "/console");
    for (const cmd of ["help", "GATES", "solve 2"]) {
      const run = await runConsoleCommand(page, cmd);
      assert.deepEqual(failedChecks(run.added, checksFor(cmd, null)), [], `${cmd}:\n${run.added}`);
    }
    await closeContext(ctx);
  });
});

// ---------------------------------------------------------------------------
// K18: request budget
// ---------------------------------------------------------------------------

describe("K18: no background requests", () => {
  it("after each view settles, 15 s pass with zero /api requests", { timeout: 90_000 }, async () => {
    const ctx = await context({ scoreboard: false });
    const quiet = VIEW_PATHS.filter((p) => p !== "/scoreboard");
    const pages = await Promise.all(quiet.map(() => ctx.newPage()));
    const logs = pages.map((p) => logApiRequests(p));
    await Promise.all(pages.map((p, i) => gotoView(p, quiet[i])));
    await sleep(2_000);
    const atOpen = logs.map((l) => l.entries.length);
    quiet.forEach((path, i) => {
      const allowed = path === "/console" ? logs[i].entries.every((e) => e.method === "GET" && e.path === "/api/scoreboard") && atOpen[i] <= 1 : atOpen[i] === 0;
      assert.ok(allowed, `${path} at open: ${JSON.stringify(logs[i].entries.map((e) => `${e.method} ${e.path}`))}`);
    });
    await sleep(15_000);
    quiet.forEach((path, i) => assert.equal(logs[i].entries.length, atOpen[i], `${path}: requests while idle ${JSON.stringify(logs[i].entries.slice(atOpen[i]).map((e) => `${e.method} ${e.path}`))}`));
    logs.forEach((l) => l.dispose());
    await closeContext(ctx);
  });

  it("/scoreboard sends nothing but GET /api/scoreboard (the exact count is checked by exploration, M-01)", { timeout: 60_000 }, async () => {
    const ctx = await context();
    const page = await ctx.newPage();
    const log = logApiRequests(page);
    await gotoView(page, "/scoreboard");
    await sleep(5_000);
    assert.ok(log.count("GET", "/api/scoreboard") >= 1);
    assert.ok(log.entries.every((e) => e.method === "GET" && e.path === "/api/scoreboard"), JSON.stringify([...new Set(log.entries.map((e) => `${e.method} ${e.path}`))]));
    log.dispose();
    await closeContext(ctx);
  });
});

// ---------------------------------------------------------------------------
// K19: no emoji in UI text, English, dark only
// ---------------------------------------------------------------------------

describe("K19: no emoji, English, dark only", () => {
  it("UI text has no emoji, html lang is en, CSS has no light scheme, and there is no theme toggle", { timeout: 90_000 }, async () => {
    const ctx = await context();
    const page = await ctx.newPage();
    const problems: string[] = [];
    const sheets = new Set<string>();
    for (const path of SURVEY_ORDER) {
      await gotoView(page, path);
      const found = await page.evaluate(() => {
        const skip = (el: Element | null): boolean => !!el?.closest("[data-skill-doc], main article, script, style, noscript, template");
        const out: string[] = [];
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        for (let n = walker.nextNode(); n; n = walker.nextNode()) {
          if (skip(n.parentElement)) continue;
          const t = n.textContent ?? "";
          if (/\p{Emoji_Presentation}|\p{Extended_Pictographic}\uFE0F/u.test(t)) out.push(t.trim().slice(0, 60));
        }
        return {
          emoji: out,
          lang: document.documentElement.lang,
          colorScheme: getComputedStyle(document.documentElement).colorScheme,
          sheets: [...document.querySelectorAll('link[rel="stylesheet"]')].map((l) => (l as HTMLLinkElement).href),
          themeControls: [...document.querySelectorAll("button, a, [role=switch]")]
            .map((b) => `${b.getAttribute("aria-label") ?? ""} ${b.textContent ?? ""}`.trim())
            .filter((n) => /\b(theme|light mode|dark mode)\b/i.test(n)),
        };
      });
      if (found.emoji.length) problems.push(`${path}: emoji ${JSON.stringify(found.emoji)}`);
      if (found.lang !== "en") problems.push(`${path}: lang ${found.lang}`);
      if (found.colorScheme !== "dark") problems.push(`${path}: color-scheme ${found.colorScheme}`);
      if (found.themeControls.length) problems.push(`${path}: theme control ${JSON.stringify(found.themeControls)}`);
      for (const s of found.sheets) sheets.add(s);
    }
    assert.ok(sheets.size > 0, "views link stylesheets");
    const ip = nextProbeIp(BLOCK);
    for (const href of sheets) {
      const r = await probeRequest("GET", href, { ip, baseUrl: server.baseUrl });
      assert.equal(r.status, 200, href);
      if (/prefers-color-scheme\s*:\s*light/.test(r.text)) problems.push(`${href}: prefers-color-scheme: light`);
    }
    await closeContext(ctx);
    assert.deepEqual(problems, []);
  });
});
