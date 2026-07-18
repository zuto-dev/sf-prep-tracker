// Source-contract test for app/pods/page.tsx's audio-first wiring (WS
// audio-first minimal integration). Plain node:test, zero DOM/network.
//
// Asserts:
//   - page.tsx resolves narration via resolveSfPodNarration and renders
//     ReadyToListen only for a resolved pod.
//   - Existing curation/store/migration/Explorer wiring in page.tsx is
//     untouched (still present, still gated the same way).
//   - Library rows show "Listen" only when a narration resolves for that
//     row's episode, otherwise "Read notes".

import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PODS_PAGE_PATH = path.join(__dirname, '..', 'pods', 'page.tsx');

function readSource(): string {
  return readFileSync(PODS_PAGE_PATH, 'utf8');
}

test('pods/page.tsx imports resolveSfPodNarration and ReadyToListen', () => {
  const source = readSource();
  assert.match(source, /import \{ resolveSfPodNarration, type SfPodNarration \} from '\.\.\/lib\/sf-pod-narrations\.ts'/);
  assert.match(source, /import \{ ReadyToListen \} from '\.\/ReadyToListen\.tsx'/);
});

test('pods/page.tsx renders <ReadyToListen> gated on a resolved newestResolvedAudioPod (never unconditionally)', () => {
  const source = readSource();
  assert.match(source, /\{newestResolvedAudioPod && \(/);
  assert.match(source, /<ReadyToListen\b/);
  assert.match(source, /narration=\{newestResolvedAudioPod\.narration\}/);
});

test('pods/page.tsx derives newestResolvedAudioPod by calling resolveSfPodNarration per pod, never fabricating a narration', () => {
  const source = readSource();
  assert.match(source, /const narration = resolveSfPodNarration\(p\);/);
  assert.match(source, /if \(narration\) return \{ pod: p, narration \};/);
});

test('pods/page.tsx library rows label episodes "Listen" only when resolveSfPodNarration resolves for that row', () => {
  const source = readSource();
  assert.match(source, /resolveSfPodNarration\(p\) !== null && podContentId\(p\) === row\.id/);
  assert.match(source, /'Listen'/);
  assert.match(source, /'Read notes'/);
});

test('pods/page.tsx keeps existing Explorer + curation + migration wiring untouched', () => {
  const source = readSource();
  assert.match(source, /<KnowledgeExplorerModal/);
  assert.match(source, /migrateLegacyCompletions/);
  assert.match(source, /reconcileQueue/);
  assert.match(source, /CURATION_OVERLAY/);
  assert.match(source, /deriveLibrary/);
  assert.match(source, /deriveBriefing/);
});

test('pods/page.tsx never writes to pods.json (no write/PUT/POST fetch call against /pods.json)', () => {
  const source = readSource();
  // Only the read-only GET fetch of /pods.json is expected; no method:
  // 'POST'/'PUT'/'PATCH' anywhere near a /pods.json reference.
  assert.match(source, /fetch\('\/pods\.json', \{ cache: 'no-store' \}\)/);
  assert.equal(/method:\s*['"](POST|PUT|PATCH|DELETE)['"]/.test(source), false);
});
