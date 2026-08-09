import assert from 'node:assert/strict';
import test from 'node:test';

import { contentId, skillId, resolveCuration, canQueueAsPractice } from './knowledge-engine.ts';
import {
  CURATED_ENTRIES,
  CURATION_OVERLAY,
  getCurationRecord,
  listCuratedIds,
  type CurationDomain,
  type PhaseRelevance,
  type SafetyStatus,
  type SourceConfidence,
} from './knowledge-curation.ts';

// --- Fixture: literal (date, title) / (skill title, detail) pairs mirroring
// the observed corpus (public/pods.json) as of this workspace. This test
// file does NOT import or read pods.json — it independently re-derives the
// same canonical IDs the curation module claims to curate, via the same
// knowledge-engine functions, so the assertions are a genuine contract
// check rather than a tautology against the module's own internals.

const PEER_EVALS = { date: '2026-07-13', title: 'Peer Evals: The Filter Nobody Prepares For' };
const SON_TAY = { date: '2026-07-11', title: 'Son Tay: The Raid That Rewrote Special Operations' };
const SF_GROUPS = { date: '2026-07-10', title: 'The Special Forces Groups: Where You Actually End Up' };
const ODA = { date: '2026-07-07', title: "The ODA: Why It's Twelve Men" };
const RUCKING = { date: '2026-07-08', title: 'Rucking: How Not to Blow Out Your Feet and Back' };
const WATER_CONFIDENCE = {
  date: '2026-07-14',
  title: "Water Confidence: The Event Nobody Trains For Until It's Too Late",
};
const SFAS = { date: '2026-07-06', title: 'SFAS: What Actually Gets People Cut' };
const SELECTION_MENTAL_EVENT = {
  date: '2026-07-09',
  title: 'Selection Is a Mental Event with a Physical Component',
};
const LAND_NAV = { date: '2026-07-12', title: 'Land Nav: The Skill That Decides the Star Course' };

const VALID_STATUSES = new Set(['foundation_safe', 'reference_only', 'unclassified']);
const VALID_DOMAINS: Set<CurationDomain> = new Set([
  'physical_conditioning',
  'water_survival',
  'land_navigation',
  'nutrition',
  'mindset_culture',
  'pipeline_path',
  'history_doctrine',
]);
const VALID_PHASES: Set<PhaseRelevance> = new Set([
  'foundation',
  'buildup',
  'selection_prep',
  'historical_context',
  'general_orientation',
]);
const VALID_SAFETY: Set<SafetyStatus> = new Set([
  'safe',
  'caution_physical_load',
  'restricted_prescriptive',
  'archived_not_actionable',
]);
const VALID_CONFIDENCE: Set<SourceConfidence> = new Set(['high', 'medium', 'low']);

// Keywords that, if present in a foundation_safe entry's note or id, signal
// a physically-prescriptive/actionable claim that should NEVER be
// foundation_safe under WS2 policy.
const UNSAFE_KEYWORDS = [
  'ruck',
  'mileage',
  'mile',
  'bpm',
  'cadence',
  '2-mile',
  'sub-16',
  'workout',
  'nutrition',
  'macro',
  'calorie',
  'dosage',
  'supplement',
  'water-load',
  'swim',
  'physical test',
  'time trial',
];

// --- Enum legality across the whole static data set --------------------------

test('every curated entry has legal enum values for status/domain/phase/safety/confidence', () => {
  assert.ok(CURATED_ENTRIES.length > 0, 'expected at least one curated entry');
  for (const entry of CURATED_ENTRIES) {
    assert.ok(VALID_STATUSES.has(entry.status), `illegal status: ${entry.status} (id=${entry.id})`);
    assert.ok(VALID_DOMAINS.has(entry.domain), `illegal domain: ${entry.domain} (id=${entry.id})`);
    assert.ok(
      VALID_PHASES.has(entry.phaseRelevance),
      `illegal phaseRelevance: ${entry.phaseRelevance} (id=${entry.id})`,
    );
    assert.ok(
      VALID_SAFETY.has(entry.safetyStatus),
      `illegal safetyStatus: ${entry.safetyStatus} (id=${entry.id})`,
    );
    assert.ok(
      VALID_CONFIDENCE.has(entry.sourceConfidence),
      `illegal sourceConfidence: ${entry.sourceConfidence} (id=${entry.id})`,
    );
    assert.equal(typeof entry.note, 'string');
    assert.ok(entry.note.length > 0, `empty note for id=${entry.id}`);
  }
});

