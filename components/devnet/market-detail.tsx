"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import {
  DevnetClient,
  formatUnits,
  parseUnits,
  quoteBuyForBudget,
  quoteBuyTokens,
  quoteSell,
  planBuy,
  planSell,
  planMarketOperation,
  type MarketSnapshot,
  type MarketOperation,
  type TradeQuote,
} from "../../lib/devnet";
import { SALE_ALLOCATION } from "../../lib/devnet/math";
import {
  marketDirectory,
  marketHref,
  indicativePrice,
  shortAddress,
} from "../../lib/market-presentation";
import { WalletHeaderButton } from "../WalletHeaderButton";
import { useDevnetTransaction, TransactionReview } from "./transaction-review";
import { DevnetMarketHistory } from "./market-history";
import { Icon } from "./icon";

function AddressRow({ title, address }: { title: string; address: string }) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  return (
    <div className="mt-address-row">
      <span>{title}</span>
      <a
        href={`https://explorer.solana.com/address/${address}?cluster=devnet`}
        target="_blank"
        rel="noopener noreferrer"
        title={address}
      >
        {shortAddress(address)} <Icon name="external" size={12} />
      </a>
      <button
        aria-label={`Copy ${title.toLowerCase()}`}
        title={copied ? "Copied" : "Copy address"}
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(address);
            setCopied(true);
            setError("");
          } catch {
            setError(
              "Copy is unavailable. Open the Explorer link for the full address.",
            );
          }
        }}
      >
        <Icon name={copied ? "check" : "copy"} size={14} />
      </button>
      {error && <small role="status">{error}</small>}
    </div>
  );
}

export function DevnetMarketDetail({ id }: { id: string }) {
  return <MarketWorkspace key={id} id={id} />;
}

