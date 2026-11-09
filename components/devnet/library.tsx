"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useBrowserLibrary, systems, systemNames } from "./library-provider";
import { Icon } from "./icon";
import { marketDirectory, marketHref } from "../../lib/market-presentation";

export function DevnetLibrary({ discover = false }: { discover?: boolean }) {
  const library = useBrowserLibrary();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [system, setSystem] = useState("all");
  const [saved, setSaved] = useState(false);
  const [notice, setNotice] = useState("");
  const [importing, setImporting] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const list = library.games.filter(
    (game) =>
      (system === "all" || game.system === system) &&
      (!saved || library.favorites.includes(game.id)) &&
      `${game.title} ${game.author} ${game.genre}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  return (
    <>
      <div className="dn-page-heading">
        <div>
          <p className="dn-kicker">
            {discover
              ? "Small worlds. Independent creators."
              : "A collection worth coming back to."}
          </p>
          <h1>
            {discover ? "Find your next favorite." : "Your next little escape."}
          </h1>
          <p>
            {discover
              ? "Explore the same curated homebrew collection as Plemu on Seeker."
              : "Pick something up. Play a little. Make it yours."}
          </p>
        </div>
        <button
          className="dn-button dn-secondary"
          disabled={importing}
          onClick={() => input.current?.click()}
        >
          {importing ? "Checking file…" : "+ Import a game"}
        </button>
      </div>
      <input
        className="dn-hidden-input"
        ref={input}
        type="file"
        accept=".gb,.gbc,.gba,.nes,.sfc,.smc"
        aria-label="Import local game"
        onChange={async (event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (!file) return;
          setImporting(true);
          setNotice("");
          try {
            const game = await library.importFile(file);
            router.push(`/play/${game.slug}`);
          } catch (error) {
            setNotice(
              error instanceof Error
                ? error.message
                : "Could not open this game file.",
            );
          } finally {
            setImporting(false);
          }
        }}
      />
      {notice && (
        <p className="dn-error" role="alert">
          {notice}
        </p>
      )}
      {!discover && (
        <section className="dn-library-hero">
          <div>
            <span className="dn-chip">From the Seeker collection</span>
            <h2>One more round?</h2>
            <p>
              Homebrew gems, familiar buttons.
              <br />
              No wallet needed to press play.
            </p>
            <Link className="dn-button" href="/play/gb-adjustris">
              Play Adjustris <Icon name="play" size={15} />
            </Link>
          </div>
          <div className="dn-hero-art">
            <img
              src="/seeker/gb-adjustris/cover.png"
              alt="Adjustris game screen"
            />
            <div className="dn-hero-dpad" aria-hidden="true">
              ✚
            </div>
            <span className="dn-hero-a" aria-hidden="true">
              A
            </span>
            <span className="dn-hero-b" aria-hidden="true">
              B
            </span>
          </div>
          <span className="dn-hero-spark" aria-hidden="true">
            ✦
          </span>
        </section>
      )}
      <div className="dn-library-toolbar">
        <div className="dn-section-title">
          <h2>{discover ? "Explore the collection" : "Your library"}</h2>
          <span>{list.length} games</span>
        </div>
        <label className="dn-search">
          <Icon name="search" size={17} />
          <input
            aria-label="Search library"
            placeholder="Find a little adventure"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
      </div>
      <div className="dn-filters" role="group" aria-label="Library filters">
        {systems.map((value) => (
          <button
            key={value}
            aria-pressed={system === value}
            onClick={() => setSystem(value)}
          >
            {systemNames[value]}
          </button>
        ))}
        <button
          className="dn-saved-filter"
          aria-pressed={saved}
          onClick={() => setSaved((value) => !value)}
        >
          <Icon name="heart" size={14} /> Saved
        </button>
      </div>
      {list.length === 0 ? (
        <div className="dn-empty">
          <Icon name="search" size={28} />
          <h2>No games in this corner.</h2>
          <p>Try another name or give your filters a fresh start.</p>
          <button
            className="dn-button"
            onClick={() => {
              setQuery("");
              setSystem("all");
              setSaved(false);
            }}
          >
            Clear filters
          </button>
        </div>
      ) : (
        <div className="dn-game-grid">
          {list.map((game) => (
            <article className="dn-game-card" key={game.id}>
              <Link href={`/play/${game.slug}`} className="dn-game-art">
                <img
                  src={game.cover}
                  alt={`${game.title} cover`}
                  loading="lazy"
                />
                <span className="dn-play-overlay" aria-hidden="true">
                  <Icon name="play" size={23} />
                </span>
                <span className="dn-system-tag">
                  {game.system.toUpperCase()}
                </span>
              </Link>
              <div className="dn-game-meta">
                <Link href={`/play/${game.slug}`}>
                  <h3>{game.title}</h3>
                  <p>{game.author}</p>
                </Link>
                <button
                  aria-label={`${library.favorites.includes(game.id) ? "Unsave" : "Save"} ${game.title}`}
                  aria-pressed={library.favorites.includes(game.id)}
                  onClick={() => library.toggleFavorite(game.id)}
                >
                  <Icon name="heart" size={17} />
                </button>
              </div>
              {marketDirectory.some(
                ({ config }) => config.catalogId === game.id,
              ) && (
                <Link href={marketHref(game.id)} className="dn-game-market">
                  <Icon name="market" size={12} /> Explore token market{" "}
                  <Icon name="arrow" size={12} />
                </Link>
              )}
            </article>
          ))}
        </div>
      )}
      <p className="dn-fineprint">
        Local imports stay in this tab and are never uploaded. Reimport them
        after a reload. Games and artwork retain their creators’ licenses. Token
        transactions do not purchase game rights.
      </p>
    </>
  );
}
