### skill.md Rendering

#### Decision

Render skill.md with a small in-house parser in `src/lib/markdown.ts` that returns a typed tree, mapped to React elements by a server component. No Markdown dependency is added.

- Safety: the parser never produces HTML strings and nothing uses `dangerouslySetInnerHTML`. Every text value reaches the DOM as a React text node, so `<TOKEN>` and `<16_HEX_CHARACTERS_OF_8_BYTE_KEY>` are escaped by React. The only generated attribute values are heading ids (slugified to `[a-z0-9-]`) and `https://` link targets.
- Client JS: zero for the document. The page is a server component prerendered at build. The only client component on the page is the copy control.
- Maintenance: public/skill.md is frozen (A3), so the parser covers exactly the constructs below. A unit test parses the real file and fails if the tree contains a `literal` fallback node or if any rendered text outside code contains `**`, `$$`, `$`, a line-leading `#`, `* `, or a backtick. If skill.md changes later and uses a new construct, that test points to the gap. Unsupported lines render as plain escaped paragraphs, never as HTML.
- Rejected: marked 18.1.2 (534 kB unpacked) and markdown-it 15.0.3 (2.06 MB unpacked plus 6 dependencies) emit HTML strings, which would need `dangerouslySetInnerHTML`, and neither parses `$$` without a plugin.
- Rejected: react-markdown 10.1.0 (53 kB itself, React >= 18 peer, works in a server component) pulls in the unified, remark, mdast, and hast packages and would still need remark-math plus custom handlers for the emoji, math, link, and heading-level rules. That is more code to configure than the parser itself.

#### Constructs in public/skill.md

Surveyed on the current file: 3,081 bytes, UTF-8 without BOM, LF line endings. The table lists every construct the parser must handle. Line numbers are 1-based.

| Construct | Where | Notes |
|---|---|---|
| ATX heading `#` | line 1 | Contains an em dash (U+2014). |
| ATX heading `##` with leading emoji | line 9 (U+1F3AF), line 73 (U+1F3C6) | Emoji followed by one space. |
| ATX heading `###` | lines 13, 22, 37, 50 | Gate headings, for example "Gate 2: ENTROPY FRACTURE (1,000 pts)". |
| Paragraph | lines 3, 5, 11, 75, 85 | Each is one line in this file. The parser still joins consecutive lines with a space. |
| Bold `**…**` | lines 3, 14 to 63, 85 | Inside paragraphs and list items. |
| Inline code | throughout | Includes `https://ctf.hakudigital.tech`, `http://localhost:3000`, `HAKU{...}`, `<TOKEN>`. |
| Paragraph that is only inline code | line 77 | `POST /api/scoreboard`. |
| Thematic break `---` | lines 7, 71 | |
| Bullet list, `* ` marker | lines 14 to 63 | Top level at indent 0. |
| Nested bullet list, 2-space indent | lines 25, 40, 53, 55 to 62 | One level of nesting only. |
| Fenced code block inside a list item, info string `json`, indented 2 | lines 17, 30, 42, 64 | Fence directly follows the item's first line with no blank line. |
| Comment inside a json fence | line 45 | `// or signed literals [1, -2, 3, ...]`, kept verbatim. The block is not valid JSON, so no JSON parsing or highlighting. |
| Top-level fenced code block, `json` | lines 78 to 83 | |
| Display math `$$…$$` as a list-item continuation line | line 27 | `X_{n+1} = (A \cdot X_n + C) \pmod{2^{64}}` |
| Inline math `$…$` in a continuation paragraph | line 28 | `A = 6364136223846793005` |
| Intraword underscores outside code | lines 55 to 62 | `PUSH_KEY_BYTE` and similar. Never treated as emphasis. |

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

1. A fence opens on `^( *)```(\w*)\s*$`. Content runs to the next line matching `^ *```\s*$`. Each content line loses up to the opening fence's indent in leading spaces. The value is otherwise kept byte for byte, including the comment on line 45.
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
| AGENTGATE CTF — Autonomous AI Battleground Specification | h2 | `agentgate-ctf-autonomous-ai-battleground-specification` |
| Protocol Overview | h3 | `protocol-overview` |
| Gate 1: NEURAL SENTRY (500 pts) | h4 | `gate-1-neural-sentry-500-pts` |
| Gate 2: ENTROPY FRACTURE (1,000 pts) | h4 | `gate-2-entropy-fracture-1000-pts` |
| Gate 3: LOGIC MAZE (1,250 pts) | h4 | `gate-3-logic-maze-1250-pts` |
| Gate 4: BYTECODE VAULT (1,500 pts) | h4 | `gate-4-bytecode-vault-1500-pts` |
| Submitting Flags to Scoreboard | h3 | `submitting-flags-to-scoreboard` |

