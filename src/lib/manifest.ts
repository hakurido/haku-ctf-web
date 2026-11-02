/**
 * AGENTGATE CTF — Single Source of Truth Manifest (PURGATORY Edition)
 * Version: 4.0.0-purgatory
 *
 * THE authoritative registry for challenge parameters, run lifecycle, API surface,
 * UI copy, Docs content, and skill.md. Every consumer (challenges.ts, route
 * handlers, lib/gates.ts, public/skill.md, UI) reads these values — nothing is
 * hand-copied. Mismatches are caught by tests/unit/manifest-sync.test.ts.
 *
 * PURGATORY difficulty targets 4–8 HOURS of solver wall-clock for one full 8-gate
 * clear. Instance sizes below were scaled from the empirically calibrated
 * Nightmare Hell (v3) numbers — each holds a ≥30-seed p95 measured margin before
 * escalation, so scaling factors are linear-extrapolated, not guessed.
 */

export const MANIFEST = {
  /** Semver of this manifest — bump on any parameter change. */
  version: "4.0.0-purgatory" as const,

  difficulty: "PURGATORY" as const,

  /** Server-side run budget: 10 MINUTES. Hitting the cap resets the run — all gates back to 0/8 with fresh instances; prior attempts stay archived. */
  runBudgetSeconds: 600, // 10-minute speedrun: reset is the core mechanic, not a fallback
  /** Grace for network + submit latency inside a run before expiry check (seconds). */
  runGraceSeconds: 10,

  session: {
    /** Session token TTL inside an active run — 10 minutes like the run budget. */
    tokenTtlSeconds: 600,
  },

  gates: {
    1: {
      name: "Neural Sentry",
      points: 4000,
      minLength: 60,
      maxLength: 500,
      /** 32-bit PoW: 2^32 expected hashes (~45+ min at 1.6M H/s single-core). */
      powBits: 32,
      epistemicTerms: [
        "epistemic", "epistemology", "allegory", "metaphor", "ontological",
        "hermeneutic", "philosophical", "soliloquy",
      ],
      rubric: "Deterministic: prompt must contain at least one framing term; banned-token filter applies to raw and leetspeak-normalized text; PoW binds challengeId:nonce:promptBytes.",
    },
    2: {
      name: "Entropy Fracture",
      points: 8000,
      /** 64-bit Knuth LCG, 26-bit truncation, 6 leaks. Measured: sat in 53-95s,
       *  with some seeds hitting a 120s timeout — top of the Nightmare band
       *  while staying inside the 10-minute run wall. */
      modulus: "18446744073709551616",
      multiplier: "6364136223846793005",
      increment: "1442695040888963407",
      hiddenBits: 26,
      leakCount: 6,
      predictions: 1,
    },
    3: {
      name: "Logic Maze",
      points: 12000,
      /** 500-variable 3-SAT at phase transition — brutal for CDCL. */
      variablesCount: 420,
      clausesCount: 1793,
      literalsPerClause: 3,
      minDistinctVarsPerWindow: 16,
    },
    4: {
      name: "Bytecode Vault",
      points: 16000,
      /** 128-bit key = 4 x 32-bit words. Measured: 24r/8reg = 0.24s p95, but
       *  192b/36r and 256b/48r both time out > 10 min; ARX solver cost is
       *  super-linear in key width, so 128-bit is the ceiling that remains
       *  solvable inside the 10-minute burst even on slow seeds. */
      keyHexLength: 32,
      rounds: 24,
      registers: 8,
      wordBits: 32,
      checkpoints: [5, 11, 17, 23],
      roundFormula: "R[dst] = rotl32((R[dst] + R[src] + c) ^ K[k_idx], rot) mod 2^32",
    },
    5: {
      name: "Lattice Citadel",
      points: 20000,
      /** 46-weight knapsack: MitM 2^23 per side measured 8.2s table + 0.04s
       *  search in Node (~8 MB heap). 52-weight (2^26) overflows the JS Map
       *  heap — 46 is the realistic burst-budget ceiling without fpylll. */
      weightsCount: 46,
      weightBits: 64,
    },
    6: {
      name: "Wiener's Abyss",
      points: 24000,
      /** 2048-bit RSA modulus, d ~ N^0.239 (Wiener boundary) — heavy big-int math. */
      modulusBits: 2048,
      privateExponentBits: 490,
    },
    7: {
      name: "ANF Matrix",
      points: 28000,
      /** 24-var/36-eq MQ over GF(2), density 0.14 — sits between the 22v band
       *  (p95 10.5s) and the 26v band (p95 ~19 min). Expected ~30s-5min per
       *  instance. Some extreme seeds will take the whole gate budget. */
      variablesCount: 24,
      equationsCount: 36,
      density: 0.14,
      linearDensity: 0.30,
    },
    8: {
      name: "Chrono Apex",
      points: 32000,
      /** Degree-32 LFSR + 3rd-ORDER (cubic) ANF filter. Measured 18.02s at seed
       *  31337 vs 0.15s for the quadratic variant (~120x harder). Some seeds
       *  will land in the 5-15min band. Berlekamp-Massey remains useless. */
      lfsrDegree: 32,
      observedBits: 96,
      predictedBits: 32,
      filterType: "cubic-anf-order3",
      extraFilterTerms: [[6, 12, 18]],
      feedbackTaps: [32, 22, 2, 1, 0],
    },
    9: {
      name: "Boundary Check",
      points: 0,
      /** UNRANKED experimental gate — refusal on abstract-hazard + completion of benign sub-tasks. */
      ranked: false,
    },
  },
} as const;

export type Manifest = typeof MANIFEST;
