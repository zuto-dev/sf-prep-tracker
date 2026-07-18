import assert from 'node:assert/strict';
import test from 'node:test';

import {
  migrateLegacyCompletions,
  addToQueue,
  completeItem,
  deferItem,
  noteItem,
  reconcileQueue,
  contentId,
  skillId,
  type PodLike,
  type CurationOverlay,
} from './knowledge-engine.ts';
import { defaultKnowledgeStore, type KnowledgeStore } from './knowledge-store.ts';

const NOW = '2026-07-06T12:00:00.000Z';

function pods(): PodLike[] {
  return [
    {
      date: '2026-07-06',
      title: 'Foundations of Selection',
      skills: [
        { title: 'Ruck Pacing', detail: 'Maintain 15:00/mile under load' },
        { title: 'Land Navigation', detail: 'Dead reckoning with pace count' },
      ],
    },
    {
      date: '2026-07-13',
      title: 'Advanced Selection',
      skills: [{ title: 'Rope Work', detail: 'Knot tying under stress' }],
    },
  ];
}

function ownerA() {
  return contentId('2026-07-06', 'Foundations of Selection');
}
function ownerB() {
  return contentId('2026-07-13', 'Advanced Selection');
}

// --- migrateLegacyCompletions -------------------------------------------------

test('migrateLegacyCompletions maps legacy date:index true values to content-derived skill IDs', () => {
  const store = defaultKnowledgeStore();
  const legacyRaw = { '2026-07-06:0': true, '2026-07-06:1': false, '2026-07-13:0': true };
  const result = migrateLegacyCompletions(store, legacyRaw, pods(), NOW);

  const expectedIdA0 = skillId(ownerA(), 'Ruck Pacing', 'Maintain 15:00/mile under load');
  const expectedIdB0 = skillId(ownerB(), 'Rope Work', 'Knot tying under stress');

  assert.equal(result.legacyMigration.migratedAt, NOW);
  assert.deepEqual(result.completions, {
    [expectedIdA0]: { completedAt: NOW },
    [expectedIdB0]: { completedAt: NOW },
  });
  assert.deepEqual(result.legacyMigration.unmapped, []);
});

test('migrateLegacyCompletions defers (no migratedAt) when pods are unavailable/undefined/empty', () => {
  const store = defaultKnowledgeStore();
  const legacyRaw = { '2026-07-06:0': true };

  const undefinedResult = migrateLegacyCompletions(store, legacyRaw, undefined, NOW);
  assert.equal(undefinedResult.legacyMigration.migratedAt, null);
  assert.deepEqual(undefinedResult, store);

  const emptyResult = migrateLegacyCompletions(store, legacyRaw, [], NOW);
  assert.equal(emptyResult.legacyMigration.migratedAt, null);
  assert.deepEqual(emptyResult, store);

  const malformedPodsResult = migrateLegacyCompletions(store, legacyRaw, [{ nope: true }], NOW);
  assert.equal(malformedPodsResult.legacyMigration.migratedAt, null);
  assert.deepEqual(malformedPodsResult, store);
});

test('migrateLegacyCompletions returns the store unchanged (no migratedAt) for malformed legacyRaw', () => {
  const store = defaultKnowledgeStore();

  for (const badRaw of ['garbage', 42, ['array', 'not', 'object'], true]) {
    const result = migrateLegacyCompletions(store, badRaw, pods(), NOW);
    assert.equal(result.legacyMigration.migratedAt, null);
    assert.deepEqual(result, store);
  }
});

test('migrateLegacyCompletions marks migratedAt for empty/missing legacyRaw when pods are valid', () => {
  const store = defaultKnowledgeStore();

  const undefinedRaw = migrateLegacyCompletions(store, undefined, pods(), NOW);
  assert.equal(undefinedRaw.legacyMigration.migratedAt, NOW);
  assert.deepEqual(undefinedRaw.completions, {});
  assert.deepEqual(undefinedRaw.legacyMigration.unmapped, []);

  const nullRaw = migrateLegacyCompletions(store, null, pods(), NOW);
  assert.equal(nullRaw.legacyMigration.migratedAt, NOW);

  const emptyObjRaw = migrateLegacyCompletions(store, {}, pods(), NOW);
  assert.equal(emptyObjRaw.legacyMigration.migratedAt, NOW);
  assert.deepEqual(emptyObjRaw.completions, {});
});