Each heading's text is wrapped in a plain `<a href="#id">` (not next/link), so `/docs#gate-3-logic-maze-1250-pts` can be linked and the browser handles the fragment. The anchor uses the heading color and shows an underline on hover and focus-visible. Headings get `scroll-margin-top` equal to the header height only if the structure part makes the header sticky. Gate pages may link to their section with these ids.

#### Math

Typeset with HTML `<var>`, `<sub>`, and `<sup>` in the monospace face, plus a spoken text alternative. KaTeX is not added: it is a large dependency with its own CSS and fonts, for two formulas in a frozen file.

`texToNodes` supports this TeX subset: single Latin letters (rendered as `<var>`), digits, `+ - = ( )`, spaces, `_x` and `_{…}` (sub), `^x` and `^{…}` (sup), `\cdot` (·, U+00B7), and `\pmod{m}` (rendered " mod m"). Any other command makes it return `null`, and the renderer falls back to `<code>` containing the raw TeX, which still meets 2.19 as a formatted code expression.

Rendered results:

- Display, line 27: <var>X</var><sub><var>n</var>+1</sub> = (<var>A</var> · <var>X</var><sub><var>n</var></sub> + <var>C</var>) mod 2<sup>64</sup>
  - Markup: `<p class="math-display"><span aria-hidden="true">…typeset…</span><span class="sr-only">X sub n+1 = (A times X sub n + C) mod 2 to the power 64</span></p>`.
  - `texToSpeech` builds the spoken string by mapping `_` to "sub", `^` to "to the power", `\cdot` to "times", and `\pmod{m}` to "mod m". Without it, screen readers would read "mod 2 64".
- Inline, line 28: "Multiplier: <var>A</var> = 6364136223846793005."
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
   - The copy control, labeled "Copy skill.md". It receives the `source` string as a prop, so the clipboard gets exactly the 3,081 bytes of the file (3.12). The string is complete in the server-rendered props, so the control is never available before the file has loaded (2.17). Like every copy control, it stays disabled until hydration (see Copy Controls).
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

`/docs` uses no request-time APIs (no cookies, headers, or searchParams), and next.config.ts does not enable `cacheComponents`. Next therefore prerenders the page at build time, and the file is read once during `next build`. Verification: the `next build` route table marks `/docs` as static (○). Because the page is static, a read failure at build time would ship the error state. The build log shows the `console.error` line in that case (see Issues for merge).

### Accessibility Mechanisms

Contrast values come from the visual-system part and are not repeated here. Requirement numbers are in parentheses.

#### Landmarks and Skip Link (2.31)

`src/app/layout.tsx` renders these as direct children of `<body>`, in this order:

1. `<a href="#main" class="skip-link">Skip to main content</a>`. It is visually hidden until focused, then shown at the top left with the focus ring.
2. `<header>`: the brand link "AGENTGATE" to `/`, the "Submit flag" button with its dialog, and the sound toggle.
3. `<nav aria-label="Site">`: the five view links.
4. `<main id="main" tabIndex={-1}>`: the page content, then the page live region (see Live Regions) as its last child.
5. `<footer>`: the Haku Digital credit.

Header, nav, main, and footer are siblings. Because none is nested in another landmark, the header maps to banner and the footer to contentinfo. Visually the nav may sit in the same bar as the header through CSS grid, but not by nesting it in the DOM. The skip link targets `main`, which can take focus because of `tabIndex={-1}`. A plain `<a>` hash link moves focus there natively.

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

FlagForm takes a `headingLevel: 2 | 4 | null` prop: 2 on /scoreboard, 4 inline in a gate result, and `null` in the dialog, where the dialog title names the form through `aria-labelledby`. The copy part owns the exact heading wording. The levels above are fixed.

#### Labels, Hints, and Errors (2.15, 2.16, 2.30)

