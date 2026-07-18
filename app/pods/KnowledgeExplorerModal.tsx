'use client';

// Honest, reusable Knowledge Explorer modal (WS6).
//
// Contract (do not relax without a spec change):
//   - Consumes Pod-shaped data + curation status + KnowledgeStore-derived
//     flags passed in by the parent; it never owns persistence and never
//     imports knowledge-store/sfprep-sync/network directly.
//   - Mode is decided by `decideExplorerMode` (knowledge-explorer-logic.ts)
//     from the pod's real `audio` field ONLY:
//       * 'read'   -> "Read + Explore": summary/takeaways/skills/homework/
//                     bookmarks/search. No play button, no virtual clock,
//                     no timer, no simulated progression.
//       * 'listen' -> "Listen + Explore": a real `<audio>` element bound to
//                     the real audio URL. `onError` / a rejected play()
//                     promise always moves to a visible 'unavailable'
//                     state — it never silently no-ops and never keeps a
//                     fake clock running.
//   - Bookmarks/search come from pods-engine's `buildBookmarks` /
//     `searchPodContent` over the pod's real fields (summary/takeaways/
//     skills/homework) — labeled as structured-content bookmarks, never
//     presented as transcript timestamps.
//   - The queue affordance only ever calls `onQueue` when the given
//     curation status passes `canQueueFromExplorer` (which delegates to
//     knowledge-engine's single `canQueueAsPractice` chokepoint). This
//     component never calls a store/sync/workout mutation directly — all
//     of queue/complete/defer/note/close are parent-owned callbacks.

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  buildBookmarks,
  searchPodContent,
  formatClock,
  DEFAULT_DURATION_SECONDS,
  type Pod,
  type AudioTimestampBookmark,
} from '../lib/pods-engine.ts';
import {
  decideExplorerMode,
  canShowAudioPlayer,
  nextStatusAfterPlayAttempt,
  nextStatusAfterAudioError,
  nextStatusAfterPause,
  canQueueFromExplorer,
  type AudioPlaybackStatus,
} from '../lib/knowledge-explorer-logic.ts';
import type { CurationStatus } from '../lib/knowledge-engine.ts';

export type KnowledgeExplorerPod = Pod;

export type KnowledgeExplorerProps = {
  /** The pod being explored. Null/undefined means the modal is closed (parent controls visibility). */
  pod: KnowledgeExplorerPod | null | undefined;
  /** Canonical content ID for this pod (parent derives via podContentId — this component never derives IDs). */
  contentId: string;
  /** Curation status for this pod's content-level ID. Gates the queue affordance. */
  curationStatus: CurationStatus;
  /** Display-facing safety/reference label shown alongside the source. */
  safetyLabel: string;
  /** Whether this content is already queued (parent-owned store state). */
  isQueued?: boolean;
  /** Whether this content is already completed (parent-owned store state). */
  isCompleted?: boolean;
  /** Whether this content is already deferred (parent-owned store state). */
  isDeferred?: boolean;
  /** Existing freeform note text for this content, if any (parent-owned store state). */
  noteText?: string;
  /** Called when the user explicitly requests queueing. Only invoked when curationStatus is foundation_safe. */
  onQueue?: (contentId: string) => void;
  /** Called when the user marks this content complete. */
  onComplete?: (contentId: string) => void;
  /** Called when the user defers this content for later review. */
  onDefer?: (contentId: string) => void;
  /** Called when the user updates the freeform note. */
  onNote?: (contentId: string, text: string) => void;
  /** Called when the modal should close. */
  onClose: () => void;
};

/**
 * Honest reusable explorer for a single pod. Renders "Read + Explore" for
 * any pod without a real playable audio URL, and "Listen + Explore" (real
 * `<audio>` element) only when one exists. Owns zero persistence — every
 * mutation-shaped action is a parent callback.
 */
