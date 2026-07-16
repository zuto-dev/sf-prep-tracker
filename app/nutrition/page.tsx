'use client';

import { useEffect, useMemo, useState } from 'react';
import { Nav } from '../components/Nav';
import { motion, AnimatePresence } from 'motion/react';
import { FOODS, searchFoods, type Food } from '../data/foods';
import { SupsLog } from '../components/SupsLog';
import { useMeals, addMeal, removeMeal, searchMeals, type UserMeal } from '../data/meals';
import { pullSfprepSync, pushSfprepSync } from '../lib/sfprep-sync';
import { FOUNDATION_TARGETS, PEAK_TARGETS, normalizeNutritionStore } from '../lib/nutrition-execution';
import {
  scoreMealRecommendation,
  classifyWindow,
  windowLabel,
  windowGuidance,
  type TrainingType,
  type SuggestionContext,
} from '../lib/nutrient-timing';

type Meal = 'breakfast' | 'lunch' | 'dinner' | 'snacks';
type Entry = { foodId: string; servings: number };
type DayLog = Record<Meal, Entry[]>;
type NutritionStore = {
  days: Record<string, DayLog>;   // key = YYYY-MM-DD
  targets: { kcal: number; p: number; c: number; f: number };
  preset: 'foundation' | 'peak' | 'custom';
};

type Suggestion = {
  title: string;
  note: string;
  items: Entry[];
  accent: string;
};

type CoachMessage = { role: 'user' | 'assistant'; text: string; image?: string };

const KEY = 'sfprep:nutrition';
const emptyDay = (): DayLog => ({ breakfast: [], lunch: [], dinner: [], snacks: [] });
const PRESETS = {
  foundation: FOUNDATION_TARGETS,
  peak: PEAK_TARGETS,
};
const defaultStore: NutritionStore = { days: {}, targets: PRESETS.foundation, preset: 'foundation' };

function load(): NutritionStore {
  if (typeof window === 'undefined') return defaultStore;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultStore;
    const parsed = JSON.parse(raw) as NutritionStore;
    return normalizeNutritionStore({ ...defaultStore, ...parsed, days: parsed.days ?? {}, targets: parsed.targets ?? PRESETS.foundation });
  } catch { return defaultStore; }
}
function save(s: NutritionStore) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(KEY, JSON.stringify(s));
  void pushSfprepSync();
}

const foodById = new Map<string, Food>(FOODS.map(f => [f.id, f]));
// Registers user meals so foodById.get() works for meal IDs anywhere in this module.
function registerMeals(meals: UserMeal[]) {
  // Clear only user-meal IDs (leave base FOODS intact)
  for (const key of Array.from(foodById.keys())) {
    if (key.startsWith('meal:')) foodById.delete(key);
  }
  for (const m of meals) foodById.set(m.id, m);
}

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

function macroLine(t: { kcal: number; p: number; c: number; f: number }) {
  return `${fmt(t.kcal)} kcal · ${fmt(t.p)}g P · ${fmt(t.c)}g C · ${fmt(t.f)}g F`;
}

function planTotals(items: Entry[]) {
  return totals(items);
}

