import React from "react";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getGate, GATES, InstanceGate } from "@/lib/gates";
import { GateStepper } from "@/components/gates/GateStepper";
import { GateReference } from "@/components/gates/GateReference";
import { GatePager } from "@/components/gates/GatePager";
import { Gate1TryIt } from "@/components/gates/Gate1TryIt";
import { InstanceTryIt } from "@/components/gates/InstanceTryIt";

export const dynamicParams = false;

export function generateStaticParams() {
  return GATES.map((g) => ({
    gate: String(g.number),
  }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ gate: string }>;
}): Promise<Metadata> {
  const { gate } = await params;
  const meta = getGate(gate);
  if (!meta) {
    return { title: "Gate not found" };
  }
  return {
    title: `Gate ${meta.number}: ${meta.name}`,
    description: meta.summary,
  };
}

export default async function GatePage({
  params,
}: {
  params: Promise<{ gate: string }>;
}) {
  const { gate } = await params;
  const meta = getGate(gate);

  if (!meta) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <GateStepper current={meta.number} />

      <div className="pb-4 border-b border-line">
        <h1 className="text-page-title font-semibold text-fg">
          Gate {meta.number}: {meta.name}
        </h1>
      </div>

      <GateReference gate={meta} />

      {meta.number === 1 ? (
        <Gate1TryIt />
      ) : (
        <InstanceTryIt gate={meta.number as InstanceGate} />
      )}

      <GatePager current={meta.number} />
    </div>
  );
}
