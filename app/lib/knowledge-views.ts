// Pure derived VIEW selectors for the SF Prep Knowledge substrate (WS4).
//
// Hard constraints (do not relax without a spec change):
//   - NO React/DOM/network/storage imports. This module must be importable
//     and fully exercised under plain `node:test` with zero DOM globals and
//     zero network access, matching knowledge-engine.ts's contract.
//   - NEVER mutates a KnowledgeStore and NEVER calls any of
//     knowledge-engine.ts's mutation helpers (addToQueue/completeItem/
//     deferItem/noteItem/reconcileQueue). Every function here is a read-only
//     projection over (store, pods, curation) -> view data.
//   - Uses structural pod/skill types (a superset of knowledge-engine's
//     PodLike/SkillLike) rather than importing Pod/Skill from
//     pods-engine.ts, so this module stays decoupled from the Pods feature
//     exactly like knowledge-engine.ts is.
//   - Architecture Amendment 3: Calendar will eventually read-only fetch the
//     existing /pods.json itself (knowledge state only ever stores canonical
//     IDs, never human labels). `deriveKnowledgeFocusSnapshot` is written
//     for that shape: when `pods` is unavailable/unusable it returns a
//     graceful "unavailable" state plus safe counts derived purely from the
//     store — it never throws and never fabricates a label.
//   - Curation is resolved via `resolveCuration`/`getCurationRecord`; an ID
//     absent from the overlay (or the whole overlay missing) fails safe to
//     'unclassified', which this module always treats as reference-only —
//     i.e. never actionable/practice-queueable, exactly like
//     `canQueueAsPractice` already enforces upstream.

import {
  skillId,
  podContentId,
  resolveCuration,
  canQueueAsPractice,
  type PodLike,
  type SkillLike,
  type CurationOverlay,
  type CurationStatus,
} from './knowledge-engine.ts';

import {
  CURATION_OVERLAY,
  getCurationRecord,
  type CurationDomain,
  type PhaseRelevance,
  type SafetyStatus,
  type SourceConfidence,
} from './knowledge-curation.ts';

import type { KnowledgeStore } from './knowledge-store.ts';

// --- Structural view-facing pod/skill types ----------------------------------
//
// A superset of knowledge-engine's PodLike/SkillLike carrying the additional
// real text fields (summary/takeaways/homework/source) that only this
// display layer needs for text search / metadata — still zero import
// coupling to pods-engine.ts's Pod/Skill types.

export type ViewSkillLike = SkillLike;

export type ViewPodLike = PodLike & {
  summary?: string;
  takeaways?: readonly string[];
  homework?: string;
  source?: string;
};

// --- Shared helpers -----------------------------------------------------------

function isPlainObjectLocal(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Structural, defensive check for a usable, nonempty pod array: every
 * element must be a plain object carrying at least string `date`/`title`
 * fields. Mirrors knowledge-engine's own `isUsablePodArray` gate (kept as a
 * private, local copy so this module has no import of that private helper).
 */
function isUsablePodArray(pods: unknown): pods is ViewPodLike[] {
  if (!Array.isArray(pods) || pods.length === 0) return false;
  return pods.every(
    p =>
      isPlainObjectLocal(p) &&
      typeof (p as Record<string, unknown>).date === 'string' &&
      typeof (p as Record<string, unknown>).title === 'string',
  );
}

function normalizeSearchText(value: string): string {
  return value.trim().toLowerCase();
}

/** Builds the full real-text search corpus for an episode-level row. */
function episodeSearchText(pod: ViewPodLike): string {
  const parts: string[] = [pod.title];
  if (pod.summary) parts.push(pod.summary);
  if (pod.takeaways) parts.push(...pod.takeaways);
  for (const skill of pod.skills ?? []) {
    parts.push(skill.title, skill.detail);
  }
  if (pod.homework) parts.push(pod.homework);
  return normalizeSearchText(parts.join(' \n '));
}

/** Builds the real-text search corpus for a single skill-level row. */
function skillSearchText(pod: ViewPodLike, skill: ViewSkillLike): string {
  return normalizeSearchText([skill.title, skill.detail, pod.title].join(' \n '));
}

// --- Library view --------------------------------------------------------------

export type ContentType = 'episode' | 'skill';

/** Display-facing safety label: a curated SafetyStatus, or 'unclassified' when no curation record exists. */
export type LibrarySafetyLabel = SafetyStatus | 'unclassified';

