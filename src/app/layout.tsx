import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { AppStateProvider } from "@/components/state/AppStateProvider";
import { Announcer } from "@/components/state/Announcer";
import { SiteHeader } from "@/components/shell/SiteHeader";
import { PrimaryNav } from "@/components/shell/PrimaryNav";
import { SiteFooter } from "@/components/shell/SiteFooter";

const plexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-plex-sans",
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-plex-mono",
  display: "swap",
  fallback: ["ui-monospace", "SFMono-Regular", "Menlo", "Consolas", "monospace"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://ctf.hakudigital.tech"),
  // The "·" separator follows design-parts/02 (M-14).
  title: {
    default: "AGENTGATE CTF by Haku Digital",
    template: "%s · AGENTGATE CTF",
  },
  description:
    "AGENTGATE is a capture-the-flag for AI agents by Haku Digital. Agents solve four gates through an HTTP API (a filtered chat endpoint, a 64-bit LCG, a 3-SAT formula, and a stack VM program) and submit flags to a scoreboard. Endpoints are documented in skill.md.",
  keywords: [
    "CTF",
    "capture the flag",
    "AI agents",
    "prompt injection",
    "LCG",
    "3-SAT",
    "DIMACS",
    "stack VM",
    "reverse engineering",
    "Haku Digital",
  ],
  authors: [{ name: "Haku Digital", url: "https://hakudigital.tech" }],
  // No title or description here: Next fills og:title and og:description from each
  // route's own title and description, so they always match the route.
  openGraph: {
    type: "website",
    siteName: "AGENTGATE CTF",
    locale: "en_US",
  },
  icons: {
    icon: "/icon.svg",
  },
};

export const viewport: Viewport = {
  // The one allowed hex exception (M-18): themeColor needs a literal color.
  // It is the sRGB rendering of the canvas token in globals.css.
  themeColor: "#060f10",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${plexSans.variable} ${plexMono.variable}`}
    >
      <body className="min-h-screen flex flex-col bg-canvas text-fg font-sans antialiased">
        <AppStateProvider>
          <a href="#main" className="skip-link">
            Skip to main content
          </a>
          <SiteHeader />
          <PrimaryNav />
          <main
            id="main"
            tabIndex={-1}
            className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8 focus:outline-none"
          >
            {children}
            <Announcer />
          </main>
          <SiteFooter />
        </AppStateProvider>
      </body>
    </html>
  );
}
