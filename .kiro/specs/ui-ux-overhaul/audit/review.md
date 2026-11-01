# UI/UX overhaul and HELL-mode sync (afe2537..c6d13ea)

**Verdict**: NEEDS_CHANGES

The range replaces the single-page Arena with routed views (Overview, Gates 1 to 4, Scoreboard, Docs, Console), a token-based visual system, a reducer-backed AppStateProvider, a typed fetch layer in src/lib/api.ts, an in-house skill.md renderer, and one shared announcer. The HELL commit then changed the API on purpose and updated gates.ts and Gate2Instance to match. The problems sit in four places: the scoreboard's request lifecycle, HELL facts that didn't reach the try-it panels, accessibility wiring around the dialog and live regions, and copy that came back with the HELL strings.

Watch for: opening /scoreboard starts an endless refetch loop that burns the shared per-IP rate limit and locks every gate endpoint for that IP (confirmed). The scoreboard never renders its error state and shows "No entries yet." on failure (confirmed). `lint:ui` fails with 24 errors in 9 files (confirmed). Gate 3's hint still says 60 booleans (confirmed). Gate 1's try-it says nothing about the 50 to 500 character rule or the SHA-256 proof of work (confirmed). The console input still has no real label and no focus ring (confirmed). The submit-flag dialog has no live region of its own, so results inside it are likely silent (likely).

## High-level view

Opening /scoreboard starts a request loop. `loadScoreboard` changes identity on every status change, and the views call it from effects keyed on that identity. ratelimit.ts shares one counter per IP across routes, so the loop also locks the gate endpoints for that IP, including any agent behind it. The fix belongs in the provider.

Where the UI reads gates.ts or the response, the HELL numbers are right. The gaps are hardcoded text. Gate 3's assignment hint says 60. Gate 2 dropped the modulus and its number-format hint. Gate 1's try-it panel and TTL note invite hand-typed prompts without saying the server checks length and a SHA-256 prefix. The scoreboard intro is still the pre-overhaul string, and no view shows the 8,500-point total.

The state bugs are in presentation, not in api.ts's classification, so api.ts only needs its lint and two fallback strings fixed. The flag form labels every server error "Rate limited". The try-it panels omit the HTTP status. Auto-fill leaves the previous flag result and field error in place under a new flag.

The single announcer exists, but StatusMessage also puts `role="status"` on every result box, so result areas become nested live regions. The modal dialog has no region of its own. FlagForm's `onSuccess` reads a stale status, so the dialog closes on the wrong submission. Every text copy button's accessible name is just "Copy".

The HELL strings in gates.ts bring back phrasing that 2.21 removed ("adversarial guardrail", "high-order epistemic", "Search space exceeds 1.3e36"). The Gate 2 description no longer says that A and C are given. "Hell" is baked into every gate `name`, so it repeats in h1s, titles, the stepper, the pager, overview cards, and console columns. The longer names also likely clip the gate stepper. A single difficulty label would carry the user's naming without those side effects.

On the visual side, the remaining issues are 12px uppercase h4 headings in the instance views, h1-to-h3 skips on gate pages, two em-relative sizes that land under 12px, the console's removed focus ring, and a primary nav row that likely wraps at 360px. The docs renderer shows the two decorative emoji that A8 says to hide, and it prints `\gg` and `\times` from the new skill.md literally. ESLint on the UI files reports 19 `no-explicit-any`, 2 unescaped entities, one `react-hooks/purity`, one `set-state-in-effect`, and one `prefer-const`.

<details>
<summary>Issues (50)</summary>

