import assert from 'node:assert/strict';
import test from 'node:test';

import {
  FOUNDATION_DAYS,
  FOUNDATION_START,
  FOUNDATION_WEEKS,
  canToggleCompletion,
  canonicalTwoMileSeconds,
  resolveBodyweightTrend,
  resolveFoundationNutritionGuidance,
  resolveFoundationSaturdaySession,
  resolveFoundationTempoCap,
  resolveFoundationWeekIndex,
  resolveFridayPrescription,
  resolveRuckLockState,
  resolveSfreLifecycle,
  resolveStrictRuckGate,
  resolveThursdayRecoveryPolicy,
} from './sfre-program.ts';

// --- Lifecycle -------------------------------------------------------------

test('lifecycle is foundation on day 1 and stays foundation through day 91', () => {
  assert.equal(resolveSfreLifecycle({ date: FOUNDATION_START }), 'foundation');
  const lastFoundationDay = new Date(FOUNDATION_START.getTime() + (FOUNDATION_DAYS - 1) * 86_400_000);
  assert.equal(resolveSfreLifecycle({ date: lastFoundationDay }), 'foundation');
});

test('lifecycle rolls into bridge once the 91-day foundation window elapses with no confirmed event', () => {
  const dayAfterFoundation = new Date(FOUNDATION_START.getTime() + FOUNDATION_DAYS * 86_400_000);
  assert.equal(resolveSfreLifecycle({ date: dayAfterFoundation }), 'bridge');
});

test('lifecycle becomes mti_peak only inside the 49-day window before a confirmed event date', () => {
  const confirmedEventDate = new Date('2027-01-01T00:00:00Z');
  const day50Before = new Date(confirmedEventDate.getTime() - 50 * 86_400_000);
  const day49Before = new Date(confirmedEventDate.getTime() - 49 * 86_400_000);
  const day1Before = new Date(confirmedEventDate.getTime() - 1 * 86_400_000);

  assert.equal(resolveSfreLifecycle({ date: day50Before, confirmedEventDate }), 'bridge');
  assert.equal(resolveSfreLifecycle({ date: day49Before, confirmedEventDate }), 'mti_peak');
  assert.equal(resolveSfreLifecycle({ date: day1Before, confirmedEventDate }), 'mti_peak');
});

test('lifecycle becomes post_event on and after the confirmed event date', () => {
  const confirmedEventDate = new Date('2027-01-01T00:00:00Z');
  assert.equal(resolveSfreLifecycle({ date: confirmedEventDate, confirmedEventDate }), 'post_event');
  assert.equal(
    resolveSfreLifecycle({ date: new Date(confirmedEventDate.getTime() + 86_400_000), confirmedEventDate }),
    'post_event',
  );
});

test('resolveSfreLifecycle never returns an mti_peak session content payload — state only', () => {
  const confirmedEventDate = new Date('2027-01-01T00:00:00Z');
  const state = resolveSfreLifecycle({ date: new Date(confirmedEventDate.getTime() - 10 * 86_400_000), confirmedEventDate });
  assert.equal(typeof state, 'string');
  assert.equal(state, 'mti_peak');
});

// --- Strict two-mile gate ---------------------------------------------------

test('canonicalTwoMileSeconds reads only the standards history, never a generic pace field', () => {
  assert.equal(
    canonicalTwoMileSeconds({
      history: {
        twoMileRun: [
          { date: '2026-07-10', recordedAt: '2026-07-10T12:00:00.000Z', value: 985 },
          { date: '2026-07-14', recordedAt: '2026-07-14T12:00:00.000Z', value: 955 },
        ],
      },
    }),
    955,
  );
  assert.equal(canonicalTwoMileSeconds(null), null);
  assert.equal(canonicalTwoMileSeconds(undefined), null);
  assert.equal(canonicalTwoMileSeconds({ history: {} }), null);
});

