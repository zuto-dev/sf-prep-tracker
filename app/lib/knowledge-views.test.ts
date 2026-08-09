import assert from 'node:assert/strict';
import test from 'node:test';

import { defaultKnowledgeStore, type KnowledgeStore } from './knowledge-store.ts';
import { contentId, skillId, type CurationOverlay } from './knowledge-engine.ts';
import {
  deriveLibrary,
  deriveBriefing,
  deriveKnowledgeFocusSnapshot,
  type ViewPodLike,
} from './knowledge-views.ts';

// --- Fixture pods (no network/fs access; literal data only) ------------------

const CURATED_POD: ViewPodLike = {
  date: '2026-07-10',
  title: 'The Special Forces Groups: Where You Actually End Up',
  summary: 'Orientation content covering the seven SF Groups and how assignment works.',
  takeaways: ['Group assignment depends on language aptitude and needs of the Army'],
  homework: 'Read one long-form regional piece this week.',
  source: 'SF Prep Podcast',
  skills: [
    {
      title: 'Map the Groups',
      detail: "Pin a world map with the 7 Groups and their AORs. When someone asks 'why that Group,' you have a real answer, not a vibe.",
    },
    {
      title: 'Regional current events',
      detail: 'Read one long-form piece per week on the AOR you\'d want. War on the Rocks, CTC Sentinel, Small Wars Journal. Free.',
    },
  ],
};

const RUCKING_POD: ViewPodLike = {
  date: '2026-07-08',
  title: 'Rucking: How Not to Blow Out Your Feet and Back',
  summary: 'Prescriptive rucking guidance: load, cadence, and a timed 2-mile standard.',
  takeaways: ['20 lb ruck, 125 BPM cadence, sub-16:00 2-mile'],
  homework: 'Do a weekly rucking session.',
  source: 'SF Prep Podcast',
  skills: [
    {
      title: 'Cadence drill',
      detail: 'Maintain 125 BPM cadence over 3 miles with a 20 lb ruck.',
    },
  ],
};

const UNKNOWN_POD: ViewPodLike = {
  date: '2026-07-15',
  title: 'A Brand New Episode Nobody Has Curated Yet',
  summary: 'This episode has no curation overlay entry at all.',
  takeaways: ['Something novel and unclassified'],
  homework: 'No homework yet.',
  skills: [
    { title: 'Mystery skill', detail: 'An entirely uncurated skill with no overlay entry.' },
  ],
};

const ALL_PODS: ViewPodLike[] = [CURATED_POD, RUCKING_POD, UNKNOWN_POD];

const SF_GROUPS_CONTENT_ID = contentId(CURATED_POD.date, CURATED_POD.title);
const MAP_GROUPS_SKILL_ID = skillId(SF_GROUPS_CONTENT_ID, 'Map the Groups', CURATED_POD.skills![0].detail);
const REGIONAL_EVENTS_SKILL_ID = skillId(
  SF_GROUPS_CONTENT_ID,
  'Regional current events',
  CURATED_POD.skills![1].detail,
);
const RUCKING_CONTENT_ID = contentId(RUCKING_POD.date, RUCKING_POD.title);
const RUCKING_SKILL_ID = skillId(RUCKING_CONTENT_ID, 'Cadence drill', RUCKING_POD.skills![0].detail);
const UNKNOWN_CONTENT_ID = contentId(UNKNOWN_POD.date, UNKNOWN_POD.title);
const UNKNOWN_SKILL_ID = skillId(UNKNOWN_CONTENT_ID, 'Mystery skill', UNKNOWN_POD.skills![0].detail);

const TEST_OVERLAY: CurationOverlay = Object.freeze({
  [SF_GROUPS_CONTENT_ID]: 'reference_only',
  [MAP_GROUPS_SKILL_ID]: 'foundation_safe',
  [REGIONAL_EVENTS_SKILL_ID]: 'foundation_safe',
  [RUCKING_CONTENT_ID]: 'reference_only',
  [RUCKING_SKILL_ID]: 'reference_only',
  // UNKNOWN_* entries deliberately absent — must fail safe to unclassified.
});