1. **R-01 Scoreboard refetch loop** (blocker): make `loadScoreboard` stable with an in-flight ref so /scoreboard and /console stop hammering the shared per-IP limit.
2. **R-02 Provider lint** (major): remove four `any` and the `Date.now()` purity error in AppStateProvider.
3. **R-03 Announcement wording** (minor): add gate numbers and server messages, and stop announcing every flag server error as a rate limit.
4. **R-04 Unused retryAt ticker** (minor): drop `retryAt` from the ticker, or render the wait from it.
5. **R-05 Stale flag state on auto-fill** (minor): clear the flag field error and the old result when a gate fills the flag.
6. **R-06 Reducer lint and dead action** (major): type the three `any` payloads, delete `console/set`, and import the duplicate types from gates.ts.
7. **R-07 api.ts and validation.ts lint** (major): use `unknown` with an `isRecord` guard instead of `any`.
8. **R-08 Fallback strings** (minor): use 03's non-JSON and no-message strings, and use or delete `HANDLE_MAX_LENGTH`.
9. **R-09 Scoreboard error state missing** (major): render the 03 error block and show "No entries yet." only after a successful load.
10. **R-10 Scoreboard intro** (major): replace the old "Verified … leaderboard" string with HELL points and the 8,500 total derived from `GATES`, plus the full A9 sentence.
11. **R-11 Standings table semantics** (minor): add `scope`, a table name, `aria-busy`, "Refreshing…", and "Loaded at".
12. **R-12 Console label** (major): add a visible "Command" label and hint, and hide the `$` glyph.
13. **R-13 Console focus ring** (major): remove `focus-visible:outline-none` or add a replacement outline.
14. **R-14 "Directives" in console copy** (major): replace the intro and the metadata description.
15. **R-15 Console auto-load** (minor): drop the scoreboard load on console open, or make it run once.
16. **R-16 Console gates columns** (minor): pad to the longest name, print "no TTL", and announce clear.
17. **R-17 HELL jargon in gates.ts** (major): replace the summaries, descriptions, and topic tags with the plain strings given.
18. **R-18 Gate 2 givens** (major): state that A and the modulus come in the response and C comes from skill.md.
19. **R-19 "(Hell)" in every name** (major): restore the gate names and show "Difficulty: Hell" once per gate page and once on the Overview.
20. **R-20 Dead gates.ts exports** (minor): delete or use `SCOREBOARD_ENDPOINTS` and `SKILL_ENDPOINT`.
21. **R-21 Gate 1 PoW not explained** (major): add the length and SHA-256 hint plus a local length and hash readout, and relabel blocked results.
22. **R-22 Try-it lint** (major): remove the `as any` casts and the unescaped apostrophes.
23. **R-23 Try it heading level** (major): change h3 to h2.
24. **R-24 Expiry announced more than once** (minor): track the announcement per instance in the reducer, and skip it after acceptance.
25. **R-25 Error labels and retry** (minor): show the HTTP status, add "Try again", and add the rejected guidance.
26. **R-26 Focus lost on new instance** (minor): keep the panel mounted while requesting, or move focus to the new button.
27. **R-27 Two primaries in Try it** (minor): demote the gate action to secondary while a flag result shows.
28. **R-28 Gate 3 hint says 60** (major): derive the boolean count from `variablesCount`.
29. **R-29 Gate 2 fields** (major): show the response's multiplier and modulus, label C's source, and add a fieldset with a decimal-range hint.
30. **R-30 Instance headings** (major): replace the 12px uppercase h4s with sentence-case h3s, and remove the 11.25px inline code.
31. **R-31 Gate reference headings** (major): change "Endpoints" and "Request body" to h2.
32. **R-32 Gate 1 TTL note** (minor): stop promising a browser try, and add "No TTL" and the rate-limit line.
33. **R-33 Stepper labels clipped** (major, likely): remove `truncate` and verify at 360px and 640px.
34. **R-34 Pager labels** (minor): add the "Previous:" and "Next:" prefixes and the two end links.
35. **R-35 Dialog closes on stale status** (major): remove `onSuccess` so the dialog keeps showing results and the badge.
36. **R-36 Flag form details** (minor): fix the heading level, the warning-versus-error styling, the score line, the badge note, and the error labels by status.
37. **R-37 No live region in dialog** (major, likely): render an Announcer inside the dialog.
38. **R-38 Dialog focus and name** (minor): focus the first empty field, add `aria-labelledby` and `aria-haspopup`, and close on route change.
39. **R-39 Copy buttons all named "Copy"** (major): add sr-only label text.
40. **R-40 CopyButton lint and wording** (major): use `useSyncExternalStore` for hydration, and use 03's announcements.
41. **R-41 Result boxes are live regions** (major, likely): remove `role="status"` from StatusMessage and type `badgeIcon`.
42. **R-42 Busy buttons drop focus** (minor): use `aria-disabled` while busy.
43. **R-43 Nav wraps at 360px** (major, likely): tighten mobile padding, drop `flex-wrap`, and verify in the browser.
44. **R-44 Sound toggle label in name** (minor): name the button "Sound" and hide the state text from assistive technology.
45. **R-45 Emoji in docs headings** (major): strip leading pictographs from rendered headings.
46. **R-46 Literal TeX in docs** (major): map `\gg` and `\times`, fall back to code for unknown commands, and fix `prefer-const`.
47. **R-47 Docs details** (minor): replace `text-[0.8em]`, add new-tab notices, use 03's intro, and add a real error state.
48. **R-48 Overview gates block** (minor): add the derived 8,500 total, use `<ol>`, keep one link per card, and replace the "Direct endpoint" row.
49. **R-49 Metadata and 404 copy** (minor): remove "proving ground" and "Verified", and add Open Graph, the skip-link text, and the 404 links.
50. **R-50 Dead helpers in format.ts** (minor): delete `formatClause` and the no-op replacer.

</details>

## Findings by file

Severity means: blocker breaks behavior for visitors or agents; major violates a 2.x or 3.x clause on a main path or fails the 2.35 lint gate; minor is a copy, design-doc, or edge-case deviation. The groups don't share files, so each group can become one task. Cross-group dependencies are noted inline.

### A. src/components/state/AppStateProvider.tsx

**R-01 · blocker · AppStateProvider.tsx:254-274** (confirmed)
What happens: `loadScoreboard` is memoized on `[state.scoreboard.status, announce]`. ScoreboardView.tsx:13-15 calls it from `useEffect(..., [loadScoreboard])`. Each status change (idle → loading → loaded or server-error) creates a new callback, the effect re-runs, and a non-loading status starts another GET. /scoreboard issues back-to-back GET /api/scoreboard for as long as it is open. ConsoleView.tsx:10-14 loops the same way while loads keep failing. ratelimit.ts shares one count per IP across routes. After about 40 requests every gate endpoint returns 429 for that IP, including an agent run from the same machine or NAT, and the loop refills the count after each window resets.
Violates: 3.15, A13.
Fix: make the callback stable. Guard with `const inFlight = useRef(false)` instead of reading status from the closure, and set the deps to `[announce]`. The view effects then run once per mount with no change. In the browser pass, confirm one GET on opening /scoreboard and one per Refresh click.

**R-02 · major · AppStateProvider.tsx:31, :45, :74, :118, :200** (confirmed by ESLint)
What happens: four `any` (`toServerError(res: any)`, `setField(..., value: any)` twice, `let body: any`), and `useState<number>(Date.now())` fails `react-hooks/purity`.
Violates: 2.35.
Fix: type the parameter as `ApiResult<unknown>`, type `value` as `string`, and build `body` as `SubmitBodyByGate[G]` in each gate branch. Use `useState(0)` for `now` and call `setNow(Date.now())` in `requestInstance` next to the `requestSuccess` dispatch. No countdown renders before an instance exists.

**R-03 · minor · AppStateProvider.tsx:176, :231, :234, :272, :324** (confirmed)
What happens: the submit announcements omit the gate number and use "Accepted! …". The scoreboard error announcement drops the server message. Every flag server-error, including a 500 or a non-JSON body, is announced as "Flag submission rate limited."
Violates: 2.32 (message table in 04), A12.
Fix: use "Gate {n}: Accepted. {message}" and "Gate {n}: Rejected. {message}", and "Couldn't load the scoreboard. {message}". Choose the flag announcement from `res.status === 429`.

