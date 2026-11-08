// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  Keypair,
  PublicKey,
  Transaction,
  SystemProgram,
} from "@solana/web3.js";
import { getBase58Decoder } from "@solana/kit";
import {
  submitReviewedPlan,
  readPending,
  checkPending,
  persistPending,
  resendPending,
} from "../browser-transactions";
import { DEVNET_RELEASE } from "../devnet";
const payer = Keypair.generate(),
  recipient = Keypair.generate().publicKey;
let entries: Map<string, string>, sends: string[], events: string[];
const decoder = getBase58Decoder();
beforeEach(() => {
  const held = new Set<string>();
  vi.stubGlobal("navigator", {
    locks: {
      request: async (
        name: string,
        _options: unknown,
        callback: (lock: unknown) => Promise<unknown>,
      ) => {
        if (held.has(name)) return callback(null);
        held.add(name);
        try {
          return await callback({ name, mode: "exclusive" });
        } finally {
          held.delete(name);
        }
      },
    },
  });
  entries = new Map();
  sends = [];
  events = [];
  Object.assign(globalThis, {
    localStorage: {
      getItem: (k: string) => {
        events.push("get");
        return entries.get(k) ?? null;
      },
      setItem: (k: string, v: string) => {
        events.push("set");
        entries.set(k, v);
      },
      removeItem: (k: string) => entries.delete(k),
    },
  });
});
function plan(n = 1): any {
  const i = SystemProgram.transfer({
    fromPubkey: payer.publicKey,
    toPubkey: recipient,
    lamports: n,
  });
  const now = Date.now();
  return {
    cluster: "devnet",
    genesisHash: DEVNET_RELEASE.genesisHash,
    wallet: payer.publicKey.toBase58(),
    kind: "welcome-claim",
    readSlot: 1n,
    createdAtMs: now,
    expiresAtMs: now + 30000,
    summary: ["offline unit test"],
    maximumDebitLamports: 0n,
    minimumReceiveLamports: 0n,
    source: {
      cluster: "devnet",
      genesisHash: DEVNET_RELEASE.genesisHash,
      readSlot: 1n,
      readAtMs: now,
      wallet: payer.publicKey.toBase58(),
    },
    instructions: [
      {
        programAddress: i.programId.toBase58(),
        accounts: i.keys.map((k) => ({
          address: k.pubkey.toBase58(),
          isSigner: k.isSigner,
          isWritable: k.isWritable,
        })),
        data: new Uint8Array(i.data),
      },
    ],
  };
}
function connection(overrides: any = {}) {
  return {
    getGenesisHash: async () => DEVNET_RELEASE.genesisHash,
    getLatestBlockhash: async () => ({
      blockhash: Keypair.generate().publicKey.toBase58(),
      lastValidBlockHeight: 999,
    }),
    getFeeForMessage: async () => ({ context: { slot: 1 }, value: 5000 }),
    getBalance: async () => 1e9,
    sendRawTransaction: async (bytes: Uint8Array) => {
      events.push("send");
      const tx = Transaction.from(bytes),
        sig = decoder.decode(tx.signature!);
      sends.push(sig);
      return sig;
    },
    ...overrides,
  } as any;
}
function options(
  p = plan(),
  c = connection(),
  signer = async (tx: Transaction) => {
    tx.sign(payer);
    return tx;
  },
) {
  return {
    plan: p,
    connection: c,
    publicKey: payer.publicKey,
    currentWallet: () => payer.publicKey.toBase58(),
    signTransaction: signer,
  };
}
describe("offline fake-RPC signing boundary", () => {
  it("persists and reads exact signed wire before fake send", async () => {
    const r = await submitReviewedPlan(options());
    expect(readPending(r.wallet)?.wire).toBe(r.wire);
    expect(events.lastIndexOf("set")).toBeLessThan(events.indexOf("send"));
    expect(events[events.indexOf("send") - 1]).toBe("get");
    expect(sends).toEqual([r.signature]);
  });
  it("fails closed when durable storage is unavailable", async () => {
    globalThis.localStorage.setItem = () => {
      throw Error("quota");
    };
    await expect(submitReviewedPlan(options())).rejects.toThrow("quota");
    expect(sends).toHaveLength(0);
  });
  it("rejects a changed signed message", async () => {
    await expect(
      submitReviewedPlan(
        options(plan(), connection(), async (tx) => {
          tx.instructions[0] = SystemProgram.transfer({
            fromPubkey: payer.publicKey,
            toPubkey: recipient,
            lamports: 99,
          });
          tx.sign(payer);
          return tx;
        }),
      ),
    ).rejects.toThrow("changed");
    expect(sends).toHaveLength(0);
  });
  it("rejects switched wallet after approval", async () => {
    let current = payer.publicKey.toBase58();
    const o = options(plan(), connection(), async (tx) => {
      tx.sign(payer);
      current = recipient.toBase58();
      return tx;
    });
    o.currentWallet = () => current;
    await expect(submitReviewedPlan(o)).rejects.toThrow("Wallet changed");
    expect(sends).toHaveLength(0);
  });
  it("rejects wrong genesis without signing", async () => {
    let signed = 0;
    await expect(
      submitReviewedPlan(
        options(
          plan(),
          connection({ getGenesisHash: async () => "mainnet" }),
          async (tx) => {
            signed++;
            return tx;
          },
        ),
      ),
    ).rejects.toThrow("Devnet");
    expect(signed).toBe(0);
    expect(sends).toHaveLength(0);
  });
  it("rejects a second sequential request while pending", async () => {
    await submitReviewedPlan(options());
    await expect(submitReviewedPlan(options())).rejects.toThrow("pending");
    expect(sends).toHaveLength(1);
  });
  it("preserves a conflicting signed record introduced while wallet approval is open", async () => {
    let expected: any;
    const signer = async (tx: Transaction) => {
      const other = Transaction.from(
        tx.serialize({ requireAllSignatures: false, verifySignatures: false }),
      );
      other.instructions[0] = SystemProgram.transfer({
        fromPubkey: payer.publicKey,
        toPubkey: recipient,
        lamports: 17,
      });
      other.sign(payer);
      expected = {
        version: 1,
        wallet: payer.publicKey.toBase58(),
        genesisHash: DEVNET_RELEASE.genesisHash,
        signature: decoder.decode(other.signature!),
        wire: other.serialize().toString("base64"),
        blockhash: other.recentBlockhash!,
        lastValidBlockHeight: 999,
        kind: "welcome-claim",
        createdAt: new Date().toISOString(),
      };
      persistPending(expected);
      tx.sign(payer);
      return tx;
    };
    await expect(
      submitReviewedPlan(options(plan(), connection(), signer)),
    ).rejects.toThrow("Another signed transaction");
    expect(sends).toHaveLength(0);
    expect(readPending(expected.wallet)?.wire).toBe(expected.wire);
  });
  it("blocks a concurrent panel/tab approval while first wallet request is open", async () => {
    let release!: () => void, entered!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    const started = new Promise<void>((resolve) => (entered = resolve));
    const signer = async (tx: Transaction) => {
      entered();
      await gate;
      tx.sign(payer);
      return tx;
    };
    const first = submitReviewedPlan(options(plan(1), connection(), signer));
    await started;
    await expect(
      submitReviewedPlan(options(plan(2), connection(), signer)),
    ).rejects.toThrow("Another Plemu tab or panel");
    release();
    const result = await first;
    expect(sends).toEqual([result.signature]);
    expect(readPending(result.wallet)?.signature).toBe(result.signature);
  });
});

