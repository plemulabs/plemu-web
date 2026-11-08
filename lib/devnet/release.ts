import release from "./release.json";
import type { MarketConfig, PackConfig, WelcomeConfig } from "./types";
export const DEVNET_RELEASE = Object.freeze({
  cluster: "devnet" as const,
  programId: release.programId,
  genesisHash: release.genesisHash,
  rpcUrl: release.rpcUrl,
});
export const DEVNET_MARKETS: readonly MarketConfig[] = Object.freeze(
  release.markets.map((g) => Object.freeze(g)),
);
export const DEVNET_PACKS: readonly PackConfig[] = Object.freeze(
  release.packs.map((g) =>
    Object.freeze({
      ...g,
      games: Object.freeze(g.games.map((r) => Object.freeze(r))),
    }),
  ),
);
export const WELCOME_PACK: WelcomeConfig = Object.freeze({
  ...release.welcome,
  games: Object.freeze(release.welcome.games.map((g) => Object.freeze(g))),
});
export const LIBRARY_ROSTER = Object.freeze(
  release.library.games.map((g) => Object.freeze(g)),
);
