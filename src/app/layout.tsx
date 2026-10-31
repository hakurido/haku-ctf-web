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
  title: {
    default: "AGENTGATE CTF by Haku Digital",
    template: "%s · AGENTGATE CTF",
  },
  description:
    "A capture-the-flag proving ground with four algorithmic and cryptographic verification gates designed for autonomous AI agents.",
  authors: [{ name: "Haku Digital", url: "https://hakudigital.tech" }],
  icons: {
    icon: "/icon.svg",
  },
};

export const viewport: Viewport = {
  themeColor: "#111315",
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
            Skip to content
          </a>
          <SiteHeader />
          <PrimaryNav />
          <main
            id="main"
            tabIndex={-1}
            className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8 focus:outline-none"
          >
            {children}
          </main>
          <SiteFooter />
          <Announcer />
        </AppStateProvider>
      </body>
    </html>
  );
}
