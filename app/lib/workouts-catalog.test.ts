import assert from 'node:assert/strict';
import test from 'node:test';

import { FOUNDATION_WEEKS } from '../data/workouts.ts';

// --- Friday catalog renders the HRPU -> Rest 5m -> Sit-ups sequence ---------
//
// Regression guard for the rendered Foundation catalog (app/data/workouts.ts),
// distinct from the pure sfre-program.ts policy resolver test. This proves
// the *actual UI-facing exercise list* — not just the policy function —
// carries the corrected HRPU naming/standard and the fixed 5-minute rest.

test('Friday catalog renders 2-Minute HRPU -> 5-min Rest -> Sit-ups in order, for every Foundation week', () => {
  for (const week of FOUNDATION_WEEKS) {
    const names = week.friday.exercises.map(ex => ex.name);
    const hrpuIdx = names.indexOf('2-Minute HRPU (Max Push-ups)');
    assert.ok(hrpuIdx !== -1, `expected a '2-Minute HRPU (Max Push-ups)' exercise, got: ${names.join(', ')}`);

    // Must never be named the stale generic PT-test push-up entry.
    assert.ok(!names.some(n => n === '2-min Max Push-ups (PT Test)'), 'stale HRPU name must not render');

    const restIdx = names.indexOf('Rest');
    assert.equal(restIdx, hrpuIdx + 1, 'Rest must immediately follow the HRPU exercise');
    assert.equal(week.friday.exercises[restIdx].duration, '5 min', 'Rest must remain 5 minutes');

    const situpsIdx = names.findIndex(n => n.includes('Sit-ups'));
    assert.ok(situpsIdx > restIdx, 'Sit-ups must come after the rest period');

    const hrpuExercise = week.friday.exercises[hrpuIdx];
    assert.match(
      hrpuExercise.notes ?? '',
      /hand-release/i,
      'HRPU exercise notes must state the hand-release standard',
    );
  }
});
