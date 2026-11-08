import { getBase58Encoder } from "@solana/kit";
import { createReadTransport, DevnetClient, rpcUnsigned } from "./client";
import { DEVNET_RELEASE } from "./release";
import { key, PROGRAM } from "./wire";
import type { RpcTransport } from "./types";
import {
  getGameTradeV1EventDecoder,
  type GameTradeV1Event,
} from "./generated/events/gameTradeV1";
import {
  getGameStageAdvancedV1EventDecoder,
  type GameStageAdvancedV1Event,
} from "./generated/events/gameStageAdvancedV1";
import {
  getGameHypergraduatedV1EventDecoder,
  type GameHypergraduatedV1Event,
} from "./generated/events/gameHypergraduatedV1";
import {
  getGameFeeClaimedV1EventDecoder,
  type GameFeeClaimedV1Event,
} from "./generated/events/gameFeeClaimedV1";
import {
  getGameBuybackV1EventDecoder,
  type GameBuybackV1Event,
} from "./generated/events/gameBuybackV1";

type EventMap = {
  trade: GameTradeV1Event;
  stage: GameStageAdvancedV1Event;
  hypergraduated: GameHypergraduatedV1Event;
  fees: GameFeeClaimedV1Event;
  buyback: GameBuybackV1Event;
};
export type MarketHistoryEntry = {
  [K in keyof EventMap]: Readonly<{
    kind: K;
    event: EventMap[K];
    signature: string;
    slot: bigint;
    blockTime: bigint | null;
    logIndex: number;
  }>;
}[keyof EventMap];
export type MarketHistory = Readonly<{
  cluster: "devnet";
  genesisHash: string;
  market: string;
  readAtMs: number;
  entries: readonly MarketHistoryEntry[];
  scannedSignatures: number;
  skippedTransactions: number;
  complete: false;
}>;
export type HistoryReadOptions = {
  transport?: RpcTransport;
  signal?: AbortSignal;
  limit?: number;
};
const specs = [
  { kind: "trade", decoder: getGameTradeV1EventDecoder() },
  { kind: "stage", decoder: getGameStageAdvancedV1EventDecoder() },
  { kind: "hypergraduated", decoder: getGameHypergraduatedV1EventDecoder() },
  { kind: "fees", decoder: getGameFeeClaimedV1EventDecoder() },
  { kind: "buyback", decoder: getGameBuybackV1EventDecoder() },
] as const;
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Malformed confirmed transaction.");
  return value as Record<string, unknown>;
}
function validSignature(value: unknown): value is string {
  if (typeof value !== "string" || !/^[1-9A-HJ-NP-Za-km-z]{80,90}$/.test(value))
    return false;
  try {
    return getBase58Encoder().encode(value).length === 64;
  } catch {
    return false;
  }
}
function eventBytes(value: string): Uint8Array {
  if (
    value.length > 1024 ||
    !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(
      value,
    )
  )
    throw new Error("Malformed program data log.");
  const binary = atob(value);
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}
/** Discards failed/incomplete transactions and data emitted by any other invocation frame. */
export function decodeMarketHistoryTransaction(
  value: unknown,
  market: string,
  signature: string,
  expectedSlot: bigint,
): MarketHistoryEntry[] {
  key(market);
  if (!validSignature(signature)) throw new Error("Invalid history signature.");
  const result = object(value),
    meta = object(result.meta),
    transaction = object(result.transaction),
    message = object(transaction.message);
  if (meta.err !== null) return [];
  if (rpcUnsigned(result.slot) !== expectedSlot)
    throw new Error("History slot mismatch.");
  if (
    result.version !== undefined &&
    result.version !== "legacy" &&
    result.version !== 0 &&
    result.version !== 1
  )
    throw new Error("Unsupported history transaction version.");
  if (
    !Array.isArray(transaction.signatures) ||
    transaction.signatures[0] !== signature ||
    !Array.isArray(message.accountKeys)
  )
    throw new Error("History transaction identity mismatch.");
  const loaded =
    meta.loadedAddresses === undefined ? {} : object(meta.loadedAddresses);
  const keys = [
    ...message.accountKeys,
    ...(Array.isArray(loaded.writable) ? loaded.writable : []),
    ...(Array.isArray(loaded.readonly) ? loaded.readonly : []),
  ];
  if (
    keys.some((k) => typeof k !== "string") ||
    !keys.includes(PROGRAM) ||
    !keys.includes(market)
  )
    throw new Error(
      "History transaction does not reference this market/program.",
    );
  keys.forEach((k) => key(k as string));
  if (
    !Array.isArray(meta.logMessages) ||
    meta.logMessages.length > 2000 ||
    meta.logMessages.some((log) => typeof log !== "string" || log.length > 4000)
  )
    throw new Error("Incomplete or oversized transaction logs.");
  const logs = meta.logMessages as string[];
  if (logs.some((log) => /log truncated/i.test(log)))
    throw new Error("Truncated market logs.");
  const blockTime =
    result.blockTime === null ? null : rpcUnsigned(result.blockTime);
  const stack: string[] = [],
    entries: MarketHistoryEntry[] = [];
  for (let logIndex = 0; logIndex < logs.length; logIndex++) {
    const log = logs[logIndex],
      invoke = /^Program ([1-9A-HJ-NP-Za-km-z]+) invoke \[(\d+)\]$/.exec(log),
      end = /^Program ([1-9A-HJ-NP-Za-km-z]+) (success|failed:.*)$/.exec(log);
    if (invoke) {
      key(invoke[1]);
      if (Number(invoke[2]) !== stack.length + 1)
        throw new Error("Invalid invocation log stack.");
      stack.push(invoke[1]);
      continue;
    }
    if (end) {
      if (stack.pop() !== end[1] || end[2] !== "success")
        throw new Error("Failed or unmatched invocation log stack.");
      continue;
    }
    const data = /^Program data: (.+)$/.exec(log);
    if (!data || stack.at(-1) !== PROGRAM) continue;
    const bytes = eventBytes(data[1]);
    for (const spec of specs) {
      // The canonical generated decoder validates its hidden discriminator, and exact size disallows trailing bytes.
      if (bytes.length !== spec.decoder.fixedSize) continue;
      let event: EventMap[keyof EventMap];
      try {
        event = spec.decoder.decode(bytes);
      } catch {
        continue;
      }
      if (event.market !== market) break;
      if (event.timestamp < 0n)
        throw new Error("Invalid market event timestamp.");
      entries.push({
        kind: spec.kind,
        event,
        signature,
        slot: expectedSlot,
        blockTime,
        logIndex,
      } as MarketHistoryEntry);
      break;
    }
  }
  if (stack.length) throw new Error("Incomplete invocation log stack.");
  return entries;
}
/** One bounded confirmed page, never a claim of complete account/financial history. */
export async function readMarketHistory(
  id: string,
  options: HistoryReadOptions = {},
): Promise<MarketHistory> {
  const rpc = options.transport ?? createReadTransport(),
    signal = options.signal,
    limit = options.limit ?? 10;
  if (!Number.isInteger(limit) || limit < 1 || limit > 12)
    throw new Error("History read limit must be between 1 and 12.");
  const snapshot = await new DevnetClient({ transport: rpc }).readMarket(
      id,
      null,
      signal,
    ),
    market = snapshot.config.market;
  const value = await rpc(
    "getSignaturesForAddress",
    [
      market,
      {
        limit,
        commitment: "confirmed",
        minContextSlot: Number(snapshot.readSlot),
      },
    ],
    signal,
  );
  if (!Array.isArray(value) || value.length > limit)
    throw new Error("Malformed bounded market signature page.");
  const seen = new Set<string>();
  const signatures = value.map((item) => {
    const record = object(item);
    if (
      !validSignature(record.signature) ||
      seen.has(record.signature) ||
      !["confirmed", "finalized"].includes(String(record.confirmationStatus))
    )
      throw new Error("Unconfirmed or duplicate history signature.");
    seen.add(record.signature);
    return {
      signature: record.signature,
      slot: rpcUnsigned(record.slot),
      failed: record.err !== null,
    };
  });
  let skippedTransactions = 0;
  const groups = await Promise.all(
    signatures.map(async (record) => {
      if (record.failed) {
        skippedTransactions++;
        return [];
      }
      try {
        const result = await rpc(
          "getTransaction",
          [
            record.signature,
            {
              encoding: "json",
              commitment: "confirmed",
              maxSupportedTransactionVersion: 1,
            },
          ],
          signal,
        );
        if (result === null) {
          skippedTransactions++;
          return [];
        }
        return decodeMarketHistoryTransaction(
          result,
          market,
          record.signature,
          record.slot,
        );
      } catch (error) {
        if (signal?.aborted) throw error;
        skippedTransactions++;
        return [];
      }
    }),
  );
  const entries = groups
    .flat()
    .sort((a, b) =>
      a.slot > b.slot ? -1 : a.slot < b.slot ? 1 : b.logIndex - a.logIndex,
    );
  return Object.freeze({
    cluster: "devnet",
    genesisHash: DEVNET_RELEASE.genesisHash,
    market,
    readAtMs: Date.now(),
    entries: Object.freeze(entries),
    scannedSignatures: signatures.length,
    skippedTransactions,
    complete: false,
  });
}
