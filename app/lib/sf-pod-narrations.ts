// SF Pod audio-first narration resolver.
//
// Contract (do not relax without a spec change):
//   - This module is PURE: no React/DOM/network/storage imports, importable
//     and fully exercised under plain `node:test` with zero DOM globals,
//     matching pods-engine.ts's / knowledge-explorer-logic.ts's contract.
//   - `resolveSfPodNarration` is an EXACT-MATCH lookup keyed by the pod's
//     real `{date, title}` pair against the fixed list of the 10 CURRENT
//     production debriefs below (see /public/pods.json at the time this
//     module was written). It never fuzzy-matches, never falls back to a
//     partial match, and never fabricates an audio URL for a pod that
//     isn't an exact hit — unknown/mismatched/renamed/re-dated content
//     always resolves to `null`.
//   - The narration audio is generated OFFLINE by
//     scripts/generate_sf_pod_narrations.py from ONLY the app-owned text
//     already present in pods.json (summary/takeaways/skills/homework) —
//     it is a read-aloud of the app's own briefing notes, never the
//     original podcast audio, never a voice clone, never sourced from any
//     external API. Every resolved narration must be labeled
//     'SF Pod briefing narration' by the caller (see label below) so it is
//     never confused with the source podcast.
//   - This module does NOT read pods.json, does NOT fetch anything, and
//     does NOT probe the filesystem for whether the MP3 actually exists on
//     disk yet — it is a pure, deterministic path-mapping function. The
//     UI layer is responsible for wiring an `onError` fallback if the
//     asset is ever missing at runtime.

export const SF_POD_NARRATION_LABEL = 'SF Pod briefing narration' as const;

/** Minimal shape this module needs from a Pod — never imports pods-engine's Pod type to stay dependency-free. */
export type NarrationPodLike = {
  date: string;
  title: string;
};

export type SfPodNarration = {
  audioUrl: string;
  label: typeof SF_POD_NARRATION_LABEL;
};

/**
 * The exact `{date, title}` pairs for the 10 CURRENT production debriefs in
 * /public/pods.json, each mapped to its deterministic narration path
 * `/audio/sf-pod-narration-<date>.mp3`. This list is intentionally static
 * (not derived from pods.json at runtime) so a stale/edited/cron-mutated
 * pods.json can never silently mint new narration URLs — only the 10
 * entries reviewed and approved here resolve to audio.
 */
const KNOWN_SF_POD_NARRATIONS: ReadonlyArray<{ date: string; title: string }> = [
  { date: '2026-07-17', title: "Ruck Up or Shut Up — Walton's Operating System" },
  { date: '2026-07-14', title: "Water Confidence: The Event Nobody Trains For Until It's Too Late" },
  { date: '2026-07-13', title: 'Peer Evals: The Filter Nobody Prepares For' },
  { date: '2026-07-12', title: 'Land Nav: The Skill That Decides the Star Course' },
  { date: '2026-07-11', title: 'Son Tay: The Raid That Rewrote Special Operations' },
  { date: '2026-07-10', title: 'The Special Forces Groups: Where You Actually End Up' },
  { date: '2026-07-09', title: 'Selection Is a Mental Event with a Physical Component' },
  { date: '2026-07-08', title: 'Rucking: How Not to Blow Out Your Feet and Back' },
  { date: '2026-07-07', title: "The ODA: Why It's Twelve Men" },
  { date: '2026-07-06', title: 'SFAS: What Actually Gets People Cut' },
];

/** Deterministic narration path for a given production date, e.g. `/audio/sf-pod-narration-2026-07-17.mp3`. */
export function narrationPathForDate(date: string): string {
  return `/audio/sf-pod-narration-${date}.mp3`;
}

/**
 * Resolves a pod to its SF Pod briefing narration, or `null` when the pod
 * does not exactly match one of the 10 known-current production debriefs
 * (by BOTH date and title). Never fuzzy-matches on date-only or
 * title-only; never returns a narration for unknown/renamed/re-dated
 * content, even if a same-dated pod exists in the known list.
 */
export function resolveSfPodNarration(pod: NarrationPodLike | null | undefined): SfPodNarration | null {
  if (!pod) return null;
  const date = typeof pod.date === 'string' ? pod.date : '';
  const title = typeof pod.title === 'string' ? pod.title : '';
  if (!date || !title) return null;

  const match = KNOWN_SF_POD_NARRATIONS.find(k => k.date === date && k.title === title);
  if (!match) return null;

  return {
    audioUrl: narrationPathForDate(match.date),
    label: SF_POD_NARRATION_LABEL,
  };
}

/** Exposed for tests/tools that need the raw known-list without re-deriving it. */
export function listKnownSfPodNarrationKeys(): ReadonlyArray<{ date: string; title: string }> {
  return KNOWN_SF_POD_NARRATIONS;
}
