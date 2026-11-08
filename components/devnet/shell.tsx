"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { WalletHeaderButton } from "../WalletHeaderButton";
import { usePrivacyPreferences } from "../privacy-preferences";
import { BrowserLibraryProvider } from "./library-provider";
import { useEffect, useState } from "react";
import {
  readBrowserSettings,
  subscribeBrowserSettings,
} from "../../lib/browser-settings";

const navigation = [
  { href: "/", label: "Library", icon: "▦" },
  { href: "/market", label: "Market", icon: "◈" },
  { href: "/packs", label: "Packs", icon: "▣" },
  { href: "/discover", label: "Discover", icon: "✦" },
  { href: "/create", label: "Create", icon: "+" },
  { href: "/wallet", label: "Wallet", icon: "◇" },
  { href: "/settings", label: "Settings", icon: "⚙" },
];
export function DevnetShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { openPrivacy } = usePrivacyPreferences();
  const [reducedMotion, setReducedMotion] = useState(false);
  useEffect(() => {
    setReducedMotion(readBrowserSettings().reducedMotion);
    return subscribeBrowserSettings((settings) =>
      setReducedMotion(settings.reducedMotion),
    );
  }, []);
  return (
    <BrowserLibraryProvider>
      <div className={`devnet-app${reducedMotion ? " dn-mode-reduced" : ""}`}>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        <header className="dn-header">
          <Link href="/" className="dn-logo" aria-label="Plemu library">
            <span className="dn-wordmark">
              <img
                src="/brand/plemu-wordmark-lime.png"
                alt=""
                width="1920"
                height="1080"
              />
            </span>
            <span>play</span>
          </Link>
          <span className="dn-network">
            <i />
            Devnet
          </span>
          <div className="dn-wallet">
            <WalletHeaderButton />
          </div>
        </header>
        <div className="dn-layout">
          <aside className="dn-sidebar">
            <nav aria-label="Main navigation">
              {navigation.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={
                    pathname === item.href ||
                    (item.href === "/" &&
                      ["/games", "/library"].includes(pathname))
                      ? "page"
                      : undefined
                  }
                >
                  <span aria-hidden="true">{item.icon}</span>
                  {item.label}
                </Link>
              ))}
            </nav>
            <a className="dn-back" href="https://plemu.xyz">
              Meet Plemu ↗
            </a>
            <div className="dn-sidebar-note">
              <span className="dn-pixel-friend" aria-hidden="true">
                ▟▙
              </span>
              <small>
                A little more play.
                <br />A little less scrolling.
              </small>
            </div>
          </aside>
          <main id="main" className="dn-main">
            {children}
          </main>
        </div>
        <footer className="dn-footer">
          <span>
            Plemu Labs LLC · Solana Devnet · Test tokens have no monetary value
          </span>
          <nav aria-label="Legal and privacy">
            <a href="https://plemu.xyz/toc">Website terms</a>
            <a href="https://plemu.xyz/privacy">Website privacy</a>
            <Link href="/toc">Terms of service</Link>
            <Link href="/privacy">Privacy policy</Link>
            <button onClick={openPrivacy}>Privacy choices</button>
          </nav>
        </footer>
      </div>
    </BrowserLibraryProvider>
  );
}
