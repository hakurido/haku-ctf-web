// Exploration tests, Property 1 (Bug Condition): the rendered layout and
// semantics show no defect marker.
//
// These encode the expected behavior. On HEAD c6d13ea the gap checks FAIL,
// which confirms each gap; they pass after the fix. Rows the audit measured as
// passing (measured.md "Passing") stay here as regression guards, marked
// "[regression guard, already fixed in 2516aa1]". Findings the review marked
// "likely" (R-33, R-37) are decided by the test; see
// tests/fixtures/explore-failures/rendered.md for the recorded counterexamples.
//
// Run: node --test tests/explore/rendered.test.ts
// Starts `next start -p 3101` from the existing .next build (or uses BASE_URL),
// sends probe IPs from PROBE_BLOCKS.exploreRendered, one fresh IP per browser
// context. Contexts that open /scoreboard or /console answer the first
// GET /api/scoreboard locally (the real envelope with one probe entry) and hold
// later ones, so HEAD's refetch loop (M-01) never reaches the server.
//
// Requirements: 2.3, 2.4, 2.5, 2.6, 2.9, 2.17, 2.24, 2.28, 2.29, 2.30, 2.31,
// 2.33, 2.34.

import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import type { Browser, BrowserContext, Page, Route } from "playwright-core";
import { ensureServer, nextProbeIp, PROBE_BLOCKS, probeFetch, probeRequest, sleep } from "../support/server.ts";
import type { ServerHandle } from "../support/server.ts";
import { describeFocused, gotoView, launchBrowser, newContext, surveyPage } from "../support/browser.ts";
import type { FocusInfo, PageSurvey, ViewportName } from "../support/browser.ts";
import { instancePanel, navLabelFor, openFlagDialog, VIEW_PATHS } from "../support/views.ts";
import type { InstanceGateNumber, ViewPath } from "../support/views.ts";
import { parseColorTokens, tokenContrast } from "../support/contrast.ts";
import { gitShowBuffer, readRepoFile, REF_BUG } from "../support/source.ts";

const PORT = 3101;
const BLOCK = PROBE_BLOCKS.exploreRendered;
const GATE_PATHS = ["/gates/1", "/gates/2", "/gates/3", "/gates/4"] as const;
const TIMEOUT = { timeout: 240_000 };

/** Endpoints per gate, from the frozen src/app/api routes (and gates.ts). */
const GATE_ENDPOINTS: Record<number, readonly (readonly [string, string])[]> = {
  1: [["POST", "/api/gate1/chat"]],
  2: [["GET", "/api/gate2/challenge"], ["POST", "/api/gate2/submit"]],
  3: [["GET", "/api/gate3/challenge"], ["POST", "/api/gate3/submit"]],
  4: [["GET", "/api/gate4/challenge"], ["POST", "/api/gate4/submit"]],
};

/**
 * The injected standings row for X36. The envelope comes from the server's
 * real GET /api/scoreboard; the entry has the LeaderboardEntry shape of the
 * frozen route, with gatesSolved [1, 3] as X36 specifies.
 */
const X36_ENTRY = Object.freeze({ agentName: "probe-x36", gatesSolved: [1, 3], score: 3500, lastSolveAt: 0 });

let server: ServerHandle | undefined;
let browser: Browser | undefined;
let scoreboardBody: Record<string, unknown> | undefined;

function ready<T>(value: T | undefined, what: string): T {
  if (value === undefined) throw new Error(`${what} is not ready (before() failed?)`);
  return value;
}

/** Fails with one line per counterexample when `found` is not empty. */
function assertNone(id: string, what: string, found: readonly unknown[]): void {
  if (found.length === 0) return;
  const shown = found.slice(0, 60).map((f) => "  - " + (typeof f === "string" ? f : JSON.stringify(f)));
  if (found.length > 60) shown.push(`  … and ${found.length - 60} more`);
  assert.fail(`${id}: ${what} (${found.length} counterexample${found.length === 1 ? "" : "s"})\n${shown.join("\n")}`);
}

const escapeRe = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// ---------------------------------------------------------------------------
// In-page probe (self-contained; serialized into the page)
// ---------------------------------------------------------------------------

interface Rect {
  top: number;
  bottom: number;
  left: number;
  right: number;
  width: number;
  height: number;
}

interface ViewProbe {
  path: string;
  innerWidth: number;
  title: string;
  metaDescription: string | null;
  viewportMeta: string | null;
  iconHrefs: string[];
  bodyFontPx: number;
  /** document.body.innerText: rendered text only (closed dialog excluded). */
  bodyText: string;
  h1Texts: string[];
  liveCount: number;
  buttons: { name: string; variant: string | null; disabled: boolean; el: string }[];
  multiPrimary: { container: string; count: number; names: string[] }[];
  /** Visible p, li, label, td below 14px, outside code/pre/kbd/samp/[data-mono]. */
  smallBlocks: { tag: string; fs: number; text: string; el: string }[];
  primaryNav: { nav: Rect | null; main: Rect | null; links: { text: string; rect: Rect }[] };
  /** Clipped content inside links of every nav other than Primary (stepper, pager). */
  innerNavClipping: { nav: string; link: string; el: string; scrollWidth: number; clientWidth: number }[];
  /** Elements past the viewport edge that are not inside an overflow-x auto/scroll container. */
  overflowing: { el: string; left: number; right: number; text: string }[];
  inputs: {
    el: string;
    labels: { text: string; visible: boolean }[];
    labelledby: { text: string; visible: boolean }[];
    describedby: { id: string; text: string; visible: boolean }[];
    fieldsetDescribedby: string | null;
  }[];
  positiveTabindex: string[];
  urlCopy: { url: string; found: boolean; buttons: number; names: string[] }[];
  docs: null | {
    literal: { block: string; match: string; el: string }[];
    emoji: { text: string; el: string }[];
    preOverflow: { el: string; overflowX: string }[];
    scrollBoxes: { el: string; clientHeight: number; scrollHeight: number; overflowY: string }[];
  };
  scoreRows: { row: string; chips: { gate: number; name: string }[] }[];
}

