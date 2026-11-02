/**
 * Manifest synchronization tests (v4.0.0-purgatory).
 *
 * Single-source-of-truth invariant: MANIFEST (src/lib/manifest.ts) drives
 * challenges, route metadata, lib/gates UI metadata, and public/skill.md.
 * Facts are inlined here (matching the manifest) because Node's ESM loader
 * cannot resolve the extension-less "@/" aliases used inside src/.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readRepoFile } from "../support/source.ts";
import { GATES as GATES_FROM_SRC, gatesExports } from "../../tests/preserve/subjects.ts";

const GATES = GATES_FROM_SRC;
const GATE1_RULES = gatesExports.GATE1_RULES as {
  minLength: number;
  maxLength: number;
  powBits: number;
  hashPrefix: string;
};
assert.ok(GATE1_RULES, "GATE1_RULES is exported from lib/gates.ts");

const MANIFEST_FACTS = {
  version: "4.0.0-purgatory",
  runBudgetSeconds: 28800,
  runGraceSeconds: 60,
  tokenTtlSeconds: 28800,
  gatePoints: [4000, 8000, 12000, 16000, 20000, 24000, 28000, 32000] as const,
  gate1: { minLength: 60, maxLength: 500, powBits: 32 },
  gate2HiddenBits: 64,
  gate2LeakCount: 3,
};

function gateN(n: number) {
  const g = GATES[n - 1];
  assert.ok(g, `Gate ${n} exists`);
  return g;
}

describe("manifest ↔ gates.ts sync (PURGATORY)", () => {
  it("all 8 gates exist with matching points; TTLs follow the manifest (Gate 1 stateless)", () => {
    assert.equal(GATES.length, 8);
    GATES.forEach((g, i) => {
      assert.equal(g.number, i + 1);
      assert.equal(g.points, MANIFEST_FACTS.gatePoints[i], `Gate ${g.number} points`);
      if (g.number === 1) {
        assert.equal(g.ttlSeconds, null, "Gate 1 is stateless (no instance TTL)");
      } else {
        assert.equal(g.ttlSeconds, MANIFEST_FACTS.tokenTtlSeconds, `Gate ${g.number} TTL`);
      }
    });
  });

  it("total score equals 144,000 and matches the sum of gate points", () => {
    const total = GATES.reduce((s, g) => s + g.points, 0);
    assert.equal(total, 144000);
    assert.equal(total, MANIFEST_FACTS.gatePoints.reduce((a, b) => a + b, 0));
  });

  it("GATE1_RULES mirrors manifest gate 1 settings (32-bit PoW)", () => {
    assert.equal(GATE1_RULES.minLength, MANIFEST_FACTS.gate1.minLength);
    assert.equal(GATE1_RULES.maxLength, MANIFEST_FACTS.gate1.maxLength);
    assert.equal(GATE1_RULES.powBits, MANIFEST_FACTS.gate1.powBits);
    assert.equal(GATE1_RULES.hashPrefix, "0".repeat(Math.floor(MANIFEST_FACTS.gate1.powBits / 4)));
  });

  it("manifest.ts itself declares the PURGATORY parameters", () => {
    const src = readRepoFile("src/lib/manifest.ts");
    assert.ok(src.includes("powBits: 32"));
    assert.ok(src.includes("hiddenBits: 64"));
    assert.ok(src.includes("leakCount: 3"));
    assert.ok(src.includes("runBudgetSeconds: 28800"));
    assert.ok(src.includes("PURGATORY"));
    assert.ok(src.includes("cubic-anf-order3"));
    assert.ok(src.includes("variablesCount: 28"));
    assert.ok(src.includes("modulusBits: 2048"));
  });
});

describe("manifest ↔ API routes sync (PURGATORY)", () => {
  it("gate2 route metadata uses manifest hiddenBits, not stale 18-bit copy", () => {
    const src = readRepoFile("src/app/api/gate2/challenge/route.ts");
    assert.ok(src.includes("MANIFEST.gates[2].hiddenBits"), "route reads hiddenBits from manifest");
    assert.ok(!src.includes("bottom 18 bits"), "no stale 18-bit copy");
    assert.ok(!src.includes('"truncationBits": 18'), "no hardcoded truncationBits");
  });

  it("gate1 route exposes manifest powBits and rubric", () => {
    const src = readRepoFile("src/app/api/gate1/challenge/route.ts");
    assert.ok(src.includes("cfg.powBits"), "route reads powBits from manifest config");
    assert.ok(src.includes("cfg.rubric"), "route exposes the deterministic rubric");
    assert.ok(src.includes("MANIFEST.gates[1]"), "route imports manifest gate 1 config");
  });

  it("run API exists and advertises the manifest budget (8h)", () => {
    const src = readRepoFile("src/app/api/run/route.ts");
    assert.ok(src.includes("MANIFEST.runBudgetSeconds"));
    const runsSrc = readRepoFile("src/lib/runs.ts");
    assert.ok(runsSrc.includes("MANIFEST.runBudgetSeconds"));
  });

  it("scoreboard binds submissions to runs and rejects expired ones", () => {
    const src = readRepoFile("src/app/api/scoreboard/route.ts");
    assert.ok(src.includes("recordGateSolve"));
    assert.ok(src.includes("getRun"));
    assert.ok(src.includes("RUN EXPIRED"));
  });

  it("challenges derive session TTL from MANIFEST.session, not per-gate stale values", () => {
    const src = readRepoFile("src/lib/challenges.ts");
    assert.ok(!src.includes(".ttlSeconds"), "no per-gate ttlSeconds reads remain");
    const uses = src.match(/MANIFEST\.session\.tokenTtlSeconds/g) || [];
    assert.ok(uses.length >= 8, `all 8 generators use session TTL (found ${uses.length})`);
  });
});

describe("manifest ↔ skill.md sync (PURGATORY)", () => {
  it("skill.md documents the 32-bit PoW, 8h run, and cubic filter", () => {
    const skill = readRepoFile("public/skill.md");
    assert.ok(skill.includes("32-bit"), "skill.md mentions 32-bit PoW");
    assert.ok(!skill.includes("24-bit PoW"), "no stale 24-bit copy");
    assert.ok(skill.includes("Run Lifecycle"), "run lifecycle documented");
    assert.ok(skill.includes("/api/run"), "run endpoint documented");
    assert.ok(skill.includes("runId"), "runId binding documented");
    assert.ok(skill.toUpperCase().includes("PURGATORY"), "difficulty named");
  });

  it("skill.md covers all 8 gates", () => {
    const skill = readRepoFile("public/skill.md");
    for (const name of ["NEURAL SENTRY", "ENTROPY FRACTURE", "LOGIC MAZE", "BYTECODE VAULT", "LATTICE CITADEL", "WIENER", "ANF MATRIX", "CHRONO APEX"]) {
      assert.ok(skill.toUpperCase().includes(name), `skill.md documents ${name}`);
    }
  });
});

describe("secret hygiene (no client leaks)", () => {
  it("session token payloads carry no flag strings", () => {
    const src = readRepoFile("src/lib/challenges.ts");
    assert.ok(!/createSignedToken\(\s*\d+[^)]*FLAGS\./.test(src), "no FLAGS value inside createSignedToken calls");
  });

  it("manifest carries no secret material", () => {
    const src = readRepoFile("src/lib/manifest.ts");
    assert.ok(!src.includes("HAKU{"), "no flag in manifest");
  });

  it("verifySignedToken uses HMAC (constant-time comparison primitive)", () => {
    const src = readRepoFile("src/lib/crypto.ts");
    assert.ok(src.includes("createHmac"), "HMAC verification present");
  });

  it("single-use jti mechanism exists for replay protection", () => {
    const src = readRepoFile("src/lib/crypto.ts");
    assert.ok(src.includes("consumeJti"), "consumeJti present");
    assert.ok(src.includes("Replay detected"), "replay rejection message present");
  });
});

describe("run lifecycle invariants (8h PURGATORY)", () => {
  it("run budget is 28800 seconds with 60s grace and session TTL matches budget", () => {
    assert.equal(MANIFEST_FACTS.runBudgetSeconds, 28800);
    assert.equal(MANIFEST_FACTS.runGraceSeconds, 60);
    assert.equal(MANIFEST_FACTS.tokenTtlSeconds, MANIFEST_FACTS.runBudgetSeconds);
  });

  it("runs.ts archives attempts (history preserved)", () => {
    const src = readRepoFile("src/lib/runs.ts");
    assert.ok(src.includes("archiveRun"));
    assert.ok(src.includes("attemptHistory"));
    const clears = src.match(/attemptHistory\.clear\(\)/g) || [];
    assert.ok(clears.length <= 1, "history clear appears at most once (test helper only)");
    if (clears.length === 1) {
      assert.ok(src.includes("_resetRunsForTests"), "clear is scoped to the test reset helper");
    }
  });
});
