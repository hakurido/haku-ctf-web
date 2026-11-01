# Implementation Plan

> **Pending user confirmation before execution.** Two items wait on the user and the
> orchestrator confirms them before dispatching the tasks that touch them:
> - **A14 — "Difficulty: Hell" presentation.** Gate names stay "Neural Sentry",
>   "Entropy Fracture", "Logic Maze", "Bytecode Vault" (R-19), and "Hell" shows once per
>   page as a `Difficulty: Hell` tag. Affects tasks 4.2, 4.8, 4.12.
> - **Gate 1 local hash readout.** The Gate 1 try-it panel shows a local trimmed-length
>   and SHA-256-prefix readout through `crypto.subtle` (an A6 affordance; it sends no
>   request and is not a nonce miner). Affects task 4.6.
> If the user declines either, drop that item from the named task and leave the rest.

## Overview

The UI fix is already implemented and committed (2516aa1; HEAD c6d13ea is HELL mode). This
plan closes the remaining gaps the audit found — 50 review findings (R-01 to R-50) and 19
measured gaps (M-01 to M-19) — and adds the exploration and preservation test suites the
design calls for. Work runs in six dependency waves: tooling, test writing on HEAD, two
parallel fix waves grouped by file, then fix checking and a final checkpoint. Nothing is
rebuilt from scratch.

## How to read this plan

- The fix at commit 2516aa1 is already in place. "Unfixed code (F)" below means **HEAD
  c6d13ea** for the gaps that remain. Exploration tests must fail on HEAD and pass after
  the fix; preservation tests must pass on HEAD and still pass after the fix.
- **Dependency mechanism.** Every leaf task carries three italic annotation lines the
  orchestrator reads: `_Wave: N_`, `_Owns: <files>_`, and `_Depends on: <task ids>_`
  (`none` for ready tasks). The orchestrator dispatches every leaf whose dependencies are
  all complete as one wave, up to 5 at a time. No two leaves in the same wave list the
  same file under `_Owns:_`, so parallel agents never collide.
- Fix tasks name their R-xx (review.md) and M-xx (measured.md) IDs and point at the fix
  text there instead of copying it.
- **M-09 (monospace outside code and data)** is handled inside each fix task for its own
  files: interface labels move to the sans face, and data gets `data-mono` or a `<code>`
  wrapper.

## Safety rules (apply to every task that could touch these)

- **Never run the committed `test_agent_solver.py`.** At HEAD it targets production
  (`BASE = "https://ctf.hakudigital.tech"`). Always copy it to `%TEMP%`, change only the
  `BASE` line to `http://localhost:<port>`, then run the copy with `PYTHONUTF8=1`. No test
  or script may send any request to ctf.hakudigital.tech.
- **Frozen at c6d13ea, byte-identical, never edited:** `src/app/api/**`,
  `src/lib/challenges.ts`, `src/lib/crypto.ts`, `src/lib/ratelimit.ts`, `public/skill.md`,
  `test_agent_solver.py`. Check with
  `git diff --exit-code c6d13ea -- src/app/api src/lib/challenges.ts src/lib/crypto.ts src/lib/ratelimit.ts public/skill.md test_agent_solver.py`.
- **Servers run in the background and get stopped afterward.** Fallback cleanup:
  `Get-NetTCPConnection -LocalPort <port> -State Listen | ForEach-Object { taskkill /PID $_.OwningProcess /T /F }`,
  then confirm the port is free.
- **The rate limiter keeps one counter per IP across all routes.** Each test file sends
  its own probe IP in `cf-connecting-ip` (198.18.0.0/15), and the solver copy runs first
  after a server starts.
- **No commits and no pushes.**

---

## Tasks

### 1. Wave 1 — Tooling and test harness

