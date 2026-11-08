/** Instruction data codecs extracted verbatim from committed Codama output. See PROVENANCE.md. */
import {
  combineCodec,
  fixDecoderSize,
  fixEncoderSize,
  getBytesDecoder,
  getBytesEncoder,
  getStructDecoder,
  getStructEncoder,
  getU64Decoder,
  getU64Encoder,
  transformEncoder,
  type FixedSizeEncoder,
  type FixedSizeDecoder,
  type FixedSizeCodec,
  type ReadonlyUint8Array,
} from "@solana/kit";

export const BUY_GAME_TOKENS_V1_DISCRIMINATOR: ReadonlyUint8Array =
  new Uint8Array([194, 126, 190, 179, 209, 149, 128, 186]);

export function getBuyGameTokensV1DiscriminatorBytes(): ReadonlyUint8Array {
  return fixEncoderSize(getBytesEncoder(), 8).encode(
    BUY_GAME_TOKENS_V1_DISCRIMINATOR,
  );
}

export type BuyGameTokensV1InstructionData = {
  discriminator: ReadonlyUint8Array;
  tokenAmount: bigint;
  maxTotalSol: bigint;
};

export type BuyGameTokensV1InstructionDataArgs = {
  tokenAmount: number | bigint;
  maxTotalSol: number | bigint;
};

export function getBuyGameTokensV1InstructionDataEncoder(): FixedSizeEncoder<BuyGameTokensV1InstructionDataArgs> {
  return transformEncoder(
    getStructEncoder([
      ["discriminator", fixEncoderSize(getBytesEncoder(), 8)],
      ["tokenAmount", getU64Encoder()],
      ["maxTotalSol", getU64Encoder()],
    ]),
    (value) => ({ ...value, discriminator: BUY_GAME_TOKENS_V1_DISCRIMINATOR }),
  );
}

export function getBuyGameTokensV1InstructionDataDecoder(): FixedSizeDecoder<BuyGameTokensV1InstructionData> {
  return getStructDecoder([
    ["discriminator", fixDecoderSize(getBytesDecoder(), 8)],
    ["tokenAmount", getU64Decoder()],
    ["maxTotalSol", getU64Decoder()],
  ]);
}

export function getBuyGameTokensV1InstructionDataCodec(): FixedSizeCodec<
  BuyGameTokensV1InstructionDataArgs,
  BuyGameTokensV1InstructionData
> {
  return combineCodec(
    getBuyGameTokensV1InstructionDataEncoder(),
    getBuyGameTokensV1InstructionDataDecoder(),
  );
}

export const SELL_GAME_TOKENS_V1_DISCRIMINATOR: ReadonlyUint8Array =
  new Uint8Array([240, 100, 121, 67, 158, 115, 147, 86]);

export function getSellGameTokensV1DiscriminatorBytes(): ReadonlyUint8Array {
  return fixEncoderSize(getBytesEncoder(), 8).encode(
    SELL_GAME_TOKENS_V1_DISCRIMINATOR,
  );
}

export type SellGameTokensV1InstructionData = {
  discriminator: ReadonlyUint8Array;
  tokenAmount: bigint;
  minSolOut: bigint;
};

export type SellGameTokensV1InstructionDataArgs = {
  tokenAmount: number | bigint;
  minSolOut: number | bigint;
};

export function getSellGameTokensV1InstructionDataEncoder(): FixedSizeEncoder<SellGameTokensV1InstructionDataArgs> {
  return transformEncoder(
    getStructEncoder([
      ["discriminator", fixEncoderSize(getBytesEncoder(), 8)],
      ["tokenAmount", getU64Encoder()],
      ["minSolOut", getU64Encoder()],
    ]),
    (value) => ({ ...value, discriminator: SELL_GAME_TOKENS_V1_DISCRIMINATOR }),
  );
}

export function getSellGameTokensV1InstructionDataDecoder(): FixedSizeDecoder<SellGameTokensV1InstructionData> {
  return getStructDecoder([
    ["discriminator", fixDecoderSize(getBytesDecoder(), 8)],
    ["tokenAmount", getU64Decoder()],
    ["minSolOut", getU64Decoder()],
  ]);
}

export function getSellGameTokensV1InstructionDataCodec(): FixedSizeCodec<
  SellGameTokensV1InstructionDataArgs,
  SellGameTokensV1InstructionData
