import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const navSource = readFileSync(new URL('../components/Nav.tsx', import.meta.url), 'utf8');
const cssSource = readFileSync(new URL('../globals.css', import.meta.url), 'utf8');

test('shared navigation exposes four primary jobs and hides specialist tools under More', () => {
  for (const label of ['Train', 'Standards', 'Progress', 'Fuel']) {
    assert.match(navSource, new RegExp(`label: '${label}'`));
  }
  assert.match(navSource, /More/);
  assert.doesNotMatch(navSource, /label: 'Workouts'/);
  assert.doesNotMatch(navSource, /flex-wrap/);
});

test('global tactical reset removes legacy gradients, oversized rounding, and decorative shadows', () => {
  assert.match(cssSource, /\[class\*="bg-gradient"\]/);
  assert.match(cssSource, /\[class\*="shadow-"\]/);
  assert.match(cssSource, /\.rounded-2xl/);
  assert.match(cssSource, /background-image:\s*none\s*!important/);
});
