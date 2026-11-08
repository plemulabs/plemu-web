"use client";

import { useRef, useState, useEffect } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import {
  DEVNET_FAUCETS,
  readFaucet,
  planFaucetClaim,
  formatUnits,
  type FaucetSnapshot,
} from "../../lib/devnet";
import { useDevnetTransaction, TransactionReview } from "./transaction-review";
export function DevnetFaucets() {
  return (
    <section className="dn-panel">
      <h2>Test funds, for trying things.</h2>
      <p>
        Native Devnet SOL pays network fees, token packs and V1 trades. Mock
        SOL, mock USDC and mock PLEMU are SPL test tokens; they cannot pay
        network fees and have no monetary value.
      </p>
      <p>
        Copy your wallet address from the wallet menu, then use the{" "}
        <a
          href="https://faucet.solana.com/"
          target="_blank"
          rel="noopener noreferrer"
        >
          official Solana Devnet faucet ↗
        </a>{" "}
        for native SOL. The three mock faucets below use the same onchain claims
        and cooldowns as Seeker.
      </p>
      <div className="dn-market-grid">
        {DEVNET_FAUCETS.map((config) => (
          <FaucetCard key={config.mint} id={config.mint} />
        ))}
      </div>
    </section>
  );
}
function FaucetCard({ id }: { id: string }) {
  const address = useWallet().publicKey?.toBase58() || null;
  const config = DEVNET_FAUCETS.find((item) => item.mint === id)!;
  const [snapshot, setSnapshot] = useState<FaucetSnapshot | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const generation = useRef(0);
  const transaction = useDevnetTransaction(() => void refresh());
  async function refresh() {
    if (!address) {
      setError("Connect your wallet to check this test faucet.");
      return;
    }
    const current = ++generation.current;
    setLoading(true);
    setError("");
    setSnapshot(null);
    transaction.setPlan(null);
    try {
      const state = await readFaucet(id, address);
      if (current === generation.current) setSnapshot(state);
    } catch (error) {
      if (current === generation.current)
        setError(
          error instanceof Error
            ? error.message
            : "Could not check this faucet.",
        );
    } finally {
      if (current === generation.current) setLoading(false);
    }
  }
  useEffect(() => {
    generation.current++;
    setSnapshot(null);
    setError("");
    setLoading(false);
    return () => {
      generation.current++;
    };
  }, [address]);
  return (
    <section className="dn-panel">
      <h3>{config.title}</h3>
      <p>{config.use}</p>
      <button
        className="dn-button dn-secondary"
        disabled={loading || transaction.busy || !address}
        onClick={() => void refresh()}
      >
        {loading ? "Checking Devnet…" : "Check balance & eligibility"}
      </button>
      {snapshot && (
        <>
          <p>
            Balance: {formatUnits(snapshot.balance, config.decimals)}{" "}
            {config.symbol}
            <br />
            Per claim: {formatUnits(snapshot.amount, config.decimals)}{" "}
            {config.symbol}
            <br />
            Faucet inventory: {formatUnits(snapshot.inventory, config.decimals)}
          </p>
          <p>
            {snapshot.ready
              ? "A claim is available."
              : snapshot.inventory < snapshot.amount
                ? "This faucet is empty."
                : `Ready in about ${Math.max(1, Number((snapshot.availableAt - snapshot.chainTime + 59n) / 60n))} minutes on the chain clock.`}
          </p>
          <button
            className="dn-button"
            disabled={
              !snapshot.ready || transaction.busy || !!transaction.pending
            }
            onClick={() => {
              try {
                transaction.setPlan(planFaucetClaim(snapshot));
              } catch (error) {
                setError(
                  error instanceof Error
                    ? error.message
                    : "Refresh before claiming.",
                );
              }
            }}
          >
            Preview mock-token claim
          </button>
          <p className="dn-fineprint">
            Network fees and new account rent can require native Devnet SOL. A
            mock-token claim does not fund the native balance.
          </p>
        </>
      )}
      {error && (
        <p role="alert" className="dn-error">
          {error}
        </p>
      )}
      <TransactionReview transaction={transaction} />
    </section>
  );
}
