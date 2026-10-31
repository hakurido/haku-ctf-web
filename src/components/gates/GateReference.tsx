import React from "react";
import { GateMeta, absoluteUrl } from "@/lib/gates";
import { formatPoints } from "@/lib/format";
import { CopyButton } from "../ui/CopyButton";

export function GateReference({ gate }: { gate: GateMeta }) {
  const ttlNote = gate.ttlSeconds
    ? `Instances expire after ${gate.ttlSeconds} s, which is sized for an agent calling the API. Use the try-it area below to request a live instance and inspect what the API returns.`
    : "Gate 1 has no instance and no TTL. Each prompt is checked on its own, so you can try it from this page.";

  return (
    <div className="space-y-6 mb-8">
      <div>
        <div className="flex flex-wrap items-center gap-3 mb-2">
          <span className="font-mono text-caption font-semibold px-2 py-0.5 rounded-sm bg-surface-hover border border-line-control text-fg">
            {gate.topic}
          </span>
          <span className="font-mono text-caption text-accent font-medium">
            {formatPoints(gate.points)} points
          </span>
          {gate.ttlSeconds && (
            <span className="font-mono text-caption text-fg-muted">
              Instance TTL: {gate.ttlSeconds} s
            </span>
          )}
        </div>
        <p className="text-body text-fg leading-relaxed">
          {gate.description}
        </p>
        <p className="text-caption text-fg-muted mt-2">
          {ttlNote}
        </p>
      </div>

      <div className="space-y-3">
        <h3 className="text-title font-semibold text-fg">Endpoints</h3>
        <div className="space-y-2">
          {gate.endpoints.map((ep) => {
            const fullUrl = absoluteUrl(ep.path);
            return (
              <div
                key={ep.path}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-md border border-line bg-surface"
              >
                <div className="flex items-center gap-2.5 font-mono text-code text-fg flex-wrap min-w-0">
                  <span className="h-5 px-1.5 inline-flex items-center rounded-sm bg-surface-hover text-code-sm font-semibold text-fg">
                    {ep.method}
                  </span>
                  <span className="break-all">{ep.path}</span>
                  <span className="text-caption text-fg-muted font-sans hidden md:inline">
                    · {ep.purpose}
                  </span>
                </div>
                <div className="shrink-0">
                  <CopyButton value={fullUrl} label={`${ep.method} ${ep.path}`} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {gate.requestFields.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-title font-semibold text-fg">Request Payload</h3>
          <div className="overflow-x-auto rounded-lg border border-line">
            <table className="w-full text-left text-ui">
              <thead className="bg-surface border-b border-line">
                <tr className="text-caption uppercase tracking-label text-fg-muted font-medium">
                  <th className="py-2 px-4">Field</th>
                  <th className="py-2 px-4">Type</th>
                  <th className="py-2 px-4">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line bg-canvas">
                {gate.requestFields.map((f) => (
                  <tr key={f.name}>
                    <td className="py-2.5 px-4 font-mono text-code text-fg font-medium">
                      {f.name}
                    </td>
                    <td className="py-2.5 px-4 font-mono text-code-sm text-fg-secondary">
                      {f.type}
                    </td>
                    <td className="py-2.5 px-4 text-ui text-fg-secondary">
                      {f.notes}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
