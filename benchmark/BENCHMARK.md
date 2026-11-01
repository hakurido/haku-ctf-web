# AGENTGATE v3.0.0-speedrun — Holdout Benchmark Report

Date: 2026-11-02
Reference machine: Windows (win32), Python 3.14, Z3 5.3.2, 2-core basic (Vercel-equivalent class)
Suite: `benchmark/holdout_v3.py`

## Seeded Holdout Results

| Gate | Solver | Seeds | Median | p95 | Max | Gate Limit | Verdict |
|---|---|---|---|---|---|---|---|
| 1 PoW-24 | hashlib brute (challengeId:nonce:promptBytes) | 5* | 15.08s | 18.49s | 19.48s | 30s | PASS |
| 2 LCG-64 | Z3 QF_BV (Extract(63,18)) | 30 | 1.51s | 5.42s | 7.94s | 15s | PASS |
| 3 3-SAT | Z3 CDCL (occurrence-spread filter, min degree ≥ 6) | 30 | 0.18s | 0.78s | 3.46s | 15s | PASS |
| 4 ARX VM | Z3 BitVec32 (24 rounds, 4 checkpoints) | 30 | 0.10s | 0.24s | 0.47s | 25s | PASS |
| 5 MitM | Python dict 2^21+2^21 | 10* | 7.40s | 8.28s | 8.74s | 25s | PASS |
| 6 Wiener | Pure-Python continued fractions (d=245 bits) | 5* | <0.01s | <0.01s | <0.01s | 25s | PASS |
| 7 MQ GF(2) | Z3 Bool SAT (22v/30e, qd=0.12, ld=0.32) | 30 | 7.82s | 10.54s | 15.15s | 25s | PASS |
| 8 NLFG-32 | Z3 Bool algebraic SMT | 30 | 0.11s | 0.12s | 0.13s | 25s | PASS |

\* Reduced seeds: dominated by instance generation on the reference machine
(24-bit PoW mining, 1024-bit primegen, 2^21 MitM table build). Cross-checked
against a second independent solver (Node, 30 seeds, earlier run) where noted:
Gate 5 Node med 2.4s / max 3.4s; Gate 6 Node p95 7.6ms.

## Speedrun Budget Check

Total solver p95 sum: 18.49 + 5.42 + 0.78 + 0.24 + 8.28 + 0.01 + 10.54 + 0.12
= **43.88s** against the 480s (8 min) design target — 11x headroom. Remaining
600s - 440s ≈ operator/network reserve inside the 10-minute server-side run.

## Fairness Filters Applied

- Gate 3: instances regenerate unless every variable occurs in ≥ 6 clauses
  (blocks tiny-backdoor preprocessing shortcuts).
- Gate 7: 30/30 seeds sat under a 25s timeout (qd=0.12/ld=0.32 calibration);
  denser variants (0.35, 0.30) failed the p95 budget and were rejected.
- Gate 6: kept at d≈N^0.239 (245 bits). Boneh–Durfee at N^0.26–0.28 was
  evaluated and rejected: no SageMath/C-lattice on the reference stack solves
  it inside budget (pure-Python LLL exceeded 180s), violating the
  "don't ship unless the reference solver can clear it" rule.
- Gate 2: canonical-state verification loop added to holdout (recovered state
  must reproduce leak 0 exactly) — guards against ambigu­ous multi-state
  solutions at 18-bit truncation depth.

## Solver / Hardware Provenance

- z3 5.3.2 (pip wheel), Python 3.14 (uv-managed)
- Node 24 (reference for cross-language checks)
- Windows, 2-core shared (parity with Vercel basic build class)
- No tuned solver flags; stock `z3.Solver()` / `z3.SolverFor('QF_BV')`
