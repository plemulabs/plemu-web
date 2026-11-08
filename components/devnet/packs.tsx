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

export function DevnetPacks() {
  return (
    <>
      <div className="dn-page-heading">
        <div>
          <p className="dn-kicker">A little surprise for your collection.</p>
          <h1>Packs, made for play.</h1>
          <p>
            The same welcome collection and active V2 token pools as Seeker.
          </p>
        </div>
      </div>
      <RecoveryWalletPicker />
      <section className="dn-panel">
        <h2>Start with a welcome.</h2>
        <p>
          Six curated games. One onchain access receipt per wallet. Claiming
          does not buy game rights; you can play the beta collection without
          connecting a wallet.
        </p>
        <p>{WELCOME_PACK.games.map((game) => game.title).join(" · ")}</p>
        <WelcomeClaim />
      </section>
      <div className="dn-market-grid">
        {DEVNET_PACKS.map((pack) => (
          <PackCard key={pack.pack} id={pack.rosterKey} />
        ))}
      </div>
      <p className="dn-fineprint">
        Native Devnet SOL and tokens are test assets with no monetary value. V4
        is dormant. Draw-count odds are 50% for one reward, 35% for two, and 15%
        for three. Entries are distinct within a draw. Selection prioritizes
        entries missing at request time, then fills remaining slots from other
        pool entries, which can already be owned. Inventory affects
        availability. A reveal animation does not determine the onchain result.
      </p>
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
    <section className="dn-panel">
      <div className="dn-market-card-heading">
        <span className="dn-pack-icon" aria-hidden="true">
          ▣
        </span>
        <div>
          <h2>{config.title}</h2>
          <p>
            {formatUnits(BigInt(config.price))} Devnet SOL + randomness, rent
            and network costs
          </p>
        </div>
      </div>
      <p>{config.games.map((game) => game.title).join(" · ")}</p>
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