> {
  return combineCodec(
    getSellGameTokensV1InstructionDataEncoder(),
    getSellGameTokensV1InstructionDataDecoder(),
  );
}

export const CLAIM_WELCOME_PACK_DISCRIMINATOR: ReadonlyUint8Array =
  new Uint8Array([31, 93, 215, 111, 112, 165, 99, 114]);

export function getClaimWelcomePackDiscriminatorBytes(): ReadonlyUint8Array {
  return fixEncoderSize(getBytesEncoder(), 8).encode(
    CLAIM_WELCOME_PACK_DISCRIMINATOR,
  );
}

export type ClaimWelcomePackInstructionData = {
  discriminator: ReadonlyUint8Array;
};

export type ClaimWelcomePackInstructionDataArgs = {};

export function getClaimWelcomePackInstructionDataEncoder(): FixedSizeEncoder<ClaimWelcomePackInstructionDataArgs> {
  return transformEncoder(
    getStructEncoder([["discriminator", fixEncoderSize(getBytesEncoder(), 8)]]),
    (value) => ({ ...value, discriminator: CLAIM_WELCOME_PACK_DISCRIMINATOR }),
  );
}

export function getClaimWelcomePackInstructionDataDecoder(): FixedSizeDecoder<ClaimWelcomePackInstructionData> {
  return getStructDecoder([
    ["discriminator", fixDecoderSize(getBytesDecoder(), 8)],
  ]);
}

export function getClaimWelcomePackInstructionDataCodec(): FixedSizeCodec<
  ClaimWelcomePackInstructionDataArgs,
  ClaimWelcomePackInstructionData
> {
  return combineCodec(
    getClaimWelcomePackInstructionDataEncoder(),
    getClaimWelcomePackInstructionDataDecoder(),
  );
}

export const CREATE_PACK_PLAYER_V2_DISCRIMINATOR: ReadonlyUint8Array =
  new Uint8Array([149, 9, 200, 144, 21, 99, 179, 165]);

export function getCreatePackPlayerV2DiscriminatorBytes(): ReadonlyUint8Array {
  return fixEncoderSize(getBytesEncoder(), 8).encode(
    CREATE_PACK_PLAYER_V2_DISCRIMINATOR,
  );
}

export type CreatePackPlayerV2InstructionData = {
  discriminator: ReadonlyUint8Array;
};

export type CreatePackPlayerV2InstructionDataArgs = {};

export function getCreatePackPlayerV2InstructionDataEncoder(): FixedSizeEncoder<CreatePackPlayerV2InstructionDataArgs> {
  return transformEncoder(
    getStructEncoder([["discriminator", fixEncoderSize(getBytesEncoder(), 8)]]),
    (value) => ({
      ...value,
      discriminator: CREATE_PACK_PLAYER_V2_DISCRIMINATOR,
    }),
  );
}

export function getCreatePackPlayerV2InstructionDataDecoder(): FixedSizeDecoder<CreatePackPlayerV2InstructionData> {
  return getStructDecoder([
    ["discriminator", fixDecoderSize(getBytesDecoder(), 8)],
  ]);
}

export function getCreatePackPlayerV2InstructionDataCodec(): FixedSizeCodec<
  CreatePackPlayerV2InstructionDataArgs,
  CreatePackPlayerV2InstructionData
> {
  return combineCodec(
    getCreatePackPlayerV2InstructionDataEncoder(),
    getCreatePackPlayerV2InstructionDataDecoder(),
  );
}

export const REQUEST_RANDOM_PACK_V2_DISCRIMINATOR: ReadonlyUint8Array =
  new Uint8Array([73, 39, 220, 6, 200, 195, 232, 222]);

export function getRequestRandomPackV2DiscriminatorBytes(): ReadonlyUint8Array {
  return fixEncoderSize(getBytesEncoder(), 8).encode(
    REQUEST_RANDOM_PACK_V2_DISCRIMINATOR,
  );
}

export type RequestRandomPackV2InstructionData = {
  discriminator: ReadonlyUint8Array;
  nonce: bigint;
  maxPrice: bigint;
  maxOracleFee: bigint;
};

export type RequestRandomPackV2InstructionDataArgs = {
  nonce: number | bigint;
  maxPrice: number | bigint;
  maxOracleFee: number | bigint;
};

