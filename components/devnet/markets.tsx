"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { DevnetClient } from "../../lib/devnet/client";
import {
  marketDirectory,
  marketHref,
  indicativePrice,
} from "../../lib/market-presentation";
import { Icon } from "./icon";
type Summary = {
  status: "loading" | "ready" | "error";
  price?: string;
  stage?: string;
  slot?: string;
  readAtMs?: number;
  error?: string;
};

export function DevnetMarkets() {
  const [query, setQuery] = useState("");
  const [summaries, setSummaries] = useState<Record<string, Summary>>({});
  const [reading, setReading] = useState(false);
  const generation = useRef(0);
  const read = useRef<AbortController | null>(null);
  useEffect(() => {
    void refreshSummaries();
    return () => {
      read.current?.abort();
      generation.current++;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  async function refreshSummaries() {
    const current = ++generation.current;
    read.current?.abort();
    const controller = new AbortController();
    read.current = controller;
    setReading(true);
    setSummaries(
      Object.fromEntries(
        marketDirectory.map(({ config }) => [
          config.catalogId,
          { status: "loading" },
        ]),
      ),
    );
    let index = 0;
    async function worker() {
      while (!controller.signal.aborted && index < marketDirectory.length) {
        const { config } = marketDirectory[index++];
        try {
          const snapshot = await new DevnetClient().readMarket(
            config.catalogId,
            null,
            controller.signal,
          );
          if (generation.current === current)
            setSummaries((previous) => ({
              ...previous,
              [config.catalogId]: {
                status: "ready",
                price: indicativePrice(snapshot),
                stage: snapshot.stage,
                slot: snapshot.readSlot.toString(),
                readAtMs: snapshot.readAtMs,
              },
            }));
        } catch (error) {
          if (generation.current === current && !controller.signal.aborted)
            setSummaries((previous) => ({
              ...previous,
              [config.catalogId]: {
                status: "error",
                error:
                  error instanceof Error
                    ? error.message
                    : "Market read unavailable.",
              },
            }));
        }
      }
    }
    try {
      await Promise.all([worker(), worker()]);
    } finally {
      if (read.current === controller) {
        read.current = null;
        setReading(false);
      }
    }
  }
  const markets = marketDirectory.filter(({ config, game }) =>
    `${config.title} ${config.symbol} ${game.genre}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  const featured = marketDirectory[0];
  return (
    <div className="mt-directory">
      <div className="dn-page-heading mt-directory-heading">
        <div>
          <div className="mt-section-label">
            <Icon name="market" size={18} /> Game token markets
          </div>
          <h1>
            Back a world.
            <br />
            Be part of its story.
          </h1>
          <p>
            Independent games. Public onchain markets.
            <br />A community that keeps playing.
          </p>
        </div>
        <Link className="mt-guide-link" href="/guide">
          <Icon name="guide" /> How markets work{" "}
          <Icon name="external" size={14} />
        </Link>
      </div>
      <section
        className="mt-directory-feature"
        aria-label="Featured game market"
      >
        <div className="mt-feature-copy">
          <span className="mt-feature-badge">
            <span className="mt-status-dot" /> Explore on Solana Devnet
          </span>
          <h2>
            Goodboy.
            <br />
            Great universe.
          </h2>
          <p>
            Get to know the game, explore its token market, and find your place
            in the community.
          </p>
          <Link
            className="dn-button"
            href={marketHref(featured.config.catalogId)}
          >
            Explore {featured.config.symbol} <Icon name="arrow" size={17} />
          </Link>
          <small>Test tokens only. No monetary value.</small>
        </div>
        <div className="mt-feature-art">
          <div className="mt-feature-orbit" />
          <img
            src={featured.game.cover}
            alt="Goodboy Galaxy game artwork"
            width="512"
            height="512"
          />
          <span className="mt-art-chip">
            <Icon name="play" size={14} /> Independent worlds, onchain.
          </span>
        </div>
      </section>
      <div className="mt-directory-toolbar">
        <div className="mt-directory-tab">
          <Icon name="compass" size={17} /> All markets{" "}
          <span>{marketDirectory.length}</span>
        </div>
        <button
          className="mt-directory-refresh"
          disabled={reading}
          onClick={() => void refreshSummaries()}
        >
          <Icon name="refresh" size={15} />
          {reading ? "Reading quotes…" : "Refresh quotes"}
        </button>
        <label className="mt-search">
          <Icon name="search" size={17} />
          <input
            id="market-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Find a game or token"
            aria-label="Search game token markets"
          />
        </label>
      </div>
      <div className="mt-market-list" aria-label="Game token markets">
        <div className="mt-market-list-head">
          <span>Game / token</span>
          <span>Indicative SOL / token</span>
          <span>Protocol stage</span>
          <span>Explore</span>
        </div>
        {markets.map(({ config, game }) => (
          <Link
            className="mt-market-row"
            key={config.market}
            href={marketHref(config.catalogId)}
            title={`Market ${config.market}${summaries[config.catalogId]?.slot ? " · confirmed slot " + summaries[config.catalogId].slot : ""}`}
          >
            <div className="mt-market-identity">
              <img
                src={game.cover}
                alt=""
                width="64"
                height="64"
                loading="lazy"
              />
              <div>
                <strong>
                  {config.title}
                  <span>${config.symbol}</span>
                </strong>
                <small>
                  {game.genre} <span>Game Boy Advance</span>
                </small>
              </div>
            </div>
            <span
              className="mt-directory-price"
              title={summaries[config.catalogId]?.error}
            >
              {summaries[config.catalogId]?.status === "ready"
                ? summaries[config.catalogId].price
                : summaries[config.catalogId]?.status === "loading"
                  ? "Reading…"
                  : summaries[config.catalogId]?.status === "error"
                    ? "Unavailable"
                    : "—"}
              {summaries[config.catalogId]?.readAtMs !== undefined && (
                <small>
                  Read{" "}
                  {new Date(summaries[config.catalogId].readAtMs!)
                    .toISOString()
                    .slice(11, 19)}{" "}
                  UTC
                </small>
              )}
            </span>
            <span className="mt-directory-phase">
              {summaries[config.catalogId]?.status === "ready"
                ? summaries[config.catalogId].stage
                : "—"}
            </span>
            <span className="mt-row-open">
              Open market <Icon name="arrow" size={16} />
            </span>
          </Link>
        ))}
      </div>
      <p className="mt-directory-quote-note" role="status">
        {reading
          ? "Reading five confirmed markets, two at a time."
          : "Indicative spot quotes exclude fees and price impact. Open a market for a fresh trade preview."}
      </p>
      {!markets.length && (
        <div className="dn-empty">
          <Icon name="search" size={28} />
          <h2>No matching market.</h2>
          <p>Try a game title or token symbol.</p>
          <button
            className="dn-button dn-secondary"
            onClick={() => setQuery("")}
          >
            Clear search
          </button>
        </div>
      )}
      <div className="mt-directory-bottom">
        <Icon name="shield" size={20} />
        <p>
          Connect your own wallet to interact with the protocol. These Devnet
          tokens have no monetary value. A token does not itself convey game
          files, copyright, equity or a commercial redistribution license.
        </p>
        <Link href="/wallet">
          Need test funds? <Icon name="arrow" size={15} />
        </Link>
      </div>
    </div>
  );
}
