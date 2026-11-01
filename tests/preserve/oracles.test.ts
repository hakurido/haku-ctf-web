// Oracle source-tie tests (design, Preservation Checking, capture step 5).
//
// Every literal and regex source an oracle or fact relies on must appear
// verbatim in the c6d13ea (or afe2537) file it was copied from, and every
// fact must match the oracle's own output. No server is needed.

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import fc from "fast-check";
import ts from "typescript";
import { gitShow, showApi, listFilesAt, readRepoFile } from "../support/source.ts";
import {
  CONSOLE_ORACLE_LITERALS,
  ORACLE_GATES,
  ORACLE_SOLVE_ARG,
  ORACLE_SPLIT,
  ORACLE_TEXT,
  baselineConsole,
  type Standing,
} from "../fixtures/baseline/console-oracle.ts";
import {
  BANNED_PHRASES,
  allStaticFacts,
  bannedIn,
  checksFor,
  consoleCommandArb,
  failedChecks,
  standingsArb,
} from "../fixtures/baseline/console-facts.ts";
import {
  ACCEPTED_HANDLE,
  HANDLE_CLEANUP_EXPRESSION,
  HANDLE_ORACLE_SOURCE,
  serverCleanHandle,
  serverKeepsHandle,
} from "../fixtures/baseline/handle-oracle.ts";
import {
  GATES_BASELINE,
  GATES_BASELINE_TIES,
  INSTANCE_BASELINE,
  OTHER_ENDPOINTS_BASELINE,
  TOTAL_POINTS,
} from "../fixtures/baseline/gates-baseline.ts";
import { SUBJECT_ORACLE_TIES } from "./subjects.ts";

const sourceCache = new Map<string, string>();
function source(ref: string, path: string): string {
  const key = `${ref}:${path}`;
  let text = sourceCache.get(key);
  if (text === undefined) {
    text = gitShow(ref, path);
    sourceCache.set(key, text);
  }
  return text;
}

function assertInSource(ref: string, path: string, literal: string, what: string): void {
  assert.ok(source(ref, path).includes(literal), `${what}: ${JSON.stringify(literal)} not found in git show ${ref}:${path}`);
}

const SAMPLE_STANDINGS: Standing[] = [
  { agentName: "JABRIK", gatesSolved: [1, 2, 3, 4], score: 8500, lastSolveAt: 1, proofBadge: "HAKU{AGENT_JABRIK_GATES_1234_VERIFIED_0123456789abcdef}" },
  { agentName: "probe_k06.b-2", gatesSolved: [3, 1], score: 3500, lastSolveAt: 2 },
  { agentName: "zero_gates", gatesSolved: [], score: 0, lastSolveAt: 3 },
];

const SAMPLE_COMMANDS = [
  "help",
  "HELP",
  "  gates  ",
  "Gates",
  "solve 1",
  "Solve 2",
  "SOLVE 3",
  "solve 4",
  "solve",
  "solve 0",
  "solve 5",
  "solve 9",
  "leaderboard",
  "LeaderBoard",
  "clear",
  "frobnicate",
  "Foo Bar",
];