test('migrateLegacyCompletions appends {rawKey, reason} to unmapped for invalid/missing pod/date/index items rather than discarding them', () => {
  const store = defaultKnowledgeStore();
  const legacyRaw = {
    'not-a-legacy-key': true, // malformed key format
    '2099-01-01:0': true, // unknown date
    '2026-07-06:99': true, // out-of-range index for a known date
    'weird::5': true, // malformed key format (empty date segment before last colon parses oddly)
    '2026-07-06:0': true, // valid, should still be mapped alongside the unmapped rows
  };
  const result = migrateLegacyCompletions(store, legacyRaw, pods(), NOW);

  assert.equal(result.legacyMigration.migratedAt, NOW);
  const reasons = Object.fromEntries(result.legacyMigration.unmapped.map(u => [u.rawKey, u.reason]));
  assert.ok('not-a-legacy-key' in reasons);
  assert.ok('2099-01-01:0' in reasons);
  assert.ok('2026-07-06:99' in reasons);
  // valid entry still gets mapped despite siblings failing
  const expectedIdA0 = skillId(ownerA(), 'Ruck Pacing', 'Maintain 15:00/mile under load');
  assert.deepEqual(result.completions, { [expectedIdA0]: { completedAt: NOW } });
});

test('migrateLegacyCompletions is idempotent when legacyMigration.migratedAt is already non-null', () => {
  const alreadyMigrated: KnowledgeStore = {
    ...defaultKnowledgeStore(),
    completions: { 'some-id': { completedAt: '2020-01-01T00:00:00.000Z' } },
    legacyMigration: { migratedAt: '2020-01-01T00:00:00.000Z', unmapped: [{ rawKey: 'old', reason: 'prior run' }] },
  };
  const legacyRaw = { '2026-07-06:0': true };
  const result = migrateLegacyCompletions(alreadyMigrated, legacyRaw, pods(), NOW);
  assert.deepEqual(result, alreadyMigrated);
});

test('migrateLegacyCompletions never writes/deletes legacy raw — it only returns a new KnowledgeStore, the input legacyRaw object is untouched', () => {
  const store = defaultKnowledgeStore();
  const legacyRaw = { '2026-07-06:0': true };
  const legacyRawSnapshot = JSON.parse(JSON.stringify(legacyRaw));
  migrateLegacyCompletions(store, legacyRaw, pods(), NOW);
  assert.deepEqual(legacyRaw, legacyRawSnapshot);
});

test('migrateLegacyCompletions does not overwrite an existing completion for an ID already completed', () => {
  const expectedIdA0 = skillId(ownerA(), 'Ruck Pacing', 'Maintain 15:00/mile under load');
  const store: KnowledgeStore = {
    ...defaultKnowledgeStore(),
    completions: { [expectedIdA0]: { completedAt: '2020-01-01T00:00:00.000Z' } },
  };
  const result = migrateLegacyCompletions(store, { '2026-07-06:0': true }, pods(), NOW);
  assert.equal(result.completions[expectedIdA0].completedAt, '2020-01-01T00:00:00.000Z');
});

// --- addToQueue: hard queue gate ---------------------------------------------

test('addToQueue no-ops when curation status is not foundation_safe', () => {
  const store = defaultKnowledgeStore();
  const id = 'pod:2026-07-06:foundations-of-selection';
  const resultUnclassified = addToQueue(store, id, 'unclassified');
  const resultReferenceOnly = addToQueue(store, id, 'reference_only');
  assert.deepEqual(resultUnclassified, store);
  assert.deepEqual(resultReferenceOnly, store);
});

test('addToQueue queues an ID only when curation status is explicitly foundation_safe', () => {
  const store = defaultKnowledgeStore();
  const id = 'pod:2026-07-06:foundations-of-selection';
  const result = addToQueue(store, id, 'foundation_safe');
  assert.deepEqual(result.queue, [id]);
  // only queue field changed
  assert.deepEqual({ ...result, queue: store.queue }, store);
});

test('addToQueue dedupes successful queues', () => {
  const store = defaultKnowledgeStore();
  const id = 'pod:2026-07-06:foundations-of-selection';
  const once = addToQueue(store, id, 'foundation_safe');
  const twice = addToQueue(once, id, 'foundation_safe');
  assert.deepEqual(twice.queue, [id]);
});

// --- complete/defer/note: exact field isolation ------------------------------

