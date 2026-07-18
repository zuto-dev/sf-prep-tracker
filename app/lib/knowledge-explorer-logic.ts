// Pure decision logic for the honest, reusable Knowledge Explorer (WS6).
//
// Hard constraints (do not relax without a spec change):
//   - NO React/DOM/network/storage imports. This module must be importable
//     and fully exercised under plain `node:test` with zero DOM globals,
//     matching knowledge-engine.ts's / knowledge-views.ts's contract.
//   - Owns the ONLY branching rule for "is there real playable audio for
//     this pod": a non-empty, non-whitespace-only `audio` string. Anything
//     else (undefined, null, '', '   ') means Read + Explore mode — no
//     player, no virtual clock, no simulated progression. This function is
//     the single chokepoint the KnowledgeExplorerModal component must call
//     before rendering a play button or an <audio> element; it is never
//     "loosened" to synthesize a fake mode.
//   - Playback status transitions are pure functions of an outcome
//     (audio.play() resolved/rejected, or the <audio> element's onError
//     firing) so the component never has to invent a virtual clock or a
//     progress simulation to represent "still working" — a failed/absent
//     real audio source always resolves to the same visible 'unavailable'
//     state, never silently staying 'idle' or fabricating a duration.
//   - The practice-queue gate is re-exported (not reimplemented) directly
//     from knowledge-engine.ts's `canQueueAsPractice`, so the Explorer can
//     never drift from the single hard safety chokepoint that decides what
//     may be queued as practice.

import { canQueueAsPractice, type CurationStatus } from './knowledge-engine.ts';

export type ExplorerMode = 'read' | 'listen';

/**
 * True only for a non-empty, non-whitespace-only audio URL string. This is
 * the ONE test that decides whether real `<audio>` playback is available
 * for a pod — never "assume audio exists because other pods have it" and
 * never treat an empty/whitespace string as playable.
 */
export function hasPlayableAudioUrl(audio: string | null | undefined): boolean {
  return typeof audio === 'string' && audio.trim().length > 0;
}

/**
 * Decides the Explorer's mode for a given pod's audio field. 'listen' only
 * when `hasPlayableAudioUrl` is true; every other case (including
 * undefined/null/empty/whitespace) is 'read'. This is the single gate a
 * component must consult before rendering a play button or `<audio>`
 * element — it must never independently re-derive "has audio".
 */
export function decideExplorerMode(audio: string | null | undefined): ExplorerMode {
  return hasPlayableAudioUrl(audio) ? 'listen' : 'read';
}

/** A play button (and any `<audio>` element) may only ever render in 'listen' mode. */
export function canShowAudioPlayer(mode: ExplorerMode): boolean {
  return mode === 'listen';
}

export type AudioPlaybackStatus = 'idle' | 'playing' | 'paused' | 'unavailable';

/**
 * Resolves the next playback status after an attempted `audio.play()` call.
 * A rejected play promise (autoplay-blocked, decode failure, network error,
 * etc.) always resolves to the same visible 'unavailable' state — never a
 * silent no-op and never a fabricated 'playing' state.
 */
export function nextStatusAfterPlayAttempt(playResolved: boolean): AudioPlaybackStatus {
  return playResolved ? 'playing' : 'unavailable';
}

/** The `<audio>` element's `onError` event always resolves to 'unavailable'. */
export function nextStatusAfterAudioError(): AudioPlaybackStatus {
  return 'unavailable';
}

/** A user-initiated pause always resolves to 'paused'. */
export function nextStatusAfterPause(): AudioPlaybackStatus {
  return 'paused';
}

/**
 * Re-exported practice-queue safety gate: only an explicit 'foundation_safe'
 * curation status may trigger a queue callback. The Explorer must call this
 * function (not reimplement the check) before invoking any `onQueue`
 * callback, so it can never drift from knowledge-engine's single hard
 * safety chokepoint.
 */
export function canQueueFromExplorer(status: CurationStatus): boolean {
  return canQueueAsPractice(status);
}
