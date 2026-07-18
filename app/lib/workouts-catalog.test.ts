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

// --- Saturday catalog renders the Phase 3 (week 10+) 3-mile tempo cap -------
//
// Regression guard for the rendered Foundation catalog (app/data/workouts.ts),
// distinct from the pure sfre-program.ts resolveFoundationTempoCap() resolver
// test. resolveFoundationTempoCap() existed but was orphaned — the actual
// Saturday session for Foundation weeks 10-13 still rendered the stale
// "3-5 mi at tempo" text instead of the corrected 3-mile hard-tempo cap with
// an explicit easy-only extension. This proves the *rendered UI-facing*
// catalog, not just the policy function.

test('Saturday catalog caps the hard tempo portion at 3 miles from Foundation week 10 onward, with an explicit easy-only extension', () => {
  for (const week of FOUNDATION_WEEKS.slice(9, 13)) { // weeks 10-13 (0-indexed 9..12)
    const exercises = week.saturday.exercises;
    const text = exercises
      .map(ex => `${ex.name} ${ex.duration ?? ''} ${ex.distance ?? ''} ${ex.notes ?? ''}`)
      .join(' | ');

    // Test weeks (e.g. week 13) render a 2-Mile Time Trial, not a tempo run —
    // the tempo cap only governs the tempo-run branch.
    const isTempoWeek = exercises.some(ex => ex.name === 'Tempo Run');
    if (!isTempoWeek) continue;

    assert.ok(
      !text.includes('3-5 mi at tempo'),
      `stale uncapped '3-5 mi at tempo' text must not render, got: ${text}`,
    );

    const tempoEx = exercises.find(ex => ex.name === 'Tempo Run');
    assert.ok(tempoEx, 'expected a Tempo Run exercise');
    assert.match(
      tempoEx.duration ?? '',
      /\b3 mi at tempo\b/,
      `Tempo Run duration must state the exact 3-mile hard tempo cap, got: ${tempoEx.duration}`,
    );

    const extensionEx = exercises.find(ex => /easy/i.test(ex.name) && /extension|optional/i.test(ex.name));
    assert.ok(
      extensionEx,
      `expected an explicit optional easy-only extension exercise, got exercise names: ${exercises.map(e => e.name).join(', ')}`,
    );
    assert.match(
      `${extensionEx?.duration ?? ''} ${extensionEx?.notes ?? ''}`,
      /1-2 mi/,
      'extension must state the optional 1-2 mile distance',
    );
    assert.match(
      `${extensionEx?.duration ?? ''} ${extensionEx?.notes ?? ''}`,
      /easy/i,
      'extension must be explicitly EASY only',
    );
    assert.doesNotMatch(
      `${extensionEx?.duration ?? ''} ${extensionEx?.notes ?? ''}`,
      /tempo/i,
      'extension must never be described as additional tempo volume',
    );
  }
});
