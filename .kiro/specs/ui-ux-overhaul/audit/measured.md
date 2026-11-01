# Measured behavior of HEAD (c6d13ea)

Measured on 2026-11-01 against a production build (`npm run build`, then `npx next start -p 3008`), using curl/fetch and headless Chrome over CDP at 360×780 (mobile emulation) and 1280×900. Requirement numbers refer to `git show HEAD:.kiro/specs/ui-ux-overhaul/bugfix.md`. The 3.x clauses are judged against the HEAD API (HELL mode), so points are 1,000/2,000/2,500/3,000, Gate 2 returns 4 truncated outputs, and Gate 3 has 120 variables and 512 clauses. Scratch scripts, raw JSON, and screenshots are in `%TEMP%\agentgate-audit`.

## Summary

| Check | Result | Detail |
|---|---|---|
| build | Pass | Exit 0. One warning: Next.js ignored `C:\Users\ahmad\package-lock.json` (outside the repo) and suggests setting `turbopack.root` (build) or `outputFileTracingRoot` (start). |
| lint:ui | Fail | 24 errors, 0 warnings in 9 UI files (M-17). |
| tsc | Pass | `npx tsc --noEmit` exit 0, no errors. |
| enforcement search | Fail | 3 matches (M-18). |
| solver | Pass, with a caveat | The committed script targets production, not port 3008 (M-02). A temp copy pointed at `http://localhost:3008` recovered and got acceptance for all 4 flags, plus the badge. |
| HTTP checks | Pass | Every status, redirect, byte comparison, and metadata check passed. |
| browser checks | Fail | 15 gaps (M-01, M-03 to M-16, M-19). The most severe is M-01, a request loop on /scoreboard. |

## Gaps

**M-01. Scoreboard request loop**
- Requirements: 3.15 (A13) and 2.18.
- View: /scoreboard at 360 and 1280.
- Measured: opening /scoreboard and staying 10 s sent 1,963 `GET /api/scoreboard` requests (59 got 200, 1,904 got 429). That is about 196 requests per second, and the loop does not stop. Every other view sent 0 API requests in 10 s, except /console, which sent 1.
- Side effects: the rate limiter in the frozen ratelimit.ts keeps one counter per IP across all routes, so the loop uses up the gate budget too.
  - After visiting /scoreboard, "Request instance" on Gate 3 and Gate 4 returned 429 ("Rate limit exceeded. Retry in 37s." / "…9s.").
  - At 360, /scoreboard and /console announced "Failed to load scoreboard."
  - The refresh button showed a disabled "Loading…" on every capture.
- Likely cause: `src/components/state/AppStateProvider.tsx:254`. `loadScoreboard` is a `useCallback` that reads `state.scoreboard.status`, so its identity changes on every status change. `src/components/scoreboard/ScoreboardView.tsx:13-15` runs `useEffect(() => loadScoreboard(), [loadScoreboard])`, which then fires again each time.

**M-02. The committed solver runs against production**
- Requirement: 3.3.
- View: none (process check).
- Measured: `test_agent_solver.py:12` is `BASE = "https://ctf.hakudigital.tech"`. Commit c6d13ea changed it from `http://localhost:3008`. Lines 13-16 send a spoofed `cf-connecting-ip: 198.18.99.1`.
- Effect of following the run instruction: `python test_agent_solver.py` hit the live site. It registered the handle JABRIK on the production scoreboard, all 4 flags were accepted there, and the badge was `HAKU{AGENT_JABRIK_GATES_1234_VERIFIED_5c05d6d9fa16e068}`.
- To verify the local build, I ran a copy in %TEMP% with only BASE changed. See Passing.
- Likely cause: `test_agent_solver.py`.

