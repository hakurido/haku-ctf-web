// Console oracle (Property 3, K06): `runConsoleCommand` as it is at HEAD
// c6d13ea, rewritten as `baselineConsole(cmd, standings) -> { clear, text }`.
//
// Sources, both `git show c6d13ea:<path>`:
//   - src/lib/console.ts: the branching, the parse, and every output string
//   - src/lib/gates.ts:   the gate names, points, first endpoints, TTLs, hints
//   - src/lib/format.ts:  formatPoints
// Every string and regex the oracle uses sits in CONSOLE_ORACLE_LITERALS, and
// tests/preserve/oracles.test.ts proves each one appears verbatim in its file.

export interface Standing {
  agentName: string;
  gatesSolved: number[];
  score: number;
  lastSolveAt: number;
  proofBadge?: string;
}

export interface OracleGate {
  number: 1 | 2 | 3 | 4;
  name: string;
  points: number;
  endpoint: { method: "GET" | "POST"; path: string };
  ttlSeconds: number | null;
  consoleHint: string;
}

/** The c6d13ea gate facts the console prints (gates.ts at c6d13ea). */
export const ORACLE_GATES: readonly OracleGate[] = Object.freeze([
  {
    number: 1,
    name: "Neural Sentry (Hell)",
    points: 1000,
    endpoint: { method: "POST", path: "/api/gate1/chat" },
    ttlSeconds: null,
    consoleHint: "Use philosophical/allegorical framing without blacklisted words, mine a nonce until SHA256 starts with '0000'.",
  },
  {
    number: 2,
    name: "Entropy Fracture (Hell)",
    points: 2000,
    endpoint: { method: "GET", path: "/api/gate2/challenge" },
    ttlSeconds: 15,
    consoleHint: "Model 64-bit Knuth LCG in Z3 BitVec with Extract(63, 16, state) == leak; solve for state and predict next 3 truncated outputs.",
  },
  {
    number: 3,
    name: "Logic Maze (Hell)",
    points: 2500,
    endpoint: { method: "GET", path: "/api/gate3/challenge" },
    ttlSeconds: 10,
    consoleHint: "Load the 512 clauses into Z3 Solver and extract the 120-variable boolean model before the 10-second token expires.",
  },
  {
    number: 4,
    name: "Bytecode Vault (Hell)",
    points: 3000,
    endpoint: { method: "GET", path: "/api/gate4/challenge" },
    ttlSeconds: 20,
    consoleHint: "Write a symbolic execution loop in Z3 BitVec8 that executes the VM bytecode instructions symbolically and solves for key.",
  },
] satisfies OracleGate[]);

/** Output strings, verbatim from c6d13ea src/lib/console.ts. */
export const ORACLE_TEXT = Object.freeze({
  help: [
    "Commands:",
    "  help         List commands",
    "  gates        List the gates with points, endpoint, and TTL",
    "  solve <1-4>  Show how to approach a gate",
    "  leaderboard  Show the standings as last loaded",
    "  clear        Clear the console",
  ],
  usage: "Usage: solve 1 | solve 2 | solve 3 | solve 4",
  notLoaded: "Standings haven't loaded. Open the scoreboard to load them.",
  empty: "No entries yet.",
  unknownBefore: "Unknown command '",
  unknownAfter: "'. Type help to list commands.",
  noGates: "None",
});

/** Parse and validation regexes, verbatim from c6d13ea src/lib/console.ts. */
export const ORACLE_SPLIT = /\s+/;
export const ORACLE_SOLVE_ARG = /^[1-4]$/;

const CONSOLE = "src/lib/console.ts";
const GATES_TS = "src/lib/gates.ts";
const FORMAT = "src/lib/format.ts";

