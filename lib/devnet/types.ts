import type { GameMarketV1 } from "./generated/accounts/gameMarketV1";
import type { GameProtocolV1 } from "./generated/accounts/gameProtocolV1";
import type { RandomPackV2 } from "./generated/accounts/randomPackV2";
import type { PackPlayerV2 } from "./generated/accounts/packPlayerV2";
import type { PackDrawV2 } from "./generated/accounts/packDrawV2";
import type { FaucetSnapshot } from "./faucet";
export type {
  GameMarketV1,
  GameProtocolV1,
  RandomPackV2,
  PackPlayerV2,
  PackDrawV2,
};
export type MarketConfig = Readonly<{
  catalogId: string;
  title: string;
  symbol: string;
  creator: string;
  gameId: string;
  contentHash: string;
  market: string;
  mint: string;
  system: string;
  licenseThreshold: number;
  deployed: boolean;
}>;
export type RewardConfig = Readonly<{
  catalogId: string;
  title: string;
  system: string;
  market: string;
  mint: string;
  contentHash: string;
  symbol: string;
}>;
export type PackConfig = Readonly<{
  version: number;
  rosterKey: string;
  title: string;
  pack: string;
  creator: string;
  price: string;
  tokenBonus: string;
  progressPolicy: boolean;
  recoveryOnly: boolean;
  games: readonly RewardConfig[];
}>;
export type WelcomeConfig = Readonly<{
  creator: string;
  campaignId: string;
  campaign: string;
  treasury: string;
  games: readonly {
    id: string;
    title: string;
    system: string;
    contentHash: string;
  }[];
}>;
export type UnsignedInstruction = Readonly<{
  programAddress: string;
  accounts: readonly Readonly<{
    address: string;
    isWritable: boolean;
    isSigner: boolean;
  }>[];
  data: Uint8Array;
}>;
export type SnapshotBase = Readonly<{
  cluster: "devnet";
  genesisHash: string;
  readSlot: bigint;
  readAtMs: number;
  chainTime: bigint;
  wallet: string | null;
}>;
export type MarketSnapshot = SnapshotBase &
  Readonly<{
    kind: "market";
    config: MarketConfig;
    market: GameMarketV1;
    protocol: GameProtocolV1;
    mintSupply: bigint;
    walletTokens: bigint;
    walletLamports: bigint;
    walletEligible: boolean;
    tokenAccounts: readonly { address: string; amount: bigint }[];
    stage: "demo" | "graduated" | "alpha" | "hyper" | "beta";
  }>;
export type FeeSplit = Readonly<{
  total: bigint;
  platform: bigint;
  creator: bigint;
  buyback: bigint;
}>;
export type TradeQuote = Readonly<{
  buy: boolean;
  poolTrade: boolean;
  tokens: bigint;
  principalLamports: bigint;
  fees: FeeSplit;
  totalDebitLamports: bigint;
  netReceiveLamports: bigint;
  migrates: boolean;
}>;
export type WelcomeSnapshot = SnapshotBase &
  Readonly<{
    kind: "welcome";
    config: WelcomeConfig;
    capacity: bigint;
    claimed: bigint;
    alreadyClaimed: boolean;
    available: boolean;
    receipt: string | null;
    receiptRent: bigint;
    sponsorLamports: bigint;
  }>;
export type PackPhase =
  | "not-started"
  | "awaiting-randomness"
  | "awaiting-delivery"
  | "verifying-delivery"
  | "delivered"
  | "refund-available"
  | "refunded";
export type PackSnapshot = SnapshotBase &
  Readonly<{
    kind: "pack";
    config: PackConfig;
    pool: RandomPackV2;
    player: PackPlayerV2 | null;
    playerAddress: string | null;
    draw: PackDrawV2 | null;
    drawAddress: string | null;
    ownedMask: number;
    currentReceiptMask: number;
    availableDraws: bigint;
    phase: PackPhase;
    rewards: readonly RewardConfig[];
    canRefund: boolean;
    estimatedMaximumDebitLamports: bigint;
  }>;
export type PlanKind =
  | MarketOperation
  | "market-buy"
  | "market-sell"
  | "welcome-claim"
  | "pack-request"
  | "pack-claim"
  | "pack-refund"
  | "faucet-claim";
// Faucet claims are explicit, fee-paying Devnet actions, separate from native SOL.
export type MarketOperation =
  | "market-creator-fees"
  | "market-platform-fees"
  | "market-observe"
  | "market-stage"
  | "market-buyback"
  | "market-license";
export type InstructionPlan = Readonly<{
  cluster: "devnet";
  genesisHash: string;
  wallet: string;
  kind: PlanKind;
  instructions: readonly UnsignedInstruction[];
  readSlot: bigint;
  createdAtMs: number;
  expiresAtMs: number;
  summary: readonly string[];
  maximumDebitLamports: bigint;
  minimumReceiveLamports: bigint;
  quote?: TradeQuote;
  operationAmount?: bigint;
  source: MarketSnapshot | PackSnapshot | WelcomeSnapshot | FaucetSnapshot;
}>;
export type RpcAccount = Readonly<{
  owner: string;
  executable: boolean;
  lamports: bigint;
  data: Uint8Array;
}>;
export type RpcTransport = (
  method: string,
  params: readonly unknown[],
  signal?: AbortSignal,
) => Promise<unknown>;

export type TokenBalances = Readonly<{
  cluster: "devnet";
  genesisHash: string;
  wallet: string;
  readSlot: bigint;
  readAtMs: number;
  nativeLamports: bigint;
  balances: readonly {
    mint: string;
    catalogId: string;
    title: string;
    symbol: string;
    decimals: 6;
    amount: bigint;
    tokenAccounts: readonly { address: string; amount: bigint }[];
  }[];
}>;
