// Console facts (Property 3, K06): the information each console output
// carries at c6d13ea, written as patterns that ignore wording, padding, and
// the "(Hell)" suffix, so the fixed console can reword its output and still
// pass. Every static fact names the c6d13ea literal it was taken from;
// tests/preserve/oracles.test.ts proves the literal appears in
// `git show c6d13ea:<path>` and that every fact matches the oracle's output.

import fc from "fast-check";
import { GATES_BASELINE } from "./gates-baseline.ts";
import { classifyCommand, type ConsoleKind, type Standing } from "./console-oracle.ts";

export interface Fact {
  id: string;
  pattern: RegExp;
  /** Verbatim text in `git show c6d13ea:<path>` the fact is taken from. */
  literal: string;
  path: string;
  /** True when `pattern` must also match `literal` itself (a data value, not a format). */
  value: boolean;
}

/** A check the subject's output must pass. Static facts and per-input checks share this shape. */
export interface Check {
  id: string;
  test(text: string): boolean;
}

const CONSOLE = "src/lib/console.ts";
const GATES_TS = "src/lib/gates.ts";

const fact = (id: string, pattern: RegExp, literal: string, path: string, value: boolean): Fact => ({ id, pattern, literal, path, value });

export const escapeRegExp = (s: string): string => s.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");

/** "2500" -> "2,?500": digits with optional en-US thousands separators. */
export function numberPattern(n: number): string {
  const digits = String(n);
  let out = "";
  for (let i = 0; i < digits.length; i++) {
    const fromEnd = digits.length - i;
    if (i > 0 && fromEnd % 3 === 0) out += ",?";
    out += digits[i];
  }
  return out;
}

// ---------------------------------------------------------------------------
// Static facts
// ---------------------------------------------------------------------------

/** `help`: the command list. */
export const HELP_FACTS: readonly Fact[] = Object.freeze([
  fact("help:help", /\bhelp\b/, "  help         List commands", CONSOLE, true),
  fact("help:gates", /\bgates\b/, "  gates        List the gates", CONSOLE, true),
  fact("help:solve", /\bsolve\b/, "  solve <1-4>  Show how to approach a gate", CONSOLE, true),
  fact("help:leaderboard", /\bleaderboard\b/, "  leaderboard  Show the standings", CONSOLE, true),
  fact("help:clear", /\bclear\b/, "  clear        Clear the console", CONSOLE, true),
]);

/** `gates`: per gate, its number, name, points, first endpoint, and TTL. Checked inside that gate's segment. */
export function gateRowFacts(n: 1 | 2 | 3 | 4): Fact[] {
  const g = GATES_BASELINE[n - 1];
  const ep = g.endpoints[0];
  const facts: Fact[] = [
    fact(`gates:${n}:number`, new RegExp(`\\bGate\\s+${n}\\b`), "const num = `Gate ${g.number}`", CONSOLE, false),
    fact(`gates:${n}:name`, new RegExp(escapeRegExp(g.name), "i"), `name: "${g.name}`, GATES_TS, true),
    fact(`gates:${n}:points`, new RegExp(`\\b${numberPattern(g.points)}\\b`), `points: ${g.points},`, GATES_TS, true),
    fact(`gates:${n}:path`, new RegExp(escapeRegExp(ep.path)), `path: "${ep.path}"`, GATES_TS, true),
    fact(`gates:${n}:method`, new RegExp(`\\b${ep.method}\\s+${escapeRegExp(ep.path)}`), "`${ep.method} ${ep.path}`", CONSOLE, false),
  ];
  if (g.ttlSeconds !== null) {
    facts.push(fact(`gates:${n}:ttl`, new RegExp(`\\b${g.ttlSeconds}\\s?s\\b`), `ttlSeconds: ${g.ttlSeconds},`, GATES_TS, false));
  }
  return facts;
}

