// Adapted from @solana/wallet-adapter-react 0.15.40 (Apache-2.0); see LICENSE and README.md.
import { type Cluster } from "@solana/web3.js";

export default function getInferredClusterFromEndpoint(
  endpoint?: string,
): Cluster {
  if (!endpoint) {
    return "mainnet-beta";
  }
  if (/devnet/i.test(endpoint)) {
    return "devnet";
  } else if (/testnet/i.test(endpoint)) {
    return "testnet";
  } else {
    return "mainnet-beta";
  }
}
