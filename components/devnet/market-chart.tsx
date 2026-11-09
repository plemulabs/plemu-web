"use client";

import { useId, useState } from "react";
import {
  candleGeometry,
  eventDate,
  eventTime,
  fillCandles,
  fillPrice,
  fillPriceUnits,
  formatRatio,
  type ConfirmedFill,
} from "../../lib/market-presentation";
import { Icon } from "./icon";

export function MarketChart({
  fills,
  loading,
}: {
  fills: readonly ConfirmedFill[];
  loading: boolean;
}) {
  const [mode, setMode] = useState<"line" | "candles">("line");
  const [interval, setInterval] = useState("300");
  const [cursor, setCursor] = useState<number | null>(null);
  const uid = useId().replace(/:/g, "");
  const visible = fills
    .slice(-256)
    .sort((a, b) =>
      a.event.timestamp < b.event.timestamp
        ? -1
        : a.event.timestamp > b.event.timestamp
          ? 1
          : 0,
    );
  const candles = fillCandles(visible, BigInt(interval));
  const candleLayout = candleGeometry(candles, BigInt(interval));
  const prices = visible.map(fillPriceUnits);
  const low = prices.reduce((a, b) => (a < b ? a : b), prices[0] || 0n);
  const high = prices.reduce((a, b) => (a > b ? a : b), prices[0] || 0n);
  const padding = (high - low) / 8n || high / 20n || 1n;
  const bottom = low > padding ? low - padding : 0n;
  const top = high + padding;
  const y = (price: bigint) =>
    26 + Number(((top - price) * 246_000n) / (top - bottom)) / 1000;
  const firstTime = visible[0]?.event.timestamp || 0n;
  const lastTime = visible.at(-1)?.event.timestamp || firstTime;
  const domainStart = mode === "candles" ? candleLayout.start : firstTime;
  const domainEnd = mode === "candles" ? candleLayout.end : lastTime;
  const x = (time: bigint, index: number, count: number) =>
    domainEnd > domainStart
      ? 24 +
        Number(((time - domainStart) * 764_000n) / (domainEnd - domainStart)) /
          1000
      : 24 + (index * 764) / Math.max(1, count - 1);
  const points = visible.map((fill, index) => ({
    x: x(fill.event.timestamp, index, visible.length),
    y: y(prices[index]),
  }));
  const selected =
    cursor === null ? null : visible[Math.min(cursor, visible.length - 1)];
  const selectedPoint =
    cursor === null ? null : points[Math.min(cursor, points.length - 1)];
  const line = points
    .map((point, index) => `${index ? "L" : "M"}${point.x},${point.y}`)
    .join(" ");
  const area =
    points.length > 1
      ? `${line} L${points.at(-1)!.x},292 L${points[0].x},292 Z`
      : "";
  function selectNearest(clientX: number, bounds: DOMRect) {
    if (!points.length) return;
    const position = ((clientX - bounds.left) / bounds.width) * 900;
    let nearest = 0;
    points.forEach((point, index) => {
      if (Math.abs(point.x - position) < Math.abs(points[nearest].x - position))
        nearest = index;
    });
    setCursor(nearest);
  }
  return (
    <figure className="mt-chart">
      <div className="mt-chart-tools">
        <span className="mt-chart-caption">
          <Icon name="market" size={16} /> Confirmed fills{" "}
          <span className="mt-small-tag">Partial window</span>
        </span>
        <div className="mt-chart-controls">
          {mode === "candles" && (
            <select
              aria-label="Candle bucket duration"
              value={interval}
              onChange={(event) => setInterval(event.target.value)}
            >
              <option value="60">1m buckets</option>
              <option value="300">5m buckets</option>
              <option value="3600">1h buckets</option>
            </select>
          )}
          <div role="group" aria-label="Chart display">
            <button
              aria-pressed={mode === "line"}
              onClick={() => setMode("line")}
            >
              Line
            </button>
            <button
              aria-pressed={mode === "candles"}
              onClick={() => setMode("candles")}
            >
              Candles
            </button>
          </div>
        </div>
      </div>
      <div className="mt-chart-readout" aria-live="polite">
        <strong>
          {selected
            ? fillPrice(selected)
            : visible.length
              ? fillPrice(visible[visible.length - 1])
              : "—"}
          <small> SOL / token</small>
        </strong>
        <span>
          {selected
            ? `${selected.event.buy ? "Buy" : "Sell"} fill · ${eventDate(selected.event.timestamp)} ${eventTime(selected.event.timestamp)}`
            : visible.length
              ? "Last fill in this confirmed window"
              : loading
                ? "Reading confirmed activity…"
                : "No confirmed fills loaded"}
        </span>
      </div>
      <div className={`mt-chart-stage${loading ? " mt-chart-loading" : ""}`}>
        <svg
          viewBox="0 0 900 322"
          role="img"
          tabIndex={visible.length ? 0 : undefined}
          aria-label={`${mode === "line" ? "Line" : "Candlestick"} chart of ${visible.length} authenticated fills in a partial confirmed window`}
          aria-describedby={`chart-help-${uid}`}
          onPointerMove={(event) =>
            selectNearest(
              event.clientX,
              event.currentTarget.getBoundingClientRect(),
            )
          }
          onPointerLeave={() => setCursor(null)}
          onBlur={() => setCursor(null)}
          onKeyDown={(event) => {
            if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
              event.preventDefault();
              setCursor((value) =>
                Math.max(
                  0,
                  Math.min(
                    visible.length - 1,
                    (value ?? visible.length - 1) +
                      (event.key === "ArrowRight" ? 1 : -1),
                  ),
                ),
              );
            }
          }}
        >
          <defs>
            <linearGradient id={`fill-${uid}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#b8dc2f" stopOpacity=".15" />
              <stop offset="1" stopColor="#b8dc2f" stopOpacity="0" />
            </linearGradient>
          </defs>
          {[26, 87, 149, 210, 272].map((value, index) => (
            <g key={value}>
              <path d={`M24 ${value}H790`} stroke="#ffffff09" />
              <text x="806" y={value + 4} className="mt-axis-label">
                {visible.length
                  ? formatRatio(
                      top - ((top - bottom) * BigInt(index)) / 4n,
                      10n ** 24n,
                    )
                  : "—"}
              </text>
            </g>
          ))}
          {[24, 177, 330, 483, 636, 789].map((value) => (
            <path key={value} d={`M${value} 26V272`} stroke="#ffffff05" />
          ))}
          {mode === "line" ? (
            <>
              {area && <path d={area} fill={`url(#fill-${uid})`} />}
              {points.length > 1 && (
                <path
                  d={line}
                  fill="none"
                  stroke="#b8dc2f"
                  strokeWidth="2"
                  vectorEffect="non-scaling-stroke"
                />
              )}
              {points.length > 0 && (
                <circle
                  cx={points.at(-1)!.x}
                  cy={points.at(-1)!.y}
                  r="3.5"
                  fill="#b8dc2f"
                />
              )}
            </>
          ) : (
            candleLayout.bars.map(({ candle, center: position, width }) => {
              const center = 24 + position;
              const color = candle.close >= candle.open ? "#b8dc2f" : "#ef8b86";
              return (
                <g key={candle.time.toString()}>
                  <path
                    d={`M${center} ${y(candle.high)}V${y(candle.low)}`}
                    stroke={color}
                    strokeWidth={Math.min(1.4, width * 0.7)}
                  />
                  <rect
                    x={center - width / 2}
                    y={Math.min(y(candle.open), y(candle.close))}
                    width={width}
                    height={Math.max(
                      1.5,
                      Math.abs(y(candle.open) - y(candle.close)),
                    )}
                    fill={color}
                  />
                </g>
              );
            })
          )}
          {selectedPoint && (
            <>
              <path
                d={`M${selectedPoint.x} 26V272M24 ${selectedPoint.y}H790`}
                stroke="#a5adb5"
                strokeDasharray="3 5"
              />
              <circle
                cx={selectedPoint.x}
                cy={selectedPoint.y}
                r="4"
                fill="#b8dc2f"
                stroke="#111417"
                strokeWidth="2"
              />
            </>
          )}
          {visible.length > 0 && (
            <>
              <text x="24" y="309" className="mt-axis-label">
                {eventDate(firstTime)} {eventTime(firstTime)}
              </text>
              <text x="788" y="309" textAnchor="end" className="mt-axis-label">
                {eventDate(lastTime)} {eventTime(lastTime)}
              </text>
            </>
          )}
        </svg>
        {!visible.length && (
          <div className="mt-chart-empty">
            <Icon name="market" size={34} />
            <strong>
              {loading
                ? "Finding the story onchain."
                : "Every market starts somewhere."}
            </strong>
            <p>
              {loading
                ? "Checking confirmed program events."
                : "Confirmed fills appear here after activity is available."}
            </p>
          </div>
        )}
        <span className="mt-chart-watermark" aria-hidden="true">
          plemu
        </span>
      </div>
      {visible.length > 0 && (
        <div className="mt-chart-mobile-scale">
          <span>
            {eventDate(firstTime)}
            <br />
            {eventTime(firstTime)}
          </span>
          <span>
            {eventDate(lastTime)}
            <br />
            {eventTime(lastTime)}
          </span>
        </div>
      )}
      <figcaption id={`chart-help-${uid}`}>
        SOL per whole token, excluding fees.{" "}
        {mode === "candles"
          ? "Sampled-fill candles aggregate only fetched fills; empty intervals are omitted, and order between transactions in the same slot is unresolved. "
          : "Each point is a fetched fill. "}
        This is a partial window
        {fills.length > 256 ? "; chart shows its latest 256 fills" : ""}, not
        complete price history.{" "}
        {visible.length > 0 &&
          "Focus the chart and use arrow keys to inspect fills."}
      </figcaption>
    </figure>
  );
}