function freshStore(overrides: Partial<KnowledgeStore> = {}): KnowledgeStore {
  return { ...defaultKnowledgeStore(), ...overrides };
}

// --- deriveLibrary -------------------------------------------------------------

test('deriveLibrary returns one episode row + one row per skill for each pod', () => {
  const rows = deriveLibrary(ALL_PODS, freshStore(), TEST_OVERLAY);
  // 3 episodes + (2 + 1 + 1) skills = 7 rows
  assert.equal(rows.length, 7);
  const episodeRows = rows.filter(r => r.contentType === 'episode');
  assert.equal(episodeRows.length, 3);
});

test('deriveLibrary never mutates the passed-in store', () => {
  const store = freshStore({ queue: ['a'], completions: { a: { completedAt: '2026-01-01T00:00:00.000Z' } } });
  const snapshot = JSON.parse(JSON.stringify(store));
  deriveLibrary(ALL_PODS, store, TEST_OVERLAY);
  assert.deepEqual(store, snapshot);
});

test('deriveLibrary text filter searches real fields: title, summary, takeaways, skills, homework', () => {
  const byTitle = deriveLibrary(ALL_PODS, freshStore(), TEST_OVERLAY, { text: 'Rucking' });
  assert.ok(byTitle.some(r => r.id === RUCKING_CONTENT_ID));

  const bySummary = deriveLibrary(ALL_PODS, freshStore(), TEST_OVERLAY, { text: 'seven SF Groups' });
  assert.ok(bySummary.some(r => r.id === SF_GROUPS_CONTENT_ID));

  const byTakeaway = deriveLibrary(ALL_PODS, freshStore(), TEST_OVERLAY, { text: 'language aptitude' });
  assert.ok(byTakeaway.some(r => r.id === SF_GROUPS_CONTENT_ID));

  const bySkillText = deriveLibrary(ALL_PODS, freshStore(), TEST_OVERLAY, { text: 'War on the Rocks' });
  assert.ok(bySkillText.some(r => r.id === REGIONAL_EVENTS_SKILL_ID));

  const byHomework = deriveLibrary(ALL_PODS, freshStore(), TEST_OVERLAY, { text: 'weekly rucking session' });
  assert.ok(byHomework.some(r => r.id === RUCKING_CONTENT_ID));

  const noMatch = deriveLibrary(ALL_PODS, freshStore(), TEST_OVERLAY, { text: 'zzz-nonexistent-zzz' });
  assert.equal(noMatch.length, 0);
});

test('deriveLibrary filters by domain, phaseRelevance, safetyStatus, sourceConfidence, contentType, completed', () => {
  const byDomain = deriveLibrary(ALL_PODS, freshStore(), TEST_OVERLAY, { domain: 'pipeline_path' });
  assert.ok(byDomain.length > 0);
  assert.ok(byDomain.every(r => r.domain === 'pipeline_path'));

  const byPhase = deriveLibrary(ALL_PODS, freshStore(), TEST_OVERLAY, { phaseRelevance: 'foundation' });
  assert.ok(byPhase.length > 0);
  assert.ok(byPhase.every(r => r.phaseRelevance === 'foundation'));

  const bySafety = deriveLibrary(ALL_PODS, freshStore(), TEST_OVERLAY, { safetyStatus: 'safe' });
  assert.ok(bySafety.length > 0);
  assert.ok(bySafety.every(r => r.safetyStatus === 'safe'));

  const byConfidence = deriveLibrary(ALL_PODS, freshStore(), TEST_OVERLAY, { sourceConfidence: 'high' });
  assert.ok(byConfidence.length > 0);
  assert.ok(byConfidence.every(r => r.sourceConfidence === 'high'));

  const byContentType = deriveLibrary(ALL_PODS, freshStore(), TEST_OVERLAY, { contentType: 'skill' });
  assert.ok(byContentType.length > 0);
  assert.ok(byContentType.every(r => r.contentType === 'skill'));

  const store = freshStore({ completions: { [RUCKING_CONTENT_ID]: { completedAt: '2026-07-09T00:00:00.000Z' } } });
  const completedOnly = deriveLibrary(ALL_PODS, store, TEST_OVERLAY, { completed: true });
  assert.equal(completedOnly.length, 1);
  assert.equal(completedOnly[0].id, RUCKING_CONTENT_ID);
  assert.equal(completedOnly[0].completedAt, '2026-07-09T00:00:00.000Z');
});