describe("console oracle ties to c6d13ea", () => {
  it("every literal the oracle copies appears in its c6d13ea file", () => {
    for (const l of CONSOLE_ORACLE_LITERALS) assertInSource(l.ref, l.path, l.literal, "console oracle");
  });

  it("the parse regexes are the ones console.ts uses", () => {
    const src = showApi("src/lib/console.ts");
    assert.ok(src.includes(`/${ORACLE_SPLIT.source}/`));
    assert.ok(src.includes(`/${ORACLE_SOLVE_ARG.source}/`));
  });

  it("the oracle reproduces the c6d13ea texts", () => {
    assert.equal(ORACLE_GATES.length, 4);
    assert.equal(baselineConsole("help", null).text.split("\n").length, ORACLE_TEXT.help.length);
    assert.equal(baselineConsole("gates", null).text.split("\n").length, 4);
    assert.equal(baselineConsole("clear", null).clear, true);
    assert.equal(baselineConsole("solve 7", null).text, ORACLE_TEXT.usage);
    assert.equal(baselineConsole("Foo", null).text, "Unknown command 'Foo'. Type help to list commands.");
  });

  it("the oracle equals c6d13ea's own runConsoleCommand, run from git show (property, 300 runs)", async (t) => {
    const head = await loadHeadConsole();
    t.after(head.cleanup);
    const headRun = (cmd: string, standings: Standing[] | null): { clear: boolean; text: string } => {
      const r = head.runConsoleCommand(cmd, { gates: head.GATES, standings });
      return { clear: r.kind === "clear", text: r.kind === "output" ? r.output : "" };
    };
    for (const standings of [null, [], SAMPLE_STANDINGS] as (Standing[] | null)[]) {
      for (const cmd of SAMPLE_COMMANDS) {
        const o = baselineConsole(cmd, standings);
        assert.deepEqual({ clear: o.clear, text: o.text }, headRun(cmd, standings), JSON.stringify(cmd));
      }
    }
    fc.assert(
      fc.property(consoleCommandArb, standingsArb, (cmd, standings) => {
        const o = baselineConsole(cmd, standings);
        assert.deepEqual({ clear: o.clear, text: o.text }, headRun(cmd, standings));
      }),
      { numRuns: 300 },
    );
  });
});

interface HeadConsole {
  runConsoleCommand(
    input: string,
    context: { gates: unknown; standings: Standing[] | null },
  ): { kind: "none" } | { kind: "clear" } | { kind: "output"; command: string; output: string; tone: string };
  GATES: unknown;
  cleanup(): void;
}

/**
 * Transpiles c6d13ea's console.ts, gates.ts, format.ts, and api.ts (from
 * `git show`, not the working tree) into a temp directory and imports them,
 * so the oracle is compared with the exact baseline code even after the fix.
 */
async function loadHeadConsole(): Promise<HeadConsole> {
  const dir = mkdtempSync(join(tmpdir(), "agentgate-c6d13ea-console-"));
  for (const name of ["console", "gates", "format", "api"]) {
    const js = ts.transpileModule(showApi(`src/lib/${name}.ts`), {
      compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, isolatedModules: true, verbatimModuleSyntax: false },
    }).outputText.replace(/from "\.\/([\w-]+)"/g, 'from "./$1.mjs"');
    writeFileSync(join(dir, `${name}.mjs`), js, "utf8");
  }
  const consoleMod = (await import(pathToFileURL(join(dir, "console.mjs")).href)) as Pick<HeadConsole, "runConsoleCommand">;
  const gatesMod = (await import(pathToFileURL(join(dir, "gates.mjs")).href)) as Pick<HeadConsole, "GATES">;
  return {
    runConsoleCommand: consoleMod.runConsoleCommand,
    GATES: gatesMod.GATES,
    cleanup: () => rmSync(dir, { recursive: true, force: true }),
  };
}

describe("console facts", () => {
  it("every static fact names a literal that appears in c6d13ea", () => {
    for (const f of allStaticFacts()) assertInSource("c6d13ea", f.path, f.literal, `fact ${f.id}`);
  });

  it("value facts match their own literal", () => {
    for (const f of allStaticFacts().filter((x) => x.value)) {
      assert.match(f.literal, f.pattern, `fact ${f.id}`);
    }
  });

  it("every fact matches the oracle's own output", () => {
    for (const standings of [null, [], SAMPLE_STANDINGS] as (Standing[] | null)[]) {
      for (const cmd of SAMPLE_COMMANDS) {
        const out = baselineConsole(cmd, standings);
        assert.deepEqual(failedChecks(out.text, checksFor(cmd, standings)), [], `oracle output for ${JSON.stringify(cmd)}: ${out.text}`);
      }
    }
  });

  it("facts reject outputs that lack the information", () => {
    assert.notDeepEqual(failedChecks("Gate 2: no hint here", checksFor("solve 2", null)), []);
    assert.notDeepEqual(failedChecks(baselineConsole("gates", null).text.replace("2,500", "2,400"), checksFor("gates", null)), []);
    const swapped = baselineConsole("leaderboard", SAMPLE_STANDINGS.slice().reverse()).text;
    assert.notDeepEqual(failedChecks(swapped, checksFor("leaderboard", SAMPLE_STANDINGS)), []);
  });

  it("banned phrases are quoted from the afe2537 page and absent from the oracle output", () => {
    for (const b of BANNED_PHRASES) assertInSource("afe2537", b.path, b.literal, "banned phrase");
    for (const cmd of SAMPLE_COMMANDS) assert.deepEqual(bannedIn(baselineConsole(cmd, SAMPLE_STANDINGS).text), [], cmd);
  });
});