describe("existing signed transaction recovery", () => {
  it.each([
    ["confirmed", null, "confirmed"],
    ["finalized", { InstructionError: [0, "Custom"] }, "failed"],
    [null, null, "pending"],
  ] as const)(
    "handles a %s signature result",
    async (confirmationStatus, err, expected) => {
      const record = await submitReviewedPlan(options());
      const c = connection({
        getSignatureStatuses: async () => ({
          context: { slot: 1 },
          value: [confirmationStatus ? { confirmationStatus, err } : null],
        }),
        getBlockHeight: async () => 1,
      });
      expect(await checkPending(c, record)).toBe(expected);
    },
  );
  it("only calls an unseen transaction expired after finalized block height passes its lifetime", async () => {
    const record = await submitReviewedPlan(options());
    const c = connection({
      getSignatureStatuses: async () => ({
        context: { slot: 1 },
        value: [null],
      }),
      getBlockHeight: async (commitment: string) => {
        expect(commitment).toBe("finalized");
        return 1000;
      },
    });
    expect(await checkPending(c, record)).toBe("expired");
  });
  it("resubmits the identical signed bytes without another signature", async () => {
    let approvals = 0;
    const c = connection({
      getSignatureStatuses: async () => ({
        context: { slot: 1 },
        value: [null],
      }),
      getBlockHeight: async () => 1,
    });
    const o = options(plan(), c, async (tx) => {
      approvals++;
      tx.sign(payer);
      return tx;
    });
    const record = await submitReviewedPlan(o);
    await resendPending(c, record, o.currentWallet);
    expect(approvals).toBe(1);
    expect(sends).toEqual([record.signature, record.signature]);
    expect(readPending(record.wallet)?.wire).toBe(record.wire);
  });
  it("never resubmits an already confirmed transaction or wrong wallet", async () => {
    const record = await submitReviewedPlan(options());
    const c = connection({
      getSignatureStatuses: async () => ({
        context: { slot: 1 },
        value: [{ confirmationStatus: "confirmed", err: null }],
      }),
      getBlockHeight: async () => 1,
    });
    await expect(
      resendPending(c, record, () => recipient.toBase58()),
    ).rejects.toThrow("wallet");
    await expect(resendPending(c, record, () => record.wallet)).rejects.toThrow(
      "confirmed",
    );
    expect(sends).toEqual([record.signature]);
  });
});
