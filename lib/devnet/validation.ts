import {
  getGameMarketV1Decoder,
  GAME_MARKET_V1_DISCRIMINATOR,
} from "./generated/accounts/gameMarketV1";
import {
  getGameProtocolV1Decoder,
  GAME_PROTOCOL_V1_DISCRIMINATOR,
} from "./generated/accounts/gameProtocolV1";
import {
  getGameSolVaultV1Decoder,
  GAME_SOL_VAULT_V1_DISCRIMINATOR,
} from "./generated/accounts/gameSolVaultV1";
import {
  getRandomPackV2Decoder,
  RANDOM_PACK_V2_DISCRIMINATOR,
} from "./generated/accounts/randomPackV2";
import {
  getPackPlayerV2Decoder,
  PACK_PLAYER_V2_DISCRIMINATOR,
} from "./generated/accounts/packPlayerV2";
import {
  getPackDrawV2Decoder,
  PACK_DRAW_V2_DISCRIMINATOR,
} from "./generated/accounts/packDrawV2";
import {
  getGameAccessDecoder,
  GAME_ACCESS_DISCRIMINATOR,
} from "./generated/accounts/gameAccess";
import {
  getMarketDecoder,
  MARKET_DISCRIMINATOR,
} from "./generated/accounts/market";
import {
  getWelcomePackDecoder,
  WELCOME_PACK_DISCRIMINATOR,
} from "./generated/accounts/welcomePack";
import {
  checkedDecode,
  checkPda,
  hex,
  key,
  onCurve,
  pda,
  required,
  TOKEN,
  SYSTEM,
  PROGRAM,
  unhex,
  uint64,
} from "./wire";
import {
  curveReserve,
  SALE_ALLOCATION,
  SUPPLY,
  LICENSE_THRESHOLD,
  u64,
  splitFee,
} from "./math";
import type {
  GameMarketV1,
  MarketConfig,
  PackConfig,
  PackDrawV2,
  PackPlayerV2,
  RandomPackV2,
  RpcAccount,
  WelcomeConfig,
  MarketSnapshot,
} from "./types";
export const V1_SEEDS = [
  "game-sale-v1",
  "game-liquidity-v1",
  "game-pool-v1",
  "game-quote-v1",
  "game-pool-quote-v1",
  "game-fees-v1",
  "game-buyback-v1",
] as const;
export function validateMarketConfig(config: MarketConfig): void {
  if (
    !config.deployed ||
    BigInt(config.licenseThreshold) !== LICENSE_THRESHOLD ||
    config.system !== "gba"
  )
    throw new Error("Market is outside the verified five-game V1 deployment.");
  unhex(config.contentHash);
  const [market] = pda(
    "game-market-v1",
    key(config.creator),
    unhex(config.gameId),
  );
  if (
    config.market !== market ||
    config.mint !== pda("game-mint-v1", key(market))[0]
  )
    throw new Error("Configured market or mint identity mismatch.");
}
export function decodeMarket(
  account: RpcAccount | null,
  config: MarketConfig,
): GameMarketV1 {
  validateMarketConfig(config);
  const d = required(account, PROGRAM);
  for (const at of [185, 186, 187, 188])
    if (d[at] > 1) throw new Error("Invalid market boolean.");
  const m = checkedDecode(
    account,
    getGameMarketV1Decoder(),
    GAME_MARKET_V1_DISCRIMINATOR,
  );
  if (
    m.creator !== config.creator ||
    m.mint !== config.mint ||
    hex(m.gameId) !== config.gameId ||
    hex(m.contentHash) !== config.contentHash ||
    m.licenseThreshold !== BigInt(config.licenseThreshold)
  )
    throw new Error("Market differs from reviewed content identity.");
  checkPda(
    config.market,
    m.bump,
    "game-market-v1",
    key(m.creator),
    Uint8Array.from(m.gameId),
  );
  const bumps = [
    m.mintBump,
    m.saleBump,
    m.liquidityBump,
    m.poolBump,
    m.quoteBump,
    m.poolQuoteBump,
    m.feesBump,
    m.buybackBump,
  ];
  ["game-mint-v1", ...V1_SEEDS].forEach((s, i) => {
    if (pda(s, key(config.market))[1] !== bumps[i])
      throw new Error("Market custody canonical bump mismatch.");
  });
  validateMarketState(m);
  return m;
}
export function validateMarketState(m: GameMarketV1): void {
  if (
    m.version !== 1 ||
    m.targetQuote === 0n ||
    m.targetQuote > SUPPLY ||
    m.licenseThreshold !== LICENSE_THRESHOLD ||
    m.sold > SALE_ALLOCATION ||
    m.burnedTokens > SUPPLY ||
    m.buybackMinimum < 2n ||
    m.buybackMaximum < m.buybackMinimum ||
    m.buybackMaximum > SUPPLY ||
    m.buybackSlippageBps > 1000 ||
    u64(m.platformAccrued + m.creatorAccrued + m.buybackAccrued) !==
      m.totalFees ||
    m.platformClaimed > m.platformAccrued ||
    m.creatorClaimed > m.creatorAccrued ||
    m.buybackSpent > m.buybackAccrued
  )
    throw new Error("Invalid market reserves, fees or immutable parameters.");
  u64(m.targetQuote + splitFee(m.targetQuote, false).total);
  if (m.dexReady) {
    if (
      !m.graduated ||
      !m.alphaUnlocked ||
      m.sold !== SALE_ALLOCATION ||
      m.curveQuote !== 0n ||
      m.poolQuote === 0n ||
      m.poolTokens === 0n ||
      m.poolTokens > SUPPLY
    )
      throw new Error("Invalid Hyper liquidity state.");
  } else if (
    m.curveQuote !== curveReserve(m.targetQuote, m.sold) ||
    m.poolQuote !== 0n ||
    m.poolTokens !== 0n ||
    m.sold === SALE_ALLOCATION
  )
    throw new Error("Curve accounting mismatch.");
  if (
    (!m.graduated && m.curveQuote >= (m.targetQuote + 9n) / 10n) ||
    m.createdAt < 0n ||
    m.lastLifecycleAt < m.createdAt ||
    m.postGraduationTrades > 5n
  )
    throw new Error("Invalid lifecycle state.");
  if (
    m.graduated
      ? m.graduatedAt < m.createdAt || m.graduatedAt > m.lastLifecycleAt
      : m.graduatedAt !== 0n || m.alphaUnlocked || m.postGraduationTrades !== 0n
  )
    throw new Error("Invalid graduation state.");
  if (
    m.alphaUnlocked
      ? !m.graduated ||
        m.postGraduationTrades !== 5n ||
        m.alphaAt < m.graduatedAt + 3600n ||
        m.alphaAt > m.lastLifecycleAt
      : m.alphaAt !== 0n || m.dexReady
  )
    throw new Error("Invalid Alpha state.");
  if (
    m.dexReady
      ? m.hypergraduatedAt < m.alphaAt || m.hypergraduatedAt > m.lastLifecycleAt
      : m.hypergraduatedAt !== 0n || m.beta
  )
    throw new Error("Invalid Hyper transition.");
  if (
    m.beta
      ? !m.dexReady ||
        m.betaAt < m.hypergraduatedAt + 7200n ||
        m.betaAt > m.lastLifecycleAt
      : m.betaAt !== 0n
  )
    throw new Error("Invalid Beta state.");
  if (
    m.lastPriceUpdate < 0n ||
    m.observationAt < 0n ||
    m.twapObservedAt < 0n ||
    m.observationCumulative > m.priceCumulative ||
    m.observationAt > m.lastPriceUpdate ||
    m.twapObservedAt > m.lastPriceUpdate
  )
    throw new Error("Invalid market observations.");
}
export function marketStage(
  m: GameMarketV1,
  chainTime: bigint,
): MarketSnapshot["stage"] {
  if (
    chainTime < 0n ||
    m.lastLifecycleAt > chainTime ||
    m.lastPriceUpdate > chainTime
  )
    throw new Error("Market time is ahead of the confirmed clock.");
  if (m.beta || (m.dexReady && chainTime >= m.hypergraduatedAt + 7200n))
    return "beta";
  if (m.dexReady) return "hyper";
  if (
    m.alphaUnlocked ||
    (m.graduated &&
      m.postGraduationTrades === 5n &&
      chainTime >= m.graduatedAt + 3600n)
  )
    return "alpha";
  return m.graduated ? "graduated" : "demo";
}
export function decodeProtocol(account: RpcAccount | null) {
  const p = checkedDecode(
    account,
    getGameProtocolV1Decoder(),
    GAME_PROTOCOL_V1_DISCRIMINATOR,
  );
  checkPda(pda("game-protocol-v1")[0], p.bump, "game-protocol-v1");
  if (
    p.version !== 1 ||
    p.authority === SYSTEM ||
    p.platform === SYSTEM ||
    !onCurve(p.platform)
  )
    throw new Error("Invalid protocol authority or platform.");
  return p;
}
export function validateSolVault(
  account: RpcAccount | null,
  address: string,
  market: string,
  seed: string,
  bump: number,
  rent: bigint,
  tracked: bigint,
) {
  const v = checkedDecode(
    account,
    getGameSolVaultV1Decoder(),
    GAME_SOL_VAULT_V1_DISCRIMINATOR,
  );
  if (
    v.market !== market ||
    v.bump !== bump ||
    !account ||
    account.lamports < u64(rent + tracked)
  )
    throw new Error("Invalid or underfunded SOL custody.");
  checkPda(address, v.bump, seed, key(market));
}
export function validateMint(
  account: RpcAccount | null,
  m: GameMarketV1,
): bigint {
  const d = required(account, TOKEN, 82),
    v = new DataView(d.buffer, d.byteOffset, d.byteLength);
  if (
    v.getUint32(0, true) !== 0 ||
    d[44] !== 6 ||
    d[45] !== 1 ||
    v.getUint32(46, true) !== 0
  )
    throw new Error("V1 mint is not initialized fixed-supply and unfrozen.");
  const supply = v.getBigUint64(36, true);
  if (supply > SUPPLY - m.burnedTokens)
    throw new Error("Mint supply exceeds fixed issuance.");
  return supply;
}
export function decodePool(
  account: RpcAccount | null,
  config: PackConfig,
): RandomPackV2 {
  if (config.version !== 2 || config.recoveryOnly)
    throw new Error("Only the existing active V2 packs are enabled.");
  const p = checkedDecode(
    account,
    getRandomPackV2Decoder(),
    RANDOM_PACK_V2_DISCRIMINATOR,
  );
  if (
    p.creator !== config.creator ||
    p.count < 3 ||
    p.count > 16 ||
    p.count !== config.games.length ||
    p.price !== BigInt(config.price) ||
    p.tokenBonus !== BigInt(config.tokenBonus) ||
    p.price <= 0n ||
    p.tokenBonus <= 0n
  )
    throw new Error("Pack pool differs from reviewed configuration.");
  checkPda(
    config.pack,
    p.bump,
    "random-pack-v2",
    key(p.creator),
    Uint8Array.from(p.packId),
  );
  const markets = new Set<string>(),
    mints = new Set<string>();
  for (let i = 0; i < p.count; i++) {
    const r = p.rewards[i],
      g = config.games[i];
    if (
      r.market !== g.market ||
      r.mint !== g.mint ||
      hex(r.contentHash) !== g.contentHash ||
      r.mint !== pda("game-token", key(r.market))[0] ||
      r.weight === 0 ||
      r.weight > 1000 ||
      markets.has(r.market) ||
      mints.has(r.mint)
    )
      throw new Error("Pack reward identity or weight mismatch.");
    markets.add(r.market);
    mints.add(r.mint);
  }
  return p;
}
export function validateLegacyMarket(
  account: RpcAccount | null,
  config: PackConfig,
  index: number,
): void {
  const g = config.games[index],
    m = checkedDecode(account, getMarketDecoder(), MARKET_DISCRIMINATOR);
  if (
    m.mint !== g.mint ||
    hex(m.contentHash) !== g.contentHash ||
    m.mint !== pda("game-token", key(g.market))[0]
  )
    throw new Error("Legacy reward market differs from content identity.");
  checkPda(
    g.market,
    m.bump,
    "market",
    key(m.creator),
    Uint8Array.from(m.gameId),
  );
}
export function decodePlayer(
  account: RpcAccount | null,
  address: string,
  pack: string,
  wallet: string,
): PackPlayerV2 {
  const data = required(account, PROGRAM);
  if (data[88] > 1) throw new Error("Invalid pending flag.");
  const p = checkedDecode(
    account,
    getPackPlayerV2Decoder(),
    PACK_PLAYER_V2_DISCRIMINATOR,
  );
  if (
    p.pack !== pack ||
    p.buyer !== wallet ||
    (p.pending && (p.nextNonce === 0n || p.pendingNonce !== p.nextNonce - 1n))
  )
    throw new Error("Pack player does not match buyer.");
  checkPda(address, p.bump, "pack-player-v2", key(pack), key(wallet));
  return p;
}
export function packResults(
  pool: RandomPackV2,
  mask: number,
  randomness: ArrayLike<number>,
  progress: boolean,
): readonly number[] {
  const full = (1 << pool.count) - 1;
  if (
    randomness.length !== 32 ||
    (progress ? (mask & ~full) !== 0 : mask !== full)
  )
    throw new Error("Invalid pack randomness or eligible mask.");
  const view = new DataView(Uint8Array.from(randomness).buffer);
  let cursor = 0;
  function sample(bound: number) {
    if (bound <= 0) throw new Error("Invalid random sample bound.");
    const range = 2 ** 32,
      limit = range - (range % bound);
    while (cursor < 8) {
      const value = view.getUint32(cursor++ * 4, true);
      if (value < limit) return value % bound;
    }
    throw new Error("Unbiased randomness sample window exhausted.");
  }
  const roll = sample(progress ? 100 : 3),
    count = progress ? (roll < 50 ? 1 : roll < 85 ? 2 : 3) : roll + 1;
  let remaining = full,
    missing = progress ? mask : 0;
  const results: number[] = [];
  for (let n = 0; n < count; n++) {
    const choices = missing || remaining;
    let total = 0;
    for (let i = 0; i < pool.count; i++)
      if (choices & (1 << i)) total += pool.rewards[i].weight;
    let ticket = sample(total),
      selected = -1;
    for (let i = 0; i < pool.count; i++) {
      if (!(choices & (1 << i))) continue;
      const weight = pool.rewards[i].weight;
      if (ticket < weight) {
        selected = i;
        break;
      }
      ticket -= weight;
    }
    if (selected < 0) throw new Error("Pack selection failed.");
    results.push(selected);
    remaining &= ~(1 << selected);
    missing &= ~(1 << selected);
  }
  return results;
}
export function decodeDraw(
  account: RpcAccount | null,
  address: string,
  pool: RandomPackV2,
  config: PackConfig,
  player: PackPlayerV2,
  playerAddress: string,
  wallet: string,
): PackDrawV2 {
  const d = checkedDecode(
      account,
      getPackDrawV2Decoder(),
      PACK_DRAW_V2_DISCRIMINATOR,
    ),
    progress = d.status >= 4,
    status = progress ? d.status - 4 : d.status,
    full = (1 << pool.count) - 1;
  if (
    d.pack !== config.pack ||
    d.player !== playerAddress ||
    d.buyer !== wallet ||
    d.price !== pool.price ||
    d.expiresAt - d.requestedAt !== 600n ||
    d.requestedAt <= 0n ||
    status > 3 ||
    (progress ? (d.eligibleMask & ~full) !== 0 : d.eligibleMask !== full) ||
    player.nextNonce === 0n ||
    d.nonce !== player.nextNonce - 1n ||
    player.pending !== status < 2
  )
    throw new Error("Pack draw does not match buyer or current pool.");
  checkPda(
    address,
    d.bump,
    "pack-draw-v2",
    key(playerAddress),
    uint64(d.nonce),
  );
  if (status === 1 || status === 2) {
    const expected = packResults(pool, d.eligibleMask, d.randomness, progress);
    if (
      expected.length !== d.resultCount ||
      Array.from(d.resultIndices).some((r, i) => r !== (expected[i] ?? 255))
    )
      throw new Error("Pack results disagree with verified randomness.");
  } else if (
    d.resultCount !== 0 ||
    Array.from(d.resultIndices).some((i) => i !== 255) ||
    Array.from(d.randomness).some((i) => i !== 0)
  )
    throw new Error("Unfulfilled pack contains results.");
  return d;
}
export function validateAccess(
  account: RpcAccount | null,
  address: string,
  market: string,
  wallet: string,
  hash: string,
): void {
  const a = checkedDecode(
    account,
    getGameAccessDecoder(),
    GAME_ACCESS_DISCRIMINATOR,
  );
  if (
    a.market !== market ||
    a.wallet !== wallet ||
    hex(a.contentHash) !== hash ||
    a.acquiredAt <= 0n
  )
    throw new Error("Access receipt does not match original buyer/content.");
  checkPda(address, a.bump, "game-access", key(market), key(wallet));
}
export function decodeWelcome(
  account: RpcAccount | null,
  config: WelcomeConfig,
  digest: string,
) {
  const w = checkedDecode(
    account,
    getWelcomePackDecoder(),
    WELCOME_PACK_DISCRIMINATOR,
  );
  if (
    w.creator !== config.creator ||
    hex(w.campaignId) !== config.campaignId ||
    hex(w.contentDigest) !== digest ||
    w.contentHashes.some((h, i) => hex(h) !== config.games[i].contentHash) ||
    w.maxClaims === 0n ||
    w.claimed > w.maxClaims
  )
    throw new Error("Welcome campaign content/order or stock mismatch.");
  checkPda(
    config.campaign,
    w.bump,
    "welcome-pack",
    key(w.creator),
    unhex(config.campaignId),
  );
  checkPda(
    config.treasury,
    w.treasuryBump,
    "welcome-treasury",
    key(config.campaign),
  );
  return w;
}
