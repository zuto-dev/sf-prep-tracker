'use client';

import { useEffect, useMemo, useState } from 'react';
import { Nav } from '../components/Nav';
import { FOODS, searchFoods, type Food } from '../data/foods';

type Meal = 'breakfast' | 'lunch' | 'dinner' | 'snacks';
type Entry = { foodId: string; servings: number };
type DayLog = Record<Meal, Entry[]>;
type NutritionStore = {
  days: Record<string, DayLog>;   // key = YYYY-MM-DD
  targets: { kcal: number; p: number; c: number; f: number };
  preset: 'foundation' | 'peak' | 'custom';
};

const KEY = 'sfprep:nutrition';
const emptyDay = (): DayLog => ({ breakfast: [], lunch: [], dinner: [], snacks: [] });
const PRESETS = {
  foundation: { kcal: 2800, p: 180, c: 320, f: 80 },
  peak:       { kcal: 2400, p: 200, c: 240, f: 75 },
};
const defaultStore: NutritionStore = { days: {}, targets: PRESETS.foundation, preset: 'foundation' };

function load(): NutritionStore {
  if (typeof window === 'undefined') return defaultStore;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultStore;
    const parsed = JSON.parse(raw) as NutritionStore;
    return { ...defaultStore, ...parsed, days: parsed.days ?? {}, targets: parsed.targets ?? PRESETS.foundation };
  } catch { return defaultStore; }
}
function save(s: NutritionStore) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(KEY, JSON.stringify(s));
}

const foodById = new Map(FOODS.map(f => [f.id, f]));

function totals(entries: Entry[]) {
  return entries.reduce((acc, e) => {
    const f = foodById.get(e.foodId);
    if (!f) return acc;
    acc.kcal += f.kcal * e.servings;
    acc.p += f.p * e.servings;
    acc.c += f.c * e.servings;
    acc.f += f.f * e.servings;
    return acc;
  }, { kcal: 0, p: 0, c: 0, f: 0 });
}
function dayTotals(d: DayLog) {
  const t = totals([...d.breakfast, ...d.lunch, ...d.dinner, ...d.snacks]);
  return t;
}
function fmt(n: number) { return Math.round(n).toLocaleString(); }
function iso(d: Date) { return d.toISOString().slice(0,10); }

