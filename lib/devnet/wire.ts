import { PublicKey } from "@solana/web3.js";
import { DEVNET_RELEASE } from "./release";
import type { RpcAccount, UnsignedInstruction } from "./types";
export const PROGRAM = DEVNET_RELEASE.programId,
  TOKEN = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
  SYSTEM = "11111111111111111111111111111111",
  ASSOCIATED = "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL",
  CLOCK = "SysvarC1ock11111111111111111111111111111111",
  SYSVAR = "Sysvar1111111111111111111111111111111111111",
  VRF = "Vrf1RNUjXmQGjmQrQLvJHs9SNkvDJEsRVFPkfSQUwGz",
  VRF_QUEUE = "Cuj97ggrhhidhbu39TijNVqE74xvKJ69gDervRUXAxGh";
export const bytes = (s: string) => new TextEncoder().encode(s);
export function key(s: string): Uint8Array {
  const p = new PublicKey(s);
  if (p.toBase58() !== s) throw new Error("Noncanonical account address.");
  return p.toBytes();
}
export function onCurve(s: string): boolean {
  return PublicKey.isOnCurve(key(s));
}
export function hex(data: ArrayLike<number>): string {
  return Array.from(data, (b) => b.toString(16).padStart(2, "0")).join("");
}
export function unhex(s: string): Uint8Array {
  if (!/^[a-f0-9]{64}$/.test(s)) throw new Error("Invalid SHA-256 identity.");
  return Uint8Array.from(s.match(/../g)!, (n) => parseInt(n, 16));
}
export function pda(
  seed: string,
  ...values: Uint8Array[]
): readonly [string, number] {
  const [p, b] = PublicKey.findProgramAddressSync(
    [bytes(seed), ...values],
    new PublicKey(PROGRAM),
  );
  return [p.toBase58(), b];
}
export function checkPda(
  actual: string,
  bump: number,
  seed: string,
  ...values: Uint8Array[]
): void {
  const [expected, b] = pda(seed, ...values);
  if (actual !== expected || bump !== b)
    throw new Error("Account PDA or canonical bump mismatch.");
}
export function ata(wallet: string, mint: string): string {
  return PublicKey.findProgramAddressSync(
    [key(wallet), key(TOKEN), key(mint)],
    new PublicKey(ASSOCIATED),
  )[0].toBase58();
}
export function uint64(n: bigint): Uint8Array {
  const data = new Uint8Array(8);
  new DataView(data.buffer).setBigUint64(0, n, true);
  return data;
}
export function u64At(data: Uint8Array, at: number): bigint {
  return new DataView(
    data.buffer,
    data.byteOffset,
    data.byteLength,
  ).getBigUint64(at, true);
}
export function i64At(data: Uint8Array, at: number): bigint {
  return new DataView(
    data.buffer,
    data.byteOffset,
    data.byteLength,
  ).getBigInt64(at, true);
}
export function required(
  account: RpcAccount | null,
  owner: string,
  size?: number,
): Uint8Array {
  if (
    !account ||
    account.owner !== owner ||
    account.executable ||
    (size !== undefined && account.data.length !== size)
  )
    throw new Error("Account owner, executable flag or exact size mismatch.");
  return account.data;
}
export function optional(account: RpcAccount | null): RpcAccount | null {
  if (!account) return null;
  if (
    account.owner === SYSTEM &&
    !account.executable &&
    account.data.length === 0
  )
    return null;
  return account;
}
export function tokenAmount(
  account: RpcAccount | null,
  wallet: string,
  mint: string,
): bigint {
  const data = required(account, TOKEN, 165),
    v = new DataView(data.buffer, data.byteOffset, data.byteLength);
  if (
    hex(data.slice(0, 32)) !== hex(key(mint)) ||
    hex(data.slice(32, 64)) !== hex(key(wallet)) ||
    data[108] !== 1 ||
    v.getUint32(72, true) !== 0 ||
    v.getUint32(109, true) !== 0 ||
    v.getUint32(129, true) !== 0
  )
    throw new Error(
      "Token account authority, mint or initialized undelegated state mismatch.",
    );
  return u64At(data, 64);
}
export const meta = (
  address: string,
  isWritable = false,
  isSigner = false,
) => ({ address, isWritable, isSigner });
export function instruction(
  data: ArrayLike<number>,
  accounts: UnsignedInstruction["accounts"],
): UnsignedInstruction {
  return { programAddress: PROGRAM, accounts, data: Uint8Array.from(data) };
}
export function createAta(wallet: string, mint: string): UnsignedInstruction {
  return {
    programAddress: ASSOCIATED,
    accounts: [
      meta(wallet, true, true),
      meta(ata(wallet, mint), true),
      meta(wallet),
      meta(mint),
      meta(SYSTEM),
      meta(TOKEN),
    ],
    data: new Uint8Array([1]),
  };
}
export async function sha256(data: Uint8Array): Promise<Uint8Array> {
  return new Uint8Array(
    await crypto.subtle.digest("SHA-256", Uint8Array.from(data)),
  );
}
export function checkedDecode<T>(
  account: RpcAccount | null,
  codec: { decode: (data: Uint8Array) => T; fixedSize: number },
  discriminator: ArrayLike<number>,
  owner = PROGRAM,
): T {
  const data = required(account, owner, codec.fixedSize);
  if (hex(data.slice(0, 8)) !== hex(discriminator))
    throw new Error("Anchor account discriminator mismatch.");
  return codec.decode(data);
}
