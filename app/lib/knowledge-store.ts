// Pure, versioned KnowledgeStore state normalization/storage guard.
//
// Mirrors sfre-store.ts's safety contract exactly:
//   - No React imports; storage access is behind an injectable StorageLike
//     so this module is unit-testable without a DOM.
//   - The guarded hydrate path never throws on malformed raw input — it
//     fails *safe* to the versioned default in-memory, WITHOUT ever
//     overwriting whatever bytes are already sitting in storage (so a
//     corrupt-but-inspectable raw value is never silently destroyed).
//   - An empty/absent key writes the versioned default back to storage
//     (first-run bootstrap), same as sfre-store.
//   - This module does NOT implement migration (`legacyMigration` is a
//     carried-through field only, no legacy source is read/migrated here)
//     or any UI-facing mutation helpers — those are WS3's responsibility.
//     `legacyMigration.migratedAt` is the one-time migration gate:
//     null means "not yet migrated", any valid ISO timestamp means
//     "migrated at this time". There is no separate boolean flag.
//
// Storage key is namespaced under `sfprep:knowledge` only, per the approved
// constraint that all new state must live under that key.

export const KNOWLEDGE_STORAGE_KEY = 'sfprep:knowledge';
export const KNOWLEDGE_STORE_VERSION = 1;

// A minimal storage contract (satisfied by window.localStorage) so this
// module can be exercised with a plain in-memory fake in tests.
export type StorageLike = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
};

/** A single unmapped legacy-migration audit row. */
export type UnmappedEntry = {
  rawKey: string; // the raw legacy storage key that could not be mapped
  reason: string; // human-readable reason it was left unmapped
};

/**
 * KnowledgeStore fields follow the Phase 2 shape exactly:
 * version, queue, completions, deferred, notes, lastOpenedContentId,
 * weeklyFocusOrder, needsReview, legacyMigration.
 */
export type KnowledgeStore = {
  version: 1;
  queue: string[]; // canonical IDs queued as practice
  completions: Record<string, { completedAt: string }>; // canonical ID -> completion record
  deferred: string[]; // canonical IDs deferred for later review
  notes: Record<string, string>; // canonical ID -> freeform note text
  lastOpenedContentId: string | null; // canonical content ID
  weeklyFocusOrder: string[]; // canonical IDs, ordered
  needsReview: string[]; // canonical IDs flagged for review
  legacyMigration: {
    migratedAt: string | null; // ISO timestamp; null = not yet migrated (the gate)
    unmapped: UnmappedEntry[]; // audit rows for legacy keys that couldn't be mapped
  };
};

export function defaultKnowledgeStore(): KnowledgeStore {
  return {
    version: KNOWLEDGE_STORE_VERSION,
    queue: [],
    completions: {},
    deferred: [],
    notes: {},
    lastOpenedContentId: null,
    weeklyFocusOrder: [],
    needsReview: [],
    legacyMigration: { migratedAt: null, unmapped: [] },
  };
}

function validIsoOrNull(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const t = Date.parse(value);
  return Number.isFinite(t) ? value : null;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeIdArray(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(isNonEmptyString);
}

/** Normalizes the completions Record<string, { completedAt }>, dropping malformed entries individually. */
function normalizeCompletions(raw: unknown): KnowledgeStore['completions'] {
  if (!isPlainObject(raw)) return {};
  const result: KnowledgeStore['completions'] = {};
  for (const [key, value] of Object.entries(raw)) {
    if (!isNonEmptyString(key)) continue;
    if (!isPlainObject(value)) continue;
    const completedAt = validIsoOrNull(value.completedAt);
    if (!completedAt) continue;
    result[key] = { completedAt };
  }
  return result;
}

/** Normalizes the notes Record<string, string>, dropping malformed entries individually. */
function normalizeNotes(raw: unknown): KnowledgeStore['notes'] {
  if (!isPlainObject(raw)) return {};
  const result: KnowledgeStore['notes'] = {};
  for (const [key, value] of Object.entries(raw)) {
    if (!isNonEmptyString(key)) continue;
    if (!isNonEmptyString(value)) continue;
    result[key] = value;
  }
  return result;
}

/** Normalizes a single unmapped audit row; drops it (returns null) if malformed. */
function normalizeUnmappedEntry(raw: unknown): UnmappedEntry | null {
  if (!isPlainObject(raw)) return null;
  if (!isNonEmptyString(raw.rawKey)) return null;
  if (!isNonEmptyString(raw.reason)) return null;
  return { rawKey: raw.rawKey, reason: raw.reason };
}

function normalizeUnmappedArray(raw: unknown): UnmappedEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map(normalizeUnmappedEntry)
    .filter((u): u is UnmappedEntry => u !== null);
}