test('CURATION_OVERLAY only ever contains legal CurationStatus values', () => {
  for (const [id, status] of Object.entries(CURATION_OVERLAY)) {
    assert.ok(VALID_STATUSES.has(status), `illegal overlay status for ${id}: ${status}`);
  }
});

test('the static overlay contains no duplicate canonical IDs', () => {
  const ids = CURATED_ENTRIES.map(e => e.id);
  const unique = new Set(ids);
  assert.equal(unique.size, ids.length, 'duplicate canonical ID found in CURATED_ENTRIES');
});

// --- IDs resolve deterministically from fixture data (contract, not tautology) --

test('content-level curated IDs resolve deterministically from independently-derived fixture data', () => {
  const expectedPeerEvals = contentId(PEER_EVALS.date, PEER_EVALS.title);
  const expectedRucking = contentId(RUCKING.date, RUCKING.title);
  const expectedWaterConfidence = contentId(WATER_CONFIDENCE.date, WATER_CONFIDENCE.title);
  const expectedSfas = contentId(SFAS.date, SFAS.title);

  assert.ok(getCurationRecord(expectedPeerEvals), 'expected a curated record for Peer Evals content ID');
  assert.ok(getCurationRecord(expectedRucking), 'expected a curated record for Rucking content ID');
  assert.ok(
    getCurationRecord(expectedWaterConfidence),
    'expected a curated record for Water Confidence content ID',
  );
  assert.ok(getCurationRecord(expectedSfas), 'expected a curated record for SFAS content ID');
});

test('skill-level curated IDs resolve deterministically from independently-derived fixture data', () => {
  const peerEvalsOwner = contentId(PEER_EVALS.date, PEER_EVALS.title);
  const talkToListenId = skillId(
    peerEvalsOwner,
    'Talk-to-listen audit',
    'Pick one daily setting and count how often you talk vs. listen. Adjust the ratio. Runs continuously, no equipment needed.',
  );
  const record = getCurationRecord(talkToListenId);
  assert.ok(record, 'expected a curated record for the talk-to-listen-audit skill ID');
  assert.equal(record?.status, 'foundation_safe');

  const sonTayOwner = contentId(SON_TAY.date, SON_TAY.title);
  const learnTheNamesId = skillId(
    sonTayOwner,
    'Learn the names',
    "Blackburn, Simons, Meadows, Doc Kirby. Read Benjamin Schemmer's 'The Raid' (1976) before you ship. If a team sergeant asks why Meadows matters, you should have an answer.",
  );
  assert.equal(getCurationRecord(learnTheNamesId)?.status, 'foundation_safe');
});

test('listCuratedIds() matches CURATED_ENTRIES exactly (no drift between the index and the lookup)', () => {
  const ids = listCuratedIds();
  assert.equal(ids.length, CURATED_ENTRIES.length);
  for (const entry of CURATED_ENTRIES) {
    assert.ok(ids.includes(entry.id), `listCuratedIds() missing id ${entry.id}`);
  }
});

// --- Conservative curation policy: no content-level entry is ever foundation_safe --

test('no content-level (whole-episode) entry is ever foundation_safe', () => {
  const contentLevelIds = new Set([
    contentId(WATER_CONFIDENCE.date, WATER_CONFIDENCE.title),
    contentId(PEER_EVALS.date, PEER_EVALS.title),
    contentId(LAND_NAV.date, LAND_NAV.title),
    contentId(SON_TAY.date, SON_TAY.title),
    contentId(SF_GROUPS.date, SF_GROUPS.title),
    contentId(SELECTION_MENTAL_EVENT.date, SELECTION_MENTAL_EVENT.title),
    contentId(RUCKING.date, RUCKING.title),
    contentId(ODA.date, ODA.title),
    contentId(SFAS.date, SFAS.title),
  ]);
  let checked = 0;
  for (const entry of CURATED_ENTRIES) {
    if (contentLevelIds.has(entry.id)) {
      checked += 1;
      assert.notEqual(
        entry.status,
        'foundation_safe',
        `whole-episode content ID must never be foundation_safe: ${entry.id}`,
      );
    }
  }
  assert.ok(checked > 0, 'expected to find at least one content-level entry to check');
});

// --- Conservative curation policy: intentionally-unsafe items are never foundation_safe --

