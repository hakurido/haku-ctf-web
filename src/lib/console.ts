import type { GateMeta } from "./gates";
import type { LeaderboardEntry } from "./api";
import { formatPoints, formatTime } from "./format";

export interface ConsoleContext {
  gates: readonly GateMeta[];
  standings: readonly LeaderboardEntry[] | null;
  /** When the standings were last loaded (ms since epoch), if known. */
  loadedAt?: number | null;
}

export type ConsoleResult =
  | { kind: "none" }
  | { kind: "clear" }
  | { kind: "output"; command: string; output: string; tone: "normal" | "error" };

const HELP_LINES = [
  "Commands:",
  "  help          List these commands",
  "  gates         List each gate's points, endpoint, and TTL",
  "  solve <1-4>   Show the solving hint for a gate",
  "  leaderboard   Show the scoreboard as last loaded",
  "  clear         Clear the output",
];

/** Pads every cell in a column to the column's widest cell (R-16). */
function alignColumns(rows: readonly string[][]): string[] {
  const widths: number[] = [];
  for (const row of rows) {
    row.forEach((cell, i) => {
      widths[i] = Math.max(widths[i] ?? 0, cell.length);
    });
  }
  return rows.map((row) =>
    row
      .map((cell, i) => (i === row.length - 1 ? cell : cell.padEnd(widths[i])))
      .join("  ")
      .trimEnd()
  );
}

function gatesOutput(gates: readonly GateMeta[]): string {
  const rows = gates.map((g) => {
    const ep = g.endpoints[0];
    return [
      `Gate ${g.number}`,
      g.name,
      `${formatPoints(g.points)} pts`,
      `${ep.method} ${ep.path}`,
      g.ttlSeconds ? `TTL ${g.ttlSeconds} s` : "no TTL",
    ];
  });
  return [
    ...alignColumns(rows),
    "Gates 2 to 4 take answers at POST /api/gateN/submit. Flags go to POST /api/scoreboard.",
  ].join("\n");
}

function leaderboardOutput(
  standings: readonly LeaderboardEntry[],
  loadedAt: number | null | undefined
): string {
  const header = loadedAt
    ? `Scoreboard as last loaded at ${formatTime(loadedAt)}:`
    : "Scoreboard as last loaded:";
  const rows = standings.map((entry, idx) => {
    const gates =
      entry.gatesSolved.length > 0
        ? [...entry.gatesSolved].sort((a, b) => a - b).join(", ")
        : "none";
    return [
      `#${idx + 1}`,
      entry.agentName,
      `${formatPoints(entry.score)} pts`,
      `gates: ${gates}`,
    ];
  });
  return [header, ...alignColumns(rows)].join("\n");
}

export function runConsoleCommand(
  input: string,
  context: ConsoleContext
): ConsoleResult {
  const trimmed = input.trim();
  if (!trimmed) {
    return { kind: "none" };
  }

  const [root, arg] = trimmed.toLowerCase().split(/\s+/);
  const output = (text: string, tone: "normal" | "error" = "normal"): ConsoleResult => ({
    kind: "output",
    command: trimmed,
    output: text,
    tone,
  });

  if (root === "clear") {
    return { kind: "clear" };
  }

  if (root === "help") {
    return output(HELP_LINES.join("\n"));
  }

  if (root === "gates") {
    return output(gatesOutput(context.gates));
  }

  if (root === "solve") {
    if (arg && /^[1-4]$/.test(arg)) {
      const num = parseInt(arg, 10);
      const gate = context.gates[num - 1];
      return output(`Gate ${num}: ${gate.consoleHint}`);
    }
    return output("Usage: solve <1-4>, for example: solve 2", "error");
  }

  if (root === "leaderboard") {
    if (context.standings === null) {
      return output("The scoreboard hasn't loaded yet. Open Scoreboard to load it.");
    }
    if (context.standings.length === 0) {
      return output("No scoreboard entries in the last load.");
    }
    return output(leaderboardOutput(context.standings, context.loadedAt));
  }

  return output(`Unknown command: ${trimmed}. Type help to list commands.`, "error");
}
