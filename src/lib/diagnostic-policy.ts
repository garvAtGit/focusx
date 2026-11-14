export const DIAGNOSTIC_SEVERITIES = ["INFO", "WARN", "ERROR", "CRITICAL", "FATAL"] as const;
export type DiagnosticSeverity = typeof DIAGNOSTIC_SEVERITIES[number];

/** Keep raw firmware severity; derive a minimum severity for known reset causes. */
export function diagnosticSeverity(eventCode: number, reason: number | null, reported: string): DiagnosticSeverity {
  const normalized = reported.toUpperCase() as DiagnosticSeverity;
  const base = DIAGNOSTIC_SEVERITIES.includes(normalized) ? normalized : "WARN";
  const minimum: DiagnosticSeverity = eventCode !== 1001 ? "INFO"
    : reason === 4 || reason === 5 || reason === 6 || reason === 7 ? "CRITICAL"
    : reason === 9 ? "ERROR"
    : reason === 1 || reason === 3 || reason === 8 ? "INFO" : "WARN";
  return DIAGNOSTIC_SEVERITIES.indexOf(base) >= DIAGNOSTIC_SEVERITIES.indexOf(minimum) ? base : minimum;
}

/** Legacy firmware IDs are only unique within a device. No database migration needed. */
export function diagnosticStorageId(relayId: string, eventId: string): string {
  return `${relayId}:${eventId}`;
}

export function diagnosticWireId(relayId: string, stored: string): string {
  const prefix = `${relayId}:`;
  return stored.startsWith(prefix) ? stored.slice(prefix.length) : stored;
}

export function diagnosticInteger(value: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): number | null {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < min || value > max) return null;
  return value;
}

export async function readDiagnosticBody(request: Request): Promise<unknown> {
  if (!request.body) throw new Error("Missing body");
  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let size = 0, text = "";
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 65536) { await reader.cancel(); throw new RangeError("Diagnostic body exceeds 64 KB"); }
      text += decoder.decode(value, { stream: true });
    }
    return JSON.parse(text + decoder.decode());
  } finally { reader.releaseLock(); }
}
