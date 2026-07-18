import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { FOUNDATION_TARGETS } from './nutrition-execution.ts';

// Regression guard for the stale Foundation preset label bug: the nutrition
// page's preset button must render the Foundation kcal/protein values by
// reading FOUNDATION_TARGETS at render time, not a hardcoded literal that can
// drift out of sync with the actual target source of truth.
const source = readFileSync(join(import.meta.dirname, '..', 'nutrition', 'page.tsx'), 'utf8');

test('nutrition page does not contain the stale hardcoded Foundation label', () => {
  assert.equal(source.includes('Foundation · 2400 kcal / 180P'), false);
});

test('nutrition page derives the Foundation preset label from FOUNDATION_TARGETS', () => {
  assert.match(source, /FOUNDATION_TARGETS\.kcal/);
  assert.match(source, /FOUNDATION_TARGETS\.p/);
});

test('FOUNDATION_TARGETS still matches the evidence-backed values', () => {
  assert.equal(FOUNDATION_TARGETS.kcal, 2450);
  assert.equal(FOUNDATION_TARGETS.p, 150);
});
