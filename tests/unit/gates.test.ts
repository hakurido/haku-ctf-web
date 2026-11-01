// src/lib/gates.ts (through tests/preserve/subjects.ts), K09 (3.16, A15):
// the UI's gate facts equal the agent surface at c6d13ea. The baseline is
// tests/fixtures/baseline/gates-baseline.ts; this file also checks that
// baseline against the frozen API (challenges.ts imported read-only, route
// sources read with `git show c6d13ea:`). No server.
//
// Names are compared by prefix, so "Neural Sentry (Hell)" (HEAD) and
// "Neural Sentry" (after A14) both pass.
//
// **Validates: Requirements 3.16, 3.1**

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

describe("K09: gates.ts matches the c6d13ea agent surface", () => {
  it("has the four gates in order with the baseline points, TTLs, endpoints, and request fields", () => {
    assert.equal(GATES.length, 4);
    GATES.forEach((g, i) => {
      const b = GATES_BASELINE[i];
      assert.equal(g.number, b.number);
      assert.ok(g.name.toLowerCase().startsWith(b.name.toLowerCase()), `Gate ${b.number} name ${JSON.stringify(g.name)} starts with ${b.name}`);
      assert.equal(g.points, b.points, `Gate ${b.number} points`);
      assert.equal(g.ttlSeconds, b.ttlSeconds, `Gate ${b.number} TTL`);
      assert.deepEqual(g.endpoints, b.endpoints, `Gate ${b.number} endpoints`);
      assert.deepEqual(g.requestFields, b.requestFields, `Gate ${b.number} request fields`);
    });
  });

  it("points total 8,500", () => {
    assert.equal(GATES.reduce((sum, g) => sum + g.points, 0), TOTAL_POINTS);
  });

  it("uses the fixed production URLs (A10)", () => {
    assert.equal(BASE_URL, URLS_BASELINE.base);
    assert.equal(SKILL_URL, URLS_BASELINE.skill);
    assert.equal(absoluteUrl("/api/gate2/challenge"), `${URLS_BASELINE.base}/api/gate2/challenge`);
  });

  it("getGate accepts only 1 to 4", () => {
    for (const n of ["1", "2", "3", "4"]) assert.equal(getGate(n)?.number, Number(n));
    for (const bad of ["0", "5", "x", "01", " 1", "1.0", ""]) assert.equal(getGate(bad), undefined, JSON.stringify(bad));
  });

  it("GATE2_INCREMENT, when gates.ts exports it, is skill.md's C", () => {
    const exported = gatesExports.GATE2_INCREMENT;
    if (exported !== undefined) assert.equal(String(exported), GATE2_INCREMENT_BASELINE);
  });
});

describe("K09: the baseline matches the frozen API at c6d13ea", () => {
  it("TTLs and instance sizes come from the challenge generators", async () => {
    const challenges = await loadChallenges();
    const g2 = challenges.generateGate2Challenge();
    const g3 = challenges.generateGate3Challenge();
    const g4 = challenges.generateGate4Challenge();
    assert.deepEqual([g2.ttl, g3.ttl, g4.ttl], GATES_BASELINE.slice(1).map((g) => g.ttlSeconds));
    assert.equal(g2.sequence.length, INSTANCE_BASELINE.gate2.sequenceLength);
    assert.equal(g3.variables, INSTANCE_BASELINE.gate3.variables);
    assert.equal(g3.clauses.length, INSTANCE_BASELINE.gate3.clauses);
    assert.ok(g3.clauses.every((c) => c.length === INSTANCE_BASELINE.gate3.literalsPerClause));
    assert.equal(g4.bytecodeHex.length / 2, INSTANCE_BASELINE.gate4.bytecodeBytes);
  });

  it("Gate 2 takes exactly three predictions", async () => {
    const challenges = await loadChallenges();
    const { sessionToken } = challenges.generateGate2Challenge();
    const two = challenges.verifyGate2Solution(sessionToken, ["1", "2"]);
    assert.equal(two.success, false);
    assert.match(two.message, new RegExp(`\\b${INSTANCE_BASELINE.gate2.predictions}\\b`));
    const three = challenges.verifyGate2Solution(sessionToken, ["1", "2", "3"]);
    assert.match(three.message, /step 1/, "three values reach the comparison");
  });

  it("Gate 4 has 9 opcodes including 0x08", () => {
    const route = showApi("src/app/api/gate4/challenge/route.ts");
    const opcodes = [...route.matchAll(/"(0x[0-9A-F]{2})":/g)].map((m) => m[1]);
    assert.equal(opcodes.length, 9);
    assert.ok(opcodes.includes("0x08"));
    assert.deepEqual(opcodes, INSTANCE_BASELINE.gate4.opcodes);
  });

  it("Gate 2's increment C is in skill.md and in the generator", () => {
    assert.ok(readRepoFile("public/skill.md").includes(GATE2_INCREMENT_BASELINE));
    assert.ok(showApi("src/lib/challenges.ts").includes(`BigInt("${GATE2_INCREMENT_BASELINE}")`));
  });
});
