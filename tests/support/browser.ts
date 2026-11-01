// Browser helpers on playwright-core, driving the installed Chrome.
//
// Launch uses `channel: "chrome"` or `executablePath` from CHROME_PATH; no
// browser is downloaded. Every context sends the probe IP as
// `cf-connecting-ip`, uses a localhost baseURL, and aborts any request to a
// non-localhost host, so a page can never reach ctf.hakudigital.tech.

import { chromium } from "playwright-core";
import type { Browser, BrowserContext, BrowserContextOptions, LaunchOptions, Locator, Page, Request, Response, Route } from "playwright-core";
import { assertLocalUrl, assertProbeIp, isLocalUrl, poll, sleep } from "./server.ts";

export { poll, sleep };

// ---------------------------------------------------------------------------
// Launch
// ---------------------------------------------------------------------------

export const DEFAULT_CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

export interface LaunchBrowserOptions {
  /** Default true. */
  headless?: boolean;
  /** Extra Chrome flags. */
  args?: string[];
}

/**
 * Launches the installed Chrome. Uses CHROME_PATH as `executablePath` when set,
 * otherwise `channel: "chrome"`. Fails (never skips) with a message naming
 * CHROME_PATH when Chrome can't be started.
 */
export async function launchBrowser(options: LaunchBrowserOptions = {}): Promise<Browser> {
  const executablePath = process.env.CHROME_PATH;
  const launchOptions: LaunchOptions = {
    headless: options.headless ?? true,
    args: ["--autoplay-policy=no-user-gesture-required", ...(options.args ?? [])],
  };
  if (executablePath) launchOptions.executablePath = executablePath;
  else launchOptions.channel = "chrome";
  try {
    return await chromium.launch(launchOptions);
  } catch (err) {
    const how = executablePath ? `CHROME_PATH=${executablePath}` : 'channel "chrome" (CHROME_PATH not set)';
    throw new Error(
      `Could not launch Chrome with ${how}. Install Google Chrome or set CHROME_PATH to chrome.exe ` +
        `(default ${DEFAULT_CHROME_PATH}). Cause: ${(err as Error).message}`,
    );
  }
}

// ---------------------------------------------------------------------------
// Contexts
// ---------------------------------------------------------------------------

/** The three viewports from the design's glossary. */
export const VIEWPORTS = Object.freeze({
  desktop: { width: 1280, height: 900, deviceScaleFactor: 1, isMobile: false, hasTouch: false },
  /** 360x780 mobile emulation (meta viewport honored, touch on). */
  mobile: { width: 360, height: 780, deviceScaleFactor: 1, isMobile: true, hasTouch: true },
  /** 640x450 at device scale 2, equal to 1280x900 at 200% zoom. */
  zoom200: { width: 640, height: 450, deviceScaleFactor: 2, isMobile: false, hasTouch: false },
} as const);

export type ViewportName = keyof typeof VIEWPORTS;

export interface ContextOptions {
  /** Server origin, e.g. handle.baseUrl. Must be localhost. Used as baseURL. */
  baseUrl: string;
  /** Probe IP, sent as `cf-connecting-ip` on every request (extraHTTPHeaders). */
  ip: string;
  /** Default "desktop". */
  viewport?: ViewportName;
  /** Default "no-preference". Change later with setReducedMotion(page, ...). */
  reducedMotion?: "reduce" | "no-preference";
  /** Granted for baseUrl's origin, e.g. ["clipboard-read", "clipboard-write"]. */
  permissions?: string[];
  /** Install the recorder init script (audio, scroll, live regions, canvases). Default true. */
  recorders?: boolean;
  /** Extra Playwright context options (merged last). */
  extra?: BrowserContextOptions;
}

const blockedByContext = new WeakMap<BrowserContext, string[]>();

/**
 * New context bound to one server and one probe IP. Non-localhost requests
 * are aborted and listed by blockedRequests(context).
 */
export async function newContext(browser: Browser, options: ContextOptions): Promise<BrowserContext> {
  const origin = assertLocalUrl(options.baseUrl).origin;
  assertProbeIp(options.ip);
  const vp = VIEWPORTS[options.viewport ?? "desktop"];
  const context = await browser.newContext({
    baseURL: origin,
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: vp.deviceScaleFactor,
    isMobile: vp.isMobile,
    hasTouch: vp.hasTouch,
    reducedMotion: options.reducedMotion ?? "no-preference",
    extraHTTPHeaders: { "cf-connecting-ip": options.ip },
    locale: "en-US",
    ...options.extra,
  });
  const blocked: string[] = [];
  blockedByContext.set(context, blocked);
  await context.route(
    (url) => !isLocalUrl(url),
    async (route) => {
      blocked.push(route.request().url());
      await route.abort("blockedbyclient");
    },
  );
  if (options.permissions?.length) await context.grantPermissions(options.permissions, { origin });
  if (options.recorders ?? true) await installRecorders(context);
  return context;
}

/** Non-localhost URLs this context tried to load (all were aborted). */
export function blockedRequests(context: BrowserContext): readonly string[] {
  return blockedByContext.get(context) ?? [];
}

