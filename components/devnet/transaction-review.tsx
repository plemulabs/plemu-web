"use client";

import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { useEffect, useRef, useState } from "react";
import {
  DevnetClient,
  formatUnits,
  type InstructionPlan,
} from "../../lib/devnet";
import {
  checkPending,
  clearPending,
  readPending,
  resendPending,
  submitReviewedPlan,
  type PendingTransaction,
} from "../../lib/browser-transactions";
import { usePrivacyPreferences } from "../privacy-preferences";
import { type Transaction } from "@solana/web3.js";

export function useDevnetTransaction(onSuccess?: () => void) {
  const { connection } = useConnection();
  const wallet = useWallet();
  const { requireTerms } = usePrivacyPreferences();
  const [plan, setPlan] = useState<InstructionPlan | null>(null);
  const [pending, setPending] = useState<PendingTransaction | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const currentWallet = useRef(wallet.publicKey?.toBase58() || null);
  currentWallet.current = wallet.publicKey?.toBase58() || null;
  const currentAdapter = useRef(wallet.wallet?.adapter);
  currentAdapter.current = wallet.wallet?.adapter;
  const locked = useRef(false);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const address = currentWallet.current;
  useEffect(() => {
    setPlan(null);
    setPending(null);
    setMessage("");
    if (!address) return;
    try {
      setPending(readPending(address));
    } catch {
      setMessage(
        "The saved transaction cannot be read. Restore browser storage before approving another transaction.",
      );
    }
  }, [address]);
  async function check() {
    if (!pending || locked.current) return;
    locked.current = true;
    setBusy(true);
    try {
      const status = await checkPending(connection, pending);
      if (currentWallet.current !== pending.wallet) return;
      setMessage(
        status === "confirmed"
          ? "Transaction confirmed on Devnet."
          : status === "failed"
            ? "Transaction failed on chain. Network fees may have been charged."
            : status === "expired"
              ? "Transaction expired without a confirmed signature. Refresh before making a new request."
              : "Awaiting confirmation. Keep this saved transaction; avoid a duplicate approval.",
      );
      if (status !== "pending") {
        clearPending(pending);
        setPending(null);
        if (status === "confirmed") onSuccess?.();
      }
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Could not check the saved transaction.",
      );
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }
  async function approve() {
    if (!plan || !wallet.publicKey || !wallet.signTransaction || locked.current)
      return;
    const expectedAdapter = wallet.wallet?.adapter;
    locked.current = true;
    setBusy(true);
    setMessage("");
    try {
      const recovery =
        plan.kind === "pack-claim" || plan.kind === "pack-refund";
      if (!recovery && !(await requireTerms())) return;
      if (!alive.current)
        throw new Error(
          "This page closed. Review the action again before approving.",
        );
      if (currentWallet.current !== plan.wallet)
        throw new Error("Wallet changed. Review a new preview.");
      const verified = await new DevnetClient().revalidatePlan(plan);
      if (!alive.current)
        throw new Error(
          "This page closed. Review the action again before approving.",
        );
      if (currentWallet.current !== verified.wallet)
        throw new Error("Wallet changed. Review a new preview.");
      if (currentAdapter.current !== expectedAdapter)
        throw new Error("Wallet provider changed. Review a new preview.");
      const adapter = wallet.wallet?.adapter;
      let signer: (transaction: Transaction) => Promise<Transaction> =
        wallet.signTransaction;
      if (recovery) {
        // Only a freshly fetched, original-buyer existing draw can bypass NEW terms.
        // No fresh request, trade or arbitrary message uses this adapter boundary.
        if (
          verified.source.kind !== "pack" ||
          !verified.source.player?.pending ||
          verified.source.draw?.buyer !== verified.wallet ||
          !["pack-claim", "pack-refund"].includes(verified.kind) ||
          !adapter ||
          !("signTransaction" in adapter) ||
          adapter.publicKey?.toBase58() !== verified.wallet
        )
          throw new Error("Existing-draw recovery validation failed.");
        signer = async (tx: Transaction): Promise<Transaction> => {
          if (
            currentAdapter.current !== adapter ||
            adapter.publicKey?.toBase58() !== verified.wallet ||
            currentWallet.current !== verified.wallet
          )
            throw new Error("Recovery wallet changed.");
          const signed = await adapter.signTransaction(tx);
          if (
            currentAdapter.current !== adapter ||
            adapter.publicKey?.toBase58() !== verified.wallet ||
            currentWallet.current !== verified.wallet
          )
            throw new Error("Recovery wallet or provider changed.");
          return signed;
        };
      }
      const record = await submitReviewedPlan({
        plan: verified,
        connection,
        publicKey: wallet.publicKey,
        currentWallet: () =>
          alive.current &&
          currentAdapter.current === expectedAdapter &&
          expectedAdapter?.publicKey?.toBase58() === verified.wallet
            ? currentWallet.current
            : null,
        signTransaction: signer,
        onPersisted: setPending,
      });
      setPending(record);
      setPlan(null);
      setMessage(
        "Submitted to Devnet. Check confirmation before approving another transaction.",
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Approval or submission did not complete. Check any saved transaction before trying again.",
      );
      if (currentWallet.current) {
        try {
          setPending(readPending(currentWallet.current));
        } catch {
          /* Preserve the actionable error. */
        }
      }
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }
  async function resend() {
    if (!pending || locked.current) return;
    locked.current = true;
    setBusy(true);
    setMessage("");
    try {
      await resendPending(connection, pending, () => currentWallet.current);
      setMessage(
        "The identical saved transaction was resubmitted. No new payment or signature was requested.",
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Could not resubmit. Keep the saved transaction and check confirmation.",
      );
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }
  return {
    plan,
    setPlan,
    pending,
    busy,
    message,
    setMessage,
    approve,
    check,
    resend,
  };
}
export function TransactionReview({
  transaction,
}: {
  transaction: ReturnType<typeof useDevnetTransaction>;
}) {
  const { plan, pending, busy, message, approve, check, resend, setPlan } =
    transaction;
  return (
    <>
      {pending && (
        <section
          className="dn-panel dn-recovery"
          aria-label="Pending transaction"
        >
          <h2>Keep this transaction.</h2>
          <p>
            A signed request is saved locally for recovery. Checking or
            resubmitting these same bytes requests no new payment or signature.
          </p>
          <p className="dn-mono">{pending.signature}</p>
          <div className="dn-inline">
            <button
              className="dn-button"
              disabled={busy}
              onClick={() => void check()}
            >
              {busy ? "Checking…" : "Check confirmation"}
            </button>
            <button
              className="dn-button dn-secondary"
              disabled={busy}
              onClick={() => void resend()}
            >
              Resubmit saved transaction
            </button>
            <a
              href={`https://explorer.solana.com/tx/${pending.signature}?cluster=devnet`}
              target="_blank"
              rel="noopener noreferrer"
            >
              View transaction ↗
            </a>
          </div>
        </section>
      )}
      {plan && (
        <section className="dn-panel" aria-label="Transaction preview">
          <h2>Review your transaction</h2>
          <div className="dn-receipt">{plan.summary.join("\n")}</div>
          <p>
            Maximum operation debit:{" "}
            <strong>{formatUnits(plan.maximumDebitLamports)} Devnet SOL</strong>
            . Network fees and any separately disclosed account costs also
            apply. Minimum SOL received:{" "}
            {formatUnits(plan.minimumReceiveLamports)}.
          </p>
          <p className="dn-mono">
            Wallet: {plan.wallet}
            <br />
            Solana Devnet · snapshot slot {plan.readSlot.toString()}
          </p>
          <p>
            Preview expires after 30 seconds. The wallet shows the exact request
            and asks for your approval.
          </p>
          <div className="dn-inline">
            <button
              className="dn-button"
              disabled={busy || !!pending}
              onClick={() => void approve()}
            >
              {busy ? "Waiting for wallet…" : "Approve in wallet"}
            </button>
            <button
              className="dn-button dn-secondary"
              disabled={busy}
              onClick={() => setPlan(null)}
            >
              Cancel
            </button>
          </div>
        </section>
      )}
      {message && (
        <p role="status" className="dn-status">
          {message}
        </p>
      )}
    </>
  );
}