export function getRequestRandomPackV2InstructionDataEncoder(): FixedSizeEncoder<RequestRandomPackV2InstructionDataArgs> {
  return transformEncoder(
    getStructEncoder([
      ["discriminator", fixEncoderSize(getBytesEncoder(), 8)],
      ["nonce", getU64Encoder()],
      ["maxPrice", getU64Encoder()],
      ["maxOracleFee", getU64Encoder()],
    ]),
    (value) => ({
      ...value,
      discriminator: REQUEST_RANDOM_PACK_V2_DISCRIMINATOR,
    }),
  );
}

export function getRequestRandomPackV2InstructionDataDecoder(): FixedSizeDecoder<RequestRandomPackV2InstructionData> {
  return getStructDecoder([
    ["discriminator", fixDecoderSize(getBytesDecoder(), 8)],
    ["nonce", getU64Decoder()],
    ["maxPrice", getU64Decoder()],
    ["maxOracleFee", getU64Decoder()],
  ]);
}

export function getRequestRandomPackV2InstructionDataCodec(): FixedSizeCodec<
  RequestRandomPackV2InstructionDataArgs,
  RequestRandomPackV2InstructionData
> {
  return combineCodec(
    getRequestRandomPackV2InstructionDataEncoder(),
    getRequestRandomPackV2InstructionDataDecoder(),
  );
}

export const REQUEST_RANDOM_PACK_V3_DISCRIMINATOR: ReadonlyUint8Array =
  new Uint8Array([122, 93, 164, 113, 46, 32, 173, 168]);

export function getRequestRandomPackV3DiscriminatorBytes(): ReadonlyUint8Array {
  return fixEncoderSize(getBytesEncoder(), 8).encode(
    REQUEST_RANDOM_PACK_V3_DISCRIMINATOR,
  );
}

export type RequestRandomPackV3InstructionData = {
  discriminator: ReadonlyUint8Array;
  nonce: bigint;
  maxPrice: bigint;
  maxOracleFee: bigint;
};

export type RequestRandomPackV3InstructionDataArgs = {
  nonce: number | bigint;
  maxPrice: number | bigint;
  maxOracleFee: number | bigint;
};

export function getRequestRandomPackV3InstructionDataEncoder(): FixedSizeEncoder<RequestRandomPackV3InstructionDataArgs> {
  return transformEncoder(
    getStructEncoder([
      ["discriminator", fixEncoderSize(getBytesEncoder(), 8)],
      ["nonce", getU64Encoder()],
      ["maxPrice", getU64Encoder()],
      ["maxOracleFee", getU64Encoder()],
    ]),
    (value) => ({
      ...value,
      discriminator: REQUEST_RANDOM_PACK_V3_DISCRIMINATOR,
    }),
  );
}

export function getRequestRandomPackV3InstructionDataDecoder(): FixedSizeDecoder<RequestRandomPackV3InstructionData> {
  return getStructDecoder([
    ["discriminator", fixDecoderSize(getBytesDecoder(), 8)],
    ["nonce", getU64Decoder()],
    ["maxPrice", getU64Decoder()],
    ["maxOracleFee", getU64Decoder()],
  ]);
}

export function getRequestRandomPackV3InstructionDataCodec(): FixedSizeCodec<
  RequestRandomPackV3InstructionDataArgs,
  RequestRandomPackV3InstructionData
> {
  return combineCodec(
    getRequestRandomPackV3InstructionDataEncoder(),
    getRequestRandomPackV3InstructionDataDecoder(),
  );
}

export const CLAIM_RANDOM_PACK_V2_DISCRIMINATOR: ReadonlyUint8Array =
  new Uint8Array([233, 92, 238, 69, 37, 209, 72, 152]);

export function getClaimRandomPackV2DiscriminatorBytes(): ReadonlyUint8Array {
  return fixEncoderSize(getBytesEncoder(), 8).encode(
    CLAIM_RANDOM_PACK_V2_DISCRIMINATOR,
  );
}

export type ClaimRandomPackV2InstructionData = {
  discriminator: ReadonlyUint8Array;
};

export type ClaimRandomPackV2InstructionDataArgs = {};

