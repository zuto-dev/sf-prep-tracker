import assert from 'node:assert/strict';
import test from 'node:test';

import { FOUNDATION_START } from './sfre-program.ts';
import {
  BODYWEIGHT_STORAGE_KEY,
  LIFECYCLE_STORAGE_KEY,
  LIFECYCLE_STORE_VERSION,
  BODYWEIGHT_STORE_VERSION,
  defaultLifecycleStore,
  defaultBodyweightStore,
  normalizeLifecycleStore,
  normalizeBodyweightStore,
  hydrateLifecycleStore,
  hydrateBodyweightStore,
  saveLifecycleStore,
  saveBodyweightStore,
  upsertBodyweightPoint,
  type StorageLike,
} from './sfre-store.ts';

function fakeStorage(initial: Record<string, string> = {}): StorageLike & { data: Record<string, string> } {
  const data = { ...initial };
  return {
    data,
    getItem: (key: string) => (key in data ? data[key] : null),
    setItem: (key: string, value: string) => { data[key] = value; },
  };
}

// --- normalizeLifecycleStore -------------------------------------------------

test('normalizeLifecycleStore returns the versioned default when raw is missing or not an object', () => {
  assert.deepEqual(normalizeLifecycleStore(undefined), defaultLifecycleStore());
  assert.deepEqual(normalizeLifecycleStore(null), defaultLifecycleStore());
  assert.deepEqual(normalizeLifecycleStore('garbage'), defaultLifecycleStore());
  assert.deepEqual(normalizeLifecycleStore(42), defaultLifecycleStore());
});

test('normalizeLifecycleStore preserves valid existing values', () => {
  const raw = {
    version: 1,
    foundationStart: '2026-07-06T00:00:00.000Z',
    confirmedSfreDate: '2027-01-01T00:00:00.000Z',
    bridgeStartedAt: '2026-10-05T00:00:00.000Z',
  };
  assert.deepEqual(normalizeLifecycleStore(raw), {
    version: LIFECYCLE_STORE_VERSION,
    foundationStart: '2026-07-06T00:00:00.000Z',
    confirmedSfreDate: '2027-01-01T00:00:00.000Z',
    bridgeStartedAt: '2026-10-05T00:00:00.000Z',
  });
});

test('normalizeLifecycleStore falls back an invalid foundationStart to the canonical default while preserving other valid fields', () => {
  const raw = { foundationStart: 'not-a-date', confirmedSfreDate: '2027-01-01T00:00:00.000Z' };
  const result = normalizeLifecycleStore(raw);
  assert.equal(result.foundationStart, FOUNDATION_START.toISOString());
  assert.equal(result.confirmedSfreDate, '2027-01-01T00:00:00.000Z');
});

test('normalizeLifecycleStore normalizes an invalid confirmedSfreDate/bridgeStartedAt to null rather than dropping the key silently', () => {
  const result = normalizeLifecycleStore({ confirmedSfreDate: 'nope', bridgeStartedAt: 12345 });
  assert.equal(result.confirmedSfreDate, null);
  assert.equal(result.bridgeStartedAt, null);
});

// --- normalizeBodyweightStore -----------------------------------------------

test('normalizeBodyweightStore returns the versioned empty default when raw is missing or not an object', () => {
  assert.deepEqual(normalizeBodyweightStore(undefined), defaultBodyweightStore());
  assert.deepEqual(normalizeBodyweightStore(null), defaultBodyweightStore());
  assert.deepEqual(normalizeBodyweightStore('garbage'), defaultBodyweightStore());
});

test('normalizeBodyweightStore preserves valid points and fills a missing recordedAt', () => {
  const raw = {
    points: [
      { date: '2026-07-01', value: 180 },
      { date: '2026-07-08', recordedAt: '2026-07-08T09:00:00.000Z', value: 179.5 },
    ],
  };
  const result: ReturnType<typeof normalizeBodyweightStore> = normalizeBodyweightStore(raw);
  assert.equal(result.version, BODYWEIGHT_STORE_VERSION);
  assert.equal(result.points.length, 2);
  assert.equal(result.points[0].date, '2026-07-01');
  assert.equal(result.points[0].value, 180);
  assert.equal(result.points[0].recordedAt, '2026-07-01T12:00:00.000Z');
  assert.equal(result.points[1].recordedAt, '2026-07-08T09:00:00.000Z');
});

test('normalizeBodyweightStore drops individually malformed points but keeps valid siblings', () => {
  const raw = {
    points: [
      { date: '2026-07-01', value: 180 },
      { date: '', value: 179 },
      { date: '2026-07-08', value: Number.NaN },
      { date: '2026-07-15', value: 178 },
      'not-an-object',
    ],
  };
  const result: ReturnType<typeof normalizeBodyweightStore> = normalizeBodyweightStore(raw);
  assert.deepEqual(result.points.map((p: { date: string }) => p.date), ['2026-07-01', '2026-07-15']);
});

