import { describe, it, expect, vi, afterEach } from "vitest";
import { address, getBase58Decoder } from "@solana/kit";
import { createHash } from "node:crypto";
import {
  DEVNET_FAUCETS,
  FAUCET_AUTHORITY,
  readFaucet,
  planFaucetClaim,
  revalidateFaucetPlan,
} from "../faucet";
import { decodeMarketHistoryTransaction, readMarketHistory } from "../history";
import { DevnetClient } from "../client";
import { DEVNET_RELEASE, DEVNET_MARKETS } from "../release";
import { getTestFaucetEncoder } from "../generated/accounts/testFaucet";
import { getFaucetClaimEncoder } from "../generated/accounts/faucetClaim";
import { getGameTradeV1EventEncoder } from "../generated/events/gameTradeV1";
import {
  getClaimTestTokensInstructionDataEncoder,
  getCreateFaucetClaimInstructionDataEncoder,
} from "../generated/faucet-instruction-data";
import {
  CLOCK,
  key,
  pda,
  PROGRAM,
  SYSTEM,
  SYSVAR,
  TOKEN,
  uint64,
} from "../wire";
import type { MarketSnapshot, RpcTransport } from "../types";
const wallet = FAUCET_AUTHORITY,
  config = DEVNET_FAUCETS[0],
  loader = "BPFLoader2111111111111111111111111111111111";
const base64 = (bytes: ArrayLike<number>) =>
  Buffer.from(Uint8Array.from(bytes)).toString("base64");
