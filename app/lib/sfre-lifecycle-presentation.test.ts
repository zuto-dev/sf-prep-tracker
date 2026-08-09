import assert from 'node:assert/strict';
import test from 'node:test';

import {
  resolveSfreLifecyclePresentation,
} from './sfre-lifecycle-presentation.ts';

const FOUNDATION_START = new Date('2026-07-06T00:00:00Z');
const DAY_MS = 86_400_000;

test('no confirmed date during foundation: date_required, bridge locked, mtiPeak locked', () => {
  const p = resolveSfreLifecyclePresentation({
    date: FOUNDATION_START,
    foundationStart: FOUNDATION_START,
    confirmedSfreDate: null,
  });
  assert.equal(p.state, 'foundation');
  assert.equal(p.dateState, 'date_required');
  assert.equal(p.stages.foundation.status, 'active');
  assert.equal(p.stages.bridge.status, 'locked');
  assert.equal(p.stages.mtiPeak.status, 'locked');
  assert.equal(p.daysUntilEvent, null);
  assert.equal(p.daysUntilPeakWindow, null);
});

test('no confirmed date after foundation window: bridge active, mtiPeak still locked (date required)', () => {
  const afterFoundation = new Date(FOUNDATION_START.getTime() + 91 * DAY_MS);
  const p = resolveSfreLifecyclePresentation({
    date: afterFoundation,
    foundationStart: FOUNDATION_START,
    confirmedSfreDate: null,
  });
  assert.equal(p.state, 'bridge');
  assert.equal(p.dateState, 'date_required');
  assert.equal(p.stages.foundation.status, 'complete');
  assert.equal(p.stages.bridge.status, 'active');
  assert.equal(p.stages.mtiPeak.status, 'locked');
});

test('confirmed date set, currently in bridge, more than 49 days out: countdown, mtiPeak upcoming', () => {
  const eventDate = new Date(FOUNDATION_START.getTime() + 200 * DAY_MS);
  const now = new Date(FOUNDATION_START.getTime() + 100 * DAY_MS);
  const p = resolveSfreLifecyclePresentation({
    date: now,
    foundationStart: FOUNDATION_START,
    confirmedSfreDate: eventDate.toISOString(),
  });
  assert.equal(p.state, 'bridge');
  assert.equal(p.dateState, 'countdown');
  assert.equal(p.stages.bridge.status, 'active');
  assert.equal(p.stages.mtiPeak.status, 'upcoming');
  assert.equal(p.daysUntilEvent, 100);
  assert.equal(p.daysUntilPeakWindow, 100 - 49);
});

test('confirmed date, inside the 49-day mti_peak window: active, mtiPeak active, bridge complete', () => {
  const eventDate = new Date(FOUNDATION_START.getTime() + 200 * DAY_MS);
  const now = new Date(eventDate.getTime() - 10 * DAY_MS);
  const p = resolveSfreLifecyclePresentation({
    date: now,
    foundationStart: FOUNDATION_START,
    confirmedSfreDate: eventDate.toISOString(),
  });
  assert.equal(p.state, 'mti_peak');
  assert.equal(p.dateState, 'active');
  assert.equal(p.stages.bridge.status, 'complete');
  assert.equal(p.stages.mtiPeak.status, 'active');
  assert.equal(p.daysUntilEvent, 10);
  assert.equal(p.daysUntilPeakWindow, null);
});

test('confirmed date has passed: post_event, all stages complete', () => {
  const eventDate = new Date(FOUNDATION_START.getTime() + 200 * DAY_MS);
  const now = new Date(eventDate.getTime() + 5 * DAY_MS);
  const p = resolveSfreLifecyclePresentation({
    date: now,
    foundationStart: FOUNDATION_START,
    confirmedSfreDate: eventDate.toISOString(),
  });
  assert.equal(p.state, 'post_event');
  assert.equal(p.dateState, 'post_event');
  assert.equal(p.stages.foundation.status, 'complete');
  assert.equal(p.stages.bridge.status, 'complete');
  assert.equal(p.stages.mtiPeak.status, 'complete');
  assert.equal(p.daysUntilEvent, -5);
  assert.equal(p.daysUntilPeakWindow, null);
});

test('malformed confirmedSfreDate string is treated as no date (fail-safe, never throws)', () => {
  const p = resolveSfreLifecyclePresentation({
    date: FOUNDATION_START,
    foundationStart: FOUNDATION_START,
    confirmedSfreDate: 'not-a-date',
  });
  assert.equal(p.dateState, 'date_required');
  assert.equal(p.daysUntilEvent, null);
});
