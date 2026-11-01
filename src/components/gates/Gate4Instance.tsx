"use client";

import React, { useId } from "react";
import type { Gate4Challenge } from "@/lib/api";
import { TextField } from "../ui/Field";
import { useAppState } from "../state/AppStateProvider";

export interface Gate4InstanceProps {
  data: Gate4Challenge;
  readOnly: boolean;
}

export function Gate4Instance({ data, readOnly }: Gate4InstanceProps) {
  const { state, setField } = useAppState();
  const tableHeadingId = useId();
  const byteCount = Math.floor(data.bytecodeHex.length / 2);
  const opcodes = Object.entries(data.vmSpec?.opcodes || {});

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-ui font-semibold text-fg mb-2">Bytecode ({byteCount} bytes, hex)</h3>
        <pre className="p-3 rounded-md border border-line bg-inset font-mono text-code text-fg whitespace-pre-wrap break-all select-all">
          {data.bytecodeHex}
        </pre>
      </div>

      {opcodes.length > 0 && (
        <div>
          <h3 id={tableHeadingId} className="text-ui font-semibold text-fg mb-2">
            Opcode table
          </h3>
          <div className="overflow-x-auto rounded-md border border-line">
            <table aria-labelledby={tableHeadingId} className="w-full text-left text-ui">
              <thead className="bg-surface border-b border-line text-fg-muted">
                <tr>
                  <th scope="col" className="py-2 px-3 font-medium">Opcode</th>
                  <th scope="col" className="py-2 px-3 font-medium">Meaning</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line bg-canvas">
                {opcodes.map(([op, desc]) => (
                  <tr key={op}>
                    <td className="py-1.5 px-3">
                      <code className="font-mono text-code font-semibold text-accent">{op}</code>
                    </td>
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
          autoComplete="off"
          spellCheck={false}
          value={state.gate4.inputs}
          onChange={(e) => setField("gate4.inputs", e.target.value)}
          disabled={readOnly}
        />
      </div>
    </div>
  );
}
