import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

test('root layout does not inject global error overlays or monkey-patch browser APIs', () => {
  const layout = readFileSync(join(process.cwd(), 'app', 'layout.tsx'), 'utf8');

  assert.equal(layout.includes('dangerouslySetInnerHTML'), false);
  assert.equal(layout.includes("Object.defineProperty(window, 'fetch'"), false);
  assert.equal(layout.includes('startup-error-overlay'), false);
});
