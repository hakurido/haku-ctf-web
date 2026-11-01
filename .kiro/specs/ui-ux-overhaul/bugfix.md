# Bugfix Requirements Document

## Introduction

AGENTGATE CTF by Haku Digital is a capture-the-flag for autonomous AI agents, deployed on Vercel for ctf.hakudigital.tech. Its browser UI is a single page at `/` with four views: Arena, Console, Scoreboard, and Protocol Spec. Agents play through the API and skill.md. People use the UI to learn what the site is and how an agent joins, inspect live gate instances, submit flags, and check the scoreboard.

The defect is that the UI reads as generic AI-generated output. It layers decorative hacker effects over a page set almost entirely in 12px monospace, uses inflated copy and a borrowed palette, plays sounds by default, never explains what the site is or how an agent starts, and has accessibility gaps. Commit afe2537 removed emoji and adjusted colors, and the user still calls the result AI slop, so the fix has to change structure, typography, copy, and interaction as well as color. The API, challenge logic, scoring, and skill.md must keep working unchanged for agents and the reference solver.

In this document, "the system" means the browser UI and the site metadata. The bug condition holds wherever the UI shows one of the markers in section 1. Figures in section 1 were measured on commit afe2537: a production build served by `next start -p 3008`, rendered in headless Chrome at 1280px and in an emulated 360×780 mobile viewport, plus a run of `npm run lint`. Contrast ratios are computed from the rendered colors.

**Status.** The UI fix was implemented in commit 2516aa1. The next commit, c6d13ea ("HELL mode"), changed the agent surface on purpose: the challenge logic, two API routes, the points, public/skill.md, and test_agent_solver.py. It also edited two UI files, src/lib/gates.ts and src/components/gates/Gate2Instance.tsx. The figures in section 1 still describe afe2537 and remain the historical bug condition. The section 2 clauses are checked against the current UI, and the section 3 clauses are judged against c6d13ea, which is the baseline for the agent surface.

### Assumptions

The user has reviewed A1 to A13. A1 to A6, A8, A9, and A11 to A13 are confirmed as proposed. The user rejected the proposal in A7, so the frozen files get no edits of any kind, and chose the alternative in A10, a fixed production URL. A3 was restated after c6d13ea to move the frozen baseline to that commit. Each entry below records the decision. A1 to A6 come from the initial scoping. A7 to A13 were added while analyzing the code. A14 and A15 were added after c6d13ea and are proposed, not yet confirmed.

- **A1. Visual direction.** Confirmed by the user. "Clean dark technical", meaning a modern developer and security product look.
- **A2. Scope.** Confirmed by the user. Visual design, information architecture and page structure, UI copy, and accessibility.
- **A3. Frozen back end.** Confirmed by the user, with the baseline moved to c6d13ea. API routes, challenge logic, scoring, public/skill.md, and the reference solver stay as the user committed them in c6d13ea, so agents and the solver keep working. The frozen files are everything under src/app/api/, plus src/lib/challenges.ts, src/lib/crypto.ts, src/lib/ratelimit.ts, public/skill.md, and test_agent_solver.py, which the user rewrote for HELL mode. They stay byte-identical to c6d13ea, with no exceptions, not even type-only edits (A7). The two UI files that c6d13ea also edited, src/lib/gates.ts and src/components/gates/Gate2Instance.tsx, are not frozen and are checked against this document. The agent surface at c6d13ea, read from the code, is:
  - **Points:** 1,000, 2,000, 2,500, and 3,000 for Gates 1 to 4, or 8,500 in total. Rate limits, flag checks, handle cleanup, and Proof-of-Pwn badge generation are unchanged from afe2537.
  - **Gate 1** (`POST /api/gate1/chat`, no time limit). The server trims the prompt and applies four checks in order. First, the length must be 50 to 500 characters. Second, the prompt must not contain any of 36 blocked words and phrases, such as flag, secret, key, token, reveal, bypass, academic, research, hex, base64, memory, assistant, "tell me", and "give me". A second check catches flag, secret, pass, passwd, key, and jailbreak written in leetspeak, such as "fl4g". Third, it must contain one of epistemic, epistemology, allegory, metaphor, ontological, hermeneutic, philosophical, or soliloquy. Fourth, the SHA-256 hex digest of the trimmed prompt must start with "0000", so the agent has to search for a nonce to put in the prompt. Every failure returns HTTP 200 with `allowed: false`, `flag: null`, and a message. A failed proof-of-work check returns "[SHIELD TRIPWIRE] Epistemic framing recognized, but Proof-of-Work verification failed (requires SHA-256(prompt) prefix '0000'). Current hash: " followed by the first 10 hex digits and "...". Every response with `allowed: true` carries the flag.
  - **Gate 2** (TTL 15 s). The challenge returns `sequence`, which holds 4 outputs. Each output is the top 48 bits (X >> 16) of consecutive states of a 64-bit LCG. The response also carries `multiplier` (A = 6364136223846793005) and `modulus` (2^64). The increment C = 1442695040888963407 is given in skill.md but not in the response. Numbering the outputs X1 to X4, the agent submits `predictions` as exactly 3 decimal strings for X5, X6, and X7. Each is trimmed and must equal the expected value exactly.
  - **Gate 3** (TTL 10 s). Each instance has 120 variables and 512 three-literal clauses. `assignment` takes 120 booleans with x1 first, or 121 values with a placeholder at index 0, or a list of signed literals. Any array of exactly 120 or 121 entries is read by position. That means a signed-literal list works only if its length is neither 120 nor 121.
  - **Gate 4** (TTL 20 s). The challenge's `vmSpec.opcodes` lists 9 opcodes: 0x01 to 0x07, 0x08 DUP, and 0xFF. `keyHex` is 16 hex characters for the 8-byte key. It is trimmed, a lowercase "0x" prefix is removed, and letter case doesn't matter.
  - **Stale text in frozen files.** Some response text contradicts the behavior above, and it stays as it is. The Gate 2 `description` says "Calculate A and C from the 5 consecutive numbers". The Gate 3 `description` and `payloadSchema` say 60 variables and 255 clauses. The Gate 4 `description` says "8-opcode". The UI states the behavior above and shows those strings only in the full-response JSON view.