function probeView(): ViewProbe {
  const norm = (s: string | null | undefined): string => (s ?? "").replace(/\s+/g, " ").trim();
  const round = (v: number): number => Math.round(v * 10) / 10;
  const desc = (el: Element): string => {
    let s = el.tagName.toLowerCase();
    if (el.id) s += "#" + el.id;
    const cls = (el.getAttribute("class") || "").split(/\s+/).filter(Boolean).slice(0, 4).join(".");
    if (cls) s += "." + cls;
    return s;
  };
  // Page coordinates, so a view that scrolls the window on load still reports stable positions.
  const rectOf = (el: Element): Rect => {
    const r = el.getBoundingClientRect();
    const x = window.scrollX;
    const y = window.scrollY;
    return { top: round(r.top + y), bottom: round(r.bottom + y), left: round(r.left + x), right: round(r.right + x), width: round(r.width), height: round(r.height) };
  };
  const isSrOnly = (el: Element): boolean => {
    for (let e: Element | null = el; e; e = e.parentElement) {
      const s = getComputedStyle(e);
      if (s.position === "absolute" && (s.clip === "rect(0px, 0px, 0px, 0px)" || s.clipPath === "inset(50%)")) return true;
      if (e.getBoundingClientRect().width <= 1 && s.overflow === "hidden") return true;
    }
    return false;
  };
  const isShown = (el: Element): boolean => {
    if (el.closest("dialog:not([open])")) return false;
    const s = getComputedStyle(el);
    if (s.display === "none" || s.visibility === "hidden") return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };
  const textNoHidden = (node: Node): string => {
    let out = "";
    node.childNodes.forEach((n) => {
      if (n.nodeType === Node.TEXT_NODE) out += n.textContent ?? "";
      else if (n.nodeType === Node.ELEMENT_NODE) {
        const e = n as Element;
        if (e.getAttribute("aria-hidden") === "true") return;
        if (/^(SCRIPT|STYLE|TEMPLATE|NOSCRIPT)$/.test(e.tagName)) return;
        if (getComputedStyle(e).display === "none") return;
        out += textNoHidden(e);
      }
    });
    return out;
  };
  const byIds = (ids: string | null): HTMLElement[] =>
    (ids ?? "")
      .split(/\s+/)
      .filter(Boolean)
      .map((id) => document.getElementById(id))
      .filter((e): e is HTMLElement => e !== null);
  const accName = (el: Element): string => {
    const aria = el.getAttribute("aria-label");
    if (aria && aria.trim()) return norm(aria);
    const lb = byIds(el.getAttribute("aria-labelledby"));
    if (lb.length) return norm(lb.map((e) => textNoHidden(e)).join(" "));
    return norm(textNoHidden(el));
  };
  const visibleText = (el: Element): boolean => isShown(el) && !isSrOnly(el);
  const main = document.querySelector("main");

  // Buttons and the one-primary rule (X04).
  const buttons = Array.from(document.querySelectorAll("button"))
    .filter(isShown)
    .map((b) => ({ name: accName(b).slice(0, 60), variant: b.getAttribute("data-variant"), disabled: b.disabled, el: desc(b) }));
  const primaries = Array.from(document.querySelectorAll('[data-variant="primary"]')).filter(isShown);
  const multiPrimary = Array.from(document.querySelectorAll("section, form, dialog[open], [role=region]"))
    .filter(isShown)
    .map((c) => {
      const inside = primaries.filter((p) => c.contains(p));
      return { container: desc(c), count: inside.length, names: inside.map((p) => accName(p).slice(0, 40)) };
    })
    .filter((x) => x.count > 1);

  // Block text below 14px (X06, M-07).
  const smallBlocks: ViewProbe["smallBlocks"] = [];
  for (const el of Array.from(document.querySelectorAll("p, li, label, td"))) {
    if (!isShown(el) || isSrOnly(el)) continue;
    if (el.closest("code, pre, kbd, samp, [data-mono]")) continue;
    const text = norm(el.textContent);
    if (!text) continue;
    const fs = Number.parseFloat(getComputedStyle(el).fontSize);
    if (fs < 14) smallBlocks.push({ tag: el.tagName.toLowerCase(), fs, text: text.slice(0, 60), el: desc(el) });
  }

  // Primary nav geometry (X37, M-03).
  const nav = document.querySelector('nav[aria-label="Primary"]');
  const primaryNav = {
    nav: nav ? rectOf(nav) : null,
    main: main ? rectOf(main) : null,
    links: nav ? Array.from(nav.querySelectorAll("a")).map((a) => ({ text: norm(a.textContent), rect: rectOf(a) })) : [],
  };

  // Clipping inside the other navs (R-33 stepper, pager).
  const innerNavClipping: ViewProbe["innerNavClipping"] = [];
  for (const n of Array.from(document.querySelectorAll("nav"))) {
    if (n.getAttribute("aria-label") === "Primary" || !isShown(n)) continue;
    const label = n.getAttribute("aria-label") ?? desc(n);
    for (const a of Array.from(n.querySelectorAll("a"))) {
      for (const el of [a, ...Array.from(a.querySelectorAll("*"))]) {
        if (!isShown(el) || isSrOnly(el)) continue;
        const s = getComputedStyle(el);
        const clips = s.overflowX !== "visible" || s.textOverflow === "ellipsis";
        if (clips && el.scrollWidth > el.clientWidth + 1) {
          innerNavClipping.push({ nav: label, link: norm(a.textContent).slice(0, 60), el: desc(el), scrollWidth: el.scrollWidth, clientWidth: el.clientWidth });
        }
      }
    }
  }

  // Elements past the viewport edge (X37).
  const vw = window.innerWidth;
  const scrollsX = (e: Element): boolean => {
    const ox = getComputedStyle(e).overflowX;
    return ox === "auto" || ox === "scroll";
  };
  const overflowing: ViewProbe["overflowing"] = [];
  for (const el of Array.from(document.body.querySelectorAll("*"))) {
    if (!isShown(el)) continue;
    const r = el.getBoundingClientRect();
    if (r.right <= vw + 0.5 && r.left >= -0.5) continue;
    let inScroller = false;
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      if (scrollsX(p)) {
        inScroller = true;
        break;
      }
    }
    if (inScroller || isSrOnly(el)) continue;
    overflowing.push({ el: desc(el), left: round(r.left), right: round(r.right), text: norm(el.textContent).slice(0, 40) });
  }

  // Inputs, labels, descriptions (X33).
  const inputs = Array.from(document.querySelectorAll("input, textarea, select"))
    .filter((i) => (i as HTMLInputElement).type !== "hidden" && isShown(i))
    .map((i) => {
      const inp = i as HTMLInputElement;
      const fieldset = i.closest("fieldset");
      return {
        el: desc(i),
        labels: Array.from(inp.labels ?? []).map((l) => ({ text: norm(l.textContent), visible: visibleText(l) })),
        labelledby: byIds(i.getAttribute("aria-labelledby")).map((e) => ({ text: norm(e.textContent), visible: visibleText(e) })),
        describedby: (i.getAttribute("aria-describedby") ?? "")
          .split(/\s+/)
          .filter(Boolean)
          .map((id) => {
            const e = document.getElementById(id);
            return { id, text: e ? norm(e.textContent).slice(0, 120) : "", visible: e ? visibleText(e) : false };
          }),
        fieldsetDescribedby: fieldset ? fieldset.getAttribute("aria-describedby") : null,
      };
    });

  const positiveTabindex = Array.from(document.querySelectorAll("[tabindex]"))
    .filter((e) => (e as HTMLElement).tabIndex > 0)
    .map(desc);

  // Overview: each URL has an adjacent copy control (X09 B-half).
  const copyLike = (b: Element): boolean => /^(Copy|Copied|Copy failed)\b/i.test(accName(b));
  const urlCopy: ViewProbe["urlCopy"] = [];
  if (location.pathname === "/" && main) {
    const mainEl: Element = main;
    for (const url of ["https://ctf.hakudigital.tech", "https://ctf.hakudigital.tech/skill.md"]) {
      const leaves: Element[] = Array.from(mainEl.querySelectorAll("*")).filter(
        (e) => isShown(e) && norm(e.textContent) === url && !Array.from(e.children).some((c) => norm(c.textContent) === url),
      );
      let hit: ViewProbe["urlCopy"][number] | null = null;
      for (const leaf of leaves) {
        let depth = 0;
        for (let a: Element | null = leaf.parentElement; a && a !== mainEl && depth < 5 && !hit; a = a.parentElement, depth++) {
          const btns: HTMLButtonElement[] = Array.from(a.querySelectorAll("button")).filter((b) => isShown(b) && copyLike(b));
          if (btns.length) hit = { url, found: true, buttons: btns.length, names: btns.map(accName) };
        }
        if (hit) break;
      }
      urlCopy.push(hit ?? { url, found: false, buttons: 0, names: [] });
    }
  }

  // Docs (X22).
  let docs: ViewProbe["docs"] = null;
  const docEl = document.querySelector("main [data-skill-doc], main article");
  if (location.pathname === "/docs" && docEl) {
    const blockSel = "p, li, h1, h2, h3, h4, h5, h6, td, th, dt, dd, blockquote, div, figcaption, summary";
    const blocks = new Map<Element, string>();
    const emoji: { text: string; el: string }[] = [];
    const tw = document.createTreeWalker(docEl, NodeFilter.SHOW_TEXT);
    for (let n = tw.nextNode(); n; n = tw.nextNode()) {
      const parent = n.parentElement;
      if (!parent) continue;
      const t = n.textContent ?? "";
      if (/\p{Extended_Pictographic}/u.test(t) && isShown(parent)) emoji.push({ text: norm(t).slice(0, 60), el: desc(parent) });
      if (parent.closest("pre, code, kbd, samp")) continue;
      const block = parent.closest(blockSel) ?? docEl;
      blocks.set(block, (blocks.get(block) ?? "") + t);
    }
    const literal: { block: string; match: string; el: string }[] = [];
    for (const [b, raw] of blocks) {
      const t = norm(raw);
      const found: string[] = [];
      const tex = t.match(/\\[A-Za-z]+/g);
      if (tex) found.push(...tex);
      if (t.includes("$$")) found.push("$$");
      if (/^#/.test(t) || /\n\s*#/.test(raw)) found.push("line-start #");
      if (t.includes("**")) found.push("**");
      if (t.includes("```")) found.push("```");
      if (found.length) literal.push({ block: t.slice(0, 80), match: found.join(", "), el: desc(b) });
    }
    const preOverflow = Array.from(docEl.querySelectorAll("pre")).map((p) => ({ el: desc(p), overflowX: getComputedStyle(p).overflowX }));
    const scrollBoxes: { el: string; clientHeight: number; scrollHeight: number; overflowY: string }[] = [];
    for (let e = docEl.parentElement; e && e !== document.body; e = e.parentElement) {
      const oy = getComputedStyle(e).overflowY;
      if ((oy === "auto" || oy === "scroll") && e.scrollHeight > e.clientHeight + 1) {
        scrollBoxes.push({ el: desc(e), clientHeight: e.clientHeight, scrollHeight: e.scrollHeight, overflowY: oy });
      }
    }
    docs = { literal, emoji, preOverflow, scrollBoxes };
  }

  // Scoreboard rows: gate chips and their names (X36).
  const scoreRows = Array.from(document.querySelectorAll("main table tbody tr")).map((tr) => {
    const best = new Map<number, string>();
    for (const el of Array.from(tr.querySelectorAll("*"))) {
      const name = accName(el);
      // No leading \b: adjacent chips concatenate ("G1 solvedG2 not solved…").
      const nums = new Set(Array.from(name.matchAll(/(?:[Gg]ate\s*|G)([1-4])(?![0-9])/g)).map((m) => Number(m[1])));
      if (nums.size !== 1) continue;
      const g = [...nums][0];
      if ((best.get(g) ?? "").length < name.length) best.set(g, name);
    }
    return { row: norm((tr as HTMLElement).innerText).slice(0, 120), chips: [...best].map(([gate, name]) => ({ gate, name })) };
  });

  return {
    path: location.pathname,
    innerWidth: vw,
    title: document.title,
    metaDescription: document.querySelector('meta[name="description"]')?.getAttribute("content") ?? null,
    viewportMeta: document.querySelector('meta[name="viewport"]')?.getAttribute("content") ?? null,
    iconHrefs: Array.from(document.querySelectorAll('link[rel~="icon"]')).map((l) => (l as HTMLLinkElement).href),
    bodyFontPx: Number.parseFloat(getComputedStyle(document.body).fontSize),
    bodyText: document.body.innerText,
    h1Texts: Array.from(document.querySelectorAll("h1")).filter(isShown).map((h) => norm(h.textContent)),
    liveCount: document.querySelectorAll("[aria-live], [role=status], [role=alert], [role=log]").length,
    buttons,
    multiPrimary,
    smallBlocks,
    primaryNav,
    innerNavClipping,
    overflowing,
    inputs,
    positiveTabindex,
    urlCopy,
    docs,
    scoreRows,
  };
}

