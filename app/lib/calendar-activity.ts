const FOUNDATION_START_UTC = Date.parse('2026-07-06T00:00:00.000Z');
const FOUNDATION_DAYS = 161;
const DAY_MS = 24 * 60 * 60 * 1000;
const DAY_KEYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;

export type FoundationCompletionSnapshot = Record<string, string[]>;
export type CanonicalMobilityStore = Record<string, Record<string | number, boolean>>;

export function foundationCompletionKeyForDate(dateIso: string): string | null {
  const timestamp = Date.parse(`${dateIso}T00:00:00.000Z`);
  if (!Number.isFinite(timestamp)) return null;
  const elapsed = Math.floor((timestamp - FOUNDATION_START_UTC) / DAY_MS);
  if (elapsed < 0 || elapsed >= FOUNDATION_DAYS) return null;
  const week = Math.floor(elapsed / 7) + 1;
  const day = DAY_KEYS[elapsed % 7];
  return `sfprep:log:foundation:${week}:${day}:completed`;
}

export function hasFoundationWorkoutActivity(
  snapshot: FoundationCompletionSnapshot,
  dateIso: string,
): boolean {
  const key = foundationCompletionKeyForDate(dateIso);
  if (!key) return false;
  return (snapshot[key] ?? []).length > 0;
}

export function countCanonicalMobilityCompletions(
  store: CanonicalMobilityStore,
  dateIso: string,
): number {
  const day = store[dateIso];
  if (!day || typeof day !== 'object') return 0;
  return Object.values(day).filter(Boolean).length;
}
