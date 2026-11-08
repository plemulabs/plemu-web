"use client";

import { useEffect, useRef, useState } from "react";
import {
  readMarketHistory,
  formatUnits,
  type MarketHistory,
  type MarketHistoryEntry,
} from "../../lib/devnet";
const stages = ["Demo", "Graduated", "Alpha", "Hyper", "Beta"];
function entryLabel(entry: MarketHistoryEntry): string {
  switch (entry.kind) {
    case "trade":
      return `${entry.event.buy ? "Bought" : "Sold"} ${formatUnits(entry.event.tokens, 6)} tokens · ${formatUnits(entry.event.principal)} SOL principal · ${formatUnits(entry.event.fee)} SOL fee`;
    case "fees":
      return `${entry.event.platform ? "Platform" : "Creator"} claimed ${formatUnits(entry.event.amount)} SOL`;
    case "buyback":
      return `Buyback burned ${formatUnits(entry.event.tokensBurned, 6)} tokens · ${formatUnits(entry.event.quoteDebit)} SOL dedicated funds`;
    case "stage":
      return `${stages[entry.event.from] || entry.event.from} → ${stages[entry.event.to] || entry.event.to}`;
    case "hypergraduated":
      return "Protocol liquidity activated";
  }
}
export function DevnetMarketHistory({ id }: { id: string }) {
  const [history, setHistory] = useState<MarketHistory | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const generation = useRef(0);
  const read = useRef<AbortController | null>(null);
  useEffect(() => {
    setHistory(null);
    setError("");
    setLoading(false);
    return () => {
      read.current?.abort();
      generation.current++;
    };
  }, [id]);
  async function refresh() {
    const current = ++generation.current;
    read.current?.abort();
    const controller = new AbortController();
    read.current = controller;
    setLoading(true);
    setError("");
    try {
      const result = await readMarketHistory(id, {
        limit: 8,
        signal: controller.signal,
      });
      if (current === generation.current) setHistory(result);
    } catch (error) {
      if (current === generation.current) {
        setHistory(null);
        setError(
          error instanceof Error
            ? error.message
            : "Could not load confirmed activity.",
        );
      }
    } finally {
      if (read.current === controller) read.current = null;
      if (current === generation.current) setLoading(false);
    }
  }
  const trades =
    history?.entries
      .filter(
        (entry): entry is Extract<MarketHistoryEntry, { kind: "trade" }> =>
          entry.kind === "trade",
      )
      .slice()
      .reverse() || [];
  const prices = trades
    .map(
      (entry) =>
        Number(entry.event.principal) / Number(entry.event.tokens) / 1000,
    )
    .filter((price) => Number.isFinite(price) && price > 0);
  const low = Math.min(...prices),
    high = Math.max(...prices);
  const points = prices
    .map(
      (price, index) =>
        `${12 + (index * 576) / Math.max(1, prices.length - 1)},${122 - ((price - low) * 104) / Math.max(high - low, Number.EPSILON)}`,
    )
    .join(" ");
  return (
    <section className="dn-panel">
      <div className="dn-page-heading">
        <h3>Confirmed activity</h3>
        <button
          className="dn-button dn-secondary"
          disabled={loading}
          onClick={() => void refresh()}
        >
          {loading ? "Reading confirmed transactions…" : "Load recent activity"}
        </button>
      </div>
      <p>
        Actual protocol events from a bounded window of confirmed transactions.
        This is partial history; it may include seeded Devnet activity.
      </p>
      {prices.length > 1 && (
        <figure className="dn-price-chart">
          <svg
            viewBox="0 0 600 140"
            role="img"
            aria-label="Recent confirmed trade prices, ordered by fill"
          >
            <path d="M12 126H588" stroke="#34383e" fill="none" />
            <polyline
              points={points}
              fill="none"
              stroke="#b8dc2f"
              strokeWidth="2"
            />
          </svg>
          <figcaption>
            Recent fill prices · {low.toExponential(3)}–{high.toExponential(3)}{" "}
            Devnet SOL per token. This display is approximate; transaction
            quotes use exact integer units.
          </figcaption>
        </figure>
      )}
      {history && (
        <>
          <div className="dn-transaction-list">
            {history.entries
              .slice(-14)
              .reverse()
              .map((entry) => (
                <a
                  key={`${entry.signature}-${entry.logIndex}`}
                  href={`https://explorer.solana.com/tx/${entry.signature}?cluster=devnet`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <span>{entryLabel(entry)}</span>
                  <span>↗</span>
                </a>
              ))}
          </div>
          {history.entries.length === 0 && (
            <p>No authenticated market events were found in this window.</p>
          )}
          <p className="dn-fineprint">
            Scanned {history.scannedSignatures} signatures; skipped{" "}
            {history.skippedTransactions} unavailable, failed or invalid
            transactions. Explorer may provide additional history.
          </p>
        </>
      )}
      {error && (
        <p role="alert" className="dn-error">
          {error}
        </p>
      )}
    </section>
  );
}