export interface Session {
  browser: Browser;
  context: BrowserContext;
  page: Page;
  /** Closes the context, and the browser if this session launched it. */
  close(): Promise<void>;
}

/** Launches Chrome (unless `browser` is given), creates a context and one page. */
export async function openSession(options: ContextOptions & { browser?: Browser }): Promise<Session> {
  const ownBrowser = !options.browser;
  const browser = options.browser ?? (await launchBrowser());
  const context = await newContext(browser, options);
  const page = await context.newPage();
  return {
    browser,
    context,
    page,
    async close() {
      await context.close().catch(() => undefined);
      if (ownBrowser) await browser.close().catch(() => undefined);
    },
  };
}

// ---------------------------------------------------------------------------
// Navigation
// ---------------------------------------------------------------------------

/**
 * Waits until React has hydrated: document complete and every light-DOM
 * a[href], button, input, textarea, and select carries React's props key.
 */
export async function waitForHydration(page: Page, timeoutMs = 15_000): Promise<void> {
  try {
    await page.waitForFunction(
      () => {
        if (document.readyState !== "complete") return false;
        const els = Array.from(document.querySelectorAll("a[href], button, input, textarea, select"));
        if (els.length === 0) return false;
        return els.every((el) => Object.keys(el).some((k) => k.startsWith("__reactProps$")));
      },
      undefined,
      { timeout: timeoutMs, polling: 100 },
    );
  } catch (err) {
    const stats = await page
      .evaluate(() => {
        const els = Array.from(document.querySelectorAll("a[href], button, input, textarea, select"));
        const done = els.filter((el) => Object.keys(el).some((k) => k.startsWith("__reactProps$"))).length;
        return `${done} of ${els.length} interactive elements hydrated, readyState=${document.readyState}`;
      })
      .catch(() => "page unavailable");
    throw new Error(`Page ${page.url()} did not hydrate within ${timeoutMs} ms (${stats}): ${(err as Error).message}`);
  }
}

export interface GotoOptions {
  /** Wait for hydration after load. Default true. */
  hydrate?: boolean;
  timeoutMs?: number;
}

/**
 * Navigates to a path on the context's baseURL, waits for "load" (never
 * "networkidle": HEAD's scoreboard refetch loop never goes idle), then for
 * hydration. Returns the navigation response (check `.status()` for 404s).
 */
export async function gotoView(page: Page, path: string, options: GotoOptions = {}): Promise<Response | null> {
  const res = await page.goto(path, { waitUntil: "load", timeout: options.timeoutMs ?? 30_000 });
  if (options.hydrate ?? true) await waitForHydration(page, options.timeoutMs ?? 15_000);
  return res;
}

/** New page in `context`, navigated with gotoView. */
export async function openView(context: BrowserContext, path: string, options: GotoOptions = {}): Promise<Page> {
  const page = await context.newPage();
  await gotoView(page, path, options);
  return page;
}

/** Path part of the page's current URL. */
export function currentPath(page: Page): string {
  return new URL(page.url()).pathname;
}

// ---------------------------------------------------------------------------
// Recorders (init script)
// ---------------------------------------------------------------------------

export interface LiveRecord {
  /** Date.now() when the text was seen. */
  at: number;
  /** Stable id of the live region element (per document). */
  regionId: number;
  /** Date.now() when the region element was first seen. */
  regionSeenAt: number;
  role: string | null;
  live: string | null;
  label: string | null;
  text: string;
}

export interface ScrollRecord {
  at: number;
  fn: "scrollIntoView" | "scrollTo" | "scroll" | "scrollBy";
  /** "window" or the element's lowercase tag name. */
  target: string;
  /** The `behavior` option passed, or null when none was passed. */
  behavior: string | null;
}

export interface Recorders {
  /** Date.now() when the init script ran for this document. */
  installedAt: number;
  audio: {
    /** `new AudioContext()` / `new webkitAudioContext()` calls. */
    contexts: number;
    /** createOscillator() calls plus `new OscillatorNode()` calls. */
    oscillators: number;
  };
  scrolls: ScrollRecord[];
  live: LiveRecord[];
  /** <canvas> elements added to the document after the init script ran. */
  canvasesAdded: number;
}

