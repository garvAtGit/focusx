const OFFSET = 330 * 60_000;
const DAY = 86_400_000;
type Log = { timestamp: Date | string; status: string; libraryId: string };
export function attendanceSummary(logs: Log[], now = new Date()) {
  const days = new Map<string, number>();
  const open = new Map<string, number>();
  let liveMinutes = 0;
  function add(from: number, to: number) {
    for (let cursor = from; cursor < to;) {
      const nextMidnight = (Math.floor((cursor + OFFSET) / DAY) + 1) * DAY - OFFSET;
      const end = Math.min(to, nextMidnight);
      const key = new Date(cursor + OFFSET).toISOString().slice(0, 10);
      days.set(key, (days.get(key) ?? 0) + end - cursor);
      cursor = end;
    }
  }
  for (const log of [...logs].sort((a, b) => +new Date(a.timestamp) - +new Date(b.timestamp))) {
    const at = +new Date(log.timestamp);
    if (!Number.isFinite(at) || at > +now) continue;
    if (log.status === 'CHECK_IN') { if (!open.has(log.libraryId)) open.set(log.libraryId, at); }
    else if (log.status === 'CHECK_OUT' && open.has(log.libraryId)) { add(open.get(log.libraryId)!, at); open.delete(log.libraryId); }
  }
  for (const from of open.values()) {
    const midnight = (Math.floor((from + OFFSET) / DAY) + 1) * DAY - OFFSET;
    // A missing checkout is bounded at midnight, never assigned invented hours.
    if (+now >= midnight) add(from, midnight);
    else liveMinutes += (+now - from) / 60_000;
  }
  const values = [...days.values()].filter(ms => ms > 0);
  return { attendedDays: values.length, totalMinutes: values.reduce((a, b) => a + b, 0) / 60_000, averageMinutes: values.length ? values.reduce((a, b) => a + b, 0) / values.length / 60_000 : 0, liveMinutes, days: Object.fromEntries([...days].map(([date, ms]) => [date, ms / 3_600_000])) };
}

/**
 * Calculates session duration in minutes with safeguards against missing checkouts:
 * - If session crosses midnight into subsequent days and exceeds 16 hours, it is bounded
 *   at midnight (23:59:59.999 IST) of the check-in day.
 * - Single-day or normal sessions are capped at 16 hours max to prevent runaway timers.
 */
export function calculateSafeSessionMinutes(inTime: Date | string, outTime: Date | string): number {
  const start = new Date(inTime).getTime();
  const end = new Date(outTime).getTime();
  const diffMs = Math.max(0, end - start);
  if (diffMs === 0) return 0;

  const toISTDateStr = (t: number) =>
    new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date(t));

  const startDay = toISTDateStr(start);
  const endDay = toISTDateStr(end);
  const crossDay = startDay !== endDay;

  let effectiveDurationMs = diffMs;
  if (crossDay && diffMs > 16 * 60 * 60 * 1000) {
    const [py, pm, pd] = startDay.split('-').map(Number);
    const midnightIST = Date.UTC(py, pm - 1, pd, 23, 59, 59, 999) - (5.5 * 3600 * 1000);
    effectiveDurationMs = Math.max(0, midnightIST - start);
  } else {
    effectiveDurationMs = Math.min(diffMs, 16 * 60 * 60 * 1000);
  }

  return Math.floor(effectiveDurationMs / 60000);
}

