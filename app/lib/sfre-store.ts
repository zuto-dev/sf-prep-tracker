// Pure, versioned lifecycle + bodyweight state normalization/migration.
// No React imports. Storage access is guarded behind an injectable
// StorageLike interface so this module stays unit-testable without a DOM,
// and so the guarded client hydration path can never throw on a malformed
// raw value — it must fail *safe* (fall back to the versioned default)
// without ever overwriting whatever bytes are already sitting in storage.

import { FOUNDATION_START } from './sfre-program.ts';

export const LIFECYCLE_STORAGE_KEY = 'sfprep:lifecycle';
export const BODYWEIGHT_STORAGE_KEY = 'sfprep:bodyweight';

export const LIFECYCLE_STORE_VERSION = 1;
export const BODYWEIGHT_STORE_VERSION = 1;

// A minimal storage contract (satisfied by window.localStorage) so this
// module can be exercised with a plain in-memory fake in tests.
export type StorageLike = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
};

// --- Lifecycle store ---------------------------------------------------------

export type LifecycleStore = {
  version: number;
  foundationStart: string; // ISO
  confirmedSfreDate: string | null; // ISO
  bridgeStartedAt: string | null; // ISO
};

export function defaultLifecycleStore(): LifecycleStore {
  return {
    version: LIFECYCLE_STORE_VERSION,
    foundationStart: FOUNDATION_START.toISOString(),
    confirmedSfreDate: null,
    bridgeStartedAt: null,
  };
}

function validIsoOrNull(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const t = Date.parse(value);
  return Number.isFinite(t) ? value : null;
}

/**
 * Normalizes a raw (untrusted, possibly-parsed-JSON) value into a versioned
 * LifecycleStore. Missing/invalid fields fall back to safe defaults; valid
 * existing values are preserved exactly. This function never throws.
 */
export function normalizeLifecycleStore(raw: unknown): LifecycleStore {
  const fallback = defaultLifecycleStore();
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return fallback;
  }
  const r = raw as Record<string, unknown>;
  return {
    version: LIFECYCLE_STORE_VERSION,
    foundationStart: validIsoOrNull(r.foundationStart) ?? fallback.foundationStart,
    confirmedSfreDate: validIsoOrNull(r.confirmedSfreDate),
    bridgeStartedAt: validIsoOrNull(r.bridgeStartedAt),
  };
}

// --- Bodyweight store ---------------------------------------------------------

export type BodyweightPointRecord = {
  date: string; // YYYY-MM-DD
  recordedAt: string; // ISO timestamp
  value: number;
};

export type BodyweightStore = {
  version: number;
  points: BodyweightPointRecord[];
};

export function defaultBodyweightStore(): BodyweightStore {
  return { version: BODYWEIGHT_STORE_VERSION, points: [] };
}

function normalizeBodyweightPoint(raw: unknown): BodyweightPointRecord | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  const date = typeof r.date === 'string' ? r.date : '';
  const value = typeof r.value === 'number' ? r.value : Number(r.value);
  if (!date || !Number.isFinite(value) || !Number.isFinite(Date.parse(date))) return null;
  const recordedAt = validIsoOrNull(r.recordedAt) ?? `${date}T12:00:00.000Z`;
  return { date, recordedAt, value };
}

/**
 * Normalizes a raw (untrusted) value into a versioned BodyweightStore.
 * Individually malformed points are dropped without discarding valid
 * siblings; a missing/invalid `recordedAt` is safely defaulted to noon UTC
 * on the point's date rather than rejecting the whole point.
 */
export function normalizeBodyweightStore(raw: unknown): BodyweightStore {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return defaultBodyweightStore();
  }
  const r = raw as Record<string, unknown>;
  const rawPoints = Array.isArray(r.points) ? r.points : [];
  const points = rawPoints
    .map(normalizeBodyweightPoint)
    .filter((p): p is BodyweightPointRecord => p !== null)
    .sort((a, b) => a.date.localeCompare(b.date));
  return { version: BODYWEIGHT_STORE_VERSION, points };
}

