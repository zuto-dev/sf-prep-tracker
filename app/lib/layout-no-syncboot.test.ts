// Static source-level guard: RootLayout must not mount the legacy global
// SyncBoot component. SyncBoot drives legacy sync.ts / /api/sync
// polling+write interception, which races/stomps state against the
// approved versioned sfprep-sync engine used by the SFRE feature. This is
// a source-text check (no component render harness exists in this
// project) so it stays honest about what it verifies: the layout markup
// itself, not runtime behavior.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const layoutPath = join(__dirname, '..', 'layout.tsx');
const source = readFileSync(layoutPath, 'utf8');

test('RootLayout does not import SyncBoot', () => {
  assert.doesNotMatch(source, /import\s*\{\s*SyncBoot\s*\}\s*from\s*["']\.\/components\/SyncBoot["']/);
});

test('RootLayout does not mount <SyncBoot />', () => {
  assert.doesNotMatch(source, /<SyncBoot\s*\/>/);
});