// ---------------------------------------------------------------------------
// Observation (one fresh context and probe IP per page visit)
// ---------------------------------------------------------------------------

type LowContrast = PageSurvey["lowContrast"][number];
type ForcedState = "hover" | "active" | "focus-visible";
const FORCED_STATES: readonly ForcedState[] = ["hover", "active", "focus-visible"];

interface FocusStep {
  info: FocusInfo;
  domIndex: number;
}

interface ViewObs {
  path: ViewPath;
  viewport: ViewportName;
  survey: PageSurvey;
  probe: ViewProbe;
  /** Buttons whose accessible name is exactly "Copy" (Playwright role matching). */
  justCopy: number;
  /** Expected "Copy <label>" names and how many buttons match each. */
  expectedCopy: { name: string; count: number }[];
  /** Desktop only: the Tab sequence from page start. */
  focus: FocusStep[];
  /** Desktop only: low-contrast text with every control forced into a state. */
  forced: Partial<Record<ForcedState, LowContrast[]>>;
}

async function openContext(viewport: ViewportName): Promise<BrowserContext> {
  return newContext(ready(browser, "browser"), {
    baseUrl: ready(server, "server").baseUrl,
    ip: nextProbeIp(BLOCK),
    viewport,
    // Transitions finish instantly, so forced states and hovers read final colors.
    reducedMotion: "reduce",
  });
}

/**
 * Answers the first GET /api/scoreboard with the real envelope plus the X36
 * entry and holds every later GET. HEAD's loop (M-01) then parks in "loading"
 * after one extra request, and nothing reaches the server.
 */
async function stubScoreboard(context: BrowserContext): Promise<void> {
  const body = JSON.stringify(ready(scoreboardBody, "scoreboard body"));
  let served = 0;
  const held: Route[] = [];
  await context.route(
    (url) => url.pathname === "/api/scoreboard",
    async (route) => {
      if (route.request().method() !== "GET") return route.fallback();
      served++;
      if (served === 1) return route.fulfill({ status: 200, contentType: "application/json", body });
      held.push(route);
    },
  );
}

async function loadView(context: BrowserContext, path: string): Promise<Page> {
  if (path === "/scoreboard" || path === "/console") await stubScoreboard(context);
  const page = await context.newPage();
  const res = await gotoView(page, path);
  assert.equal(res?.status(), 200, `GET ${path} should return 200`);
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  if (path === "/scoreboard") {
    await page.locator("main table tbody tr").first().waitFor({ state: "visible", timeout: 10_000 }).catch(() => undefined);
  }
  await sleep(250);
  return page;
}

function expectedCopyNames(path: string): { name: string; re: RegExp }[] {
  if (path === "/") {
    return [
      { name: "Copy base URL", re: /^Copy base URL$/i },
      { name: "Copy skill.md URL", re: /^Copy skill\.md URL$/i },
    ];
  }
  if (path === "/docs") return [{ name: "Copy skill.md", re: /^Copy skill\.md$/i }];
  const m = /^\/gates\/([1-4])$/.exec(path);
  if (m) {
    return GATE_ENDPOINTS[Number(m[1])].map(([method, p]) => ({
      name: `Copy URL for ${method} ${p}`,
      re: new RegExp(`^Copy (URL for )?${method} ${escapeRe(p)}$`, "i"),
    }));
  }
  return [];
}

async function tabThrough(page: Page, maxSteps = 90): Promise<FocusStep[]> {
  const out: FocusStep[] = [];
  let firstKey: string | null = null;
  for (let i = 0; i < maxSteps; i++) {
    await page.keyboard.press("Tab");
    // Elements without a transition class get `transition: all 0.01ms` from the
    // reduced-motion backstop; let that finish before reading outline and ring.
    await page.evaluate(() => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))));
    await sleep(20);
    const info = await describeFocused(page);
    if (!info) break;
    const key = `${info.tag}#${info.id}|${info.name}`;
    if (firstKey === key) break;
    firstKey ??= key;
    const domIndex = await page.evaluate(() => Array.prototype.indexOf.call(document.querySelectorAll("*"), document.activeElement));
    out.push({ info, domIndex });
  }
  return out;
}

