// Static, code-owned curation overlay for the SF Prep Knowledge substrate
// (WS2). This module supplies the ONLY real curation data set consumed by
// knowledge-engine.ts's `resolveCuration`/`canQueueAsPractice` gate.
//
// Hard constraints (do not relax without a spec change):
//   - No fetch/import of public/pods.json or any network/filesystem access.
//     All curated content is described by hardcoded literal (date, title)
//     and, where relevant, (skill title, skill detail) pairs declared right
//     here in source. This file is the code-owned "editorial" layer.
//   - IDs are always derived via knowledge-engine's `contentId`/`skillId`,
//     never hand-typed as raw ID strings, so a curated entry's identity
//     stays mechanically in sync with however the engine computes IDs.
//   - Curation policy is conservative by construction:
//       * No whole episode/content ID in this file is ever set to
//         'foundation_safe'. Content-level entries are always
//         'reference_only' (or left out entirely, which defaults to
//         'unclassified' via the engine's fail-safe).
//       * Only individual SKILL-level entries may be 'foundation_safe',
//         and only when the skill is a non-prescriptive learning/
//         reflection/journaling task that cannot be read as prescribing a
//         ruck load or mileage, a physical/fitness test, workout
//         programming, nutrition targets, a performance standard, or a
//         timing/cadence target.
//   - Anything not explicitly listed here resolves to 'unclassified' via
//     knowledge-engine's default (this file never ships a "catch-all"
//     entry), so unknown/future corpus content never becomes actionable
//     by omission.

import { contentId, skillId, type CurationOverlay, type CurationStatus } from './knowledge-engine.ts';

// --- Display metadata vocabularies -------------------------------------------
//
// These are presentation/editorial concerns layered on TOP of the engine's
// 3-value CurationStatus gate — they never change what canQueueAsPractice
// admits. In particular 'archived_not_actionable' is a SafetyStatus nuance
// only; the underlying CurationStatus for any such entry is still one of
// the engine's legal values ('reference_only' in practice), never a 4th
// status invented here.

export type CurationDomain =
  | 'physical_conditioning'
  | 'water_survival'
  | 'land_navigation'
  | 'nutrition'
  | 'mindset_culture'
  | 'pipeline_path'
  | 'history_doctrine';

export type PhaseRelevance =
  | 'foundation'
  | 'buildup'
  | 'selection_prep'
  | 'historical_context'
  | 'general_orientation';

export type SafetyStatus =
  | 'safe'
  | 'caution_physical_load'
  | 'restricted_prescriptive'
  | 'archived_not_actionable';

export type SourceConfidence = 'high' | 'medium' | 'low';

/** Display-facing curation record for a single canonical content/skill ID. */
export type CurationRecord = {
  readonly id: string;
  readonly status: CurationStatus;
  readonly domain: CurationDomain;
  readonly phaseRelevance: PhaseRelevance;
  readonly safetyStatus: SafetyStatus;
  readonly sourceConfidence: SourceConfidence;
  readonly note: string;
};

// --- Literal corpus references (no import/fetch of pods.json) ---------------
//
// These mirror the (date, title) and (skill title, skill detail) pairs as
// they currently appear in the observed corpus, copied verbatim as literal
// source constants. This file has zero coupling to how/whether pods.json
// changes at runtime; it only shares the *convention* of what a canonical
// ID looks like via the imported contentId/skillId derivation functions.

const WATER_CONFIDENCE = {
  date: '2026-07-14',
  title: "Water Confidence: The Event Nobody Trains For Until It's Too Late",
} as const;

const PEER_EVALS = {
  date: '2026-07-13',
  title: 'Peer Evals: The Filter Nobody Prepares For',
} as const;

const LAND_NAV = {
  date: '2026-07-12',
  title: 'Land Nav: The Skill That Decides the Star Course',
} as const;

const SON_TAY = {
  date: '2026-07-11',
  title: 'Son Tay: The Raid That Rewrote Special Operations',
} as const;

const SF_GROUPS = {
  date: '2026-07-10',
  title: 'The Special Forces Groups: Where You Actually End Up',
} as const;

