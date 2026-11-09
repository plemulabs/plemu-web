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
import fixture from "../../../lib/devnet/__tests__/fixtures/market-operations-readonly.json";
import type { MarketSnapshot } from "../../../lib/devnet/types";

const state = vi.hoisted(() => ({
  address: null as string | null,
  busy: false,
  pending: null as unknown,
  readMarket: vi.fn(),
  setPlan: vi.fn(),
}));
vi.mock("@solana/wallet-adapter-react", () => ({
  useWallet: () => ({
    publicKey: state.address ? { toBase58: () => state.address } : null,
    connected: !!state.address,
  }),
}));
vi.mock("../../../lib/devnet", async (original) => {
  const actual = await original<typeof import("../../../lib/devnet")>();
  return {
    ...actual,
    DevnetClient: class {
      readMarket(...args: unknown[]) {
        return state.readMarket(...args);
      }
    },
    planBuy: vi.fn(actual.planBuy),
    planSell: vi.fn(actual.planSell),
    planMarketOperation: vi.fn(actual.planMarketOperation),
  };
});
vi.mock("../../WalletHeaderButton", () => ({
  WalletHeaderButton: () => <button>Connect wallet</button>,
}));
vi.mock("../market-history", () => ({
  DevnetMarketHistory: () => <section aria-label="Market chart and activity" />,
}));
vi.mock("../transaction-review", () => ({
  useDevnetTransaction: () => ({
    setPlan: state.setPlan,
    busy: state.busy,
    pending: state.pending,
    plan: null,
  }),
  TransactionReview: () => null,
}));
import { DevnetMarketDetail } from "../market-detail";
import { planBuy, planSell, planMarketOperation } from "../../../lib/devnet";

