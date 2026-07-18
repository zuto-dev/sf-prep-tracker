import assert from 'node:assert/strict';
import test from 'node:test';

import {
  hasPlayableAudioUrl,
  decideExplorerMode,
  canShowAudioPlayer,
  nextStatusAfterPlayAttempt,
  nextStatusAfterAudioError,
  nextStatusAfterPause,
  canQueueFromExplorer,
  type ExplorerMode,
} from './knowledge-explorer-logic.ts';

// --- hasPlayableAudioUrl / decideExplorerMode -------------------------------

test('hasPlayableAudioUrl is false for undefined/null/empty/whitespace-only audio', () => {
  assert.equal(hasPlayableAudioUrl(undefined), false);
  assert.equal(hasPlayableAudioUrl(null), false);
  assert.equal(hasPlayableAudioUrl(''), false);
  assert.equal(hasPlayableAudioUrl('   '), false);
  assert.equal(hasPlayableAudioUrl('\n\t '), false);
});

test('hasPlayableAudioUrl is true for a real nonempty audio URL string', () => {
  assert.equal(hasPlayableAudioUrl('https://example.com/ep1.mp3'), true);
  assert.equal(hasPlayableAudioUrl('/local/ep1.mp3'), true);
});

test('decideExplorerMode is "read" whenever there is no playable audio URL', () => {
  const modes: ExplorerMode[] = [
    decideExplorerMode(undefined),
    decideExplorerMode(null),
    decideExplorerMode(''),
    decideExplorerMode('   '),
  ];
  for (const m of modes) assert.equal(m, 'read');
});

test('decideExplorerMode is "listen" only for a real nonempty audio URL', () => {
  assert.equal(decideExplorerMode('https://example.com/ep1.mp3'), 'listen');
});

test('canShowAudioPlayer only permits rendering an audio player in listen mode', () => {
  assert.equal(canShowAudioPlayer('listen'), true);
  assert.equal(canShowAudioPlayer('read'), false);
});

// --- Playback status transitions: no virtual clock / simulated progression -

test('nextStatusAfterPlayAttempt resolves to "playing" only when play() actually resolved', () => {
  assert.equal(nextStatusAfterPlayAttempt(true), 'playing');
});

test('nextStatusAfterPlayAttempt resolves to visible "unavailable" when play() rejected — never a silent no-op or fake playing state', () => {
  assert.equal(nextStatusAfterPlayAttempt(false), 'unavailable');
});

test('nextStatusAfterAudioError always resolves to "unavailable"', () => {
  assert.equal(nextStatusAfterAudioError(), 'unavailable');
});

test('nextStatusAfterPause always resolves to "paused"', () => {
  assert.equal(nextStatusAfterPause(), 'paused');
});

// --- Safety gate: only foundation_safe may ever trigger a queue callback ---

test('canQueueFromExplorer permits queueing only for foundation_safe status', () => {
  assert.equal(canQueueFromExplorer('foundation_safe'), true);
  assert.equal(canQueueFromExplorer('reference_only'), false);
  assert.equal(canQueueFromExplorer('unclassified'), false);
});
