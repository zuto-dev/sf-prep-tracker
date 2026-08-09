'use client';

// Read-only Calendar "Knowledge Focus" card (WS-7, Architecture Amendment 3).
//
// Hard constraints (do not relax without a spec change):
//   - This component NEVER imports a KnowledgeStore mutation helper and
//     never triggers a background sync push. It is a pure display layer
//     over a KnowledgeFocusSnapshot value computed by the caller (Calendar
//     page) via `deriveKnowledgeFocusSnapshot` (knowledge-views.ts), which
//     is itself a read-only projection.
//   - It never renders a raw canonical ID as a label — only
//     `KnowledgeFocusSnapshot.activeItems[].label` (a real human-readable
//     title resolved against pods), or, when the pods feed is unavailable,
//     a plain-language unavailable message plus the store-derived counts.
//   - It explicitly states it does not change the training prescription,
//     and links to /pods with a normal (non-mutating) navigation link.
//
// Props are intentionally narrow (just the already-derived snapshot) so
// this component carries zero knowledge of KnowledgeStore/pods shapes and
// cannot accidentally reach for a mutation path.

import Link from 'next/link';
import { BookOpen } from 'lucide-react';
import type { KnowledgeFocusSnapshot } from '../lib/knowledge-views';

export type KnowledgeFocusCardProps = {
  readonly snapshot: KnowledgeFocusSnapshot;
};

export function KnowledgeFocusCard({ snapshot }: KnowledgeFocusCardProps) {
  const { reviewCount } = snapshot;
  const activeItems = snapshot.available ? snapshot.activeItems.slice(0, 3) : [];

  return (
    <div className="backdrop-blur-md bg-gray-900/60 border border-gray-800/50 rounded-2xl p-5 space-y-3 hover:border-gray-750 transition-colors">
      <h4 className="text-sm font-bold text-white flex items-center gap-2">
        <BookOpen className="w-4 h-4 text-purple-400" />
        Knowledge Focus
      </h4>

      {snapshot.available ? (
        activeItems.length > 0 ? (
          <ul className="space-y-1.5">
            {activeItems.map(item => (
              <li
                key={item.id}
                className="text-sm text-gray-200 px-3 py-2 bg-gray-950/40 rounded-lg border border-gray-850 truncate"
              >
                {item.label}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-gray-500 italic">No active queued items right now.</p>
        )
      ) : (
        <p className="text-xs text-gray-500 italic">
          Knowledge feed unavailable right now — showing counts only.
        </p>
      )}

      <div className="flex justify-between items-center text-xs pt-1">
        <span className="text-gray-400">Needs review</span>
        <span className="text-purple-400 font-bold font-mono">{reviewCount}</span>
      </div>

      <Link
        href="/pods"
        className="inline-block text-xs text-blue-400 hover:text-blue-300 underline underline-offset-2"
      >
        Open SF Pod library
      </Link>

      <p className="text-[10px] text-gray-500 pt-1">
        Reference only — this card does not change your training prescription.
      </p>
    </div>
  );
}
