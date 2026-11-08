import React from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  address: "wallet-A" as string | null,
  readWelcome: vi.fn(),
  readPack: vi.fn(),
  readFaucet: vi.fn(),
}));
vi.mock("@solana/wallet-adapter-react", () => ({
  useWallet: () => ({
    publicKey: state.address ? { toBase58: () => state.address } : null,
    connected: !!state.address,
    wallets: [],
    wallet: null,
  }),
}));
vi.mock("../../../lib/devnet", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../lib/devnet")>()),
  DevnetClient: class {
    readWelcome(address: string | null) {
      return state.readWelcome(address);
    }
    readPack(id: string, address: string | null) {
      return state.readPack(id, address);
    }
  },
  readFaucet: (...args: unknown[]) => state.readFaucet(...args),
}));
vi.mock("../../WalletHeaderButton", () => ({
  WalletHeaderButton: () => <button>Connect wallet</button>,
}));
vi.mock("../transaction-review", () => ({
  useDevnetTransaction: () => ({
    setPlan: vi.fn(),
    busy: false,
    pending: null,
    plan: null,
  }),
  TransactionReview: () => null,
}));

import { DevnetPacks } from "../packs";
import { DevnetFaucets } from "../faucets";

function deferred() {
  let resolve!: (value: unknown) => void;
  const promise = new Promise<unknown>((done) => (resolve = done));
  return { promise, resolve };
}
beforeEach(() => {
  state.address = "wallet-A";
  vi.clearAllMocks();
});
afterEach(cleanup);

describe.each(["switch", "disconnect"] as const)(
  "%s while a public-chain read is pending",
  (transition) => {
    function changeIdentity(
      rerender: (ui: React.ReactNode) => void,
      ui: React.ReactNode,
    ) {
      state.address = transition === "switch" ? "wallet-B" : null;
      rerender(React.cloneElement(ui as React.ReactElement));
      if (transition === "disconnect") {
        state.address = "wallet-B";
        rerender(React.cloneElement(ui as React.ReactElement));
      }
    }

    it("restores welcome refresh and rejects the old wallet's late eligibility", async () => {
      const old = deferred();
      state.readWelcome.mockReturnValueOnce(old.promise).mockResolvedValueOnce({
        alreadyClaimed: false,
        available: false,
        claimed: 22n,
        capacity: 100n,
      });
      const ui = <DevnetPacks />;
      const { rerender } = render(ui);
      fireEvent.click(
        screen.getByRole("button", { name: "Check welcome eligibility" }),
      );
      expect(
        (
          screen.getByRole("button", {
            name: "Checking Devnet…",
          }) as HTMLButtonElement
        ).disabled,
      ).toBe(true);
      changeIdentity(rerender, <DevnetPacks />);
      const refresh = screen.getByRole("button", {
        name: "Check welcome eligibility",
      });
      expect((refresh as HTMLButtonElement).disabled).toBe(false);
      await act(async () => fireEvent.click(refresh));
      expect(screen.getByText(/22 \/ 100 claimed/)).toBeTruthy();
      await act(async () =>
        old.resolve({
          alreadyClaimed: true,
          available: true,
          claimed: 11n,
          capacity: 100n,
        }),
      );
      expect(screen.getByText(/22 \/ 100 claimed/)).toBeTruthy();
      expect(
        screen.queryByText(/already claimed its welcome receipt/),
      ).toBeNull();
      expect(state.readWelcome.mock.calls.map((args) => args[0])).toEqual([
        "wallet-A",
        "wallet-B",
      ]);
    });

    it("restores pack refresh and rejects a late draw from the old identity", async () => {
      const old = deferred();
      const snapshot = (slot: bigint) => ({
        player: null,
        ownedMask: 0,
        availableDraws: 17n,
        phase: "not-started",
        rewards: [],
        canRefund: false,
        estimatedMaximumDebitLamports: 20n,
        readSlot: slot,
      });
      state.readPack
        .mockReturnValueOnce(old.promise)
        .mockResolvedValueOnce(snapshot(222n));
      const { rerender } = render(<DevnetPacks />);
      fireEvent.click(
        screen.getAllByRole("button", { name: "Check pack & recovery" })[0],
      );
      expect(
        (
          screen.getByRole("button", {
            name: "Reading Devnet…",
          }) as HTMLButtonElement
        ).disabled,
      ).toBe(true);
      changeIdentity(rerender, <DevnetPacks />);
      const refresh = screen.getAllByRole("button", {
        name: "Check pack & recovery",
      })[0];
      expect((refresh as HTMLButtonElement).disabled).toBe(false);
      await act(async () => fireEvent.click(refresh));
      expect(screen.getByText(/Confirmed slot 222/)).toBeTruthy();
      await act(async () => old.resolve(snapshot(111n)));
      expect(screen.getByText(/Confirmed slot 222/)).toBeTruthy();
      expect(screen.queryByText(/Confirmed slot 111/)).toBeNull();
      expect(state.readPack.mock.calls.map((args) => args[1])).toEqual([
        "wallet-A",
        "wallet-B",
      ]);
    });

    it("restores faucet refresh and rejects the old wallet's late balance", async () => {
      const old = deferred();
      const snapshot = (balance: bigint) => ({
        balance,
        amount: 1_000_000_000n,
        inventory: 1_000_000_000n,
        ready: true,
      });
      state.readFaucet
        .mockReturnValueOnce(old.promise)
        .mockResolvedValueOnce(snapshot(22_000_000_000n));
      const { rerender } = render(<DevnetFaucets />);
      fireEvent.click(
        screen.getAllByRole("button", {
          name: "Check balance & eligibility",
        })[0],
      );
      expect(
        (
          screen.getByRole("button", {
            name: "Checking Devnet…",
          }) as HTMLButtonElement
        ).disabled,
      ).toBe(true);
      changeIdentity(rerender, <DevnetFaucets />);
      const refresh = screen.getAllByRole("button", {
        name: "Check balance & eligibility",
      })[0];
      expect((refresh as HTMLButtonElement).disabled).toBe(false);
      await act(async () => fireEvent.click(refresh));
      expect(screen.getByText(/Balance: 22 mSOL/)).toBeTruthy();
      await act(async () => old.resolve(snapshot(11_000_000_000n)));
      expect(screen.getByText(/Balance: 22 mSOL/)).toBeTruthy();
      expect(screen.queryByText(/Balance: 11 mSOL/)).toBeNull();
      expect(state.readFaucet.mock.calls.map((args) => args[1])).toEqual([
        "wallet-A",
        "wallet-B",
      ]);
    });
  },
);
