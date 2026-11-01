// Property 2: Preservation - the reference solver still clears every gate (K04).
//
// Requirement 3.3. Must pass on HEAD c6d13ea and after the fix.
//
// Safety: the committed test_agent_solver.py targets production
// (BASE = "https://ctf.hakudigital.tech") and is never executed. runSolverCopy()
// copies it to %TEMP%, rewrites only the BASE line to this server's localhost
// origin, checks that exactly that line differs, and runs the copy with
// PYTHONUTF8=1. The copy registers the handle JABRIK on the local scoreboard.
//
// Starts `next start -p 3103` from the existing .next build, or uses BASE_URL
// when it points at a running localhost server. Run it first after a server
// starts. Run: node --test tests/solver/solver.test.ts

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { after, before, test } from "node:test";
import { CONTRACT_PORT, expectedSolverScoreboard, SOLVER_FIXTURE } from "../capture/api-contract.ts";
import { ensureServer } from "../support/server.ts";
import type { ServerHandle } from "../support/server.ts";
import { normalizeSolverOutput, parseSolverOutput, runSolverCopy } from "../support/solver-copy.ts";
import type { SolverRun } from "../support/solver-copy.ts";

let server: ServerHandle | undefined;
let run: SolverRun | undefined;

function solverRun(): SolverRun {
  assert.ok(run, "solver copy did not run");
  return run;
}

function output(r: SolverRun): string {
  return `--- stdout ---\n${r.stdout}\n--- stderr ---\n${r.stderr}`;
}

before(async () => {
  server = await ensureServer(CONTRACT_PORT);
  run = await runSolverCopy(server.baseUrl, { timeoutMs: 90_000 });
}, { timeout: 240_000 });

after(async () => {
  await server?.stop();
});

test("K04: the solver copy differs from the committed file only in BASE, set to localhost", () => {
  const r = solverRun();
  assert.ok(server);
  assert.equal(r.copy.originalLine, 'BASE = "https://ctf.hakudigital.tech"');
  assert.equal(r.copy.rewrittenLine, `BASE = "${server.baseUrl}"`);
  assert.match(r.copy.baseUrl, /^http:\/\/(localhost|127\.0\.0\.1|\[::1\]):\d+$/);
});

test("K04: the solver exits 0 within 90 s", () => {
  const r = solverRun();
  assert.equal(r.timedOut, false, `timed out after ${r.durationMs} ms\n${output(r)}`);
  assert.equal(r.exitCode, 0, output(r));
});

test("K04: the solver recovers all four flags", () => {
  const r = solverRun();
  const { flags } = parseSolverOutput(r.stdout);
  assert.equal(flags.length, 4);
  flags.forEach((flag, i) => {
    assert.ok(flag !== null, `Flag ${i + 1} is None\n${output(r)}`);
    assert.match(flag, /^HAKU\{[^}]+\}$/, `Flag ${i + 1}`);
  });
});

test("K04: the scoreboard accepts each flag for 1000, 2000, 2500, and 3000 points", () => {
  const r = solverRun();
  assert.deepEqual(parseSolverOutput(r.stdout).scoreboard, expectedSolverScoreboard(), output(r));
});

test("K04: the solver receives a Proof-of-Pwn badge", () => {
  const r = solverRun();
  const { proofBadge } = parseSolverOutput(r.stdout);
  assert.ok(proofBadge, `no PROOF BADGE line\n${output(r)}`);
  assert.match(proofBadge, /^HAKU\{AGENT_JABRIK_GATES_1234_VERIFIED_[0-9a-f]{16}\}$/);
});

test("K04: normalized solver output equals solver.txt", () => {
  const r = solverRun();
  const expected = readFileSync(SOLVER_FIXTURE, "utf8").replace(/\r\n/g, "\n");
  assert.equal(normalizeSolverOutput(r.stdout), expected);
});
