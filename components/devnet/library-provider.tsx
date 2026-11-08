"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import catalog from "../../lib/browser-catalog.json";
import {
  readOptionalStorage,
  writeOptionalStorage,
} from "../../lib/privacy-preferences";
import { usePrivacyPreferences } from "../privacy-preferences";

export type BrowserGame = (typeof catalog.games)[number] & { file?: File };
const KEY = "plemu-browser-library-v1";
export const systems = ["all", "gb", "gbc", "gba", "nes", "snes"] as const;
export const systemNames: Record<string, string> = {
  all: "All systems",
  gb: "Game Boy",
  gbc: "Game Boy Color",
  gba: "Game Boy Advance",
  nes: "NES",
  snes: "Super NES",
};
type Library = {
  games: BrowserGame[];
  favorites: string[];
  toggleFavorite: (id: string) => void;
  importFile: (file: File) => Promise<BrowserGame>;
  removeImport: (id: string) => void;
};
const Context = createContext<Library>({
  games: catalog.games,
  favorites: [],
  toggleFavorite: () => {},
  importFile: async () => {
    throw new Error("Open the library to import a game.");
  },
  removeImport: () => {},
});

export async function inspectRom(
  file: File,
): Promise<{ system: string; sha256: string }> {
  const extension = file.name.split(".").at(-1)?.toLowerCase();
  const system = (
    {
      gb: "gb",
      gbc: "gbc",
      gba: "gba",
      nes: "nes",
      sfc: "snes",
      smc: "snes",
    } as Record<string, string>
  )[extension || ""];
  if (!system)
    throw new Error(
      "Choose an uncompressed .gb, .gbc, .gba, .nes, .sfc or .smc file.",
    );
  if (file.size < 16 || file.size > 64 * 1024 * 1024)
    throw new Error("Game files must be between 16 bytes and 64 MB.");
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (
    system === "nes" &&
    (bytes[0] !== 0x4e ||
      bytes[1] !== 0x45 ||
      bytes[2] !== 0x53 ||
      bytes[3] !== 0x1a)
  )
    throw new Error("This file does not have a valid NES header.");
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return {
    system,
    sha256: Array.from(new Uint8Array(hash), (value) =>
      value.toString(16).padStart(2, "0"),
    ).join(""),
  };
}

export function BrowserLibraryProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { persistence, ready } = usePrivacyPreferences();
  const [imported, setImported] = useState<BrowserGame[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);
  const restored = useRef(false);
  const favoritesEdited = useRef(false);
  useEffect(() => {
    restored.current = false;
    if (!ready) return;
    if (persistence) {
      try {
        if (favoritesEdited.current)
          writeOptionalStorage(KEY, JSON.stringify(favorites));
        else {
          const raw = readOptionalStorage(KEY);
          const parsed: unknown = raw === null ? null : JSON.parse(raw);
          if (Array.isArray(parsed))
            setFavorites(
              parsed
                .filter(
                  (id): id is string =>
                    typeof id === "string" && id.length < 150,
                )
                .slice(0, 500),
            );
        }
      } catch {
        /* An invalid preference is ignored. */
      }
    }
    restored.current = true;
  }, [ready, persistence]);
  const value: Library = {
    games: [...catalog.games, ...imported],
    favorites,
    toggleFavorite: (id) => {
      favoritesEdited.current = true;
      const next = favorites.includes(id)
        ? favorites.filter((value) => value !== id)
        : [...favorites, id];
      setFavorites(next);
      if (ready && persistence && restored.current)
        writeOptionalStorage(KEY, JSON.stringify(next));
    },
    async importFile(file) {
      const { system, sha256 } = await inspectRom(file);
      const known = [...catalog.games, ...imported].find(
        (game) => game.sha256 === sha256,
      );
      if (known) return known;
      const game: BrowserGame = {
        id: `local/${sha256}`,
        slug: `local-${sha256}`,
        title: file.name.replace(/\.[^.]+$/, ""),
        system,
        author: "Your local file",
        description:
          "Imported on this device. This file stays in this tab and is never uploaded.",
        genre: "Local import",
        controls:
          "Arrow keys: D-pad. X/Z: A/B. Enter: Start. Shift: Select. Use the player controls to change bindings.",
        sourceUrl: "",
        license: "User supplied",
        licenseUrl: "",
        evidence: "",
        sha256,
        size: file.size,
        standard: false,
        marketOnly: false,
        commerce: false,
        packKey: "",
        cover: "/brand/plemu-mark.svg",
        rom: "",
        file,
      };
      setImported((previous) =>
        previous.some((item) => item.id === game.id)
          ? previous
          : [...previous, game],
      );
      return game;
    },
    removeImport: (id) =>
      setImported((previous) => previous.filter((game) => game.id !== id)),
  };
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export const useBrowserLibrary = () => useContext(Context);