- [x] 1. Set up test tooling, support helpers, and the HEAD build
  - Add `fast-check` (^4) and `playwright-core` to **devDependencies** only, never to
    `dependencies` (3.19, K05). `playwright-core` drives the installed Chrome through
    `channel: "chrome"` (or `CHROME_PATH`), so no browser download happens.
  - Run `npm install -D fast-check playwright-core` to write `package.json` and
    `package-lock.json`.
  - Confirm `pip install z3-solver` (already installed: z3 5.3.3, requests 2.32.3 — just
    verify, don't reinstall) so the full Gate 3 solver run works in Wave 5.
  - Add the npm scripts exactly as the design's Test tooling section lists them: the
    required set `lint:ui`, `test`, `test:explore`, `test:preserve`, plus
    `typecheck:tests`, `test:solver`, and `capture:baseline`. Use the exact `lint:ui`
    command from design-parts/05-testing.md:
    `eslint src --max-warnings 0 --ignore-pattern "src/app/api/**" --ignore-pattern src/lib/challenges.ts --ignore-pattern src/lib/crypto.ts --ignore-pattern src/lib/ratelimit.ts`.
    Leave the existing `lint` script as it is (it keeps exiting 1 on the frozen files, A7).
  - Edit `tsconfig.json` (R17): add `"allowImportingTsExtensions": true` and add `"tests"`
    to `exclude`. Add `tests/tsconfig.json` extending `../tsconfig.json` with
    `erasableSyntaxOnly` and `verbatimModuleSyntax`, including `**/*.ts`. Fallback: if
    `next build` rejects `allowImportingTsExtensions`, revert root tsconfig.json and keep
    the setting in tests/tsconfig.json only.
  - Add the support modules under `tests/support/`: `server.ts` (`BASE_URL`, server
    start/stop on a given port, probe-IP fetch that sets `cf-connecting-ip`),
    `browser.ts` (playwright-core launch with `channel: "chrome"` and the page helpers),
    `views.ts` (the view adapter), `contrast.ts` (WCAG luminance and oklch→sRGB),
    `source.ts` (`git show afe2537:` / `git show c6d13ea:`), and the solver-copy helper
    (copy `test_agent_solver.py` to `%TEMP%`, rewrite only the `BASE` line, assert exactly
    that one line differs, spawn `python <copy>` with `PYTHONUTF8=1`). Test logic may be
    ported from the audit scripts in `%TEMP%\agentgate-audit` (cdp.mjs, views.mjs,
    type.mjs, interact.mjs, extras.mjs, requests.mjs, http-check.mjs, solver_local.py).
  - Run `npm run build` once so the HEAD build sits in `.next` for Wave 2 to reuse.
  - **Safety:** copy-only solver rule; frozen-file set; no commits. Do not edit any file
    under the frozen set.
  - _Wave: 1_
  - _Owns: package.json, package-lock.json, tsconfig.json, tests/tsconfig.json, tests/support/server.ts, tests/support/browser.ts, tests/support/views.ts, tests/support/contrast.ts, tests/support/source.ts, tests/support/solver-copy.ts_
  - _Depends on: none_
  - _Requirements: 3.19, 2.35_

---

### 2. Wave 2 — Exploration tests for the remaining gaps (Property 1)

These tests encode expected behavior. They **must FAIL on HEAD c6d13ea** — failure
confirms the gap exists — and they pass after the fix. Do not fix code or tests when they
fail here. Each task records its counterexamples to
`tests/fixtures/explore-failures/<file>.md` (one file per task). Where a review.md finding
is marked "likely" (R-33, R-37, R-41 double-speech, R-42, R-43), the test decides it: if
the assertion passes on HEAD, record it as "not reproduced" and the Wave 3/4 owner drops
that item from its fix.

- [x] 2.1 Write source/static exploration tests
  - **Property 1: Bug Condition** - UI source shows no defect marker (static checks)
  - **CRITICAL**: These tests MUST FAIL on HEAD c6d13ea; failure confirms the gaps.
  - Cover the S-kind rows: X01, X03, X05, X24 (source half), X25 (source half), X28
    (source default), X29 (dependency + imports), X38 (`npm run lint:ui` exits 0). Port
    the enforcement regex search (M-18) and the "no 60 booleans / no `(Hell)` / no
    `1.3e36` / no `high-order` / no `Babai` / no `35+`" literal scans from the design's X
    table and from the audit `rg.log`.
  - Run on the Wave 1 HEAD build / repo (no rebuild). `lint:ui` on HEAD reports 24 errors
    (M-17), so X38 fails as expected. Record counterexamples.
  - _Wave: 2_
  - _Owns: tests/explore/source.test.ts, tests/fixtures/explore-failures/source.md_
  - _Depends on: 1_
  - _Requirements: 2.1, 2.2, 2.4, 2.21, 2.22, 2.25, 2.26, 2.35_

- [x] 2.2 Write browser layout and accessibility exploration tests
  - **Property 1: Bug Condition** - Rendered layout and semantics show no defect marker
  - **CRITICAL**: These tests MUST FAIL on HEAD c6d13ea; failure confirms the gaps.
  - Reuse the Wave 1 build; run `next start -p 3101` on its own port; send a probe IP.
  - Cover the B-kind structural rows: X04 (`data-variant`, M-15), X06 (type survey: no
    "60 booleans", no uppercase h4 — M-06, nothing under 14px for p/label/td — M-07,
    h1>h2>h3 — M-10), X07/X08 (contrast), X11 (gate pages show names without "(Hell)",
    one `Difficulty: Hell` per page — A14), X22 (docs: no literal `\gg`/`$$`/`#`, no
    emoji — M-08/M-12/M-19), X27 (favicon/title), X31 (zoom reflow), X32 (focus ring,
    R-13), X33 (labels, M-16 console label is "Command"), X34 (landmarks, skipped heading
    levels — M-11), X36 (status not by color alone), X37 (360px no overlap — M-03/M-33),
    and the Overview intro/URL copy controls (X09 B-half, X20 copy accessible names —
    R-39).
  - Assert the "Command" console label (R-12/M-16), a live region inside the dialog
    (R-37, likely), no nav overlap of `main` at 360px (M-03), no skipped heading levels
    (M-11), no uppercase h4 (M-06), nothing under 14px for p/label/td (M-07), and the copy
    buttons' accessible names (R-39).
  - Record counterexamples; mark any "likely" row that passes on HEAD as not reproduced.
  - _Wave: 2_
  - _Owns: tests/explore/rendered.test.ts, tests/fixtures/explore-failures/rendered.md_
  - _Depends on: 1_
  - _Requirements: 2.3, 2.4, 2.5, 2.6, 2.9, 2.17, 2.24, 2.28, 2.29, 2.30, 2.31, 2.33, 2.34_

- [x] 2.3 Write browser flow and request exploration tests
  - **Property 1: Bug Condition** - Interactions and requests show no defect marker
  - **CRITICAL**: These tests MUST FAIL on HEAD c6d13ea; failure confirms the gaps.
  - Reuse the Wave 1 build; run `next start -p 3102`; send a probe IP; use `page.route`
    to inject captured bodies and network failures.
  - Cover the flow/request rows: X02/X09/X23 (routes, nav, `aria-current`), X10 (flag form
    not ahead of intro), X12 (instance counts derived — M-04/M-05), X13 (network-error
    message), X14 (429 error state), X15 (busy state), X16 (expiry), X17 (Gate 1 labels),
    X18/X19 (required and handle warnings), X20 (copy to clipboard), X21 (scoreboard
    loading/error), X28 (oscillator count), X29/X30 (confetti/reduced motion), X35 (live
    regions announce).
  - **Assert exactly one `GET /api/scoreboard` when `/scoreboard` opens** (M-01, R-01, the
    most severe gap). On HEAD this fails because of the refetch loop.
  - Record counterexamples.
  - _Wave: 2_
  - _Owns: tests/explore/flows.test.ts, tests/fixtures/explore-failures/flows.md_
  - _Depends on: 1_
  - _Requirements: 2.7, 2.10, 2.11, 2.12, 2.13, 2.14, 2.15, 2.16, 2.17, 2.18, 2.20, 2.25, 2.26, 2.27, 2.32_

### 3. Wave 2 — Preservation tests (Properties 2 to 5)

These tests capture behavior that must not change. They **must PASS on HEAD c6d13ea**
(observation-first) and still pass after the fix. Follow the design's Preservation Checking
capture order. The solver copy runs first after each server start.

- [x] 3.1 Write agent-surface preservation tests (HTTP contract + solver copy)
  - **Property 2: Preservation** - The agent surface is unchanged
  - **IMPORTANT**: Observe on HEAD c6d13ea first, then assert; these MUST PASS on HEAD.
  - Reuse the Wave 1 build; run `next start -p 3103`. Run the solver copy first (safety
    rule: copy to `%TEMP%`, change only `BASE` to `http://localhost:3103`, `PYTHONUTF8=1`),
    then the contract capture, then replay.
  - Implement K01 (frozen-file diff against c6d13ea plus `git status --porcelain`), K02
    (`/api/skill` and `/skill.md` byte-equal `public/skill.md`, with
    `text/markdown; charset=utf-8` and `access-control-allow-origin: *`), K03 (contract
    replay deep-compare against `api-contract.json`, random fields excluded), K04 (solver
    copy: 4 flags accepted with points 1000/2000/2500/3000, plus a Proof-of-Pwn badge),
    and K05 (`dependencies` exclude test tooling). Write `tests/capture/api-contract.ts`
    and the baseline fixtures (`api-contract.json`, `solver.txt`) from the probes in the
    design's capture step 3.
  - **Safety:** copy-only solver rule; frozen set byte-identical; no request to
    ctf.hakudigital.tech; no commits.
  - _Wave: 2_
  - _Owns: tests/preserve/api-contract.test.ts, tests/solver/solver.test.ts, tests/capture/api-contract.ts, tests/fixtures/baseline/api-contract.json, tests/fixtures/baseline/solver.txt_
  - _Depends on: 1_
  - _Requirements: 3.1, 3.2, 3.3, 3.19_

- [x] 3.2 Write visitor-flow, passing-list, and property preservation tests
  - **Property 2: Preservation** - Visitor flows and site invariants are unchanged
  - **Property 3: Preservation** - Console commands return equivalent information
  - **Property 4: Preservation** - The handle check agrees with the server cleanup
  - **Property 5: Preservation** - Gate payloads keep trimming and pass-through
  - **IMPORTANT**: Observe on HEAD c6d13ea first; these MUST PASS on HEAD.
  - Reuse the Wave 1 build; run `next start -p 3104`; send a probe IP.
  - Turn the measured.md **Passing** list into regression checks: landmarks,
    `aria-current`, sound off, the countdown lifecycle and announcements, instance counts
    (Gate 2 = 4 outputs X1–X4 with inputs X5–X7, Gate 3 = 120 vars / 512 clauses, Gate 4 =
    9 opcodes), console help/gates/solve output, contrast, no horizontal scroll, the 307
    and 404 routes, and metadata. Implement K06–K20 (K10, K11, K12, K13, K14, K15, K16,
    K17, K18, K19, K20) as browser flows.
  - Property tests (fast-check, under `tests/unit/` so they run with `npm test`, no
    server): Property 3 console equivalence (K06) from the HEAD `src/lib/console.ts`
    oracle, Property 4 handle agreement (K07), Property 5 payload trimming and Gate 3 JSON
    pass-through (K08). Write the oracles and `subjects.ts` from `git show afe2537:` /
    `git show c6d13ea:` and the oracle source-tie test (`oracles.test.ts`). Add the pure
    unit/property tests for api.ts, validation.ts, app-state.ts, format.ts, gates.ts
    (K09), markdown.ts, countdown math, and token contrast (X08).
  - Record the HEAD `lint:ui` count (24 errors) for reference; don't fix anything here.
  - _Wave: 2_
  - _Owns: tests/preserve/flows.test.ts, tests/preserve/subjects.ts, tests/preserve/oracles.test.ts, tests/unit/api.test.ts, tests/unit/validation.test.ts, tests/unit/console.test.ts, tests/unit/app-state.test.ts, tests/unit/format.test.ts, tests/unit/gates.test.ts, tests/unit/markdown.test.ts, tests/unit/countdown.test.ts, tests/unit/contrast.test.ts, tests/fixtures/baseline/console-oracle.ts, tests/fixtures/baseline/console-facts.ts, tests/fixtures/baseline/handle-oracle.ts, tests/fixtures/baseline/gates-baseline.ts_
  - _Depends on: 1_
  - _Requirements: 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 3.10, 3.11, 3.12, 3.13, 3.14, 3.15, 3.16, 3.17, 3.18, 2.16, 2.21, 2.22, 2.23_

---

### 4. The fix — gap fixes by file group

Wave 3 fixes have no dependency on other fix tasks. Wave 4 fixes depend on the state, lib,
and ui-primitive tasks. **Wave 3 and Wave 4 tasks do not build or start servers.** Each
one checks only its own files: `eslint` on those files (zero errors, zero warnings),
`tsc --noEmit` filtered to its own files, and unit tests for the pure modules it touched.
Every task names its R-xx and M-xx IDs; the fix text lives in review.md and measured.md.

#### Wave 3 — fixes A (parallel, no fix-task dependencies)

- [x] 4.1 Fix the state layer (provider and reducer)
  - Groups A and B: R-01 (blocker, scoreboard refetch loop — stabilize `loadScoreboard`
    with an `inFlight` ref, deps `[announce]`), R-02, R-03, R-04, R-05, R-06. Also add the
    `flag/error` case that stores the HTTP status so FlagForm (4.9) can label errors
    (R-36). See review.md groups A and B for the exact fixes.
  - Resolves M-01. Apply M-09 to any mono-outside-code in these files.
  - Check: `eslint` + `tsc --noEmit` on the owned files; run `tests/unit/app-state.test.ts`.
  - _Wave: 3_
  - _Owns: src/components/state/AppStateProvider.tsx, src/lib/app-state.ts_
  - _Depends on: 1_
  - _Requirements: 2.32, 2.35, 3.4, 3.15_

- [x] 4.2 Fix the library modules (api, validation, format, gates)
  - Groups C, F, S: R-07, R-08 (api.ts/validation.ts typing and messages), R-17, R-18,
    R-19, R-20 (gates.ts: drop "(Hell)" from names, replace jargon with the Copy section's
    strings), R-50 (format.ts dead code). Add `difficulty: "Hell"` / `DIFFICULTY`,
    `GATE2_INCREMENT` (the `LCG_INCREMENT` constant), `expiringAtSeconds`, and
    `GATE1_RULES` to gates.ts. See review.md groups C, F, S.
  - **A14 pending:** the `Difficulty: Hell` presentation is confirmed by the orchestrator
    before this runs. Apply M-09 to data/labels in these files.
  - Check: `eslint` + `tsc --noEmit` on the owned files; run
    `tests/unit/api.test.ts`, `tests/unit/validation.test.ts`, `tests/unit/format.test.ts`,
    `tests/unit/gates.test.ts` (K09).
  - _Wave: 3_
  - _Owns: src/lib/api.ts, src/lib/validation.ts, src/lib/format.ts, src/lib/gates.ts_
  - _Depends on: 1_
  - _Requirements: 2.8, 2.10, 2.11, 2.18, 2.21, 2.22, 2.35, 3.16_

- [x] 4.3 Fix the UI primitives
  - Groups L, M, N: R-39, R-40 (CopyButton: constant "Copy {label}" name,
    `useSyncExternalStore` for hydration), R-41 (StatusMessage: remove `role="status"`,
    type `badgeIcon`), R-42 (Button: `aria-disabled` busy state), plus M-15 (`data-variant`
    on Button) and M-07 field-description size (Field descriptions to ≥14px). See review.md
    groups L, M, N and measured.md M-07, M-15.
  - R-42 and R-41 double-speech are "likely" — honor the Wave 2 test verdict. Apply M-09.
  - Check: `eslint` + `tsc --noEmit` on the owned files.
  - _Wave: 3_
  - _Owns: src/components/ui/CopyButton.tsx, src/components/ui/StatusMessage.tsx, src/components/ui/Button.tsx, src/components/ui/Field.tsx, src/components/ui/StatusBadge.tsx_
  - _Depends on: 1_
  - _Requirements: 2.3, 2.4, 2.12, 2.17, 2.29, 2.32, 2.35_

- [x] 4.4 Fix the shell and metadata
  - Groups O and R: R-43 (PrimaryNav 360px overflow), R-44 (SoundToggle accessible name),
    R-49 (layout/not-found/scoreboard metadata, skip link, 404 copy). Resolves M-03 (nav
    overlap) and M-14 (keep the `·` title separator from design-parts/02, overriding 03).
    Document the M-18 `themeColor: "#111315"` literal as the one allowed hex exception.
    See review.md groups O, R and measured.md M-03, M-14, M-18.
  - R-43 is "likely" — honor the Wave 2 verdict. Apply M-09. Owns only the scoreboard
    page's **metadata**; `ScoreboardView`/`StandingsTable` belong to 4.10.
  - Check: `eslint` + `tsc --noEmit` on the owned files.
  - _Wave: 3_
  - _Owns: src/components/shell/PrimaryNav.tsx, src/components/shell/SoundToggle.tsx, src/components/shell/SiteFooter.tsx, src/components/shell/SiteHeader.tsx, src/app/layout.tsx, src/app/not-found.tsx, src/app/scoreboard/page.tsx_
  - _Depends on: 1_
  - _Requirements: 2.22, 2.24, 2.25, 2.31, 2.34, 3.13_

- [x] 4.5 Fix the docs renderer
  - Group P: R-45 (strip leading emoji from heading inlines — M-12), R-46 (map `\gg`→"≫"
    and `\times`→"×", return `null` for other `\command` so the code fallback runs, fix
    `prefer-const`), R-47 (math sub/sup size token ≥0.75rem — M-08/M-18, sr-only
    "(opens in a new tab)" on docs links — M-19, 03 intro/URLs and error state). See
    review.md group P and measured.md M-08, M-12, M-19.
  - Apply M-09. Check: `eslint` + `tsc --noEmit` on the owned files; run
    `tests/unit/markdown.test.ts`.
  - _Wave: 3_
  - _Owns: src/lib/markdown.ts, src/components/docs/SkillDocument.tsx, src/components/docs/SkillDoc.tsx, src/app/docs/page.tsx_
  - _Depends on: 1_
  - _Requirements: 2.4, 2.19, 2.31, 3.17_

#### Wave 4 — fixes B (parallel, depend on state/lib/ui primitives)

- [x] 4.6 Fix the try-it panels
  - Group G: R-21 (Gate 1 PoW hint and — **pending user confirmation** — a local trimmed
    length and SHA-256-prefix readout via `crypto.subtle`; no nonce miner), R-22, R-23
    (h3→h2, resolves the M-11 skipped level for the try-it heading), R-24, R-25, R-26,
    R-27. See review.md group G.
  - Apply M-09. Check: `eslint` + `tsc --noEmit` on the owned files.
  - _Wave: 4_
  - _Owns: src/components/gates/Gate1TryIt.tsx, src/components/gates/InstanceTryIt.tsx, src/components/gates/Countdown.tsx_
  - _Depends on: 4.1, 4.2, 4.3_
  - _Requirements: 2.8, 2.13, 2.14, 2.15, 2.22, 2.29, 2.30, 2.33, 2.35, 3.6_

- [x] 4.7 Fix the instance views
  - Group H: R-28 (Gate 3 hint derived from `variablesCount` — M-05), R-29 (Gate 2 show
    `multiplier` and `modulus`, increment C from `LCG_INCREMENT`, fieldset legend — M-04),
    R-30 (no all-caps h4, nothing below 12px, title-case fixes — M-06). All counts derive
    from the response (A15). See review.md group H and measured.md M-04, M-05, M-06.
  - Apply M-09. Check: `eslint` + `tsc --noEmit` on the owned files.
  - _Wave: 4_
  - _Owns: src/components/gates/Gate2Instance.tsx, src/components/gates/Gate3Instance.tsx, src/components/gates/Gate4Instance.tsx_
  - _Depends on: 4.2, 4.3_
  - _Requirements: 2.4, 2.9, 2.22, 2.30_

- [x] 4.8 Fix the gate page shell
  - Group I: R-31 (Endpoints/Request body headings h2, resolves M-11 skipped level), R-32
    (Gate 1 note and rate-limit line), R-33 (stepper label wrap — "likely", honor the
    Wave 2 verdict), R-34 (pager prefixes and end links). Add the `Difficulty: Hell` tag
    on each gate page (**A14 pending**). See review.md group I.
  - Apply M-09. Check: `eslint` + `tsc --noEmit` on the owned files.
  - _Wave: 4_
  - _Owns: src/components/gates/GateReference.tsx, src/components/gates/GateStepper.tsx, src/components/gates/GatePager.tsx, src/app/gates/[gate]/page.tsx_
  - _Depends on: 4.2, 4.3_
  - _Requirements: 2.4, 2.8, 2.20, 2.22, 2.24, 2.31, 2.34_

- [x] 4.9 Fix the flag form and dialog
  - Groups J and K: R-35 (remove the `onSuccess` auto-close so the dialog keeps showing
    results and the badge), R-36 (inline `headingLevel`, handle warning as a hint not an
    error, score line, status-labelled errors — relies on the `flag/error` status added
    in 4.1), R-37 (render `<Announcer />` as the dialog's last child — "likely", honor the
    Wave 2 verdict), R-38 (focus the first empty field, `aria-labelledby`,
    `aria-haspopup`, close on pathname change). See review.md groups J, K.
  - Apply M-09. Check: `eslint` + `tsc --noEmit` on the owned files.
  - _Wave: 4_
  - _Owns: src/components/flag/FlagForm.tsx, src/components/shell/FlagDialog.tsx_
  - _Depends on: 4.1, 4.3_
  - _Requirements: 2.15, 2.16, 2.31, 2.32, 3.4, 3.5_

- [x] 4.10 Fix the scoreboard view
  - Group D: R-09 (render the error block instead of a false empty state — resolves the
    1.18 defect), R-10 (intro copy built from `GATES`, full memory sentence — M-13), R-11
    (`scope="col"`, table name, `aria-busy`, "Refreshing…", "Loaded at" line). Also apply
    M-07 (td/p ≥14px). See review.md group D and measured.md M-07, M-13.
  - Apply M-09. Check: `eslint` + `tsc --noEmit` on the owned files.
  - _Wave: 4_
  - _Owns: src/components/scoreboard/ScoreboardView.tsx, src/components/scoreboard/StandingsTable.tsx_
  - _Depends on: 4.1, 4.2, 4.3_
  - _Requirements: 2.4, 2.18, 2.22, 2.23, 2.33, 3.11_

- [x] 4.11 Fix the console
  - Group E: R-12 (visible "Command" label with an `aria-describedby` hint, `$` glyph
    `aria-hidden` — M-16), R-13 (restore the focus-visible outline), R-14 (factual intro
    and metadata, drop "directive"/"shell"), R-15 (drop or run-once the scoreboard load),
    R-16 (`gates` column padding, "no TTL" for Gate 1, announce "Console cleared."). See
    review.md group E and measured.md M-16.
  - Apply M-09. Check: `eslint` + `tsc --noEmit` on the owned files; run
    `tests/unit/console.test.ts`.
  - _Wave: 4_
  - _Owns: src/components/console/ConsoleView.tsx, src/lib/console.ts, src/app/console/page.tsx_
  - _Depends on: 4.1, 4.2, 4.3_
  - _Requirements: 2.21, 2.23, 2.29, 2.30, 3.10_

- [x] 4.12 Fix the overview
  - Group Q: R-48 (show the 8,500 total from `GATES.reduce`, use `<ol>`, one link per
    card, heading "Gates", "No TTL", and the `GET /api/skill` note). Fix M-10 (h2 and h3
    the same size) across the overview components and `page.tsx`. Add the one
    `Difficulty: Hell` label in the gates intro (**A14 pending**). See review.md group Q
    and measured.md M-10.
  - Apply M-09. Check: `eslint` + `tsc --noEmit` on the owned files.
  - _Wave: 4_
  - _Owns: src/app/page.tsx, src/components/overview/ConnectionDetails.tsx, src/components/overview/GateProgression.tsx, src/components/overview/StartSteps.tsx_
  - _Depends on: 4.2, 4.3_
  - _Requirements: 2.4, 2.6, 2.8, 3.16_

---

### 5. Wave 5 — Fix checking and preservation checking

- [x] 5. Verify the fix against the exploration and preservation suites
  - **Property 1: Expected Behavior** - every exploration test now passes
  - **Property 2: Preservation** - the agent surface and visitor flows are unchanged
  - **Properties 3, 4, 5: Preservation** - console, handle, and payload behavior unchanged
  - **IMPORTANT**: Re-run the SAME tests from Waves 2 and 3 (tasks 2.x and 3.x). Do NOT
    write new tests and do NOT edit any test or frozen file. Fix causes only.
  - One serial task: `npm run build` once, then start `next start -p 3008`. Run the solver
    copy first (safety rule: copy to `%TEMP%`, change only `BASE` to
    `http://localhost:3008`, `PYTHONUTF8=1`), then `npm run test:preserve` (must pass),
    then `npm run test:explore` (every exploration test now passes), then the frozen-file
    diff (`git diff --exit-code c6d13ea -- src/app/api src/lib/challenges.ts src/lib/crypto.ts src/lib/ratelimit.ts public/skill.md test_agent_solver.py`).
  - Stop the server (stop the background handle; fallback `Get-NetTCPConnection` kill),
    then confirm port 3008 is free.
  - If a check fails, the Wave 3/4 owner of the cause fixes its source and this task
    re-runs. Never change a test or a frozen file to make it pass.
  - _Wave: 5_
  - _Owns: (no source files; runs the suites on port 3008)_
  - _Depends on: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 4.9, 4.10, 4.11, 4.12_
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9, 2.10, 2.11, 2.12, 2.13, 2.14, 2.15, 2.16, 2.17, 2.18, 2.19, 2.20, 2.21, 2.22, 2.23, 2.24, 2.25, 2.26, 2.27, 2.28, 2.29, 2.30, 2.31, 2.32, 2.33, 2.34, 2.35, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 3.10, 3.11, 3.12, 3.13, 3.14, 3.15, 3.16, 3.17, 3.18, 3.19_

---

### 6. Wave 6 — Final checkpoint

- [x] 6. Full validation checkpoint
  - Run the design's validation phase in order: `npm run lint:ui` (exit 0, X38/M-17),
    `npm run typecheck:tests`, `npm test` (unit and property), and `npm run build`
    (passes, 3.19).
  - Start the server on port 3008, run the solver copy (safety rule — copy to `%TEMP%`,
    change only `BASE` to `http://localhost:3008`, `PYTHONUTF8=1`), then
    `npm run test:preserve`, `npm run test:explore`, and the frozen-file diff.
  - Stop the server (background handle; fallback `Get-NetTCPConnection` kill) and confirm
    port 3008 is free.
  - Fix causes, never tests or frozen files. Ask the user if questions arise.
  - **Safety:** copy-only solver rule; frozen set byte-identical; no request to
    ctf.hakudigital.tech; no commits and no pushes.
  - _Wave: 6_
  - _Owns: (no source files; runs the full gate on port 3008)_
  - _Depends on: 5_
  - _Requirements: 2.35, 3.1, 3.2, 3.3, 3.19_

---

## Task Dependency Graph

Dependencies are declared per leaf with `_Depends on:_`. The orchestrator dispatches every
leaf whose dependencies are all complete, up to 5 at once. The waves fall out of the graph:

```json
{
  "waves": [
    { "wave": 1, "tasks": ["1"] },
    { "wave": 2, "tasks": ["2.1", "2.2", "2.3", "3.1", "3.2"] },
    { "wave": 3, "tasks": ["4.1", "4.2", "4.3", "4.4", "4.5"] },
    { "wave": 4, "tasks": ["4.6", "4.7", "4.8", "4.9", "4.10", "4.11", "4.12"] },
    { "wave": 5, "tasks": ["5"] },
    { "wave": 6, "tasks": ["6"] }
  ],
  "tasks": [
    { "id": "1", "dependsOn": [] },
    { "id": "2.1", "dependsOn": ["1"] },
    { "id": "2.2", "dependsOn": ["1"] },
    { "id": "2.3", "dependsOn": ["1"] },
    { "id": "3.1", "dependsOn": ["1"] },
    { "id": "3.2", "dependsOn": ["1"] },
    { "id": "4.1", "dependsOn": ["1"] },
    { "id": "4.2", "dependsOn": ["1"] },
    { "id": "4.3", "dependsOn": ["1"] },
    { "id": "4.4", "dependsOn": ["1"] },
    { "id": "4.5", "dependsOn": ["1"] },
    { "id": "4.6", "dependsOn": ["4.1", "4.2", "4.3"] },
    { "id": "4.7", "dependsOn": ["4.2", "4.3"] },
    { "id": "4.8", "dependsOn": ["4.2", "4.3"] },
    { "id": "4.9", "dependsOn": ["4.1", "4.3"] },
    { "id": "4.10", "dependsOn": ["4.1", "4.2", "4.3"] },
    { "id": "4.11", "dependsOn": ["4.1", "4.2", "4.3"] },
    { "id": "4.12", "dependsOn": ["4.2", "4.3"] },
    { "id": "5", "dependsOn": ["4.1", "4.2", "4.3", "4.4", "4.5", "4.6", "4.7", "4.8", "4.9", "4.10", "4.11", "4.12"] },
    { "id": "6", "dependsOn": ["5"] }
  ]
}
```

A text view of the same graph:

```
Wave 1:  1
            └─────────────┬─────────────┬─────────────┐
Wave 2:  2.1   2.2   2.3   3.1   3.2        (all depend on 1)
Wave 3:  4.1   4.2   4.3   4.4   4.5        (all depend on 1)
            │     │     │
            ├─────┴─────┤  (4.1 state, 4.2 lib, 4.3 ui primitives feed Wave 4)
Wave 4:  4.6  4.7  4.8  4.9  4.10  4.11  4.12
Wave 5:  5                                  (depends on 4.1–4.12)
Wave 6:  6                                  (depends on 5)
```

Per-leaf edges:

- **1** → (no deps)
- **2.1, 2.2, 2.3, 3.1, 3.2** → depend on **1**
- **4.1, 4.2, 4.3, 4.4, 4.5** → depend on **1**
- **4.6** → depends on **4.1, 4.2, 4.3**
- **4.7** → depends on **4.2, 4.3**
- **4.8** → depends on **4.2, 4.3**
- **4.9** → depends on **4.1, 4.3**
- **4.10** → depends on **4.1, 4.2, 4.3**
- **4.11** → depends on **4.1, 4.2, 4.3**
- **4.12** → depends on **4.2, 4.3**
- **5** → depends on **4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 4.9, 4.10, 4.11, 4.12**
- **6** → depends on **5**

No two leaves in the same wave share a file under `_Owns:_`, so a wave runs safely in
parallel. Wave 2 test tasks each start `next start` on their own port (3101, 3102, 3103,
3104) and reuse the Wave 1 build without rebuilding.

## Notes

- **Dependency mechanism used:** per-leaf italic annotation lines — `_Wave: N_`,
  `_Owns: <files>_`, and `_Depends on: <task ids>_` — backed by the `## Task Dependency
  Graph` section above. There is no built-in dependency field in the task format, so the
  orchestrator reads these annotations.
- **Leaf task count:** 20. Wave 1 = 1; Wave 2 = 5 (2.1, 2.2, 2.3, 3.1, 3.2); Wave 3 = 5
  (4.1–4.5); Wave 4 = 7 (4.6–4.12); Wave 5 = 1; Wave 6 = 1.
- **Coverage.** All 50 review findings (R-01 to R-50) are assigned to a fix task, and all
  19 measured gaps (M-01 to M-19) are covered. Two measured gaps are not standalone fix
  tasks because they are not source edits: **M-02** (the committed solver targets
  production) is handled by the solver-copy helper (task 1) and the agent-surface
  preservation test (3.1) — the file is frozen; **M-17** (`lint:ui` fails) is the
  aggregate of the per-file lint fixes (R-02, R-06, R-07, R-22, R-40, R-41, R-46, and the
  rest) and is verified green in Wave 6.
- **"Likely" findings decided by test.** R-33 (stepper label clipping), R-37 (dialog live
  region), R-41 (double speech), R-42 (busy focus), and R-43 (nav wrap) are marked
  "likely" in review.md. The Wave 2 browser tests decide each: if the assertion passes on
  HEAD, record it "not reproduced" in the matching `tests/fixtures/explore-failures/`
  file and the owning fix task drops that item.
- **Spec-editor note (from review.md).** 03-copy.md and bugfix.md 3.1/3.8/3.16 still carry
  some pre-HELL numbers; the findings and this plan take the HEAD c6d13ea routes as the
  contract. That reconciliation is for the bugfix.md/design.md editor, not for these
  tasks.
