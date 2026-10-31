## Glossary

- **X (UI observation)**: one observable state of the UI, written `X = (route, viewport, media, interaction, source)`. `route` is a URL path. `viewport` is one of 1280×900, 360×780 (mobile emulation), or 640×450 at device scale 2, which equals 1280×900 at 200% zoom. `media` is `prefers-reduced-motion` on or off. `interaction` is a scripted sequence of clicks, key presses, and typed values, with optional network interception. `source` is the file tree under src/ plus package.json and tsconfig.json.
- **Bug_Condition (C)**: predicate `isBugCondition(X)`. It holds when X shows at least one defect marker from bugfix.md section 1.
- **Defect marker**: one detectable symptom from clauses 1.1 to 1.35, paired with one exploration test (X01 to X38 below).
- **Property (P)**: predicate `expectedBehavior(X)`. It holds when X satisfies every applicable clause 2.1 to 2.35.
- **Preservation**: for every input outside C (agent API traffic, skill.md requests, the reference solver, console command semantics, and the flows in 3.4 to 3.18), the fixed system F' behaves the same as the baseline F.
- **F (baseline)**: the code at commit afe2537, which is HEAD when the tasks phase starts. Built with `npm run build` and served by `next start -p 3008`.
- **F' (fixed)**: the code after the fix tasks, built and served the same way.
- **Frozen set Z**: `src/app/api/**`, `src/lib/challenges.ts`, `src/lib/crypto.ts`, `src/lib/ratelimit.ts`, and `public/skill.md`. Each file stays byte-identical to afe2537.
- **UI code U**: every file under src/ that is not in Z. This is the scope of the UI-only lint command (2.35).
- **Server under test**: a production server on http://localhost:3008. Tests read `BASE_URL`, which defaults to that address.
- **Probe IP**: a value in 198.18.0.0/15 (the RFC 2544 benchmark range) that a test sends as `cf-connecting-ip`. `src/lib/ratelimit.ts` takes the client IP from that header first, so each test file gets its own rate-limit bucket and leaves the 127.0.0.1 bucket to the reference solver.
- **Fixture**: a file under `tests/fixtures/baseline/` captured from F before any UI change. It is committed and never regenerated from F'.
- **Oracle**: a function under `tests/fixtures/baseline/` that reproduces one baseline behavior of F that moves into a new module in F'. Examples are the console branching in page.tsx and the handle cleanup in the scoreboard route. A source-tie test proves that each oracle literal or regex appears verbatim in `git show afe2537:<path>`.
- **Subject**: the implementation a module-level preservation test checks. `tests/preserve/subjects.ts` maps each subject to its oracle before the fix and to the new src/lib module after it. That file is the only one that changes between the two runs.
- **View adapter**: `tests/support/views.ts`. It finds views, gate areas, fields, and buttons by visible text or label, with the selectors of both F and F', so the same browser preservation tests run on both builds.
- **Counterexample**: the concrete X recorded when an exploration test fails on F.

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

These examples were measured on F, or follow directly from F's source:

- `GET /docs`, `/scoreboard`, `/console`, and `/gates/1` return 404. Expected: 200 with that view, and `/gates` redirects to `/gates/1`.
- At 360×780, the "Protocol Spec" button wraps to 44px tall next to 28px neighbors, and the four-button row is 318px wide inside a 294px box. Expected: no wrapping or clipping.
- A Gate 3 challenge response with 7 variables and 9 clauses, injected by interception, still shows "Variables: 60 | Clauses: 255" and "... +252 clauses". Expected: 7 and 9, derived from the response.
- A 429 response from `GET /api/gate2/challenge` with "Rate limit exceeded. Retry in 42s." shows an empty instance with a 15 s countdown and a Submit button that does nothing. Expected: an error state showing that message, with no countdown and no enabled Submit.
- Clicking the "Console" view button starts a Web Audio oscillator. Expected: zero oscillators until the visitor turns sound on.
- Tabbing to the Gate 1 prompt shows no focus indicator, because `focus:outline-none` has no replacement. Expected: an indicator with at least 3:1 contrast.
- The UI-only lint command reports 16 errors and 16 warnings and exits 1. Expected: zero of each, exit 0.
- Edge case: a handle such as `my agent!` is accepted without comment and recorded as `myagent`. Expected: a format message before submission, and the recorded handle shown after an accepted flag.

### Preservation Requirements

The non-bug domain ¬C splits into four parts. Each part has its own baseline capture, so the preserved behavior is observed on F, not assumed:

| Part | Inputs | Baseline captured as | Clauses |
|---|---|---|---|
| Agent surface | every `/api/*` request, `/skill.md`, the solver run | `api-contract.json`, `solver.txt`, the git diff of Z | 3.1, 3.2, 3.3 |
| Moved logic | console commands, handle cleanup, input trimming, Gate 3 JSON parsing, gate metadata | oracles plus source-tie tests | 3.8, 3.9, 3.10, 3.16, and the server half of 2.16 |
| Visitor flows | flag submit and feedback, auto-fill, Gate 1 send, instance lifecycle, scoreboard listing, skill.md copy, state across navigation, request budget | browser runs through the view adapter on F | 3.4 to 3.7, 3.11, 3.12, 3.14, 3.15 |
| Site invariants | Haku Digital credit and author metadata, no emoji, English and dark only, no page scroll at 360px, build passes, dependency split | HTML, rendered-text, and package.json checks on F | 3.13, 3.17, 3.18, 3.19 |

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

