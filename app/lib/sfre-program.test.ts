import assert from 'node:assert/strict';
import test from 'node:test';

import {
  FOUNDATION_DAYS,
  FOUNDATION_START,
  canonicalTwoMileSeconds,
  resolveBodyweightTrend,
  resolveFoundationNutritionGuidance,
  resolveSfreLifecycle,
  resolveStrictRuckGate,
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
