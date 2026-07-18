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
