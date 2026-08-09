// Pure knowledge domain engine: canonical identity derivation + curation
// gating for the SF Prep Knowledge substrate.
//
// Hard constraints (do not relax without a spec change):
//   - NO React/DOM/network/page/sfprep-sync/Intel imports. This module must
//     be importable and fully exercised under plain `node:test` with zero
//     DOM globals and zero network access.
//   - Owns a private, non-cryptographic, deterministic `shortHash`. This is
//     intentionally NOT the same algorithm as sfprep-sync's `cheapHash` and
//     is never exported — nothing outside this file may depend on the
//     specific hash implementation, only on the fact that it is stable for
//     a given normalized input.
//   - Uses its own structural `PodLike`/`SkillLike` types (a minimal shape
//     subset) rather than importing Pod/Skill from pods-engine.ts, so this
//     module has zero import coupling to the Pods feature.
//   - Curation resolution is pure and fail-safe: with no overlay data,
//     everything resolves to 'unclassified', which is NOT practice-queueable.
//     Only an explicit 'foundation_safe' overlay entry unlocks
//     `canQueueAsPractice`. This file does not create or ship any static
//     overlay data set (that is WS2's job) — callers pass an overlay in.

// --- Structural content types (decoupled from pods-engine.ts) --------------

/** Minimal shape of a skill as it appears inside a knowledge content item. */
export type SkillLike = {
  title: string;
  detail: string;
};

/** Minimal shape of a piece of knowledge content (e.g. a pod/episode). */
export type PodLike = {
  date: string; // YYYY-MM-DD
  title: string;
  skills?: SkillLike[];
};

// --- Private deterministic non-cryptographic hash ---------------------------
//
// FNV-1a (32-bit) variant. Deliberately distinct from sfprep-sync's
// `cheapHash` (different algorithm, different module, never exported) so
// the two hashing concerns never become accidentally coupled.

function shortHash(input: string): string {
  let hash = 0x811c9dc5; // FNV offset basis (32-bit)
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193); // FNV prime (32-bit)
  }
  // Force unsigned, base36 for compactness.
  return (hash >>> 0).toString(36);
}

// --- Normalization + slugging ------------------------------------------------

/**
 * Normalizes free text for identity derivation: trims, lowercases, and
 * collapses internal whitespace. Two titles/details that differ only in
 * case or incidental whitespace must derive the same identity.
 */
