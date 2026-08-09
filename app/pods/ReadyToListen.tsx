'use client';

// Audio-first "Ready to Listen" hero card for the SF Pod Briefing Center.
//
// Contract (do not relax without a spec change):
//   - Consumes the CURRENT Pod + its already-resolved SfPodNarration (from
//     app/lib/sf-pod-narrations.ts's `resolveSfPodNarration`) as props. It
//     NEVER resolves narration itself, never fetches pods.json, and never
//     imports KnowledgeStore/sfprep-sync/knowledge-engine or any
//     store/sync/prescription surface — pure presentation + one local
//     playback-error UI state.
//   - Renders a REAL native `<audio controls>` element bound to
//     `narration.audioUrl` — no virtual clock, no simulated progress bar,
//     no synthesized duration.
//   - Always visibly labels the audio as `SF Pod briefing narration`
//     (never implies it is the original podcast episode).
//   - A native `onError` on the `<audio>` element always flips to a
//     visible "narration unavailable" state — it never silently no-ops
//     and never keeps showing a player that looks functional.
//   - `onOpenNotes` is a parent-owned callback (e.g. opens the existing
//     KnowledgeExplorerModal in Read + Explore mode) — this component
//     never owns modal/queue/complete/defer state itself.
//   - When `narration` is null/undefined this component renders nothing
//     (parent is responsible for not rendering it for unresolved/unknown
//     pods — see page.tsx's contract).

import { useState } from 'react';
import type { SfPodNarration } from '../lib/sf-pod-narrations.ts';

export type ReadyToListenPod = {
  date: string;
  episode: number;
  title: string;
  summary: string;
};

export type ReadyToListenProps = {
  /** The current (newest resolved) pod to feature. */
  pod: ReadyToListenPod;
  /** The already-resolved narration for this pod. Component renders nothing if this is null/undefined. */
  narration: SfPodNarration | null | undefined;
  /** Called when the user wants to open the full notes/explorer view for this pod. Parent-owned. */
  onOpenNotes: () => void;
};

/**
 * Audio-first hero card: real `<audio controls>` bound to the resolved
 * narration URL, a visible `SF Pod briefing narration` label, and an
 * explicit unavailable state on playback error. Renders nothing when no
 * narration was resolved for the given pod.
 */
export function ReadyToListen({ pod, narration, onOpenNotes }: ReadyToListenProps) {
  const [unavailable, setUnavailable] = useState(false);

  if (!narration) return null;

  const handleError = () => {
    setUnavailable(true);
  };

  return (
    <div
      data-testid="ready-to-listen"
      className="backdrop-blur-md bg-gradient-to-br from-blue-950/40 to-purple-950/20 border border-blue-800/40 rounded-2xl p-6 shadow-xl"
    >
      <div className="flex items-center gap-2 mb-1">
        <span className="text-[10px] uppercase font-bold tracking-wider text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded-full">
          Ready to Listen
        </span>
        <span
          data-testid="ready-to-listen-narration-label"
          className="text-[10px] uppercase font-bold tracking-wider text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded-full"
        >
          {narration.label}
        </span>
      </div>

      <h2 className="text-2xl font-black text-white mt-1">{pod.title}</h2>
      <p className="text-xs text-gray-500 mt-0.5">Episode {pod.episode} · {pod.date}</p>
      <p className="text-sm text-gray-300 mt-3 leading-relaxed">{pod.summary}</p>

      {unavailable ? (
        <div
          data-testid="ready-to-listen-unavailable"
          role="status"
          className="mt-4 bg-amber-950/30 border border-amber-700/50 text-amber-200 px-4 py-3 rounded-xl text-sm"
        >
          Narration audio is unavailable right now. You can still read the full briefing notes below.
        </div>
      ) : (
        <audio
          data-testid="ready-to-listen-audio"
          controls
          preload="none"
          className="w-full mt-4"
          src={narration.audioUrl}
          onError={handleError}
        >
          Your browser does not support the audio element.
        </audio>
      )}

      <button
        onClick={onOpenNotes}
        className="mt-4 text-xs font-bold px-3 py-1.5 rounded-full bg-blue-600 hover:bg-blue-500 text-white"
      >
        Open notes
      </button>
    </div>
  );
}
