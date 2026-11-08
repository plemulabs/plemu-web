import { createReadTransport, decodeRpcAccount, rpcUnsigned } from "./client";
import { DEVNET_RELEASE } from "./release";
import { formatUnits, u64 } from "./math";
import {
  ata,
  checkPda,
  checkedDecode,
  CLOCK,
  createAta,
  hex,
  i64At,
  instruction,
  key,
  meta,
  onCurve,
  optional,
  pda,
  PROGRAM,
  required,
  SYSTEM,
  SYSVAR,
  TOKEN,
  tokenAmount,
  u64At,
} from "./wire";
import type {
  InstructionPlan,
  RpcAccount,
  RpcTransport,
  SnapshotBase,
  UnsignedInstruction,
} from "./types";
import {
  getTestFaucetDecoder,
  TEST_FAUCET_DISCRIMINATOR,
} from "./generated/accounts/testFaucet";
import {
  getFaucetClaimDecoder,
  FAUCET_CLAIM_DISCRIMINATOR,
} from "./generated/accounts/faucetClaim";
import {
  getClaimTestTokensInstructionDataEncoder,
  getCreateFaucetClaimInstructionDataEncoder,
} from "./generated/faucet-instruction-data";

export type FaucetConfig = Readonly<{
  symbol: string;
  title: string;
  decimals: number;
  amount: string;
  use: string;
  mint: string;
  faucet: string;
  vault: string;
}>;
// Exact current Seeker TestTokensPanel filter: three mocks; no listed V1 game has a committed faucet.
// DevnetFaucets.json SHA-256: e47af4ba50621d7ca09131b4123ef6f2181744b40fd00269c1a285e6ec7088c9
export const FAUCET_AUTHORITY = "HEY6W2WV2WXB5YRGE6Eh4SxjNNbMrxgdETYk26ZuKBLs";
export const DEVNET_FAUCETS: readonly FaucetConfig[] = Object.freeze(
  [
    {
      symbol: "mSOL",
      title: "Mock SOL",
      decimals: 9,
      amount: "1000000000",
      use: "SPL test transfers; cannot pay network fees",
      mint: "9FckAKwqx8vGQF5dKi3hQWPXrYoqYdWLX2fkg6MPknEJ",
      faucet: "6gSuBmyU1XUXkyqiycrwYbLnh4NcJRQ4ztVJEDXZfcoL",
      vault: "7AN1tP55wmpMhDaEh8pQoinhFZGEGCriSEZdvJxpGmcW",
    },
    {
      symbol: "mUSDC",
      title: "Mock USDC",
      decimals: 6,
      amount: "1000000000",
      use: "Test transfers; markets currently use native SOL",
      mint: "kUwyQQSdEQPG7NvxxfjReJJCUKManPtb7XCXpDDN9MH",
      faucet: "87G5gceo52SfByGaEmBf2ZEKZCYWwXsD7XYPPhG734yg",
      vault: "2XjQFbvCHZi3VMa4rxFBm71XXo7KCSEMTzYDyCP2mXMf",
    },
    {
      symbol: "PLEMU",
      title: "Mock PLEMU",
      decimals: 6,
      amount: "10000000000",
      use: "Test transfers and PLEMU integration",
      mint: "3SCEkyV7Zzy9Xbjw29Vx8MApyg8pftrDp1xiKxhALi5v",
      faucet: "8ZJ6qhqnYmGJbh71aERwfpF5Gjm35Rwbw7ebZWdZ3b5V",
      vault: "H9JjAAxANdxcD8aMqdajRtJdRWY3ax175uoh64tpn1mx",
    },
  ].map((value) => Object.freeze(value)),
);

export type FaucetSnapshot = SnapshotBase &
  Readonly<{
    kind: "faucet";
    config: FaucetConfig;
    claimAddress: string;
    destination: string;
    hasClaim: boolean;
    hasDestination: boolean;
    amount: bigint;
    cooldown: bigint;
    availableAt: bigint;
    inventory: bigint;
    balance: bigint;
    walletLamports: bigint;
    accountRentLamports: bigint;
    ready: boolean;
  }>;
export type FaucetInstructionPlan = Omit<InstructionPlan, "kind" | "source"> &
  Readonly<{ kind: "faucet-claim"; source: FaucetSnapshot }>;
