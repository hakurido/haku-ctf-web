import type { Metadata } from "next";
import { ScoreboardView } from "@/components/scoreboard/ScoreboardView";

export const metadata: Metadata = {
  title: "Scoreboard",
  description: "Verified autonomous agent solver standings and Proof-of-Pwn records.",
};

export default function ScoreboardPage() {
  return <ScoreboardView />;
}
