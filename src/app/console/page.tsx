import type { Metadata } from "next";
import { ConsoleView } from "@/components/console/ConsoleView";

export const metadata: Metadata = {
  title: "Console",
  description: "Interactive shell for inspecting AGENTGATE gates, standings, and directives.",
};

export default function ConsolePage() {
  return <ConsoleView />;
}
