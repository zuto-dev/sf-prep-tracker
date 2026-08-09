import assert from 'node:assert/strict';
import test from 'node:test';

import {
  KNOWLEDGE_STORAGE_KEY,
  KNOWLEDGE_STORE_VERSION,
  defaultKnowledgeStore,
  normalizeKnowledgeStore,
  hydrateKnowledgeStore,
  saveKnowledgeStore,
  type StorageLike,
  type KnowledgeStore,
} from './knowledge-store.ts';

function fakeStorage(initial: Record<string, string> = {}): StorageLike & { data: Record<string, string> } {
  const data = { ...initial };
  return {
    data,
    getItem: (key: string) => (key in data ? data[key] : null),
    setItem: (key: string, value: string) => { data[key] = value; },
  };
}

// --- Field shape lock (Phase 2 exact shape) ----------------------------------

test('defaultKnowledgeStore has exactly the Phase 2 fields', () => {
  const store = defaultKnowledgeStore();
  assert.deepEqual(Object.keys(store).sort(), [
    'completions',
    'deferred',
    'lastOpenedContentId',
    'legacyMigration',
    'needsReview',
    'notes',
    'queue',
    'version',
    'weeklyFocusOrder',
  ]);
  assert.deepEqual(store, {
    version: KNOWLEDGE_STORE_VERSION,
    queue: [],
    completions: {},
    deferred: [],
    notes: {},
    lastOpenedContentId: null,
    weeklyFocusOrder: [],
    needsReview: [],
    legacyMigration: { migratedAt: null, unmapped: [] },
  });
});

// --- normalizeKnowledgeStore --------------------------------------------------

test('normalizeKnowledgeStore returns the versioned default when raw is missing or not an object', () => {
  assert.deepEqual(normalizeKnowledgeStore(undefined), defaultKnowledgeStore());
  assert.deepEqual(normalizeKnowledgeStore(null), defaultKnowledgeStore());
  assert.deepEqual(normalizeKnowledgeStore('garbage'), defaultKnowledgeStore());
  assert.deepEqual(normalizeKnowledgeStore(42), defaultKnowledgeStore());
  assert.deepEqual(normalizeKnowledgeStore([1, 2, 3]), defaultKnowledgeStore());
});

test('normalizeKnowledgeStore preserves a fully valid existing store exactly', () => {
  const raw: KnowledgeStore = {
    version: 1,
    queue: ['pod:2026-07-06:foo:skill:bar:abc123'],
    completions: { 'pod:2026-06-29:baz': { completedAt: '2026-06-29T12:00:00.000Z' } },
    deferred: ['pod:2026-07-06:foo'],
    notes: { 'pod:2026-07-06:foo': 'good context' },
    lastOpenedContentId: 'pod:2026-07-06:foo',
    weeklyFocusOrder: ['pod:2026-07-06:foo', 'pod:2026-06-29:baz'],
    needsReview: ['pod:2026-07-06:foo'],
    legacyMigration: {
      migratedAt: '2026-07-01T00:00:00.000Z',
      unmapped: [{ rawKey: 'old:legacy:key', reason: 'no canonical mapping found' }],
    },
  };
  assert.deepEqual(normalizeKnowledgeStore(raw), raw);
});

test('normalizeKnowledgeStore drops malformed array entries but keeps valid siblings', () => {
  const raw = {
    queue: ['valid-id', '', 42, null, 'another-valid-id'],
    deferred: ['deferred-id', {}, 42, 'kept-deferred-id'],
    weeklyFocusOrder: [123, 'kept-id'],
    needsReview: ['kept-review-id', []],
  };
  const result = normalizeKnowledgeStore(raw);
  assert.deepEqual(result.queue, ['valid-id', 'another-valid-id']);
  assert.deepEqual(result.deferred, ['deferred-id', 'kept-deferred-id']);
  assert.deepEqual(result.weeklyFocusOrder, ['kept-id']);
  assert.deepEqual(result.needsReview, ['kept-review-id']);
});

test('normalizeKnowledgeStore drops malformed completions/notes entries but keeps valid siblings', () => {
  const raw = {
    completions: {
      'good-id': { completedAt: '2026-06-29T12:00:00.000Z' },
      'bad-date-id': { completedAt: 'not-a-date' }, // invalid date -> dropped
      'missing-field-id': {}, // missing completedAt -> dropped
      'not-object-id': 'nope', // not an object -> dropped
    },
    notes: {
      'good-note': 'hello',
      'empty-note': '', // empty string -> dropped
      'non-string-note': 42, // not a string -> dropped
    },
  };
  const result = normalizeKnowledgeStore(raw);
  assert.deepEqual(result.completions, { 'good-id': { completedAt: '2026-06-29T12:00:00.000Z' } });
  assert.deepEqual(result.notes, { 'good-note': 'hello' });
});

test('normalizeKnowledgeStore treats a non-object/array completions or notes value as empty', () => {
  const result = normalizeKnowledgeStore({ completions: 'garbage', notes: [1, 2, 3] });
  assert.deepEqual(result.completions, {});
  assert.deepEqual(result.notes, {});
});

