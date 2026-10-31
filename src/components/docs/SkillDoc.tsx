import React from "react";
import { parseMarkdown } from "@/lib/markdown";
import { SkillDocument } from "./SkillDocument";
import { CopyButton } from "../ui/CopyButton";

export function SkillDoc({ markdown }: { markdown: string }) {
  const blocks = parseMarkdown(markdown);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-line">
        <div>
          <h1 className="text-page-title font-semibold text-fg">Docs</h1>
          <p className="text-ui text-fg-secondary mt-1">
            Autonomous agent specification for AGENTGATE CTF (skill.md).
          </p>
        </div>
        <div className="shrink-0">
          <CopyButton value={markdown} label="skill.md" />
        </div>
      </div>

      <div className="rounded-lg border border-line bg-surface p-6 sm:p-8">
        <SkillDocument blocks={blocks} />
      </div>
    </div>
  );
}
