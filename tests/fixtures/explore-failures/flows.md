# Exploration counterexamples: browser flows and requests (task 2.3)

**File:** `tests/explore/flows.test.ts` (Property 1: Bug Condition, "Interactions and requests show no defect marker").

**Target:** HEAD c6d13ea, using the Wave 1 `.next` build with `next start -p 3102` (started by `ensureServer(3102)`). Chrome is headless through playwright-core. Every context uses its own probe IP from `PROBE_BLOCKS.exploreFlows` (198.18.22.x).

**Command:** `node --test tests/explore/flows.test.ts`. Two runs gave the same verdicts:

| | Tests | Pass | Fail |
|---|---|---|---|
| Totals | 42 | 25 | 17 |

The second run took 115 s. Port 3102 was free before and after each run.

**Injected bodies:** captured live from the port-3102 server in `before`, so their shapes are the frozen HEAD API's:
- Gate 2, 3, and 4 challenges
- Gate 1 blocked, and Gate 1 flag (a mined proof-of-work prompt)
- the Gate 2 rejected submit
- GET /api/scoreboard
- four accepted scoreboard POSTs, the fourth with the Proof-of-Pwn badge
- the 403 rejected flag
- the real 429 bodies, from a probe IP spent on purpose

Tests then change only values:
- `ttlSeconds`
- Gate 3 counts: 7 variables, 9 clauses over x1 to x7
- a fifth Gate 2 value
- Gate 4 opcodes, cut to 5
- the 429 message, set to "Rate limit exceeded. Retry in 42s."
- `agent.agentName` = `myagent`

No request went to ctf.hakudigital.tech, because every context aborts non-localhost requests.

## Failing on HEAD (the gaps; each must pass after the fix)

