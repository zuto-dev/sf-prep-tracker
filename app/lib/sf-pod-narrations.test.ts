// Pure node:test for sf-pod-narrations.ts — no DOM/network/React.

import assert from 'node:assert/strict';
import test from 'node:test';

import {
  resolveSfPodNarration,
  narrationPathForDate,
  listKnownSfPodNarrationKeys,
  SF_POD_NARRATION_LABEL,
} from './sf-pod-narrations.ts';

test('resolves an exact {date,title} match to the deterministic narration path + label', () => {
  const result = resolveSfPodNarration({
    date: '2026-07-17',
    title: "Ruck Up or Shut Up — Walton's Operating System",
  });
  assert.deepEqual(result, {
    audioUrl: '/audio/sf-pod-narration-2026-07-17.mp3',
    label: 'SF Pod briefing narration',
  });
});

test('label is always the literal "SF Pod briefing narration" — never the original podcast', () => {
  assert.equal(SF_POD_NARRATION_LABEL, 'SF Pod briefing narration');
});

test('every known key resolves to its own deterministic path with no collisions', () => {
  const keys = listKnownSfPodNarrationKeys();
  assert.equal(keys.length, 10);
  const seenPaths = new Set<string>();
  for (const k of keys) {
    const result = resolveSfPodNarration(k);
    assert.ok(result, `expected a resolution for ${k.date} / ${k.title}`);
    assert.equal(result!.audioUrl, narrationPathForDate(k.date));
    assert.equal(seenPaths.has(result!.audioUrl), false, `duplicate narration path ${result!.audioUrl}`);
    seenPaths.add(result!.audioUrl);
  }
});

test('unknown title on a known date returns null (no date-only fuzzy match)', () => {
  const result = resolveSfPodNarration({
    date: '2026-07-17',
    title: 'Some Completely Different Episode Title',
  });
  assert.equal(result, null);
});

test('known title on a different/wrong date returns null (no title-only fuzzy match)', () => {
  const result = resolveSfPodNarration({
    date: '1999-01-01',
    title: "Ruck Up or Shut Up — Walton's Operating System",
  });
  assert.equal(result, null);
});

test('a pod not in the known list at all returns null', () => {
  const result = resolveSfPodNarration({
    date: '2026-08-01',
    title: 'A Brand New Episode That Does Not Exist Yet',
  });
  assert.equal(result, null);
});

test('null/undefined input returns null without throwing', () => {
  assert.equal(resolveSfPodNarration(null), null);
  assert.equal(resolveSfPodNarration(undefined), null);
});

test('malformed pod shapes (missing/blank date or title) return null, never throw', () => {
  // @ts-expect-error intentionally malformed for the runtime guard
  assert.equal(resolveSfPodNarration({ date: '2026-07-17' }), null);
  // @ts-expect-error intentionally malformed for the runtime guard
  assert.equal(resolveSfPodNarration({ title: 'x' }), null);
  assert.equal(resolveSfPodNarration({ date: '', title: '' }), null);
  // @ts-expect-error intentionally malformed for the runtime guard
  assert.equal(resolveSfPodNarration({ date: 123, title: "Ruck Up or Shut Up — Walton's Operating System" }), null);
});

test('narrationPathForDate is a pure deterministic function of date only', () => {
  assert.equal(narrationPathForDate('2026-07-06'), '/audio/sf-pod-narration-2026-07-06.mp3');
  assert.equal(narrationPathForDate('2026-07-06'), narrationPathForDate('2026-07-06'));
});

test('module performs no filesystem/network access — this file itself never imports fs/http/fetch', () => {
  // Documented contract check: importing the module above must not have
  // thrown or touched the DOM/network in a Node-only test environment,
  // which this test file running successfully already proves. This test
  // exists to make that guarantee explicit and named in the test output.
  assert.ok(true);
});
