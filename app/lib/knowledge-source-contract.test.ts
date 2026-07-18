// WS-7 source-contract test: Calendar must stay read-only with respect to
// the Knowledge substrate (Architecture Amendment 3).
//
// This is a plain node:test file with zero DOM/network access, mirroring
// the other *.test.ts files in this directory. It performs two kinds of
// checks:
//   1. A static source-text contract check on app/calendar/page.tsx: it
//      must not import any KnowledgeStore mutation helper
//      (addToQueue/completeItem/deferItem/noteItem/reconcileQueue) from
//      knowledge-engine.ts/knowledge-store.ts, and it must not call
//      pushSfprepSync anywhere in the file body (only pull is allowed).
//   2. A data-level check that the KnowledgeFocusCard component module
//      itself has zero import of any mutation helper or pushSfprepSync,
//      and that deriveKnowledgeFocusSnapshot (the pure function feeding
//      the card) produces the exact snapshot shapes the card is built to
//      render, for both the "available" and "unavailable" branches.

import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { defaultKnowledgeStore, type KnowledgeStore } from './knowledge-store.ts';
import { contentId, skillId } from './knowledge-engine.ts';
import { deriveKnowledgeFocusSnapshot, type ViewPodLike } from './knowledge-views.ts';
import { CURATION_OVERLAY } from './knowledge-curation.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CALENDAR_PAGE_PATH = path.join(__dirname, '..', 'calendar', 'page.tsx');
const KNOWLEDGE_FOCUS_CARD_PATH = path.join(__dirname, '..', 'components', 'KnowledgeFocusCard.tsx');

const MUTATION_HELPER_NAMES = ['addToQueue', 'completeItem', 'deferItem', 'noteItem', 'reconcileQueue'];

function readSource(p: string): string {
  return readFileSync(p, 'utf8');
}

/**
 * Extracts the text of every `import { ... } from '...'` statement in a
 * source file (the actual binding surface), ignoring comments/prose
 * elsewhere in the file. This lets the contract check assert on what is
 * actually imported/bound rather than tripping over documentation text
 * that legitimately *names* the forbidden helpers as a reminder of what
 * NOT to import.
 */
function extractImportStatements(source: string): string {
  const importRe = /^\s*import\s+[^;]*?;/gms;
  return (source.match(importRe) ?? []).join('\n');
}

// --- 1. Calendar page source-text contract -----------------------------------

test('calendar/page.tsx imports no KnowledgeStore mutation helper', () => {
  const imports = extractImportStatements(readSource(CALENDAR_PAGE_PATH));
  for (const helper of MUTATION_HELPER_NAMES) {
    assert.equal(
      imports.includes(helper),
      false,
      `calendar/page.tsx must not import the mutation helper "${helper}"`,
    );
  }
});

