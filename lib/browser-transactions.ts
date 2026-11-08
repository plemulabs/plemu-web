import { Transaction, type Connection, type PublicKey } from "@solana/web3.js";
import { Buffer } from "buffer";
import { getBase58Decoder } from "@solana/kit";
import {
  assertFreshPlan,
  toWeb3Instructions,
  DEVNET_RELEASE,
  type InstructionPlan,
} from "./devnet";

export type PendingTransaction = Readonly<{
  version: 1;
  wallet: string;
  genesisHash: string;
  signature: string;
  wire: string;
  blockhash: string;
  lastValidBlockHeight: number;
  kind: string;
  createdAt: string;
}>;
const PREFIX = "plemu-devnet-pending-v1:";
const signatureDecoder = getBase58Decoder();
export function validatePending(
  value: unknown,
  wallet: string,
): PendingTransaction {
  if (!value || typeof value !== "object")
    throw new Error("Invalid recovery record.");
  const record = value as PendingTransaction;
  if (
    record.version !== 1 ||
    record.wallet !== wallet ||
    record.genesisHash !== DEVNET_RELEASE.genesisHash ||
    typeof record.wire !== "string" ||
    record.wire.length > 2000 ||
    typeof record.signature !== "string" ||
    !Number.isSafeInteger(record.lastValidBlockHeight) ||
    record.lastValidBlockHeight <= 0 ||
    typeof record.createdAt !== "string" ||
    !Number.isFinite(Date.parse(record.createdAt))
  )
    throw new Error("Invalid recovery record.");
  const bytes = Buffer.from(record.wire, "base64");
  if (bytes.length > 1232 || bytes.toString("base64") !== record.wire)
    throw new Error("Invalid recovery transaction encoding.");
  const tx = Transaction.from(bytes);
  if (
    tx.feePayer?.toBase58() !== wallet ||
    tx.recentBlockhash !== record.blockhash ||
    !tx.verifySignatures() ||
    !tx.signature ||
    signatureDecoder.decode(tx.signature) !== record.signature
  )
    throw new Error("Recovery transaction failed wallet/signature validation.");
  return record;
}
export function readPending(wallet: string): PendingTransaction | null {
  const value = localStorage.getItem(PREFIX + wallet);
  return value ? validatePending(JSON.parse(value), wallet) : null;
}
export function persistPending(record: PendingTransaction): void {
  validatePending(record, record.wallet);
  const existing = readPending(record.wallet);
  if (existing && existing.signature !== record.signature)
    throw new Error(
      "Another signed transaction is already saved. Its recovery record was preserved.",
    );
  const serialized = JSON.stringify(record);
  localStorage.setItem(PREFIX + record.wallet, serialized);
  if (localStorage.getItem(PREFIX + record.wallet) !== serialized)
    throw new Error(
      "The exact signed transaction could not be saved and read back. Nothing was submitted.",
    );
}
export function clearPending(record: PendingTransaction): void {
  const current = readPending(record.wallet);
  if (current?.signature === record.signature)
    localStorage.removeItem(PREFIX + record.wallet);
}
type SigningConnection = Pick<
  Connection,
  | "getGenesisHash"
  | "getLatestBlockhash"
  | "getFeeForMessage"
  | "getBalance"
  | "sendRawTransaction"
