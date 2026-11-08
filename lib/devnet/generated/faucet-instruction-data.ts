// Exact data-encoder extraction from committed Codama instructions; account lists are validated separately.

import {
  fixEncoderSize,
  getBytesEncoder,
  getStructEncoder,
  transformEncoder,
  type FixedSizeEncoder,
  type ReadonlyUint8Array,
} from "@solana/kit";

// Source SHA-256: 7f8864a9ceded4549a35b24f355c8e1595cc869da2a3ff2817f677bd237cd127

export const CREATE_FAUCET_CLAIM_DISCRIMINATOR: ReadonlyUint8Array =
  new Uint8Array([160, 97, 234, 77, 11, 115, 191, 241]);

export type CreateFaucetClaimInstructionDataArgs = {};

export function getCreateFaucetClaimInstructionDataEncoder(): FixedSizeEncoder<CreateFaucetClaimInstructionDataArgs> {
  return transformEncoder(
    getStructEncoder([["discriminator", fixEncoderSize(getBytesEncoder(), 8)]]),
    (value) => ({ ...value, discriminator: CREATE_FAUCET_CLAIM_DISCRIMINATOR }),
  );
}

// Source SHA-256: 9d29df882ac536029b5b163f4780cfac6122fe0798dd450b676d64595876868d

export const CLAIM_TEST_TOKENS_DISCRIMINATOR: ReadonlyUint8Array =
  new Uint8Array([214, 44, 182, 173, 157, 35, 25, 172]);

export type ClaimTestTokensInstructionDataArgs = {};

export function getClaimTestTokensInstructionDataEncoder(): FixedSizeEncoder<ClaimTestTokensInstructionDataArgs> {
  return transformEncoder(
    getStructEncoder([["discriminator", fixEncoderSize(getBytesEncoder(), 8)]]),
    (value) => ({ ...value, discriminator: CLAIM_TEST_TOKENS_DISCRIMINATOR }),
  );
}
