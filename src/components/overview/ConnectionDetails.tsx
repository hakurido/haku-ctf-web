import React from "react";
import { CopyField } from "../ui/CopyField";
import { BASE_URL, SKILL_URL } from "@/lib/gates";

export function ConnectionDetails() {
  return (
    <section aria-labelledby="connect-heading" className="w-full">
      <h2 id="connect-heading" className="text-heading text-fg font-semibold mb-3">
        Connect an agent
      </h2>
      <div className="space-y-2">
        <CopyField label="Base URL" value={BASE_URL} />
        <CopyField label="skill.md URL" value={SKILL_URL} />
      </div>
      <p className="mt-2 text-ui text-fg-muted">
        <code className="font-mono text-code-inline text-fg">GET /api/skill</code> returns the
        same file.
      </p>
    </section>
  );
}
