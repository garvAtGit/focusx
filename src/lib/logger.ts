/**
 * Minimal structured logger.
 *
 * Emits single-line JSON so logs are queryable in Datadog/Vercel without a
 * heavy APM dependency. Never log secrets or PII (Aadhaar, full addresses,
 * tokens) — pass only identifiers and safe metadata.
 */
type LogLevel = 'info' | 'warn' | 'error';

function emit(level: LogLevel, event: string, meta?: Record<string, unknown>) {
  const line = JSON.stringify({ level, event, ts: new Date().toISOString(), ...meta });
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

export const logger = {
  info: (event: string, meta?: Record<string, unknown>) => emit('info', event, meta),
  warn: (event: string, meta?: Record<string, unknown>) => emit('warn', event, meta),
  error: (event: string, meta?: Record<string, unknown>) => emit('error', event, meta),
};