**M-03. At 360px the nav overflows its bar and overlaps the page**
- Requirement: 2.34.
- View: all 8 views at 360.
- Measured: each label stays on one line and isn't clipped, but the list wraps. Overview, Gates, Scoreboard, and Docs sit at top 57. Console drops to a second row at top 97 and is 328px wide.
- The `ul` is 44px tall and the `nav` is 45px tall, so Console draws outside the bar, on top of the main content above the h1. The screenshot `shot-360-_.png` shows this.
- Document scrollWidth stays at 360.
- Likely cause: `src/components/shell/PrimaryNav.tsx`. It uses a fixed `h-11` together with `flex-wrap sm:flex-nowrap`, and each item has `flex-1`.

**M-04. Gate 2 panel omits the modulus**
- Requirement: 2.9.
- View: /gates/2 at 1280.
- Measured: the response includes `modulus: "18446744073709551616 (2^64)"`, but the panel shows only "Multiplier (A): 6364136223846793005" and "Increment (C): 1442695040888963407".
- The increment isn't in the response. It is hardcoded in the component, and the value does match `LCG_C` in challenges.ts:130.
- Likely cause: `src/components/gates/Gate2Instance.tsx:51`.

**M-05. Gate 3 hint gives the old variable count**
- Requirement: 2.22.
- View: /gates/3 at 1280, with an instance loaded.
- Measured: the assignment description reads "Either 60 booleans in variable order…", while the instance shows 120 variables (response `variablesCount: 120`).
- Likely cause: `src/components/gates/Gate3Instance.tsx:60`.

**M-06. All-caps headings in the instance panels**
- Requirement: 2.4.
- View: /gates/2, /gates/3, and /gates/4 at 1280, after the instance loads. At page load, nothing is uppercase outside `th` and method badges.
- Measured: these h4 elements compute `text-transform: uppercase`:
  - Gate 2: "Truncated Sequence (4 outputs)" and "Next three truncated outputs"
  - Gate 3: "Clause preview"
  - Gate 4: "Bytecode (151 bytes, hex)" and "Opcode table"
- Likely cause: `Gate2Instance.tsx`, `Gate3Instance.tsx`, and `Gate4Instance.tsx` (the `uppercase tracking-label` classes on the h4s).

**M-07. Body text below 14px**
- Requirement: 2.4 (design check X06: `p`, `li`, `label`, and `td` must be at least 14px).
- View: 1280.
- Measured, at 12px:
  - /gates/1: 2 `p` ("Gate 1 has no instance and no TTL…", "Sent as {"prompt": "..."} to POST /api/gate1/chat.") and 1 `td` ("string")
  - /gates/2: 1 `p` ("Instances expire after 15 s, which is sized for an…") and 2 `td`
  - /scoreboard: 4 `p` (the memory disclosure, "Each flag counts once…", the handle hint, the flag hint) and 1 `td` ("Complete")
- Likely cause: `GateReference.tsx`, `ui/Field.tsx` (field descriptions), `ScoreboardView.tsx`, and `StandingsTable.tsx`.

**M-08. Text below 12px on /docs**
- Requirement: 2.4.
- View: /docs at 360 and 1280.
- Measured: the smallest font size is 11.2px, on 9 subscript and superscript math nodes ("n", "+", "1", "6", "4", …).
- Likely cause: `src/components/docs/SkillDocument.tsx:12,14` (`text-[0.8em]`).

**M-09. Monospace outside code and data containers**
- Requirement: 2.4 (design check X06: mono only inside `code`, `pre`, `kbd`, `samp`, or `[data-mono]`).
- View: all views at 360 and 1280.
- Measured share of visible characters in mono outside `code`, `pre`, and `[data-mono]`:

  | View | 1280 | 360 |
  |---|---|---|
  | / | 18.2% | 18.3% |
  | /gates/1 | 12.2% | 13.2% |
  | /gates/2 | 14.8% | 16.6% |
  | /gates/3 | 16.0% | 17.7% |
  | /gates/4 | 15.0% | 16.5% |
  | /scoreboard | 7.7% | 7.4% |
  | /docs | 3.5% | 3.6% |
  | /console | 39.3% | 40.4% |