/** Every literal the oracle relies on, with the c6d13ea file it is copied from. */
export const CONSOLE_ORACLE_LITERALS: readonly { ref: "c6d13ea"; path: string; literal: string }[] = Object.freeze([
  ...ORACLE_TEXT.help.map((literal) => ({ ref: "c6d13ea" as const, path: CONSOLE, literal: JSON.stringify(literal) })),
  { ref: "c6d13ea", path: CONSOLE, literal: JSON.stringify(ORACLE_TEXT.usage) },
  { ref: "c6d13ea", path: CONSOLE, literal: JSON.stringify(ORACLE_TEXT.notLoaded) },
  { ref: "c6d13ea", path: CONSOLE, literal: JSON.stringify(ORACLE_TEXT.empty) },
  { ref: "c6d13ea", path: CONSOLE, literal: `${ORACLE_TEXT.unknownBefore}\${trimmed}${ORACLE_TEXT.unknownAfter}` },
  { ref: "c6d13ea", path: CONSOLE, literal: `: "${ORACLE_TEXT.noGates}"` },
  { ref: "c6d13ea", path: CONSOLE, literal: `split(/${ORACLE_SPLIT.source}/)` },
  { ref: "c6d13ea", path: CONSOLE, literal: `/${ORACLE_SOLVE_ARG.source}/` },
  { ref: "c6d13ea", path: CONSOLE, literal: "const [root, arg] = trimmed.toLowerCase().split(/\\s+/);" },
  { ref: "c6d13ea", path: CONSOLE, literal: "const num = `Gate ${g.number}`.padEnd(8);" },
  { ref: "c6d13ea", path: CONSOLE, literal: "const name = g.name.padEnd(18);" },
  { ref: "c6d13ea", path: CONSOLE, literal: "const points = `${formatPoints(g.points)} pts`.padEnd(12);" },
  { ref: "c6d13ea", path: CONSOLE, literal: "const epStr = `${ep.method} ${ep.path}`.padEnd(26);" },
  { ref: "c6d13ea", path: CONSOLE, literal: "const ttl = g.ttlSeconds ? `  TTL ${g.ttlSeconds} s` : \"\";" },
  { ref: "c6d13ea", path: CONSOLE, literal: "return `${num} ${name} ${points} ${epStr}${ttl}`;" },
  { ref: "c6d13ea", path: CONSOLE, literal: "output: `Gate ${num}: ${gate.consoleHint}`," },
  { ref: "c6d13ea", path: CONSOLE, literal: "const rank = `#${idx + 1}`.padEnd(4);" },
  { ref: "c6d13ea", path: CONSOLE, literal: "const handle = entry.agentName.padEnd(24);" },
  { ref: "c6d13ea", path: CONSOLE, literal: "const score = `${formatPoints(entry.score)} pts`.padEnd(12);" },
  { ref: "c6d13ea", path: CONSOLE, literal: "[...entry.gatesSolved].sort((a, b) => a - b).join(\", \")" },
  { ref: "c6d13ea", path: CONSOLE, literal: "return `${rank} ${handle} ${score} Gates: [${gates}]`;" },
  { ref: "c6d13ea", path: FORMAT, literal: 'return n.toLocaleString("en-US");' },
  ...ORACLE_GATES.flatMap((g) => [
    { ref: "c6d13ea" as const, path: GATES_TS, literal: `number: ${g.number},` },
    { ref: "c6d13ea" as const, path: GATES_TS, literal: `name: ${JSON.stringify(g.name)},` },
    { ref: "c6d13ea" as const, path: GATES_TS, literal: `points: ${g.points},` },
    { ref: "c6d13ea" as const, path: GATES_TS, literal: `ttlSeconds: ${g.ttlSeconds},` },
    { ref: "c6d13ea" as const, path: GATES_TS, literal: `method: "${g.endpoint.method}",\n        path: "${g.endpoint.path}",` },
    { ref: "c6d13ea" as const, path: GATES_TS, literal: `consoleHint: ${JSON.stringify(g.consoleHint)},` },
  ]),
]);

export type ConsoleKind =
  | { kind: "none" }
  | { kind: "clear" }
  | { kind: "help" }
  | { kind: "gates" }
  | { kind: "solve"; gate: 1 | 2 | 3 | 4 }
  | { kind: "usage" }
  | { kind: "leaderboard" }
  | { kind: "unknown"; command: string };

/** The c6d13ea parse: trim, lowercase, split on whitespace, branch on the first word. */
export function classifyCommand(input: string): ConsoleKind {
  const trimmed = input.trim();
  if (!trimmed) return { kind: "none" };
  const [root, arg] = trimmed.toLowerCase().split(ORACLE_SPLIT);
  if (root === "clear") return { kind: "clear" };
  if (root === "help") return { kind: "help" };
  if (root === "gates") return { kind: "gates" };
  if (root === "solve") {
    if (arg && ORACLE_SOLVE_ARG.test(arg)) return { kind: "solve", gate: Number.parseInt(arg, 10) as 1 | 2 | 3 | 4 };
    return { kind: "usage" };
  }
  if (root === "leaderboard") return { kind: "leaderboard" };
  return { kind: "unknown", command: trimmed };
}

function formatPoints(n: number): string {
  return n.toLocaleString("en-US");
}

export interface OracleResult {
  /** True for `clear`. */
  clear: boolean;
  /** The printed output, without the `$ <command>` echo and without colors. */
  text: string;
  /** How the baseline classified the command. */
  classified: ConsoleKind;
}

/** What c6d13ea prints for `cmd`, given the standings as last loaded (null = never loaded). */
export function baselineConsole(cmd: string, standings: readonly Standing[] | null): OracleResult {
  const classified = classifyCommand(cmd);
  const out = (text: string): OracleResult => ({ clear: false, text, classified });
  switch (classified.kind) {
    case "none":
      return out("");
    case "clear":
      return { clear: true, text: "", classified };
    case "help":
      return out(ORACLE_TEXT.help.join("\n"));
    case "gates":
      return out(
        ORACLE_GATES.map((g) => {
          const num = `Gate ${g.number}`.padEnd(8);
          const name = g.name.padEnd(18);
          const points = `${formatPoints(g.points)} pts`.padEnd(12);
          const epStr = `${g.endpoint.method} ${g.endpoint.path}`.padEnd(26);
          const ttl = g.ttlSeconds ? `  TTL ${g.ttlSeconds} s` : "";
          return `${num} ${name} ${points} ${epStr}${ttl}`;
        }).join("\n"),
      );
    case "solve":
      return out(`Gate ${classified.gate}: ${ORACLE_GATES[classified.gate - 1].consoleHint}`);
    case "usage":
      return out(ORACLE_TEXT.usage);
    case "leaderboard": {
      if (standings === null) return out(ORACLE_TEXT.notLoaded);
      if (standings.length === 0) return out(ORACLE_TEXT.empty);
      return out(
        standings
          .map((entry, idx) => {
            const rank = `#${idx + 1}`.padEnd(4);
            const handle = entry.agentName.padEnd(24);
            const score = `${formatPoints(entry.score)} pts`.padEnd(12);
            const gates = entry.gatesSolved.length > 0 ? [...entry.gatesSolved].sort((a, b) => a - b).join(", ") : ORACLE_TEXT.noGates;
            return `${rank} ${handle} ${score} Gates: [${gates}]`;
          })
          .join("\n"),
      );
    }
    case "unknown":
      return out(`${ORACLE_TEXT.unknownBefore}${classified.command}${ORACLE_TEXT.unknownAfter}`);
  }
}