export function normalizeForIdentity(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Slugifies text into a URL/ID-safe token: normalizes first, then strips
 * anything that isn't an alphanumeric run, joining with hyphens. Always
 * returns a non-empty string ('untitled' fallback) so a canonical ID is
 * never built from an empty segment.
 */
export function slugify(value: string): string {
  const normalized = normalizeForIdentity(value);
  const slug = normalized
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug.length > 0 ? slug : 'untitled';
}

// --- Canonical IDs ------------------------------------------------------------

/**
 * Canonical content ID: `pod:<date>:<slug-title>`. Deterministic — the same
 * (date, title) pair always derives the same ID, independent of incidental
 * whitespace/case in the title.
 */
export function contentId(date: string, title: string): string {
  return `pod:${date}:${slugify(title)}`;
}

/**
 * Canonical skill ID, derived from its owning content ID + the slugified
 * skill title + a private shortHash of the normalized detail text. This
 * makes the skill ID stable across re-ordering (no positional index is
 * ever used as part of identity) while still disambiguating two skills
 * that happen to share a title but differ in detail.
 */
export function skillId(ownerContentId: string, skillTitle: string, detail: string): string {
  const detailHash = shortHash(normalizeForIdentity(detail));
  return `${ownerContentId}:skill:${slugify(skillTitle)}:${detailHash}`;
}

/** Convenience: derive the content ID directly from a PodLike. */
export function podContentId(pod: PodLike): string {
  return contentId(pod.date, pod.title);
}

/** Convenience: derive all canonical skill IDs for a PodLike's skills. */
export function podSkillIds(pod: PodLike): string[] {
  const owner = podContentId(pod);
  return (pod.skills ?? []).map(s => skillId(owner, s.title, s.detail));
}

// --- Curation ------------------------------------------------------------------

/**
 * Curation status for a piece of knowledge content or a derived skill.
 *  - 'foundation_safe': explicitly reviewed and cleared to be queued as
 *    practice work.
 *  - 'reference_only': explicitly reviewed but intentionally excluded from
 *    the practice queue (informational/context only).
 *  - 'unclassified': no curation decision has been made yet. This is the
 *    fail-safe default for anything absent from the overlay.
 */
export type CurationStatus = 'foundation_safe' | 'reference_only' | 'unclassified';

/** Overlay mapping canonical IDs to an explicit curation decision. */
export type CurationOverlay = Readonly<Record<string, CurationStatus>>;

const DEFAULT_CURATION_STATUS: CurationStatus = 'unclassified';

/**
 * Resolves the curation status for a canonical ID against an optional
 * overlay. Pure default resolution only — no static overlay data is
 * created or shipped here (WS2 owns any real curation data set). Absent
 * overlay entries — and an absent overlay itself — resolve to
 * 'unclassified', never to 'foundation_safe'.
 */
export function resolveCuration(id: string, overlay?: CurationOverlay): CurationStatus {
  if (!overlay) return DEFAULT_CURATION_STATUS;
  const status = overlay[id];
  if (status === 'foundation_safe' || status === 'reference_only' || status === 'unclassified') {
    return status;
  }
  return DEFAULT_CURATION_STATUS;
}

/**
 * Hard gate: only an explicit 'foundation_safe' curation status may be
 * queued as practice. Both 'reference_only' and 'unclassified' — including
 * anything unrecognized — are rejected. This function must never be
 * "loosened" to admit anything else; it is the single safety chokepoint
 * between curated content and the practice queue.
 */
export function canQueueAsPractice(status: CurationStatus): boolean {
  return status === 'foundation_safe';
}

// --- WS3: legacy checkbox migration + safe KnowledgeStore mutations ---------
//
// Everything below is pure: no React/DOM/storage/network access. Callers
// (future WS3 page components) own reading/writing KnowledgeStore via
// knowledge-store.ts's hydrate/save and own reading the legacy raw value
// from wherever it lives; this module never touches storage directly and
// never mutates its input arguments.

import type { KnowledgeStore, UnmappedEntry } from './knowledge-store.ts';

function isPlainObjectLocal(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Structural check for a usable, nonempty pod array: every element must be
 * a plain object carrying at least string `date` and `title` fields (the
 * minimum PodLike requires). A pod's `skills` array may be absent/empty.
 */
function isUsablePodArray(pods: unknown): pods is PodLike[] {
  if (!Array.isArray(pods) || pods.length === 0) return false;
  return pods.every(p =>
    isPlainObjectLocal(p) &&
    typeof (p as Record<string, unknown>).date === 'string' &&
    typeof (p as Record<string, unknown>).title === 'string',
  );
}

/**
 * Builds a `date:index` -> canonical skillId lookup from a validated pod
 * array. `index` is the skill's position within its owning pod's `skills`
 * array (0-based), matching the legacy checkbox key shape. When multiple
 * pods share the same date, the last pod in the array wins for that date's
 * indices (deterministic, order-dependent — same rule a caller would see
 * from array iteration).
 */
function buildLegacySkillIndexMap(pods: PodLike[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const pod of pods) {
    const owner = podContentId(pod);
    const skills = pod.skills ?? [];
    skills.forEach((skill, index) => {
      map.set(`${pod.date}:${index}`, skillId(owner, skill.title, skill.detail));
    });
  }
  return map;
}

/** Parses a legacy raw key of the form `date:index`. Returns null if malformed. */
function parseLegacyKey(rawKey: string): { date: string; index: number } | null {
  const lastColon = rawKey.lastIndexOf(':');
  if (lastColon <= 0 || lastColon === rawKey.length - 1) return null;
  const date = rawKey.slice(0, lastColon);
  const indexPart = rawKey.slice(lastColon + 1);
  if (!/^\d+$/.test(indexPart)) return null;
  const index = Number(indexPart);
  if (!Number.isSafeInteger(index) || index < 0) return null;
  return { date, index };
}

/**
 * Migrates legacy `date:index` -> boolean checkbox completions into
 * content-derived skill IDs on a KnowledgeStore's `completions` field.
 *
 * Safety contract:
 *  - Idempotent: if `store.legacyMigration.migratedAt` is already non-null,
 *    the store is returned completely unchanged (same values, new object
 *    identity not guaranteed either way — callers must not rely on identity).
 *  - Never reads/writes/deletes the legacy raw source itself — this function
 *    only reads `legacyRaw` as a plain in-memory value and returns a new
 *    KnowledgeStore; the caller owns the legacy storage key's lifecycle.
 *  - Defers (returns the store unchanged, migratedAt stays null) when `pods`
 *    is not a usable nonempty array — migration cannot safely resolve
 *    identities without loaded content, so it does not guess.
 *  - Treats a malformed `legacyRaw` (anything other than a plain object,
 *    including arrays/strings/numbers) as a hard failure: returns the store
 *    unchanged, does NOT set migratedAt (so a future call with valid data
 *    can still migrate).
 *  - Treats a missing/empty legacyRaw (undefined, null, or `{}`) as a valid
 *    "nothing to migrate" case when pods ARE usable: marks migratedAt,
 *    leaves completions/unmapped untouched otherwise.
 *  - For each `true`-valued legacy entry: on successful resolution, adds a
 *    completion (does not overwrite an existing completion for that ID).
 *    On failure to resolve (malformed key, unknown date, out-of-range
 *    index), appends `{ rawKey, reason }` to `unmapped` — the entry is
 *    never silently discarded.
 *  - `false`-valued legacy entries are treated as valid "not completed"
 *    state and are neither migrated nor recorded as unmapped.
 */
export function migrateLegacyCompletions(
  store: KnowledgeStore,
  legacyRaw: unknown,
  pods: unknown,
  nowIso: string,
): KnowledgeStore {
  // Idempotency gate: already migrated, never touch again.
  if (store.legacyMigration.migratedAt !== null) {
    return store;
  }

  // Migration cannot proceed without usable, nonempty pod content.
  if (!isUsablePodArray(pods)) {
    return store;
  }

  // A present-but-malformed legacy raw value is a hard failure: defer
  // entirely rather than guess at partial data.
  const isEmptyOrMissing = legacyRaw === undefined || legacyRaw === null;
  if (!isEmptyOrMissing && !isPlainObjectLocal(legacyRaw)) {
    return store;
  }

  const indexMap = buildLegacySkillIndexMap(pods);
  const entries = isEmptyOrMissing ? [] : Object.entries(legacyRaw as Record<string, unknown>);

  const newCompletions: KnowledgeStore['completions'] = { ...store.completions };
  const newUnmapped: UnmappedEntry[] = [...store.legacyMigration.unmapped];

  for (const [rawKey, value] of entries) {
    if (value === false) continue; // valid "not completed" — nothing to do
    if (value !== true) {
      newUnmapped.push({ rawKey, reason: 'non-boolean legacy value' });
      continue;
    }
    const parsed = parseLegacyKey(rawKey);
    if (!parsed) {
      newUnmapped.push({ rawKey, reason: 'malformed key format (expected date:index)' });
      continue;
    }
    const mappedId = indexMap.get(`${parsed.date}:${parsed.index}`);
    if (!mappedId) {
      newUnmapped.push({ rawKey, reason: 'no matching pod/skill found for date/index' });
      continue;
    }
    if (!(mappedId in newCompletions)) {
      newCompletions[mappedId] = { completedAt: nowIso };
    }
  }

  return {
    ...store,
    completions: newCompletions,
    legacyMigration: { migratedAt: nowIso, unmapped: newUnmapped },
  };
}

// --- Queue / completion / defer / note mutations ----------------------------

/**
 * Adds a canonical ID to the practice queue, gated by the hard
 * `canQueueAsPractice` chokepoint. No-ops (returns the store unchanged) when
 * the given curation status is not `foundation_safe`, or when the ID is
 * already present in the queue (dedupe). Only the `queue` field ever
 * changes.
 */
export function addToQueue(store: KnowledgeStore, id: string, status: CurationStatus): KnowledgeStore {
  if (!canQueueAsPractice(status)) return store;
  if (store.queue.includes(id)) return store;
  return { ...store, queue: [...store.queue, id] };
}

/**
 * Records a completion timestamp for a canonical ID. Only the `completions`
 * field ever changes. Overwrites any prior completion for the same ID
 * (re-completing is allowed and simply updates the timestamp).
 */
export function completeItem(store: KnowledgeStore, id: string, nowIso: string): KnowledgeStore {
  return {
    ...store,
    completions: { ...store.completions, [id]: { completedAt: nowIso } },
  };
}

/**
 * Marks a canonical ID as deferred for later review. Only the `deferred`
 * field ever changes. Dedupes — deferring an already-deferred ID is a no-op.
 */
export function deferItem(store: KnowledgeStore, id: string): KnowledgeStore {
  if (store.deferred.includes(id)) return store;
  return { ...store, deferred: [...store.deferred, id] };
}

/**
 * Sets a freeform note for a canonical ID. Only the `notes` field ever
 * changes.
 */
export function noteItem(store: KnowledgeStore, id: string, text: string): KnowledgeStore {
  return { ...store, notes: { ...store.notes, [id]: text } };
}

/**
 * Re-evaluates every queued ID against a (possibly updated) curation
 * overlay. Any queued ID that no longer resolves to `foundation_safe` is
 * added to `needsReview` (deduped). This function NEVER removes anything
 * from `queue`, `notes`, or `completions` — it only ever appends to
 * `needsReview`, preserving all existing history.
 */
export function reconcileQueue(store: KnowledgeStore, overlay?: CurationOverlay): KnowledgeStore {
  const newlyFlagged = store.queue.filter(id => !canQueueAsPractice(resolveCuration(id, overlay)));
  const needsReview = [...store.needsReview];
  for (const id of newlyFlagged) {
    if (!needsReview.includes(id)) needsReview.push(id);
  }
  if (needsReview.length === store.needsReview.length) return store;
  return { ...store, needsReview };
}