| Test ID | Requirement | Scenario | Measured on HEAD |
|---|---|---|---|
| X12, M-05 (counts) | 2.9, 2.22 | Gate 3 challenge injected with `variablesCount: 7`, `clausesCount: 9`, 9 clauses. The test reads the try-it text, leaving out the JSON view. | It shows "Variables: 7" and "Clauses: 9", but the text still contains a stale "60": "Assignment (JSON array) Either 60 booleans in variable order…". The real HEAD instance shows 120 and 512. |
| X12, M-05 (hint) | 2.9, 2.22 | The same instance. The test reads the `aria-describedby` hint of the Assignment field. | "Either 60 booleans in variable order, such as [true, false, ...], or signed literals…". The expected "7 booleans" is missing. |
| X12, M-04 | 2.9 | The captured Gate 2 challenge, which includes `modulus: "18446744073709551616 (2^64)"`. | The panel shows "Multiplier (A): 6364136223846793005" and "Increment (C): 1442695040888963407". `18446744073709551616` is missing. |
| X14, R-25 | 2.11 (03 shared states) | A 429 body with "Retry in 42s" on GET /api/gate2/challenge and on POST /api/gate1/chat. | Both show the label "Rate limited". "Rate limited (HTTP 429)" is expected. The message, the absent countdown, and the absent Submit all pass. |
| X15, R-42 (likely, **reproduced**) | 2.12, 2.29 | The request is held 1.5 s. The control is focused and activated with Enter, then `document.activeElement` is read at +400 ms. | The Gate 2 "Request instance" button and the dialog "Submit flag" button both lose focus to `body` while busy. Busy uses native `disabled`. |
| X16, R-24 | 2.13 | Gate 2 with `ttlSeconds: 1`. After "Expired", the test clicks the Overview nav link, then the Gate 2 link, so the client-side navigation keeps app state. | The expiry is announced 2 times for one instance, "Gate 2 instance expired. Request a new instance to try again." twice. 1 is expected. |
| X16, R1 | 2.13, 2.33 | Gate 3 with `ttlSeconds: 4`, read 300 ms after the instance appears. | It shows "Expiring, 4 s left" at 4 s. The Gate 3 threshold should be 3 s, but HEAD uses 5 s for every gate. Gate 2 at 4 s correctly shows Expiring. |
| X19, R-36 | 2.16 | Handle `my agent!` typed into the header dialog. | The format message shows: "This handle doesn't match the accepted format. The server will record it as myagent." But the field gets `aria-invalid="true"`, which makes it an error, not a warning. |
| X21, R-09 (429) | 2.18 | Every GET /api/scoreboard is answered with the 429 body, and no earlier rows exist. | The server message "Retry in 42s" is never shown, and "No entries yet." is shown. 258 GETs went out during the roughly 3 s check, because of the refetch loop. |
| X21, R-09 (network) | 2.18 | GET /api/scoreboard is aborted (`internetdisconnected`), and no earlier rows exist. | No "didn't reach the server" error appears, and "No entries yet." is shown. |
| X35 (focus) | 2.32 | Five actions, each started from a focused control: copy, 429 error, expiry, accepted flag, and console. The test checks `document.activeElement` after the announcement. | "429 error: focus moved to body" and "accepted flag: focus moved to body". Copy, expiry, and console keep focus. |
| X35, R-41 (likely, **reproduced**) | 2.32 | The same five actions. The test looks for live-region records in regions that appeared at or after the action. | The 429 error inserts a new `role=status` region with "Rate limitedRate limit exceeded. Retry in 42s.". The accepted flag inserts one with "AcceptedDismissFLAG ACCEPTED for Gate 1! +1000 points.Recorded as …". This is StatusMessage `role="status"`. |
| X35, R-37 (likely, **reproduced**) | 2.32 | Accepted flag in the open modal dialog. Live regions are marked before the action. | No region inside `dialog[open]` that existed before the action received the message. "Flag accepted for flows-probe-…" went only to the Announcer outside the dialog, which is inert while the modal is open. |
| R-35 | 3.4, 2.7 | Header dialog on /gates/1. The first POST returns accepted (Gate 1), and the second returns accepted with `proofBadge` (Gate 4). | The dialog is open after the first submission. It is **closed** after the second, so the second message and the badge are not shown in the dialog. |
| M-01, R-01 | 2.18, 3.15 (A13) | /scoreboard against the real server with a fresh probe IP. No interception. The page stays open 3 s. | **398** GET /api/scoreboard: 60 got 200, 337 got 429, and 1 was pending. 1 is expected. Run 1 measured 393. |
| R-01 (Refresh) | 2.18, 3.15 | /scoreboard with GET answered 200 from the capture. The test waits 1.5 s, clicks Refresh once, and waits 1.5 s more. | 297 GETs before Refresh, and 368 more in the 1.5 s after the click. 1 more is expected. |
| R-01, R-15 (console) | 3.15 | /console with every GET /api/scoreboard answered 429. The page stays open 3 s. | **884** GET /api/scoreboard. At most 1 is expected. The console effect loops while loads fail. |

### Verdicts on "likely" review findings

- **R-42 is reproduced.** A busy control loses focus to `<body>` (X15, R-42 and X35 focus).
- **R-41 is reproduced.** Result boxes are extra `role=status` regions that appear with their content (X35, R-41).
- **R-37 is reproduced.** While the modal dialog is open, the flag result reaches only the inert Announcer outside the dialog (X35, R-37).

## Passing on HEAD (regression guards, already fixed in 2516aa1)