/** Runs in the page before any page script. Must be self-contained. */
function recordersInit(): void {
  type Rec = {
    installedAt: number;
    audio: { contexts: number; oscillators: number };
    scrolls: { at: number; fn: string; target: string; behavior: string | null }[];
    live: { at: number; regionId: number; regionSeenAt: number; role: string | null; live: string | null; label: string | null; text: string }[];
    canvasesAdded: number;
  };
  const w = window as unknown as Record<string, unknown> & { __agTest?: Rec };
  if (w.__agTest) return;
  const rec: Rec = { installedAt: Date.now(), audio: { contexts: 0, oscillators: 0 }, scrolls: [], live: [], canvasesAdded: 0 };
  w.__agTest = rec;

  // Audio: count contexts and oscillators.
  try {
    const BAC = (window as unknown as { BaseAudioContext?: { prototype: { createOscillator?: (...a: unknown[]) => unknown } } }).BaseAudioContext;
    const patchProto = (proto: { createOscillator?: (...a: unknown[]) => unknown } | undefined): void => {
      if (!proto || typeof proto.createOscillator !== "function" || (proto.createOscillator as { __ag?: boolean }).__ag) return;
      const orig = proto.createOscillator;
      const patched = function (this: unknown, ...a: unknown[]): unknown {
        rec.audio.oscillators++;
        return orig.apply(this, a);
      };
      (patched as { __ag?: boolean }).__ag = true;
      proto.createOscillator = patched;
    };
    patchProto(BAC?.prototype);
    for (const name of ["AudioContext", "webkitAudioContext"]) {
      const C = w[name] as (new (...a: unknown[]) => object) | undefined;
      if (typeof C !== "function") continue;
      patchProto((C as unknown as { prototype: { createOscillator?: (...a: unknown[]) => unknown } }).prototype);
      const Wrapped = class extends C {
        constructor(...a: unknown[]) {
          super(...a);
          rec.audio.contexts++;
        }
      };
      Object.defineProperty(window, name, { value: Wrapped, configurable: true, writable: true });
    }
    const ON = w.OscillatorNode as (new (...a: unknown[]) => object) | undefined;
    if (typeof ON === "function") {
      const WrappedNode = class extends ON {
        constructor(...a: unknown[]) {
          super(...a);
          rec.audio.oscillators++;
        }
      };
      Object.defineProperty(window, "OscillatorNode", { value: WrappedNode, configurable: true, writable: true });
    }
  } catch {
    // audio APIs unavailable
  }

  // Scroll calls: record the behavior option.
  const behaviorOf = (arg: unknown): string | null =>
    arg && typeof arg === "object" && "behavior" in arg ? String((arg as { behavior?: unknown }).behavior ?? null) : null;
  const elementProto = Element.prototype as unknown as Record<string, (...a: unknown[]) => unknown>;
  for (const fn of ["scrollIntoView", "scrollTo", "scroll", "scrollBy"]) {
    const orig = elementProto[fn];
    if (typeof orig !== "function") continue;
    elementProto[fn] = function (this: Element, ...a: unknown[]): unknown {
      rec.scrolls.push({ at: Date.now(), fn, target: this.tagName.toLowerCase(), behavior: behaviorOf(a[0]) });
      return orig.apply(this, a);
    };
  }
  const win = window as unknown as Record<string, (...a: unknown[]) => unknown>;
  for (const fn of ["scrollTo", "scroll", "scrollBy"]) {
    const orig = win[fn];
    if (typeof orig !== "function") continue;
    win[fn] = function (...a: unknown[]): unknown {
      rec.scrolls.push({ at: Date.now(), fn, target: "window", behavior: behaviorOf(a[0]) });
      return orig.apply(window, a);
    };
  }

  // Live regions and added canvases.
  const ids = new WeakMap<Element, { id: number; seenAt: number; last: string }>();
  let nextId = 1;
  const scan = (): void => {
    for (const el of Array.from(document.querySelectorAll("[aria-live], [role=status], [role=alert], [role=log]"))) {
      let info = ids.get(el);
      if (!info) {
        info = { id: nextId++, seenAt: Date.now(), last: "" };
        ids.set(el, info);
      }
      const text = (el.textContent ?? "").replace(/\s+/g, " ").trim();
      if (text !== info.last) {
        info.last = text;
        if (text) {
          rec.live.push({
            at: Date.now(),
            regionId: info.id,
            regionSeenAt: info.seenAt,
            role: el.getAttribute("role"),
            live: el.getAttribute("aria-live"),
            label: el.getAttribute("aria-label"),
            text: text.slice(0, 500),
          });
        }
      }
    }
  };
  const observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      for (const n of Array.from(m.addedNodes)) {
        if (n.nodeType !== 1) continue;
        const el = n as Element;
        if (el.tagName === "CANVAS") rec.canvasesAdded++;
        rec.canvasesAdded += el.querySelectorAll("canvas").length;
      }
    }
    scan();
  });
  observer.observe(document, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["aria-live", "role"] });
  document.addEventListener("DOMContentLoaded", scan);
}

/** Adds the recorder init script to a context or page (newContext does this by default). */
export async function installRecorders(target: BrowserContext | Page): Promise<void> {
  await target.addInitScript(recordersInit);
}

/** Snapshot of the current document's recorders. Throws if they aren't installed. */
export async function readRecorders(page: Page): Promise<Recorders> {
  const r = await page.evaluate(() => {
    const rec = (window as unknown as { __agTest?: unknown }).__agTest;
    return rec ? JSON.parse(JSON.stringify(rec)) : null;
  });
  if (!r) throw new Error("Recorders are not installed in this page (newContext({ recorders: true }) or installRecorders())");
  return r as Recorders;
}

/** Clears the recorded scrolls, live records, and counters (keeps region ids). */
export async function resetRecorders(page: Page): Promise<void> {
  await page.evaluate(() => {
    const rec = (window as unknown as { __agTest?: { audio: { contexts: number; oscillators: number }; scrolls: unknown[]; live: unknown[]; canvasesAdded: number } }).__agTest;
    if (!rec) return;
    rec.audio.contexts = 0;
    rec.audio.oscillators = 0;
    rec.scrolls.length = 0;
    rec.live.length = 0;
    rec.canvasesAdded = 0;
  });
}