/** Inserts or replaces the point for a given date, keeping points sorted by date. */
export function upsertBodyweightPoint(
  store: BodyweightStore,
  point: { date: string; value: number; recordedAt?: string },
): BodyweightStore {
  const recordedAt = point.recordedAt ?? new Date().toISOString();
  const withoutDate = store.points.filter(p => p.date !== point.date);
  const next = [...withoutDate, { date: point.date, value: point.value, recordedAt }]
    .sort((a, b) => a.date.localeCompare(b.date));
  return { version: BODYWEIGHT_STORE_VERSION, points: next };
}

// --- Guarded client hydration -------------------------------------------------
//
// These functions integrate with the existing generic sfprep-sync transport
// indirectly: sfprep-sync mirrors *every* `sfprep:*` localStorage key
// (see snapshotLocalSfprep in sfprep-sync.ts), so writing the normalized
// store back to the same key under hydrate*/save* keeps it in the sync
// mirror automatically. This module intentionally does not import or call
// sfprep-sync directly — callers (page components) already own that wiring
// and continue to call pushSfprepSync() themselves after a save, exactly as
// the existing nutrition/workouts pages do.

function safeParse(raw: string): { ok: true; value: unknown } | { ok: false } {
  try {
    return { ok: true, value: JSON.parse(raw) };
  } catch {
    return { ok: false };
  }
}

/**
 * Reads, normalizes, and (only on successfully-parsed input) migrates the
 * lifecycle store back into storage. A malformed raw string (invalid JSON)
 * is NEVER overwritten — the function returns the safe default in-memory
 * but leaves the corrupt bytes in storage untouched, so no data is silently
 * destroyed and a future manual recovery/inspection remains possible.
 */
export function hydrateLifecycleStore(storage: StorageLike | undefined | null): LifecycleStore {
  if (!storage) return defaultLifecycleStore();
  const raw = storage.getItem(LIFECYCLE_STORAGE_KEY);
  if (raw === null) {
    const fallback = defaultLifecycleStore();
    storage.setItem(LIFECYCLE_STORAGE_KEY, JSON.stringify(fallback));
    return fallback;
  }
  const parsed = safeParse(raw);
  if (!parsed.ok) {
    return defaultLifecycleStore();
  }
  const normalized = normalizeLifecycleStore(parsed.value);
  storage.setItem(LIFECYCLE_STORAGE_KEY, JSON.stringify(normalized));
  return normalized;
}

/** Bodyweight-store counterpart of hydrateLifecycleStore — same safety contract. */
export function hydrateBodyweightStore(storage: StorageLike | undefined | null): BodyweightStore {
  if (!storage) return defaultBodyweightStore();
  const raw = storage.getItem(BODYWEIGHT_STORAGE_KEY);
  if (raw === null) {
    const fallback = defaultBodyweightStore();
    storage.setItem(BODYWEIGHT_STORAGE_KEY, JSON.stringify(fallback));
    return fallback;
  }
  const parsed = safeParse(raw);
  if (!parsed.ok) {
    return defaultBodyweightStore();
  }
  const normalized = normalizeBodyweightStore(parsed.value);
  storage.setItem(BODYWEIGHT_STORAGE_KEY, JSON.stringify(normalized));
  return normalized;
}

export function saveLifecycleStore(store: LifecycleStore, storage: StorageLike | undefined | null): void {
  if (!storage) return;
  storage.setItem(LIFECYCLE_STORAGE_KEY, JSON.stringify(store));
}

export function saveBodyweightStore(store: BodyweightStore, storage: StorageLike | undefined | null): void {
  if (!storage) return;
  storage.setItem(BODYWEIGHT_STORAGE_KEY, JSON.stringify(store));
}
