import { GateMeta } from "./gates";
import { LeaderboardEntry } from "./api";
import { formatPoints } from "./format";

export interface ConsoleContext {
  gates: readonly GateMeta[];
  standings: readonly LeaderboardEntry[] | null;
}

export type ConsoleResult =
  | { kind: "none" }
  | { kind: "clear" }
  | { kind: "output"; command: string; output: string; tone: "normal" | "error" };

export function runConsoleCommand(
  input: string,
  context: ConsoleContext
): ConsoleResult {
  const trimmed = input.trim();
  if (!trimmed) {
    return { kind: "none" };
  }

  const [root, arg] = trimmed.toLowerCase().split(/\s+/);

  if (root === "clear") {
    return { kind: "clear" };
  }

  if (root === "help") {
    const lines = [
      "Commands:",
      "  help         List commands",
      "  gates        List the gates with points, endpoint, and TTL",
      "  solve <1-4>  Show how to approach a gate",
      "  leaderboard  Show the standings as last loaded",
      "  clear        Clear the console",
    ];
    return {
      kind: "output",
      command: trimmed,
      output: lines.join("\n"),
      tone: "normal",
    };
  }

  if (root === "gates") {
    const lines = context.gates.map((g) => {
      const num = `Gate ${g.number}`.padEnd(8);
      const name = g.name.padEnd(18);
      const points = `${formatPoints(g.points)} pts`.padEnd(12);
      const ep = g.endpoints[0];
      const epStr = `${ep.method} ${ep.path}`.padEnd(26);
      const ttl = g.ttlSeconds ? `  TTL ${g.ttlSeconds} s` : "";
      return `${num} ${name} ${points} ${epStr}${ttl}`;
    });
    return {
      kind: "output",
      command: trimmed,
      output: lines.join("\n"),
      tone: "normal",
    };
  }

  if (root === "solve") {
    if (arg && /^[1-4]$/.test(arg)) {
      const num = parseInt(arg, 10);
      const gate = context.gates[num - 1];
      return {
        kind: "output",
        command: trimmed,
        output: `Gate ${num}: ${gate.consoleHint}`,
        tone: "normal",
      };
    }
    return {
      kind: "output",
      command: trimmed,
      output: "Usage: solve 1 | solve 2 | solve 3 | solve 4",
      tone: "error",
    };
  }

  if (root === "leaderboard") {
    if (context.standings === null) {
      return {
        kind: "output",
        command: trimmed,
        output: "Standings haven't loaded. Open the scoreboard to load them.",
        tone: "normal",
      };
    }
    if (context.standings.length === 0) {
      return {
        kind: "output",
        command: trimmed,
        output: "No entries yet.",
        tone: "normal",
      };
    }

    const lines = context.standings.map((entry, idx) => {
      const rank = `#${idx + 1}`.padEnd(4);
      const handle = entry.agentName.padEnd(24);
      const score = `${formatPoints(entry.score)} pts`.padEnd(12);
      const gates =
        entry.gatesSolved.length > 0
          ? [...entry.gatesSolved].sort((a, b) => a - b).join(", ")
          : "None";
      return `${rank} ${handle} ${score} Gates: [${gates}]`;
    });
    return {
      kind: "output",
      command: trimmed,
      output: lines.join("\n"),
      tone: "normal",
    };
  }

  return {
    kind: "output",
    command: trimmed,
    output: `Unknown command '${trimmed}'. Type help to list commands.`,
    tone: "error",
  };
}
