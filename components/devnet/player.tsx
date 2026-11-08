"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useBrowserLibrary, systemNames } from "./library-provider";
import {
  readBrowserSettings,
  subscribeBrowserSettings,
} from "../../lib/browser-settings";

export function BrowserPlayer({ slug }: { slug: string }) {
  const { games, favorites, toggleFavorite, removeImport } =
    useBrowserLibrary();
  const game = games.find((item) => item.slug === slug);
  const [playing, setPlaying] = useState(false);
  const [message, setMessage] = useState("");
  const frame = useRef<HTMLIFrameElement>(null);
  const payload = useRef<ArrayBuffer | null>(null);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      payload.current = null;
    };
  }, []);
  useEffect(() => {
    if (!playing || !game) return;
    const listener = (event: MessageEvent) => {
      if (
        event.source !== frame.current?.contentWindow ||
        event.origin !== "null"
      )
        return;
      if (event.data?.type === "plemu-player-awaiting-game" && payload.current)
        frame.current.contentWindow?.postMessage(
          {
            type: "plemu-local-game",
            bytes: payload.current,
            title: game.title,
            system: game.system,
            muted: readBrowserSettings().muted,
          },
          "*",
        );
      if (event.data?.type === "plemu-player-started")
        setMessage("Playing locally. Export a save before leaving.");
      if (event.data?.type === "plemu-player-error")
        setMessage("The player could not load. Stop the player and try again.");
    };
    window.addEventListener("message", listener);
    const unsubscribe = subscribeBrowserSettings((settings) =>
      frame.current?.contentWindow?.postMessage(
        { type: "plemu-player-volume", muted: settings.muted },
        "*",
      ),
    );
    return () => {
      window.removeEventListener("message", listener);
      unsubscribe();
    };
  }, [playing, game]);
  if (!game)
    return (
      <div className="dn-empty">
        <h1>Game unavailable in this tab.</h1>
        <p>Local imports must be selected again after a reload.</p>
        <Link href="/" className="dn-button">
          Back to library
        </Link>
      </div>
    );
  async function start() {
    if (!game) return;
    setMessage("Checking your game file…");
    try {
      const response = game.file ? null : await fetch(game.rom);
      if (response && !response.ok)
        throw new Error("Game download failed. Please try again.");
      const bytes = game.file
        ? await game.file.arrayBuffer()
        : await response!.arrayBuffer();
      const hash = Array.from(
        new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
        (value) => value.toString(16).padStart(2, "0"),
      ).join("");
      if (hash !== game.sha256 || bytes.byteLength !== game.size)
        throw new Error("The game file failed its integrity check.");
      if (!mounted.current) return;
      payload.current = bytes;
      setPlaying(true);
      setMessage("Loading the local player…");
    } catch (error) {
      if (mounted.current)
        setMessage(
          error instanceof Error
            ? error.message
            : "Could not start the player.",
        );
    }
  }
  return (
    <>
      <Link href="/" className="dn-text-link">
        ‹ Your library
      </Link>
      <div className="dn-player-heading">
        <div>
          <p className="dn-kicker">
            {systemNames[game.system]} · {game.author}
          </p>
          <h1>{game.title}</h1>
        </div>
        <button
          className="dn-button dn-secondary"
          aria-pressed={favorites.includes(game.id)}
          onClick={() => toggleFavorite(game.id)}
        >
          {favorites.includes(game.id) ? "♥ Saved" : "♡ Save game"}
        </button>
      </div>
      {game.system === "snes" && (
        <p className="dn-status">
          Experimental browser SNES player. This uses a pinned bsnes preview
          runtime; performance and save compatibility can differ from Seeker.
        </p>
      )}
      <div className={`dn-player-stage ${playing ? "is-playing" : ""}`}>
        {playing ? (
          <iframe
            ref={frame}
            src={
              game.system === "snes"
                ? "/emulator-snes/frame.html"
                : "/emulator/frame.html"
            }
            title={`Play ${game.title}`}
            sandbox="allow-scripts allow-downloads allow-pointer-lock"
            allow="autoplay *; fullscreen *; gamepad *"
          />
        ) : (
          <>
            <img src={game.cover} alt={`${game.title} cover`} />
            <button className="dn-button" onClick={() => void start()}>
              ▶ Start playing
            </button>
          </>
        )}
      </div>
      <div className="dn-player-actions">
        <p role="status">
          {message || "Plays on your device. No wallet connection required."}
        </p>
        {playing && (
          <button
            className="dn-button dn-secondary"
            onClick={() => {
              setPlaying(false);
              payload.current = null;
              setMessage("Player stopped. Unsaved progress has been cleared.");
            }}
          >
            Stop player
          </button>
        )}
      </div>
      <div className="dn-detail-columns">
        <section>
          <h2>A little about this game</h2>
          <p>{game.description}</p>
          <h3>Controls</h3>
          <p>{game.controls}</p>
          <p>
            Keyboard, a connected controller, or the player’s touch buttons.
            Open the player menu to change controls, download a save state, or
            import a compatible save. Browser and Seeker save formats may
            differ.
          </p>
        </section>
        <section>
          <h2>Made by {game.author}</h2>
          {game.sourceUrl && (
            <p>
              <a
                href={game.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                Creator’s release ↗
              </a>
            </p>
          )}
          {game.evidence && (
            <p>
              <a href={game.evidence}>Curation and license evidence</a>
            </p>
          )}
          <p>
            License: {game.license}.{" "}
            <a href="/seeker/notices/PRESENTATION-ART.md">Artwork credits</a>.{" "}
            <a href="/emulator/NOTICE.txt">Player licenses and source</a>.
          </p>
          <p className="dn-fineprint">
            Game files and saves stay on your device. Download saves before
            leaving. Token holdings convey no copyright or game license.
          </p>
          {game.file && (
            <button
              className="dn-button dn-secondary"
              onClick={() => {
                removeImport(game.id);
                window.location.assign("/");
              }}
            >
              Remove local import
            </button>
          )}
        </section>
      </div>
    </>
  );
}