test('resolveStrictRuckGate clears only at or under 960 seconds from the canonical source', () => {
  assert.deepEqual(resolveStrictRuckGate(960), { cleared: true, gateSeconds: 960 });
  assert.deepEqual(resolveStrictRuckGate(959), { cleared: true, gateSeconds: 960 });
  assert.deepEqual(resolveStrictRuckGate(961), { cleared: false, gateSeconds: 960 });
  assert.deepEqual(resolveStrictRuckGate(null), { cleared: false, gateSeconds: 960 });
});

// --- Day-aware Foundation nutrition ranges ----------------------------------

test('resolveFoundationNutritionGuidance returns the training-day range for non-custom presets', () => {
  const guidance = resolveFoundationNutritionGuidance({ preset: 'foundation', isTrainingDay: true });
  assert.deepEqual(guidance, {
    kcalRange: [2400, 2500],
    proteinRangeG: [145, 150],
    fatFloorG: 50,
  });
});

test('resolveFoundationNutritionGuidance returns the rest-day range for non-custom presets', () => {
  const guidance = resolveFoundationNutritionGuidance({ preset: 'foundation', isTrainingDay: false });
  assert.deepEqual(guidance, {
    kcalRange: [2100, 2200],
    proteinRangeG: [145, 150],
    fatFloorG: 50,
  });
});

test('resolveFoundationNutritionGuidance returns null for custom presets and never mutates user macros', () => {
  assert.equal(resolveFoundationNutritionGuidance({ preset: 'custom', isTrainingDay: true }), null);
});

// --- Bodyweight trend --------------------------------------------------------

test('resolveBodyweightTrend reports insufficient_data with fewer than 3 valid points', () => {
  assert.equal(
    resolveBodyweightTrend([
      { date: '2026-07-01', value: 180 },
      { date: '2026-07-22', value: 179 },
    ]),
    'insufficient_data',
  );
});

test('resolveBodyweightTrend reports insufficient_data when points span fewer than 21 days', () => {
  assert.equal(
    resolveBodyweightTrend([
      { date: '2026-07-01', value: 180 },
      { date: '2026-07-05', value: 179.5 },
      { date: '2026-07-10', value: 179 },
    ]),
    'insufficient_data',
  );
});

test('resolveBodyweightTrend holds when weight is stable across a 21+ day span', () => {
  assert.equal(
    resolveBodyweightTrend([
      { date: '2026-07-01', value: 180 },
      { date: '2026-07-12', value: 180.2 },
      { date: '2026-07-22', value: 180.1 },
    ]),
    'hold',
  );
});

test('resolveBodyweightTrend recommends increase_100_150 when weight is dropping across a 21+ day span', () => {
  assert.equal(
    resolveBodyweightTrend([
      { date: '2026-07-01', value: 181 },
      { date: '2026-07-12', value: 179.5 },
      { date: '2026-07-22', value: 178.5 },
    ]),
    'increase_100_150',
  );
});

test('resolveBodyweightTrend recommends decrease_100_150 when weight is climbing across a 21+ day span', () => {
  assert.equal(
    resolveBodyweightTrend([
      { date: '2026-07-01', value: 178 },
      { date: '2026-07-12', value: 179.5 },
      { date: '2026-07-22', value: 180.2 },
    ]),
    'decrease_100_150',
  );
});

test('resolveBodyweightTrend ignores malformed points (non-finite value / missing date) when checking sufficiency', () => {
  assert.equal(
    resolveBodyweightTrend([
      { date: '2026-07-01', value: 180 },
      { date: '', value: NaN as unknown as number },
      { date: '2026-07-05', value: 179.8 },
    ]),
    'insufficient_data',
  );
});

// --- Foundation week index ---------------------------------------------------

test('resolveFoundationWeekIndex maps the Foundation start date to week 1', () => {
  assert.equal(resolveFoundationWeekIndex(FOUNDATION_START), 1);
});

test('resolveFoundationWeekIndex clamps dates before Foundation start to week 1', () => {
  assert.equal(resolveFoundationWeekIndex(new Date(FOUNDATION_START.getTime() - 86_400_000)), 1);
});