**R-04 · minor · AppStateProvider.tsx:91-96** (confirmed)
What happens: `hasRetry` keeps the 250 ms ticker running for up to 60 s after any 429. No component reads `retryAt`, so the ticker re-renders the provider for nothing.
Violates: dead state (2.35 intent).
Fix: remove `retryAt` from `ServerError` and `FlagSlot` and from the ticker, or render "Try again in {n} s" from it. 2.11 is already met because the server message carries the wait.

### B. src/lib/app-state.ts

**R-05 · minor · app-state.ts:302, :395** (confirmed)
What happens: auto-fill (`gate1/success`, `instance/submitSuccess`) writes `flag.flag` but keeps `fieldErrors.flag` and the previous `status` and `message`. The inline form under a new Gate 2 flag can show "Enter a flag." beneath a filled field, or Gate 1's earlier "Accepted" result.
Violates: 3.5 (filled flag should be ready to submit), 2.15.
Fix: when auto-filling, also set `fieldErrors.flag: null` and reset `status`, `message`, `recordedHandle`, and `proofBadge` to their idle values.

**R-06 · major · app-state.ts:186, :192, :201** (confirmed by ESLint)
What happens: `value: any`, `data: any` in `instance/requestSuccess`, and `data: any` in `flag/success`. The `console/set` action (:208, :561) is never dispatched. `GateNumber` and `InstanceGate` are declared both here and in gates.ts.
Violates: 2.35.
Fix: split `field/set` into typed actions or a typed path union. Type the payloads as `ChallengeByGate[InstanceGate]` and `FlagAccepted`. Delete `console/set` and import the two types from gates.ts.

### C. src/lib/api.ts, src/lib/validation.ts

**R-07 · major · api.ts:121, :130, :175, :190, :206, :214, :236; validation.ts:28** (confirmed by ESLint)
What happens: the guard signature, the parsed body, and each guard use `any`, and `AssignmentParse` returns `value: any`.
Violates: 2.35.
Fix: make guards `(b: unknown) => b is T` and narrow with a small `isRecord(b): b is Record<string, unknown>` helper. Type `body` as `unknown` and the assignment as `JsonValue`.

**R-08 · minor · api.ts:137, :152** (confirmed)
What happens: a non-JSON body and a body with neither `message` nor `error` both show "The server sent an unexpected response (HTTP n)." 03 specifies "The server's response wasn't JSON." and "The response had no message." `HANDLE_MAX_LENGTH` in validation.ts:1 is exported but unused.
Violates: 03 shared states.
Fix: use the two 03 strings, and use `HANDLE_MAX_LENGTH` in `cleanHandle` or delete it.

### D. src/components/scoreboard/ScoreboardView.tsx, StandingsTable.tsx

**R-09 · major · ScoreboardView.tsx:49-55, StandingsTable.tsx:20-26** (confirmed)
What happens: `scoreboard.error` and the error statuses are never rendered. On a 429 or a network failure with no earlier rows, the table shows "No entries yet. Submit a flag to add your agent handle.", which is a false empty state. With earlier rows, it keeps them silently. Defect 1.18 persists.
Violates: 2.18.
Fix: render 03's error block. That is the heading "Couldn't load the scoreboard", then "Rate limited (HTTP 429)" or "Error (HTTP {status})" plus the server message, or the network message, and "The rows below are from the last successful load at {HH:MM:SS}." when rows exist. Show the empty state only when `status === "loaded"`.

**R-10 · major · ScoreboardView.tsx:25, :28** (confirmed)
What happens: the intro is the pre-overhaul string "Verified autonomous solver leaderboard and Proof-of-Pwn records.", which 03 lists for replacement. It uses "leaderboard" and the unmeasured "Verified", and it gives no points. The memory note omits A9's point that each server instance keeps its own list.
Violates: 2.21, 2.22, 2.23, A9.
Fix: "Agent handles ranked by score. Gates are worth 1,000, 2,000, 2,500, and 3,000 points, for 8,500 in total." Build the numbers from `GATES`, not from 03's 4,250. Use 03's full memory sentence.

**R-11 · minor · StandingsTable.tsx:30-37; ScoreboardView.tsx:40** (confirmed)
What happens: header cells have no `scope="col"`, the table has no name, the container has no `aria-busy` during refresh, the Refresh busy label is "Loading…" instead of "Refreshing…", and there is no "Loaded at" line.
Violates: 04 Status in Text, 03 Scoreboard copy.
Fix: add `scope="col"`, `aria-labelledby` pointing at the Standings h2, and `aria-busy={busy}`. Use "Refreshing…" and render `Loaded at {formatTime(loadedAt)}`.

### E. src/components/console/ConsoleView.tsx, src/lib/console.ts, src/app/console/page.tsx

**R-12 · major · ConsoleView.tsx:63-72** (confirmed)
What happens: the input's label is the glyph "$>", so a screen reader announces "dollar greater-than". The command hint lives only in the placeholder. Defect 1.30 persists for the console.
Violates: 2.30.
Fix: add a visible `<label>` "Command" with an `aria-describedby` hint ("Commands: help, gates, solve 1 to 4, leaderboard, clear. Letter case doesn't matter."), and make the `$` glyph `aria-hidden`.

**R-13 · major · ConsoleView.tsx:72** (confirmed)
What happens: `focus-visible:outline-none` overrides the global `:focus-visible` outline and nothing replaces it. Keyboard focus on the console input is invisible, so defect 1.29 persists.
Violates: 2.29.
Fix: remove `focus-visible:outline-none`, or put `focus-within:outline` with the focus token on the form row.

**R-14 · major · ConsoleView.tsx:30; console/page.tsx:6** (confirmed)
What happens: the intro reads "Interactive command interface for checking gates, standings, and directives." The metadata says "Interactive shell for inspecting … directives." "Directive" is one of the 1.21 phrases, and "shell" is a term 03 retires.
Violates: 2.21, 2.23.
Fix: use 03's intro and an equivalent factual description.

