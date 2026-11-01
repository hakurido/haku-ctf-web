// Property 2: Preservation - the agent surface is unchanged (K01, K02, K03, K05).
//
// Requirements 3.1, 3.2, 3.3 (frozen files), 3.19. Must pass on HEAD c6d13ea
// and after the fix. Starts `next start -p 3103` from the existing .next build,
// or uses BASE_URL when it points at a running localhost server.
//
// K03 replays the probes of tests/capture/api-contract.ts and deep-compares
// them with tests/fixtures/baseline/api-contract.json. Random values (tokens,
// Gate 2 outputs, Gate 3 clauses, Gate 4 bytecode, counters, timestamps) are
// compared by type and size only; everything else must match exactly.
//
// Run: node --test --test-concurrency=1 tests/preserve/api-contract.test.ts

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { after, before, describe, test } from "node:test";
import { captureContract, CONTRACT_FIXTURE, CONTRACT_PORT } from "../capture/api-contract.ts";
import type { ContractFixture, ContractReplay, Json, ResponseRecord } from "../capture/api-contract.ts";
import { ensureServer, nextProbeIp, PROBE_BLOCKS, probeFetch } from "../support/server.ts";
import type { ServerHandle } from "../support/server.ts";
import { FROZEN_PATHS, frozenFileCheck, gitShowBuffer, readPackageJson, readRepoBuffer, REF_API } from "../support/source.ts";

/** Package names that are test or build tooling and must stay out of `dependencies`. */
const TEST_TOOLING =
  /^(?:fast-check|typescript|ts-node|tsx|vitest|jest|mocha|eslint(?:-.+)?|@eslint\/.+|@types\/.+|playwright(?:-core)?|@playwright\/.+)$/;

test("K01: frozen files are byte-identical to c6d13ea", () => {
  const r = frozenFileCheck();
  assert.equal(r.diffExit, 0, `git diff --exit-code ${REF_API} -- ${FROZEN_PATHS.join(" ")} reported:\n${r.diff}`);
  assert.equal(r.status, "", `git status --porcelain -- ${FROZEN_PATHS.join(" ")} printed:\n${r.status}`);
  assert.equal(r.clean, true);
});

test("K05: runtime dependencies contain no test tooling", () => {
  const pkg = readPackageJson();
  const deps = Object.keys(pkg.dependencies ?? {});
  assert.ok(deps.length > 0, "package.json has no dependencies");
  assert.deepEqual(
    deps.filter((d) => TEST_TOOLING.test(d)),
    [],
    "test tooling belongs in devDependencies",
  );
  const dev = pkg.devDependencies ?? {};
  for (const tool of ["fast-check", "playwright-core"]) {
    assert.ok(Object.hasOwn(dev, tool), `${tool} should be a devDependency`);
  }
});

/** Reads `path` (keys or array indices) from a JSON value; undefined if absent. */
function at(value: Json | undefined, ...path: (string | number)[]): Json | undefined {
  let cur: Json | undefined = value;
  for (const key of path) {
    if (cur === null || cur === undefined || typeof cur !== "object") return undefined;
    cur = Array.isArray(cur) ? cur[Number(key)] : cur[String(key)];
  }
  return cur;
}

function jsonBody(records: readonly ResponseRecord[], id: string): Json | undefined {
  const rec = records.find((r) => r.id === id);
  assert.ok(rec, `probe ${id} missing from the replay`);
  assert.equal(rec.body.kind, "json", `probe ${id} body is not JSON`);
  return rec.body.kind === "json" ? rec.body.value : undefined;
}