- Interface labels set in mono:
  - "CTF" next to the brand, on every view
  - the gate tags "Prompt filter & PoW", "Truncated LCG", "120-Var 3-SAT", and "Chained Non-linear VM"
  - "No time limit", "Instance TTL: 15 s", "1,000 pts", and "points"
  - the stepper labels "Gate 1" to "Gate 4"
  - the footer's "Base URL: …" and its "skill.md" link
  - the console's "$>" label
- Data set in mono without the `[data-mono]` or `code` marker: endpoint paths, the URLs on Overview, payload `td` cells, scoreboard rank/handle/score, docs math spans, and console output.
- Likely cause: `shell/SiteHeader.tsx`, `overview/GateProgression.tsx`, `overview/ConnectionDetails.tsx`, `gates/GateReference.tsx`, `gates/GateStepper.tsx`, `shell/SiteFooter.tsx`, `scoreboard/StandingsTable.tsx`, `docs/SkillDocument.tsx`, and `console/ConsoleView.tsx`.

**M-10. h2 and h3 are the same size on Overview**
- Requirement: 2.4 (X06 needs h1 > h2 > h3 > body).
- View: / at 1280.
- Measured: h1 is 48px. h2 ("Connect an agent", …) and h3 (the gate titles) are both 18px.
- Likely cause: the overview components (`overview/ConnectionDetails.tsx`, `StartSteps.tsx`, `GateProgression.tsx`) and `src/app/page.tsx`.

**M-11. Skipped heading level on the gate pages**
- Requirement: 2.31.
- View: /gates/1 to /gates/4 at 360 and 1280.
- Measured: the h1 (gate title) is followed by h3 "Endpoints", h3 "Request Payload", and h3 "Try it", with no h2 in between.
- The h2 "Submit a flag" that comes before the h1 on every view sits inside a closed `<dialog>` (display:none), so assistive technology doesn't see it. It isn't counted here.
- Likely cause: `gates/GateReference.tsx`, plus `gates/Gate1TryIt.tsx` and `gates/InstanceTryIt.tsx` (`h3#tryit-heading`).

**M-12. Docs show the two decorative emoji**
- Requirement: 2.19 (A8).
- View: /docs at 360 and 1280.
- Measured: "🎯 Protocol Overview" and "🏆 Submitting Flags to Scoreboard" render visibly, with no `aria-hidden`.
- Likely cause: `src/components/docs/SkillDocument.tsx` and `src/lib/markdown.ts`.

**M-13. "Leaderboard" in scoreboard copy**
- Requirement: 2.23.
- View: /scoreboard at all sizes.
- Measured: the subtitle reads "Verified autonomous solver leaderboard and Proof-of-Pwn records." The meta description, by contrast, says "standings".
- Likely cause: `src/components/scoreboard/ScoreboardView.tsx`.

**M-14. Title separator conflicts with the copy spec**
- Requirement: 2.24.
- View: all view titles.
- Measured: the titles use `%s · AGENTGATE CTF`, for example "Gate 1: Neural Sentry (Hell) · AGENTGATE CTF".
- The two design parts disagree. `design-parts/03-copy.md:400` specifies an en dash (`%s – AGENTGATE CTF`), and `02-structure.md:16` specifies `·`. HEAD matches 02.
- Likely cause: `src/app/layout.tsx` (title template), or the design docs, depending on which one is meant.

**M-15. No `data-variant` on buttons**
- Requirement: 2.3 (design test hook X04).
- View: all views at 1280.
- Measured: no visible button has `data-variant` (0 of 5 on /, 0 of 4 on /gates/1, 0 of 5 on /gates/2, 0 of 4 on /scoreboard, 0 of 3 on /docs, 0 of 2 on /console).
- Likely cause: `src/components/ui/Button.tsx`.

