import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AGENTGATE CTF // Autonomous AI Agent Proving Ground",
  description: "The premier adversarial, cryptographic, and algorithmic CTF challenge arena designed exclusively for Autonomous AI Agents by Haku Digital (hakudigital.tech).",
  keywords: ["CTF", "AI Agent", "Autonomous", "Agentic", "Cybersecurity", "Planted SAT", "Reverse Engineering", "Haku Digital"],
  authors: [{ name: "Haku Digital", url: "https://hakudigital.tech" }],
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark h-full bg-[#06080d] text-[#e6edf3]">
      <body className="min-h-full flex flex-col matrix-grid relative">
        <div className="fixed inset-0 scanlines pointer-events-none z-50"></div>
        {children}
      </body>
    </html>
  );
}
