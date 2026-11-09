"use client";

import Link from "next/link";
import { useWallet } from "@solana/wallet-adapter-react";
import { useEffect, useRef, useState } from "react";
import { usePlemuAuth } from "../../hooks/usePlemuAuth";
import {
  readBrowserSettings,
  subscribeBrowserSettings,
  updateBrowserSettings,
  type BrowserSettings,
} from "../../lib/browser-settings";
import {
  DEVNET_RELEASE,
  DevnetClient,
  formatUnits,
  type TokenBalances,
} from "../../lib/devnet";
import { WalletHeaderButton } from "../WalletHeaderButton";
import { usePrivacyPreferences } from "../privacy-preferences";
import { useBrowserLibrary } from "./library-provider";
import { TransactionReview, useDevnetTransaction } from "./transaction-review";
import { DevnetFaucets } from "./faucets";
import { CreatePreview } from "./create-preview";

const explorerAddress = (address: string) =>
  `https://explorer.solana.com/address/${encodeURIComponent(address)}?cluster=devnet`;

export function DevnetWallet({
  embedded = false,
}: { embedded?: boolean } = {}) {
  const { connected, publicKey } = useWallet();
  const { walletName } = usePlemuAuth();
  const address = connected ? publicKey?.toBase58() || null : null;
  const [balances, setBalances] = useState<TokenBalances | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const request = useRef(0);
  const currentAddress = useRef(address);
  currentAddress.current = address;
  const transaction = useDevnetTransaction(() =>
    setRefresh((value) => value + 1),
  );

  useEffect(() => {
    const id = ++request.current;
    const controller = new AbortController();
    setBalances(null);
    setError("");
    setLoading(!!address);
    if (!address) return () => controller.abort();
    new DevnetClient()
      .readTokenBalances(address, controller.signal)
      .then((result) => {
        if (
          !controller.signal.aborted &&
          request.current === id &&
          currentAddress.current === address
        )
          setBalances(result);
      })
      .catch((reason: unknown) => {
        if (
          !controller.signal.aborted &&
          request.current === id &&
          currentAddress.current === address
        )
          setError(
            reason instanceof Error
              ? reason.message
              : "Could not read Devnet balances.",
          );
      })
      .finally(() => {
        if (!controller.signal.aborted && request.current === id)
          setLoading(false);
      });
    return () => controller.abort();
  }, [address, refresh]);

  // A render after an identity change must not expose the previous wallet's data.
  const visible = balances?.wallet === address ? balances : null;
  return (
    <>
      <div className="dn-page-heading">
        <div>
          <p className="dn-kicker">Your keys. Your wallet.</p>
          {embedded ? (
            <h2>Your wallet</h2>
          ) : (
            <h1>A window into your wallet.</h1>
          )}
          <p>
            Real balances on Solana Devnet. Test tokens have no monetary value.
          </p>
        </div>
        <WalletHeaderButton />
      </div>
      {address ? (
        <section className="dn-panel" aria-label="Connected wallet">
          <h2>{walletName || "Connected wallet"}</h2>
          <p className="dn-mono">{address}</p>
          <div className="dn-inline">
            <button
              className="dn-button dn-secondary"
              disabled={loading}
              onClick={() => setRefresh((value) => value + 1)}
            >
              {loading ? "Reading Devnet…" : "Refresh balances"}
            </button>
            <a
              href={explorerAddress(address)}
              target="_blank"
              rel="noopener noreferrer"
            >
              Address and transaction history ↗
            </a>
          </div>
          {visible && (
            <div className="dn-stat-grid">
              <div>
                <span>Native balance</span>
                <strong>{formatUnits(visible.nativeLamports)} SOL</strong>
              </div>
              <div>
                <span>Catalog token assets</span>
                <strong>{visible.balances.length}</strong>
              </div>
              <div>
                <span>Verified Devnet slot</span>
                <strong>{visible.readSlot.toString()}</strong>
              </div>
            </div>
          )}
          {loading && (
            <p role="status">Checking the network and token accounts…</p>
          )}
          {error && (
            <p role="alert" className="dn-error">
              {error}
            </p>
          )}
        </section>
      ) : (
        <section className="dn-panel">
          <h2>Connect to read your balances.</h2>
          <p>
            Your wallet keeps its keys. Plemu reads public chain records and
            asks for explicit approval before any transaction.
          </p>
        </section>
      )}
      <TransactionReview transaction={transaction} />
      {visible && (
        <section className="dn-panel" aria-label="Catalog token balances">
          <h2>Your catalog tokens</h2>
          <p>
            Includes all 21 supported token assets, including zero balances.
            Other wallet assets are not listed here.
          </p>
          <div className="dn-transaction-list">
            {visible.balances.map((asset) => (
              <a
                key={asset.mint}
                href={explorerAddress(asset.mint)}
                target="_blank"
                rel="noopener noreferrer"
              >
                <span>
                  {asset.title} <small>({asset.symbol})</small>
                </span>
                <span>{formatUnits(asset.amount, asset.decimals)}</span>
              </a>
            ))}
          </div>
        </section>
      )}
      <DevnetFaucets />
      <p className="dn-fineprint">
        Balances are read from Devnet; faucet claims open a separate transaction
        review. A token balance or onchain receipt does not transfer a game,
        ROM, cartridge, copyright, or game license. Explorer links open a
        third-party service.
      </p>
    </>
  );
}

