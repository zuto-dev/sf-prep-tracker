// Source-level safety guard: accepted research findings remain reviewable in
// Intel, but may not become a second programming layer on the SFRE Foundation
// home screen. The canonical Foundation catalog is the only session authority.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const homePath = join(__dirname, '..', 'page.tsx');
const source = readFileSync(homePath, 'utf8');

test('SFRE Foundation Home does not render research ActiveAdjustments', () => {
  assert.doesNotMatch(source, /function\s+ActiveAdjustments\s*\(/);
  assert.doesNotMatch(source, /<ActiveAdjustments\s*\/>/);
});

test('SFRE Foundation Home does not fetch the legacy patches programming overlay', () => {
  assert.doesNotMatch(source, /fetch\(['"]\/api\/patches['"]/);
});
