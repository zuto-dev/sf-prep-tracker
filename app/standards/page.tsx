'use client';

import { useEffect, useMemo, useState } from 'react';
import { Nav } from '../components/Nav';
import { pullSfprepSync, pushSfprepSync } from '../lib/sfprep-sync';
import {
  SOF_PROFILES,
  type EventHistory,
  type HistoryPoint,
  latestPoint,
} from '../lib/sof-standards';
import {
  buildBenchmarkRows,
  selectPrimaryWeakness,
  type BenchmarkPresentationRow,
  type BenchmarkStatus,
} from '../lib/standards-presentation';
import { hydrateLifecycleStore, type LifecycleStore } from '../lib/sfre-store';
import { resolveSfreLifecyclePresentation } from '../lib/sfre-lifecycle-presentation';
import { canonicalTwoMileSeconds, resolveStrictRuckGate } from '../lib/sfre-program';

const STORAGE_KEY = 'sfprep:standards';

type Store = {
  bodyweight_lbs: number;
  activeProfile: keyof typeof SOF_PROFILES;
  history: EventHistory;
};

const empty: Store = { bodyweight_lbs: 170, activeProfile: 'sfas', history: {} };

function load(): Store {
  if (typeof window === 'undefined') return empty;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return empty;
    const parsed = JSON.parse(raw);
    return { ...empty, ...parsed, history: parsed.history ?? {} };
  } catch {
    return empty;
  }
}

function save(store: Store) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  void pushSfprepSync();
}

function fmtTime(seconds?: number | null): string {
  if (seconds == null) return '—';
  const minutes = Math.floor(seconds / 60);
  const remainder = Math.round(seconds % 60);
  return `${minutes}:${String(remainder).padStart(2, '0')}`;
}

function isTimeEvent(unit: string): boolean {
  return unit === 'sec';
}

function statusClass(status: BenchmarkStatus): string {
  if (status === 'elite' || status === 'average-select') return 'text-emerald-400 border-emerald-900/50 bg-emerald-950/20';
  if (status === 'minimum') return 'text-amber-400 border-amber-900/50 bg-amber-950/20';
  if (status === 'below-minimum') return 'text-red-400 border-red-900/50 bg-red-950/20';
  return 'text-gray-600 border-gray-900 bg-black/20';
}