export function getClaimRandomPackV2InstructionDataEncoder(): FixedSizeEncoder<ClaimRandomPackV2InstructionDataArgs> {
  return transformEncoder(
    getStructEncoder([["discriminator", fixEncoderSize(getBytesEncoder(), 8)]]),
    (value) => ({
      ...value,
      discriminator: CLAIM_RANDOM_PACK_V2_DISCRIMINATOR,
    }),
  );
}

export function getClaimRandomPackV2InstructionDataDecoder(): FixedSizeDecoder<ClaimRandomPackV2InstructionData> {
  return getStructDecoder([
    ["discriminator", fixDecoderSize(getBytesDecoder(), 8)],
  ]);
}

export function getClaimRandomPackV2InstructionDataCodec(): FixedSizeCodec<
  ClaimRandomPackV2InstructionDataArgs,
  ClaimRandomPackV2InstructionData
> {
  return combineCodec(
    getClaimRandomPackV2InstructionDataEncoder(),
    getClaimRandomPackV2InstructionDataDecoder(),
  );
}

export const CLAIM_RANDOM_PACK_V3_DISCRIMINATOR: ReadonlyUint8Array =
  new Uint8Array([129, 5, 172, 35, 194, 78, 181, 80]);

export function getClaimRandomPackV3DiscriminatorBytes(): ReadonlyUint8Array {
  return fixEncoderSize(getBytesEncoder(), 8).encode(
    CLAIM_RANDOM_PACK_V3_DISCRIMINATOR,
  );
}

export type ClaimRandomPackV3InstructionData = {
  discriminator: ReadonlyUint8Array;
};

export type ClaimRandomPackV3InstructionDataArgs = {};

export function getClaimRandomPackV3InstructionDataEncoder(): FixedSizeEncoder<ClaimRandomPackV3InstructionDataArgs> {
  return transformEncoder(
    getStructEncoder([["discriminator", fixEncoderSize(getBytesEncoder(), 8)]]),
    (value) => ({
      ...value,
      discriminator: CLAIM_RANDOM_PACK_V3_DISCRIMINATOR,
    }),
  );
}

export function getClaimRandomPackV3InstructionDataDecoder(): FixedSizeDecoder<ClaimRandomPackV3InstructionData> {
  return getStructDecoder([
    ["discriminator", fixDecoderSize(getBytesDecoder(), 8)],
  ]);
}

export function getClaimRandomPackV3InstructionDataCodec(): FixedSizeCodec<
  ClaimRandomPackV3InstructionDataArgs,
  ClaimRandomPackV3InstructionData
> {
  return combineCodec(
    getClaimRandomPackV3InstructionDataEncoder(),
    getClaimRandomPackV3InstructionDataDecoder(),
  );
}

export const REFUND_RANDOM_PACK_V2_DISCRIMINATOR: ReadonlyUint8Array =
  new Uint8Array([226, 137, 38, 248, 99, 29, 167, 57]);

export function getRefundRandomPackV2DiscriminatorBytes(): ReadonlyUint8Array {
  return fixEncoderSize(getBytesEncoder(), 8).encode(
    REFUND_RANDOM_PACK_V2_DISCRIMINATOR,
  );
}

export type RefundRandomPackV2InstructionData = {
  discriminator: ReadonlyUint8Array;
};

export type RefundRandomPackV2InstructionDataArgs = {};

export function getRefundRandomPackV2InstructionDataEncoder(): FixedSizeEncoder<RefundRandomPackV2InstructionDataArgs> {
  return transformEncoder(
    getStructEncoder([["discriminator", fixEncoderSize(getBytesEncoder(), 8)]]),
    (value) => ({
      ...value,
      discriminator: REFUND_RANDOM_PACK_V2_DISCRIMINATOR,
    }),
  );
}

export function getRefundRandomPackV2InstructionDataDecoder(): FixedSizeDecoder<RefundRandomPackV2InstructionData> {
  return getStructDecoder([
    ["discriminator", fixDecoderSize(getBytesDecoder(), 8)],
  ]);
}

export function getRefundRandomPackV2InstructionDataCodec(): FixedSizeCodec<
  RefundRandomPackV2InstructionDataArgs,
  RefundRandomPackV2InstructionData
> {
  return combineCodec(
    getRefundRandomPackV2InstructionDataEncoder(),
    getRefundRandomPackV2InstructionDataDecoder(),
  );
}

