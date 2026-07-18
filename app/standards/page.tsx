'use client';

import { useEffect, useMemo, useState } from 'react';
import { Nav } from '../components/Nav';
import { pullSfprepSync, pushSfprepSync } from '../lib/sfprep-sync';
import {
  SOF_PROFILES,
  evaluateSOFMetrics,
  TIER_META,
  type EventHistory,
  type HistoryPoint,
  latestPoint,
} from '../lib/sof-standards';
import { hydrateLifecycleStore, saveLifecycleStore, type LifecycleStore } from '../lib/sfre-store';
import { resolveSfreLifecyclePresentation } from '../lib/sfre-lifecycle-presentation';
import { canonicalTwoMileSeconds, resolveStrictRuckGate } from '../lib/sfre-program';

// SFAS standards pulled from official USAJFKSWCS docs:
//  - SFAS Preparation Handbook (25 June 2025), 120 pg
//  - 14-Week THOR3 SFAS Training Plan, 25 pg
// Full markdown reference: ~/Gbrain-personal/personal/sf-prep/sfas-standards.md
// PDFs: ~/Gbrain-personal/personal/sf-prep/official-docs/
// Other branch profiles (SEAL PST, RASP, AFSOC) sourced from public-domain
// published minimums — see app/lib/sof-standards.ts SOF_PROFILES.source.

const STORAGE_KEY = 'sfprep:standards';

type Store = {
  bodyweight_lbs: number;
  activeProfile: keyof typeof SOF_PROFILES;
  history: EventHistory; // eventKey -> bi-temporal points
};

const empty: Store = { bodyweight_lbs: 170, activeProfile: 'sfas', history: {} };

function load(): Store {
  if (typeof window === 'undefined') return empty;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return empty;
    const parsed = JSON.parse(raw);
    return { ...empty, ...parsed, history: parsed.history ?? {} };
  } catch { return empty; }
}

function save(s: Store) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  void pushSfprepSync();
}

