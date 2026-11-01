# UI/UX Overhaul Bugfix Design

## Overview

On afe2537 the AGENTGATE UI was a single 950-line client page. It layered decorative effects over 12px monospace text, used inflated copy, played sounds by default, never said what the site is or how an agent starts, and had accessibility gaps (bugfix.md section 1). The fix replaces that page with routed App Router views built mostly from server components. They sit on one small token-based design system, with plain copy that matches the API and explicit accessibility mechanisms. The agent surface stays frozen. Each defect marker in section 1 maps to one exploration test (X01 to X38) that must fail on afe2537 and pass after the fix. Each preserved behavior in section 3 maps to a preservation test (K01 to K20) that compares the fixed build with c6d13ea.

**Design decisions**

- **Routes:** `/` (Overview), `/gates/1` to `/gates/4` (`/gates` redirects to `/gates/1`), `/scoreboard`, `/docs`, and `/console`, plus a not-found page. Each view has its own URL and title (2.20).
- **Typefaces:** IBM Plex Sans for interface text and IBM Plex Mono for code and data, both loaded through `next/font` (2.4, see Typefaces).
- **Color:** graphite neutrals and one ice accent, #62c9f0 (`oklch(0.790 0.110 225)`), used for actions, links, focus, and the current view (2.2, see Tokens).
- **skill.md:** an in-house Markdown renderer in `src/lib/markdown.ts`, read on the server at build time. No Markdown or math package is added (2.19, R6).
- **Dependencies:** `canvas-confetti` and `@types/canvas-confetti` are removed (2.26). `playwright-core` and `fast-check` are added as devDependencies for tests only (3.19, R16).
- **Resolutions applied in this document:**
  - R1: the expiring threshold is per gate, in src/lib/gates.ts: 5 s for Gates 2 and 4, 3 s for Gate 3.
  - R2: busy controls get `aria-disabled="true"` and `data-busy`, keep focus, and ignore activation. Native `disabled` is used only for unavailable controls.
  - R3: the shell is two rows at every width. header, nav, main, and footer are siblings. The navs are labelled "Primary", "Gates" (GateStepper), and "Gate pages" (GatePager). One Announcer is the last child of main, and a second sits in the flag dialog.
  - R4: the 360px fit relies on X37, nowrap labels, and a wrapping nav list, not on Inter-based width estimates.
  - R5: the Copy section owns every UI string.
  - R6: Docs reads skill.md at build time, with no client fetch and no loading state. It offers "View raw file" and the production skill.md URL with its own copy control.
  - R7: the scoreboard's G1 to G4 chips have an icon and the names "Gate N: solved" or "Gate N: not solved".
  - R8: copy controls have a constant name starting with "Copy", check the clipboard promise, announce once, and stay disabled until hydration.
  - R9: the sound toggle is `<button aria-pressed>` named "Sound effects", starting false.
  - R10: endpoint copy controls copy the production URL and are named "Copy URL for {METHOD} {PATH}".
  - R11: GatePager shows "Previous: Overview" on Gate 1 and "Next: Scoreboard" on Gate 4.
  - R12: src/lib/api.ts classifies responses with one ordered rule list.
  - R13: the handle check warns, doesn't block, and previews the cleaned handle.
  - R14: Gate 4 accepts a lowercase `0x` prefix and any letter case. This was checked against c6d13ea.
  - R15: not-found.tsx, icon.svg, app-state.ts, format.ts, and Announcer.tsx are part of the design.
  - R16: browser tests use playwright-core with the installed Chrome.
  - R17: `allowImportingTsExtensions` with relative `.ts` imports in the pure modules, with tests/tsconfig.json as the fallback.
  - R18: the countdown has three states: live, expiring, and expired.
- **HELL mode (c6d13ea):** gate facts follow the code at c6d13ea (bugfix.md A3). "Hell" appears once per page as "Difficulty: Hell" (A14), and src/lib/gates.ts is the single source for gate facts (A15).

**Status.** The fix was implemented in commit 2516aa1. This document audits it at c6d13ea, which also changed the agent surface on purpose. Files that already exist at HEAD are marked "exists at HEAD, audit" in Changes Required. tasks.md lists the gap fixes.

**Open questions**

1. A14 (the "Difficulty: Hell" label) and A15 (gates.ts as the single source) are proposed and not yet confirmed.
2. Should Gate 1's try-it area get a nonce helper that searches for a passing nonce in the browser? A6 keeps it out of scope until the user decides. Without one, a prompt typed by hand passes the proof-of-work check about 1 time in 65,536.
3. The c6d13ea solver points at production and registers JABRIK. Verification runs a temporary copy against localhost:3008. Should the original also run against production after deploy? That would write to the live scoreboard.
4. Some response text in frozen files is stale: Gate 2 says "Calculate A and C from the 5 consecutive numbers", Gate 3 says 60 variables and 255 clauses, and Gate 4 says "8-opcode". The Gate 3 verifier also reads any 120- or 121-entry array by position, so skill.md's signed-literal example only works at other lengths. The UI works around both. Fixing the API is a separate decision.

## Glossary

- **X (UI observation)**: one observable state of the UI, written `X = (route, viewport, media, interaction, source)`. `route` is a URL path. `viewport` is one of 1280×900, 360×780 (mobile emulation), or 640×450 at device scale 2, which equals 1280×900 at 200% zoom. `media` is `prefers-reduced-motion` on or off. `interaction` is a scripted sequence of clicks, key presses, and typed values, with optional network interception. `source` is the file tree under src/ plus package.json and tsconfig.json.
- **Bug_Condition (C)**: predicate `isBugCondition(X)`. It holds when X shows at least one defect marker from bugfix.md section 1.
- **Defect marker**: one detectable symptom from clauses 1.1 to 1.35, paired with one exploration test (X01 to X38 below).
- **Property (P)**: predicate `expectedBehavior(X)`. It holds when X satisfies every applicable clause 2.1 to 2.35.
- **Preservation**: for every input outside C (agent API traffic, skill.md requests, the reference solver, console command semantics, and the flows in 3.4 to 3.18), the fixed system F' behaves the same as the preservation baseline F_api.
- **F_bug (bug baseline)**: the code at commit afe2537, where the defects in section 1 were measured. Its exploration counterexamples were recorded during the requirements phase and are kept in `%TEMP%\agentgate-baseline`. Source and static exploration tests (kinds S and H) can be re-run on a worktree made with `git worktree add <tmp> afe2537`. Browser exploration on F_bug is not re-run.
- **F_api (preservation baseline)**: the code at commit c6d13ea ("HELL mode"), which is HEAD when the tasks phase starts. It already contains the UI fix from 2516aa1 and the deliberate agent-surface changes from c6d13ea. It is the baseline for the agent surface, the frozen-file diff, and the visitor flows in 3.4 to 3.18. Built with `npm run build` and served by `next start -p 3008`.
- **F (baseline)**: shorthand used in the pseudocode. It means F_bug in exploration and fix checking, and F_api in preservation checking.
- **F' (fixed)**: the code after the gap-fix tasks in tasks.md, built and served the same way.
- **Frozen set Z**: `src/app/api/**`, `src/lib/challenges.ts`, `src/lib/crypto.ts`, `src/lib/ratelimit.ts`, `public/skill.md`, and `test_agent_solver.py`. Each file stays byte-identical to c6d13ea (A3).
- **UI code U**: every file under src/ that is not in Z. It includes src/lib/gates.ts and src/components/gates/Gate2Instance.tsx, which c6d13ea edited. This is the scope of the UI-only lint command (2.35).
- **Server under test**: a production server on http://localhost:3008. Tests read `BASE_URL`, which defaults to that address.
- **Probe IP**: a value in 198.18.0.0/15 (the RFC 2544 benchmark range) that a test sends as `cf-connecting-ip`. `src/lib/ratelimit.ts` takes the client IP from that header first, so each test file gets its own rate-limit bucket. The c6d13ea solver sends `cf-connecting-ip: 198.18.99.1` itself, so no test may use that address.
- **Fixture**: a file under `tests/fixtures/baseline/` captured from F_api before any gap fix. It is committed and never regenerated from F'.
- **Oracle**: a function under `tests/fixtures/baseline/` that reproduces one baseline behavior, of F_bug (logic that moved out of the old page) or of F_api (agent-surface facts). Examples are the console branching in page.tsx and the handle cleanup in the scoreboard route. A source-tie test proves that each oracle literal or regex appears verbatim in `git show afe2537:<path>` (behavior moved out of the old page) or `git show c6d13ea:<path>` (agent-surface facts).
- **Subject**: the implementation a module-level preservation test checks. `tests/preserve/subjects.ts` maps each subject to its src/lib module. The fix is already applied, so the subjects point at the modules from the start, and the oracles are the reference.
- **View adapter**: `tests/support/views.ts`. It finds views, gate areas, fields, and buttons by visible text or label. F_api and F' share the routed UI, so one set of selectors serves both.
- **Counterexample**: the concrete X recorded when an exploration test fails on F_bug, or on HEAD while gaps remain.

## Bug Details

### Bug Condition

C holds for any X in which the UI shows a defect marker. The markers come from four sources:

- decorative global CSS and markup (1.1)
- the lack of a token, control, and type system (1.2 to 1.5)
- the single-route, single-component page with unchecked fetch handling (1.6 to 1.20)
- copy, metadata, sound, motion, viewport, accessibility, and lint defects (1.21 to 1.35)

C never holds for requests that agents or the solver send to `/api/*`, `/skill.md`, or `/api/skill`. Those requests are the preservation domain.

**Formal Specification:**

```
FUNCTION isBugCondition(X)
  INPUT: X of type UIObservation = (route, viewport, media, interaction, source)
  OUTPUT: boolean

  IF X.route STARTS WITH "/api/" OR X.route = "/skill.md" THEN
    RETURN false                      // agent-facing surface: preservation domain
  END IF
  RETURN EXISTS m IN DefectMarkers WHERE m.detect(X)
END FUNCTION

// DefectMarkers is the X01..X38 table in "Exploratory Bug Condition Checking".
// Each marker m has m.clause (1.x), m.detect(X) (the failing assertion), and
// m.expected (the 2.x assertion that must hold on F').

FUNCTION expectedBehavior(X)
  INPUT: X of type UIObservation, observed on F'
  OUTPUT: boolean

  RETURN FOR ALL m IN DefectMarkers WHERE m.appliesTo(X) : m.expected(X)
END FUNCTION
```

### Examples

These examples were measured on F_bug, or follow directly from its source:

- `GET /docs`, `/scoreboard`, `/console`, and `/gates/1` return 404. Expected: 200 with that view, and `/gates` redirects to `/gates/1`.
- At 360×780, the "Protocol Spec" button wraps to 44px tall next to 28px neighbors, and the four-button row is 318px wide inside a 294px box. Expected: no wrapping or clipping.
- A Gate 3 challenge response with 7 variables and 9 clauses, injected by interception, still shows "Variables: 60 | Clauses: 255" and "... +252 clauses". Expected: 7 and 9, derived from the response.
- A 429 response from `GET /api/gate2/challenge` with "Rate limit exceeded. Retry in 42s." shows an empty instance with a 15 s countdown and a Submit button that does nothing. Expected: an error state showing that message, with no countdown and no enabled Submit.
- Clicking the "Console" view button starts a Web Audio oscillator. Expected: zero oscillators until the visitor turns sound on.
- Tabbing to the Gate 1 prompt shows no focus indicator, because `focus:outline-none` has no replacement. Expected: an indicator with at least 3:1 contrast.
- The UI-only lint command reports 16 errors and 16 warnings and exits 1. Expected: zero of each, exit 0.
- Edge case: a handle such as `my agent!` is accepted without comment and recorded as `myagent`. Expected: a format message before submission, and the recorded handle shown after an accepted flag.

## Expected Behavior

### Preservation Requirements

The non-bug domain ¬C splits into four parts. Each part has its own baseline capture, so the preserved behavior is observed on F_api (c6d13ea), not assumed:

| Part | Inputs | Baseline captured as | Clauses |
|---|---|---|---|
| Agent surface | every `/api/*` request, `/skill.md`, the solver run | `api-contract.json`, `solver.txt`, the git diff of Z | 3.1, 3.2, 3.3 |
| Moved logic | console commands, handle cleanup, input trimming, Gate 3 JSON parsing, gate metadata | oracles plus source-tie tests | 3.8, 3.9, 3.10, 3.16, and the server half of 2.16 |
| Visitor flows | flag submit and feedback, auto-fill, Gate 1 send, instance lifecycle, scoreboard listing, skill.md copy, state across navigation, request budget | browser runs through the view adapter on F_api | 3.4 to 3.7, 3.11, 3.12, 3.14, 3.15 |
| Site invariants | Haku Digital credit and author metadata, no emoji, English and dark only, no page scroll at 360px, build passes, dependency split | HTML, rendered-text, and package.json checks on F_api | 3.13, 3.17, 3.18, 3.19 |

Text that the fix must change is outside the preservation domain, even where a 3.x clause covers the same flow. Examples are the console help wording (2.21) and the label "Verified Complete" (2.23). For those flows, preservation tests compare information, not wording. Console, scoreboard, and server messages are compared by content as described in "Preservation Checking". Server messages come from frozen files, so they are compared verbatim.

## Hypothesized Root Cause

1. **One client component holds every view.** `src/app/page.tsx` is about 950 lines with `"use client"`. It keeps the current view in `useState<"arena" | "terminal" | "leaderboard" | "skill">`, so there are no routes, no URL changes, and no history entries (1.20). The flag form is rendered above the view switch, so it appears on every view (1.7). The header crams brand, four buttons, and a sound toggle into one flex row, which overflows at 360px (1.34).
2. **No design-system layer.** Colors are arbitrary Tailwind values such as `bg-[#0d1117]` and `text-[#00ff66]`, mixed with default `zinc-*` and `red-*` classes, and each button is styled by hand (1.2, 1.3, 1.5). `font-mono` and `text-xs` are applied almost everywhere and no font is loaded through next/font (1.4). `focus:outline-none` has nothing to replace it (1.29).
3. **Decorative CSS is global.** globals.css defines `.scanlines`, `.matrix-grid`, `.glow-*`, `.box-glow-*`, and `--cyber-*`, and layout.tsx mounts the fixed scanline overlay and puts `matrix-grid` on `<body>` (1.1).
4. **Fetch handlers trust every response.** The handlers call `res.json()` without checking `res.ok` and store the body as challenge data. Their `catch` blocks only play a sound, so 429 and 400 bodies become empty instances (1.10, 1.11, 1.18). Counts are string literals rather than values derived from the response (1.9). Loading flags change `disabled` but not the label (1.12).
5. **Effects are on by default.** `SoundEngine.enabled` and `soundEnabled` both start as `true` (1.25). `canvas-confetti` fires on every accepted flag, and `scrollIntoView({ behavior: "smooth" })` ignores the motion preference (1.26, 1.27). The `viewport` export sets `maximumScale: 1` (1.28).
6. **Missing semantics.** Inputs carry only `placeholder` (1.30). The header and footer sit inside `<main>`, with no `<nav>` and no gate headings (1.31). There is no `aria-live` region (1.32). Scoreboard chips differ only by background color (1.33).
7. **Lint debt in UI code.** `catch (e: any)` and `useState<any>` cause the `no-explicit-any` errors. Literal quotes in JSX cause `no-unescaped-entities`. The skill fetch in an effect sets state synchronously. There are also unused imports and variables (1.35).

The exploration tests confirm or refute each of these hypotheses. Hypothesis 4 is checked by X13 and X14, which inject a network failure and a 429 body.

## Correctness Properties

Property 1: Bug Condition - The UI shows no defect marker

_For any_ UI observation X where the bug condition holds on the bug baseline (isBugCondition(X) is true on F_bug), the fixed system F' SHALL satisfy expectedBehavior(X). Every defect marker X01 to X38 SHALL be absent and its 2.x assertion SHALL hold, at each viewport and motion setting where the marker applies.

**Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9, 2.10, 2.11, 2.12, 2.13, 2.14, 2.15, 2.16, 2.17, 2.18, 2.19, 2.20, 2.21, 2.22, 2.23, 2.24, 2.25, 2.26, 2.27, 2.28, 2.29, 2.30, 2.31, 2.32, 2.33, 2.34, 2.35**

Property 2: Preservation - The agent surface and visitor flows are unchanged

_For any_ input where the bug condition does not hold (agent and solver traffic to `/api/*`, `/api/skill`, and `/skill.md`, the frozen files, and the visitor flows in 3.4 to 3.18), F' SHALL produce the same observable result as F_api (c6d13ea). This means:

- frozen files byte-identical to c6d13ea
- the same status codes and the same response shapes and values, apart from random fields
- the same skill.md bytes and headers
- four accepted solver flags and a Proof-of-Pwn badge
- the same information in each visitor flow

```
FOR ALL x WHERE NOT isBugCondition(x) DO
  ASSERT normalize(F_api(x)) = normalize(F'(x))   // normalize drops random fields only
END FOR
```

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.11, 3.12, 3.13, 3.14, 3.15, 3.16, 3.17, 3.18, 3.19**

Property 3: Preservation - Console commands return equivalent information

_For any_ command c from the console domain, F' SHALL return the same information as the baseline oracle. The domain is `help`, `gates`, `solve`, `solve 0` to `solve 9`, `leaderboard`, `clear`, and arbitrary unknown words, each in any letter case, with optional surrounding whitespace and single spaces between words. `leaderboard` runs against any generated standings list. `runConsoleCommand(c, context)` SHALL equal `baselineConsole(c, standings)` on these facts: clear or not; the command list for `help`; each gate's number, name, points, endpoint, and TTL for `gates`; the per-gate hint facts for `solve N`; rank, handle, score, and gates per entry in order for `leaderboard`, or an empty message; and usage help for unknown commands and an invalid `solve`. No phrase banned by 2.21 or 2.22 SHALL appear.

**Validates: Requirements 3.10, 2.21, 2.22, 2.23**

Property 4: Preservation - The handle check agrees with the server's cleanup

_For any_ string s, `validateHandle(s)` SHALL accept s exactly when the server's cleanup records the trimmed s unchanged and non-empty. The cleanup is `String(s).trim().replace(/[^a-zA-Z0-9_\-\.]/g, "").slice(0, 24)`, copied verbatim from src/app/api/scoreboard/route.ts, and the condition is `clean(s) = s.trim() AND clean(s) ≠ ""`. Equivalently, the trimmed s matches `^[A-Za-z0-9_.-]{1,24}$`.

**Validates: Requirements 2.15, 2.16, 3.4**

Property 5: Preservation - Gate payloads keep trimming and pass-through

_For any_ Gate 2 values (a, b, c) and Gate 4 key k with arbitrary surrounding whitespace, the submitted JSON body SHALL be `{ sessionToken, predictions: [a.trim(), b.trim(), c.trim()] }` in the order X5, X6, X7, and `{ sessionToken, keyHex: k.trim() }`. _For any_ Gate 3 text t: if `JSON.parse(t)` throws, the system SHALL send no request and return exactly "Malformed assignment array. Expected valid JSON format.". Otherwise the body's `assignment` SHALL deep-equal `JSON.parse(t)`, including boolean arrays, signed-literal arrays, and non-array JSON values.

**Validates: Requirements 3.7, 3.8, 3.9**

## Fix Implementation

### Visual System

The look is a quiet developer tool: graphite surfaces separated by lightness and 1px lines, one cool "ice" accent reserved for actions, links, focus, and the current view, and a sans/mono split so prose reads as prose and data reads as data. Nothing decorates. Hierarchy comes from type size, weight, and spacing.

Everything below was checked against the installed packages: tailwindcss 4.3.3 (compiled with `@tailwindcss/node`), next 16.4.3 (font-data.json and the bundled metadata docs), and lucide-react 1.66.0 (named exports). These checks are covered under (fixes) 2.1 to 2.5 and 2.24 to 2.27.

#### Tokens

**Color space.** Tokens are authored in OKLCH, the color space Tailwind v4 uses for its own palette. Every value was converted to sRGB and lies inside the sRGB gamut, so all displays render the same color and the contrast figures below hold. The hex column is the 8-bit sRGB rendering used for the contrast math and for the favicon file.

| Token (Tailwind class stem) | OKLCH | Hex | Role |
|---|---|---|---|
| `canvas` | `oklch(0.185 0.005 260)` | #111315 | Page background, header, footer |
| `surface` | `oklch(0.218 0.006 260)` | #181a1d | Raised panels, cards, table header, dialog |
| `inset` | `oklch(0.155 0.005 260)` | #0b0c0e | Inputs, code blocks, inline code, console |
| `surface-hover` | `oklch(0.255 0.007 260)` | #212326 | Hover fill, nav current fill, HTTP method badge |
| `line` | `oklch(0.300 0.008 260)` | #2b2e32 | Subtle borders and dividers (decorative, not a control boundary) |
| `line-control` | `oklch(0.560 0.010 260)` | #71757a | Boundaries of inputs and secondary buttons |
| `fg` | `oklch(0.955 0.003 260)` | #eff0f2 | Primary text, headings, values |
| `fg-secondary` | `oklch(0.800 0.008 260)` | #bbbec3 | Descriptions, nav items, quiet buttons |
| `fg-muted` | `oklch(0.710 0.010 260)` | #9ea2a8 | Lowest allowed text: meta, hints, placeholders, table headers, footer |
| `fg-disabled` | `oklch(0.500 0.008 260)` | #616368 | Disabled labels only (exempt from contrast) |
| `accent` | `oklch(0.790 0.110 225)` | #62c9f0 | Primary fill, links, live badge, current-view bar |
| `accent-hover` | `oklch(0.850 0.090 225)` | #8adbfa | Primary hover, link hover |
| `accent-active` | `oklch(0.730 0.115 225)` | #45b6de | Primary pressed |
| `on-accent` | `oklch(0.180 0.020 240)` | #09131a | Text and icons on accent fills |
| `accent-subtle` | `oklch(0.300 0.050 225)` | #0a3341 | Live badge background, `::selection` |
| `success` | `oklch(0.790 0.150 150)` | #6bd586 | Solved, accepted, copied |
| `success-subtle` | `oklch(0.270 0.045 150)` | #152d1a | Success badge and result panel background |
| `error` | `oklch(0.740 0.140 25)` | #f7857d | Rejected, field errors, server and network errors, copy failed |
| `error-subtle` | `oklch(0.270 0.055 25)` | #3d1b18 | Error badge and result panel background |
| `warning` | `oklch(0.840 0.130 75)` | #fcbe62 | Expiring countdown, expired, blocked by filter |
| `warning-subtle` | `oklch(0.280 0.045 75)` | #36250d | Warning badge and result panel background |
| `focus` | `oklch(0.850 0.090 225)` | #8adbfa | Focus ring (same value as `accent-hover`, separate token so it can change independently) |
| `backdrop` | `oklch(0.100 0.004 260 / 0.75)` | n/a | Dialog `::backdrop` |

