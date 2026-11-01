# Exploration counterexamples: rendered layout and semantics (task 2.2)

Property 1 (Bug Condition). Test file: `tests/explore/rendered.test.ts`.

- Code under test: HEAD c6d13ea, served from the Wave 1 `.next` build with `next start -p 3101` (started and stopped by the test file; port 3101 was free afterward).
- Command: `node --test tests/explore/rendered.test.ts`
- Result: 35 tests, 20 fail and 15 pass, in about 52 s.
  - The 20 failures are the gaps this task targets. Each failure confirms its gap.
  - The 15 passes are regression guards for rows that measured.md already lists as passing (already fixed in 2516aa1).
- Viewports: desktop is 1280×900. Mobile is 360×780 with mobile emulation. zoom200 is 640×450 at device scale 2, which equals 1280×900 at 200% zoom.
- Probe IPs: each browser context got a fresh `198.18.21.x` address. Every request went to localhost.
- Scoreboard: contexts that open `/scoreboard` or `/console` answer the first `GET /api/scoreboard` locally and hold every later one. The first answer is the server's real envelope with one entry, `probe-x36`, which has `gatesSolved: [1, 3]` and score 3,500. Holding the later requests parks HEAD's refetch loop (M-01) in "loading", so the loop never reaches the server.
- Gate instances: the Gate 2, 3, and 4 instance checks request one real instance each, which is one challenge GET per fresh IP.

## Likely findings decided by the test

| Finding | Verdict | Evidence |
|---|---|---|
| R-33 stepper labels clipped | **Reproduced** | At 360px, "Entropy Fracture (Hell)" is clipped (scrollWidth 146 > clientWidth 134). At 640px, three labels are clipped: "Neural Sentry (Hell)" (127 > 116), "Entropy Fracture (Hell)" (146 > 116), and "Bytecode Vault (Hell)" (135 > 116). This happens on all four gate pages. |
| R-37 no live region in the dialog | **Reproduced** | With the flag dialog open there are 0 live regions inside it. The only region is the page announcer outside the dialog, and Chrome's accessibility tree marks it `ignored=true` with the reason `activeModalDialog`. Announcements made while the dialog is open are therefore not exposed. |

No "likely" finding in this file's scope came out as not reproduced.

## Failing on HEAD (gap confirmed)