export const REFUND_RANDOM_PACK_V3_DISCRIMINATOR: ReadonlyUint8Array =
  new Uint8Array([128, 159, 255, 162, 72, 134, 52, 4]);

export function getRefundRandomPackV3DiscriminatorBytes(): ReadonlyUint8Array {
  return fixEncoderSize(getBytesEncoder(), 8).encode(
    REFUND_RANDOM_PACK_V3_DISCRIMINATOR,
  );
}

export type RefundRandomPackV3InstructionData = {
  discriminator: ReadonlyUint8Array;
};

export type RefundRandomPackV3InstructionDataArgs = {};

export function getRefundRandomPackV3InstructionDataEncoder(): FixedSizeEncoder<RefundRandomPackV3InstructionDataArgs> {
  return transformEncoder(
    getStructEncoder([["discriminator", fixEncoderSize(getBytesEncoder(), 8)]]),
    (value) => ({
      ...value,
      discriminator: REFUND_RANDOM_PACK_V3_DISCRIMINATOR,
    }),
  );
}

export function getRefundRandomPackV3InstructionDataDecoder(): FixedSizeDecoder<RefundRandomPackV3InstructionData> {
  return getStructDecoder([
    ["discriminator", fixDecoderSize(getBytesDecoder(), 8)],
  ]);
}

export function getRefundRandomPackV3InstructionDataCodec(): FixedSizeCodec<
  RefundRandomPackV3InstructionDataArgs,
  RefundRandomPackV3InstructionData
> {
  return combineCodec(
    getRefundRandomPackV3InstructionDataEncoder(),
    getRefundRandomPackV3InstructionDataDecoder(),
  );
}

export const CLAIM_GAME_CREATOR_FEES_V1_DISCRIMINATOR: ReadonlyUint8Array =
  new Uint8Array([96, 215, 95, 210, 12, 74, 63, 224]);

export function getClaimGameCreatorFeesV1DiscriminatorBytes(): ReadonlyUint8Array {
  return fixEncoderSize(getBytesEncoder(), 8).encode(
    CLAIM_GAME_CREATOR_FEES_V1_DISCRIMINATOR,
  );
}

export type ClaimGameCreatorFeesV1InstructionData = {
  discriminator: ReadonlyUint8Array;
  amount: bigint;
};

export type ClaimGameCreatorFeesV1InstructionDataArgs = {
  amount: number | bigint;
};

export function getClaimGameCreatorFeesV1InstructionDataEncoder(): FixedSizeEncoder<ClaimGameCreatorFeesV1InstructionDataArgs> {
  return transformEncoder(
    getStructEncoder([
      ["discriminator", fixEncoderSize(getBytesEncoder(), 8)],
      ["amount", getU64Encoder()],
    ]),
    (value) => ({
      ...value,
      discriminator: CLAIM_GAME_CREATOR_FEES_V1_DISCRIMINATOR,
    }),
  );
}

export function getClaimGameCreatorFeesV1InstructionDataDecoder(): FixedSizeDecoder<ClaimGameCreatorFeesV1InstructionData> {
  return getStructDecoder([
    ["discriminator", fixDecoderSize(getBytesDecoder(), 8)],
    ["amount", getU64Decoder()],
  ]);
}

export function getClaimGameCreatorFeesV1InstructionDataCodec(): FixedSizeCodec<
  ClaimGameCreatorFeesV1InstructionDataArgs,
  ClaimGameCreatorFeesV1InstructionData
> {
  return combineCodec(
    getClaimGameCreatorFeesV1InstructionDataEncoder(),
    getClaimGameCreatorFeesV1InstructionDataDecoder(),
  );
}

export const CLAIM_GAME_PLATFORM_FEES_V1_DISCRIMINATOR: ReadonlyUint8Array =
  new Uint8Array([66, 204, 111, 111, 120, 20, 52, 236]);

export function getClaimGamePlatformFeesV1DiscriminatorBytes(): ReadonlyUint8Array {
  return fixEncoderSize(getBytesEncoder(), 8).encode(
    CLAIM_GAME_PLATFORM_FEES_V1_DISCRIMINATOR,
  );
}

export type ClaimGamePlatformFeesV1InstructionData = {
  discriminator: ReadonlyUint8Array;
  amount: bigint;
};