**R-15 · minor · ConsoleView.tsx:10-14** (confirmed)
What happens: the console loads the scoreboard on open. 03 says console commands "send no requests", and the console's own "Standings haven't loaded. Open the scoreboard to load them." assumes it doesn't. Until R-01 is fixed, this effect loops while loads fail.
Violates: 03 Console copy. 3.15 allows the load either way, so this is a design choice to settle.
Fix: drop the effect and add 03's intro sentence. If the load stays, it must run once per mount.

**R-16 · minor · console.ts:50, :54** (confirmed)
What happens: `gates` pads names to 18 characters, and "Entropy Fracture (Hell)" is 23, so the columns misalign. Gate 1 prints no TTL column. `clear` announces nothing.
Violates: 3.10 (readability of equivalent output), 03 Console copy.
Fix: pad to the longest name, print "no TTL" for Gate 1, and announce "Console cleared."

### F. src/lib/gates.ts

**R-17 · major · gates.ts:37, :40, :42, :62, :65, :67, :97, :100, :102, :132, :135, :137** (confirmed)
What happens: the HELL strings reintroduce phrasing that 2.21 removed and that 03 forbids. Gate 1 has "adversarial guardrail endpoint", "strictly filtered", "high-order epistemic", and "35+ blacklisted tokens" ("token" is the session-token term). Gate 2 has "Formulate a Z3 BitVec SMT model or Babai lattice reduction". Gate 3 has "peak algorithmic phase transition", "Search space exceeds 1.3e36 configurations", and "must be executed". Gate 4 has "featuring". The topic tags use title case ("120-Var 3-SAT", "Chained Non-linear VM").
Violates: 2.21, 2.23, 03 voice rules 1 to 3 and 5.
Fix: keep the HELL facts, drop the inflation. Suggested strings:
- Gate 1 topic "Prompt filter and proof of work". Summary: "Get a filtered chat endpoint to return its flag with a 50 to 500 character prompt whose SHA-256 hash starts with 0000." Description: "Send a prompt to a chat endpoint behind a keyword filter and get a reply that contains the flag. The server trims the prompt and then checks four things: it is 50 to 500 characters, it avoids more than 35 blocked words (such as flag, secret, key, reveal, academic, audit, base64, and hex, plus leetspeak spellings of some), it uses philosophical or epistemic framing, and its SHA-256 hash starts with 0000."
- Gate 2 topic "Truncated LCG". Summary: "Predict the next three outputs of a 64-bit LCG when only the top 48 bits of each output are shown." Description: see R-18.
- Gate 3 topic "3-SAT". Summary: "Satisfy a 3-SAT formula with 120 variables and 512 clauses." Description: "Each instance is a satisfiable 3-SAT formula in DIMACS form, with 120 variables and 512 clauses of three literals each, a ratio of about 4.27 clauses per variable. Submit an assignment that satisfies every clause before the instance expires."
- Gate 4 topic "Stack VM". Summary: "Find the 8-byte key that a stack VM program checks." Description: "Each instance is a bytecode program for a stack VM with 9 opcodes, plus the opcode table. The program mixes each key byte into a running state over 8 chained rounds, then checks the sum and the XOR of all 8 bytes. It reaches HALT_SUCCESS (0xFF) only if every check passes. Submit the key as 16 hex characters before the instance expires."
- Solving methods (Z3, lattice reduction, symbolic execution) belong in `consoleHint`, where they already are.

**R-18 · major · gates.ts:67** (confirmed)
What happens: the Gate 2 description doesn't say that A and C are given. The HEAD response includes `multiplier` and `modulus`, and skill.md gives C.
Violates: 2.22.
Fix: "Each instance gives four consecutive outputs, X1 to X4, of a 64-bit LCG, X(n+1) = (A·X(n) + C) mod 2^64. Each output is X(n) >> 16, so its low 16 bits are hidden. The response includes the multiplier A and the modulus, and skill.md gives the increment C. Submit X5, X6, and X7 in the same truncated form before the instance expires."

**R-19 · major · gates.ts:36, :61, :96, :131** (confirmed)
What happens: every `name` ends in "(Hell)". The API `name` fields ("NEURAL SENTRY" and so on) and the skill.md gate headings don't include it. The suffix repeats in the h1, `<title>`, stepper, pager, overview cards, and console. It also lengthens the names enough to clip the stepper (R-33) and break the console columns (R-16).
Violates: 03 ("gate names come from the name field of each API response and from skill.md"), and it contributes to 2.34.
Fix: keep "Hell" as the user's difficulty name, but present it once. Restore the names to "Neural Sentry", "Entropy Fracture", "Logic Maze", and "Bytecode Vault". Add `difficulty: "Hell"`, rendered as a "Difficulty: Hell" tag next to the points on each gate page and once in the Overview gates intro.

**R-20 · minor · gates.ts:4-5, :172-191** (confirmed)
What happens: `SCOREBOARD_ENDPOINTS` and `SKILL_ENDPOINT` are never imported. `GateNumber` and `InstanceGate` duplicate app-state.ts.
Violates: 2.35 intent (dead code).
Fix: delete the two constants, or use them in Overview and Scoreboard. Keep the types here as the single source (see R-06).

### G. Try-it panels: src/components/gates/Gate1TryIt.tsx, InstanceTryIt.tsx, Countdown.tsx

**R-21 · major · Gate1TryIt.tsx:29-37, :50-62** (confirmed)
What happens: the panel's only hint is `Sent as {"prompt": "..."}`. Nothing mentions that the trimmed prompt must be 50 to 500 characters or that its SHA-256 must start with 0000. A hand-typed prompt passes the hash check about once in 65,536 tries, so a visitor sees "Blocked by filter" every time without learning why until they read the server text. The status label calls length and proof-of-work failures "filter" blocks.
Violates: 2.22 (the try-it text must agree with the API), 2.30 (format hints as visible text).
Fix: add the hint "The server trims the prompt, then requires 50 to 500 characters and a SHA-256 hash that starts with 0000. Agents usually append a nonce and increment it until the hash matches." Below the field, show a live readout of the trimmed length and the first 8 hex characters of SHA-256 of the trimmed prompt, computed with `crypto.subtle.digest`. That sends no request, so 3.15 holds. Relabel `allowed: false` as "Blocked" and keep the server text verbatim. A browser nonce miner would be a new feature that solves part of the gate. Leave it out unless the user asks for it.