const account = (
  bytes: ArrayLike<number>,
  owner = PROGRAM,
  executable = false,
) => ({
  owner,
  executable,
  lamports: 100_000_000,
  data: [base64(bytes), "base64"],
});
function fixture(
  options: {
    wrongGenesis?: boolean;
    badOwner?: boolean;
    badTag?: boolean;
    next?: bigint;
    badClaim?: boolean;
    empty?: boolean;
  } = {},
) {
  const vault = new Uint8Array(165);
  vault.set(key(config.mint));
  vault.set(key(config.faucet), 32);
  vault.set(uint64(options.empty ? 0n : 1_000_000_000_000n), 64);
  vault[108] = 1;
  const mint = new Uint8Array(82);
  mint.set(uint64(2_000_000_000_000n), 36);
  mint[44] = config.decimals;
  mint[45] = 1;
  const faucet = Uint8Array.from(
    getTestFaucetEncoder().encode({
      authority: address(FAUCET_AUTHORITY),
      mint: address(config.mint),
      vault: address(config.vault),
      amount: BigInt(config.amount),
      cooldown: 3600n,
      bump: pda("test-faucet", key(FAUCET_AUTHORITY), key(config.mint))[1],
    }),
  );
  if (options.badTag) faucet[0] ^= 1;
  const clock = new Uint8Array(40);
  new DataView(clock.buffer).setBigInt64(32, 10000n, true);
  const claim =
    options.next === undefined
      ? null
      : account(
          getFaucetClaimEncoder().encode({
            faucet: address(config.faucet),
            wallet: address(
              options.badClaim ? DEVNET_MARKETS[0].market : wallet,
            ),
            nextClaimAt: options.next,
            claims: 1n,
            bump: pda("faucet-claim", key(config.faucet), key(wallet))[1],
          }),
        );
  const calls: string[] = [];
  const rpc: RpcTransport = async (method) => {
    calls.push(method);
    if (method === "getGenesisHash")
      return options.wrongGenesis ? SYSTEM : DEVNET_RELEASE.genesisHash;
    if (method === "getMinimumBalanceForRentExemption") return 1_000_000;
    if (method === "getMultipleAccounts")
      return {
        context: { slot: 100 },
        value: [
          account([], loader, true),
          account([], loader, true),
          account(clock, SYSVAR),
          account(faucet, options.badOwner ? SYSTEM : PROGRAM),
          account(vault, TOKEN),
          account(mint, TOKEN),
          claim,
          null,
          account([], SYSTEM),
        ],
      };
    throw new Error("Unexpected RPC");
  };
  return { rpc, calls };
}
afterEach(() => vi.restoreAllMocks());
describe("current Seeker faucet wire and guarded reads", () => {
  it("matches the three visible native mocks and exact generated global discriminators", () => {
    expect(DEVNET_FAUCETS.map((x) => x.symbol)).toEqual([
      "mSOL",
      "mUSDC",
      "PLEMU",
    ]);
    for (const [name, encoder] of [
      ["create_faucet_claim", getCreateFaucetClaimInstructionDataEncoder()],
      ["claim_test_tokens", getClaimTestTokensInstructionDataEncoder()],
    ] as const) {
      expect(Uint8Array.from(encoder.encode({}))).toEqual(
        Uint8Array.from(
          createHash("sha256")
            .update("global:" + name)
            .digest()
            .subarray(0, 8),
        ),
      );
    }
  });
  it("plans first claim initialization, idempotent ATA and exact claim instruction without submitting", async () => {
    const { rpc, calls } = fixture(),
      snapshot = await readFaucet("mSOL", wallet, { transport: rpc }),
      plan = planFaucetClaim(snapshot);
    expect(snapshot.ready).toBe(true);
    expect(snapshot.accountRentLamports).toBe(2_000_000n);
    expect(plan.instructions).toHaveLength(3);
    expect(plan.instructions[0].accounts.map((x) => x.address)).toEqual([
      wallet,
      config.faucet,
      snapshot.claimAddress,
      SYSTEM,
    ]);
    expect(plan.instructions[2].accounts.map((x) => x.address)).toEqual([
      wallet,
      config.faucet,
      snapshot.claimAddress,
      config.mint,
      config.vault,
      snapshot.destination,
      TOKEN,
    ]);
    expect(plan.maximumDebitLamports).toBe(2_000_000n);
    expect(plan.summary.join(" ")).toContain("cannot pay Solana network fees");
    expect(calls.every((x) => x.startsWith("get"))).toBe(true);
    const refreshed = await revalidateFaucetPlan(plan, { transport: rpc });
    expect(refreshed.kind).toBe("faucet-claim");
    await expect(
      revalidateFaucetPlan(
        { ...plan, genesisHash: SYSTEM },
        { transport: rpc },
      ),
    ).rejects.toThrow();
  });
  it.each([
    { wrongGenesis: true },
    { badOwner: true },
    { badTag: true },
    { next: 20000n, badClaim: true },
  ])("rejects hostile network/account state", async (options) => {
    await expect(
      readFaucet("mSOL", wallet, { transport: fixture(options).rpc }),
    ).rejects.toThrow();
  });
  it("does not enable cooldown or empty inventory and rejects expired or changed-wallet snapshots", async () => {
    for (const options of [{ next: 10001n }, { empty: true }]) {
      const snapshot = await readFaucet("mSOL", wallet, {
        transport: fixture(options).rpc,
      });
      expect(snapshot.ready).toBe(false);
      expect(() => planFaucetClaim(snapshot)).toThrow();
    }
    const snapshot = await readFaucet("mSOL", wallet, {
      transport: fixture().rpc,
    });
    expect(() =>
      planFaucetClaim({ ...snapshot, readAtMs: Date.now() - 31000 }),
    ).toThrow();
    expect(() =>
      planFaucetClaim({ ...snapshot, wallet: DEVNET_MARKETS[0].market }),
    ).toThrow();
  });
});
const signature = getBase58Decoder().decode(new Uint8Array(64).fill(7)),
  market = DEVNET_MARKETS[0].market;
const trade = {
  market: address(market),
  trader: address(wallet),
  buy: true,
  poolTrade: false,
  stage: 0,
  tokens: 100n,
  principal: 20n,
  fee: 1n,
  sold: 100n,
  quoteReserve: 20n,
  tokenReserve: 1000n,
  timestamp: 9999n,
};
const eventLog =
  "Program data: " + base64(getGameTradeV1EventEncoder().encode(trade));