test('deriveLibrary: content absent from the curation overlay stays unclassified/reference-only (fail-safe)', () => {
  const rows = deriveLibrary(ALL_PODS, freshStore(), TEST_OVERLAY);
  const unknownEpisode = rows.find(r => r.id === UNKNOWN_CONTENT_ID);
  const unknownSkill = rows.find(r => r.id === UNKNOWN_SKILL_ID);
  assert.ok(unknownEpisode);
  assert.ok(unknownSkill);
  assert.equal(unknownEpisode!.status, 'unclassified');
  assert.equal(unknownEpisode!.safetyStatus, 'unclassified');
  assert.equal(unknownEpisode!.isActionable, false);
  assert.equal(unknownSkill!.status, 'unclassified');
  assert.equal(unknownSkill!.safetyStatus, 'unclassified');
  assert.equal(unknownSkill!.isActionable, false);
});

test('deriveLibrary returns empty array for missing/malformed pods without throwing', () => {
  assert.deepEqual(deriveLibrary(undefined, freshStore(), TEST_OVERLAY), []);
  assert.deepEqual(deriveLibrary(null, freshStore(), TEST_OVERLAY), []);
  assert.deepEqual(deriveLibrary([], freshStore(), TEST_OVERLAY), []);
  assert.deepEqual(deriveLibrary('not-an-array', freshStore(), TEST_OVERLAY), []);
  assert.deepEqual(deriveLibrary([{ episode: 1 }], freshStore(), TEST_OVERLAY), []);
});

test('deriveLibrary surfaces completion/deferred/needsReview flags from the store', () => {
  const store = freshStore({
    completions: { [MAP_GROUPS_SKILL_ID]: { completedAt: '2026-07-11T00:00:00.000Z' } },
    deferred: [REGIONAL_EVENTS_SKILL_ID],
    needsReview: [RUCKING_SKILL_ID],
  });
  const rows = deriveLibrary(ALL_PODS, store, TEST_OVERLAY);
  const mapRow = rows.find(r => r.id === MAP_GROUPS_SKILL_ID)!;
  const regionalRow = rows.find(r => r.id === REGIONAL_EVENTS_SKILL_ID)!;
  const ruckingSkillRow = rows.find(r => r.id === RUCKING_SKILL_ID)!;
  assert.equal(mapRow.completed, true);
  assert.equal(mapRow.completedAt, '2026-07-11T00:00:00.000Z');
  assert.equal(regionalRow.deferred, true);
  assert.equal(ruckingSkillRow.needsReview, true);
});

// --- deriveBriefing --------------------------------------------------------------

test('deriveBriefing returns up to 3 active queued Foundation-safe items in queue order', () => {
  const store = freshStore({ queue: [MAP_GROUPS_SKILL_ID, REGIONAL_EVENTS_SKILL_ID] });
  const briefing = deriveBriefing(store, ALL_PODS, TEST_OVERLAY);
  assert.equal(briefing.active.length, 2);
  assert.equal(briefing.active[0].id, MAP_GROUPS_SKILL_ID);
  assert.equal(briefing.active[1].id, REGIONAL_EVENTS_SKILL_ID);
});

