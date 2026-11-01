# Source exploration results on HEAD c6d13ea

Task 2.1. Property 1: Bug Condition. UI source shows no defect marker (static checks).

- Test file: `tests/explore/source.test.ts`
- Command: `node --test tests/explore/source.test.ts`, with `NODE_NO_WARNINGS=1`
- Scope: UI code U, meaning every working-tree file under `src/` outside the frozen set Z (`listUiFiles`).
- Repository: as-is at HEAD c6d13ea, with Wave 1 tooling and no rebuild. No server.
- Run result: 18 tests. 6 pass and 12 fail. Exit 1. Duration about 9.3 s, of which `lint:ui` takes about 8.8 s.
- Typecheck: `npx tsc -p tests/tsconfig.json --noEmit` exits 0 with no errors in this file.

## Failing on HEAD (gaps confirmed)

| Test | Requirement | Counterexample on HEAD |
|---|---|---|
| X03: `.tsx` in U has no raw colors or palette classes | 2.2 | `src/app/layout.tsx:39` `themeColor: "#111315"` |
| M-18: enforcement search returns no matches | 2.2, 2.4 | 3 matches, the same as audit `rg.log`: `src/app/layout.tsx:39` `"#111315"` (themeColor); `src/components/docs/SkillDocument.tsx:12` `text-[0.8em]` (sub); `src/components/docs/SkillDocument.tsx:14` `text-[0.8em]` (sup) |
| X24: no 1.21 phrases (case-insensitive) | 2.21 | "DIRECTIVES" matches `src/app/console/page.tsx:6` ("Interactive shell for inspecting AGENTGATE gates, standings, and directives.") and `src/components/console/ConsoleView.tsx:30` ("Interactive command interface for checking gates, standings, and directives."). Fix: R-14. |
| X24/A14: no "(Hell)" | 2.21 | `src/lib/gates.ts:36` "Neural Sentry (Hell)", `:61` "Entropy Fracture (Hell)", `:96` "Logic Maze (Hell)", `:131` "Bytecode Vault (Hell)" |
| X24: no "1.3e36" | 2.21 | `src/lib/gates.ts:102`, in the Gate 3 description: "Search space exceeds 1.3e36 configurations." |
| X24: no "high-order" | 2.21 | `src/lib/gates.ts:42`, in the Gate 1 description: "…must use high-order epistemic or philosophical framing…" |
| X24: no "Babai" | 2.21 | `src/lib/gates.ts:67`, in the Gate 2 description: "Formulate a Z3 BitVec SMT model or Babai lattice reduction…" |
| X24: no "35+" | 2.21 | `src/lib/gates.ts:40`, in the Gate 1 summary: "Bypass 35+ blacklisted tokens…" |
| M-05: no "60 booleans" | 2.22 | `src/components/gates/Gate3Instance.tsx:60`: "Either 60 booleans in variable order, …" |
| A14: gate names have no "(Hell)", and `difficulty: "Hell"` exists | 2.21, 2.22 | The names are "Neural Sentry (Hell)", "Entropy Fracture (Hell)", "Logic Maze (Hell)", and "Bytecode Vault (Hell)", where "Neural Sentry", "Entropy Fracture", "Logic Maze", and "Bytecode Vault" are expected. gates.ts has no `difficulty: "Hell"` or `DIFFICULTY = "Hell"` declaration. |
| X25: Gate 2 description says A and C are given and each output is X >> 16 | 2.22 | The description is "Each instance emits four consecutive outputs of a 64-bit LCG, X(n+1) = (A·X(n) + C) mod 2^64, where the lower 16 bits are stripped (only X_n >> 16 is leaked). Formulate a Z3 BitVec SMT model or Babai lattice reduction…". It doesn't say that the multiplier A is given or that the increment C is given. The X >> 16 part passes. Fix: R-18. |
| X38: `npm run lint:ui` exits 0 | 2.35 | Exit 1 with 24 errors and 0 warnings in 9 files, which matches M-17. See the breakdown below. |

X38 breakdown, as parsed from the ESLint output:

