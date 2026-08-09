import test from 'node:test';
import assert from 'node:assert/strict';

import {
  countCanonicalMobilityCompletions,
  foundationCompletionKeyForDate,
  hasFoundationWorkoutActivity,
} from './calendar-activity.ts';

test('foundationCompletionKeyForDate maps a calendar date to the canonical week/day completion key', () => {
  assert.equal(
    foundationCompletionKeyForDate('2026-08-08'),
    'sfprep:log:foundation:5:saturday:completed',
  );
});

test('foundationCompletionKeyForDate rejects dates outside the Foundation block', () => {
  assert.equal(foundationCompletionKeyForDate('2026-06-01'), null);
  assert.equal(foundationCompletionKeyForDate('2027-01-01'), null);
});

test('hasFoundationWorkoutActivity reads the completion array written by WorkoutDay', () => {
  const key = 'sfprep:log:foundation:5:saturday:completed';
  assert.equal(hasFoundationWorkoutActivity({ [key]: ['warm-up'] }, '2026-08-08'), true);
  assert.equal(hasFoundationWorkoutActivity({ [key]: [] }, '2026-08-08'), false);
});

test('countCanonicalMobilityCompletions counts true move indexes in the actual mobility store shape', () => {
  const store = {
    '2026-08-08': { 0: true, 1: false, 2: true },
  };
  assert.equal(countCanonicalMobilityCompletions(store, '2026-08-08'), 2);
  assert.equal(countCanonicalMobilityCompletions(store, '2026-08-09'), 0);
});