test('deriveBriefing caps active items at 3 even with a longer queue', () => {
  // Build 4 distinct foundation_safe skill IDs across the curated pod's 2
  // real skills plus reuse via a duplicate overlay entry set is not
  // possible (IDs are derived), so simulate a 4-deep queue by repeating
  // resolvable IDs after extending the overlay with a third foundation_safe
  // skill from an additional literal pod skill.
  const extraSkill = { title: 'Third foundation skill', detail: 'Another pure reading task.' };
  const podWithExtra: ViewPodLike = {
    ...CURATED_POD,
    skills: [...CURATED_POD.skills!, extraSkill],
  };
  const extraSkillId = skillId(SF_GROUPS_CONTENT_ID, extraSkill.title, extraSkill.detail);
  const overlay: CurationOverlay = { ...TEST_OVERLAY, [extraSkillId]: 'foundation_safe' };
  const store = freshStore({
    queue: [MAP_GROUPS_SKILL_ID, REGIONAL_EVENTS_SKILL_ID, extraSkillId, RUCKING_SKILL_ID],
  });
  const briefing = deriveBriefing(store, [podWithExtra, RUCKING_POD, UNKNOWN_POD], overlay);
  assert.equal(briefing.active.length, 3);
});

test('deriveBriefing excludes queued items flagged in needsReview even if still foundation_safe', () => {
  const store = freshStore({
    queue: [MAP_GROUPS_SKILL_ID, REGIONAL_EVENTS_SKILL_ID],
    needsReview: [MAP_GROUPS_SKILL_ID],
  });
  const briefing = deriveBriefing(store, ALL_PODS, TEST_OVERLAY);
  assert.equal(briefing.active.length, 1);
  assert.equal(briefing.active[0].id, REGIONAL_EVENTS_SKILL_ID);
});

test('deriveBriefing excludes queued items that no longer resolve to foundation_safe under the overlay', () => {
  // Simulate a queued item whose curation was downgraded after queueing.
  const overlay: CurationOverlay = { ...TEST_OVERLAY, [MAP_GROUPS_SKILL_ID]: 'reference_only' };
  const store = freshStore({ queue: [MAP_GROUPS_SKILL_ID, REGIONAL_EVENTS_SKILL_ID] });
  const briefing = deriveBriefing(store, ALL_PODS, overlay);
  assert.equal(briefing.active.length, 1);
  assert.equal(briefing.active[0].id, REGIONAL_EVENTS_SKILL_ID);
});

test('deriveBriefing continue-learning resolves lastOpenedContentId to a label when resolvable', () => {
  const store = freshStore({ lastOpenedContentId: RUCKING_CONTENT_ID });
  const briefing = deriveBriefing(store, ALL_PODS, TEST_OVERLAY);
  assert.ok(briefing.continueLearning);
  assert.equal(briefing.continueLearning!.id, RUCKING_CONTENT_ID);
  assert.equal(briefing.continueLearning!.title, RUCKING_POD.title);
  assert.equal(briefing.continueLearning!.contentType, 'episode');
});

test('deriveBriefing continue-learning is null when lastOpenedContentId is null or unresolvable', () => {
  const noneOpened = deriveBriefing(freshStore({ lastOpenedContentId: null }), ALL_PODS, TEST_OVERLAY);
  assert.equal(noneOpened.continueLearning, null);

  const unresolvable = deriveBriefing(
    freshStore({ lastOpenedContentId: 'pod:2026-01-01:never-existed' }),
    ALL_PODS,
    TEST_OVERLAY,
  );
  assert.equal(unresolvable.continueLearning, null);
});