**R-22 · major · InstanceTryIt.tsx:94, :100, :106, :187; Gate1TryIt.tsx:122** (confirmed by ESLint)
What happens: three `as any` casts on instance data, and an unescaped `'` in "didn't" in both panels.
Violates: 2.35.
Fix: read `state.gate2.instance`, `state.gate3.instance`, and `state.gate4.instance` in their own branches so the types narrow without casts. Write the sentences as JS strings, for example `{"The request didn't reach the server. …"}`.

**R-23 · major · Gate1TryIt.tsx:24; InstanceTryIt.tsx:60** (confirmed)
What happens: "Try it" is an h3 directly under the page h1.
Violates: 2.31 (no skipped levels).
Fix: make it an h2. The instance sub-headings then become h3 (R-28), and the inline flag heading h4 (R-36).

**R-24 · minor · InstanceTryIt.tsx:25-33** (confirmed)
What happens: expiry is announced from a per-mount ref. Returning to a gate page with an already expired instance announces "expired" again. An instance that expires after an accepted answer announces "Request a new instance to try again." The countdown also keeps ticking after acceptance.
Violates: 2.13 ("announce the expiry once"), 04 Countdown.
Fix: keep an `expiryAnnounced` flag on the instance in the reducer, set it where the ticker dispatches `instance/expired`, and announce only while status is `live` or `rejected`. Hide the countdown once the status is `accepted`.

**R-25 · minor · InstanceTryIt.tsx:160-178; Gate1TryIt.tsx:106-114** (confirmed)
What happens: the server-error labels are "Rate limited" or "Server error" without the HTTP status. There is no "Try again" action next to the error. The rejected state lacks 03's guidance ("Expires in {n} s. Change your answer and submit again." / "Request a new instance to try again.").
Violates: 03 shared states (2.11 is met because the message shows the wait).
Fix: use "Rate limited (HTTP 429)" and "Error (HTTP {status})", add a secondary "Try again" button that repeats the last operation, and add the rejected guidance.

**R-26 · minor · InstanceTryIt.tsx:74** (confirmed)
What happens: "Request new instance" sits inside the `slot.instance ?` branch, and `instance/requestStart` sets `instance: null`. The focused button unmounts, and focus drops to `<body>`.
Violates: 2.29, 04 Countdown and Busy controls.
Fix: keep the instance panel mounted in a requesting state until the response arrives, or focus the idle panel's request button after the swap.

**R-27 · minor · Gate1TryIt.tsx:41, :100; InstanceTryIt.tsx:113, :155** (confirmed)
What happens: once a flag is returned, the Try it section holds two primary buttons: the gate action, which is disabled on instance gates, and the inline "Submit flag".
Violates: 2.3 (at most one primary per gate).
Fix: render the gate action as secondary while a flag result is showing.

### H. Instance views: src/components/gates/Gate2Instance.tsx, Gate3Instance.tsx, Gate4Instance.tsx

**R-28 · major · Gate3Instance.tsx:60** (confirmed)
What happens: the assignment hint says "Either 60 booleans in variable order". At HEAD the instance has 120 variables. A 60-element boolean array matches neither the 120 nor the 121 branch of `verifyGate3Solution`, so the server reads it as signed literals and answers "Variable x_N missing assignment."
Violates: 2.9 (derive counts from the response), 2.22.
Fix: build the hint as `` `Either ${data.variablesCount} booleans in variable order, such as [true, false, ...], or signed literals with one per variable, such as [1, -2, 3, ...].` ``.

**R-29 · major · Gate2Instance.tsx:45-70** (confirmed)
What happens: the HELL edit replaced `data.modulus` with a hardcoded C and replaced `data.multiplier` with a hardcoded A, so the modulus is no longer shown. The three inputs have no group legend, and their only format hint is the placeholder "Predicted top 48-bit value", which doesn't say decimal.
Violates: 2.9 (sequence, multiplier, and modulus), 2.30.
Fix: show `data.multiplier` and `data.modulus` verbatim. Show C from a `LCG_INCREMENT` constant in gates.ts, labelled "Increment C (from skill.md)". Wrap the inputs in a `<fieldset>` with the legend "Next three outputs (X5 to X7)" and the shared hint "Decimal integers in the same truncated form, X(n) >> 16, from 0 to 281474976710655. Surrounding spaces are removed."

**R-30 · major · Gate2Instance.tsx:22, :30, :56; Gate3Instance.tsx:31; Gate4Instance.tsx:21, :31** (confirmed)
What happens: the section headings are 12px `uppercase tracking-label` h4s. "Truncated Sequence" is in title case. The inline code in the Gate 2 caption uses `text-code-inline` (0.9375em) inside 12px text, which renders at 11.25px. "Low 16 bits stripped" uses the warning color for something that isn't a status.
Violates: 2.4 (no all-caps headings, nothing below 12px), 03 rule 5.
Fix: use h3 (after R-23) with `text-ui font-semibold text-fg` and no uppercase. Write "Truncated sequence (4 outputs)" and "Next three outputs". Use `text-code-sm` for code inside captions, and `text-fg-muted` for the note.

### I. Gate page shell: src/components/gates/GateReference.tsx, GateStepper.tsx, GatePager.tsx

**R-31 · major · GateReference.tsx:36, :65** (confirmed)
What happens: "Endpoints" and "Request Payload" are h3 under the h1, and "Request Payload" is in title case and not 03's term.
Violates: 2.31, 03 rule 5.
Fix: make them h2, and write "Request body".

**R-32 · minor · GateReference.tsx:7-9, :14-26** (confirmed)
What happens: Gate 1's note ends "so you can try it from this page", which promises something the proof-of-work rule makes nearly impossible by hand. Gate 1's tag row shows no "No TTL". The rate-limit line from 03 is missing.
Violates: 2.22, 03 Gate copy.
Fix: "Gate 1 has no instance and no TTL. Each prompt is checked on its own. A prompt typed here passes only if its SHA-256 hash starts with 0000, so this area is mostly for seeing how the server answers." Add "No TTL" and the rate-limit line.

