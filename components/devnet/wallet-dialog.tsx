"use client";

import { useEffect, useRef } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { DevnetWallet } from "./utility-pages";

export function WalletDialog({ onClose }: { onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const { connected } = useWallet();
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const node = dialog.current;
    const opener = document.activeElement;
    if (connected) node?.showModal();
    else close.current();
    return () => {
      node?.close();
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus();
    };
  }, [connected]);
  if (!connected) return null;
  return (
    <dialog
      ref={dialog}
      className="dn-wallet-dialog"
      aria-label="Your wallet"
      onCancel={onClose}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="dn-wallet-dialog-body">
        <button
          className="dn-wallet-close dn-button dn-secondary"
          aria-label="Close wallet"
          onClick={onClose}
        >
          Close <span aria-hidden="true">×</span>
        </button>
        <DevnetWallet embedded />
      </div>
    </dialog>
  );
}