| Test ID | Requirement | View and viewport | Measured value |
|---|---|---|---|
| X04 / M-15 | 2.3 | All 8 views, desktop | 0 visible buttons have `data-variant`: 0 of 5 on /, 0 of 4 on /gates/1, 0 of 5 on /gates/2, /gates/3, and /gates/4, 0 of 4 on /scoreboard, 0 of 3 on /docs, and 0 of 2 on /console. |
| X06 / M-07 | 2.4 | /gates/1, desktop | `p` at 12px: "Gate 1 has no instance and no TTL…" (`p.text-caption`). `p` at 12px: "Sent as {"prompt": "..."} to POST /api/gate1/chat." (the Field description). `td` at 12px: "string" (`td.text-code-sm`). |
| X06 / M-07 | 2.4 | /gates/2, /gates/3, /gates/4, desktop | `p` at 12px: "Instances expire after 15 s / 10 s / 20 s, which is sized for an agent…". The payload-type `td` cells are 12px: "string" and "string[]" on Gate 2, "string" and "boolean[] \| number[]" on Gate 3, and "string" twice on Gate 4. |
| X06 / M-07 | 2.4 | /scoreboard, desktop | Four `p` elements at 12px: "Standings are kept in server memory and can reset…", "Each flag counts once per agent handle…", the handle hint "Letters, digits, _, - and ., up to 24 characters…", and the flag hint "Format: HAKU{...}…". One `td` at 12px: "In progress" (`td.text-caption`). That makes 17 elements in total. |
| X06 / M-10 | 2.4 | /, desktop | Each h2 is 18px and each h3 (a gate title, such as "Gate 1: Neural Sentry (Hell)") is also 18px, so h2 is not larger than h3. |
| X06 / M-06 | 2.4 | /gates/2, /gates/3, /gates/4, desktop, instance loaded | These h4 elements are 12px with `text-transform: uppercase`: "Truncated Sequence (4 outputs)" and "Next three truncated outputs" (Gate 2), "Clause preview" (Gate 3), and "Bytecode (151 bytes, hex)" and "Opcode table" (Gate 4). |
| X06 / R-30 | 2.4 | /gates/2, desktop, instance loaded | The inline code "X_n >> 16" (`code.text-code-inline`) inside the 12px caption renders at 11.25px. |
| X06 / M-05 | 2.4, 2.9 | /gates/3, desktop, instance loaded | The panel shows "Variables: 120", but the assignment hint reads "Either 60 booleans in variable order, such as [true, false, …". |
| X20 / R-39 | 2.17 | /, desktop | 3 buttons have the accessible name "Copy". No button is named "Copy base URL" or "Copy skill.md URL". |
| X20 / R-39 | 2.17 | /gates/1 to /gates/4, desktop | Each endpoint copy control is named "Copy": 1 on Gate 1 and 2 on each of Gates 2 to 4. No button is named "Copy URL for {METHOD} {PATH}". For example, "Copy URL for GET /api/gate2/challenge" is missing. |
| X20 / R-39 | 2.17 | /docs, desktop | 1 button is named "Copy", and no button is named "Copy skill.md". |
| X11 / A14 | 2.8 | /gates/1 to /gates/4, desktop | The `<title>` is "Gate N: {Name} (Hell) · AGENTGATE CTF", and the h1 is "Gate N: {Name} (Hell)". "(Hell)" appears 6 times in the rendered text on Gates 1 and 4 and 7 times on Gates 2 and 3. "Difficulty: Hell" appears 0 times on each page. |
| X11 / A14 | 2.8 | /, desktop | "(Hell)" appears 4 times in the rendered text, and "Difficulty: Hell" appears 0 times. |
| X22 / R-46 | 2.19 | /docs, desktop | Literal TeX appears outside code. The text reads "Returns: 4 consecutive truncated 48-bit integers (Xn \gg 16) and a …" and "Hint: Search space exceeds 1.3 \times 1036. …" (`p.text-body`). No `$$`, line-start `#`, `**`, or code fence appears. |
| X22 / M-12 | 2.19 (A8) | /docs, desktop | The emoji render visibly in the headings "🎯 Protocol Overview" and "🏆 Submitting Flags to Scoreboard". |
| X22 / M-08 | 2.4 | /docs, desktop and mobile | Nine subscript and superscript math nodes render at 11.2px at each viewport: "n", "n", "+", "1", "n", "6", "4", "3", and "6" (`var.font-mono` and `span`). |
| X22 / M-19 | 2.31 | /docs, desktop | The link `<a target=_blank href="https://ctf.hakudigital.tech">` has the accessible name "https://ctf.hakudigital.tech", which doesn't mention a new tab. Its rel is "noopener noreferrer". |
| X32 / R-13 | 2.29 | /console, desktop | When the console input `input#console-cmd` is focused with Tab, it has `outline-style: none` and no box-shadow ring. Every other element reached by Tab on the 8 views has a 2px ring or outline at 3:1 or more. |
| X33 / M-16, R-12 | 2.30 | /console, desktop | The input's only label is "$>", not "Command". The input has no `aria-describedby` (an empty list). |
| X33 / R-29 | 2.30, 2.9 | /gates/2, desktop, instance loaded | The prediction inputs X5, X6, and X7 have no `aria-describedby` and no enclosing fieldset description. Their only format hint is the placeholder. The Gate 3 assignment textarea and the Gate 4 key input do reference a visible hint. |
| X34 / M-11 | 2.31 | /gates/1 to /gates/4, desktop and mobile | The headings go from h1 to h3 at "Endpoints", with no h2 between them. |
| X37 / M-03 | 2.34 | All 8 views, mobile | The "Console" nav link wraps to a second row at y 97 to 133 (328px wide). The nav bar spans y 57 to 102 and `main` starts at y 102, so the link draws 31px outside the bar and over `main`. |
| X37 / R-33 | 2.34 | /gates/1 to /gates/4, mobile and zoom200 | The `nav[aria-label="Gate pages"]` labels are clipped by `span.truncate`. At 360px: "Entropy Fracture (Hell)" 146 > 134. At 640px: "Neural Sentry (Hell)" 127 > 116, "Entropy Fracture (Hell)" 146 > 116, and "Bytecode Vault (Hell)" 135 > 116. |
| R-37 | 2.32 | /, desktop, flag dialog open | There are 0 live regions inside the open `<dialog>`. Outside it is `div.sr-only` with role=status and aria-live=polite, which the AX tree marks ignored (`activeModalDialog`). |

