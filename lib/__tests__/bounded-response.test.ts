import { describe, expect, it, vi } from "vitest";
import { readBoundedResponse } from "../bounded-response";
import { createReadTransport } from "../devnet/client";

function streamed(chunks: number[][], headers: Record<string, string> = {}) {
  const cancel = vi.fn();
  let index = 0;
  const response = new Response(
    new ReadableStream({
      pull(controller) {
        if (index === chunks.length) controller.close();
        else controller.enqueue(new Uint8Array(chunks[index++]));
      },
      cancel,
    }),
    { headers },
  );
  return { response, cancel };
}

describe("bounded network reads", () => {
  it("handles heavily fragmented responses without retaining a list of chunks", async () => {
    let remaining = 100_000;
    const response = new Response(
      new ReadableStream({
        pull(controller) {
          if (remaining-- > 0) controller.enqueue(new Uint8Array([7]));
          else controller.close();
        },
      }),
    );
    const result = new Uint8Array(await readBoundedResponse(response, 100_000));
    expect(result.byteLength).toBe(100_000);
    expect(result[0]).toBe(7);
    expect(result[result.byteLength - 1]).toBe(7);
  });
  it("returns exact bytes at the limit across arbitrary chunks", async () => {
    const { response, cancel } = streamed([[1], [2, 3], [4]]);
    expect(new Uint8Array(await readBoundedResponse(response, 4))).toEqual(
      new Uint8Array([1, 2, 3, 4]),
    );
    expect(cancel).not.toHaveBeenCalled();
    expect(response.body?.locked).toBe(false);
  });
  it.each([{} as Record<string, string>, { "content-length": "1" }])(
    "cancels oversized chunked bodies despite absent or false size headers: %j",
    async (headers) => {
      const { response, cancel } = streamed([[1, 2], [3, 4], [5]], headers);
      await expect(readBoundedResponse(response, 3)).rejects.toThrow(/bounded/);
      expect(cancel).toHaveBeenCalledOnce();
      expect(response.body?.locked).toBe(false);
    },
  );
  it("rejects an advertised oversized identity body before reading it", async () => {
    const { response, cancel } = streamed([[1]], { "content-length": "50" });
    await expect(readBoundedResponse(response, 3)).rejects.toThrow(/bounded/);
    expect(cancel).toHaveBeenCalledOnce();
  });
  it("bounds decoded bytes instead of comparing compressed Content-Length", async () => {
    const { response } = streamed([[1]], {
      "content-length": "21",
      "content-encoding": "gzip",
    });
    expect(new Uint8Array(await readBoundedResponse(response, 1))).toEqual(
      new Uint8Array([1]),
    );
  });
  it("does not parse an oversized untrusted RPC response", async () => {
    const { response, cancel } = streamed([
      Array(1_000_001).fill(32),
      Array(1_000_000).fill(32),
      [32],
    ]);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response));
    try {
      await expect(createReadTransport()("getGenesisHash", [])).rejects.toThrow(
        /bounded/,
      );
      expect(cancel).toHaveBeenCalledOnce();
    } finally {
      vi.unstubAllGlobals();
    }
  });
  it("preserves normal RPC identity validation", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response(
            JSON.stringify({ jsonrpc: "2.0", id: 1, result: "devnet" }),
          ),
        ),
    );
    try {
      await expect(createReadTransport()("getGenesisHash", [])).resolves.toBe(
        "devnet",
      );
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
