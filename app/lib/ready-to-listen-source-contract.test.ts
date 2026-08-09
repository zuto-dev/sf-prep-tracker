// Source-contract test for app/pods/ReadyToListen.tsx (audio-first UI).
//
// Plain node:test file with zero DOM/network access, mirroring the other
// *.test.ts files in this directory. Static source-text checks only —
// this component is JSX/React and cannot be executed under plain
// node:test without a DOM, so its contract is enforced the same way
// knowledge-source-contract.test.ts enforces calendar/page.tsx's contract:
// asserting on the file's actual import/binding surface and literal text.

import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const READY_TO_LISTEN_PATH = path.join(__dirname, '..', 'pods', 'ReadyToListen.tsx');

const FORBIDDEN_IMPORT_SOURCES = [
  'knowledge-store',
  'knowledge-engine',
  'sfprep-sync',
  'knowledge-curation',
  'knowledge-views',
];

function readSource(): string {
  return readFileSync(READY_TO_LISTEN_PATH, 'utf8');
}

function extractImportStatements(source: string): string {
  const importRe = /^\s*import\s+[^;]*?;/gms;
  return (source.match(importRe) ?? []).join('\n');
}

test('ReadyToListen.tsx imports no store/sync/prescription module', () => {
  const imports = extractImportStatements(readSource());
  for (const forbidden of FORBIDDEN_IMPORT_SOURCES) {
    assert.equal(
      imports.includes(forbidden),
      false,
      `ReadyToListen.tsx must not import from a module containing "${forbidden}"`,
    );
  }
});

test('ReadyToListen.tsx imports resolveSfPodNarration\'s type only, never calls the resolver itself', () => {
  const source = readSource();
  const imports = extractImportStatements(source);
  // Type-only usage: imports the SfPodNarration type, but does not import
  // resolveSfPodNarration (resolution is the parent page's job) and never
  // calls it as a function anywhere in the file body.
  assert.match(imports, /import type \{ SfPodNarration \}/);
  assert.equal(imports.includes('resolveSfPodNarration'), false);
  assert.equal(/resolveSfPodNarration\s*\(/.test(source), false);
});

test('ReadyToListen.tsx renders a real native <audio> element with controls, not a custom/virtual player', () => {
  const source = readSource();
  assert.match(source, /<audio\b/);
  assert.match(source, /controls/);
  // No virtual/simulated progress state.
  assert.equal(/setInterval|requestAnimationFrame/.test(source), false);
});

test('ReadyToListen.tsx binds the <audio> src to narration.audioUrl', () => {
  const source = readSource();
  assert.match(source, /src=\{narration\.audioUrl\}/);
});

test('ReadyToListen.tsx always visibly renders the narration label text', () => {
  const source = readSource();
  assert.match(source, /\{narration\.label\}/);
});

test('ReadyToListen.tsx wires a local onError handler on the <audio> element that flips a visible unavailable state', () => {
  const source = readSource();
  assert.match(source, /onError=\{handleError\}/);
  assert.match(source, /setUnavailable\(true\)/);
  assert.match(source, /ready-to-listen-unavailable/);
  assert.match(source, /Narration audio is unavailable/i);
});

test('ReadyToListen.tsx exposes an onOpenNotes callback prop and calls it from a button, never auto-invoking it', () => {
  const source = readSource();
  assert.match(source, /onOpenNotes:\s*\(\)\s*=>\s*void/);
  assert.match(source, /onClick=\{onOpenNotes\}/);
});

test('ReadyToListen.tsx renders nothing (returns null) when narration is absent', () => {
  const source = readSource();
  assert.match(source, /if \(!narration\) return null;/);
});

test('ReadyToListen.tsx never imports React Router/network/fetch — pure presentational props in', () => {
  const source = readSource();
  assert.equal(/\bfetch\(/.test(source), false);
  assert.equal(/localStorage/.test(source), false);
});
