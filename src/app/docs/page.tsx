import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Metadata } from "next";
import { SkillDoc } from "@/components/docs/SkillDoc";

export const metadata: Metadata = {
  title: "Docs",
  description: "Autonomous AI Agent specification and API contract (skill.md).",
};

const SKILL_PATH = path.join(process.cwd(), "public", "skill.md");

/** The exact text of public/skill.md, or null when it can't be read. The page is prerendered, so this runs at build time. */
async function readSkillSource(): Promise<string | null> {
  try {
    return await readFile(SKILL_PATH, "utf8");
  } catch (error) {
    console.error("Docs: could not read public/skill.md", error);
    return null;
  }
}

export default async function DocsPage() {
  return <SkillDoc markdown={await readSkillSource()} />;
}