test('the physically-prescriptive Rucking episode is reference_only, never foundation_safe', () => {
  const id = contentId(RUCKING.date, RUCKING.title);
  const record = getCurationRecord(id);
  assert.ok(record);
  assert.equal(record?.status, 'reference_only');
  assert.equal(canQueueAsPractice(record!.status), false);
});

test('the water-confidence (physical/safety-sensitive) episode is reference_only, never foundation_safe', () => {
  const id = contentId(WATER_CONFIDENCE.date, WATER_CONFIDENCE.title);
  const record = getCurationRecord(id);
  assert.ok(record);
  assert.equal(record?.status, 'reference_only');
});

test('the SFAS episode (ruck/log-carry/pace-count prescriptions) is reference_only, never foundation_safe', () => {
  const id = contentId(SFAS.date, SFAS.title);
  const record = getCurationRecord(id);
  assert.ok(record);
  assert.equal(record?.status, 'reference_only');
});

test('no foundation_safe entry note or id contains a ruck-load/mileage/timing/nutrition/physical-test signal', () => {
  const foundationSafeEntries = CURATED_ENTRIES.filter(e => e.status === 'foundation_safe');
  assert.ok(foundationSafeEntries.length > 0, 'expected at least one foundation_safe entry to exist');
  for (const entry of foundationSafeEntries) {
    const haystack = `${entry.id} ${entry.note}`.toLowerCase();
    for (const keyword of UNSAFE_KEYWORDS) {
      assert.ok(
        !haystack.includes(keyword),
        `foundation_safe entry ${entry.id} note/id unexpectedly contains unsafe keyword "${keyword}"`,
      );
    }
  }
});

test('every foundation_safe entry\'s safetyStatus is "safe" (never caution/restricted/archived)', () => {
  for (const entry of CURATED_ENTRIES) {
    if (entry.status === 'foundation_safe') {
      assert.equal(
        entry.safetyStatus,
        'safe',
        `foundation_safe entry ${entry.id} must have safetyStatus 'safe', got '${entry.safetyStatus}'`,
      );
    }
  }
});

test('every restricted_prescriptive or caution_physical_load entry is never foundation_safe', () => {
  for (const entry of CURATED_ENTRIES) {
    if (entry.safetyStatus === 'restricted_prescriptive' || entry.safetyStatus === 'caution_physical_load') {
      assert.notEqual(
        entry.status,
        'foundation_safe',
        `entry ${entry.id} has safetyStatus '${entry.safetyStatus}' but is foundation_safe`,
      );
    }
  }
});

// --- Unlisted content stays unclassified by the engine (WS1<->WS2 contract) --

test('an ID not present in the static overlay resolves to unclassified via resolveCuration', () => {
  const unknownId = contentId('2099-01-01', 'Some Future Unreviewed Episode');
  assert.ok(getCurationRecord(unknownId) === undefined, 'fixture bug: unknown id unexpectedly curated');
  const status = resolveCuration(unknownId, CURATION_OVERLAY);
  assert.equal(status, 'unclassified');
  assert.equal(canQueueAsPractice(status), false);
});

test('resolveCuration + CURATION_OVERLAY together reproduce every curated status exactly', () => {
  for (const entry of CURATED_ENTRIES) {
    const resolved = resolveCuration(entry.id, CURATION_OVERLAY);
    assert.equal(resolved, entry.status, `resolveCuration mismatch for ${entry.id}`);
  }
});

test('canQueueAsPractice is true only for the foundation_safe curated entries, false for every other curated entry', () => {
  for (const entry of CURATED_ENTRIES) {
    const queueable = canQueueAsPractice(entry.status);
    assert.equal(
      queueable,
      entry.status === 'foundation_safe',
      `canQueueAsPractice mismatch for ${entry.id} (status=${entry.status})`,
    );
  }
});

// --- Meaningful Library category coverage (not exhaustive of all 53) ---------

test('curated domains span multiple distinct Library categories (not a single-bucket overlay)', () => {
  const domains = new Set(CURATED_ENTRIES.map(e => e.domain));
  assert.ok(domains.size >= 4, `expected curated entries to span >=4 domains, got ${domains.size}`);
});

test('both content-level and skill-level granularity are represented in the static overlay', () => {
  const hasContentLevel = CURATED_ENTRIES.some(e => !e.id.includes(':skill:'));
  const hasSkillLevel = CURATED_ENTRIES.some(e => e.id.includes(':skill:'));
  assert.ok(hasContentLevel, 'expected at least one content-level (non-skill) curated entry');
  assert.ok(hasSkillLevel, 'expected at least one skill-level curated entry');
});
