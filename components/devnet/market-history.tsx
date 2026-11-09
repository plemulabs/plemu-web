"use client";

import { useEffect, useRef, useState } from "react";
import {
  formatUnits,
  readMarketHistory,
  type MarketHistory,
  type MarketHistoryEntry,
} from "../../lib/devnet";
import {
  confirmedFills,
  eventDate,
  eventTime,
  fillPrice,
  shortAddress,
} from "../../lib/market-presentation";
import { Icon } from "./icon";
import { MarketChart } from "./market-chart";

function eventLabel(entry: MarketHistoryEntry) {
  switch (entry.kind) {
    case "trade":
      return `${entry.event.buy ? "Buy" : "Sell"} ${formatUnits(entry.event.tokens, 6)} tokens`;
    case "buyback":
      return `Buyback burned ${formatUnits(entry.event.tokensBurned, 6)} tokens · ${formatUnits(entry.event.quoteDebit)} SOL dedicated funds`;
    case "fees":
      return `${entry.event.platform ? "Platform" : "Creator"} claimed ${formatUnits(entry.event.amount)} SOL`;
    case "stage":
      return `${["Demo", "Graduated", "Alpha", "Hyper", "Beta"][entry.event.from] || entry.event.from} to ${["Demo", "Graduated", "Alpha", "Hyper", "Beta"][entry.event.to] || entry.event.to}`;
    case "hypergraduated":
      return "Protocol liquidity activated";
  }
}
export function DevnetMarketHistory({
  id,
  refreshKey = 0,
}: {
  id: string;
  refreshKey?: number;
}) {
  const [history, setHistory] = useState<MarketHistory | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<"trades" | "protocol">("trades");
  const [page, setPage] = useState(0);
  const generation = useRef(0);
  const read = useRef<AbortController | null>(null);
  async function refresh() {
    const current = ++generation.current;
    read.current?.abort();
    const controller = new AbortController();
    read.current = controller;
    setLoading(true);
    setError("");
    setHistory(null);
    setPage(0);
    try {
      const result = await readMarketHistory(id, {
        limit: 12,
        signal: controller.signal,
      });
      if (current === generation.current) setHistory(result);
    } catch (error) {
      if (current === generation.current)
        setError(
          error instanceof Error
            ? error.message
            : "Could not load confirmed activity.",
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
    };
  }, [id, refreshKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const fills = confirmedFills(history?.entries || []);
  const latest = fills.slice().reverse();
  const events =
    history?.entries.filter((entry) => entry.kind !== "trade") || [];
  const count = tab === "trades" ? latest.length : events.length;
  return (
    <section className="mt-market-data" aria-label="Market chart and activity">
      <MarketChart fills={fills} loading={loading} />
      <div className="mt-activity">
        <div className="mt-activity-toolbar">
          <div role="group" aria-label="Market activity view">
            <button
              aria-pressed={tab === "trades"}
              onClick={() => {
                setTab("trades");
                setPage(0);
              }}
            >
              Trades <span>{latest.length}</span>
            </button>
            <button
              aria-pressed={tab === "protocol"}
              onClick={() => {
                setTab("protocol");
                setPage(0);
              }}
            >
              Protocol <span>{events.length}</span>
            </button>
          </div>
          <button
            className="mt-icon-button"
            disabled={loading}
            onClick={() => void refresh()}
            aria-label="Refresh confirmed activity"
          >
            <Icon name="refresh" size={16} />
            <span>{loading ? "Reading…" : "Refresh"}</span>
          </button>
        </div>
        {error && (
          <div className="mt-data-error" role="alert">
            <Icon name="clock" />
            <div>
              <strong>Activity is unavailable right now.</strong>
              <p>{error}</p>
              <button onClick={() => void refresh()} disabled={loading}>
                Try again
              </button>
            </div>
          </div>
        )}
        {tab === "trades" ? (
          <div className="mt-table-scroll">
            <table className="mt-trades-table">
              <caption className="dn-visually-hidden">
                Confirmed trade fills from a partial transaction window
              </caption>
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Side</th>
                  <th>Price / token</th>
                  <th>Tokens</th>
                  <th>Devnet SOL</th>
                  <th>Fee (SOL)</th>
                  <th>Trader</th>
                  <th>
                    <span className="dn-visually-hidden">Explorer</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {latest.slice(page * 12, (page + 1) * 12).map((fill) => (
                  <tr key={`${fill.signature}-${fill.logIndex}`}>
                    <td>
                      <time>
                        {eventDate(fill.event.timestamp)}
                        <small>{eventTime(fill.event.timestamp)}</small>
                      </time>
                    </td>
                    <td>
                      <span
                        className={
                          fill.event.buy ? "mt-buy-text" : "mt-sell-text"
                        }
                      >
                        {fill.event.buy ? "Buy" : "Sell"}
                      </span>
                    </td>
                    <td>{fillPrice(fill)}</td>
                    <td>{formatUnits(fill.event.tokens, 6)}</td>
                    <td>{formatUnits(fill.event.principal)}</td>
                    <td>{formatUnits(fill.event.fee)}</td>
                    <td>
                      <a
                        href={`https://explorer.solana.com/address/${fill.event.trader}?cluster=devnet`}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={fill.event.trader}
                      >
                        {shortAddress(fill.event.trader)}
                      </a>
                    </td>
                    <td>
                      <a
                        href={`https://explorer.solana.com/tx/${fill.signature}?cluster=devnet`}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`Inspect ${fill.event.buy ? "buy" : "sell"} transaction at slot ${fill.slot}`}
                      >
                        <Icon name="external" size={14} />
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="mt-protocol-events">
            {events.slice(page * 12, (page + 1) * 12).map((entry) => (
              <a
                key={`${entry.signature}-${entry.logIndex}`}
                href={`https://explorer.solana.com/tx/${entry.signature}?cluster=devnet`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Icon name="shield" size={16} />
                <span>{eventLabel(entry)}</span>
                <time>{eventTime(entry.event.timestamp)}</time>
                <Icon name="external" size={14} />
              </a>
            ))}
          </div>
        )}
        {!error && !count && (
          <div className="mt-table-empty">
            {loading
              ? "Checking the confirmed transaction window…"
              : tab === "trades"
                ? "No confirmed fills in this window yet."
                : "No protocol events in this window."}
          </div>
        )}
        {count > 12 && (
          <div className="mt-table-pages">
            <button
              disabled={page === 0}
              onClick={() => setPage((value) => value - 1)}
            >
              Previous
            </button>
            <span>
              Page {page + 1} of {Math.ceil(count / 12)}
            </span>
            <button
              disabled={(page + 1) * 12 >= count}
              onClick={() => setPage((value) => value + 1)}
            >
              Next
            </button>
          </div>
        )}
        <div className="mt-data-note">
          <span className="mt-status-dot" />
          Confirmed Devnet events
          <span>
            {history
              ? `${history.scannedSignatures} signatures checked · ${history.skippedTransactions} skipped`
              : "Partial history"}
          </span>
        </div>
      </div>
    </section>
  );
}
