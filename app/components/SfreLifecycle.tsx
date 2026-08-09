'use client';

import { useEffect, useState } from 'react';
import { pullSfprepSync, pushSfprepSync } from '../lib/sfprep-sync';
import {
  hydrateLifecycleStore,
  saveLifecycleStore,
  type LifecycleStore,
} from '../lib/sfre-store';
import { resolveSfreLifecyclePresentation } from '../lib/sfre-lifecycle-presentation';

const STAGE_ORDER = ['foundation', 'bridge', 'mtiPeak'] as const;

const STATUS_STYLE: Record<string, { dot: string; text: string; bg: string; border: string }> = {
  active: { dot: 'bg-blue-400 animate-pulse', text: 'text-blue-300', bg: 'bg-blue-500/10', border: 'border-blue-500/40' },
  complete: { dot: 'bg-emerald-400', text: 'text-emerald-300', bg: 'bg-emerald-500/5', border: 'border-emerald-700/30' },
  upcoming: { dot: 'bg-amber-400', text: 'text-amber-300', bg: 'bg-amber-500/5', border: 'border-amber-700/30' },
  locked: { dot: 'bg-gray-600', text: 'text-gray-500', bg: 'bg-gray-800/20', border: 'border-gray-800/40' },
};

function toDateInputValue(iso: string | null): string {
  if (!iso) return '';
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return '';
  return new Date(t).toISOString().slice(0, 10);
}

export function SfreLifecycle() {
  const [store, setStore] = useState<LifecycleStore | null>(null);

  useEffect(() => {
    let cancelled = false;
    void pullSfprepSync().finally(() => {
      if (cancelled) return;
      const storage = typeof window !== 'undefined' ? window.localStorage : null;
      setStore(hydrateLifecycleStore(storage));
    });
    return () => { cancelled = true; };
  }, []);

  if (!store) return null;

  const presentation = resolveSfreLifecyclePresentation({
    date: new Date(),
    foundationStart: new Date(store.foundationStart),
    confirmedSfreDate: store.confirmedSfreDate,
  });

  const setConfirmedDate = (value: string) => {
    const iso = value ? new Date(`${value}T00:00:00Z`).toISOString() : null;
    const next: LifecycleStore = { ...store, confirmedSfreDate: iso };
    setStore(next);
    const storage = typeof window !== 'undefined' ? window.localStorage : null;
    saveLifecycleStore(next, storage);
    void pushSfprepSync();
  };

  return (
    <div className="backdrop-blur-md bg-gray-900/60 rounded-2xl p-5 mb-8 border border-gray-800/50 shadow-xl animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
        <div>
          <h2 className="text-xl font-bold text-white">SFRE Lifecycle</h2>
          <p className="text-xs text-gray-400 mt-1">
            User-owned plan/checklist framing only — no MTI session content lives here.
          </p>
        </div>
        <DateStateBadge presentation={presentation} />
      </div>

      <div className="grid sm:grid-cols-3 gap-3 mb-4">
        {STAGE_ORDER.map(key => {
          const stage = presentation.stages[key];
          const style = STATUS_STYLE[stage.status];
          return (
            <div key={key} className={`rounded-xl p-3.5 border ${style.bg} ${style.border}`}>
              <div className="flex items-center gap-2 mb-1">
                <span className={`w-2 h-2 rounded-full ${style.dot}`} />
                <span className={`text-[10px] uppercase font-bold tracking-wider ${style.text}`}>
                  {stage.status}
                </span>
              </div>
              <div className="text-sm font-semibold text-white leading-snug">{stage.label}</div>
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-4 pt-3 border-t border-gray-800/50">
        <div>
          <label className="text-[11px] uppercase font-bold tracking-wider text-gray-400 block mb-1">
            Confirmed SFRE Date
          </label>
          <input
            type="date"
            value={toDateInputValue(store.confirmedSfreDate)}
            onChange={e => setConfirmedDate(e.target.value)}
            className="bg-gray-950 border border-gray-700/60 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        {presentation.daysUntilEvent !== null && presentation.dateState !== 'post_event' && (
          <div className="text-sm text-gray-300">
            <span className="font-bold text-white">{presentation.daysUntilEvent}</span> days to event
            {presentation.daysUntilPeakWindow !== null && presentation.daysUntilPeakWindow > 0 && (
              <span className="text-gray-500"> · {presentation.daysUntilPeakWindow} days to MTI Peak window</span>
            )}
          </div>
        )}
        <a
          href="https://fitness.mtntactical.com/"
          target="_blank"
          rel="noreferrer"
          className="ml-auto text-xs text-gray-400 hover:text-gray-200 underline decoration-dotted"
          title="Opens the MTI platform in a new tab — you sign in there separately; no content is mirrored here."
        >
          Open MTI platform (external, sign in separately) →
        </a>
      </div>
    </div>
  );
}

function DateStateBadge({ presentation }: { presentation: ReturnType<typeof resolveSfreLifecyclePresentation> }) {
  const map: Record<string, { label: string; cls: string }> = {
    date_required: { label: 'Date Required', cls: 'bg-amber-500/20 text-amber-300' },
    countdown: { label: 'Countdown', cls: 'bg-blue-500/20 text-blue-300' },
    active: { label: 'MTI Peak Active', cls: 'bg-purple-500/20 text-purple-300' },
    post_event: { label: 'Post-Event', cls: 'bg-emerald-500/20 text-emerald-300' },
  };
  const badge = map[presentation.dateState];
  return (
    <span className={`text-xs font-bold px-3 py-1 rounded-full ${badge.cls}`}>
      {badge.label}
    </span>
  );
}
