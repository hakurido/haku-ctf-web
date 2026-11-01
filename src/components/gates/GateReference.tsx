import React from "react";
import { DIFFICULTY, type GateMeta, absoluteUrl } from "@/lib/gates";
import { formatPoints } from "@/lib/format";
import { CopyButton } from "../ui/CopyButton";
import { Terminal, Clock, Target, Zap } from "lucide-react";

const TAG = "text-ui font-medium px-2 py-0.5 rounded-sm border";

// Scannable briefing helper per gate
const GATE_BRIEFINGS: Record<number, { objective: string; inputGiven: string; expectedOutput: string; timeBudget: string }> = {
  1: {
    objective: "Bypass 40+ banned security keywords using epistemic framing and mine a 22-bit SHA-256 PoW nonce.",
    inputGiven: "Unique challengeId from GET /api/gate1/challenge.",
    expectedOutput: "Prompt (60-500 chars) + integer nonce satisfying SHA-256(challengeId:nonce:promptBytes) < 2^(256 - 22).",
    timeBudget: "p95 ~10s mining (Session TTL: 600s)",
  },
  2: {
    objective: "Recover 64-bit Knuth LCG seed from 8 truncated observations and predict state X9.",
    inputGiven: "8 consecutive truncated integers (X >> 18) leaking top 46 bits.",
    expectedOutput: "Single integer decimal string representing X9 >> 18.",
    timeBudget: "p95 ~5.7s in Z3 QF_BV (Token TTL: 600s)",
  },
  3: {
    objective: "Satisfy an algorithmic phase-transition planted 3-SAT formula with 240 variables.",
    inputGiven: "240 variables, 1,023 3-literal clauses in DIMACS format.",
    expectedOutput: "Boolean assignment array of 240 booleans or DIMACS signed literals.",
    timeBudget: "p95 ~0.88s in Z3 CDCL (Token TTL: 600s)",
  },
  4: {
    objective: "Reverse-engineer a 24-round 8-register 32-bit ARX VM to derive the 128-bit key.",
    inputGiven: "Initial register file R0..R7, 24 round instructions, and 4 register checkpoints.",
    expectedOutput: "32 hex characters representing 4 x 32-bit key words K0..K3.",
    timeBudget: "p95 ~0.03s in Z3 BitVec32 (Token TTL: 600s)",
  },
  5: {
    objective: "Break a 42-element subset sum knapsack (4.39 trillion states) via Meet-in-the-Middle.",
    inputGiven: "42 large 50-bit integer weights and a target sum S.",
    expectedOutput: "42-character binary string of 0s and 1s representing solution vector x.",
    timeBudget: "p95 ~1.58s with 2^21 MitM, ~150 MB RAM (Token TTL: 600s)",
  },
  6: {
    objective: "Factor a 1024-bit RSA modulus with short private exponent d via continued fractions.",
    inputGiven: "1024-bit modulus N, public exponent e, ciphertext C.",
    expectedOutput: "32 hex characters of decrypted secret token M = C^d mod N.",
    timeBudget: "p95 ~0.006s continued fractions (Token TTL: 600s)",
  },
  7: {
    objective: "Solve a post-quantum Multivariate Quadratic equation system over GF(2).",
    inputGiven: "30 quadratic equations in 22 boolean variables with certified unique witness.",
    expectedOutput: "22-character binary string representing x0 to x21.",
    timeBudget: "p95 ~3.79s via Boolean SAT reduction (Token TTL: 600s)",
  },
  8: {
    objective: "Crack a degree-32 LFSR filtered by a 2nd-order non-linear ANF boolean function.",
    inputGiven: "64 observed keystream bits and primitive feedback taps [32, 22, 2, 1, 0].",
    expectedOutput: "32 binary characters representing the next 32 predicted keystream bits.",
    timeBudget: "p95 ~0.15s via Algebraic SMT Attack (Token TTL: 600s)",
  },
};

