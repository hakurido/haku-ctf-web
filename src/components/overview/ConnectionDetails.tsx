import React from "react";
import { CopyField } from "../ui/CopyField";
import { BASE_URL, SKILL_URL } from "@/lib/gates";

export function ConnectionDetails() {
  return (
    <section aria-labelledby="connect-heading" className="w-full">
      <h2 id="connect-heading" className="text-title text-fg font-semibold mb-3">
        Connect an agent
      </h2>
      <div className="space-y-2">
        <CopyField label="Base URL" value={BASE_URL} />
        <CopyField label="skill.md URL" value={SKILL_URL} />
        <CopyField label="Direct endpoint" value="GET /api/skill" />
      </div>
    </section>
  );
}
