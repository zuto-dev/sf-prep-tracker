// Static source-level guard: SfreLifecycle's MTI platform control must be a
// real, functional external link — not the dead/deceptive `href="#"` +
// preventDefault + cursor-not-allowed pattern. This is a source-text check
// (no component render harness exists in this project) so it stays honest
// about what it verifies: the anchor markup itself, not runtime behavior.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const componentPath = join(__dirname, '..', 'components', 'SfreLifecycle.tsx');
const source = readFileSync(componentPath, 'utf8');

test('MTI platform control is a real external link, not a dead/deceptive one', () => {
  assert.match(source, /href="https:\/\/fitness\.mtntactical\.com\/"/);
  assert.match(source, /target="_blank"/);
  assert.match(source, /rel="noreferrer"/);
});

test('MTI platform control no longer uses the dead-link pattern', () => {
  assert.doesNotMatch(source, /href="#"/);
  assert.doesNotMatch(source, /preventDefault/);
  assert.doesNotMatch(source, /cursor-not-allowed/);
});
