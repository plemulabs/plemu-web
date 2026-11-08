import { describe, it, expect } from "vitest";
import { Keypair } from "@solana/web3.js";
import captured from "./fixtures/market-operations-readonly.json";
import { planMarketOperation } from "../operations";
import {
  getClaimGameCreatorFeesV1InstructionDataDecoder,
  getExecuteGameBuybackV1InstructionDataDecoder,
} from "../generated/instruction-data";
import { ata } from "../wire";
import type { MarketSnapshot } from "../types";
function snapshot(): MarketSnapshot {
  const s = JSON.parse(JSON.stringify(captured), (_key, value) =>
    value && typeof value === "object" && "$bigint" in value
      ? BigInt(value.$bigint)
      : value && typeof value === "object" && "$bytes" in value
        ? Uint8Array.from(value.$bytes)
        : value,
  ) as MarketSnapshot;
  return { ...s, readAtMs: Date.now() };
}
describe("existing Seeker market operations", () => {
  it("binds a creator claim to the fixed creator recipient and available ledger balance", () => {
    const original = snapshot(),
      s = {
        ...original,
        wallet: original.market.creator,
        market: {
          ...original.market,
          creatorAccrued: 10_000n,
          creatorClaimed: 1_000n,
        },
      };
    s.market.totalFees =
      s.market.platformAccrued +
      s.market.creatorAccrued +
      s.market.buybackAccrued;
    const p = planMarketOperation(s, "market-creator-fees", 9_000n);
    expect(
      getClaimGameCreatorFeesV1InstructionDataDecoder().decode(
        p.instructions[0].data,
      ).amount,
    ).toBe(9_000n);
    expect(p.instructions[0].accounts[4].address).toBe(s.market.creator);
    expect(p.minimumReceiveLamports).toBe(9_000n);
    expect(() => planMarketOperation(s, "market-creator-fees", 9_001n)).toThrow(
      /cannot claim/,
    );
    expect(() =>
      planMarketOperation(
        { ...s, wallet: Keypair.generate().publicKey.toBase58() },
        "market-creator-fees",
        1n,
      ),
    ).toThrow(/cannot claim/);
  });
  it("sends platform claims to the configured treasury rather than assuming the authority receives them", () => {
    const original = snapshot(),
      destination = Keypair.generate().publicKey.toBase58();
    const s = {
      ...original,
      wallet: original.protocol.authority,
      protocol: {
        ...original.protocol,
        platform: destination as typeof original.protocol.platform,
      },
      market: {
        ...original.market,
        platformAccrued: 10_000n,
        platformClaimed: 0n,
      },
    };
    s.market.totalFees =
      s.market.platformAccrued +
      s.market.creatorAccrued +
      s.market.buybackAccrued;
    const p = planMarketOperation(s, "market-platform-fees", 5_000n);
    expect(p.instructions[0].accounts[4].address).toBe(destination);
    expect(p.minimumReceiveLamports).toBe(0n);
  });
  it("requires a pool for observations and retains a writable canonical market for lifecycle sync", () => {
    const s = snapshot();
    expect(() =>
      planMarketOperation(
        { ...s, market: { ...s.market, dexReady: false } },
        "market-observe",
      ),
    ).toThrow();
    const p = planMarketOperation(s, "market-stage");
    expect(p.instructions[0].accounts).toEqual([
      { address: s.config.market, isWritable: true, isSigner: false },
    ]);
    expect(p.maximumDebitLamports).toBe(0n);
  });
  it("excludes the platform treasury and enforces the holding-proof threshold", () => {
    const original = snapshot(),
      holder = Keypair.generate().publicKey.toBase58();
    const s = {
      ...original,
      wallet: holder,
      walletTokens: original.market.licenseThreshold,
      tokenAccounts: [
        {
          address: ata(holder, original.config.mint),
          amount: original.market.licenseThreshold,
        },
      ],
    };
    const p = planMarketOperation(s, "market-license");
    expect(p.instructions[0].accounts[0].address).toBe(holder);
    expect(p.instructions[0].accounts).toHaveLength(5);
    expect(() =>
      planMarketOperation(
        { ...s, wallet: s.protocol.platform },
        "market-license",
      ),
    ).toThrow(/required/);
    expect(() =>
      planMarketOperation(
        { ...s, tokenAccounts: [{ ...s.tokenAccounts[0], amount: 1n }] },
        "market-license",
      ),
    ).toThrow(/required/);
  });
  it("caps a buyback to dedicated funds, checks fresh TWAP, and never debits the caller's trade balance", () => {
    const original = snapshot();
    const s = {
      ...original,
      chainTime: 1000n,
      market: {
        ...original.market,
        dexReady: true,
        twapTokensPerQuote: 1_000_000_000_000n,
        twapObservedAt: 900n,
        poolQuote: 1_000_000_000n,
        poolTokens: 1_000_000_000_000n,
        buybackAccrued: 10_000_000n,
        buybackSpent: 0n,
        buybackMinimum: 1000n,
        buybackMaximum: 1_000_000n,
        buybackSlippageBps: 100,
      },
    };
    s.market.totalFees =
      s.market.platformAccrued +
      s.market.creatorAccrued +
      s.market.buybackAccrued;
    const p = planMarketOperation(s, "market-buyback");
    const data = getExecuteGameBuybackV1InstructionDataDecoder().decode(
      p.instructions[0].data,
    );
    expect(data.budgetQuote).toBe(1_000_000n);
    expect(data.minTokensOut).toBeGreaterThan(0n);
    expect(p.maximumDebitLamports).toBe(0n);
    expect(() =>
      planMarketOperation({ ...s, chainTime: 1201n }, "market-buyback"),
    ).toThrow(/recent/);
    expect(() => planMarketOperation(s, "market-buyback", 10_000_001n)).toThrow(
      /funded/,
    );
  });
});