function tx(logs: string[], err: unknown = null) {
  return {
    slot: 100,
    blockTime: 10000,
    version: 1,
    transaction: {
      signatures: [signature],
      message: { accountKeys: [PROGRAM, market, SYSTEM] },
    },
    meta: { err, logMessages: logs },
  };
}
const logs = [
  `Program ${PROGRAM} invoke [1]`,
  eventLog,
  `Program ${PROGRAM} success`,
];
describe("bounded genuine invocation market events", () => {
  it("decodes exact canonical event bytes only in the actual program frame", () => {
    const entries = decodeMarketHistoryTransaction(
      tx(logs),
      market,
      signature,
      100n,
    );
    expect(entries).toHaveLength(1);
    expect(entries[0].kind).toBe("trade");
    expect(entries[0].event.market).toBe(market);
  });
  it("ignores spoofed nested data, text lookalikes, wrong market and failed transactions", () => {
    const nested = [
      `Program ${PROGRAM} invoke [1]`,
      `Program ${SYSTEM} invoke [2]`,
      eventLog,
      `Program ${SYSTEM} success`,
      `Program log: ${eventLog}`,
      `Program ${PROGRAM} success`,
    ];
    expect(
      decodeMarketHistoryTransaction(tx(nested), market, signature, 100n),
    ).toEqual([]);
    expect(
      decodeMarketHistoryTransaction(
        tx(logs, { InstructionError: [0, "Custom"] }),
        market,
        signature,
        100n,
      ),
    ).toEqual([]);
    const other =
      "Program data: " +
      base64(
        getGameTradeV1EventEncoder().encode({
          ...trade,
          market: address(DEVNET_MARKETS[1].market),
        }),
      );
    expect(
      decodeMarketHistoryTransaction(
        tx([logs[0], other, logs[2]]),
        market,
        signature,
        100n,
      ),
    ).toEqual([]);
  });
  it.each([
    [logs[0], eventLog],
    [...logs, "Log truncated"],
    [`Program ${PROGRAM} invoke [2]`, eventLog, logs[2]],
  ])("rejects truncated or invalid invocation transcript", (...lines) => {
    expect(() =>
      decodeMarketHistoryTransaction(
        tx(lines as string[]),
        market,
        signature,
        100n,
      ),
    ).toThrow();
  });
  it("rejects slot/signature mismatch", () => {
    expect(() =>
      decodeMarketHistoryTransaction(tx(logs), market, signature, 101n),
    ).toThrow();
    expect(() =>
      decodeMarketHistoryTransaction(
        {
          ...tx(logs),
          transaction: {
            signatures: ["wrong"],
            message: { accountKeys: [PROGRAM, market] },
          },
        },
        market,
        signature,
        100n,
      ),
    ).toThrow();
  });
  it("uses the initial verified market guard, caps confirmed transaction reads and marks partial history", async () => {
    const guard = vi
      .spyOn(DevnetClient.prototype, "readMarket")
      .mockResolvedValue({
        config: DEVNET_MARKETS[0],
        readSlot: 100n,
      } as MarketSnapshot);
    let reads = 0;
    const rpc: RpcTransport = async (method, params) => {
      if (method === "getSignaturesForAddress")
        return [
          { signature, slot: 100, err: null, confirmationStatus: "confirmed" },
        ];
      if (method === "getTransaction") {
        reads++;
        expect(params[1]).toEqual({
          encoding: "json",
          commitment: "confirmed",
          maxSupportedTransactionVersion: 1,
        });
        return tx(logs);
      }
      throw new Error("Unexpected RPC");
    };
    const history = await readMarketHistory(market, {
      transport: rpc,
      limit: 8,
    });
    expect(guard).toHaveBeenCalledWith(market, null, undefined);
    expect(history.entries).toHaveLength(1);
    expect(history.complete).toBe(false);
    expect(reads).toBe(1);
    await expect(
      readMarketHistory(market, { transport: rpc, limit: 13 }),
    ).rejects.toThrow();
  });
});
