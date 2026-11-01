// src/lib/console.ts (through tests/preserve/subjects.ts).
// Property 3 (K06): console commands return equivalent information. The
// baseline is the c6d13ea oracle (tests/fixtures/baseline/console-oracle.ts);
// outputs are compared by facts, never by wording or padding. No server.
//
// **Validates: Requirements 3.10, 2.21, 2.22, 2.23**

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fc from "fast-check";
import { runConsole } from "../preserve/subjects.ts";
import { baselineConsole, type Standing } from "../fixtures/baseline/console-oracle.ts";
import {
  bannedIn,
  checksFor,
  consoleCommandArb,
  failedChecks,
  gateSegments,
  standingsArb,
} from "../fixtures/baseline/console-facts.ts";

/** Asserts the subject's output for `cmd` carries the oracle's information. */
function assertEquivalent(cmd: string, standings: Standing[] | null): void {
  const subject = runConsole(cmd, standings);
  const oracle = baselineConsole(cmd, standings);
  assert.equal(subject.kind === "clear", oracle.clear, `clear or not for ${JSON.stringify(cmd)}`);
  if (oracle.clear) return;
  assert.equal(subject.kind, "output", `${JSON.stringify(cmd)} prints output`);
  const missing = failedChecks(subject.text, checksFor(cmd, standings));
  assert.deepEqual(missing, [], `facts missing for ${JSON.stringify(cmd)}:\n${subject.text}`);
  assert.deepEqual(bannedIn(subject.text), [], `banned phrase in output of ${JSON.stringify(cmd)}`);
}

const TWO_ENTRIES: Standing[] = [
  { agentName: "JABRIK", gatesSolved: [1, 2, 3, 4], score: 8500, lastSolveAt: 1, proofBadge: "HAKU{AGENT_JABRIK_GATES_1234_VERIFIED_bfd8ab8c030f8c4b}" },
  { agentName: "probe_k06", gatesSolved: [3, 1], score: 3500, lastSolveAt: 2 },
];

describe("console: K06 examples", () => {
  it("GATES lists every gate's number, name, points, endpoint, and TTL", () => {
    assertEquivalent("GATES", null);
    const segments = gateSegments(runConsole("GATES", null).text);
    assert.deepEqual([...segments.keys()].sort(), [1, 2, 3, 4]);
  });

  it("help lists the commands", () => {
    assertEquivalent("help", null);
    assertEquivalent("  HeLp  ", null);
  });

  it("Solve 2 prints Gate 2's hint", () => {
    assertEquivalent("Solve 2", null);
    for (const n of [1, 3, 4]) assertEquivalent(`solve ${n}`, null);
  });

  it("solve 5, solve 0, and solve alone print usage help", () => {
    for (const cmd of ["solve 5", "solve 0", "solve", "SOLVE 9"]) assertEquivalent(cmd, null);
  });

  it("clear clears", () => {
    assert.equal(runConsole("clear", null).kind, "clear");
    assert.equal(runConsole(" CLEAR ", TWO_ENTRIES).kind, "clear");
  });

  it("leaderboard: never loaded, empty, and two entries in order", () => {
    assertEquivalent("leaderboard", null);
    assertEquivalent("leaderboard", []);
    assertEquivalent("leaderboard", TWO_ENTRIES);
    assertEquivalent("LEADERBOARD", TWO_ENTRIES.slice().reverse());
  });

  it("an unknown word is echoed with its case preserved and points at help", () => {
    assertEquivalent("FooBar", null);
    assert.ok(runConsole("FooBar", null).text.includes("FooBar"));
    assert.ok(!runConsole("FooBar", null).text.includes("foobar"));
  });

  it("empty input prints nothing", () => {
    assert.equal(runConsole("", null).kind, "none");
    assert.equal(runConsole("   ", null).kind, "none");
  });
});

describe("Property 3: Preservation - console commands return equivalent information", () => {
  it("every command in the domain carries the baseline facts and no banned phrase (300 runs)", () => {
    fc.assert(
      fc.property(consoleCommandArb, standingsArb, (cmd, standings) => {
        assertEquivalent(cmd, standings);
      }),
      { numRuns: 300 },
    );
  });

  it("leaderboard lists every generated standing in order (300 runs)", () => {
    fc.assert(
      fc.property(standingsArb, (standings) => {
        assertEquivalent("leaderboard", standings);
      }),
      { numRuns: 300 },
    );
  });
});