// ---------------------------------------------------------------------------
// Request log
// ---------------------------------------------------------------------------

export interface ApiRequest {
  at: number;
  method: string;
  /** URL pathname, e.g. /api/scoreboard. */
  path: string;
  url: string;
  postData: string | null;
  headers: Record<string, string>;
  /** Filled in when the response arrives. */
  status: number | null;
  /** True when the request failed or was aborted. */
  failed: boolean;
}

export interface ApiRequestLog {
  readonly entries: readonly ApiRequest[];
  /** Number of logged requests, optionally filtered by method and exact path. */
  count(method?: string, path?: string): number;
  /** Entries filtered by method and exact path. */
  filter(method?: string, path?: string): ApiRequest[];
  clear(): void;
  dispose(): void;
}

/**
 * Logs every request whose path starts with /api/ (RSC `_rsc` prefetches are
 * ignored). Attach before the action you want to count.
 */
export function logApiRequests(page: Page): ApiRequestLog {
  const entries: ApiRequest[] = [];
  const byRequest = new Map<Request, ApiRequest>();
  const onRequest = (req: Request): void => {
    const url = new URL(req.url());
    if (!url.pathname.startsWith("/api/") || url.searchParams.has("_rsc")) return;
    const entry: ApiRequest = {
      at: Date.now(),
      method: req.method(),
      path: url.pathname,
      url: req.url(),
      postData: req.postData(),
      headers: req.headers(),
      status: null,
      failed: false,
    };
    entries.push(entry);
    byRequest.set(req, entry);
  };
  const onResponse = (res: Response): void => {
    const e = byRequest.get(res.request());
    if (e) e.status = res.status();
  };
  const onFailed = (req: Request): void => {
    const e = byRequest.get(req);
    if (e) e.failed = true;
  };
  page.on("request", onRequest);
  page.on("response", onResponse);
  page.on("requestfailed", onFailed);
  const match = (e: ApiRequest, method?: string, path?: string): boolean =>
    (!method || e.method === method.toUpperCase()) && (!path || e.path === path);
  return {
    entries,
    count: (method, path) => entries.filter((e) => match(e, method, path)).length,
    filter: (method, path) => entries.filter((e) => match(e, method, path)),
    clear: () => {
      entries.length = 0;
      byRequest.clear();
    },
    dispose: () => {
      page.off("request", onRequest);
      page.off("response", onResponse);
      page.off("requestfailed", onFailed);
    },
  };
}

// ---------------------------------------------------------------------------
// Interception (page.route)
// ---------------------------------------------------------------------------

export interface ApiRouteSpec {
  /** Exact URL pathname, e.g. "/api/gate2/challenge". */
  path: string;
  /** Only this method is intercepted; others fall through. Default: all methods. */
  method?: string;
  /** Intercept only the first N matching requests; later ones fall through. Default: all. */
  times?: number;
}

export interface RouteControl {
  /** Matching requests intercepted so far. */
  hits(): number;
  readonly requests: readonly Request[];
  /** Removes the route. */
  dispose(): Promise<void>;
}

type RouteTarget = Page | BrowserContext;

async function installApiRoute(
  target: RouteTarget,
  spec: ApiRouteSpec,
  act: (route: Route, request: Request) => Promise<void>,
): Promise<RouteControl> {
  const matcher = (url: URL): boolean => url.pathname === spec.path;
  const requests: Request[] = [];
  const handler = async (route: Route, request: Request): Promise<void> => {
    if (spec.method && request.method() !== spec.method.toUpperCase()) return route.fallback();
    if (spec.times !== undefined && requests.length >= spec.times) return route.fallback();
    requests.push(request);
    try {
      await act(route, request);
    } catch (err) {
      // The page may have navigated or closed while the request was held.
      if (!/closed|Target|navigat|already handled/i.test((err as Error).message)) throw err;
    }
  };
  await (target as Page).route(matcher, handler);
  return {
    hits: () => requests.length,
    requests,
    dispose: () => (target as Page).unroute(matcher, handler),
  };
}

export interface FulfillSpec extends ApiRouteSpec {
  status: number;
  /** JSON body (serialized). Use bodies from api-contract.json, never invented ones. */
  json?: unknown;
  /** Raw body, used when `json` is absent. */
  body?: string;
  /** Default "application/json". */
  contentType?: string;
  headers?: Record<string, string>;
}

/** Answers matching requests with a fixed response; they never reach the server. */
export function fulfillApi(target: RouteTarget, spec: FulfillSpec): Promise<RouteControl> {
  return installApiRoute(target, spec, (route) =>
    route.fulfill({
      status: spec.status,
      contentType: spec.contentType ?? "application/json",
      headers: spec.headers,
      body: spec.json !== undefined ? JSON.stringify(spec.json) : (spec.body ?? ""),
    }),
  );
}

/** Fails matching requests with a network error. Default "internetdisconnected". */
export function abortApi(target: RouteTarget, spec: ApiRouteSpec & { errorCode?: string }): Promise<RouteControl> {
  return installApiRoute(target, spec, (route) => route.abort(spec.errorCode ?? "internetdisconnected"));
}

