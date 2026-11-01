// Property 1: Bug Condition - UI source shows no defect marker (static checks).
//
// Exploration tests for the S-kind rows of the design's "Exploratory Bug Condition
// Checking" table (X01, X03, X05, X24, X25, X28, X29, X38), plus the M-18 enforcement
// search from design-parts/01-visual-system.md and the c6d13ea literal scans
// ("60 booleans", "(Hell)", "1.3e36", "high-order", "Babai", "35+").
//
// Each test asserts the expected behavior on F'. On HEAD c6d13ea the remaining gaps fail
// (the failure is the counterexample); rows already fixed in 2516aa1 pass and act as
// regression guards. Counterexamples are recorded in tests/fixtures/explore-failures/source.md.
//
// Scope: UI code U = every file under src/ outside the frozen set Z (listUiFiles).
// No server, no build, no network. Run: node --test tests/explore/source.test.ts
//
// **Validates: Requirements 2.1, 2.2, 2.4, 2.21, 2.22, 2.25, 2.26, 2.35**

import { before, test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { relative, sep } from "node:path";
import {
  FROZEN_PATHS,
  REPO_ROOT,
  isFrozen,
  listUiFiles,
  readPackageJson,
  readRepoFile,
} from "../support/source.ts";

// ---------------------------------------------------------------------------
// Scan helpers
// ---------------------------------------------------------------------------

/** Text files in U that the literal scans read. */
const TEXT_EXTENSIONS: readonly string[] = [
  ".ts", ".tsx", ".js", ".jsx", ".mjs", ".css", ".md", ".mdx", ".json", ".svg",
];
const CODE_EXTENSIONS: readonly string[] = [".ts", ".tsx", ".js", ".jsx", ".mjs"];

interface Hit {
  file: string;
  line: number;
  match: string;
  text: string;
}

interface MatchContext {
  file: string;
  lines: readonly string[];
  index: number;
  column: number;
  match: string;
}

type AllowRule = (ctx: MatchContext) => boolean;

function linesOf(file: string): string[] {
  return readRepoFile(file).split(/\r?\n/);
}

function formatHit(h: Hit): string {
  const text = h.text.trim();
  const shown = text.length > 140 ? `${text.slice(0, 137)}...` : text;
  return `${h.file}:${h.line}: ${JSON.stringify(h.match)} | ${shown}`;
}

function regexScan(
  files: readonly string[],
  patterns: readonly RegExp[],
  allow: AllowRule = () => false,
): Hit[] {
  const hits: Hit[] = [];
  for (const file of files) {
    const lines = linesOf(file);
    lines.forEach((text, index) => {
      for (const p of patterns) {
        const re = new RegExp(p.source, p.flags.includes("g") ? p.flags : `${p.flags}g`);
        for (const m of text.matchAll(re)) {
          const column = m.index ?? 0;
          if (allow({ file, lines, index, column, match: m[0] })) continue;
          hits.push({ file, line: index + 1, match: m[0], text });
        }
      }
    });
  }
  return hits;
}

/** Case-insensitive substring scan. */
function literalScan(files: readonly string[], needle: string): Hit[] {
  const n = needle.toLowerCase();
  const hits: Hit[] = [];
  for (const file of files) {
    linesOf(file).forEach((text, index) => {
      const lower = text.toLowerCase();
      let at = lower.indexOf(n);
      while (at >= 0) {
        hits.push({ file, line: index + 1, match: text.slice(at, at + n.length), text });
        at = lower.indexOf(n, at + n.length);
      }
    });
  }
  return hits;
}

// ---------------------------------------------------------------------------
// Allowed `#` matches
// ---------------------------------------------------------------------------

/** `&#8217;` and similar numeric character references are not colors. */
const isNumericEntity: AllowRule = (ctx) =>
  ctx.match.startsWith("#") && ctx.lines[ctx.index].slice(0, ctx.column).endsWith("&");

/** 01-visual-system.md: a `#` that is a URL fragment (href="#gate-3") is allowed. */
const isUrlFragment: AllowRule = (ctx) =>
  ctx.match.startsWith("#") && /href=\{?["'`]$/.test(ctx.lines[ctx.index].slice(0, ctx.column));

/**
 * Task 4.4 / M-18: the `themeColor` hex is the one allowed hex exception once it is
 * documented in source. "Documented" means the match line or one of the 3 lines above it
 * names themeColor and carries a comment containing the word "exception". HEAD has no such
 * comment, so the literal counts as a match there.
 */
const isDocumentedThemeColor: AllowRule = (ctx) => {
  if (!ctx.match.startsWith("#")) return false;
  const windowText = ctx.lines.slice(Math.max(0, ctx.index - 3), ctx.index + 1).join("\n");
  return /theme_?color/i.test(windowText) && /(?:\/\/|\/\*|^\s*\*)[^\n]*\bexception\b/im.test(windowText);
};

const allowHash: AllowRule = (ctx) =>
  isNumericEntity(ctx) || isUrlFragment(ctx) || isDocumentedThemeColor(ctx);

// ---------------------------------------------------------------------------
// gates.ts static readers (no runtime import, so the test doesn't depend on how
// gates.ts resolves its own imports)
// ---------------------------------------------------------------------------

/** Source text of the GATES entry whose `number:` is `n`, up to the next entry. */
function gateBlock(src: string, n: number): string {
  const starts: { n: number; at: number }[] = [];
  for (const m of src.matchAll(/\bnumber\s*:\s*(\d+)\b/g)) {
    starts.push({ n: Number(m[1]), at: m.index ?? 0 });
  }
  const i = starts.findIndex((s) => s.n === n);
  if (i < 0) return "";
  const end = i + 1 < starts.length ? starts[i + 1].at : src.length;
  return src.slice(starts[i].at, end);
}

/** First `key: "..."` value in `block`, joining `"a" + "b"` concatenations. */
function stringProperty(block: string, key: string): string | undefined {
  const m = new RegExp(`\\b${key}\\s*:\\s*`).exec(block);
  if (!m) return undefined;
  let i = m.index + m[0].length;
  let out = "";
  let parts = 0;
  for (;;) {
    const q = block[i];
    if (q !== '"' && q !== "'" && q !== "`") break;
    let j = i + 1;
    while (j < block.length && block[j] !== q) {
      if (block[j] === "\\") {
        out += block[j + 1] ?? "";
        j += 2;
      } else {
        out += block[j];
        j += 1;
      }
    }
    parts += 1;
    i = j + 1;
    const plus = /^\s*\+\s*/.exec(block.slice(i));
    if (!plus) break;
    i += plus[0].length;
  }
  return parts > 0 ? out : undefined;
}

// ---------------------------------------------------------------------------
// Precondition: the scan scope is U, and it is not vacuous
// ---------------------------------------------------------------------------

before(() => {
  const u = listUiFiles();
  assert.ok(u.length > 0, "listUiFiles() returned no files");
  assert.deepEqual(u.filter((p) => isFrozen(p)), [], "U must exclude the frozen set Z");
  assert.ok(FROZEN_PATHS.includes("src/app/api"), "FROZEN_PATHS must contain src/app/api");
  for (const p of [
    "src/app/layout.tsx",
    "src/app/globals.css",
    "src/lib/gates.ts",
    "src/components/gates/Gate2Instance.tsx",
  ]) {
    assert.ok(u.includes(p), `U must include ${p}`);
  }
});

// ---------------------------------------------------------------------------
// X01 (2.1) decorative CSS and markup
// ---------------------------------------------------------------------------

test("X01 (2.1) globals.css and layout.tsx carry no decorative markers", () => {
  const cssHits = regexScan(
    ["src/app/globals.css"],
    [/\.scanlines\b/, /\.matrix-grid\b/, /\.glow-/, /\.box-glow-/, /--cyber-/, /text-shadow/, /background-clip\s*:\s*text/],
  );
  const layoutHits = regexScan(["src/app/layout.tsx"], [/scanlines|matrix-grid/]);
  assert.deepEqual([...cssHits, ...layoutHits].map(formatHit), []);
});

// ---------------------------------------------------------------------------
// X03 (2.2) raw colors and default palette classes in .tsx
// ---------------------------------------------------------------------------

test("X03 (2.2) .tsx files in U contain no raw color values or default palette classes", () => {
  const files = listUiFiles({ extensions: [".tsx"] });
  const hex = regexScan(files, [/#[0-9a-fA-F]{3,8}/], allowHash);
  const fn = regexScan(files, [/\b(?:rgba?|hsla?|oklch)\(/]);
  const palette = regexScan(files, [
    /\b(?:bg|text|border|ring|outline|fill|stroke|divide|placeholder|shadow|from|via|to)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3}\b/,
  ]);
  assert.deepEqual([...hex, ...fn, ...palette].map(formatHit), []);
});

// ---------------------------------------------------------------------------
// M-18 (2.2, 2.4) the enforcement search from design-parts/01-visual-system.md
//   rg -n --glob "src/**/*.{ts,tsx,css}" --glob "!src/app/api/**"
//      --glob "!src/lib/{challenges,crypto,ratelimit}.ts" --glob "!src/app/globals.css"
//      -e "#[0-9a-fA-F]{3,8}\b" -e "\b(rgb|rgba|hsl|oklch)\(" -e "-\[#"
//      -e "\b(text|bg|border|ring|fill|stroke)-(zinc|...|amber)-\d" -e "text-\[\d"
//      -e "scanlines|matrix-grid|glow|bg-gradient|bg-clip-text"
// ---------------------------------------------------------------------------

const ENFORCEMENT_PATTERNS: readonly RegExp[] = [
  /#[0-9a-fA-F]{3,8}\b/,
  /\b(?:rgb|rgba|hsl|oklch)\(/,
  /-\[#/,
  /\b(?:text|bg|border|ring|fill|stroke)-(?:zinc|slate|gray|neutral|stone|red|green|emerald|blue|cyan|yellow|amber)-\d/,
  /text-\[\d/,
  // 2.1 (hybrid look, approved by the user): the `shadow-glow` and
  // `shadow-glow-strong` token utilities from globals.css are allowed. Any other
  // glow, scanline, grid class, gradient utility, or gradient text still matches.
  /scanlines|matrix-grid|(?<!shadow-)glow|bg-gradient|bg-clip-text/,
];

test("M-18 (2.2, 2.4) enforcement search over U returns no matches", () => {
  const files = listUiFiles({ extensions: [".ts", ".tsx", ".css"] }).filter(
    (p) => p !== "src/app/globals.css",
  );
  const hits = regexScan(files, ENFORCEMENT_PATTERNS, allowHash);
  assert.deepEqual(hits.map(formatHit), []);
});

// ---------------------------------------------------------------------------
// X05 (2.4) fonts through next/font
// ---------------------------------------------------------------------------

test("X05 (2.4) layout.tsx imports from next/font/", () => {
  const layout = readRepoFile("src/app/layout.tsx");
  assert.match(layout, /^\s*import\s[^;]*?\bfrom\s+["']next\/font\/[\w/-]+["']/m);
});

// ---------------------------------------------------------------------------
// X24 (2.21) phrases from 1.21 and the c6d13ea literals
// ---------------------------------------------------------------------------

const X24_BUG_PHRASES: readonly string[] = [
  "SOVEREIGN EXECUTION ENVIRONMENT",
  "guardrail boundary deconstruction",
  "Formulate evasion vectors",
  "Enter adversarial prompt",
  "DIRECTIVES",
  "Operational vectors",
  "Unknown directive",
  "[Dismiss]",
];

test("X24 (2.21) U contains none of the 1.21 phrases (case-insensitive)", () => {
  const files = listUiFiles({ extensions: TEXT_EXTENSIONS });
  const hits = X24_BUG_PHRASES.flatMap((p) => literalScan(files, p));
  assert.deepEqual(hits.map(formatHit), []);
});

test("X24 (2.21, 2.24) metadata titles in src/app contain no \" // \" separator", () => {
  const files = listUiFiles({ extensions: CODE_EXTENSIONS }).filter((p) => p.startsWith("src/app/"));
  const titles: Hit[] = [];
  for (const file of files) {
    linesOf(file).forEach((text, index) => {
      for (const m of text.matchAll(/\b(?:title|default|template)\s*:\s*(["'`])(.*?)\1/g)) {
        titles.push({ file, line: index + 1, match: m[2], text });
      }
    });
  }
  assert.ok(titles.length > 0, "found no metadata title strings under src/app");
  assert.deepEqual(titles.filter((t) => t.match.includes(" // ")).map(formatHit), []);
});

/** c6d13ea literals from the X table (X24) and the audit; requirement per literal. */
const C6D13EA_LITERALS: readonly { literal: string; id: string; req: string }[] = [
  { literal: "(Hell)", id: "X24/A14", req: "2.21" },
  { literal: "1.3e36", id: "X24", req: "2.21" },
  { literal: "high-order", id: "X24", req: "2.21" },
  { literal: "Babai", id: "X24", req: "2.21" },
  { literal: "35+", id: "X24", req: "2.21" },
  { literal: "60 booleans", id: "M-05", req: "2.22" },
];

for (const { literal, id, req } of C6D13EA_LITERALS) {
  test(`${id} (${req}) U does not contain ${JSON.stringify(literal)} (case-insensitive)`, () => {
    const files = listUiFiles({ extensions: TEXT_EXTENSIONS });
    assert.deepEqual(literalScan(files, literal).map(formatHit), []);
  });
}

// ---------------------------------------------------------------------------
// A14 (2.21, 2.22) gate names as the API gives them; "Hell" is a difficulty label
// ---------------------------------------------------------------------------

const EXPECTED_GATE_NAMES: readonly string[] = [
  "Neural Sentry",
  "Entropy Fracture",
  "Logic Maze",
  "Bytecode Vault",
];

test("A14 (2.21, 2.22) gates.ts names have no \"(Hell)\" and gates.ts declares difficulty \"Hell\"", () => {
  const src = readRepoFile("src/lib/gates.ts");
  const problems: string[] = [];
  EXPECTED_GATE_NAMES.forEach((expected, i) => {
    const actual = stringProperty(gateBlock(src, i + 1), "name");
    if (actual !== expected) {
      problems.push(`Gate ${i + 1} name is ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`);
    }
  });
  if (!/\b(?:DIFFICULTY|difficulty)\b[^\n]*["'`]Hell["'`]/.test(src)) {
    problems.push('gates.ts has no `difficulty: "Hell"` or `DIFFICULTY = "Hell"` declaration');
  }
  assert.deepEqual(problems, []);
});

// ---------------------------------------------------------------------------
// X25 (2.22) no unmeasured status claims; Gate 2 givens
// ---------------------------------------------------------------------------

test("X25 (2.22) U has no \"Real-time\", \"Connected\" label, \"Gates Active\", or \"derive multiplier state\"", () => {
  const files = listUiFiles({ extensions: TEXT_EXTENSIONS });
  const hits = [
    ...literalScan(files, "Real-time"),
    ...literalScan(files, "Gates Active"),
    ...literalScan(files, "derive multiplier state"),
    ...regexScan(files, [/(?:>|["'`])\s*Connected\s*(?:<|["'`])/i]),
  ];
  assert.deepEqual(hits.map(formatHit), []);
});

const GIVEN_VERB =
  /\b(?:given|gives|includes?|included|provides?|provided|supplies|supplied|lists|listed|returns|returned)\b/i;

test("X25 (2.22) Gate 2 description says A and C are given and each output is X >> 16", () => {
  const src = readRepoFile("src/lib/gates.ts");
  const desc = stringProperty(gateBlock(src, 2), "description");
  assert.ok(desc !== undefined, "gates.ts Gate 2 has no description string");
  const sentences = desc.split(/(?<=[.!?])\s+/);
  const problems: string[] = [];
  const multiplierGiven = sentences.some(
    (s) =>
      (/\bmultiplier\b/i.test(s) && GIVEN_VERB.test(s)) ||
      /\bA\b(?: and C\b)?[^.]*\b(?:is|are)\s+(?:both\s+)?given\b/.test(s),
  );
  const incrementGiven = sentences.some(
    (s) =>
      (/\bincrement\b/i.test(s) && GIVEN_VERB.test(s)) ||
      /\bC\b[^.]*\b(?:is|are)\s+(?:both\s+|also\s+)?given\b/.test(s),
  );
  const truncation = />>\s*16\b/.test(desc) || /\btop 48 bits\b/i.test(desc);
  if (!multiplierGiven) problems.push("does not say the multiplier A is given");
  if (!incrementGiven) problems.push("does not say the increment C is given");
  if (!truncation) problems.push("does not say each output is X >> 16 (the top 48 bits)");
  assert.deepEqual(problems, [], `Gate 2 description: ${JSON.stringify(desc)}`);
});

// ---------------------------------------------------------------------------
// X28 (2.25) sound defaults to off
// ---------------------------------------------------------------------------

test("X28 (2.25) sound defaults to off in source", () => {
  const problems: string[] = [];
  const sound = readRepoFile("src/lib/sound.ts").match(/\benabled\s*(?::\s*boolean\s*)?=\s*(true|false)\b/);
  if (!sound || sound[1] !== "false") {
    problems.push(`src/lib/sound.ts SoundEngine.enabled default is ${sound ? sound[1] : "missing"}`);
  }
  const state = readRepoFile("src/lib/app-state.ts").match(/\bsoundOn\s*:\s*(true|false)\b/);
  if (!state || state[1] !== "false") {
    problems.push(`src/lib/app-state.ts initial soundOn is ${state ? state[1] : "missing"}`);
  }
  const useStateTrue = regexScan(listUiFiles({ extensions: CODE_EXTENSIONS }), [
    /sound\w*[^\n]*useState\s*(?:<[^>]*>)?\(\s*true\s*\)/i,
  ]);
  problems.push(...useStateTrue.map(formatHit));
  assert.deepEqual(problems, []);
});

// ---------------------------------------------------------------------------
// X29 (2.26) canvas-confetti dependency and imports
// ---------------------------------------------------------------------------

test("X29 (2.26) canvas-confetti is absent from package.json and from imports in U", () => {
  const pkg = readPackageJson();
  const problems: string[] = [];
  for (const name of ["canvas-confetti", "@types/canvas-confetti"]) {
    if (pkg.dependencies?.[name]) problems.push(`dependencies.${name} = ${pkg.dependencies[name]}`);
    if (pkg.devDependencies?.[name]) problems.push(`devDependencies.${name} = ${pkg.devDependencies[name]}`);
  }
  const imports = regexScan(listUiFiles({ extensions: CODE_EXTENSIONS }), [
    /(?:\bfrom\s*|\bimport\s*\(\s*|\brequire\s*\(\s*|\bimport\s+)["']canvas-confetti["']/,
  ]);
  problems.push(...imports.map(formatHit));
  assert.deepEqual(problems, []);
});

// ---------------------------------------------------------------------------
// X38 (2.35) npm run lint:ui exits 0
// ---------------------------------------------------------------------------

const EXPECTED_LINT_UI =
  'eslint src --max-warnings 0 --ignore-pattern "src/app/api/**" --ignore-pattern src/lib/challenges.ts --ignore-pattern src/lib/crypto.ts --ignore-pattern src/lib/ratelimit.ts';

interface LintFile {
  file: string;
  errors: number;
  warnings: number;
  problems: string[];
}

function toRepoRelative(abs: string): string {
  return relative(REPO_ROOT, abs).split(sep).join("/");
}

/** Parses ESLint's default "stylish" output. */
function parseStylish(output: string): { files: LintFile[]; summary: string } {
  const files: LintFile[] = [];
  let current: LintFile | undefined;
  // NO_COLOR and a piped stdout keep ESLint's output free of ANSI codes.
  for (const line of output.split(/\r?\n/)) {
    const p = /^\s+(\d+):(\d+)\s+(error|warning)\s+(.+?)(?:\s{2,}(\S+))?\s*$/.exec(line);
    if (p && current) {
      if (p[3] === "error") current.errors += 1;
      else current.warnings += 1;
      current.problems.push(`${p[1]} ${p[5] ?? p[4]}`);
      continue;
    }
    if (/^[^\s>].*\.(?:tsx?|jsx?|mjs|cjs)$/.test(line)) {
      current = { file: toRepoRelative(line.trim()), errors: 0, warnings: 0, problems: [] };
      files.push(current);
    }
  }
  const s = /(\d+) problems? \((\d+) errors?, (\d+) warnings?\)/.exec(output);
  return { files, summary: s ? `${s[2]} errors, ${s[3]} warnings` : "no summary line" };
}

test("X38 (2.35) npm run lint:ui exits 0", { timeout: 300_000 }, () => {
  assert.equal(
    readPackageJson().scripts?.["lint:ui"],
    EXPECTED_LINT_UI,
    "package.json lint:ui must be the exact command from design-parts/05-testing.md",
  );
  const r = spawnSync("npm run lint:ui", {
    cwd: REPO_ROOT,
    shell: true,
    encoding: "utf8",
    windowsHide: true,
    maxBuffer: 64 * 1024 * 1024,
    timeout: 280_000,
    env: { ...process.env, NO_COLOR: "1", FORCE_COLOR: "0" },
  });
  if (r.error) throw r.error;
  const { files, summary } = parseStylish(`${r.stdout}\n${r.stderr}`);
  const perFile = files.map((f) => `${f.file}: ${f.errors} errors, ${f.warnings} warnings (${f.problems.join("; ")})`);
  assert.equal(
    r.status,
    0,
    `npm run lint:ui exited ${r.status}: ${summary}\n${perFile.join("\n")}`,
  );
});