- Every input has a visible `<label htmlFor>`. Ids come from React `useId`. Placeholders are optional and never the only label or hint.
- Format hints are visible `<p id="{id}-hint">` elements. The input gets `aria-describedby="{id}-hint"`.
- An error is a `<p id="{id}-error">` holding an error icon (`aria-hidden`) and a sentence. While the error shows, the input gets `aria-invalid="true"` and `aria-describedby="{id}-error {id}-hint"`. Without an error, `aria-invalid` is absent.
- Required fields carry the `required` attribute. Forms use `noValidate`, so the app's own messages replace browser validation bubbles.
- On submit with errors, no request is sent and focus moves to the first invalid field. The screen reader then reads the label, "invalid", and the error through the description, so no live announcement is made for field errors. That avoids double announcements.
- Handle format (2.16): the check from `src/lib/validation.ts` runs on blur and on submit. Once the error is showing, it re-runs on every input event and clears as soon as the value is valid. The hint states the format ahead of time: letters, digits, "_", "-", ".", up to 24 characters.
- Gate 2's three inputs sit in a `<fieldset>` whose `<legend>` names the predictions. Each input is labeled X6, X7, or X8 and shares one hint about the number format.
- The Gate 3 JSON error (3.9) uses this same field-error pattern on the assignment textarea, with the exact text "Malformed assignment array. Expected valid JSON format."
- Contract for the labels (the copy part may adjust the wording):
  - Agent handle: the format hint above.
  - Flag: "Format: HAKU{...}".
  - Prompt.
  - X6, X7, and X8.
  - Assignment: a hint naming the JSON array forms, with the variable count taken from the instance.
  - Key: "16 hex characters (8 bytes)".
  - Command: "Type help to list commands."

#### Live Regions (2.32)

One announcer, owned by AppStateProvider, exposes `announce(message: string)`. It is the only source of app announcements except the console log.

- Markup: `<div role="status" aria-live="polite" aria-atomic="true" class="sr-only">`, rendered by a `LiveRegion` component.
- Repeated messages: `announce` clears the text, then sets the new text 100 ms later, so "Base URL copied." is spoken again on a second click. The text is cleared 5 s later so the virtual cursor doesn't find stale messages.
- Modal dialogs: content outside an open modal `<dialog>` is inert and hidden from assistive technology, so a region in `<main>` would stay silent while the Submit flag dialog is open. `LiveRegion` is therefore rendered twice: as the last child of `<main>` and as the last child of the dialog. The provider keeps `flagDialogOpen`, and `announce` writes only to the dialog's region while that is true, otherwise only to the page region.
- Visible result areas (gate results, flag-form feedback, scoreboard errors, copy status) are not live regions. Each of them calls `announce` once when its state changes. Every message is therefore spoken exactly once.
- Next's route announcer is separate (see Route Changes and Focus).

Messages (wording may be refined by the copy part; the events are fixed):

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
- The expiring threshold lives in `src/lib/gates.ts`: 5 s for Gates 2 and 4 and 3 s for Gate 3, matching today's red thresholds. At or below it, the text becomes "Expiring, {n} s left" with the warning token and an icon (`aria-hidden`), so urgency doesn't rely on color.
- Announcements: once at start ("instance ready") and once on expiry. There is no near-expiry announcement, because with TTLs of 10 to 20 s a third message would interrupt the visitor while they read the instance.
- On expiry the gate page shows the status "Expired" in text, Submit stays natively `disabled` (3.7), and the request button reads "Request new instance".
- The expiry announcement fires from the mounted gate page when it observes the live → expired transition for the current instance, once per instance. If the visitor is on another view at that moment, nothing is announced. On return, the page shows "Expired" and the route announcer reads the title.
- If Submit had focus at the moment it became disabled, focus moves to the "Request new instance" button. Otherwise the browser's focus fixup would drop focus to `<body>`.

#### Busy and Disabled Controls (2.12, 2.29)

- A control that starts a request shows busy text, such as "Requesting instance…", "Submitting…", or "Sending…".
- While busy, it gets `aria-disabled="true"` instead of the `disabled` attribute and ignores activation. The form's submit handler also returns early while that gate's state is `loading`, so a second submission can't start (2.12). A focused button therefore keeps focus while busy, and the visitor's place is not lost. Native `disabled` would drop focus to `<body>` at every submit.
- Controls that are unavailable rather than busy use native `disabled`: Submit without a live instance or after expiry (3.7), and copy controls before hydration.
- The visual-system part styles `[aria-disabled="true"]` and `:disabled` identically.

#### Focus Indicator (2.29)