### Property 1: Bug Condition - The UI shows no defect marker

_For any_ UI observation X where the bug condition holds on the baseline (isBugCondition(X) is true on F), the fixed system F' SHALL satisfy expectedBehavior(X). Every defect marker X01 to X38 SHALL be absent and its 2.x assertion SHALL hold, at each viewport and motion setting where the marker applies.

**Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9, 2.10, 2.11, 2.12, 2.13, 2.14, 2.15, 2.16, 2.17, 2.18, 2.19, 2.20, 2.21, 2.22, 2.23, 2.24, 2.25, 2.26, 2.27, 2.28, 2.29, 2.30, 2.31, 2.32, 2.33, 2.34, 2.35**

### Property 2: Preservation - The agent surface and visitor flows are unchanged

_For any_ input where the bug condition does not hold (agent and solver traffic to `/api/*`, `/api/skill`, and `/skill.md`, the frozen files, and the visitor flows in 3.4 to 3.18), F' SHALL produce the same observable result as F. This means:

- byte-identical frozen files
- the same status codes and the same response shapes and values, apart from random fields
- the same skill.md bytes and headers
- four accepted solver flags and a Proof-of-Pwn badge
- the same information in each visitor flow

```
FOR ALL x WHERE NOT isBugCondition(x) DO
  ASSERT normalize(F(x)) = normalize(F'(x))   // normalize drops random fields only
END FOR
```

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.11, 3.12, 3.13, 3.14, 3.15, 3.16, 3.17, 3.18, 3.19**

### Property 3: Preservation - Console commands return equivalent information

_For any_ command c from the console domain, F' SHALL return the same information as the baseline oracle. The domain is `help`, `gates`, `solve`, `solve 0` to `solve 9`, `leaderboard`, `clear`, and arbitrary unknown words, each in any letter case, with optional surrounding whitespace and single spaces between words. `leaderboard` runs against any generated standings list. `runConsoleCommand(c, context)` SHALL equal `baselineConsole(c, standings)` on these facts: clear or not; the command list for `help`; each gate's number, name, points, endpoint, and TTL for `gates`; the per-gate hint facts for `solve N`; rank, handle, score, and gates per entry in order for `leaderboard`, or an empty message; and usage help for unknown commands and an invalid `solve`. No phrase banned by 2.21 or 2.22 SHALL appear.

**Validates: Requirements 3.10, 2.21, 2.22, 2.23**

### Property 4: Preservation - The handle check agrees with the server's cleanup

_For any_ string s, `validateHandle(s)` SHALL accept s exactly when the server's cleanup records the trimmed s unchanged and non-empty. The cleanup is `String(s).trim().replace(/[^a-zA-Z0-9_\-\.]/g, "").slice(0, 24)`, copied verbatim from src/app/api/scoreboard/route.ts, and the condition is `clean(s) = s.trim() AND clean(s) ≠ ""`. Equivalently, the trimmed s matches `^[A-Za-z0-9_.-]{1,24}$`.

**Validates: Requirements 2.15, 2.16, 3.4**

### Property 5: Preservation - Gate payloads keep trimming and pass-through

_For any_ Gate 2 values (a, b, c) and Gate 4 key k with arbitrary surrounding whitespace, the submitted JSON body SHALL be `{ sessionToken, predictions: [a.trim(), b.trim(), c.trim()] }` in the order X6, X7, X8, and `{ sessionToken, keyHex: k.trim() }`. _For any_ Gate 3 text t: if `JSON.parse(t)` throws, the system SHALL send no request and return exactly "Malformed assignment array. Expected valid JSON format.". Otherwise the body's `assignment` SHALL deep-equal `JSON.parse(t)`, including boolean arrays, signed-literal arrays, and non-array JSON values.

**Validates: Requirements 3.7, 3.8, 3.9**

### Validation Approach

Validation runs in three phases. The tasks phase follows this order exactly:

1. **Baseline phase, on F (HEAD = afe2537), before any UI change.** Add the test tooling: fast-check, the npm scripts, the tsconfig edits, `tests/support/`, and the oracles. These edits change no UI file. Then build, start the server, and run in order:
   1. the reference solver, saving `tests/fixtures/baseline/solver.txt`
   2. the API contract capture, saving `tests/fixtures/baseline/api-contract.json`
   3. `npm run test:preserve`, which must pass
   4. `npm run test:explore`, which must fail and whose counterexamples go into `tests/fixtures/baseline/explore-failures.md`
   5. `npm run lint:ui`, which must exit 1 with 16 errors and 16 warnings

   Stop the server when done.