- **X23 (H).** `/gates` returns 307 to `/gates/1`. `/gates/0`, `/gates/5`, and `/gates/x` return 404.
- **X02, X09 (H).** The HTML of `/` has no `scanlines` or `matrix-grid` class. After the h1 come an intro paragraph, then `https://ctf.hakudigital.tech`, `https://ctf.hakudigital.tech/skill.md`, and `GET /api/skill`.
- **X23 (B), at desktop and at mobile.** All 8 views list Overview, Gates, Scoreboard, Docs, and Console in that order. Exactly one link has `aria-current`: "page" on an exact match, and "true" for Gates on /gates/2 to /gates/4.
- **X23 (B).** Reloading /docs shows the document. After Overview, Gates, and Scoreboard, back shows /gates/1 with "Gate 1…".
- **X10.** On /, no flag input comes before the intro. Every view's header opens a dialog with the flag form, and /scoreboard has the form in main.
- **X12.** A Gate 2 body with 5 values shows rows X1 to X5 and inputs X6 to X8. Gate 4 shows 5 opcode rows for 5 injected opcodes, and the full-response JSON deep-equals the body.
- **X13.** Aborting a Gate 2, 3, or 4 challenge or submit shows "didn't reach the server" with an enabled retry control (Request instance or Submit).
- **X14.** A 429 on a Gate 2, 3, or 4 challenge, or on the Gate 1 chat, shows "Retry in 42s" with no countdown and no enabled Submit.
- **X15.** Gate 2 request and submit, Gate 1 send, and the flag submit all show a busy label ("Requesting…", "Submitting…", "Sending…") and are disabled. A second click sends no second request: exactly 1 GET or POST each.
- **X16.** With `ttlSeconds: 1`, the panel shows "Expired" within 3 s. Submit is disabled, Request new instance is enabled, and the expiry is announced once in a region that existed before.
- **X17.** The blocked, answered, and flag bodies give "Blocked by filter", "Answered, no flag", and "Flag returned". The server text shows verbatim, and the flag result has the inline form filled with the flag.
- **X18.** An empty prompt, an empty handle, or an empty flag sends 0 POSTs. The field gets `aria-invalid="true"` and a visible "Enter …" message through `aria-describedby`.
- **X19.** `my agent!` and a 25-character handle show the format message and the cleaned handle before submission. An accepted body with `agentName: "myagent"` shows `myagent`.
- **X20.** These copy controls put the exact text on the clipboard, show "Copied", and announce in a pre-existing region:
  - base URL and skill.md URL
  - every endpoint on /gates/1 to /gates/4 (1 + 2 + 2 + 2)
  - the Gate 1 flag
  - the Proof-of-Pwn badge

  With writes denied, the control shows "Copy failed" and the failure is announced.
- **X21.** A GET /api/scoreboard held 1.5 s shows "Loading scoreboard…".
- **X28.** Sound is off by default. Clicking all 5 nav links and one control per view created 0 AudioContexts and 0 oscillators. The toggle goes from `aria-pressed="false"` to `"true"`.
- **X29.** An accepted flag adds no canvas, and no animation runs outside the result.
- **X30.** With reduced motion, an accepted flag and a hover leave no running animation, no scroll call uses `behavior: "smooth"`, and `html` scroll-behavior is `auto`.
- **X35.** Every view has a live region at load. Copy, 429 error, expiry, accepted flag, and console output are each announced in a region that existed before the action.
- **M-01.** `/`, `/gates/1` to `/gates/4`, and `/docs` each sent 0 API requests in 2 s against the real server. `/console` sent at most 1.

## Not covered here

- **X20, skill.md copy disabled while the file is absent.** /docs is statically generated, so the content is never absent in a browser run. The design leaves this to a unit test with an injected reader.

## Incidental observation (no test asserts it)

- **The first countdown frame exceeds the TTL.** The captured Gate 2 body has `ttlSeconds: 15`, but the panel read "Expires in 16 s" right after the instance appeared. With `ttlSeconds: 4`, run 1 read "Expiring, 5 s left".
- **Cause:** `useNow()` returns the provider's `now`, which only the 250 ms ticker updates. The ticker doesn't run before an instance exists, so the first render uses a stale clock.
- **Fix:** R-02's fix (`setNow(Date.now())` in `requestInstance`) removes it. The R1 test waits one tick (300 ms) before it reads.