/** `solve N`: the gate number plus the hint facts that the c6d13ea hint carries. */
const HINT_FACTS: Record<1 | 2 | 3 | 4, Fact[]> = {
  1: [
    fact("solve:1:0000", /0000/, "SHA256 starts with '0000'", GATES_TS, true),
    fact("solve:1:nonce", /\bnonce\b/i, "mine a nonce", GATES_TS, true),
  ],
  2: [
    fact("solve:2:z3", /\bZ3\b/, "Z3 BitVec with Extract(63, 16, state)", GATES_TS, true),
    fact("solve:2:16", /\b16\b/, "Extract(63, 16, state)", GATES_TS, true),
  ],
  3: [
    fact("solve:3:512", /\b512\b/, "Load the 512 clauses", GATES_TS, true),
    fact("solve:3:120", /\b120\b/, "the 120-variable boolean model", GATES_TS, true),
    fact("solve:3:z3", /\bZ3\b/, "into Z3 Solver", GATES_TS, true),
  ],
  4: [
    fact("solve:4:symbolic", /symbolic/i, "Write a symbolic execution loop", GATES_TS, true),
    fact("solve:4:key", /\bkey\b/i, "solves for key", GATES_TS, true),
  ],
};

export function solveFacts(n: 1 | 2 | 3 | 4): Fact[] {
  return [fact(`solve:${n}:number`, new RegExp(`\\bGate\\s+${n}\\b`), "output: `Gate ${num}: ${gate.consoleHint}`", CONSOLE, false), ...HINT_FACTS[n]];
}

/** `solve` without a valid gate number, at c6d13ea "Usage: solve 1 | solve 2 | solve 3 | solve 4". */
export const USAGE_FACTS: readonly Fact[] = Object.freeze([
  fact("usage:usage", /\busage\b/i, "Usage: solve 1 | solve 2 | solve 3 | solve 4", CONSOLE, true),
  fact("usage:solve", /\bsolve\b/, "Usage: solve 1 | solve 2 | solve 3 | solve 4", CONSOLE, true),
  fact("usage:1", /\b1\b/, "Usage: solve 1 | solve 2 | solve 3 | solve 4", CONSOLE, true),
  fact("usage:4", /\b4\b/, "Usage: solve 1 | solve 2 | solve 3 | solve 4", CONSOLE, true),
]);

/** Unknown command: usage help pointing at `help` (the echo is a per-input check). */
export const UNKNOWN_FACTS: readonly Fact[] = Object.freeze([
  fact("unknown:help", /\bhelp\b/i, "Type help to list commands.", CONSOLE, true),
]);

/** `leaderboard` before the scoreboard ever loaded. */
export const NOT_LOADED_FACTS: readonly Fact[] = Object.freeze([
  fact("leaderboard:null:scoreboard", /\bscoreboard\b/i, "Open the scoreboard to load them.", CONSOLE, true),
  fact("leaderboard:null:load", /\bload/i, "Standings haven't loaded.", CONSOLE, true),
]);

/** `leaderboard` with an empty list. */
export const EMPTY_FACTS: readonly Fact[] = Object.freeze([
  fact("leaderboard:empty", /\bno\b[^.\n]*\bentries\b/i, "No entries yet.", CONSOLE, true),
]);

/** Every static fact, for the source-tie test. */
export function allStaticFacts(): Fact[] {
  return [
    ...HELP_FACTS,
    ...([1, 2, 3, 4] as const).flatMap((n) => gateRowFacts(n)),
    ...([1, 2, 3, 4] as const).flatMap((n) => solveFacts(n)),
    ...USAGE_FACTS,
    ...UNKNOWN_FACTS,
    ...NOT_LOADED_FACTS,
    ...EMPTY_FACTS,
  ];
}

/**
 * Phrases 2.21 and 2.22 ban from UI text (1.21, 1.22). Each one is quoted from
 * the old page, `git show afe2537:<path>`, which BANNED_PHRASE_SOURCES names.
 */
export const BANNED_PHRASES: readonly { pattern: RegExp; literal: string; path: string }[] = Object.freeze([
  { pattern: /sovereign execution environment/i, literal: "SOVEREIGN EXECUTION ENVIRONMENT", path: "src/app/page.tsx" },
  { pattern: /guardrail boundary deconstruction/i, literal: "guardrail boundary deconstruction", path: "src/app/page.tsx" },
  { pattern: /formulate evasion vectors/i, literal: "Formulate evasion vectors", path: "src/app/page.tsx" },
  { pattern: /enter adversarial prompt/i, literal: "Enter adversarial prompt", path: "src/app/page.tsx" },
  { pattern: /\bdirectives?\b/i, literal: "DIRECTIVES", path: "src/app/page.tsx" },
  { pattern: /operational vectors/i, literal: "Operational vectors", path: "src/app/page.tsx" },
  { pattern: /\[dismiss\]/i, literal: "[Dismiss]", path: "src/app/page.tsx" },
  { pattern: /real-time/i, literal: "Real-time", path: "src/app/page.tsx" },
  { pattern: /\bconnected\b/i, literal: "Connected", path: "src/app/page.tsx" },
  { pattern: /gates active/i, literal: "Gates Active", path: "src/app/page.tsx" },
]);