test('calendar/page.tsx never calls pushSfprepSync', () => {
  const source = readSource(CALENDAR_PAGE_PATH);
  // pushSfprepSync may appear in an import list (kept for other, pre-existing
  // callers in this file's history) but must never be invoked as a call
  // expression, i.e. followed by "(".
  assert.equal(
    /pushSfprepSync\s*\(/.test(source),
    false,
    'calendar/page.tsx must never call pushSfprepSync(...)',
  );
});

test('calendar/page.tsx imports deriveKnowledgeFocusSnapshot and normalizeKnowledgeStore (read-only path)', () => {
  const source = readSource(CALENDAR_PAGE_PATH);
  assert.match(source, /deriveKnowledgeFocusSnapshot/);
  assert.match(source, /normalizeKnowledgeStore/);
});

test('calendar/page.tsx renders KnowledgeFocusCard', () => {
  const source = readSource(CALENDAR_PAGE_PATH);
  assert.match(source, /<KnowledgeFocusCard\b/);
});

// --- 2. KnowledgeFocusCard component source-text contract --------------------

test('KnowledgeFocusCard.tsx imports no KnowledgeStore mutation helper and never calls pushSfprepSync', () => {
  const source = readSource(KNOWLEDGE_FOCUS_CARD_PATH);
  const imports = extractImportStatements(source);
  for (const helper of MUTATION_HELPER_NAMES) {
    assert.equal(
      imports.includes(helper),
      false,
      `KnowledgeFocusCard.tsx must not import the mutation helper "${helper}"`,
    );
  }
  assert.equal(
    /pushSfprepSync/.test(source),
    false,
    'KnowledgeFocusCard.tsx must not reference pushSfprepSync at all',
  );
});

test('KnowledgeFocusCard.tsx never renders a raw canonical ID as a label (no `item.id` interpolated as text)', () => {
  const source = readSource(KNOWLEDGE_FOCUS_CARD_PATH);
  // The only text content rendered per active item must come from
  // `item.label`, never `item.id`, inside the JSX text position.
  assert.match(source, /\{item\.label\}/);
  assert.equal(/>\s*\{item\.id\}\s*</.test(source), false);
});

test('KnowledgeFocusCard.tsx states it does not change the training prescription', () => {
  const source = readSource(KNOWLEDGE_FOCUS_CARD_PATH);
  assert.match(source, /does not change your training prescription/i);
});

test('KnowledgeFocusCard.tsx links to /pods', () => {
  const source = readSource(KNOWLEDGE_FOCUS_CARD_PATH);
  assert.match(source, /href="\/pods"/);
});

// --- 3. Data-input contract: deriveKnowledgeFocusSnapshot shapes -------------
// Exercises the exact pure function the Calendar page calls to build the
// `snapshot` prop the card renders, for both branches.

const CURATED_POD: ViewPodLike = {
  date: '2026-07-10',
  title: 'The Special Forces Groups: Where You Actually End Up',
  skills: [
    {
      title: 'Map the Groups',
      detail:
        "Pin a world map with the 7 Groups and their AORs. When someone asks 'why that Group,' you have a real answer, not a vibe.",
    },
  ],
};

function storeWithQueuedFoundationSafeSkill(): KnowledgeStore {
  const store = defaultKnowledgeStore();
  const id = skillId(
    contentId(CURATED_POD.date, CURATED_POD.title),
    'Map the Groups',
    "Pin a world map with the 7 Groups and their AORs. When someone asks 'why that Group,' you have a real answer, not a vibe.",
  );
  return { ...store, queue: [id], needsReview: [] };
}

test('deriveKnowledgeFocusSnapshot: available branch resolves a real label, never a raw ID, for the card', () => {
  const store = storeWithQueuedFoundationSafeSkill();
  const snapshot = deriveKnowledgeFocusSnapshot(store, [CURATED_POD], CURATION_OVERLAY);
  assert.equal(snapshot.available, true);
  if (snapshot.available) {
    assert.equal(snapshot.activeItems.length, 1);
    assert.equal(snapshot.activeItems[0].label, 'Map the Groups');
    assert.notEqual(snapshot.activeItems[0].label, snapshot.activeItems[0].id);
  }
});

test('deriveKnowledgeFocusSnapshot: unavailable branch (no pods) exposes only safe counts, no raw IDs', () => {
  const store = storeWithQueuedFoundationSafeSkill();
  const snapshot = deriveKnowledgeFocusSnapshot(store, null, CURATION_OVERLAY);
  assert.equal(snapshot.available, false);
  assert.equal(snapshot.activeCount, 1);
  assert.equal(snapshot.reviewCount, 0);
  // The unavailable variant of the discriminated union has no activeItems
  // field at all — assert it structurally rather than just by value.
  assert.equal('activeItems' in snapshot, false);
});

test('deriveKnowledgeFocusSnapshot: reviewCount reflects needsReview regardless of pods availability', () => {
  const store: KnowledgeStore = { ...defaultKnowledgeStore(), needsReview: ['some-id'] };
  const available = deriveKnowledgeFocusSnapshot(store, [CURATED_POD], CURATION_OVERLAY);
  const unavailable = deriveKnowledgeFocusSnapshot(store, null, CURATION_OVERLAY);
  assert.equal(available.reviewCount, 1);
  assert.equal(unavailable.reviewCount, 1);
});