function normalizeLegacyMigration(raw: unknown): KnowledgeStore['legacyMigration'] {
  const fallback = defaultKnowledgeStore().legacyMigration;
  if (!isPlainObject(raw)) return fallback;
  const migratedAt = validIsoOrNull(raw.migratedAt);
  const unmapped = normalizeUnmappedArray(raw.unmapped);
  return { migratedAt, unmapped };
}

/**
 * Normalizes a raw (untrusted, possibly-parsed-JSON) value into a versioned
 * KnowledgeStore. Missing/invalid fields fall back to safe defaults; valid
 * existing values are preserved exactly. This function never throws.
 */
export function normalizeKnowledgeStore(raw: unknown): KnowledgeStore {
  const fallback = defaultKnowledgeStore();
  if (!isPlainObject(raw)) {
    return fallback;
  }
  const r = raw;
  return {
    version: KNOWLEDGE_STORE_VERSION,
    queue: normalizeIdArray(r.queue),
    completions: normalizeCompletions(r.completions),
    deferred: normalizeIdArray(r.deferred),
    notes: normalizeNotes(r.notes),
    lastOpenedContentId: isNonEmptyString(r.lastOpenedContentId) ? r.lastOpenedContentId : null,
    weeklyFocusOrder: normalizeIdArray(r.weeklyFocusOrder),
    needsReview: normalizeIdArray(r.needsReview),
    legacyMigration: normalizeLegacyMigration(r.legacyMigration),
  };
}

// --- Guarded client hydration -------------------------------------------------
//
// This module intentionally does not import or call sfprep-sync directly.
// It writes only to the `sfprep:knowledge` key; sfprep-sync's existing
// generic `sfprep:*` mirror (snapshotLocalSfprep) already covers any key
// under that namespace, so no additional wiring is required here. Callers
// (future WS3 page components) own calling pushSfprepSync() themselves
// after a save, exactly as existing pages do.

function safeParse(raw: string): { ok: true; value: unknown } | { ok: false } {
  try {
    return { ok: true, value: JSON.parse(raw) };
  } catch {
    return { ok: false };
  }
}

/**
 * Reads, normalizes, and (only on successfully-parsed input) writes the
 * knowledge store back into storage. A malformed raw string (invalid JSON)
 * is NEVER overwritten — the function returns the safe default in-memory
 * but leaves the corrupt bytes in storage untouched, so no data is silently
 * destroyed and a future manual recovery/inspection remains possible.
 */
export function hydrateKnowledgeStore(storage: StorageLike | undefined | null): KnowledgeStore {
  if (!storage) return defaultKnowledgeStore();
  const raw = storage.getItem(KNOWLEDGE_STORAGE_KEY);
  if (raw === null) {
    const fallback = defaultKnowledgeStore();
    storage.setItem(KNOWLEDGE_STORAGE_KEY, JSON.stringify(fallback));
    return fallback;
  }
  const parsed = safeParse(raw);
  if (!parsed.ok) {
    return defaultKnowledgeStore();
  }
  const normalized = normalizeKnowledgeStore(parsed.value);
  storage.setItem(KNOWLEDGE_STORAGE_KEY, JSON.stringify(normalized));
  return normalized;
}

export function saveKnowledgeStore(store: KnowledgeStore, storage: StorageLike | undefined | null): void {
  if (!storage) return;
  storage.setItem(KNOWLEDGE_STORAGE_KEY, JSON.stringify(store));
}