function FoodSearch({ onPick }: { onPick: (f: Food) => void }) {
  const [q, setQ] = useState('');
  const results = useMemo(() => searchFoods(q, 15), [q]);
  return (
    <div className="relative">
      <input value={q} onChange={e => setQ(e.target.value)}
        placeholder="Search foods (chicken, oats, banana...)"
        className="w-full bg-gray-900 border border-gray-700 px-3 py-2 rounded text-sm" />
      {q && results.length > 0 && (
        <ul className="absolute z-10 left-0 right-0 mt-1 max-h-64 overflow-y-auto bg-gray-900 border border-gray-700 rounded shadow-lg">
          {results.map(f => (
            <li key={f.id}>
              <button onClick={() => { onPick(f); setQ(''); }}
                className="w-full text-left px-3 py-2 hover:bg-gray-800 text-sm flex justify-between">
                <span>{f.name} <span className="text-xs text-gray-500">· {f.serving}</span></span>
                <span className="text-xs text-gray-400">{f.kcal} kcal · {f.p}g P</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function MealBlock({ meal, entries, onAdd, onRemove, onChangeServing }: {
  meal: Meal; entries: Entry[];
  onAdd: (f: Food) => void;
  onRemove: (i: number) => void;
  onChangeServing: (i: number, s: number) => void;
}) {
  const t = totals(entries);
  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <div className="flex justify-between items-baseline mb-2">
        <h3 className="font-semibold capitalize">{meal}</h3>
        <span className="text-xs text-gray-400">{fmt(t.kcal)} kcal · {fmt(t.p)}g P · {fmt(t.c)}g C · {fmt(t.f)}g F</span>
      </div>
      <FoodSearch onPick={onAdd} />
      {entries.length > 0 && (
        <ul className="mt-3 space-y-1">
          {entries.map((e, i) => {
            const f = foodById.get(e.foodId);
            if (!f) return null;
            return (
              <li key={i} className="flex items-center gap-2 text-sm bg-gray-900 rounded px-2 py-1">
                <span className="flex-1">{f.name} <span className="text-xs text-gray-500">({f.serving})</span></span>
                <input type="number" step="0.25" min="0" value={e.servings}
                  onChange={ev => onChangeServing(i, parseFloat(ev.target.value) || 0)}
                  className="w-16 bg-gray-800 border border-gray-700 rounded px-1 py-0.5 text-xs" />
                <span className="text-xs text-gray-400 w-24 text-right">
                  {fmt(f.kcal * e.servings)} kcal · {fmt(f.p * e.servings)}g P
                </span>
                <button onClick={() => onRemove(i)} className="text-red-400 hover:text-red-300 text-xs">×</button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function Bar({ label, val, target, unit }: { label: string; val: number; target: number; unit: string }) {
  const pct = target > 0 ? Math.min(100, (val / target) * 100) : 0;
  const color = pct > 110 ? 'bg-red-500' : pct >= 90 ? 'bg-emerald-500' : 'bg-blue-500';
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-gray-400">{label}</span>
        <span>{fmt(val)} / {fmt(target)} {unit}</span>
      </div>
      <div className="w-full bg-gray-700 rounded-full h-2">
        <div className={`${color} h-2 rounded-full transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function NutritionPage() {
  const [store, setStore] = useState<NutritionStore>(defaultStore);
  const [date, setDate] = useState(iso(new Date()));
  const [view, setView] = useState<'today' | 'week'>('today');
  useEffect(() => { setStore(load()); }, []);

  const day = store.days[date] ?? emptyDay();
  const set = (nextDay: DayLog) => {
    const next: NutritionStore = { ...store, days: { ...store.days, [date]: nextDay } };
    setStore(next); save(next);
  };
  const addTo = (meal: Meal) => (f: Food) => set({ ...day, [meal]: [...day[meal], { foodId: f.id, servings: 1 }] });
  const removeFrom = (meal: Meal) => (i: number) => {
    const arr = [...day[meal]]; arr.splice(i, 1);
    set({ ...day, [meal]: arr });
  };
  const setServing = (meal: Meal) => (i: number, s: number) => {
    const arr = [...day[meal]]; arr[i] = { ...arr[i], servings: s };
    set({ ...day, [meal]: arr });
  };

  const setPreset = (preset: 'foundation' | 'peak' | 'custom') => {
    const targets = preset === 'custom' ? store.targets : PRESETS[preset];
    const next = { ...store, preset, targets };
    setStore(next); save(next);
  };
  const setTarget = (k: 'kcal' | 'p' | 'c' | 'f', v: number) => {
    const next = { ...store, preset: 'custom' as const, targets: { ...store.targets, [k]: v } };
    setStore(next); save(next);
  };

  const t = dayTotals(day);

  // Week summary — 7 days ending on current date
  const weekDays = useMemo(() => {
    const arr: { date: string; totals: ReturnType<typeof dayTotals> }[] = [];
    const base = new Date(date);
    for (let i = 6; i >= 0; i--) {
      const d = new Date(base); d.setDate(base.getDate() - i);
      const k = iso(d);
      const day = store.days[k] ?? emptyDay();
      arr.push({ date: k, totals: dayTotals(day) });
    }
    return arr;
  }, [store, date]);
  const weekAvg = useMemo(() => {
    const sum = weekDays.reduce((a, d) => ({
      kcal: a.kcal + d.totals.kcal, p: a.p + d.totals.p, c: a.c + d.totals.c, f: a.f + d.totals.f,
    }), { kcal: 0, p: 0, c: 0, f: 0 });
    return { kcal: sum.kcal / 7, p: sum.p / 7, c: sum.c / 7, f: sum.f / 7 };
  }, [weekDays]);

  return (
    <div className="min-h-screen p-4 max-w-7xl mx-auto">
      <h1 className="text-3xl font-bold mb-1">Nutrition</h1>
      <p className="text-gray-400 text-sm mb-6">Meal log · macro targets · weekly rollup</p>
      <Nav />

      {/* Presets + targets */}
      <div className="bg-gray-800 rounded-lg p-4 mb-4">
        <div className="flex flex-wrap gap-2 items-center mb-3">
          <span className="text-xs text-gray-400">Preset:</span>
          {(['foundation','peak','custom'] as const).map(k => (
            <button key={k} onClick={() => setPreset(k)}
              className={`px-3 py-1 rounded text-xs ${store.preset === k ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}>
              {k === 'foundation' ? 'Foundation (recomp 2800/180P)' : k === 'peak' ? 'Peak (cut 2400/200P)' : 'Custom'}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-4 gap-2">
          {(['kcal','p','c','f'] as const).map(k => (
            <label key={k} className="text-xs text-gray-400">
              {k === 'kcal' ? 'kcal' : k === 'p' ? 'Protein (g)' : k === 'c' ? 'Carbs (g)' : 'Fat (g)'}
              <input type="number" value={store.targets[k]} onChange={e => setTarget(k, parseInt(e.target.value) || 0)}
                className="w-full bg-gray-900 border border-gray-700 px-2 py-1 rounded text-sm mt-1 text-gray-100" />
            </label>
          ))}
        </div>
      </div>

      <div className="flex gap-2 mb-4">
        <button onClick={() => setView('today')}
          className={`px-3 py-1 rounded text-sm ${view === 'today' ? 'bg-blue-600' : 'bg-gray-800 hover:bg-gray-700'}`}>Today</button>
        <button onClick={() => setView('week')}
          className={`px-3 py-1 rounded text-sm ${view === 'week' ? 'bg-blue-600' : 'bg-gray-800 hover:bg-gray-700'}`}>Week Summary</button>
        <input type="date" value={date} onChange={e => setDate(e.target.value)}
          className="ml-auto bg-gray-900 border border-gray-700 px-2 py-1 rounded text-sm" />
      </div>

      {view === 'today' ? (
        <>
          <div className="bg-gray-800 rounded-lg p-4 mb-4 space-y-3">
            <div className="flex justify-between items-baseline">
              <h2 className="font-semibold">Daily Totals</h2>
              <span className="text-xs text-gray-400">{date}</span>
            </div>
            <Bar label="Calories" val={t.kcal}  target={store.targets.kcal} unit="kcal" />
            <Bar label="Protein"  val={t.p}     target={store.targets.p}    unit="g" />
            <Bar label="Carbs"    val={t.c}     target={store.targets.c}    unit="g" />
            <Bar label="Fat"      val={t.f}     target={store.targets.f}    unit="g" />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {(['breakfast','lunch','dinner','snacks'] as Meal[]).map(m => (
              <MealBlock key={m} meal={m} entries={day[m]}
                onAdd={addTo(m)} onRemove={removeFrom(m)} onChangeServing={setServing(m)} />
            ))}
          </div>
        </>
      ) : (
        <div className="bg-gray-800 rounded-lg p-4">
          <h2 className="font-semibold mb-3">7-Day Rollup (ending {date})</h2>
          <div className="grid grid-cols-4 gap-3 mb-4 text-center">
            <div className="bg-gray-900 rounded p-2"><div className="text-xs text-gray-400">Avg kcal</div><div className="text-lg">{fmt(weekAvg.kcal)}</div></div>
            <div className="bg-gray-900 rounded p-2"><div className="text-xs text-gray-400">Avg P</div><div className="text-lg">{fmt(weekAvg.p)}g</div></div>
            <div className="bg-gray-900 rounded p-2"><div className="text-xs text-gray-400">Avg C</div><div className="text-lg">{fmt(weekAvg.c)}g</div></div>
            <div className="bg-gray-900 rounded p-2"><div className="text-xs text-gray-400">Avg F</div><div className="text-lg">{fmt(weekAvg.f)}g</div></div>
          </div>
          <table className="w-full text-sm">
            <thead className="text-xs text-gray-400 border-b border-gray-700">
              <tr><th className="text-left py-2">Date</th><th className="text-right">kcal</th><th className="text-right">P</th><th className="text-right">C</th><th className="text-right">F</th><th className="text-right">vs kcal target</th></tr>
            </thead>
            <tbody>
              {weekDays.map(d => {
                const dot = d.totals.kcal / store.targets.kcal;
                return (
                  <tr key={d.date} className="border-b border-gray-700">
                    <td className="py-1">{d.date}</td>
                    <td className="text-right">{fmt(d.totals.kcal)}</td>
                    <td className="text-right">{fmt(d.totals.p)}</td>
                    <td className="text-right">{fmt(d.totals.c)}</td>
                    <td className="text-right">{fmt(d.totals.f)}</td>
                    <td className="text-right">
                      <span className={dot > 1.1 ? 'text-red-400' : dot >= 0.9 ? 'text-emerald-400' : 'text-gray-500'}>
                        {(dot * 100).toFixed(0)}%
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