**R-33 · major · GateStepper.tsx:8, :25** (likely)
What happens: the labels use `truncate`. Two columns at 360px leave about 134px per label, and four columns from 640px leave about 116px. "Entropy Fracture (Hell)", "Neural Sentry (Hell)", and "Bytecode Vault (Hell)" measure roughly 140 to 155px at 14px, so they are likely clipped. Verify in the browser pass.
Violates: 2.34 (navigation labels not clipped).
Fix: remove `truncate` and let labels wrap to two lines inside the cell. R-19's shorter names fix most cases on their own.

**R-34 · minor · GatePager.tsx:13-33** (confirmed)
What happens: the link text has no "Previous:" or "Next:" because the arrows are `aria-hidden`. Gate 1 has no "Previous: Overview" link, and Gate 4 has no "Next: Scoreboard" link.
Violates: 03 Gate copy.
Fix: add the visible prefixes and the two end links.

### J. src/components/flag/FlagForm.tsx

**R-35 · major · FlagForm.tsx:31-37** (confirmed)
What happens: `handleSubmit` checks `flagSlot.status === "accepted"` from the render before the submit. The dialog never closes on a first accepted flag. Once any earlier result was "accepted", the dialog closes after every later submission, accepted or rejected, and unmounts its result. A visitor who submits flags 2 to 4 through the header dialog never sees the rejection or the Proof-of-Pwn badge there.
Violates: 3.4 (show feedback and badge), 04 Submit Flag Dialog ("the dialog stays open and shows the result").
Fix: remove the `onSuccess` prop here and its use in FlagDialog.tsx:50.

**R-36 · minor · FlagForm.tsx:50, :69-79, :125-131, :163-165** (confirmed)
What happens: the inline heading is an h3 nested under the "Try it" heading. The invalid-handle warning renders as an error with `aria-invalid` even though submission proceeds. The accepted result lacks the "Score: … Gates solved: …" line. The badge note reads "(Issued because all four gates were solved):". Every server-error is labelled "Rate limited".
Violates: 2.31, 2.16 (a warning, not an error), 03 Flag form copy.
Fix: add a `headingLevel` prop (4 inline, per 04). Render the handle warning as a hint-style warning without `aria-invalid`. Add the score line and 03's badge note. Label errors by status: "Rate limited (HTTP 429)", or "Error (HTTP {status})". That needs the reducer's `flag/error` case to store the status, which is a one-line change in app-state.ts (group B).

### K. src/components/shell/FlagDialog.tsx

**R-37 · major · FlagDialog.tsx:33-51** (likely)
What happens: the only announcer sits outside the dialog. `showModal()` makes the rest of the page inert, and browsers hide inert content from assistive technology. Flag results and copy confirmations announced while the dialog is open are likely never spoken.
Violates: 2.32, 04 Live Regions ("LiveRegion is therefore rendered twice").
Fix: render `<Announcer />` as the dialog's last child. A closed dialog is `display: none`, so only one region is exposed at a time. If testing finds double speech in a browser that doesn't hide inert content, switch to 04's `flagDialogOpen` routing.

**R-38 · minor · FlagDialog.tsx:12-15, :24-31, :50** (confirmed)
What happens: `showModal()` runs before React renders the form (`isOpen && <FlagForm/>`), so initial focus lands on "Close". The dialog has no `aria-labelledby`, the trigger has no `aria-haspopup="dialog"`, and the dialog stays open across a back-button navigation.
Violates: 04 Submit Flag Dialog, 2.31.
Fix: always render the form inside the dialog, and after `showModal()` focus the first empty field. Add `aria-labelledby` pointing at the h2 id and `aria-haspopup="dialog"`. Close on `usePathname()` change.

### L. src/components/ui/CopyButton.tsx

**R-39 · major · CopyButton.tsx:73-96** (confirmed)
What happens: the text variant has no `aria-label` and no hidden text. Every copy control on the Overview, the endpoint rows, the flag, the badge, and skill.md is announced as plain "Copy".
Violates: 2.17, 04 Copy Controls (WCAG 2.4.6 and 4.1.2).
Fix: render `Copy<span className="sr-only"> {label}</span>` so the name is "Copy base URL" or "Copy URL for GET /api/gate2/challenge". Pass those labels from CopyField and GateReference.

**R-40 · major · CopyButton.tsx:26-28, :35, :39** (confirmed by ESLint)
What happens: `setHydrated(true)` inside an effect fails `react-hooks/set-state-in-effect`. The announcements read "Copied {label} to clipboard." and "Failed to copy …".
Violates: 2.35, 03 Copy controls.
Fix: replace the effect with `useSyncExternalStore(() => () => {}, () => true, () => false)` as 04 specifies. Use "{Thing} copied to the clipboard." and "Couldn't copy {thing}. Select the text and copy it manually."

### M. src/components/ui/StatusMessage.tsx

**R-41 · major · StatusMessage.tsx:7, :32** (likely for the double speech, confirmed for lint)
What happens: every result box is `role="status"`. The boxes nest (the flag-form result inside a gate result), and they hold changing text such as "Copy" turning into "Copied" and inline field errors. Those changes are likely spoken in addition to the announcer's message. `badgeIcon?: any` fails lint.
Violates: 2.32 and 04 ("visible result areas … are not live regions"), 2.35.
Fix: remove the role, so `announce()` stays the only source. Type `badgeIcon` as `StatusBadgeProps["icon"]`.

### N. src/components/ui/Button.tsx

**R-42 · minor · Button.tsx:45** (likely)
What happens: busy state uses native `disabled`, so the focused submit button loses focus to `<body>` on every request.
Violates: 2.29, 04 Busy and Disabled Controls.
Fix: while busy, set `aria-disabled="true"` and ignore clicks. Style `[aria-disabled="true"]` the same as `:disabled`. Keep native `disabled` for the unavailable states that 3.7 lists.