const SELECTION_MENTAL_EVENT = {
  date: '2026-07-09',
  title: 'Selection Is a Mental Event with a Physical Component',
} as const;

const RUCKING = {
  date: '2026-07-08',
  title: 'Rucking: How Not to Blow Out Your Feet and Back',
} as const;

const ODA = {
  date: '2026-07-07',
  title: "The ODA: Why It's Twelve Men",
} as const;

const SFAS = {
  date: '2026-07-06',
  title: 'SFAS: What Actually Gets People Cut',
} as const;

// --- Curated entries ----------------------------------------------------------
//
// Content-level entries: every one of these is 'reference_only'. None is
// 'foundation_safe' — per policy, no whole episode is broadly cleared.

const CONTENT_ENTRIES: readonly CurationRecord[] = [
  {
    id: contentId(WATER_CONFIDENCE.date, WATER_CONFIDENCE.title),
    status: 'reference_only',
    domain: 'water_survival',
    phaseRelevance: 'selection_prep',
    safetyStatus: 'caution_physical_load',
    sourceConfidence: 'high',
    note: 'CWSA water-confidence content walks through graded, encumbered water tasks (bobs, clothed swim, ditch drill). Physical/safety-sensitive — reference-only, never auto-queued as practice.',
  },
  {
    id: contentId(PEER_EVALS.date, PEER_EVALS.title),
    status: 'reference_only',
    domain: 'mindset_culture',
    phaseRelevance: 'selection_prep',
    safetyStatus: 'caution_physical_load',
    sourceConfidence: 'high',
    note: 'Mostly interpersonal/mindset content, but includes a physical group-task cue ("take the heavy end first"). Whole episode stays reference-only; specific non-physical skills are curated individually below.',
  },
  {
    id: contentId(LAND_NAV.date, LAND_NAV.title),
    status: 'reference_only',
    domain: 'land_navigation',
    phaseRelevance: 'selection_prep',
    safetyStatus: 'caution_physical_load',
    sourceConfidence: 'high',
    note: 'Land navigation skills are entangled with ruck mileage/pace-count prescriptions (e.g. "after a 10-mile ruck"). Reference-only pending a nav-specific safety pass.',
  },
  {
    id: contentId(SON_TAY.date, SON_TAY.title),
    status: 'reference_only',
    domain: 'history_doctrine',
    phaseRelevance: 'historical_context',
    safetyStatus: 'caution_physical_load',
    sourceConfidence: 'medium',
    note: 'Historical account of the Son Tay raid; one homework skill references ruck-cadence rehearsal, so the whole episode stays reference-only even though most content is pure history.',
  },
  {
    id: contentId(SF_GROUPS.date, SF_GROUPS.title),
    status: 'reference_only',
    domain: 'pipeline_path',
    phaseRelevance: 'general_orientation',
    safetyStatus: 'safe',
    sourceConfidence: 'high',
    note: 'Orientation content on the 7 SF Groups is not physically prescriptive, but per policy no whole episode is blanket-cleared. Individual reading/reflection skills are curated foundation_safe below.',
  },
  {
    id: contentId(SELECTION_MENTAL_EVENT.date, SELECTION_MENTAL_EVENT.title),
    status: 'reference_only',
    domain: 'mindset_culture',
    phaseRelevance: 'selection_prep',
    safetyStatus: 'caution_physical_load',
    sourceConfidence: 'high',
    note: 'Mental-toughness framing episode, but nearly every homework skill is tied to an actual ruck/run session ("solo unwitnessed ruck", "ego-check ruck"). Reference-only in full.',
  },
  {
    id: contentId(RUCKING.date, RUCKING.title),
    status: 'reference_only',
    domain: 'physical_conditioning',
    phaseRelevance: 'buildup',
    safetyStatus: 'restricted_prescriptive',
    sourceConfidence: 'high',
    note: 'Directly prescriptive on ruck load (20 lb), cadence (125 BPM), and a timed standard (sub-16:00 2-mile). Never foundation_safe — conflicts with current Foundation physical-load constraints.',
  },
  {
    id: contentId(ODA.date, ODA.title),
    status: 'reference_only',
    domain: 'pipeline_path',
    phaseRelevance: 'general_orientation',
    safetyStatus: 'safe',
    sourceConfidence: 'high',
    note: 'MOS/team-structure orientation content; not physically prescriptive, but whole episode stays reference-only per the conservative content-level policy. Reading-only skills are curated below.',
  },
  {
    id: contentId(SFAS.date, SFAS.title),
    status: 'reference_only',
    domain: 'physical_conditioning',
    phaseRelevance: 'buildup',
    safetyStatus: 'restricted_prescriptive',
    sourceConfidence: 'high',
    note: 'Mixes land-nav/ruck/log-carry prescriptions with mindset cues. The physical-test-adjacent content means the episode never qualifies as foundation_safe; one journaling skill is curated individually below.',
  },
];