// ---------------------------------------------------------------------------
// Per-input checks
// ---------------------------------------------------------------------------

const asCheck = (f: Fact): Check => ({ id: f.id, test: (text) => f.pattern.test(text) });

/** Splits `gates` output into per-gate segments: from "Gate N" up to the next "Gate M". */
export function gateSegments(text: string): Map<number, string> {
  const re = /\bGate\s+([1-4])\b/g;
  const hits = [...text.matchAll(re)].map((m) => ({ n: Number(m[1]), at: m.index ?? 0 }));
  const segments = new Map<number, string>();
  hits.forEach((h, i) => {
    if (segments.has(h.n)) return;
    const end = i + 1 < hits.length ? hits[i + 1].at : text.length;
    segments.set(h.n, text.slice(h.at, end));
  });
  return segments;
}

const HANDLE_CHAR = "A-Za-z0-9_.\\-";

/** Matches `handle` as a whole token (not inside a longer handle-like word). */
export function handleToken(handle: string): RegExp {
  return new RegExp(`(?<![${HANDLE_CHAR}])${escapeRegExp(handle)}(?![${HANDLE_CHAR}])`);
}

/** Integers in `text`, reading "8,500" as 8500 and "1, 3" as 1 and 3. */
export function integersIn(text: string): number[] {
  return [...text.matchAll(/\d{1,3}(?:,\d{3})+(?!\d)|\d+/g)].map((m) => Number(m[0].replace(/,/g, "")));
}

/**
 * One check per standing, in order: a line holds the handle; after removing
 * the handle, its integers start with the rank, then hold the score, and the
 * integers after the score are exactly the solved gates (any order), or the
 * line says "none" when no gate is solved.
 */
export function standingsChecks(standings: readonly Standing[]): Check[] {
  return [
    {
      id: "leaderboard:entries",
      test(text) {
        const lines = text.split("\n");
        let from = 0;
        for (let i = 0; i < standings.length; i++) {
          const s = standings[i];
          const token = handleToken(s.agentName);
          let found = -1;
          for (let j = from; j < lines.length; j++) {
            if (token.test(lines[j])) {
              found = j;
              break;
            }
          }
          if (found < 0) return false;
          const rest = lines[found].replace(token, " ");
          const nums = integersIn(rest);
          if (nums[0] !== i + 1) return false;
          const scoreAt = nums.indexOf(s.score, 1);
          if (scoreAt < 0) return false;
          const gates = nums.slice(scoreAt + 1);
          const want = [...new Set(s.gatesSolved)].sort((a, b) => a - b);
          if (want.length === 0) {
            if (gates.length !== 0 || !/\bnone\b/i.test(rest)) return false;
          } else if ([...gates].sort((a, b) => a - b).join(",") !== want.join(",")) {
            return false;
          }
          from = found + 1;
        }
        return true;
      },
    },
  ];
}

/** The checks that the output for `cmd` must pass. `clear` and empty input have none. */
export function checksFor(cmd: string, standings: readonly Standing[] | null): Check[] {
  const c: ConsoleKind = classifyCommand(cmd);
  switch (c.kind) {
    case "none":
    case "clear":
      return [];
    case "help":
      return HELP_FACTS.map(asCheck);
    case "gates":
      return ([1, 2, 3, 4] as const).flatMap((n) =>
        gateRowFacts(n).map((f) => ({ id: f.id, test: (text: string) => f.pattern.test(gateSegments(text).get(n) ?? "") })),
      );
    case "solve":
      return solveFacts(c.gate).map(asCheck);
    case "usage":
      return USAGE_FACTS.map(asCheck);
    case "leaderboard":
      if (standings === null) return NOT_LOADED_FACTS.map(asCheck);
      if (standings.length === 0) return EMPTY_FACTS.map(asCheck);
      return standingsChecks(standings);
    case "unknown":
      return [...UNKNOWN_FACTS.map(asCheck), { id: "unknown:echo", test: (text) => text.includes(c.command) }];
  }
}

