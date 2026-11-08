import type { InstructionPlan, MarketSnapshot, MarketOperation } from "./types";
import { buildInstructionPlan, validateMarketSnapshot } from "./plans";
import { ceil, formatUnits, splitFee, u64 } from "./math";
import { key, meta, pda, instruction, TOKEN } from "./wire";
import {
  getClaimGameCreatorFeesV1InstructionDataEncoder,
  getClaimGamePlatformFeesV1InstructionDataEncoder,
  getObserveGameMarketV1InstructionDataEncoder,
  getAdvanceGameStageV1InstructionDataEncoder,
  getExecuteGameBuybackV1InstructionDataEncoder,
  getCheckGameLicenseV1InstructionDataEncoder,
} from "./generated/instruction-data";

/** Seeker's existing advanced tools. Every operation remains a separate wallet approval. */
export function planMarketOperation(
  snapshot: MarketSnapshot,
  kind: MarketOperation,
  requestedAmount?: bigint,
): InstructionPlan {
  validateMarketSnapshot(snapshot);
  const m = snapshot.market,
    wallet = snapshot.wallet!,
    market = snapshot.config.market;
  const vault = (seed: string) => pda(seed, key(market))[0];
  let ix,
    summary: string[],
    receive = 0n,
    amount = requestedAmount;
  switch (kind) {
    case "market-creator-fees":
    case "market-platform-fees": {
      const platform = kind === "market-platform-fees";
      const available = platform
        ? m.platformAccrued - m.platformClaimed
        : m.creatorAccrued - m.creatorClaimed;
      const authority = platform ? snapshot.protocol.authority : m.creator;
      const recipient = platform ? snapshot.protocol.platform : m.creator;
      amount = u64(amount ?? available);
      if (wallet !== authority || amount === 0n || amount > available)
        throw new Error(
          "The connected wallet cannot claim this amount of accrued fees.",
        );
      const encoder = platform
        ? getClaimGamePlatformFeesV1InstructionDataEncoder()
        : getClaimGameCreatorFeesV1InstructionDataEncoder();
      ix = instruction(encoder.encode({ amount }), [
        meta(wallet, false, true),
        meta(pda("game-protocol-v1")[0]),
        meta(market, true),
        meta(vault("game-fees-v1"), true),
        meta(recipient, true),
      ]);
      summary = [
        `Claim ${formatUnits(amount)} Devnet SOL in ${platform ? "platform" : "creator"} fees.`,
        `Recipient: ${recipient}. Your wallet pays only the network fee.`,
      ];
      receive = recipient === wallet ? amount : 0n;
      break;
    }
    case "market-observe":
      if (!m.dexReady)
        throw new Error(
          "A live protocol liquidity pool is required for an observation.",
        );
      ix = instruction(
        getObserveGameMarketV1InstructionDataEncoder().encode({}),
        [meta(market, true)],
      );
      summary = [
        "Update this Devnet market’s onchain price observation. No trade or personal buyback payment.",
        "Your wallet pays the network fee. The time-weighted observation still needs its onchain interval.",
      ];
      break;
    case "market-stage":
      ix = instruction(
        getAdvanceGameStageV1InstructionDataEncoder().encode({}),
        [meta(market, true)],
      );
      summary = [
        "Synchronize this market’s lifecycle stage with the confirmed onchain clock and conditions.",
        "This does not change the lifecycle rules. Your wallet pays the network fee.",
      ];
      break;
    case "market-license": {
      const accounts = [...snapshot.tokenAccounts]
        .sort((a, b) =>
          a.amount > b.amount
            ? -1
            : a.amount < b.amount
              ? 1
              : a.address.localeCompare(b.address),
        )
        .slice(0, 16);
      const total = accounts.reduce((sum, a) => u64(sum + a.amount), 0n);
      if (
        wallet === snapshot.protocol.platform ||
        !accounts.length ||
        total < m.licenseThreshold ||
        total > snapshot.mintSupply
      )
        throw new Error(
          "Hold the required game-token balance across at most 16 wallet-owned accounts to request this proof.",
        );
      ix = instruction(
        getCheckGameLicenseV1InstructionDataEncoder().encode({}),
        [
          meta(wallet, false, true),
          meta(pda("game-protocol-v1")[0]),
          meta(market),
          meta(snapshot.config.mint),
          ...accounts.map((a) => meta(a.address)),
        ],
      );
      summary = [
        `Check ${formatUnits(total, 6)} ${snapshot.config.symbol} tokens against the protocol threshold ${formatUnits(m.licenseThreshold, 6)}.`,
        "This is an onchain holding proof, not a copyright license or game purchase. It does not gate the beta library. Your wallet pays the network fee.",
      ];
      break;
    }
    case "market-buyback": {
      const available = u64(m.buybackAccrued - m.buybackSpent);
      amount = u64(
        amount ?? (available < m.buybackMaximum ? available : m.buybackMaximum),
      );
      if (
        !m.dexReady ||
        amount < m.buybackMinimum ||
        amount > m.buybackMaximum ||
        amount > available ||
        m.twapTokensPerQuote <= 0n ||
        m.twapObservedAt <= 0n ||
        snapshot.chainTime < m.twapObservedAt ||
        snapshot.chainTime - m.twapObservedAt > 300n
      )
        throw new Error(
          "Refresh a funded buyback balance and a completed recent price observation first.",
        );
      const principal = u64((amount * 10_000n) / 10_125n);
      const reference = u64(
        (principal * m.twapTokensPerQuote) / 1_000_000_000_000n,
      );
      const minimum = u64(
        ceil(reference * BigInt(10_000 - m.buybackSlippageBps), 10_000n),
      );
      const output = u64(
        (m.poolTokens * principal) / (m.poolQuote + principal),
      );
      const debit = u64(principal + splitFee(principal, true).total);
      if (
        reference === 0n ||
        minimum === 0n ||
        output < minimum ||
        output >= m.poolTokens ||
        debit < m.buybackMinimum ||
        debit > m.buybackMaximum ||
        debit > available
      )
        throw new Error(
          "The buyback exceeds its dedicated budget or immutable price protection.",
        );
      ix = instruction(
        getExecuteGameBuybackV1InstructionDataEncoder().encode({
          budgetQuote: amount,
          minTokensOut: minimum,
        }),
        [
          meta(wallet, false, true),
          meta(market, true),
          meta(snapshot.config.mint, true),
          meta(vault("game-pool-v1"), true),
          meta(vault("game-pool-quote-v1"), true),
          meta(vault("game-fees-v1"), true),
          meta(vault("game-buyback-v1"), true),
          meta(TOKEN),
        ],
      );
      summary = [
        `Use up to ${formatUnits(amount)} Devnet SOL from the protocol’s dedicated buyback vault, with at least ${formatUnits(minimum, 6)} tokens burned.`,
        "The buyback uses protocol funds, not your trade balance. Your wallet pays the network fee. The onchain observation and price protections remain enforced.",
      ];
      break;
    }
    default:
      throw new Error("Unknown market operation.");
  }
  return Object.freeze({
    ...buildInstructionPlan(snapshot, kind, [ix], summary, 0n, receive),
    ...(amount === undefined ? {} : { operationAmount: amount }),
  });
}
