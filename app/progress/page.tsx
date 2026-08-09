'use client';

import { useEffect, useMemo, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { TrendingUp, TrendingDown, Target } from 'lucide-react';
import { TacticalPageHeader } from '../components/TacticalPageHeader';
import { pullSfprepSync, pushSfprepSync } from '../lib/sfprep-sync';
import { forecastTargetDate, correlate, type ForecastResult } from '../lib/progress-forecast';

type Metric = 'ruckPace' | 'runPace' | 'ptScore' | 'bodyWeight';

type Point = { date: string; value: number; note?: string };

const STORAGE_KEY = 'sfprep:metrics';

type MetricsStore = Record<Metric, Point[]>;

const empty: MetricsStore = { ruckPace: [], runPace: [], ptScore: [], bodyWeight: [] };

const METRIC_META: Record<Metric, { label: string; unit: string; hint: string; higherIsBetter: boolean; target: number }> = {
  ruckPace:   { label: 'Ruck Pace',   unit: 'min/mi', hint: 'Saturday ruck. Log avg min/mile.',        higherIsBetter: false, target: 15 },
  runPace:    { label: '2-Mile Time', unit: 'min',    hint: 'Time-trial minutes (e.g. 15.5 for 15:30).', higherIsBetter: false, target: 13 },
  ptScore:    { label: 'PT Test',     unit: 'score',  hint: 'Push-ups + sit-ups combined.',              higherIsBetter: true,  target: 180 },
  bodyWeight: { label: 'Body Weight', unit: 'lb',     hint: 'Friday fasted weigh-in.',                   higherIsBetter: false, target: 185 },
};

function load(): MetricsStore {
  if (typeof window === 'undefined') return empty;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return empty;
    const parsed = JSON.parse(raw) as Partial<MetricsStore>;
    return { ...empty, ...parsed };
  } catch { return empty; }
}

function save(store: MetricsStore) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  void pushSfprepSync();
}

/** Earliest logged date across all metrics — used as the OLS program-start anchor. */
function programStartDate(store: MetricsStore): Date {
  const allDates = Object.values(store).flat().map(p => p.date);
  if (allDates.length === 0) return new Date();
  const earliest = [...allDates].sort()[0];
  return new Date(earliest + 'T00:00:00');
}

