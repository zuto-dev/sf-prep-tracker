import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

test('global sync boot routes every SF Prep localStorage write through versioned sync', () => {
  const component = readFileSync(join(process.cwd(), 'app', 'components', 'VersionedSyncBoot.tsx'), 'utf8');
  const layout = readFileSync(join(process.cwd(), 'app', 'layout.tsx'), 'utf8');

  assert.ok(component.includes("from '../lib/sfprep-sync'"));
  assert.ok(component.includes('pushSfprepSync'));
  assert.ok(component.includes('pullSfprepSync'));
  assert.ok(component.includes('localStorage.setItem'));
  assert.ok(layout.includes('VersionedSyncBoot'));
});