**M-16. Console input label doesn't name the field**
- Requirement: 2.30.
- View: /console at 360 and 1280.
- Measured: the input's only associated label is "$>", so its accessible name is "$>". There is no `aria-label`.
- Likely cause: `src/components/console/ConsoleView.tsx`.

**M-17. lint:ui fails**
- Requirement: 2.35.
- Measured: 24 errors and 0 warnings, exit 1. By file:
  - `src/components/gates/Gate1TryIt.tsx`: 1 (122 no-unescaped-entities)
  - `src/components/gates/InstanceTryIt.tsx`: 4 (94, 100, 106 no-explicit-any; 187 no-unescaped-entities)
  - `src/components/state/AppStateProvider.tsx`: 5 (31, 45, 118, 200 no-explicit-any; 74 react-hooks/purity, `useState(Date.now())`)
  - `src/components/ui/CopyButton.tsx`: 1 (27 react-hooks/set-state-in-effect)
  - `src/components/ui/StatusMessage.tsx`: 1 (7 no-explicit-any)
  - `src/lib/api.ts`: 7 (121, 130, 175, 190, 206, 214, 236 no-explicit-any)
  - `src/lib/app-state.ts`: 3 (186, 192, 201 no-explicit-any)
  - `src/lib/markdown.ts`: 1 (264 prefer-const)
  - `src/lib/validation.ts`: 1 (28 no-explicit-any)

**M-18. Enforcement search has 3 matches**
- Requirements: 2.2 and 2.4.
- Measured, using the `rg` command from 01-visual-system.md:
  - `src/app/layout.tsx:39` `themeColor: "#111315"`
  - `src/components/docs/SkillDocument.tsx:12` `text-[0.8em]` (sub)
  - `src/components/docs/SkillDocument.tsx:14` `text-[0.8em]` (sup)

**M-19. A docs link opens a new tab without saying so**
- Requirement: 2.31.
- View: /docs at 360 and 1280.
- Measured: the link `https://ctf.hakudigital.tech` has `target=_blank` and `rel="noopener noreferrer"`, but neither its text nor an `aria-label` says it opens a new tab. The footer's Haku Digital link does say "(opens in a new tab)".
- Likely cause: `src/components/docs/SkillDocument.tsx` (link rendering).

## Passing