/** Forces each state on every control through CDP and re-runs the contrast survey. */
async function forcedLowContrast(page: Page): Promise<Partial<Record<ForcedState, LowContrast[]>>> {
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  const cdp = await page.context().newCDPSession(page);
  const out: Partial<Record<ForcedState, LowContrast[]>> = {};
  try {
    await cdp.send("DOM.enable");
    await cdp.send("CSS.enable");
    const { root } = await cdp.send("DOM.getDocument", { depth: -1 });
    const { nodeIds } = await cdp.send("DOM.querySelectorAll", {
      nodeId: root.nodeId,
      selector: "a[href], button, summary, input, textarea, select",
    });
    for (const state of FORCED_STATES) {
      for (const nodeId of nodeIds) await cdp.send("CSS.forcePseudoState", { nodeId, forcedPseudoClasses: [state] });
      await sleep(80);
      out[state] = (await surveyPage(page)).lowContrast.filter((l) => !l.disabled);
    }
    for (const nodeId of nodeIds) await cdp.send("CSS.forcePseudoState", { nodeId, forcedPseudoClasses: [] });
  } finally {
    await cdp.detach().catch(() => undefined);
  }
  return out;
}

const obsCache = new Map<string, Promise<ViewObs>>();

/** Memoized observation of one view at one viewport. */
function observe(path: ViewPath, viewport: ViewportName): Promise<ViewObs> {
  const key = `${path}|${viewport}`;
  let p = obsCache.get(key);
  if (!p) {
    p = (async (): Promise<ViewObs> => {
      const context = await openContext(viewport);
      try {
        const page = await loadView(context, path);
        const survey = await surveyPage(page);
        const probe = await page.evaluate(probeView);
        const justCopy = await page.getByRole("button", { name: "Copy", exact: true }).count();
        const expectedCopy: ViewObs["expectedCopy"] = [];
        for (const e of expectedCopyNames(path)) {
          expectedCopy.push({ name: e.name, count: await page.getByRole("button", { name: e.re }).count() });
        }
        let focus: FocusStep[] = [];
        let forced: ViewObs["forced"] = {};
        if (viewport === "desktop") {
          focus = await tabThrough(page);
          forced = await forcedLowContrast(page);
        }
        return { path, viewport, survey, probe, justCopy, expectedCopy, focus, forced };
      } finally {
        await context.close().catch(() => undefined);
      }
    })();
    obsCache.set(key, p);
  }
  return p;
}

async function observeAll(viewport: ViewportName, paths: readonly ViewPath[] = VIEW_PATHS): Promise<ViewObs[]> {
  const out: ViewObs[] = [];
  for (const path of paths) out.push(await observe(path, viewport));
  return out;
}

interface InstanceObs {
  gate: InstanceGateNumber;
  survey: PageSurvey;
  probe: ViewProbe;
  tryItText: string;
}

const instanceCache = new Map<number, Promise<InstanceObs>>();

/** Requests a real instance on /gates/N (one challenge GET on a fresh IP) and surveys the loaded panel. */
function observeInstance(gate: InstanceGateNumber): Promise<InstanceObs> {
  let p = instanceCache.get(gate);
  if (!p) {
    p = (async (): Promise<InstanceObs> => {
      const context = await openContext("desktop");
      try {
        const page = await loadView(context, `/gates/${gate}`);
        const panel = instancePanel(page);
        await panel.requestFirst.click();
        await panel.countdown.first().waitFor({ state: "visible", timeout: 15_000 });
        await sleep(300);
        const survey = await surveyPage(page);
        const probe = await page.evaluate(probeView);
        const tryItText = await panel.area.innerText();
        return { gate, survey, probe, tryItText };
      } finally {
        await context.close().catch(() => undefined);
      }
    })();
    instanceCache.set(gate, p);
  }
  return p;
}

interface DialogObs {
  regions: { inDialog: boolean; role: string | null; live: string | null; el: string; axIgnored: boolean | null; axReasons: string[] }[];
  unlabeled: string[];
}

let dialogObs: Promise<DialogObs> | undefined;

/** Opens the header flag dialog on / and lists the live regions and their AX status. */
function observeDialog(): Promise<DialogObs> {
  dialogObs ??= (async (): Promise<DialogObs> => {
    const context = await openContext("desktop");
    try {
      const page = await loadView(context, "/");
      await openFlagDialog(page);
      await sleep(200);
      const sel = "[aria-live], [role=status], [role=alert], [role=log]";
      const regions = await page.evaluate((s) => {
        const desc = (el: Element): string => {
          let d = el.tagName.toLowerCase();
          const cls = (el.getAttribute("class") || "").split(/\s+/).filter(Boolean).slice(0, 3).join(".");
          if (cls) d += "." + cls;
          return d;
        };
        return Array.from(document.querySelectorAll(s)).map((e) => ({
          inDialog: !!e.closest("dialog[open]"),
          role: e.getAttribute("role"),
          live: e.getAttribute("aria-live"),
          el: desc(e),
        }));
      }, sel);
      const withAx: DialogObs["regions"] = regions.map((r) => ({ ...r, axIgnored: null, axReasons: [] }));
      const cdp = await context.newCDPSession(page);
      try {
        await cdp.send("DOM.enable");
        await cdp.send("Accessibility.enable");
        const { root } = await cdp.send("DOM.getDocument", { depth: -1 });
        const { nodeIds } = await cdp.send("DOM.querySelectorAll", { nodeId: root.nodeId, selector: sel });
        for (let i = 0; i < nodeIds.length && i < withAx.length; i++) {
          const { nodes } = await cdp.send("Accessibility.getPartialAXTree", { nodeId: nodeIds[i], fetchRelatives: false });
          const n = nodes[0];
          if (n) {
            withAx[i].axIgnored = n.ignored;
            withAx[i].axReasons = (n.ignoredReasons ?? []).map((r) => r.name);
          }
        }
      } catch {
        // AX evidence is best effort; the DOM assertion decides.
      } finally {
        await cdp.detach().catch(() => undefined);
      }
      const survey = await surveyPage(page);
      return { regions: withAx, unlabeled: survey.unlabeled };
    } finally {
      await context.close().catch(() => undefined);
    }
  })();
  return dialogObs;
}