export function DevnetSettings() {
  const { persistence, openPrivacy } = usePrivacyPreferences();
  const { games } = useBrowserLibrary();
  const [settings, setSettings] = useState<BrowserSettings>({
    muted: false,
    reducedMotion: false,
  });
  useEffect(() => {
    setSettings(readBrowserSettings());
    return subscribeBrowserSettings(setSettings);
  }, []);
  const change = (patch: Partial<BrowserSettings>) =>
    setSettings(updateBrowserSettings(patch));
  return (
    <>
      <div className="dn-page-heading">
        <div>
          <p className="dn-kicker">MAKE YOURSELF AT HOME</p>
          <h1>Your settings.</h1>
          <p>A few small controls for this browser.</p>
        </div>
      </div>
      <section className="dn-panel">
        <h2>Play your way</h2>
        <label className="dn-settings-row">
          <span>
            Mute player audio
            <p>Apply the mute preference to the browser player.</p>
          </span>
          <input
            type="checkbox"
            checked={settings.muted}
            onChange={(event) => change({ muted: event.target.checked })}
          />
        </label>
        <label className="dn-settings-row">
          <span>
            Reduce motion
            <p>
              Limit interface animation. Your device preference is used by
              default.
            </p>
          </span>
          <input
            type="checkbox"
            checked={settings.reducedMotion}
            onChange={(event) =>
              change({ reducedMotion: event.target.checked })
            }
          />
        </label>
        <p>
          {persistence
            ? "Saved preferences are allowed. Changing a setting attempts to save it in this browser; browser restrictions may keep it session-only."
            : "Settings work for this session. Saving between visits is off."}{" "}
          Imported game files and game progress are not saved by these controls.
        </p>
      </section>
      <section className="dn-panel">
        <h2>Privacy and network</h2>
        <div className="dn-settings-row">
          <span>
            Optional browser storage
            <p>
              {persistence
                ? "Saved preferences allowed."
                : "Session-only preferences."}
            </p>
          </span>
          <button className="dn-button dn-secondary" onClick={openPrivacy}>
            Privacy choices
          </button>
        </div>
        <div className="dn-settings-row">
          <span>
            Network<p>Solana Devnet · test tokens only.</p>
          </span>
          <span>Read-only setting</span>
        </div>
        <p className="dn-mono">
          Expected genesis: {DEVNET_RELEASE.genesisHash}
        </p>
        <p>
          The client verifies the Devnet genesis and protocol accounts before
          returning balances or transaction previews. There is no mainnet switch
          in this app.
        </p>
      </section>
      <section className="dn-panel">
        <h2>Read, keep, and ask</h2>
        <p>
          <a href="https://plemu.xyz/toc">Website terms</a> ·{" "}
          <a href="https://plemu.xyz/privacy">Website privacy</a> ·{" "}
          <Link href="/toc">Local terms copy</Link> ·{" "}
          <Link href="/privacy">Local privacy copy</Link>
        </p>
        <p>
          <a href="/seeker/notices/README.txt">Starter game notices</a> ·{" "}
          <a href="/seeker/notices/PRESENTATION-ART.md">Artwork credits</a> ·{" "}
          <a href="/emulator/LICENSE">Browser player license</a> ·{" "}
          <a href="/emulator/manifest.json">Browser player source manifest</a>
        </p>
        <details>
          <summary>All bundled game credits and license evidence</summary>
          {games
            .filter((game) => !game.file)
            .map((game) => (
              <p key={game.id}>
                {game.title} — {game.author}. License: {game.license}.{" "}
                {game.evidence && <a href={game.evidence}>License evidence</a>}{" "}
                {game.sourceUrl && (
                  <a
                    href={game.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Creator’s release ↗
                  </a>
                )}
              </p>
            ))}
        </details>
        <p>
          Legal copies and notices are bundled with the app and can be saved
          using your browser’s print or download controls. Reloading pages
          offline still depends on what your browser has cached.
        </p>
        <p>
          Questions: <a href="mailto:support@plemu.xyz">support@plemu.xyz</a>.
          Plemu Labs LLC, Wyoming.
        </p>
      </section>
    </>
  );
}

export function DevnetCreate() {
  const [title, setTitle] = useState("");
  const [creator, setCreator] = useState("");
  const [system, setSystem] = useState("gb");
  const [description, setDescription] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [license, setLicense] = useState("");
  const [message, setMessage] = useState("");
  function download(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!title.trim() || !creator.trim() || !description.trim()) {
      setMessage(
        "Add a title, original creator credit, and description before downloading.",
      );
      return;
    }
    const draft = {
      schema: "plemu-local-creator-draft-v1",
      status: "local-draft",
      title: title.trim(),
      creator: creator.trim(),
      system,
      description: description.trim(),
      sourceUrl: sourceUrl.trim(),
      license: license.trim(),
    };
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(draft, null, 2) + "\n"], {
        type: "application/json",
      }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `${draft.title.replace(/[^a-zA-Z0-9_-]+/g, "-").slice(0, 60) || "plemu"}-draft.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setMessage(
      "Draft download requested. Keep the JSON file before leaving this page; nothing has been published.",
    );
  }
  return (
    <>
      <CreatePreview />
      <details className="dn-panel dn-creator-draft">
        <summary>Plan an idea locally</summary>
        <p>
          This form stays in page memory. Download its metadata as JSON; it does
          not upload game files, mint tokens, or create a public listing.
        </p>
        <form className="dn-form" onSubmit={download}>
          <label>
            Game title
            <input
              required
              maxLength={120}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
          </label>
          <label>
            Original creator or studio credit
            <input
              required
              maxLength={160}
              value={creator}
              onChange={(event) => setCreator(event.target.value)}
            />
          </label>
          <label>
            System
            <select
              value={system}
              onChange={(event) => setSystem(event.target.value)}
            >
              <option value="gb">Game Boy</option>
              <option value="gbc">Game Boy Color</option>
              <option value="gba">Game Boy Advance</option>
              <option value="nes">NES</option>
              <option value="snes">Super NES</option>
            </select>
          </label>
          <label>
            Description
            <textarea
              required
              maxLength={2000}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </label>
          <label>
            Creator’s release URL (optional)
            <input
              type="url"
              maxLength={500}
              placeholder="https://"
              value={sourceUrl}
              onChange={(event) => setSourceUrl(event.target.value)}
            />
          </label>
          <label>
            License or permission notes
            <input
              maxLength={500}
              value={license}
              onChange={(event) => setLicense(event.target.value)}
            />
          </label>
          <div>
            <button className="dn-button" type="submit">
              Download draft JSON ↓
            </button>
          </div>
        </form>
        {message && (
          <p role="status" className="dn-status">
            {message}
          </p>
        )}
      </details>
      <section className="dn-panel">
        <h2>Credit the people who made it.</h2>
        <p>
          Use the original creator’s name and release link. Curation is separate
          from authorship. This draft does not select a payment recipient or
          promise creator rewards.
        </p>
        <p>
          Only include content and metadata you have permission to use. A token
          interaction does not grant copyright, distribution rights, or a game
          license.
        </p>
      </section>
    </>
  );
}

export function DevnetGuide() {
  return (
    <>
      <div className="dn-page-heading">
        <div>
          <p className="dn-kicker">LESS SETUP · MORE PLAY</p>
          <h1>A little field guide.</h1>
          <p>Local play first. Your wallet is optional for playing.</p>
        </div>
      </div>
      <section className="dn-panel">
        <h2>Pick a game, then press play.</h2>
        <p>
          Open the <Link href="/">library</Link>, choose a game, and start its
          browser player. The player runs on this device. Bundled game downloads
          need a connection the first time; this app does not promise offline
          page caching.
        </p>
        <p>
          For your own file, use Import in the library. Supported uncompressed
          files are .gb, .gbc, .gba, .nes, .sfc, and .smc, up to 64 MB. Only
          import files you may lawfully use. Imports stay in this tab and must
          be selected again after a reload.
        </p>
      </section>
      <section className="dn-panel">
        <h2>Find your controls.</h2>
        <p>
          Focus the player before using a keyboard. Start with arrow keys for
          the D-pad, X/Z for A/B, Enter for Start, and Shift for Select. Each
          game’s page includes its controls; change bindings in the player menu
          when needed.
        </p>
        <p>
          A compatible connected gamepad can work through your browser. Touch
          buttons are available on supported touch devices. Browser permissions,
          controller mappings, screen size, and save formats can differ from the
          Seeker app.
        </p>
      </section>
      <section className="dn-panel">
        <h2>Take your save with you.</h2>
        <p>
          Open the player menu and download a save state or supported game save
          before stopping, reloading, closing the tab, or navigating away.
          Import a compatible save through the player menu to continue. Keep a
          backup of the downloaded file.
        </p>
        <p>
          There is no cloud save or automatic browser save promise. Browser and
          Seeker save formats may differ. Favorite preferences do not contain
          game files or progress.
        </p>
      </section>
      <section className="dn-panel">
        <h2>A small Devnet detour.</h2>
        <p>
          <Link href="/market">Market</Link> and{" "}
          <Link href="/packs">packs</Link> interact with actual Solana Devnet
          tokens using your connected wallet. These are test tokens with no
          monetary value. Never send mainnet funds to test an app.
        </p>
        <p>
          Review amounts, limits, network fees, and the Devnet label before
          approving in your wallet. A paid pack asks for one buyer payment
          approval; normal settlement delivers to that buyer through a
          separately funded executor. If a request is waiting, use its status
          and recovery controls before approving another payment.
        </p>
        <p>
          Networks, RPC providers, randomness, and executors can fail or be
          delayed. An onchain receipt or token is not a sale of a game, ROM,
          physical cartridge, copyright, or game license. Read the{" "}
          <Link href="/toc">terms</Link> before using wallet actions.
        </p>
      </section>
      <p className="dn-fineprint">
        Need a hand? <a href="mailto:support@plemu.xyz">support@plemu.xyz</a>.{" "}
        <Link href="/settings">Settings and license notices</Link>.
      </p>
    </>
  );
}
