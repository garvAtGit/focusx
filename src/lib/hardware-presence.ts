/**
 * 3-State Presence Finite State Machine (Alex Xu Ch 12 & Martin Kleppmann DDIA Ch 8)
 *
 * Eliminates connection flapping and alert noise caused by transient packet loss.
 * Instead of instantly flipping from ONLINE to OFFLINE after a single missed ping (30s),
 * it introduces an intermediate DEGRADED (45-90s) grace window.
 */

export type PresenceState = "ONLINE" | "DEGRADED" | "OFFLINE";

export interface PresenceEvaluation {
  state: PresenceState;
  label: string;
  badgeClass: string;
  dotClass: string;
  ageSeconds: number;
  isActionableAlert: boolean;
}

export function evaluateHardwarePresence(lastSeenAt: Date | string | null | undefined): PresenceEvaluation {
  if (!lastSeenAt) {
    return {
      state: "OFFLINE",
      label: "Offline",
      badgeClass: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-900",
      dotClass: "bg-rose-500",
      ageSeconds: 999999,
      isActionableAlert: true,
    };
  }

  const dateObj = typeof lastSeenAt === "string" ? new Date(lastSeenAt) : lastSeenAt;
  const ageMs = Date.now() - dateObj.getTime();
  const ageSeconds = Math.max(0, Math.floor(ageMs / 1000));

  // State 1: Active & Healthy (< 45s)
  if (ageSeconds < 45) {
    return {
      state: "ONLINE",
      label: "Online",
      badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900",
      dotClass: "bg-emerald-500",
      ageSeconds,
      isActionableAlert: false,
    };
  }

  // State 2: Transient Jitter / Grace Period (45s - 90s) - No false alarms!
  if (ageSeconds <= 90) {
    return {
      state: "DEGRADED",
      label: "Reconnecting...",
      badgeClass: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-900",
      dotClass: "bg-amber-500 animate-pulse",
      ageSeconds,
      isActionableAlert: false,
    };
  }

  // State 3: Confirmed Offline (> 90s) - Genuine failure requiring notice
  return {
    state: "OFFLINE",
    label: "Offline",
    badgeClass: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-900",
    dotClass: "bg-rose-500",
    ageSeconds,
    isActionableAlert: true,
  };
}
