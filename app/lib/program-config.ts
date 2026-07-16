// Shared program-wide constants — single source of truth so dates/targets are
// never re-hardcoded ad hoc across page.tsx / calendar/page.tsx / adaptive engine.
// (Blueprint SECTION 3.2 — "Hardcoded Dates" limitation.)

export const PLAN_D_START = new Date('2026-07-06T00:00:00Z');
export const ASVAB_START = new Date('2026-07-13T00:00:00Z');

export const TARGET_NUTRITION = { kcal: 2800, p: 180, c: 320, f: 80 };

// Programmed daily training-volume target used by the Adaptation Engine
// (Blueprint SECTION 2.3). This is the baseline before ACWR-based adjustment.
export const WORKOUT_VOLUME_TARGET_LBS = 12000;

export function getDaysSince(start: Date, current: Date = new Date()): number {
  const diffMs = current.getTime() - start.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1;
}

export function getWeekNumber(dayNumber: number): number {
  return Math.ceil(dayNumber / 7);
}

export function todayISO(d: Date = new Date()): string {
  return d.toISOString().slice(0, 10);
}
