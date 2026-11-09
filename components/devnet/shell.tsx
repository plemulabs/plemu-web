"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { WalletHeaderButton } from "../WalletHeaderButton";
import { usePrivacyPreferences } from "../privacy-preferences";
import { BrowserLibraryProvider } from "./library-provider";
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import {
  readBrowserSettings,
  subscribeBrowserSettings,
} from "../../lib/browser-settings";
import { Icon, type IconName } from "./icon";

const navigation: { href: string; label: string; icon: IconName }[] = [
  { href: "/", label: "Library", icon: "library" },
  { href: "/market", label: "Market", icon: "market" },
  { href: "/packs", label: "Packs", icon: "pack" },
  { href: "/discover", label: "Discover", icon: "compass" },
  { href: "/create", label: "Create", icon: "create" },
  { href: "/settings", label: "Settings", icon: "settings" },
];
const WalletDialog = dynamic(() =>
  import("./wallet-dialog").then((module) => module.WalletDialog),
);
export function DevnetShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "/";
  const { openPrivacy } = usePrivacyPreferences();
  const [reducedMotion, setReducedMotion] = useState(false);
  const [walletOpen, setWalletOpen] = useState(false);
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
          <div className="mt-header-divider" />
          <span className="mt-header-tagline">Good games. Shared worlds.</span>
          <span className="dn-network">
            <i />
            Devnet
          </span>
          <div className="dn-wallet">
            <WalletHeaderButton onOpenWallet={() => setWalletOpen(true)} />
          </div>
        </header>
        {walletOpen && <WalletDialog onClose={() => setWalletOpen(false)} />}
        <div className="dn-layout">
          <aside className="dn-sidebar">
            <nav aria-label="Main navigation">
              {navigation.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={
                    pathname === item.href ||
                    (item.href !== "/" &&
                      pathname.startsWith(item.href + "/")) ||
                    (item.href === "/" &&
                      ["/games", "/library"].includes(pathname))
                      ? "page"
                      : undefined
                  }
                >
                  <Icon name={item.icon} />
                  {item.label}
                </Link>
              ))}
            </nav>
            <a className="dn-back" href="https://plemu.xyz">
              Meet Plemu <Icon name="external" size={14} />
            </a>
            <div className="dn-sidebar-note">
              <span className="mt-sidebar-mark" aria-hidden="true">
                <img
                  src="/brand/plemu-pixel-face.png"
                  alt=""
                  width="64"
                  height="64"
                />
              </span>
              <small>
                Find your people.
                <br />
                Keep playing.
              </small>
              <Link href="/guide">
                <Icon name="guide" size={15} /> Field guide
              </Link>
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