describe("agent surface over HTTP", () => {
  let server: ServerHandle | undefined;
  const origin = (): string => {
    assert.ok(server, "server not started");
    return server.baseUrl;
  };

  before(async () => {
    server = await ensureServer(CONTRACT_PORT);
  }, { timeout: 120_000 });

  after(async () => {
    await server?.stop();
  });

  test("K02: /api/skill and /skill.md serve public/skill.md byte for byte", async () => {
    const file = readRepoBuffer("public/skill.md");
    assert.ok(
      file.equals(gitShowBuffer(REF_API, "public/skill.md")),
      "working-tree public/skill.md differs from the c6d13ea blob (line endings?)",
    );
    assert.equal(file.includes(0x0d), false, "public/skill.md contains CR characters");

    const ip = nextProbeIp(PROBE_BLOCKS.preserveContract);
    const api = await probeFetch("/api/skill", { ip, baseUrl: origin() });
    const apiBody = Buffer.from(await api.arrayBuffer());
    assert.equal(api.status, 200);
    assert.equal(api.headers.get("content-type"), "text/markdown; charset=utf-8");
    assert.equal(api.headers.get("access-control-allow-origin"), "*");
    assert.ok(apiBody.equals(file), `/api/skill sent ${apiBody.length} bytes that differ from public/skill.md (${file.length} bytes)`);

    const stat = await probeFetch("/skill.md", { ip, baseUrl: origin() });
    const statBody = Buffer.from(await stat.arrayBuffer());
    assert.equal(stat.status, 200);
    assert.ok(statBody.equals(file), `/skill.md sent ${statBody.length} bytes that differ from public/skill.md (${file.length} bytes)`);
  });

  test("K03: contract replay matches api-contract.json", { timeout: 180_000 }, async (t) => {
    const fixture = JSON.parse(readFileSync(CONTRACT_FIXTURE, "utf8")) as ContractFixture;
    assert.equal(fixture.baseline, REF_API);
    const replay: ContractReplay = await captureContract({
      baseUrl: origin(),
      block: PROBE_BLOCKS.preserveContract,
      log: (line) => t.diagnostic(line),
    });
    t.diagnostic(`sent ${replay.sent} requests from ${replay.ips.length} probe IPs (${replay.ips.join(", ")})`);

    await t.test("same probe set and request count", () => {
      assert.deepEqual(
        replay.probes.map((p) => p.id),
        fixture.probes.map((p) => p.id),
      );
      assert.deepEqual(
        replay.rateLimits.map((r) => r.id),
        fixture.rateLimits.map((r) => r.id),
      );
      assert.equal(replay.requestCount, fixture.requestCount);
    });

    for (const expected of fixture.probes) {
      await t.test(expected.id, () => {
        const actual = replay.probes.find((p) => p.id === expected.id);
        assert.ok(actual, `probe ${expected.id} missing from the replay`);
        assert.deepEqual(actual, expected);
      });
    }

    for (const expected of fixture.rateLimits) {
      await t.test(`${expected.id} (limit ${expected.limit})`, () => {
        const actual = replay.rateLimits.find((r) => r.id === expected.id);
        assert.ok(actual, `rate-limit probe ${expected.id} missing from the replay`);
        assert.deepEqual(actual, expected);
      });
    }

    await t.test("instance sizes, TTLs, and points", () => {
      const p = replay.probes;
      const g2 = jsonBody(p, "gate2.challenge");
      assert.equal(at(g2, "sequence", "length"), 4, "Gate 2 has 4 outputs");
      assert.equal(at(g2, "sequence", "elements"), "decimal-string");
      assert.equal(at(g2, "ttlSeconds"), 15);
      const g3 = jsonBody(p, "gate3.challenge");
      assert.equal(at(g3, "variablesCount"), 120, "Gate 3 has 120 variables");
      assert.equal(at(g3, "clausesCount"), 512, "Gate 3 has 512 clauses");
      assert.equal(at(g3, "clauses", "count"), 512);
      assert.deepEqual(at(g3, "clauses", "literalsPerClause"), [3]);
      assert.equal(at(g3, "ttlSeconds"), 10);
      const g4 = jsonBody(p, "gate4.challenge");
      const opcodes = at(g4, "vmSpec", "opcodes");
      assert.ok(opcodes && typeof opcodes === "object" && !Array.isArray(opcodes), "Gate 4 vmSpec.opcodes is an object");
      assert.equal(Object.keys(opcodes).length, 9, "Gate 4 has 9 opcodes");
      assert.equal(at(g4, "ttlSeconds"), 20);
      for (const [id, gate, ttl] of [["gate2.challenge", 2, 15], ["gate3.challenge", 3, 10], ["gate4.challenge", 4, 20]] as const) {
        const token = at(jsonBody(p, id), "sessionToken");
        assert.equal(at(token, "containsDot"), true, `${id} sessionToken contains "."`);
        assert.equal(at(token, "claims", "gate"), gate);
        assert.equal(at(token, "claims", "lifetimeSeconds"), ttl);
      }
      const board = jsonBody(p, "scoreboard.get");
      assert.deepEqual(at(board, "gatePoints"), { "1": 1000, "2": 2000, "3": 2500, "4": 3000 });
      const points = at(board, "gatePoints");
      const total = Object.values(points && typeof points === "object" ? points : {}).reduce<number>(
        (sum, v) => sum + (typeof v === "number" ? v : 0),
        0,
      );
      assert.equal(total, 8500);
      const accepted = jsonBody(p, "scoreboard.post.accepted");
      assert.equal(at(accepted, "message"), "FLAG ACCEPTED for Gate 1! +1000 points.");
      assert.equal(at(accepted, "agent", "agentName"), "contractprobe");
    });
  });
});
