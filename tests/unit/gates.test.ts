import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readRepoFile, showApi } from "../support/source.ts";
import { BASE_URL, GATES, SKILL_URL, absoluteUrl, gatesExports, getGate, loadChallenges } from "../preserve/subjects.ts";
import {
  GATE2_INCREMENT_BASELINE,
  GATES_BASELINE,
  INSTANCE_BASELINE,
  TOTAL_POINTS,
  URLS_BASELINE,
} from "../fixtures/baseline/gates-baseline.ts";

describe("K09: gates.ts matches the calibrated agent surface", () => {
  it("has the eight gates in order with the baseline points, TTLs, endpoints, and request fields", () => {
    assert.equal(GATES.length, 8);
    GATES.forEach((g, i) => {
      const b = GATES_BASELINE[i];
      assert.equal(g.number, b.number);
      assert.ok(g.name.toLowerCase().startsWith(b.name.toLowerCase()), `Gate ${b.number} name ${JSON.stringify(g.name)} starts with ${b.name}`);
      assert.equal(g.points, b.points, `Gate ${b.number} points`);
      assert.equal(g.ttlSeconds, b.ttlSeconds, `Gate ${b.number} TTL`);
      assert.deepEqual(g.endpoints, b.endpoints, `Gate ${b.number} endpoints`);
    });
  });

  it("points total 25,500", () => {
    assert.equal(GATES.reduce((sum, g) => sum + g.points, 0), TOTAL_POINTS);
  });

  it("uses the fixed production URLs (A10)", () => {
    assert.equal(BASE_URL, URLS_BASELINE.base);
    assert.equal(SKILL_URL, URLS_BASELINE.skill);
    assert.equal(absoluteUrl("/api/gate2/challenge"), `${URLS_BASELINE.base}/api/gate2/challenge`);
  });

  it("getGate accepts only 1 to 8", () => {
    for (const n of ["1", "2", "3", "4", "5", "6", "7", "8"]) assert.equal(getGate(n)?.number, Number(n));
    for (const bad of ["0", "9", "x", "01", " 1", "1.0", ""]) assert.equal(getGate(bad), undefined, JSON.stringify(bad));
  });

  it("GATE2_INCREMENT, when gates.ts exports it, is skill.md's C", () => {
    const exported = gatesExports.GATE2_INCREMENT;
    if (exported !== undefined) assert.equal(String(exported), GATE2_INCREMENT_BASELINE);
  });
});

describe("K09: the baseline matches the challenge generators", () => {
  it("TTLs and instance sizes come from the challenge generators", async () => {
    const challenges = await loadChallenges();
    const g2 = challenges.generateGate2Challenge();
    const g3 = challenges.generateGate3Challenge();
    const g4 = challenges.generateGate4Challenge();
    assert.deepEqual([g2.ttl, g3.ttl, g4.ttl], GATES_BASELINE.slice(1, 4).map((g) => g.ttlSeconds));
    assert.equal(g2.sequence.length, INSTANCE_BASELINE.gate2.sequenceLength);
    assert.equal(g3.variables, INSTANCE_BASELINE.gate3.variables);
    assert.equal(g3.clauses.length, INSTANCE_BASELINE.gate3.clauses);
    assert.ok(g3.clauses.every((c: any) => c.length === INSTANCE_BASELINE.gate3.literalsPerClause));
    assert.equal(g4.instructions.length, INSTANCE_BASELINE.gate4.rounds);
  });

  it("Gate 2 verifies predictions correctly", async () => {
    const challenges = await loadChallenges();
    const { sessionToken } = challenges.generateGate2Challenge();
    const bad = challenges.verifyGate2Solution(sessionToken, "99999999999999999");
    assert.equal(bad.success, false);
    assert.match(bad.message, /Prediction mismatch/i);
  });

  it("Gate 2's increment C is in skill.md and in the generator", () => {
    assert.ok(readRepoFile("public/skill.md").includes(GATE2_INCREMENT_BASELINE));
    assert.ok(readRepoFile("src/lib/manifest.ts").includes(GATE2_INCREMENT_BASELINE));
  });
});
