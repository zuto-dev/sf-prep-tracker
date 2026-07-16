'use client';

import { useEffect, useMemo, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Nav } from '../components/Nav';
import { motion, AnimatePresence } from 'motion/react';
import { Compass, Activity, Award, Scale, Plus, Trash2, Target, Calendar, ChevronRight } from 'lucide-react';

type Metric = 'ruckPace' | 'runPace' | 'ptScore' | 'bodyWeight';

type Point = { date: string; value: number; note?: string };

const STORAGE_KEY = 'sfprep:metrics';

type MetricsStore = Record<Metric, Point[]>;

const empty: MetricsStore = { ruckPace: [], runPace: [], ptScore: [], bodyWeight: [] };

const METRIC_META: Record<Metric, {
  label: string;
  unit: string;
  hint: string;
  target: string;
  eliteTarget: string;
  icon: typeof Compass;
  accent: string;
  bgAccent: string;
}> = {
  ruckPace: {
    label: 'Ruck Pace',
    unit: 'min/mi',
    hint: 'Saturday heavy ruck. Average minutes per mile.',
    target: '< 15:00',
    eliteTarget: '< 12:00',
    icon: Compass,
    accent: '#f59e0b', // Amber
    bgAccent: 'rgba(245, 158, 11, 0.1)',
  },
  runPace: {
    label: '2-Mile Time',
    unit: 'min',
    hint: 'Time-trial minutes (e.g., 14.5 for 14:30).',
    target: '< 14:00',
    eliteTarget: '< 13:00',
    icon: Activity,
    accent: '#3b82f6', // Blue
    bgAccent: 'rgba(59, 130, 246, 0.1)',
  },
  ptScore: {
    label: 'PT Test Score',
    unit: 'pts',
    hint: 'Push-ups + sit-ups combined reps in 4 mins.',
    target: '> 140 reps',
    eliteTarget: '> 180 reps',
    icon: Award,
    accent: '#10b981', // Emerald
    bgAccent: 'rgba(16, 185, 129, 0.1)',
  },
  bodyWeight: {
    label: 'Body Weight',
    unit: 'lb',
    hint: 'Fasted weekly weight check.',
    target: '160 - 200',
    eliteTarget: 'Athletic',
    icon: Scale,
    accent: '#ef4444', // Red/Rose
    bgAccent: 'rgba(239, 68, 68, 0.1)',
  },
};

function load(): MetricsStore {
  if (typeof window === 'undefined') return empty;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return empty;
    const parsed = JSON.parse(raw) as Partial<MetricsStore>;
    return { ...empty, ...parsed };
  } catch {
    return empty;
  }
}

function save(store: MetricsStore) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: { value: number; payload: { note?: string } }[];
  label?: string;
  unit?: string;
}

// Custom Premium Tooltip
const CustomTooltip = ({ active, payload, label, unit }: CustomTooltipProps) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-gray-950/90 border border-gray-850 px-3.5 py-2.5 rounded-2xl shadow-xl backdrop-blur-md text-xs font-mono">
        <p className="text-gray-400 mb-1 flex items-center gap-1">
          <Calendar className="w-3 h-3 text-emerald-400" />
          <span>{label}</span>
        </p>
        <p className="font-bold text-white text-sm">
          Value: <span className="text-emerald-400">{payload[0].value}</span> {unit}
        </p>
        {payload[0].payload.note && (
          <p className="text-gray-500 mt-1 italic max-w-xs">
            Note: &quot;{payload[0].payload.note}&quot;
          </p>
        )}
      </div>
    );
  }
  return null;
};

