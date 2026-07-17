import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

test('photo scanner never returns random mock meals when vision is unavailable', () => {
  const route = readFileSync(join(process.cwd(), 'app', 'api', 'photo-scan', 'route.ts'), 'utf8');

  assert.equal(route.includes('Fallback to standard mock catalog'), false);
  assert.equal(route.includes('Math.random()'), false);
  assert.equal(route.includes('status: 503'), true);
});