// Skill-level entries: the ONLY place 'foundation_safe' may appear. Every
// entry here is a pure reading / reflection / journaling task that cannot
// be read as prescribing a ruck load or mileage, a physical/fitness test,
// workout programming, nutrition targets, a performance standard, or a
// timing/cadence target.

const SKILL_ENTRIES: readonly CurationRecord[] = [
  {
    id: skillId(
      contentId(PEER_EVALS.date, PEER_EVALS.title),
      'Talk-to-listen audit',
      'Pick one daily setting and count how often you talk vs. listen. Adjust the ratio. Runs continuously, no equipment needed.',
    ),
    status: 'foundation_safe',
    domain: 'mindset_culture',
    phaseRelevance: 'foundation',
    safetyStatus: 'safe',
    sourceConfidence: 'high',
    note: 'Self-observation communication exercise. Not physically prescriptive and carries no timing target — safe at Foundation.',
  },
  {
    id: skillId(
      contentId(PEER_EVALS.date, PEER_EVALS.title),
      'Second-loudest rehearsal',
      "Contribute, execute, then shut up when someone else has the floor. Practice in low-stakes settings so it's automatic at Mackall.",
    ),
    status: 'foundation_safe',
    domain: 'mindset_culture',
    phaseRelevance: 'foundation',
    safetyStatus: 'safe',
    sourceConfidence: 'high',
    note: 'Social/behavioral rehearsal task, non-physical and non-prescriptive — safe at Foundation.',
  },
  {
    id: skillId(
      contentId(SON_TAY.date, SON_TAY.title),
      'Learn the names',
      "Blackburn, Simons, Meadows, Doc Kirby. Read Benjamin Schemmer's 'The Raid' (1976) before you ship. If a team sergeant asks why Meadows matters, you should have an answer.",
    ),
    status: 'foundation_safe',
    domain: 'history_doctrine',
    phaseRelevance: 'foundation',
    safetyStatus: 'safe',
    sourceConfidence: 'high',
    note: 'Pure historical-reading recall task with no physically-actionable or scheduling instruction — safe at Foundation.',
  },
  {
    id: skillId(
      contentId(SF_GROUPS.date, SF_GROUPS.title),
      'Map the Groups',
      "Pin a world map with the 7 Groups and their AORs. When someone asks 'why that Group,' you have a real answer, not a vibe.",
    ),
    status: 'foundation_safe',
    domain: 'pipeline_path',
    phaseRelevance: 'foundation',
    safetyStatus: 'safe',
    sourceConfidence: 'high',
    note: 'Reference/orientation task (labeling a map). Non-physical, non-prescriptive — safe at Foundation.',
  },
  {
    id: skillId(
      contentId(SF_GROUPS.date, SF_GROUPS.title),
      'Regional current events',
      "Read one long-form piece per week on the AOR you'd want. War on the Rocks, CTC Sentinel, Small Wars Journal. Free.",
    ),
    status: 'foundation_safe',
    domain: 'pipeline_path',
    phaseRelevance: 'foundation',
    safetyStatus: 'safe',
    sourceConfidence: 'high',
    note: 'Reading-comprehension homework with no physically-actionable or scheduling instruction — safe at Foundation.',
  },
  {
    id: skillId(
      contentId(SF_GROUPS.date, SF_GROUPS.title),
      'Talk to a Group vet',
      "SOWT and the r/specialforces AMAs. Ask about the day-to-day of the Group you're eyeing — not the door-kicking, the FID rotations.",
    ),
    status: 'foundation_safe',
    domain: 'pipeline_path',
    phaseRelevance: 'foundation',
    safetyStatus: 'safe',
    sourceConfidence: 'high',
    note: 'Research/networking task with no physical or prescriptive content — safe at Foundation.',
  },
  {
    id: skillId(
      contentId(SF_GROUPS.date, SF_GROUPS.title),
      'Log a Group-of-the-week note',
      'One paragraph in your prep journal each week on a different Group — mission, history, current fight. Seven weeks = full coverage.',
    ),
    status: 'foundation_safe',
    domain: 'pipeline_path',
    phaseRelevance: 'foundation',
    safetyStatus: 'safe',
    sourceConfidence: 'high',
    note: 'Journaling/reflection task, purely informational — safe at Foundation.',
  },
  {
    id: skillId(
      contentId(ODA.date, ODA.title),
      'Read one 18-series MOS deep',
      'Pick 18B/C/D/E/F this week. Read the training pipeline, day-in-the-life downrange, career progression.',
    ),
    status: 'foundation_safe',
    domain: 'pipeline_path',
    phaseRelevance: 'foundation',
    safetyStatus: 'safe',
    sourceConfidence: 'high',
    note: 'Reading homework about MOS career paths, with no physically-actionable or scheduling instruction — safe at Foundation.',
  },
  {
    id: skillId(
      contentId(ODA.date, ODA.title),
      'Study Jedburgh history',
      'One evening read on OSS Jedburgh teams — the DNA of the ODA. Understand why 3 was too small.',
    ),
    status: 'foundation_safe',
    domain: 'history_doctrine',
    phaseRelevance: 'foundation',
    safetyStatus: 'safe',
    sourceConfidence: 'high',
    note: 'Pure historical-reading task — safe at Foundation.',
  },
  {
    id: skillId(
      contentId(SFAS.date, SFAS.title),
      'VW pre-commitment',
      'Write on an index card: "I will not voluntarily withdraw." Keep it in your wallet. Read it on hard days.',
    ),
    status: 'foundation_safe',
    domain: 'mindset_culture',
    phaseRelevance: 'foundation',
    safetyStatus: 'safe',
    sourceConfidence: 'high',
    note: 'A written commitment-device exercise with no physically-actionable or scheduling instruction — safe at Foundation.',
  },
];