function MarketWorkspace({ id }: { id: string }) {
  const wallet = useWallet();
  const address = wallet.publicKey?.toBase58() || null;
  const [snapshot, setState] = useState<MarketSnapshot | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [amount, setAmount] = useState("0.01");
  const [slippage, setSlippage] = useState("100");
  const [buyMode, setBuyMode] = useState<"sol" | "tokens">("sol");
  const generation = useRef(0);
  const read = useRef<AbortController | null>(null);
  const state = snapshot?.wallet === address ? snapshot : null;
  const [activityRefresh, setActivityRefresh] = useState(0);
  const transaction = useDevnetTransaction(() => {
    void refresh();
    setActivityRefresh((value) => value + 1);
  });
  async function refresh() {
    const current = ++generation.current;
    read.current?.abort();
    const controller = new AbortController();
    read.current = controller;
    setLoading(true);
    setError("");
    setState(null);
    transaction.setPlan(null);
    try {
      const snapshot = await new DevnetClient().readMarket(
        id,
        address,
        controller.signal,
      );
      if (current === generation.current) setState(snapshot);
    } catch (error) {
      if (current === generation.current)
        setError(
          error instanceof Error
            ? error.message
            : "Market unavailable. Try refreshing.",
        );
    } finally {
      if (read.current === controller) read.current = null;
      if (current === generation.current) setLoading(false);
    }
  }
  useEffect(() => {
    void refresh();
    return () => {
      read.current?.abort();
      generation.current++;
    }; /* Identity changes invalidate every preview. */
  }, [id, address]); // eslint-disable-line react-hooks/exhaustive-deps
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

  const item = marketDirectory.find(({ config }) => config.catalogId === id);
  if (!item)
    return (
      <div className="dn-empty">
        <h1>Market not found.</h1>
        <Link href="/market">Explore game markets</Link>
      </div>
    );
  const { config, game } = item;
  const phases = ["demo", "graduated", "alpha", "hyper", "beta"];
  const progress = state
    ? Math.min(
        100,
        Number((state.market.sold * 10_000n) / SALE_ALLOCATION) / 100,
      )
    : 0;
  let estimate: TradeQuote | null = null;
  if (state) {
    try {
      estimate =
        side === "buy"
          ? buyMode === "sol"
            ? quoteBuyForBudget(state, parseUnits(amount))
            : quoteBuyTokens(state, parseUnits(amount, 6))
          : quoteSell(state, parseUnits(amount, 6));
    } catch {
      /* An incomplete input has no estimate; Preview reports validation errors. */
    }
  }
  return (
    <article className="mt-detail">
      <div className="mt-market-topline">
        <Link href="/market">
          <Icon name="back" size={16} /> All markets
        </Link>
        <div className="mt-related-markets">
          {marketDirectory
            .filter((market) => market.config.catalogId !== id)
            .map(({ config: other }) => (
              <Link key={other.market} href={marketHref(other.catalogId)}>
                ${other.symbol}
              </Link>
            ))}
        </div>
      </div>
      <header className="mt-token-header">
        <div className="mt-token-identity">
          <img src={game.cover} width="72" height="72" alt="" />
          <div>
            <div className="mt-token-title">
              <h1>{config.title}</h1>
              <span>${config.symbol}</span>
              <span className="mt-phase-badge">
                {state ? state.stage : "Devnet"}
              </span>
            </div>
            <p>
              <Icon name="pack" size={14} /> Game Boy Advance <span>•</span> SOL
              pair <span>•</span>
              <a
                href={`https://explorer.solana.com/address/${config.mint}?cluster=devnet`}
                target="_blank"
                rel="noopener noreferrer"
              >
                {shortAddress(config.mint)} <Icon name="external" size={12} />
              </a>
            </p>
          </div>
        </div>
        <a className="dn-button mt-mobile-trade" href="#trade-widget">
          <Icon name="swap" size={14} /> Trade tokens
        </a>
        <Link
          className="dn-button dn-secondary mt-play-link"
          href={`/play/${game.slug}`}
        >
          <Icon name="play" size={15} /> Play game
        </Link>
      </header>
      <div className="mt-market-stats" aria-label="Confirmed market state">
        <div>
          <span>
            Indicative spot <small>SOL / token</small>
          </span>
          <strong>{state ? indicativePrice(state) : "—"}</strong>
        </div>
        <div>
          <span>Market SOL reserves</span>
          <strong>
            {state
              ? formatUnits(state.market.curveQuote + state.market.poolQuote)
              : "—"}
            <small> SOL</small>
          </strong>
        </div>
        <div>
          <span>Mint supply</span>
          <strong>{state ? formatUnits(state.mintSupply, 6) : "—"}</strong>
        </div>
        <div>
          <span>Protocol fees accrued</span>
          <strong>
            {state ? formatUnits(state.market.totalFees) : "—"}
            <small> SOL</small>
          </strong>
        </div>
        <button
          className="mt-icon-button"
          onClick={() => void refresh()}
          disabled={loading || transaction.busy}
          aria-label="Refresh onchain market state"
        >
          <Icon name="refresh" size={16} />
          <span>{loading ? "Reading…" : "Refresh"}</span>
        </button>
      </div>
      {error && (
        <p className="dn-error mt-market-error" role="alert">
          {error}
        </p>
      )}
      <div className="mt-terminal-grid">
        <div className="mt-terminal-main">
          <DevnetMarketHistory id={id} refreshKey={activityRefresh} />
          <section className="mt-game-about">
            <img src={game.cover} width="90" height="90" alt="" />
            <div>
              <h2>A little more about {config.title}.</h2>
              <p>{game.description}</p>
              <span>
                {game.author} <span>•</span> {game.genre}
              </span>
            </div>
            <Link
              href={`/play/${game.slug}`}
              aria-label={`Play ${config.title}`}
            >
              <Icon name="play" />
            </Link>
          </section>
          {state && (
            <div className="mt-protocol-tools">
              <section className="dn-panel">
                <h3>Creator fees</h3>
                <p>
                  Accrued {formatUnits(state.market.creatorAccrued)} SOL ·
                  claimed {formatUnits(state.market.creatorClaimed)} SOL ·
                  available{" "}
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
                      state.market.creatorAccrued ===
                        state.market.creatorClaimed
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
                        state.market.platformAccrued -
                          state.market.platformClaimed,
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
                  {formatUnits(state.market.licenseThreshold, 6)} tokens across
                  at most 16 wallet-owned accounts. The platform treasury is
                  excluded. A proof is separate from a copyright license.
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
                          onClick={() =>
                            prepareOperation("market-platform-fees")
                          }
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
                  Buybacks spend only the program’s dedicated budget and keep
                  its existing immutable price protection. Your wallet pays the
                  network fee. Observation interval and price checks can make an
                  operation unavailable.
                </p>
              </details>

              <p className="mt-confirmed-slot">
                <Icon name="shield" size={14} /> Confirmed slot{" "}
                {state.readSlot.toString()}{" "}
                <span>
                  Indicative spot excludes fees and price impact; the trade
                  preview uses exact integer amounts.
                </span>
              </p>
            </div>
          )}
        </div>
        <aside className="mt-trading-column">
          <section
            className={`mt-swap-card mt-side-${side}`}
            aria-label="Trade game tokens"
            id="trade-widget"
          >
            <div className="mt-swap-heading">
              <h2>Trade tokens</h2>
              <Icon name="swap" size={18} />
            </div>
            <p className="mt-swap-subtitle">Your wallet. Your approval.</p>
            {state ? (
              <>
                <div className="dn-form mt-swap-form">
                  <div
                    className="dn-filters"
                    role="group"
                    aria-label="Trade side"
                  >
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
                  <div
                    className="mt-quick-amounts"
                    role="group"
                    aria-label="Quick trade amounts"
                  >
                    {side === "buy" && buyMode === "sol"
                      ? ["0.01", "0.1", "1"].map((value) => (
                          <button
                            key={value}
                            disabled={transaction.busy}
                            onClick={() => {
                              setAmount(value);
                              transaction.setPlan(null);
                            }}
                          >
                            {value} SOL
                          </button>
                        ))
                      : side === "sell" &&
                        address &&
                        [25n, 50n, 100n].map((value) => (
                          <button
                            key={value.toString()}
                            disabled={transaction.busy}
                            onClick={() => {
                              setAmount(
                                formatUnits(
                                  (state.walletTokens * value) / 100n,
                                  6,
                                ),
                              );
                              transaction.setPlan(null);
                            }}
                          >
                            {value.toString()}%
                          </button>
                        ))}
                  </div>
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

                <div className="mt-estimate">
                  <span>
                    Estimated{" "}
                    {side === "buy" ? "receive" : "receive after fees"}
                  </span>
                  <strong>
                    {estimate
                      ? side === "buy"
                        ? formatUnits(estimate.tokens, 6)
                        : formatUnits(estimate.netReceiveLamports)
                      : "—"}{" "}
                    <small>{side === "buy" ? config.symbol : "SOL"}</small>
                  </strong>
                  <div>
                    <span>Protocol fee</span>
                    <span>
                      {estimate ? formatUnits(estimate.fees.total) : "—"} SOL
                    </span>
                  </div>
                </div>
                <div className="mt-your-balances">
                  <span>Your balance</span>
                  <span>
                    {address
                      ? `${formatUnits(state.walletTokens, 6)} ${config.symbol}`
                      : "Connect to view"}
                  </span>
                  <span>Devnet SOL</span>
                  <span>
                    {address ? formatUnits(state.walletLamports) : "—"}
                  </span>
                </div>
              </>
            ) : (
              <div className="mt-swap-unavailable">
                <Icon name={loading ? "refresh" : "clock"} size={30} />
                <strong>
                  {loading ? "Reading the market…" : "Market state unavailable"}
                </strong>
                <p>
                  {loading
                    ? "Checking Solana Devnet before preparing a quote."
                    : "Refresh to load confirmed reserves and a current quote."}
                </p>
                {!loading && (
                  <button
                    className="dn-button dn-secondary"
                    onClick={() => void refresh()}
                  >
                    Try market again
                  </button>
                )}
              </div>
            )}
            <TransactionReview transaction={transaction} />
            <div className="mt-swap-note">
              <Icon name="shield" size={15} />
              <p>
                Preview the exact request before approving in your wallet.
                Prices can move; slippage and protocol fees apply. Network fees
                and account rent are separate.
              </p>
            </div>
          </section>
          <section className="mt-lifecycle-card">
            <div>
              <Icon name="compass" size={17} />
              <h2>Protocol lifecycle</h2>
              <span>{state ? state.stage : "—"}</span>
            </div>
            <ol>
              {phases.map((phase, index) => (
                <li
                  key={phase}
                  data-reached={
                    state ? index <= phases.indexOf(state.stage) : false
                  }
                >
                  <span />
                  {phase}
                </li>
              ))}
            </ol>
            <div className="mt-allocation-label">
              <span>Curve allocation distributed</span>
              <strong>{state ? `${progress.toFixed(2)}%` : "—"}</strong>
            </div>
            <div className="mt-progress-track">
              <span style={{ width: `${progress}%` }} />
            </div>
            <p>
              Market milestones follow the onchain protocol; they do not
              describe the game’s release status.
            </p>
          </section>
          <section className="mt-contract-card">
            <AddressRow title="Token mint" address={config.mint} />
            <AddressRow title="Market account" address={config.market} />
            <AddressRow title="Creator" address={config.creator} />
          </section>
        </aside>
      </div>
      <p className="mt-token-rights">
        Solana Devnet · Test tokens have no monetary value. Token interactions
        do not themselves convey copyright, equity, game files or redistribution
        rights. <Link href="/toc">Read the terms.</Link>
      </p>
    </article>
  );
}