- `src/components/gates/Gate1TryIt.tsx`: 1 error. Line 122, react/no-unescaped-entities.
- `src/components/gates/InstanceTryIt.tsx`: 4 errors. Lines 94, 100, and 106, no-explicit-any. Line 187, no-unescaped-entities.
- `src/components/state/AppStateProvider.tsx`: 5 errors. Lines 31, 45, 118, and 200, no-explicit-any. Line 74, react-hooks/purity (`Date.now()` during render).
- `src/components/ui/CopyButton.tsx`: 1 error. Line 27, react-hooks/set-state-in-effect.
- `src/components/ui/StatusMessage.tsx`: 1 error. Line 7, no-explicit-any.
- `src/lib/api.ts`: 7 errors. Lines 121, 130, 175, 190, 206, 214, and 236, no-explicit-any.
- `src/lib/app-state.ts`: 3 errors. Lines 186, 192, and 201, no-explicit-any.
- `src/lib/markdown.ts`: 1 error. Line 264, prefer-const.
- `src/lib/validation.ts`: 1 error. Line 28, no-explicit-any.

The HEAD `lint:ui` count is 24 errors and 0 warnings.

## Passing on HEAD (already fixed in 2516aa1; kept as regression guards)

| Test | Requirement | Result |
|---|---|---|
| X01: globals.css and layout.tsx have no decorative markers | 2.1 | Already fixed in 2516aa1. globals.css has none of `.scanlines`, `.matrix-grid`, `.glow-`, `.box-glow-`, `--cyber-`, `text-shadow`, or `background-clip: text`. layout.tsx has no `scanlines` or `matrix-grid`. |
| X05: layout.tsx imports from `next/font/` | 2.4 | Already fixed in 2516aa1. IBM Plex Sans and IBM Plex Mono are imported from `next/font/google`. |
| X24: metadata titles have no " // " | 2.21, 2.24 | Already fixed in 2516aa1. The template is `%s · AGENTGATE CTF`. |
| X25: no "Real-time", "Connected" label, "Gates Active", or "derive multiplier state" | 2.22 | Already fixed in 2516aa1. |
| X28: sound defaults to off | 2.25 | Already fixed in 2516aa1. `src/lib/sound.ts` has `enabled: boolean = false`, `src/lib/app-state.ts` has `soundOn: false`, and no `useState(true)` is used for sound. |
| X29: canvas-confetti is absent from package.json and from imports in U | 2.26 | Already fixed in 2516aa1. Neither `canvas-confetti` nor `@types/canvas-confetti` is in dependencies or devDependencies, and nothing imports either one. |

## Rules the fix must meet (read by Wave 3 and 4 owners)

- **themeColor exception (M-18, task 4.4).** A hex literal in U passes X03 and M-18 only when it is documented as the allowed exception. The match line, or one of the 3 lines above it, must mention `themeColor` and carry a comment containing the word "exception". An example is `// The one allowed hex exception (M-18): themeColor needs a literal color.` above `themeColor: "#111315",`. Without that comment, the literal counts as a match. This is why it fails on HEAD.
- **Other allowed `#` matches.** A URL fragment directly after `href="` is allowed, as in `href="#main"` (01-visual-system.md). A numeric character reference such as `&#8217;` is allowed because it isn't a color.
- **A14 names.** The test reads `src/lib/gates.ts` as text. It checks that the first `name:` string in each `number: N` GATES entry is exactly "Neural Sentry", "Entropy Fracture", "Logic Maze", or "Bytecode Vault". It also checks that a line declares `difficulty`/`DIFFICULTY` together with the string `"Hell"`.
- **X25 Gate 2 description.** The test reads the `description:` string of the `number: 2` entry in gates.ts. One sentence has to mention the multiplier along with a "giving" verb such as given, gives, includes, or provides. One sentence has to mention the increment, or C, in the same way. The text also has to contain `>> 16` or "top 48 bits". The R-18 suggested string satisfies all three.
- **Literal scans** are case-insensitive substring checks over every text file in U, so "Directive" in any casing fails X24.

## Not covered here

- The B half of X25, the `/scoreboard` sentence matching /memory/ and /reset/, is a rendered check. It isn't in this file.