2. **Fix phase.** The UI fix tasks from the other design parts. No test file changes during this phase, except `tests/preserve/subjects.ts` (switch to the new modules), `tests/support/views.ts` (add F' selectors next to the F selectors, removing none), and new unit tests under `tests/unit/` for new modules.
3. **Validation phase, on F'.** Run in order:
   1. `npm run lint:ui` (exit 0)
   2. `npm run typecheck:tests`
   3. `npm test`
   4. `npm run build`
   5. start the server
   6. `npm run test:solver`
   7. `npm run test:preserve`
   8. `npm run test:explore`, where every exploration test now passes
   9. the frozen-file check
   10. stop the server

The server process is stopped through the handle that started it: `control_pwsh_process` stop with its terminalId. As a fallback, run `Get-NetTCPConnection -LocalPort 3008 -State Listen | ForEach-Object { taskkill /PID $_.OwningProcess /T /F }`. Then confirm that nothing listens on port 3008. `/T` is needed because `npm run start` spawns a child node process.

### Exploratory Bug Condition Checking

**Goal**: Surface a counterexample for every defect marker on F, and confirm or refute the root-cause hypotheses. A marker that unexpectedly passes on F means either the test is wrong or the hypothesis is wrong. Fix the test before any UI work starts.

**Test Plan**: The tests are split by what they need:

| Kind | Needs | File |
|---|---|---|
| Source (S) | the repository only | `tests/explore/source.test.ts` |
| HTTP (H) | the server under test; regex checks on served HTML and headers | `tests/explore/routes.test.ts` |
| Browser (B) | the server and headless Chrome over CDP | `tests/explore/rendered.test.ts` (layout, contrast, focus, semantics) and `tests/explore/flows.test.ts` (interactions with interception) |

Browser tests run every view at 1280×900 and 360×780, unless the row says otherwise. On F, the views are reached through the view adapter: the tab buttons at `/`. On F', they are the five routes. Browser tests send a probe IP and use CDP `Fetch` interception to inject baseline-captured bodies (429, accepted, rejected, and blocked responses, a short-TTL instance) or network failures. Injected bodies come from `api-contract.json`, never invented.

The structural checks (landmarks, `aria-current`, labels, focus, contrast, layout) need a browser because they depend on the DOM after hydration and on computed style. Presence and absence checks on strings, routes, meta tags, and headers use served HTML or source files.

**Test Cases** (all fail on F):

| ID | Clause | Kind | Assertion (holds on F') | Failure on F |
|---|---|---|---|---|
| X01 | 1.1 | S | globals.css has no `.scanlines`, `.matrix-grid`, `.glow-`, `.box-glow-`, `--cyber-`, `text-shadow`, or `background-clip: text`. layout.tsx has no `scanlines` or `matrix-grid`. | globals.css defines `.scanlines`, `.glow-green`, and `--cyber-green`. layout.tsx mounts the overlay. |
| X02 | 1.1 | H | The HTML of `/` has no `scanlines` or `matrix-grid` class. | Both are present. |
| X03 | 1.2 | S | `.tsx` files in U contain no `#[0-9a-fA-F]{3,8}` color, no `rgb(`, `hsl(`, or `oklch(`, and no class matching `\b(bg\|text\|border\|ring\|outline\|fill\|stroke\|divide\|placeholder\|shadow\|from\|via\|to)-(slate\|gray\|zinc\|neutral\|stone\|red\|orange\|amber\|yellow\|lime\|green\|emerald\|teal\|cyan\|sky\|blue\|indigo\|violet\|purple\|fuchsia\|pink\|rose)-\d{2,3}\b`. Color values exist only in the globals.css token block. | 93 hex values and 139 zinc or red classes. |
| X04 | 1.3 | B | Every `button`, and every link styled as a button, has `data-variant` from the control set. Each gate area, form, and section has at most one `data-variant="primary"`. Forcing `:hover`, `:focus-visible`, or `:active`, or setting `disabled`, changes at least one computed color, border, or outline property. | No `data-variant` attributes, and states are undefined. |
| X05 | 1.4 | S | layout.tsx imports from `next/font/`. | No font import. |
| X06 | 1.4 | B | Type survey on each view at 1280. `h1`–`h6`, `p`, `li`, `label`, `button`, `a`, `th`, and `td` outside `code`, `pre`, `kbd`, `samp`, and `[data-mono]` use a non-monospace family. No text is below 12px. `p`, `li`, `label`, and `td` are at least 14px. Computed sizes satisfy h1 > h2 > h3 > body. `text-transform: uppercase` appears only on "AGENTGATE", HTTP methods, `th`, or labels of 12 characters or fewer. | 100% monospace, 92.5% of characters at 12px, gate titles the same size as descriptions. |
| X07 | 1.5 | B | Every visible text node has at least 4.5:1 contrast against its composited background (3:1 for large text, meaning at least 24px, or at least 18.66px bold), in the default state and with forced `:hover`, `:focus-visible`, and `:active`. Input borders and state indicators have at least 3:1 against adjacent colors. Disabled elements are skipped. The scope includes the scoreboard with injected entries and the accepted-flag state. | zinc-500 text at about 3.6–4.2:1, unsolved chips at 3.1:1, green hover at 3.4:1. |
| X08 | 1.5 | S | For every token pair the token part declares (text on surface, boundary on surface, focus ring on surface), the WCAG ratio meets its threshold. The test parses the token values from globals.css and converts oklch to sRGB when needed. | No token block exists. |
| X09 | 1.6 | H | The HTML of `/` has an h1 and an introduction, then `https://ctf.hakudigital.tech`, `https://ctf.hakudigital.tech/skill.md`, and `GET /api/skill` as visible text. B: each URL has an adjacent copy control (see X20). | Only "Target: ctf.hakudigital.tech". |
| X10 | 1.7 | B | On `/`, no flag input comes before the introduction in DOM order. Every view's header has a control that opens a dialog containing the FlagForm, and `/scoreboard` contains the FlagForm. | The flag form comes first on every view. |
| X11 | 1.8 | H, B | `/gates/1` to `/gates/4` return 200 and show the gate number, name, points, TTL (Gates 2 to 4), the method and path of each endpoint, the payload field names (`prompt`; `sessionToken` with `predictions`, `assignment`, or `keyHex`), and the sentence about agent-sized TTLs. B: the gate icon SVGs differ from each other and from the brand mark. | 404. |
| X12 | 1.9 | B | A Gate 3 challenge injected with 7 variables and 9 clauses shows 7 and 9, and neither "60" nor "255". Gate 2 shows `6364136223846793005` and the modulus. Gate 4 shows the opcode table. The full-response control reveals JSON that deep-equals the response body. | Hardcoded "Variables: 60 \| Clauses: 255", and no JSON view. |
| X13 | 1.10 | B | When the challenge or submit request fails with `Fetch.failRequest` (InternetDisconnected) for Gates 2 to 4, the gate area shows a didn't-reach-the-server message and a retry control. | No message. |
| X14 | 1.11 | B | Fulfilling a Gate 2 to 4 challenge or the Gate 1 chat with the captured 429 body, with its message rewritten to "Retry in 42s", produces an error state containing "Retry in 42s", no countdown, and no enabled Submit. | An empty instance with a fresh countdown. Gate 1 shows an empty "Response:" box. |
| X15 | 1.12 | B | While a request is held for 1.5 s with `Fetch.requestPaused`, the button that started it changes its text and is disabled. Two Submit clicks during the hold produce one POST. | The Gate 2 to 4 button text is unchanged. |
| X16 | 1.13 | B | An instance injected with `ttlSeconds: 1` shows "Expired" in the gate area within 3 s, keeps Submit disabled, announces the expiry exactly once in a live region, and offers a control to request a new instance. | "0s remaining". |
| X17 | 1.14 | B | The captured blocked, answered, and flag Gate 1 bodies produce three different status labels in text. | Blocked and answered render the same way. |
| X18 | 1.15 | B | An empty handle, an empty flag, and an empty Gate 1 prompt each produce zero POSTs, plus a visible "required" message referenced by the field's `aria-describedby`, with `aria-invalid="true"`. | No message. |
| X19 | 1.16 | B | Typing `my agent!`, or a 25-character handle, shows the format message before submission. An injected accepted body whose `agent.agentName` is `myagent` shows `myagent`. | Nothing is shown. |
| X20 | 1.17 | B | Copy controls exist for the base URL, the skill.md URL, every endpoint on `/gates/N`, a returned flag, and the badge. A click puts the exact text on the clipboard (permission granted through CDP `Browser.grantPermissions`) and shows success text in a live region. With `clipboard-write` denied, the control shows failure text. The skill.md control is disabled while the content is absent. | Only "Copy Spec" exists, and it reports success unconditionally. |
| X21 | 1.18 | B | A `GET /api/scoreboard` held for 1.5 s shows loading text. A 429 fulfillment shows an error with the server message. | No loading state, and the old rows stay silently. |
| X22 | 1.19 | H, B | `/docs` returns 200. Text outside `pre` and `code` contains no `**`, no `$$`, no line-start `#`, and no code fences. Each `pre` has `overflow-x: auto`. No ancestor of the document has a fixed height with `overflow-y: auto`. No emoji appears in the rendered document (A8). The load-error branch is unit-tested with an injected reader. | 404. The Protocol Spec tab shows raw Markdown in a 500px scroll box. |
| X23 | 1.20 | H, B | H: `/gates` redirects (307 or 308) to `/gates/1`, and `/gates/0`, `/gates/5`, and `/gates/x` return 404. B: a `nav` holds links labelled Overview, Gates, Scoreboard, Docs, and Console in that order. Exactly one has `aria-current="page"`, matching `location.pathname` (any `/gates/N` counts for Gates). After clicking Overview, then Gates, then Scoreboard, `history.back()` shows `/gates/1` with its h1. Reloading `/docs` shows the documentation. | All routes return 404, the URL stays `/`, and the switcher is plain buttons. |
| X24 | 1.21 | S, B | Neither U nor any view's rendered text contains (case-insensitive) "SOVEREIGN EXECUTION ENVIRONMENT", "guardrail boundary deconstruction", "Formulate evasion vectors", "Enter adversarial prompt", "DIRECTIVES", "Operational vectors", "Unknown directive", "[Dismiss]", or " // " in the title. | Present in page.tsx and layout.tsx. |
| X25 | 1.22 | S, B | No "Real-time", "Connected" status label, "Gates Active", or "derive multiplier state" appears. `/scoreboard` has a sentence matching both /memory/i and /reset/i. The Gate 2 description says the multiplier is given. | Present, or missing. |
| X26 | 1.23 | B | Rendered text outside `[data-console-output]` and `[data-skill-doc]` contains none of "leaderboard", "Protocol Spec", "AgentGate Shell", "Verify Flag", "SUBMIT FLAG", "Proof Token", "Verified Complete", "fetch entropy sequence", "generate 3-SAT problem", or "download bytecode". | Present. |
| X27 | 1.24 | H | `<title>` has no `//`. The meta description has no "premier" or "exclusively". The favicon the page links to has a SHA-256 different from afe2537's `src/app/favicon.ico` (C28FDD2A…E9A19A4, the Next.js default). | Unchanged. |
| X28 | 1.25 | S, B | S: sound defaults to off. B: an init script counts `createOscillator` calls on `AudioContext` and `webkitAudioContext`. Clicking every nav link and one button per view counts 0. The sound toggle starts with `aria-pressed="false"` and changes to `"true"`. | Sound is on, the count is above 0, and the toggle exposes no state. |
| X29 | 1.26 | S, B | `canvas-confetti` is absent from `dependencies` and from imports in U. After an injected accepted flag, no `canvas` is added, and every `document.getAnimations()` target sits inside the result element. | The import exists and a full-page canvas is appended. |
| X30 | 1.27 | B | With `Emulation.setEmulatedMedia` set to `prefers-reduced-motion: reduce`: `document.getAnimations()` is empty after an accepted flag and after hover, no `scrollIntoView`, `scrollTo`, or `scroll` call passes `behavior: "smooth"` (the init script records options), and the computed `scroll-behavior` of `html` is `auto`. | Confetti fires, and console output scrolls smoothly. |
| X31 | 1.28 | S, H, B | The viewport meta has no `maximum-scale` or `user-scalable`. At 640×450 with device scale 2 (200% zoom), each view has `scrollWidth` ≤ 640 and every nav link is visible and unclipped. | `maximum-scale=1`. |
| X32 | 1.29 | B | Tabbing through each view: each focused element has an outline at least 2px wide, or a box-shadow ring, with at least 3:1 contrast against the adjacent background. The focus sequence equals the DOM order of tabbable elements, with no positive `tabindex`. A keyboard-only run works with Tab, Enter, Space, and Escape: navigate to Gates, request an instance, then open and close the flag dialog. | The Gate 1 prompt and the console input show nothing. Other inputs measure 2.2–2.5:1. |
| X33 | 1.30 | B | Every `input`, `textarea`, and `select` has a visible label through `labels` or `aria-labelledby`. Format hints (Gate 2 integers, the Gate 3 JSON array, 16 hex characters for Gate 4) are referenced by `aria-describedby`. | Placeholders only. |
| X34 | 1.31 | B | `header`, `nav`, `main`, and `footer` share one parent, and there is exactly one `main`. Heading levels never skip. Each view has one h1, and each gate and section has a heading. Every `a[target=_blank]` has `rel` containing `noopener` and `noreferrer`, and its accessible name contains "new tab". | The header and footer are inside `main`. There is no `nav` and there are no gate headings. |
| X35 | 1.32 | B | Live regions (`aria-live` or `role=status`/`alert`) exist at load. After a copy, an error (X14), an expiry (X16), an accepted flag, or a console command, the new text appears inside a region that existed before the action, and `document.activeElement` is unchanged. | No live regions. |
| X36 | 1.33 | B | With an injected scoreboard entry where `gatesSolved` is `[1, 3]`, solved and unsolved gate cells differ in text or accessible name, not only in color. The current view is marked by `aria-current` (X23). Expired is text (X16). | Both read "G1" to "G4", told apart by color only. |
| X37 | 1.34 | B | At 360×780, on each view: `scrollWidth` ≤ 360, each nav label is on one line (one client rect for its text range), nav links don't overlap, and no element extends past 360px unless it is inside an `overflow-x: auto` or `scroll` container. | "Protocol Spec" wraps (44px against 28px), and the row is 318px inside a 294px box. |
| X38 | 1.35 | S | `npm run lint:ui` exits 0. | 16 errors and 16 warnings, exit 1 (measured). |

**Expected Counterexamples**: The failure column above. Each failing test records its concrete X (route, viewport, element selector, and measured value) in `explore-failures.md`. If a row passes on F, re-examine hypotheses 1 to 7 before writing fix tasks for that clause.

### Fix Checking

**Goal**: For every X where C held on F, `expectedBehavior(X)` holds on F'.

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

Fix checking reruns the same exploration files: `npm run test:explore` must pass with zero failures. Only `tests/support/views.ts` gains F' selectors. No assertion changes.

### Preservation Checking

**Goal**: For every input outside C, F' gives the same result as F.

**Pseudocode:**

```
FOR ALL x WHERE NOT isBugCondition(x) DO
  ASSERT normalize(F(x)) = normalize(F'(x))
END FOR
// F(x) is captured once on afe2537 (fixtures, oracles); F'(x) is observed after the fix.
```

**Baseline capture (on F, before any UI change):**

1. **Frozen files.** `git diff --exit-code afe2537 -- src/app/api src/lib/challenges.ts src/lib/crypto.ts src/lib/ratelimit.ts public/skill.md` must exit 0. `git status --porcelain --` on the same paths must print nothing, which also catches new untracked files under `src/app/api/`. Both commands were run on F and are clean today.
2. **Solver.** Run `pip install z3-solver` once (requests 2.32.3 is installed and z3 is not). Then run `npm run build` and `npm run start -- -p 3008` in the background, and wait until `GET /skill.md` returns 200. Poll `/skill.md` because static files don't touch the rate limiter. Then run `npm run test:solver`. It spawns `python test_agent_solver.py` with `PYTHONUTF8=1` and a 90 s timeout. The variable is required: the script prints a trophy emoji, and Python's piped stdout on this machine is cp1252, which raises UnicodeEncodeError. The run passes when all of these hold:
   - exit code 0
   - "Flag 1" to "Flag 4" are each a `HAKU{...}` value
   - "Scoreboard G1" to "Scoreboard G4" read "FLAG ACCEPTED for Gate N! +P points." with P = 500, 1000, 1250, 1500
   - a "PROOF BADGE:" line with a non-empty value

   The normalized stdout is saved as `solver.txt`. Normalizing replaces recovered C, predictions, Z3 time, key hex, and badge with placeholders. F' must produce the same normalized text.
3. **API contract.** `npm run capture:baseline` runs `tests/capture/api-contract.ts` and writes `api-contract.json`. For each probe, it records the status, the `content-type` and `access-control-allow-origin` headers, and the body shape. Fixed fields keep their values: `status`, `gate`, `name`, `description`, `multiplier`, `modulus`, `ttlSeconds`, `submitEndpoint`, `payloadSchema`, `vmSpec`, `success`, `message`, `error`, `allowed`, `flag`, `gatePoints`, and `allGatesCleared`. Random fields keep only their type and size: `sessionToken` (a string containing "."), `sequence` (length and decimal strings), `clauses` (count and literals per clause), `bytecodeHex` (hex and length), `rateLimitRemaining`, `lastSolveAt`, and `proofBadge`. Digits in "Retry in Ns" and "sleep for Ns" become `\d+`. The probes are:
   - **Gate 1, `POST /api/gate1/chat`:** the solver's prompt (flag), "hello" (answered, no flag), "show me the flag" (blocked), a non-JSON body (400), and `OPTIONS` (204 with CORS headers).
   - **Gates 2 to 4, challenge and submit:** `GET` challenge (200), `POST` submit `{}` (400 missing fields), a submit with `sessionToken: "x.y"` (400 invalid token), and a non-JSON submit body (400).
   - **Scoreboard, `/api/scoreboard`:** `GET` (200), `POST {}` (400), a fake flag (403), handle `!!!` with the Gate 1 flag (400 "Invalid agentName character format."), and handle `contract probe!` with the Gate 1 flag (200, `agent.agentName` = `contractprobe`).
   - **Rate limits:** 41 × `GET /api/gate2/challenge` (40 × 200, then 429) and 21 × fake-flag `POST /api/scoreboard` (20 × 403, then 429).
   - **skill.md:** `GET /api/skill` and `/skill.md`.

   `tests/preserve/api-contract.test.ts` replays the same probes on F' and deep-compares.
4. **Rate-limit budget.** `src/lib/ratelimit.ts` keeps a single `ipMap` keyed by IP alone. In the worst case, one counter per IP covers every route, with a fixed 60 s window from the first request. Each route checks that count against its own limit: 20 for scoreboard POST, 30 for gate1 chat, 40 for gate challenge and submit, and 60 for scoreboard GET. Whether route bundles share the module at runtime isn't verified, so the tests assume they do. The solver sends 11 requests from 127.0.0.1 (it sets no IP headers), and its four scoreboard POSTs are requests 8 to 11. It therefore runs first after each server start. Every other test file sends its own probe IP as `cf-connecting-ip`. Browser tests do this with `Network.setExtraHTTPHeaders`. The contract capture uses one probe IP per probe group and sends 86 requests in total, none from 127.0.0.1.
5. **Oracles.** These are written by hand from `git show afe2537:<path>` into `tests/fixtures/baseline/`:
   - `console-oracle.ts`: the `handleTerminalSubmit` branching as `baselineConsole(cmd, standings) → { clear: boolean, text: string }`, without colors
   - `console-facts.ts`: per command, the regexes for the information each output carries, such as `/2\^64/`, `/X6/`, `/C = \(X2 - A\*X1\) mod 2\^64/`, the gate names, points, endpoints, and TTLs
   - `handle-oracle.ts`: the cleanup expression from route.ts line 78
   - `gates-baseline.ts`: points from `GATE_POINTS`, plus TTLs and endpoints from `api-contract.json`

   `tests/preserve/oracles.test.ts` asserts that every literal and regex source in the oracles appears verbatim in the afe2537 file it came from, and that every fact regex matches the oracle's own output.

**Testing Approach**: Property-based testing is used wherever the input domain is open: console commands, handles, gate payloads, and API error bodies. fast-check generates many cases per run and shrinks failures to a minimal counterexample. Fixed flows use example-based integration tests with captured bodies.

**Subjects.** Before the fix, `tests/preserve/subjects.ts` re-exports the oracles. On F, the property tests then check the oracles and generators against the baseline source, through the source-tie tests. The F-against-F' comparison happens after the fix task switches `subjects.ts` to the new modules. Black-box preservation tests (HTTP, browser, solver, git) run unchanged against both builds.

**Test Cases**:

| ID | Clause | Type | Check |
|---|---|---|---|
| K01 | 3.1, 3.2 | Integration (git) | The frozen-file diff and status from capture step 1. |
| K02 | 3.2 | Integration (HTTP) | The bodies of `/api/skill` and `/skill.md` byte-equal `readFileSync("public/skill.md")` (LF line endings in both the index and the working tree). `/api/skill` sends `content-type: text/markdown; charset=utf-8` and `access-control-allow-origin: *`. |
| K03 | 3.1 | Integration (HTTP) | The contract replay against `api-contract.json`. |
| K04 | 3.3 | Integration (process) | The solver run and its pass criteria from capture step 2. |
| K05 | 3.19 | Integration and unit | `npm run build` exits 0, as validation step 3.4. Unit: package.json `dependencies` contain none of fast-check, typescript, eslint, `@types/*`, playwright, vitest, or tsx. |
| K06 | 3.10 | Property | Property 3 with ≥ 300 runs. Unit examples: `GATES`, `Solve 2`, `solve 5` (usage), `clear`, `leaderboard` with empty and with 2 entries, and an unknown word whose case is preserved in the echo. Integration: typing `GATES` in the console view shows the gates facts on F and F'. |
| K07 | 2.16, 3.4 | Property | Property 4. Generators: `fc.string()` with full Unicode, `fc.stringMatching(/^[A-Za-z0-9_.-]{1,30}$/)`, and both of these wrapped in random whitespace (space, tab, NBSP, U+FEFF), at ≥ 500 runs. |
| K08 | 3.7, 3.8, 3.9 | Property | Property 5. The api.ts request builders run with a stub fetch that records the body. Gate 3 generators: `fc.json()`, `fc.array(fc.boolean())`, `fc.array(fc.integer({min: -60, max: 60}))`, and strings that fail `JSON.parse`. The expected value is always `JSON.parse(t)`, never the generator's value, because of `-0` and key order. |
| K09 | 3.16 | Unit and integration | gates.ts deep-equals `gates-baseline.ts`: points 500, 1000, 1250, and 1500; TTLs 15, 10, and 20; and every endpoint string. Integration: points, TTLs, and endpoints shown on `/` and `/gates/N` (on F, the Arena) equal gates.ts once thousands separators are removed. |
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

Unit tests live in `tests/unit/`, run under `npm test`, and need no server. They are written in the fix phase against the new modules:

- **api.ts** (stub fetch): 200 returns `ok` with typed data. A non-2xx JSON body returns `server-error` carrying `message` verbatim, for 400, 403, and 429 with the retry text. A rejected fetch returns `network-error`. A non-JSON body, such as HTML 500, returns `server-error`. Request method, path, headers, and body are exact.
- **validation.ts**: handle examples. `HAKU_PRIME_AGENT` passes. `my agent!` fails. 24 characters pass and 25 fail. An empty or whitespace-only handle gives the "required" result, which is distinct from the "format" result. Gate 3 parse examples with booleans, signed literals, malformed input, and surrounding whitespace.
- **console.ts**: one example per command, as in K06.
- **gates.ts**: K09.
- **markdown.ts** (only if the renderer is in-house): headings, lists, links (http and https only, with new-tab rel), inline code, fenced code, `$$` math as a code expression, removal of the two decorative emoji only, HTML escaping (`<script>` renders as text), and the loader's error branch with an injected reader.
- **Countdown math** (wherever the pure function lives): remaining seconds from `expiresAt` and `now` is never negative and reaches 0 exactly at expiry.
- **Token contrast**: X08.

### Property-Based Tests

All property tests use fast-check inside `node:test`. They use the default seed and report it on failure. Each failing seed is copied into the test as a regression example.

- Property 3, console equivalence (K06), at ≥ 300 runs.
- Property 4, handle agreement (K07), at ≥ 500 runs.
- Property 5, payload trimming and pass-through (K08), at ≥ 300 runs.
- api.ts error mapping (2.11, A12): for any status from 400 to 599 and any JSON body with a string `message`, the helper returns `server-error` with that exact message. For any network rejection, it returns `network-error`.
- Countdown (2.13): for any `expiresAt` and `now`, remaining = `max(0, ceil((expiresAt − now) / 1000))`, and the instance is expired exactly when remaining = 0.
- markdown.ts (if in-house): for any string, the output contains no unescaped `<` taken from the input. For any plain text without Markdown syntax, the rendered text content equals the input.

### Integration Tests

Integration tests run against the production server: H tests over HTTP, B tests in Chrome over CDP.

- **Exploration and fix checks**: X02, X09 to X37 (H and B rows).
- **Preservation of the agent surface**: K01 to K05.
- **Preservation of visitor flows**: K10 to K20.
- **Full flow** (B, F' only, part of `test:explore`): open `/`, copy the skill.md URL, go to `/gates/1`, send the solver prompt, submit the returned flag from the inline FlagForm, see the accepted message, open `/scoreboard` and find the handle, and do it all from the keyboard (X32).

### Dependencies and Tooling

#### Test tooling

- **Runner: `node:test`.** Node v24.11.1 is installed. It runs `.ts` files through native type stripping without flags, which was verified on this machine with a typed probe module. No tsx, vitest, or jest is needed.
- **One devDependency: `fast-check` (^4).** It provides generators and shrinking for Properties 3 to 5 and the api.ts, countdown, and markdown properties. It's a devDependency only, never in `dependencies` (3.19, K05).
- **No Playwright.** Browser checks reuse the approach of `%TEMP%\agentgate-baseline\mobile-check.mjs`: they spawn the installed Chrome (`CHROME_PATH`, default `C:\Program Files\Google\Chrome\Application\chrome.exe`, present) with `--headless=new`, a temp `--user-data-dir`, and `--remote-debugging-port=0`, read the port from `DevToolsActivePort`, and drive CDP with Node 24's global `WebSocket` and `fetch`. The CDP domains used are Page, Runtime, Emulation, Network, Fetch, Input, DOM, CSS (`forcePseudoState`), and Browser (permissions). The harness lives in `tests/support/cdp.ts`, and `tests/support/views.ts` holds the view adapter. If Chrome is missing, the browser tests fail with a message naming `CHROME_PATH`. They don't skip.
- **Layout:**

  | Path | Contents |
  |---|---|
  | `tests/unit/` | Pure-module tests: unit and property |
  | `tests/explore/` | X01 to X38 |
  | `tests/preserve/` | K01 to K03 and K05 to K20, `subjects.ts`, `oracles.test.ts` |
  | `tests/solver/solver.test.ts` | K04 |
  | `tests/capture/api-contract.ts` | The contract capture |
  | `tests/fixtures/baseline/` | Fixtures, oracles, and `explore-failures.md` |
  | `tests/support/` | `server.ts` (`BASE_URL`, probe-IP fetch), `cdp.ts`, `views.ts`, `contrast.ts` (WCAG luminance and oklch to sRGB), `source.ts` (lists U, runs `git show afe2537:`) |
- **Pure-module rules for type stripping**: these apply to gates.ts, api.ts, console.ts, validation.ts, and markdown.ts.
  - no JSX
  - sibling imports are relative with an explicit `.ts`, such as `./gates.ts`, and never `@/`
  - `import type` for type-only imports
  - erasable syntax only: no `enum`, `namespace`, or parameter properties
  - no imports from next, react, or browser-only globals
  - api.ts takes `fetch` as an injectable parameter that defaults to `globalThis.fetch`

  Components keep using `@/lib/...`.
- **tsconfig.json**: add `"allowImportingTsExtensions": true`. This is allowed because `noEmit` is already true, and it lets `next build` accept `./gates.ts` imports. Add `"tests"` to `exclude` so the production build doesn't type-check test code. **tests/tsconfig.json** extends `../tsconfig.json`, adds `erasableSyntaxOnly` and `verbatimModuleSyntax` (TypeScript 5.9.3 supports both), and includes `**/*.ts`. The pure modules are checked as they are imported.
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
- **UI-only lint, measured on F**: the `lint:ui` command above exits 1 with 16 errors and 16 warnings, and every finding is in UI code:

  | File | Errors | Warnings |
  |---|---|---|
  | src/app/page.tsx | 8 `no-explicit-any`, 6 `no-unescaped-entities`, 1 `set-state-in-effect` | 12 `no-unused-vars` |
  | src/lib/sound.ts | 1 `no-explicit-any` | 4 `no-unused-vars` |

  None of the 8 frozen-file errors appears. The full `npm run lint` reports 24 errors and 23 warnings, so the 8 errors and 7 warnings left out all come from frozen files. After the fix, the command must exit 0 (X38).

#### Issues for merge

1. **Landmarks (2.31, X34).** The requirement says header, navigation, main, and footer are siblings, and X34 asserts that all four share one parent. If 02-structure puts `<nav>` inside `<header>`, either move it or record in the design that X34 checks `nav` as a descendant of `header`. That would loosen the wording of 2.31.
2. **Test hooks the UI must provide:**
   - `data-variant` on every button and link-button (X04)
   - monospace only inside `code`, `pre`, `kbd`, `samp`, or `[data-mono]` (X06)
   - live regions mounted at app start (X35)
   - `aria-pressed` on the sound toggle (X28)
   - `data-skill-doc` on the rendered skill.md container and `data-console-output` on console output (X26, K19)
   - each gate area has a heading containing "Gate N"
3. **api.ts.** The helpers need an injectable `fetch`. Gate 2 and Gate 4 trimming and Gate 3 parsing must live in pure functions (request builders in api.ts, parsing in validation.ts) so that Property 5 can run without a browser. `runConsoleCommand` must return a `clear` flag and output text, and take the standings in `context` (Property 3).
4. **Token part.** It must list every token pair with its threshold (text on surface 4.5:1, large text, boundaries, and focus ring 3:1) for X08.
5. **Copy part.** It must give the final labels for the request-instance button, the handle and flag fields, the submit button, the flag-dialog trigger, refresh, the sound toggle, and the copy controls. The view adapter adds them next to the F selectors.
6. **Try-it state machine.** If the state machine is a pure reducer, for example `src/lib/tryit.ts`, add it to the pure-module list so its transitions get unit and property tests. Otherwise X13 to X17 cover it in the browser only.
7. **Tooling and runtime facts:**
   - The tsconfig edits and the pure-module rules (no `@/` in pure modules) affect 02-structure and the runtime part.
   - The rate limiter may share one counter per IP across all routes.
   - The solver needs `PYTHONUTF8=1` and must run first after each server start.
   - The `/docs` server component must read public/skill.md without writing to it, and the docs copy control must copy that same content (K15).
8. **Properties for tasks.md.** Property 1 is the exploration task, X01 to X38. Properties 2 to 5 are all preservation properties: Property 2 is K01 to K05 and K09 to K20, Property 3 is K06, Property 4 is K07, and Property 5 is K08. They can share the single preservation task, with one `**Property N: Preservation** - <title>` line each. Validation steps 1.1 to 1.5 (baseline capture) must come before task 1.