const base = JSON.parse(JSON.stringify(fixture), (_key, value) =>
  value?.$bigint !== undefined
    ? BigInt(value.$bigint)
    : value?.$bytes
      ? Uint8Array.from(value.$bytes)
      : value,
) as MarketSnapshot;
const walletA = base.wallet!;
const walletB = "79bnkSFGG4ptfcoyKocuK1FhRbvF2YWxLhQGUqaJia5T";
function snapshot(wallet = state.address) {
  return { ...base, wallet, readAtMs: Date.now() };
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
beforeEach(() => {
  vi.clearAllMocks();
  state.address = walletA;
  state.busy = false;
  state.pending = null;
  state.readMarket.mockImplementation(async () => snapshot());
});
afterEach(cleanup);

describe("market workspace transaction boundary", () => {
  it("uses the existing buy/sell planners, clears previews on every changed trade input, and retains advanced tools", async () => {
    render(<DevnetMarketDetail id="gba/apotris" />);
    await screen.findByRole("button", { name: "Preview buy" });
    fireEvent.click(screen.getByRole("button", { name: "Preview buy" }));
    expect(planBuy).toHaveBeenCalledOnce();
    expect(state.setPlan.mock.calls.at(-1)?.[0].kind).toBe("market-buy");
    state.setPlan.mockClear();
    fireEvent.change(
      screen.getByRole("textbox", {
        name: "Devnet SOL budget before slippage",
      }),
      { target: { value: "0.02" } },
    );
    expect(state.setPlan).toHaveBeenLastCalledWith(null);
    state.setPlan.mockClear();
    fireEvent.change(screen.getByRole("combobox", { name: "Slippage limit" }), {
      target: { value: "50" },
    });
    expect(state.setPlan).toHaveBeenLastCalledWith(null);
    fireEvent.change(
      screen.getByRole("combobox", { name: "Enter buy amount as" }),
      { target: { value: "tokens" } },
    );
    expect(state.setPlan).toHaveBeenLastCalledWith(null);
    expect(screen.queryByRole("button", { name: "100%" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Sell tokens" }));
    expect(state.setPlan).toHaveBeenLastCalledWith(null);
    expect(screen.getByRole("button", { name: "100%" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Preview sell" }));
    expect(planSell).toHaveBeenCalledOnce();
    expect(
      screen.getByRole("button", { name: "Preview creator fee claim" }),
    ).toBeTruthy();
    fireEvent.click(screen.getByText("Advanced market tools", { exact: true }));
    for (const name of [
      "Preview stage synchronization",
      "Preview price observation",
      "Preview funded buyback",
      "Preview onchain holding proof",
    ])
      expect(screen.getByRole("button", { name })).toBeTruthy();
    fireEvent.click(
      screen.getByRole("button", { name: "Preview stage synchronization" }),
    );
    expect(planMarketOperation).toHaveBeenCalledWith(
      expect.objectContaining({ wallet: walletA }),
      "market-stage",
    );
  });
  it("aborts the old wallet read, hides the old quote immediately and ignores its late completion", async () => {
    const old = deferred<MarketSnapshot>();
    const fresh = deferred<MarketSnapshot>();
    state.readMarket
      .mockReturnValueOnce(old.promise)
      .mockReturnValueOnce(fresh.promise);
    const view = render(<DevnetMarketDetail id="gba/apotris" />);
    const signal = state.readMarket.mock.calls[0][2] as AbortSignal;
    state.address = walletB;
    view.rerender(<DevnetMarketDetail id="gba/apotris" />);
    expect(signal.aborted).toBe(true);
    expect(screen.queryByRole("button", { name: "Preview buy" })).toBeNull();
    await act(async () =>
      old.resolve({ ...snapshot(walletA), walletTokens: 111n }),
    );
    expect(screen.queryByRole("button", { name: "Preview buy" })).toBeNull();
    await act(async () =>
      fresh.resolve({ ...snapshot(walletB), walletTokens: 222_000_000n }),
    );
    await screen.findByRole("button", { name: "Preview buy" });
    expect(screen.getByText("222 APOTRIS", { exact: true })).toBeTruthy();
    expect(screen.queryByText("0.000111 APOTRIS", { exact: true })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Preview buy" }));
    expect(planBuy).toHaveBeenCalledWith(
      expect.objectContaining({ wallet: walletB }),
      expect.any(BigInt),
      100,
    );
  });
  it("clears wallet-specific balances and approvals on disconnect", async () => {
    const view = render(<DevnetMarketDetail id="gba/apotris" />);
    await screen.findByRole("button", { name: "Preview buy" });
    state.address = null;
    view.rerender(<DevnetMarketDetail id="gba/apotris" />);
    await screen.findByText("Connect to view", { exact: true });
    expect(screen.queryByRole("button", { name: "Preview buy" })).toBeNull();
    expect(
      screen.getAllByRole("button", { name: "Connect wallet" }).length,
    ).toBeGreaterThan(0);
  });
  it("remounts workspace identity and cancels a previous market on slug navigation", async () => {
    const old = deferred<MarketSnapshot>();
    const current = deferred<MarketSnapshot>();
    state.readMarket
      .mockReturnValueOnce(old.promise)
      .mockReturnValueOnce(current.promise);
    const view = render(<DevnetMarketDetail id="gba/apotris" />);
    const signal = state.readMarket.mock.calls[0][2] as AbortSignal;
    view.rerender(<DevnetMarketDetail id="gba/anguna" />);
    expect(signal.aborted).toBe(true);
    await act(async () => old.resolve(snapshot()));
    expect(screen.queryByRole("button", { name: "Preview buy" })).toBeNull();
    expect(screen.getByRole("heading", { name: /^Anguna/ })).toBeTruthy();
    expect(state.readMarket.mock.calls.map((args) => args[0])).toEqual([
      "gba/apotris",
      "gba/anguna",
    ]);
  });
  it("blocks a second preview and protocol operations while a journaled request is pending", async () => {
    state.pending = { signature: "pending" };
    render(<DevnetMarketDetail id="gba/apotris" />);
    const preview = await screen.findByRole("button", { name: "Preview buy" });
    expect((preview as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(preview);
    expect(planBuy).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText("Advanced market tools", { exact: true }));
    expect(
      (
        screen.getByRole("button", {
          name: "Preview funded buyback",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
  });
});
