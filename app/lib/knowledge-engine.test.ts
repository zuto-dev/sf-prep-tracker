import assert from 'node:assert/strict';
import test from 'node:test';

import {
  normalizeForIdentity,
  slugify,
  contentId,
  skillId,
  podContentId,
  podSkillIds,
  resolveCuration,
  canQueueAsPractice,
  type PodLike,
  type CurationOverlay,
} from './knowledge-engine.ts';

// --- Deterministic identity, including normalization ------------------------

test('contentId is deterministic for the same (date, title)', () => {
  const a = contentId('2026-07-06', 'Foundations of Selection');
  const b = contentId('2026-07-06', 'Foundations of Selection');
  assert.equal(a, b);
  assert.equal(a, 'pod:2026-07-06:foundations-of-selection');
});

test('contentId normalizes incidental whitespace/case differences to the same ID', () => {
  const a = contentId('2026-07-06', 'Foundations of Selection');
  const b = contentId('2026-07-06', '  foundations   OF  selection  ');
  assert.equal(a, b);
});

test('contentId differs when date or title differs', () => {
  const a = contentId('2026-07-06', 'Foundations of Selection');
  const b = contentId('2026-07-13', 'Foundations of Selection');
  const c = contentId('2026-07-06', 'Advanced Selection');
  assert.notEqual(a, b);
  assert.notEqual(a, c);
});

test('skillId is deterministic for the same (owner, title, detail) and normalizes whitespace/case', () => {
  const owner = contentId('2026-07-06', 'Foundations of Selection');
  const a = skillId(owner, 'Ruck Pacing', 'Maintain 15:00/mile under load');
  const b = skillId(owner, '  ruck   PACING ', '  maintain 15:00/mile UNDER load  ');
  assert.equal(a, b);
});

test('skillId differs when detail differs even with the same title (disambiguates same-title skills)', () => {
  const owner = contentId('2026-07-06', 'Foundations of Selection');
  const a = skillId(owner, 'Ruck Pacing', 'Maintain 15:00/mile under load');
  const b = skillId(owner, 'Ruck Pacing', 'Maintain 12:00/mile under load');
  assert.notEqual(a, b);
});

test('skillId does not depend on positional index — only owner+title+detail feed identity', () => {
  const owner = contentId('2026-07-06', 'Foundations of Selection');
  // Simulate the same skill appearing at a different position in a list;
  // identity must be unaffected because no index parameter exists.
  const a = skillId(owner, 'Ruck Pacing', 'Maintain 15:00/mile under load');
  const b = skillId(owner, 'Ruck Pacing', 'Maintain 15:00/mile under load');
  assert.equal(a, b);
});

test('podContentId/podSkillIds derive canonical IDs from a PodLike without importing pods-engine', () => {
  const pod: PodLike = {
    date: '2026-07-06',
    title: 'Foundations of Selection',
    skills: [
      { title: 'Ruck Pacing', detail: 'Maintain 15:00/mile under load' },
      { title: 'Land Navigation', detail: 'Dead reckoning with pace count' },
    ],
  };
  const cid = podContentId(pod);
  assert.equal(cid, 'pod:2026-07-06:foundations-of-selection');
  const sids = podSkillIds(pod);
  assert.equal(sids.length, 2);
  assert.ok(sids.every(id => id.startsWith(`${cid}:skill:`)));
  assert.notEqual(sids[0], sids[1]);
});

test('slugify falls back to "untitled" for a title with no alphanumeric content', () => {
  assert.equal(slugify('   ---   '), 'untitled');
  assert.equal(slugify(''), 'untitled');
});

test('normalizeForIdentity collapses whitespace and lowercases', () => {
  assert.equal(normalizeForIdentity('  Foo   BAR  baz '), 'foo bar baz');
});

// --- Curation fail-safe / hard gate ------------------------------------------

test('resolveCuration defaults to unclassified when no overlay is provided', () => {
  const status = resolveCuration('pod:2026-07-06:foundations-of-selection');
  assert.equal(status, 'unclassified');
});

test('resolveCuration defaults to unclassified when the ID is absent from the overlay', () => {
  const overlay: CurationOverlay = { 'pod:2026-07-06:some-other': 'foundation_safe' };
  const status = resolveCuration('pod:2026-07-06:foundations-of-selection', overlay);
  assert.equal(status, 'unclassified');
});

test('resolveCuration honors an explicit foundation_safe entry', () => {
  const id = 'pod:2026-07-06:foundations-of-selection';
  const overlay: CurationOverlay = { [id]: 'foundation_safe' };
  assert.equal(resolveCuration(id, overlay), 'foundation_safe');
});

test('resolveCuration honors an explicit reference_only entry', () => {
  const id = 'pod:2026-07-06:foundations-of-selection';
  const overlay: CurationOverlay = { [id]: 'reference_only' };
  assert.equal(resolveCuration(id, overlay), 'reference_only');
});

test('resolveCuration falls back to unclassified for an unrecognized overlay value (defensive)', () => {
  const id = 'pod:2026-07-06:foundations-of-selection';
  // Deliberately cast to simulate a corrupted/foreign overlay value getting through.
  const overlay = { [id]: 'made-up-status' } as unknown as CurationOverlay;
  assert.equal(resolveCuration(id, overlay), 'unclassified');
});

test('canQueueAsPractice hard-gates: only foundation_safe returns true', () => {
  assert.equal(canQueueAsPractice('foundation_safe'), true);
  assert.equal(canQueueAsPractice('reference_only'), false);
  assert.equal(canQueueAsPractice('unclassified'), false);
});

test('curation fail-safe end-to-end: unclassified/absent overlay content can never be queued', () => {
  const id = contentId('2026-07-06', 'Unreviewed Episode');
  const status = resolveCuration(id); // no overlay at all
  assert.equal(canQueueAsPractice(status), false);
});
