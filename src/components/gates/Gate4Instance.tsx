"use client";

import React from "react";
import { Gate4Challenge } from "@/lib/api";
import { TextField } from "../ui/Field";
import { useAppState } from "../state/AppStateProvider";

export interface Gate4InstanceProps {
  data: Gate4Challenge;
  readOnly: boolean;
}

export function Gate4Instance({ data, readOnly }: Gate4InstanceProps) {
  const { state, setField } = useAppState();
  const byteCount = Math.floor(data.bytecodeHex.length / 2);
  const opcodes = Object.entries(data.vmSpec?.opcodes || {});

  return (
    <div className="space-y-5">
      <div>
        <h4 className="text-caption font-semibold uppercase tracking-label text-fg-muted mb-2">
          Bytecode ({byteCount} bytes, hex)
        </h4>
        <div className="p-3 rounded-md border border-line bg-inset font-mono text-code text-fg break-all select-all">
          {data.bytecodeHex}
        </div>
      </div>

      {opcodes.length > 0 && (
        <div>
          <h4 className="text-caption font-semibold uppercase tracking-label text-fg-muted mb-2">
            Opcode table
          </h4>
          <div className="overflow-x-auto rounded-md border border-line">
            <table className="w-full text-left text-caption font-mono">
              <thead className="bg-surface border-b border-line text-fg-muted">
                <tr>
                  <th className="py-2 px-3">Opcode</th>
                  <th className="py-2 px-3">Meaning</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line bg-canvas">
                {opcodes.map(([op, desc]) => (
                  <tr key={op}>
                    <td className="py-1.5 px-3 font-semibold text-accent">{op}</td>
                    <td className="py-1.5 px-3 text-fg-secondary">{desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div>
        <TextField
          label="Key (hex)"
          description="16 hex characters for the 8-byte key, such as a1b2c3d4e5f60718. A 0x prefix is accepted."
          mono
          value={state.gate4.inputs}
          onChange={(e) => setField("gate4.inputs", e.target.value)}
          disabled={readOnly}
          placeholder="e.g. 53b9e1df5c6c0f51"
        />
      </div>
    </div>
  );
}
