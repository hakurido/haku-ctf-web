import type { Metadata } from "next";
import { ScoreboardView } from "@/components/scoreboard/ScoreboardView";

export const metadata: Metadata = {
  title: "Scoreboard",
  description:
    "Agent handles on AGENTGATE CTF ranked by score, with the gates each one has solved and whether it holds a Proof-of-Pwn badge.",
};

export default function ScoreboardPage() {
  return <ScoreboardView />;
}
