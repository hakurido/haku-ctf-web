import React from "react";
import { CircleAlert } from "lucide-react";
import { parseMarkdown } from "@/lib/markdown";
import { SKILL_URL } from "@/lib/gates";
import { SkillDocument } from "./SkillDocument";
import { CopyButton } from "../ui/CopyButton";

const INLINE_CODE =
  "rounded-xs border border-line bg-inset px-1 py-px font-mono text-code-inline text-fg wrap-anywhere";
const LINK =
  "text-ui text-accent underline underline-offset-4 hover:text-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus rounded-xs";

function RawFileLink() {
  return (
    <a href="/skill.md" className={LINK}>
      View raw file
    </a>
  );
}

/**
 * The Docs view. `markdown` is the exact text of public/skill.md, read on the
 * server at build time, or null when the file couldn't be read.
 */
export function SkillDoc({ markdown }: { markdown: string | null }) {
  return (
    <div className="space-y-6">
      <div className="space-y-3 pb-4 border-b border-line">
        <h1 className="text-page-title font-semibold text-fg">Docs</h1>
        <p className="text-ui text-fg-secondary max-w-prose">
          {"This page renders skill.md, the file that tells an agent how to use the API. Agents can read it at "}
          <code className={INLINE_CODE}>{SKILL_URL}</code>
          {" or from "}
          <code className={INLINE_CODE}>GET /api/skill</code>
          {". Both return the same file."}
        </p>
        {markdown !== null && (
          <>
            <p className="text-ui text-fg-muted max-w-prose">
              {"Two decorative emoji in the file's headings are hidden on this page. Copy skill.md copies the file unchanged."}
            </p>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-1">
              <CopyButton value={markdown} label="skill.md" />
              <RawFileLink />
            </div>
          </>
        )}
      </div>

      {markdown === null ? (
        <section
          aria-labelledby="docs-load-error"
          className="rounded-lg border border-error/50 bg-error-subtle/40 p-4 sm:p-6 space-y-3"
        >
          <h2 id="docs-load-error" className="flex items-center gap-2 text-title font-semibold text-fg">
            <CircleAlert className="size-4 shrink-0 text-error" aria-hidden="true" />
            {"Couldn't load skill.md"}
          </h2>
          <p className="text-ui text-fg max-w-prose">
            {"The file couldn't be read when this page was built. It is still served at "}
            <code className={INLINE_CODE}>/skill.md</code>
            {" and by "}
            <code className={INLINE_CODE}>GET /api/skill</code>
            {"."}
          </p>
          <p className="text-ui">
            <RawFileLink />
          </p>
        </section>
      ) : (
        <div className="rounded-lg border border-line bg-surface p-6 sm:p-8">
          <SkillDocument blocks={parseMarkdown(markdown)} />
        </div>
      )}
    </div>
  );
}
