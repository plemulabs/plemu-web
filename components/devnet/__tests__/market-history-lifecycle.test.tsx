import React from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Address } from "@solana/kit";
import type { MarketHistory } from "../../../lib/devnet/history";
const state = vi.hoisted(() => ({ read: vi.fn() }));
vi.mock("../../../lib/devnet", async (original) => ({
  ...(await original<typeof import("../../../lib/devnet")>()),
  readMarketHistory: (...args: unknown[]) => state.read(...args),
}));
import { DevnetMarketHistory } from "../market-history";
function history(count = 1): MarketHistory {
  return {
    cluster: "devnet",
    genesisHash: "devnet",
    market: "market",
    readAtMs: 0,
    scannedSignatures: 12,
    skippedTransactions: 0,
    complete: false,
    entries: Array.from({ length: count }, (_, index) => ({
      kind: "trade",
      signature: `signature-${index}`,
      slot: BigInt(index),
      blockTime: null,
      logIndex: 0,
      event: {
        market: "market" as Address,
        trader: "trader" as Address,
        buy: true,
        poolTrade: false,
        stage: 0,
        tokens: 1_000_000n,
        principal: BigInt(index + 1) * 1_000_000_000n,
        fee: 6789n,
        sold: 0n,
        quoteReserve: 0n,
        tokenReserve: 0n,
        timestamp: BigInt(index) * 86400n,
      },
    })),
  };
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
beforeEach(() => {
  state.read.mockReset();
  state.read.mockResolvedValue(history());
});
afterEach(cleanup);
describe("confirmed market activity lifecycle", () => {
  it("cancels old market history and rejects its late completion", async () => {
    const old = deferred<MarketHistory>();
    const current = deferred<MarketHistory>();
    state.read
      .mockReturnValueOnce(old.promise)
      .mockReturnValueOnce(current.promise);
    const view = render(<DevnetMarketHistory id="market-A" />);
    const signal = state.read.mock.calls[0][1].signal as AbortSignal;
    view.rerender(<DevnetMarketHistory id="market-B" />);
    expect(signal.aborted).toBe(true);
    await act(async () => current.resolve(history()));
    expect(document.querySelectorAll("tbody tr")).toHaveLength(1);
    await act(async () => old.resolve(history(13)));
    expect(document.querySelectorAll("tbody tr")).toHaveLength(1);
    expect(state.read.mock.calls.map((args) => args[0])).toEqual([
      "market-A",
      "market-B",
    ]);
  });
  it("retains exact fee and UTC date visibility and paginates the available window without dropping older fills", async () => {
    state.read.mockResolvedValue(history(13));
    render(<DevnetMarketHistory id="market" />);
    await screen.findByRole("button", { name: "Next" });
    expect(document.querySelectorAll("tbody tr")).toHaveLength(12);
    expect(screen.getAllByText("0.000006789", { exact: true })).toHaveLength(
      12,
    );
    expect(document.querySelector("tbody time")?.textContent).toContain(
      "1970-01-13",
    );
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(document.querySelectorAll("tbody tr")).toHaveLength(1);
    expect(document.querySelector("tbody time")?.textContent).toContain(
      "1970-01-01",
    );
  });
  it("shows a provider error with retry instead of fabricated activity", async () => {
    state.read.mockRejectedValueOnce(new Error("Provider unavailable"));
    render(<DevnetMarketHistory id="market" />);
    await screen.findByRole("alert");
    expect(document.querySelectorAll("tbody tr")).toHaveLength(0);
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    await screen.findByText("0.000006789", { exact: true });
    expect(document.querySelectorAll("tbody tr")).toHaveLength(1);
  });
});
