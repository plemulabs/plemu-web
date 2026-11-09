import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { Address } from "@solana/kit";
import type { ConfirmedFill } from "../../../lib/market-presentation";
import { MarketChart } from "../market-chart";
afterEach(cleanup);
function fill(
  slot: bigint,
  timestamp: bigint,
  principal: bigint,
): ConfirmedFill {
  return {
    kind: "trade",
    signature: "test",
    slot,
    blockTime: null,
    logIndex: 0,
    event: {
      market: "market" as Address,
      trader: "trader" as Address,
      buy: true,
      poolTrade: false,
      stage: 0,
      tokens: 1_000_000n,
      principal,
      fee: 0n,
      sold: 0n,
      quoteReserve: 0n,
      tokenReserve: 0n,
      timestamp,
    },
  };
}
describe("confirmed fill chart", () => {
  it("renders a useful empty state without inventing a price or line", () => {
    render(<MarketChart fills={[]} loading={false} />);
    expect(
      screen.getByRole("img", { name: /0 authenticated fills/ }),
    ).toBeTruthy();
    expect(document.querySelector('path[stroke="#b8dc2f"]')).toBeNull();
    expect(
      screen.getByText("Every market starts somewhere.", { exact: true }),
    ).toBeTruthy();
  });
  it("switches chart modes, preserves the partial-window qualification and supports keyboard fill inspection", () => {
    render(
      <MarketChart
        fills={[fill(1n, 0n, 10n), fill(2n, 86401n, 20n)]}
        loading={false}
      />,
    );
    const chart = screen.getByRole("img", { name: /Line chart of 2/ });
    fireEvent.keyDown(chart, { key: "ArrowLeft" });
    expect(document.querySelector(".mt-chart-readout")?.textContent).toContain(
      "1970-01-01 00:00:00 UTC",
    );
    fireEvent.click(screen.getByRole("button", { name: "Candles" }));
    expect(
      screen.getByText(/Sampled-fill candles aggregate only fetched fills/),
    ).toBeTruthy();
    fireEvent.change(
      screen.getByRole("combobox", { name: "Candle bucket duration" }),
      { target: { value: "60" } },
    );
    expect(
      screen.getByRole("img", { name: /Candlestick chart of 2/ }),
    ).toBeTruthy();
    expect(screen.getByText("Partial window", { exact: true })).toBeTruthy();
  });
  it("keeps timestamps inside a truthful domain even if event time moves backwards between slots", () => {
    render(
      <MarketChart
        fills={[fill(1n, 100n, 10n), fill(2n, 90n, 20n), fill(3n, 95n, 15n)]}
        loading={false}
      />,
    );
    const line =
      document.querySelector('path[stroke="#b8dc2f"]')?.getAttribute("d") || "";
    expect(line).toMatch(/^M24,/);
    expect(line).toContain("L788,");
  });
});
