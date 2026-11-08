import {
  DEVNET_RELEASE,
  DEVNET_MARKETS,
  DEVNET_PACKS,
  WELCOME_PACK,
} from "./release";
import {
  quoteBuyTokens,
  quoteSell,
  maximumTotal,
  minimumOutput,
  formatUnits,
  u64,
} from "./math";
import {
  validateMarketState,
  validateMarketConfig,
  packResults,
} from "./validation";
import {
  ata,
  createAta,
  instruction,
  key,
  meta,
  onCurve,
  pda,
  SYSTEM,
  TOKEN,
  VRF,
  VRF_QUEUE,
  uint64,
} from "./wire";
import {
  getBuyGameTokensV1InstructionDataEncoder,
  getSellGameTokensV1InstructionDataEncoder,
  getClaimWelcomePackInstructionDataEncoder,
  getCreatePackPlayerV2InstructionDataEncoder,
  getRequestRandomPackV2InstructionDataEncoder,
  getRequestRandomPackV3InstructionDataEncoder,
  getClaimRandomPackV2InstructionDataEncoder,
  getClaimRandomPackV3InstructionDataEncoder,
  getRefundRandomPackV2InstructionDataEncoder,
  getRefundRandomPackV3InstructionDataEncoder,
} from "./generated/instruction-data";
import type {
  SnapshotBase,
  MarketSnapshot,
  PackSnapshot,
  WelcomeSnapshot,
  InstructionPlan,
  PlanKind,
  UnsignedInstruction,
  TradeQuote,
} from "./types";
export const SNAPSHOT_MAX_AGE_MS = 30_000;
function fresh(s: SnapshotBase, now = Date.now()): void {
  if (
    s.cluster !== "devnet" ||
    s.genesisHash !== DEVNET_RELEASE.genesisHash ||
    s.readSlot < 0n ||
    !Number.isFinite(s.readAtMs) ||
    s.readAtMs > now + 1000 ||
    now - s.readAtMs > SNAPSHOT_MAX_AGE_MS
  )
    throw new Error("Refresh the verified Devnet state before approval.");
}
export function assertFreshPlan(plan: InstructionPlan, now = Date.now()): void {
  fresh(plan.source, now);
  if (
    plan.cluster !== "devnet" ||
    plan.genesisHash !== DEVNET_RELEASE.genesisHash ||
    plan.wallet !== plan.source.wallet ||
    now > plan.expiresAtMs ||
    plan.expiresAtMs > plan.source.readAtMs + SNAPSHOT_MAX_AGE_MS
  )
    throw new Error("Transaction preview expired or changed network/wallet.");
}
function buyer(s: SnapshotBase): string {
  fresh(s);
  if (!s.wallet || s.wallet === SYSTEM || !onCurve(s.wallet))
    throw new Error("Connect a valid Devnet buyer wallet and refresh.");
  return s.wallet;
}
function plan(
  source: InstructionPlan["source"],
  kind: PlanKind,
  instructions: readonly UnsignedInstruction[],
  summary: readonly string[],
  max = 0n,
  min = 0n,
  quote?: TradeQuote,
): InstructionPlan {
  const wallet = buyer(source);
  instructions.forEach((ix) => {
    key(ix.programAddress);
    ix.accounts.forEach((a) => key(a.address));
  });
  return Object.freeze({
    cluster: "devnet",
    genesisHash: DEVNET_RELEASE.genesisHash,
    wallet,
    kind,
    instructions: Object.freeze(instructions),
    readSlot: source.readSlot,
    createdAtMs: Date.now(),
    expiresAtMs: source.readAtMs + SNAPSHOT_MAX_AGE_MS,
    summary: Object.freeze(summary),
    maximumDebitLamports: u64(max),
    minimumReceiveLamports: u64(min),
    quote,
    source,
  });
}
function validateMarket(s: MarketSnapshot): void {
  buyer(s);
  validateMarketConfig(s.config);
  validateMarketState(s.market);
  if (
    !DEVNET_MARKETS.some(
      (c) =>
        c.market === s.config.market &&
        c.mint === s.market.mint &&
        c.creator === s.market.creator &&
        c.catalogId === s.config.catalogId,
    ) ||
    !s.walletEligible
  )
    throw new Error(
      "Market preview does not match the reviewed wallet/content.",
    );
}
function tradeAccounts(s: MarketSnapshot, tokenAccount: string) {
  return [
    meta(s.wallet!, true, true),
    meta(s.config.market, true),
    meta(s.config.mint, true),
    meta(tokenAccount, true),
    ...[
      "game-sale-v1",
      "game-liquidity-v1",
      "game-pool-v1",
      "game-quote-v1",
      "game-pool-quote-v1",
      "game-fees-v1",
      "game-buyback-v1",
    ].map((seed) => meta(pda(seed, key(s.config.market))[0], true)),
    meta(TOKEN),
    meta(SYSTEM),
  ];
}
export function planBuy(
  s: MarketSnapshot,
  tokens: bigint,
  slippageBps = 100,
): InstructionPlan {
  validateMarket(s);
  const q = quoteBuyTokens(s, tokens),
    max = maximumTotal(q.totalDebitLamports, slippageBps);
  if (s.walletLamports < max)
    throw new Error(
      "Insufficient native Devnet SOL for the maximum trade debit; keep extra SOL for network/account fees.",
    );
  return plan(
    s,
    "market-buy",
    [
      createAta(s.wallet!, s.config.mint),
      instruction(
        getBuyGameTokensV1InstructionDataEncoder().encode({
          tokenAmount: tokens,
          maxTotalSol: max,
        }),
        tradeAccounts(s, ata(s.wallet!, s.config.mint)),
      ),
    ],
    [
      `Buy ${formatUnits(tokens, 6)} ${s.config.symbol} tokens on Solana Devnet.`,
      `Maximum trade debit ${formatUnits(max)} native Devnet SOL, plus network/account costs.`,
      `Game tokens and content licenses are separate.`,
    ],
    max,
    0n,
    q,
  );
}
export function planSell(
  s: MarketSnapshot,
  tokens: bigint,
  slippageBps = 100,
  sourceTokenAccount?: string,
): InstructionPlan {
  validateMarket(s);
  const q = quoteSell(s, tokens),
    min = minimumOutput(q.netReceiveLamports, slippageBps),
    source = s.tokenAccounts.find(
      (a) =>
        a.amount >= tokens &&
        (!sourceTokenAccount || a.address === sourceTokenAccount),
    );
  if (!source)
    throw new Error(
      "One validated token account must hold the sale amount. Choose a smaller amount or consolidate first.",
    );
  return plan(
    s,
    "market-sell",
    [
      instruction(
        getSellGameTokensV1InstructionDataEncoder().encode({
          tokenAmount: tokens,
          minSolOut: min,
        }),
        tradeAccounts(s, source.address),
      ),
    ],
    [
      `Sell ${formatUnits(tokens, 6)} ${s.config.symbol} tokens on Solana Devnet.`,
      `Minimum received ${formatUnits(min)} native Devnet SOL after protocol fee; network fees remain separate.`,
    ],
    0n,
    min,
    q,
  );
}
export function planWelcome(s: WelcomeSnapshot): InstructionPlan {
  const wallet = buyer(s);
  if (
    s.config.campaign !== WELCOME_PACK.campaign ||
    s.alreadyClaimed ||
    !s.available
  )
    throw new Error(
      s.alreadyClaimed
        ? "This wallet already claimed the welcome collection."
        : "Welcome collection or sponsor is unavailable.",
    );
  return plan(
    s,
    "welcome-claim",
    [
      instruction(getClaimWelcomePackInstructionDataEncoder().encode({}), [
        meta(wallet, true, true),
        meta(s.config.campaign, true),
        meta(s.config.treasury, true),
        meta(
          pda("welcome-claim", key(s.config.campaign), key(wallet))[0],
          true,
        ),
        meta(SYSTEM),
      ]),
    ],
    [
      "Claim the six-game welcome access receipt on Solana Devnet.",
      "The sponsor covers receipt rent; your wallet pays network fees. No token purchase.",
    ],
  );
}
function validatePack(s: PackSnapshot) {
  const wallet = buyer(s);
  if (
    s.config.version !== 2 ||
    !DEVNET_PACKS.some((c) => c.pack === s.config.pack) ||
    s.pool.creator !== s.config.creator ||
    s.pool.price !== BigInt(s.config.price) ||
    s.pool.tokenBonus !== BigInt(s.config.tokenBonus) ||
    s.playerAddress !==
      pda("pack-player-v2", key(s.config.pack), key(wallet))[0]
  )
    throw new Error("Pack preview differs from the reviewed V2 deployment.");
  return wallet;
}
export function planPackRequest(s: PackSnapshot): InstructionPlan {
  const wallet = validatePack(s);
  if (s.config.recoveryOnly || s.player?.pending || s.availableDraws === 0n)
    throw new Error(
      "Finish any pending draw and refresh stock before requesting another pack.",
    );
  const nonce = s.player?.nextNonce ?? 0n;
  u64(nonce + 1n);
  const draw = pda("pack-draw-v2", key(s.playerAddress!), uint64(nonce))[0],
    ix: UnsignedInstruction[] = [];
  if (!s.player)
    ix.push(
      instruction(getCreatePackPlayerV2InstructionDataEncoder().encode({}), [
        meta(wallet, true, true),
        meta(s.config.pack),
        meta(s.playerAddress!, true),
        meta(SYSTEM),
      ]),
    );
  const accounts = [
    meta(wallet, true, true),
    meta(s.config.pack, true),
    meta(s.playerAddress!, true),
    meta(draw, true),
    meta(VRF_QUEUE, true),
    meta(pda("identity")[0]),
    meta(VRF),
    meta("SysvarS1otHashes111111111111111111111111111"),
    meta(SYSTEM),
    ...s.config.games.map((g) =>
      meta(pda("pack-tokens-v2", key(s.config.pack), key(g.mint))[0]),
    ),
    ...(s.config.progressPolicy
      ? s.config.games.map((g) =>
          meta(pda("game-access", key(g.market), key(wallet))[0]),
        )
      : []),
  ];
  const encoder = s.config.progressPolicy
    ? getRequestRandomPackV3InstructionDataEncoder()
    : getRequestRandomPackV2InstructionDataEncoder();
  ix.push(
    instruction(
      encoder.encode({
        nonce,
        maxPrice: s.pool.price,
        maxOracleFee: 1_000_000n,
      }),
      accounts,
    ),
  );
  return plan(
    s,
    "pack-request",
    ix,
    [
      `Request ${s.config.title}: ${formatUnits(s.pool.price)} native Devnet SOL base price.`,
      `Reward-count odds: 1 reward 50%, 2 rewards 35%, 3 rewards 15%. Entries are distinct within the draw. Progress selection prioritizes entries missing when requested, then fills remaining slots from other pool entries, which can already be owned.`,
      `One buyer payment approval. Automatic settlement delivers only to this stored buyer; a separate executor pays delivery rent.`,
      `Estimated maximum initial debit ${formatUnits(s.estimatedMaximumDebitLamports)} Devnet SOL; wallet/network fees may differ.`,
    ],
    s.estimatedMaximumDebitLamports,
  );
}
/** Recovery-only buyer-signed claim. Active automatic purchase UI must wait for executor delivery instead. */
export function planPackClaim(s: PackSnapshot): InstructionPlan {
  const wallet = validatePack(s),
    d = s.draw,
    status = d ? (d.status >= 4 ? d.status - 4 : d.status) : null;
  if (!s.player?.pending || status !== 1 || !d || !s.drawAddress)
    throw new Error(
      "A fulfilled original-buyer draw is required for claim recovery.",
    );
  const expected = packResults(
    s.pool,
    d.eligibleMask,
    d.randomness,
    d.status >= 4,
  );
  if (
    expected.length !== d.resultCount ||
    expected.some((n, i) => d.resultIndices[i] !== n)
  )
    throw new Error("Reward verification failed.");
  const accounts = [
      meta(wallet, true, true),
      meta(s.config.pack, true),
      meta(s.playerAddress!, true),
      meta(s.drawAddress, true),
      meta(s.pool.creator, true),
      meta(TOKEN),
      meta(SYSTEM),
    ],
    ix: UnsignedInstruction[] = [];
  for (const i of expected) {
    const g = s.config.games[i];
    ix.push(createAta(wallet, g.mint));
    accounts.push(
      meta(g.market),
      meta(pda("game-access", key(g.market), key(wallet))[0], true),
      meta(g.mint),
      meta(pda("pack-tokens-v2", key(s.config.pack), key(g.mint))[0], true),
      meta(ata(wallet, g.mint), true),
    );
  }
  ix.push(
    instruction(
      (d.status >= 4
        ? getClaimRandomPackV3InstructionDataEncoder()
        : getClaimRandomPackV2InstructionDataEncoder()
      ).encode({}),
      accounts,
    ),
  );
  return plan(s, "pack-claim", ix, [
    "Optional existing-draw recovery only; ordinary paid packs settle automatically without another buyer approval.",
    "Original buyer receives the verified rewards. This claim incurs network and possibly account-rent costs.",
  ]);
}
export function planPackRefund(s: PackSnapshot): InstructionPlan {
  const wallet = validatePack(s);
  if (!s.canRefund || !s.draw || !s.drawAddress || !s.player?.pending)
    throw new Error(
      "Refund requires an unfulfilled draw past its onchain timeout.",
    );
  return plan(
    s,
    "pack-refund",
    [
      instruction(
        (s.draw.status >= 4
          ? getRefundRandomPackV3InstructionDataEncoder()
          : getRefundRandomPackV2InstructionDataEncoder()
        ).encode({}),
        [
          meta(wallet, true, true),
          meta(s.config.pack, true),
          meta(s.playerAddress!, true),
          meta(s.drawAddress, true),
        ],
      ),
    ],
    [
      `Recover ${formatUnits(s.draw.price)} native Devnet SOL pack price to the original buyer.`,
      `Already-spent oracle and network fees are excluded; this recovery transaction has a network fee.`,
    ],
    0n,
    s.draw.price,
  );
}
export {
  plan as buildInstructionPlan,
  validateMarket as validateMarketSnapshot,
};