// --- hydrateLifecycleStore (guarded storage) --------------------------------

test('hydrateLifecycleStore writes and returns the default when no key exists yet', () => {
  const storage = fakeStorage();
  const result = hydrateLifecycleStore(storage);
  assert.deepEqual(result, defaultLifecycleStore());
  assert.equal(storage.data[LIFECYCLE_STORAGE_KEY], JSON.stringify(defaultLifecycleStore()));
});

test('hydrateLifecycleStore migrates a partially-valid stored value and writes the normalized form back', () => {
  const storage = fakeStorage({
    [LIFECYCLE_STORAGE_KEY]: JSON.stringify({ foundationStart: 'garbage', confirmedSfreDate: '2027-01-01T00:00:00.000Z' }),
  });
  const result = hydrateLifecycleStore(storage);
  assert.equal(result.foundationStart, FOUNDATION_START.toISOString());
  assert.equal(result.confirmedSfreDate, '2027-01-01T00:00:00.000Z');
  assert.equal(storage.data[LIFECYCLE_STORAGE_KEY], JSON.stringify(result));
});

test('hydrateLifecycleStore NEVER overwrites malformed raw JSON in storage', () => {
  const malformedRaw = '{not valid json at all';
  const storage = fakeStorage({ [LIFECYCLE_STORAGE_KEY]: malformedRaw });
  const result = hydrateLifecycleStore(storage);
  assert.deepEqual(result, defaultLifecycleStore());
  assert.equal(storage.data[LIFECYCLE_STORAGE_KEY], malformedRaw, 'malformed raw storage must be left untouched');
});

test('hydrateLifecycleStore is a no-op passthrough default outside a browser/storage context', () => {
  assert.deepEqual(hydrateLifecycleStore(undefined), defaultLifecycleStore());
});

// --- hydrateBodyweightStore (guarded storage) -------------------------------

test('hydrateBodyweightStore writes and returns the default when no key exists yet', () => {
  const storage = fakeStorage();
  const result = hydrateBodyweightStore(storage);
  assert.deepEqual(result, defaultBodyweightStore());
  assert.equal(storage.data[BODYWEIGHT_STORAGE_KEY], JSON.stringify(defaultBodyweightStore()));
});

test('hydrateBodyweightStore NEVER overwrites malformed raw JSON in storage', () => {
  const malformedRaw = '[[[broken';
  const storage = fakeStorage({ [BODYWEIGHT_STORAGE_KEY]: malformedRaw });
  const result = hydrateBodyweightStore(storage);
  assert.deepEqual(result, defaultBodyweightStore());
  assert.equal(storage.data[BODYWEIGHT_STORAGE_KEY], malformedRaw);
});

// --- saveLifecycleStore / saveBodyweightStore -------------------------------

test('saveLifecycleStore and saveBodyweightStore write the exact serialized store to the given storage', () => {
  const storage = fakeStorage();
  const lifecycle = { version: LIFECYCLE_STORE_VERSION, foundationStart: FOUNDATION_START.toISOString(), confirmedSfreDate: null, bridgeStartedAt: null };
  saveLifecycleStore(lifecycle, storage);
  assert.equal(storage.data[LIFECYCLE_STORAGE_KEY], JSON.stringify(lifecycle));

  const bodyweight = { version: BODYWEIGHT_STORE_VERSION, points: [{ date: '2026-07-01', recordedAt: '2026-07-01T12:00:00.000Z', value: 180 }] };
  saveBodyweightStore(bodyweight, storage);
  assert.equal(storage.data[BODYWEIGHT_STORAGE_KEY], JSON.stringify(bodyweight));
});

// --- upsertBodyweightPoint ---------------------------------------------------

test('upsertBodyweightPoint appends a new date in sorted order', () => {
  const store = { version: BODYWEIGHT_STORE_VERSION, points: [{ date: '2026-07-01', recordedAt: '2026-07-01T12:00:00.000Z', value: 180 }] };
  const next = upsertBodyweightPoint(store, { date: '2026-07-08', value: 179, recordedAt: '2026-07-08T08:00:00.000Z' });
  assert.deepEqual(next.points.map(p => p.date), ['2026-07-01', '2026-07-08']);
});

test('upsertBodyweightPoint replaces an existing same-date entry instead of duplicating it', () => {
  const store = { version: BODYWEIGHT_STORE_VERSION, points: [{ date: '2026-07-01', recordedAt: '2026-07-01T09:00:00.000Z', value: 180 }] };
  const next = upsertBodyweightPoint(store, { date: '2026-07-01', value: 181.2, recordedAt: '2026-07-01T18:00:00.000Z' });
  assert.equal(next.points.length, 1);
  assert.equal(next.points[0].value, 181.2);
  assert.equal(next.points[0].recordedAt, '2026-07-01T18:00:00.000Z');
});