function lifecycleLabel(value: string | undefined): string {
  if (!value) return 'Loading';
  return value.replaceAll('_', ' ').replace(/\b\w/g, char => char.toUpperCase());
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

  const set = (patch: Partial<Store>) => {
    const next = { ...store, ...patch };
    setStore(next);
    save(next);
  };

  const profile = SOF_PROFILES[store.activeProfile] ?? SOF_PROFILES.sfas;
  const benchmarkRows = useMemo(
    () => buildBenchmarkRows(store.activeProfile, store.history),
    [store.activeProfile, store.history],
  );
  const primaryWeakness = useMemo(
    () => selectPrimaryWeakness(benchmarkRows),
    [benchmarkRows],
  );
  const loggedCount = benchmarkRows.filter(row => row.currentValue !== null).length;

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

  const logValue = (eventKey: string, raw: string, unit: string) => {
    let value: number | null = null;
    if (isTimeEvent(unit)) {
      const parts = raw.split(':');
      if (parts.length === 2) {
        const minutes = Number(parts[0]);
        const seconds = Number(parts[1]);
        if (Number.isFinite(minutes) && Number.isFinite(seconds) && seconds >= 0 && seconds < 60) {
          value = minutes * 60 + seconds;
        }
      }
    } else {
      const parsed = Number(raw);
      if (Number.isFinite(parsed)) value = parsed;
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

  const bodyweight = store.bodyweight_lbs;
  const ruckTiers = [
    { label: 'Foundation 20%', weight: bodyweight * 0.20, distance: '3–5 mi' },
    { label: 'Build 25%', weight: bodyweight * 0.25, distance: '5–7 mi' },
    { label: 'Late build 30%', weight: bodyweight * 0.30, distance: '3.5–12 mi' },
  ];

  return (
    <main className="min-h-screen bg-[#0a0a0b] text-gray-200">
      <div className="fixed inset-0 pointer-events-none" style={{
        background: 'linear-gradient(180deg, rgba(20,20,25,0.55) 0%, transparent 32vh)',
      }} />

      <div className="relative z-10 max-w-3xl mx-auto px-5 pt-8 pb-16">
        <header className="mb-8">
          <div className="flex items-center justify-between mb-7">
            <div className="flex items-baseline gap-3">
              <span className="text-sm font-bold tracking-[0.3em] text-gray-400">SF</span>
              <span className="text-sm font-bold tracking-[0.3em] text-white">PREP</span>
            </div>
            <span className="text-[10px] uppercase tracking-[0.18em] text-gray-700">Operational Standards</span>
          </div>
          <h1 className="text-2xl font-light tracking-tight text-white">Readiness Benchmarks</h1>
          <p className="mt-2 max-w-xl text-xs leading-5 text-gray-600">
            Your recorded performance against published selection thresholds. Coaching targets are separated from official minimums.
          </p>
        </header>

        <Nav />

        <section className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-gray-900/60 rounded-lg overflow-hidden mb-6">
          <Metric label="Readiness" value={lifecycleLabel(readinessLifecycle?.state)} detail={`${loggedCount}/${benchmarkRows.length} metrics logged`} />
          <Metric label="Weakness" value={primaryWeakness?.label ?? 'Insufficient Data'} detail={primaryWeakness?.gapDisplay ?? 'Log benchmarks first'} />
          <Metric label="2-Mile" value={fmtTime(twoMileSeconds)} detail={`Gate ${fmtTime(ruckGate.gateSeconds)}`} mono />
          <Metric label="Ruck Gate" value={ruckGate.cleared ? 'Cleared' : 'Locked'} detail={ruckGate.cleared ? 'Run standard met' : 'Sub-16:00 required'} tone={ruckGate.cleared ? 'good' : 'warn'} />
        </section>

        <section className="rounded-lg border border-gray-900/80 bg-[#0d0d0f] p-4 mb-6">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <p className="text-[10px] uppercase tracking-[0.18em] text-gray-600">Active Standard</p>
              <h2 className="mt-1 text-sm font-medium text-white">{profile.branchName}</h2>
            </div>
            <p className="hidden sm:block max-w-xs text-right text-[10px] leading-4 text-gray-700">{profile.source}</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1">
            {Object.entries(SOF_PROFILES).map(([key, option]) => {
              const active = store.activeProfile === key;
              return (
                <button
                  key={key}
                  onClick={() => set({ activeProfile: key as keyof typeof SOF_PROFILES })}
                  className={`px-3 py-2 text-[10px] font-bold tracking-[0.12em] uppercase border transition-colors ${
                    active
                      ? 'border-blue-800/70 bg-blue-950/30 text-blue-400'
                      : 'border-gray-900 bg-black/20 text-gray-600 hover:text-gray-400 hover:border-gray-800'
                  }`}
                >
                  {option.shortLabel}
                </button>
              );
            })}
          </div>
        </section>

        <section className="mb-7">
          <div className="flex items-end justify-between mb-3">
            <div>
              <p className="text-[10px] uppercase tracking-[0.18em] text-gray-600">Operational Benchmarks</p>
              <h2 className="mt-1 text-base font-medium text-white">Your values vs. selection standards</h2>
            </div>
            <span className="text-[10px] text-gray-700">CURRENT · MIN · AVG · ELITE</span>
          </div>

          <div className="space-y-2">
            {benchmarkRows.map(row => (
              <BenchmarkRow
                key={row.key}
                row={row}
                onLog={value => logValue(row.key, value, row.unit)}
              />
            ))}
          </div>
        </section>

        <section className="grid sm:grid-cols-3 gap-px bg-gray-900/60 rounded-lg overflow-hidden mb-7">
          <div className="bg-[#0d0d0f] p-4 sm:col-span-1">
            <label htmlFor="bodyweight" className="block text-[10px] uppercase tracking-[0.18em] text-gray-600">Bodyweight</label>
            <div className="mt-2 flex items-baseline gap-2">
              <input
                id="bodyweight"
                type="number"
                value={store.bodyweight_lbs}
                onChange={event => set({ bodyweight_lbs: Number(event.target.value) })}
                className="w-20 bg-transparent border-b border-gray-800 pb-1 text-2xl font-light tabular-nums text-white focus:outline-none focus:border-blue-700"
              />
              <span className="text-xs text-gray-700">LB</span>
            </div>
          </div>
          <div className="bg-[#0d0d0f] p-4 sm:col-span-2">
            <p className="text-[10px] uppercase tracking-[0.18em] text-gray-600">Current Baseline</p>
            <div className="mt-3 grid grid-cols-3 gap-3">
              <Baseline label="HRPU" value={hrpuPoint ? String(hrpuPoint.value) : '—'} />
              <Baseline label="Pull-ups" value={pullUpPoint ? String(pullUpPoint.value) : '—'} />
              <Baseline label="2-Mile" value={fmtTime(twoMileSeconds)} mono />
            </div>
          </div>
        </section>

        <section className="rounded-lg border border-gray-900/80 bg-[#0d0d0f] mb-7 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-900/80 flex items-center justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-[0.18em] text-gray-600">Ruck Reference</p>
              <h2 className="mt-1 text-sm font-medium text-white">Bodyweight-derived load progression</h2>
            </div>
            <span className={`text-[10px] font-bold uppercase tracking-[0.12em] ${ruckGate.cleared ? 'text-emerald-500' : 'text-amber-600'}`}>
              {ruckGate.cleared ? 'Unlocked' : 'Gate Locked'}
            </span>
          </div>
          <div className="grid sm:grid-cols-3 gap-px bg-gray-900/60">
            {ruckTiers.map(tier => (
              <div key={tier.label} className="bg-[#0d0d0f] p-4">
                <p className="text-[10px] uppercase tracking-[0.12em] text-gray-600">{tier.label}</p>
                <p className="mt-2 text-xl font-light tabular-nums text-white">{Math.round(tier.weight)} lb</p>
                <p className="mt-1 text-[10px] text-gray-700">{tier.distance} · walking progression</p>
              </div>
            ))}
          </div>
          <p className="px-4 py-3 text-[10px] leading-4 text-gray-700 border-t border-gray-900/80">
            Reference only. The Foundation catalog and strict two-mile gate remain the sole prescription authority.
          </p>
        </section>

        <section className="rounded-lg border border-gray-900/80 bg-[#0d0d0f] overflow-hidden">
          <details>
            <summary className="cursor-pointer list-none px-4 py-4 flex items-center justify-between">
              <div>
                <p className="text-[10px] uppercase tracking-[0.18em] text-gray-600">History</p>
                <p className="mt-1 text-sm font-medium text-white">Bi-temporal performance log</p>
              </div>
              <span className="text-[10px] text-gray-700 uppercase tracking-wider">Expand</span>
            </summary>
            <div className="border-t border-gray-900/80 p-4 space-y-2">
              {benchmarkRows.every(row => (store.history[row.key] ?? []).length === 0) ? (
                <p className="py-6 text-center text-xs text-gray-700">No performance history logged.</p>
              ) : (
                benchmarkRows.map(row => {
                  const points = [...(store.history[row.key] ?? [])].sort((a, b) => b.date.localeCompare(a.date));
                  if (points.length === 0) return null;
                  return (
                    <details key={row.key} className="border border-gray-900 p-3">
                      <summary className="cursor-pointer text-xs text-gray-400 flex justify-between">
                        <span>{row.label}</span>
                        <span>{points.length} entries</span>
                      </summary>
                      <ul className="mt-3 space-y-1.5">
                        {points.map((point, index) => (
                          <li key={`${point.recordedAt}-${index}`} className="flex justify-between text-[11px] text-gray-600">
                            <span>{point.date}</span>
                            <span className="font-mono text-gray-300">{isTimeEvent(row.unit) ? fmtTime(point.value) : point.value}</span>
                          </li>
                        ))}
                      </ul>
                    </details>
                  );
                })
              )}
            </div>
          </details>
        </section>
      </div>
    </main>
  );
}

function Metric({
  label,
  value,
  detail,
  mono = false,
  tone = 'default',
}: {
  label: string;
  value: string;
  detail: string;
  mono?: boolean;
  tone?: 'default' | 'good' | 'warn';
}) {
  const valueColor = tone === 'good' ? 'text-emerald-400' : tone === 'warn' ? 'text-amber-500' : 'text-white';
  return (
    <div className="bg-[#0d0d0f] p-4 min-h-28">
      <p className="text-[9px] uppercase tracking-[0.16em] text-gray-700">{label}</p>
      <p className={`mt-3 text-sm font-medium leading-5 ${mono ? 'font-mono tabular-nums' : ''} ${valueColor}`}>{value}</p>
      <p className="mt-1 text-[9px] leading-4 text-gray-700">{detail}</p>
    </div>
  );
}

function Baseline({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p className="text-[9px] uppercase tracking-[0.12em] text-gray-700">{label}</p>
      <p className={`mt-1 text-base text-white ${mono ? 'font-mono tabular-nums' : 'font-light'}`}>{value}</p>
    </div>
  );
}

function BenchmarkRow({ row, onLog }: { row: BenchmarkPresentationRow; onLog: (value: string) => void }) {
  return (
    <div className="rounded-lg border border-gray-900/80 bg-[#0d0d0f] p-4">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <p className="text-sm font-medium text-white">{row.label}</p>
          <p className="mt-1 text-[10px] text-gray-700">{row.gapDisplay}</p>
        </div>
        <span className={`px-2 py-1 border text-[9px] font-bold uppercase tracking-[0.1em] ${statusClass(row.status)}`}>
          {row.statusLabel}
        </span>
      </div>

      <div className="grid grid-cols-4 gap-px bg-gray-900/60 mb-3">
        <ValueCell label="Current" value={row.currentDisplay} emphasis />
        <ValueCell label="Minimum" value={row.minimumDisplay} />
        <ValueCell label="Avg Select" value={row.averageDisplay} />
        <ValueCell label="Elite" value={row.eliteDisplay} />
      </div>

      <LogInput unit={row.unit} onSubmit={onLog} />
    </div>
  );
}

function ValueCell({ label, value, emphasis = false }: { label: string; value: string; emphasis?: boolean }) {
  return (
    <div className="bg-black/20 px-2 py-2.5 min-w-0">
      <p className="text-[8px] uppercase tracking-[0.08em] text-gray-700 truncate">{label}</p>
      <p className={`mt-1 text-xs tabular-nums truncate ${emphasis ? 'text-white font-medium' : 'text-gray-500'}`}>{value}</p>
    </div>
  );
}

function LogInput({ unit, onSubmit }: { unit: string; onSubmit: (raw: string) => void }) {
  const [value, setValue] = useState('');
  const submit = () => {
    const trimmed = value.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
    setValue('');
  };

  return (
    <div className="flex items-center gap-2">
      <input
        aria-label="Log benchmark value"
        placeholder={isTimeEvent(unit) ? 'mm:ss' : unit}
        value={value}
        onChange={event => setValue(event.target.value)}
        onKeyDown={event => { if (event.key === 'Enter') submit(); }}
        className="min-w-0 flex-1 bg-black/30 border border-gray-900 px-3 py-2 text-xs text-white placeholder:text-gray-800 focus:outline-none focus:border-blue-800"
      />
      <button
        onClick={submit}
        className="border border-gray-800 px-4 py-2 text-[10px] font-bold uppercase tracking-[0.12em] text-gray-400 hover:text-white hover:border-gray-700 transition-colors"
      >
        Log
      </button>
    </div>
  );
}