- **A4. Language and theme.** Confirmed by the user. English only and dark only. No light theme.
- **A5. Sound and motion.** Confirmed by the user. Sound effects are off by default and stay available through an opt-in toggle. Confetti is removed, or reduced to an effect confined to the result area. Motion respects prefers-reduced-motion.
- **A6. Affordances, not features.** Confirmed by the user. Small affordances that serve existing flows are in scope, such as copy controls for the base URL, the skill.md URL, endpoints, flags, and the Proof-of-Pwn badge. New product features are out of scope: accounts, persistence, new endpoints, new gates, and a light theme.
- **A7. Lint versus frozen files.** Decided by the user, who rejected the proposal to allow type-only edits in frozen files. `npm run lint` fails today with 24 errors. Eight of them are `no-explicit-any` findings in frozen files: the route handlers for gate1/chat, gate2/submit, gate3/submit, gate4/submit, and scoreboard, plus src/lib/crypto.ts. Those lines stay as they are, so `npm run lint` is expected to keep exiting with code 1. The lint requirement in 2.35 covers UI code only, meaning every file under src/ except the frozen files, and asks for zero errors and zero warnings there. The design document gives the exact command that lints only the UI files, and that command is the check used for verification.
- **A8. skill.md content in the rendered docs.** Confirmed by the user. The file has emoji in two section headings (a target and a trophy), promotional wording ("sovereign CTF proving ground", "live leaderboard"), and LaTeX math. Because the file can't change, the UI copy rules (no emoji, no puffery, no real-time claims) apply to text the UI writes, not to the file's content. The rendered view hides the two decorative emoji and otherwise shows the text as written, while the copy control and both URLs still return the file unchanged.
- **A9. Scoreboard disclosure.** Confirmed by the user. Standings live in server memory. They reset on restarts and cold starts and aren't shared between serverless instances, so a visitor may not find an entry that was just accepted. The scoreboard says so in one plain sentence (2.22).
- **A10. Base URL and skill.md URL.** Decided by the user, who chose the alternative over the proposal to show the origin of the page being viewed. The copyable base URL is always https://ctf.hakudigital.tech, whatever origin the page is viewed on, and the skill.md URL is https://ctf.hakudigital.tech/skill.md, with `GET /api/skill` listed as the equivalent endpoint. Both production URLs return 200 with a body byte-identical to public/skill.md. The gate try-it areas still call the relative `/api` paths of the origin being viewed, so a preview or local build exercises its own API.
- **A11. Console.** Confirmed by the user. The console stays, restyled, with equivalent commands (3.10). Dropping it or merging it into another view would need a separate decision by the user.
- **A12. Server messages.** Confirmed by the user. Messages such as "FLAG REJECTED: Invalid or fake flag token." and "[SHIELD TRIPWIRE] ..." come from the frozen API, so their wording stays. The UI shows each one verbatim under its own plain status label, for example "Rejected".
- **A13. Request budget.** Confirmed by the user. The API rate-limits per IP address. The UI makes no polling or other background requests (3.15), so it doesn't spend that budget on the visitor's behalf.
- **A14. Difficulty label.** Proposed, not yet confirmed. "Hell" is the difficulty name the user chose in c6d13ea. The UI shows it once as a difficulty label, "Difficulty: Hell", on the Overview and on each gate page. It is not added to gate names, so the UI uses the names the API gives, such as "Neural Sentry" for `NEURAL SENTRY`. The `name` fields in API responses stay as they are (A3).
- **A15. One source for gate facts.** Proposed, not yet confirmed. src/lib/gates.ts is the UI's single source for gate facts: names, points, TTLs, endpoints, payload fields, rules, constants such as Gate 2's C, and hints. Its values match the API at c6d13ea (A3), and components don't restate those facts inline. Every count shown for a live instance, such as outputs, variables, clauses, bytes, and opcodes, is derived from the response.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN any view loads THEN the system draws a fixed overlay above all content that darkens alternating 1.5px rows by 35% (scanlines), paints a green 40px grid behind the page, turns the scrollbar thumb neon green on hover, and keeps unused neon glow classes and "cyber" color variables in the global stylesheet.