export function KnowledgeExplorerModal({
  pod,
  contentId,
  curationStatus,
  safetyLabel,
  isQueued = false,
  isCompleted = false,
  isDeferred = false,
  noteText = '',
  onQueue,
  onComplete,
  onDefer,
  onNote,
  onClose,
}: KnowledgeExplorerProps) {
  const [query, setQuery] = useState('');
  const [playbackStatus, setPlaybackStatus] = useState<AudioPlaybackStatus>('idle');
  const [currentTime, setCurrentTime] = useState(0);
  const [draftNote, setDraftNote] = useState(noteText);
  const audioRef = useRef<HTMLAudioElement>(null);

  // Reset all per-open, per-pod transient UI state whenever a different
  // pod is opened (or the modal closes) — never carries stale playback
  // state or a stale query across pods.
  useEffect(() => {
    setQuery('');
    setPlaybackStatus('idle');
    setCurrentTime(0);
    setDraftNote(noteText);
  }, [pod, noteText]);

  const mode = useMemo(() => decideExplorerMode(pod?.audio), [pod]);
  const showPlayer = canShowAudioPlayer(mode);

  const bookmarks: AudioTimestampBookmark[] = useMemo(
    () => (pod ? buildBookmarks(pod) : []),
    [pod],
  );

  const searchHits = useMemo(
    () => (pod && query.trim() ? searchPodContent(pod, query, bookmarks) : []),
    [pod, query, bookmarks],
  );

  if (!pod) return null;

  const seekTo = (seconds: number) => {
    setCurrentTime(seconds);
    if (showPlayer && audioRef.current) {
      audioRef.current.currentTime = seconds;
    }
  };

  const togglePlay = () => {
    if (!showPlayer || !audioRef.current) return;
    if (playbackStatus === 'playing') {
      audioRef.current.pause();
      setPlaybackStatus(nextStatusAfterPause());
      return;
    }
    audioRef.current
      .play()
      .then(() => setPlaybackStatus(nextStatusAfterPlayAttempt(true)))
      .catch(() => setPlaybackStatus(nextStatusAfterPlayAttempt(false)));
  };

  const handleAudioError = () => {
    setPlaybackStatus(nextStatusAfterAudioError());
  };

  const handleQueueClick = () => {
    if (!onQueue) return;
    if (!canQueueFromExplorer(curationStatus)) return;
    onQueue(contentId);
  };

  const handleNoteBlur = () => {
    if (onNote && draftNote !== noteText) onNote(contentId, draftNote);
  };

  const duration = DEFAULT_DURATION_SECONDS;
  const canQueue = canQueueFromExplorer(curationStatus);

  return (
    <div
      data-testid="knowledge-explorer-modal"
      className="fixed inset-0 z-40 flex items-start justify-center p-4 pt-16 bg-black/70 backdrop-blur-md overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="max-w-4xl w-full bg-gray-900/80 backdrop-blur-xl border border-gray-700/50 rounded-3xl shadow-2xl overflow-hidden mb-40"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 p-6 border-b border-gray-800/60">
          <div>
            <div className="text-xs font-bold text-blue-400 uppercase tracking-wider">
              Ep {pod.episode} · {pod.date}
            </div>
            <h2 className="text-xl font-black text-white mt-1">{pod.title}</h2>
            <div className="flex items-center gap-2 mt-2">
              <span
                data-testid="explorer-mode-label"
                className="text-[10px] uppercase font-bold tracking-wider text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded-full"
              >
                {mode === 'listen' ? 'Listen + Explore' : 'Read + Explore'}
              </span>
              <span
                data-testid="safety-label"
                className="text-[10px] uppercase font-bold tracking-wider text-amber-300 bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 rounded-full"
              >
                {safetyLabel}
              </span>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl leading-none" aria-label="Close">
            ×
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="bg-gray-950/40 p-4 rounded-xl border border-gray-850 text-sm text-gray-300 leading-relaxed">
            {pod.summary}
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <h3 className="text-sm font-bold text-white mb-2">Key Takeaways</h3>
              <ul className="space-y-2">
                {pod.takeaways.map((t, idx) => (
                  <li key={idx} className="text-sm text-gray-300 flex gap-2 leading-relaxed">
                    <span className="text-blue-500 font-bold flex-shrink-0">▸</span>
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="text-sm font-bold text-white mb-2">Skills</h3>
              <ul className="space-y-2">
                {pod.skills.map((s, idx) => (
                  <li key={idx} className="text-sm text-gray-300">
                    <div className="font-bold text-white">{s.title}</div>
                    <div className="text-gray-400 text-xs">{s.detail}</div>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {pod.homework && (
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl px-4 py-3 text-sm text-emerald-200">
              <strong className="font-bold text-emerald-400 block mb-1">Homework:</strong>
              {pod.homework}
            </div>
          )}

          <div>
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search this episode's summary, takeaways, skills, homework..."
              className="w-full bg-gray-950/60 border border-gray-800 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-gray-600 focus:border-blue-500/50 focus:outline-none"
            />
          </div>

          {query.trim() && (
            <div className="space-y-2">
              <div className="text-xs uppercase font-bold tracking-wider text-gray-400">
                {searchHits.length} match{searchHits.length === 1 ? '' : 'es'}
              </div>
              {searchHits.map((hit, idx) => (
                <button
                  key={idx}
                  onClick={() => seekTo(hit.timestamp)}
                  className="w-full text-left bg-gray-950/40 hover:bg-blue-950/30 border border-gray-800/50 hover:border-blue-500/30 rounded-xl px-4 py-3 transition-colors"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-mono text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded">
                      {formatClock(hit.timestamp)}
                    </span>
                    <span className="text-[10px] uppercase text-gray-500 tracking-wider">{hit.field}</span>
                  </div>
                  <div className="text-sm text-gray-200">{hit.text}</div>
                </button>
              ))}
            </div>
          )}

          {!query.trim() && bookmarks.length > 0 && (
            <div>
              <div className="text-xs uppercase font-bold tracking-wider text-gray-400 mb-2">
                Structured-content bookmarks (from key takeaways)
              </div>
              <div className="space-y-2">
                {bookmarks.map((b, idx) => (
                  <button
                    key={idx}
                    onClick={() => seekTo(b.seconds)}
                    disabled={!showPlayer}
                    className={`w-full text-left flex items-start gap-3 rounded-xl px-4 py-3 border transition-colors ${
                      showPlayer && Math.abs(currentTime - b.seconds) < 15
                        ? 'bg-blue-950/30 border-blue-500/40'
                        : 'bg-gray-950/40 border-gray-800/50 hover:border-gray-700'
                    } ${!showPlayer ? 'opacity-60 cursor-default' : ''}`}
                  >
                    {showPlayer && (
                      <span className="text-[10px] font-mono text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded flex-shrink-0 mt-0.5">
                        {formatClock(b.seconds)}
                      </span>
                    )}
                    <span className="text-sm text-gray-200">{b.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {pod.source && <div className="text-xs text-gray-500 pt-2 border-t border-gray-800/50">Source: {pod.source}</div>}

          {/* Listen + Explore: real <audio> playback only. No virtual clock, no timer. */}
          {showPlayer && (
            <div data-testid="audio-player" className="pt-3 border-t border-gray-800/50 space-y-2">
              <audio
                ref={audioRef}
                src={pod.audio}
                onError={handleAudioError}
                onEnded={() => setPlaybackStatus('idle')}
                onTimeUpdate={e => setCurrentTime(e.currentTarget.currentTime)}
              />
              <div className="flex items-center gap-3">
                <button
                  onClick={togglePlay}
                  disabled={playbackStatus === 'unavailable'}
                  className="flex-shrink-0 w-10 h-10 rounded-full bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:cursor-not-allowed flex items-center justify-center text-white"
                  aria-label={playbackStatus === 'playing' ? 'Pause' : 'Play'}
                >
                  {playbackStatus === 'playing' ? '❚❚' : '▶'}
                </button>
                <span className="text-[10px] font-mono text-gray-400">{formatClock(currentTime)}</span>
                <span className="text-[10px] font-mono text-gray-500">/ {formatClock(duration)}</span>
                {playbackStatus === 'unavailable' && (
                  <span data-testid="audio-unavailable" className="text-xs text-red-300">
                    Audio unavailable
                  </span>
                )}
              </div>
            </div>
          )}

          <div className="pt-3 border-t border-gray-800/50 flex flex-wrap items-center gap-2">
            <button
              onClick={handleQueueClick}
              disabled={!canQueue || isQueued}
              title={canQueue ? undefined : 'Only foundation_safe content may be queued as practice'}
              className="text-xs font-bold px-3 py-1.5 rounded-full bg-blue-600 hover:bg-blue-500 disabled:bg-gray-800 disabled:text-gray-500 disabled:cursor-not-allowed text-white"
            >
              {isQueued ? 'Queued' : 'Queue as Practice'}
            </button>
            <button
              onClick={() => onComplete?.(contentId)}
              disabled={isCompleted}
              className="text-xs font-bold px-3 py-1.5 rounded-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-800 disabled:text-gray-500 text-white"
            >
              {isCompleted ? 'Completed' : 'Mark Complete'}
            </button>
            <button
              onClick={() => onDefer?.(contentId)}
              disabled={isDeferred}
              className="text-xs font-bold px-3 py-1.5 rounded-full bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:text-gray-500 text-white"
            >
              {isDeferred ? 'Deferred' : 'Defer for Review'}
            </button>
          </div>

          <div>
            <textarea
              value={draftNote}
              onChange={e => setDraftNote(e.target.value)}
              onBlur={handleNoteBlur}
              placeholder="Add a note..."
              rows={2}
              className="w-full bg-gray-950/60 border border-gray-800 rounded-xl px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:border-blue-500/50 focus:outline-none"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