/**
 * Holds matching requests for `ms` (default 1500), then sends them to the
 * server, or answers with `then` when given.
 */
export function holdApi(
  target: RouteTarget,
  spec: ApiRouteSpec & { ms?: number; then?: Omit<FulfillSpec, keyof ApiRouteSpec> },
): Promise<RouteControl> {
  return installApiRoute(target, spec, async (route) => {
    await sleep(spec.ms ?? 1_500);
    if (spec.then) {
      await route.fulfill({
        status: spec.then.status,
        contentType: spec.then.contentType ?? "application/json",
        headers: spec.then.headers,
        body: spec.then.json !== undefined ? JSON.stringify(spec.then.json) : (spec.then.body ?? ""),
      });
    } else {
      await route.continue();
    }
  });
}

// ---------------------------------------------------------------------------
// Media, clipboard, pointer states
// ---------------------------------------------------------------------------

/** Emulates prefers-reduced-motion for the page. */
export async function setReducedMotion(page: Page, value: "reduce" | "no-preference" = "reduce"): Promise<void> {
  await page.emulateMedia({ reducedMotion: value });
}

/** Grants clipboard-read and clipboard-write for the server origin. */
export async function grantClipboard(context: BrowserContext, baseUrl: string): Promise<void> {
  await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: assertLocalUrl(baseUrl).origin });
}

/** navigator.clipboard.readText() in the page (needs grantClipboard). */
export async function readClipboard(page: Page): Promise<string> {
  return page.evaluate(() => navigator.clipboard.readText());
}

/**
 * Makes navigator.clipboard.writeText (and write) reject with NotAllowedError,
 * standing in for a denied clipboard-write permission (Chrome grants it by
 * default on localhost, and Playwright can't deny a permission). Applies to
 * the current document and, for a context, to every later one.
 */
export async function failClipboardWrites(target: Page | BrowserContext): Promise<void> {
  const script = (): void => {
    const deny = (): Promise<never> => Promise.reject(new DOMException("Write permission denied.", "NotAllowedError"));
    for (const name of ["writeText", "write"]) {
      Object.defineProperty(Clipboard.prototype, name, { value: deny, configurable: true, writable: true });
    }
  };
  await target.addInitScript(script);
  if ("goto" in target) await target.evaluate(script);
}

/** Hovers `locator`, presses the mouse, and returns a function that releases it (forced :active). */
export async function holdActive(page: Page, locator: Locator): Promise<() => Promise<void>> {
  await locator.hover();
  await page.mouse.down();
  return () => page.mouse.up();
}

/** innerText with whitespace collapsed and trimmed. */
export async function textOf(locator: Locator): Promise<string> {
  return (await locator.innerText()).replace(/\s+/g, " ").trim();
}

// ---------------------------------------------------------------------------
// Focus
// ---------------------------------------------------------------------------

export interface FocusInfo {
  tag: string;
  id: string;
  role: string | null;
  /** aria-label, else aria-labelledby text, else trimmed text content (60 chars). */
  name: string;
  tabIndex: number;
  outlineStyle: string;
  outlineWidthPx: number;
  outlineColor: string;
  outlineOffsetPx: number;
  boxShadow: string;
  /** Widest non-inset, non-transparent box-shadow with spread > 0 (a Tailwind ring), or null. */
  ring: { color: string; spreadPx: number } | null;
  /** Composited background behind the element (its parent chain), "r,g,b". */
  backgroundBehind: string;
  /** Outline color vs backgroundBehind, when an outline is drawn; else null. */
  outlineContrast: number | null;
  /** Ring color vs backgroundBehind, when a ring is drawn; else null. */
  ringContrast: number | null;
  rect: { x: number; y: number; width: number; height: number };
}