test('resolveFoundationWeekIndex advances a week every 7 days and clamps at week 13', () => {
  assert.equal(resolveFoundationWeekIndex(new Date(FOUNDATION_START.getTime() + 7 * 86_400_000)), 2);
  assert.equal(resolveFoundationWeekIndex(new Date(FOUNDATION_START.getTime() + 90 * 86_400_000)), FOUNDATION_WEEKS);
  assert.equal(resolveFoundationWeekIndex(new Date(FOUNDATION_START.getTime() + 400 * 86_400_000)), FOUNDATION_WEEKS);
});

// --- Friday session prescription --------------------------------------------

test('resolveFridayPrescription is fasted weigh-in, 2-min HRPU, 5-min rest, 2-min sit-ups, in that order', () => {
  const prescription = resolveFridayPrescription();
  assert.equal(prescription.kind, 'friday_pt_test');
  assert.deepEqual(prescription.steps.map(s => s.name), [
    'Fasted Weigh-In',
    '2-Minute HRPU (Max Push-ups)',
    'Rest',
    '2-Minute Sit-ups',
  ]);
  assert.equal(prescription.steps[1].durationSeconds, 120);
  assert.equal(prescription.steps[2].durationSeconds, 300);
  assert.equal(prescription.steps[3].durationSeconds, 120);
});

// --- Thursday protected recovery ---------------------------------------------

test('resolveThursdayRecoveryPolicy marks Thursday as protected recovery that is never a strength make-up day', () => {
  assert.deepEqual(resolveThursdayRecoveryPolicy(), { protected: true, allowMakeupStrength: false });
});

// --- Foundation week 10+ hard tempo cap --------------------------------------

test('resolveFoundationTempoCap has no cap before week 10', () => {
  assert.deepEqual(resolveFoundationTempoCap(9), { hardTempoCapMiles: null, extensionPolicy: 'none' });
});

test('resolveFoundationTempoCap caps the hard tempo portion at 3 miles from week 10 onward, extension easy-only', () => {
  assert.deepEqual(resolveFoundationTempoCap(10), { hardTempoCapMiles: 3, extensionPolicy: 'easy_only' });
  assert.deepEqual(resolveFoundationTempoCap(13), { hardTempoCapMiles: 3, extensionPolicy: 'easy_only' });
});

// --- Saturday ruck-or-substitute session decision ----------------------------

test('resolveFoundationSaturdaySession reports not_scheduled outside ruck weeks', () => {
  assert.deepEqual(resolveFoundationSaturdaySession(1, 900), { kind: 'not_scheduled' });
  assert.deepEqual(resolveFoundationSaturdaySession(8, 900), { kind: 'not_scheduled' });
});

test('resolveFoundationSaturdaySession replaces a scheduled ruck with the prescribed Easy Long Walk / Recovery when the gate is unmet', () => {
  const decision = resolveFoundationSaturdaySession(7, null);
  assert.equal(decision.kind, 'ruck_locked');
  if (decision.kind === 'ruck_locked') {
    assert.equal(decision.substitute, 'Easy Long Walk / Recovery');
    assert.match(decision.lockReason, /960/);
  }
});

test('resolveFoundationSaturdaySession keeps a cleared ruck walking-only when the gate is met', () => {
  assert.deepEqual(resolveFoundationSaturdaySession(7, 900), { kind: 'ruck_cleared', mode: 'walking_only' });
});

// --- Ruck completion lock -----------------------------------------------------

test('resolveRuckLockState is unlocked when the ruck is not scheduled or cleared', () => {
  assert.deepEqual(resolveRuckLockState(1, null), { locked: false });
  assert.deepEqual(resolveRuckLockState(7, 900), { locked: false });
});

test('resolveRuckLockState locks a scheduled ruck with an unmet gate and names the substitute', () => {
  const state = resolveRuckLockState(7, null);
  assert.equal(state.locked, true);
  if (state.locked) {
    assert.equal(state.substitute, 'Easy Long Walk / Recovery');
    assert.match(state.reason, /960/);
  }
});

test('canToggleCompletion is the smallest pure completion guard: false when locked, true when unlocked', () => {
  assert.equal(canToggleCompletion(true), false);
  assert.equal(canToggleCompletion(false), true);
});
