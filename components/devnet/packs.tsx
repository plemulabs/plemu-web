"use client";

import { useEffect, useRef, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import {
  DEVNET_PACKS,
  WELCOME_PACK,
  DevnetClient,
  formatUnits,
  planWelcome,
  planPackRequest,
  planPackClaim,
  planPackRefund,
  type PackSnapshot,
  type WelcomeSnapshot,
} from "../../lib/devnet";
import { WalletHeaderButton } from "../WalletHeaderButton";
import { useDevnetTransaction, TransactionReview } from "./transaction-review";
import { RecoveryWalletPicker } from "./recovery-wallet";
import { PackContents, PackOpeningPreview } from "./pack-art";
import { Icon } from "./icon";

export function DevnetPacks() {
  const [selected, setSelected] = useState(DEVNET_PACKS[0].rosterKey);
  const recovery = selected === "recovery";
  const pack =
    DEVNET_PACKS.find((item) => item.rosterKey === selected) || DEVNET_PACKS[0];
  return (
    <>
      <div className="dn-page-heading dn-packs-heading">
        <div>
          <h1>Packs</h1>
          <p>Rip. Reveal. Make it yours.</p>
        </div>
        <a className="dn-button" href="#welcome-pack">
          <Icon name="pack" size={18} /> Welcome · {WELCOME_PACK.games.length}{" "}
          games
        </a>
      </div>
      <div className="dn-pack-tabs" role="group" aria-label="Pack collection">
        {DEVNET_PACKS.filter((item) => !item.recoveryOnly).map((item) => (
          <button
            key={item.pack}
            type="button"
            aria-pressed={selected === item.rosterKey}
            onClick={() => setSelected(item.rosterKey)}
          >
            {item.title}
          </button>
        ))}
        <button
          type="button"
          aria-pressed={recovery}
          onClick={() => setSelected("recovery")}
        >
          <Icon name="refresh" size={16} /> Recovery
        </button>
      </div>
      {recovery && (
        <section className="dn-panel dn-recovery-intro">
          <h2>Pick up where you left off.</h2>
          <p>
            Check an existing draw with its original buyer wallet. Pending
            delivery and eligible timeout refunds are available below.
          </p>
          <RecoveryWalletPicker />
        </section>
      )}
      <div className={`dn-pack-workspace${recovery ? " is-recovery" : ""}`}>
        {!recovery && (
          <PackOpeningPreview
            key={pack.pack}
            title={pack.title}
            games={pack.games}
          />
        )}
        <div className="dn-pack-operations">
          {DEVNET_PACKS.map((item) => (
            <div
              className="dn-pack-pane"
              key={item.pack}
              hidden={!recovery && item.rosterKey !== selected}
            >
              <PackCard id={item.rosterKey} />
            </div>
          ))}
        </div>
      </div>
      <section className="dn-panel dn-welcome-pack" id="welcome-pack">
        <div className="dn-welcome-heading">
          <Icon name="pack" size={30} />
          <div>
            <h2>Your welcome pack is waiting.</h2>
            <p>Six curated games. One onchain access receipt per wallet.</p>
          </div>
          <span className="dn-studio-status">Welcome collection</span>
        </div>
        <PackContents
          games={WELCOME_PACK.games}
          statusLabel="Welcome collection"
        />
        <WelcomeClaim />
        <p className="dn-fineprint">
          Claiming does not buy game rights. You can play the beta collection
          without connecting a wallet.
        </p>
      </section>
      <details className="dn-panel dn-pack-rules">
        <summary>What a token pack contains</summary>
        <p>
          Native Devnet SOL and tokens are test assets with no monetary value.
          Active V2 pools have 50% odds for one reward, 35% for two, and 15% for
          three. Entries are distinct within a draw. Selection prioritizes
          entries missing at request time, then fills remaining slots from other
          pool entries, which can already be owned. Inventory affects
          availability.
        </p>
        <p>
          The free opening preview never pays, chooses an onchain result or
          creates a receipt. Tokens and receipts do not themselves transfer a
          game, copyright or a game license.
        </p>
      </details>
    </>
  );
}
function WelcomeClaim() {
  const address = useWallet().publicKey?.toBase58() || null;
  const [snapshot, setSnapshot] = useState<WelcomeSnapshot | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const request = useRef(0);
  const read = useRef<AbortController | null>(null);
  const transaction = useDevnetTransaction(() => void refresh());
  async function refresh() {
    const id = ++request.current;
    read.current?.abort();
    const controller = new AbortController();
    read.current = controller;
    setLoading(true);
    setSnapshot(null);
    setError("");
    transaction.setPlan(null);
    try {
      const state = await new DevnetClient().readWelcome(
        address,
        controller.signal,
      );
      if (id === request.current) setSnapshot(state);
    } catch (error) {
      if (id === request.current)
        setError(
          error instanceof Error
            ? error.message
            : "Could not read welcome state.",
        );
    } finally {
      if (read.current === controller) read.current = null;
      if (id === request.current) setLoading(false);
    }
  }
  useEffect(() => {
    setSnapshot(null);
    setError("");
    setLoading(false);
    request.current++;
    return () => {
      read.current?.abort();
      request.current++;
    };
  }, [address]);
  return (
    <>
      <div className="dn-inline">
        <button
          className="dn-button dn-secondary"
          disabled={loading || transaction.busy}
          onClick={() => void refresh()}
        >
          {loading ? "Checking Devnet…" : "Check welcome eligibility"}
        </button>
        {!address && <WalletHeaderButton />}
        {snapshot && address && !snapshot.alreadyClaimed && (
          <button
            className="dn-button"
            disabled={
              !snapshot.available || transaction.busy || !!transaction.pending
            }
            onClick={() => {
              try {
                transaction.setPlan(planWelcome(snapshot));
              } catch (error) {
                setError(
                  error instanceof Error
                    ? error.message
                    : "Refresh eligibility.",
                );
              }
            }}
          >
            Preview welcome claim
          </button>
        )}
      </div>
      {snapshot && (
        <p role="status">
          {snapshot.alreadyClaimed
            ? "This wallet has already claimed its welcome receipt."
            : snapshot.available
              ? "Welcome claim is available."
              : "Welcome capacity or sponsor funding is unavailable."}{" "}
          {snapshot.claimed.toString()} / {snapshot.capacity.toString()}{" "}
          claimed.
        </p>
      )}
      {error && (
        <p role="alert" className="dn-error">
          {error}
        </p>
      )}
      <TransactionReview transaction={transaction} />
    </>
  );
}
function PackCard({ id }: { id: string }) {
  const config = DEVNET_PACKS.find((pack) => pack.rosterKey === id)!;
  const address = useWallet().publicKey?.toBase58() || null;
  const [snapshot, setSnapshot] = useState<PackSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const request = useRef(0);
  const read = useRef<AbortController | null>(null);
  const transaction = useDevnetTransaction(() => void refresh());
  async function refresh() {
    const number = ++request.current;
    read.current?.abort();
    const controller = new AbortController();
    read.current = controller;
    setLoading(true);
    setError("");
    transaction.setPlan(null);
    try {
      const state = await new DevnetClient().readPack(
        id,
        address,
        controller.signal,
      );
      if (number === request.current) setSnapshot(state);
    } catch (error) {
      if (number === request.current) {
        setSnapshot(null);
        setError(
          error instanceof Error ? error.message : "Could not read pack state.",
        );
      }
    } finally {
      if (read.current === controller) read.current = null;
      if (number === request.current) setLoading(false);
    }
  }
  useEffect(() => {
    setSnapshot(null);
    setError("");
    setLoading(false);
    request.current++;
    return () => {
      read.current?.abort();
      request.current++;
    };
  }, [address]);
  useEffect(() => {
    if (!snapshot?.player?.pending) return;
    const timer = setInterval(() => {
      if (!read.current && !transaction.busy && !transaction.plan)
        void refresh();
    }, 8000);
    return () => clearInterval(timer);
  }, [snapshot?.player?.pending, transaction.busy, transaction.plan, address]); // eslint-disable-line react-hooks/exhaustive-deps
  function prepare(kind: "request" | "claim" | "refund") {
    if (!snapshot) return;
    try {
      transaction.setPlan(
        kind === "request"
          ? planPackRequest(snapshot)
          : kind === "claim"
            ? planPackClaim(snapshot)
            : planPackRefund(snapshot),
      );
      setError("");
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Refresh the pack before continuing.",
      );
    }
  }
  const count = snapshot
    ? config.games.filter(
        (_, index) => (snapshot.ownedMask & (1 << index)) !== 0,
      ).length
    : 0;
  return (
    <section className="dn-panel dn-pack-detail">
      <div className="dn-market-card-heading">
        <span className="dn-pack-icon" aria-hidden="true">
          <Icon name="pack" size={24} />
        </span>
        <div>
          <h2>{config.title}</h2>
          <p>
            {formatUnits(BigInt(config.price))} Devnet SOL + randomness, rent
            and network costs
          </p>
        </div>
      </div>
      <h3 className="dn-possible-heading">
        {config.games.length} possible pulls
      </h3>
      <PackContents
        games={config.games}
        ownedMask={address && snapshot ? snapshot.ownedMask : undefined}
      />
      <p>
        Approve one buyer payment. Randomness is fulfilled onchain; a separate
        executor delivers to the stored buyer. The normal delivery flow asks for
        no second buyer approval.
      </p>
      <div className="dn-inline">
        <button
          className="dn-button dn-secondary"
          disabled={loading || transaction.busy}
          onClick={() => void refresh()}
        >
          {loading ? "Reading Devnet…" : "Check pack & recovery"}
        </button>
        {!address && <WalletHeaderButton />}
      </div>
      {snapshot && (
        <>
          <div
            className="dn-progress"
            aria-label={`${count} of ${config.games.length} collected`}
          >
            <span
              style={{ width: `${(count / config.games.length) * 100}%` }}
            />
          </div>
          <p>
            {count}/{config.games.length} access receipts ·{" "}
            {snapshot.availableDraws.toString()} draws available
          </p>
          <p className="dn-mono">
            Pool: {config.pack}
            <br />
            Confirmed slot {snapshot.readSlot.toString()}
          </p>
          <p role="status">Status: {snapshot.phase.replaceAll("-", " ")}</p>
          {snapshot.rewards.length > 0 && (
            <div className="dn-receipt">
              {snapshot.rewards.map((game) => game.title).join("\n")}
            </div>
          )}
          {snapshot.player?.pending && !snapshot.canRefund && (
            <p>
              Keep this page open or come back later. Delivery is automatic when
              the fulfillment service is available. Refresh recovers the same
              stored draw.
            </p>
          )}
          <p>
            Estimated maximum operation debit:{" "}
            {formatUnits(snapshot.estimatedMaximumDebitLamports)} Devnet SOL,
            plus network fee.
          </p>
          <div className="dn-inline">
            {address && !snapshot.player?.pending && (
              <button
                className="dn-button"
                disabled={
                  transaction.busy ||
                  !!transaction.pending ||
                  snapshot.availableDraws === 0n ||
                  config.recoveryOnly ||
                  count === config.games.length
                }
                onClick={() => prepare("request")}
              >
                Preview token pack
              </button>
            )}
            {address && snapshot.phase === "awaiting-delivery" && (
              <button
                className="dn-button dn-secondary"
                disabled={transaction.busy || !!transaction.pending}
                onClick={() => prepare("claim")}
              >
                Preview manual delivery recovery
              </button>
            )}
            {address && snapshot.canRefund && (
              <button
                className="dn-button dn-secondary"
                disabled={transaction.busy || !!transaction.pending}
                onClick={() => prepare("refund")}
              >
                Preview timeout refund
              </button>
            )}
          </div>
          <p className="dn-fineprint">
            {config.progressPolicy
              ? "Progress policy: request-time missing entries are selected first, then remaining reward slots can include entries you already own. The 50% / 35% / 15% reward-count odds remain unchanged. Check receipts and inventory before approving."
              : "Legacy pool: selection follows this pool’s configured rules."}{" "}
            An expired unfulfilled draw can be refunded under its onchain
            conditions. A completed draw cannot be rerolled or refunded by the
            interface.
          </p>
        </>
      )}
      {error && (
        <p className="dn-error" role="alert">
          {error}
        </p>
      )}
      <TransactionReview transaction={transaction} />
    </section>
  );
}
