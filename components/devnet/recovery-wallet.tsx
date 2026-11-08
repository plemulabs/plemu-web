"use client";

import { useRef, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletReadyState } from "@solana/wallet-adapter-base";

/** Explicit read-only reconnection for an existing draw; fresh actions still use the guarded signer. */
export function RecoveryWalletPicker() {
  const wallet = useWallet();
  const currentAdapter = useRef(wallet.wallet?.adapter);
  currentAdapter.current = wallet.wallet?.adapter;
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  if (wallet.connected) return null;
  async function connectForRecovery() {
    const adapter = wallet.wallet?.adapter;
    if (!adapter || busy) return;
    setBusy(true);
    setMessage("");
    try {
      await adapter.connect();
      if (currentAdapter.current !== adapter) {
        await adapter.disconnect();
        throw new Error(
          "Wallet selection changed. Choose the recovery wallet again.",
        );
      }
      setMessage(
        "Connected for read-only recovery. Check your existing pack below; new purchases still require the current terms.",
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Recovery connection did not complete.",
      );
    } finally {
      setBusy(false);
    }
  }
  const available = wallet.wallets.filter(
    (item) =>
      item.readyState === WalletReadyState.Installed ||
      item.readyState === WalletReadyState.Loadable,
  );
  return (
    <details className="dn-panel">
      <summary>Recover an existing draw without accepting new terms</summary>
      <p>
        Select the original buyer’s wallet, then explicitly connect to inspect
        its existing draw. Connection alone sends no transaction and grants no
        spending permission.
      </p>
      <div className="dn-inline">
        {available.map((item) => (
          <button
            key={item.adapter.name}
            className="dn-button dn-secondary"
            disabled={busy}
            aria-pressed={wallet.wallet?.adapter === item.adapter}
            onClick={() => wallet.select(item.adapter.name)}
          >
            Select {item.adapter.name}
          </button>
        ))}
      </div>
      {!available.length && (
        <p>Install or enable a compatible Solana wallet to reconnect.</p>
      )}
      {wallet.wallet && (
        <button
          className="dn-button"
          disabled={busy}
          onClick={() => void connectForRecovery()}
        >
          {busy
            ? "Connecting…"
            : `Connect ${wallet.wallet.adapter.name} for recovery`}
        </button>
      )}
      {message && (
        <p className="dn-status" role="status">
          {message}
        </p>
      )}
    </details>
  );
}