export type FaucetReadOptions = {
  transport?: RpcTransport;
  signal?: AbortSignal;
};
const MAX_AGE = 30_000;
const LOADERS = [
  "BPFLoaderUpgradeab1e11111111111111111111111",
  "BPFLoader2111111111111111111111111111111111",
];
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Invalid faucet RPC response.");
  return value as Record<string, unknown>;
}
function reviewed(id: string): FaucetConfig {
  const config = DEVNET_FAUCETS.find(
    (item) => item.symbol === id || item.mint === id || item.faucet === id,
  );
  if (!config) throw new Error("Unknown reviewed Devnet faucet.");
  checkPda(
    config.faucet,
    pda("test-faucet", key(FAUCET_AUTHORITY), key(config.mint))[1],
    "test-faucet",
    key(FAUCET_AUTHORITY),
    key(config.mint),
  );
  if (config.vault !== pda("faucet-vault", key(config.faucet))[0])
    throw new Error("Faucet release configuration mismatch.");
  return config;
}
function executable(account: RpcAccount | null, owner?: string) {
  if (
    !account?.executable ||
    (owner ? account.owner !== owner : !LOADERS.includes(account.owner))
  )
    throw new Error(
      "Faucet program is not executable under its expected loader.",
    );
}
export async function readFaucet(
  id: string,
  wallet: string,
  options: FaucetReadOptions = {},
): Promise<FaucetSnapshot> {
  const config = reviewed(id),
    rpc = options.transport ?? createReadTransport(),
    signal = options.signal;
  if (wallet === SYSTEM || !onCurve(wallet))
    throw new Error("Connect a valid wallet for the Devnet faucet.");
  if ((await rpc("getGenesisHash", [], signal)) !== DEVNET_RELEASE.genesisHash)
    throw new Error("Wrong network: verified Solana Devnet is required.");
  const [claimAddress, claimBump] = pda(
      "faucet-claim",
      key(config.faucet),
      key(wallet),
    ),
    destination = ata(wallet, config.mint);
  const keys = [
    PROGRAM,
    TOKEN,
    CLOCK,
    config.faucet,
    config.vault,
    config.mint,
    claimAddress,
    destination,
    wallet,
  ];
  const response = object(
    await rpc(
      "getMultipleAccounts",
      [keys, { encoding: "base64", commitment: "confirmed" }],
      signal,
    ),
  );
  const readSlot = rpcUnsigned(object(response.context).slot);
  if (!Array.isArray(response.value) || response.value.length !== keys.length)
    throw new Error("Incomplete faucet account snapshot.");
  const a = response.value.map(decodeRpcAccount);
  executable(a[0]);
  executable(a[1]);
  const chainTime = i64At(required(a[2], SYSVAR, 40), 32);
  if (chainTime <= 0n) throw new Error("Invalid confirmed faucet clock.");
  const faucet = checkedDecode(
    a[3],
    getTestFaucetDecoder(),
    TEST_FAUCET_DISCRIMINATOR,
  );
  checkPda(
    config.faucet,
    faucet.bump,
    "test-faucet",
    key(FAUCET_AUTHORITY),
    key(config.mint),
  );
  if (
    faucet.authority !== FAUCET_AUTHORITY ||
    faucet.mint !== config.mint ||
    faucet.vault !== config.vault ||
    faucet.amount !== BigInt(config.amount) ||
    faucet.amount === 0n ||
    faucet.cooldown < 60n ||
    faucet.cooldown > 86400n
  )
    throw new Error("Faucet state differs from the reviewed release.");
  const inventory = tokenAmount(a[4], config.faucet, config.mint);
  const mint = required(a[5], TOKEN, 82);
  if (mint[44] !== config.decimals || mint[45] !== 1)
    throw new Error("Faucet mint decimals or initialized state mismatch.");
  const claimAccount = optional(a[6]),
    destinationAccount = optional(a[7]);
  let availableAt = 0n;
  if (claimAccount) {
    const claim = checkedDecode(
      claimAccount,
      getFaucetClaimDecoder(),
      FAUCET_CLAIM_DISCRIMINATOR,
    );
    if (
      claim.faucet !== config.faucet ||
      claim.wallet !== wallet ||
      claim.bump !== claimBump ||
      claim.nextClaimAt < 0n
    )
      throw new Error("Faucet claim identity or cooldown mismatch.");
    availableAt = claim.nextClaimAt;
  }
  const balance = destinationAccount
    ? tokenAmount(destinationAccount, wallet, config.mint)
    : 0n;
  if (u64(inventory + balance) > u64At(mint, 36))
    throw new Error("Faucet balances exceed the initialized mint supply.");
  u64(balance + faucet.amount);
  if (
    a[8] &&
    (a[8].owner !== SYSTEM || a[8].executable || a[8].data.length !== 0)
  )
    throw new Error("Faucet wallet must be an ordinary System-owned wallet.");
  const rents = await Promise.all(
    [121, 165, 82, 89].map((size) =>
      rpc(
        "getMinimumBalanceForRentExemption",
        [size, { commitment: "confirmed" }],
        signal,
      ).then(rpcUnsigned),
    ),
  );
  for (const [account, rent] of [
    [a[3], rents[0]],
    [a[4], rents[1]],
    [a[5], rents[2]],
    [claimAccount, rents[3]],
    [destinationAccount, rents[1]],
  ] as const) {
    if (account && account.lamports < rent)
      throw new Error("A faucet account is below its rent-exempt floor.");
  }
  const claimRent = claimAccount
    ? 0n
    : rents[3] > (a[6]?.lamports ?? 0n)
      ? rents[3] - (a[6]?.lamports ?? 0n)
      : 0n;
  const destinationRent = destinationAccount
    ? 0n
    : rents[1] > (a[7]?.lamports ?? 0n)
      ? rents[1] - (a[7]?.lamports ?? 0n)
      : 0n;
  return Object.freeze({
    kind: "faucet",
    cluster: "devnet",
    genesisHash: DEVNET_RELEASE.genesisHash,
    readSlot,
    readAtMs: Date.now(),
    chainTime,
    wallet,
    config,
    claimAddress,
    destination,
    hasClaim: !!claimAccount,
    hasDestination: !!destinationAccount,
    amount: faucet.amount,
    cooldown: faucet.cooldown,
    availableAt,
    inventory,
    balance,
    walletLamports: a[8]?.lamports ?? 0n,
    accountRentLamports: u64(claimRent + destinationRent),
    ready: availableAt <= chainTime && inventory >= faucet.amount,
  });
}
export function planFaucetClaim(
  snapshot: FaucetSnapshot,
): FaucetInstructionPlan {
  const s = snapshot,
    c = reviewed(s.config.mint),
    now = Date.now();
  if (
    JSON.stringify(c) !== JSON.stringify(s.config) ||
    s.kind !== "faucet" ||
    s.cluster !== "devnet" ||
    s.genesisHash !== DEVNET_RELEASE.genesisHash ||
    s.readSlot < 0n ||
    !Number.isFinite(s.readAtMs) ||
    s.readAtMs > now + 1000 ||
    now - s.readAtMs > MAX_AGE ||
    !s.wallet ||
    s.wallet === SYSTEM ||
    !onCurve(s.wallet) ||
    s.chainTime <= 0n
  )
    throw new Error(
      "Refresh a verified Devnet faucet snapshot before approval.",
    );
  if (
    s.claimAddress !== pda("faucet-claim", key(c.faucet), key(s.wallet))[0] ||
    s.destination !== ata(s.wallet, c.mint) ||
    s.amount !== BigInt(c.amount) ||
    s.cooldown < 60n ||
    s.cooldown > 86400n ||
    s.availableAt > s.chainTime ||
    s.inventory < s.amount ||
    !s.ready
  )
    throw new Error(
      "This faucet is unavailable or still cooling down. Refresh its status.",
    );
  if (s.walletLamports < u64(s.accountRentLamports))
    throw new Error(
      "Native Devnet SOL is needed for first-time account rent and network fees.",
    );
  const ixs: UnsignedInstruction[] = [];
  if (!s.hasClaim)
    ixs.push(
      instruction(getCreateFaucetClaimInstructionDataEncoder().encode({}), [
        meta(s.wallet, true, true),
        meta(c.faucet),
        meta(s.claimAddress, true),
        meta(SYSTEM),
      ]),
    );
  ixs.push(createAta(s.wallet, c.mint));
  ixs.push(
    instruction(getClaimTestTokensInstructionDataEncoder().encode({}), [
      meta(s.wallet, false, true),
      meta(c.faucet),
      meta(s.claimAddress, true),
      meta(c.mint),
      meta(c.vault, true),
      meta(s.destination, true),
      meta(TOKEN),
    ]),
  );
  return Object.freeze({
    cluster: "devnet",
    genesisHash: DEVNET_RELEASE.genesisHash,
    wallet: s.wallet,
    kind: "faucet-claim",
    instructions: Object.freeze(ixs),
    source: s,
    readSlot: s.readSlot,
    createdAtMs: now,
    expiresAtMs: s.readAtMs + MAX_AGE,
    maximumDebitLamports: s.accountRentLamports,
    minimumReceiveLamports: 0n,
    summary: Object.freeze([
      `Claim ${formatUnits(s.amount, c.decimals)} ${c.symbol} test tokens on Devnet. These tokens have no monetary value.`,
      `Token destination: ${s.destination}. Account rent up to ${formatUnits(s.accountRentLamports)} native Devnet SOL, plus network fees.`,
      c.symbol === "mSOL"
        ? "Mock SOL is an SPL token; it cannot pay Solana network fees."
        : "This is a free inventory-funded test-token claim, not a purchase.",
    ]),
  });
}
export async function revalidateFaucetPlan(
  plan: FaucetInstructionPlan,
  options: FaucetReadOptions = {},
): Promise<FaucetInstructionPlan> {
  if (
    plan.kind !== "faucet-claim" ||
    plan.cluster !== "devnet" ||
    plan.genesisHash !== DEVNET_RELEASE.genesisHash ||
    plan.wallet !== plan.source.wallet ||
    Date.now() > plan.expiresAtMs ||
    plan.expiresAtMs > plan.source.readAtMs + MAX_AGE
  )
    throw new Error("Faucet preview expired or wallet changed.");
  planFaucetClaim(plan.source);
  const next = planFaucetClaim(
    await readFaucet(plan.source.config.mint, plan.wallet, options),
  );
  if (
    next.maximumDebitLamports > plan.maximumDebitLamports ||
    next.instructions.length !== plan.instructions.length ||
    next.instructions.some(
      (ix, i) =>
        ix.programAddress !== plan.instructions[i].programAddress ||
        hex(ix.data) !== hex(plan.instructions[i].data) ||
        JSON.stringify(ix.accounts) !==
          JSON.stringify(plan.instructions[i].accounts),
    )
  )
    throw new Error(
      "Faucet accounts or costs changed. Review a fresh preview.",
    );
  return next;
}