function pickSuggestion(
  kind: 'protein' | 'carb' | 'fat' | 'balanced',
  gap: { kcal: number; p: number; c: number; f: number },
  seed: number = 0,
  context?: SuggestionContext,
): Suggestion {
  const pools = {
    protein: [
      { title: 'Lean protein top-up', note: 'Fastest way to close a protein gap without adding much fat.', items: [{ foodId: 'whey-scoop', servings: 1 }] },
      { title: 'Real-food protein', note: 'Better if you want something more filling than a shake.', items: [{ foodId: 'rotisserie', servings: 1 }] },
      { title: 'Protein snack', note: 'Easy if you still need protein but want a softer landing.', items: [{ foodId: 'greek-yogurt', servings: 1 }, { foodId: 'berries-mixed', servings: 1 }] },
      { title: 'Protein + carbs', note: 'Best after training when both protein and carbs are short.', items: [{ foodId: 'whey-1_5', servings: 1 }] },
    ],
    carb: [
      { title: 'Carb reload', note: 'Good when calories and carbs are both low.', items: [{ foodId: 'jasmine-pouch', servings: 1 }] },
      { title: 'Simple carb bump', note: 'Easy calories if you need a smaller refill.', items: [{ foodId: 'banana', servings: 2 }] },
      { title: 'Breakfast carb fix', note: 'A clean way to bring carbs up without a ton of prep.', items: [{ foodId: 'oats-dry', servings: 1 }, { foodId: 'honey', servings: 1 }] },
      { title: 'Carbs + protein', note: 'Useful when you want the meal to also help recovery.', items: [{ foodId: 'bagel', servings: 1 }, { foodId: 'whey-scoop', servings: 1 }] },
    ],
    fat: [
      { title: 'Fat bump', note: 'Use when you still need a little fat but not a full meal.', items: [{ foodId: 'avocado', servings: 1 }] },
      { title: 'Dense calories', note: 'Best if fats are the last macro standing.', items: [{ foodId: 'peanut-butter', servings: 1 }] },
      { title: 'Clean fat + protein', note: 'A better finish than random snack food.', items: [{ foodId: 'salmon', servings: 1 }] },
      { title: 'Small fat add-on', note: 'A subtle way to bring fat up without changing the whole meal.', items: [{ foodId: 'olive-oil', servings: 1 }] },
    ],
    balanced: [
      { title: 'Full breakfast-style refill', note: 'Best when all the macros are behind.', items: [{ foodId: 'plan-d-breakfast', servings: 1 }] },
      { title: 'Post-workout bowl', note: 'Strong default when protein and carbs both need help.', items: [{ foodId: 'salsa-chicken', servings: 1 }] },
      { title: 'Easy dinner reset', note: 'A balanced meal when you want the simplest path back on target.', items: [{ foodId: 'fried-rice', servings: 1 }] },
      { title: 'Heavier dinner', note: 'Use when you need more calories and don\'t mind a denser plate.', items: [{ foodId: 'beef-chili', servings: 1 }] },
    ],
  };

  const list = pools[kind];
  const weightedScore = (item: { title: string; note: string; items: Entry[] }) => {
    const t = planTotals(item.items);
    // Context-aware scoring (SECTION 4.3): when we know the time-of-day and
    // training schedule, let the Gaussian nutrient-timing curve steer ranking
    // instead of the old fixed multipliers.
    if (context) return scoreMealRecommendation(t, context);
    if (kind === 'protein') return t.p * 5 - t.f * 1.5 - t.c * 0.5 - t.kcal * 0.01;
    if (kind === 'carb') return t.c * 4 - t.p * 0.5 - t.f * 0.4 - t.kcal * 0.01;
    if (kind === 'fat') return t.f * 4 - t.p * 0.25 - t.c * 0.2 - t.kcal * 0.01;
    const remainingScore = Math.abs(gap.p - t.p) + Math.abs(gap.c - t.c) + Math.abs(gap.f - t.f) + Math.abs(gap.kcal - t.kcal) / 75;
    return 100 - remainingScore;
  };

  const sorted = [...list].sort((a, b) => weightedScore(b) - weightedScore(a));
  // Rotate through the top candidates so Refresh gives new options
  const best = sorted[seed % sorted.length];
  const totalsText = macroLine(planTotals(best.items));
  const gapText = kind === 'protein'
    ? `${Math.max(0, Math.round(gap.p))}g short on protein`
    : kind === 'carb'
      ? `${Math.max(0, Math.round(gap.c))}g short on carbs`
      : kind === 'fat'
        ? `${Math.max(0, Math.round(gap.f))}g short on fat`
        : `aiming at the full gap`

  return {
    title: best.title,
    note: `${best.note} · ${totalsText}${gapText ? ` · ${gapText}` : ''}`,
    items: best.items,
    accent: kind === 'protein' ? 'text-emerald-300' : kind === 'carb' ? 'text-sky-300' : kind === 'fat' ? 'text-amber-300' : 'text-violet-300',
  };
}

function coachReply(
  prompt: string,
  t: { kcal: number; p: number; c: number; f: number },
  remaining: { kcal: number; p: number; c: number; f: number },
  targets: { kcal: number; p: number; c: number; f: number },
) {
  const p = prompt.toLowerCase();
  const gapLine = `You're at ${macroLine(t)} and still have ${fmt(Math.max(0, remaining.kcal))} kcal · ${fmt(Math.max(0, remaining.p))}g P · ${fmt(Math.max(0, remaining.c))}g C · ${fmt(Math.max(0, remaining.f))}g F left.`;
  if (/(pre|before).*(workout|training)|before workout|pre-workout/.test(p)) {
    return [
      'Pre-workout: keep it light on fat/fiber and lean on carbs + a little protein.',
      '60-90 min out: 25-40g carbs + 10-20g protein. If you are tight on time, do a shake + banana.',
      `If your workout is hard or long, bias carbs first. ${gapLine}`,
    ].join(' ');
  }
  if (/(post|after).*(workout|training)|post-workout|after workout/.test(p)) {
    return [
      'Post-workout: get protein in soon, then add carbs if you trained hard.',
      'Target 30-40g protein + 30-60g carbs inside the next 1-2 hours. Keep fats lower if you want the meal to digest fast.',
      `Best move is the easiest meal you will actually eat. ${gapLine}`,
    ].join(' ');
  }
  if (/plan|meal plan|schedule|timing|how many meals|split/.test(p)) {
    return [
      'Meal plan: split the day into 3 anchor meals and 1 smaller recovery slot.',
      `Use roughly 30% / 30% / 30% / 10% of your remaining macros, then shift carbs toward the workout and protein to the meal after it.`,
      `For your current day, that means ${fmt(Math.max(0, remaining.p / 3))}g protein-ish chunks and ${fmt(Math.max(0, remaining.c / 3))}g carb chunks per big meal.`,
    ].join(' ');
  }
  if (/morning|breakfast/.test(p)) {
    return [
      'Breakfast answer: protein first, then carbs if you train later.',
      'If workout is within ~2 hours, keep breakfast low fat and let carbs do the work.',
      gapLine,
    ].join(' ');
  }
  return [
    'Short answer: tell me whether this is pre-workout, post-workout, or a full-day meal plan and I will tighten it up.',
    'Default rule: protein every meal, carbs around training, fats farther away from the session.',
    gapLine,
  ].join(' ');
}

