import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  cleanup,
  act,
} from "@testing-library/react";
const s = vi.hoisted(() => ({
  wallet: null as any,
  requireTerms: vi.fn(),
  revalidate: vi.fn(),
  submit: vi.fn(),
  plan: null as any,
}));
vi.mock("@solana/wallet-adapter-react", () => ({
  useWallet: () => s.wallet,
  useConnection: () => ({ connection: {} }),
}));
vi.mock("../../privacy-preferences", () => ({
  usePrivacyPreferences: () => ({ requireTerms: s.requireTerms }),
}));
vi.mock("../../../lib/devnet", () => ({
  DevnetClient: class {
    revalidatePlan(p: any) {
      return s.revalidate(p);
    }
  },
  formatUnits: (x: any) => String(x),
}));
vi.mock("../../../lib/browser-transactions", () => ({
  submitReviewedPlan: (o: any) => s.submit(o),
  readPending: () => null,
  checkPending: vi.fn(),
  clearPending: vi.fn(),
}));
import { useDevnetTransaction } from "../transaction-review";
import { RecoveryWalletPicker } from "../recovery-wallet";
function adapter(name = "Alpha", address = "wallet-A") {
  return {
    name,
    publicKey: { toBase58: () => address },
    signTransaction: vi.fn(async () => ({})),
    connect: vi.fn(async () => {}),
    disconnect: vi.fn(async () => {}),
  };
}
function plan(kind = "pack-claim") {
  return {
    kind,
    wallet: "wallet-A",
    source: {
      kind: "pack",
      player: { pending: true },
      draw: { buyer: "wallet-A" },
    },
    summary: [],
    readSlot: 1n,
    maximumDebitLamports: 0n,
    minimumReceiveLamports: 0n,
  };
}
function makeWallet(a = adapter()) {
  return {
    publicKey: a.publicKey,
    connected: true,
    wallet: { adapter: a },
    signTransaction: vi.fn(async () => ({})),
    wallets: [],
    select: vi.fn(),
    connect: vi.fn(),
  };
}
function Harness() {
  const t = useDevnetTransaction();
  return (
    <>
      <button onClick={() => t.setPlan(s.plan)}>Prepare</button>
      <button onClick={() => void t.approve()}>Approve</button>
      <output data-testid="message">{t.message}</output>
    </>
  );
}
function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}
beforeEach(() => {
  cleanup();
  vi.clearAllMocks();
  s.wallet = makeWallet();
  s.plan = plan();
  s.requireTerms.mockResolvedValue(false);
  s.revalidate.mockImplementation(async (p) => p);
  s.submit.mockImplementation(async (o) => {
    await o.signTransaction({});
    return { wallet: o.plan.wallet, signature: "test-signature" };
  });
});
async function begin() {
  fireEvent.click(screen.getByRole("button", { name: "Prepare" }));
  fireEvent.click(screen.getByRole("button", { name: "Approve" }));
}
describe("narrow recovery signing", () => {
  it.each(["market-buy", "market-sell", "welcome-claim", "pack-request"])(
    "fresh %s cannot bypass cancelled Terms",
    async (kind) => {
      s.plan = plan(kind);
      render(<Harness />);
      await begin();
      await waitFor(() => expect(s.requireTerms).toHaveBeenCalledOnce());
      expect(s.revalidate).not.toHaveBeenCalled();
      expect(s.submit).not.toHaveBeenCalled();
      expect(s.wallet.wallet.adapter.signTransaction).not.toHaveBeenCalled();
    },
  );
  it("fresh payment uses wrapped signer after Terms approval", async () => {
    s.plan = plan("pack-request");
    s.requireTerms.mockResolvedValue(true);
    render(<Harness />);
    await begin();
    await waitFor(() => expect(s.submit).toHaveBeenCalledOnce());
    expect(s.wallet.signTransaction).toHaveBeenCalledOnce();
    expect(s.wallet.wallet.adapter.signTransaction).not.toHaveBeenCalled();
  });
  it.each(["pack-claim", "pack-refund"])(
    "verified %s bypasses only new Terms and uses original buyer adapter",
    async (kind) => {
      s.plan = plan(kind);
      render(<Harness />);
      await begin();
      await waitFor(() =>
        expect(s.wallet.wallet.adapter.signTransaction).toHaveBeenCalledOnce(),
      );
      expect(s.requireTerms).not.toHaveBeenCalled();
      expect(s.revalidate).toHaveBeenCalledOnce();
      expect(s.wallet.signTransaction).not.toHaveBeenCalled();
    },
  );
  it("rejects an adapter account change before its signature returns, even before React rerenders", async () => {
    const a = s.wallet.wallet.adapter;
    a.signTransaction.mockImplementation(async () => {
      a.publicKey = { toBase58: () => "wallet-B" };
      return {};
    });
    render(<Harness />);
    await begin();
    await waitFor(() =>
      expect(screen.getByTestId("message").textContent).toContain("changed"),
    );
  });
  it("rejects recovery for a different buyer", async () => {
    s.revalidate.mockImplementation(async (p) => ({
      ...p,
      source: { ...p.source, draw: { buyer: "someone-else" } },
    }));
    render(<Harness />);
    await begin();
    await waitFor(() =>
      expect(screen.getByTestId("message").textContent).toContain(
        "validation failed",
      ),
    );
    expect(s.submit).not.toHaveBeenCalled();
  });
  it("rejects recovery without a pending draw", async () => {
    s.revalidate.mockImplementation(async (p) => ({
      ...p,
      source: { ...p.source, player: { pending: false } },
    }));
    render(<Harness />);
    await begin();
    await waitFor(() =>
      expect(screen.getByTestId("message").textContent).toContain(
        "validation failed",
      ),
    );
    expect(s.submit).not.toHaveBeenCalled();
  });
  it("rejects a changed wallet while revalidation is pending", async () => {
    const d = deferred<any>();
    s.revalidate.mockReturnValue(d.promise);
    const view = render(<Harness />);
    await begin();
    s.wallet = makeWallet(adapter("Beta", "wallet-B"));
    view.rerender(<Harness />);
    await act(async () => d.resolve(s.plan));
    await waitFor(() =>
      expect(screen.getByTestId("message").textContent).toContain(
        "Wallet changed",
      ),
    );
    expect(s.submit).not.toHaveBeenCalled();
  });
  it("rejects a different selected adapter with the same key during revalidation", async () => {
    const d = deferred<any>();
    s.revalidate.mockReturnValue(d.promise);
    const old = s.wallet.wallet.adapter;
    const view = render(<Harness />);
    await begin();
    s.wallet = makeWallet(adapter("Beta", "wallet-A"));
    view.rerender(<Harness />);
    await act(async () => d.resolve(s.plan));
    await waitFor(() =>
      expect(screen.getByTestId("message").textContent).toContain("changed"),
    );
    expect(old.signTransaction).not.toHaveBeenCalled();
  });
});
describe("explicit read-only recovery reconnection", () => {
  it("selection alone never connects; second click calls only selected raw adapter connect", async () => {
    const a = adapter();
    s.wallet = {
      ...makeWallet(a),
      connected: false,
      publicKey: null,
      wallet: null,
      wallets: [{ adapter: a, readyState: "Installed" }],
    };
    const view = render(<RecoveryWalletPicker />);
    fireEvent.click(
      screen.getByText("Recover an existing draw without accepting new terms"),
    );
    fireEvent.click(screen.getByRole("button", { name: "Select Alpha" }));
    expect(s.wallet.select).toHaveBeenCalledWith("Alpha");
    expect(a.connect).not.toHaveBeenCalled();
    s.wallet = { ...s.wallet, wallet: { adapter: a } };
    view.rerender(<RecoveryWalletPicker />);
    fireEvent.click(
      screen.getByRole("button", { name: "Connect Alpha for recovery" }),
    );
    await waitFor(() => expect(a.connect).toHaveBeenCalledOnce());
    expect(s.requireTerms).not.toHaveBeenCalled();
    expect(s.wallet.connect).not.toHaveBeenCalled();
    expect(a.signTransaction).not.toHaveBeenCalled();
  });
  it("wallet cancellation produces a message without retrying", async () => {
    const a = adapter();
    a.connect.mockRejectedValue(Error("user cancelled"));
    s.wallet = {
      ...makeWallet(a),
      connected: false,
      publicKey: null,
      wallets: [{ adapter: a, readyState: "Installed" }],
    };
    render(<RecoveryWalletPicker />);
    fireEvent.click(
      screen.getByText("Recover an existing draw without accepting new terms"),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Connect Alpha for recovery" }),
    );
    await waitFor(() =>
      expect(screen.getByRole("status").textContent).toContain(
        "user cancelled",
      ),
    );
    expect(a.connect).toHaveBeenCalledOnce();
    expect(s.requireTerms).not.toHaveBeenCalled();
  });
  it("disconnects a stale adapter when selection changes while connect waits", async () => {
    const a = adapter(),
      b = adapter("Beta");
    const d = deferred<void>();
    a.connect.mockReturnValue(d.promise);
    s.wallet = {
      ...makeWallet(a),
      connected: false,
      publicKey: null,
      wallets: [
        { adapter: a, readyState: "Installed" },
        { adapter: b, readyState: "Installed" },
      ],
    };
    const view = render(<RecoveryWalletPicker />);
    fireEvent.click(
      screen.getByText("Recover an existing draw without accepting new terms"),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Connect Alpha for recovery" }),
    );
    s.wallet = { ...s.wallet, wallet: { adapter: b } };
    view.rerender(<RecoveryWalletPicker />);
    await act(async () => d.resolve());
    await waitFor(() => expect(a.disconnect).toHaveBeenCalledOnce());
    expect(screen.getByRole("status").textContent).toContain(
      "selection changed",
    );
    expect(b.connect).not.toHaveBeenCalled();
  });
});