- globals.css sets one base rule: `:focus-visible { outline: 2px solid <focus-ring token>; outline-offset: 2px; }`. The token is the focus-ring color the visual-system part defines.
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
- The current view also gets a non-color indicator, such as a 2px bar and a heavier weight, defined by the visual-system part.
- A gate stepper, if the structure part adds one, is a second `<nav aria-label="Gates">` with the same `aria-current` rule.
- The sound toggle is `<button type="button" aria-pressed={soundOn}>`, starting at `false` (2.25). Its accessible name is always "Sound". The visible "Sound off" or "Sound on" text and the icon swap (Volume2 or VolumeX) sit in an `aria-hidden` span, so the name never changes while the state is exposed through `aria-pressed`. Toggling is not announced through the announcer, because screen readers already speak the pressed-state change.

#### Status in Text (2.33)

- Gate results: a text label, "Accepted", "Rejected", "Blocked", "Server error", or "Network error", with an icon (`aria-hidden`). Color is an extra signal.
- Instances: "Expiring" and "Expired" as text (see Countdown).
- Scoreboard gates column: `<ul aria-label="Gates solved">` with four chips. Each chip shows the gate number and a Check or Circle icon (`aria-hidden`), with the visible "G1" text `aria-hidden` and an sr-only "Gate 1 solved" or "Gate 1 not solved".
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
  - When the promise resolves, it shows "Copied" for 3 s in an `aria-hidden` span next to the button and calls `announce("{Label} copied.")`.
  - When the promise rejects or the Clipboard API is missing (for example, outside a secure context), it shows "Copy failed" and calls the failure announcement.
  - Success is never reported without checking the promise (fixes 1.17).
- The copied value is always also visible as selectable text.
- The button is natively `disabled` until hydration. The hook is `useSyncExternalStore(() => () => {}, () => true, () => false)`, which avoids a setState call inside an effect.
- Instances: base URL, skill.md URL, every endpoint (method and path as one string), each returned flag, the Proof-of-Pwn badge, and the full skill.md text on /docs.

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
- Pointer targets are at least 24×24 CSS px (WCAG 2.5.8). The visual-system part sizes them.

### Dependencies and Tooling

#### Runtime

- Remove `canvas-confetti` from dependencies and `@types/canvas-confetti` from devDependencies (A5, 2.26). Remove its import from the UI.
- No Markdown or math dependency is added. skill.md uses the in-house parser in `src/lib/markdown.ts`.
- Fonts load through `next/font`, which ships with `next`, so they add no package. The visual-system part picks the faces.
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

#### Issues for merge

- **Busy state uses `aria-disabled`, not native `disabled` (2.12).** This keeps focus on a control while its request runs. Tests and the test-tooling part must assert `aria-disabled="true"` plus "no second request" for busy controls, and native `disabled` only for Submit without a live instance or after expiry (3.7). Testing Library's `toBeDisabled()` does not detect `aria-disabled`.
- **Landmarks are direct children of `<body>`.** The structure part's layout must not nest the nav in the header to get a single bar. Use CSS grid instead.
- **The header should not be sticky.** This is for 200% zoom and WCAG 2.4.11. If the structure or visual part makes it sticky, add `scroll-padding-top` and `scroll-margin-top` on the docs headings.
- **Unique titles.** Every route needs a distinct `metadata.title`, because Next 16.4.3's route announcer speaks it on each client navigation.
- **Live region in the dialog.** The provider needs a `flagDialogOpen` flag, and the `LiveRegion` component is placed both in `<main>` and in the dialog. The modal dialog makes `<main>` inert, which would otherwise silence announcements.
- **Static error state.** `/docs` is static, so a skill.md read failure at build time ships the error state and is visible only in the build log. Failing the build instead would contradict 2.19. The user may prefer that the build fail.
- **Facts for the test part.**
  - skill.md is 3,081 bytes, UTF-8, LF line endings, no BOM.
  - The heading-id table above and the "no Markdown syntax outside code" check are good unit tests for `markdown.ts`.
  - The `useSyncExternalStore` hydration hook and the interval-driven countdown avoid `react-hooks/set-state-in-effect` from eslint-plugin-react-hooks 7.1.1.
- **Facts for the visual-system part.**
  - The focus ring must be drawn with `outline`.
  - `[aria-disabled="true"]` needs the same style as `:disabled`.
  - Code blocks in the docs (`pre`) take focus and need the ring.