export type ClaimGamePlatformFeesV1InstructionDataArgs = {
  amount: number | bigint;
};

export function getClaimGamePlatformFeesV1InstructionDataEncoder(): FixedSizeEncoder<ClaimGamePlatformFeesV1InstructionDataArgs> {
  return transformEncoder(
    getStructEncoder([
      ["discriminator", fixEncoderSize(getBytesEncoder(), 8)],
      ["amount", getU64Encoder()],
    ]),
    (value) => ({
      ...value,
      discriminator: CLAIM_GAME_PLATFORM_FEES_V1_DISCRIMINATOR,
    }),
  );
}

export function getClaimGamePlatformFeesV1InstructionDataDecoder(): FixedSizeDecoder<ClaimGamePlatformFeesV1InstructionData> {
  return getStructDecoder([
    ["discriminator", fixDecoderSize(getBytesDecoder(), 8)],
    ["amount", getU64Decoder()],
  ]);
}

export function getClaimGamePlatformFeesV1InstructionDataCodec(): FixedSizeCodec<
  ClaimGamePlatformFeesV1InstructionDataArgs,
  ClaimGamePlatformFeesV1InstructionData
> {
  return combineCodec(
    getClaimGamePlatformFeesV1InstructionDataEncoder(),
    getClaimGamePlatformFeesV1InstructionDataDecoder(),
  );
}

export const OBSERVE_GAME_MARKET_V1_DISCRIMINATOR: ReadonlyUint8Array =
  new Uint8Array([65, 154, 113, 8, 14, 139, 177, 37]);

export function getObserveGameMarketV1DiscriminatorBytes(): ReadonlyUint8Array {
  return fixEncoderSize(getBytesEncoder(), 8).encode(
    OBSERVE_GAME_MARKET_V1_DISCRIMINATOR,
  );
}

export type ObserveGameMarketV1InstructionData = {
  discriminator: ReadonlyUint8Array;
};

export type ObserveGameMarketV1InstructionDataArgs = {};

export function getObserveGameMarketV1InstructionDataEncoder(): FixedSizeEncoder<ObserveGameMarketV1InstructionDataArgs> {
  return transformEncoder(
    getStructEncoder([["discriminator", fixEncoderSize(getBytesEncoder(), 8)]]),
    (value) => ({
      ...value,
      discriminator: OBSERVE_GAME_MARKET_V1_DISCRIMINATOR,
    }),
  );
}

export function getObserveGameMarketV1InstructionDataDecoder(): FixedSizeDecoder<ObserveGameMarketV1InstructionData> {
  return getStructDecoder([
    ["discriminator", fixDecoderSize(getBytesDecoder(), 8)],
  ]);
}

export function getObserveGameMarketV1InstructionDataCodec(): FixedSizeCodec<
  ObserveGameMarketV1InstructionDataArgs,
  ObserveGameMarketV1InstructionData
> {
  return combineCodec(
    getObserveGameMarketV1InstructionDataEncoder(),
    getObserveGameMarketV1InstructionDataDecoder(),
  );
}

export const ADVANCE_GAME_STAGE_V1_DISCRIMINATOR: ReadonlyUint8Array =
  new Uint8Array([150, 112, 228, 194, 50, 139, 190, 45]);

export function getAdvanceGameStageV1DiscriminatorBytes(): ReadonlyUint8Array {
  return fixEncoderSize(getBytesEncoder(), 8).encode(
    ADVANCE_GAME_STAGE_V1_DISCRIMINATOR,
  );
}

export type AdvanceGameStageV1InstructionData = {
  discriminator: ReadonlyUint8Array;
};

export type AdvanceGameStageV1InstructionDataArgs = {};

export function getAdvanceGameStageV1InstructionDataEncoder(): FixedSizeEncoder<AdvanceGameStageV1InstructionDataArgs> {
  return transformEncoder(
    getStructEncoder([["discriminator", fixEncoderSize(getBytesEncoder(), 8)]]),
    (value) => ({
      ...value,
      discriminator: ADVANCE_GAME_STAGE_V1_DISCRIMINATOR,
    }),
  );
}

export function getAdvanceGameStageV1InstructionDataDecoder(): FixedSizeDecoder<AdvanceGameStageV1InstructionData> {
  return getStructDecoder([
    ["discriminator", fixDecoderSize(getBytesDecoder(), 8)],
  ]);
}

