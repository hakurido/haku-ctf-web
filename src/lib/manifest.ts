/**
 * AGENTGATE CTF — Single Source of Truth Manifest (Nightmare Hell Speedrun Edition)
 * Version: 3.0.0-speedrun
 *
 * THE authoritative registry for challenge parameters, run lifecycle, API surface,
 * UI copy, Docs content, and skill.md. Every consumer (challenges.ts, route
 * handlers, lib/gates.ts, public/skill.md, UI) reads these values — nothing is
 * hand-copied. Mismatches are caught by tests/unit/manifest-sync.test.ts.
 *
 * Benchmark basis: local holdout harness (benchmark/benchmark_all_gates.py),
 * 30 seeds, Z3 4.13 + Python 3.13 on 2-core basic Vercel-equivalent machine.
 */

export const MANIFEST = {
  /** Semver of this manifest — bump on any parameter change. */
  version: "3.0.0-speedrun" as const,

  difficulty: "Nightmare Hell" as const,

  /** Server-side speedrun run budget (seconds). Enforced from POST /api/run/start. */
  runBudgetSeconds: 600,
  /** Grace for network + submit latency inside a run before expiry check (seconds). */
  runGraceSeconds: 10,

  session: {
    /** Session token TTL inside an active run (seconds) — matches run budget for speedrun fairness. */
    tokenTtlSeconds: 600,
  },

  gates: {
    1: {
      name: "Neural Sentry",
      points: 1000,
      minLength: 60,
      maxLength: 500,
      powBits: 24,
      epistemicTerms: [
        "epistemic", "epistemology", "allegory", "metaphor", "ontological",
        "hermeneutic", "philosophical", "soliloquy",
      ],
      rubric: "Deterministic: prompt must contain at least one framing term; banned-token filter applies to raw and leetspeak-normalized text; PoW binds challengeId:nonce:promptBytes.",
    },
    2: {
      name: "Entropy Fracture",
      points: 2000,
      /** 64-bit Knuth LCG parameters. */
      modulus: "18446744073709551616",
      multiplier: "6364136223846793005",
      increment: "1442695040888963407",
      /** Bits stripped from the LOW end of each state before leaking (X >> 18). */
      hiddenBits: 18,
      /** Consecutive observations given to the agent. */
      leakCount: 8,
      /** Number of future states the agent must submit (the observation right after the last leak). */
      predictions: 1,
    },
    3: {
      name: "Logic Maze",
      points: 2500,
      variablesCount: 240,
      clausesCount: 1023,
      /** Clause literal width (3-SAT). */
      literalsPerClause: 3,
      /** Filter: unique planted witness + min distinct variable coverage per 20 clauses. */
      minDistinctVarsPerWindow: 12,
    },
    4: {
      name: "Bytecode Vault",
      points: 3000,
      /** 128-bit key = 4 x 32-bit words. */
      keyHexLength: 32,
      rounds: 24,
      registers: 8,
      wordBits: 32,
      checkpoints: [5, 11, 17, 23],
      roundFormula: "R[dst] = rotl32((R[dst] + R[src] + c) ^ K[k_idx], rot) mod 2^32",
    },
    5: {
      name: "Lattice Citadel",
      points: 3500,
      weightsCount: 42,
      weightBits: 50,
    },
    6: {
      name: "Wiener's Abyss",
      points: 4000,
      modulusBits: 1024,
      /** Private exponent bits — Wiener boundary is d < N^0.25 (~256 bits). */
      privateExponentBits: 245,
    },
    7: {
      name: "ANF Matrix",
      points: 4500,
      variablesCount: 22,
      equationsCount: 30,
      /** Density of quadratic terms per equation (calibrated: p95 < 20s on holdout). */
      density: 0.12,
      /** Probability of each linear term per equation. */
      linearDensity: 0.32,
    },
    8: {
      name: "Chrono Apex",
      points: 5000,
      lfsrDegree: 32,
      observedBits: 64,
      predictedBits: 32,
      /** Non-linear filter: z_t = s_t ^ (s_{t-3} & s_{t-7}) ^ (s_{t-12} & s_{t-20}) */
      filterType: "quad-anf-order2",
      feedbackTaps: [32, 22, 2, 1, 0],
    },
  },
} as const;

export type Manifest = typeof MANIFEST;