function fmtTime(sec?: number): string {
  if (sec == null) return '—';
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

function isTimeEvent(unit: string) {
  return unit === 'sec';
}

export default function StandardsPage() {
  const [store, setStore] = useState<Store>(empty);
  const [lifecycle, setLifecycle] = useState<LifecycleStore | null>(null);
  useEffect(() => {
    void pullSfprepSync().finally(() => {
      setStore(load());
      const storage = typeof window !== 'undefined' ? window.localStorage : null;
      setLifecycle(hydrateLifecycleStore(storage));
    });
  }, []);
  const set = (patch: Partial<Store>) => { const s = { ...store, ...patch }; setStore(s); save(s); };

  const profile = SOF_PROFILES[store.activeProfile] ?? SOF_PROFILES.sfas;

  const logValue = (eventKey: string, raw: string, unit: string) => {
    let value: number | null = null;
    if (isTimeEvent(unit)) {
      const [m, s] = raw.split(':').map(n => parseInt(n, 10));
      if (Number.isFinite(m) && Number.isFinite(s)) value = m * 60 + s;
    } else {
      const v = parseFloat(raw);
      if (Number.isFinite(v)) value = v;
    }
    if (value == null) return;
    const now = new Date();
    const point: HistoryPoint = {
      date: now.toISOString().slice(0, 10),
      recordedAt: now.toISOString(),
      value,
    };
    const existing = store.history[eventKey] ?? [];
    set({ history: { ...store.history, [eventKey]: [...existing, point] } });
  };

  const bw = store.bodyweight_lbs;
  const ruckTiers = [
    { label: 'THOR3 Wk 5-6 (20% BW)', weight: bw * 0.20, distance: '3-5 mi', pace: 'moderate' },
    { label: 'THOR3 Wk 7-8 (25% BW)', weight: bw * 0.25, distance: '5-7 mi', pace: 'moderate' },
    { label: 'THOR3 Wk 9-14 (30% BW)', weight: bw * 0.30, distance: '3.5-12 mi', pace: 'moderate + fast' },
  ];
  const officialTiers = [35, 40, 45, 50, 55];

  const eventRows = useMemo(() => {
    return Object.entries(profile.events).map(([key, ev]) => {
      const point = latestPoint(store.history, key);
      const evalResult = point ? evaluateSOFMetrics(store.activeProfile, key, point.value) : null;
      return { key, ev, point, evalResult };
    });
  }, [profile, store.history, store.activeProfile]);

  const twoMileSeconds = useMemo(() => canonicalTwoMileSeconds(store), [store]);
  const ruckGate = useMemo(() => resolveStrictRuckGate(twoMileSeconds), [twoMileSeconds]);
  const readinessLifecycle = useMemo(() => {
    if (!lifecycle) return null;
    return resolveSfreLifecyclePresentation({
      date: new Date(),
      foundationStart: new Date(lifecycle.foundationStart),
      confirmedSfreDate: lifecycle.confirmedSfreDate,
    });
  }, [lifecycle]);
  const pullUpPoint = latestPoint(store.history, 'pullUps');
  const hrpuPoint = latestPoint(store.history, 'hrPushups');

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      {/* Animated background gradient */}
      <div className="fixed inset-0 bg-gradient-to-br from-blue-950/20 via-gray-950 to-purple-950/20 pointer-events-none" />

      {/* Hero Section */}
      <div className="relative bg-gradient-to-b from-blue-950/40 to-transparent backdrop-blur-sm pb-8">
        <div className="max-w-5xl mx-auto p-4">
          <div className="mb-6 animate-fade-in">
            <h1 className="text-5xl font-black bg-gradient-to-r from-white via-blue-300 to-purple-400 bg-clip-text text-transparent">
              Military Standards
            </h1>
            <p className="text-gray-400 mt-2 text-base">
              Multi-branch SOF threshold engine. Switch profiles, log a value, and every gauge redraws.
            </p>
          </div>
          <Nav />
        </div>
      </div>

      <div className="max-w-5xl mx-auto p-4 -mt-6 relative z-10 space-y-8">
        {/* Dynamic SOF Profile Switcher */}
        <div className="backdrop-blur-md bg-gray-900/60 rounded-2xl p-4 border border-gray-800/50 shadow-xl">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold uppercase tracking-wider text-gray-400">Active Profile</h2>
            <span className="text-[11px] text-gray-500 italic">{profile.source}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {Object.entries(SOF_PROFILES).map(([key, p]) => (
              <button
                key={key}
                onClick={() => set({ activeProfile: key as keyof typeof SOF_PROFILES })}
                className={`px-4 py-2 rounded-xl text-sm font-bold border transition-all duration-300 ${
                  store.activeProfile === key
                    ? 'bg-blue-600/80 border-blue-400/50 text-white shadow-lg shadow-blue-500/20 scale-105'
                    : 'bg-gray-800/40 border-gray-700/50 text-gray-300 hover:border-blue-500/40 hover:bg-gray-800/70'
                }`}
              >
                {p.shortLabel}
              </button>
            ))}
          </div>
        </div>

        {/* SFRE Readiness — Plan D + MTI coaching targets, not official cutoffs */}
        <div className="backdrop-blur-md bg-gray-900/60 rounded-2xl p-5 border border-purple-500/20 shadow-xl">
          <div className="flex items-center justify-between flex-wrap gap-2 mb-1">
            <h2 className="text-lg font-bold text-white">SFRE Readiness</h2>
            <span className="text-[11px] text-purple-300 italic">
              Plan D + MTI coaching targets — not official SFRE cutoffs.
            </span>
          </div>
          <div className="grid sm:grid-cols-3 gap-3 mt-4">
            <div className="bg-gray-950/40 border border-gray-800/60 rounded-xl p-3.5">
              <div className="text-[10px] uppercase font-bold tracking-wider text-gray-500 mb-1">2-Mile (canonical)</div>
              <div className="text-lg font-black text-white font-mono">{twoMileSeconds != null ? fmtTime(twoMileSeconds) : '—'}</div>
              <div className="text-xs text-gray-400 mt-1">HRPU: {hrpuPoint ? hrpuPoint.value : '—'} · Pull-ups: {pullUpPoint ? pullUpPoint.value : '—'}</div>
            </div>
            <div className="bg-gray-950/40 border border-gray-800/60 rounded-xl p-3.5">
              <div className="text-[10px] uppercase font-bold tracking-wider text-gray-500 mb-1">Ruck Gate</div>
              <div className={`text-sm font-bold ${ruckGate.cleared ? 'text-emerald-400' : 'text-amber-400'}`}>
                {ruckGate.cleared ? 'Cleared' : 'Locked'}
              </div>
              <div className="text-xs text-gray-400 mt-1">
                {ruckGate.cleared
                  ? `2-mile at or under ${fmtTime(ruckGate.gateSeconds)}`
                  : `Next action: log a 2-mile at or under ${fmtTime(ruckGate.gateSeconds)}`}
              </div>
            </div>
            <div className="bg-gray-950/40 border border-gray-800/60 rounded-xl p-3.5">
              <div className="text-[10px] uppercase font-bold tracking-wider text-gray-500 mb-1">Lifecycle / Peak Date</div>
              {readinessLifecycle ? (
                <>
                  <div className="text-sm font-bold text-blue-300 capitalize">{readinessLifecycle.state.replace('_', ' ')}</div>
                  <div className="text-xs text-gray-400 mt-1">
                    {readinessLifecycle.dateState === 'date_required'
                      ? 'Confirm your SFRE date on Home to unlock a countdown.'
                      : readinessLifecycle.daysUntilEvent !== null
                        ? `${readinessLifecycle.daysUntilEvent} days to event`
                        : '—'}
                  </div>
                </>
              ) : (
                <div className="text-sm text-gray-500">Loading…</div>
              )}
            </div>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <div className="backdrop-blur-md bg-gray-900/60 rounded-2xl p-5 border border-yellow-500/20 shadow-xl hover:border-yellow-500/40 transition-all duration-300">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xl">⚠️</span>
              <h3 className="text-lg font-bold text-yellow-400">Minimum Standards</h3>
            </div>
            <p className="text-sm text-gray-300 leading-relaxed">
              Price of entry. These are the absolute bare minimum to avoid being immediately dropped. Meet these or do not show up.
            </p>
          </div>
          <div className="backdrop-blur-md bg-gray-900/60 rounded-2xl p-5 border border-emerald-500/20 shadow-xl hover:border-emerald-500/40 transition-all duration-300">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xl">🔥</span>
              <h3 className="text-lg font-bold text-emerald-400">Average Select Candidate</h3>
            </div>
            <p className="text-sm text-gray-300 leading-relaxed">
              What successful candidates actually perform. This is the tier that gets selected. Chase these numbers.
            </p>
          </div>
        </div>

        {/* Bodyweight input */}
        <div className="backdrop-blur-md bg-gray-900/60 rounded-2xl p-6 border border-gray-800/50 shadow-xl">
          <h2 className="text-2xl font-bold mb-4 bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
            Your Current Baseline
          </h2>
          <div className="bg-gray-800/40 rounded-xl p-3.5 border border-gray-800/60 max-w-xs">
            <span className="text-gray-400 text-xs font-bold mb-2 uppercase tracking-wider block">Bodyweight (lbs)</span>
            <input type="number" value={store.bodyweight_lbs}
              onChange={e => set({ bodyweight_lbs: Number(e.target.value) })}
              className="bg-gray-950 border border-gray-700/60 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-full" />
          </div>
        </div>

        {/* Bi-Temporal Threshold Matrix */}
        <div className="backdrop-blur-md bg-gray-900/60 rounded-2xl border border-gray-800/50 shadow-xl overflow-hidden">
          <div className="bg-gradient-to-r from-blue-900/40 to-purple-900/40 px-6 py-4 border-b border-gray-800/50">
            <h2 className="text-xl font-bold">{profile.branchName}</h2>
          </div>
          <div className="divide-y divide-gray-800/50">
            {eventRows.map(({ key, ev, point, evalResult }) => {
              const tierMeta = evalResult ? TIER_META[evalResult.tier] : null;
              const displayValue = point == null
                ? '—'
                : isTimeEvent(ev.unit) ? fmtTime(point.value) : `${point.value}`;
              return (
                <div key={key} className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-gray-800/20 transition-colors">
                  <div>
                    <h4 className="font-bold text-white text-base">{ev.label}</h4>
                    <div className="text-xs text-gray-500 mt-1">
                      Min <span className="text-gray-300 font-semibold">{isTimeEvent(ev.unit) ? fmtTime(ev.thresholds.minimum) : ev.thresholds.minimum}</span>
                      {' · '}Avg-Select <span className="text-gray-300 font-semibold">{isTimeEvent(ev.unit) ? fmtTime(ev.thresholds.averageSelect) : ev.thresholds.averageSelect}</span>
                      {' · '}Elite <span className="text-gray-300 font-semibold">{isTimeEvent(ev.unit) ? fmtTime(ev.thresholds.elite) : ev.thresholds.elite}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="text-xs text-gray-400 uppercase tracking-wider">Latest</div>
                      <div className="text-lg font-black text-white font-mono">{displayValue}</div>
                    </div>
                    <div className="bg-gray-950/60 border border-gray-800 rounded-xl px-4 py-2.5 min-w-[150px] text-center text-sm">
                      {tierMeta ? (
                        <div>
                          <span className={`font-semibold ${tierMeta.color}`}>{tierMeta.label}</span>
                          {evalResult && evalResult.tier !== 'elite' && (
                            <div className="text-[10px] text-gray-500 mt-0.5">
                              gap: {isTimeEvent(ev.unit) ? fmtTime(evalResult.nextTargetGap) : Math.round(evalResult.nextTargetGap)} {isTimeEvent(ev.unit) ? '' : ev.unit}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-500">not entered</span>
                      )}
                    </div>
                    <LogInput unit={ev.unit} onSubmit={v => logValue(key, v, ev.unit)} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Ruck Progression */}
        <div className="backdrop-blur-md bg-gray-900/60 rounded-2xl border border-gray-800/50 shadow-xl overflow-hidden">
          <div className="bg-gradient-to-r from-amber-900/40 to-orange-900/40 px-6 py-4 border-b border-gray-800/50">
            <h2 className="text-xl font-bold">Ruck Load Progression</h2>
          </div>
          <div className="p-6 space-y-6">
            <div>
              <h3 className="text-lg font-semibold mb-3">THOR3 (from your bodyweight)</h3>
              <div className="grid md:grid-cols-3 gap-4">
                {ruckTiers.map((tier, i) => (
                  <div key={i} className="bg-gray-850/40 border border-gray-800/60 rounded-xl p-4 hover:border-amber-500/30 transition-all duration-300">
                    <h4 className="font-bold text-gray-200 text-sm mb-2">{tier.label}</h4>
                    <div className="text-3xl font-black text-amber-400 font-mono mb-1">{Math.round(tier.weight)} lbs</div>
                    <div className="text-xs text-gray-400">Distance: {tier.distance} · Pace: {tier.pace}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-4 border-t border-gray-800/50">
              <h3 className="text-lg font-semibold mb-3">Handbook Absolute Tiers</h3>
              <div className="flex flex-wrap gap-3">
                {officialTiers.map((w, i) => (
                  <div key={i} className="bg-gray-950/40 border border-gray-850 rounded-xl px-4 py-3 flex-1 min-w-[100px] text-center">
                    <div className="text-xs text-gray-500">Tier {i + 1}</div>
                    <div className="text-2xl font-black text-white font-mono">{w} lbs</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* History log per event */}
        <div className="backdrop-blur-md bg-gray-900/60 rounded-2xl border border-gray-800/50 shadow-xl overflow-hidden">
          <div className="bg-gradient-to-r from-gray-800/60 to-gray-900/60 px-6 py-4 border-b border-gray-800/50">
            <h2 className="text-xl font-bold">History (bi-temporal log)</h2>
            <p className="text-xs text-gray-500 mt-1">Every entry keeps its recorded-at timestamp, so late-logged sessions never overwrite the true chronology.</p>
          </div>
          <div className="p-4 space-y-3">
            {eventRows.every(r => (store.history[r.key] ?? []).length === 0) ? (
              <div className="text-sm text-gray-500 text-center py-4">No history yet — log a value above to start tracking trend.</div>
            ) : (
              eventRows.map(({ key, ev }) => {
                const pts = [...(store.history[key] ?? [])].sort((a, b) => b.date.localeCompare(a.date));
                if (pts.length === 0) return null;
                return (
                  <details key={key} className="group border border-gray-800/60 rounded-xl p-3">
                    <summary className="text-sm font-semibold cursor-pointer flex items-center justify-between">
                      <span>{ev.label} ({pts.length})</span>
                      <span className="text-gray-500 group-open:rotate-180 transition-transform text-xs">▼</span>
                    </summary>
                    <ul className="mt-2 text-xs space-y-1">
                      {pts.map((p, i) => (
                        <li key={i} className="flex justify-between text-gray-400">
                          <span>{p.date}</span>
                          <span className="text-white font-mono">{isTimeEvent(ev.unit) ? fmtTime(p.value) : p.value}</span>
                        </li>
                      ))}
                    </ul>
                  </details>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Global styles */}
      <style jsx global>{`
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .animate-fade-in {
          animation: fade-in 0.6s ease-out forwards;
        }
      `}</style>
    </div>
  );
}

function LogInput({ unit, onSubmit }: { unit: string; onSubmit: (raw: string) => void }) {
  const [v, setV] = useState('');
  return (
    <div className="flex items-center gap-1">
      <input
        placeholder={isTimeEvent(unit) ? 'mm:ss' : unit}
        value={v}
        onChange={e => setV(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter' && v.trim()) { onSubmit(v.trim()); setV(''); }
        }}
        className="w-20 bg-gray-950 border border-gray-700/60 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      <button
        onClick={() => { if (v.trim()) { onSubmit(v.trim()); setV(''); } }}
        className="text-xs px-2 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold"
      >
        Log
      </button>
    </div>
  );
}