export function getAdvanceGameStageV1InstructionDataCodec(): FixedSizeCodec<
  AdvanceGameStageV1InstructionDataArgs,
  AdvanceGameStageV1InstructionData
> {
  return combineCodec(
    getAdvanceGameStageV1InstructionDataEncoder(),
    getAdvanceGameStageV1InstructionDataDecoder(),
  );
}

export const EXECUTE_GAME_BUYBACK_V1_DISCRIMINATOR: ReadonlyUint8Array =
  new Uint8Array([255, 179, 6, 120, 84, 216, 46, 182]);

export function getExecuteGameBuybackV1DiscriminatorBytes(): ReadonlyUint8Array {
  return fixEncoderSize(getBytesEncoder(), 8).encode(
    EXECUTE_GAME_BUYBACK_V1_DISCRIMINATOR,
  );
}

export type ExecuteGameBuybackV1InstructionData = {
  discriminator: ReadonlyUint8Array;
  budgetQuote: bigint;
  minTokensOut: bigint;
};

export type ExecuteGameBuybackV1InstructionDataArgs = {
  budgetQuote: number | bigint;
  minTokensOut: number | bigint;
};

export function getExecuteGameBuybackV1InstructionDataEncoder(): FixedSizeEncoder<ExecuteGameBuybackV1InstructionDataArgs> {
  return transformEncoder(
    getStructEncoder([
      ["discriminator", fixEncoderSize(getBytesEncoder(), 8)],
      ["budgetQuote", getU64Encoder()],
      ["minTokensOut", getU64Encoder()],
    ]),
    (value) => ({
      ...value,
      discriminator: EXECUTE_GAME_BUYBACK_V1_DISCRIMINATOR,
    }),
  );
}

export function getExecuteGameBuybackV1InstructionDataDecoder(): FixedSizeDecoder<ExecuteGameBuybackV1InstructionData> {
  return getStructDecoder([
    ["discriminator", fixDecoderSize(getBytesDecoder(), 8)],
    ["budgetQuote", getU64Decoder()],
    ["minTokensOut", getU64Decoder()],
  ]);
}

export function getExecuteGameBuybackV1InstructionDataCodec(): FixedSizeCodec<
  ExecuteGameBuybackV1InstructionDataArgs,
  ExecuteGameBuybackV1InstructionData
> {
  return combineCodec(
    getExecuteGameBuybackV1InstructionDataEncoder(),
    getExecuteGameBuybackV1InstructionDataDecoder(),
  );
}

export const CHECK_GAME_LICENSE_V1_DISCRIMINATOR: ReadonlyUint8Array =
  new Uint8Array([245, 187, 149, 192, 199, 148, 112, 63]);

export function getCheckGameLicenseV1DiscriminatorBytes(): ReadonlyUint8Array {
  return fixEncoderSize(getBytesEncoder(), 8).encode(
    CHECK_GAME_LICENSE_V1_DISCRIMINATOR,
  );
}

export type CheckGameLicenseV1InstructionData = {
  discriminator: ReadonlyUint8Array;
};

export type CheckGameLicenseV1InstructionDataArgs = {};

export function getCheckGameLicenseV1InstructionDataEncoder(): FixedSizeEncoder<CheckGameLicenseV1InstructionDataArgs> {
  return transformEncoder(
    getStructEncoder([["discriminator", fixEncoderSize(getBytesEncoder(), 8)]]),
    (value) => ({
      ...value,
      discriminator: CHECK_GAME_LICENSE_V1_DISCRIMINATOR,
    }),
  );
}

export function getCheckGameLicenseV1InstructionDataDecoder(): FixedSizeDecoder<CheckGameLicenseV1InstructionData> {
  return getStructDecoder([
    ["discriminator", fixDecoderSize(getBytesDecoder(), 8)],
  ]);
}

export function getCheckGameLicenseV1InstructionDataCodec(): FixedSizeCodec<
  CheckGameLicenseV1InstructionDataArgs,
  CheckGameLicenseV1InstructionData
> {
  return combineCodec(
    getCheckGameLicenseV1InstructionDataEncoder(),
    getCheckGameLicenseV1InstructionDataDecoder(),
  );
}
