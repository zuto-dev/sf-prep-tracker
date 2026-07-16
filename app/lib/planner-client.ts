import { pushSfprepSync } from './sfprep-sync';
import { PLAN_KEY, emptyPlan, parsePlan, type WeeklyPlan } from './planner';

const MEALS_KEY = 'sfprep:meals';

function isBrowser() {
  return typeof window !== 'undefined';
}

/** Reads the new planner key safely; malformed values never break Calendar rendering. */
export function loadPlan(): WeeklyPlan {
  if (!isBrowser()) return emptyPlan();
  return parsePlan(window.localStorage.getItem(PLAN_KEY));
}

/**
 * Persists only planning data. The generic sfprep sync engine discovers this key
 * automatically on push; it never modifies actual sfprep:nutrition day logs.
 */
export async function savePlan(plan: WeeklyPlan): Promise<boolean> {
  if (!isBrowser()) return false;
  window.localStorage.setItem(PLAN_KEY, JSON.stringify(plan));
  return pushSfprepSync();
}

/**
 * Current meal storage is a raw array. The object fallback preserves compatibility
 * with older browser snapshots without copying Calendar's old `.meals` mismatch.
 */
export function readSavedMealArray<T>(): T[] {
  if (!isBrowser()) return [];
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(MEALS_KEY) || '[]');
    if (Array.isArray(parsed)) return parsed as T[];
    if (parsed && typeof parsed === 'object' && Array.isArray((parsed as { meals?: unknown }).meals)) {
      return (parsed as { meals: T[] }).meals;
    }
    return [];
  } catch {
    return [];
  }
}
