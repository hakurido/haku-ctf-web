import fs from "fs/promises";
import path from "path";
import type { Metadata } from "next";
import { SkillDoc } from "@/components/docs/SkillDoc";

export const metadata: Metadata = {
  title: "Docs",
  description: "Autonomous AI Agent specification and API contract (skill.md).",
};

export default async function DocsPage() {
  const filePath = path.join(process.cwd(), "public", "skill.md");
  let markdown = "";
  try {
    markdown = await fs.readFile(filePath, "utf-8");
  } catch {
    markdown = "# Specification file not found\n\nUnable to read public/skill.md.";
  }

  return <SkillDoc markdown={markdown} />;
}