/** Ids of the checks `text` fails (empty when it carries every fact). */
export function failedChecks(text: string, checks: readonly Check[]): string[] {
  return checks.filter((c) => !c.test(text)).map((c) => c.id);
}

/** Banned phrases found in `text`. */
export function bannedIn(text: string): string[] {
  return BANNED_PHRASES.filter((b) => b.pattern.test(text)).map((b) => b.literal);
}

// ---------------------------------------------------------------------------
// Generators for Property 3
// ---------------------------------------------------------------------------

/** First words the console knows. */
export const COMMAND_ROOTS: readonly string[] = Object.freeze(["help", "gates", "solve", "leaderboard", "clear"]);

/** `word` in random letter case. */
export function anyCase(word: string): fc.Arbitrary<string> {
  return fc
    .array(fc.boolean(), { minLength: word.length, maxLength: word.length })
    .map((bits) => [...word].map((ch, i) => (bits[i] ? ch.toUpperCase() : ch.toLowerCase())).join(""));
}

const surrounding = fc.constantFrom("", " ", "  ", "\t", " \t ", "   ");
/** Up to 8 letters, so no generated word can spell a banned phrase. */
const unknownFirstWord = fc.stringMatching(/^[A-Za-z]{1,8}$/).filter((w) => !COMMAND_ROOTS.includes(w.toLowerCase()));
const laterWord = fc.stringMatching(/^[A-Za-z0-9]{1,8}$/);

/**
 * The console domain of Property 3: help, gates, leaderboard, clear, solve,
 * solve 0 to 9, and unknown words, in any letter case, with optional
 * surrounding whitespace and single spaces between words.
 */
export const consoleCommandArb: fc.Arbitrary<string> = fc
  .tuple(
    surrounding,
    fc.oneof(
      anyCase("help"),
      anyCase("gates"),
      anyCase("leaderboard"),
      anyCase("clear"),
      anyCase("solve"),
      fc.tuple(anyCase("solve"), fc.integer({ min: 0, max: 9 })).map(([s, n]) => `${s} ${n}`),
      fc.tuple(unknownFirstWord, fc.array(laterWord, { maxLength: 2 })).map(([w, rest]) => [w, ...rest].join(" ")),
    ),
    surrounding,
  )
  .map(([a, body, b]) => `${a}${body}${b}`);

/** Words of the console templates; handles never equal one, so lines can't be confused. */
const RESERVED_HANDLE = /^(pts|points|gates?|none|no|entries|yet|scoreboard|rank|score|handle|loaded?|last|at|as|the|of|in)$/i;

/** A handle as the server records it (letters first, so it can't be read as a number). */
export const standingHandleArb: fc.Arbitrary<string> = fc
  .stringMatching(/^[A-Za-z][A-Za-z0-9_.-]{0,23}$/)
  .filter((h) => !RESERVED_HANDLE.test(h));

const POINTS: Record<number, number> = Object.fromEntries(GATES_BASELINE.map((g) => [g.number, g.points]));

/** One scoreboard entry shaped like the server's: score = points of the solved gates, badge at 4. */
export const standingArb: fc.Arbitrary<Standing> = fc
  .record({
    agentName: standingHandleArb,
    gatesSolved: fc.shuffledSubarray([1, 2, 3, 4]),
    lastSolveAt: fc.nat(),
  })
  .map(({ agentName, gatesSolved, lastSolveAt }) => {
    const entry: Standing = { agentName, gatesSolved, score: gatesSolved.reduce((s, g) => s + POINTS[g], 0), lastSolveAt };
    if (gatesSolved.length === 4) entry.proofBadge = `HAKU{AGENT_${agentName.toUpperCase().replace(/[^A-Z0-9]/g, "_")}_GATES_1234_VERIFIED_0123456789abcdef}`;
    return entry;
  });

/** Standings as last loaded: null (never loaded) or up to 6 entries with unique handles. */
export const standingsArb: fc.Arbitrary<Standing[] | null> = fc.option(
  fc.uniqueArray(standingArb, { selector: (e) => e.agentName, maxLength: 6 }),
  { nil: null },
);