test('deriveBriefing never converts/promotes any item to practice (no queue mutation, no side effects)', () => {
  const store = freshStore({ queue: [UNKNOWN_SKILL_ID] });
  const snapshot = JSON.parse(JSON.stringify(store));
  const briefing = deriveBriefing(store, ALL_PODS, TEST_OVERLAY);
  // Unclassified queued entries never surface as active (they aren't
  // foundation_safe) and the store itself must be untouched.
  assert.equal(briefing.active.length, 0);
  assert.deepEqual(store, snapshot);
});

test('deriveBriefing returns an empty/null-safe briefing when pods are unavailable', () => {
  const store = freshStore({ queue: [MAP_GROUPS_SKILL_ID], lastOpenedContentId: RUCKING_CONTENT_ID });
  const briefing = deriveBriefing(store, undefined, TEST_OVERLAY);
  assert.deepEqual(briefing, { active: [], continueLearning: null });
});

// --- deriveKnowledgeFocusSnapshot --------------------------------------------------

test('deriveKnowledgeFocusSnapshot resolves up to 3 active items to labels for Calendar when pods are available', () => {
  const store = freshStore({ queue: [MAP_GROUPS_SKILL_ID, REGIONAL_EVENTS_SKILL_ID] });
  const snapshot = deriveKnowledgeFocusSnapshot(store, ALL_PODS, TEST_OVERLAY);
  assert.equal(snapshot.available, true);
  if (snapshot.available) {
    assert.equal(snapshot.activeItems.length, 2);
    assert.equal(snapshot.activeItems[0].label, 'Map the Groups');
    assert.equal(snapshot.activeItems[1].label, 'Regional current events');
    assert.equal(snapshot.activeCount, 2);
  }
  assert.equal(snapshot.reviewCount, 0);
});

test('deriveKnowledgeFocusSnapshot falls back to an unavailable state + counts (no raw ID labels) when pods are missing', () => {
  const store = freshStore({
    queue: [MAP_GROUPS_SKILL_ID, REGIONAL_EVENTS_SKILL_ID],
    needsReview: [RUCKING_SKILL_ID],
  });
  const snapshotUndefined = deriveKnowledgeFocusSnapshot(store, undefined, TEST_OVERLAY);
  const snapshotEmpty = deriveKnowledgeFocusSnapshot(store, [], TEST_OVERLAY);
  const snapshotMalformed = deriveKnowledgeFocusSnapshot(store, 'not-pods', TEST_OVERLAY);

  for (const snap of [snapshotUndefined, snapshotEmpty, snapshotMalformed]) {
    assert.equal(snap.available, false);
    assert.equal(snap.activeCount, 2);
    assert.equal(snap.reviewCount, 1);
    // The unavailable branch must never carry an `activeItems` field with
    // raw canonical IDs used as labels.
    assert.equal('activeItems' in snap, false);
  }
});

test('deriveKnowledgeFocusSnapshot never writes to the store (pure read projection)', () => {
  const store = freshStore({ queue: [MAP_GROUPS_SKILL_ID] });
  const snapshot = JSON.parse(JSON.stringify(store));
  deriveKnowledgeFocusSnapshot(store, ALL_PODS, TEST_OVERLAY);
  deriveKnowledgeFocusSnapshot(store, undefined, TEST_OVERLAY);
  assert.deepEqual(store, snapshot);
});

test('deriveKnowledgeFocusSnapshot excludes needsReview items from activeCount just like the briefing', () => {
  const store = freshStore({
    queue: [MAP_GROUPS_SKILL_ID, REGIONAL_EVENTS_SKILL_ID],
    needsReview: [MAP_GROUPS_SKILL_ID],
  });
  const snapshot = deriveKnowledgeFocusSnapshot(store, ALL_PODS, TEST_OVERLAY);
  assert.equal(snapshot.activeCount, 1);
  assert.equal(snapshot.reviewCount, 1);
  if (snapshot.available) {
    assert.equal(snapshot.activeItems.length, 1);
    assert.equal(snapshot.activeItems[0].id, REGIONAL_EVENTS_SKILL_ID);
  }
});