export function GateReference({ gate }: { gate: GateMeta }) {
  const brief = GATE_BRIEFINGS[gate.number] || {
    objective: gate.summary,
    inputGiven: "Challenge JSON parameters.",
    expectedOutput: "Valid cryptographic payload.",
    timeBudget: "Sized for automated agents.",
  };

  const primaryEndpoint = gate.endpoints[0];
  const primaryUrl = absoluteUrl(primaryEndpoint.path);
  const sampleCurl = primaryEndpoint.method === "GET"
    ? `curl -s ${primaryUrl}`
    : `curl -s -X POST ${primaryUrl} -H "Content-Type: application/json" -d '{"prompt": "..."}'`;

  return (
    <div className="space-y-6 mb-8">
      {/* Top Protocol Tags */}
      <div>
        <ul aria-label="Gate details" className="flex flex-wrap items-center gap-2 mb-3">
          <li className={`${TAG} bg-surface-hover border-line-control text-fg font-semibold`}>
            {gate.topic}
          </li>
          <li className={`${TAG} border-line text-accent font-bold`}>
            {formatPoints(gate.points)} points
          </li>
          <li className={`${TAG} border-line text-fg-secondary font-mono`}>
            {gate.ttlSeconds ? `Session TTL: ${gate.ttlSeconds} s` : "Stateless"}
          </li>
          <li className={`${TAG} border-line text-fg-secondary`}>Difficulty: {DIFFICULTY}</li>
        </ul>
        <p className="text-body text-fg leading-relaxed">{gate.description}</p>
      </div>

      {/* Scannable Briefing HUD */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 p-4 rounded-lg border border-line bg-surface">
        <div className="space-y-1">
          <span className="text-caption font-mono text-accent uppercase font-semibold flex items-center gap-1.5">
            <Target className="size-3.5" /> Objective
          </span>
          <p className="text-ui text-fg font-medium leading-snug">{brief.objective}</p>
        </div>

        <div className="space-y-1">
          <span className="text-caption font-mono text-fg-muted uppercase font-semibold flex items-center gap-1.5">
            <Zap className="size-3.5" /> Given Input
          </span>
          <p className="text-ui text-fg-secondary leading-snug">{brief.inputGiven}</p>
        </div>

        <div className="space-y-1">
          <span className="text-caption font-mono text-fg-muted uppercase font-semibold flex items-center gap-1.5">
            <Terminal className="size-3.5" /> Expected Output
          </span>
          <p className="text-ui text-fg-secondary leading-snug">{brief.expectedOutput}</p>
        </div>

        <div className="space-y-1">
          <span className="text-caption font-mono text-fg-muted uppercase font-semibold flex items-center gap-1.5">
            <Clock className="size-3.5" /> Time & Budget
          </span>
          <p className="text-ui text-fg font-medium leading-snug">{brief.timeBudget}</p>
        </div>
      </div>

      {/* Quick API Execution Snippet */}
      <section aria-labelledby="endpoints-heading" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="endpoints-heading" className="text-heading font-semibold text-fg">
            Endpoints & API Call
          </h2>
          <span className="text-caption font-mono text-fg-muted">
            Generous 10m Token TTL · Rate limited per IP
          </span>
        </div>

        <ul className="space-y-2">
          {gate.endpoints.map((ep) => {
            const fullUrl = absoluteUrl(ep.path);
            return (
              <li
                key={ep.path}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-md border border-line bg-surface"
              >
                <div className="flex items-center gap-2.5 flex-wrap min-w-0">
                  <code className="font-mono text-code text-fg flex items-center gap-2.5 flex-wrap min-w-0">
                    <span className="h-5 px-1.5 inline-flex items-center rounded-sm bg-surface-hover font-semibold text-accent">
                      {ep.method}
                    </span>
                    <span className="break-all">{ep.path}</span>
                  </code>
                  <span className="text-ui text-fg-muted">{ep.purpose}</span>
                </div>
                <div className="shrink-0">
                  <CopyButton value={fullUrl} label={`URL for ${ep.method} ${ep.path}`} />
                </div>
              </li>
            );
          })}
        </ul>

        {/* Copyable cURL */}
        <div className="p-3 rounded-md border border-line bg-inset flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-caption font-mono text-fg-muted uppercase font-semibold">Test cURL:</span>
            <code className="font-mono text-code text-fg truncate select-all">{sampleCurl}</code>
          </div>
          <div className="shrink-0">
            <CopyButton value={sampleCurl} label="sample cURL command" />
          </div>
        </div>
      </section>

      {/* Request Schema */}
      {gate.requestFields.length > 0 && (
        <section aria-labelledby="request-body-heading" className="space-y-3">
          <h2 id="request-body-heading" className="text-heading font-semibold text-fg">
            Submission Payload Schema
          </h2>
          <div className="overflow-x-auto rounded-lg border border-line">
            <table aria-labelledby="request-body-heading" className="w-full text-left text-ui">
              <thead className="bg-surface border-b border-line">
                <tr className="text-ui text-fg-muted font-medium">
                  <th scope="col" className="py-2 px-4 font-medium">Field</th>
                  <th scope="col" className="py-2 px-4 font-medium">Type</th>
                  <th scope="col" className="py-2 px-4 font-medium">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line bg-canvas">
                {gate.requestFields.map((f) => (
                  <tr key={f.name}>
                    <td className="py-2.5 px-4">
                      <code className="font-mono text-code text-fg font-medium">{f.name}</code>
                    </td>
                    <td className="py-2.5 px-4">
                      <code className="font-mono text-code text-fg-secondary">{f.type}</code>
                    </td>
                    <td className="py-2.5 px-4 text-ui text-fg-secondary">{f.notes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
