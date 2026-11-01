// View adapter: finds views, gate areas, fields, and buttons by visible text,
// label, or role, so one browser test runs on HEAD (c6d13ea) and on F'.
//
// Rules for editing (design, gap-fix phase): add F' selectors next to the
// HEAD ones, remove none. Prefer roles and labels over classes. Where HEAD and
// F' differ, match both with an anchored regex or a CSS union + .first().

import type { Locator, Page } from "playwright-core";
import { poll } from "./server.ts";

export type Scope = Page | Locator;

function isPage(scope: Scope): scope is Page {
  return typeof (scope as Page).goto === "function";
}

/** The Page behind a Page or Locator scope. */
export function pageOf(scope: Scope): Page {
  return isPage(scope) ? scope : scope.page();
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

/** Every view route, in nav order (all four gate pages). */
export const VIEW_PATHS = Object.freeze(["/", "/gates/1", "/gates/2", "/gates/3", "/gates/4", "/scoreboard", "/docs", "/console"] as const);
export type ViewPath = (typeof VIEW_PATHS)[number];

/** One route per nav item. */
export const PRIMARY_PATHS = Object.freeze(["/", "/gates/1", "/scoreboard", "/docs", "/console"] as const);

export const GATE_NUMBERS = Object.freeze([1, 2, 3, 4] as const);
export type GateNumber = (typeof GATE_NUMBERS)[number];
export const INSTANCE_GATES = Object.freeze([2, 3, 4] as const);
export type InstanceGateNumber = (typeof INSTANCE_GATES)[number];

/** Primary nav labels and targets, in order (X23). */
export const NAV_ITEMS = Object.freeze([
  { label: "Overview", href: "/" },
  { label: "Gates", href: "/gates/1" },
  { label: "Scoreboard", href: "/scoreboard" },
  { label: "Docs", href: "/docs" },
  { label: "Console", href: "/console" },
] as const);
export type NavLabel = (typeof NAV_ITEMS)[number]["label"];

/** Nav label that should be current for a path (any /gates/N counts for Gates). */
export function navLabelFor(path: string): NavLabel | null {
  if (path === "/") return "Overview";
  if (path === "/gates" || path.startsWith("/gates/")) return "Gates";
  if (path === "/scoreboard") return "Scoreboard";
  if (path === "/docs") return "Docs";
  if (path === "/console") return "Console";
  return null;
}

/** Display strings on the Overview (text only; tests never request them). */
export const CONNECTION_TEXT = Object.freeze({
  baseUrl: "https://ctf.hakudigital.tech",
  skillUrl: "https://ctf.hakudigital.tech/skill.md",
  direct: "GET /api/skill",
});

// ---------------------------------------------------------------------------
// Shell
// ---------------------------------------------------------------------------

/** The site header (banner landmark). */
export function siteHeader(page: Page): Locator {
  return page.getByRole("banner");
}

/** The primary nav, `<nav aria-label="Primary">`. */
export function primaryNav(page: Page): Locator {
  return page.getByRole("navigation", { name: "Primary", exact: true });
}

/** All primary nav links, in DOM order. */
export function navLinks(page: Page): Locator {
  return primaryNav(page).getByRole("link");
}

/** One primary nav link by its visible label. */
export function navLink(page: Page, label: NavLabel): Locator {
  return primaryNav(page).getByRole("link", { name: label, exact: true });
}

/** Nav links carrying aria-current (any value; X23 expects exactly one, "page"). */
export function currentNavLinks(page: Page): Locator {
  return primaryNav(page).locator("a[aria-current]");
}

export function mainRegion(page: Page): Locator {
  return page.locator("main");
}

/** The site footer (contentinfo landmark). */
export function siteFooter(page: Page): Locator {
  return page.getByRole("contentinfo");
}

/** The page's h1 elements (each view has exactly one). */
export function pageHeading(page: Page): Locator {
  return page.getByRole("heading", { level: 1 });
}

export function skipLink(page: Page): Locator {
  return page.getByRole("link", { name: /^Skip to (main )?content$/ });
}

/** The header sound toggle (`button[aria-pressed]`). */
export function soundToggle(page: Page): Locator {
  return siteHeader(page).locator("button[aria-pressed]");
}

/** Live regions present now (aria-live, status, alert, log). */
export function liveRegions(page: Page): Locator {
  return page.locator("[aria-live], [role=status], [role=alert], [role=log]");
}

// ---------------------------------------------------------------------------
// Flag dialog and flag form
// ---------------------------------------------------------------------------

/** The header button that opens the flag dialog ("Submit flag"). */
export function flagDialogTrigger(page: Page): Locator {
  return siteHeader(page).getByRole("button", { name: "Submit flag", exact: true });
}

/** The flag `<dialog>` (hidden until opened). */
export function flagDialog(page: Page): Locator {
  return page.locator("dialog");
}

/** Clicks the header trigger and waits until the dialog is visible. */
export async function openFlagDialog(page: Page): Promise<Locator> {
  await flagDialogTrigger(page).click();
  const dialog = flagDialog(page);
  await dialog.waitFor({ state: "visible" });
  await flagForm(dialog).handle.waitFor({ state: "visible" });
  return dialog;
}

/** Clicks the dialog's Close button and waits until it is hidden. */
export async function closeFlagDialog(page: Page): Promise<void> {
  const dialog = flagDialog(page);
  await dialog.getByRole("button", { name: "Close", exact: true }).click();
  await dialog.waitFor({ state: "hidden" });
}

export interface FlagFormParts {
  /** The `<form>` that holds the "Agent handle" field. */
  form: Locator;
  /** The form's parent element: heading, form, and result area. */
  container: Locator;
  handle: Locator;
  flag: Locator;
  /** "Submit flag", or "Submitting…" while busy. */
  submit: Locator;
  /** Elements after the form inside the container (the result area). */
  after: Locator;
  /** "Dismiss" control of the result (aria-label "Dismiss result" on HEAD). */
  dismiss: Locator;
}

/**
 * The flag form inside `scope`. Scope it: `flagForm(flagDialog(page))`,
 * `flagForm(mainRegion(page))` on /scoreboard, or `flagForm(tryIt(page))`
 * for the inline form after a gate returns a flag.
 */
export function flagForm(scope: Scope): FlagFormParts {
  const page = pageOf(scope);
  const form = scope.locator("form").filter({ has: page.getByLabel("Agent handle", { exact: true }) });
  const container = form.locator("xpath=..");
  return {
    form,
    container,
    handle: form.getByLabel("Agent handle", { exact: true }),
    flag: form.getByLabel("Flag", { exact: true }),
    submit: form.getByRole("button", { name: /^(Submit flag|Submitting…)$/ }),
    after: form.locator("xpath=following-sibling::*"),
    dismiss: container.getByRole("button", { name: /^Dismiss/ }),
  };
}

// ---------------------------------------------------------------------------
// Gate pages
// ---------------------------------------------------------------------------

/** The gate page's "Try it" region (section labelled by its "Try it" heading). */
export function tryIt(page: Page): Locator {
  return page.getByRole("region", { name: "Try it", exact: true });
}

/** Countdown text: "Expires in N s", "Expiring, N s left" / "Expiring", or "Expired". */
export const COUNTDOWN_TEXT = /^(Expires in \d+ s|Expiring(, \d+ s left)?|Expired)$/;

export interface InstancePanelParts {
  area: Locator;
  /** "Request instance", "Request new instance", or "Requesting…". */
  request: Locator;
  /** Only the idle "Request instance" (or its busy "Requesting…"). */
  requestFirst: Locator;
  requestNew: Locator;
  /** The instance submit: "Submit" (F'), "Submit predictions/assignment/key" (HEAD), "Submitting…". */
  submit: Locator;
  /** "Try again" / "Try again in N s" (F' error state). */
  tryAgain: Locator;
  countdown: Locator;
  /** Gate 2 prediction inputs, labelled X<n>. */
  predictions: Locator;
  /** Gate 3 assignment textarea. */
  assignment: Locator;
  /** Gate 4 key input. */
  key: Locator;
  /** The full-response disclosure(s). */
  json: Locator;
  /** A returned flag rendered as code. */
  flag: Locator;
}

/** Controls of the Gates 2-4 try-it panel. */
export function instancePanel(page: Page): InstancePanelParts {
  const area = tryIt(page);
  return {
    area,
    request: area.getByRole("button", { name: /^(Request instance|Request new instance|Requesting…)$/ }),
    requestFirst: area.getByRole("button", { name: /^(Request instance|Requesting…)$/ }),
    requestNew: area.getByRole("button", { name: /^Request new instance$/ }),
    submit: area.getByRole("button", { name: /^(Submit|Submit predictions|Submit assignment|Submit key|Submitting…)$/ }),
    tryAgain: area.getByRole("button", { name: /^Try again/ }),
    countdown: area.getByText(COUNTDOWN_TEXT),
    predictions: area.getByLabel(/^X\d+$/),
    assignment: area.getByLabel(/^Assignment/),
    key: area.getByLabel(/^Key/),
    json: area.locator("details"),
    flag: area.locator("code").filter({ hasText: /^HAKU\{.*\}$/ }),
  };
}

/** Seconds shown by the countdown, 0 for "Expired", null when there is no countdown. */
export async function countdownSeconds(page: Page): Promise<number | null> {
  const c = instancePanel(page).countdown;
  if ((await c.count()) === 0) return null;
  const text = (await c.first().innerText()).trim();
  if (/^Expired$/.test(text)) return 0;
  const m = /(\d+) s/.exec(text);
  return m ? Number(m[1]) : null;
}

export interface Gate1PanelParts {
  area: Locator;
  prompt: Locator;
  /** "Send prompt", "Sending…", or "Send prompt (N s)". */
  send: Locator;
  flag: Locator;
}

/** Controls of the Gate 1 try-it panel. */
export function gate1Panel(page: Page): Gate1PanelParts {
  const area = tryIt(page);
  return {
    area,
    prompt: area.getByLabel("Prompt", { exact: true }),
    send: area.getByRole("button", { name: /^(Send prompt|Sending…)/ }),
    flag: area.locator("code").filter({ hasText: /^HAKU\{.*\}$/ }),
  };
}

/** Gate result labels (status badges) used by HEAD and F'. */
export const RESULT_LABELS = Object.freeze([
  "Accepted",
  "Rejected",
  "Rate limited",
  "Request failed",
  "Server error",
  "Not sent",
  "Blocked by filter",
  "Answered, no flag",
  "Flag returned",
] as const);

/** The status badge text inside `scope` that matches a known result label, or null. */
export async function resultLabel(scope: Scope): Promise<string | null> {
  const page = pageOf(scope);
  for (const label of RESULT_LABELS) {
    const re = new RegExp(`^${label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}( \\(HTTP \\d{3}\\))?$`);
    const loc = (isPage(scope) ? page.locator("main") : scope).getByText(re);
    if ((await loc.count()) > 0) return (await loc.first().innerText()).trim();
  }
  return null;
}

/** Endpoint rows on /gates/N: the method badge and path text, for each endpoint listed. */
export async function endpointList(page: Page): Promise<{ method: string; path: string }[]> {
  return page.locator("main").evaluate((main) => {
    const out: { method: string; path: string }[] = [];
    const walker = document.createTreeWalker(main, NodeFilter.SHOW_ELEMENT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const el = n as Element;
      const t = (el.textContent ?? "").trim();
      if (el.children.length === 0 && /^(GET|POST)$/.test(t)) {
        const next = el.nextElementSibling;
        const path = (next?.textContent ?? "").trim();
        if (/^\/api\//.test(path)) out.push({ method: t, path });
      }
    }
    return out;
  });
}

// ---------------------------------------------------------------------------
// Copy controls
// ---------------------------------------------------------------------------

/** Copy controls in `scope`: name "Copy…", "Copied", or "Copy failed" (HEAD names them all "Copy"). */
export function copyButtons(scope: Scope): Locator {
  return scope.getByRole("button", { name: /^(Copy\b|Copied|Copy failed)/ });
}

/**
 * The copy control for `label` (e.g. "Base URL", "skill.md URL",
 * "GET /api/gate2/challenge", "flag", "skill.md"). F' names it "Copy <label>";
 * on HEAD every copy button is named "Copy", so this falls back to the
 * innermost element that contains `visibleText` (default `label`) and exactly
 * one copy button.
 */
export async function copyButtonFor(scope: Scope, label: string, visibleText: string = label): Promise<Locator> {
  const named = scope.getByRole("button", { name: `Copy ${label}`, exact: true });
  if ((await named.count()) > 0) return named.first();
  const page = pageOf(scope);
  const copyRe = /^(Copy|Copied|Copy failed)$/;
  const holders = scope
    .locator("div, li, section, header")
    .filter({ hasText: visibleText })
    .filter({ has: page.getByRole("button", { name: copyRe }) });
  const n = await holders.count();
  for (let i = n - 1; i >= 0; i--) {
    const h = holders.nth(i);
    const buttons = h.getByRole("button", { name: copyRe });
    if ((await buttons.count()) === 1) return buttons.first();
  }
  throw new Error(`No copy control found for ${JSON.stringify(label)}`);
}

// ---------------------------------------------------------------------------
// Scoreboard
// ---------------------------------------------------------------------------

export interface ScoreboardParts {
  /** "Refresh", "Refreshing…" (F'), or "Loading…" (HEAD). */
  refresh: Locator;
  table: Locator;
  rows: Locator;
  /** "No entries yet…". */
  empty: Locator;
  /** Initial loading text ("Loading scoreboard…" on HEAD). */
  loading: Locator;
}

export function scoreboardParts(page: Page): ScoreboardParts {
  const main = mainRegion(page);
  return {
    refresh: main.getByRole("button", { name: /^(Refresh|Refreshing…|Loading…)$/ }),
    table: main.locator("table"),
    rows: main.locator("table tbody tr"),
    empty: main.getByText(/^No entries yet/),
    loading: main.getByText(/^Loading( the)? scoreboard…/),
  };
}

/** Standings cell texts, one array per row, whitespace collapsed. */
export async function readStandings(page: Page): Promise<string[][]> {
  return scoreboardParts(page).rows.evaluateAll((rows) =>
    rows.map((r) => [...(r as HTMLTableRowElement).cells].map((c) => (c.innerText || "").replace(/\s+/g, " ").trim())),
  );
}

// ---------------------------------------------------------------------------
// Docs
// ---------------------------------------------------------------------------

/** The rendered skill.md: `[data-skill-doc]` (F') or the `article` in main (HEAD). */
export function docsDocument(page: Page): Locator {
  return page.locator("main [data-skill-doc], main article").first();
}

// ---------------------------------------------------------------------------
// Console
// ---------------------------------------------------------------------------

export interface ConsoleParts {
  /** The command input: #console-cmd (HEAD, label "$>") or the "Command" field (F'). */
  input: Locator;
  /** The output log: `[data-console-output]` or `role="log"`. */
  output: Locator;
  /** "Run" button (F' only). */
  run: Locator;
}

export function consoleParts(page: Page): ConsoleParts {
  return {
    input: page.locator("#console-cmd").or(page.getByLabel("Command", { exact: true })).first(),
    output: page.locator("main [data-console-output], main [role=log]").first(),
    run: page.locator("main").getByRole("button", { name: "Run", exact: true }),
  };
}

export interface ConsoleRun {
  before: string;
  after: string;
  /** Text appended by the command, or the whole output when it didn't append (e.g. clear). */
  added: string;
}

/**
 * Types `command` into the console input, presses Enter, and waits up to
 * `timeoutMs` for the output to change.
 */
export async function runConsoleCommand(page: Page, command: string, timeoutMs = 5_000): Promise<ConsoleRun> {
  const { input, output } = consoleParts(page);
  const before = await output.innerText();
  await input.fill(command);
  await input.press("Enter");
  await poll(async () => (await output.innerText()) !== before, { timeoutMs });
  const after = await output.innerText();
  return { before, after, added: after.startsWith(before) ? after.slice(before.length).replace(/^\n+/, "") : after };
}
