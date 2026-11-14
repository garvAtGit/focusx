import { createHash } from "node:crypto";

export function assembleCrashDump(prefix: string, size: number, chunks: { offset: number; hex: string }[]): Uint8Array<ArrayBuffer> {
  if (!/^cd_[0-9a-f]{12}_[0-9a-f]{32}$/.test(prefix) || !Number.isInteger(size) || size < 1 || size > 262144) {
    throw new Error("Invalid crash metadata");
  }
  const output = Buffer.alloc(size);
  const seen = new Set<number>();
  let written = 0;
  for (const chunk of [...chunks].sort((a, b) => a.offset - b.offset)) {
    if (seen.has(chunk.offset)) continue;
    if (chunk.offset !== written || !/^(?:[0-9a-f]{2}){1,96}$/.test(chunk.hex)) throw new Error("Incomplete crash dump");
    const data = Buffer.from(chunk.hex, "hex");
    if (written + data.length > size) throw new Error("Invalid chunk length");
    data.copy(output, written); written += data.length; seen.add(chunk.offset);
  }
  if (written !== size) throw new Error("Incomplete crash dump");
  if (createHash("sha256").update(output).digest("hex").slice(0, 32) !== prefix.slice(-32)) {
    throw new Error("Crash checksum mismatch");
  }
  return new Uint8Array(output);
}
