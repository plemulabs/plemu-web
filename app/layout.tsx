import type { Metadata, Viewport } from "next";
import "@fontsource-variable/space-grotesk";
import "@fontsource/dm-sans/400.css";
import "@fontsource/dm-sans/500.css";
import "@fontsource/dm-sans/600.css";
import "@fontsource/dm-mono/400.css";
import "@fontsource/silkscreen/400.css";
import "../components/wallet-adapter-local.css";
import "../components/wallet-adapter-retro.css";
import "./globals.css";
import "./play-system.css";
import "./handheld.css";
import "./devnet.css";
import "./market-terminal.css";
import { SolanaWalletProvider } from "../providers/SolanaWalletProvider";
import { DevnetShell } from "../components/devnet/shell";
import { PrivacyPreferencesProvider } from "../components/privacy-preferences";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#121418",
};

export const metadata: Metadata = {
  title: "Plemu Play — Devnet",
  description:
    "Discover, play, create, and collect. A new home for games, creators, and curious people.",
  icons: {
    icon: "/brand/plemu-pixel-face.png",
    apple: "/brand/plemu-pixel-face.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body>
        <PrivacyPreferencesProvider>
          <SolanaWalletProvider>
            <DevnetShell>{children}</DevnetShell>
          </SolanaWalletProvider>
        </PrivacyPreferencesProvider>
      </body>
    </html>
  );
}