/** A single compact row in the library view — one per episode, one per skill. */
export type LibraryRow = {
  readonly id: string;
  readonly contentType: ContentType;
  readonly title: string;
  readonly summary: string;
  readonly source: string | null;
  readonly status: CurationStatus;
  readonly safetyStatus: LibrarySafetyLabel;
  readonly domain: CurationDomain | null;
  readonly phaseRelevance: PhaseRelevance | null;
  readonly sourceConfidence: SourceConfidence | null;
  readonly isActionable: boolean; // canQueueAsPractice(status) — read-only mirror, never used to mutate
  readonly completed: boolean;
  readonly completedAt: string | null;
  readonly deferred: boolean;
  readonly needsReview: boolean;
  readonly ownerContentId: string | null; // set for skill rows: the parent episode's canonical content ID
  readonly ownerTitle: string | null; // set for skill rows: the parent episode's title
};

export type LibraryFilter = {
  readonly text?: string;
  readonly domain?: CurationDomain;
  readonly phaseRelevance?: PhaseRelevance;
  readonly safetyStatus?: LibrarySafetyLabel;
  readonly sourceConfidence?: SourceConfidence;
  readonly contentType?: ContentType;
  readonly completed?: boolean;
};

function buildLibraryRow(params: {
  id: string;
  contentType: ContentType;
  title: string;
  summary: string;
  source: string | null;
  ownerContentId: string | null;
  ownerTitle: string | null;
  store: KnowledgeStore;
  overlay: CurationOverlay;
}): LibraryRow {
  const { id, contentType, title, summary, source, ownerContentId, ownerTitle, store, overlay } = params;
  const status = resolveCuration(id, overlay);
  const record = getCurationRecord(id);
  return {
    id,
    contentType,
    title,
    summary,
    source,
    status,
    // Unknown/uncurated content stays unclassified and is treated as
    // reference-only display-wise — it never inherits a curated
    // safetyStatus it was never given.
    safetyStatus: record ? record.safetyStatus : 'unclassified',
    domain: record ? record.domain : null,
    phaseRelevance: record ? record.phaseRelevance : null,
    sourceConfidence: record ? record.sourceConfidence : null,
    isActionable: canQueueAsPractice(status),
    completed: id in store.completions,
    completedAt: store.completions[id]?.completedAt ?? null,
    deferred: store.deferred.includes(id),
    needsReview: store.needsReview.includes(id),
    ownerContentId,
    ownerTitle,
  };
}

function matchesFilter(row: LibraryRow, searchText: string, filter: LibraryFilter | undefined): boolean {
  if (!filter) return true;
  if (filter.contentType !== undefined && row.contentType !== filter.contentType) return false;
  if (filter.domain !== undefined && row.domain !== filter.domain) return false;
  if (filter.phaseRelevance !== undefined && row.phaseRelevance !== filter.phaseRelevance) return false;
  if (filter.safetyStatus !== undefined && row.safetyStatus !== filter.safetyStatus) return false;
  if (filter.sourceConfidence !== undefined && row.sourceConfidence !== filter.sourceConfidence) return false;
  if (filter.completed !== undefined && row.completed !== filter.completed) return false;
  if (filter.text !== undefined && filter.text.trim().length > 0) {
    const needle = normalizeSearchText(filter.text);
    if (!searchText.includes(needle)) return false;
  }
  return true;
}

/**
 * Derives compact library rows (one per episode, one per skill) from a pod
 * list plus the current KnowledgeStore, applying an optional filter. Never
 * mutates `store`. Text filtering searches the REAL text fields that exist
 * on a pod — title/summary/takeaways/skills/homework — never invented
 * transcript data. An unrecognized/unknown pod (one whose canonical IDs
 * have no explicit curation entry) always resolves to `status:
 * 'unclassified'` and `safetyStatus: 'unclassified'` — the fail-safe
 * "unclassified/reference-only" default; it is never actionable.
 */
export function deriveLibrary(
  pods: unknown,
  store: KnowledgeStore,
  curationOverlay: CurationOverlay = CURATION_OVERLAY,
  filter?: LibraryFilter,
): LibraryRow[] {
  if (!isUsablePodArray(pods)) return [];

  const rows: LibraryRow[] = [];
  for (const pod of pods) {
    const episodeId = podContentId(pod);
    const episodeSearch = episodeSearchText(pod);
    const episodeRow = buildLibraryRow({
      id: episodeId,
      contentType: 'episode',
      title: pod.title,
      summary: pod.summary ?? '',
      source: pod.source ?? null,
      ownerContentId: null,
      ownerTitle: null,
      store,
      overlay: curationOverlay,
    });
    if (matchesFilter(episodeRow, episodeSearch, filter)) rows.push(episodeRow);

    for (const skill of pod.skills ?? []) {
      const id = skillId(episodeId, skill.title, skill.detail);
      const skillRow = buildLibraryRow({
        id,
        contentType: 'skill',
        title: skill.title,
        summary: skill.detail,
        source: pod.source ?? null,
        ownerContentId: episodeId,
        ownerTitle: pod.title,
        store,
        overlay: curationOverlay,
      });
      const skillSearch = skillSearchText(pod, skill);
      if (matchesFilter(skillRow, skillSearch, filter)) rows.push(skillRow);
    }
  }
  return rows;
}

