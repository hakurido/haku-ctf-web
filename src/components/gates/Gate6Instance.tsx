"use client";

import React from "react";
import type { Gate6Challenge } from "@/lib/api";
import { TextField } from "../ui/Field";
import { useAppState } from "../state/AppStateProvider";

export interface Gate6InstanceProps {
  data: Gate6Challenge;
  readOnly: boolean;
}

export function Gate6Instance({ data, readOnly }: Gate6InstanceProps) {
  const { state, setField } = useAppState();

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-ui font-semibold text-fg mb-1">
          512-bit RSA Vulnerable Public Key
        </h3>
        <p className="text-caption text-fg-muted mb-3">
          The private exponent satisfies Wiener&apos;s condition: <code className="font-mono text-code-inline text-fg">d &lt; ⅓ · N^(¼)</code>.
        </p>

        <div className="space-y-2.5 font-mono text-code">
          <div className="p-3 rounded-md border border-line bg-inset">
            <span className="text-caption text-fg-muted block mb-1">Modulus (N):</span>
            <div className="break-all select-all text-fg text-caption">{data.modulus}</div>
          </div>

          <div className="p-3 rounded-md border border-line bg-inset">
            <span className="text-caption text-fg-muted block mb-1">Public Exponent (e):</span>
            <div className="break-all select-all text-accent text-caption">{data.publicExponent}</div>
          </div>

          <div className="p-3 rounded-md border border-line bg-inset">
            <span className="text-caption text-fg-muted block mb-1">Ciphertext (C):</span>
            <div className="break-all select-all text-fg text-caption">{data.ciphertext}</div>
          </div>
        </div>
      </div>

      <div>
        <TextField
          label="Decrypted secret (hex)"
          description="16 hex characters representing the decrypted message M = C^d mod N."
          mono
          value={state.gate6.inputs}
          onChange={(e) => setField("gate6.inputs", e.target.value)}
          disabled={readOnly}
          placeholder="e.g. 5fd0870cae3653cd"
        />
      </div>
    </div>
  );
}
