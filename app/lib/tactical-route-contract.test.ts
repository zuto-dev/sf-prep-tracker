import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const ROUTES = ['mobility', 'progress', 'calendar', 'nutrition', 'study', 'intel', 'pods', 'board-sim'];

test('every product route uses the shared tactical page header', () => {
  for (const route of ROUTES) {
    const source = readFileSync(new URL(`../${route}/page.tsx`, import.meta.url), 'utf8');
    assert.match(source, /TacticalPageHeader/, `${route} must use TacticalPageHeader`);
  }
});

test('the tactical page header owns shared SF PREP branding and navigation', () => {
  const source = readFileSync(new URL('../components/TacticalPageHeader.tsx', import.meta.url), 'utf8');
  assert.match(source, /SF/);
  assert.match(source, /PREP/);
  assert.match(source, /<Nav \/>/);
});
