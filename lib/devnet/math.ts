import type { FeeSplit, MarketSnapshot, TradeQuote } from "./types";
export const U64_MAX = (1n << 64n) - 1n;
export const SALE_ALLOCATION = 800_000_000_000_000n;
export const LIQUIDITY_ALLOCATION = 200_000_000_000_000n;
export const SUPPLY = 1_000_000_000_000_000n;
export const LICENSE_THRESHOLD = 1_000_000_000_000n;
export function u64(value: bigint): bigint {
  if (typeof value !== "bigint" || value < 0n || value > U64_MAX)
    throw new Error("Amount exceeds unsigned 64-bit units.");
  return value;
}
export function ceil(n: bigint, d: bigint): bigint {
  if (n < 0n || d <= 0n) throw new Error("Invalid integer division.");
  return (n + d - 1n) / d;
}
export function curveReserve(target: bigint, sold: bigint): bigint {
  u64(target);
  u64(sold);
  if (target === 0n || sold > SALE_ALLOCATION)
    throw new Error("Invalid curve state.");
  return u64((target * sold) / (4n * SALE_ALLOCATION - 3n * sold));
}
export function splitFee(principal: bigint, pool: boolean): FeeSplit {
  u64(principal);
  const total = u64(ceil(principal * 125n, 10_000n)),
    platform = (total * (pool ? 10n : 60n)) / 100n,
    buyback = pool ? total / 10n : 0n;
  return { total, platform, buyback, creator: total - platform - buyback };
}
function quote(s: MarketSnapshot, buy: boolean, tokens: bigint): TradeQuote {
  u64(tokens);
  if (tokens === 0n) throw new Error("Enter a positive token amount.");
  const m = s.market,
    pool = m.dexReady;
  let principal: bigint;
  if (pool) {
    if (m.poolQuote === 0n || m.poolTokens === 0n)
      throw new Error("Pool liquidity is unavailable.");
    if (buy) {
      if (tokens >= m.poolTokens)
        throw new Error("Insufficient token liquidity.");
      principal = u64(ceil(m.poolQuote * tokens, m.poolTokens - tokens));
      u64(m.poolQuote + principal);
    } else {
      u64(m.poolTokens + tokens);
      principal = u64((m.poolQuote * tokens) / (m.poolTokens + tokens));
    }
  } else {
    if ((buy && tokens > SALE_ALLOCATION - m.sold) || (!buy && tokens > m.sold))
      throw new Error("Trade exceeds curve inventory.");
    const before = curveReserve(m.targetQuote, m.sold),
      after = curveReserve(
        m.targetQuote,
        buy ? m.sold + tokens : m.sold - tokens,
      );
    principal = buy ? after - before : before - after;
  }
  if (principal === 0n) throw new Error("Trade rounds to zero SOL.");
  const fees = splitFee(principal, pool);
  if (!buy && principal <= fees.total)
    throw new Error("Trade is too small after its fee.");
  const migrates = buy && !pool && m.sold + tokens === SALE_ALLOCATION;
  if (migrates && s.stage !== "alpha")
    throw new Error(
      "Final curve fill requires Alpha: five trades after graduation and one chain-clock hour.",
    );
  return {
    buy,
    poolTrade: pool,
    tokens,
    principalLamports: principal,
    fees,
    totalDebitLamports: buy ? u64(principal + fees.total) : 0n,
    netReceiveLamports: buy ? 0n : principal - fees.total,
    migrates,
  };
}
export const quoteBuyTokens = (s: MarketSnapshot, tokens: bigint) =>
  quote(s, true, tokens);
export const quoteSell = (s: MarketSnapshot, tokens: bigint) =>
  quote(s, false, tokens);
export function quoteBuyForBudget(
  s: MarketSnapshot,
  budget: bigint,
): TradeQuote {
  u64(budget);
  if (budget === 0n) throw new Error("Enter a positive SOL budget.");
  const principal = (budget * 10_000n) / 10_125n,
    m = s.market;
  let tokens: bigint;
  if (m.dexReady)
    tokens = (m.poolTokens * principal) / (m.poolQuote + principal);
  else {
    const bound = curveReserve(m.targetQuote, m.sold) + principal;
    const after =
      bound >= m.targetQuote
        ? SALE_ALLOCATION
        : ceil(
            4n * SALE_ALLOCATION * (bound + 1n),
            m.targetQuote + 3n * (bound + 1n),
          ) - 1n;
    tokens = after - m.sold;
  }
  const result = quote(s, true, tokens);
  if (result.totalDebitLamports > budget)
    throw new Error("Quote exceeds the inclusive SOL budget.");
  return result;
}
export function minimumOutput(output: bigint, bps = 100): bigint {
  u64(output);
  if (output === 0n || !Number.isInteger(bps) || bps < 0 || bps > 1000)
    throw new Error("Slippage must be 0–1000 basis points.");
  const minimum = (output * BigInt(10_000 - bps)) / 10_000n;
  return minimum > 0n ? minimum : 1n;
}
export function maximumTotal(total: bigint, bps = 100): bigint {
  u64(total);
  if (total === 0n || !Number.isInteger(bps) || bps < 0 || bps > 1000)
    throw new Error("Slippage must be 0–1000 basis points.");
  return u64(ceil(total * BigInt(10_000 + bps), 10_000n));
}
export function parseUnits(input: string, decimals = 9): bigint {
  if (
    !Number.isInteger(decimals) ||
    decimals < 0 ||
    decimals > 18 ||
    !/^\d+(?:\.\d+)?$/.test(input) ||
    input.length > 40
  )
    throw new Error("Enter a plain nonnegative decimal amount.");
  const [whole, fraction = ""] = input.split(".");
  if (fraction.length > decimals)
    throw new Error("Amount has too many decimal places.");
  return u64(
    BigInt(whole) * 10n ** BigInt(decimals) +
      BigInt(fraction.padEnd(decimals, "0") || "0"),
  );
}
export function formatUnits(value: bigint, decimals = 9): string {
  u64(value);
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 18)
    throw new Error("Invalid decimals.");
  if (decimals === 0) return value.toString();
  const scale = 10n ** BigInt(decimals),
    fraction = (value % scale)
      .toString()
      .padStart(decimals, "0")
      .replace(/0+$/, "");
  return `${value / scale}${fraction ? "." + fraction : ""}`;
}