### O. src/components/shell/PrimaryNav.tsx, SoundToggle.tsx

**R-43 · major · PrimaryNav.tsx:56, :62** (likely)
What happens: at 360px the five labels plus `px-2` and `gap-1` come to about 340px against 328px available, so the row likely wraps. Because the `ul` has a fixed `h-11` and `flex-wrap`, the second row overflows the 44px bar into `main`. Verify in the browser pass.
Violates: 2.34.
Fix: below `sm`, use `px-1.5` and `gap-0.5`, drop `flex-wrap` and `flex-1`, and change `h-11` to `min-h-11`.

**R-44 · minor · SoundToggle.tsx:15, :21, :26** (confirmed)
What happens: `aria-label="Sound effects"` overrides the visible "Sound off" or "Sound on", so the accessible name doesn't contain the visible label.
Violates: WCAG 2.5.3, 04 Navigation State and Toggles.
Fix: per 04, name the button "Sound", put the state text in an `aria-hidden` span, and keep `aria-pressed`.

### P. Docs: src/lib/markdown.ts, src/components/docs/SkillDocument.tsx, SkillDoc.tsx, src/app/docs/page.tsx

**R-45 · major · markdown.ts:173-174 → SkillDocument.tsx:87** (confirmed)
What happens: heading inlines keep the leading 🎯 and 🏆. Only the slug strips them, so the rendered page shows both emoji.
Violates: A8, 2.19, 3.17.
Fix: strip a leading `[\p{Extended_Pictographic}\uFE0F\u200D]+\s*` from the heading's first text inline. Use the same narrower class in `slugify`, because `\p{Emoji}` also matches digits, `#`, and `*`.

**R-46 · major · markdown.ts:264, :353** (confirmed)
What happens: the HELL skill.md adds `$X_n \gg 16$` and `$1.3 \times 10^{36}$`. `texToNodes` has no case for either command, so the default branch emits a literal "\" followed by italic "g", "g" or "t", "i", "m", "e", "s". It never returns `null`, so the `<code>` fallback never runs. `let s` at :264 also fails `prefer-const`.
Violates: 2.19 (no LaTeX syntax as literal text outside code), 2.35.
Fix: map `\gg` to "≫" and `\times` to "×", return `null` for any other `\command` so the code fallback applies, mirror the two commands in `texToSpeech`, and change `let` to `const`.

**R-47 · minor · SkillDocument.tsx:12, :14, :40-44; SkillDoc.tsx:15; docs/page.tsx:17** (confirmed)
What happens: sub and sup use the arbitrary `text-[0.8em]`, which renders at 11.2px inside 14px code text. Rendered links open a new tab without saying so. The intro lacks 03's URLs and rendering note. A file-read failure renders a fake "# Specification file not found" document instead of an error state.
Violates: 2.4, 2.31, 2.19, 03 Docs copy.
Fix: add a `--text-math-script` token at 0.75rem or larger, and add the sr-only "(opens in a new tab)" text. Use 03's intro and note, and render 03's "Couldn't load skill.md" block on read failure.

### Q. Overview: src/components/overview/GateProgression.tsx, ConnectionDetails.tsx

**R-48 · minor · GateProgression.tsx:18-25, :71; ConnectionDetails.tsx:14** (confirmed)
What happens: no total is shown. The gates render as a `div` grid instead of an ordered list, each card has two links to the same page, the heading is "The four gates" instead of "Gates", and Gate 1 shows "No time limit" instead of "No TTL". The "Direct endpoint" row copies the string "GET /api/skill", which isn't a URL.
Violates: 2.8 (ordered progression), 03 Overview copy.
Fix: add "{total} points in total. Points rise from Gate 1 to Gate 4, and the gates can be solved in any order." with `total = GATES.reduce(...)`, which gives 8,500. Use `<ol>`, keep one link per card, use 03's heading and "No TTL", and replace the row with the note "`GET /api/skill` returns the same file."

### R. Metadata and static pages: src/app/layout.tsx, src/app/not-found.tsx, src/app/scoreboard/page.tsx

**R-49 · minor · layout.tsx:30-31, :57; not-found.tsx:10, :18; scoreboard/page.tsx:6** (confirmed)
What happens: the default description and the 404 text say "proving ground", the scoreboard description says "Verified autonomous agent solver standings", there's no `openGraph`, `metadataBase`, or `keywords`, the skip link reads "Skip to content", and the 404 page lacks "Go to Gate 1".
Violates: 2.24, 2.21, 03 Metadata and Shell copy.
Fix: use 03's description, Open Graph block, skip-link text, and 404 copy and links.

### S. src/lib/format.ts

**R-50 · minor · format.ts:5-13, :14-24** (confirmed)
What happens: `formatClause` and `formatTime` are unused (until R-11 uses `formatTime`), and the `formatResponseJson` replacer returns `val` on both branches.
Violates: 2.35 intent (dead code).
Fix: delete `formatClause` and the no-op replacer, and keep `formatTime` only if R-11 lands.

### Note for the spec editors

03-copy.md and bugfix.md 3.1, 3.8, and 3.16 still carry pre-HELL numbers and examples: the 4,250 total, X1 to X5 with X6 to X8, 60 variables and 255 clauses, 8 opcodes, and old server messages. The findings above take the HEAD routes as the contract. The agent editing bugfix.md and design.md may want to reconcile these.

<details>
<summary>Details</summary>

### Scoreboard refetch loop and the shared rate limit

The loop needs no visitor action. The memoized callback depends on the same state it changes:

```
ScoreboardView effect [loadScoreboard]
   │ calls L(idle) ──► dispatch start ──► status=loading ──► new L(loading)
   │                                                           │ effect re-runs, L(loading) returns early
   │ fetch resolves ──► status=loaded ──► new L(loaded)
   └───────────────────────────────────────── effect re-runs, L(loaded) fetches again ...
```