test('normalizeKnowledgeStore normalizes an invalid lastOpenedContentId to null rather than dropping the key silently', () => {
  const result = normalizeKnowledgeStore({ lastOpenedContentId: 42 });
  assert.equal(result.lastOpenedContentId, null);
});

test('normalizeKnowledgeStore falls back legacyMigration to the safe default when malformed', () => {
  const result = normalizeKnowledgeStore({ legacyMigration: 'not-an-object' });
  assert.deepEqual(result.legacyMigration, { migratedAt: null, unmapped: [] });

  const partial = normalizeKnowledgeStore({ legacyMigration: { migratedAt: 'bad-date', unmapped: [] } });
  assert.deepEqual(partial.legacyMigration, { migratedAt: null, unmapped: [] });
});

test('normalizeKnowledgeStore uses migratedAt null/non-null as the one-time migration gate (no migrated boolean)', () => {
  const notYetMigrated = normalizeKnowledgeStore({ legacyMigration: { migratedAt: null, unmapped: [] } });
  assert.equal(notYetMigrated.legacyMigration.migratedAt, null);
  assert.ok(!('migrated' in notYetMigrated.legacyMigration));

  const alreadyMigrated = normalizeKnowledgeStore({
    legacyMigration: { migratedAt: '2026-07-01T00:00:00.000Z', unmapped: [] },
  });
  assert.equal(alreadyMigrated.legacyMigration.migratedAt, '2026-07-01T00:00:00.000Z');
  assert.ok(!('migrated' in alreadyMigrated.legacyMigration));
});

test('normalizeKnowledgeStore preserves valid unmapped audit rows and drops malformed ones individually', () => {
  const raw = {
    legacyMigration: {
      migratedAt: '2026-07-01T00:00:00.000Z',
      unmapped: [
        { rawKey: 'old:key:one', reason: 'no canonical mapping found' },
        { rawKey: '', reason: 'blank rawKey' }, // empty rawKey -> dropped
        { rawKey: 'old:key:two', reason: '' }, // empty reason -> dropped
        { rawKey: 'old:key:three' }, // missing reason -> dropped
        'not-an-object', // dropped
        { rawKey: 'old:key:four', reason: 'kept sibling' },
      ],
    },
  };
  const result = normalizeKnowledgeStore(raw);
  assert.deepEqual(result.legacyMigration.unmapped, [
    { rawKey: 'old:key:one', reason: 'no canonical mapping found' },
    { rawKey: 'old:key:four', reason: 'kept sibling' },
  ]);
});

// --- hydrateKnowledgeStore (guarded storage) --------------------------------

test('hydrateKnowledgeStore writes and returns the default when no key exists yet (empty storage writes default)', () => {
  const storage = fakeStorage();
  const result = hydrateKnowledgeStore(storage);
  assert.deepEqual(result, defaultKnowledgeStore());
  assert.equal(storage.data[KNOWLEDGE_STORAGE_KEY], JSON.stringify(defaultKnowledgeStore()));
});

test('hydrateKnowledgeStore normalizes a partially-valid stored value and writes the normalized form back', () => {
  const storage = fakeStorage({
    [KNOWLEDGE_STORAGE_KEY]: JSON.stringify({ queue: ['a', 42, 'b'], lastOpenedContentId: 99 }),
  });
  const result = hydrateKnowledgeStore(storage);
  assert.deepEqual(result.queue, ['a', 'b']);
  assert.equal(result.lastOpenedContentId, null);
  assert.equal(storage.data[KNOWLEDGE_STORAGE_KEY], JSON.stringify(result));
});

test('hydrateKnowledgeStore NEVER overwrites malformed raw JSON in storage', () => {
  const malformedRaw = '{not valid json at all';
  const storage = fakeStorage({ [KNOWLEDGE_STORAGE_KEY]: malformedRaw });
  const result = hydrateKnowledgeStore(storage);
  assert.deepEqual(result, defaultKnowledgeStore());
  assert.equal(storage.data[KNOWLEDGE_STORAGE_KEY], malformedRaw, 'malformed raw storage must be left untouched');
});

test('hydrateKnowledgeStore is a no-op passthrough default outside a browser/storage context (storage-free no throw)', () => {
  assert.deepEqual(hydrateKnowledgeStore(undefined), defaultKnowledgeStore());
  assert.deepEqual(hydrateKnowledgeStore(null), defaultKnowledgeStore());
});

// --- saveKnowledgeStore -------------------------------------------------------

test('saveKnowledgeStore writes the exact serialized store to the given storage', () => {
  const storage = fakeStorage();
  const store = defaultKnowledgeStore();
  saveKnowledgeStore(store, storage);
  assert.equal(storage.data[KNOWLEDGE_STORAGE_KEY], JSON.stringify(store));
});

test('saveKnowledgeStore is a no-op (does not throw) when storage is absent', () => {
  assert.doesNotThrow(() => saveKnowledgeStore(defaultKnowledgeStore(), undefined));
  assert.doesNotThrow(() => saveKnowledgeStore(defaultKnowledgeStore(), null));
});
