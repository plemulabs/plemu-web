import { readBoundedResponse } from "../bounded-response";
import {
  DEVNET_MARKETS,
  DEVNET_PACKS,
  DEVNET_RELEASE,
  WELCOME_PACK,
} from "./release";
import {
  decodeMarket,
  decodeProtocol,
  decodePool,
  decodePlayer,
  decodeDraw,
  decodeWelcome,
  validateAccess,
  validateLegacyMarket,
  validateMint,
  validateSolVault,
  V1_SEEDS,
  marketStage,
} from "./validation";
import {
  ata,
  bytes,
  CLOCK,
  SYSVAR,
  PROGRAM,
  SYSTEM,
  TOKEN,
  VRF,
  VRF_QUEUE,
  hex,
  i64At,
  key,
  onCurve,
  optional,
  pda,
  required,
  sha256,
  tokenAmount,
  uint64,
  unhex,
  u64At,
} from "./wire";
import { LIQUIDITY_ALLOCATION, SALE_ALLOCATION, u64 } from "./math";
import { planMarketOperation } from "./operations";
import { revalidateFaucetPlan } from "./faucet";
import {
  assertFreshPlan,
  planBuy,
  planSell,
  planWelcome,
  planPackRequest,
  planPackClaim,
  planPackRefund,
} from "./plans";
import type {
  InstructionPlan,
  MarketSnapshot,
  PackSnapshot,
  WelcomeSnapshot,
  RpcAccount,
  RpcTransport,
  PackPhase,
  TokenBalances,
} from "./types";
const READ_METHODS = new Set([
  "getGenesisHash",
  "getMultipleAccounts",
  "getMinimumBalanceForRentExemption",
  "getTokenAccountsByOwner",
  "getSignaturesForAddress",
  "getTransaction",
]);
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Invalid RPC object.");
  return value as Record<string, unknown>;
}
export function rpcUnsigned(value: unknown): bigint {
  if (typeof value === "bigint") return u64(value);
  if (typeof value === "number" && Number.isSafeInteger(value) && value >= 0)
    return u64(BigInt(value));
  if (typeof value === "string" && /^\d{1,20}$/.test(value))
    return u64(BigInt(value));
  throw new Error("RPC unsigned integer is missing or unsafe.");
}
export function decodeRpcAccount(value: unknown): RpcAccount | null {
  if (value === null) return null;
  const a = record(value);
  if (
    typeof a.owner !== "string" ||
    typeof a.executable !== "boolean" ||
    !Array.isArray(a.data) ||
    a.data.length !== 2 ||
    a.data[1] !== "base64" ||
    typeof a.data[0] !== "string" ||
    a.data[0].length > 350_000
  )
    throw new Error("Malformed base64 RPC account.");
  key(a.owner);
  const encoded = a.data[0];
  if (
    !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(
      encoded,
    )
  )
    throw new Error("Invalid base64 account data.");
  const binary = atob(encoded),
    data = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return {
    owner: a.owner,
    executable: a.executable,
    lamports: rpcUnsigned(a.lamports),
    data,
  };
}
function values(
  result: unknown,
  count: number,
  minSlot = 0n,
): { accounts: (RpcAccount | null)[]; slot: bigint } {
  const r = record(result),
    context = record(r.context),
    slot = rpcUnsigned(context.slot);
  if (slot < minSlot || !Array.isArray(r.value) || r.value.length !== count)
    throw new Error("RPC account response is incomplete or stale.");
  return { accounts: r.value.map(decodeRpcAccount), slot };
}
function endpointAllowed(endpoint: string) {
  const url = new URL(endpoint);
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.hash ||
    url.port ||
    !["api.devnet.solana.com", "devnet.helius-rpc.com"].includes(url.hostname)
  )
    throw new Error("Only supported HTTPS Devnet RPC endpoints are accepted.");
  return url.toString();
}
export function createReadTransport(
  endpoint = DEVNET_RELEASE.rpcUrl,
): RpcTransport {
  const url = endpointAllowed(endpoint);
  let id = 0;
  return async (method, params, signal) => {
    if (!READ_METHODS.has(method))
      throw new Error("This client permits read-only RPC methods only.");
    const controller = new AbortController(),
      abort = () => controller.abort(),
      timeout = setTimeout(abort, 15_000);
    if (signal?.aborted) controller.abort();
    signal?.addEventListener("abort", abort, { once: true });
    try {
      const requestId = ++id;
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: requestId, method, params }),
        signal: controller.signal,
        cache: "no-store",
        redirect: "error",
      });
      if (!response.ok)
        throw new Error(`Devnet RPC unavailable (HTTP ${response.status}).`);
      const raw = new TextDecoder().decode(
        await readBoundedResponse(response, 2_000_000),
      );
      const data = record(JSON.parse(raw));
      if (
        data.error ||
        data.jsonrpc !== "2.0" ||
        data.id !== requestId ||
        !Object.hasOwn(data, "result")
      )
        throw new Error("Devnet RPC rejected the read.");
      return data.result;
    } finally {
      clearTimeout(timeout);
      signal?.removeEventListener("abort", abort);
    }
  };
}
export class DevnetClient {
  private readonly rpc: RpcTransport;
  constructor(options: { endpoint?: string; transport?: RpcTransport } = {}) {
    if (options.endpoint) endpointAllowed(options.endpoint);
    this.rpc = options.transport ?? createReadTransport(options.endpoint);
  }
  private async accounts(
    addresses: readonly string[],
    minimumSlot = 0n,
    signal?: AbortSignal,
  ) {
    addresses.forEach(key);
    return values(
      await this.rpc(
        "getMultipleAccounts",
        [
          addresses,
          {
            encoding: "base64",
            commitment: "confirmed",
            minContextSlot: Number(minimumSlot),
          },
        ],
        signal,
      ),
      addresses.length,
      minimumSlot,
    );
  }
  private async rent(size: number, signal?: AbortSignal) {
    return rpcUnsigned(
      await this.rpc(
        "getMinimumBalanceForRentExemption",
        [size, { commitment: "confirmed" }],
        signal,
      ),
    );
  }
  private async guard(signal?: AbortSignal) {
    const genesis = await this.rpc("getGenesisHash", [], signal);
    if (genesis !== DEVNET_RELEASE.genesisHash)
      throw new Error(
        "Wrong Solana network: verified Devnet genesis hash is required.",
      );
    const { accounts } = await this.accounts([PROGRAM], 0n, signal),
      program = accounts[0];
    if (
      !program?.executable ||
      ![
        "BPFLoaderUpgradeab1e11111111111111111111111",
        "BPFLoader2111111111111111111111111111111111",
      ].includes(program.owner)
    )
      throw new Error(
        "Configured launchpad program is not executable under a supported loader.",
      );
  }
  private base(slot: bigint, time: bigint, wallet: string | null) {
    if (time < 0n) throw new Error("Invalid confirmed chain clock.");
    if (wallet) key(wallet);
    return {
      cluster: "devnet" as const,
      genesisHash: DEVNET_RELEASE.genesisHash,
      readSlot: slot,
      readAtMs: Date.now(),
      chainTime: time,
      wallet,
    };
  }
  async readMarket(
    id: string,
    wallet: string | null = null,
    signal?: AbortSignal,
  ): Promise<MarketSnapshot> {
    await this.guard(signal);
    const config = DEVNET_MARKETS.find(
      (g) => g.catalogId === id || g.market === id,
    );
    if (!config) throw new Error("Unknown reviewed V1 game market.");
    const custody = V1_SEEDS.map((s) => pda(s, key(config.market))[0]);
    const keys = [
      pda("game-protocol-v1")[0],
      config.market,
      config.mint,
      ...custody,
      CLOCK,
      ...(wallet ? [wallet] : []),
    ];
    const [{ accounts: a, slot }, rent] = await Promise.all([
      this.accounts(keys, 0n, signal),
      this.rent(41, signal),
    ]);
    const protocol = decodeProtocol(a[0]),
      market = decodeMarket(a[1], config),
      mintSupply = validateMint(a[2], market);
    let totalCustody = 0n;
    const tracked = [
      market.dexReady ? 0n : SALE_ALLOCATION - market.sold,
      market.dexReady ? 0n : LIQUIDITY_ALLOCATION,
      market.dexReady ? market.poolTokens : 0n,
    ];
    for (let i = 0; i < 3; i++) {
      const amount = tokenAmount(a[i + 3], config.market, config.mint);
      if (amount < tracked[i])
        throw new Error("Underfunded protected token custody.");
      totalCustody = u64(totalCustody + amount);
    }
    if (totalCustody > mintSupply)
      throw new Error("Protected custody exceeds mint supply.");
    const trackedSol = [
        market.curveQuote,
        market.poolQuote,
        u64(
          market.platformAccrued -
            market.platformClaimed +
            market.creatorAccrued -
            market.creatorClaimed,
        ),
        market.buybackAccrued - market.buybackSpent,
      ],
      bumps = [
        market.quoteBump,
        market.poolQuoteBump,
        market.feesBump,
        market.buybackBump,
      ];
    for (let i = 0; i < 4; i++)
      validateSolVault(
        a[i + 6],
        custody[i + 3],
        config.market,
        V1_SEEDS[i + 3],
        bumps[i],
        rent,
        trackedSol[i],
      );
    const chainTime = i64At(required(a[10], SYSVAR, 40), 32);
    let tokenAccounts: { address: string; amount: bigint }[] = [],
      walletTokens = 0n,
      walletLamports = 0n,
      walletEligible = false,
      readSlot = slot;
    if (wallet) {
      const info = a[11];
      walletEligible =
        wallet !== SYSTEM &&
        onCurve(wallet) &&
        (!info ||
          (info.owner === SYSTEM &&
            !info.executable &&
            info.data.length === 0));
      walletLamports = info?.lamports ?? 0n;
      const result = record(
          await this.rpc(
            "getTokenAccountsByOwner",
            [
              wallet,
              { mint: config.mint },
              {
                encoding: "base64",
                commitment: "confirmed",
                minContextSlot: Number(slot),
              },
            ],
            signal,
          ),
        ),
        context = record(result.context);
      readSlot = rpcUnsigned(context.slot);
      if (
        readSlot < slot ||
        !Array.isArray(result.value) ||
        result.value.length > 128
      )
        throw new Error("Holder accounts are stale or incomplete.");
      const seen = new Set<string>();
      tokenAccounts = result.value.map((entry) => {
        const item = record(entry);
        if (typeof item.pubkey !== "string" || seen.has(item.pubkey))
          throw new Error("Duplicate or malformed holder account.");
        key(item.pubkey);
        seen.add(item.pubkey);
        const amount = tokenAmount(
          decodeRpcAccount(item.account),
          wallet,
          config.mint,
        );
        walletTokens = u64(walletTokens + amount);
        return { address: item.pubkey, amount };
      });
      if (walletTokens > mintSupply)
        throw new Error("Holder balance exceeds mint supply.");
    }
    return Object.freeze({
      ...this.base(readSlot, chainTime, wallet),
      kind: "market",
      config,
      market,
      protocol,
      mintSupply,
      walletTokens,
      walletLamports,
      walletEligible,
      tokenAccounts: Object.freeze(tokenAccounts),
      stage: marketStage(market, chainTime),
    });
  }
  async readWelcome(
    wallet: string | null = null,
    signal?: AbortSignal,
  ): Promise<WelcomeSnapshot> {
    await this.guard(signal);
    const c = WELCOME_PACK,
      receipt = wallet
        ? pda("welcome-claim", key(c.campaign), key(wallet))[0]
        : null;
    const [{ accounts: a, slot }, receiptRent, sponsorFloor] =
      await Promise.all([
        this.accounts(
          [c.campaign, c.treasury, CLOCK, ...(receipt ? [receipt] : [])],
          0n,
          signal,
        ),
        this.rent(113, signal),
        this.rent(0, signal),
      ]);
    const joined = new Uint8Array(bytes("plemu-welcome-v1").length + 192);
    joined.set(bytes("plemu-welcome-v1"));
    c.games.forEach((g, i) =>
      joined.set(
        unhex(g.contentHash),
        bytes("plemu-welcome-v1").length + i * 32,
      ),
    );
    const digest = hex(await sha256(joined)),
      campaign = decodeWelcome(a[0], c, digest),
      sponsor = a[1];
    if (sponsor) required(sponsor, SYSTEM, 0);
    if (receiptRent === 0n)
      throw new Error("Welcome receipt rent unavailable.");
    let alreadyClaimed = false,
      prefunded = 0n;
    if (receipt) {
      const record = optional(a[3]);
      if (record) {
        const d = required(record, PROGRAM, 113),
          disc = (await sha256(bytes("account:WelcomeClaim"))).slice(0, 8);
        if (
          hex(d.slice(0, 8)) !== hex(disc) ||
          hex(d.slice(8, 40)) !== hex(key(c.campaign)) ||
          hex(d.slice(40, 72)) !== hex(key(wallet!)) ||
          hex(d.slice(72, 104)) !== digest ||
          i64At(d, 104) <= 0n ||
          campaign.claimed === 0n
        )
          throw new Error("Welcome receipt identity or stock mismatch.");
        checkReceipt(receipt, d[112], c.campaign, wallet!);
        alreadyClaimed = true;
      } else prefunded = a[3]?.lamports ?? 0n;
    }
    const needed = prefunded >= receiptRent ? 0n : receiptRent - prefunded,
      balance = sponsor?.lamports ?? 0n,
      available =
        alreadyClaimed ||
        (campaign.claimed < campaign.maxClaims &&
          (needed === 0n ||
            (balance >= needed &&
              (balance === needed || balance - needed >= sponsorFloor))));
    return Object.freeze({
      ...this.base(slot, i64At(required(a[2], SYSVAR, 40), 32), wallet),
      kind: "welcome",
      config: c,
      capacity: campaign.maxClaims,
      claimed: campaign.claimed,
      alreadyClaimed,
      available,
      receipt,
      receiptRent,
      sponsorLamports: balance,
    });
  }
  async readPack(
    id: string,
    wallet: string | null = null,
    signal?: AbortSignal,
  ): Promise<PackSnapshot> {
    await this.guard(signal);
    const config = DEVNET_PACKS.find(
      (p) => p.rosterKey === id || p.pack === id,
    );
    if (!config) throw new Error("Unknown active V2 pack; V4 is dormant.");
    const playerAddress = wallet
      ? pda("pack-player-v2", key(config.pack), key(wallet))[0]
      : null;
    const { accounts: a, slot } = await this.accounts(
        [
          config.pack,
          CLOCK,
          VRF,
          VRF_QUEUE,
          ...(playerAddress ? [playerAddress] : []),
        ],
        0n,
        signal,
      ),
      pool = decodePool(a[0], config),
      chainTime = i64At(required(a[1], SYSVAR, 40), 32);
    if (
      !a[2]?.executable ||
      ![
        "BPFLoaderUpgradeab1e11111111111111111111111",
        "BPFLoader2111111111111111111111111111111111",
      ].includes(a[2].owner)
    )
      throw new Error("Pinned VRF program is not executable.");
    required(a[3], VRF);
    const player =
      playerAddress && optional(a[4])
        ? decodePlayer(a[4], playerAddress, config.pack, wallet!)
        : null;
    const drawAddress =
      player && player.nextNonce > 0n
        ? pda(
            "pack-draw-v2",
            key(playerAddress!),
            uint64(player.nextNonce - 1n),
          )[0]
        : null;
    const vaults = config.games.map(
        (g) => pda("pack-tokens-v2", key(config.pack), key(g.mint))[0],
      ),
      receipts = wallet
        ? config.games.map(
            (g) => pda("game-access", key(g.market), key(wallet))[0],
          )
        : [],
      markets = config.games.map((g) => g.market);
    const inventory = [
      ...vaults,
      ...receipts,
      ...markets,
      ...(drawAddress ? [drawAddress] : []),
    ];
    const [stock, drawRent, playerRent] = await Promise.all([
      this.accounts(inventory, slot, signal),
      this.rent(176, signal),
      player ? Promise.resolve(0n) : this.rent(90, signal),
    ]);
    let available = pool.tokenBonus > 0n ? (1n << 64n) - 1n : 0n,
      ownedMask = 0;
    for (let i = 0; i < pool.count; i++) {
      const token = optional(stock.accounts[i]),
        amount = token
          ? tokenAmount(token, config.pack, config.games[i].mint)
          : 0n;
      if (amount / pool.tokenBonus < available)
        available = amount / pool.tokenBonus;
      validateLegacyMarket(
        stock.accounts[pool.count + receipts.length + i],
        config,
        i,
      );
      if (wallet && optional(stock.accounts[pool.count + i])) {
        validateAccess(
          stock.accounts[pool.count + i],
          receipts[i],
          config.games[i].market,
          wallet,
          config.games[i].contentHash,
        );
        ownedMask |= 1 << i;
      }
    }
    const draw = drawAddress
        ? decodeDraw(
            stock.accounts[inventory.length - 1],
            drawAddress,
            pool,
            config,
            player!,
            playerAddress!,
            wallet!,
          )
        : null,
      status = draw ? (draw.status >= 4 ? draw.status - 4 : draw.status) : null,
      canRefund = !!(
        player?.pending &&
        status === 0 &&
        chainTime > draw!.expiresAt
      ),
      rewards =
        draw && (status === 1 || status === 2)
          ? Array.from(draw.resultIndices)
              .slice(0, draw.resultCount)
              .map((i) => config.games[i])
          : [];
    let phase: PackPhase = "not-started";
    if (draw) {
      phase =
        status === 3
          ? "refunded"
          : canRefund
            ? "refund-available"
            : status === 0
              ? "awaiting-randomness"
              : status === 1
                ? "awaiting-delivery"
                : rewards.every(
                      (g) => (ownedMask & (1 << config.games.indexOf(g))) !== 0,
                    )
                  ? "delivered"
                  : "verifying-delivery";
    }
    return Object.freeze({
      ...this.base(stock.slot, chainTime, wallet),
      kind: "pack",
      config,
      pool,
      player,
      playerAddress,
      draw,
      drawAddress,
      ownedMask,
      currentReceiptMask: ownedMask,
      availableDraws:
        available > pool.pendingDraws ? available - pool.pendingDraws : 0n,
      phase,
      rewards: Object.freeze(rewards),
      canRefund,
      estimatedMaximumDebitLamports: u64(
        pool.price + 1_000_000n + 50_000n + drawRent + playerRent,
      ),
    });
  }
  async readTokenBalances(
    wallet: string,
    signal?: AbortSignal,
  ): Promise<TokenBalances> {
    await this.guard(signal);
    if (wallet === SYSTEM || !onCurve(wallet))
      throw new Error("An on-curve wallet is required for balances.");
    const catalog = [
        ...DEVNET_MARKETS,
        ...DEVNET_PACKS.flatMap((p) => p.games),
      ],
      assets = Array.from(new Map(catalog.map((g) => [g.mint, g])).values());
    const initial = await this.accounts(
        [wallet, ...assets.map((g) => g.mint)],
        0n,
        signal,
      ),
      owner = initial.accounts[0];
    if (owner) required(owner, SYSTEM, 0);
    assets.forEach((g, i) => {
      const d = required(initial.accounts[i + 1], TOKEN, 82);
      if (d[44] !== 6 || d[45] !== 1)
        throw new Error(
          "Configured token mint decimals or initialized state mismatch.",
        );
    });
    const response = record(
        await this.rpc(
          "getTokenAccountsByOwner",
          [
            wallet,
            { programId: TOKEN },
            {
              encoding: "base64",
              commitment: "confirmed",
              minContextSlot: Number(initial.slot),
            },
          ],
          signal,
        ),
      ),
      slot = rpcUnsigned(record(response.context).slot);
    if (
      slot < initial.slot ||
      !Array.isArray(response.value) ||
      response.value.length > 512
    )
      throw new Error(
        "Wallet token response is stale or exceeds the bounded account limit.",
      );
    const seen = new Set<string>(),
      balances = assets.map((g) => ({
        mint: g.mint,
        catalogId: g.catalogId,
        title: g.title,
        symbol: g.symbol,
        decimals: 6 as const,
        amount: 0n,
        tokenAccounts: [] as { address: string; amount: bigint }[],
      }));
    for (const entry of response.value) {
      const item = record(entry);
      if (typeof item.pubkey !== "string" || seen.has(item.pubkey))
        throw new Error("Malformed or duplicate wallet token account.");
      key(item.pubkey);
      seen.add(item.pubkey);
      const info = decodeRpcAccount(item.account),
        d = required(info, TOKEN, 165),
        asset = balances.find((g) => hex(key(g.mint)) === hex(d.slice(0, 32)));
      if (!asset) continue;
      const amount = tokenAmount(info, wallet, asset.mint);
      asset.amount = u64(asset.amount + amount);
      asset.tokenAccounts.push({ address: item.pubkey, amount });
    }
    return {
      cluster: "devnet",
      genesisHash: DEVNET_RELEASE.genesisHash,
      wallet,
      readSlot: slot,
      readAtMs: Date.now(),
      nativeLamports: owner?.lamports ?? 0n,
      balances,
    };
  }
  async revalidatePlan(
    plan: InstructionPlan,
    signal?: AbortSignal,
  ): Promise<InstructionPlan> {
    assertFreshPlan(plan);
    let next: InstructionPlan;
    switch (plan.kind) {
      case "market-buy": {
        const source = plan.source as MarketSnapshot,
          fresh = await this.readMarket(
            source.config.catalogId,
            plan.wallet,
            signal,
          );
        next = planBuy(fresh, plan.quote!.tokens, 0);
        if (next.maximumDebitLamports > plan.maximumDebitLamports)
          throw new Error("Market quote changed; review a fresh preview.");
        return {
          ...next,
          maximumDebitLamports: plan.maximumDebitLamports,
          instructions: plan.instructions,
        };
      }
      case "market-sell": {
        const source = plan.source as MarketSnapshot,
          fresh = await this.readMarket(
            source.config.catalogId,
            plan.wallet,
            signal,
          );
        next = planSell(fresh, plan.quote!.tokens, 0);
        if (next.minimumReceiveLamports < plan.minimumReceiveLamports)
          throw new Error("Market quote changed; review a fresh preview.");
        if (
          next.instructions[0].accounts[3].address !==
          plan.instructions[0].accounts[3].address
        )
          throw new Error("Sale source account changed; review again.");
        return {
          ...next,
          minimumReceiveLamports: plan.minimumReceiveLamports,
          instructions: plan.instructions,
        };
      }
      case "welcome-claim":
        return planWelcome(await this.readWelcome(plan.wallet, signal));
      case "faucet-claim": {
        if (plan.source.kind !== "faucet")
          throw new Error("Invalid faucet preview source.");
        return revalidateFaucetPlan(
          { ...plan, kind: "faucet-claim", source: plan.source },
          { transport: this.rpc, signal },
        );
      }
      case "market-creator-fees":
      case "market-platform-fees":
      case "market-observe":
      case "market-stage":
      case "market-buyback":
      case "market-license": {
        const source = plan.source as MarketSnapshot;
        const fresh = await this.readMarket(
          source.config.catalogId,
          plan.wallet,
          signal,
        );
        next = planMarketOperation(fresh, plan.kind, plan.operationAmount);
        if (!sameInstructions(next, plan))
          throw new Error(
            "Market operation changed. Refresh and review its new state.",
          );
        return next;
      }
      default: {
        const source = plan.source as PackSnapshot,
          fresh = await this.readPack(
            source.config.rosterKey,
            plan.wallet,
            signal,
          );
        next =
          plan.kind === "pack-request"
            ? planPackRequest(fresh)
            : plan.kind === "pack-claim"
              ? planPackClaim(fresh)
              : planPackRefund(fresh);
        if (!sameInstructions(next, plan))
          throw new Error("Pack state changed; review a fresh preview.");
        return next;
      }
    }
  }
}
function checkReceipt(
  address: string,
  bump: number,
  campaign: string,
  wallet: string,
) {
  const [expected, b] = pda("welcome-claim", key(campaign), key(wallet));
  if (address !== expected || bump !== b)
    throw new Error("Welcome claim canonical bump mismatch.");
}
function sameInstructions(a: InstructionPlan, b: InstructionPlan): boolean {
  return (
    a.instructions.length === b.instructions.length &&
    a.instructions.every(
      (ix, i) =>
        ix.programAddress === b.instructions[i].programAddress &&
        hex(ix.data) === hex(b.instructions[i].data) &&
        JSON.stringify(ix.accounts) ===
          JSON.stringify(b.instructions[i].accounts),
    )
  );
}