/** Describes document.activeElement, or null when focus is on body/none. */
export async function describeFocused(page: Page): Promise<FocusInfo | null> {
  return page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    if (!el || el === document.body || el === document.documentElement) return null;
    const cv = document.createElement("canvas");
    cv.width = cv.height = 1;
    const cx = cv.getContext("2d", { willReadFrequently: true }) as CanvasRenderingContext2D;
    const parse = (c: string): number[] => {
      if (!c || c === "transparent") return [0, 0, 0, 0];
      cx.clearRect(0, 0, 1, 1);
      cx.fillStyle = "#000";
      cx.fillStyle = c;
      cx.fillRect(0, 0, 1, 1);
      const d = cx.getImageData(0, 0, 1, 1).data;
      return [d[0], d[1], d[2], d[3] / 255];
    };
    const over = (top: number[], bot: number[]): number[] => [0, 1, 2].map((i) => top[i] * top[3] + bot[i] * (1 - top[3]));
    const lum = (rgb: number[]): number => {
      const f = (v: number): number => {
        const c = v / 255;
        return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
      };
      return 0.2126 * f(rgb[0]) + 0.7152 * f(rgb[1]) + 0.0722 * f(rgb[2]);
    };
    const ratio = (a: number[], b: number[]): number => {
      const l1 = lum(a);
      const l2 = lum(b);
      return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
    };
    const chain: Element[] = [];
    for (let e = el.parentElement; e; e = e.parentElement) chain.push(e);
    let bg = [255, 255, 255];
    for (let i = chain.length - 1; i >= 0; i--) {
      const c = parse(getComputedStyle(chain[i]).backgroundColor);
      if (c[3] > 0) bg = over(c, bg);
    }
    const s = getComputedStyle(el);
    const ow = Number.parseFloat(s.outlineWidth) || 0;
    const drawn = s.outlineStyle !== "none" && ow > 0;
    const oc = parse(s.outlineColor);
    const labelledby = el.getAttribute("aria-labelledby");
    const lbText = labelledby
      ? labelledby
          .split(/\s+/)
          .map((id) => document.getElementById(id)?.textContent?.trim() ?? "")
          .join(" ")
          .trim()
      : "";
    // Split box-shadow at top-level commas, then pick the widest spread ring.
    const shadows: string[] = [];
    let depth = 0;
    let cur = "";
    for (const ch of s.boxShadow === "none" ? "" : s.boxShadow) {
      if (ch === "(") depth++;
      if (ch === ")") depth--;
      if (ch === "," && depth === 0) {
        shadows.push(cur.trim());
        cur = "";
      } else cur += ch;
    }
    if (cur.trim()) shadows.push(cur.trim());
    let ring: { color: string; spreadPx: number } | null = null;
    for (const sh of shadows) {
      if (/\binset\b/.test(sh)) continue;
      const colorMatch = /^([a-z-]+\([^)]*\)|#[0-9a-f]+|[a-z]+)/i.exec(sh);
      const color = colorMatch ? colorMatch[1] : "";
      const lengths = sh.slice(color.length).trim().split(/\s+/).map((v) => Number.parseFloat(v));
      const spread = lengths.length >= 4 ? lengths[3] : 0;
      if (spread > 0 && parse(color)[3] > 0 && (!ring || spread > ring.spreadPx)) ring = { color, spreadPx: spread };
    }
    const r = el.getBoundingClientRect();
    return {
      tag: el.tagName.toLowerCase(),
      id: el.id,
      role: el.getAttribute("role"),
      name: (el.getAttribute("aria-label") || lbText || (el.textContent ?? "").replace(/\s+/g, " ").trim()).slice(0, 60),
      tabIndex: el.tabIndex,
      outlineStyle: s.outlineStyle,
      outlineWidthPx: ow,
      outlineColor: s.outlineColor,
      outlineOffsetPx: Number.parseFloat(s.outlineOffset) || 0,
      boxShadow: s.boxShadow,
      ring,
      backgroundBehind: bg.map((v) => Math.round(v)).join(","),
      outlineContrast: drawn ? +ratio(over(oc, bg), bg).toFixed(2) : null,
      ringContrast: ring ? +ratio(over(parse(ring.color), bg), bg).toFixed(2) : null,
      rect: { x: r.x, y: r.y, width: r.width, height: r.height },
    };
  });
}

/**
 * Presses Tab up to `maxSteps` times from the current focus and describes each
 * focused element. Stops early when focus leaves the page or returns to the
 * first element.
 */