function Chart({ data, color, unit }: { data: Point[]; color: string; unit: string }) {
  if (!data.length) {
    return (
      <div className="flex flex-col items-center justify-center py-12 border border-dashed border-gray-800 rounded-2xl bg-gray-950/20">
        <Target className="w-8 h-8 text-gray-700 mb-2 animate-pulse" />
        <p className="text-xs font-mono text-gray-500 uppercase tracking-widest">Awaiting performance data</p>
      </div>
    );
  }
  const sorted = [...data].sort((a, b) => a.date.localeCompare(b.date));
  return (
    <div className="w-full h-[240px] mt-2 select-none">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={sorted} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <CartesianGrid stroke="#1f2937" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="date"
            stroke="#4b5563"
            fontSize={10}
            fontFamily="monospace"
            tickLine={false}
            dy={8}
          />
          <YAxis
            stroke="#4b5563"
            fontSize={10}
            fontFamily="monospace"
            tickLine={false}
            domain={['auto', 'auto']}
          />
          <Tooltip content={<CustomTooltip unit={unit} />} cursor={{ stroke: '#374151', strokeWidth: 1 }} />
          <Line
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={3}
            dot={{ r: 4, fill: '#030712', strokeWidth: 2, stroke: color }}
            activeDot={{ r: 6, fill: color, stroke: '#030712', strokeWidth: 2 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function MetricCard({ metric, store, setStore }: {
  metric: Metric;
  store: MetricsStore;
  setStore: (s: MetricsStore) => void;
}) {
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [value, setValue] = useState('');
  const [note, setNote] = useState('');

  const meta = METRIC_META[metric];
  const data = store[metric];
  const IconComp = meta.icon;

  const add = () => {
    const v = parseFloat(value);
    if (!Number.isFinite(v)) return;
    const next: MetricsStore = {
      ...store,
      [metric]: [...store[metric], { date, value: v, note: note || undefined }],
    };
    setStore(next);
    save(next);
    setValue('');
    setNote('');
  };

  const remove = (p: Point) => {
    const arr = store[metric].filter(item => item !== p);
    const next = { ...store, [metric]: arr };
    setStore(next);
    save(next);
  };

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-3xl p-5 md:p-6 shadow-xl relative overflow-hidden flex flex-col justify-between">
      {/* Accent color blur background */}
      <div
        className="absolute -top-12 -right-12 w-28 h-28 rounded-full blur-3xl pointer-events-none"
        style={{ backgroundColor: meta.accent, opacity: 0.08 }}
      />

      <div>
        <div className="flex justify-between items-start gap-4 mb-4">
          <div className="flex items-center gap-3">
            <div
              className="p-2.5 rounded-xl border flex items-center justify-center shrink-0"
              style={{ color: meta.accent, borderColor: `${meta.accent}30`, backgroundColor: meta.bgAccent }}
            >
              <IconComp className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold font-display text-white text-base md:text-lg leading-none">{meta.label}</h3>
              <p className="text-[10px] font-mono text-gray-500 mt-1 uppercase tracking-wider">{meta.hint}</p>
            </div>
          </div>
          <span className="text-xs font-mono text-gray-500 px-2 py-0.5 bg-gray-950 border border-gray-850 rounded">
            {meta.unit}
          </span>
        </div>

        {/* Elite Standard Indicator */}
        <div className="grid grid-cols-2 gap-2 text-[10px] font-mono bg-gray-950 px-3 py-2 rounded-xl border border-gray-850/80 mb-4">
          <div>
            <span className="text-gray-500 block uppercase">Min Passing</span>
            <span className="text-gray-300 font-bold">{meta.target}</span>
          </div>
          <div className="border-l border-gray-850 pl-3">
            <span className="text-amber-500/80 block uppercase">Elite Candidate</span>
            <span className="text-amber-400 font-bold">{meta.eliteTarget}</span>
          </div>
        </div>

        {/* Recharts chart */}
        <Chart data={data} color={meta.accent} unit={meta.unit} />
      </div>

      <div className="mt-5 space-y-4 pt-4 border-t border-gray-850/80">
        {/* Metric Form Fields */}
        <div className="grid grid-cols-2 gap-2">
          <div className="col-span-2">
            <label className="text-[10px] font-mono text-gray-500 uppercase block mb-1">Date</label>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="w-full bg-gray-950 border border-gray-850 text-gray-100 px-3 py-1.5 rounded-xl text-xs font-mono focus:border-emerald-500/40 focus:outline-none transition-colors"
            />
          </div>
          <div>
            <label className="text-[10px] font-mono text-gray-500 uppercase block mb-1">Value ({meta.unit})</label>
            <input
              type="number"
              step="0.01"
              placeholder={meta.unit}
              value={value}
              onChange={e => setValue(e.target.value)}
              className="w-full bg-gray-950 border border-gray-850 text-gray-100 px-3 py-1.5 rounded-xl text-xs font-mono focus:border-emerald-500/40 focus:outline-none transition-colors"
            />
          </div>
          <div>
            <label className="text-[10px] font-mono text-gray-500 uppercase block mb-1">Assessment note</label>
            <input
              placeholder="e.g. wet track"
              value={note}
              onChange={e => setNote(e.target.value)}
              className="w-full bg-gray-950 border border-gray-850 text-gray-100 px-3 py-1.5 rounded-xl text-xs focus:border-emerald-500/40 focus:outline-none transition-colors"
            />
          </div>
        </div>

        <button
          onClick={add}
          className="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-mono font-bold transition-all hover:brightness-115 active:scale-98 cursor-pointer text-white shadow-md shadow-gray-950/20"
          style={{ backgroundColor: meta.accent }}
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add Log Entry</span>
        </button>

        {/* History Timelines */}
        {data.length > 0 && (
          <details className="group mt-2">
            <summary className="text-xs font-mono text-gray-400 group-open:text-white cursor-pointer select-none py-1 flex items-center justify-between">
              <span>View Data Feed ({data.length})</span>
              <ChevronRight className="w-3.5 h-3.5 transition-transform group-open:rotate-90 text-gray-500" />
            </summary>
            
            <ul className="mt-3 space-y-2 max-h-48 overflow-y-auto pr-1.5 scrollbar-thin">
              {[...data]
                .sort((a, b) => b.date.localeCompare(a.date))
                .map((p, i) => (
                  <li
                    key={i}
                    className="flex justify-between items-center bg-gray-950 border border-gray-850/80 p-2.5 rounded-xl text-xs font-mono"
                  >
                    <div className="min-w-0 pr-2">
                      <div className="flex items-center gap-2">
                        <span className="text-gray-400 font-bold">{p.date}</span>
                        <span className="text-gray-500">|</span>
                        <span className="text-white font-bold">{p.value}</span>
                        <span className="text-gray-400 text-[10px]">{meta.unit}</span>
                      </div>
                      {p.note && (
                        <p className="text-[10px] text-gray-500 italic mt-0.5 truncate">
                          &quot;{p.note}&quot;
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => remove(p)}
                      className="text-gray-500 hover:text-red-400 p-1.5 rounded-lg hover:bg-gray-900 transition-colors cursor-pointer shrink-0"
                      title="Delete Record"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </li>
                ))}
            </ul>
          </details>
        )}
      </div>
    </div>
  );
}

export default function ProgressPage() {
  const [store, setStore] = useState<MetricsStore>(empty);
  useEffect(() => {
    setStore(load());
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

  const cardsInfo = [
    { label: 'Ruck', val: summary.ruckPace, unit: 'min/mi', color: 'text-amber-400', icon: Compass, bg: 'bg-amber-500/5 border-amber-500/10' },
    { label: '2-Mile', val: summary.runPace, unit: 'min', color: 'text-blue-400', icon: Activity, bg: 'bg-blue-500/5 border-blue-500/10' },
    { label: 'PT Test', val: summary.ptScore, unit: 'pts', color: 'text-emerald-400', icon: Award, bg: 'bg-emerald-500/5 border-emerald-500/10' },
    { label: 'Weight', val: summary.bodyWeight, unit: 'lb', color: 'text-red-400', icon: Scale, bg: 'bg-red-500/5 border-red-500/10' },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className="space-y-6"
    >
      <Nav />

      {/* Hero Header */}
      <div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-5">
        <span className="font-mono text-xs text-gray-500 tracking-widest uppercase">PERFORMANCE TRACKING</span>
        <h2 className="text-xl md:text-2xl font-bold font-display mt-0.5 text-white">
          Tactical Recon & Metrics Logs
        </h2>
        <p className="text-gray-400 text-sm mt-1">
          Review physical benchmarks against Special Forces selection targets.
        </p>
      </div>

      {/* Bento Stats Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {cardsInfo.map((card, idx) => {
          const IconComponent = card.icon;
          return (
            <div
              key={idx}
              className={`border p-4 rounded-2xl flex flex-col justify-between h-28 relative overflow-hidden bg-gray-900/40 border-gray-850/80 shadow-md`}
            >
              <div className="flex justify-between items-start">
                <span className="font-mono text-xs text-gray-500 uppercase tracking-wider">{card.label}</span>
                <IconComponent className={`w-4 h-4 ${card.color} opacity-60`} />
              </div>
              <div className="mt-2 flex items-baseline gap-1">
                <span className={`text-2xl md:text-3xl font-extrabold font-mono tracking-tight text-white`}>
                  {card.val ?? '—'}
                </span>
                {card.val && <span className="text-xs font-mono text-gray-500">{card.unit}</span>}
              </div>
            </div>
          );
        })}
      </div>

      {/* Interactive Charts Panel */}
      <div className="grid gap-6 md:grid-cols-2">
        <MetricCard metric="ruckPace" store={store} setStore={setStore} />
        <MetricCard metric="runPace" store={store} setStore={setStore} />
        <MetricCard metric="ptScore" store={store} setStore={setStore} />
        <MetricCard metric="bodyWeight" store={store} setStore={setStore} />
      </div>
    </motion.div>
  );
}

