'use client';

import { useEffect, useMemo, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Nav } from '../components/Nav';

type Metric = 'ruckPace' | 'runPace' | 'ptScore' | 'bodyWeight';

type Point = { date: string; value: number; note?: string };

const STORAGE_KEY = 'sfprep:metrics';

type MetricsStore = Record<Metric, Point[]>;

const empty: MetricsStore = { ruckPace: [], runPace: [], ptScore: [], bodyWeight: [] };

const METRIC_META: Record<Metric, { label: string; unit: string; hint: string }> = {
  ruckPace:   { label: 'Ruck Pace',   unit: 'min/mi', hint: 'Saturday ruck. Log avg min/mile.' },
  runPace:    { label: '2-Mile Time', unit: 'min',    hint: 'Time-trial minutes (e.g. 15.5 for 15:30).' },
  ptScore:    { label: 'PT Test',     unit: 'score',  hint: 'Push-ups + sit-ups combined.' },
  bodyWeight: { label: 'Body Weight', unit: 'lb',     hint: 'Friday fasted weigh-in.' },
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
}

function Chart({ data, color }: { data: Point[]; color: string }) {
  if (!data.length) return <p className="text-sm text-gray-500 py-8">No data yet — add an entry below.</p>;
  const sorted = [...data].sort((a, b) => a.date.localeCompare(b.date));
  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={sorted}>
        <CartesianGrid stroke="#374151" strokeDasharray="3 3" />
        <XAxis dataKey="date" stroke="#9ca3af" fontSize={11} />
        <YAxis stroke="#9ca3af" fontSize={11} domain={['auto','auto']} />
        <Tooltip contentStyle={{ background: '#1f2937', border: '1px solid #374151', color: '#f3f4f6' }} />
        <Line type="monotone" dataKey="value" stroke={color} strokeWidth={2} dot={{ r: 3 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}

function MetricCard({ metric, color, store, setStore }: {
  metric: Metric; color: string; store: MetricsStore;
  setStore: (s: MetricsStore) => void;
}) {
  const [date, setDate] = useState(() => new Date().toISOString().slice(0,10));
  const [value, setValue] = useState('');
  const [note, setNote] = useState('');

  const meta = METRIC_META[metric];
  const data = store[metric];

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
    <div className="bg-gray-800 rounded-lg p-4">
      <div className="flex justify-between items-baseline mb-2">
        <div>
          <h2 className="text-lg font-semibold">{meta.label}</h2>
          <p className="text-xs text-gray-400">{meta.hint}</p>
        </div>
        <span className="text-xs text-gray-500">{meta.unit}</span>
      </div>
      <Chart data={data} color={color} />
      <div className="mt-3 grid grid-cols-4 gap-2">
        <input type="date" value={date} onChange={e => setDate(e.target.value)}
          className="bg-gray-900 border border-gray-700 px-2 py-1 rounded text-sm" />
        <input type="number" step="0.01" placeholder={meta.unit} value={value}
          onChange={e => setValue(e.target.value)}
          className="bg-gray-900 border border-gray-700 px-2 py-1 rounded text-sm" />
        <input placeholder="note (optional)" value={note} onChange={e => setNote(e.target.value)}
          className="bg-gray-900 border border-gray-700 px-2 py-1 rounded text-sm col-span-1" />
        <button onClick={add} className="bg-blue-600 hover:bg-blue-700 rounded text-sm">Add</button>
      </div>
      {data.length > 0 && (
        <details className="mt-2">
          <summary className="text-xs text-gray-400 cursor-pointer">History ({data.length})</summary>
          <ul className="mt-2 text-xs space-y-1">
            {[...data].sort((a,b) => b.date.localeCompare(a.date)).map((p, i) => (
              <li key={i} className="flex justify-between border-b border-gray-700 py-1">
                <span>{p.date}: <strong>{p.value}</strong> {meta.unit} {p.note && <em className="text-gray-500">— {p.note}</em>}</span>
                <button onClick={() => remove(data.indexOf(p))} className="text-red-400 hover:text-red-300">×</button>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

export default function ProgressPage() {
  const [store, setStore] = useState<MetricsStore>(empty);
  useEffect(() => { setStore(load()); }, []);

  const summary = useMemo(() => {
    const latest = (m: Metric) => store[m][store[m].length - 1]?.value;
    return {
      ruckPace: latest('ruckPace'),
      runPace: latest('runPace'),
      ptScore: latest('ptScore'),
      bodyWeight: latest('bodyWeight'),
    };
  }, [store]);

  return (
    <div className="min-h-screen p-4 max-w-7xl mx-auto">
      <h1 className="text-3xl font-bold mb-1">Progress</h1>
      <p className="text-gray-400 text-sm mb-6">Log the four numbers that matter.</p>
      <Nav />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-6 text-center">
        <div className="bg-gray-800 rounded p-3"><div className="text-xs text-gray-400">Ruck</div><div className="text-lg">{summary.ruckPace ?? '—'} <span className="text-xs text-gray-500">min/mi</span></div></div>
        <div className="bg-gray-800 rounded p-3"><div className="text-xs text-gray-400">2-Mile</div><div className="text-lg">{summary.runPace ?? '—'} <span className="text-xs text-gray-500">min</span></div></div>
        <div className="bg-gray-800 rounded p-3"><div className="text-xs text-gray-400">PT Test</div><div className="text-lg">{summary.ptScore ?? '—'}</div></div>
        <div className="bg-gray-800 rounded p-3"><div className="text-xs text-gray-400">Weight</div><div className="text-lg">{summary.bodyWeight ?? '—'} <span className="text-xs text-gray-500">lb</span></div></div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <MetricCard metric="ruckPace"   color="#f59e0b" store={store} setStore={setStore} />
        <MetricCard metric="runPace"    color="#3b82f6" store={store} setStore={setStore} />
        <MetricCard metric="ptScore"    color="#10b981" store={store} setStore={setStore} />
        <MetricCard metric="bodyWeight" color="#ef4444" store={store} setStore={setStore} />
      </div>
    </div>
  );
}
