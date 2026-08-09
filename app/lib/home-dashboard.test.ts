import test from 'node:test';
import assert from 'node:assert/strict';

import { FOUNDATION_WEEKS } from '../data/workouts.ts';
import {
  countCompletedDays,
  describeMission,
  resolveHomeEventStatus,
} from './home-dashboard.ts';

test('describeMission renders a time trial as steps without inventing zero sets', () => {
  const mission = describeMission(FOUNDATION_WEEKS[4].saturday);
  assert.equal(mission.type, 'Assessment');
  assert.equal(mission.intensity, 'High');
  assert.equal(mission.dose, '3 steps · Timed assessment');
  assert.equal(mission.title, '2-Mile Time Trial');
});

test('describeMission summarizes mixed run and strength work without a misleading set total', () => {
  const mission = describeMission(FOUNDATION_WEEKS[4].monday);
  assert.equal(mission.type, 'Run + Strength');
  assert.equal(mission.dose, '9 movements · 1 session');
});

test('resolveHomeEventStatus refuses to fabricate a ship countdown without a confirmed event date', () => {
  assert.deepEqual(resolveHomeEventStatus(null, new Date('2026-08-08T12:00:00Z')), {
    state: 'date-required',
    label: 'Event date not set',
    detail: 'Add it when your SFRE date is confirmed',
    daysUntilEvent: null,
  });
});

test('resolveHomeEventStatus calculates countdown only from a confirmed future date', () => {
  assert.deepEqual(resolveHomeEventStatus('2026-08-18T00:00:00.000Z', new Date('2026-08-08T00:00:00.000Z')), {
    state: 'countdown',
    label: '10 days to SFRE',
    detail: 'Confirmed event date: Aug 18, 2026',
    daysUntilEvent: 10,
  });
});

test('countCompletedDays reads canonical week/day completion arrays', () => {
  const week = FOUNDATION_WEEKS[4];
  const mondayIds = week.monday.exercises.map(exercise => exercise.id);
  const saturdayIds = week.saturday.exercises.map(exercise => exercise.id);

  assert.deepEqual(countCompletedDays(week, {
    monday: mondayIds,
    saturday: saturdayIds.slice(0, 2),
  }), {
    completed: 1,
    total: 7,
    completedDays: ['monday'],
  });
});
