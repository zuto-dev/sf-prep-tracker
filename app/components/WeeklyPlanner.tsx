'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { Food } from '../data/foods';
import {
  buildGroceryList,
  emptyPlan,
  forecastPlanMacros,
  setPlannedEntry,
  setPlanText,
  togglePlanSupplement,
  type MealSlot,
  type WeeklyPlan,
} from '../lib/planner';
import { loadPlan, savePlan } from '../lib/planner-client';

type MacroTotals = { kcal: number; p: number; c: number; f: number };
type PlannerDay = { dayName: string; isoDate: string; macros: MacroTotals };

const SLOTS: MealSlot[] = ['breakfast', 'lunch', 'dinner', 'snacks'];
const SUPPLEMENTS = ['Creatine', 'Whey', 'Vitamin D3', 'Electrolytes'];

function fmt(value: number) {
  return Math.round(value).toLocaleString();
}

export function WeeklyPlanner({
  days,
  foods,
  selectedDate,
  onSelectDate,
}: {
  days: PlannerDay[];
  foods: Food[];
  selectedDate: string;
  onSelectDate: (date: string) => void;
}) {
  const [plan, setPlan] = useState<WeeklyPlan>(emptyPlan());
  const [status, setStatus] = useState<'loading' | 'saved' | 'unsaved' | 'sync-failed'>('loading');
  const planRef = useRef<WeeklyPlan>(emptyPlan());
  const isLoadedRef = useRef(false);
  const saveQueueRef = useRef(Promise.resolve());
  const [drafts, setDrafts] = useState<Record<MealSlot, string>>({ breakfast: '', lunch: '', dinner: '', snacks: '' });
  const [selectedRecipes, setSelectedRecipes] = useState<Array<'carnitas' | 'korean-beef'>>(['carnitas', 'korean-beef']);

  useEffect(() => {
    const loaded = loadPlan();
    planRef.current = loaded;
    setPlan(loaded);
    isLoadedRef.current = true;
    setStatus('saved');
  }, []);

  const activeDay = days.find(day => day.isoDate === selectedDate) ?? days[0];
  const plannedDay = plan.days[activeDay?.isoDate] ?? null;
  const forecast = useMemo(
    () => activeDay ? forecastPlanMacros(plan, activeDay.isoDate, foods) : { totals: { kcal: 0, p: 0, c: 0, f: 0 }, unavailable: [] },
    [activeDay, foods, plan],
  );
  const grocery = useMemo(() => buildGroceryList(selectedRecipes), [selectedRecipes]);
  const meals = foods.filter(food => food.cat === 'meal');

  const persistSnapshot = (snapshot: WeeklyPlan) => {
    saveQueueRef.current = saveQueueRef.current.then(async () => {
      const synced = await savePlan(snapshot);
      setStatus(synced ? 'saved' : 'sync-failed');
    }).catch(() => setStatus('sync-failed'));
    return saveQueueRef.current;
  };

  const mutatePlan = (mutation: (current: WeeklyPlan) => WeeklyPlan, syncNow: boolean) => {
    if (!isLoadedRef.current) return;
    const next = mutation(planRef.current);
    planRef.current = next;
    setPlan(next);
    setStatus('unsaved');
    if (syncNow) void persistSnapshot(next);
  };

  const addMeal = (slot: MealSlot) => {
    const foodId = drafts[slot];
    if (!activeDay || !foodId) return;
    mutatePlan(current => setPlannedEntry(current, activeDay.isoDate, slot, { foodId, servings: 1 }), true);
    setDrafts(current => ({ ...current, [slot]: '' }));
  };

  const updateText = (field: 'training' | 'study' | 'note', value: string) => {
    if (!activeDay) return;
    mutatePlan(current => setPlanText(current, activeDay.isoDate, field, value), false);
  };

  const persistCurrentPlan = () => {
    if (!isLoadedRef.current) return;
    void persistSnapshot(planRef.current);
  };

  const toggleSupplement = (supplement: string) => {
    if (!activeDay) return;
    mutatePlan(current => togglePlanSupplement(current, activeDay.isoDate, supplement), true);
  };

  const toggleRecipe = (id: 'carnitas' | 'korean-beef') => {
    setSelectedRecipes(current => current.includes(id) ? current.filter(recipe => recipe !== id) : [...current, id]);
  };

  if (!activeDay) return null;

  return (
    <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="rounded-2xl border border-emerald-500/20 bg-gray-900/60 p-5 backdrop-blur-md">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-emerald-300">Planning mode</p>
            <h2 className="text-xl font-bold text-white">Plan the week before it happens</h2>
            <p className="mt-1 text-sm text-gray-400">Plans are separate from your actual meal and workout logs.</p>
          </div>
          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${status === 'saved' ? 'bg-emerald-500/15 text-emerald-300' : status === 'sync-failed' ? 'bg-amber-500/15 text-amber-200' : 'bg-blue-500/15 text-blue-200'}`}>
            {status === 'saved' ? 'Synced plan' : status === 'sync-failed' ? 'Saved locally — retry on next sync' : status === 'loading' ? 'Loading plan…' : 'Saving plan…'}
          </span>
        </div>

        <div className="mb-5 grid grid-cols-2 gap-2 md:grid-cols-7">
          {days.map(day => (
            <button
              key={day.isoDate}
              disabled={status === 'loading'}
              onClick={() => onSelectDate(day.isoDate)}
              className={`rounded-lg border p-2 text-left text-xs ${day.isoDate === activeDay.isoDate ? 'border-emerald-400 bg-emerald-500/15 text-white' : 'border-gray-700 bg-gray-950/40 text-gray-400 hover:border-gray-500'}`}
            >
              <span className="block font-bold">{day.dayName.slice(0, 3)}</span>
              <span className="font-mono">{day.isoDate.slice(-2)}</span>
            </button>
          ))}
        </div>

        <div className="mb-5 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-3">
            <p className="text-xs font-bold uppercase tracking-wide text-blue-300">Planned forecast</p>
            <p className="mt-1 font-mono text-sm text-white">{fmt(forecast.totals.kcal)} kcal · {fmt(forecast.totals.p)}g P · {fmt(forecast.totals.c)}g C · {fmt(forecast.totals.f)}g F</p>
          </div>
          <div className="rounded-xl border border-gray-700 bg-gray-950/40 p-3">
            <p className="text-xs font-bold uppercase tracking-wide text-gray-400">Actually logged</p>
            <p className="mt-1 font-mono text-sm text-white">{fmt(activeDay.macros.kcal)} kcal · {fmt(activeDay.macros.p)}g P · {fmt(activeDay.macros.c)}g C · {fmt(activeDay.macros.f)}g F</p>
          </div>
        </div>

        {forecast.unavailable.length > 0 && (
          <p className="mb-4 rounded-lg border border-amber-500/20 bg-amber-500/10 p-2 text-xs text-amber-100">
            Unavailable saved meal ID{forecast.unavailable.length > 1 ? 's' : ''}: {forecast.unavailable.join(', ')}. It stays in the plan but contributes zero macros until restored.
          </p>
        )}

        <div className="grid gap-3 md:grid-cols-2">
          {SLOTS.map(slot => {
            const entries = plannedDay?.meals[slot] ?? [];
            return (
              <div key={slot} className="rounded-xl border border-gray-700 bg-gray-950/40 p-3">
                <p className="mb-2 text-sm font-bold capitalize text-white">{slot}</p>
                <div className="flex gap-2">
                  <select
                    disabled={status === 'loading'}
                    value={drafts[slot]}
                    onChange={event => setDrafts(current => ({ ...current, [slot]: event.target.value }))}
                    className="min-w-0 flex-1 rounded border border-gray-700 bg-gray-900 px-2 py-1.5 text-xs text-gray-100"
                  >
                    <option value="">Choose a saved meal…</option>
                    {meals.map(food => <option key={food.id} value={food.id}>{food.name} · {food.kcal} kcal</option>)}
                  </select>
                  <button disabled={status === 'loading' || !drafts[slot]} onClick={() => addMeal(slot)} className="rounded bg-emerald-600 px-2 py-1 text-xs font-bold text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-gray-700">Add</button>
                </div>
                <ul className="mt-2 space-y-1">
                  {entries.length === 0 ? <li className="text-xs italic text-gray-500">Nothing planned yet.</li> : entries.map(entry => {
                    const food = foods.find(item => item.id === entry.foodId);
                    return <li key={entry.foodId} className="flex justify-between gap-2 text-xs text-gray-300"><span className="truncate">{food?.name ?? `Unavailable: ${entry.foodId}`}</span><span className="font-mono text-gray-500">×{entry.servings}</span></li>;
                  })}
                </ul>
              </div>
            );
          })}
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2">
          <label className="text-xs text-gray-400">Training block
            <input disabled={status === 'loading'} value={plannedDay?.training ?? ''} onChange={event => updateText('training', event.target.value)} onBlur={persistCurrentPlan} placeholder="e.g. Easy run · 6:00 AM" className="mt-1 w-full rounded border border-gray-700 bg-gray-900 px-2 py-2 text-sm text-gray-100 disabled:opacity-50" />
          </label>
          <label className="text-xs text-gray-400">ASVAB block
            <input disabled={status === 'loading'} value={plannedDay?.study ?? ''} onChange={event => updateText('study', event.target.value)} onBlur={persistCurrentPlan} placeholder="e.g. AR conversions · 20 min" className="mt-1 w-full rounded border border-gray-700 bg-gray-900 px-2 py-2 text-sm text-gray-100 disabled:opacity-50" />
          </label>
          <label className="text-xs text-gray-400 md:col-span-2">Day note
            <input disabled={status === 'loading'} value={plannedDay?.note ?? ''} onChange={event => updateText('note', event.target.value)} onBlur={persistCurrentPlan} placeholder="What would make this day easier to execute?" className="mt-1 w-full rounded border border-gray-700 bg-gray-900 px-2 py-2 text-sm text-gray-100 disabled:opacity-50" />
          </label>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {SUPPLEMENTS.map(supplement => {
            const active = plannedDay?.supplements.includes(supplement) ?? false;
            return <button disabled={status === 'loading'} key={supplement} onClick={() => toggleSupplement(supplement)} className={`rounded-full border px-3 py-1 text-xs disabled:opacity-50 ${active ? 'border-emerald-400 bg-emerald-500/15 text-emerald-200' : 'border-gray-700 bg-gray-950/40 text-gray-400'}`}>{active ? '✓ ' : ''}{supplement}</button>;
          })}
        </div>
      </div>

      <aside className="self-start rounded-2xl border border-orange-500/20 bg-gray-900/60 p-5 backdrop-blur-md">
        <p className="text-xs font-bold uppercase tracking-wider text-orange-300">Sunday prep</p>
        <h2 className="text-xl font-bold text-white">Real grocery list</h2>
        <p className="mt-1 text-sm text-gray-400">Plan D guide quantities only. No invented recipe math.</p>
        <div className="mt-4 space-y-2">
          {(['carnitas', 'korean-beef'] as const).map(id => {
            const recipe = buildGroceryList([id]).recipes[0];
            return <label key={id} className="flex cursor-pointer gap-2 rounded-lg border border-gray-700 bg-gray-950/40 p-2 text-sm text-gray-200"><input type="checkbox" checked={selectedRecipes.includes(id)} onChange={() => toggleRecipe(id)} /><span><b>{recipe.name}</b><span className="block text-xs text-gray-500">{recipe.yieldNote}</span></span></label>;
          })}
        </div>
        <ul className="mt-4 space-y-2">
          {grocery.items.length === 0 ? <li className="text-sm text-gray-500">Select a recipe to build the list.</li> : grocery.items.map(item => <li key={`${item.name}-${item.unit}`} className="border-b border-gray-800 pb-2 text-sm text-gray-200"><span className="font-semibold">{item.quantity === null ? '' : `${item.quantity} `}{item.unit} </span>{item.name}{item.note && <span className="block text-xs text-gray-500">{item.note}</span>}</li>)}
        </ul>
      </aside>
    </section>
  );
}