const tag = (o: { path: string; viewport: string }): string => `${o.path} @${o.viewport}`;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Property 1 (Bug Condition): rendered layout and semantics show no defect marker", () => {
  before(
    async () => {
      server = await ensureServer(PORT);
      browser = await launchBrowser();
      const real = await probeRequest<Record<string, unknown>>("GET", "/api/scoreboard", {
        ip: nextProbeIp(BLOCK),
        baseUrl: server.baseUrl,
      });
      assert.equal(real.status, 200, `GET /api/scoreboard returned ${real.status}: ${real.text.slice(0, 200)}`);
      assert.ok(real.json && Array.isArray(real.json.leaderboard), "GET /api/scoreboard has a leaderboard array");
      scoreboardBody = { ...real.json, leaderboard: [{ ...X36_ENTRY, lastSolveAt: Date.now() }], totalAgents: 1 };
    },
    { timeout: 120_000 },
  );

  after(async () => {
    await browser?.close().catch(() => undefined);
    await server?.stop();
  });

  // ---- X04 ---------------------------------------------------------------

  test("X04 (2.3, M-15): every visible button has a data-variant from the control set, at most one primary per section/form", TIMEOUT, async () => {
    const allowed = new Set(["primary", "secondary", "quiet", "ghost", "icon"]);
    const found: string[] = [];
    for (const o of await observeAll("desktop")) {
      const missing = o.probe.buttons.filter((b) => !b.variant || !allowed.has(b.variant));
      if (missing.length) {
        found.push(`${tag(o)}: ${missing.length} of ${o.probe.buttons.length} visible buttons lack data-variant (${missing.map((b) => JSON.stringify(b.name)).join(", ")})`);
      }
      for (const m of o.probe.multiPrimary) found.push(`${tag(o)}: ${m.container} holds ${m.count} primary controls (${m.names.join(", ")})`);
    }
    assertNone("X04", "buttons without data-variant, or more than one primary per container", found);
  });

  // ---- X06 ---------------------------------------------------------------

  test("X06 (2.4, M-07): p, li, label, and td are at least 14px on every view at 1280", TIMEOUT, async () => {
    const found: string[] = [];
    for (const o of await observeAll("desktop")) {
      for (const b of o.probe.smallBlocks) found.push(`${tag(o)}: ${b.tag} ${b.fs}px ${JSON.stringify(b.text)} (${b.el})`);
    }
    assertNone("X06/M-07", "block text below 14px", found);
  });

  test("X06 (2.4, M-10): heading sizes satisfy h1 > h2 > h3 > body on every view at 1280", TIMEOUT, async () => {
    const found: string[] = [];
    for (const o of await observeAll("desktop")) {
      const byLevel = new Map<number, { size: number; text: string }[]>();
      for (const h of o.survey.headings) {
        if (h.level > 3) continue;
        const list = byLevel.get(h.level) ?? [];
        list.push({ size: h.fontSizePx, text: h.text });
        byLevel.set(h.level, list);
      }
      const levels = [1, 2, 3].filter((l) => byLevel.has(l));
      for (let i = 0; i + 1 < levels.length; i++) {
        const hi = byLevel.get(levels[i]) ?? [];
        const lo = byLevel.get(levels[i + 1]) ?? [];
        const minHi = Math.min(...hi.map((h) => h.size));
        const maxLo = lo.reduce((a, h) => (h.size > a.size ? h : a), lo[0]);
        if (!(minHi > maxLo.size)) {
          found.push(`${tag(o)}: h${levels[i]} min ${minHi}px is not larger than h${levels[i + 1]} ${maxLo.size}px (${JSON.stringify(maxLo.text)})`);
        }
      }
      const deepest = levels[levels.length - 1];
      if (deepest !== undefined) {
        const minDeep = Math.min(...(byLevel.get(deepest) ?? []).map((h) => h.size));
        if (!(minDeep > o.probe.bodyFontPx)) found.push(`${tag(o)}: h${deepest} ${minDeep}px is not larger than body ${o.probe.bodyFontPx}px`);
      }
    }
    assertNone("X06/M-10", "heading size hierarchy broken", found);
  });

  test("X06 (2.4): at load no text is below 12px (outside /docs) and uppercase is limited to labels of 12 characters or fewer [regression guard, already fixed in 2516aa1]", TIMEOUT, async () => {
    const found: string[] = [];
    for (const o of await observeAll("desktop")) {
      if (o.path !== "/docs") {
        for (const b of o.survey.fonts.below12) found.push(`${tag(o)}: ${b.fs}px ${JSON.stringify(b.text)} (${b.el})`);
      }
      for (const u of o.survey.uppercase) {
        if (u.text.length > 12 && !/^AGENTGATE\b/.test(u.text)) found.push(`${tag(o)}: uppercase ${JSON.stringify(u.text)} (${u.el})`);
      }
      for (const h of o.survey.headings) {
        if (h.textTransform === "uppercase") found.push(`${tag(o)}: uppercase h${h.level} ${JSON.stringify(h.text)}`);
      }
    }
    assertNone("X06", "text below 12px or uppercase text at load", found);
  });

  test("X06 (2.4, M-06): instance panels of Gates 2 to 4 have no uppercase headings", TIMEOUT, async () => {
    const found: string[] = [];
    for (const gate of [2, 3, 4] as const) {
      const o = await observeInstance(gate);
      for (const h of o.survey.headings) {
        if (h.textTransform === "uppercase") found.push(`/gates/${gate} @desktop, instance loaded: h${h.level} ${JSON.stringify(h.text)} is text-transform: uppercase (${h.fontSizePx}px)`);
      }
      for (const u of o.survey.uppercase) {
        // Headings are reported above; this catches other long uppercase text.
        if (u.text.length > 12 && !/^h[1-6]\b/.test(u.el)) found.push(`/gates/${gate} @desktop, instance loaded: uppercase ${JSON.stringify(u.text)} (${u.el})`);
      }
    }
    assertNone("X06/M-06", "uppercase headings or long uppercase text in loaded instance panels", found);
  });

  test("X06 (2.4, R-30): instance panels of Gates 2 to 4 have no text below 12px", TIMEOUT, async () => {
    const found: string[] = [];
    for (const gate of [2, 3, 4] as const) {
      const o = await observeInstance(gate);
      for (const b of o.survey.fonts.below12) found.push(`/gates/${gate} @desktop, instance loaded: ${b.fs}px ${JSON.stringify(b.text)} (${b.el})`);
    }
    assertNone("X06/R-30", "text below 12px in loaded instance panels", found);
  });

  test("X06 (2.4, 2.9, M-05): the Gate 3 assignment hint does not say 60 booleans", TIMEOUT, async () => {
    const o = await observeInstance(3);
    const m = /[^.]*\b60 booleans\b[^.]*/i.exec(o.tryItText);
    const vars = /Variables:\s*(\d+)/i.exec(o.tryItText);
    assertNone("X06/M-05", "Gate 3 hint gives a stale variable count", m ? [`/gates/3 @desktop, instance loaded (Variables: ${vars?.[1] ?? "?"}): ${JSON.stringify(m[0].trim())}`] : []);
  });

  // ---- X07 / X08 -----------------------------------------------------------

  test("X07 (2.5): visible text meets 4.5:1 (3:1 large) on every view at 1280 and 360, scoreboard with an injected entry [regression guard, already fixed in 2516aa1]", TIMEOUT, async () => {
    const found: string[] = [];
    for (const vp of ["desktop", "mobile"] as const) {
      for (const o of await observeAll(vp)) {
        for (const l of o.survey.lowContrast) {
          if (!l.disabled) found.push(`${tag(o)}: ${l.ratio}:1 < ${l.need}:1 ${JSON.stringify(l.text)} (${l.el}, fg ${l.fg} on ${l.bg})`);
        }
      }
    }
    assertNone("X07", "text below its contrast threshold", found);
  });

  test("X07 (2.5): text keeps its contrast with every control forced into :hover, :active, and :focus-visible at 1280 [regression guard, already fixed in 2516aa1]", TIMEOUT, async () => {
    const found: string[] = [];
    for (const o of await observeAll("desktop")) {
      for (const state of FORCED_STATES) {
        for (const l of o.forced[state] ?? []) {
          found.push(`${tag(o)} :${state}: ${l.ratio}:1 < ${l.need}:1 ${JSON.stringify(l.text)} (${l.el}, fg ${l.fg} on ${l.bg})`);
        }
      }
      if (FORCED_STATES.some((s) => o.forced[s] === undefined)) found.push(`${tag(o)}: forced-state survey did not run`);
    }
    assertNone("X07", "text below its contrast threshold in a forced state", found);
  });

  test("X08 (2.5): the declared token pairs in globals.css meet their WCAG thresholds [regression guard, already fixed in 2516aa1]", () => {
    const tokens = parseColorTokens(readRepoFile("src/app/globals.css"));
    const text = 4.5;
    const nonText = 3;
    const pairs: [string, string, number][] = [
      ...["canvas", "surface", "inset", "surface-hover", "accent-subtle", "success-subtle", "error-subtle", "warning-subtle"].map((bg): [string, string, number] => ["fg", bg, text]),
      ...["canvas", "surface", "inset", "surface-hover", "success-subtle", "error-subtle", "warning-subtle"].map((bg): [string, string, number] => ["fg-secondary", bg, text]),
      ...["canvas", "surface", "inset", "surface-hover"].map((bg): [string, string, number] => ["fg-muted", bg, text]),
      ...["canvas", "surface", "inset", "surface-hover", "accent-subtle"].map((bg): [string, string, number] => ["accent", bg, text]),
      ["accent-hover", "canvas", text],
      ["accent-hover", "surface", text],
      ...["canvas", "surface", "inset", "success-subtle"].map((bg): [string, string, number] => ["success", bg, text]),
      ...["canvas", "surface", "inset", "error-subtle"].map((bg): [string, string, number] => ["error", bg, text]),
      ...["canvas", "surface", "inset", "warning-subtle"].map((bg): [string, string, number] => ["warning", bg, text]),
      ...["accent", "accent-hover", "accent-active"].map((bg): [string, string, number] => ["on-accent", bg, text]),
      ...["canvas", "surface", "inset", "surface-hover"].map((bg): [string, string, number] => ["line-control", bg, nonText]),
      ...["canvas", "surface", "inset", "surface-hover"].map((bg): [string, string, number] => ["focus", bg, nonText]),
    ];
    const found: string[] = [];
    for (const [fg, bg, need] of pairs) {
      let ratio: number;
      try {
        ratio = tokenContrast(tokens, fg, bg);
      } catch (err) {
        found.push(`${fg} on ${bg}: ${(err as Error).message}`);
        continue;
      }
      if (ratio < need) found.push(`${fg} on ${bg}: ${ratio.toFixed(2)}:1 < ${need}:1`);
    }
    assertNone("X08", "token pairs below threshold", found);
  });

  // ---- X09 / X20 -----------------------------------------------------------

  test("X09 (2.6, B-half): each Overview URL has an adjacent copy control [regression guard, already fixed in 2516aa1]", TIMEOUT, async () => {
    const o = await observe("/", "desktop");
    const found = o.probe.urlCopy.filter((u) => !u.found || u.buttons !== 1).map((u) => `${tag(o)}: ${u.url}: ${u.found ? `${u.buttons} copy controls next to it` : "no copy control next to it"}`);
    if (o.probe.urlCopy.length !== 2) found.push(`${tag(o)}: expected 2 URLs, probed ${o.probe.urlCopy.length}`);
    assertNone("X09", "Overview URL without an adjacent copy control", found);
  });

  test("X20 (2.17, R-39): copy controls are named \"Copy <label>\", never just \"Copy\"", TIMEOUT, async () => {
    const found: string[] = [];
    for (const o of await observeAll("desktop")) {
      if (o.justCopy > 0) found.push(`${tag(o)}: ${o.justCopy} button(s) with the accessible name "Copy"`);
      for (const e of o.expectedCopy) if (e.count === 0) found.push(`${tag(o)}: no button named ${JSON.stringify(e.name)}`);
    }
    assertNone("X20/R-39", "copy controls without a label in their accessible name", found);
  });

  // ---- X11 -----------------------------------------------------------------

  test("X11 (2.8, A14): gate pages name gates without \"(Hell)\" and show \"Difficulty: Hell\" exactly once", TIMEOUT, async () => {
    const found: string[] = [];
    for (const o of await observeAll("desktop", GATE_PATHS)) {
      if (/Hell/.test(o.probe.title)) found.push(`${tag(o)}: <title> ${JSON.stringify(o.probe.title)}`);
      for (const h of o.probe.h1Texts) if (/Hell/.test(h)) found.push(`${tag(o)}: h1 ${JSON.stringify(h)}`);
      const hellNames = o.probe.bodyText.match(/\(Hell\)/g)?.length ?? 0;
      if (hellNames) found.push(`${tag(o)}: "(Hell)" appears ${hellNames} times in the rendered text`);
      const tags = o.probe.bodyText.match(/Difficulty:\s*Hell/g)?.length ?? 0;
      if (tags !== 1) found.push(`${tag(o)}: "Difficulty: Hell" appears ${tags} times`);
    }
    assertNone("X11/A14", "gate pages with \"(Hell)\" names or without exactly one difficulty tag", found);
  });

  test("X11 (2.8, A14): the Overview shows \"Difficulty: Hell\" exactly once and no \"(Hell)\" names", TIMEOUT, async () => {
    const o = await observe("/", "desktop");
    const found: string[] = [];
    const hellNames = o.probe.bodyText.match(/\(Hell\)/g)?.length ?? 0;
    if (hellNames) found.push(`${tag(o)}: "(Hell)" appears ${hellNames} times in the rendered text`);
    const tags = o.probe.bodyText.match(/Difficulty:\s*Hell/g)?.length ?? 0;
    if (tags !== 1) found.push(`${tag(o)}: "Difficulty: Hell" appears ${tags} times`);
    assertNone("X11/A14", "Overview difficulty presentation", found);
  });

  // ---- X22 -----------------------------------------------------------------

  test("X22 (2.19): docs text outside pre and code has no literal TeX commands, $$, line-start #, ** or fences", TIMEOUT, async () => {
    const o = await observe("/docs", "desktop");
    const docs = o.probe.docs;
    assert.ok(docs, "/docs renders the skill.md document");
    assertNone("X22/R-46", "literal Markdown or TeX outside code", docs.literal.map((l) => `${tag(o)}: ${l.match} in ${JSON.stringify(l.block)} (${l.el})`));
  });

  test("X22 (2.19, A8, M-12): the rendered docs show no emoji", TIMEOUT, async () => {
    const o = await observe("/docs", "desktop");
    const docs = o.probe.docs;
    assert.ok(docs, "/docs renders the skill.md document");
    assertNone("X22/M-12", "emoji in the rendered document", docs.emoji.map((e) => `${tag(o)}: ${JSON.stringify(e.text)} (${e.el})`));
  });

  test("X22 (2.4, M-08): no docs text is below 12px", TIMEOUT, async () => {
    const found: string[] = [];
    for (const vp of ["desktop", "mobile"] as const) {
      const o = await observe("/docs", vp);
      for (const b of o.survey.fonts.below12) found.push(`${tag(o)}: ${b.fs}px ${JSON.stringify(b.text)} (${b.el})`);
    }
    assertNone("X22/M-08", "docs text below 12px", found);
  });

  test("X22 (2.31, M-19): docs links that open a new tab say so and set rel=\"noopener noreferrer\"", TIMEOUT, async () => {
    const o = await observe("/docs", "desktop");
    const found = o.survey.blankLinks
      .filter((l) => !/new tab/i.test(l.name) || !/\bnoopener\b/.test(l.rel ?? "") || !/\bnoreferrer\b/.test(l.rel ?? ""))
      .map((l) => `${tag(o)}: <a target=_blank href=${l.href}> named ${JSON.stringify(l.name)}, rel=${JSON.stringify(l.rel)}`);
    assertNone("X22/M-19", "new-tab links that don't say so", found);
  });

  test("X22 (2.19): docs code blocks scroll on their own and no ancestor is an inner scroll box [regression guard, already fixed in 2516aa1]", TIMEOUT, async () => {
    const found: string[] = [];
    for (const vp of ["desktop", "mobile"] as const) {
      const o = await observe("/docs", vp);
      const docs = o.probe.docs;
      if (!docs) {
        found.push(`${tag(o)}: no rendered document`);
        continue;
      }
      if (docs.preOverflow.length === 0) found.push(`${tag(o)}: no pre blocks found`);
      for (const p of docs.preOverflow) if (p.overflowX !== "auto" && p.overflowX !== "scroll") found.push(`${tag(o)}: ${p.el} overflow-x ${p.overflowX}`);
      for (const s of docs.scrollBoxes) found.push(`${tag(o)}: ancestor ${s.el} scrolls (${s.overflowY}, ${s.clientHeight}px of ${s.scrollHeight}px)`);
    }
    assertNone("X22", "docs scrolling layout", found);
  });

  // ---- X27 -----------------------------------------------------------------

  test("X27 (2.24): titles and descriptions are factual and the favicon differs from the Next.js default [regression guard, already fixed in 2516aa1]", TIMEOUT, async () => {
    const defaultIcon = createHash("sha256").update(gitShowBuffer(REF_BUG, "src/app/favicon.ico")).digest("hex");
    const found: string[] = [];
    const icons = new Set<string>();
    for (const o of await observeAll("desktop")) {
      if (o.probe.title.includes("//")) found.push(`${tag(o)}: <title> ${JSON.stringify(o.probe.title)} has "//"`);
      if (!o.probe.title.trim()) found.push(`${tag(o)}: empty <title>`);
      const d = o.probe.metaDescription ?? "";
      if (!d) found.push(`${tag(o)}: no meta description`);
      if (/premier|exclusively/i.test(d)) found.push(`${tag(o)}: description ${JSON.stringify(d)}`);
      if (o.probe.iconHrefs.length === 0) found.push(`${tag(o)}: no link rel=icon`);
      for (const h of o.probe.iconHrefs) icons.add(h);
    }
    const srv = ready(server, "server");
    for (const href of icons) {
      const res = await probeFetch(href, { ip: nextProbeIp(BLOCK), baseUrl: srv.baseUrl });
      const buf = Buffer.from(await res.arrayBuffer());
      if (res.status !== 200) found.push(`favicon ${href}: HTTP ${res.status}`);
      else if (createHash("sha256").update(buf).digest("hex") === defaultIcon) found.push(`favicon ${href}: same bytes as afe2537 src/app/favicon.ico (Next.js default)`);
    }
    assertNone("X27", "title, description, or favicon", found);
  });

  // ---- X31 -----------------------------------------------------------------

  test("X31 (2.28): at 200% zoom (640x450 @2x) no view scrolls sideways, nav links stay visible and unclipped, and the viewport allows zoom [regression guard, already fixed in 2516aa1]", TIMEOUT, async () => {
    const found: string[] = [];
    for (const o of await observeAll("zoom200")) {
      const w = o.probe.innerWidth;
      if (o.survey.docScrollWidth > w) found.push(`${tag(o)}: scrollWidth ${o.survey.docScrollWidth} > ${w}`);
      for (const l of o.survey.navLinks) {
        if (l.clipped || l.lines !== 1 || l.w <= 0 || l.left < 0 || l.left + l.w > w) {
          found.push(`${tag(o)}: nav link ${JSON.stringify(l.text)} lines=${l.lines} clipped=${l.clipped} left=${l.left} w=${l.w}`);
        }
      }
      const vm = o.probe.viewportMeta ?? "";
      if (/maximum-scale|user-scalable/i.test(vm)) found.push(`${tag(o)}: viewport meta ${JSON.stringify(vm)}`);
    }
    assertNone("X31", "zoom reflow", found);
  });

  // ---- X32 -----------------------------------------------------------------

  test("X32 (2.29, R-13): every element reached by Tab shows a 2px outline or ring with at least 3:1 contrast", TIMEOUT, async () => {
    const found: string[] = [];
    for (const o of await observeAll("desktop")) {
      if (o.focus.length === 0) found.push(`${tag(o)}: Tab reached no element`);
      for (const { info: f } of o.focus) {
        const outline = f.outlineStyle !== "none" && f.outlineWidthPx >= 2 && (f.outlineContrast ?? 0) >= 3;
        const ring = f.ring !== null && f.ring.spreadPx >= 2 && (f.ringContrast ?? 0) >= 3;
        if (!outline && !ring) {
          found.push(
            `${tag(o)}: ${f.tag}${f.id ? "#" + f.id : ""} ${JSON.stringify(f.name)} outline ${f.outlineStyle} ${f.outlineWidthPx}px (contrast ${f.outlineContrast}), ring ${f.ring ? `${f.ring.spreadPx}px (contrast ${f.ringContrast})` : "none"}`,
          );
        }
      }
    }
    assertNone("X32/R-13", "focused elements without a visible focus indicator", found);
  });

  test("X32 (2.29): Tab order follows DOM order and no element has a positive tabindex [regression guard, already fixed in 2516aa1]", TIMEOUT, async () => {
    const found: string[] = [];
    for (const o of await observeAll("desktop")) {
      for (const e of o.probe.positiveTabindex) found.push(`${tag(o)}: positive tabindex on ${e}`);
      for (let i = 1; i < o.focus.length; i++) {
        if (o.focus[i].domIndex <= o.focus[i - 1].domIndex) {
          found.push(`${tag(o)}: Tab ${i + 1} ${JSON.stringify(o.focus[i].info.name)} comes before Tab ${i} ${JSON.stringify(o.focus[i - 1].info.name)} in the DOM`);
        }
      }
    }
    assertNone("X32", "focus order", found);
  });

  // ---- X33 -----------------------------------------------------------------

  test("X33 (2.30): every input has a visible, associated label, including the open flag dialog [regression guard, already fixed in 2516aa1]", TIMEOUT, async () => {
    const found: string[] = [];
    for (const o of await observeAll("desktop")) {
      for (const u of o.survey.unlabeled) found.push(`${tag(o)}: unlabeled ${u}`);
      for (const i of o.probe.inputs) {
        if (![...i.labels, ...i.labelledby].some((l) => l.visible && l.text)) found.push(`${tag(o)}: ${i.el} has no visible label`);
      }
    }
    const d = await observeDialog();
    for (const u of d.unlabeled) found.push(`/ @desktop, flag dialog open: unlabeled ${u}`);
    assertNone("X33", "inputs without a visible label", found);
  });

  test("X33 (2.30, M-16, R-12): the console input is labelled \"Command\" with a described hint", TIMEOUT, async () => {
    const o = await observe("/console", "desktop");
    const found: string[] = [];
    if (o.probe.inputs.length !== 1) found.push(`${tag(o)}: expected 1 input, found ${o.probe.inputs.length}`);
    for (const i of o.probe.inputs) {
      const names = [...i.labels, ...i.labelledby].map((l) => l.text);
      if (!names.some((n) => /^Command$/i.test(n))) found.push(`${tag(o)}: ${i.el} label is ${JSON.stringify(names)}, not "Command"`);
      if (!i.describedby.some((d) => d.text && d.visible)) found.push(`${tag(o)}: ${i.el} has no aria-describedby hint (describedby ${JSON.stringify(i.describedby)})`);
    }
    assertNone("X33/M-16", "console input label", found);
  });

  test("X33 (2.30, 2.9, R-29): instance inputs of Gates 2 to 4 reference a visible format hint through aria-describedby", TIMEOUT, async () => {
    const found: string[] = [];
    for (const gate of [2, 3, 4] as const) {
      const o = await observeInstance(gate);
      const fields = o.probe.inputs.filter((i) => [...i.labels, ...i.labelledby].some((l) => /^(X\d+|Assignment|Key)/i.test(l.text)));
      if (fields.length === 0) found.push(`/gates/${gate} @desktop, instance loaded: no instance inputs found`);
      for (const i of fields) {
        const label = [...i.labels, ...i.labelledby].map((l) => l.text).join(" / ");
        if (!i.describedby.some((d) => d.text && d.visible) && !i.fieldsetDescribedby) {
          found.push(`/gates/${gate} @desktop, instance loaded: ${JSON.stringify(label)} (${i.el}) has no described hint`);
        }
      }
    }
    assertNone("X33/R-29", "instance inputs without a described format hint", found);
  });

  // ---- X34 -----------------------------------------------------------------

  test("X34 (2.31): header, nav, main, and footer are siblings, with one main and one h1 per view [regression guard, already fixed in 2516aa1]", TIMEOUT, async () => {
    const found: string[] = [];
    for (const vp of ["desktop", "mobile"] as const) {
      for (const o of await observeAll(vp)) {
        const l = o.survey.landmarks;
        if (!l.siblings) found.push(`${tag(o)}: landmarks not siblings (parents ${JSON.stringify(l.parents)})`);
        if (l.main !== 1) found.push(`${tag(o)}: ${l.main} main elements`);
        if (o.survey.h1 !== 1) found.push(`${tag(o)}: ${o.survey.h1} h1 elements`);
      }
    }
    assertNone("X34", "landmarks", found);
  });

  test("X34 (2.31, M-11): heading levels never skip", TIMEOUT, async () => {
    const found: string[] = [];
    for (const vp of ["desktop", "mobile"] as const) {
      for (const o of await observeAll(vp)) for (const s of o.survey.skips) found.push(`${tag(o)}: ${s}`);
    }
    assertNone("X34/M-11", "skipped heading levels", found);
  });

  test("X34 (2.31): new-tab links outside /docs say so and set rel=\"noopener noreferrer\" [regression guard, already fixed in 2516aa1]", TIMEOUT, async () => {
    const found: string[] = [];
    for (const o of await observeAll("desktop")) {
      if (o.path === "/docs") continue; // covered by X22/M-19
      for (const l of o.survey.blankLinks) {
        if (!/new tab/i.test(l.name) || !/\bnoopener\b/.test(l.rel ?? "") || !/\bnoreferrer\b/.test(l.rel ?? "")) {
          found.push(`${tag(o)}: <a target=_blank href=${l.href}> named ${JSON.stringify(l.name)}, rel=${JSON.stringify(l.rel)}`);
        }
      }
    }
    assertNone("X34", "new-tab links", found);
  });

  // ---- X35 / R-37 ----------------------------------------------------------

  test("X35 (2.32): every view has a live region at load [regression guard, already fixed in 2516aa1]", TIMEOUT, async () => {
    const found: string[] = [];
    for (const o of await observeAll("desktop")) if (o.probe.liveCount < 1) found.push(`${tag(o)}: no live region at load`);
    assertNone("X35", "views without a live region", found);
  });

  test("R-37 (2.32, likely): the open flag dialog contains a live region of its own", TIMEOUT, async () => {
    const d = await observeDialog();
    const inside = d.regions.filter((r) => r.inDialog);
    const outside = d.regions
      .filter((r) => !r.inDialog)
      .map((r) => `${r.el} role=${r.role} aria-live=${r.live}, AX ignored=${r.axIgnored}${r.axReasons.length ? ` (${r.axReasons.join(", ")})` : ""}`);
    assertNone(
      "R-37",
      "live regions while the modal flag dialog is open",
      inside.length > 0 ? [] : [`/ @desktop, flag dialog open: 0 live regions inside the dialog; outside it: ${outside.join("; ") || "none"}`],
    );
  });

  // ---- X36 -----------------------------------------------------------------

  test("X36 (2.33): solved and unsolved gates differ in text, and the current view is marked with aria-current [regression guard, already fixed in 2516aa1]", TIMEOUT, async () => {
    const found: string[] = [];
    const sb = await observe("/scoreboard", "desktop");
    const row = sb.probe.scoreRows.find((r) => r.row.includes(X36_ENTRY.agentName));
    if (!row) found.push(`${tag(sb)}: injected row ${X36_ENTRY.agentName} not rendered (rows ${JSON.stringify(sb.probe.scoreRows.map((r) => r.row))})`);
    else {
      const status = (g: number): string | undefined => row.chips.find((c) => c.gate === g)?.name.replace(/(?:[Gg]ate\s*|G)[1-4](?![0-9])/g, "#").trim();
      const s = [1, 2, 3, 4].map(status);
      if (s.some((x) => x === undefined)) found.push(`${tag(sb)}: gate cells not found (chips ${JSON.stringify(row.chips)})`);
      else if (s[0] !== s[2] || s[1] !== s[3] || s[0] === s[1]) found.push(`${tag(sb)}: solved [1,3] vs unsolved [2,4] read ${JSON.stringify(row.chips)}`);
    }
    for (const o of await observeAll("desktop")) {
      const current = o.survey.navLinks.filter((l) => l.ariaCurrent !== null && l.ariaCurrent !== "false");
      const want = navLabelFor(o.path);
      if (current.length !== 1 || current[0].text !== want) found.push(`${tag(o)}: aria-current on ${JSON.stringify(current.map((c) => c.text))}, expected ${JSON.stringify(want)}`);
    }
    assertNone("X36", "status conveyed by color alone", found);
  });

  // ---- X37 -----------------------------------------------------------------

  test("X37 (2.34): at 360px no view scrolls sideways, nav labels sit on one line without overlap, and nothing extends past the edge [regression guard, already fixed in 2516aa1]", TIMEOUT, async () => {
    const found: string[] = [];
    for (const o of await observeAll("mobile")) {
      const w = o.probe.innerWidth;
      if (o.survey.docScrollWidth > w) found.push(`${tag(o)}: scrollWidth ${o.survey.docScrollWidth} > ${w}`);
      for (const l of o.survey.navLinks) if (l.lines !== 1 || l.clipped) found.push(`${tag(o)}: nav label ${JSON.stringify(l.text)} lines=${l.lines} clipped=${l.clipped}`);
      const links = o.probe.primaryNav.links;
      for (let i = 0; i < links.length; i++) {
        for (let j = i + 1; j < links.length; j++) {
          const a = links[i].rect;
          const b = links[j].rect;
          const ox = Math.min(a.right, b.right) - Math.max(a.left, b.left);
          const oy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
          if (ox > 0.5 && oy > 0.5) found.push(`${tag(o)}: nav links ${JSON.stringify(links[i].text)} and ${JSON.stringify(links[j].text)} overlap`);
        }
      }
      for (const e of o.probe.overflowing) found.push(`${tag(o)}: ${e.el} spans ${e.left}..${e.right} ${JSON.stringify(e.text)}`);
    }
    assertNone("X37", "360px layout", found);
  });

  test("X37 (2.34, M-03): at 360px every primary nav link stays inside the nav bar and clear of main", TIMEOUT, async () => {
    const found: string[] = [];
    for (const o of await observeAll("mobile")) {
      const { nav, main, links } = o.probe.primaryNav;
      if (!nav || !main) {
        found.push(`${tag(o)}: primary nav or main not found`);
        continue;
      }
      for (const l of links) {
        const outside = l.rect.bottom > nav.bottom + 0.5 || l.rect.top < nav.top - 0.5;
        const overMain = l.rect.bottom > main.top + 0.5 && l.rect.top < main.bottom;
        if (outside || overMain) {
          found.push(`${tag(o)}: ${JSON.stringify(l.text)} spans y ${l.rect.top}..${l.rect.bottom} (w ${l.rect.width}); nav bar y ${nav.top}..${nav.bottom}; main starts at y ${main.top}`);
        }
      }
    }
    assertNone("X37/M-03", "primary nav links outside the bar or over main", found);
  });

  test("X37 (2.34, R-33, likely): gate stepper and pager labels are not clipped at 360px and 640px", TIMEOUT, async () => {
    const found: string[] = [];
    for (const vp of ["mobile", "zoom200"] as const) {
      for (const o of await observeAll(vp, GATE_PATHS)) {
        for (const c of o.probe.innerNavClipping) found.push(`${tag(o)}: [${c.nav}] ${JSON.stringify(c.link)} ${c.el} scrollWidth ${c.scrollWidth} > clientWidth ${c.clientWidth}`);
      }
    }
    assertNone("X37/R-33", "clipped gate navigation labels", found);
  });
});