// --- Briefing view --------------------------------------------------------------

export type BriefingItem = {
  readonly id: string;
  readonly title: string;
  readonly contentType: ContentType;
};

export type Briefing = {
  /** Up to 3 queued, Foundation-safe, not-needing-review items, in queue order. */
  readonly active: readonly BriefingItem[];
  /** The last-opened item, resolved to a label, if it can still be resolved against `pods`. Null otherwise. */
  readonly continueLearning: BriefingItem | null;
};

/** Resolves a canonical ID (content or skill) to a display label + contentType against a pod list. Read-only. */
function resolveIdToItem(id: string, pods: ViewPodLike[]): BriefingItem | null {
  for (const pod of pods) {
    const episodeId = podContentId(pod);
    if (id === episodeId) {
      return { id, title: pod.title, contentType: 'episode' };
    }
    for (const skill of pod.skills ?? []) {
      const sId = skillId(episodeId, skill.title, skill.detail);
      if (id === sId) {
        return { id, title: skill.title, contentType: 'skill' };
      }
    }
  }
  return null;
}

/**
 * Derives the read-only Foundation briefing: up to 3 active (queued,
 * foundation_safe, not needing review) items in queue order, plus a
 * "continue learning" pointer resolved from `lastOpenedContentId` when it
 * can still be resolved against `pods`. This function NEVER calls any
 * KnowledgeStore mutation helper and NEVER adds/queues anything — it is a
 * pure read projection over the store's existing `queue`/`needsReview`/
 * `lastOpenedContentId` fields.
 */
export function deriveBriefing(
  store: KnowledgeStore,
  pods: unknown,
  curationOverlay: CurationOverlay = CURATION_OVERLAY,
): Briefing {
  if (!isUsablePodArray(pods)) {
    return { active: [], continueLearning: null };
  }

  const activeIds = store.queue
    .filter(id => !store.needsReview.includes(id))
    .filter(id => canQueueAsPractice(resolveCuration(id, curationOverlay)));

  const active: BriefingItem[] = [];
  for (const id of activeIds) {
    if (active.length >= 3) break;
    const item = resolveIdToItem(id, pods);
    if (item) active.push(item);
  }

  const continueLearning = store.lastOpenedContentId
    ? resolveIdToItem(store.lastOpenedContentId, pods)
    : null;

  return { active, continueLearning };
}

// --- Calendar-focus snapshot (Architecture Amendment 3) -------------------------

export type KnowledgeFocusItem = {
  readonly id: string;
  readonly label: string;
};

/**
 * Calendar-facing focus snapshot. When `pods` cannot be resolved (missing,
 * empty, malformed — the read-only /pods.json fetch failed or hasn't
 * completed yet), `available` is `false` and NO raw canonical ID is ever
 * surfaced as a label; only safe, store-derived counts are returned. This
 * function never writes anything — it is a pure projection.
 */
export type KnowledgeFocusSnapshot =
  | {
      readonly available: true;
      readonly activeItems: readonly KnowledgeFocusItem[];
      readonly activeCount: number;
      readonly reviewCount: number;
    }
  | {
      readonly available: false;
      readonly activeCount: number;
      readonly reviewCount: number;
    };

/**
 * Derives up to 3 active (queued, foundation_safe, not needing review)
 * items resolved to human labels for Calendar's read-only focus card, per
 * Architecture Amendment 3. `pods` is expected to eventually come from a
 * read-only fetch of `/pods.json`; when it is unavailable/unusable this
 * degrades gracefully to `{ available: false, activeCount, reviewCount }`
 * — the counts are always safe to show because they are derived purely
 * from `store` (no pod data or ID needed to count), while individual raw
 * canonical IDs are NEVER surfaced as a label in the unavailable branch.
 */
export function deriveKnowledgeFocusSnapshot(
  store: KnowledgeStore,
  pods: unknown,
  curationOverlay: CurationOverlay = CURATION_OVERLAY,
): KnowledgeFocusSnapshot {
  const activeIds = store.queue
    .filter(id => !store.needsReview.includes(id))
    .filter(id => canQueueAsPractice(resolveCuration(id, curationOverlay)));
  const activeCount = activeIds.length;
  const reviewCount = store.needsReview.length;

  if (!isUsablePodArray(pods)) {
    return { available: false, activeCount, reviewCount };
  }

  const activeItems: KnowledgeFocusItem[] = [];
  for (const id of activeIds) {
    if (activeItems.length >= 3) break;
    const item = resolveIdToItem(id, pods);
    if (item) activeItems.push({ id: item.id, label: item.title });
  }

  return { available: true, activeItems, activeCount, reviewCount };
}