Neutrals carry a trace of blue (chroma 0.005 to 0.010) so they read as graphite rather than GitHub's saturated navy (#0d1117, #161b22). The accent at hue 225 sits between cyan and blue, away from GitHub's link blue (#58a6ff, hue about 255), the old neon green, and the purple gradients typical of generated UIs. Rejected: periwinkle accent (reads as generic AI branding); signal orange (too close to the error and warning hues).

**Definition in globals.css.** src/app/globals.css is replaced in full. It is the only place raw color values exist in UI code.

```css
@import "tailwindcss";

@theme {
  /* Remove Tailwind defaults so only these tokens generate utilities (2.2). */
  --color-*: initial;
  --radius-*: initial;
  --shadow-*: initial;
  --text-*: initial;

  --color-canvas: oklch(0.185 0.005 260);
  --color-surface: oklch(0.218 0.006 260);
  --color-inset: oklch(0.155 0.005 260);
  --color-surface-hover: oklch(0.255 0.007 260);
  --color-line: oklch(0.300 0.008 260);
  --color-line-control: oklch(0.560 0.010 260);
  --color-fg: oklch(0.955 0.003 260);
  --color-fg-secondary: oklch(0.800 0.008 260);
  --color-fg-muted: oklch(0.710 0.010 260);
  --color-fg-disabled: oklch(0.500 0.008 260);
  --color-accent: oklch(0.790 0.110 225);
  --color-accent-hover: oklch(0.850 0.090 225);
  --color-accent-active: oklch(0.730 0.115 225);
  --color-on-accent: oklch(0.180 0.020 240);
  --color-accent-subtle: oklch(0.300 0.050 225);
  --color-success: oklch(0.790 0.150 150);
  --color-success-subtle: oklch(0.270 0.045 150);
  --color-error: oklch(0.740 0.140 25);
  --color-error-subtle: oklch(0.270 0.055 25);
  --color-warning: oklch(0.840 0.130 75);
  --color-warning-subtle: oklch(0.280 0.045 75);
  --color-focus: oklch(0.850 0.090 225);
  --color-backdrop: oklch(0.100 0.004 260 / 0.75);

  --radius-sm: 4px;
  --radius-md: 6px;
  --radius-lg: 10px;

  --shadow-dialog: 0 24px 48px -16px oklch(0 0 0 / 0.6);

  /* Type scale: see the Type scale table. */
  --text-caption: 0.75rem;     --text-caption--line-height: 1rem;
  --text-ui: 0.875rem;         --text-ui--line-height: 1.25rem;
  --text-body: 1rem;           --text-body--line-height: 1.625rem;
  --text-title: 1.125rem;      --text-title--line-height: 1.625rem;  --text-title--font-weight: 600;
  --text-heading: 1.375rem;    --text-heading--line-height: 1.875rem; --text-heading--font-weight: 600; --text-heading--letter-spacing: -0.01em;
  --text-page-title: 1.75rem;  --text-page-title--line-height: 2.25rem; --text-page-title--font-weight: 600; --text-page-title--letter-spacing: -0.015em;
  --text-page-title-lg: 2rem;  --text-page-title-lg--line-height: 2.5rem; --text-page-title-lg--font-weight: 600; --text-page-title-lg--letter-spacing: -0.015em;
  --text-display: 2.25rem;     --text-display--line-height: 2.75rem; --text-display--font-weight: 600; --text-display--letter-spacing: -0.02em;
  --text-display-lg: 3rem;     --text-display-lg--line-height: 3.5rem; --text-display-lg--font-weight: 600; --text-display-lg--letter-spacing: -0.025em;
  --text-code-sm: 0.75rem;     --text-code-sm--line-height: 1rem;
  --text-code: 0.875rem;       --text-code--line-height: 1.375rem;
  --text-code-inline: 0.9375em;

  --tracking-label: 0.06em;

  --ease-standard: cubic-bezier(0.2, 0, 0, 1);
  --animate-enter: enter 160ms var(--ease-standard) both;
  --animate-dialog-in: dialog-in 180ms var(--ease-standard) both;
  @keyframes enter { from { opacity: 0; transform: translateY(4px); } }
  @keyframes dialog-in { from { opacity: 0; transform: translateY(8px); } }
}

/* next/font sets these variables on <html>; inline so utilities reference them directly. */
@theme inline {
  --font-sans: var(--font-plex-sans), ui-sans-serif, system-ui, sans-serif;
  --font-mono: var(--font-plex-mono), ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
}

@layer base {
  html {
    color-scheme: dark;
    background-color: var(--color-canvas);
    color: var(--color-fg);
    scrollbar-color: var(--color-line-control) var(--color-canvas);
    -webkit-text-size-adjust: 100%;
  }
  body {
    font-family: var(--font-sans);
    font-size: var(--text-ui);
    line-height: var(--text-ui--line-height);
    -webkit-font-smoothing: antialiased;
  }
  ::selection { background-color: var(--color-accent-subtle); color: var(--color-fg); }
  :focus-visible { outline: 2px solid var(--color-focus); outline-offset: 2px; }
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after {
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.01ms !important;
      scroll-behavior: auto !important;
    }
  }
}
```

**Clearing the defaults (verified).** Compiling this `@theme` with tailwindcss 4.3.3 produced no `--color-zinc-*` or `--color-red-*` variables. `text-zinc-500`, `bg-red-400`, `text-white`, `bg-black`, `text-sm`, `text-xs`, and `shadow-md` generated nothing. The token utilities did generate: `bg-canvas`, `text-fg`, `bg-accent/20`, `border-success/35`, `stroke-accent`, `aria-invalid:border-error`, `backdrop:bg-backdrop`, `text-heading` (size, line-height, weight, and tracking), `rounded-md`, `shadow-dialog`, `ease-standard`, `tracking-label`, and `motion-safe:animate-enter` with its keyframes. Built-in keywords still work: `bg-transparent`, `border-current`, `text-inherit`, `rounded-none`, and `rounded-full`. Tailwind's default font-weight, spacing, container, and breakpoint scales stay (`font-medium`, `max-w-6xl`, `sm:`/`lg:`).

**Enforcement.** Clearing the palette can't block arbitrary values such as `text-[10px]` or `bg-[#123456]`, which still compile. The verification step runs this search over UI code, and it must return no matches:

```
rg -n --glob "src/**/*.{ts,tsx,css}" --glob "!src/app/api/**" --glob "!src/lib/{challenges,crypto,ratelimit}.ts" --glob "!src/app/globals.css" -e "#[0-9a-fA-F]{3,8}\b" -e "\b(rgb|rgba|hsl|oklch)\(" -e "-\[#" -e "\b(text|bg|border|ring|fill|stroke)-(zinc|slate|gray|neutral|stone|red|green|emerald|blue|cyan|yellow|amber)-\d" -e "text-\[\d" -e "scanlines|matrix-grid|glow|bg-gradient|bg-clip-text"
```

A match on `#` that is a URL fragment (for example `href="#gate-3"`) is reviewed by hand and allowed.

#### Contrast

Ratios use the WCAG 2.x relative-luminance formula on the hex values above and were computed with a node script. Every pairing the UI uses is listed. All pass.

| Foreground | Background | Ratio | Minimum | Result | Where |
|---|---|---|---|---|---|
| fg | canvas | 16.33 | 4.5 | Pass | Body text, headings |
| fg | surface | 15.29 | 4.5 | Pass | Card and dialog text |
| fg | inset | 17.16 | 4.5 | Pass | Input values, code |
| fg | surface-hover | 13.82 | 4.5 | Pass | Hovered and current nav item, method badge |
| fg | accent-subtle | 11.78 | 4.5 | Pass | Selected text |
| fg | success-subtle | 12.95 | 4.5 | Pass | Accepted result message |
| fg | error-subtle | 13.46 | 4.5 | Pass | Rejected or error result message |
| fg | warning-subtle | 12.90 | 4.5 | Pass | Blocked or expired result message |
| fg-secondary | canvas | 9.99 | 4.5 | Pass | Descriptions, nav items |
| fg-secondary | surface | 9.35 | 4.5 | Pass | Card descriptions |
| fg-secondary | inset | 10.50 | 4.5 | Pass | Unsolved badge, console output |
| fg-secondary | surface-hover | 8.45 | 4.5 | Pass | Quiet button on hover fill |
| fg-secondary | success-subtle | 7.92 | 4.5 | Pass | Result panel detail text |
| fg-secondary | error-subtle | 8.23 | 4.5 | Pass | Result panel detail text |
| fg-secondary | warning-subtle | 7.89 | 4.5 | Pass | Result panel detail text |
| fg-muted | canvas | 7.26 | 4.5 | Pass | Meta, hints, footer |
| fg-muted | surface | 6.80 | 4.5 | Pass | Table headers, card meta |
| fg-muted | inset | 7.63 | 4.5 | Pass | Placeholders, console prompt |
| fg-muted | surface-hover | 6.14 | 4.5 | Pass | Meta on hover fill |
| accent | canvas | 9.87 | 4.5 | Pass | Links |
| accent | surface | 9.24 | 4.5 | Pass | Links in cards |
| accent | inset | 10.37 | 4.5 | Pass | Links in code areas |
| accent | surface-hover | 8.35 | 4.5 | Pass | Link on hover fill |
| accent | accent-subtle | 7.12 | 4.5 | Pass | Live badge |
| accent-hover | canvas | 12.05 | 4.5 | Pass | Link hover |
| accent-hover | surface | 11.29 | 4.5 | Pass | Link hover in cards |
| success | canvas | 10.19 | 4.5 | Pass | "Copied", solved text |
| success | surface | 9.54 | 4.5 | Pass | "Copied" in cards |
| success | inset | 10.70 | 4.5 | Pass | Console success lines |
| success | success-subtle | 8.08 | 4.5 | Pass | Solved and accepted badges |
| error | canvas | 7.63 | 4.5 | Pass | Field errors, "Copy failed" |
| error | surface | 7.15 | 4.5 | Pass | Field errors in cards |
| error | inset | 8.02 | 4.5 | Pass | Console error lines |
| error | error-subtle | 6.29 | 4.5 | Pass | Rejected and error badges |
| warning | canvas | 11.24 | 4.5 | Pass | Expiring countdown |
| warning | surface | 10.53 | 4.5 | Pass | Expiring countdown in cards |
| warning | inset | 11.82 | 4.5 | Pass | Console warning lines |
| warning | warning-subtle | 8.88 | 4.5 | Pass | Expired and blocked badges |
| on-accent | accent | 9.94 | 4.5 | Pass | Primary button label |
| on-accent | accent-hover | 12.14 | 4.5 | Pass | Primary button label, hover |
| on-accent | accent-active | 8.04 | 4.5 | Pass | Primary button label, pressed |
| line-control | canvas | 4.01 | 3 | Pass | Control boundary on page |
| line-control | surface | 3.76 | 3 | Pass | Control boundary in cards |
| line-control | inset | 4.22 | 3 | Pass | Input border against its own fill |
| line-control | surface-hover | 3.40 | 3 | Pass | Secondary button border against its hover fill |
| focus | canvas | 12.05 | 3 | Pass | Focus ring on page |
| focus | surface | 11.29 | 3 | Pass | Focus ring in cards and dialog |
| focus | inset | 12.67 | 3 | Pass | Focus ring in console and code areas |
| focus | surface-hover | 10.20 | 3 | Pass | Focus ring next to hover fills |
| accent | canvas | 9.87 | 3 | Pass | Primary fill boundary, current-view bar |
| accent | surface | 9.24 | 3 | Pass | Primary fill boundary in cards |
| error | inset | 8.02 | 3 | Pass | Invalid input border |
| error | surface | 7.15 | 3 | Pass | Invalid input border vs card |

The focus ring sits 2px outside the element, so its neighbours are the parent surface on both sides, never the element's own fill. `line` (#2b2e32) is decorative and never the only boundary of a control. `fg-disabled` measures 3.10 on canvas and 2.62 on surface-hover, which WCAG exempts for disabled controls. Badge backgrounds and their `/35` borders are decorative, because the badge text carries the status.

#### Typefaces

- **UI text: IBM Plex Sans**, variable (`wght` 100 to 700; uses 400, 500, 600). It was drawn for IBM's technical and enterprise products. It has open apertures that stay legible at 14px on dark backgrounds, and its slightly engineered grotesque reads as a security tool rather than a consumer app.
- **Code and data: IBM Plex Mono**, static weights 400 and 500. It belongs to the same superfamily, so x-height and stroke weight match Plex Sans when the two sit in one line (endpoint rows, inline code, badges). It has a dotted zero and distinct `1 l I`, which matters for hex keys, flags, and session tokens.
- Rejected: Geist (starter default); Inter (the most common default, so it reads as unconsidered); JetBrains Mono (good, but its larger x-height clashes with Plex Sans inline).

Both exist in `node_modules/next/dist/compiled/@next/font/dist/google/font-data.json` with the weights needed and a `latin` subset. `IBM_Plex_Sans` and `IBM_Plex_Mono` are exported from next/font/google (`IBM_Plex_Mono` requires `weight` because it isn't variable).

```ts
// src/app/layout.tsx
import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";

const plexSans = IBM_Plex_Sans({ subsets: ["latin"], variable: "--font-plex-sans", display: "swap" });
const plexMono = IBM_Plex_Mono({
  subsets: ["latin"], weight: ["400", "500"], variable: "--font-plex-mono", display: "swap",
  fallback: ["ui-monospace", "SFMono-Regular", "Menlo", "Consolas", "monospace"],
});
// <html lang="en" className={`${plexSans.variable} ${plexMono.variable}`}>
```

The font variables go on `<html>` so the `@theme inline` font tokens and the base `body` rule both resolve. next/font downloads the files at `next build` and serves them from the site, so visitors make no requests to Google. That is fine on Vercel. A local `npm run build` needs network access to fonts.googleapis.com and fonts.gstatic.com, and fails without it. Rejected alternative: next/font/local with @fontsource packages (adds two dependencies to avoid a network fetch the deploy target already allows).

#### Type scale

Sans unless marked mono. Weights come from the token where listed. Otherwise the class adds `font-medium` (500) or `font-semibold` (600).

| Token | Size / line-height | Weight | Tracking | Usage |
|---|---|---|---|---|
| `text-display` → `lg:text-display-lg` | 36/44 → 48/56 | 600 | -0.02em → -0.025em | Overview h1 only |
| `text-page-title` → `sm:text-page-title-lg` | 28/36 → 32/40 | 600 | -0.015em | h1 of Gates, Scoreboard, Docs, Console pages |
| `text-heading` | 22/30 | 600 | -0.01em | h2: sections, docs h2, gate page sections |
| `text-title` | 18/26 | 600 | 0 | h3: gate cards on Overview, dialog title, docs h3 |
| `text-body` | 16/26 | 400 | 0 | Prose: Overview intro, gate descriptions, docs paragraphs and lists |
| `text-ui` | 14/20 | 400; 500 for labels, buttons, nav | 0 | Default UI text: labels, buttons, nav, table cells, hints, messages, footer |
| `text-caption` | 12/16 | 500 | 0; `tracking-label` (0.06em) when uppercase | Badges, table column headers (uppercase), the "Gate 1" eyebrow |
| `text-code` (mono) | 14/22 | 400; 500 for values | 0 | Code blocks, endpoints, flags, hex, tokens, console input and output, countdown, scores, ranks, points |
| `text-code-sm` (mono) | 12/16 | 500 | 0 | HTTP method badge, points and TTL chips |
| `text-code-inline` (mono) | 0.9375em, inherits | inherits | 0 | Inline code (15px in 16px prose, 13.1px in 14px UI text) |

Rules:
- Nothing renders below 12px. Body and UI text is 14px or larger.
- Docs h4 and below use `text-ui font-semibold`.
- All-caps appears only in the AGENTGATE wordmark, HTTP methods (GET, POST), and table column headers. Headings are sentence case.
- Points, scores, ranks, countdowns, and gate counts are set in Plex Mono with `tabular-nums`. Mono digits are fixed-width whatever the font's OpenType features, so columns and the ticking countdown don't shift.

#### Spacing and layout

- **Spacing scale.** Tailwind's 4px step (`--spacing: 0.25rem`, unchanged), limited to 0.5, 1, 1.5, 2, 3, 4, 5, 6, 8, 10, 12, 16 (2 to 64px). Control internals use 1 to 4. Card padding uses 4 and 6. Section gaps use 8, 12, and 16.
- **Radius.** `rounded-sm` 4px for badges and inline code; `rounded-md` 6px for buttons, inputs, nav items, and code blocks; `rounded-lg` 10px for cards, panels, the table wrapper, and the dialog. No pill shapes.
- **Borders.** 1px everywhere. 2px only for the focus outline and the current-view bar. No colored left-border stripes on cards.
- **Content width.** Page container `mx-auto w-full max-w-6xl` (1152px). Docs prose and the Overview intro `max-w-2xl` (672px, about 75 characters at 16px). Docs code blocks and tables can use the full container width and scroll inside themselves.
- **Gutters.** `px-4` (16px) below 640px, giving a 328px content box at 360px; `sm:px-6` (24px); `lg:px-8` (32px).
- **Vertical rhythm.** Header 56px (`h-14`). Space between page title and content `mt-6`. Between sections `gap-12`, `lg:gap-16`. Inside cards `gap-4`.
- **Shell rows (R3).** At every width the shell is two rows: the header row (brand and actions), then the nav row. The nav list is `flex flex-wrap gap-1` and every item is `whitespace-nowrap`. Labels then never wrap or clip at 360px, and if the five items don't fit on one line the list wraps onto a second line.
- **Gate page.** At `lg` and above, two columns: reference (description, endpoints, payload fields) and try-it, split 5:7. Single column below `lg`.
- **Elevation.** Lightness steps only: inset < canvas < surface < surface-hover. The dialog is the only element with a drop shadow (`shadow-dialog`, black, no hue). The one colored shadow is the approved accent halo (`shadow-glow`, `shadow-glow-strong`, see 2.1), limited to primary actions, the current nav and gate item, the wordmark, the hero rule, and hovered gate cards. No hover lifts or blurs.

#### Control variants and states

Shared rules:
- Every focusable element gets the global `:focus-visible` ring (2px `focus`, offset 2px). Components don't remove it or restyle it.
- Every transition is `transition-colors duration-120 ease-standard`.
- Button sizes: `md` is `h-9 px-4 gap-2` and `sm` is `h-8 px-3 gap-1.5`. Labels are `text-ui font-medium`, icons `size-4`.
- At most one primary per gate, form, or section. In a gate's try-it area the primary is "Request instance" when idle or expired, and "Submit" while an instance is live. The request control then becomes secondary ("Request new instance"). In the flag form the primary is "Submit flag". On Overview it is the "Read the docs" link styled as primary. The header "Submit flag" button is secondary so it doesn't compete with page primaries.
- Busy controls (R2) carry `aria-disabled="true"` and `data-busy`, not the native `disabled` attribute, so they keep focus. Their click and submit handlers return early while busy. Native `disabled` is used only for controls that are unavailable, such as Submit on an expired instance. Busy styles are written as `data-busy:*`, so a busy control keeps its normal colors with `cursor-progress` and doesn't look unavailable. Tests accept either attribute as "disabled".

| Control | Default | Hover | Focus-visible | Active | Disabled | Busy |
|---|---|---|---|---|---|---|
| Primary button | `bg-accent text-on-accent` | `bg-accent-hover` | Ring | `bg-accent-active` | `bg-surface-hover text-fg-disabled border border-line cursor-not-allowed` | Default colors; label becomes the busy text ("Requesting instance…", "Submitting…", "Sending…"); `LoaderCircle` `size-4 motion-safe:animate-spin` replaces the leading icon |
| Secondary button | `bg-surface text-fg border border-line-control` | `bg-surface-hover border-fg-muted` | Ring | `bg-inset` | Same as primary disabled | Same pattern as primary |
| Quiet button | `bg-transparent text-fg-secondary` | `bg-surface-hover text-fg` | Ring | `bg-line text-fg` | `text-fg-disabled bg-transparent` | n/a |
| Icon button | Quiet geometry `size-9` (`size-8` in dense rows), icon `size-4`, `aria-label` required | Quiet hover | Ring | Quiet active | Quiet disabled | n/a |
| Sound toggle (R9) | `<button aria-pressed="false" aria-label="Sound effects">` on load. `VolumeX` plus visible "Sound off" from `sm` up, `Volume2` plus "Sound on" when pressed. The icon and the visible text are `aria-hidden`, so the name stays "Sound effects" and `aria-pressed` carries the state | Quiet hover | Ring | Quiet active | n/a | n/a |
| Text input | `h-9 w-full rounded-md border border-line-control bg-inset px-3 text-ui text-fg placeholder:text-fg-muted`; data fields (flag, hex key, predictions, console) add `font-mono text-code` | `border-fg-muted` | Ring (border unchanged) | n/a | `bg-canvas border-line text-fg-disabled cursor-not-allowed` | n/a |
| Textarea | Text input styles plus `min-h-24 py-2 resize-y`; Gate 1 prompt in sans, Gate 3 assignment in mono | Same | Ring | n/a | Same | n/a |
| Validation error | `aria-invalid:border-error` on the field. Below it: `mt-1.5 flex gap-1.5 text-ui text-error` with `CircleX` `size-4` and text such as "Agent handle is required", linked by `aria-describedby` | n/a | Ring | n/a | n/a | n/a |
| Field label and hint | Label `text-ui font-medium text-fg mb-1.5`. Hint `text-ui text-fg-muted mt-1.5`, for example "16 hex characters" | n/a | n/a | n/a | n/a | n/a |
| Nav item | `relative h-9 px-3 rounded-md text-ui font-medium text-fg-secondary whitespace-nowrap` (`px-2` below 640px) | `bg-surface-hover text-fg` | Ring | `bg-line` | n/a | n/a |
| Nav item, current | `aria-current="page"`: `text-fg bg-surface-hover font-semibold`, plus a 2px bar `after:absolute after:inset-x-3 after:bottom-1 after:h-0.5 after:rounded-full after:bg-accent`. The bar and weight are the non-color cues | Same | Ring | Same | n/a | n/a |
| Copy control (R8) | Secondary `sm`, `min-w-24` so the width doesn't change: `Copy` icon + "Copy" (or "Copy URL", "Copy flag", "Copy badge", "Copy skill.md"). The accessible name is constant and starts with "Copy" | Secondary hover | Ring | Secondary active | Native `disabled` until hydration, detected with `useSyncExternalStore` (server snapshot false, client snapshot true) | n/a |
| Copy control, copied | `Check` icon + "Copied" in an `aria-hidden` span, `text-success`, for 2000ms, then idle. Shown only after the `navigator.clipboard.writeText` promise resolves. One announcement goes through the Announcer | Same | Ring | n/a | n/a | n/a |
| Copy control, failed | `CircleX` icon + "Copy failed" in an `aria-hidden` span, `text-error`, for 4000ms, then idle. Shown when the promise rejects or the Clipboard API is missing, with one announcement | Same | Ring | n/a | n/a | n/a |
| Copy control, icon-only (endpoint rows, R10) | Icon button `size-8` with `aria-label="Copy URL for POST /api/gate1/chat"`. It copies `https://ctf.hakudigital.tech` plus the path. State text "Copied" or "Copy failed" appears next to it in an `aria-hidden` span in `text-ui` with the same colors | Same | Ring | Same | n/a | n/a |
| HTTP method badge | `inline-flex h-5 items-center rounded-sm bg-surface-hover px-1.5 font-mono text-code-sm text-fg`. GET and POST are told apart by their text, not by color | n/a | n/a | n/a | n/a | n/a |
| Endpoint row | Method badge + path `font-mono text-code text-fg wrap-anywhere` + icon-only copy control, `gap-2` | n/a | n/a | n/a | n/a | n/a |
| Code block | `rounded-md border border-line bg-inset p-4 font-mono text-code text-fg whitespace-pre overflow-x-auto`. When it can scroll it gets `tabIndex={0}` and an accessible name, so it takes the ring | n/a | Ring | n/a | n/a | n/a |
| Full-response viewer | `<details>` whose summary is a quiet button "View full response (JSON)". Body is a code block with `max-h-96 overflow-auto` | Quiet hover | Ring | n/a | n/a | n/a |
| Inline code | `rounded-sm border border-line bg-inset px-1 py-px font-mono text-code-inline text-fg wrap-anywhere` | n/a | n/a | n/a | n/a | n/a |
| Link | `text-accent underline decoration-accent/40 underline-offset-4`; external links add `ExternalLink` `size-3.5` and sr-only "(opens in a new tab)" | `text-accent-hover decoration-accent-hover` | Ring | n/a | n/a | n/a |
| Table | Wrapper `overflow-x-auto rounded-lg border border-line`. `thead` `bg-surface`. `th` `h-10 px-4 text-left text-caption uppercase tracking-label text-fg-muted`. Rows `border-t border-line` on canvas, `td` `h-12 px-4 text-ui text-fg`. Numeric cells `font-mono text-code tabular-nums text-right`. Rows aren't interactive, so they have no hover. Empty state: one row, `text-fg-muted` | n/a | n/a | n/a | n/a | n/a |
| Card / panel | `rounded-lg border border-line bg-surface p-4 sm:p-6` | No hover. A card that is a link uses `hover:border-line-control` and the ring | Ring (link cards) | n/a | n/a | n/a |
| Result panel | `rounded-lg border p-4 motion-safe:animate-enter`. Accepted: `border-success/50 bg-success-subtle`. Rejected and errors: `border-error/50 bg-error-subtle`. Blocked and expired: `border-warning/50 bg-warning-subtle`. Neutral (answer with no flag): `border-line bg-inset`. First line is a status badge plus the message in `text-ui text-fg`. Flags show in a code block with a copy control and the inline flag form | n/a | n/a | n/a | n/a | n/a |
| Dialog | Native `<dialog>` opened with `showModal()`: `w-[min(30rem,calc(100vw-2rem))] rounded-lg border border-line bg-surface p-4 sm:p-6 text-fg shadow-dialog backdrop:bg-backdrop motion-safe:animate-dialog-in`. Title `text-title`; close is an icon button (`X`, "Close") at top right; actions right-aligned, one primary | n/a | Ring on contents | n/a | n/a | n/a |
| Countdown | `font-mono text-code font-medium tabular-nums text-fg`, reading "Expires in 12 s". At 5 s or less it is `text-warning` with the same wording. At 0 it is replaced by the Expired badge | n/a | n/a | n/a | n/a | n/a |

Status badges share `inline-flex h-6 items-center gap-1 rounded-sm border px-2 text-caption font-medium`. The icon is `size-3.5`, stroke 2, `aria-hidden`, and the text always states the status.

| Badge | Text | Icon | Classes |
|---|---|---|---|
| Solved | "Solved" | `CircleCheck` | `bg-success-subtle text-success border-success/35` |
| Unsolved | "Unsolved" | `Circle` | `bg-inset text-fg-secondary border-line` |
| Live | "Live" | `Timer` | `bg-accent-subtle text-accent border-accent/35` |
| Expired | "Expired" | `TimerOff` | `bg-warning-subtle text-warning border-warning/35` |
| Accepted | "Accepted" | `Check` | `bg-success-subtle text-success border-success/35` |
| Rejected | "Rejected" | `X` | `bg-error-subtle text-error border-error/35` |
| Warning | e.g. "Blocked by filter" | `TriangleAlert` | `bg-warning-subtle text-warning border-warning/35` |
| Server error | "Server error" | `CircleX` | `bg-error-subtle text-error border-error/35` |
| Network error | "Network error" | `WifiOff` | `bg-error-subtle text-error border-error/35` |
| Scoreboard gate chip | "G1" to "G4" | `CircleCheck` (solved) or `Circle` (not solved) | Solved or Unsolved classes, plus sr-only " solved" or " not solved" |

#### Iconography and brand

- **Library.** lucide-react 1.66.0. Every name used here is a verified export. Inline and button icons are `size-4` (16px), badge icons `size-3.5` (14px), stroke 2. Gate icons are `size-5` (20px) with `strokeWidth={1.75}`, in a `size-9 rounded-md border border-line bg-inset text-fg-secondary` tile. All icons are `aria-hidden` and the adjacent text names the thing.
- **Gate icons.** Each matches the task and none is a padlock or the brand mark:
  - Gate 1, guarded chat: `MessageSquareLock`
  - Gate 2, LCG prediction: `Dices`
  - Gate 3, 3-SAT: `Puzzle`
  - Gate 4, stack VM bytecode: `Cpu`
- **Brand mark.** A doorway arch standing on a baseline, drawn as an inline SVG component (src/components/brand-mark.tsx), `viewBox="0 0 32 32"`, `size-5` in the header, `aria-hidden`:
  - Arch: `<path d="M10 24V14a6 6 0 0 1 12 0v10" fill="none" strokeWidth={3} strokeLinecap="round" className="stroke-accent" />`
  - Baseline: `<path d="M6.5 24h19" fill="none" strokeWidth={2.5} strokeLinecap="round" className="stroke-fg" />`
- **Wordmark.** Mark + "AGENTGATE" in `font-mono text-ui font-medium tracking-label text-fg`, `gap-2`. The pair is the home link (accessible name "AGENTGATE"). The Haku Digital credit lives in the footer (3.13), not beside the wordmark.
- **Favicon.** App Router icon file convention, checked in `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/01-metadata/app-icons.md`. `icon` accepts `.svg` anywhere under `app/`, and Next emits `<link rel="icon" href="/icon.svg?<hash>" type="image/svg+xml" sizes="any">`. `favicon` accepts only `.ico`. Delete src/app/favicon.ico (the Next.js default, bug 1.24) and add src/app/icon.svg:

  ```svg
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
    <rect width="32" height="32" rx="7" fill="#111315"/>
    <path d="M10 24V14a6 6 0 0 1 12 0v10" fill="none" stroke="#62c9f0" stroke-width="3" stroke-linecap="round"/>
    <path d="M6.5 24h19" fill="none" stroke="#eff0f2" stroke-width="2.5" stroke-linecap="round"/>
  </svg>
  ```

  The colors are the sRGB renderings of `canvas`, `accent`, and `fg`. An asset file can't read CSS variables, so literal hex is used and the file is excluded from the raw-color search. The dark rounded square keeps the mark visible on light browser tab strips (accent on canvas 9.87:1). Once favicon.ico is gone, browsers that still probe `/favicon.ico` get a 404, which is harmless.

#### Motion

- **Durations and easing.**
  - 120ms for color, background, and border changes on hover and press.
  - 160ms for a result panel or error message appearing (`animate-enter`: opacity 0→1, translateY 4px→0).
  - 180ms for the dialog opening (`animate-dialog-in`: opacity, translateY 8px→0). Closing is instant.
  - Easing for all of them is `--ease-standard`, cubic-bezier(0.2, 0, 0, 1).
- **What animates, all of it triggered by a state change:**
  - hover and press colors
  - result and error panels entering
  - dialog opening
  - the busy spinner (`LoaderCircle`, 1s linear rotation)
- **What doesn't animate:**
  - copy state swaps (text and icon change instantly)
  - countdown ticks (the number changes once a second, with no ring or bar animation)
  - navigation between views
  - loading states (static text such as "Loading scoreboard…", no shimmer)
  - backgrounds, the logo, and hover lifts
- **Success feedback.** An accepted flag or a returned flag shows the success result panel with its 160ms entry, inside the gate or form that produced it. Nothing animates outside that panel.
- **Reduced motion.** Under `prefers-reduced-motion: reduce`, the base-layer rule cuts every animation and transition to 0.01ms and forces `scroll-behavior: auto`. Keyframe animations are also applied only through `motion-safe:`, so the spinner stays still and the busy label carries the state. The UI never requests smooth scrolling: the console keeps its newest line in view by setting `scrollTop = scrollHeight`, without `behavior: "smooth"`.
- **Dependencies.** Remove canvas-confetti and @types/canvas-confetti (`npm uninstall canvas-confetti @types/canvas-confetti`). That leaves runtime dependencies at lucide-react, next, react, and react-dom.

#### Deliberately absent

| Bug marker | Replaced by |
|---|---|
| 1.1 Scanline overlay, grid background, glow classes, "cyber" variables, neon scrollbar | Flat `canvas`. globals.css holds only the tokens. Scrollbar `line-control` on `canvas` |
| 1.2 93 inline hex values, GitHub palette, neon #00ff66, zinc and red classes | One OKLCH token set in `@theme`, default palette cleared, raw-color search in verification |
| 1.3 Per-component button styles, grey main actions | Primary, secondary, quiet, and icon variants with full state sets. One primary per gate, form, or section |
| 1.4 100% monospace, 92.5% of text at 12px, 14px top heading | Plex Sans UI text, Plex Mono for data only, 10-step scale with 14px body and headings from 18 to 48px |
| 1.5 zinc-500 text at 3.1 to 4.2:1, dimmed further by scanlines | Lowest text `fg-muted` at 6.14:1 or more on every surface. Every pairing in the table passes |
| 1.8 Reused chip icon, near-identical padlocks | `MessageSquareLock`, `Dices`, `Puzzle`, `Cpu`; custom arch brand mark |
| 1.24 Default Next.js favicon | src/app/icon.svg with the arch mark |
| 1.26, 1.27 Full-page confetti, smooth scrolling under reduced motion | 160ms panel entry inside the result area, reduced-motion override, no smooth scrolling, canvas-confetti removed |
| 1.29 Removed outlines, 2.2:1 to 2.5:1 focus borders | Global 2px `focus` ring at 10.20:1 or more against every surface |
| 1.33 Color-only chips and countdown urgency | Badges with text and icon, "G1" chips with check or empty circle plus sr-only state, countdown wording, current-view bar |
| 1.34 Nav row overflowing at 360px | Second header row with wrapping, `whitespace-nowrap` nav items |

### Information Architecture and Routing

#### Route map

| URL | File | Rendering | Title (`metadata.title`) |
|---|---|---|---|
| `/` | src/app/page.tsx | static, server component | default title from layout |
| `/gates` | src/app/gates/page.tsx | calls `redirect("/gates/1")` | none |
| `/gates/1` to `/gates/4` | src/app/gates/[gate]/page.tsx | static via `generateStaticParams`, `dynamicParams = false` | `Gate N: <name>` |
| `/gates/<anything else>` | same file | 404 from `dynamicParams = false`, with `notFound()` as a second guard | |
| `/scoreboard` | src/app/scoreboard/page.tsx | static shell, client view loads data | `Scoreboard` |
| `/docs` | src/app/docs/page.tsx | static, reads public/skill.md at build time | `Docs` |
| `/console` | src/app/console/page.tsx | static shell, client view | `Console` |
| any other path | src/app/not-found.tsx | rendered inside the root layout | `Page not found` |

The layout sets `title: { default: "AGENTGATE CTF by Haku Digital", template: "%s · AGENTGATE CTF" }`. The Copy section owns the exact strings. The App Router route announcer (`node_modules/next/dist/client/components/app-router-announcer.js`) reads `document.title` after each client navigation, so a distinct title per view is how a screen reader hears the view change.

Navigation labels and targets, in this order: Overview `/`, Gates `/gates/1`, Scoreboard `/scoreboard`, Docs `/docs`, Console `/console`. Every view is one link away from every other view through this nav, so 2.20's "one step away" holds for the gates, the scoreboard, and the documentation.

#### Next.js 16.4.3 APIs, checked against node_modules

Checked in `node_modules/next/package.json` (version 16.4.3) and the bundled docs under `node_modules/next/dist/docs/01-app/`.

- **Async `params`.** `03-api-reference/03-file-conventions/page.md` types `params` as `Promise<{ slug: string }>` and awaits it. The gate page uses `export default async function GatePage({ params }: { params: Promise<{ gate: string }> })` and `const { gate } = await params`. The global `PageProps<'/gates/[gate]'>` helper also exists, but its types are only generated by `next dev`, `next build`, or `next typegen`, so the explicit type is used and `tsc --noEmit` works on a clean checkout.
- **`generateStaticParams`.** `04-functions/generate-static-params.md`. It returns `[{ gate: "1" }, { gate: "2" }, { gate: "3" }, { gate: "4" }]`, built from `GATES` in src/lib/gates.ts.
- **`dynamicParams = false`.** `02-route-segment-config/dynamicParams.md` says params not returned by `generateStaticParams` return 404. The same file says the option is unavailable when Cache Components is on. next.config.ts doesn't enable `cacheComponents`, so it applies. `/gates/0`, `/gates/5`, `/gates/01`, and `/gates/abc` all return 404.
- **`notFound()`.** `04-functions/not-found.md`. It throws, so no `return` is needed. The gate page calls it when `getGate(gate)` returns `undefined`, which covers the case where `dynamicParams` is changed later.
- **`redirect()`.** `04-functions/redirect.md`, imported from `next/navigation`. It returns a 307 by default, and its `type` argument has no effect in server components. src/app/gates/page.tsx is the single line `redirect("/gates/1")`. `permanentRedirect` (308) is rejected because browsers cache it, which makes it hard to change later.
- **`Link`.** `02-components/link.md`, from `next/link`. Defaults are `replace={false}` and `scroll={true}`, so every view switch pushes a history entry and back and forward move between views (2.20). Prefetch stays at its default.
- **`usePathname`.** `04-functions/use-pathname.md`. It is a client-only hook from `next/navigation`, and PrimaryNav and GateStepper are the only components that call it.
- **State survives client navigation.** `01-getting-started/03-layouts-and-pages.md`: "On navigation, layouts preserve state, remain interactive, and do not rerender." AppStateProvider is mounted in the root layout, so its state survives every `<Link>` navigation and back and forward. This is how 3.14 is met.
- **A full reload resets the state.** A reload, opening a URL in a new tab, or typing a URL in the address bar starts a fresh React tree. The handle, the flag field, live instances, gate inputs and results, console history, and the sound preference all return to their initial values. 3.14 only covers moves "without a full page reload", so this is allowed. Nothing is written to storage (A6).

#### Current-view marking

PrimaryNav computes the current section from `usePathname()`:

```ts
function sectionOf(pathname: string): NavKey {
  if (pathname === "/") return "overview";
  if (pathname === "/gates" || pathname.startsWith("/gates/")) return "gates";
  if (pathname === "/scoreboard") return "scoreboard";
  if (pathname === "/docs") return "docs";
  if (pathname === "/console") return "console";
  return "none"; // 404 page: no item is current
}
```

- The current item gets `aria-current="page"` when the pathname equals its `href`, and `aria-current="true"` when the pathname is only inside its section. The second case is the Gates item (href `/gates/1`) on `/gates/2` to `/gates/4`.
- The current item is shown by a 2px bar under the label and a heavier label weight as well as by color (2.33). The Visual System section picks the tokens.
- On a gate page, GateStepper (a `<nav aria-label="Gates">` inside `main`) marks the exact gate with `aria-current="page"`. The primary nav says "you are in Gates", and the stepper says "Gate 3". GatePager at the foot of the page is a separate `<nav aria-label="Gate pages">` (R3).

#### Site shell

The DOM order in src/app/layout.tsx is:

```tsx
<html lang="en" className={`${sans.variable} ${mono.variable}`}>
  <body>
    <AppStateProvider>
      <a href="#main" className="skip-link">Skip to content</a>
      <SiteHeader />                         {/* <header> landmark */}
      <PrimaryNav />                         {/* <nav aria-label="Primary"> landmark */}
      <main id="main" tabIndex={-1}>
        {children}
        <Announcer />                        {/* polite live region, visually hidden, last child of main */}
      </main>
      <SiteFooter />                         {/* <footer> landmark */}
    </AppStateProvider>
  </body>
</html>
```

Header, nav, main, and footer are siblings, as 2.31 requires (R3). AppStateProvider renders only a context provider and no wrapping element, so the four landmarks are direct children of `<body>` next to the skip link. The nav is a sibling of the header, not a child, even though the two read as one bar. A second Announcer lives inside FlagDialog's `<dialog>`, because a modal dialog makes the rest of the page inert and a live region outside it may not be read.

- **SiteHeader (row 1, 56px tall).** It holds the wordmark "AGENTGATE" on the left, a `<Link href="/">` with no h1 because each page owns its h1. On the right are the "Submit flag" button, which opens FlagDialog, and the sound toggle.
- **PrimaryNav (row 2, 44px tall).** `<nav aria-label="Primary">` with five links in a list that wraps, with a 1px divider above and below.
- **SiteFooter.** It has the line "AGENTGATE is built by Haku Digital", where "Haku Digital" links to https://hakudigital.tech with `target="_blank"`, `rel="noopener noreferrer"`, and visually hidden text "(opens in a new tab)" (2.31, 3.13). It also links to Docs (`/docs`) and the raw file (`/skill.md`, same tab). The footer makes no status claims (2.22).
- **Not sticky.** The header and nav scroll away with the page. A sticky bar would take 100px of a 780px screen on every scroll and could hide focused elements (WCAG 2.4.11).

Two rows at every width, rejected alternatives:
- One row at ≥1024px. Brand, nav, and actions need the nav between two parts of `<header>`, so either the DOM order and visual order differ (2.29) or `display: contents` removes the header landmark in some browsers.
- A hamburger menu at 360px. It hides the nav and makes every view two steps away.
- A horizontally scrolling tab strip. Partly visible labels count as clipped (2.34).

#### 360px width arithmetic

The page gutter is 16px on each side below 640px and 24px at 640px and wider. At 360px the content box is 360 − 2 × 16 = 328px.

The earlier per-label width estimates came from the Inter metrics in `node_modules/next/dist/server/capsize-font-metrics.json`. IBM Plex Sans has no entry in that file, so the estimates don't apply and are dropped (R4). Fit at 360px rests on three things instead: every nav label and button label is `white-space: nowrap`, the nav list wraps, and X37 measures the rendered shell at 360px and at 200% zoom.

**Rule.** The nav `<ul>` uses `flex-wrap: wrap`, and each link uses `white-space: nowrap`. If the five links don't fit on one line at 360px, the list takes a second line. With 200% text-only zoom (2.28) or a 320px viewport, whole links move to a second line, and a label never breaks or clips (2.34). The page never scrolls horizontally because nothing in the shell has a fixed width.

### View Layouts

The breakpoints are Tailwind defaults: `sm` 640px and `lg` 1024px. Content is `max-width: 72rem` (1152px) and centered. "Above the fold" means a 360 × 780 viewport after the 100px shell (56 + 44), so 680px is left, plus the first 24px of top padding. Each view has exactly one h1. Sections use h2. Gate cards on the Overview and the panels inside a gate page section use h3. No heading level is skipped (2.31).

#### Overview (`/`)

Content blocks in order:
1. **Intro** (h1 "AGENTGATE", 2–3 sentences). What it is: a capture-the-flag for autonomous AI agents, with four gates covering prompt-filter evasion, LCG prediction, 3-SAT solving, and stack-VM bytecode reversing. Who it's for: people who build agents and want to test them. What the browser part is for: reading the API and inspecting live instances. The Copy section owns the wording.
2. **Connection details** (h2 "Connect an agent"). Three rows, each a label with a mono value and a CopyButton:
   - Base URL: `https://ctf.hakudigital.tech`
   - skill.md: `https://ctf.hakudigital.tech/skill.md`
   - Same file as an endpoint: `GET /api/skill`

   The values come from `BASE_URL` and `SKILL_URL` in src/lib/gates.ts and never from `window.location` (A10). The skill.md value renders as `https://ctf.hakudigital.tech/<wbr>skill.md` with `overflow-wrap: anywhere`.
3. **How an agent starts** (h2). An `<ol>` of three steps:
   1. Read skill.md, with a link to `/docs`.
   2. Call the gate endpoints and solve each instance before it expires.
   3. Submit each flag with an agent handle to `POST /api/scoreboard`, with a link to `/scoreboard`.
4. **Gates** (h2 "The four gates"). An `<ol>` of GateCard items for Gates 1 to 4 in order. Each card has an h3 "Gate N: Name", the points, the TTL ("No time limit" for Gate 1), the one-line `summary`, and a link "Open Gate N" to `/gates/N`. The whole card is not one big link: only the title and the "Open" text are links, so the link names stay short.

Grid:
- **≥1024px**, 12 columns, 24px gap:
  - Row A: intro in columns 1–7 (text at most 65ch), connection details card in columns 8–12.
  - Row B: steps as 3 equal columns.
  - Row C: gates as 4 equal columns, read left to right as 1 → 4.
- **360px**, 1 column, 24px between blocks: intro, connection details, steps, gates. The DOM order matches the visual order at both widths.

Above the fold at 360 × 780, estimated: the intro ends near y = 296px, and the connection card runs from about 320px to 520px. The steps heading and the first two steps follow, up to about 780px. So what AGENTGATE is, who it's for, both URLs with copy controls, and the start of "how an agent starts" are visible before any scrolling (2.6). There is no flag form on this view (2.7). It is reachable from the header button.

URL fit at 360px: the connection card is 328 − 2 × 16 = 296px inside. A row has a 40px CopyButton and an 8px gap, which leaves 248px for the value. At 14px mono (a 0.6em advance, so 8.4px per character), `https://ctf.hakudigital.tech` is 28 characters, or 235px, and fits. The skill.md URL is 37 characters, or 311px, so it breaks after the last `/` into `https://ctf.hakudigital.tech/` (29 characters, 243.6px) and `skill.md`.

#### Gate page (`/gates/N`)

Content blocks in order:
1. **GateStepper.** `<nav aria-label="Gates">` with four links, "Gate 1" to "Gate 4". The current gate has `aria-current="page"`. The list wraps, and labels don't.
2. **Heading.** h1 "Gate N: Name", with the name as the API gives it (A14). A line under it gives the points ("2,500 points"), the TTL ("Instances expire after 10 s"; Gate 1 has "No time limit"), and the label "Difficulty: Hell".
3. **Description** (`GateMeta.description`). Plain text that matches the API's behavior at c6d13ea and skill.md (2.22). For Gate 2 it says the outputs are truncated and that A and C are given. For Gate 1 it states the four checks, including the proof-of-work rule (2.8).
4. **Endpoints** (h2). A `<ul>` with one row per endpoint: the method as a text badge (`GET` / `POST`), the path in mono, a short purpose ("Get an instance" / "Submit an answer"), and a CopyButton. CopyButton copies the absolute production URL, for example `https://ctf.hakudigital.tech/api/gate2/challenge`, and its accessible name is "Copy URL for GET /api/gate2/challenge".
5. **Request payload** (h2). A `<table>` with columns Field (mono), Type, and Notes, built from `GateMeta.requestFields`. Example rows for Gate 2: `sessionToken` / string / "From the challenge response", and `predictions` / array of 3 strings / "X5, X6, X7 as decimal integers".
6. **TTL note** (Gates 2–4 only, a short callout). It says the 15 s, 10 s, or 20 s limit is sized for an agent, and that the panel below is for requesting a live instance and inspecting it, not for solving it by hand.
7. **Try-it panel** (h2 "Try it"). It is Gate1TryIt or InstanceTryIt, and its states are listed below.
8. **GatePager** (R11). `<nav aria-label="Gate pages">` with "Previous: Gate N−1: Name" and "Next: Gate N+1: Name" links. Gate 1's previous link is "Previous: Overview" and goes to `/`. Gate 4's next link is "Next: Scoreboard" and goes to `/scoreboard`.

Grid:
- **≥1024px:**
  - Blocks 1–2 span all 12 columns.
  - Columns 1–5 hold the reference: blocks 3–6.
  - Columns 6–12 hold the try-it panel (block 7). It is not sticky.
  - Block 8 spans all 12 columns.
- **360px:** one column with blocks 1 to 8 in order. The payload table has 3 columns, and the Notes column wraps.

Above the fold at 360 × 780: the stepper, heading, description, and the endpoints list. The try-it panel is below the fold on purpose: the reference comes first for agent builders, and the TTL note just above the panel explains what the panel is for.

#### Try-it panel: Gates 2–4 (InstanceTryIt)

The frame is the same for all three gates:
- **Panel header row:** the h3 "Live instance", a StatusBadge, and Countdown, both of which appear only when there is an instance.
- **Body:** gate-specific fields and inputs.
- **Action row:** the primary button and a secondary button.
- **Message area.**
- **JsonDisclosure.**

The StatusBadge always shows text: "Live", "Expiring", "Expired", "Accepted", or "Rejected" (2.33). "Expiring" applies at or below the gate's threshold in src/lib/gates.ts: 5 s for Gates 2 and 4 and 3 s for Gate 3 (R1). The countdown states are in "Countdown" under Accessibility Mechanisms (R18).

| State | Body | Primary | Secondary | Message area |
|---|---|---|---|---|
| idle | "No instance yet." | "Request instance" | none | none |
| loading, op request | "Requesting an instance…" and the panel has `aria-busy="true"` | "Requesting…", disabled | none | none |
| live | instance fields and labeled inputs | "Submit" | "Request new instance" | Gate 3 parse error, if any |
| loading, op submit | instance fields; inputs are `readOnly` | "Submitting…", disabled | disabled | none |
| expired | instance fields stay visible for inspection; inputs are `readOnly` | "Request new instance" | none; Submit disabled | "This instance expired. Request a new one to try again." |
| server-error, op request | none: no instance, countdown, or Submit (2.11) | "Try again", disabled and showing "Try again in N s" until `retryAt` (R12) | none | label "Rate limited (HTTP 429)" for 429, otherwise "Request failed", plus the server message verbatim |
| server-error, op submit | instance fields and inputs | "Submit", disabled until `retryAt` and while expired | "Request new instance" | as above |
| network-error, op request or submit | as for server-error with the same op | "Try again" repeats the same op; for submit it is disabled once expired | "Request new instance" for submit | "The request didn't reach the server. Check your connection and try again." |
| accepted | inputs are hidden | "Request new instance" | none | label "Accepted", the server message verbatim, the flag in mono with a CopyButton, then the inline FlagForm pre-filled with the flag |
| rejected | instance fields and inputs, kept as entered | "Submit" while the instance hasn't expired | "Request new instance" | label "Rejected" and the server message verbatim |

Gate-specific body (all counts are derived from the response, 2.9 and A15; constants that the response lacks come from src/lib/gates.ts):
- **Gate 2:**
  - "Truncated outputs" as an `<ol>` labeled X1 to X`sequence.length` (`sequence[i]`, mono; 4 at c6d13ea), with the line "Each value is X >> 16, the top 48 bits of the state. The low 16 bits are hidden."
  - "Multiplier A" (`multiplier`, verbatim string).
  - "Increment C" (`GATE2_INCREMENT` from gates.ts, because the response doesn't include it).
  - "Modulus" (`modulus`).
  - Three labeled inputs numbered from `sequence.length + 1`, which gives "X5", "X6", and "X7" at c6d13ea, in a fieldset with the legend "Next three outputs" and the Copy section's hint. They sit in a 3-column grid at ≥640px and stack at 360px.
- **Gate 3:**
  - The line "`variablesCount` variables, `clausesCount` clauses".
  - "Clause preview": the first 5 clauses as `(a ∨ b ∨ c)` in mono, followed by "and `clauses.length − 5` more".
  - A labeled textarea "Assignment (JSON array)" with the Copy section's hint. The variable count in that hint comes from `variablesCount`, never from a literal.
- **Gate 4:**
  - "Bytecode" (`bytecodeHex`) in a mono block with `overflow-wrap: anywhere`, and its byte count.
  - "Opcodes" as a 2-column table (Opcode, Meaning) built from `Object.entries(vmSpec.opcodes)`, 9 rows at c6d13ea.
  - A labeled input "Key (hex)" with the Copy section's hint.

**JsonDisclosure.** `<details><summary>View full response</summary>` contains a `<pre>` with `formatResponseJson(instance.data)`. In that format, arrays made only of primitives are written on one line, so 512 clauses take 512 lines instead of 2,560. This is also the only place the stale response `description` strings appear (A3). The `<pre>` has `max-height: 24rem`, `overflow: auto`, `tabIndex={0}`, and `aria-label="Full response JSON"`. After submission, a second disclosure shows the submit response.

#### Try-it panel: Gate 1 (Gate1TryIt)

- **Body:**
  - A rules note above the field, with the Copy section's text. It lists the four checks the server applies in order (length, blocked words, framing word, proof of work) and says a prompt typed by hand passes the proof-of-work check about 1 time in 65,536 (2.8).
  - A labeled textarea "Prompt" (4 rows) with the Copy section's hint and a live character count of the trimmed prompt ("{n} of 50 to 500 characters"). The count is information only and doesn't block sending, because the server's message for a wrong length is the authority (A12).
  - A required-field error below it (2.15).
- **Action:** the primary button "Send prompt". Gate 1 has no secondary button. There is no nonce helper (A6). See Open questions.

The response area is a box under the action row:

| State | Label (text) | Content |
|---|---|---|
| idle | none | "The response appears here." |
| loading | none | "Sending…" on the button, which is disabled; the textarea stays editable but no second request starts (2.12) |
| blocked | "Blocked by filter" | "No flag was returned." and `response` verbatim. This covers every `allowed: false` reply, including the length check and a failed proof-of-work check (2.14) |
| answered | "Answered, no flag" | `response` verbatim. c6d13ea never produces this state, and it stays as a safe default |
| flag-returned | "Flag returned" | `response` verbatim, the flag in mono with a CopyButton, then the inline FlagForm |
| server-error | "Rate limited (HTTP 429)" for 429, otherwise "Request failed" | the server message verbatim; "Send prompt" stays disabled until `retryAt` and shows "Send prompt (N s)" (R12) |
| network-error | "Not sent" | "The request didn't reach the server. Check your connection and send again." |

JsonDisclosure shows the last chat response when there is one.

#### Scoreboard (`/scoreboard`)

Content blocks in order:
1. h1 "Scoreboard".
2. **Memory note** (one sentence, A9). "Standings are kept in server memory, so they reset when the server restarts, and each server instance keeps its own list: a flag you just submitted may not appear here." The Copy section owns the wording.
3. **Submit a flag** card (h2) containing FlagForm with `variant="page"`.
4. **Standings** (h2) with an action row containing:
   - "Refresh", a secondary button that shows "Refreshing…" and is disabled while loading.
   - "Last loaded HH:MM:SS" (local time of the last successful load), shown once at least one load has succeeded.
5. Message area:
   - **Loading:** "Loading standings…" when no rows have loaded yet. When rows already exist, they stay visible with `aria-busy="true"` on the table.
   - **Error:** "Rate limited" or "Request failed" with the server message verbatim, or the network-error text. The last loaded rows, if any, stay below with their "Last loaded" time, so it is visible that they may be out of date.
6. StandingsTable or the empty state.

StandingsTable is a `<table>` with `<caption class="sr-only">Standings, ordered as returned by the server</caption>` and these columns:

| Column | Content | ≥640px | <640px |
|---|---|---|---|
| Rank | `#1`, from the index in the returned order (3.11) | shown | shown |
| Agent | `agentName` in mono, `overflow-wrap: anywhere` | shown | shown, with the proof status as a second line under the name |
| Score | `score.toLocaleString("en-US")`, tabular figures | shown | shown |
| Gates solved (R7) | four chips G1 to G4. Each chip shows an icon (`CircleCheck` solved, `Circle` not solved) and the visible text "G1", with the accessible name "Gate N: solved" or "Gate N: not solved" | shown | shown; the chips may wrap to a 2×2 grid |
| Proof | "Complete" (the entry has `proofBadge`) or "In progress" | shown | hidden (`display: none`; the second line under the name replaces it) |

360px fit: rank is 3 characters, about 26 + 16 = 42px. Score is at most "8,500", about 42 + 16 = 58px. The four chips in a 2×2 grid take about 100px. That leaves 328 − 200 = 128px for Agent, which is about 13 mono characters per line, so a 24-character handle wraps onto two lines. The table is `w-full`, and its wrapper has `overflow-x: auto` only as a safety net.

**Empty state** (entries is an empty array after a successful load): "No flags have been accepted since the server last started." followed by a link "Start with Gate 1" to `/gates/1`.

Grid: one column at every width, with content at most 72rem wide. The form card lays out handle, flag, and Submit in one row at ≥1024px (handle 16rem, flag fills the rest, Submit auto width) and stacks them at 360px. Rejected: putting the form to the right of the table, because a right-hand column first in the DOM would break the visual focus order.

Above the fold at 360 × 780: the h1, the memory note, the flag form card (about 300px stacked), and the Standings heading.

#### FlagForm (all three placements)

- **Fields:**
  - "Agent handle", with the description "Letters, digits, _, - and ., up to 24 characters."
  - "Flag", in mono, with the placeholder `HAKU{…}` as a hint only, since the field also has a visible label.
- **Button:** a primary "Submit flag" that shows "Submitting…" and is busy (R2) while the request runs.
- **Validation:**
  - An empty handle or flag shows "Required" at that field, and no request is sent (2.15).
  - A handle that fails `checkHandle` shows the format note and a preview of the cleaned handle ("This will be recorded as "myagent"."). It warns and does not block submission (R13).
- **Result block below the form:**
  - **Accepted:** the label "Accepted", the server message verbatim, "Recorded as `<agent.agentName>`" (2.16), and, when `proofBadge` is non-null, "Proof-of-Pwn badge" in mono with a CopyButton.
  - **Rejected:** the label "Rejected" and the server message verbatim.
  - **Errors:** the same labels as the gate panels.
  - A "Dismiss" text button clears the result (3.4).
- **Placements:**
  - `variant="page"`: inside the scoreboard card, with an h2 that the card supplies.
  - `variant="inline"`: inside a gate result, with an h3 "Submit this flag". Its flag field is the shared field, which already holds the returned flag (3.5).
  - `variant="dialog"`: inside FlagDialog, a native `<dialog>` opened with `showModal()`. It has the h2 "Submit a flag" and a "Close" button. Escape closes it, and focus goes back to the "Submit flag" header button on close. Native modal dialogs make the background inert, so no focus trap code is needed.

#### Docs (`/docs`)

Content blocks in order:
1. h1 "Docs", with the lead "skill.md is the file agents read to learn the API. It is shown here as formatted text."
2. **Toolbar:**
   - CopyButton "Copy skill.md", whose value is the exact file string read on the server at build time (3.12). It is disabled only until hydration (R6, R8).
   - The production skill.md URL `https://ctf.hakudigital.tech/skill.md` in mono with its own CopyButton.
   - A link "View raw file" to `/skill.md`.
3. **Article:** `<article>` with SkillDoc rendering the Markdown. The file's own headings are shifted so its top heading renders as h2 under the page h1. The renderer, math, and emoji handling are in "skill.md Rendering".
4. **Error state:** if reading the file fails at build time, an error block "skill.md couldn't be loaded." with a link to `/skill.md` replaces blocks 2 and 3. There is no client fetch, so there is no loading state (R6).

Grid: one column at every width, article text at most 75ch, and code blocks as wide as the column, each scrolling horizontally on its own. There is no inner fixed-height scroll box (2.19). Rejected: a sticky table of contents at ≥1024px (YAGNI, and it can be added later). Above the fold at 360 × 780: the h1, the lead, the toolbar, and the start of the file's text.

#### Console (`/console`)

Content blocks in order:
1. h1 "Console", with the lead "Type help to list commands. The console uses the gate data on this site; leaderboard shows the standings as last loaded."
2. Console panel:
   - **Output log:** `role="log"` with `aria-live="polite"`, `aria-label="Console output"`, and `tabIndex={0}`. Its height is `min(60vh, 32rem)` with `overflow-y: auto`. Each entry is the echoed command, `$ <input as typed>` in a muted color, followed by its output in mono `white-space: pre-wrap`. Error outputs start with words that state the problem ("Unknown command", "Usage:"), so status doesn't depend on color.
   - **Input row:** `<form>` with a visible label "Command", a mono `<input>` (no `autoFocus`, `autoComplete="off"`, `spellCheck={false}`), and a secondary button "Run".
3. After each command, the log sets `scrollTop = scrollHeight` instantly. Smooth scrolling is not used at all, so reduced motion needs no special case (2.27).

Grid: one column at every width, with the panel as wide as the content. At 360px the label sits above the input, and the input and "Run" share one row. The console output of `gates` is about 70 characters per line, so the log scrolls horizontally inside itself at 360px; this is allowed for code and data containers (2.34). Above the fold at 360 × 780: the h1 and lead (about 100px), a 468px log, and the input row (about 56px), all inside 680px.

On mount, ConsoleView calls `loadScoreboard()` once if `scoreboard.entries === null` and no load is running, so `leaderboard` has data, as it does today when the scoreboard loads on page load. This counts as "opening a view that needs data" (3.15).

#### Not-found page

src/app/not-found.tsx: h1 "Page not found", one sentence, and links to Overview and Gate 1. It renders inside the root layout, so the shell and the state are unaffected.

### Component and File Structure

#### File tree

```
src/app/
  layout.tsx              fonts, metadata, viewport, shell, AppStateProvider
  page.tsx                Overview (server)
  not-found.tsx           404 (server)              (R15)
  icon.svg                site favicon              (R15; replaces favicon.ico, see Iconography and brand)
  globals.css             tokens (@theme), base styles
  gates/page.tsx          redirect("/gates/1")
  gates/[gate]/page.tsx   gate page (server)
  scoreboard/page.tsx     metadata + <ScoreboardView/>
  docs/page.tsx           reads public/skill.md at build time, renders SkillDoc (R6)
  console/page.tsx        metadata + <ConsoleView/>
  api/**                  FROZEN at c6d13ea
src/components/
  state/AppStateProvider.tsx, state/Announcer.tsx
  shell/SiteHeader.tsx, shell/PrimaryNav.tsx, shell/SiteFooter.tsx, shell/SoundToggle.tsx, shell/FlagDialog.tsx
  ui/Button.tsx, ui/Field.tsx, ui/CopyButton.tsx, ui/CopyField.tsx, ui/StatusBadge.tsx, ui/StatusMessage.tsx, ui/JsonDisclosure.tsx
  overview/ConnectionDetails.tsx, overview/StartSteps.tsx, overview/GateProgression.tsx
  gates/GateStepper.tsx, gates/GateReference.tsx, gates/GatePager.tsx, gates/Gate1TryIt.tsx,
  gates/InstanceTryIt.tsx, gates/Gate2Instance.tsx, gates/Gate3Instance.tsx, gates/Gate4Instance.tsx, gates/Countdown.tsx
  flag/FlagForm.tsx
  scoreboard/ScoreboardView.tsx, scoreboard/StandingsTable.tsx
  docs/SkillDoc.tsx
  console/ConsoleView.tsx
src/lib/
  gates.ts        static gate metadata, URLs
  api.ts          response types, ApiResult, fetch helpers
  app-state.ts    state types, initial state, pure reducer with unit tests  (R15)
  console.ts      runConsoleCommand
  validation.ts   checkHandle, cleanHandle, parseGate3Assignment
  format.ts       formatPoints, formatResponseJson, formatClause  (R15)
  markdown.ts     in-house Markdown renderer for skill.md
  sound.ts        kept; enabled = false by default
  challenges.ts, crypto.ts, ratelimit.ts   FROZEN at c6d13ea
```

#### Component inventory

"Server" means a component with no `"use client"`. Server components may render client children. All gate data comes from src/lib/gates.ts.

| Name | File | Kind | Props | Responsibility |
|---|---|---|---|---|
| RootLayout | src/app/layout.tsx | server | `{ children }` | fonts through `next/font`, metadata, viewport without `maximumScale`, shell order, provider |
| AppStateProvider | src/components/state/AppStateProvider.tsx | client | `{ children }` | holds the reducer state, runs fetches through src/lib/api.ts, runs the ticker, syncs `sounds.enabled`, provides `announce()`; exports `useAppState()` and `useNow()` |
| Announcer | src/components/state/Announcer.tsx | client | none | a visually hidden `aria-live="polite"` `aria-atomic="true"` region that shows the latest `announce()` text; clears and resets the text so a repeated message is spoken again. One instance is the last child of `main`, and a second one sits inside FlagDialog (R3, R15) |
| SiteHeader | src/components/shell/SiteHeader.tsx | server | none | `<header>` holding the wordmark link, FlagDialog, and SoundToggle |
| PrimaryNav | src/components/shell/PrimaryNav.tsx | client | none | `<nav aria-label="Primary">` with 5 Links and `aria-current` from `usePathname()` |
| SiteFooter | src/components/shell/SiteFooter.tsx | server | none | attribution and links (3.13) |
| SoundToggle | src/components/shell/SoundToggle.tsx | client | none | `<button aria-pressed={soundOn} aria-label="Sound effects">`, starts `false`; the Volume2 or VolumeX icon and the visible text are `aria-hidden` (2.25, R9) |
| FlagDialog | src/components/shell/FlagDialog.tsx | client | none | "Submit flag" trigger, native `<dialog>` with FlagForm `variant="dialog"`, focus return |
| Button | src/components/ui/Button.tsx | server-safe (no hooks) | `variant: "primary" \| "secondary" \| "ghost"`, `size?: "md" \| "sm"`, `busy?: boolean`, plus native button props | the shared control variants (2.3); `busy` sets `aria-disabled="true"` and `data-busy`, keeps focus, and ignores activation; native `disabled` only when the caller passes it (R2) |
| TextField, TextAreaField | src/components/ui/Field.tsx | client (`useId`) | `label`, `description?`, `error?`, `mono?`, plus input or textarea props | visible `<label htmlFor>`, `aria-describedby` for the description and error, `aria-invalid` (2.30) |
| CopyButton | src/components/ui/CopyButton.tsx | client | `value: string`, `label: string` (what is copied, e.g. "base URL"), `disabled?` | constant accessible name starting with "Copy"; awaits `navigator.clipboard.writeText` and checks the result; shows "Copied" for 2 s or "Copy failed" for 4 s in an `aria-hidden` span and calls `announce()` once; disabled until hydrated through `useSyncExternalStore` (2.17, R8) |
| CopyField | src/components/ui/CopyField.tsx | server | `label`, `value`, `display?: ReactNode` | label, mono value, and CopyButton in one row |
| StatusBadge | src/components/ui/StatusBadge.tsx | server-safe | `tone: "neutral" \| "success" \| "error" \| "warning"`, `children` (text) | a status label shown in text and color (2.33) |
| StatusMessage | src/components/ui/StatusMessage.tsx | server-safe | `tone`, `label: string`, `children`, `action?: ReactNode` | the message box used for results and errors |
| JsonDisclosure | src/components/ui/JsonDisclosure.tsx | client | `value: unknown`, `summary?: string` | `<details>` with the formatted JSON |
| ConnectionDetails | src/components/overview/ConnectionDetails.tsx | server | none | three CopyField rows |
| StartSteps | src/components/overview/StartSteps.tsx | server | none | the three-step `<ol>` |
| GateProgression | src/components/overview/GateProgression.tsx | server | `gates: readonly GateMeta[]` | ordered gate cards with links |
| GateStepper | src/components/gates/GateStepper.tsx | server | `current: GateNumber` | `<nav aria-label="Gates">` with `aria-current` (R3) |
| GateReference | src/components/gates/GateReference.tsx | server | `gate: GateMeta` | description, endpoints with CopyButton, payload table, TTL note |
| GatePager | src/components/gates/GatePager.tsx | server | `current: GateNumber` | `<nav aria-label="Gate pages">` with previous and next links; "Previous: Overview" on Gate 1, "Next: Scoreboard" on Gate 4 (R3, R11) |
| Gate1TryIt | src/components/gates/Gate1TryIt.tsx | client | none | the Gate 1 prompt form and response states |
| InstanceTryIt | src/components/gates/InstanceTryIt.tsx | client | `gate: 2 \| 3 \| 4` | the shared panel frame, states, and actions; renders the matching GateNInstance; announces expiry once |
| Gate2Instance, Gate3Instance, Gate4Instance | src/components/gates/Gate{2,3,4}Instance.tsx | client | `{ data, inputs, onInput, readOnly, fieldError }`, typed per gate | gate-specific fields and labeled inputs |
| Countdown | src/components/gates/Countdown.tsx | client | `expiresAt: number`, `expired: boolean`, `expiringAt: number` (the gate's threshold from gates.ts) | the three states in R18 from `useNow()`; this is the only per-second rerender |
| FlagForm | src/components/flag/FlagForm.tsx | client | `variant: "page" \| "inline" \| "dialog"`, `headingId?: string` | shared handle and flag fields, validation, result block, Dismiss |
| ScoreboardView | src/components/scoreboard/ScoreboardView.tsx | client | none | loads on mount, renders the memory note, form card, refresh, messages, and table |
| StandingsTable | src/components/scoreboard/StandingsTable.tsx | client (imported by a client view) | `entries: readonly LeaderboardEntry[]`, `busy: boolean` | the table described above |
| SkillDoc | src/components/docs/SkillDoc.tsx | server | `markdown: string` | formatted rendering through src/lib/markdown.ts |
| ConsoleView | src/components/console/ConsoleView.tsx | client | none | log, input, `runConsole`, loads the scoreboard once on mount |

The gate page composes: `<GateStepper current={n}/>`, the heading, `<GateReference gate={meta}/>`, `{n === 1 ? <Gate1TryIt/> : <InstanceTryIt gate={n}/>}`, and `<GatePager current={n}/>`.

#### API response types (src/lib/api.ts)

These are derived from the frozen routes and from the return types in src/lib/challenges.ts and src/lib/crypto.ts. JSON drops `undefined` properties, so fields that are sometimes `undefined` on the server are optional here.

```ts
export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

/** 429 from every rate-limited route. */
export interface RateLimitBody { error: "Too Many Requests"; message: string }

export interface LeaderboardEntry {
  agentName: string;
  gatesSolved: number[];      // insertion order on the server; the UI sorts ascending for display
  score: number;
  lastSolveAt: number;        // ms since epoch
  proofBadge?: string;
}

/** GET /api/scoreboard 200 */
export interface ScoreboardResponse {
  status: "ok";
  leaderboard: LeaderboardEntry[];
  totalAgents: number;
  gatePoints: Record<string, number>;   // JSON object keys "1".."4"
}

/** POST /api/scoreboard 200 */
export interface FlagAccepted {
  success: true;
  message: string;            // "FLAG ACCEPTED for Gate N! +P points."
  agent: LeaderboardEntry;    // agent.agentName is the recorded (cleaned) handle
  proofBadge: string | null;
  allGatesCleared: boolean;
}
/** POST /api/scoreboard 400 (missing field, bad handle, bad JSON) or 403 (wrong flag) */
export interface FlagRejected { success: false; message: string }
export type FlagSubmitResponse = FlagAccepted | FlagRejected;

/** POST /api/gate1/chat 200. 400 is { error: string } with no message. */
export interface Gate1ChatResponse {
  status: "ok";
  gate: 1;
  name: string;
  allowed: boolean;
  response: string;
  flag: string | null;
  rateLimitRemaining: number;
}

interface ChallengeBase<G extends 2 | 3 | 4> {
  status: "ok";
  gate: G;
  name: string;
  description: string;
  sessionToken: string;
  ttlSeconds: number;
  submitEndpoint: string;
}
export interface Gate2Challenge extends ChallengeBase<2> {
  multiplier: string;          // "6364136223846793005 (Knuth 64-bit)"
  modulus: string;             // "18446744073709551616 (2^64)"
  sequence: string[];          // 4 decimal strings at c6d13ea, each X >> 16; C is not in the response
  // description at c6d13ea is stale ("5 consecutive numbers"); the UI does not display it outside JsonDisclosure
  payloadSchema: { sessionToken: string; predictions: string[] };
}
export interface Gate3Challenge extends ChallengeBase<3> {
  variablesCount: number;
  clausesCount: number;
  clauses: number[][];
  payloadSchema: { sessionToken: string; assignment: string };
}
export interface Gate4Challenge extends ChallengeBase<4> {
  vmSpec: { opcodes: Record<string, string> };
  bytecodeHex: string;
  payloadSchema: { sessionToken: string; keyHex: string };
}
export interface ChallengeByGate { 2: Gate2Challenge; 3: Gate3Challenge; 4: Gate4Challenge }

/** POST /api/gateN/submit: 200 when success, 400 when not. */
export interface GateSubmitResponse { success: boolean; message: string; flag?: string }

export interface SubmitBodyByGate {
  2: { sessionToken: string; predictions: [string, string, string] };
  3: { sessionToken: string; assignment: JsonValue };
  4: { sessionToken: string; keyHex: string };
}
```

#### src/lib/api.ts: result classification

```ts
export type ApiResult<T> =
  | { kind: "ok"; status: number; data: T }
  | { kind: "server-error"; status: number; message: string; retryAfterSec: number | null; body: JsonValue | null }
  | { kind: "network-error" };

async function request<T>(
  path: string,
  init: RequestInit,
  guard: (body: unknown) => body is T,
  acceptNonOk: boolean,
): Promise<ApiResult<T>>;
```

The classification is one ordered rule list (R12). The first rule that matches decides the result:

0. **Network error.** `fetch` rejects, either a `TypeError` for offline or DNS problems, or the `TimeoutError` from `AbortSignal.timeout(15000)`, which is passed as `init.signal`. The result is `{ kind: "network-error" }`. The 15 s timeout keeps a hung request from leaving a button busy forever. This happens before any HTTP status exists.
1. **HTTP 429** is server-error, whatever the body. `retryAfterSec` is the last `(\d+)\s*s\b` match in `body.message`, which covers both "Retry in 12s." and "Anti-bruteforce sleep for 12s.". If nothing matches, it is `null`.
2. **A boolean `success`** (the gate submit endpoints and `POST /api/scoreboard`, at 200, 400, or 403) is ok. The panel shows "Accepted" when it is true and "Rejected" when it is false. For the scoreboard, `success: true` also needs `agent.agentName` as a string.
3. **Gate 1's boolean `allowed`** with a string `response` is ok. The panel shows "Flag returned" when `allowed` is true and `flag` is a string, "Answered, no flag" when `allowed` is true without a flag, and "Blocked by filter" when `allowed` is false.
4. **A challenge response with a non-empty string `sessionToken`** and its gate field (Gate 2 `sequence` array, Gate 3 `clauses` array, Gate 4 `bytecodeHex` string) is ok and becomes a live instance. The scoreboard list (`leaderboard` array) is ok at this step too.
5. **Anything else** is server-error, including a body that isn't JSON, such as an HTML 500 or 504 page.

Error text for server-error comes from `body.message` if it is a string, then `body.error` if it is a string (the Gate 1 400 has only `error`), then the fallback "The server sent an unexpected response (HTTP <status>).". `body` is kept for JsonDisclosure, or `null` when it wasn't JSON. Every rule is checked in the request helper that knows which endpoint it called, so rule 3 runs only for Gate 1 and rule 4 only for challenge and scoreboard GETs.

Guards check only the fields the UI reads:

| Guard | Passes when |
|---|---|
| `isScoreboard` | `Array.isArray(b.leaderboard)` |
| `isFlagSubmit` | `typeof b.success === "boolean" && typeof b.message === "string"`, and when `success` is true, `typeof b.agent?.agentName === "string"` |
| `isGate1Chat` | `typeof b.allowed === "boolean" && typeof b.response === "string"` |
| `isChallenge(gate)` | `typeof b.sessionToken === "string" && b.sessionToken.length > 0`, plus: Gate 2 `Array.isArray(b.sequence)`, Gate 3 `Array.isArray(b.clauses)`, Gate 4 `typeof b.bytecodeHex === "string"` |
| `isGateSubmit` | `typeof b.success === "boolean" && typeof b.message === "string"` |

**Valid challenge instance.** A response is a valid instance only when it passes `isChallenge`. A 429 body `{error, message}` has no `sessionToken`, so it becomes server-error, and no instance, countdown, or Submit is shown (2.11). If `ttlSeconds` is not a positive number, the provider falls back to `GateMeta.ttlSeconds`, the same value the current code uses (`d.ttlSeconds || 15`).

**What Gate 1 classifies as ok.** `{ allowed: false, … }` is an ok result with HTTP 200. It is a domain outcome, and the panel shows it as "blocked". It is not an error.

**429 display.** The server message is shown verbatim under the label "Rate limited (HTTP 429)" (A12, R12). The provider stores `retryAt = Date.now() + retryAfterSec * 1000`. The control that would repeat the request is disabled and labelled with the remaining seconds from `useNow()`, for example "Try again in 9 s", and it goes back to "Try again" at 0. Nothing retries automatically (3.15, A13).

Exported helpers:
- `getScoreboard()`: GET.
- `postFlag(agentName, flag)`: POST with body `{ agentName, flag }` as typed (3.4).
- `postGate1Prompt(prompt)`: POST with body `{ prompt }`, the raw text (3.6).
- `getChallenge<G extends 2|3|4>(gate: G): Promise<ApiResult<ChallengeByGate[G]>>`
- `submitGate<G extends 2|3|4>(gate: G, body: SubmitBodyByGate[G]): Promise<ApiResult<GateSubmitResponse>>`

All paths are relative (`/api/...`), so a preview or local build calls its own API (A10). POSTs send `Content-Type: application/json`.

#### State shape (src/lib/app-state.ts)

```ts
export type GateNumber = 1 | 2 | 3 | 4;
export type InstanceGate = 2 | 3 | 4;

export interface ServerError { status: number; message: string; retryAt: number | null; body: JsonValue | null }

export type Gate1Status = "idle" | "loading" | "blocked" | "answered" | "flag-returned" | "server-error" | "network-error";
export interface Gate1Slot {
  status: Gate1Status;
  prompt: string;
  promptError: "required" | null;
  response: Gate1ChatResponse | null;   // set for blocked | answered | flag-returned
  error: ServerError | null;            // set for server-error
}

export type InstanceStatus = "idle" | "loading" | "live" | "expired" | "server-error" | "network-error" | "accepted" | "rejected";
export interface LiveInstance<C> { data: C; receivedAt: number; expiresAt: number; expired: boolean }
export interface InputsByGate { 2: [string, string, string]; 3: string; 4: string }
export interface InstanceSlot<G extends InstanceGate> {
  status: InstanceStatus;
  op: "request" | "submit" | null;      // which request a loading or error status belongs to
  instance: LiveInstance<ChallengeByGate[G]> | null;
  inputs: InputsByGate[G];
  fieldError: string | null;            // Gate 3 parse message (3.9)
  result: GateSubmitResponse | null;    // accepted | rejected
  error: ServerError | null;            // server-error
}

export type FlagStatus = "idle" | "submitting" | "accepted" | "rejected" | "server-error" | "network-error";
export interface FlagSlot {
  agentHandle: string;
  flag: string;
  fieldErrors: { handle: "required" | null; flag: "required" | null };
  status: FlagStatus;
  message: string | null;               // server message verbatim
  recordedHandle: string | null;        // agent.agentName from FlagAccepted
  proofBadge: string | null;
  retryAt: number | null;
}

export interface ScoreboardSlot {
  status: "idle" | "loading" | "loaded" | "server-error" | "network-error";
  entries: LeaderboardEntry[] | null;   // last successful load; null = never loaded
  loadedAt: number | null;
  error: ServerError | null;
}

export interface ConsoleEntry { id: number; command: string | null; output: string; tone: "normal" | "error" }
export interface ConsoleSlot { history: ConsoleEntry[]; input: string; nextId: number }

export interface AppState {
  gate1: Gate1Slot;
  gate2: InstanceSlot<2>;
  gate3: InstanceSlot<3>;
  gate4: InstanceSlot<4>;
  flag: FlagSlot;
  scoreboard: ScoreboardSlot;
  console: ConsoleSlot;
  soundOn: boolean;                     // false initially (2.25)
}
```

**Invariants for an instance slot** (the property tests can check these with the pure reducer):
- `idle` means `instance`, `result`, and `error` are all null.
- `loading` with op `request` means `instance` is null.
- `live`, `expired`, `accepted`, `rejected`, and every `submit` op have an instance.
- `instance.expired` turns true at most once per instance and never back to false.
- Submit is enabled only when all of these hold:
  - `instance` is set and `instance.expired` is false;
  - `status` is not `loading` or `accepted`;
  - `retryAt` is null or in the past.

Initial console history is a single system entry with `command: null`: "AGENTGATE console. Type help to list commands, or gates to list the four gates."

#### Actions

The provider exposes these actions through `useAppState()`. Each async action dispatches a pure reducer event (for example `{ type: "instance/requested", gate }` and `{ type: "instance/received", gate, result, now }`), so all set and clear rules live in the reducer and can be tested without `fetch`.

| Action | Before the request | On ok | On server-error or network-error | Side effects |
|---|---|---|---|---|
| `setField(path, value)` (handle, flag, prompt, `gate2[i]`, `gate3`, `gate4`, console input) | sets the value; clears that field's `required` error or `fieldError` | | | none |
| `sendGate1Prompt()` | if `prompt.trim() === ""`: set `promptError: "required"`, no request (2.15). If `status === "loading"`: do nothing (2.12). Otherwise set `status: "loading"` and clear `response`, `error`, and `promptError` | sets `response`. Status is `blocked` if `!allowed`, `flag-returned` if `flag` is set, otherwise `answered`. On a flag: `flag.flag = data.flag`, the handle is untouched (3.5) | `error` and status `server-error` or `network-error` | sound success or error; announce the label and the first 120 characters of the message |
| `requestInstance(gate)` | if already loading: do nothing. Otherwise set `status: "loading"`, `op: "request"`, and clear `instance`, `result`, `error`, `fieldError`, and `inputs`, resetting them to empty (3.7) | `instance = { data, receivedAt: now, expiresAt: now + ttl*1000, expired: false }`, `status: "live"`, `op: null` | `status` error, `op: "request"`, `instance` stays null | announce "Gate N instance ready, expires in T seconds." or the error |
| `submitInstance(gate)` | does nothing unless Submit is enabled. Gate 3: `parseGate3Assignment(inputs)`; on failure set `fieldError` to the exact 3.9 message, keep the status, and send nothing. Otherwise set `status: "loading"`, `op: "submit"`, and clear `result` and `error`. The body is: Gate 2 `predictions = inputs.map(s => s.trim())` in the order X6, X7, X8; Gate 3 the parsed value; Gate 4 `keyHex = inputs.trim()` (3.8) | `result = data`. Status is `accepted` if `data.success`, otherwise `rejected`. If `data.flag` is set: `flag.flag = data.flag` (3.5) | `status` error, `op: "submit"`, instance kept | sound; announce "Accepted"/"Rejected" and the message |
| `submitFlag()` | `fieldErrors.handle = "required"` if `agentHandle.trim() === ""`, the same for the flag; if either is set, send nothing (2.15). If `status === "submitting"`: do nothing. Otherwise set `status: "submitting"` and clear `message`, `recordedHandle`, `proofBadge`, and `retryAt` | `success`: `status: "accepted"`, `message`, `recordedHandle = data.agent.agentName`, `proofBadge = data.proofBadge`, then call `loadScoreboard()` (3.4). Not `success`: `status: "rejected"` and `message` | `status` error, `message`, `retryAt` | `sounds.playFlagWin()` or `playError()`; announce |
| `dismissFlagResult()` | `status: "idle"` and clear `message`, `recordedHandle`, `proofBadge`, and `retryAt`. The fields keep their values | | | none |
| `loadScoreboard()` | if already loading: do nothing. Otherwise set `status: "loading"`, keeping `entries` | `status: "loaded"`, `entries = data.leaderboard` in the returned order (3.11), `loadedAt: now`, `error: null` | status error and `error`; `entries` kept | announce only on error |
| `runConsole()` | `r = runConsoleCommand(console.input, { gates: GATES, standings: scoreboard.entries })` | `clear` gives `history: []`; `output` appends the entry; `none` does nothing. `input` is cleared except for `none` | | none: console output is announced by `role="log"` |
| `toggleSound()` | `soundOn = !soundOn`; an effect sets `sounds.enabled = soundOn`. Turning sound on plays `playClick()` once as confirmation | | | none |
| `announce(text)` | sets the Announcer text | | | |

**When the scoreboard loads (3.15):**
- ScoreboardView mount, on every visit to `/scoreboard`.
- The Refresh button.
- After an accepted flag.
- ConsoleView mount, only if it has never loaded.

The Overview, gate, and docs views make no API calls on load. There is no polling.

#### Ticker

There is one ticker in AppStateProvider, `useNow()`:
- `now` lives in a separate `NowContext`, so only Countdown and the "Try again in N s" labels rerender each tick. The main context value is memoized on `state`.
- A single `setInterval(250)` runs only while at least one instance is not expired, or at least one `retryAt` is in the future. The effect depends on that boolean, so the interval stops when nothing is counting.
- On each tick, for each gate with `instance && !instance.expired && now >= instance.expiresAt`, it dispatches `{ type: "instance/expired", gate }`. That event sets `instance.expired = true`, and moves `status` from `live` to `expired`. Other statuses keep their message, and Submit turns off through `instance.expired`.
- Countdown computes `n = Math.max(0, Math.ceil((expiresAt - now) / 1000))` and shows the R18 states: "Expires in {n} s" while live, the "Expiring" badge plus the warning color and icon at or below the gate's `expiringAtSeconds` (5 s for Gates 2 and 4, 3 s for Gate 3, R1), and the "Expired" badge plus the expired message at 0.
- `expiresAt` is absolute, so the countdown is correct after navigating away and back (3.14).
- InstanceTryIt keeps a ref with the last `instance.expired` value it rendered, keyed by `sessionToken`. When the value turns true while the component is mounted, it calls `announce("Gate N instance expired. Request a new instance to try again.")` once. If the component mounts with an instance that has already expired, it records the value without announcing. So expiry is announced once, and only on the gate's own page (2.13).

#### src/lib/console.ts

```ts
export interface ConsoleContext { gates: readonly GateMeta[]; standings: readonly LeaderboardEntry[] | null }
export type ConsoleResult =
  | { kind: "none" }                                          // empty or whitespace input
  | { kind: "clear" }
  | { kind: "output"; command: string; output: string; tone: "normal" | "error" };

export function runConsoleCommand(input: string, context: ConsoleContext): ConsoleResult;
```

`command` is `input.trim()` as typed and is echoed as `$ <command>`. Parsing uses `const [root, arg] = input.trim().toLowerCase().split(/\s+/)`, so any letter case works (3.10), and extra spaces no longer break `solve  2`.

| Input root | Output (Copy section may reword; content must stay equivalent) | Tone |
|---|---|---|
| `help` | `Commands:` then one line each: `help` "List commands", `gates` "List the gates with points, endpoint, and TTL", `solve <1-4>` "Show how to approach a gate", `leaderboard` "Show the standings as last loaded", `clear` "Clear the console" | normal |
| `gates` | one line per gate from `context.gates`: `Gate N  <name>  <points> pts  <first endpoint method and path>` followed by `  TTL <ttl> s` for gates with a TTL. Columns are padded with `padEnd` | normal |
| `solve` with `arg` in 1..4 | `Gate N: ` + `gates[N-1].consoleHint` | normal |
| `solve` with anything else | `Usage: solve 1 \| solve 2 \| solve 3 \| solve 4` | error |
| `leaderboard` | if `standings === null`: "Standings haven't loaded. Open the scoreboard to load them." If the array is empty: "No entries yet." Otherwise one line per entry: `#<i+1> <agentName padEnd 24> <score> pts  Gates <sorted list or None>` | normal |
| `clear` | `{ kind: "clear" }` | |
| anything else | `Unknown command '<command>'. Type help to list commands.` | error |

Points use `formatPoints` (`toLocaleString("en-US")`), giving 1,000, 2,000, 2,500, and 3,000 (3.16). Gate names come from `GateMeta.name` without a difficulty suffix (A14), so the `padEnd(18)` column holds the longest name, "Entropy Fracture". The function is pure: it uses no `Date`, no randomness, and no I/O.

#### src/lib/validation.ts

```ts
export const HANDLE_MAX_LENGTH = 24;
/** Mirrors src/app/api/scoreboard/route.ts exactly. */
export function cleanHandle(raw: string): string {
  return String(raw).trim().replace(/[^a-zA-Z0-9_\-\.]/g, "").slice(0, 24);
}
export type HandleCheck =
  | { ok: true }
  | { ok: false; reason: "required" }
  | { ok: false; reason: "format"; recordedAs: string };   // recordedAs "" means the server will reject it
export function checkHandle(raw: string): HandleCheck;
// trimmed = raw.trim(); "" → required; cleanHandle(raw) !== trimmed → format; else ok

export const GATE3_MALFORMED_MESSAGE = "Malformed assignment array. Expected valid JSON format.";
export type AssignmentParse = { ok: true; value: JsonValue } | { ok: false; message: typeof GATE3_MALFORMED_MESSAGE };
export function parseGate3Assignment(text: string): AssignmentParse;
// try JSON.parse(text) → ok with the parsed value (any JSON, sent as parsed: 3.9); catch → the exact message. "" → the message.
```

`checkHandle(h).ok` is true exactly when `cleanHandle(h) === h.trim() && h.trim() !== ""`. This is the property that ties the client check to the server cleanup. Leading and trailing spaces are allowed because the server trims them.

#### src/lib/gates.ts

```ts
export const BASE_URL = "https://ctf.hakudigital.tech";
export const SKILL_URL = `${BASE_URL}/skill.md`;
export type HttpMethod = "GET" | "POST";
export interface Endpoint { method: HttpMethod; path: `/api/${string}`; purpose: string }
export interface PayloadField { name: string; type: string; notes: string }
export interface GateMeta {
  number: GateNumber;
  name: string;
  topic: string;               // short task name: "Prompt filter evasion", "LCG prediction", "3-SAT", "Stack VM bytecode"
  points: number;
  ttlSeconds: number | null;   // null = no instance, no time limit
  expiringAtSeconds: number | null; // R1: 5 for Gates 2 and 4, 3 for Gate 3, null for Gate 1
  summary: string;             // one sentence for the Overview card
  description: string;         // gate page paragraph
  endpoints: readonly Endpoint[];
  requestFields: readonly PayloadField[];
  consoleHint: string;
}
export const GATES: readonly [GateMeta, GateMeta, GateMeta, GateMeta];
export function getGate(param: string): GateMeta | undefined;   // only "1".."4"; "01", "1.0", " 1" → undefined
export const SCOREBOARD_ENDPOINTS: readonly Endpoint[];          // GET and POST /api/scoreboard
export const SKILL_ENDPOINT: Endpoint;                           // GET /api/skill
export function absoluteUrl(path: string): string;               // BASE_URL + path, used by endpoint CopyButtons
export const DIFFICULTY = "Hell";                                // A14: shown once as "Difficulty: Hell"
export const GATE2_INCREMENT = "1442695040888963407";            // C; skill.md gives it, the response does not
export const GATE1_RULES: readonly string[];                     // the four checks, in server order, for the gate page and try-it note
```

Values (3.16; description and summary strings are owned by the Copy section):

| # | name | points | ttlSeconds | endpoints | requestFields |
|---|---|---|---|---|---|
| 1 | Neural Sentry | 1000 | null | POST /api/gate1/chat | `prompt` string, 50 to 500 characters after trimming; must pass the four checks in A3 |
| 2 | Entropy Fracture | 2000 | 15 | GET /api/gate2/challenge, POST /api/gate2/submit | `sessionToken` string; `predictions` array of 3 strings: X5, X6, X7 as decimal integers |
| 3 | Logic Maze | 2500 | 10 | GET /api/gate3/challenge, POST /api/gate3/submit | `sessionToken` string; `assignment` array of 120 booleans in variable order (signed literals are read by position when the array has 120 or 121 entries, A3) |
| 4 | Bytecode Vault | 3000 | 20 | GET /api/gate4/challenge, POST /api/gate4/submit | `sessionToken` string; `keyHex` string of 16 hex characters (8 bytes), any case, optional lowercase `0x` |

Console hints carry these facts for c6d13ea. The wording is in "Console copy":
1. Gate 1: use a framing word, avoid the blocked words, then add a nonce and search until SHA-256 of the trimmed prompt starts with 0000.
2. Gate 2: A, C, and 2^64 are given and each output is X >> 16; recover the 16 hidden low bits (65,536 candidates, or Z3), then compute X5 to X7.
3. Gate 3: load the 512 clauses into a SAT solver such as Z3 or CaDiCaL and submit 120 booleans.
4. Gate 4: 8 rounds of XOR with a key byte, add, rotate left, and compare, then a sum check and an XOR check; invert each round or run it symbolically.

A test (K09) asserts that `GATES` matches the API at c6d13ea (A15): the points match `GATE_POINTS` in the scoreboard route, the TTLs match `generateGateNChallenge().ttl` from src/lib/challenges.ts, which the test imports read-only, Gate 3's counts match `generateGate3Challenge()`, Gate 4's opcode count matches the route's `vmSpec`, and `GATE2_INCREMENT` appears in public/skill.md.

#### src/lib/format.ts

- `formatPoints(n: number): string` returns `n.toLocaleString("en-US")`.
- `formatClause(c: readonly number[]): string` returns `"(" + c.join(" ∨ ") + ")"`. The current page uses `" v "`, and the UI may use either.
- `formatResponseJson(v: unknown): string` indents by 2 and writes any array whose items are all primitives on one line.
- `formatTime(ms: number): string` returns local `HH:MM:SS` for "Last loaded".

#### Migration map (current src/app/page.tsx → new location)

| Current block | Moves to | Deleted |
|---|---|---|
| `"use client"`, the whole-page client component | split into server pages and client islands | the single `Home` component |
| `canvas-confetti` import and the `confetti(...)` call | none | deleted, along with `canvas-confetti` and `@types/canvas-confetti` in package.json (2.26; the Motion section may add a result-area effect in CSS) |
| lucide imports | the components that use them; `Clock` and `ExternalLink` aren't used anywhere | `Cpu` as a gate icon (it was also the brand mark) |
| `interface LeaderboardEntry` | src/lib/api.ts | |
| the 30 `useState` hooks | `AppState` in src/lib/app-state.ts, held by AppStateProvider | all `any` state types |
| `loadLeaderboard` | `getScoreboard` in api.ts, `loadScoreboard` action | the silent `catch (e) {}` |
| mount `useEffect` (scoreboard load and `fetch("/api/skill")`) | scoreboard: ScoreboardView or ConsoleView mount; skill.md: `fs.readFile` in src/app/docs/page.tsx | the client fetch of `/api/skill` and the "Loading specification..." placeholder |
| timer `useEffect` (three decrementing counters) | the `useNow()` ticker and `expiresAt` | the relative counters |
| `toggleSound` | `toggleSound` action, SoundToggle; src/lib/sound.ts `enabled = false` | `useState(true)` |
| `handleFlagSubmit` | `submitFlag` action, FlagForm | confetti; the generic "Flag verification rejected." fallback (the server message is always present) |
| `handleGate1Send` | `sendGate1Prompt`, Gate1TryIt | the fake `{ allowed: false, response: "Service connection timeout." }` |
| `handleGate{2,3,4}Fetch` and `Submit` | `requestInstance` and `submitInstance`, InstanceTryIt with Gate{2,3,4}Instance | the `|| 15/10/20` fallbacks move into `GateMeta.ttlSeconds`; on-change `.trim()` moves to submit time |
| Gate 3 `JSON.parse` block | `parseGate3Assignment` in validation.ts | |
| `handleTerminalSubmit` | `runConsoleCommand` in console.ts and the `runConsole` action, ConsoleView | `setTimeout(...scrollIntoView({behavior:"smooth"}))` |
| `<header>` JSX and the view buttons | SiteHeader, PrimaryNav, SoundToggle, FlagDialog | `activeTab` state, the `onClick` sound on navigation |
| "Flag Submission Bar" section | FlagForm (scoreboard, dialog, inline) | its position above every view; `[Dismiss]` |
| Arena 2×2 grid | GateProgression on `/`, plus `/gates/[gate]` with GateReference and the try-it panels | the hardcoded "Variables: 60 \| Clauses: 255" and "... +252 clauses" |
| Terminal view | ConsoleView | the "AgentGate Shell" title, the fixed "Connected" label, `autoFocus` |
| Leaderboard view | ScoreboardView and StandingsTable | color-only G1–G4 chips, "Verified Complete" |
| Protocol Spec view | src/app/docs/page.tsx and SkillDoc | the `<pre>` with `max-h-[500px]`, "Copy Spec" |
| `<footer>` | SiteFooter | "4 Gates Active", "Target: ctf.hakudigital.tech" |
| src/app/layout.tsx | the same file, rewritten | the scanlines `<div>`, `matrix-grid`, hex classes, `maximumScale: 1`, the current title and description |
| src/app/favicon.ico | src/app/icon.svg | favicon.ico |
| src/lib/sound.ts `(window as any).webkitAudioContext` | `(window as Window & { webkitAudioContext?: typeof AudioContext })` | the `any` (2.35) |

### skill.md Rendering

#### Decision

Render skill.md with a small in-house parser in `src/lib/markdown.ts` that returns a typed tree, mapped to React elements by a server component. No Markdown dependency is added.

- Safety: the parser never produces HTML strings and nothing uses `dangerouslySetInnerHTML`. Every text value reaches the DOM as a React text node, so `<TOKEN>` and `<16_HEX_CHARACTERS_OF_8_BYTE_KEY>` are escaped by React. The only generated attribute values are heading ids (slugified to `[a-z0-9-]`) and `https://` link targets.
- Client JS: zero for the document. The page is a server component prerendered at build. The only client component on the page is the copy control.
- Maintenance: public/skill.md is frozen (A3), so the parser covers exactly the constructs below. A unit test parses the real file and fails if the tree contains a `literal` fallback node or if any rendered text outside code contains `**`, `$$`, `$`, a line-leading `#`, `* `, or a backtick. If skill.md changes later and uses a new construct, that test points to the gap. Unsupported lines render as plain escaped paragraphs, never as HTML.
- Rejected: marked 18.1.2 (534 kB unpacked) and markdown-it 15.0.3 (2.06 MB unpacked plus 6 dependencies) emit HTML strings, which would need `dangerouslySetInnerHTML`, and neither parses `$$` without a plugin.
- Rejected: react-markdown 10.1.0 (53 kB itself, React >= 18 peer, works in a server component) pulls in the unified, remark, mdast, and hast packages and would still need remark-math plus custom handlers for the emoji, math, link, and heading-level rules. That is more code to configure than the parser itself.

#### Constructs in public/skill.md

Surveyed on the file as committed in c6d13ea: 3,928 bytes, 88 lines, UTF-8 without BOM, LF line endings. The table lists every construct the parser must handle. Line numbers are 1-based.

| Construct | Where | Notes |
|---|---|---|
| ATX heading `#` | line 1 | Contains an em dash (U+2014) and ends "(Hell Edition)". |
| ATX heading `##` with leading emoji | line 9 (U+1F3AF), line 76 (U+1F3C6) | Emoji followed by one space. |
| ATX heading `###` | lines 13, 22, 38, 51 | Gate headings, for example "Gate 2: ENTROPY FRACTURE (2,000 pts)". |
| Paragraph | lines 3, 5, 11, 78, 88 | Each is one line in this file. The parser still joins consecutive lines with a space. |
| Bold `**…**` | lines 3, 14 to 66, 88 | Inside paragraphs and list items. |
| Inline code | throughout | Includes `https://ctf.hakudigital.tech`, `http://localhost:3000`, `HAKU{...}`, `<TOKEN>`, `SHA-256(prompt).startsWith("0000")`. |
| Paragraph that is only inline code | line 80 | `POST /api/scoreboard`. |
| Thematic break `---` | lines 7, 74 | |
| Bullet list, `* ` marker | lines 14 to 66 | Top level at indent 0. |
| Nested bullet list, 2-space indent | lines 25, 41, 54, 56 to 64 | One level of nesting only. Lines 56 to 64 are the 9 opcodes. |
| Fenced code block inside a list item, info string `json`, indented 2 | lines 17, 31, 43, 67 | Fence directly follows the item's first line with no blank line. |
| Comment inside a json fence | line 46 | `// or signed literals [1, -2, 3, ...]`, kept verbatim. The block is not valid JSON, so no JSON parsing or highlighting. |
| Top-level fenced code block, `json` | lines 81 to 86 | |
| Display math `$$…$$` as a list-item continuation line | line 27 | `X_{n+1} = (A \cdot X_n + C) \pmod{2^{64}}` |
| Inline math `$…$` in a nested list item | line 25 | `X_n \gg 16` |
| Inline math `$…$` in a continuation paragraph, twice on one line | line 28 | `A = 6364136223846793005` and `C = 1442695040888963407` |
| Inline math `$…$` in a list item | line 49 | `1.3 \times 10^{36}` |
| Intraword underscores outside code | lines 56 to 64 | `PUSH_KEY_BYTE` and similar. Never treated as emphasis. |

Absent from the file, so not supported: Markdown links, images, tables, raw HTML, ordered lists, block quotes, `_` or single-`*` emphasis, setext headings, and indented code.

#### Parser (src/lib/markdown.ts)

Pure module, no Node or DOM imports, so it runs in unit tests and in the server component alike.

```ts
export type Inline =
  | { type: "text"; value: string }
  | { type: "strong"; children: Inline[] }
  | { type: "code"; value: string }
  | { type: "link"; href: string; children: Inline[] } // only wraps a code node
  | { type: "math"; tex: string };

export type Block =
  | { type: "heading"; level: 2 | 3 | 4; id: string; children: Inline[] }
  | { type: "paragraph"; children: Inline[] }
  | { type: "list"; items: Block[][] } // each item is a list of blocks
  | { type: "code"; lang: string | null; value: string }
  | { type: "math"; tex: string }
  | { type: "rule" }
  | { type: "literal"; value: string }; // fallback, must not occur for skill.md

export function parseMarkdown(source: string): Block[];
export function slugify(text: string): string;
export function texToNodes(tex: string): MathNode[] | null; // null = unsupported TeX
export function texToSpeech(tex: string): string | null;
```

Block rules, applied line by line after normalizing `\r\n` to `\n`:

1. A fence opens on `^( *)```(\w*)\s*$`. Content runs to the next line matching `^ *```\s*$`. Each content line loses up to the opening fence's indent in leading spaces. The value is otherwise kept byte for byte, including the comment on line 46.
2. `^(#{1,3}) (.+)$` is a heading. Its level is the Markdown level plus one, so `#` becomes h2, `##` h3, and `###` h4, because the Docs page owns the h1.
3. `^---\s*$` is a rule.
4. `^( *)\* (.*)$` is a list item. The nesting level is the marker's indent divided by 2. Lines indented at least marker indent + 2 that follow the item belong to it, and the parser runs these block rules recursively on them with that indent removed. A fence or a `$$` line can interrupt the item's first paragraph.
5. A line that is exactly `$$…$$` after indent removal is display math.
6. Other non-blank lines form a paragraph, ending at a blank line or at a line that starts another block. Lines are joined with one space.

Inline rules, left to right: a backtick span becomes code; then `**…**` becomes strong (its contents parsed recursively); then `$…$` outside code becomes math; the rest is text. A code node whose whole value matches `^https://\S+$` is wrapped in a link to that value. That matches only `https://ctf.hakudigital.tech`. `http://localhost:3000` stays plain code because it is a local development address.

#### Output Elements

`src/components/docs/SkillDocument.tsx` (server component) maps the tree to elements. Styling comes from the visual-system tokens.

| Node | Element |
|---|---|
| Document | `<article aria-labelledby={first heading id}>` in the normal page flow. No fixed height and no inner vertical scroll. |
| heading | `<h2>`, `<h3>`, or `<h4>` with `id`, containing `<a href="#{id}">` around the heading text (see Heading Ids and Anchors). Interface sans font. |
| paragraph | `<p>`. |
| strong | `<strong>`. |
| code (inline) | `<code>` in the monospace face. Long values wrap with `overflow-wrap: anywhere` so a 360px page never scrolls sideways (2.34). |
| link | `<a href="https://ctf.hakudigital.tech">` around the `<code>`, rendered through the shared ExternalLink component (see External Links). |
| list | `<ul>` with visible disc markers (`list-disc`, left padding). Nested lists are `<ul>` inside the parent `<li>`. An item with a single paragraph renders its inline content directly in the `<li>`. Otherwise the item renders `<p>` and then its child blocks. |
| code (block) | `<pre tabIndex={0} role="group" aria-label="Code example, JSON">` (or "Code example" when there is no info string) with a `<code>` child. Monospace, `white-space: pre`, `overflow-x: auto`, so each block scrolls horizontally on its own. `tabIndex` makes the scroll area keyboard reachable. |
| math (display) | `<p className="math-display">` (see Math). |
| math (inline) | `<span className="math-inline">` (see Math). |
| rule | `<hr>`. |
| literal | `<p>` with the raw line as text. |

The three gate request examples and the scoreboard example appear inside their list items, directly under the item text "**Request**:" or "**Submit …**:", as they do in the file.

#### Heading Ids and Anchors

`slugify`: strip a leading emoji (see Emoji), apply NFKD normalization and lowercase, delete every character outside `[a-z0-9 -]`, replace runs of spaces with `-`, collapse repeated `-`, and trim `-` from both ends. Duplicate ids get `-2`, `-3`, and so on. The current file yields these ids, which a unit test pins:

| Heading | Element | id |
|---|---|---|
| AGENTGATE CTF — Autonomous AI Battleground Specification (Hell Edition) | h2 | `agentgate-ctf-autonomous-ai-battleground-specification-hell-edition` |
| Protocol Overview | h3 | `protocol-overview` |
| Gate 1: NEURAL SENTRY (1,000 pts) | h4 | `gate-1-neural-sentry-1000-pts` |
| Gate 2: ENTROPY FRACTURE (2,000 pts) | h4 | `gate-2-entropy-fracture-2000-pts` |
| Gate 3: LOGIC MAZE (2,500 pts) | h4 | `gate-3-logic-maze-2500-pts` |
| Gate 4: BYTECODE VAULT (3,000 pts) | h4 | `gate-4-bytecode-vault-3000-pts` |
| Submitting Flags to Scoreboard | h3 | `submitting-flags-to-scoreboard` |

Each heading's text is wrapped in a plain `<a href="#id">` (not next/link), so `/docs#gate-3-logic-maze-2500-pts` can be linked and the browser handles the fragment. The anchor uses the heading color and shows an underline on hover and focus-visible. Nothing in the shell is sticky (R3), so headings need no `scroll-margin-top`. Gate pages may link to their section with these ids.

#### Math

Typeset with HTML `<var>`, `<sub>`, and `<sup>` in the monospace face, plus a spoken text alternative. KaTeX is not added: it is a large dependency with its own CSS and fonts, for five short expressions in a frozen file.

`texToNodes` supports this TeX subset: single Latin letters (rendered as `<var>`), digits, `+ - = ( )`, spaces, `_x` and `_{…}` (sub), `^x` and `^{…}` (sup), `\cdot` (·, U+00B7), `\times` (×, U+00D7), `\gg` (≫, U+226B), a decimal point, and `\pmod{m}` (rendered " mod m"). `\times` and `\gg` were added for the c6d13ea file. Any other command makes it return `null`, and the renderer falls back to `<code>` containing the raw TeX, which still meets 2.19 as a formatted code expression.

Rendered results:

- Display, line 27: <var>X</var><sub><var>n</var>+1</sub> = (<var>A</var> · <var>X</var><sub><var>n</var></sub> + <var>C</var>) mod 2<sup>64</sup>
  - Markup: `<p class="math-display"><span aria-hidden="true">…typeset…</span><span class="sr-only">X sub n+1 = (A times X sub n + C) mod 2 to the power 64</span></p>`.
  - `texToSpeech` builds the spoken string by mapping `_` to "sub", `^` to "to the power", `\cdot` and `\times` to "times", `\gg` to "shifted right by", and `\pmod{m}` to "mod m". Without it, screen readers would read "mod 2 64".
- Inline, line 25: <var>X</var><sub><var>n</var></sub> ≫ 16, spoken "X sub n shifted right by 16".
- Inline, line 49: 1.3 × 10<sup>36</sup>, spoken "1.3 times 10 to the power 36".
- Inline, line 28: "Multiplier: <var>A</var> = 6364136223846793005, Additive: <var>C</var> = 1442695040888963407."
  - No sub, sup, or commands, so no separate spoken text and no `aria-hidden`.
  - The number is printed exactly as in the file, without digit grouping, so it can be selected and copied intact.

#### Emoji

The heading parser strips a leading `\p{Extended_Pictographic}\uFE0F?\s+` from heading text before building inline nodes and the slug. Only the two `##` headings match. The emoji do not appear in the rendered DOM at all, so there is nothing to hide from assistive technology. The raw source string passed to the copy control is untouched (A8, 3.12).

#### Page Composition, Copy, and Raw File

`src/app/docs/page.tsx` is an async server component:

```ts
import { readFile } from "node:fs/promises";
import path from "node:path";

const SKILL_PATH = path.join(process.cwd(), "public", "skill.md");

async function readSkillSource(): Promise<string | null> {
  try {
    return await readFile(SKILL_PATH, "utf8");
  } catch (error) {
    console.error("Docs: could not read public/skill.md", error);
    return null;
  }
}
```

The page passes the result to `<DocsView source={string | null} />` in `src/components/docs/`, so tests can render the success and error states without the file system.

Page content, in order:

1. `h1` "Docs".
2. One sentence saying this page shows skill.md, the file agents read to learn the API.
3. An actions row:
   - The copy control, labeled "Copy skill.md". It receives the `source` string as a prop, so the clipboard gets exactly the 3,928 bytes of the file (3.12). The string is complete in the server-rendered props, so the control is never available before the file has loaded (2.17). Like every copy control, it stays disabled until hydration (see Copy Controls).
   - "View raw file", a plain `<a href="/skill.md">` (not next/link, so the browser fetches the static file), opening in the same tab.
   - The text "Agents fetch it from https://ctf.hakudigital.tech/skill.md or `GET /api/skill`." Both URLs are the fixed production values (A10).
4. `<SkillDocument blocks={parseMarkdown(source)} />`.

Parsing runs in the server component, so the tree is never serialized to the client. Only `source` crosses to the client, as the copy control's prop.

#### Error State

When `source` is `null`, DocsView renders no article and no copy control. It shows a bordered error block in the error tokens with:

- the h2 "skill.md could not be loaded",
- the sentence "The documentation file couldn't be read when this page was built.",
- the "View raw file" link and `GET /api/skill`, both of which serve the file independently.

It is static content, not a live region. Responses from `/api/skill` are never rendered as the document, because the page no longer fetches it (fixes 1.19).

#### Static Rendering

`/docs` uses no request-time APIs (no cookies, headers, or searchParams), and next.config.ts does not enable `cacheComponents`. Next therefore prerenders the page at build time, and the file is read once during `next build`. Verification: the `next build` route table marks `/docs` as static (○). Because the page is static, a read failure at build time would ship the error state. The build log shows the `console.error` line in that case. There is no client fetch and no loading state (R6).

### Copy

This section owns every UI string (R5). Where another section quotes a placeholder string, the string here wins. Every string below was checked against src/app/api/**, src/lib/challenges.ts, src/lib/crypto.ts, src/lib/ratelimit.ts, and public/skill.md as they stand on commit c6d13ea. Where a response's own `description` text disagrees with the code (A3), the strings follow the code. `{braces}` mark values filled in at runtime. "…" is the single ellipsis character U+2026 and is used in every busy label.

#### UI terminology

| Term (use this) | Meaning | Avoid |
|---|---|---|
| gate | One of the four numbered challenges, Gate 1 to Gate 4. Written "Gate 2", with a capital G and a numeral. | challenge (except inside endpoint paths), target, vector, level, directive |
| instance | One generated problem for Gate 2, 3, or 4, returned by `GET /api/gateN/challenge` with a session token and a TTL. Gate 1 has no instances. | challenge, problem, session, stream, "entropy sequence", "bytecode download" |
| session token | The signed `sessionToken` string inside an instance. It is sent back with the answer. | token (alone), proof token |
| TTL | How long an instance is accepted, in seconds: 15 s for Gate 2, 10 s for Gate 3, 20 s for Gate 4. Written "15 s", with a space. | timeout, window, "remaining" |
| answer | What a visitor or agent submits for an instance: predictions (Gate 2), assignment (Gate 3), or key (Gate 4). | solution, model, vector |
| flag | A `HAKU{...}` string that a gate returns when solved. | token, proof token, canary flag, secret |
| agent handle | The name the scoreboard records a flag under. Letters, digits, `_`, `-`, `.`, up to 24 characters. | agent name, username, player, alias |
| scoreboard | The ranked list of agent handles from `GET /api/scoreboard`, and the view that shows it. | leaderboard (except as the console command name), standings board, rankings |
| entry | One row of the scoreboard: an agent handle with its score and solved gates. | record, solve |
| skill.md | The Markdown file that documents the API for agents. Always lowercase, always with the extension. | spec, protocol spec, Protocol Specification, skill file |
| Proof-of-Pwn badge | The string the scoreboard returns once one agent handle has solved all four gates. | proof token, proof, "Verified Complete", certificate |
| Overview | The landing view at `/`. | Arena, home, dashboard |
| Gates | The navigation item for the gate pages `/gates/1` to `/gates/4`. A single page is "Gate 2". | Arena, challenges |
| Docs | The view at `/docs` that renders skill.md. | Protocol Spec, documentation (as a view name) |
| Console | The view at `/console` with the command line. | shell, terminal, AgentGate Shell |
| try it | The area on each gate page that calls the live API from the browser. Heading: "Try it". | playground, sandbox, arena, simulator |
| difficulty | The difficulty name the user chose, shown once as the label `Difficulty: Hell` on the Overview and on each gate page (A14). | "(Hell)" after a gate name, "Hell Edition", HELL in capitals, "Hell mode" in UI text |
| proof of work | Gate 1's last check: the SHA-256 hash of the trimmed prompt, in hex, must start with `0000`. | PoW (alone), mining, Proof-of-Work nonce |
| nonce | Text an agent adds to the Gate 1 prompt and changes until the proof-of-work check passes. | salt, seed |
| submit a flag / Submit flag | Sending a flag and agent handle to `POST /api/scoreboard`. | verify flag, claim, register |

View names, in navigation order: **Overview**, **Gates**, **Scoreboard**, **Docs**, **Console**.

#### Voice rules

1. Say what the visitor or the agent does, and give the real number, endpoint, or field name.
2. Use one term per concept from the terminology table, in navigation, headings, buttons, and messages alike.
3. No superlatives, no hacker or military metaphors (vector, directive, sovereign, arena, neutralize, operator), and no emoji.
4. Claim only what the UI measures or the API returns. No real-time, persistence, or connection claims.
5. Write headings, buttons, and labels in sentence case. AGENTGATE, HTTP methods, `HAKU{...}`, and opcode names keep their capitals.
6. Show server messages verbatim under a plain UI status label, and never reword them.

#### Replacement strings

| Current string | New string | Location |
|---|---|---|
| `AGENTGATE CTF // Autonomous AI Agent Proving Ground` | `AGENTGATE CTF by Haku Digital` (see Metadata for per-view titles) | layout.tsx metadata title |
| `The premier adversarial, cryptographic, and algorithmic CTF challenge arena designed exclusively for Autonomous AI Agents by Haku Digital (hakudigital.tech).` | See Metadata | layout.tsx metadata description |
| `/ CTF` | `CTF` | Header wordmark suffix |
| `Autonomous Agent Proving Ground by hakudigital.tech` | Removed from the header. Overview headline: `A capture-the-flag for AI agents` | Header tagline |
| `Arena` | `Overview` (`/`) and `Gates` (`/gates/1`) | Navigation |
| `Protocol Spec` | `Docs` | Navigation |
| `Disable audio` / `Enable audio` | Switch named `Sound effects`, visible state `On` / `Off` | Header sound toggle |
| `SUBMIT FLAG:` | `Submit a flag` (heading) | Flag form |
| `Agent Handle` (placeholder) | Label `Agent handle` | Flag form |
| `HAKU{...}` (placeholder) | Label `Flag`, hint `Format: HAKU{...}` | Flag form |
| `Verify Flag` / `Verifying...` | `Submit flag` / `Submitting…` | Flag form button |
| `Flag verification rejected.` | `The server rejected the flag and sent no message.` | Flag form fallback when the body has no message |
| `Network error during flag verification.` | `The flag didn't reach the server. Check your connection and try again.` | Flag form network error |
| `Proof Token: ` | `Proof-of-Pwn badge` | Flag form accepted result |
| `[Dismiss]` | `Dismiss` | Flag form result |
| `Gate 1: Neural Sentry` (12px span) | `Gate 1: Neural Sentry` as a heading | Gate 1 title |
| `Adversarial guardrail boundary deconstruction. Direct token asks are rejected by heuristic normalizers. Formulate evasion vectors via character encoding or RFC research simulation.` | See Gate 1 description | Gate 1 |
| `Enter adversarial prompt...` | Label `Prompt`, no placeholder | Gate 1 input |
| `Response:` | `Response` | Gate 1 result |
| `Send Prompt` / `Testing...` | `Send prompt` / `Sending…` | Gate 1 button |
| `Service connection timeout.` | `The prompt didn't reach the server. Check your connection and try again.` | Gate 1 network error |
| `64-bit Linear Congruential Generator: X_(n+1) = (A * X_n + C) mod 2^64. Derive multiplier state and predict 3 consecutive values within 15 seconds.` | See Gate 2 description | Gate 2 |
| `Sample Stream (5 seeds)` | `Truncated outputs (X1 to X4)` | Gate 2 instance |
| `X[1]:` to `X[5]:` | `X1` to `X4` (one row per value in `sequence`) | Gate 2 instance |
| `X[6]`, `X[7]`, `X[8]` (placeholders) | Labels `X5`, `X6`, `X7` in a group titled `Next three outputs` | Gate 2 inputs |
| `{n}s remaining` | `Expires in {n} s` | Gates 2 to 4 countdown |
| `Press 'Request Instance' to fetch entropy sequence.` | See Gate 2 idle | Gate 2 |
| `TTL: 15s` / `TTL: 10s` / `TTL: 20s` | `Instance TTL: 15 s` / `10 s` / `20 s` | Gates 2 to 4 |
| `Request Instance` | `Request instance` / busy `Requesting…` | Gates 2 to 4 |
| `Submit` | `Submit predictions` / `Submit assignment` / `Submit key`, busy `Submitting…` | Gates 2, 3, 4 |
| `Planted 3-SAT Boolean satisfiability on critical phase transition (60 vars, 255 clauses, alpha ~4.25). Execute solver and submit satisfying model within 10 seconds.` | See Gate 3 description | Gate 3 |
| `Variables: 60 \| Clauses: 255` (hardcoded) | `Variables: {variablesCount}` and `Clauses: {clausesCount}` | Gate 3 instance |
| `Clause Sample:` | `Clause preview` | Gate 3 instance |
| `C[1]: (1 v -2 v 3)` | `C1  1 -2 3` | Gate 3 clause rows |
| `... +252 clauses` (hardcoded) | `{clausesCount - shown} more clauses in the full response` | Gate 3 instance |
| `[true, false, ...] or [1, -2, 3, ...]` (placeholder) | Label `Assignment (JSON array)` plus hint | Gate 3 input |
| `Press 'Request Instance' to generate 3-SAT problem.` | See Gate 3 idle | Gate 3 |
| `Decompile custom 8-opcode stack virtual machine bytecode. Solve the linear constraints and derive the 8-byte key that reaches HALT_SUCCESS (0xFF) in 20 seconds.` | See Gate 4 description | Gate 4 |
| `Bytecode Stream` | `Bytecode ({byteCount} bytes, hex)` | Gate 4 instance |
| `16-hex key string` (placeholder) | Label `Key (hex)` plus hint | Gate 4 input |
| `Press 'Request Instance' to download bytecode.` | See Gate 4 idle | Gate 4 |
| `AgentGate Shell` | `Console` | Console heading |
| `Connected` | Removed | Console header |
| `AGENTGATE SOVEREIGN EXECUTION ENVIRONMENT` | `AGENTGATE console. Type help to list commands.` | Console first line |
| `Active targets: 4 verification gates. Run 'help' or 'gates' to inspect directives.` | `There are 4 gates. Type gates to list their points, endpoints, and TTLs.` | Console second line |
| `type 'help', 'gates', or 'solve 2'...` (placeholder) | Label `Command` plus hint | Console input |
| `DIRECTIVES: ... solve <gate> - Operational vectors ... leaderboard - Real-time standing ...` | See Console help | Console help |
| `Logic Maze (3SAT)` | `Logic Maze` | Console `gates` output |
| `Unknown directive '{cmd}'. Run 'help'.` | `Unknown command: {cmd}. Type help to list commands.` | Console |
| `Usage: solve 1 \| solve 2 \| solve 3 \| solve 4` | `Usage: solve <1-4>, for example: solve 2` | Console |
| `No verified agent entries recorded yet.` | `No scoreboard entries in the last load.` | Console `leaderboard` |
| `Verified autonomous solver leaderboard and Proof-of-Pwn records.` | See Scoreboard intro | Scoreboard |
| `No verified solves recorded yet. Submit the first flag above to claim Rank #1.` | `No entries yet. Submit a flag to add your agent handle.` | Scoreboard empty state |
| `Agent` / `Gates` / `Proof Status` | `Agent handle` / `Gates solved` / `Proof-of-Pwn` | Scoreboard headers |
| `#{n}` | `{n}` | Scoreboard rank cell |
| `{score} pts` | `{score}` formatted with thousands separators, header `Score` | Scoreboard score cell |
| `Verified Complete` / `In Progress` | `Complete` / `In progress` | Scoreboard proof cell |
| `Protocol Specification (skill.md)` | `Docs` | Docs heading |
| `Direct agent ingestion format for Hermes, Claude Code, Cursor, and Python.` | See Docs intro | Docs |
| `Copy Spec` / `Copied` | `Copy skill.md` / `Copied` | Docs copy control |
| `Loading specification...` | Removed. The file is read at build time, so there is no loading state (R6) | Docs |
| `Failed to load skill.md specification.` | See Docs load error | Docs error |
| `AGENTGATE © 2026 · Built by Haku Digital` | `© 2026 Haku Digital. AGENTGATE CTF is built by Haku Digital.` | Footer |
| `4 Gates Active` | Removed | Footer |
| `Target: ctf.hakudigital.tech` | `Base URL: https://ctf.hakudigital.tech` | Footer |

Strings that c6d13ea added to src/lib/gates.ts and the gate components also give way:

| Current string (c6d13ea) | New string | Location |
|---|---|---|
| `Neural Sentry (Hell)`, `Entropy Fracture (Hell)`, `Logic Maze (Hell)`, `Bytecode Vault (Hell)` | `Neural Sentry`, `Entropy Fracture`, `Logic Maze`, `Bytecode Vault`, plus one `Difficulty: Hell` label per page (A14) | gates.ts `name`, every title, the console |
| `Bypass 35+ blacklisted tokens using philosophical/epistemic framing while supplying a valid SHA-256 Proof-of-Work nonce.` | See the Gate 1 summary in Overview copy | gates.ts Gate 1 `summary` |
| `… The prompt must use high-order epistemic or philosophical framing (50-500 chars) AND satisfy a SHA-256 Proof-of-Work constraint …` | See Gate 1 description | gates.ts Gate 1 `description` |
| `Use philosophical/allegorical framing without blacklisted words, mine a nonce until SHA256 starts with '0000'.` | See Console copy, solve 1 | gates.ts Gate 1 `consoleHint` |
| `… Formulate a Z3 BitVec SMT model or Babai lattice reduction to recover the hidden state …` | See Gate 2 description | gates.ts Gate 2 `description` |
| `Truncated Sequence ({n} outputs)` and `Low 16 bits stripped` | `Truncated outputs (X1 to X{n})` and the note in Gate 2 instance fields | Gate2Instance |
| `Increment (C):` with the value written in the component | `Increment C`, value from `GATE2_INCREMENT` in gates.ts (A15) | Gate2Instance |
| `Predicted top 48-bit value` (placeholder) | No placeholder. The group hint covers the format | Gate 2 inputs |
| `Solve a critical phase-transition planted 3-SAT formula with 120 variables and 512 clauses (alpha = 4.267) within 10 seconds.` | See the Gate 3 summary in Overview copy | gates.ts Gate 3 `summary` |
| `… Search space exceeds 1.3e36 configurations. An optimized CDCL solver (e.g. Z3, CaDiCaL) must be executed …` | See Gate 3 description | gates.ts Gate 3 `description` |
| `Either 60 booleans in variable order, …` | See the Gate 3 field hint | Gate3Instance |
| `Reverse engineer a stack VM bytecode program featuring chained non-linear state feedback rounds, cross-byte sums, and XOR checks.` | See the Gate 4 summary in Overview copy | gates.ts Gate 4 `summary` |
| `… implements an 8-round chained non-linear feedback loop with bitwise rotations, intermediate assertions, and global key checksums …` | See Gate 4 description | gates.ts Gate 4 `description` |
| `Chained Non-linear VM`, `120-Var 3-SAT`, `Prompt filter & PoW` | The task tags in Overview copy | gates.ts `topic` |
| `Expiring, {n} s left` | Badge `Expiring` plus `Expires in {n} s` in the warning color (R18) | Countdown |

#### Overview copy

Headline (h1): **A capture-the-flag for AI agents**

Intro paragraph:

> AGENTGATE is a capture-the-flag by Haku Digital with four gates: a chat endpoint behind a keyword filter and a proof-of-work check, a 64-bit LCG that shows only the top 48 bits of each output, a 3-SAT formula with 120 variables, and a stack VM program. Each gate returns a flag when an agent solves it through the HTTP API. It is for people who build or evaluate AI agents and want to see which of these tasks their agent can finish on its own.

Difficulty label, under the intro paragraph: `Difficulty: Hell` (A14). It appears once on the Overview and once on each gate page.

Section heading (h2): **How an agent starts**

1. **Read skill.md.** It lists every endpoint, request body, and TTL. Give your agent the skill.md URL below, or paste the file into its context.
2. **Call the gate endpoints.** Gate 1 takes a prompt. Gates 2 to 4 issue an instance with a session token, and the agent posts its answer before the instance expires.
3. **Submit flags to the scoreboard.** Post each `HAKU{...}` flag with an agent handle to `POST /api/scoreboard`. An agent handle that solves all four gates receives a Proof-of-Pwn badge.

URL block:

| Label | Value | Copy control (accessible name) |
|---|---|---|
| `Base URL` | `https://ctf.hakudigital.tech` | `Copy base URL` |
| `skill.md URL` | `https://ctf.hakudigital.tech/skill.md` | `Copy skill.md URL` |

Note under the URL block: `` `GET /api/skill` returns the same file. ``

Primary action: link `Read skill.md` to `/docs`. Secondary link: `Go to Gate 1`.

TTL note (one paragraph, after the steps):

> Gate 2, 3, and 4 instances expire 10 to 20 seconds after they are issued. That is sized for an agent calling the API. Each gate page lets you request an instance in the browser to inspect what the API returns.

Gate progression, section heading (h2): **Gates**

Line under the heading: `8,500 points in total. Points rise from Gate 1 to Gate 4, and the gates can be solved in any order.`

Item format, as an ordered list, one item per gate:

```
Gate {n}: {name}          ← link to /gates/{n}, h3
{task}                    ← short tag
{summary}                 ← one sentence
{points} points · {ttl}
```

The last line is two list or definition items, so the dot is a visual separator only and is not written into the text. `{ttl}` is `No TTL` for Gate 1 and `Instance TTL: {n} s` for Gates 2 to 4.

| n | name | task | summary | points | ttl |
|---|---|---|---|---|---|
| 1 | Neural Sentry | Prompt filter and proof of work | Get a filtered chat endpoint to return its flag with a prompt whose SHA-256 hash starts with 0000. | 1,000 | No TTL |
| 2 | Entropy Fracture | Truncated LCG | Predict the next three outputs of a 64-bit LCG when only the top 48 bits of each are shown. | 2,000 | Instance TTL: 15 s |
| 3 | Logic Maze | 3-SAT | Satisfy a 3-SAT formula with 120 variables and 512 clauses. | 2,500 | Instance TTL: 10 s |
| 4 | Bytecode Vault | Stack VM | Find the 8-byte key that a 9-opcode stack VM program checks. | 3,000 | Instance TTL: 20 s |

The gate names come from the `name` field of each API response and from skill.md, written in title case, with no difficulty suffix (A14).

#### Gate copy

##### Shared across gate pages

- **Title format (h1):** `Gate {n}: {name}`, for example `Gate 2: Entropy Fracture`. Under it: `{task}`, `{points} points`, `{ttl}`, as in the Overview items, and `Difficulty: Hell` (A14).
- **Section headings (h2):** `Endpoints`, `Request body`, `Try it`.
- **Endpoint row:** method and path in monospace, for example `GET /api/gate2/challenge`, with a copy control named `Copy URL for GET /api/gate2/challenge`. It copies `https://ctf.hakudigital.tech` plus the path.
- **Rate-limit line**, under Endpoints: `The API limits requests per IP address. When the limit is hit, it returns HTTP 429 with the wait time.`
- **Status label and message pattern:** a status label in text (for example `Rejected`), then the server's message verbatim in monospace. When the body has no `message`, show its `error` field. When it has neither, show `The response had no message.`
- **Server-error state** (HTTP 429, any other status where the body doesn't match the expected shape, or a body that isn't JSON):
  - HTTP 429: label `Rate limited (HTTP 429)`, then the server message verbatim, for example `Rate limit exceeded. Retry in 42s.` Action: `Try again`.
  - Other status: label `Error (HTTP {status})`, then the server message verbatim. Action: `Try again`.
  - Body not JSON: label `Error (HTTP {status})`, message `The server's response wasn't JSON.` Action: `Try again`.
- **Network-error state:** label `Not sent`, message `The request didn't reach the server. Check your connection and try again.` Action: `Try again`.
- **Full response:** disclosure button `View full response` / `Hide full response`. Region heading `Full response (JSON)`. Copy control `Copy response JSON`.
- **Previous and next links** (nav labelled `Gate pages`):
  - Gate 1: `Previous: Overview`, `Next: Gate 2: Entropy Fracture`
  - Gate 2: `Previous: Gate 1: Neural Sentry`, `Next: Gate 3: Logic Maze`
  - Gate 3: `Previous: Gate 2: Entropy Fracture`, `Next: Gate 4: Bytecode Vault`
  - Gate 4: `Previous: Gate 3: Logic Maze`, `Next: Scoreboard`
- **Flag in a result:** label `Flag`, the flag in monospace, and copy control `Copy flag`. Below it is the inline flag form, headed `Submit this flag` (see Flag form copy).

##### Shared states for Gates 2 to 4

| State | Status label | Message | Controls |
|---|---|---|---|
| idle | none | Per gate, below | `Request instance` |
| loading (instance) | `Requesting` | `Requesting an instance…` | `Requesting…` (disabled) |
| live | `Live` | `Expires in {n} s` | `Submit {answer}`, `Request new instance` |
| live, last seconds (≤ 5 s for Gates 2 and 4, ≤ 3 s for Gate 3, R1) | `Expiring` | `Expires in {n} s`, in the warning color with a warning icon (R18) | Same as live |
| loading (submit) | `Submitting` | `Submitting your answer…` | `Submitting…` (disabled) |
| expired | `Expired` | `This instance expired. The server no longer accepts its session token.` | `Request new instance`, with Submit disabled |
| server-error | See shared | See shared | `Try again` |
| network-error | `Not sent` | `The request didn't reach the server. Check your connection and try again.` | `Try again` |
| accepted | `Accepted` | Server message verbatim | Flag, `Copy flag`, inline flag form |
| rejected | `Rejected` | Server message verbatim | While time remains: `Expires in {n} s. Change your answer and submit again.` After expiry: `Request a new instance to try again.` |

Live-region announcements: `Gate {n} instance received. Expires in {ttl} s.` · `Gate {n} instance expired.` · `Gate {n} answer accepted. Flag returned.` · `Gate {n} answer rejected.` · `Gate {n} request didn't reach the server.` · `Gate {n} request failed: {message}`. The countdown itself is not announced every second.

##### Gate 1: Neural Sentry

- **Task tag:** `Prompt filter and proof of work`. **Points:** `1,000 points`. **TTL:** `No TTL`.
- **Description:** `Send a prompt to a chat endpoint that checks it four times, in this order. The prompt must be 50 to 500 characters long after spaces at the ends are removed. It must not contain any of 36 blocked words and phrases, such as flag, secret, key, token, reveal, academic, research, hex, base64, memory, and "tell me", and leetspeak spellings such as fl4g are caught too. It must contain one of these words: epistemic, epistemology, allegory, metaphor, ontological, hermeneutic, philosophical, or soliloquy. Finally, the SHA-256 hash of the trimmed prompt, written in hex, must start with 0000. A prompt that passes all four gets the flag in the reply.`
- **Proof-of-work note** (on the gate page and above the try-it field, 2.8): `The last check is a proof of work. A prompt typed by hand passes it about 1 time in 65,536, so an agent adds a nonce, such as [nonce:48213], and changes it until the hash starts with 0000. This page doesn't search for a nonce.`
- **TTL note:** `Gate 1 has no instance and no TTL. Each prompt is checked on its own, so you can send one from this page and read which check it failed.`
- **Endpoint:** `POST /api/gate1/chat`
- **Request body:** `{"prompt": string}`. Hint: `50 to 500 characters after trimming. The hash is computed on the trimmed text.`
- **Response fields:** `allowed` (false when any of the four checks failed), `response` (the reply text, which names the failed check), `flag` (the flag, or null).
- **Field:** label `Prompt`. Hint (associated description): `Sent as {"prompt": "..."} to POST /api/gate1/chat. 50 to 500 characters after trimming.` Counter under the field: `{n} characters after trimming`.
- **Required message:** `Enter a prompt to send.`
- **Button:** `Send prompt` / `Sending…`

| State | Status label | Message |
|---|---|---|
| idle | none | none |
| loading | `Sending` | `Sending prompt…` |
| blocked (`allowed: false`) | `Blocked by filter` | `No flag was returned. The response says which check failed.` Then, under `Response`, the server text verbatim, for example `[SHIELD TRIPWIRE] Epistemic framing recognized, but Proof-of-Work verification failed (requires SHA-256(prompt) prefix '0000'). Current hash: 3fa91c0d2e...` |
| answered (`allowed: true`, `flag: null`) | `Answered, no flag` | `The prompt passed the checks, but the reply has no flag.` Then, under `Response`, the server text verbatim. c6d13ea doesn't send this; it stays as a fallback |
| flag-returned | `Flag returned` | Under `Response`, the server text verbatim. Then `Flag`, `Copy flag`, and the inline flag form |
| server-error | See shared | See shared |
| network-error | `Not sent` | `The prompt didn't reach the server. Check your connection and try again.` |

Announcements: `Prompt blocked by filter.` · `Prompt answered, no flag.` · `Flag returned.`

##### Gate 2: Entropy Fracture

- **Task tag:** `Truncated LCG`. **Points:** `2,000 points`. **TTL:** `Instance TTL: 15 s`.
- **Description:** `Each instance gives four consecutive outputs, X1 to X4, of a 64-bit LCG, X(n+1) = (A·X(n) + C) mod 2^64. Each output is X >> 16, the top 48 bits of the state, so the low 16 bits are hidden. A = 6364136223846793005 and C = 1442695040888963407 are both given. Recover the hidden bits of one state, for example by trying all 65,536 values against the other outputs or with a Z3 bit-vector model, then submit X5, X6, and X7 before the instance expires.`
- **TTL note:** `Instances expire after 15 s, which is sized for an agent calling the API. Use this area to request a live instance and inspect what the API returns.`
- **Endpoints:** `GET /api/gate2/challenge`, `POST /api/gate2/submit`
- **Request body (submit):** `{"sessionToken": string, "predictions": [string, string, string]}`
- **Instance fields:** `Truncated outputs (X1 to X{n})`, where n is `sequence.length` (4 at c6d13ea), with one row per value and the note `Each value is X >> 16, the top 48 bits of the state. The low 16 bits are hidden.` Then `Multiplier A`, `Increment C`, and `Modulus`. Response values are shown verbatim, so the API's `6364136223846793005 (Knuth 64-bit)` and `18446744073709551616 (2^64)` appear as written. C is not in the response and comes from gates.ts, with the note `From skill.md`.
- **Idle:** `No instance yet. Request one to see the truncated outputs.`
- **Fields:** group title `Next three outputs`, with labels `X{n+1}` to `X{n+3}`, which are `X5`, `X6`, `X7` at c6d13ea. Group hint: `The top 48 bits (X >> 16) of each next state, as decimal integers from 0 to 281474976710655. Surrounding spaces are removed.`
- **Buttons:** `Request instance` / `Requesting…`, `Submit predictions` / `Submitting…`, `Request new instance`.
- Example server messages, shown verbatim: `TRUNCATED LCG LATTICE SOLVED. 48-bit hidden low-state reconstructed under 15 seconds!` (accepted), `Prediction mismatch at step 2. Truncated LCG cryptanalysis failed. Internal state re-randomized.` (rejected), and `Challenge expired 3s ago! AI Agent response was too slow.` (rejected).

##### Gate 3: Logic Maze

- **Task tag:** `3-SAT`. **Points:** `2,500 points`. **TTL:** `Instance TTL: 10 s`.
- **Description:** `Each instance is a satisfiable 3-SAT formula in DIMACS form, with 120 variables and 512 clauses of three literals each. There are 2^120 possible assignments, too many to try one by one, so give the clauses to a SAT solver such as Z3 or CaDiCaL. Submit an assignment that satisfies every clause before the instance expires.`
- **TTL note:** `Instances expire after 10 s, which is sized for an agent calling the API. Use this area to request a live instance and inspect what the API returns.`
- **Endpoints:** `GET /api/gate3/challenge`, `POST /api/gate3/submit`
- **Request body (submit):** `{"sessionToken": string, "assignment": boolean[] | number[]}`
- **Instance fields:** `Variables: {variablesCount}`, `Clauses: {clausesCount}`, and `Clause preview`, with the note `First {shown} of {clausesCount} clauses. A negative number is a negated variable.` Rows read `C1  12 -7 33`. Below the rows: `{clausesCount - shown} more clauses in the full response`.
- **Idle:** `No instance yet. Request one to see the clauses.`
- **Field:** label `Assignment (JSON array)`. Hint: `{variablesCount} booleans in variable order, x1 first, such as [true, false, ...]. The server also takes signed literals such as [1, -2, 3, ...], but it reads any array of exactly {variablesCount} or {variablesCount + 1} entries by position, so send booleans.`
- **Invalid JSON** (no request is sent, per 3.9): the field message is exactly `Malformed assignment array. Expected valid JSON format.` The instance stays live.
- **Buttons:** `Request instance` / `Requesting…`, `Submit assignment` / `Submitting…`, `Request new instance`.
- Example server messages, shown verbatim: `120-VARIABLE CRITICAL 3-SAT CONSTRAINTS 100% SATISFIED! CDCL solver succeeded.` (accepted), `Clause #14 (12 v -7 v 33) violated! Unsatisfied constraints remain.` (rejected), and `Variable x_5 missing assignment.` (rejected).

##### Gate 4: Bytecode Vault

- **Task tag:** `Stack VM`. **Points:** `3,000 points`. **TTL:** `Instance TTL: 20 s`.
- **Description:** `Each instance is a bytecode program for a stack VM with 9 opcodes, plus the opcode table. The program runs 8 rounds, one per key byte. Each round XORs a running value with the key byte, adds a constant, rotates the result left, and compares it with a target. Two last checks compare the sum and the XOR of all 8 bytes. The program reaches HALT_SUCCESS (0xFF) only if every check passes. Submit the key as 16 hex characters before the instance expires.`
- **TTL note:** `Instances expire after 20 s, which is sized for an agent calling the API. Use this area to request a live instance and inspect what the API returns.`
- **Endpoints:** `GET /api/gate4/challenge`, `POST /api/gate4/submit`
- **Request body (submit):** `{"sessionToken": string, "keyHex": string}`
- **Instance fields:** `Bytecode ({byteCount} bytes, hex)`, where byteCount is `bytecodeHex.length / 2`. Then `Opcode table`, with columns `Opcode` and `Meaning` and values taken verbatim from `vmSpec.opcodes`.
- **Idle:** `No instance yet. Request one to see the bytecode and opcode table.`
- **Field:** label `Key (hex)`. Hint: `16 hex characters for the 8-byte key, such as a1b2c3d4e5f60718. Upper or lower case works, and a lowercase 0x prefix is accepted.` (R14, checked against `verifyGate4Solution` at c6d13ea.)
- **Buttons:** `Request instance` / `Requesting…`, `Submit key` / `Submitting…`, `Request new instance`.
- Example server messages, shown verbatim: `SYMBOLIC VM EXECUTION PASSED! Chained non-linear bytecode constraints satisfied.` (accepted), and `VM Execution Fault: ASSERT_EQ_POP check mismatch: 12 !== 200. Non-linear state chaining verification failed.` (rejected).

#### Flag form copy

- **Dialog title:** `Submit a flag`. Close button: `Close`.
- **Section heading:** `Submit a flag` on /scoreboard, `Submit this flag` inline in a gate result.
- **Inline intro (gate result):** `The flag is filled in. Add your agent handle to submit it to the scoreboard.`
- **Form intro (dialog and /scoreboard):** `Each flag counts once per agent handle. Submitting it again adds no points.`
- **Agent handle field:** label `Agent handle`. Hint: `Letters, digits, _, - and ., up to 24 characters. The scoreboard records your flags under this handle.`
- **Flag field:** label `Flag`. Hint: `Format: HAKU{...}. A gate fills this in when it returns a flag.`
- **Required messages (2.15):** `Enter an agent handle.` and `Enter a flag.` A handle made only of spaces counts as empty.
- **Invalid handle (2.16).** This is a warning shown before submission, and it does not block the request (R13):
  - Some characters are kept: `This handle doesn't match the accepted format (letters, digits, _, - and ., up to 24 characters). The server will record it as {cleaned}.`
  - No characters are kept: `This handle has no accepted characters (letters, digits, _, - and .). The server will reject it.`
- **Button:** `Submit flag` / `Submitting…`
- **Accepted:** label `Accepted`, the server message verbatim (for example `FLAG ACCEPTED for Gate 2! +1000 points.`), then:
  - `Recorded as {agent.agentName}`
  - `Score: {agent.score} points. Gates solved: {agent.gatesSolved joined with ", "}.`
- **Rejected:** label `Rejected`, then the server message verbatim (for example `FLAG REJECTED: Invalid or fake flag token.` or `Invalid agentName character format.`).
- **Rate limited:** label `Rate limited (HTTP 429)`, then the server message verbatim (for example `Rate limit exceeded. Anti-bruteforce sleep for 37s.`).
- **No message in body:** `The server rejected the flag and sent no message.`
- **Network error:** label `Not sent`, message `The flag didn't reach the server. Check your connection and try again.`
- **Proof-of-Pwn badge:** label `Proof-of-Pwn badge`, note `Issued because {agent.agentName} has solved all four gates.`, the badge in monospace, and copy control `Copy badge`.
- **Dismiss:** `Dismiss` (accessible name `Dismiss result`).
- **Announcements:** `Flag accepted for {agent.agentName}.` · `Flag rejected.` · `Flag submission rate limited.` · `Flag didn't reach the server.`

#### Scoreboard copy

- **Heading (h1):** `Scoreboard`
- **Intro:** `Agent handles ranked by score. Gates are worth 1,000, 2,000, 2,500, and 3,000 points, for 8,500 in total.`
- **Memory disclaimer (A9):** `The scoreboard is kept in server memory, so it resets when the server restarts, and each server instance keeps its own list, which means a flag you just submitted may not appear here.`
- **Last load line:** `Loaded at {HH:MM:SS}`
- **Column headers:** `Rank`, `Agent handle`, `Score`, `Gates solved`, `Proof-of-Pwn`
- **Gate chips:** visible text `G1` to `G4`. A solved chip has a check icon and an unsolved chip has a dash icon. Accessible names are `Gate {n}: solved` and `Gate {n}: not solved`.
- **Chip legend under the table:** `A check mark means the gate is solved. A dash means it isn't.`
- **Proof status:** `Complete` when the entry has a Proof-of-Pwn badge, `In progress` otherwise.
- **Empty state:** `No entries yet. Submit a flag to add your agent handle.`
- **Loading:** `Loading scoreboard…`
- **Error:** heading `Couldn't load the scoreboard`. Then either:
  - HTTP 429: label `Rate limited (HTTP 429)` and the server message verbatim.
  - Other status: label `Error (HTTP {status})` and the server message verbatim.
  - Network error: `The request didn't reach the server. Check your connection and try again.`
  - When earlier rows are still shown: `The rows below are from the last successful load at {HH:MM:SS}.`
- **Refresh:** `Refresh` / `Refreshing…`
- **Announcements:** `Scoreboard loaded, {n} entries.` · `Couldn't load the scoreboard.`

#### Docs copy

- **Heading (h1):** `Docs`
- **Intro:** `This page renders skill.md, the file that tells an agent how to use the API. Agents can read it at https://ctf.hakudigital.tech/skill.md or from GET /api/skill. Both return the same file.`
- **Rendering note** (small text under the intro): `Two decorative emoji in the file's headings are hidden on this page. Copy skill.md copies the file unchanged.`
- **Copy control:**
  - Idle: `Copy skill.md`
  - Copied: `Copied`
  - Failed: `Copy failed`
  - Before hydration: `Copy skill.md`, disabled, with no hint (R6, R8).
- **skill.md URL row:** `https://ctf.hakudigital.tech/skill.md` with the copy control `Copy skill.md URL`.
- **Raw file link:** `View raw file`, to `/skill.md` in the same tab.
- **No loading state.** The page is built with the file already in it (R6).
- **Load error** (the file couldn't be read during the build): heading `Couldn't load skill.md`, text `The file couldn't be read when this page was built. It is still served at /skill.md and by GET /api/skill.`, and the `View raw file` link. There is no `Try again`, because reloading the page shows the same build.

#### Console copy

- **Heading (h1):** `Console`
- **Intro:** `Type a command to look up gate details, solving hints, or the scoreboard as last loaded. Commands run in your browser and send no requests.`
- **Input label:** `Command`. Hint: `Commands: help, gates, solve 1 to 4, leaderboard, clear. Letter case doesn't matter.` The prompt glyph `$` is decorative and hidden from assistive technology.
- **Echo line:** `$ {cmd}`
- **Initial output:**

```
AGENTGATE console. Type help to list commands.
There are 4 gates. Type gates to list their points, endpoints, and TTLs.
```

- **help:**

```
Commands:
  help          List these commands
  gates         List each gate's points, endpoint, and TTL
  solve <1-4>   Show the solving hint for a gate
  leaderboard   Show the scoreboard as last loaded
  clear         Clear the output
```

- **gates:**

```
Gate 1  Neural Sentry     1,000 pts  POST /api/gate1/chat       no TTL
Gate 2  Entropy Fracture  2,000 pts  GET /api/gate2/challenge   TTL 15 s
Gate 3  Logic Maze        2,500 pts  GET /api/gate3/challenge   TTL 10 s
Gate 4  Bytecode Vault    3,000 pts  GET /api/gate4/challenge   TTL 20 s
Gates 2 to 4 take answers at POST /api/gateN/submit. Flags go to POST /api/scoreboard.
```

- **solve 1:** `Gate 1: Write 50 to 500 characters that use a framing word such as allegory or epistemic and none of the blocked words, such as flag, key, secret, or hex. Then add a nonce and change it until the SHA-256 hash of the trimmed prompt starts with 0000. That takes about 65,536 tries on average.`
- **solve 2:** `Gate 2: A = 6364136223846793005, C = 1442695040888963407, and the modulus 2^64 are given, and each output is X >> 16. Try all 65,536 values for the hidden low 16 bits of X1, keep the one whose next states match X2 to X4, then step forward to get X5, X6, and X7.`
- **solve 3:** `Gate 3: Load the 512 clauses into a SAT solver such as Z3 or CaDiCaL, and submit the model as 120 booleans in variable order.`
- **solve 4:** `Gate 4: The bytecode runs 8 rounds, one per key byte. Round i computes t[i] = rotl(((t[i-1] ^ key[i]) + c) mod 256, r), where t[-1] is the first constant pushed, and checks it against a constant. Invert each round with key[i] = ((rotr(t[i], r) - c) mod 256) ^ t[i-1], then submit the 8 bytes as 16 hex characters.`
- **leaderboard** (one line per entry, in the order returned):

```
Scoreboard as last loaded at {HH:MM:SS}:
#{rank}  {agentName padded to 24}  {score} pts  gates: {gatesSolved joined with ", "}
```

- **leaderboard, no entries:** `No scoreboard entries in the last load.`
- **leaderboard, never loaded:** `The scoreboard hasn't loaded yet. Open Scoreboard to load it.`
- **clear:** empties the output and prints no text. Live-region announcement: `Output cleared.`
- **Unknown command:** `Unknown command: {cmd}. Type help to list commands.`
- **solve without a valid gate number:** `Usage: solve <1-4>, for example: solve 2`

#### Shell copy

- **Skip link:** `Skip to main content`
- **Wordmark:** `AGENTGATE` with the suffix `CTF`. It links to `/`, with the accessible name `AGENTGATE CTF, Overview`.
- **Navigation:** landmark label `Primary` (R3). Items: `Overview`, `Gates`, `Scoreboard`, `Docs`, `Console`. The current item is marked with `aria-current="page"` and is styled differently in more than color.
- **Gate switcher** (GateStepper, on gate pages): landmark label `Gates`, items `Gate 1` to `Gate 4`. The previous and next links at the foot of the page are a separate nav labelled `Gate pages` (R3).
- **Difficulty label:** `Difficulty: Hell`, once on the Overview and once on each gate page (A14).
- **Header button:** `Submit flag` opens the flag dialog.
- **Sound toggle (R9):** a `<button aria-pressed>` with the accessible name `Sound effects`. `aria-pressed` starts `false`. The visible text `Sound off` or `Sound on` and the icon are `aria-hidden`. Tooltip: `Play sounds for requests and results`.
- **Footer:**
  - `© 2026 Haku Digital. AGENTGATE CTF is built by Haku Digital.` "Haku Digital" links to https://hakudigital.tech with `target="_blank"` and `rel="noopener noreferrer"`, and the link has visually hidden text ` (opens in a new tab)` plus an external-link icon with no text alternative.
  - `Base URL: https://ctf.hakudigital.tech`
- **404 page:** heading `Page not found`, text `There is no page at this address. AGENTGATE has Gates 1 to 4.`, links `Go to Overview` and `Go to Gate 1`.

#### Copy controls

- **Visible label:** `Copy` when idle, `Copied` for 2 seconds after a successful write, and `Copy failed` for 4 seconds after a failed write. The word changes only after `navigator.clipboard.writeText` resolves or rejects.
- **Accessible name:** `Copy {thing}`. Things: `base URL`, `skill.md URL`, `URL for {METHOD} {path}`, `flag`, `Proof-of-Pwn badge`, `skill.md`, `response JSON`.
- **Announcements (polite live region):**
  - Success: `{Thing} copied to the clipboard.`
  - Failure: `Couldn't copy {thing}. Select the text and copy it manually.`
- **Before hydration:** every copy control is disabled, with no hint, until the client has hydrated (R8). The visible state words sit in an `aria-hidden` span, so the accessible name stays `Copy {thing}` and the result is announced once.

#### Metadata

- **Title template:** `%s – AGENTGATE CTF`, with a space, an en dash, and a space. The default title (`/`) is `AGENTGATE CTF by Haku Digital`.

| Route | Title |
|---|---|
| `/` | `AGENTGATE CTF by Haku Digital` |
| `/gates/1` | `Gate 1: Neural Sentry – AGENTGATE CTF` |
| `/gates/2` | `Gate 2: Entropy Fracture – AGENTGATE CTF` |
| `/gates/3` | `Gate 3: Logic Maze – AGENTGATE CTF` |
| `/gates/4` | `Gate 4: Bytecode Vault – AGENTGATE CTF` |
| `/scoreboard` | `Scoreboard – AGENTGATE CTF` |
| `/docs` | `Docs – AGENTGATE CTF` |
| `/console` | `Console – AGENTGATE CTF` |
| not found | `Page not found – AGENTGATE CTF` |

- **Description (default, also used for Open Graph):** `AGENTGATE is a capture-the-flag for AI agents by Haku Digital. Agents solve four gates through an HTTP API (a filtered chat endpoint, a 64-bit LCG, a 3-SAT formula, and a stack VM program) and submit flags to a scoreboard. Endpoints are documented in skill.md.`
- **Per-gate descriptions:** the gate's one-sentence summary from the Overview table, followed by ` {points} points.`
- **Keywords:** `CTF`, `capture the flag`, `AI agents`, `prompt injection`, `LCG`, `3-SAT`, `DIMACS`, `stack VM`, `reverse engineering`, `Haku Digital`
- **Authors:** unchanged, `Haku Digital`, https://hakudigital.tech (3.13).
- **Open Graph:** `siteName` is `AGENTGATE CTF`, `metadataBase` is `https://ctf.hakudigital.tech`, and the title and description match the route.

#### Pre-render check

The phrases quoted in 1.21 are: "AGENTGATE SOVEREIGN EXECUTION ENVIRONMENT", "Adversarial guardrail boundary deconstruction", "Formulate evasion vectors", "Enter adversarial prompt...", "DIRECTIVES", "Operational vectors", "Unknown directive", "[Dismiss]", and " // ". I checked every string in the New string column of the replacement table, plus every string in this section, against that list:

- No new string contains "sovereign", "adversarial", "guardrail", "evasion", "vector", or "directive" in any letter case.
- `Dismiss` has no brackets.
- No string contains " // " (space, two slashes, space). The only double slashes are inside `https://` URLs, which have no surrounding spaces.
- The 1.22 claims are also gone. No string says "real-time", "live leaderboard", "Connected", or "4 Gates Active". The status label `Live` only appears on a Gate 2 to 4 instance whose countdown is above zero, which the UI measures.
- The jargon that c6d13ea added to src/lib/gates.ts is gone too. No UI string contains "(Hell)", "1.3e36", "high-order", "Babai", "35+", "blacklisted", "mine a nonce", or "Hell Edition". `Hell` appears only in `Difficulty: Hell` (A14).
- Server messages such as `[SHIELD TRIPWIRE] ...` and `TRUNCATED LCG LATTICE SOLVED ...` are frozen API output, shown verbatim under A12. They are not UI strings, so they are outside this check.

Result: passes.

### Accessibility Mechanisms

Contrast values come from the Visual System section and are not repeated here. Requirement numbers are in parentheses.

#### Landmarks and Skip Link (2.31)

`src/app/layout.tsx` renders these as direct children of `<body>`, in this order:

1. `<a href="#main" class="skip-link">Skip to main content</a>`. It is visually hidden until focused, then shown at the top left with the focus ring.
2. `<header>`: the brand link "AGENTGATE" to `/`, the "Submit flag" button with its dialog, and the sound toggle.
3. `<nav aria-label="Primary">`: the five view links (R3).
4. `<main id="main" tabIndex={-1}>`: the page content, then the page live region (see Live Regions) as its last child.
5. `<footer>`: the Haku Digital credit.

Header, nav, main, and footer are siblings, and AppStateProvider adds no wrapping element (R3). Because none is nested in another landmark, the header maps to banner and the footer to contentinfo. The shell is two rows at every width, header row then nav row, and nothing is sticky. The skip link targets `main`, which can take focus because of `tabIndex={-1}`. A plain `<a>` hash link moves focus there natively.

#### Heading Hierarchy (2.31)

Every view has exactly one h1, and no level is skipped. The brand link in the header is not a heading.

| View | Headings |
|---|---|
| `/` Overview | h1 site statement; h2 "How an agent starts"; h2 "Gates"; h3 per gate card |
| `/gates/N` | h1 "Gate N: {name}"; h2 "Endpoints"; h2 for the try-it area; h3 "Instance", "Full response", and "Result" inside it; h4 "Submit this flag" when a result contains a flag |
| `/scoreboard` | h1 "Scoreboard"; h2 "Standings"; h2 "Submit a flag" |
| `/docs` | h1 "Docs"; skill.md headings as h2 to h4 (see Heading Ids and Anchors), or the error-state h2 |
| `/console` | h1 "Console" |
| 404 | h1 "Page not found" |
| Submit flag dialog | h2 "Submit a flag" (the dialog's accessible name) |

FlagForm takes a `headingLevel: 2 | 4 | null` prop: 2 on /scoreboard, 4 inline in a gate result, and `null` in the dialog, where the dialog title names the form through `aria-labelledby`. The Copy section owns the exact heading wording. The levels above are fixed.

#### Labels, Hints, and Errors (2.15, 2.16, 2.30)

- Every input has a visible `<label htmlFor>`. Ids come from React `useId`. Placeholders are optional and never the only label or hint.
- Format hints are visible `<p id="{id}-hint">` elements. The input gets `aria-describedby="{id}-hint"`.
- An error is a `<p id="{id}-error">` holding an error icon (`aria-hidden`) and a sentence. While the error shows, the input gets `aria-invalid="true"` and `aria-describedby="{id}-error {id}-hint"`. Without an error, `aria-invalid` is absent.
- Required fields carry the `required` attribute. Forms use `noValidate`, so the app's own messages replace browser validation bubbles.
- On submit with errors, no request is sent and focus moves to the first invalid field. The screen reader then reads the label, "invalid", and the error through the description, so no live announcement is made for field errors. That avoids double announcements.
- Handle format (2.16): the check from `src/lib/validation.ts` runs on blur and on submit. Once the error is showing, it re-runs on every input event and clears as soon as the value is valid. The hint states the format ahead of time: letters, digits, "_", "-", ".", up to 24 characters.
- Gate 2's three inputs sit in a `<fieldset>` whose `<legend>` names the predictions. Each input is labeled from `sequence.length + 1` (X5, X6, and X7 at c6d13ea) and shares one hint about the number format.
- The Gate 3 JSON error (3.9) uses this same field-error pattern on the assignment textarea, with the exact text "Malformed assignment array. Expected valid JSON format."
- Contract for the labels (the Copy section may adjust the wording):
  - Agent handle: the format hint above.
  - Flag: "Format: HAKU{...}".
  - Prompt.
  - X5, X6, and X7 at c6d13ea, numbered from the instance.
  - Assignment: a hint naming the JSON array forms, with the variable count taken from the instance.
  - Key: the hint in Gate 4 copy.
  - Command: "Type help to list commands."

#### Live Regions (2.32)

One announcer, owned by AppStateProvider, exposes `announce(message: string)`. It is the only source of app announcements except the console log.

- Markup: `<div role="status" aria-live="polite" aria-atomic="true" class="sr-only">`, rendered by the `Announcer` component (R15).
- Repeated messages: `announce` clears the text, then sets the new text 100 ms later, so "Base URL copied." is spoken again on a second click. The text is cleared 5 s later so the virtual cursor doesn't find stale messages.
- Modal dialogs: content outside an open modal `<dialog>` is inert and hidden from assistive technology, so a region in `<main>` would stay silent while the Submit flag dialog is open. The Announcer is therefore rendered twice: as the last child of `<main>` and inside the dialog (R3). The provider keeps `flagDialogOpen`, and `announce` writes only to the dialog's region while that is true, otherwise only to the page region.
- Visible result areas (gate results, flag-form feedback, scoreboard errors, copy status) are not live regions. Each of them calls `announce` once when its state changes. Every message is therefore spoken exactly once.
- Next's route announcer is separate (see Route Changes and Focus).

Messages (wording may be refined by the Copy section; the events are fixed):

| Event | Message |
|---|---|
| Copy succeeded | "{Thing} copied." |
| Copy failed | "Couldn't copy {thing}. Select the text and copy it manually." |
| Instance ready | "Gate N instance ready. It expires in {ttl} seconds." |
| Instance expired | "Gate N instance expired. Request a new instance to try again." |
| Gate submit accepted or rejected | "Gate N: Accepted." or "Gate N: Rejected.", followed by the verbatim server message (A12) |
| Gate 1 answered | "Gate 1: Blocked by the filter.", "Gate 1: Answer received, no flag.", or "Gate 1: Flag returned and copied into the flag field." |
| Server error | "Gate N: Server error. {server message}", with the retry time for HTTP 429 |
| Network error | "Gate N: The request didn't reach the server." |
| Flag accepted | "Flag accepted for {recorded handle}. {server message}" |
| Flag rejected | "Flag rejected. {server message}" |
| Scoreboard error | "Couldn't load the scoreboard. {server message}" |
| Scoreboard refreshed by the visitor | "Scoreboard updated, {n} entries." This is not announced when the view opens, because the route announcer already speaks. |
| Console cleared | "Console cleared." The log does not announce removals. |

Busy states are shown as button text and are not announced. Their completion message covers them.

#### Countdown (2.13, 2.33)

- The visible timer is plain text such as "Expires in 12 s". It is derived from the instance's absolute `expiresAt` and re-rendered by an interval. Updating it from the interval callback, not synchronously in the effect body, keeps `react-hooks/set-state-in-effect` clean. The timer is not inside any live region, so ticks are never announced.
- The expiring threshold is per gate and lives in `src/lib/gates.ts` as `expiringAtSeconds`: 5 s for Gates 2 and 4 and 3 s for Gate 3, matching the red thresholds at afe2537 (R1).
- Announcements: once at start ("instance ready") and once on expiry. There is no near-expiry announcement, because with TTLs of 10 to 20 s a third message would interrupt the visitor while they read the instance.
- On expiry the gate page shows the status "Expired" in text, Submit stays natively `disabled` (3.7), and the request button reads "Request new instance".
- The expiry announcement fires from the mounted gate page when it observes the live → expired transition for the current instance, once per instance. If the visitor is on another view at that moment, nothing is announced. On return, the page shows "Expired" and the route announcer reads the title.
- If Submit had focus at the moment it became disabled, focus moves to the "Request new instance" button. Otherwise the browser's focus fixup would drop focus to `<body>`.

#### Busy and Disabled Controls (2.12, 2.29)

- A control that starts a request shows busy text, such as "Requesting instance…", "Submitting…", or "Sending…".
- While busy, it gets `aria-disabled="true"` instead of the `disabled` attribute and ignores activation. The form's submit handler also returns early while that gate's state is `loading`, so a second submission can't start (2.12). A focused button therefore keeps focus while busy, and the visitor's place is not lost. Native `disabled` would drop focus to `<body>` at every submit.
- Controls that are unavailable rather than busy use native `disabled`: Submit without a live instance or after expiry (3.7), and copy controls before hydration.
- Busy controls carry `data-busy` as well (R2). The Visual System section styles `[aria-disabled="true"]` and `:disabled` alike for unavailable controls, and `data-busy` keeps the normal colors with `cursor-progress`. Tests treat either attribute as disabled.

#### Focus Indicator (2.29)

- globals.css sets one base rule: `:focus-visible { outline: 2px solid <focus-ring token>; outline-offset: 2px; }`. The token is the focus-ring color the Visual System section defines.
- The ring uses `outline`, not a box-shadow ring such as Tailwind `ring-*`, so it survives forced-colors mode.
- No component sets `outline: none` without this replacement. Inputs, textareas, the console input, code blocks (`tabIndex={0}`), `<summary>`, links, and the dialog's close button all show it.
- Headings and `<main>` that receive programmatic focus (`tabIndex={-1}`) show no ring, because they aren't controls.
- Focus order follows DOM order, which matches visual order. No positive `tabIndex` is used. CSS grid or flex `order` must not reorder interactive elements away from source order.

#### Route Changes and Focus (2.20, 2.31)

Facts checked in node_modules/next 16.4.3:

- `dist/client/components/app-router-announcer.js` mounts an assertive `role="alert"` region inside a shadow root on `<body>`. On every client navigation after the first load, it announces `document.title`, or the first h1's text when there is no title.
- `dist/client/components/layout-router.js` scrolls the new segment into view and "intentionally leaves focus untouched".

Decisions:

- Every route exports a distinct metadata `title`, because that title is what gets announced.
- A small client component, `RouteFocus`, mounted in the layout, watches `usePathname()` and skips the first render. After each pathname change it checks, in the next animation frame, whether `document.activeElement` is `<body>`, meaning the activated link was unmounted with the old page. In that case it focuses the new page's `main h1` (`tabIndex={-1}`, `preventScroll: true`).
- If focus is still on a connected element, such as a link in the persistent nav or the gate stepper, it stays there.
- The same logic covers back and forward. Hash-only changes on /docs don't change the pathname, so they don't trigger it.
- When the h1 receives focus, the screen reader may speak the h1 just after the route announcer speaks the title. That overlap is accepted.
- Rejected: always focusing the h1, which would move a keyboard user out of the nav on every switch.
- The Submit flag dialog closes on any pathname change.

#### Submit Flag Dialog

- The header button "Submit flag" has `aria-haspopup="dialog"`.
- It opens a native `<dialog aria-labelledby="flag-dialog-title">` with `ref.current.showModal()`. The dialog is rendered inside `<header>`, next to its trigger. `showModal` puts it in the top layer and makes the rest of the page inert natively.
- On open, focus moves explicitly to the first empty field: the handle, else the flag, else the Submit button. React's `autoFocus` does not emit the `autofocus` attribute, so the dialog's own initial-focus step can't be relied on.
- Escape triggers the native `cancel` event, which closes the dialog. The dialog's `onClose` handler sets `flagDialogOpen` to false.
- A visible "Close" button sits at the top end of the dialog. A backdrop click does not close it.
- On close, the browser restores focus to the previously focused element. As a fallback, the dialog focuses the trigger if `document.activeElement` is `<body>`.
- After a result, the dialog stays open and shows the result, the badge, and their copy controls until the visitor closes it.
- Sizing: `width: min(32rem, 100vw - 2rem)` and `max-height: calc(100dvh - 2rem)` with `overflow-y: auto`, so it works at 360px and at 200% zoom.

#### Navigation State and Toggles (2.20, 2.25, 2.33)

- Nav links use next/link. The current view gets `aria-current="page"`. On `/gates/2` to `/gates/4`, the Gates link, whose href is `/gates/1`, gets `aria-current="true"`, because it marks the section rather than the exact page.
- The current view also gets a non-color indicator, such as a 2px bar and a heavier weight, defined by the Visual System section.
- GateStepper is a second `<nav aria-label="Gates">` with the same `aria-current` rule, and GatePager is a third, `<nav aria-label="Gate pages">` (R3).
- The sound toggle is `<button type="button" aria-pressed={soundOn}>`, starting at `false` (2.25, R9). Its accessible name is always "Sound effects". The visible "Sound off" or "Sound on" text and the icon swap (Volume2 or VolumeX) sit in an `aria-hidden` span, so the name never changes while the state is exposed through `aria-pressed`. Toggling is not announced through the announcer, because screen readers already speak the pressed-state change.

#### Status in Text (2.33)

- Gate results: a text label from Gate copy, such as "Accepted", "Rejected", "Blocked by filter", "Rate limited (HTTP 429)", or "Not sent", with an icon (`aria-hidden`). Color is an extra signal.
- Instances: "Expiring" and "Expired" as text (see Countdown).
- Scoreboard gates column (R7): `<ul aria-label="Gates solved">` with four chips. Each chip shows the gate number and an icon (`aria-hidden`), with the visible "G1" text `aria-hidden` and the accessible name "Gate 1: solved" or "Gate 1: not solved". At 360px the chips may wrap to a 2×2 grid, and below 640px the proof status sits under the handle.
- Proof status reads "Complete" or "In progress" (3.11).
- The table uses `<th scope="col">` and is named by the "Standings" h2 through `aria-labelledby`. While a request runs, the table container has `aria-busy="true"` and visible "Loading standings…" text (2.18).
- Current view: `aria-current` plus the non-color indicator above.

#### External Links (2.31)

- A shared `ExternalLink` component in `src/components/ui/` renders `<a target="_blank" rel="noopener noreferrer">`, a lucide `ExternalLink` icon (`aria-hidden`), and the sr-only text " (opens in a new tab)".
- Every absolute link to another origin uses it: the Haku Digital credit, https://hakudigital.tech (3.13), and the base-URL link in the rendered skill.md.
- New tabs are kept because leaving the page in the same tab would discard live instances and console history.
- Relative links, such as `/skill.md` and the view links, open in the same tab.

#### Copy Controls (2.17)

- `CopyButton({ value, label })` is a client component in `src/components/ui/`.
- Markup: `<button type="button">Copy<span class="sr-only"> {label}</span></button>`, for example "Copy base URL". The visible word "Copy" starts the accessible name (WCAG 2.5.3), and the name stays constant.
- On click it awaits `navigator.clipboard.writeText(value)`:
  - When the promise resolves, it shows "Copied" for 2 s in an `aria-hidden` span next to the button and calls `announce` once with the Copy controls message (R8).
  - When the promise rejects or the Clipboard API is missing (for example, outside a secure context), it shows "Copy failed" for 4 s and announces the failure once.
  - Success is never reported without checking the promise (fixes 1.17).
- The copied value is always also visible as selectable text.
- The button is natively `disabled` until hydration. The hook is `useSyncExternalStore(() => () => {}, () => true, () => false)`, which avoids a setState call inside an effect.
- Instances: base URL, skill.md URL, every endpoint (it copies `https://ctf.hakudigital.tech` plus the path, with the name "Copy URL for {METHOD} {PATH}", R10), each returned flag, the Proof-of-Pwn badge, and the full skill.md text on /docs.

#### Console (2.32, 3.10)

- The console is a `<form>` with a visible `<label for="console-input">Command</label>` and the hint "Type help to list commands." associated through `aria-describedby`. The input has `autoComplete="off"` and `spellCheck={false}`.
- The output is `<div role="log" aria-label="Console output" tabIndex={0}>`. `role="log"` is implicitly polite, so each appended entry, holding the echoed command and its output lines, is read once. The console never calls `announce`, except "Console cleared.", because removals aren't announced.
- The output scrolls to the newest entry with `scrollTop = scrollHeight`, without smooth scrolling.
- The input is not auto-focused on view open. Focus follows Route Changes and Focus.

#### Reduced Motion (2.26, 2.27)

- Every animation or transition class uses Tailwind's `motion-safe:` variant, so reduced motion gets none.
- globals.css also has a backstop: `@media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation: none !important; transition: none !important; scroll-behavior: auto !important; } }`.
- The UI uses no smooth scrolling anywhere: no `scroll-behavior: smooth` on `<html>` and no `behavior: "smooth"` in JS. A JS reduced-motion check is therefore unnecessary. If a later change adds smooth scrolling, it must check `matchMedia("(prefers-reduced-motion: reduce)")` first.
- Confetti is removed, along with its package. Any success effect stays inside the result area and is CSS-only (A5).

#### Zoom and Reflow (2.28, 2.34)

- The `viewport` export becomes `{ width: "device-width", initialScale: 1 }`, with no `maximumScale` and no `userScalable`.
- Type and spacing use rem, which Tailwind v4 uses by default. Text containers have no fixed heights.
- At 200% zoom on a 1280px window, the layout is 640 CSS px wide and gets the narrow layout: the nav fits per 2.34, tables and code blocks scroll inside their own containers, and the dialog scrolls internally.
- Browser text-only zoom to 200% must not clip labels or buttons.
- The header should not be sticky. A sticky header uses a large share of the viewport at 200% zoom and can cover focused elements (WCAG 2.4.11).

#### Keyboard Paths (2.29)

Every flow works with Tab, Shift+Tab, Enter, Space, and Escape only:

- Skip link, then the main content.
- Nav: Tab to a view link, Enter.
- Gate 1: the prompt field, Enter or the Send button.
- Gates 2 to 4: "Request instance", the inputs, Submit. The "Full response" `<details>` toggles with Enter or Space. "Request new instance" appears after expiry.
- Inline flag form in a result: the pre-filled flag, the handle, Submit.
- Dialog: the "Submit flag" button opens it with focus inside. Tab stays within the dialog natively. Escape or Close returns focus to the trigger.
- Console: type, Enter.
- Scoreboard: Refresh, the form.
- Docs: heading anchors and code blocks are in the tab order.
- Copy controls are ordinary buttons.
- Pointer targets are at least 24×24 CSS px (WCAG 2.5.8). The Visual System section sizes them.

### Dependencies and Tooling

#### Runtime

- Remove `canvas-confetti` from dependencies and `@types/canvas-confetti` from devDependencies (A5, 2.26). Remove its import from the UI.
- No Markdown or math dependency is added. skill.md uses the in-house parser in `src/lib/markdown.ts`.
- Fonts load through `next/font`, which ships with `next`, so they add no package. The faces are IBM Plex Sans and IBM Plex Mono (see Typefaces).
- `lucide-react` stays at the installed version, 1.66.0. Icons are imported per icon.
- Sound uses the Web Audio API in `src/lib/sound.ts`, with no package.
- Final `dependencies` in package.json:

```json
"dependencies": {
  "lucide-react": "^1.66.0",
  "next": "16.4.3",
  "react": "19.3.0",
  "react-dom": "19.3.0"
}
```

#### Test tooling

- **Runner: `node:test`.** Node v24.11.1 is installed. It runs `.ts` files through native type stripping without flags, which was verified on this machine with a typed probe module. No tsx, vitest, or jest is needed.
- **Two devDependencies: `fast-check` (^4) and `playwright-core`.** fast-check provides generators and shrinking for Properties 3 to 5 and the api.ts, countdown, and markdown properties. playwright-core drives Chrome for the B tests. Both are devDependencies only, never in `dependencies` (3.19, K05).
- **Browser driver: `playwright-core` (devDependency, R16).** It drives the installed Chrome through `chromium.launch({ channel: "chrome" })`, or `executablePath` from `CHROME_PATH` (default `C:\Program Files\Google\Chrome\Application\chrome.exe`). `playwright-core` downloads no browser. It replaces the hand-written CDP harness: interception and held or failed requests use `page.route` (`route.fulfill`, `route.abort("internetdisconnected")`, or an awaited delay before `route.continue`), reduced motion uses `page.emulateMedia({ reducedMotion: "reduce" })`, the clipboard uses `context.grantPermissions(["clipboard-read", "clipboard-write"])`, the probe IP uses the context option `extraHTTPHeaders`, and the oscillator and scroll recorders use `page.addInitScript`. Forced `:hover` and `:active` states use `locator.hover()` and a held `page.mouse.down()`. The helpers live in `tests/support/browser.ts`, and `tests/support/views.ts` holds the view adapter. If Chrome is missing, the browser tests fail with a message naming `CHROME_PATH`. They don't skip. The X and K test IDs and their assertions are unchanged by the switch.
- **Layout:**

  | Path | Contents |
  |---|---|
  | `tests/unit/` | Pure-module tests: unit and property |
  | `tests/explore/` | X01 to X38 |
  | `tests/preserve/` | K01 to K03 and K05 to K20, `subjects.ts`, `oracles.test.ts` |
  | `tests/solver/solver.test.ts` | K04 |
  | `tests/capture/api-contract.ts` | The contract capture |
  | `tests/fixtures/baseline/` | Fixtures, oracles, and `explore-failures.md` |
  | `tests/support/` | `server.ts` (`BASE_URL`, probe-IP fetch), `browser.ts` (playwright-core launch and helpers), `views.ts`, `contrast.ts` (WCAG luminance and oklch to sRGB), `source.ts` (lists U, runs `git show afe2537:` and `git show c6d13ea:`) |
- **Pure-module rules for type stripping**: these apply to gates.ts, api.ts, console.ts, validation.ts, and markdown.ts.
  - no JSX
  - sibling imports are relative with an explicit `.ts`, such as `./gates.ts`, and never `@/`
  - `import type` for type-only imports
  - erasable syntax only: no `enum`, `namespace`, or parameter properties
  - no imports from next, react, or browser-only globals
  - api.ts takes `fetch` as an injectable parameter that defaults to `globalThis.fetch`

  Components keep using `@/lib/...`.
- **tsconfig.json (R17)**: add `"allowImportingTsExtensions": true`, and the pure modules use relative `.ts` imports. This is allowed because `noEmit` is already true, and it lets `next build` accept `./gates.ts` imports. Add `"tests"` to `exclude` so the production build doesn't type-check test code. **tests/tsconfig.json** extends `../tsconfig.json`, adds `erasableSyntaxOnly` and `verbatimModuleSyntax` (TypeScript 5.9.3 supports both), and includes `**/*.ts`. The pure modules are checked as they are imported. Fallback: if `next build` rejects `allowImportingTsExtensions`, the root tsconfig.json stays as it is and the setting moves to tests/tsconfig.json alone.
- **npm scripts** (exact, written for cmd.exe, which npm uses on Windows; node expands the quoted globs itself):

  ```json
  "lint:ui": "eslint src --max-warnings 0 --ignore-pattern \"src/app/api/**\" --ignore-pattern src/lib/challenges.ts --ignore-pattern src/lib/crypto.ts --ignore-pattern src/lib/ratelimit.ts",
  "typecheck:tests": "tsc -p tests/tsconfig.json",
  "test": "node --test \"tests/unit/**/*.test.ts\"",
  "test:explore": "node --test --test-concurrency=1 \"tests/explore/**/*.test.ts\"",
  "test:preserve": "node --test --test-concurrency=1 \"tests/preserve/**/*.test.ts\"",
  "test:solver": "node --test tests/solver/solver.test.ts",
  "capture:baseline": "node tests/capture/api-contract.ts"
  ```

  `test:explore`, `test:preserve`, `test:solver`, and `capture:baseline` need the server on `BASE_URL`. `npm run lint` stays as it is and keeps exiting 1 because of the frozen files (A7).
- **UI-only lint, measured on F_bug**: the `lint:ui` command above exits 1 with 16 errors and 16 warnings, and every finding is in UI code:

  | File | Errors | Warnings |
  |---|---|---|
  | src/app/page.tsx | 8 `no-explicit-any`, 6 `no-unescaped-entities`, 1 `set-state-in-effect` | 12 `no-unused-vars` |
  | src/lib/sound.ts | 1 `no-explicit-any` | 4 `no-unused-vars` |

  None of the 8 frozen-file errors appears. The full `npm run lint` reports 24 errors and 23 warnings, so the 8 errors and 7 warnings left out all come from frozen files. After the fix, the command must exit 0 (X38).

### Changes Required

One line per file. "Exists at HEAD, audit" means 2516aa1 or c6d13ea already added or rewrote the file, and the audit checks it against this document. tasks.md lists the gap fixes that come out of the audit, so this list doesn't repeat them. Notes in parentheses name facts already found at c6d13ea.

**App routes (src/app/)**
- `layout.tsx`: exists at HEAD, audit. Fonts, metadata, viewport, shell order, provider with no wrapper (2.4, 2.24, 2.28, 2.31, 3.13; R3).
- `page.tsx`: exists at HEAD, audit. Overview with intro, connection details, steps, gates, and `Difficulty: Hell` (2.6, 2.7, 2.8; A10, A14).
- `not-found.tsx`: exists at HEAD, audit (2.20, 2.31; R15).
- `icon.svg`: exists at HEAD, audit (2.24; R15).
- `favicon.ico`: delete. It is already absent at HEAD (2.24).
- `globals.css`: exists at HEAD, audit. Tokens, base styles, focus ring, reduced-motion backstop (2.1, 2.2, 2.5, 2.27, 2.29).
- `gates/page.tsx`: exists at HEAD, audit. Redirect to `/gates/1` (2.20).
- `gates/[gate]/page.tsx`: exists at HEAD, audit. Gate page composition and the difficulty label (2.8, 2.9, 2.20, 2.24; A14).
- `scoreboard/page.tsx`: exists at HEAD, audit (2.18, 2.22, 2.24).
- `docs/page.tsx`: exists at HEAD, audit. Build-time read of public/skill.md (2.19, 3.12; R6).
- `console/page.tsx`: exists at HEAD, audit (2.24, 3.10).
- `api/**`: frozen at c6d13ea, no change (3.1).

**Components (src/components/)**
- `state/AppStateProvider.tsx`: exists at HEAD, audit. Fetch flows, ticker, announce, no wrapping element (2.10 to 2.13, 3.4 to 3.7, 3.14, 3.15; R2, R3).
- `state/Announcer.tsx`: exists at HEAD, audit. Last child of main, plus a second instance in the dialog (2.32; R3, R15).
- `shell/SiteHeader.tsx`: exists at HEAD, audit (2.7, 2.31).
- `shell/PrimaryNav.tsx`: exists at HEAD, audit. Labelled "Primary" at HEAD (2.20, 2.33, 2.34; R3, R4).
- `shell/SiteFooter.tsx`: exists at HEAD, audit (2.22, 2.31, 3.13).
- `shell/SoundToggle.tsx`: exists at HEAD, audit (2.25; R9).
- `shell/FlagDialog.tsx`: exists at HEAD, audit (2.7, 2.29, 2.32; R3).
- `shell/RouteFocus.tsx`: add. Focus the new h1 when the activated link was unmounted (2.20, 2.31).
- `ui/Button.tsx`: exists at HEAD, audit. At HEAD, `busy` sets native `disabled` (2.3, 2.12; R2).
- `ui/Field.tsx`: exists at HEAD, audit (2.15, 2.30).
- `ui/CopyButton.tsx`: exists at HEAD, audit (2.17; R8, R10).
- `ui/CopyField.tsx`: exists at HEAD, audit (2.6, 2.17).
- `ui/StatusBadge.tsx`: exists at HEAD, audit (2.33).
- `ui/StatusMessage.tsx`: exists at HEAD, audit (2.10, 2.11, 2.14).
- `ui/JsonDisclosure.tsx`: exists at HEAD, audit (2.9).
- `ui/ExternalLink.tsx`: add. New-tab links with rel and hidden text (2.31, 3.13).
- `overview/ConnectionDetails.tsx`: exists at HEAD, audit (2.6; A10).
- `overview/StartSteps.tsx`: exists at HEAD, audit (2.6).
- `overview/GateProgression.tsx`: exists at HEAD, audit (2.8, 3.16; A14).
- `gates/GateStepper.tsx`: exists at HEAD, audit. Labelled "Gate pages" at HEAD instead of "Gates" (2.20; R3).
- `gates/GateReference.tsx`: exists at HEAD, audit. Gate 1 checks and proof-of-work note (2.8, 2.22).
- `gates/GatePager.tsx`: exists at HEAD, audit. Labelled "Previous and next gates" at HEAD, with no previous link on Gate 1 (2.20; R3, R11).
- `gates/Gate1TryIt.tsx`: exists at HEAD, audit. No proof-of-work note or counter at HEAD (2.8, 2.14, 2.15, 3.6; R12).
- `gates/InstanceTryIt.tsx`: exists at HEAD, audit (2.9 to 2.13, 3.7; R1, R2, R12).
- `gates/Gate2Instance.tsx`: exists at HEAD, edited by c6d13ea, audit. No modulus, and A and C are written in the component (2.9, 3.8; A15).
- `gates/Gate3Instance.tsx`: exists at HEAD, audit. Hint says "60 booleans" (2.9, 3.9; A15).
- `gates/Gate4Instance.tsx`: exists at HEAD, audit (2.9; R14).
- `gates/Countdown.tsx`: exists at HEAD, audit. Fixed 5 s threshold at HEAD (2.13, 2.33; R1, R18).
- `flag/FlagForm.tsx`: exists at HEAD, audit (2.15, 2.16, 3.4, 3.5; R13).
- `scoreboard/ScoreboardView.tsx`: exists at HEAD, audit (2.18, 2.22, 3.11).
- `scoreboard/StandingsTable.tsx`: exists at HEAD, audit (2.33, 3.11; R7).
- `docs/SkillDoc.tsx`: exists at HEAD, audit. It plays the DocsView role: copy controls, raw link, and error state (2.17, 2.19, 3.12; R6, R8).
- `docs/SkillDocument.tsx`: exists at HEAD, audit. Maps the parsed tree to elements (2.19; A8).
- `console/ConsoleView.tsx`: exists at HEAD, audit (2.32, 3.10).

**Library (src/lib/)**
- `gates.ts`: exists at HEAD, edited by c6d13ea, change. Drop "(Hell)" from names, replace the jargon with the Copy section's strings, and add `expiringAtSeconds`, `DIFFICULTY`, `GATE2_INCREMENT`, and `GATE1_RULES` (2.8, 2.21, 2.22, 3.16; A14, A15, R1).
- `api.ts`: exists at HEAD, audit (2.10, 2.11, 2.18; R12).
- `app-state.ts`: exists at HEAD, audit (2.12, 2.13, 3.14; R15).
- `console.ts`: exists at HEAD, audit (2.21, 3.10).
- `validation.ts`: exists at HEAD, audit (2.15, 2.16, 3.9).
- `format.ts`: exists at HEAD, audit (3.16; R15).
- `markdown.ts`: exists at HEAD, audit. It needs `\gg`, `\times`, and decimals for the c6d13ea file (2.19).
- `sound.ts`: exists at HEAD, audit (2.25, 2.35).
- `challenges.ts`, `crypto.ts`, `ratelimit.ts`: frozen at c6d13ea, no change (3.1).

**Other files**
- `public/skill.md`, `test_agent_solver.py`: frozen at c6d13ea, no change (3.2, 3.3).
- `package.json` and `package-lock.json`: change. Add `fast-check` and `playwright-core` to devDependencies and add the npm scripts from Test tooling. `canvas-confetti` is already gone at HEAD, audit (2.26, 3.19; R16).
- `tsconfig.json`: change. Add `allowImportingTsExtensions` and exclude `tests` (R17).
- `tests/tsconfig.json`: add (R17).
- `tests/support/server.ts`, `browser.ts`, `views.ts`, `contrast.ts`, `source.ts`: add (R16).
- `tests/unit/*.test.ts`: add. Unit and property tests for the pure modules (Unit Tests, Property-Based Tests).
- `tests/explore/source.test.ts`, `routes.test.ts`, `rendered.test.ts`, `flows.test.ts`: add (X01 to X38).
- `tests/preserve/*.test.ts`, `subjects.ts`, `oracles.test.ts`, `api-contract.test.ts`: add (K01 to K03, K05 to K20).
- `tests/solver/solver.test.ts`: add (K04, 3.3).
- `tests/capture/api-contract.ts`: add (3.1).
- `tests/fixtures/baseline/`: add `api-contract.json`, `solver.txt`, `explore-failures.md`, `gaps.md`, `console-oracle.ts`, `console-facts.ts`, `handle-oracle.ts`, and `gates-baseline.ts` (3.1, 3.3, 3.10, 3.16).

### Requirement Map

| Clause | Design sections | Tests |
|---|---|---|
| 2.1 | Tokens; Deliberately absent | X01, X02 |
| 2.2 | Tokens | X03 |
| 2.3 | Control variants and states; Spacing and layout | X04 |
| 2.4 | Typefaces; Type scale | X05, X06 |
| 2.5 | Contrast; Tokens | X07, X08 |
| 2.6 | Overview (`/`); Overview copy | X09 |
| 2.7 | Site shell; FlagForm; Submit Flag Dialog | X10 |
| 2.8 | Gate page; src/lib/gates.ts; Gate copy (Gate 1 checks and proof-of-work note) | X11 |
| 2.9 | Try-it panel: Gates 2–4; API response types; Gate copy | X12 |
| 2.10 | src/lib/api.ts: result classification; Try-it panel: Gates 2–4 | X13 |
| 2.11 | src/lib/api.ts: result classification (R12); Try-it panels | X14 |
| 2.12 | Control variants and states; Busy and Disabled Controls (R2); Actions | X15 |
| 2.13 | Ticker; Countdown (R1, R18) | X16 |
| 2.14 | Try-it panel: Gate 1; Gate 1 copy | X17 |
| 2.15 | FlagForm; Labels, Hints, and Errors; src/lib/validation.ts | X18 |
| 2.16 | src/lib/validation.ts; Flag form copy (R13) | X19, K07 |
| 2.17 | Control variants (copy control); Copy Controls (R8, R10); Copy controls copy | X20 |
| 2.18 | Scoreboard (`/scoreboard`); Scoreboard copy | X21 |
| 2.19 | skill.md Rendering; Docs (`/docs`) (R6) | X22 |
| 2.20 | Route map; Current-view marking; Route Changes and Focus | X23 |
| 2.21 | Voice rules; Replacement strings; Pre-render check | X24 |
| 2.22 | Gate copy; Scoreboard copy; src/lib/gates.ts | X25 |
| 2.23 | UI terminology | X26 |
| 2.24 | Metadata; Iconography and brand | X27 |
| 2.25 | Navigation State and Toggles (R9); Control variants (sound toggle) | X28 |
| 2.26 | Motion; Runtime | X29 |
| 2.27 | Motion; Reduced Motion | X30 |
| 2.28 | Zoom and Reflow | X31 |
| 2.29 | Focus Indicator; Keyboard Paths; Busy and Disabled Controls | X32 |
| 2.30 | Labels, Hints, and Errors | X33 |
| 2.31 | Site shell (R3); Landmarks and Skip Link; Heading Hierarchy; External Links | X34 |
| 2.32 | Live Regions; Console (accessibility) | X35 |
| 2.33 | Status in Text (R7); Countdown; Current-view marking | X36 |
| 2.34 | Site shell; 360px width arithmetic (R4); Zoom and Reflow | X37 |
| 2.35 | Test tooling (`lint:ui`) | X38 |
| 3.1 | Preservation Requirements; Preservation Checking, capture steps 1, 3, 4 | K01, K03 |
| 3.2 | Preservation Checking, capture step 1; skill.md Rendering | K01, K02 |
| 3.3 | Preservation Checking, capture step 2 (temporary solver copy) | K01, K04 |
| 3.4 | FlagForm; Actions; Flag form copy | K07, K11 |
| 3.5 | FlagForm (inline placement) | K10 |
| 3.6 | Try-it panel: Gate 1; src/lib/api.ts | K12 |
| 3.7 | Try-it panel: Gates 2–4; Ticker; Property 5 | K08, K13 |
| 3.8 | Gate-specific body; Labels, Hints, and Errors; Property 5 | K08 |
| 3.9 | src/lib/validation.ts; Gate 3 copy; Property 5 | K08 |
| 3.10 | src/lib/console.ts; Console copy; Property 3 | K06 |
| 3.11 | Scoreboard (`/scoreboard`); Status in Text | K14 |
| 3.12 | Page Composition, Copy, and Raw File | K15 |
| 3.13 | Site shell; External Links; Metadata | K16 |
| 3.14 | State shape; Ticker | K17 |
| 3.15 | When the scoreboard loads; Console (`/console`) | K18 |
| 3.16 | src/lib/gates.ts (A15); src/lib/format.ts | K09 |
| 3.17 | Voice rules; Emoji | K19 |
| 3.18 | 360px width arithmetic; Zoom and Reflow | K20 |
| 3.19 | Dependencies and Tooling | K05 |

## Testing Strategy

### Validation Approach

The fix is already applied (2516aa1), and c6d13ea changed the agent surface on purpose, so validation is fix checking plus gap fixes. It runs against two baselines: F_bug (afe2537) for the defects and F_api (c6d13ea) for preservation. The tasks phase follows this order exactly:

1. **Historical bug baseline, F_bug.** The exploration counterexamples were measured on afe2537 during the requirements phase and are kept in `%TEMP%\agentgate-baseline`. They are copied into `tests/fixtures/baseline/explore-failures.md`. The S and H exploration tests can be re-run on F_bug from a worktree (`git worktree add <tmp> afe2537`, then `git worktree remove <tmp>`). Browser exploration on F_bug is not re-run.
2. **Preservation baseline phase, on F_api (HEAD = c6d13ea), before any gap fix.** Add the test tooling: fast-check, playwright-core, the npm scripts, the tsconfig edits, `tests/support/`, and the oracles. These edits change no file in U or Z. Then build, start the server, and run in order:
   1. the reference solver (a temporary copy, see capture step 2), saving `tests/fixtures/baseline/solver.txt`
   2. the API contract capture, saving `tests/fixtures/baseline/api-contract.json`
   3. `npm run test:preserve`, which must pass
   4. `npm run test:explore`, whose failures on HEAD are the gaps that 2516aa1 left or that c6d13ea reopened. They are recorded in `tests/fixtures/baseline/gaps.md` and become the gap-fix tasks.
   5. `npm run lint:ui`, recording the count

   Stop the server when done.
3. **Gap-fix phase.** The gap-fix tasks in tasks.md. No test file changes during this phase, except `tests/support/views.ts` (selectors only, removing none) and new unit tests under `tests/unit/` for new or changed modules.
4. **Validation phase, on F'.** Run in order:
   1. `npm run lint:ui` (exit 0)
   2. `npm run typecheck:tests`
   3. `npm test`
   4. `npm run build`
   5. start the server
   6. `npm run test:solver`
   7. `npm run test:preserve`
   8. `npm run test:explore`, where every exploration test now passes
   9. the frozen-file check: `git diff --exit-code c6d13ea -- src/app/api src/lib/challenges.ts src/lib/crypto.ts src/lib/ratelimit.ts public/skill.md test_agent_solver.py`
   10. stop the server

The server process is stopped through the handle that started it: `control_pwsh_process` stop with its terminalId. As a fallback, run `Get-NetTCPConnection -LocalPort 3008 -State Listen | ForEach-Object { taskkill /PID $_.OwningProcess /T /F }`. Then confirm that nothing listens on port 3008. `/T` is needed because `npm run start` spawns a child node process.

### Exploratory Bug Condition Checking

**Goal**: Surface a counterexample for every defect marker on F_bug, and confirm or refute the root-cause hypotheses. This was done during the requirements phase, and the results are in `%TEMP%\agentgate-baseline`. On HEAD (c6d13ea), the same tests find the gaps that remain. A marker that unexpectedly passes on F_bug means either the test is wrong or the hypothesis is wrong.

**Test Plan**: The tests are split by what they need:

| Kind | Needs | File |
|---|---|---|
| Source (S) | the repository only | `tests/explore/source.test.ts` |
| HTTP (H) | the server under test; regex checks on served HTML and headers | `tests/explore/routes.test.ts` |
| Browser (B) | the server and headless Chrome driven by playwright-core | `tests/explore/rendered.test.ts` (layout, contrast, focus, semantics) and `tests/explore/flows.test.ts` (interactions with interception) |

Browser tests run every view at 1280×900 and 360×780, unless the row says otherwise. On F_bug the views were the tab buttons at `/`. On F_api and F' they are the five routes. Browser tests send a probe IP and use `page.route` to inject baseline-captured bodies (429, accepted, rejected, and blocked responses, a short-TTL instance) or network failures. Injected bodies come from `api-contract.json`, never invented.

The structural checks (landmarks, `aria-current`, labels, focus, contrast, layout) need a browser because they depend on the DOM after hydration and on computed style. Presence and absence checks on strings, routes, meta tags, and headers use served HTML or source files.

**Test Cases** (all failed on F_bug; rows marked "c6d13ea" add checks for facts that HELL mode changed):

| ID | Clause | Kind | Assertion (holds on F') | Failure on F_bug |
|---|---|---|---|---|
| X01 | 1.1 | S | globals.css has no `.scanlines`, `.matrix-grid`, `.glow-`, `.box-glow-`, `--cyber-`, `text-shadow`, or `background-clip: text`. layout.tsx has no `scanlines` or `matrix-grid`. | globals.css defines `.scanlines`, `.glow-green`, and `--cyber-green`. layout.tsx mounts the overlay. |
| X02 | 1.1 | H | The HTML of `/` has no `scanlines` or `matrix-grid` class. | Both are present. |
| X03 | 1.2 | S | `.tsx` files in U contain no `#[0-9a-fA-F]{3,8}` color, no `rgb(`, `hsl(`, or `oklch(`, and no class matching `\b(bg\|text\|border\|ring\|outline\|fill\|stroke\|divide\|placeholder\|shadow\|from\|via\|to)-(slate\|gray\|zinc\|neutral\|stone\|red\|orange\|amber\|yellow\|lime\|green\|emerald\|teal\|cyan\|sky\|blue\|indigo\|violet\|purple\|fuchsia\|pink\|rose)-\d{2,3}\b`. Color values exist only in the globals.css token block. | 93 hex values and 139 zinc or red classes. |
| X04 | 1.3 | B | Every `button`, and every link styled as a button, has `data-variant` from the control set. Each gate area, form, and section has at most one `data-variant="primary"`. Forcing `:hover`, `:focus-visible`, or `:active`, or setting `disabled`, changes at least one computed color, border, or outline property. | No `data-variant` attributes, and states are undefined. |
| X05 | 1.4 | S | layout.tsx imports from `next/font/`. | No font import. |
| X06 | 1.4 | B | Type survey on each view at 1280. `h1`–`h6`, `p`, `li`, `label`, `button`, `a`, `th`, and `td` outside `code`, `pre`, `kbd`, `samp`, and `[data-mono]` use a non-monospace family. No text is below 12px. `p`, `li`, `label`, and `td` are at least 14px. Computed sizes satisfy h1 > h2 > h3 > body. `text-transform: uppercase` appears only on "AGENTGATE", HTTP methods, `th`, or labels of 12 characters or fewer. | 100% monospace, 92.5% of characters at 12px, gate titles the same size as descriptions. |
| X07 | 1.5 | B | Every visible text node has at least 4.5:1 contrast against its composited background (3:1 for large text, meaning at least 24px, or at least 18.66px bold), in the default state and with forced `:hover`, `:focus-visible`, and `:active`. Input borders and state indicators have at least 3:1 against adjacent colors. Disabled elements are skipped. The scope includes the scoreboard with injected entries and the accepted-flag state. | zinc-500 text at about 3.6–4.2:1, unsolved chips at 3.1:1, green hover at 3.4:1. |
| X08 | 1.5 | S | For every token pair the Tokens section declares (text on surface, boundary on surface, focus ring on surface), the WCAG ratio meets its threshold. The test parses the token values from globals.css and converts oklch to sRGB when needed. | No token block exists. |
| X09 | 1.6 | H | The HTML of `/` has an h1 and an introduction, then `https://ctf.hakudigital.tech`, `https://ctf.hakudigital.tech/skill.md`, and `GET /api/skill` as visible text. B: each URL has an adjacent copy control (see X20). | Only "Target: ctf.hakudigital.tech". |
| X10 | 1.7 | B | On `/`, no flag input comes before the introduction in DOM order. Every view's header has a control that opens a dialog containing the FlagForm, and `/scoreboard` contains the FlagForm. | The flag form comes first on every view. |
| X11 | 1.8 | H, B | `/gates/1` to `/gates/4` return 200 and show the gate number, name, points, TTL (Gates 2 to 4), the method and path of each endpoint, the payload field names (`prompt`; `sessionToken` with `predictions`, `assignment`, or `keyHex`), and the sentence about agent-sized TTLs. c6d13ea: `/gates/1` states the four Gate 1 checks, including the "0000" proof-of-work rule, and `/` and each gate page show `Difficulty: Hell` exactly once, while no gate name contains "Hell" (A14). B: the gate icon SVGs differ from each other and from the brand mark. | 404. |
| X12 | 1.9 | B | A Gate 3 challenge injected with 7 variables and 9 clauses shows 7 and 9, and none of "60", "255", "120", or "512", including in the assignment hint. Gate 2 shows `6364136223846793005`, C, and the modulus. c6d13ea: a Gate 2 instance injected with 5 values shows rows X1 to X5 and inputs X6 to X8, so the labels come from `sequence.length`. Gate 4 shows the opcode table, with one row per injected opcode. The full-response control reveals JSON that deep-equals the response body. | Hardcoded "Variables: 60 \| Clauses: 255", and no JSON view. |
| X13 | 1.10 | B | When the challenge or submit request fails with `route.abort("internetdisconnected")` for Gates 2 to 4, the gate area shows a didn't-reach-the-server message and a retry control. | No message. |
| X14 | 1.11 | B | Fulfilling a Gate 2 to 4 challenge or the Gate 1 chat with the captured 429 body, with its message rewritten to "Retry in 42s", produces an error state containing "Retry in 42s", no countdown, and no enabled Submit. | An empty instance with a fresh countdown. Gate 1 shows an empty "Response:" box. |
| X15 | 1.12 | B | While a request is held for 1.5 s in a `page.route` handler, the button that started it changes its text and has `aria-disabled="true"` or `disabled` (R2). Two Submit clicks during the hold produce one POST. | The Gate 2 to 4 button text is unchanged. |
| X16 | 1.13 | B | An instance injected with `ttlSeconds: 1` shows "Expired" in the gate area within 3 s, keeps Submit disabled, announces the expiry exactly once in a live region, and offers a control to request a new instance. c6d13ea: with `ttlSeconds: 4`, Gate 3 shows "Expiring" only from 3 s, while Gate 2 shows it from the start because 4 s is within its 5 s threshold (R1). | "0s remaining". |
| X17 | 1.14 | B | The captured blocked, answered, and flag Gate 1 bodies produce three different status labels in text. | Blocked and answered render the same way. |
| X18 | 1.15 | B | An empty handle, an empty flag, and an empty Gate 1 prompt each produce zero POSTs, plus a visible "required" message referenced by the field's `aria-describedby`, with `aria-invalid="true"`. | No message. |
| X19 | 1.16 | B | Typing `my agent!`, or a 25-character handle, shows the format message before submission. An injected accepted body whose `agent.agentName` is `myagent` shows `myagent`. | Nothing is shown. |
| X20 | 1.17 | B | Copy controls exist for the base URL, the skill.md URL, every endpoint on `/gates/N`, a returned flag, and the badge. A click puts the exact text on the clipboard (permission granted through `context.grantPermissions`) and shows success text in a live region. With `clipboard-write` denied, the control shows failure text. The skill.md control is disabled while the content is absent. | Only "Copy Spec" exists, and it reports success unconditionally. |
| X21 | 1.18 | B | A `GET /api/scoreboard` held for 1.5 s shows loading text. A 429 fulfillment shows an error with the server message. | No loading state, and the old rows stay silently. |
| X22 | 1.19 | H, B | `/docs` returns 200. Text outside `pre` and `code` contains no `**`, no `$$`, no line-start `#`, and no code fences. Each `pre` has `overflow-x: auto`. No ancestor of the document has a fixed height with `overflow-y: auto`. No emoji appears in the rendered document (A8). The load-error branch is unit-tested with an injected reader. | 404. The Protocol Spec tab shows raw Markdown in a 500px scroll box. |
| X23 | 1.20 | H, B | H: `/gates` redirects (307 or 308) to `/gates/1`, and `/gates/0`, `/gates/5`, and `/gates/x` return 404. B: a `nav` holds links labelled Overview, Gates, Scoreboard, Docs, and Console in that order. Exactly one has `aria-current="page"`, matching `location.pathname` (any `/gates/N` counts for Gates). After clicking Overview, then Gates, then Scoreboard, `history.back()` shows `/gates/1` with its h1. Reloading `/docs` shows the documentation. | All routes return 404, the URL stays `/`, and the switcher is plain buttons. |
| X24 | 1.21 | S, B | Neither U nor any view's rendered text contains (case-insensitive) "SOVEREIGN EXECUTION ENVIRONMENT", "guardrail boundary deconstruction", "Formulate evasion vectors", "Enter adversarial prompt", "DIRECTIVES", "Operational vectors", "Unknown directive", "[Dismiss]", or " // " in the title. c6d13ea: nor "(Hell)", "1.3e36", "high-order", "Babai", or "35+". | Present in page.tsx and layout.tsx. The c6d13ea phrases are in src/lib/gates.ts. |
| X25 | 1.22 | S, B | No "Real-time", "Connected" status label, "Gates Active", or "derive multiplier state" appears. `/scoreboard` has a sentence matching both /memory/i and /reset/i. The Gate 2 description says the multiplier is given. c6d13ea: it also says C is given and that each output is X >> 16. | Present, or missing. |
| X26 | 1.23 | B | Rendered text outside `[data-console-output]` and `[data-skill-doc]` contains none of "leaderboard", "Protocol Spec", "AgentGate Shell", "Verify Flag", "SUBMIT FLAG", "Proof Token", "Verified Complete", "fetch entropy sequence", "generate 3-SAT problem", or "download bytecode". | Present. |
| X27 | 1.24 | H | `<title>` has no `//`. The meta description has no "premier" or "exclusively". The favicon the page links to has a SHA-256 different from afe2537's `src/app/favicon.ico` (C28FDD2A…E9A19A4, the Next.js default). | Unchanged. |
| X28 | 1.25 | S, B | S: sound defaults to off. B: an init script counts `createOscillator` calls on `AudioContext` and `webkitAudioContext`. Clicking every nav link and one button per view counts 0. The sound toggle starts with `aria-pressed="false"` and changes to `"true"`. | Sound is on, the count is above 0, and the toggle exposes no state. |
| X29 | 1.26 | S, B | `canvas-confetti` is absent from `dependencies` and from imports in U. After an injected accepted flag, no `canvas` is added, and every `document.getAnimations()` target sits inside the result element. | The import exists and a full-page canvas is appended. |
| X30 | 1.27 | B | With `page.emulateMedia({ reducedMotion: "reduce" })`: `document.getAnimations()` is empty after an accepted flag and after hover, no `scrollIntoView`, `scrollTo`, or `scroll` call passes `behavior: "smooth"` (the init script records options), and the computed `scroll-behavior` of `html` is `auto`. | Confetti fires, and console output scrolls smoothly. |
| X31 | 1.28 | S, H, B | The viewport meta has no `maximum-scale` or `user-scalable`. At 640×450 with device scale 2 (200% zoom), each view has `scrollWidth` ≤ 640 and every nav link is visible and unclipped. | `maximum-scale=1`. |
| X32 | 1.29 | B | Tabbing through each view: each focused element has an outline at least 2px wide, or a box-shadow ring, with at least 3:1 contrast against the adjacent background. The focus sequence equals the DOM order of tabbable elements, with no positive `tabindex`. A keyboard-only run works with Tab, Enter, Space, and Escape: navigate to Gates, request an instance, then open and close the flag dialog. | The Gate 1 prompt and the console input show nothing. Other inputs measure 2.2–2.5:1. |
| X33 | 1.30 | B | Every `input`, `textarea`, and `select` has a visible label through `labels` or `aria-labelledby`. Format hints (Gate 2 integers, the Gate 3 JSON array, 16 hex characters for Gate 4) are referenced by `aria-describedby`. | Placeholders only. |
| X34 | 1.31 | B | `header`, `nav`, `main`, and `footer` share one parent, and there is exactly one `main`. Heading levels never skip. Each view has one h1, and each gate and section has a heading. Every `a[target=_blank]` has `rel` containing `noopener` and `noreferrer`, and its accessible name contains "new tab". | The header and footer are inside `main`. There is no `nav` and there are no gate headings. |
| X35 | 1.32 | B | Live regions (`aria-live` or `role=status`/`alert`) exist at load. After a copy, an error (X14), an expiry (X16), an accepted flag, or a console command, the new text appears inside a region that existed before the action, and `document.activeElement` is unchanged. | No live regions. |
| X36 | 1.33 | B | With an injected scoreboard entry where `gatesSolved` is `[1, 3]`, solved and unsolved gate cells differ in text or accessible name, not only in color. The current view is marked by `aria-current` (X23). Expired is text (X16). | Both read "G1" to "G4", told apart by color only. |
| X37 | 1.34 | B | At 360×780, on each view: `scrollWidth` ≤ 360, each nav label is on one line (one client rect for its text range), nav links don't overlap, and no element extends past 360px unless it is inside an `overflow-x: auto` or `scroll` container. | "Protocol Spec" wraps (44px against 28px), and the row is 318px inside a 294px box. |
| X38 | 1.35 | S | `npm run lint:ui` exits 0. | 16 errors and 16 warnings, exit 1 (measured). |

**Expected Counterexamples**: The failure column above. Each failing test records its concrete X (route, viewport, element selector, and measured value) in `explore-failures.md`. If a row passes on F_bug, re-examine hypotheses 1 to 7 before writing fix tasks for that clause.

### Fix Checking

**Goal**: For every X where C held on F_bug, `expectedBehavior(X)` holds on F'.

**Pseudocode:**

```
FOR ALL m IN DefectMarkers DO
  FOR ALL X IN m.observations            // the views, viewports, media, and injected responses listed for m
    result := observe(F', X)
    ASSERT m.expected(result)
  END FOR
END FOR
ASSERT exitCode("npm run lint:ui") = 0
```

Fix checking reruns the same exploration files on F': `npm run test:explore` must pass with zero failures. The S and H rows can also be run on the F_bug worktree to confirm they still fail there. No assertion changes after the gap list is recorded.

### Preservation Checking

**Goal**: For every input outside C, F' gives the same result as F_api (c6d13ea).

**Pseudocode:**

```
FOR ALL x WHERE NOT isBugCondition(x) DO
  ASSERT normalize(F_api(x)) = normalize(F'(x))
END FOR
// F_api(x) is captured once on c6d13ea (fixtures); oracles for moved logic come from afe2537; F'(x) is observed after the gap fixes.
```

**Baseline capture (on F_api = c6d13ea, before any gap fix):**

1. **Frozen files.** `git diff --exit-code c6d13ea -- src/app/api src/lib/challenges.ts src/lib/crypto.ts src/lib/ratelimit.ts public/skill.md test_agent_solver.py` must exit 0. `git status --porcelain --` on the same paths must print nothing, which also catches new untracked files under `src/app/api/`. At HEAD = c6d13ea both are clean by definition.
2. **Solver.** Run `pip install z3-solver` once (requests 2.32.3 is installed and z3 is not). Then run `npm run build` and `npm run start -- -p 3008` in the background, and wait until `GET /skill.md` returns 200. Poll `/skill.md` because static files don't touch the rate limiter. Then run `npm run test:solver`. The committed c6d13ea script sets `BASE = "https://ctf.hakudigital.tech"`, so the test copies it to a temp directory, replaces only that line with `BASE = "http://localhost:3008"`, checks that the copy differs from the original in that one line, and spawns `python <copy>` with `PYTHONUTF8=1` and a 90 s timeout. The committed file is never edited and the live scoreboard is never written (3.3). The variable is required: the script prints a trophy emoji, and Python's piped stdout on this machine is cp1252, which raises UnicodeEncodeError. The run passes when all of these hold:
   - exit code 0
   - "Flag 1" to "Flag 4" are each a `HAKU{...}` value
   - "Scoreboard G1" to "Scoreboard G4" read "FLAG ACCEPTED for Gate N! +P points." with P = 1000, 2000, 2500, 3000
   - a "PROOF BADGE:" line with a non-empty value

   The normalized stdout is saved as `solver.txt`. Normalizing replaces the mined nonce and hash, timings, the recovered seed, predictions, key hex, and badge with placeholders. F' must produce the same normalized text.
3. **API contract.** `npm run capture:baseline` runs `tests/capture/api-contract.ts` and writes `api-contract.json`. For each probe, it records the status, the `content-type` and `access-control-allow-origin` headers, and the body shape. Fixed fields keep their values: `status`, `gate`, `name`, `description`, `multiplier`, `modulus`, `ttlSeconds`, `submitEndpoint`, `payloadSchema`, `vmSpec`, `success`, `message`, `error`, `allowed`, `flag`, `gatePoints`, and `allGatesCleared`. Random fields keep only their type and size: `sessionToken` (a string containing "."), `sequence` (length and decimal strings), `clauses` (count and literals per clause), `bytecodeHex` (hex and length), `rateLimitRemaining`, `lastSolveAt`, and `proofBadge`. Digits in "Retry in Ns" and "sleep for Ns" become `\d+`. The probes are:
   - **Gate 1, `POST /api/gate1/chat`:** the solver's mined prompt (flag), "hello" (blocked by length), a 60-character prompt containing "flag" (blocked word), a 60-character prompt with no framing word (blocked), a 60-character allegory prompt whose hash doesn't start with 0000 (proof-of-work failure, with its deterministic hash prefix), a non-JSON body (400), and `OPTIONS` (204 with CORS headers).
   - **Gates 2 to 4, challenge and submit:** `GET` challenge (200), `POST` submit `{}` (400 missing fields), a submit with `sessionToken: "x.y"` (400 invalid token), and a non-JSON submit body (400).
   - **Scoreboard, `/api/scoreboard`:** `GET` (200), `POST {}` (400), a fake flag (403), handle `!!!` with the Gate 1 flag (400 "Invalid agentName character format."), and handle `contract probe!` with the Gate 1 flag (200, `agent.agentName` = `contractprobe`).
   - **Rate limits:** 41 × `GET /api/gate2/challenge` (40 × 200, then 429) and 21 × fake-flag `POST /api/scoreboard` (20 × 403, then 429).
   - **skill.md:** `GET /api/skill` and `/skill.md`.

   `tests/preserve/api-contract.test.ts` replays the same probes on F' and deep-compares.
4. **Rate-limit budget.** `src/lib/ratelimit.ts` keeps a single `ipMap` keyed by IP alone. In the worst case, one counter per IP covers every route, with a fixed 60 s window from the first request. Each route checks that count against its own limit: 20 for scoreboard POST, 30 for gate1 chat, 40 for gate challenge and submit, and 60 for scoreboard GET. Whether route bundles share the module at runtime isn't verified, so the tests assume they do. The solver sends 11 requests with `cf-connecting-ip: 198.18.99.1`, and its four scoreboard POSTs are requests 8 to 11. It therefore runs first after each server start. Every other test file sends its own probe IP as `cf-connecting-ip`. Browser tests do this with the context option `extraHTTPHeaders`. The contract capture uses one probe IP per probe group and sends 86 requests in total, none from 198.18.99.1.
5. **Oracles.** These are written by hand into `tests/fixtures/baseline/`, from `git show afe2537:<path>` for logic that moved out of the old page and from `git show c6d13ea:<path>` for agent-surface facts:
   - `console-oracle.ts`: the `handleTerminalSubmit` branching as `baselineConsole(cmd, standings) → { clear: boolean, text: string }`, without colors
   - `console-facts.ts`: per command, the regexes for the information each output carries at c6d13ea, such as `/2\^64/`, `/X5/`, `/1442695040888963407/`, `/0000/`, `/512/`, the gate names, points, endpoints, and TTLs
   - `handle-oracle.ts`: the cleanup expression from route.ts line 78
   - `gates-baseline.ts`: points from `GATE_POINTS` at c6d13ea, plus TTLs, endpoints, Gate 2's sequence length, Gate 3's counts, and Gate 4's opcode count from `api-contract.json`

   `tests/preserve/oracles.test.ts` asserts that every literal and regex source in the oracles appears verbatim in the afe2537 or c6d13ea file it came from, and that every fact regex matches the oracle's own output.

**Testing Approach**: Property-based testing is used wherever the input domain is open: console commands, handles, gate payloads, and API error bodies. fast-check generates many cases per run and shrinks failures to a minimal counterexample. Fixed flows use example-based integration tests with captured bodies.

**Subjects.** `tests/preserve/subjects.ts` points at the src/lib modules from the start, because the fix is already applied. The property tests compare them with the oracles on F_api and again on F'. Black-box preservation tests (HTTP, browser, solver, git) run unchanged against both builds.

**Test Cases**:

| ID | Clause | Type | Check |
|---|---|---|---|
| K01 | 3.1, 3.2, 3.3 | Integration (git) | The frozen-file diff against c6d13ea and the status from capture step 1. |
| K02 | 3.2 | Integration (HTTP) | The bodies of `/api/skill` and `/skill.md` byte-equal `readFileSync("public/skill.md")` (LF line endings in both the index and the working tree). `/api/skill` sends `content-type: text/markdown; charset=utf-8` and `access-control-allow-origin: *`. |
| K03 | 3.1 | Integration (HTTP) | The contract replay against `api-contract.json`. |
| K04 | 3.3 | Integration (process) | The solver run and its pass criteria from capture step 2. |
| K05 | 3.19 | Integration and unit | `npm run build` exits 0, as validation step 3.4. Unit: package.json `dependencies` contain none of fast-check, typescript, eslint, `@types/*`, playwright, vitest, or tsx. |
| K06 | 3.10 | Property | Property 3 with ≥ 300 runs. Unit examples: `GATES`, `Solve 2`, `solve 5` (usage), `clear`, `leaderboard` with empty and with 2 entries, and an unknown word whose case is preserved in the echo. Integration: typing `GATES` in the console view shows the gates facts on F and F'. |
| K07 | 2.16, 3.4 | Property | Property 4. Generators: `fc.string()` with full Unicode, `fc.stringMatching(/^[A-Za-z0-9_.-]{1,30}$/)`, and both of these wrapped in random whitespace (space, tab, NBSP, U+FEFF), at ≥ 500 runs. |
| K08 | 3.7, 3.8, 3.9 | Property | Property 5. The api.ts request builders run with a stub fetch that records the body. Gate 3 generators: `fc.json()`, `fc.array(fc.boolean())`, `fc.array(fc.integer({min: -120, max: 120}))`, and strings that fail `JSON.parse`. The expected value is always `JSON.parse(t)`, never the generator's value, because of `-0` and key order. |
| K09 | 3.16 | Unit and integration | gates.ts deep-equals `gates-baseline.ts`: points 1000, 2000, 2500, and 3000 (8,500 in total); TTLs 15, 10, and 20; 4 outputs and 3 predictions for Gate 2; 120 variables and 512 clauses for Gate 3; 9 opcodes for Gate 4; `GATE2_INCREMENT`; and every endpoint string (A15). Integration: points, TTLs, and endpoints shown on `/` and `/gates/N` equal gates.ts once thousands separators are removed. |
| K10 | 3.5 | Integration (browser) | Set the handle to `keep_me`, then send the solver's Gate 1 prompt. A visible flag field holds the Gate 1 flag, and the handle field still holds `keep_me`. |
| K11 | 3.4 | Integration (browser) | Submit `probe_k11` with the Gate 1 flag. The POST body has exactly the keys `agentName` and `flag` and the typed values. The server message is shown verbatim, and a `GET /api/scoreboard` follows within 2 s. An injected badge body shows the badge. A fake flag shows "FLAG REJECTED: Invalid or fake flag token." verbatim. The dismiss control removes the feedback. |
| K12 | 3.6 | Integration (browser) | The Gate 1 POST body equals `{"prompt": <typed>}`. The response text is shown verbatim, and the flag is shown when one is returned. |
| K13 | 3.7 | Integration (browser) | A real Gate 2 instance. The GET is issued and the previous result is cleared. The countdown starts at 15 and decreases. The submit POST carries the response's `sessionToken`. Submit is disabled at zero (injected TTL of 1) and while a request is held. |
| K14 | 3.11 | Integration (browser) | Inject 3 entries out of score order, one with `proofBadge`. Rows appear in the returned order, each with its rank, handle, score, and gates. The badge row's proof cell text differs from the others. An empty list shows the empty state. Opening the view and pressing refresh each issue one GET. |
| K15 | 3.12 | Integration (browser) | Copy skill.md, then `navigator.clipboard.readText()` equals the file. If the only difference is CRLF from the Windows clipboard, normalize the read side (the file has no CR) and log it. |
| K16 | 3.13 | Integration (HTTP) | Every view URL that returns 200 contains `<a href="https://hakudigital.tech"` and `<meta name="author" content="Haku Digital">`. |
| K17 | 3.14 | Integration (browser) | Set a window marker. Fill in the handle, the flag, a Gate 2 instance, a Gate 2 input, and one console command. Move through views by clicking nav, then return. The marker survives (no reload) and every value persists. The countdown has gone down by the elapsed time and was not reset. |
| K18 | 3.15 | Integration (browser) | Log `/api/*` requests from `Network.requestWillBeSent`, ignoring `_rsc` prefetches. After each view settles, wait 15 s idle and expect zero `/api/*` requests. Requests only happen at load, when a view opens, or on an action. |
| K19 | 3.17 | Integration (browser) | Rendered text outside `[data-skill-doc]` matches neither `\p{Emoji_Presentation}` nor `\p{Extended_Pictographic}\uFE0F`. `html[lang="en"]` is set, served CSS has no `prefers-color-scheme: light` rules, and there is no theme toggle. |
| K20 | 3.18 | Integration (browser) | At 360×780, `document.documentElement.scrollWidth` = 360 on each view. |

### Unit Tests

Unit tests live in `tests/unit/`, run under `npm test`, and need no server. They are written against the src/lib modules at HEAD, before the gap fixes:

- **api.ts** (stub fetch): one example per R12 rule, in order. A 429 body returns `server-error` with the retry seconds, even if it carries `success`. A 400 or 403 body with a boolean `success` returns `ok` (rejected). A Gate 1 200 body with `allowed: false` returns `ok` (blocked). A challenge body without `sessionToken` returns `server-error`. Error text falls back from `message` to `error` to the fixed sentence. A rejected fetch returns `network-error`. A non-JSON body, such as HTML 500, returns `server-error`. Request method, path, headers, and body are exact.
- **validation.ts**: handle examples. `HAKU_PRIME_AGENT` passes. `my agent!` fails. 24 characters pass and 25 fail. An empty or whitespace-only handle gives the "required" result, which is distinct from the "format" result. Gate 3 parse examples with booleans, signed literals, malformed input, and surrounding whitespace.
- **console.ts**: one example per command, as in K06.
- **app-state.ts** (R15): the reducer is pure. Tests cover request start and success (an instance with `expiresAt = now + ttl * 1000`), `instance/expired` moving `live` to `expired` only, a submit ignored while busy (2.12), a 429 storing `retryAt`, and a flag result keeping the field values on dismiss (3.4).
- **format.ts** (R15): `formatPoints` gives 1,000 to 8,500 as expected, `formatResponseJson` keeps primitive arrays on one line, and `formatClause` joins literals.
- **gates.ts**: K09.
- **markdown.ts**: headings, lists, links (http and https only, with new-tab rel), inline code, fenced code, `$$` math as a code expression, removal of the two decorative emoji only, HTML escaping (`<script>` renders as text), and the loader's error branch with an injected reader.
- **Countdown math** (wherever the pure function lives): remaining seconds from `expiresAt` and `now` is never negative and reaches 0 exactly at expiry.
- **Token contrast**: X08.

### Property-Based Tests

All property tests use fast-check inside `node:test`. They use the default seed and report it on failure. Each failing seed is copied into the test as a regression example.

- Property 3, console equivalence (K06), at ≥ 300 runs.
- Property 4, handle agreement (K07), at ≥ 500 runs.
- Property 5, payload trimming and pass-through (K08), at ≥ 300 runs.
- api.ts error mapping (2.11, A12, R12): for any status from 400 to 599 and any JSON body with a string `message` and no boolean `success`, `allowed`, or `sessionToken`, the helper returns `server-error` with that exact message. For any network rejection, it returns `network-error`.
- Countdown (2.13): for any `expiresAt` and `now`, remaining = `max(0, ceil((expiresAt − now) / 1000))`, and the instance is expired exactly when remaining = 0.
- markdown.ts: for any string, the output contains no unescaped `<` taken from the input. For any plain text without Markdown syntax, the rendered text content equals the input.

### Integration Tests

Integration tests run against the production server: H tests over HTTP, B tests in Chrome through playwright-core.

- **Exploration and fix checks**: X02, X09 to X37 (H and B rows).
- **Preservation of the agent surface**: K01 to K05.
- **Preservation of visitor flows**: K10 to K20.
- **Full flow** (B, F' only, part of `test:explore`): open `/`, copy the skill.md URL, go to `/gates/1`, send the solver prompt, submit the returned flag from the inline FlagForm, see the accepted message, open `/scoreboard` and find the handle, and do it all from the keyboard (X32).