A 429 response sets status to `server-error`, which is also a new identity, so the loop continues through rate limiting. ratelimit.ts keys one record per IP with a different threshold per route. Gate challenge and submit allow 40 and scoreboard GET allows 60, so the count reaches 40 first and every gate route rejects that IP until the 60 s window resets, at which point the loop consumes it again. The table and Refresh button also flicker between "Loading…" and "No entries yet." during the loop, which hides R-09. ConsoleView's effect is keyed on `[entries, loadScoreboard]`. It stops once a load succeeds, but loops the same way while loads fail, including offline, where `fetch` rejects immediately. A stable `loadScoreboard` fixes both views without touching their effects.

### HELL contract versus what the UI shows

The frozen responses still carry pre-HELL text. Gate 2's `description` says "5 consecutive numbers" and "Calculate A and C", Gate 3's `payloadSchema` says "array of 60 booleans", and Gate 4's `description` says "8-opcode". UI strings must come from gates.ts or from counts derived from the response, never from these fields outside the JSON disclosure. Gate 3's hint is the one place where a stale number got copied (R-28). Gate 1's four server checks (length, blocked words, framing words, SHA-256 prefix) all return `allowed: false` with distinct messages. The gap there is copy, not classification (R-21, R-32).

### Announcement topology

```
now                                          intended (04)
body                                         body
├─ main                                      ├─ main
│   └─ StatusMessage role=status (each)      │   └─ result boxes (no role)
│       └─ FlagForm StatusMessage role=status│   └─ LiveRegion
├─ Announcer role=status                     ├─ dialog
└─ dialog (modal, page inert)                │   └─ LiveRegion
    └─ FlagForm StatusMessage role=status    └─ console role=log
console role=log
```

With the dialog open, the page Announcer is inert, and the only regions left are StatusMessage boxes that mount with their content already in place. Most screen readers don't speak a region inserted that way, so dialog results are likely silent (R-37). With the dialog closed, both the Announcer and the box around a changing element can speak, so "Copied" inside a result box likely speaks twice (R-41).

</details>

<details>
<summary>File map</summary>

Full diff: `git diff afe2537..HEAD`.

- src/app/layout.tsx: fonts, metadata, viewport without maximumScale, landmark order, provider, announcer.
- src/app/page.tsx, components/overview/*: Overview headline, connection URLs, start steps, gate cards.
- src/app/gates/page.tsx, gates/[gate]/page.tsx, components/gates/GateStepper, GateReference, GatePager: gate routes, reference sections, navigation.
- components/gates/Gate1TryIt, InstanceTryIt, Countdown, Gate2/3/4Instance: try-it panels and instance views (Gate2Instance also edited in c6d13ea).
- src/app/scoreboard/page.tsx, components/scoreboard/*: scoreboard view, standings table, page flag form.
- src/app/docs/page.tsx, components/docs/*, src/lib/markdown.ts: static skill.md render with in-house Markdown and TeX subset.
- src/app/console/page.tsx, components/console/ConsoleView, src/lib/console.ts: console view and pure command runner.
- components/shell/*: header, primary nav, footer, flag dialog, sound toggle.
- components/state/*, src/lib/app-state.ts, src/lib/api.ts: provider, reducer, typed fetch and classification.
- components/ui/*: Button, Field, CopyButton, CopyField, StatusBadge, StatusMessage, JsonDisclosure.
- src/lib/gates.ts (edited in c6d13ea), format.ts, validation.ts, sound.ts: gate metadata, formatting, handle cleanup, sound off by default.
- src/app/globals.css, icon.svg, favicon.ico removed: token set, type scale, focus ring, reduced-motion backstop, new favicon.
- package.json, package-lock.json: canvas-confetti and its types removed.
- Frozen and out of scope: src/app/api/**, src/lib/challenges.ts, public/skill.md, test_agent_solver.py (HELL changes), plus .kiro spec files.

</details>

## Checked and fine

- Points (1,000, 2,000, 2,500, 3,000), TTLs (15, 10, 20 s), and every endpoint in gates.ts match the HEAD routes and `GATE_POINTS`. The console `gates` and `solve` output reads them from gates.ts.
- Gate 2 shows the four outputs as X1 to X4 and submits three trimmed values labelled X5 to X7, in the order `verifyGate2Solution` expects and skill.md names.
- Gate 3 counts and Gate 4's byte count come from the response. The opcode table comes from `vmSpec.opcodes`, so 0x08 DUP appears. The stale API `description` fields appear only in the JSON disclosure.
- api.ts classifies by body: 429 and non-JSON bodies are server errors, a boolean `success` means accepted or rejected whatever the 400 or 403 status, Gate 1's `error`-only 400 shows its `error`, a challenge without a non-empty `sessionToken` produces no instance or countdown, and a failed fetch is a network error.
- `instance/requestStart` clears the instance, inputs, result, and error (3.7). Submit is blocked while loading, after expiry, and after acceptance. Gate 3's malformed JSON stays a field error with the exact 3.9 text and sends nothing. The Gate 4 key is trimmed (3.8).
- The flag form validates required fields, mirrors the route's handle cleanup exactly, POSTs `{agentName, flag}`, refreshes the scoreboard after an accepted flag, and shows the recorded handle and the badge with a copy control. Auto-fill sets the flag and leaves the handle alone (3.5).
- State lives in the root-layout provider and survives client navigation (3.14). Every view has its own URL, and the nav sets `aria-current="page"`, or `"true"` for gate subpages.
- header, nav, main, and footer are siblings. There is one app announcer plus the console's `role="log"`. The footer's external link has `rel="noopener noreferrer"` and sr-only new-tab text.
- CopyButton awaits `writeText` before showing "Copied", reports failure, and stays disabled until hydrated.
- Reduced motion has a global backstop, the dialog animation is `motion-safe`, there is no smooth scrolling, and confetti and its package are gone. Sound starts off and the toggle exposes `aria-pressed`.
- Components contain no raw hex, rgb, or default palette classes. The only hex is `themeColor`, which needs a literal. There are no `text-[Npx]` sizes, the viewport allows zoom, and fonts load through next/font.
- `npx tsc --noEmit --incremental false` exits 0.