/** All curated records (content-level + skill-level), content entries first. */
export const CURATED_ENTRIES: readonly CurationRecord[] = [...CONTENT_ENTRIES, ...SKILL_ENTRIES];

// Defensive invariant: this static data set must never contain a duplicate
// canonical ID (which would make overlay resolution ambiguous). Thrown at
// module-load time so a future editorial mistake fails immediately/loudly
// rather than silently shadowing an entry.
(function assertNoDuplicateIds(entries: readonly CurationRecord[]): void {
  const seen = new Set<string>();
  for (const entry of entries) {
    if (seen.has(entry.id)) {
      throw new Error(`knowledge-curation: duplicate canonical ID in static overlay: ${entry.id}`);
    }
    seen.add(entry.id);
  }
})(CURATED_ENTRIES);

/** Canonical-ID -> CurationRecord lookup, built once from CURATED_ENTRIES. */
const RECORDS_BY_ID: ReadonlyMap<string, CurationRecord> = new Map(
  CURATED_ENTRIES.map(entry => [entry.id, entry]),
);

/**
 * The overlay to pass into knowledge-engine's `resolveCuration`. Derived
 * mechanically from CURATED_ENTRIES (id -> status) — never hand-maintained
 * separately from the display metadata, so the two can't drift.
 */
export const CURATION_OVERLAY: CurationOverlay = Object.freeze(
  Object.fromEntries(CURATED_ENTRIES.map(entry => [entry.id, entry.status])),
);

/** Looks up the full display-facing curation record for a canonical ID, if curated. */
export function getCurationRecord(id: string): CurationRecord | undefined {
  return RECORDS_BY_ID.get(id);
}

/** All canonical IDs this static overlay has an explicit opinion about. */
export function listCuratedIds(): string[] {
  return CURATED_ENTRIES.map(entry => entry.id);
}
