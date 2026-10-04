import type { Metadata } from "next";
import { IBM_Plex_Sans, JetBrains_Mono, Space_Grotesk } from "next/font/google";
import type { ReactNode } from "react";

import { Providers } from "@/components/providers";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

import "./globals.css";

const bodyFont = IBM_Plex_Sans({
  subsets: ["latin"],
  variable: "--font-ibm-plex-sans",
  weight: ["400", "600"],
});
const displayFont = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
  weight: ["500", "700"],
});
const monoFont = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  weight: ["400", "600"],
});

export const metadata: Metadata = {
  title: {
    default: "YieldLine — RWA credit workbench",
    template: "%s · YieldLine",
  },
  description:
    "A workshop prototype for risk-adjusted, permissioned RWA collateral on Arbitrum Sepolia.",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html
      className={`${bodyFont.variable} ${displayFont.variable} ${monoFont.variable}`}
      lang="en"
      suppressHydrationWarning
    >
      <body>
        <Providers>
          <SiteHeader />
          <main className="site-main">{children}</main>
          <SiteFooter />
        </Providers>
      </body>
    </html>
  );
}