>;
export async function submitReviewedPlan(options: {
  plan: InstructionPlan;
  connection: SigningConnection;
  publicKey: PublicKey;
  currentWallet: () => string | null;
  signTransaction: (transaction: Transaction) => Promise<Transaction>;
  onPersisted?: (record: PendingTransaction) => void;
}): Promise<PendingTransaction> {
  if (typeof navigator === "undefined" || !navigator.locks?.request)
    throw new Error(
      "Use an updated browser with secure transaction coordination support.",
    );
  return navigator.locks.request(
    `plemu-devnet-sign:${options.publicKey.toBase58()}`,
    { mode: "exclusive", ifAvailable: true },
    async (lock) => {
      if (!lock)
        throw new Error(
          "Another Plemu tab or panel is approving a transaction for this wallet. Finish it first.",
        );
      return submitPlanLocked(options);
    },
  );
}
async function submitPlanLocked(options: {
  plan: InstructionPlan;
  connection: SigningConnection;
  publicKey: PublicKey;
  currentWallet: () => string | null;
  signTransaction: (transaction: Transaction) => Promise<Transaction>;
  onPersisted?: (record: PendingTransaction) => void;
}): Promise<PendingTransaction> {
  const { plan, connection, publicKey, currentWallet, signTransaction } =
    options;
  const wallet = publicKey.toBase58();
  const sameWallet = () => {
    if (wallet !== plan.wallet || currentWallet() !== wallet)
      throw new Error("Wallet changed. Review the transaction again.");
  };
  sameWallet();
  assertFreshPlan(plan);
  if (readPending(wallet))
    throw new Error(
      "Check the pending transaction before approving another one.",
    );
  if ((await connection.getGenesisHash()) !== DEVNET_RELEASE.genesisHash)
    throw new Error("Signing is available on verified Solana Devnet only.");
  sameWallet();
  const lifetime = await connection.getLatestBlockhash("confirmed");
  const tx = new Transaction({ feePayer: publicKey, ...lifetime }).add(
    ...toWeb3Instructions(plan),
  );
  const reviewedMessage = tx.serializeMessage();
  const fee = await connection.getFeeForMessage(
    tx.compileMessage(),
    "confirmed",
  );
  if (fee.value === null || !Number.isSafeInteger(fee.value) || fee.value < 0)
    throw new Error("Network fee is unavailable. Refresh before approving.");
  const balance = await connection.getBalance(publicKey, "confirmed");
  if (
    !Number.isSafeInteger(balance) ||
    BigInt(balance) < plan.maximumDebitLamports + BigInt(fee.value)
  )
    throw new Error(
      "Keep enough Devnet SOL for the maximum debit and network fee.",
    );
  assertFreshPlan(plan);
  sameWallet();
  const signed = await signTransaction(tx);
  sameWallet();
  if (!Buffer.from(signed.serializeMessage()).equals(reviewedMessage))
    throw new Error(
      "The wallet changed the reviewed transaction. Nothing was submitted.",
    );
  const wire = signed.serialize({
    requireAllSignatures: true,
    verifySignatures: true,
  });
  if (!signed.signature)
    throw new Error("The wallet did not sign the transaction.");
  const record: PendingTransaction = {
    version: 1,
    wallet,
    genesisHash: DEVNET_RELEASE.genesisHash,
    signature: signatureDecoder.decode(signed.signature),
    wire: wire.toString("base64"),
    blockhash: lifetime.blockhash,
    lastValidBlockHeight: lifetime.lastValidBlockHeight,
    kind: plan.kind,
    createdAt: new Date().toISOString(),
  };
  // Signed bytes must be persisted and read back before any RPC can see them,
  // including sendRawTransaction's provider-side preflight simulation.
  persistPending(record);
  options.onPersisted?.(record);
  sameWallet();
  const signature = await connection.sendRawTransaction(wire, {
    skipPreflight: false,
    maxRetries: 0,
  });
  if (signature !== record.signature)
    throw new Error(
      "RPC returned a different signature. Check the saved transaction before continuing.",
    );
  return record;
}
export async function checkPending(
  connection: Pick<
    Connection,
    "getGenesisHash" | "getSignatureStatuses" | "getBlockHeight"
  >,
  record: PendingTransaction,
): Promise<"confirmed" | "failed" | "expired" | "pending"> {
  validatePending(record, record.wallet);
  if ((await connection.getGenesisHash()) !== DEVNET_RELEASE.genesisHash)
    throw new Error("Recovery requires verified Solana Devnet.");
  const result = await connection.getSignatureStatuses([record.signature], {
    searchTransactionHistory: true,
  });
  const status = result.value[0];
  if (
    status &&
    (status.confirmationStatus === "confirmed" ||
      status.confirmationStatus === "finalized")
  )
    return status.err ? "failed" : "confirmed";
  if (
    !status &&
    (await connection.getBlockHeight("finalized")) > record.lastValidBlockHeight
  )
    return "expired";
  return "pending";
}
export async function resendPending(
  connection: Pick<
    Connection,
    | "getGenesisHash"
    | "getSignatureStatuses"
    | "getBlockHeight"
    | "sendRawTransaction"
  >,
  record: PendingTransaction,
  currentWallet: () => string | null,
): Promise<void> {
  if (typeof navigator === "undefined" || !navigator.locks?.request)
    throw new Error(
      "Use an updated browser with secure transaction coordination support.",
    );
  await navigator.locks.request(
    `plemu-devnet-sign:${record.wallet}`,
    { mode: "exclusive", ifAvailable: true },
    async (lock) => {
      if (!lock)
        throw new Error(
          "Another Plemu tab is handling this wallet. Finish it first.",
        );
      validatePending(record, record.wallet);
      if (
        currentWallet() !== record.wallet ||
        readPending(record.wallet)?.wire !== record.wire
      )
        throw new Error("Recovery wallet or saved transaction changed.");
      const status = await checkPending(connection, record);
      if (status !== "pending")
        throw new Error(
          `Transaction is ${status}. Check confirmation to finish recovery.`,
        );
      if (currentWallet() !== record.wallet)
        throw new Error("Recovery wallet changed.");
      persistPending(record);
      const signature = await connection.sendRawTransaction(
        Buffer.from(record.wire, "base64"),
        { skipPreflight: false, maxRetries: 0 },
      );
      if (signature !== record.signature)
        throw new Error(
          "RPC returned a different signature. Keep the original recovery record.",
        );
    },
  );
}