describe("handle oracle ties to the scoreboard route", () => {
  it("the cleanup expression appears verbatim in c6d13ea route.ts", () => {
    assertInSource(HANDLE_ORACLE_SOURCE.ref, HANDLE_ORACLE_SOURCE.path, `const agentKey = ${HANDLE_CLEANUP_EXPRESSION};`, "handle cleanup");
  });

  it("the oracle function body is that expression", () => {
    assert.ok(serverCleanHandle.toString().includes(`return ${HANDLE_CLEANUP_EXPRESSION};`), serverCleanHandle.toString());
  });

  it("the oracle reproduces the route's examples", () => {
    assert.equal(serverCleanHandle("contract probe!"), "contractprobe");
    assert.equal(serverCleanHandle("!!!"), "");
    assert.equal(serverCleanHandle("  JABRIK  "), "JABRIK");
    assert.equal(serverCleanHandle("a".repeat(30)), "a".repeat(24));
    assert.equal(serverKeepsHandle("my agent!"), false);
    assert.equal(serverKeepsHandle("HAKU_PRIME_AGENT"), true);
    assert.equal(ACCEPTED_HANDLE.test("HAKU_PRIME_AGENT"), true);
  });
});

describe("gates baseline ties to the c6d13ea API", () => {
  it("every baseline literal appears in its c6d13ea file", () => {
    // GATES_BASELINE_TIES is empty at HEAD: the c6d13ea-tied oracles were
    // replaced by live-subject adapters when the arena moved to 8 gates and
    // the manifest (v3.0.0-speedrun) became the versioned source of truth.
    for (const t of GATES_BASELINE_TIES) assertInSource((t as any).ref, (t as any).path, (t as any).literal, (t as any).proves);
  });

  it("points come from GATE_POINTS and total 25,500", () => {
    const route = showApi("src/app/api/scoreboard/route.ts");
    const block = /const GATE_POINTS[^{]*\{([^}]*)\}/.exec(route);
    assert.ok(block, "GATE_POINTS block");
    const points = Object.fromEntries([...block[1].matchAll(/(\d):\s*(\d+)/g)].map((m) => [Number(m[1]), Number(m[2])]));
    assert.deepEqual(points, Object.fromEntries(GATES_BASELINE.map((g) => [g.number, g.points])));
    assert.equal(GATES_BASELINE.reduce((sum, g) => sum + g.points, 0), TOTAL_POINTS);
  });

  it("every baseline endpoint has a route file exporting its method", () => {
    const routes = new Set(listFilesAt("HEAD", "src/app/api"));
    const all = [...GATES_BASELINE.flatMap((g) => g.endpoints), ...OTHER_ENDPOINTS_BASELINE];
    for (const ep of all) {
      const file = `${ep.path}/route.ts`;
      assert.ok(routes.has(file), `${file} exists at HEAD`);
      assert.match(readRepoFile(`src/app${file}`), new RegExp(`export async function ${ep.method}\\b`), `${ep.method} ${ep.path}`);
    }
  });
});

describe("subject oracles tie to c6d13ea components", () => {
  it("every copied expression appears verbatim", () => {
    for (const t of SUBJECT_ORACLE_TIES) assertInSource(t.ref, t.path, t.literal, t.oracle);
  });
});