## Passing on HEAD (regression guards, already fixed in 2516aa1)

| Test ID | Requirement | What holds on HEAD |
|---|---|---|
| X06 | 2.4 | At load, no text is below 12px outside /docs, there are no uppercase headings, and there is no uppercase text longer than 12 characters outside `th` and HTTP methods. |
| X07 | 2.5 | No visible, non-disabled text falls below 4.5:1 (or 3:1 for large text) on any of the 8 views at desktop or mobile. That includes /scoreboard with the injected entry. The only low reading is the disabled "Loading…" refresh button, which is exempt. |
| X07 | 2.5 | Contrast still holds with every link, button, summary, and input forced into `:hover`, `:active`, and `:focus-visible` through CDP `CSS.forcePseudoState`, on all 8 views at desktop. |
| X08 | 2.5 | Every token pair in design.md's Tokens table, parsed from globals.css with oklch converted to sRGB, meets its threshold. |
| X09 (B-half) | 2.6 | On /, each of https://ctf.hakudigital.tech and https://ctf.hakudigital.tech/skill.md has exactly one copy control next to it. |
| X22 | 2.19 | Each docs `pre` has `overflow-x: auto`, and no ancestor of the document is an inner scroll box, at desktop and mobile. |
| X27 | 2.24 | Titles have no "//". Descriptions have no "premier" or "exclusively". The favicon `/icon.svg` differs from afe2537's `src/app/favicon.ico`. |
| X31 | 2.28 | At zoom200, every view has scrollWidth ≤ 640. The primary nav links are on one line, unclipped, and within the viewport. The viewport meta has no `maximum-scale` or `user-scalable`. |
| X32 | 2.29 | Tab order follows DOM order on all 8 views, and no element has a positive `tabindex`. |
| X33 | 2.30 | Every input has a visible, associated label, including the handle and flag fields in the open flag dialog. |
| X34 | 2.31 | header, nav, main, and footer are siblings. Each view has 1 main and 1 h1 at desktop and mobile. |
| X34 | 2.31 | The new-tab links outside /docs (the footer's Haku Digital link) say "(opens in a new tab)" and set `rel="noopener noreferrer"`. |
| X35 | 2.32 | Every view has a live region at load. |
| X36 | 2.33 | In the injected row, solved gates read "G1 solved" and "G3 solved", and unsolved gates read "G2 not solved" and "G4 not solved" (through sr-only text). Each view marks exactly the expected primary nav link with `aria-current`. |
| X37 | 2.34 | At 360px, every view has scrollWidth ≤ 360. Nav labels are on one line, unclipped, and don't overlap, and no element extends past the edge outside an `overflow-x: auto` container. |

## Notes for the fix owners

- The X22 literal-TeX check (R-46) fails even though measured.md's Passing list says "No literal Markdown or LaTeX appears outside code". The two `\gg` and `\times` commands are rendered as a literal backslash followed by italic letters, so a text search for Markdown syntax misses them.
- M-07 affects more cells than measured.md lists. The payload-type `td` cells (`text-code-sm`) are 12px on all four gate pages, and the TTL note `p` is 12px on Gates 2, 3, and 4.
- X32 fails only on the console input. Every other input, including the Gate 1 prompt and the scoreboard flag form, shows a 2px ring.
- These are out of scope for this file:
  - M-09 (monospace outside code). The task list leaves it to each fix task.
  - X04's "links styled as buttons". Only `button` elements are checked.
  - X04's forced-state differences per variant.
  - X07's input-border check.