function buildSuggestions(
  t: { kcal: number; p: number; c: number; f: number },
  target: { kcal: number; p: number; c: number; f: number },
  seed: number = 0,
  context?: SuggestionContext,
) {
  const gap = {
    kcal: target.kcal - t.kcal,
    p: target.p - t.p,
    c: target.c - t.c,
    f: target.f - t.f,
  };
  const ranked = [
    { kind: 'protein' as const, score: gap.p },
    { kind: 'carb' as const, score: gap.c },
    { kind: 'fat' as const, score: gap.f },
    { kind: 'balanced' as const, score: Math.max(gap.kcal, 0) + Math.max(gap.p, 0) + Math.max(gap.c, 0) + Math.max(gap.f, 0) },
  ];
  const order = ranked
    .sort((a, b) => b.score - a.score)
    .map(item => item.kind);

  const seen = new Set<string>();
  return order
    .map((kind, i) => pickSuggestion(kind, gap, seed + i, context))
    .filter(s => {
      if (seen.has(s.title)) return false;
      seen.add(s.title);
      return true;
    })
    .slice(0, 3);
}

function MealsLibrary({ meals, builtIn = [] }: { meals: UserMeal[]; builtIn?: Food[] }) {
  const [form, setForm] = useState({ name: '', serving: '1 serving', kcal: '', p: '', c: '', f: '' });
  const canSave = form.name.trim() && form.kcal && form.p;

  const save = () => {
    if (!canSave) return;
    addMeal({
      name: form.name.trim(),
      serving: form.serving.trim() || '1 serving',
      servingG: 0,
      kcal: parseFloat(form.kcal) || 0,
      p: parseFloat(form.p) || 0,
      c: parseFloat(form.c) || 0,
      f: parseFloat(form.f) || 0,
      source: 'manual',
    });
    setForm({ name: '', serving: '1 serving', kcal: '', p: '', c: '', f: '' });
  };

  return (
    <div className="space-y-4">
      <div className="bg-gray-800 rounded-lg p-4">
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="font-semibold">Add a meal</h2>
          <span className="text-xs text-gray-500">Save recipes so you can log them by name later</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <input placeholder="Name (e.g. High Protein Chicken Pasta)"
            value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            className="bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm md:col-span-2" />
          <input placeholder="Serving label (e.g. 1 bowl, 376g)"
            value={form.serving} onChange={e => setForm(f => ({ ...f, serving: e.target.value }))}
            className="bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm md:col-span-2" />
          <input placeholder="kcal" type="number" inputMode="decimal"
            value={form.kcal} onChange={e => setForm(f => ({ ...f, kcal: e.target.value }))}
            className="bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm" />
          <input placeholder="Protein (g)" type="number" inputMode="decimal"
            value={form.p} onChange={e => setForm(f => ({ ...f, p: e.target.value }))}
            className="bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm" />
          <input placeholder="Carbs (g)" type="number" inputMode="decimal"
            value={form.c} onChange={e => setForm(f => ({ ...f, c: e.target.value }))}
            className="bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm" />
          <input placeholder="Fat (g)" type="number" inputMode="decimal"
            value={form.f} onChange={e => setForm(f => ({ ...f, f: e.target.value }))}
            className="bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm" />
        </div>
        <div className="mt-3">
          <button onClick={save} disabled={!canSave}
            className="px-3 py-2 rounded bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-700 disabled:text-gray-500 text-sm text-white">
            Save to library
          </button>
          <span className="text-xs text-gray-500 ml-3">Tip: use the Coach — paste a recipe screenshot and say &quot;save this as a meal&quot;.</span>
        </div>
      </div>

      <div className="bg-gray-800 rounded-lg p-4">
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="font-semibold">Built-in meals ({builtIn.length})</h2>
          <span className="text-xs text-gray-500">Preloaded recipes — searchable in every meal slot</span>
        </div>
        {builtIn.length === 0 ? (
          <div className="text-sm text-gray-500 py-4 text-center">None yet.</div>
        ) : (
          <ul className="divide-y divide-gray-700">
            {builtIn.map(m => (
              <li key={m.id} className="py-3">
                <div className="font-medium text-gray-100"><span className="text-blue-400 mr-1.5">■</span>{m.name}</div>
                <div className="text-xs text-gray-500 mt-0.5">
                  {m.serving} · {Math.round(m.kcal)} kcal · {Math.round(m.p)}g P · {Math.round(m.c)}g C · {Math.round(m.f)}g F
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="bg-gray-800 rounded-lg p-4">
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="font-semibold">Your meals ({meals.length})</h2>
          {meals.length > 0 && <span className="text-xs text-gray-500">Search-ready in every meal slot</span>}
        </div>
        {meals.length === 0 ? (
          <div className="text-sm text-gray-500 py-4 text-center">
            No saved meals yet. Add one above, or ask the Coach to save one from a screenshot.
          </div>
        ) : (
          <ul className="divide-y divide-gray-700">
            {[...meals].reverse().map(m => (
              <li key={m.id} className="py-3 flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-gray-100 truncate">
                    <span className="text-emerald-400 mr-1.5">◆</span>{m.name}
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {m.serving} · {Math.round(m.kcal)} kcal · {Math.round(m.p)}g P · {Math.round(m.c)}g C · {Math.round(m.f)}g F
                    {m.source && <span className="ml-2 text-[10px] text-gray-600">via {m.source}</span>}
                  </div>
                </div>
                <button onClick={() => { if (confirm(`Remove "${m.name}"?`)) removeMeal(m.id); }}
                  className="text-xs text-gray-500 hover:text-red-400 px-2">Remove</button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function FoodSearch({ onPick, extraFoods = [] }: { onPick: (f: Food) => void; extraFoods?: Food[] }) {
  const [q, setQ] = useState('');
  const results = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return searchFoods(q, 15);
    const meals = extraFoods.filter(f => f.name.toLowerCase().includes(s));
    const foods = searchFoods(q, 15);
    // Meals first — they're your saved recipes and more likely what you want
    return [...meals, ...foods].slice(0, 20);
  }, [q, extraFoods]);
  return (
    <div className="relative">
      <input value={q} onChange={e => setQ(e.target.value)}
        placeholder="Search foods or your saved meals..."
        className="w-full bg-gray-900 border border-gray-700 px-3 py-2 rounded text-sm" />
      {q && results.length > 0 && (
        <ul className="absolute z-10 left-0 right-0 mt-1 max-h-64 overflow-y-auto bg-gray-900 border border-gray-700 rounded shadow-lg">
          {results.map(f => (
            <li key={f.id}>
              <button onClick={() => { onPick(f); setQ(''); }}
                className="w-full text-left px-3 py-2 hover:bg-gray-800 text-sm flex justify-between items-center gap-2">
                <span className="min-w-0 flex-1 truncate">
                  {f.cat === 'meal' && <span className="text-[10px] text-emerald-400 mr-1.5">◆</span>}
                  {f.name} <span className="text-xs text-gray-500">· {f.serving}</span>
                </span>
                <span className="text-xs text-gray-400 flex-shrink-0">{f.kcal} kcal · {f.p}g P</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function MealBlock({ meal, entries, onAdd, onRemove, onChangeServing, extraFoods }: {
  meal: Meal; entries: Entry[];
  onAdd: (f: Food) => void;
  onRemove: (i: number) => void;
  onChangeServing: (i: number, s: number) => void;
  extraFoods?: Food[];
}) {
  const t = totals(entries);
  const saveAsMeal = () => {
    if (entries.length < 2) {
      alert('Add at least 2 items first — then save the combo as a meal.');
      return;
    }
    const name = prompt(`Name this meal (e.g. "Chicken pasta dinner"):`);
    if (!name || !name.trim()) return;
    addMeal({
      name: name.trim(),
      serving: '1 serving',
      servingG: 0,
      kcal: t.kcal,
      p: t.p,
      c: t.c,
      f: t.f,
      source: 'manual',
    });
  };
  return (
    <div className="bg-gray-950/40 border border-gray-850 rounded-2xl p-5 space-y-4">
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-sm font-bold text-white font-mono uppercase tracking-wider">{meal}</h3>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400 font-mono">{fmt(t.kcal)} kcal · {fmt(t.p)}g P · {fmt(t.c)}g C · {fmt(t.f)}g F</span>
          {entries.length >= 2 && (
            <button onClick={saveAsMeal} title="Save this combo as a reusable meal"
              className="text-[10px] text-emerald-400 hover:text-emerald-300 border border-emerald-500/20 bg-emerald-500/5 rounded px-2 py-0.5 transition">
              + Save Combo
            </button>
          )}
        </div>
      </div>
      <FoodSearch onPick={onAdd} extraFoods={extraFoods} />
      {entries.length > 0 && (
        <ul className="mt-3 space-y-2">
          {entries.map((e, i) => {
            const f = foodById.get(e.foodId);
            if (!f) return null;
            return (
              <li key={i} className="flex items-center gap-2 text-sm bg-gray-900 border border-gray-850 rounded-xl px-3 py-2">
                <span className="flex-1 text-gray-200">{f.name} <span className="text-xs text-gray-500">({f.serving})</span></span>
                <input type="number" step="0.25" min="0" value={e.servings}
                  onChange={ev => onChangeServing(i, parseFloat(ev.target.value) || 0)}
                  className="w-16 bg-gray-950 border border-gray-855 rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:border-blue-500 font-mono" />
                <span className="text-xs text-gray-400 w-24 text-right font-mono">
                  {fmt(f.kcal * e.servings)} kcal · {fmt(f.p * e.servings)}g P
                </span>
                <button onClick={() => onRemove(i)} className="text-red-400 hover:text-red-300 text-sm font-bold w-6 h-6 flex items-center justify-center rounded-lg hover:bg-red-500/10 transition">×</button>
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
  const [view, setView] = useState<'today' | 'week' | 'meals' | 'tools'>('today');
  const [nextMealSlot, setNextMealSlot] = useState<Meal>('lunch');
  const [activeMealSlot, setActiveMealSlot] = useState<Meal>('lunch');
  useEffect(() => {
    void pullSfprepSync().finally(() => setStore(load()));
  }, []);

  const meals = useMeals();
  useEffect(() => { registerMeals(meals); }, [meals]);

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
  const addSuggestionToLog = (items: Entry[]) => {
    set({ ...day, [nextMealSlot]: [...day[nextMealSlot], ...items] });
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
  const [refreshSeed, setRefreshSeed] = useState(0);
  const [trainingType, setTrainingType] = useState<TrainingType>('rest');
  const [trainingTimeStr, setTrainingTimeStr] = useState('16:00');
  const nutrientContext: SuggestionContext = useMemo(() => {
    const now = new Date();
    let trainingTime: Date | null = null;
    if (trainingType !== 'rest' && trainingTimeStr) {
      const [hh, mm] = trainingTimeStr.split(':').map(n => parseInt(n, 10));
      if (Number.isFinite(hh) && Number.isFinite(mm)) {
        trainingTime = new Date(now);
        trainingTime.setHours(hh, mm, 0, 0);
      }
    }
    return {
      currentTime: now,
      trainingTime,
      trainingType,
      macroGaps: {
        kcal: store.targets.kcal - t.kcal,
        p: store.targets.p - t.p,
        c: store.targets.c - t.c,
        f: store.targets.f - t.f,
      },
    };
  }, [trainingType, trainingTimeStr, t, store.targets]);
  const activeWindow = useMemo(() => classifyWindow(nutrientContext), [nutrientContext]);
  const [coachMessages, setCoachMessages] = useState<CoachMessage[]>([
    { role: 'assistant', text: 'Ask me about meal timing, macros, or how to plan around today\'s workout.' },
  ]);
  const [coachDraft, setCoachDraft] = useState('');
  const [coachImage, setCoachImage] = useState<string | null>(null);
  const [coachBusy, setCoachBusy] = useState(false);
  const suggestions = useMemo(() => buildSuggestions(t, store.targets, refreshSeed, nutrientContext).slice(0, 3), [t, store.targets, refreshSeed, nutrientContext]);
  const remaining = {
    kcal: store.targets.kcal - t.kcal,
    p: store.targets.p - t.p,
    c: store.targets.c - t.c,
    f: store.targets.f - t.f,
  };

  const sendCoach = async () => {
    const prompt = coachDraft.trim();
    if ((!prompt && !coachImage) || coachBusy) return;
    const userMsg: CoachMessage = {
      role: 'user',
      text: prompt || (coachImage ? '(image)' : ''),
      image: coachImage || undefined,
    };
    const nextMsgs: CoachMessage[] = [...coachMessages, userMsg];
    setCoachMessages(nextMsgs);
    setCoachDraft('');
    setCoachImage(null);
    setCoachBusy(true);
    try {
      const dayOfWeek = new Date(date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long' });
      const context = {
        dayTotals: t,
        remaining,
        targets: store.targets,
        date,
        dayOfWeek,
        loggedFoods: [...day.breakfast, ...day.lunch, ...day.dinner, ...day.snacks]
          .map(e => foodById.get(e.foodId)?.name)
          .filter(Boolean),
      };
      // Build OpenAI messages: if the last user message has an image, send multipart content
      const apiMsgs = nextMsgs.map(m => {
        if (m.role === 'user' && m.image) {
          return {
            role: 'user',
            content: [
              { type: 'text', text: m.text || 'Analyze this.' },
              { type: 'image_url', image_url: { url: m.image } },
            ],
          };
        }
        return { role: m.role, content: m.text };
      });
      const r = await fetch('/api/coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: apiMsgs, context }),
      });
      const data = await r.json();
      const rawReply = data.error ? `⚠️ ${data.error}` : (data.reply || '(no reply)');

      // Auto-save meals if the coach emitted a save_meal JSON block
      let displayReply = rawReply;
      const jsonMatch = rawReply.match(/\{\s*"save_meal"\s*:\s*\{[^}]+\}\s*\}/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0]);
          const m = parsed.save_meal;
          if (m && m.name && m.kcal != null && m.p != null) {
            addMeal({
              name: String(m.name),
              serving: String(m.serving || '1 serving'),
              servingG: 0,
              kcal: Number(m.kcal) || 0,
              p: Number(m.p) || 0,
              c: Number(m.c) || 0,
              f: Number(m.f) || 0,
              source: 'coach',
            });
            displayReply = rawReply.replace(/```json[\s\S]*?```/g, '').replace(jsonMatch[0], '').trim()
              + `\n\n✅ Saved to meal library: **${m.name}** — search for it in any meal slot.`;
          }
        } catch { /* silent — leave raw reply */ }
      }
      setCoachMessages(prev => [...prev, { role: 'assistant', text: displayReply }]);
    } catch (e) {
      setCoachMessages(prev => [...prev, { role: 'assistant', text: `⚠️ ${String(e)}` }]);
    } finally {
      setCoachBusy(false);
    }
  };

  // Downscale image before sending to keep the payload manageable
  const attachImage = async (file: File) => {
    const buf = await file.arrayBuffer();
    const blob = new Blob([buf], { type: file.type });
    const url = URL.createObjectURL(blob);
    const img = new window.Image();
    img.src = url;
    await new Promise(res => { img.onload = res; });
    const maxDim = 1024;
    const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
    const canvas = document.createElement('canvas');
    canvas.width = img.width * scale;
    canvas.height = img.height * scale;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    URL.revokeObjectURL(url);
    setCoachImage(dataUrl);
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (it.kind === 'file' && it.type.startsWith('image/')) {
        const file = it.getAsFile();
        if (file) {
          e.preventDefault();
          attachImage(file);
          return;
        }
      }
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) attachImage(f);
    e.target.value = '';
  };

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
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className="space-y-6"
    >
      <Nav />

      {/* Main Stats Banner */}
      <div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="font-mono text-xs text-gray-500 tracking-widest uppercase">NUTRITION PORTAL</span>
          <h2 className="text-xl md:text-2xl font-bold font-display mt-0.5 text-white">
            Plan-D Macro Engine
          </h2>
          <p className="text-gray-400 text-sm mt-1">
            Macro-targeted fuel timing · adaptive meal planner · compliance assistant.
          </p>
        </div>
        <div className="text-left sm:text-right shrink-0">
          <span className="text-[10px] font-mono text-gray-500 block uppercase tracking-wider">DAILY CALORIES</span>
          <span className="text-xs bg-emerald-500/10 text-emerald-400 font-semibold px-2.5 py-0.5 rounded-full inline-flex items-center gap-1.5 mt-1 border border-emerald-500/25 font-mono">
            <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
            {fmt(t.kcal)} / {fmt(store.targets.kcal)} Kcal
          </span>
        </div>
      </div>

      {/* Presets + targets */}
      <div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-5 shadow-xl space-y-4">
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-xs font-mono text-gray-400 mr-2">Preset Protocol:</span>
          {(['foundation','peak','custom'] as const).map(k => (
            <button
              key={k}
              onClick={() => setPreset(k)}
              className={`px-4 py-2 rounded-xl text-xs font-bold font-mono border transition-all duration-300 ${
                store.preset === k
                  ? 'bg-blue-600/80 border-blue-400/50 text-white shadow-lg shadow-blue-500/20 scale-105'
                  : 'bg-gray-800/40 border-gray-700/50 text-gray-300 hover:border-blue-500/40 hover:bg-gray-800/70'
              }`}
            >
              {k === 'foundation' ? 'Foundation (2400 kcal / 180P)' : k === 'peak' ? 'Peak (2200 kcal / 200P)' : 'Custom'}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {(['kcal','p','c','f'] as const).map(k => (
            <div key={k}>
              <label className="text-xs font-mono text-gray-400 block mb-1">
                {k === 'kcal' ? 'Target Calories (kcal)' : k === 'p' ? 'Protein (g)' : k === 'c' ? 'Carbs (g)' : 'Fat (g)'}
              </label>
              <input
                type="number"
                value={store.targets[k]}
                onChange={e => setTarget(k, parseInt(e.target.value) || 0)}
                className="w-full bg-gray-950 border border-gray-850 hover:border-gray-750 focus:border-blue-500 focus:outline-none rounded-xl px-3 py-2 text-sm text-white"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Sub-Navigation Tabs */}
      <div className="flex flex-wrap items-center gap-2">
        {(['today', 'week', 'meals', 'tools'] as const).map(k => (
          <button
            key={k}
            onClick={() => setView(k)}
            className={`px-4 py-2 rounded-xl text-sm font-medium font-mono border transition-all duration-200 ${
              view === k
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.05)]'
                : 'bg-gray-900/40 border-gray-800/50 text-gray-400 hover:text-white hover:bg-gray-900'
            }`}
          >
            {k === 'today' ? 'Today' : k === 'week' ? 'Week Summary' : k === 'meals' ? `Meals (${meals.length})` : 'Tools'}
          </button>
        ))}
        <input
          type="date"
          value={date}
          onChange={e => setDate(e.target.value)}
          className="ml-auto bg-gray-950 border border-gray-850 rounded-xl px-3 py-2 text-sm font-mono text-white focus:outline-none focus:border-blue-500"
        />
      </div>

      {view === 'today' ? (
        <div className="space-y-6">
          <section className="mb-5 rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-950/50 via-gray-900 to-gray-900 p-5 shadow-xl">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-300">Daily execution · {date}</p>
                <h2 className="mt-1 text-2xl font-black text-white">What do you need to eat next?</h2>
                <p className="mt-1 text-sm text-gray-300">You have <span className="font-bold text-white">{fmt(Math.max(0, remaining.kcal))} kcal</span> and <span className="font-bold text-white">{fmt(Math.max(0, remaining.p))}g protein</span> left for today.</p>
              </div>
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-right">
                <div className="text-xs uppercase tracking-wide text-emerald-300">Target</div>
                <div className="font-mono text-sm font-bold text-white">{fmt(store.targets.kcal)} kcal · {fmt(store.targets.p)}P</div>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-gray-300">Training:</span>
              {(['rest','run','ruck','strength'] as TrainingType[]).map(tt => (
                <button key={tt} onClick={() => setTrainingType(tt)} className={`rounded-full px-3 py-1 text-xs font-bold capitalize ${trainingType === tt ? 'bg-emerald-500 text-gray-950' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'}`}>{tt}</button>
              ))}
              {trainingType !== 'rest' && <input type="time" value={trainingTimeStr} onChange={e => setTrainingTimeStr(e.target.value)} className="rounded bg-gray-800 px-2 py-1 text-xs text-gray-100" />}
              <select value={nextMealSlot} onChange={e => setNextMealSlot(e.target.value as Meal)} className="ml-auto rounded bg-gray-800 px-2 py-1 text-xs text-gray-100">
                {(['breakfast','lunch','dinner','snacks'] as Meal[]).map(slot => <option key={slot} value={slot}>Log next move to {slot}</option>)}
              </select>
            </div>
          </section>
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div>
            <div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-5 mb-4 space-y-3 shadow-xl">
              <div className="flex justify-between items-baseline">
                <h2 className="font-semibold text-white font-mono uppercase tracking-wider text-sm">Daily Totals</h2>
                <span className="text-xs text-gray-500 font-mono">{date}</span>
              </div>
              <Bar label="Calories" val={t.kcal}  target={store.targets.kcal} unit="kcal" />
              <Bar label="Protein"  val={t.p}     target={store.targets.p}    unit="g" />
              <Bar label="Carbs"    val={t.c}     target={store.targets.c}    unit="g" />
              <Bar label="Fat"      val={t.f}     target={store.targets.f}    unit="g" />
            </div>
            <div className="rounded-2xl border border-gray-800 bg-gray-900/40 p-4">
              <div className="mb-3 grid grid-cols-4 gap-2">
                {(['breakfast','lunch','dinner','snacks'] as Meal[]).map(slot => (
                  <button key={slot} onClick={() => setActiveMealSlot(slot)} className={`rounded-xl px-2 py-2.5 text-xs font-bold font-mono capitalize border transition-all duration-200 ${activeMealSlot === slot ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-gray-900/60 border-gray-800 text-gray-400 hover:text-white'}`}>
                    {slot}
                  </button>
                ))}
              </div>
              <MealBlock meal={activeMealSlot} entries={day[activeMealSlot]}
                extraFoods={meals}
                onAdd={addTo(activeMealSlot)} onRemove={removeFrom(activeMealSlot)} onChangeServing={setServing(activeMealSlot)} />
            </div>
          </div>

          <aside className="space-y-4 lg:sticky lg:top-4 self-start">
            <div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-5 space-y-4 shadow-xl">
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <h2 className="font-bold font-display text-white text-sm">Suggestions to hit goals</h2>
                <button onClick={() => setRefreshSeed(s => s + 1)}
                  title="Show different options"
                  className="text-[11px] px-2.5 py-1.5 rounded-xl border border-gray-750 bg-gray-800 hover:bg-gray-750 text-gray-200 flex items-center gap-1 transition font-mono">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3 h-3 text-emerald-400">
                    <path d="M21 12a9 9 0 1 1-3-6.7L21 8" />
                    <path d="M21 3v5h-5" />
                  </svg>
                  Refresh
                </button>
              </div>
              <div className="mb-2 rounded-xl bg-gray-950/40 border border-gray-850 px-3 py-2.5">
                <div className="text-[10px] font-bold font-mono text-emerald-400 uppercase tracking-wider">{windowLabel(activeWindow)}</div>
                <div className="text-[11px] text-gray-400 mt-1 leading-relaxed">{windowGuidance(activeWindow)}</div>
              </div>
              <p className="text-[11px] text-gray-400 font-mono">
                Remaining: {fmt(Math.max(0, remaining.kcal))} kcal · {fmt(Math.max(0, remaining.p))}g P · {fmt(Math.max(0, remaining.c))}g C · {fmt(Math.max(0, remaining.f))}g F
              </p>
              <div className="space-y-1.5">
                {suggestions.map(s => {
                  const plan = planTotals(s.items);
                  return (
                    <div key={s.title} className="rounded-xl bg-gray-950/40 border border-gray-850 px-3 py-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-xs font-semibold text-gray-200 truncate">{s.title}</div>
                        <div className={`text-[10px] font-mono font-bold flex-shrink-0 ${s.accent}`}>{Math.round(plan.kcal)}k · {Math.round(plan.p)}P</div>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {s.items.map(item => {
                          const food = foodById.get(item.foodId);
                          return food ? (
                            <span key={`${s.title}-${item.foodId}`} className="text-[10px] px-2 py-0.5 rounded bg-gray-900 border border-gray-800 text-gray-300">
                              {food.name}{item.servings !== 1 ? ` ×${item.servings}` : ''}
                            </span>
                          ) : null;
                        })}
                      </div>
                      <button onClick={() => addSuggestionToLog(s.items)} className="mt-2.5 w-full rounded-xl bg-emerald-600 hover:bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white transition">
                        Add to {nextMealSlot}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            <details className="bg-gray-900/60 border border-gray-800 rounded-2xl p-5 group shadow-xl">
              <summary className="flex cursor-pointer items-center justify-between gap-2 text-sm font-semibold text-gray-200">
                <span>Need help with this meal?</span>
                <span className="text-[11px] font-normal text-gray-500">Coach · recipe scan · timing</span>
              </summary>
              <div className="mt-3 flex items-center justify-between gap-2">
              <div className="max-h-52 overflow-y-auto space-y-2 mb-2 pr-1">
                {coachMessages.map((msg, i) => (
                  <div
                    key={i}
                    className={`rounded-md px-2.5 py-2 text-[11px] leading-snug whitespace-pre-wrap border ${
                      msg.role === 'user'
                        ? 'ml-8 bg-blue-900/30 border-blue-800 text-blue-100'
                        : 'mr-4 bg-gray-900/70 border-gray-700 text-gray-200'
                    }`}
                  >
                    {msg.image && (
                      <img src={msg.image} alt="pasted"
                        className="max-w-full max-h-40 rounded border border-gray-700 mb-1" />
                    )}
                    {msg.text}
                  </div>
                ))}
                {coachBusy && (
                  <div className="mr-4 rounded-md px-2.5 py-2 text-[11px] bg-gray-900/70 border border-gray-700 text-gray-500">
                    <span className="animate-pulse">thinking…</span>
                  </div>
                )}
              </div>

              {coachImage && (
                <div className="mb-2 flex items-center gap-2 bg-gray-900 border border-gray-700 rounded p-1.5">
                  <img src={coachImage} alt="attachment"
                    className="h-12 w-12 object-cover rounded border border-gray-700" />
                  <div className="text-[11px] text-gray-400 flex-1">Image attached — will send with next message</div>
                  <button onClick={() => setCoachImage(null)}
                    className="text-gray-500 hover:text-gray-300 text-xs px-1">×</button>
                </div>
              )}

              <textarea
                rows={3}
                value={coachDraft}
                onChange={e => setCoachDraft(e.target.value)}
                onPaste={handlePaste}
                disabled={coachBusy}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendCoach();
                  }
                }}
                placeholder="Ask, or paste an image (recipe / label / meal)…"
                className="w-full bg-gray-900 border border-gray-700 px-2.5 py-2 rounded text-[11px] text-gray-100 resize-none disabled:opacity-50"
              />
              <div className="mt-2 flex gap-2 items-center">
                <label className="px-2 py-1 rounded bg-gray-700 hover:bg-gray-600 text-[11px] text-gray-200 cursor-pointer" title="Attach image">
                  📎
                  <input type="file" accept="image/*" className="hidden" onChange={handleFileInput} />
                </label>
                <button
                  onClick={sendCoach}
                  disabled={coachBusy || (!coachDraft.trim() && !coachImage)}
                  className="px-2.5 py-1 rounded bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:text-gray-500 text-[11px] text-white"
                >
                  Ask
                </button>
                <button
                  onClick={() => { setCoachMessages([{ role: 'assistant', text: 'Ask me about meal timing, macros, or how to plan around today\'s workout.' }]); setCoachDraft(''); setCoachImage(null); }}
                  className="px-2.5 py-1 rounded bg-gray-700 hover:bg-gray-600 text-[11px] text-gray-200 ml-auto"
                >
                  Clear
                </button>
              </div>
              </div>
            </details>
          </aside>

        </div>
        </div>
      ) : view === 'meals' ? (
        <MealsLibrary meals={meals} builtIn={FOODS.filter(f => f.cat === 'meal')} />
      ) : view === 'tools' ? (
        <SupsLog />
      ) : (
        <div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-5 space-y-4">
          <h2 className="text-lg font-bold text-white font-display">7-Day Rollup (ending {date})</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4 text-center">
            <div className="bg-gray-950/40 border border-gray-850 rounded-xl p-3"><div className="text-xs text-gray-400 font-mono">Avg kcal</div><div className="text-lg font-bold font-mono text-white mt-1">{fmt(weekAvg.kcal)}</div></div>
            <div className="bg-gray-950/40 border border-gray-850 rounded-xl p-3"><div className="text-xs text-gray-400 font-mono">Avg P</div><div className="text-lg font-bold font-mono text-white mt-1">{fmt(weekAvg.p)}g</div></div>
            <div className="bg-gray-950/40 border border-gray-850 rounded-xl p-3"><div className="text-xs text-gray-400 font-mono">Avg C</div><div className="text-lg font-bold font-mono text-white mt-1">{fmt(weekAvg.c)}g</div></div>
            <div className="bg-gray-950/40 border border-gray-850 rounded-xl p-3"><div className="text-xs text-gray-400 font-mono">Avg F</div><div className="text-lg font-bold font-mono text-white mt-1">{fmt(weekAvg.f)}g</div></div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-gray-400 border-b border-gray-800">
                <tr><th className="text-left py-2 font-mono uppercase">Date</th><th className="text-right font-mono uppercase">kcal</th><th className="text-right font-mono uppercase">P</th><th className="text-right font-mono uppercase">C</th><th className="text-right font-mono uppercase">F</th><th className="text-right font-mono uppercase">vs kcal target</th></tr>
              </thead>
              <tbody>
                {weekDays.map(d => {
                  const dot = d.totals.kcal / store.targets.kcal;
                  return (
                    <tr key={d.date} className="border-b border-gray-850 hover:bg-gray-900/30 transition-colors">
                      <td className="py-2.5 font-mono text-xs">{d.date}</td>
                      <td className="text-right font-mono">{fmt(d.totals.kcal)}</td>
                      <td className="text-right font-mono">{fmt(d.totals.p)}g</td>
                      <td className="text-right font-mono">{fmt(d.totals.c)}g</td>
                      <td className="text-right font-mono">{fmt(d.totals.f)}g</td>
                      <td className="text-right font-mono">
                        <span className={dot > 1.1 ? 'text-red-400 font-bold' : dot >= 0.9 ? 'text-emerald-400 font-bold' : 'text-gray-500'}>
                          {(dot * 100).toFixed(0)}%
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </motion.div>
  );
}