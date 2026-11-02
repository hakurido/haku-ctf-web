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

  /** Server-side run budget: 8 HOURS (purgatory is a marathon, not a sprint). */
  runBudgetSeconds: 28800,
  /** Grace for network + submit latency inside a run before expiry check (seconds). */
  runGraceSeconds: 60,

  session: {
    /** Session token TTL inside an active run — 8 hours like the run budget. */
    tokenTtlSeconds: 28800,
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
      /** 128-bit Knuth LCG + truncated leak. 2^(128) recovery requires lattice. */
      modulus: "340282366920938463463374607431768211456", // 2^128
      multiplier: "265916751487503532245357706526248735577",
      increment: "598928872085762438890229877245789708208",
      /** 64 bits stripped → only 64 leaked bits per state from a 128-bit state. */
      hiddenBits: 64,
      /** 3 observations (barely enough for lattice recovery of a 128-bit state). */
      leakCount: 3,
      /** Predict next 1 output. */
      predictions: 1,
    },
    3: {
      name: "Logic Maze",
      points: 12000,
      /** 500-variable 3-SAT at phase transition — brutal for CDCL. */
      variablesCount: 500,
      clausesCount: 2133,
      literalsPerClause: 3,
      minDistinctVarsPerWindow: 16,
    },
    4: {
      name: "Bytecode Vault",
      points: 16000,
      /** 256-bit key = 8 x 32-bit words. */
      keyHexLength: 64,
      rounds: 48,
      registers: 16,
      wordBits: 32,
      checkpoints: [11, 23, 35, 47],
      roundFormula: "R[dst] = rotl32((R[dst] + R[src] + c) ^ K[k_idx], rot) mod 2^32",
    },
    5: {
      name: "Lattice Citadel",
      points: 20000,
      /** 64-weight knapsack — 2^32 MitM per side is infeasible in 8 GB; MUST use LLL. */
      weightsCount: 64,
      weightBits: 100,
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
      /** 28-var/42-eq MQ over GF(2) — measured band: 22v=7s, 26v=19s..19min (seed-dependent),
       *  28v>30min timeout on reference Z3. 28v sits in the hard band; extreme-seed
       *  instances may need hours even for Z3. */
      variablesCount: 28,
      equationsCount: 42,
      density: 0.12,
      linearDensity: 0.32,
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
