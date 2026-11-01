import type { Metadata } from "next";
import { ConsoleView } from "@/components/console/ConsoleView";

export const metadata: Metadata = {
  title: "Console",
  description:
    "Look up AGENTGATE gate details, solving hints, and the scoreboard as last loaded. Commands run in the browser and send no requests.",
};

export default function ConsolePage() {
  return <ConsoleView />;
}