export async function focusSequence(page: Page, maxSteps = 60): Promise<FocusInfo[]> {
  const out: FocusInfo[] = [];
  let firstKey: string | null = null;
  for (let i = 0; i < maxSteps; i++) {
    await page.keyboard.press("Tab");
    const info = await describeFocused(page);
    if (!info) break;
    const key = `${info.tag}#${info.id}|${info.name}|${Math.round(info.rect.x)},${Math.round(info.rect.y)}`;
    if (firstKey === key) break;
    firstKey ??= key;
    out.push(info);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Page survey (ported from the audit's measure.js)
// ---------------------------------------------------------------------------

export interface PageSurvey {
  url: string;
  innerWidth: number;
  docScrollWidth: number;
  bodyScrollWidth: number;
  navLinks: { text: string; lines: number; clipped: boolean; ariaCurrent: string | null; w: number; h: number; top: number; left: number }[];
  landmarks: { header: number; nav: number; main: number; footer: number; siblings: boolean; parents: (string | null)[] };
  h1: number;
  headings: { level: number; text: string; fontSizePx: number; textTransform: string }[];
  /** Skipped heading levels, e.g. 'h1->h3 at "Try it"'. */
  skips: string[];
  fonts: {
    totalChars: number;
    /** [fontSizePx, characters] sorted by size. */
    sizes: [number, number][];
    below12: { fs: number; text: string; el: string }[];
    monoOutsidePct: number;
    monoOutsideSamples: { text: string; el: string }[];
  };
  /** Text under text-transform: uppercase, outside th and HTTP methods. */
  uppercase: { text: string; el: string }[];
  /** Visible text below its WCAG threshold (disabled controls flagged, not skipped). */
  lowContrast: { ratio: number; need: number; fs: number; weight: string; disabled: boolean; text: string; el: string; fg: string; bg: string }[];
  inputs: { el: string; type: string; labels: string[]; ariaLabel: string | null; labelledby: string | null; describedby: string | null; placeholder: string | null }[];
  unlabeled: string[];
  live: { el: string; role: string | null; live: string | null; text: string }[];
  blankLinks: { text: string; rel: string | null; href: string | null; name: string }[];
}

/**
 * One-pass survey of the rendered page: widths, nav links, landmarks,
 * headings, type sizes and monospace use, uppercase, text contrast against the
 * composited background, inputs and labels, live regions, new-tab links.
 * Text inside code, pre, kbd, samp, and [data-mono] counts as data for the
 * monospace figure. sr-only text is skipped.
 */
export async function surveyPage(page: Page): Promise<PageSurvey> {
  return page.evaluate(() => {
    const cv = document.createElement("canvas");
    cv.width = cv.height = 1;
    const cx = cv.getContext("2d", { willReadFrequently: true }) as CanvasRenderingContext2D;
    const parse = (c: string): number[] => {
      if (!c || c === "transparent") return [0, 0, 0, 0];
      cx.clearRect(0, 0, 1, 1);
      cx.fillStyle = "#000";
      cx.fillStyle = c;
      cx.fillRect(0, 0, 1, 1);
      const d = cx.getImageData(0, 0, 1, 1).data;
      return [d[0], d[1], d[2], d[3] / 255];
    };
    const over = (top: number[], bot: number[]): number[] => [0, 1, 2].map((i) => top[i] * top[3] + bot[i] * (1 - top[3]));
    const lum = (rgb: number[]): number => {
      const f = (v: number): number => {
        const c = v / 255;
        return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
      };
      return 0.2126 * f(rgb[0]) + 0.7152 * f(rgb[1]) + 0.0722 * f(rgb[2]);
    };
    const ratio = (a: number[], b: number[]): number => {
      const l1 = lum(a);
      const l2 = lum(b);
      return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
    };
    const bgOf = (el: Element): number[] => {
      const chain: Element[] = [];
      for (let e: Element | null = el; e; e = e.parentElement) chain.push(e);
      let bg = [255, 255, 255];
      for (let i = chain.length - 1; i >= 0; i--) {
        const c = parse(getComputedStyle(chain[i]).backgroundColor);
        if (c[3] > 0) bg = over(c, bg);
      }
      return bg;
    };
    const opacityOf = (el: Element): number => {
      let o = 1;
      for (let e: Element | null = el; e; e = e.parentElement) o *= Number.parseFloat(getComputedStyle(e).opacity);
      return o;
    };
    const isSrOnly = (el: Element): boolean => {
      for (let e: Element | null = el; e; e = e.parentElement) {
        const s = getComputedStyle(e);
        if (s.position === "absolute" && (s.clip === "rect(0px, 0px, 0px, 0px)" || s.clipPath === "inset(50%)")) return true;
        if (e.getBoundingClientRect().width <= 1 && s.overflow === "hidden") return true;
      }
      return false;
    };
    const desc = (el: Element): string => {
      let s = el.tagName.toLowerCase();
      if (el.id) s += "#" + el.id;
      const cls = (el.getAttribute("class") || "").split(/\s+/).filter(Boolean).slice(0, 4).join(".");
      if (cls) s += "." + cls;
      return s;
    };

    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const texts: { el: Element; t: string; s: CSSStyleDeclaration }[] = [];
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const t = (n.textContent ?? "").replace(/\s+/g, " ").trim();
      if (!t) continue;
      const el = n.parentElement;
      if (!el || el.closest("script,style,noscript,template")) continue;
      const s = getComputedStyle(el);
      if (s.visibility === "hidden" || s.display === "none") continue;
      const range = document.createRange();
      range.selectNodeContents(n);
      if (![...range.getClientRects()].some((x) => x.width > 0 && x.height > 0)) continue;
      if (isSrOnly(el)) continue;
      texts.push({ el, t, s });
    }
    let total = 0;
    let monoOutside = 0;
    const sizes: Record<string, number> = {};
    const below12: { fs: number; text: string; el: string }[] = [];
    const monoSamples: { text: string; el: string }[] = [];
    const upper: { text: string; el: string }[] = [];
    type LowContrast = { ratio: number; need: number; fs: number; weight: string; disabled: boolean; text: string; el: string; fg: string; bg: string };
    const low: LowContrast[] = [];
    for (const { el, t, s } of texts) {
      total += t.length;
      const fs = Number.parseFloat(s.fontSize);
      sizes[fs] = (sizes[fs] || 0) + t.length;
      if (fs < 12) below12.push({ fs, text: t.slice(0, 50), el: desc(el) });
      const mono = /mono|monospace|consolas|menlo/i.test(s.fontFamily);
      if (mono && !el.closest("code,pre,kbd,samp,[data-mono]")) {
        monoOutside += t.length;
        if (monoSamples.length < 200) monoSamples.push({ text: t.slice(0, 60), el: desc(el) });
      }
      let up = false;
      for (let e: Element | null = el; e; e = e.parentElement) {
        if (getComputedStyle(e).textTransform === "uppercase") {
          up = true;
          break;
        }
      }
      if (up && !el.closest("th") && !/^(GET|POST|PUT|PATCH|DELETE|OPTIONS)$/.test(t)) upper.push({ text: t.slice(0, 50), el: desc(el) });
      const disabled = !!el.closest("button:disabled,[aria-disabled=true],input:disabled,textarea:disabled,fieldset:disabled");
      const fg = parse(s.color);
      const bg = bgOf(el);
      const fgc = over([fg[0], fg[1], fg[2], fg[3] * opacityOf(el)], bg);
      const cr = ratio(fgc, bg);
      const weight = Number.parseInt(s.fontWeight, 10);
      const need = fs >= 24 || (weight >= 700 && fs >= 18.66) ? 3 : 4.5;
      if (cr < need) {
        low.push({ ratio: +cr.toFixed(2), need, fs, weight: s.fontWeight, disabled, text: t.slice(0, 50), el: desc(el), fg: s.color, bg: bg.map(Math.round).join(",") });
      }
    }

    const nav = document.querySelector('nav[aria-label="Primary"]') ?? document.querySelector("nav");
    const navLinks = nav
      ? [...nav.querySelectorAll("a")].map((a) => {
          const r = document.createRange();
          r.selectNodeContents(a);
          const tops = new Set([...r.getClientRects()].filter((x) => x.width > 0).map((x) => Math.round(x.top)));
          const b = a.getBoundingClientRect();
          return {
            text: (a.textContent ?? "").trim(),
            lines: tops.size,
            clipped: a.scrollWidth > a.clientWidth + 1,
            ariaCurrent: a.getAttribute("aria-current"),
            w: Math.round(b.width),
            h: Math.round(b.height),
            top: Math.round(b.top),
            left: Math.round(b.left),
          };
        })
      : [];

    const all = (sel: string): Element[] => [...document.querySelectorAll(sel)];
    const headers = all("header,[role=banner]");
    const navs = all("nav,[role=navigation]");
    const mains = all("main,[role=main]");
    const footers = all("footer,[role=contentinfo]");
    const firstOf = [headers[0], navs[0], mains[0], footers[0]];
    const parents = firstOf.map((e) => (e && e.parentElement ? desc(e.parentElement) : null));
    const siblings = firstOf.every((e) => e) && firstOf.every((e) => e.parentElement === firstOf[0].parentElement);

    const hs = all("h1,h2,h3,h4,h5,h6")
      .filter((h) => getComputedStyle(h).display !== "none" && !h.closest("dialog:not([open])"))
      .map((h) => ({ level: Number(h.tagName[1]), text: (h.textContent ?? "").trim().slice(0, 60), fontSizePx: Number.parseFloat(getComputedStyle(h).fontSize), textTransform: getComputedStyle(h).textTransform }));
    const skips: string[] = [];
    let prev = 0;
    for (const h of hs) {
      if (prev && h.level > prev + 1) skips.push(`h${prev}->h${h.level} at "${h.text}"`);
      if (!prev && h.level !== 1) skips.push(`starts at h${h.level} "${h.text}"`);
      prev = h.level;
    }

    const inputs = all("input,textarea,select")
      .filter((i) => (i as HTMLInputElement).type !== "hidden")
      .map((i) => {
        const inp = i as HTMLInputElement;
        return {
          el: desc(i),
          type: inp.type,
          labels: [...(inp.labels ?? [])].map((l) => (l.textContent ?? "").trim().slice(0, 50)),
          ariaLabel: i.getAttribute("aria-label"),
          labelledby: i.getAttribute("aria-labelledby"),
          describedby: i.getAttribute("aria-describedby"),
          placeholder: i.getAttribute("placeholder"),
        };
      });
    const live = all("[aria-live],[role=status],[role=alert],[role=log]").map((e) => ({
      el: desc(e),
      role: e.getAttribute("role"),
      live: e.getAttribute("aria-live"),
      text: (e.textContent ?? "").trim().slice(0, 80),
    }));
    const blankLinks = all("a[target=_blank]").map((a) => ({
      text: (a.textContent ?? "").trim().slice(0, 60),
      rel: a.getAttribute("rel"),
      href: a.getAttribute("href"),
      name: (a.getAttribute("aria-label") || (a.textContent ?? "")).replace(/\s+/g, " ").trim(),
    }));
    const sortedSizes = Object.entries(sizes)
      .map(([k, v]) => [Number(k), v] as [number, number])
      .sort((a, b) => a[0] - b[0]);
    return {
      url: location.pathname,
      innerWidth,
      docScrollWidth: document.documentElement.scrollWidth,
      bodyScrollWidth: document.body.scrollWidth,
      navLinks,
      landmarks: { header: headers.length, nav: navs.length, main: mains.length, footer: footers.length, siblings, parents },
      h1: hs.filter((h) => h.level === 1).length,
      headings: hs,
      skips,
      fonts: {
        totalChars: total,
        sizes: sortedSizes,
        below12: below12.slice(0, 50),
        monoOutsidePct: total ? +((100 * monoOutside) / total).toFixed(1) : 0,
        monoOutsideSamples: monoSamples,
      },
      uppercase: upper,
      lowContrast: low,
      inputs,
      unlabeled: inputs.filter((i) => !i.labels.length && !i.labelledby && !i.ariaLabel).map((i) => i.el),
      live,
      blankLinks,
    };
  });
}
