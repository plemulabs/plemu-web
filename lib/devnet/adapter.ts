/** The only legacy SDK boundary. All application snapshots retain plain data and bigint. */
import { Buffer } from "buffer";
import { PublicKey, TransactionInstruction } from "@solana/web3.js";
import type { InstructionPlan } from "./types";
export function toWeb3Instructions(
  plan: InstructionPlan,
): TransactionInstruction[] {
  return plan.instructions.map(
    (ix) =>
      new TransactionInstruction({
        programId: new PublicKey(ix.programAddress),
        keys: ix.accounts.map((a) => ({
          pubkey: new PublicKey(a.address),
          isWritable: a.isWritable,
          isSigner: a.isSigner,
        })),
        data: Buffer.from(ix.data),
      }),
  );
}
