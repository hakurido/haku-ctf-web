import React from "react";
import { DIFFICULTY, type GateMeta, absoluteUrl } from "@/lib/gates";
import { formatPoints } from "@/lib/format";
import { CopyButton } from "../ui/CopyButton";

const TAG = "text-ui font-medium px-2 py-0.5 rounded-sm border";

export function GateReference({ gate }: { gate: GateMeta }) {
  const ttlNote = gate.ttlSeconds
    ? `Instances expire after ${gate.ttlSeconds} s, which is sized for an agent calling the API. Use the try-it area below to request a live instance and inspect what the API returns.`
    : "Gate 1 has no instance and no TTL. Each prompt is checked on its own. A prompt typed here passes only if its SHA-256 hash starts with 0000, so this area is mostly for seeing how the server answers.";

  return (
    <div className="space-y-6 mb-8">
      <div>
        <ul aria-label="Gate details" className="flex flex-wrap items-center gap-2 mb-3">
          <li className={`${TAG} bg-surface-hover border-line-control text-fg`}>{gate.topic}</li>
          <li className={`${TAG} border-line text-accent`}>{formatPoints(gate.points)} points</li>
          <li className={`${TAG} border-line text-fg-secondary`}>
            {gate.ttlSeconds ? `Instance TTL: ${gate.ttlSeconds} s` : "No TTL"}
          </li>
          <li className={`${TAG} border-line text-fg-secondary`}>Difficulty: {DIFFICULTY}</li>
        </ul>
        <p className="text-body text-fg leading-relaxed">{gate.description}</p>
        <p className="text-ui text-fg-muted mt-2">{ttlNote}</p>
      </div>

      <section aria-labelledby="endpoints-heading" className="space-y-3">
        <h2 id="endpoints-heading" className="text-heading font-semibold text-fg">
          Endpoints
        </h2>
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
                    <span className="h-5 px-1.5 inline-flex items-center rounded-sm bg-surface-hover font-semibold">
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
        <p className="text-ui text-fg-muted">
          The API limits requests per IP address. When the limit is hit, it returns HTTP 429 with
          the wait time.
        </p>
      </section>

      {gate.requestFields.length > 0 && (
        <section aria-labelledby="request-body-heading" className="space-y-3">
          <h2 id="request-body-heading" className="text-heading font-semibold text-fg">
            Request body
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
