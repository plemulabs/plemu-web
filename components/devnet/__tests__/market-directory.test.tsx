import React from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MarketSnapshot } from "../../../lib/devnet/types";
const state = vi.hoisted(() => ({ read: vi.fn() }));
vi.mock("../../../lib/devnet/client", () => ({
  DevnetClient: class {
    readMarket(...args: unknown[]) {
      return state.read(...args);
    }
  },
}));
import { DevnetMarkets } from "../markets";
import { marketDirectory } from "../../../lib/market-presentation";
function value(id: string): MarketSnapshot {
  return {
    config: marketDirectory.find(({ config }) => config.catalogId === id)!
      .config,
    stage: "demo",
    readSlot: 100n,
    readAtMs: Date.now(),
    market: { dexReady: false, sold: 0n, targetQuote: 1_000_000_000n },
  } as MarketSnapshot;
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
  state.read.mockImplementation(async (id: string) => value(id));
});
afterEach(cleanup);
describe("market directory reads", () => {
  it("reads only the five reviewed markets with no more than two snapshots in flight", async () => {
    const pending = Object.fromEntries(
      marketDirectory.map(({ config }) => [
        config.catalogId,
        deferred<MarketSnapshot>(),
      ]),
    );
    let active = 0,
      maximum = 0;
    state.read.mockImplementation((id: string) => {
      active++;
      maximum = Math.max(maximum, active);
      return pending[id].promise.finally(() => {
        active--;
      });
    });
    render(<DevnetMarkets />);
    expect(state.read).toHaveBeenCalledTimes(2);
    for (let index = 0; index < 5; index++) {
      const id = marketDirectory[index].config.catalogId;
      await act(async () => pending[id].resolve(value(id)));
    }
    await waitFor(() =>
      expect(
        (
          screen.getByRole("button", {
            name: "Refresh quotes",
          }) as HTMLButtonElement
        ).disabled,
      ).toBe(false),
    );
    expect(maximum).toBe(2);
    expect(state.read.mock.calls.map((args) => args[0])).toEqual(
      marketDirectory.map(({ config }) => config.catalogId),
    );
    for (const args of state.read.mock.calls) {
      expect(args[1]).toBeNull();
      expect(args[2]).toBeInstanceOf(AbortSignal);
    }
    fireEvent.change(
      screen.getByRole("textbox", { name: "Search game token markets" }),
      { target: { value: "APOTRIS" } },
    );
    expect(document.querySelectorAll(".mt-market-row")).toHaveLength(1);
    expect(state.read).toHaveBeenCalledTimes(5);
  });
  it("aborts active reads on navigation and never queues remaining markets after disposal", async () => {
    const pending = deferred<MarketSnapshot>();
    state.read.mockReturnValue(pending.promise);
    const view = render(<DevnetMarkets />);
    const signals = state.read.mock.calls.map((args) => args[2] as AbortSignal);
    view.unmount();
    expect(signals.every((signal) => signal.aborted)).toBe(true);
    await act(async () =>
      pending.resolve(value(marketDirectory[0].config.catalogId)),
    );
    expect(state.read).toHaveBeenCalledTimes(2);
  });
  it("shows unavailable quotes without invented values and retries through a fresh bounded read", async () => {
    state.read.mockRejectedValueOnce(new Error("Provider unavailable"));
    render(<DevnetMarkets />);
    await screen.findByText("Unavailable", { exact: true });
    await waitFor(() =>
      expect(
        (
          screen.getByRole("button", {
            name: "Refresh quotes",
          }) as HTMLButtonElement
        ).disabled,
      ).toBe(false),
    );
    fireEvent.click(screen.getByRole("button", { name: "Refresh quotes" }));
    await waitFor(() => expect(state.read).toHaveBeenCalledTimes(10));
    await waitFor(() =>
      expect(screen.queryByText("Unavailable", { exact: true })).toBeNull(),
    );
    expect(document.querySelectorAll(".mt-market-row")).toHaveLength(5);
  });
});
