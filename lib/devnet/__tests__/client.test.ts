import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { createHash } from "node:crypto";
import { getGameMarketV1Decoder } from "../generated/accounts/gameMarketV1";
import { getRandomPackV2Decoder } from "../generated/accounts/randomPackV2";
import { getPackPlayerV2Decoder } from "../generated/accounts/packPlayerV2";
import { getPackDrawV2Decoder } from "../generated/accounts/packDrawV2";
import {
  getBuyGameTokensV1InstructionDataEncoder,
  getRequestRandomPackV2InstructionDataEncoder,
  getClaimRandomPackV2InstructionDataEncoder,
  getRefundRandomPackV2InstructionDataEncoder,
} from "../generated/instruction-data";
import vectors from "./fixtures/market-sbf.json";
import wire from "./fixtures/pack-wire.json";
import livePack from "./fixtures/readonly-live-pack.json";
import { getPackPlayerV2Encoder } from "../generated/accounts/packPlayerV2";
import { getPackDrawV2Encoder } from "../generated/accounts/packDrawV2";
import { getRandomPackV2Encoder } from "../generated/accounts/randomPackV2";
import { CLOCK, i64At } from "../wire";
import {
  decodePool,
  decodePlayer,
  decodeDraw,
  decodeMarket,
  packResults,
  validateMarketConfig,
  validateMarketState,
} from "../validation";
import {
  quoteBuyTokens,
  quoteBuyForBudget,
  quoteSell,
  minimumOutput,
  maximumTotal,
  parseUnits,
  formatUnits,
  splitFee,
  curveReserve,
} from "../math";
import {
  DEVNET_MARKETS,
  DEVNET_PACKS,
  DEVNET_RELEASE,
  WELCOME_PACK,
} from "../release";
import {
  DevnetClient,
  decodeRpcAccount,
  rpcUnsigned,
  createReadTransport,
} from "../client";
import {
  hex,
  PROGRAM,
  SYSTEM,
  TOKEN,
  bytes,
  key,
  pda,
  uint64,
  meta,
  instruction,
} from "../wire";
import { assertFreshPlan, planBuy, planSell } from "../plans";
import type { MarketSnapshot, PackConfig, RpcAccount } from "../types";
const unbase64 = (s: string) =>
  Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const account = (data: Uint8Array, owner = PROGRAM): RpcAccount => ({
  data,
  owner,
  executable: false,
  lamports: 100_000_000n,
});
const base = {
  cluster: "devnet" as const,
  genesisHash: DEVNET_RELEASE.genesisHash,
  readSlot: 1n,
  readAtMs: Date.now(),
  chainTime: 100_000n,
  wallet: DEVNET_MARKETS[0].creator,
};
function marketSnapshot(
  data = vectors.steps[0].beforeMarketBase64,
): MarketSnapshot {
  const market = getGameMarketV1Decoder().decode(unbase64(data));
  return {
    ...base,
    readAtMs: Date.now(),
    kind: "market",
    config: DEVNET_MARKETS[0],
    market,
    protocol: {
      discriminator: new Uint8Array(8),
      version: 1,
      authority: market.creator,
      platform: market.creator,
      bump: 1,
    },
    mintSupply: 1_000_000_000_000_000n,
    walletTokens: 0n,
    walletLamports: 10_000_000_000_000n,
    walletEligible: true,
    tokenAccounts: [],
    stage: "alpha",
  };
}
describe("executed SBF market vectors", () => {
  for (const step of vectors.steps.filter(
    (s) => s.instruction.name !== "execute_game_buyback_v1",
  ))
    it(step.name, () => {
      const s = marketSnapshot(step.beforeMarketBase64),
        amount = BigInt(step.instruction.tokenAmount!),
        q =
          step.instruction.name === "buy_game_tokens_v1"
            ? quoteBuyTokens(s, amount)
            : quoteSell(s, amount);
      expect(q.principalLamports).toBe(BigInt(step.principal));
      expect(q.fees.total).toBe(BigInt(step.fee));
      expect(q.tokens).toBe(BigInt(step.tokens));
      const after = getGameMarketV1Decoder().decode(
        unbase64(step.afterMarketBase64),
      );
      expect(after.platformAccrued - s.market.platformAccrued).toBe(
        q.fees.platform,
      );
      expect(after.creatorAccrued - s.market.creatorAccrued).toBe(
        q.fees.creator,
      );
      expect(after.buybackAccrued - s.market.buybackAccrued).toBe(
        q.fees.buyback,
      );
    });
  it("retains exact bigint budgets, final atom, fee splits and restrictive slippage", () => {
    const s = marketSnapshot();
    for (const budget of [1n, 2n, 100n, 1_000_000n, 50_000_000n]) {
      try {
        expect(quoteBuyForBudget(s, budget).totalDebitLamports <= budget).toBe(
          true,
        );
      } catch (e) {
        expect(String(e)).toMatch(/zero|positive|small/);
      }
    }
    expect(curveReserve(100_000_000_000n, 800_000_000_000_000n)).toBe(
      100_000_000_000n,
    );
    for (const pool of [false, true]) {
      const f = splitFee(7n, pool);
      expect(f.platform + f.creator + f.buyback).toBe(f.total);
    }
    expect(maximumTotal(101n, 100)).toBe(103n);
    expect(minimumOutput(101n, 100)).toBe(99n);
    expect(() => minimumOutput(1n, 1001)).toThrow();
    expect(() => maximumTotal(1n, -1)).toThrow();
    expect(parseUnits("18446744073.709551615")).toBe((1n << 64n) - 1n);
    expect(formatUnits(parseUnits("0.000000001"))).toBe("0.000000001");
    expect(() => parseUnits("1e3")).toThrow();
    expect(() => parseUnits("18446744073.709551616")).toThrow();
  });
});
describe("existing V2 compiler-generated wire fixtures", () => {
  const config = {
    ...wire.config,
    progressPolicy: false,
    recoveryOnly: false,
  } as unknown as PackConfig;
  it("decodes exact checked pool/player/draw and independent request bytes", () => {
    const pool = decodePool(account(unbase64(wire.pool)), config),
      player = decodePlayer(
        account(unbase64(wire.playerState)),
        wire.player,
        config.pack,
        wire.wallet,
      ),
      draw = decodeDraw(
        account(unbase64(wire.drawState)),
        wire.draw,
        pool,
        config,
        player,
        wire.player,
        wire.wallet,
      );
    expect(draw.resultCount).toBe(3);
    expect(pool.price).toBe(50_000_000n);
    expect(
      hex(
        getRequestRandomPackV2InstructionDataEncoder().encode({
          nonce: 0n,
          maxPrice: pool.price,
          maxOracleFee: 1_000_000n,
        }),
      ),
    ).toBe(hex(unbase64(wire.request.data)));
    expect(hex(getClaimRandomPackV2InstructionDataEncoder().encode({}))).toBe(
      hex(unbase64(wire.claim.data)),
    );
    expect(hex(getRefundRandomPackV2InstructionDataEncoder().encode({}))).toBe(
      hex(unbase64(wire.refund.data)),
    );
    expect(
      packResults(pool, draw.eligibleMask, draw.randomness, false),
    ).toEqual(Array.from(draw.resultIndices));
  });
  it("rejects owner/discriminator/PDA, buyer, nonce and randomness forgery", () => {
    const pbytes = unbase64(wire.pool);
    expect(() => decodePool(account(pbytes, TOKEN), config)).toThrow(/owner/);
    const bad = pbytes.slice();
    bad[0] ^= 1;
    expect(() => decodePool(account(bad), config)).toThrow(/discriminator/);
    expect(() =>
      decodePool(account(pbytes), { ...config, pack: DEVNET_PACKS[0].pack }),
    ).toThrow(/PDA/);
    const pool = decodePool(account(pbytes), config),
      player = decodePlayer(
        account(unbase64(wire.playerState)),
        wire.player,
        config.pack,
        wire.wallet,
      );
    expect(() =>
      decodePlayer(
        account(unbase64(wire.playerState)),
        wire.player,
        config.pack,
        DEVNET_MARKETS[0].creator,
      ),
    ).toThrow(/buyer/);
    const draw = unbase64(wire.drawState);
    draw[139] = draw[140];
    expect(() =>
      decodeDraw(
        account(draw),
        wire.draw,
        pool,
        config,
        player,
        wire.player,
        wire.wallet,
      ),
    ).toThrow(/results/);
    expect(() =>
      decodeDraw(
        account(unbase64(wire.drawState)),
        wire.draw,
        pool,
        config,
        { ...player, nextNonce: 2n },
        wire.player,
        wire.wallet,
      ),
    ).toThrow();
  });
  it("preserves exact 50/35/15 progress counts and missing-first without replacement", () => {
    const pool = getRandomPackV2Decoder().decode(unbase64(wire.pool)),
      counts = [0, 0, 0];
    for (let n = 0; n < 10000; n++) {
      const r = new Uint8Array(32);
      new DataView(r.buffer).setUint32(0, n, true);
      const result = packResults(pool, 15, r, true);
      counts[result.length - 1]++;
      expect(new Set(result).size).toBe(result.length);
    }
    expect(counts).toEqual([5000, 3500, 1500]);
    for (let mask = 0; mask < 16; mask++)
      for (const roll of [0, 50, 85]) {
        const r = new Uint8Array(32);
        new DataView(r.buffer).setUint32(0, roll, true);
        const result = packResults(pool, mask, r, true),
          missing = [0, 1, 2, 3].filter((i) => mask & (1 << i));
        expect(result.filter((i) => mask & (1 << i)).length).toBe(
          Math.min(missing.length, result.length),
        );
      }
    expect(() =>
      packResults(pool, 15, new Uint8Array(32).fill(255), false),
    ).toThrow(/exhausted/);
  });
});
describe("reviewed configuration and malicious RPC defenses", () => {
  it("pins all actual five market, welcome and two active V2 identities, never V4", () => {
    expect(DEVNET_MARKETS).toHaveLength(5);
    DEVNET_MARKETS.forEach(validateMarketConfig);
    expect(DEVNET_PACKS.map((p) => [p.version, p.progressPolicy])).toEqual([
      [2, true],
      [2, true],
    ]);
    expect(WELCOME_PACK.games).toHaveLength(6);
    expect(() =>
      validateMarketConfig({
        ...DEVNET_MARKETS[0],
        market: DEVNET_MARKETS[1].market,
      }),
    ).toThrow();
  });
  it("rejects wrong network before any protocol read or plan", async () => {
    const methods: string[] = [];
    const c = new DevnetClient({
      transport: async (method) => {
        methods.push(method);
        return "wrong-cluster";
      },
    });
    await expect(c.readMarket(DEVNET_MARKETS[0].catalogId)).rejects.toThrow(
      /network/,
    );
    expect(methods).toEqual(["getGenesisHash"]);
    expect(() =>
      createReadTransport("https://api.mainnet-beta.solana.com"),
    ).toThrow(/Devnet/);
    expect(() =>
      createReadTransport("https://devnet.helius-rpc.com.evil.invalid"),
    ).toThrow();
  });
  it("rejects nonexecutable or wrong-owner program even on Devnet", async () => {
    const c = new DevnetClient({
      transport: async (method) =>
        method === "getGenesisHash"
          ? DEVNET_RELEASE.genesisHash
          : {
              context: { slot: 1 },
              value: [
                {
                  owner: SYSTEM,
                  executable: false,
                  lamports: 1,
                  data: ["", "base64"],
                },
              ],
            },
    });
    await expect(c.readWelcome()).rejects.toThrow(/executable/);
  });
  it("rejects unsafe numeric account fields and malformed data", () => {
    expect(() => rpcUnsigned(Number.MAX_SAFE_INTEGER + 1)).toThrow(/unsafe/);
    expect(() =>
      decodeRpcAccount({
        owner: PROGRAM,
        executable: false,
        lamports: 1,
        data: ["not base64", "base64"],
      }),
    ).toThrow(/base64/);
    expect(() => rpcUnsigned(-1)).toThrow();
  });
  it("rejects wrong-size/discriminator and invalid lifecycle market accounts", () => {
    expect(() =>
      decodeMarket(account(new Uint8Array(408)), DEVNET_MARKETS[0]),
    ).toThrow();
    const m = marketSnapshot().market;
    expect(() =>
      validateMarketState({ ...m, platformClaimed: m.platformAccrued + 1n }),
    ).toThrow();
    expect(() => validateMarketState({ ...m, dexReady: true })).toThrow();
  });
  it("rejects stale, future or wrong-network transaction previews", () => {
    const s = marketSnapshot(),
      mock = {
        source: { ...s, readAtMs: Date.now() - 31_000 },
        cluster: "devnet",
        genesisHash: base.genesisHash,
        wallet: s.wallet,
        expiresAtMs: Date.now() + 100,
      };
    expect(() => assertFreshPlan(mock as never)).toThrow(/Refresh/);
    expect(() =>
      assertFreshPlan({
        ...mock,
        source: { ...s, genesisHash: "wrong" },
      } as never),
    ).toThrow();
  });
  it("does not silently read or mutate any browser storage", () => {
    const source = readFileSync(
      resolve(process.cwd(), "lib/devnet/client.ts"),
      "utf8",
    );
    expect(source).not.toMatch(
      /localStorage|sessionStorage|sendTransaction|simulateTransaction|requestAirdrop/,
    );
  });
});

