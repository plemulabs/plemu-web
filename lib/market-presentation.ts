import catalog from "./browser-catalog.json";
import { DEVNET_MARKETS } from "./devnet/release";
import type { MarketHistoryEntry } from "./devnet/history";
import type { MarketSnapshot } from "./devnet/types";
import { SALE_ALLOCATION } from "./devnet/math";

export const marketDirectory = DEVNET_MARKETS.map((config) => ({
  config,
  game: catalog.games.find((game) => game.id === config.catalogId)!,
}));
export function marketBySlug(slug: string) {
  return marketDirectory.find(({ game }) => game.slug === slug);
}
export function marketHref(catalogId: string) {
  const item = marketDirectory.find(
    ({ config }) => config.catalogId === catalogId,
  );
  return item ? `/market/${item.game.slug}` : "/market";
}
/** Decimal display only; the ratio remains exact until truncation to the requested places. */
export function formatRatio(
  numerator: bigint,
  denominator: bigint,
  places = 12,
): string {
  if (
    numerator < 0n ||
    denominator <= 0n ||
    !Number.isInteger(places) ||
    places < 0 ||
    places > 24
  )
    return "—";
  const scale = 10n ** BigInt(places);
  const value = (numerator * scale) / denominator;
  if (value === 0n && numerator > 0n)
    return `<${places ? "0." + "0".repeat(places - 1) + "1" : "1"}`;
  const whole = value / scale;
  const fractional = (value % scale)
    .toString()
    .padStart(places, "0")
    .replace(/0+$/, "");
  return whole.toString() + (fractional ? "." + fractional : "");
}
export type ConfirmedFill = Extract<MarketHistoryEntry, { kind: "trade" }>;
export function confirmedFills(
  entries: readonly MarketHistoryEntry[],
): ConfirmedFill[] {
  return entries
    .filter(
      (entry): entry is ConfirmedFill =>
        entry.kind === "trade" &&
        entry.event.tokens > 0n &&
        entry.event.principal > 0n,
    )
    .slice()
    .sort((a, b) =>
      a.slot < b.slot ? -1 : a.slot > b.slot ? 1 : a.logIndex - b.logIndex,
    );
}
export function fillPrice(fill: ConfirmedFill) {
  return formatRatio(fill.event.principal, fill.event.tokens * 1000n);
}
export function fillPriceUnits(fill: ConfirmedFill): bigint {
  return (fill.event.principal * 10n ** 24n) / (fill.event.tokens * 1000n);
}
export type FillCandle = {
  time: bigint;
  open: bigint;
  high: bigint;
  low: bigint;
  close: bigint;
  fills: ConfirmedFill[];
};
export function fillCandles(
  fills: readonly ConfirmedFill[],
  interval: bigint,
): FillCandle[] {
  if (interval <= 0n) return [];
  const buckets = new Map<bigint, FillCandle>();
  for (const fill of fills) {
    const time = (fill.event.timestamp / interval) * interval;
    const price = fillPriceUnits(fill);
    const candle = buckets.get(time);
    if (candle) {
      candle.high = price > candle.high ? price : candle.high;
      candle.low = price < candle.low ? price : candle.low;
      candle.close = price;
      candle.fills.push(fill);
    } else
      buckets.set(time, {
        time,
        open: price,
        high: price,
        low: price,
        close: price,
        fills: [fill],
      });
  }
  return [...buckets.values()].sort((a, b) =>
    a.time < b.time ? -1 : a.time > b.time ? 1 : 0,
  );
}
export function candleGeometry(
  candles: readonly FillCandle[],
  interval: bigint,
  plotWidth = 764,
) {
  if (!candles.length || interval <= 0n)
    return { start: 0n, end: 0n, bars: [] };
  const start = candles[0].time;
  const end = candles[candles.length - 1].time + interval;
  const span = end - start;
  const units = BigInt(Math.round(plotWidth * 1_000_000));
  const spacing = Number((interval * units) / span) / 1_000_000;
  return {
    start,
    end,
    bars: candles.map((candle) => ({
      candle,
      center:
        Number(
          (((candle.time - start) * 2n + interval) * units) / (span * 2n),
        ) / 1_000_000,
      width: Math.min(18, spacing * 0.62),
    })),
  };
}
export function shortAddress(address: string) {
  return `${address.slice(0, 5)}…${address.slice(-4)}`;
}
export function eventTime(timestamp: bigint) {
  if (timestamp < 0n || timestamp > 8_640_000_000_000n) return "Unavailable";
  return (
    new Date(Number(timestamp) * 1000).toISOString().split("T")[1].slice(0, 8) +
    " UTC"
  );
}
export function eventDate(timestamp: bigint) {
  if (timestamp < 0n || timestamp > 8_640_000_000_000n) return "Unavailable";
  return new Date(Number(timestamp) * 1000).toISOString().split("T")[0];
}
export function indicativePrice(snapshot: MarketSnapshot) {
  const market = snapshot.market;
  if (market.dexReady)
    return formatRatio(market.poolQuote, market.poolTokens * 1000n);
  const denominator = 4n * SALE_ALLOCATION - 3n * market.sold;
  return formatRatio(
    market.targetQuote * 4n * SALE_ALLOCATION,
    denominator * denominator * 1000n,
  );
}