- **Build.** `/docs` is static (○). `/gates/[gate]` is SSG (●) with `/gates/1` to `/gates/4`. `/`, `/gates`, `/scoreboard`, and `/console` are static. The API routes are dynamic (ƒ).
- **HTTP redirects and errors.** `/gates` returns 307 with `Location: /gates/1`. `/gates/0`, `/gates/5`, and `/gates/x` return 404.
- **HTTP views.** `/`, `/gates/1` to `/gates/4`, `/scoreboard`, `/docs`, and `/console` return 200.
- **skill.md.** `/skill.md` and `/api/skill` are byte-identical to public/skill.md (3,928 bytes). `/api/skill` sends `text/markdown; charset=utf-8`.
- **Metadata.** Each view has its own `<title>`: "AGENTGATE CTF by Haku Digital", "Gate N: … (Hell) · AGENTGATE CTF", "Scoreboard · …", "Docs · …", and "Console · …". Each view has a factual meta description. The favicon is `/icon.svg`, `lang` is `en`, and the viewport is `width=device-width, initial-scale=1`, with no maximum-scale.
- **Solver (local copy, BASE = http://localhost:3008).**
  - Gate 1 (PoW nonce 47208): accepted, +1000
  - Gate 2 (Z3, 64-bit seed): accepted, +2000
  - Gate 3 (sat): accepted, +2500
  - Gate 4 (key recovered): accepted, +3000
  - Proof-of-Pwn badge: `HAKU{AGENT_JABRIK_GATES_1234_VERIFIED_bfd8ab8c030f8c4b}`
- **Page width.** Document scrollWidth equals the viewport width on all 16 view and viewport combinations.
- **Nav labels.** Every nav label sits on one line with no clipping.
- **Landmarks.** Every view has 1 header, 1 main, and 1 footer, and header, nav, main, and footer are siblings under `body`. There is 1 nav on most views and 3 on gate pages (primary plus two gate navs).
- **Headings.** Every view has exactly one h1. On /docs the levels run h1 → h2 → h3 → h4 with no skip.
- **aria-current.** The nav marks the exact match with `aria-current="page"`. On /gates/2 to /gates/4 the Gates link carries `aria-current="true"`.
- **Contrast.** No visible text node falls below 4.5:1 (or 3:1 for large text) on any view at either size. The only low reading is the disabled "Loading…" button at 2.62:1, which is exempt.
- **Labels.** Every input has an associated `<label>`.
- **Live regions.** Every view has a live region at load (`div.sr-only`, `role=status`, `aria-live=polite`). /console also has `role=log`.
- **Sound.** The toggle has `aria-pressed="false"` at load. Five nav clicks created 0 AudioContexts and 0 oscillators. Turning sound on created 1 context and 1 oscillator (the toggle's own click). A nav click with sound on added none.
- **Gate 2 instance.** The panel shows 4 outputs, X1 to X4, matching the response's 4. It has 3 inputs labeled X5, X6, and X7.
- **Gate 3 instance.** The panel shows "Variables: 120", "Clauses: 512", "First 5 of 512 clauses", and "... 507 more clauses".
- **Gate 4 instance.** The bytecode is "151 bytes", derived from the 302 hex characters. The opcode table has 9 rows: 0x01 to 0x07, 0x08 DUP, and 0xFF.
- **Countdown.** It reads "Expires in N s", switches to "Expiring, 5 s left" at 5 s, and shows "Expired" at the TTL (15, 10, and 20 s). After expiry, Submit and the inputs are disabled and "Request new instance" stays enabled.
- **Instance announcements.** Each gate announced "Gate N instance ready, expires in T seconds." about 0.1 s after the response, and "Gate N instance expired. Request a new instance to try again." once, at TTL + 0.3 s.
- **Rate-limit state (2.11).** The panel shows a "Rate limited" label with the server message and retry time. It shows no instance, no countdown, and no Submit, and the message is announced.
- **Busy state (2.12).** With 1.5 s of added latency, the request button reads "Requesting…" and is disabled.
- **Gate 1.** The page explains proof-of-work: "satisfy a SHA-256 Proof-of-Work constraint where SHA-256(prompt) starts with '0000'", and the payload row describes the nonce.
- **Gate 1 response.** A 32-character prompt produced the label "Blocked by filter", the text "No flag was returned.", and the verbatim message "[SHIELD TRIPWIRE] Length Constraint Violation…". The live region announced "Prompt blocked by filter."
- **Console `help`.** It lists help, gates, `solve <1-4>`, leaderboard, and clear.
- **Console `gates`.** It lists 4 rows with name, points (1,000/2,000/2,500/3,000), endpoint, and TTL (15/10/20 s).
- **Console `solve 2`.** It prints the Z3 BitVec truncated-LCG hint.
- **Console `leaderboard`.** It printed "No entries yet." That was correct at the time: the console's single load returned an empty list, because the first solver run had gone to production.
- **Docs rendering.** No literal Markdown or LaTeX appears outside code. There is no inner scroll box. `pre` blocks use `overflow-x: auto`. There is a Copy control.
- **Scoreboard content.** It shows the memory disclosure and lists rows with rank, handle, score, "G1 solved … G4 solved", and "Complete".
- **Cleanup.** The server is stopped and nothing listens on 3008. No `__pycache__` was created. `git status` shows `?? .kiro/specs/ui-ux-overhaul/audit/` (this file and the other agent's review.md) and ` M` on bugfix.md and design.md, which come from the other editing agent.
