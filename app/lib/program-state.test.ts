import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getProgramPosition,
  latestTwoMileSeconds,
  resolveRuckReadiness,
} from './program-state.ts';

test('program position maps Plan D start to Foundation Week 1 Day 1', () => {
  assert.deepEqual(getProgramPosition(new Date('2026-07-06T12:00:00Z')), {
    day: 1,
    globalWeek: 1,
    phase: 'foundation',
    phaseWeek: 1,
  });
});

test('program position clamps dates before Plan D start to Day 1', () => {
  assert.equal(getProgramPosition(new Date('2026-07-01T12:00:00Z')).day, 1);
});

test('ruck readiness blocks scheduled rucks without a qualifying 2-mile', () => {
  assert.deepEqual(resolveRuckReadiness(7, null), {
    scheduled: true,
    status: 'blocked',
    gateSeconds: 960,
    substitute: 'Easy Long Walk / Recovery',
  });
});

test('ruck readiness clears a scheduled ruck at a 16-minute 2-mile', () => {
  assert.deepEqual(resolveRuckReadiness(7, 960), {
    scheduled: true,
    status: 'cleared',
    gateSeconds: 960,
    substitute: null,
  });
});

test('latest two-mile result comes only from standards history, never from a progress-only pace value', () => {
  assert.equal(latestTwoMileSeconds({
    history: {
      twoMileRun: [
        { date: '2026-07-10', recordedAt: '2026-07-10T12:00:00.000Z', value: 985 },
        { date: '2026-07-14', recordedAt: '2026-07-14T12:00:00.000Z', value: 955 },
      ],
    },
  }, { runPace: [{ date: '2026-07-15', value: 14.5 }] }), 955);

  // No standards history at all: must return null, NOT derive a value from progress.runPace.
  assert.equal(latestTwoMileSeconds(null, { runPace: [{ date: '2026-07-15', value: 15.75 }] }), null);
  assert.equal(latestTwoMileSeconds(undefined, { runPace: [{ date: '2026-07-15', value: 1 }] }), null);
});

test('resolveRuckReadiness never clears a scheduled ruck when only a progress-only pace produced a null two-mile time', () => {
  const twoMileSeconds = latestTwoMileSeconds(null, { runPace: [{ date: '2026-07-15', value: 1 }] });
  assert.deepEqual(resolveRuckReadiness(7, twoMileSeconds), {
    scheduled: true,
    status: 'blocked',
    gateSeconds: 960,
    substitute: 'Easy Long Walk / Recovery',
  });
});
