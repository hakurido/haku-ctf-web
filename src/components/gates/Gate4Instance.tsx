"use client";

import React from "react";
import type { Gate4Challenge } from "@/lib/api";
import { TextField } from "../ui/Field";
import { useAppState } from "../state/AppStateProvider";

export interface Gate4InstanceProps {
  data: Gate4Challenge;
  readOnly: boolean;
}

export function Gate4Instance({ data, readOnly }: Gate4InstanceProps) {
  const { state, setField } = useAppState();
  const initRegs = data.initialRegisters || [];
  const checkpoints = data.checkpoints || {};

  return (
    <div className="space-y-5">
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <h3 className="text-ui font-semibold text-fg">
            24-Round ARX Machine Specification
          </h3>
          <span className="text-caption font-mono text-fg-muted">
            8 Registers · 32-bit Words · 4 Checkpoints
          </span>
        </div>
        <p className="text-caption text-fg-muted mb-3 font-mono">
          Formula: R[dst] = rotl32((R[dst] + R[src] + c) ^ K[k_idx], rot) [mod 2^32]
        </p>

        <div className="mb-3">
          <span className="text-caption text-fg-muted block mb-1">Initial Register File (R0..R7):</span>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono text-code">
            {initRegs.map((val, idx) => (
              <div key={idx} className="p-2 rounded-md border border-line bg-inset flex justify-between">
                <span className="text-fg-muted text-caption">R{idx}</span>
                <span className="text-fg text-caption select-all">0x{val.toString(16).padStart(8, "0")}</span>
              </div>
            ))}
          </div>
        </div>

        <div>
          <span className="text-caption text-fg-muted block mb-1">Checkpoints (Rounds 5, 11, 17, 23):</span>
          <div className="space-y-1.5 font-mono text-caption">
            {Object.entries(checkpoints).map(([rnd, regs]) => (
              <div key={rnd} className="p-2 rounded-md border border-line bg-inset">
                <span className="text-accent font-semibold mr-2">Round {Number(rnd) + 1} State:</span>
                <span className="text-fg select-all break-all">
                  {regs.map((r, i) => `R${i}:0x${r.toString(16).padStart(8, "0")}`).join("  ")}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div>
        <TextField
          label="Key (32 hex characters)"
          description="32 hex characters representing 4 x 32-bit key words K0..K3 (128-bit master key)."
          mono
          autoComplete="off"
          spellCheck={false}
          value={state.gate4.inputs}
          onChange={(e) => setField("gate4.inputs", e.target.value)}
          disabled={readOnly}
          placeholder="e.g. c4702ba56367ec4350049d61e6e17946"
        />
      </div>
    </div>
  );
}
