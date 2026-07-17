import assert from 'node:assert/strict';
import test from 'node:test';
import { mergeLegacySnapshot } from './sync-migration.ts';

test('legacy sync migration imports only missing SF Prep records and never overwrites versioned data', () => {
  const current = {
    'sfprep:nutrition': {
      key: 'sfprep:nutrition',
      value: '{"days":{"2026-07-17":{"breakfast":["phone-log"]}}}',
      version: 8,
      clientUpdatedAt: '2026-07-17T00:36:49.570Z',
    },
  };

  const legacy = {
    keys: {
      'sfprep:nutrition': { days: { '2026-07-16': { breakfast: ['stale-log'] } } },
      'sfprep:metrics': { bodyWeight: [{ date: '2026-07-16', value: 150 }] },
      'sfprep:_deviceId': 'legacy-device',
    },
    updatedAt: '2026-07-16T20:50:16.347Z',
  };

  const first = mergeLegacySnapshot(current, legacy, '2026-07-17T01:00:00.000Z');
  assert.deepEqual(first.migratedKeys, ['sfprep:metrics']);
  assert.equal(first.store['sfprep:nutrition'].value, current['sfprep:nutrition'].value);
  assert.equal(first.store['sfprep:metrics'].value, JSON.stringify(legacy.keys['sfprep:metrics']));
  assert.equal(first.store['sfprep:_deviceId'], undefined);

  const second = mergeLegacySnapshot(first.store, legacy, '2026-07-17T01:01:00.000Z');
  assert.deepEqual(second.migratedKeys, []);
  assert.deepEqual(second.store, first.store);
});
