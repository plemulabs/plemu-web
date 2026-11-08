"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import {
  DEVNET_MARKETS,
  DevnetClient,
  formatUnits,
  parseUnits,
  quoteBuyForBudget,
  planBuy,
  planSell,
  planMarketOperation,
  type MarketSnapshot,
  type MarketOperation,
} from "../../lib/devnet";
import catalog from "../../lib/browser-catalog.json";
import { WalletHeaderButton } from "../WalletHeaderButton";
import { useDevnetTransaction, TransactionReview } from "./transaction-review";
import { DevnetMarketHistory } from "./market-history";

export function DevnetMarkets() {
  const [selected, setSelected] = useState<string | null>(null);
  return (
    <>
      <div className="dn-page-heading">
        <div>
          <p className="dn-kicker">
            Same protocol. A little more room to explore.
          </p>
          <h1>Game token markets.</h1>
          <p>
            Five live Solana Devnet markets. Token interactions, with a wallet
            you control.
          </p>
        </div>
      </div>
      <p className="dn-fineprint">
        Native Devnet SOL only. These test tokens have no monetary value.
        Collecting a token does not buy a game, cartridge, copyright, or a share
        in a business.
      </p>
      <div className="dn-market-grid">
        {DEVNET_MARKETS.map((market) => {
          const game = catalog.games.find(
            (item) => item.id === market.catalogId,
          );
          return (
            <section className="dn-panel" key={market.market}>
              <div className="dn-market-card-heading">
                <img
                  src={game?.cover || "/brand/plemu-pixel-face.png"}
                  alt=""
                />
                <div>
                  <h2>{market.title}</h2>
                  <p>
                    ${market.symbol} · {market.system.toUpperCase()}
                  </p>
                </div>
              </div>
              <p>{game?.description}</p>
              <div className="dn-inline">
                <button
                  className="dn-button dn-secondary"
                  onClick={() => setSelected(market.catalogId)}
                >
                  View market
                </button>
                {game && <Link href={`/play/${game.slug}`}>Play game ↗</Link>}
              </div>
            </section>
          );
        })}
      </div>
      {selected && (
        <MarketTrade
          key={selected}
          id={selected}
          onClose={() => setSelected(null)}
        />
      )}
    </>
  );
}
function MarketTrade({ id, onClose }: { id: string; onClose: () => void }) {
  const wallet = useWallet();
  const address = wallet.publicKey?.toBase58() || null;
  const [state, setState] = useState<MarketSnapshot | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [amount, setAmount] = useState("0.01");
  const [slippage, setSlippage] = useState("100");
  const [buyMode, setBuyMode] = useState<"sol" | "tokens">("sol");
  const generation = useRef(0);
  const panel = useRef<HTMLElement>(null);
  const transaction = useDevnetTransaction(() => void refresh());
  async function refresh() {
    const current = ++generation.current;
    setLoading(true);
    setError("");
    setState(null);
    transaction.setPlan(null);
    try {
      const snapshot = await new DevnetClient().readMarket(id, address);
      if (current === generation.current) setState(snapshot);
    } catch (error) {
      if (current === generation.current)
        setError(
          error instanceof Error
            ? error.message
            : "Market unavailable. Try refreshing.",
        );
    } finally {
      if (current === generation.current) setLoading(false);
    }
  }
  useEffect(() => {
    void refresh();
    return () => {
      generation.current++;
    }; /* Identity changes invalidate every preview. */
  }, [id, address]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    panel.current?.scrollIntoView({ block: "start" });
    panel.current?.focus({ preventScroll: true });
  }, []);
  function preview() {
    transaction.setPlan(null);
    setError("");
    try {
      if (!state || state.wallet !== address)
        throw new Error("Connect your wallet and refresh this market.");
      const bps = Number(slippage);
      if (!Number.isInteger(bps) || bps < 0 || bps > 1000)
        throw new Error("Choose slippage between 0 and 1000 basis points.");
      const plan =
        side === "buy"
          ? planBuy(
              state,
              buyMode === "sol"
                ? quoteBuyForBudget(state, parseUnits(amount)).tokens
                : parseUnits(amount, 6),
              bps,
            )
          : planSell(state, parseUnits(amount, 6), bps);
      transaction.setPlan(plan);
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Could not prepare a quote.",
      );
    }
  }
  function prepareOperation(kind: MarketOperation) {
    if (!state || transaction.busy) return;
    transaction.setPlan(null);
    setError("");
    try {
      transaction.setPlan(planMarketOperation(state, kind));
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Refresh the verified market before continuing.",
      );
    }
  }
  return (
    <section
      className="dn-panel"
      ref={panel}
      tabIndex={-1}
      aria-label="Selected game market"
    >
      <div className="dn-page-heading">
        <h2>{DEVNET_MARKETS.find((item) => item.catalogId === id)?.title}</h2>
        <button
          className="dn-button dn-secondary"
          onClick={onClose}
          disabled={transaction.busy}
        >
          Close market
        </button>
      </div>
      {error && (
        <p className="dn-error" role="alert">
          {error}
        </p>
      )}
      <button
        className="dn-button dn-secondary"
        disabled={loading || transaction.busy}
        onClick={() => void refresh()}
      >
        {loading ? "Reading Devnet…" : "Refresh onchain state"}
      </button>
      {state && (
        <>
          <div className="dn-stat-grid">
            <div>
              Phase<strong>{state.stage}</strong>
            </div>
            <div>
              Your tokens<strong>{formatUnits(state.walletTokens, 6)}</strong>
            </div>
            <div>
              Your Devnet SOL
              <strong>{formatUnits(state.walletLamports)}</strong>
            </div>
          </div>
          <p className="dn-mono">
            Market: {state.config.market}
            <br />
            Mint: {state.config.mint}
            <br />
            Confirmed slot {state.readSlot.toString()} · no simulated chart
          </p>
          <p>
            <a
              href={`https://explorer.solana.com/address/${state.config.market}?cluster=devnet`}
              target="_blank"
              rel="noopener noreferrer"
            >
              Inspect market on Solana Explorer ↗
            </a>
          </p>
          <div className="dn-trade-layout">
            <div className="dn-form">
              <div className="dn-filters" role="group" aria-label="Trade side">
                <button
                  disabled={transaction.busy}
                  aria-pressed={side === "buy"}
                  onClick={() => {
                    setSide("buy");
                    setAmount(buyMode === "sol" ? "0.01" : "1000000");
                    transaction.setPlan(null);
                  }}
                >
                  Buy tokens
                </button>
                <button
                  disabled={transaction.busy}
                  aria-pressed={side === "sell"}
                  onClick={() => {
                    setSide("sell");
                    setAmount("1");
                    transaction.setPlan(null);
                  }}
                >
                  Sell tokens
                </button>
              </div>
              {side === "buy" && (
                <label>
                  Enter buy amount as
                  <select
                    disabled={transaction.busy}
                    value={buyMode}
                    onChange={(event) => {
                      const mode = event.target.value as "sol" | "tokens";
                      setBuyMode(mode);
                      setAmount(mode === "sol" ? "0.01" : "1000000");
                      transaction.setPlan(null);
                    }}
                  >
                    <option value="sol">Devnet SOL budget</option>
                    <option value="tokens">Number of tokens</option>
                  </select>
                </label>
              )}
              <label>
                {side === "buy" && buyMode === "sol"
                  ? "Devnet SOL budget before slippage"
                  : "Token amount"}
                <input
                  disabled={transaction.busy}
                  inputMode="decimal"
                  value={amount}
                  onChange={(event) => {
                    setAmount(event.target.value);
                    transaction.setPlan(null);
                  }}
                />
              </label>
              <label>
                Slippage limit
                <select
                  disabled={transaction.busy}
                  value={slippage}
                  onChange={(event) => {
                    setSlippage(event.target.value);
                    transaction.setPlan(null);
                  }}
                >
                  <option value="0">0%</option>
                  <option value="50">0.5%</option>
                  <option value="100">1%</option>
                  <option value="200">2%</option>
                </select>
              </label>
              {address ? (
                <button
                  className="dn-button"
                  disabled={
                    loading || transaction.busy || !!transaction.pending
                  }
                  onClick={preview}
                >
                  Preview {side}
                </button>
              ) : (
                <WalletHeaderButton />
              )}
            </div>
            <div>
              <h3>Before you approve</h3>
              <p>
                Quotes use the live bonding curve or the protocol’s pool.
                Integer math, protocol fees, and your slippage limit are
                included. The transaction can fail if the state changes before
                it lands.
              </p>
              <p>
                Token account creation may add a refundable rent deposit. Your
                wallet and the protocol validate the final request.
              </p>
            </div>
          </div>
          <section className="dn-panel">
            <h3>Creator fees</h3>
            <p>
              Accrued {formatUnits(state.market.creatorAccrued)} SOL · claimed{" "}
              {formatUnits(state.market.creatorClaimed)} SOL · available{" "}
              {formatUnits(
                state.market.creatorAccrued - state.market.creatorClaimed,
              )}{" "}
              SOL.
            </p>
            <p>
              {state.market.dexReady
                ? "Pool fee allocation: 80% creator, 10% platform, 10% dedicated buyback."
                : "Curve fee allocation: 40% creator, 60% platform."}
            </p>
            {address === state.market.creator && (
              <button
                className="dn-button dn-secondary"
                disabled={
                  transaction.busy ||
                  !!transaction.pending ||
                  state.market.creatorAccrued === state.market.creatorClaimed
                }
                onClick={() => prepareOperation("market-creator-fees")}
              >
                Preview creator fee claim
              </button>
            )}
          </section>
          <details className="dn-panel">
            <summary>Advanced market tools</summary>
            <p>
              Protocol maintenance and holding proofs use separate explicit
              wallet approvals. They do not change local game availability.
            </p>
            <div className="dn-stat-grid">
              <div>
                Platform fees available
                <strong>
                  {formatUnits(
                    state.market.platformAccrued - state.market.platformClaimed,
                  )}{" "}
                  SOL
                </strong>
              </div>
              <div>
                Dedicated buyback funds
                <strong>
                  {formatUnits(
                    state.market.buybackAccrued - state.market.buybackSpent,
                  )}{" "}
                  SOL
                </strong>
              </div>
              <div>
                Tokens burned
                <strong>{formatUnits(state.market.burnedTokens, 6)}</strong>
              </div>
            </div>
            <p>
              Holding-proof threshold:{" "}
              {formatUnits(state.market.licenseThreshold, 6)} tokens across at
              most 16 wallet-owned accounts. The platform treasury is excluded.
              A proof is separate from a copyright license.
            </p>
            <div className="dn-inline">
              {address ? (
                <>
                  <button
                    className="dn-button dn-secondary"
                    disabled={transaction.busy || !!transaction.pending}
                    onClick={() => prepareOperation("market-stage")}
                  >
                    Preview stage synchronization
                  </button>
                  <button
                    className="dn-button dn-secondary"
                    disabled={
                      transaction.busy ||
                      !!transaction.pending ||
                      !state.market.dexReady
                    }
                    onClick={() => prepareOperation("market-observe")}
                  >
                    Preview price observation
                  </button>
                  <button
                    className="dn-button dn-secondary"
                    disabled={
                      transaction.busy ||
                      !!transaction.pending ||
                      !state.market.dexReady
                    }
                    onClick={() => prepareOperation("market-buyback")}
                  >
                    Preview funded buyback
                  </button>
                  <button
                    className="dn-button dn-secondary"
                    disabled={
                      transaction.busy ||
                      !!transaction.pending ||
                      state.walletTokens < state.market.licenseThreshold ||
                      address === state.protocol.platform
                    }
                    onClick={() => prepareOperation("market-license")}
                  >
                    Preview onchain holding proof
                  </button>
                  {address === state.protocol.authority && (
                    <button
                      className="dn-button dn-secondary"
                      disabled={
                        transaction.busy ||
                        !!transaction.pending ||
                        state.market.platformAccrued ===
                          state.market.platformClaimed
                      }
                      onClick={() => prepareOperation("market-platform-fees")}
                    >
                      Preview platform fee claim
                    </button>
                  )}
                </>
              ) : (
                <WalletHeaderButton />
              )}
            </div>
            <p className="dn-fineprint">
              Buybacks spend only the program’s dedicated budget and keep its
              existing immutable price protection. Your wallet pays the network
              fee. Observation interval and price checks can make an operation
              unavailable.
            </p>
          </details>
        </>
      )}
      <DevnetMarketHistory id={id} />
      <TransactionReview transaction={transaction} />
    </section>
  );
}