describe("captured read-only Devnet progress delivery and reload recovery", () => {
  function clientWith(
    patch?: (address: string, account: any, call: any) => any,
  ) {
    const calls: any[] = structuredClone(livePack.calls);
    let n = 0;
    return new DevnetClient({
      transport: async (method, params) => {
        const call = calls[n++];
        expect(method).toBe(call.method);
        expect(params).toEqual(call.params);
        if (patch && method === "getMultipleAccounts") {
          call.result.value = call.result.value.map((account: any, i: number) =>
            patch(call.params[0][i] as string, account, call),
          );
        }
        return call.result;
      },
    });
  }
  function encodeRecord(account: any, encoder: any, value: any) {
    return {
      ...account,
      data: [btoa(String.fromCharCode(...encoder.encode(value))), "base64"],
    };
  }
  it("restores delivered V3 progress draw from chain, not local storage or fulfilled randomness alone", async () => {
    const s = await clientWith().readPack(
      DEVNET_PACKS[0].rosterKey,
      livePack.wallet,
    );
    expect(s.draw?.status).toBe(6);
    expect(s.phase).toBe("delivered");
    expect(s.rewards.map((r) => r.catalogId)).toEqual([
      "gb/flappy-bird-gameboy",
    ]);
    expect(s.player?.pending).toBe(false);
    expect(s.drawAddress).toBeTruthy();
  });
  it.each([
    "awaiting-delivery",
    "verifying-delivery",
    "refund-available",
    "awaiting-randomness",
    "refunded",
  ] as const)(
    "classifies %s from verified draw state and actual receipts",
    async (phase) => {
      const config = DEVNET_PACKS[0],
        playerAddress = pda(
          "pack-player-v2",
          key(config.pack),
          key(livePack.wallet),
        )[0];
      let drawAddress = "";
      const snapshot = await clientWith((address, account, call) => {
        if (!account) return account;
        const data = unbase64(account.data[0]);
        if (
          address === config.pack &&
          [
            "awaiting-delivery",
            "refund-available",
            "awaiting-randomness",
          ].includes(phase)
        ) {
          const pool = getRandomPackV2Decoder().decode(data);
          return encodeRecord(account, getRandomPackV2Encoder(), {
            ...pool,
            pendingDraws: pool.pendingDraws + 1n,
          });
        }
        if (address === playerAddress) {
          const p = getPackPlayerV2Decoder().decode(data);
          drawAddress = pda(
            "pack-draw-v2",
            key(playerAddress),
            uint64(p.nextNonce - 1n),
          )[0];
          return encodeRecord(account, getPackPlayerV2Encoder(), {
            ...p,
            pending: !["verifying-delivery", "refunded"].includes(phase),
          });
        }
        if (
          phase === "verifying-delivery" &&
          DEVNET_PACKS[0].games.some(
            (g) =>
              address ===
              pda("game-access", key(g.market), key(livePack.wallet))[0],
          )
        )
          return null;
        if (address === drawAddress) {
          const d = getPackDrawV2Decoder().decode(data);
          if (phase === "awaiting-delivery")
            return encodeRecord(account, getPackDrawV2Encoder(), {
              ...d,
              status: 5,
            });
          if (
            ["refund-available", "awaiting-randomness", "refunded"].includes(
              phase,
            )
          ) {
            const first: any = livePack.calls.find(
              (c) =>
                c.method === "getMultipleAccounts" &&
                (c.params[0] as string[]).includes(CLOCK),
            );
            const clock = i64At(unbase64(first.result.value[1].data[0]), 32),
              requestedAt =
                phase === "awaiting-randomness" ? clock - 1n : d.requestedAt;
            return encodeRecord(account, getPackDrawV2Encoder(), {
              ...d,
              status: phase === "refunded" ? 7 : 4,
              resultCount: 0,
              resultIndices: new Uint8Array([255, 255, 255]),
              randomness: new Uint8Array(32),
              requestedAt,
              expiresAt: requestedAt + 600n,
            });
          }
        }
        return account;
      }).readPack(config.rosterKey, livePack.wallet);
      expect(snapshot.phase).toBe(phase);
      expect(snapshot.canRefund).toBe(phase === "refund-available");
    },
  );
  it("rejects stale second-read context and wrong reward account owner", async () => {
    await expect(
      clientWith((address, account, call) => {
        if (
          (call.params[0] as string[]).includes(DEVNET_PACKS[0].games[0].market)
        )
          call.result.context.slot = 0;
        return account;
      }).readPack(DEVNET_PACKS[0].rosterKey, livePack.wallet),
    ).rejects.toThrow(/stale/);
    await expect(
      clientWith((address, account) =>
        address === DEVNET_PACKS[0].games[0].market
          ? { ...account, owner: TOKEN }
          : account,
      ).readPack(DEVNET_PACKS[0].rosterKey, livePack.wallet),
    ).rejects.toThrow(/owner/);
  });
});

it("keeps compiler-generated decoders and release identities tied to pinned upstream sources", () => {
  const manifest = JSON.parse(
    readFileSync(
      resolve(process.cwd(), "lib/devnet/source-manifest.json"),
      "utf8",
    ),
  );
  expect(manifest.upstreamRepository).toBe(
    "https://github.com/plemulabs/plemu-skr",
  );
  expect(manifest.upstreamCommit).toBe(
    "c5a16e0a2745cc3d2fbb90f2e1a9fdb2ae07e3e7",
  );
  expect(manifest.files).toHaveLength(21);
  expect(
    new Set(manifest.files.map((entry: { path: string }) => entry.path)).size,
  ).toBe(21);
  for (const entry of manifest.files) {
    const bytes = readFileSync(resolve(process.cwd(), entry.path));
    expect(
      createHash("sha256").update(bytes).digest("hex"),
      entry.upstreamPath,
    ).toBe(entry.sha256);
  }
  const canonical = JSON.parse(
    readFileSync(
      resolve(
        process.cwd(),
        "lib/devnet/__tests__/fixtures/seeker-markets-v1.json",
      ),
      "utf8",
    ),
  );
  expect(DEVNET_MARKETS).toEqual(canonical.games);
});
