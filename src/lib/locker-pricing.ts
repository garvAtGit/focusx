/** Standalone locker rates are rupees per 30-day billing month. */
export function lockerChargePaise(monthlyRupees: number, days: number): number {
  if (!Number.isFinite(monthlyRupees) || monthlyRupees < 0 || !Number.isFinite(days) || days < 0) throw new Error('Invalid locker price or duration');
  return Math.round(Math.round(monthlyRupees * 100) * days / 30);
}
