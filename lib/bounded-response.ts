/** Caps decoded response bytes even when Content-Length is absent or misleading. */
export async function readBoundedResponse(
  response: Response,
  maximumBytes: number,
): Promise<ArrayBuffer> {
  if (!Number.isSafeInteger(maximumBytes) || maximumBytes < 0)
    throw new Error("Invalid response size limit.");
  const body = response.body;
  const advertised = response.headers.get("content-length");
  const encoding = response.headers.get("content-encoding");
  if (
    (!encoding || encoding === "identity") &&
    advertised &&
    /^\d+$/.test(advertised) &&
    BigInt(advertised) > BigInt(maximumBytes)
  ) {
    void body?.cancel().catch(() => {});
    throw new Error("Response exceeds the bounded read size.");
  }
  if (!body) return new ArrayBuffer(0);
  const reader = body.getReader();
  let bytes: Uint8Array<ArrayBuffer> = new Uint8Array(0);
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value.byteLength > maximumBytes - length)
        throw new Error("Response exceeds the bounded read size.");
      const required = length + value.byteLength;
      if (required > bytes.byteLength) {
        const capacity = Math.min(
          maximumBytes,
          Math.max(required, bytes.byteLength * 2, 1024),
        );
        const grown = new Uint8Array(capacity);
        grown.set(bytes);
        bytes = grown;
      }
      bytes.set(value, length);
      length += value.byteLength;
    }
    return bytes.byteLength === length
      ? bytes.buffer
      : bytes.slice(0, length).buffer;
  } catch (error) {
    void reader.cancel().catch(() => {});
    throw error;
  } finally {
    reader.releaseLock();
  }
}
