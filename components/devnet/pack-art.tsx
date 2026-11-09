"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import catalog from "../../lib/browser-catalog.json";
import {
  readBrowserSettings,
  subscribeBrowserSettings,
} from "../../lib/browser-settings";
import { TearPack } from "../tear-pack";
import { Icon } from "./icon";
import { NativeCartridge } from "./native-cartridge";

type PackGame = {
  title: string;
  system: string;
  catalogId?: string;
  id?: string;
};

export function PackContents({
  games,
  ownedMask,
  statusLabel,
}: {
  games: readonly PackGame[];
  ownedMask?: number;
  statusLabel?: string;
}) {
  return (
    <div className="dn-pull-rack" aria-label="Possible pack contents">
      {games.map((game, index) => {
        const item = catalog.games.find(
          (entry) => entry.id === (game.catalogId || game.id),
        );
        const content = (
          <>
            <NativeCartridge
              title={game.title}
              system={game.system}
              cover={item?.cover}
            />
            <strong>{game.title}</strong>
            <small>
              {statusLabel ??
                (ownedMask === undefined
                  ? "Check wallet to see receipts"
                  : (ownedMask & (1 << index)) !== 0
                    ? "Receipt collected"
                    : "No receipt yet")}
            </small>
          </>
        );
        return item ? (
          <Link className="dn-pull" href={`/game/${item.slug}`} key={item.id}>
            {content}
          </Link>
        ) : (
          <div
            className="dn-pull"
            key={game.catalogId || game.id || game.title}
          >
            {content}
          </div>
        );
      })}
    </div>
  );
}

export function PackOpeningPreview({
  title,
  games,
}: {
  title: string;
  games: readonly PackGame[];
}) {
  const [opened, setOpened] = useState(false);
  const [round, setRound] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(false);
  const stage = useRef<HTMLElement>(null);
  const reveal = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (opened) reveal.current?.focus({ preventScroll: true });
    else if (round > 0)
      stage.current
        ?.querySelector<HTMLElement>("[role='button']")
        ?.focus({ preventScroll: true });
  }, [opened, round]);
  useEffect(() => {
    setReducedMotion(readBrowserSettings().reducedMotion);
    const unsubscribe = subscribeBrowserSettings((settings) =>
      setReducedMotion(settings.reducedMotion),
    );
    const node = stage.current;
    let visible = true;
    const update = () => {
      if (node) node.dataset.active = String(visible && !document.hidden);
    };
    const observer =
      typeof IntersectionObserver === "undefined"
        ? null
        : new IntersectionObserver((entries) => {
            visible = entries.some((entry) => entry.isIntersecting);
            update();
          });
    if (node) observer?.observe(node);
    document.addEventListener("visibilitychange", update);
    update();
    return () => {
      unsubscribe();
      observer?.disconnect();
      document.removeEventListener("visibilitychange", update);
    };
  }, []);
  const game = games[round % games.length];
  const cover = catalog.games.find(
    (item) => item.id === (game.catalogId || game.id),
  )?.cover;
  return (
    <section
      ref={stage}
      className="dn-pack-stage"
      aria-label={`${title} opening preview`}
    >
      <span className="dn-preview-label">
        <Icon name="play" size={14} /> Free opening preview
      </span>
      <div className={`dn-foil-scene${opened ? " is-open" : ""}`}>
        {opened ? (
          <div ref={reveal} className="dn-preview-reveal" tabIndex={-1}>
            <NativeCartridge
              title={game.title}
              system={game.system}
              cover={cover}
            />
            <strong>{game.title}</strong>
          </div>
        ) : (
          <TearPack
            key={round}
            className="dn-foil-tear"
            label={`Try the ${title} pack opening preview. Drag right or press Enter.`}
            onOpen={() => setOpened(true)}
            reducedMotion={reducedMotion}
          >
            <div className="dn-native-foil" aria-hidden="true">
              <div className="dn-foil-top">
                <span>
                  Pull <Icon name="arrow" size={18} />
                </span>
              </div>
              <div className="dn-foil-body">
                <img
                  src="/brand/plemu-mark.svg"
                  alt=""
                  width="1600"
                  height="1600"
                  draggable={false}
                />
                <strong>plemu</strong>
                <span>{title}</span>
                <small>Free preview</small>
              </div>
              <div className="dn-foil-crimp" />
            </div>
          </TearPack>
        )}
      </div>
      <div className="dn-pack-stage-caption" aria-live="polite">
        <h2>{opened ? "A little taste of the reveal." : title}</h2>
        <p>
          {opened
            ? "Illustration only. No payment, draw, reward or receipt."
            : `1–3 token rewards from ${games.length} possible entries.`}
        </p>
      </div>
      <button
        className="dn-button dn-secondary"
        onClick={() => {
          if (opened) {
            setRound((value) => value + 1);
            setOpened(false);
          } else setOpened(true);
        }}
      >
        <Icon name={opened ? "refresh" : "pack"} size={17} />{" "}
        {opened ? "Try the rip again" : "Open free preview"}
      </button>
      {!opened && (
        <p className="dn-pack-gesture-note">
          Drag across the seal or press Enter on the pack.
        </p>
      )}
    </section>
  );
}