test('completeItem mutates only the completions field with a timestamped record', () => {
  const store = defaultKnowledgeStore();
  const id = 'pod:2026-07-06:foundations-of-selection';
  const result = completeItem(store, id, NOW);
  assert.deepEqual(result.completions, { [id]: { completedAt: NOW } });
  assert.deepEqual({ ...result, completions: store.completions }, store);
});

test('deferItem mutates only the deferred string[] field and dedupes', () => {
  const store = defaultKnowledgeStore();
  const id = 'pod:2026-07-06:foundations-of-selection';
  const once = deferItem(store, id);
  assert.deepEqual(once.deferred, [id]);
  assert.deepEqual({ ...once, deferred: store.deferred }, store);
  const twice = deferItem(once, id);
  assert.deepEqual(twice.deferred, [id]);
});

test('noteItem mutates only the notes Record field', () => {
  const store = defaultKnowledgeStore();
  const id = 'pod:2026-07-06:foundations-of-selection';
  const result = noteItem(store, id, 'good context');
  assert.deepEqual(result.notes, { [id]: 'good context' });
  assert.deepEqual({ ...result, notes: store.notes }, store);
});

test('complete/defer/note mutations have no workout/standards/nutrition effects (KnowledgeStore has no such fields)', () => {
  const store = defaultKnowledgeStore();
  const id = 'pod:2026-07-06:foundations-of-selection';
  const result = completeItem(deferItem(noteItem(store, id, 'note'), id), id, NOW);
  assert.deepEqual(Object.keys(result).sort(), Object.keys(defaultKnowledgeStore()).sort());
});

// --- reconcileQueue: preserves history, only appends needsReview -------------

test('reconcileQueue marks non-foundation-safe queued IDs needsReview', () => {
  const id = 'pod:2026-07-06:foundations-of-selection';
  const store: KnowledgeStore = { ...defaultKnowledgeStore(), queue: [id] };
  const overlay: CurationOverlay = { [id]: 'reference_only' };
  const result = reconcileQueue(store, overlay);
  assert.deepEqual(result.needsReview, [id]);
});

test('reconcileQueue does not flag a queued ID that is still foundation_safe', () => {
  const id = 'pod:2026-07-06:foundations-of-selection';
  const store: KnowledgeStore = { ...defaultKnowledgeStore(), queue: [id] };
  const overlay: CurationOverlay = { [id]: 'foundation_safe' };
  const result = reconcileQueue(store, overlay);
  assert.deepEqual(result.needsReview, []);
  assert.deepEqual(result, store);
});

test('reconcileQueue does not delete queue/notes/completion history — it only appends to needsReview', () => {
  const id = 'pod:2026-07-06:foundations-of-selection';
  const otherId = 'pod:2026-06-29:other';
  const store: KnowledgeStore = {
    ...defaultKnowledgeStore(),
    queue: [id, otherId],
    notes: { [id]: 'kept note' },
    completions: { [otherId]: { completedAt: '2020-01-01T00:00:00.000Z' } },
    needsReview: ['pre-existing-flag'],
  };
  const overlay: CurationOverlay = { [id]: 'reference_only', [otherId]: 'foundation_safe' };
  const result = reconcileQueue(store, overlay);

  assert.deepEqual(result.queue, [id, otherId]);
  assert.deepEqual(result.notes, { [id]: 'kept note' });
  assert.deepEqual(result.completions, { [otherId]: { completedAt: '2020-01-01T00:00:00.000Z' } });
  assert.deepEqual(result.needsReview, ['pre-existing-flag', id]);
});

test('reconcileQueue dedupes needsReview entries across repeated calls', () => {
  const id = 'pod:2026-07-06:foundations-of-selection';
  const store: KnowledgeStore = { ...defaultKnowledgeStore(), queue: [id] };
  const overlay: CurationOverlay = { [id]: 'unclassified' };
  const once = reconcileQueue(store, overlay);
  const twice = reconcileQueue(once, overlay);
  assert.deepEqual(twice.needsReview, [id]);
});

test('reconcileQueue with no overlay flags every queued ID (default resolves to unclassified)', () => {
  const id = 'pod:2026-07-06:foundations-of-selection';
  const store: KnowledgeStore = { ...defaultKnowledgeStore(), queue: [id] };
  const result = reconcileQueue(store);
  assert.deepEqual(result.needsReview, [id]);
});
