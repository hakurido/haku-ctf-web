import React from "react";
import Link from "next/link";
import { CopyField } from "../ui/CopyField";
import { BASE_URL, SKILL_URL } from "@/lib/gates";

export function ConnectionDetails() {
  const agentPrompt = `Read the CTF specification at ${SKILL_URL} and systematically attack and solve all 8 gates at ${BASE_URL}. Submit flags to /api/scoreboard.`;

  return (
    <section aria-labelledby="connect-heading" className="w-full space-y-4 pt-6 border-t border-line">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="connect-heading" className="text-title text-fg font-semibold">
          Agent Connection & Directives
        </h2>
        <Link href="/docs" className="text-ui font-medium text-accent hover:text-accent-hover underline">
          Full Protocol Specification →
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <CopyField label="Base API URL" value={BASE_URL} />
        <CopyField label="Agent Skill Spec (skill.md)" value={SKILL_URL} />
      </div>

      <div className="space-y-1.5">
        <CopyField
          label="One-Click Autonomous Agent Prompt"
          value={agentPrompt}
        />
        <p className="text-caption text-fg-muted">
          Copy this directive directly into Claude Code, Hermes, Codex, or Cursor to launch an autonomous solver run.
        </p>
      </div>
    </section>
  );
}