1.2 WHEN colors render THEN the system uses 93 hex values written directly into the page and layout markup (10 distinct values, mostly GitHub's dark palette #0d1117, #161b22, #21262d and button greens #238636 and #2ea043, plus a neon #00ff66 accent used 25 times) and 139 uses of default Tailwind zinc and red classes, with no shared token set.

1.3 WHEN buttons and inputs render THEN the system styles each one separately: the green primary style goes to "Verify Flag", "Submit", and "Copy Spec", while Gate 1's main action "Send Prompt" and every "Request Instance" are grey. Padding and radius vary by component, and hover, focus, active, and disabled states are not defined as a set.

1.4 WHEN any view renders THEN the system sets 100% of its text in monospace. On the Arena view, 92.5% of characters are 12px, 6.8% are 10px or 11px, and the only larger text is the 14px "AGENTGATE" heading, which is the largest text on the site. Gate titles are 12px bold, the same size as their descriptions.

1.5 WHEN text and controls render THEN the system shows grey secondary text (zinc-500) at 10px to 12px with about 3.6:1 to 4.2:1 contrast against its backgrounds (#161b22, #0d1117, #06080d), below the 4.5:1 AA minimum. This covers endpoint and TTL labels, empty-state hints, table headers, "In Progress", and the footer. Unsolved scoreboard chips measure about 3.1:1, white text on the green button's hover color about 3.4:1, and the scanline overlay darkens all text further.

1.6 WHEN a visitor opens the site THEN the system shows a one-line tagline ("Autonomous Agent Proving Ground"), a flag form, and four gate cards, without saying what AGENTGATE is, who it is for, or how an agent starts. Outside the skill.md text, the only mention of the site's address is the footer's "Target: ctf.hakudigital.tech" (no scheme, no copy control), the skill.md URL never appears, and on a 360×780 screen the header and flag form fill the top 440px or so before any gate.

1.7 WHEN a visitor opens any view THEN the system places the flag submission form above that view's content, including Console, Scoreboard, and Protocol Spec, before the visitor has seen a gate.

1.8 WHEN the gates render (Arena view) THEN the system shows them as identical cards in a 2×2 grid with arbitrary icons: the chip icon is both the brand mark and Gate 3's icon, and Gates 2 and 4 use near-identical padlocks. Only Gate 1 shows its endpoint. Gates 2 to 4 show "TTL: Ns" but no challenge endpoint, submit endpoint, or payload fields.

1.9 WHEN a gate instance loads THEN the system shows only part of the response: Gate 2 omits the multiplier and modulus, Gate 3 shows 3 of 255 clauses next to hardcoded "Variables: 60 | Clauses: 255" and "... +252 clauses" text, Gate 4 omits the opcode table, and the full response can't be viewed.

1.10 WHEN a Gate 2, 3, or 4 instance request or submission fails with a network error THEN the system shows no message, and the only signal is an error sound.

1.11 WHEN a gate's challenge endpoint or Gate 1's chat endpoint returns an error body, such as HTTP 429 from rate limiting, THEN the system treats it as data: Gates 2 to 4 show an empty instance with a fresh countdown and a Submit button that does nothing, and Gate 1 shows an empty "Response:" box.

1.12 WHEN a gate request is in flight THEN the system dims and disables the Gate 2 to 4 buttons without any text or progress indication, and only Gate 1's button changes its label ("Testing...").

1.13 WHEN an instance's countdown reaches zero THEN the system shows "0s remaining" in red and disables Submit, with no expired message, no announcement to assistive technology, and no prompt to request a new instance.

1.14 WHEN Gate 1 answers THEN the system shows a prompt blocked by the filter and an answer without a flag the same way, as grey text in a grey box, and only a returned flag changes the box color.

1.15 WHEN a visitor submits the flag form with an empty handle or flag, or sends an empty Gate 1 prompt, THEN the system does nothing: it sends no request and shows no message.

1.16 WHEN a visitor enters a handle containing characters other than letters, digits, "_", "-", and ".", or longer than 24 characters, THEN the server records an altered handle (for example "my agent!" becomes "myagent"), and the system neither explains the format beforehand nor shows the recorded handle afterwards.

1.17 WHEN a visitor wants to copy the base URL, the skill.md URL, an endpoint, a returned flag, or the Proof-of-Pwn badge THEN the system offers no copy control, and flags and the badge are only selectable text. The one copy control, "Copy Spec", shows "Copied" without checking that the clipboard write succeeded, and before skill.md loads it copies the placeholder "Loading specification...".

1.18 WHEN the scoreboard loads or refreshes THEN the system shows no loading state, and when the request fails or is rate-limited it silently keeps the previous rows.

1.19 WHEN a visitor opens the skill.md documentation (the Protocol Spec view) THEN the system shows skill.md as raw Markdown in 12px monospace inside a 500px-tall inner scroll box, with "#", "**", list markers, code fences, and "$$" LaTeX as literal text. An error response from GET /api/skill would be displayed as if it were the document.

1.20 WHEN a visitor switches views THEN the URL stays "/", so no view can be linked or bookmarked, a reload returns to Arena, and back and forward don't move between views. The view buttons have no navigation or tab semantics and don't expose which view is current.

1.21 WHEN UI text renders THEN the system uses inflated or decorative phrasing, such as "AGENTGATE SOVEREIGN EXECUTION ENVIRONMENT", "Adversarial guardrail boundary deconstruction", "Formulate evasion vectors", "Enter adversarial prompt...", "DIRECTIVES", "Operational vectors", "Unknown directive", "[Dismiss]", and a " // " separator in the page title.

1.22 WHEN UI text describes status or gate mechanics THEN the system makes claims that nothing backs: the console help calls the scoreboard "Real-time standing", the console header shows a fixed "Connected" label, and the footer shows a fixed "4 Gates Active". Gate 2's description says to "derive multiplier state", although the instance response and skill.md both give the multiplier.

1.23 WHEN the same concept appears in different places THEN the system names it differently: "Scoreboard" and "leaderboard"; "Protocol Spec" and "Protocol Specification (skill.md)"; "Console" and "AgentGate Shell"; "SUBMIT FLAG" and "Verify Flag"; "Proof Token", "Verified Complete", and "Proof-of-Pwn"; "Request Instance" and "fetch entropy sequence", "generate 3-SAT problem", or "download bytecode".

1.24 WHEN the page is shared, indexed, or open in a browser tab THEN the system presents the description "The premier adversarial, cryptographic, and algorithmic CTF challenge arena designed exclusively for Autonomous AI Agents..." and the default Next.js favicon.

1.25 WHEN a visitor clicks any control, including the view buttons, THEN the system plays a sound, because sound starts on.

1.26 WHEN a flag is accepted THEN the system fires confetti across the page.

1.27 WHEN the visitor's system requests reduced motion THEN the system still fires the confetti and still requests smooth scrolling for console output.

1.28 WHEN a visitor tries to pinch-zoom THEN the viewport setting maximum-scale=1 blocks zoom in browsers that honor it, such as Chrome on Android.

1.29 WHEN a keyboard user moves focus THEN the Gate 1 prompt and the console input show no focus indicator, because the outline is removed and nothing replaces it, and the other inputs only shift their border from #27272a to #52525c, about 2.2:1 to 2.5:1 against the field background.

1.30 WHEN a screen reader reaches an input THEN the field's only label is its placeholder (agent handle, flag, Gate 1 prompt, Gate 2 X[6] to X[8], Gate 3 assignment, Gate 4 key, console command), and the visible "SUBMIT FLAG:" label is not associated with either flag-form input.

1.31 WHEN assistive technology reads the page structure THEN the header and footer sit inside the main landmark, the view buttons are not in a navigation landmark, and gate titles are not headings, so the Arena's only heading is the h1 "AGENTGATE". The two external links open a new tab without saying so and without a rel attribute.

1.32 WHEN a result, error, or copy confirmation appears THEN the system announces nothing to screen readers, because the page has no live regions.

1.33 WHEN status is shown THEN the system conveys some of it by color alone: solved and unsolved gate chips on the scoreboard (both read "G1" to "G4") and countdown urgency (red from 5 s for Gates 2 and 4, and from 3 s for Gate 3).

1.34 WHEN the page is 360px wide THEN the system lays the four view buttons in a 318px row inside a 294px content box, so the row runs into the header padding and "Protocol Spec" wraps onto two lines, making that button 44px tall next to 28px neighbors.

1.35 WHEN `npm run lint` runs THEN it exits with code 1, reporting 24 errors and 23 warnings. Sixteen errors are in UI code: in the page, 8 `no-explicit-any`, 6 unescaped quotes, and 1 setState call inside an effect; in the sound module, 1 `no-explicit-any`. The page also imports two unused icons (Clock, ExternalLink). The other 8 errors are `no-explicit-any` findings in frozen API and crypto files (A7).

### Expected Behavior (Correct)

2.1 WHEN any view loads THEN the system SHALL render no scanline overlay, text glow, or gradient text, and the global stylesheet SHALL contain no decorative classes or color variables outside the token set. Two effects are allowed for the cyber look the user approved on 2026-11-01: a faint grid on `body`, defined once in globals.css behind solid surfaces, and the `--shadow-glow` / `--shadow-glow-strong` accent halo, used only on primary actions, the current nav and gate item, the wordmark, the hero rule, and hovered gate cards. Neither effect may lower a token contrast pair below its minimum or act as a focus indicator.

2.2 WHEN colors render THEN the system SHALL take every color from one token set defined once, covering neutral surfaces, text, borders, one accent, and success, error, and warning. Component markup SHALL contain no raw color values (hex, rgb, oklch) and no default palette classes such as zinc-500 or red-400.

2.3 WHEN buttons, inputs, and other controls render THEN the system SHALL use a defined set of control variants, with at most one primary action per gate, form, or section, and one spacing scale and one radius scale. Every variant SHALL define hover, focus-visible, active, and disabled states.

2.4 WHEN any view renders THEN the system SHALL set interface text in a sans-serif typeface loaded through next/font and use monospace only for code and data (endpoints, flags, hex, numbers, tokens, console input and output). The monospace face SHALL be loaded the same way or be a deliberately chosen system stack, and the design document SHALL record the reason for both choices. Text SHALL follow a defined type scale with body text of at least 14px and nothing below 12px. Headings SHALL differ from body text in size and SHALL NOT rely on all-caps, which is limited to the AGENTGATE name and short labels such as HTTP methods and table headers.

2.5 WHEN text and controls render, in any state, THEN the system SHALL meet WCAG 2.2 AA contrast: at least 4.5:1 for normal text, 3:1 for large text, and 3:1 for control boundaries, focus indicators, and state indicators against adjacent colors. Disabled controls are exempt, as WCAG allows.

2.6 WHEN a visitor opens the site THEN the system SHALL state in plain language, at the top of the landing view and before the gates, what AGENTGATE is, who it is for, and how an agent starts (read skill.md, call the gate endpoints, submit flags to the scoreboard). It SHALL show the base URL https://ctf.hakudigital.tech and the skill.md URL https://ctf.hakudigital.tech/skill.md there, each with a copy control, and SHALL list `GET /api/skill` as the equivalent endpoint. Both URLs stay the same on every origin the page is viewed on (A10).

2.7 WHEN a visitor opens any view THEN the system SHALL NOT place the flag form ahead of the introduction or the gates, SHALL offer flag submission from every gate result that contains a flag and from the scoreboard, and SHALL keep flag submission reachable from every view.

2.8 WHEN the gates render THEN the system SHALL present them as an ordered progression from Gate 1 to Gate 4. Each gate SHALL show its number, name, points, TTL where it has one, the method and path of each endpoint with a copy control, and the request payload fields, with the values in A3. The system SHALL state that the 10 to 20 s TTLs of Gates 2 to 4 are sized for agents and that the browser area is for inspecting a live instance. Gate 1's page and its try-it area SHALL state its four checks in plain words: 50 to 500 characters after trimming, none of the blocked words, one of the accepted framing words, and a SHA-256 digest of the trimmed prompt that starts with "0000". The try-it area SHALL say that a prompt typed by hand passes the last check about 1 time in 65,536, so an agent has to search for a nonce to put in the prompt. The browser offers no nonce helper (A6), and whether to add one is an open question for the user. Icons, if used, SHALL differ per gate and SHALL NOT reuse the brand mark.

2.9 WHEN a gate instance loads THEN the system SHALL show the fields a solver needs and let the visitor view the complete response as JSON. For Gate 2 that means the truncated outputs, labeled X1 to X4 and described as the top 48 bits (X >> 16) of each state, plus the multiplier A, the increment C from src/lib/gates.ts, and the modulus. For Gate 3 it means the variable count, the clause count, and a clause preview. For Gate 4 it means the bytecode and the opcode table. Every count SHALL be derived from the response (A15).

2.10 WHEN a Gate 2, 3, or 4 instance request or submission fails with a network error THEN the system SHALL show a message in that gate's area saying the request didn't reach the server, with a way to retry.

2.11 WHEN a gate's challenge endpoint or Gate 1's chat endpoint returns an error body THEN the system SHALL show an error state with the server's message, including the retry time for rate limits, and SHALL NOT show an instance, a countdown, or an enabled Submit.

2.12 WHEN a gate request is in flight THEN the control that started it SHALL show a busy state in text and be disabled, and the gate SHALL NOT accept a second submission until the response arrives.

2.13 WHEN an instance's countdown reaches zero THEN the system SHALL mark the instance "Expired" in text, keep Submit disabled, announce the expiry once to assistive technology, and offer a control to request a new instance.

2.14 WHEN Gate 1 answers THEN the system SHALL distinguish in text between a prompt blocked by the filter, an answer without a flag, and an answer with a flag. Any `allowed: false` response counts as blocked, including a failed proof-of-work check, and its server message is shown verbatim (A12). c6d13ea never sends an allowed answer without a flag, but the UI keeps that state.

2.15 WHEN a visitor submits the flag form with an empty handle or flag, or sends an empty Gate 1 prompt, THEN the system SHALL send no request and SHALL show a message at the empty field saying it is required.

2.16 WHEN a visitor enters a handle containing characters other than letters, digits, "_", "-", and ".", or longer than 24 characters, THEN the system SHALL tell the visitor before submission that the handle doesn't match the accepted format (letters, digits, "_", "-", ".", up to 24 characters), and an accepted-flag result SHALL show the handle as the server recorded it.

2.17 WHEN a visitor wants to copy the base URL, the skill.md URL, an endpoint, a returned flag, or the Proof-of-Pwn badge THEN the system SHALL offer a copy control for each that confirms success in text, reports failure, and is announced to assistive technology. The skill.md copy control SHALL be unavailable until the file has loaded.

2.18 WHEN the scoreboard loads or refreshes THEN the system SHALL show a loading state while the request runs, and on failure or rate limiting SHALL show an error with the server's message.

2.19 WHEN a visitor opens the skill.md documentation THEN the system SHALL render it as formatted documentation in the page flow, without a fixed-height inner scroll box: headings, paragraphs, lists, links, inline code, and fenced code blocks set in monospace that scroll horizontally on their own. No Markdown or LaTeX syntax SHALL appear as literal text outside code, and math SHALL be typeset or shown as a formatted code expression. Decorative emoji follow A8. When the file fails to load, the system SHALL show an error state instead of the document.

2.20 WHEN a visitor switches views THEN each view SHALL have its own URL, opening or reloading that URL SHALL show that view, and back and forward SHALL move between visited views. The view switcher SHALL be a navigation landmark that marks the current view programmatically, and the gates, the scoreboard, and the documentation SHALL each be one step away from any view.

2.21 WHEN UI text renders THEN the system SHALL use plain, specific sentences that say what the visitor or the agent does, and none of the phrases quoted in 1.21 SHALL appear. Terms that name the actual task, such as LCG, 3-SAT, DIMACS, opcode, and stack VM, MAY stay. Server messages follow A12.

2.22 WHEN UI text describes status or gate mechanics THEN the system SHALL NOT claim real-time updates, persistence, connection state, or any other status it doesn't measure. The scoreboard SHALL say that standings are kept in server memory and can reset (A9). Each gate's description SHALL agree with the API's behavior at c6d13ea and with skill.md (A3). For example, Gate 2's description states that A and C are both given and that each output shows only the top 48 bits of the state. Where a response's own `description` text is stale (A3), the UI follows the behavior.

2.23 WHEN the same concept appears in different places THEN the system SHALL use one term for it in navigation, headings, buttons, and messages: gate, instance, flag, agent handle, scoreboard, skill.md, and Proof-of-Pwn badge, plus one name each for the console and documentation views. The console's existing `leaderboard` command keeps working (3.10).

2.24 WHEN the page is shared, indexed, or open in a browser tab THEN the system SHALL present a factual title and description without superlatives such as "premier" and "exclusively" or decorative separators, and a favicon made for this site.

2.25 WHEN a visitor clicks any control THEN the system SHALL play no sound unless the visitor has turned sound on. The sound toggle SHALL start off and expose its on or off state to assistive technology.

2.26 WHEN a flag is accepted THEN the system SHALL confirm it with a visible, announced message and SHALL NOT launch a full-page particle effect. Any success animation SHALL stay inside the result area.

2.27 WHEN the visitor's system requests reduced motion THEN the system SHALL run no non-essential animation, including success effects and smooth scrolling.

2.28 WHEN a visitor tries to pinch-zoom or zooms text to 200% THEN the system SHALL allow it, with no maximum-scale or user-scalable limit in the viewport, and all content and functions SHALL stay available.

2.29 WHEN a keyboard user moves focus THEN every focusable element SHALL show a visible focus indicator with at least 3:1 contrast against adjacent colors, focus order SHALL follow the visual order, and every function SHALL work from the keyboard alone.

2.30 WHEN a screen reader reaches an input THEN the input SHALL have a visible label that is programmatically associated with it, and format hints such as "16 hex characters" or "JSON array" SHALL be visible text associated as its description, not only a placeholder.

2.31 WHEN assistive technology reads the page structure THEN the system SHALL expose header, navigation, main, and footer landmarks as siblings, and a heading hierarchy without skipped levels in which every view, section, and gate has a heading. Links that open a new tab SHALL say so and set rel="noopener noreferrer".

2.32 WHEN a result, error, expiry, or copy confirmation appears THEN the system SHALL announce it through a live region without moving focus, and new console output SHALL be announced too.

2.33 WHEN status is shown THEN the system SHALL convey it with text, or an icon with a text alternative, in addition to color. This covers solved and unsolved gates, accepted and rejected results, expiring and expired instances, and the current view.

2.34 WHEN the page is 360px wide or wider THEN navigation labels SHALL NOT wrap or be clipped, no content SHALL overlap or be clipped, and the page SHALL NOT scroll horizontally. Code blocks and tables MAY scroll horizontally inside their own container.

2.35 WHEN ESLint checks the UI code, meaning every file under src/ except the frozen files in A3, THEN it SHALL report zero errors and zero warnings, with no `any` and no unused imports. The design document gives the exact command that lints only those files, and that command is the verification check. The 8 existing errors in frozen files stay, so `npm run lint` is expected to keep exiting with code 1 (A7).

### Unchanged Behavior (Regression Prevention)

3.1 WHEN any client calls an `/api/*` endpoint THEN the system SHALL CONTINUE TO return the same status codes and response bodies as c6d13ea, with the same TTLs (15, 10, and 20 s for Gates 2 to 4), Gate 1 checks, instance sizes, rate limits, flag checks, handle cleanup, points (1,000, 2,000, 2,500, and 3,000, for 8,500 in total), and Proof-of-Pwn badge generation, as listed in A3. The frozen files in A3 SHALL NOT change from c6d13ea.

3.2 WHEN a client requests `GET /api/skill` or `/skill.md` THEN the system SHALL CONTINUE TO return the unmodified content of public/skill.md as committed in c6d13ea, as both do today, and `GET /api/skill` SHALL CONTINUE TO send Content-Type "text/markdown; charset=utf-8" and Access-Control-Allow-Origin "*".

3.3 WHEN the c6d13ea test_agent_solver.py runs against a production build served by `next start -p 3008` THEN it SHALL CONTINUE TO recover all four flags, have each one accepted by the scoreboard, and receive a Proof-of-Pwn badge. The committed script sets `BASE = "https://ctf.hakudigital.tech"` and registers the handle JABRIK. To keep the file byte-identical and leave the live scoreboard alone, verification runs a temporary copy whose only change is that `BASE` line, set to http://localhost:3008. The script needs the Python packages requests and z3-solver. The user allows `pip install z3-solver` so that the full run, Gate 3 included, takes place during verification.

3.4 WHEN a visitor submits a non-empty handle and flag THEN the system SHALL CONTINUE TO POST `{agentName, flag}` to `/api/scoreboard`, show accepted or rejected feedback with the server's message, show the Proof-of-Pwn badge when the response includes one, refresh the scoreboard after an accepted flag, and let the visitor dismiss the feedback.

3.5 WHEN any gate response contains a flag THEN the system SHALL CONTINUE TO fill the flag field with it and leave the agent handle unchanged.

3.6 WHEN a visitor sends a non-empty Gate 1 prompt THEN the system SHALL CONTINUE TO POST `{prompt}` to `/api/gate1/chat` and show the response text, plus the flag when one is returned.

3.7 WHEN a visitor requests a Gate 2, 3, or 4 instance THEN the system SHALL CONTINUE TO GET that gate's challenge endpoint, clear the previous result, show the instance with a countdown starting at the response's `ttlSeconds`, and POST the `sessionToken` with `predictions`, `assignment`, or `keyHex` to that gate's submit endpoint. Submit SHALL CONTINUE TO be disabled once the countdown reaches zero and while a request is in flight.

3.8 WHEN a visitor enters Gate 2 predictions or a Gate 4 key THEN the system SHALL CONTINUE TO submit the values with surrounding whitespace removed, and Gate 2 SHALL CONTINUE TO submit exactly three values in the order of the next three outputs, which are X5, X6, and X7 at c6d13ea (X6 to X8 at afe2537).

3.9 WHEN the Gate 3 assignment is not valid JSON THEN the system SHALL CONTINUE TO skip the API call and show "Malformed assignment array. Expected valid JSON format.", and valid JSON SHALL CONTINUE TO be sent as parsed, so boolean arrays and signed-literal arrays both reach the server unchanged. A3 describes how the server reads each one.

3.10 WHEN a visitor runs help, gates, solve 1 to 4, leaderboard, or clear in the console, in any letter case, THEN the system SHALL CONTINUE TO return equivalent information: the command list; each gate's number, name, points, endpoint, and TTL; that gate's solving hint; the standings as last loaded, with rank, handle, score, and gates, or an empty message; and a cleared output. Unknown commands and `solve` without a valid gate number SHALL CONTINUE TO return usage help. A11 covers dropping or merging the console.

3.11 WHEN the scoreboard view opens or the visitor refreshes it THEN the system SHALL CONTINUE TO GET `/api/scoreboard` and list entries in the order returned, with rank, agent handle, score, gates solved, and proof status (complete when the entry has a Proof-of-Pwn badge, otherwise in progress), and an empty state when there are no entries.

3.12 WHEN the visitor copies skill.md THEN the system SHALL CONTINUE TO put the exact file content on the clipboard.

3.13 WHEN any view renders THEN the system SHALL CONTINUE TO credit Haku Digital with a link to https://hakudigital.tech, and the metadata SHALL CONTINUE TO name Haku Digital as author.

3.14 WHEN a visitor moves between views without a full page reload THEN the system SHALL CONTINUE TO keep the agent handle, the flag field, live instances with running countdowns, gate inputs and results, and console history.

3.15 WHEN the UI is open THEN the system SHALL CONTINUE TO call the API only on page load, on opening a view that needs data, and on explicit visitor actions, with no polling or other background requests (A13).

3.16 WHEN gate points, TTLs, endpoints, or instance facts appear anywhere in the UI THEN the system SHALL CONTINUE TO show the values the API uses at c6d13ea (A3): 1,000, 2,000, 2,500, and 3,000 points, for 8,500 in total; 4 truncated outputs and 3 predictions for Gate 2; 120 variables and 512 clauses for Gate 3; 9 opcodes for Gate 4; TTLs of 15, 10, and 20 s for Gates 2 to 4; `POST /api/gate1/chat`; `GET /api/gateN/challenge` and `POST /api/gateN/submit` for N = 2, 3, 4; `GET` and `POST /api/scoreboard`; and `GET /api/skill`.

3.17 WHEN any view renders THEN the system SHALL CONTINUE TO show no emoji in text the UI writes (rendered skill.md content follows A8), and SHALL CONTINUE TO render in English with a dark theme only (A4).

3.18 WHEN the page is 360px wide THEN the system SHALL CONTINUE TO have no horizontal page scroll. Today the document width equals the 360px viewport.

3.19 WHEN `npm run build` runs THEN it SHALL CONTINUE TO pass, and runtime dependencies SHALL CONTINUE TO exclude test tooling. Any test tooling added later goes in devDependencies with a stated reason.