function Chart({ data, color, forecast, target }: { data: Point[]; color: string; forecast: ForecastResult | null; target: number }) {
  if (!data.length) return <p className="text-sm text-gray-500 py-8 text-center">No data yet — add an entry below.</p>;
  const sorted = [...data].sort((a, b) => a.date.localeCompare(b.date));
  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={sorted}>
        <CartesianGrid stroke="#374151" strokeDasharray="3 3" opacity={0.3} />
        <XAxis dataKey="date" stroke="#9ca3af" fontSize={11} tickLine={false} />
        <YAxis stroke="#9ca3af" fontSize={11} domain={['auto','auto']} tickLine={false} />
        <Tooltip contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: '12px', color: '#f3f4f6' }} />
        <ReferenceLine y={target} stroke="#a78bfa" strokeDasharray="4 4" label={{ value: 'target', fill: '#a78bfa', fontSize: 10, position: 'insideTopRight' }} />
        <Line type="monotone" dataKey="value" stroke={color} strokeWidth={3} dot={{ r: 4, fill: color }} activeDot={{ r: 6 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}

function ForecastBadge({ forecast, meta }: { forecast: ForecastResult; meta: typeof METRIC_META[Metric] }) {
  if (forecast.insufficientData) {
    return (
      <div className="text-[11px] text-gray-500 bg-gray-950/40 border border-gray-800/60 rounded-lg px-3 py-2">
        Need 3+ logged entries to project a target date.
      </div>
    );
  }
  if (forecast.expectedDays < 0) {
    return (
      <div className="text-[11px] text-amber-400 bg-amber-950/20 border border-amber-800/40 rounded-lg px-3 py-2 flex items-center gap-1.5">
        <TrendingDown className="w-3.5 h-3.5" /> {forecast.dateString}
      </div>
    );
  }
  const trendIcon = meta.higherIsBetter
    ? <TrendingUp className="w-3.5 h-3.5" />
    : <TrendingDown className="w-3.5 h-3.5" />;
  return (
    <div className="text-[11px] text-emerald-300 bg-emerald-950/20 border border-emerald-800/40 rounded-lg px-3 py-2 flex items-center gap-1.5">
      <Target className="w-3.5 h-3.5 flex-shrink-0" />
      <span>
        Projected to hit <strong>{meta.target}{meta.unit === 'min' || meta.unit === 'min/mi' ? '' : meta.unit}</strong> around
        {' '}<strong className="font-mono">{forecast.dateString}</strong>
        {' '}(R²={forecast.r2.toFixed(2)}) {trendIcon}
      </span>
    </div>
  );
}

function MetricCard({ metric, color, store, setStore, programStart }: {
  metric: Metric; color: string; store: MetricsStore;
  setStore: (s: MetricsStore) => void;
  programStart: Date;
}) {
  const [date, setDate] = useState(() => new Date().toISOString().slice(0,10));
  const [value, setValue] = useState('');
  const [note, setNote] = useState('');

  const meta = METRIC_META[metric];
  const data = store[metric];

  const forecast = useMemo(
    () => forecastTargetDate(data, programStart, meta.target, meta.higherIsBetter),
    [data, programStart, meta],
  );

  const add = () => {
    const v = parseFloat(value);
    if (!Number.isFinite(v)) return;
    const next: MetricsStore = { ...store, [metric]: [...store[metric], { date, value: v, note: note || undefined }] };
    setStore(next); save(next);
    setValue(''); setNote('');
  };
  const remove = (i: number) => {
    const arr = [...store[metric]]; arr.splice(i, 1);
    const next = { ...store, [metric]: arr };
    setStore(next); save(next);
  };

  return (
    <div className="backdrop-blur-md bg-gray-900/60 rounded-2xl border border-gray-800/50 p-5 shadow-xl hover:border-blue-500/20 transition-all duration-300">
      <div className="flex justify-between items-baseline mb-4">
        <div>
          <h2 className="text-xl font-bold text-white">{meta.label}</h2>
          <p className="text-xs text-gray-400 mt-0.5">{meta.hint}</p>
        </div>
        <span className="text-xs bg-gray-800 text-gray-400 font-semibold px-2.5 py-1 rounded-full uppercase tracking-wider">{meta.unit}</span>
      </div>

      <div className="bg-gray-950/40 border border-gray-800/60 rounded-xl p-3 mb-3">
        <Chart data={data} color={color} forecast={forecast} target={meta.target} />
      </div>

      <div className="mb-4">
        <ForecastBadge forecast={forecast} meta={meta} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
        <input type="date" value={date} onChange={e => setDate(e.target.value)}
          className="bg-gray-950 border border-gray-700/60 px-3 py-2 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-white" />
        <input type="number" step="0.01" placeholder={meta.unit} value={value}
          onChange={e => setValue(e.target.value)}
          className="bg-gray-950 border border-gray-700/60 px-3 py-2 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-white" />
        <input placeholder="note (optional)" value={note} onChange={e => setNote(e.target.value)}
          className="bg-gray-950 border border-gray-700/60 px-3 py-2 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-white col-span-1" />
        <button onClick={add} className="bg-blue-600 hover:bg-blue-500 rounded-xl text-sm font-bold text-white transition-all">Add</button>
      </div>

      {data.length > 0 && (
        <details className="mt-4 group border-t border-gray-800/60 pt-3">
          <summary className="text-xs text-gray-400 cursor-pointer select-none font-bold uppercase tracking-wider hover:text-white transition-colors flex items-center justify-between">
            <span>View History ({data.length})</span>
            <span className="text-gray-500 group-open:rotate-180 transition-transform">▼</span>
          </summary>
          <ul className="mt-3 text-xs space-y-2 max-h-40 overflow-y-auto pr-1">
            {[...data].sort((a,b) => b.date.localeCompare(a.date)).map((p, i) => (
              <li key={i} className="flex justify-between items-center bg-gray-950/40 border border-gray-800/40 rounded-lg px-3 py-2">
                <span className="text-gray-300">
                  <span className="text-gray-500 font-mono mr-2">{p.date}</span>
                  <strong className="text-white font-mono">{p.value}</strong> {meta.unit}
                  {p.note && <span className="text-gray-400 italic ml-2">— {p.note}</span>}
                </span>
                <button onClick={() => remove(data.indexOf(p))} className="text-red-400 hover:text-red-300 font-bold px-1 text-sm">✕</button>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

type Suggestion = {
  id: string;
  title: string;
  description: string;
  source?: string;
  category?: string;
  action?: string;
  status: 'pending' | 'accepted' | 'rejected';
  created_at: string;
};

const CAT_COLOR: Record<string, { border: string; bg: string; text: string }> = {
  run: { border: 'border-blue-500', bg: 'bg-blue-500/10', text: 'text-blue-400' },
  ruck: { border: 'border-amber-500', bg: 'bg-amber-500/10', text: 'text-amber-400' },
  strength: { border: 'border-emerald-500', bg: 'bg-emerald-500/10', text: 'text-emerald-400' },
  nutrition: { border: 'border-purple-500', bg: 'bg-purple-500/10', text: 'text-purple-400' },
  recovery: { border: 'border-cyan-500', bg: 'bg-cyan-500/10', text: 'text-cyan-400' },
  other: { border: 'border-gray-500', bg: 'bg-gray-500/10', text: 'text-gray-400' },
};

function SuggestionsPanel() {
  const [items, setItems] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const refresh = () => {
    setLoading(true);
    fetch('/api/suggestions?status=pending')
      .then(r => r.json())
      .then(d => setItems(Array.isArray(d.suggestions) ? d.suggestions : []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  };

  useEffect(refresh, []);

  const decide = async (id: string, action: 'approve' | 'reject') => {
    setBusy(id);
    try {
      await fetch('/api/suggestions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action }),
      });
      setItems(prev => prev.filter(s => s.id !== id));
    } catch {
      // leave it in place on failure
    } finally {
      setBusy(null);
    }
  };

  if (loading) return null;
  if (!items.length) return null;

  return (
    <div className="backdrop-blur-md bg-gray-900/60 rounded-2xl p-5 mb-8 border border-purple-500/20 shadow-xl shadow-purple-500/5 animate-fade-in">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <span>🔬 Suggested Changes</span>
          <span className="text-xs bg-purple-500/20 text-purple-400 font-semibold px-2.5 py-0.5 rounded-full">
            {items.length} suggestions
          </span>
        </h2>
        <button onClick={refresh} className="text-xs text-gray-400 hover:text-white transition-colors bg-gray-800 px-3 py-1.5 rounded-xl font-bold">↻ Refresh</button>
      </div>
      <p className="text-xs text-gray-400 mb-4">Research findings worth folding into the program. Approve to keep, dismiss to drop.</p>
      <div className="space-y-4">
        {items.map((s, i) => {
          const colors = CAT_COLOR[s.category || 'other'] || CAT_COLOR.other;
          return (
            <div key={s.id}
              className={`bg-gray-950/60 rounded-2xl p-4 border-l-4 ${colors.border} transition-all duration-300 hover:scale-[1.01] animate-slide-in-left`}
              style={{ animationDelay: `${i * 100}ms` }}
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="min-w-0">
                  <h3 className="text-base font-bold text-white">{s.title}</h3>
                  {s.category && (
                    <span className={`inline-block text-[9px] uppercase font-bold tracking-wider mt-1 px-2 py-0.5 rounded ${colors.bg} ${colors.text}`}>
                      {s.category}
                    </span>
                  )}
                </div>
              </div>
              <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-line mb-3">{s.description}</p>
              {s.action && <p className="text-xs text-gray-400 bg-gray-900/50 p-2.5 rounded-lg border border-gray-800/40"><strong>Change:</strong> {s.action}</p>}
              {s.source && <p className="text-[11px] text-gray-500 mt-2 italic">Source: {s.source}</p>}
              <div className="flex gap-2.5 mt-4">
                <button disabled={busy === s.id} onClick={() => decide(s.id, 'approve')}
                  className="bg-green-600 hover:bg-green-500 text-white font-bold disabled:opacity-40 rounded-xl px-4 py-2 text-xs transition-all">Approve</button>
                <button disabled={busy === s.id} onClick={() => decide(s.id, 'reject')}
                  className="bg-gray-800 hover:bg-gray-750 text-gray-300 font-bold disabled:opacity-40 rounded-xl px-4 py-2 text-xs transition-all">Dismiss</button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CorrelationInsight({ store }: { store: MetricsStore }) {
  // Correlate bodyweight vs ruck pace on overlapping dates
  const bw = store.bodyWeight, ruck = store.ruckPace;
  const pairs = useMemo(() => {
    const byDate = new Map(bw.map(p => [p.date, p.value]));
    const out: { bw: number; ruck: number }[] = [];
    ruck.forEach(p => { const w = byDate.get(p.date); if (w != null) out.push({ bw: w, ruck: p.value }); });
    return out;
  }, [bw, ruck]);

  if (pairs.length < 3) return null;
  const r = correlate(pairs.map(p => p.bw), pairs.map(p => p.ruck));
  if (Math.abs(r) < 0.3) return null;

  return (
    <div className="backdrop-blur-md bg-gray-900/60 rounded-2xl p-5 border border-cyan-500/20 shadow-xl">
      <h3 className="text-sm font-bold text-cyan-300 uppercase tracking-wider mb-1">Cross-Metric Correlation</h3>
      <p className="text-sm text-gray-300">
        Bodyweight and ruck pace show a {r > 0 ? 'positive' : 'negative'} correlation (r = {r.toFixed(2)}) across {pairs.length} overlapping days —
        {r > 0
          ? ' heavier weigh-ins have tracked with slower ruck paces.'
          : ' lighter weigh-ins have tracked with faster ruck paces.'}
      </p>
    </div>
  );
}

export default function ProgressPage() {
  const [store, setStore] = useState<MetricsStore>(empty);
  useEffect(() => {
    void pullSfprepSync().finally(() => setStore(load()));
  }, []);

  const summary = useMemo(() => {
    const latest = (m: Metric) => store[m][store[m].length - 1]?.value;
    return {
      ruckPace: latest('ruckPace'),
      runPace: latest('runPace'),
      ptScore: latest('ptScore'),
      bodyWeight: latest('bodyWeight'),
    };
  }, [store]);

  const programStart = useMemo(() => programStartDate(store), [store]);

  return (
    <div className="min-h-screen bg-[#09090a] text-gray-100">
      <div className="max-w-7xl mx-auto p-4">
        <TacticalPageHeader
          eyebrow="Performance"
          title="Are you improving?"
          description="Log the few numbers that move selection readiness. Trends and projections stay subordinate to real test results."
          status={`${Object.values(summary).filter(value => value != null).length}/4 logged`}
        />
      </div>

      <div className="max-w-7xl mx-auto p-4 space-y-8">
        <SuggestionsPanel />

        {/* Diagnostic KPI boxes */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Latest Ruck', value: summary.ruckPace, unit: 'min/mi', gradient: 'from-amber-500/10 to-orange-500/10 border-amber-500/20', text: 'text-amber-400' },
            { label: '2-Mile PR', value: summary.runPace, unit: 'min', gradient: 'from-blue-500/10 to-cyan-500/10 border-blue-500/20', text: 'text-blue-400' },
            { label: 'PT Test Score', value: summary.ptScore, unit: 'pts', gradient: 'from-emerald-500/10 to-teal-500/10 border-emerald-500/20', text: 'text-emerald-400' },
            { label: 'Latest Weight', value: summary.bodyWeight, unit: 'lbs', gradient: 'from-red-500/10 to-pink-500/10 border-red-500/20', text: 'text-red-400' }
          ].map((kpi, i) => (
            <div key={kpi.label}
              className={`bg-gradient-to-br ${kpi.gradient} backdrop-blur-md rounded-2xl p-5 border text-center transition-all duration-300 hover:scale-105 shadow-lg shadow-black/25 animate-scale-in`}
              style={{ animationDelay: `${i * 100}ms` }}
            >
              <div className="text-xs text-gray-400 font-bold uppercase tracking-wider mb-2">{kpi.label}</div>
              <div className={`text-3xl font-black ${kpi.text} font-mono`}>
                {kpi.value ?? '—'} <span className="text-xs text-gray-500">{kpi.unit}</span>
              </div>
            </div>
          ))}
        </div>

        <CorrelationInsight store={store} />

        {/* Charts and Logging Grid */}
        <div className="grid gap-6 md:grid-cols-2">
          <MetricCard metric="ruckPace"   color="#f59e0b" store={store} setStore={setStore} programStart={programStart} />
          <MetricCard metric="runPace"    color="#3b82f6" store={store} setStore={setStore} programStart={programStart} />
          <MetricCard metric="ptScore"    color="#10b981" store={store} setStore={setStore} programStart={programStart} />
          <MetricCard metric="bodyWeight" color="#ef4444" store={store} setStore={setStore} programStart={programStart} />
        </div>
      </div>

      {/* Global CSS animations */}
      <style jsx global>{`
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes scale-in {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
        .animate-fade-in {
          animation: fade-in 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .animate-scale-in {
          animation: scale-in 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>
    </div>
  );
}
