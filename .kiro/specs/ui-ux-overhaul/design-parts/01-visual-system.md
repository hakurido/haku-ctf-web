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
- **Header at narrow widths.** Below 640px the header is two rows: brand and actions on the first, nav on the second. The nav list is `flex flex-wrap gap-1` and every item is `whitespace-nowrap`. Labels then never wrap or clip at 360px, and if the five items don't fit on one line the list wraps onto a second line.
- **Gate page.** At `lg` and above, two columns: reference (description, endpoints, payload fields) and try-it, split 5:7. Single column below `lg`.
- **Elevation.** Lightness steps only: inset < canvas < surface < surface-hover. The dialog is the only element with a shadow (`shadow-dialog`, black, no hue). No glows, colored shadows, hover lifts, or blurs.

#### Control variants and states

Shared rules:
- Every focusable element gets the global `:focus-visible` ring (2px `focus`, offset 2px). Components don't remove it or restyle it.
- Every transition is `transition-colors duration-120 ease-standard`.
- Button sizes: `md` is `h-9 px-4 gap-2` and `sm` is `h-8 px-3 gap-1.5`. Labels are `text-ui font-medium`, icons `size-4`.
- At most one primary per gate, form, or section. In a gate's try-it area the primary is "Request instance" when idle or expired, and "Submit" while an instance is live. The request control then becomes secondary ("Request new instance"). In the flag form the primary is "Submit flag". On Overview it is the "Read the docs" link styled as primary. The header "Submit flag" button is secondary so it doesn't compete with page primaries.
- Busy controls carry `disabled` and `data-busy`. Disabled styles are written as `disabled:not-data-busy:*`, so a busy control keeps its normal colors with `cursor-progress` and doesn't look unavailable.

| Control | Default | Hover | Focus-visible | Active | Disabled | Busy |
|---|---|---|---|---|---|---|
| Primary button | `bg-accent text-on-accent` | `bg-accent-hover` | Ring | `bg-accent-active` | `bg-surface-hover text-fg-disabled border border-line cursor-not-allowed` | Default colors; label becomes the busy text ("Requesting instance…", "Submitting…", "Sending…"); `LoaderCircle` `size-4 motion-safe:animate-spin` replaces the leading icon |
| Secondary button | `bg-surface text-fg border border-line-control` | `bg-surface-hover border-fg-muted` | Ring | `bg-inset` | Same as primary disabled | Same pattern as primary |
| Quiet button | `bg-transparent text-fg-secondary` | `bg-surface-hover text-fg` | Ring | `bg-line text-fg` | `text-fg-disabled bg-transparent` | n/a |
| Icon button | Quiet geometry `size-9` (`size-8` in dense rows), icon `size-4`, `aria-label` required | Quiet hover | Ring | Quiet active | Quiet disabled | n/a |
| Sound toggle | Icon button with `aria-pressed`: `VolumeX` plus visible "Sound off" from `sm` up, `Volume2` plus "Sound on" when pressed | Quiet hover | Ring | Quiet active | n/a | n/a |
| Text input | `h-9 w-full rounded-md border border-line-control bg-inset px-3 text-ui text-fg placeholder:text-fg-muted`; data fields (flag, hex key, predictions, console) add `font-mono text-code` | `border-fg-muted` | Ring (border unchanged) | n/a | `bg-canvas border-line text-fg-disabled cursor-not-allowed` | n/a |
| Textarea | Text input styles plus `min-h-24 py-2 resize-y`; Gate 1 prompt in sans, Gate 3 assignment in mono | Same | Ring | n/a | Same | n/a |
| Validation error | `aria-invalid:border-error` on the field. Below it: `mt-1.5 flex gap-1.5 text-ui text-error` with `CircleX` `size-4` and text such as "Agent handle is required", linked by `aria-describedby` | n/a | Ring | n/a | n/a | n/a |
| Field label and hint | Label `text-ui font-medium text-fg mb-1.5`. Hint `text-ui text-fg-muted mt-1.5`, for example "16 hex characters" | n/a | n/a | n/a | n/a | n/a |
| Nav item | `relative h-9 px-3 rounded-md text-ui font-medium text-fg-secondary whitespace-nowrap` (`px-2` below 640px) | `bg-surface-hover text-fg` | Ring | `bg-line` | n/a | n/a |
| Nav item, current | `aria-current="page"`: `text-fg bg-surface-hover font-semibold`, plus a 2px bar `after:absolute after:inset-x-3 after:bottom-1 after:h-0.5 after:rounded-full after:bg-accent`. The bar and weight are the non-color cues | Same | Ring | Same | n/a | n/a |
| Copy control | Secondary `sm`, `min-w-24` so the width doesn't change: `Copy` icon + "Copy" (or "Copy URL", "Copy flag", "Copy badge", "Copy skill.md") | Secondary hover | Ring | Secondary active | Secondary disabled, used for skill.md before it loads | n/a |
| Copy control, copied | `Check` icon + "Copied", `text-success`, for 2000ms, then idle | Same | Ring | n/a | n/a | n/a |
| Copy control, failed | `CircleX` icon + "Copy failed", `text-error`, for 4000ms, then idle | Same | Ring | n/a | n/a | n/a |
| Copy control, icon-only (endpoint rows) | Icon button `size-8` with `aria-label="Copy POST /api/gate1/chat"`. State text "Copied" or "Copy failed" appears next to it in `text-ui` with the same colors | Same | Ring | Same | n/a | n/a |
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

#### Issues for merge

- **Countdown threshold.** This part uses one warning threshold of 5 s or less for all gates. Today Gate 3 turns red at 3 s and Gates 2 and 4 at 5 s. The interaction part should use the same 5 s rule.
- **Busy controls.** They keep `disabled` and add `data-busy`, so the disabled look doesn't apply while busy. The interaction and accessibility parts should set both attributes.
- **Favicon file.** Deleting src/app/favicon.ico and adding src/app/icon.svg are UI file changes that tasks.md must list. Neither file is frozen.
- **Build needs network.** `npm run build`, used for 3.19 and the 3.3 solver run, now needs network access to fetch the Plex fonts.
- **Nav fit at 360px.** The flex-wrap layout makes the nav correct whether the five items fit on one line or not. Measure the rendered width at 360px during verification. If the items wrap, decide whether two nav rows are acceptable or whether the nav should collapse into a menu.
- **Docs renderer.** The docs renderer should map Markdown elements to these styles: h2 `text-heading`, h3 `text-title`, p and li `text-body text-fg-secondary`, inline code, code block, and link. The math in skill.md renders as a code block (2.19).
