import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { useWallet } from "@solana/wallet-adapter-react";
import {
  WalletReadyState,
  type Adapter,
  type WalletName,
} from "@solana/wallet-adapter-base";
import { PublicKey, Transaction } from "@solana/web3.js";
import { WalletProviderBase } from "../WalletProviderBase";
import { PrivacyPreferencesProvider } from "../../../components/privacy-preferences";

const key = new PublicKey("11111111111111111111111111111111");
type Action =
  | "sendTransaction"
  | "signTransaction"
  | "signAllTransactions"
  | "signMessage"
  | "signIn";

function Fixture({
  action,
  finished,
}: {
  action: Action;
  finished: (result: string) => void;
}) {
  const wallet = useWallet();
  return (
    <button
      onClick={async () => {
        try {
          if (action === "sendTransaction")
            await wallet.sendTransaction(new Transaction(), {} as never);
          else if (action === "signTransaction")
            await wallet.signTransaction!(new Transaction());
          else if (action === "signAllTransactions")
            await wallet.signAllTransactions!([new Transaction()]);
          else if (action === "signMessage")
            await wallet.signMessage!(new Uint8Array([1]));
          else await wallet.signIn!({});
          finished("authorized");
        } catch {
          finished("cancelled");
        }
      }}
    >
      Sign requested action
    </button>
  );
}

describe("wallet signing boundary", () => {
  beforeEach(() => localStorage.clear());
  function setup(action: Action) {
    const operation = vi.fn().mockResolvedValue(new Uint8Array([1]));
    const finished = vi.fn();
    const adapter = {
      name: "Fixture" as WalletName,
      url: "https://example.invalid",
      icon: "data:image/png;base64,",
      readyState: WalletReadyState.Installed,
      publicKey: key,
      connected: true,
      connecting: false,
      on: vi.fn(),
      off: vi.fn(),
      connect: vi.fn(),
      disconnect: vi.fn(),
      sendTransaction: operation,
      signTransaction: operation,
      signAllTransactions: operation,
      signMessage: operation,
      signIn: operation,
    } as unknown as Adapter;
    render(
      <PrivacyPreferencesProvider>
        <WalletProviderBase
          wallets={[adapter]}
          adapter={adapter}
          isUnloadingRef={{ current: false }}
          onConnectError={() => {}}
          onSelectWallet={() => {}}
        >
          <Fixture action={action} finished={finished} />
        </WalletProviderBase>
      </PrivacyPreferencesProvider>,
    );
    return { operation, finished, adapter };
  }

  it.each<Action>([
    "sendTransaction",
    "signTransaction",
    "signAllTransactions",
    "signMessage",
    "signIn",
  ])(
    "requires explicit terms acknowledgment for %s even with an already-connected adapter",
    async (action) => {
      const { operation, finished } = setup(action);
      fireEvent.click(
        screen.getByRole("button", { name: "Sign requested action" }),
      );
      await screen.findByRole("dialog", { name: "Review the terms" });
      expect(operation).not.toHaveBeenCalled();
      fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
      await waitFor(() => expect(finished).toHaveBeenCalledWith("cancelled"));
      expect(operation).not.toHaveBeenCalled();
      fireEvent.click(
        screen.getByRole("button", { name: "Sign requested action" }),
      );
      fireEvent.click(await screen.findByRole("checkbox"));
      fireEvent.click(
        screen.getByRole("button", { name: "Acknowledge draft and continue" }),
      );
      await waitFor(() => expect(operation).toHaveBeenCalledOnce());
    },
  );

  it("rejects an account changed while the terms prompt is pending", async () => {
    const { operation, finished, adapter } = setup("signMessage");
    fireEvent.click(
      screen.getByRole("button", { name: "Sign requested action" }),
    );
    await screen.findByRole("dialog", { name: "Review the terms" });
    Object.defineProperty(adapter, "publicKey", {
      value: new PublicKey("So11111111111111111111111111111111111111112"),
    });
    fireEvent.click(screen.getByRole("checkbox"));
    await act(async () =>
      fireEvent.click(
        screen.getByRole("button", { name: "Acknowledge draft and continue" }),
      ),
    );
    await waitFor(() => expect(finished).toHaveBeenCalledWith("cancelled"));
    expect(operation).not.toHaveBeenCalled();
  });
});
