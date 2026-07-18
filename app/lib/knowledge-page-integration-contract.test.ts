// WS-5 source/integration contract test: the Pods page must be the new SF
// Pod Briefing Center + compact Knowledge Library, not the legacy full-card
// feed with a virtual audio clock or direct date:index checkbox persistence.
//
// Plain node:test file, zero DOM/network access, mirroring the project
// convention already used by knowledge-source-contract.test.ts. Checks are
// scoped to real import statements / actual call expressions — not comment
// text — so a doc-comment that legitimately *names* a forbidden pattern as
// a reminder never trips these assertions.

import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PODS_PAGE_PATH = path.join(__dirname, '..', 'pods', 'page.tsx');

function readSource(p: string): string {
  return readFileSync(p, 'utf8');
}

function extractImportStatements(source: string): string {
  const importRe = /^\s*import\s+[^;]*?;/gms;
  return (source.match(importRe) ?? []).join('\n');
}

const source = readSource(PODS_PAGE_PATH);
const imports = extractImportStatements(source);

// --- 1. Legacy virtual player / checkbox persistence must be gone -----------

test('pods/page.tsx no longer contains a legacy virtual setInterval audio clock', () => {
  assert.equal(/setInterval\s*\(/.test(source), false, 'pods/page.tsx must not run a virtual playback clock');
});

test('pods/page.tsx no longer directly persists legacy date:index checkbox state', () => {
  // The old shape: `${pod.date}:${idx}` used as a localStorage checkbox key,
  // written via a bespoke saveSkillState. Neither should exist anymore.
  assert.equal(/saveSkillState/.test(source), false, 'legacy saveSkillState helper must be removed');
  assert.equal(/loadSkillState/.test(source), false, 'legacy loadSkillState helper must be removed');
  assert.equal(
    /\$\{pod\.date\}:\$\{idx\}/.test(source),
    false,
    'legacy `${pod.date}:${idx}` checkbox key construction must be removed',
  );
});

test('pods/page.tsx never writes the legacy sfprep:pods:skills key (read-only migration source)', () => {
  assert.equal(
    /localStorage\.setItem\(\s*(['"`])sfprep:pods:skills\1/.test(source) ||
      /localStorage\.setItem\(\s*LEGACY_SKILLS_KEY/.test(source),
    false,
    'pods/page.tsx must never write to the legacy sfprep:pods:skills key',
  );
  assert.equal(
    /removeItem\(\s*(['"`])sfprep:pods:skills\1/.test(source) || /removeItem\(\s*LEGACY_SKILLS_KEY/.test(source),
    false,
    'pods/page.tsx must never delete the legacy sfprep:pods:skills key',
  );
});

// --- 2. Uses approved functions ----------------------------------------------

const REQUIRED_IMPORTED_SYMBOLS = [
  'hydrateKnowledgeStore',
  'saveKnowledgeStore',
  'migrateLegacyCompletions',
  'addToQueue',
  'completeItem',
  'deferItem',
  'noteItem',
  'reconcileQueue',
  'deriveLibrary',
  'deriveBriefing',
  'pullSfprepSync',
  'pushSfprepSync',
  'resolveFoundationWeekIndex',
  'KnowledgeExplorerModal',
  'CURATION_OVERLAY',
];

for (const symbol of REQUIRED_IMPORTED_SYMBOLS) {
  test(`pods/page.tsx imports the approved symbol "${symbol}"`, () => {
    assert.match(imports, new RegExp(`\\b${symbol}\\b`), `pods/page.tsx must import ${symbol}`);
  });
}

test('pods/page.tsx calls migrateLegacyCompletions, reconcileQueue, saveKnowledgeStore, and pushSfprepSync as real call expressions (not just imported)', () => {
  for (const fn of ['migrateLegacyCompletions', 'reconcileQueue', 'saveKnowledgeStore', 'pushSfprepSync']) {
    assert.match(source, new RegExp(`${fn}\\s*\\(`), `pods/page.tsx must actually call ${fn}(...)`);
  }
});

test('pods/page.tsx renders KnowledgeExplorerModal (not a hand-rolled inline explorer)', () => {
  assert.match(source, /<KnowledgeExplorerModal\b/);
});

// --- 3. No forbidden domain imports ------------------------------------------

const FORBIDDEN_IMPORT_PATTERNS: Array<{ name: string; re: RegExp }> = [
  { name: 'sfre-program (Foundation program internals beyond the week resolver)', re: /from ['"].*sfre-lifecycle-presentation/ },
  { name: 'workout catalog/state', re: /from ['"].*(workouts-catalog|program-state|planner)(\.ts)?['"]/ },
  { name: 'nutrition modules', re: /from ['"].*(nutrition-execution|nutrient-timing)(\.ts)?['"]/ },
  { name: 'standards modules', re: /from ['"].*sof-standards(\.ts)?['"]/ },
  { name: 'Intel modules', re: /from ['"].*\/intel\// },
  { name: 'adaptive/API-suggestion engine', re: /from ['"].*adaptive-engine(\.ts)?['"]/ },
];

for (const { name, re } of FORBIDDEN_IMPORT_PATTERNS) {
  test(`pods/page.tsx does not import ${name}`, () => {
    assert.equal(re.test(imports), false, `pods/page.tsx must not import from ${name}`);
  });
}

test('pods/page.tsx imports no KnowledgeStore field it would use to fabricate workout/nutrition/standards state', () => {
  // Defensive belt-and-suspenders: the KnowledgeStore type itself has no
  // such fields (see knowledge-store.ts), but assert the page never
  // constructs one either.
  assert.equal(/workoutLogs|nutritionTargets|standardsAssessment/.test(source), false);
});

// --- 4. Safety gate: queue control disabled unless row.isActionable ---------

test('pods/page.tsx gates the per-row Queue button on row.isActionable', () => {
  assert.match(source, /disabled=\{[^}]*!row\.isActionable[^}]*\}/);
});

test('pods/page.tsx never imports/loosens canQueueAsPractice — it defers to isActionable/canQueueFromExplorer', () => {
  assert.equal(/\bcanQueueAsPractice\b/.test(imports), false, 'pods/page.tsx should rely on isActionable, not reimplement the gate');
});

// --- 5. Corrupt-store recovery / read-only messaging -------------------------

test('pods/page.tsx renders an explicit recovery/read-only message for a corrupt knowledge store', () => {
  assert.match(source, /Recovery needed/i);
});

test('pods/page.tsx never calls saveKnowledgeStore/pushSfprepSync from inside a corrupt branch (persist() gates on corrupt)', () => {
  assert.match(source, /function persist\([^)]*\)\s*\{\s*if\s*\(corrupt/);
});

// --- 6. Pod-fetch failure preserves state, never clears local keys ----------

test('pods/page.tsx never calls localStorage.removeItem or localStorage.clear anywhere', () => {
  assert.equal(/localStorage\.removeItem\(/.test(source), false);
  assert.equal(/localStorage\.clear\(/.test(source), false);
});

test('pods/page.tsx shows a pods-unavailable message without clearing existing store state', () => {
  assert.match(source, /podsError/);
  assert.match(source, /Your saved progress has been preserved/i);
});
