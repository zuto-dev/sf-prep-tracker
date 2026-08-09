import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildBenchmarkRows,
  selectPrimaryWeakness,
} from './standards-presentation.ts';

test('buildBenchmarkRows preserves all SFAS thresholds and marks missing metrics not logged', () => {
  const rows = buildBenchmarkRows('sfas', {});
  const run = rows.find(row => row.key === 'twoMileRun');

  assert.ok(run);
  assert.equal(run.currentDisplay, 'Not logged');
  assert.equal(run.minimumDisplay, '16:00');
  assert.equal(run.averageDisplay, '13:30');
  assert.equal(run.eliteDisplay, '12:00');
  assert.equal(run.status, 'not-logged');
  assert.equal(run.gapDisplay, 'Log a result');
});

test('buildBenchmarkRows evaluates a logged value without changing the standards engine', () => {
  const rows = buildBenchmarkRows('sfas', {
    twoMileRun: [{
      date: '2026-08-08',
      recordedAt: '2026-08-08T12:00:00.000Z',
      value: 1259,
    }],
  });
  const run = rows.find(row => row.key === 'twoMileRun');

  assert.ok(run);
  assert.equal(run.currentDisplay, '20:59');
  assert.equal(run.status, 'below-minimum');
  assert.equal(run.statusLabel, 'Below Minimum');
  assert.equal(run.gapDisplay, '4:59 to minimum');
});

test('selectPrimaryWeakness ignores unlogged events and returns the lowest scored logged benchmark', () => {
  const rows = buildBenchmarkRows('sfas', {
    twoMileRun: [{ date: '2026-08-08', recordedAt: '2026-08-08T12:00:00.000Z', value: 1259 }],
    pullUps: [{ date: '2026-08-08', recordedAt: '2026-08-08T12:00:00.000Z', value: 7 }],
  });

  const weakness = selectPrimaryWeakness(rows);
  assert.ok(weakness);
  assert.equal(weakness.key, 'pullUps');
  assert.equal(weakness.label, 'Pull-ups');
});

test('selectPrimaryWeakness returns null when nothing is logged', () => {
  assert.equal(selectPrimaryWeakness(buildBenchmarkRows('sfas', {})), null);
});
