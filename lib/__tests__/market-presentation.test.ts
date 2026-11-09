import { describe, expect, it } from "vitest";
import type { Address } from "@solana/kit";
import {
  candleGeometry,
  confirmedFills,
  eventTime,
  fillCandles,
  fillPrice,
  formatRatio,
  indicativePrice,
  marketBySlug,
  marketDirectory,
  marketHref,
  type ConfirmedFill,
} from "../market-presentation";
import type { MarketSnapshot } from "../devnet/types";
import { SALE_ALLOCATION } from "../devnet/math";

function fill(
  slot: bigint,
  time: bigint,
  principal: bigint,
  tokens = 1_000_000n,
): ConfirmedFill {
  return {
    kind: "trade",
    signature: `signature-${slot}`,
    slot,
    blockTime: null,
    logIndex: 0,
    event: {
      market: "market" as Address,
      trader: "trader" as Address,
      buy: true,
      poolTrade: true,
      stage: 4,
      tokens,
      principal,
      fee: 0n,
      sold: 0n,
      quoteReserve: 0n,
      tokenReserve: 0n,
      timestamp: time,
    },
  };
}
describe("market display data", () => {
  it("resolves only reviewed market slugs with one canonical route each", () => {
    expect(marketDirectory).toHaveLength(5);
    for (const item of marketDirectory) {
      expect(marketBySlug(item.game.slug)).toBe(item);
      expect(marketHref(item.config.catalogId)).toBe(
        `/market/${item.game.slug}`,
      );
    }
    expect(marketBySlug("not-a-market")).toBeUndefined();
    expect(marketBySlug("gba/goodboy-galaxy")).toBeUndefined();
  });
  it("formats large and tiny ratios without converting token quantities to Number", () => {
    expect(formatRatio((1n << 64n) - 1n, 1000n)).toBe("18446744073709551.615");
    expect(formatRatio(1n, 10n ** 15n)).toBe("<0.000000000001");
    expect(formatRatio(10n, 0n)).toBe("—");
    expect(formatRatio(-1n, 2n)).toBe("—");
    expect(formatRatio(1n, 2n, 0)).toBe("<1");
  });
  it("converts lamports and six-decimal token units once, excluding fees", () => {
    const entry = fill(1n, 100n, 1_000_000_000n, 100_000_000n);
    entry.event.fee = 999_999_999n;
    expect(fillPrice(entry)).toBe("0.01");
  });
  it("sorts fills by confirmed slot/log order and removes non-priced events without mutating input", () => {
    const later = fill(3n, 110n, 200n);
    const earlier = fill(1n, 100n, 100n);
    const entries = [later, fill(2n, 105n, 0n), earlier];
    expect(confirmedFills(entries)).toEqual([earlier, later]);
    expect(entries[0]).toBe(later);
  });
  it("aggregates only actual fills, leaves gaps empty, and derives real OHLC values", () => {
    const entries = [
      fill(1n, 61n, 10n),
      fill(2n, 65n, 30n),
      fill(3n, 66n, 5n),
      fill(4n, 245n, 20n),
    ];
    const candles = fillCandles(entries, 60n);
    expect(candles.map((candle) => candle.time)).toEqual([60n, 240n]);
    expect(candles[0].open).toBe(10_000_000_000_000_000n);
    expect(candles[0].high).toBe(30_000_000_000_000_000n);
    expect(candles[0].low).toBe(5_000_000_000_000_000n);
    expect(candles[0].close).toBe(candles[0].low);
    expect(candles[0].fills).toHaveLength(3);
    expect(fillCandles(entries, 0n)).toEqual([]);
  });
  it("computes indicative pool/curve spot independently of executed fill history", () => {
    const snapshot = {
      market: {
        dexReady: true,
        poolQuote: 1_000_000_000n,
        poolTokens: 200_000_000_000_000n,
        targetQuote: 1_000_000_000n,
        sold: 0n,
      },
    } as MarketSnapshot;
    expect(indicativePrice(snapshot)).toBe("0.000000005");
    snapshot.market.dexReady = false;
    expect(indicativePrice(snapshot)).toBe(
      formatRatio(1_000_000_000n, 4n * SALE_ALLOCATION * 1000n),
    );
  });
  it("uses event time without substituting wall-clock time and rejects out-of-range dates", () => {
    expect(eventTime(0n)).toBe("00:00:00 UTC");
    expect(eventTime(-1n)).toBe("Unavailable");
    expect(eventTime(1n << 63n)).toBe("Unavailable");
  });
  it("keeps adjacent candle buckets distinct when the confirmed window also contains a large gap", () => {
    const candles = fillCandles(
      [0n, 60n, 120n, 180n, 86400n].map((time, index) =>
        fill(BigInt(index), time, BigInt(index + 1)),
      ),
      60n,
    );
    const layout = candleGeometry(candles, 60n);
    expect(layout.start).toBe(0n);
    expect(layout.end).toBe(86460n);
    for (let i = 0; i < layout.bars.length; i++) {
      const bar = layout.bars[i];
      expect(bar.center - bar.width / 2).toBeGreaterThan(0);
      expect(bar.center + bar.width / 2).toBeLessThan(764);
      if (i)
        expect(
          layout.bars[i - 1].center + layout.bars[i - 1].width / 2,
        ).toBeLessThan(bar.center - bar.width / 2);
    }
    expect(layout.bars[4].center - layout.bars[3].center).toBeGreaterThan(700);
  });
});
