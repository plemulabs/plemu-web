import { expect, it } from "vitest";
import { DevnetClient } from "../client";
import { DEVNET_PACKS } from "../release";
import fixture from "./fixtures/readonly-live-pack.json";

it("reads fresh pack inventory and independent rent concurrently after network guards", async () => {
  let index = 0,
    active = 0,
    maximumActive = 0;
  const client = new DevnetClient({
    transport: async (method, params) => {
      const call = fixture.calls[index++];
      expect(method).toBe(call.method);
      expect(params).toEqual(call.params);
      active++;
      maximumActive = Math.max(maximumActive, active);
      await new Promise((resolve) => setTimeout(resolve, 5));
      active--;
      return structuredClone(call.result);
    },
  });
  const snapshot = await client.readPack(
    DEVNET_PACKS[0].rosterKey,
    fixture.wallet,
  );
  expect(snapshot.phase).toBe("delivered");
  expect(snapshot.readSlot).toBe(
    BigInt(
      (fixture.calls[3].result as { context: { slot: number } }).context.slot,
    ),
  );
  expect(index).toBe(fixture.calls.length);
  expect(maximumActive).toBe(2);
});
