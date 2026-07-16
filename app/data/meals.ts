'use client';

// User-saved composite meals (recipes) stored in sfprep:meals.
// They masquerade as Food objects so the existing MealBlock/log UI works unchanged.

import { useEffect, useState } from 'react';
import type { Food } from './foods';

const KEY = 'sfprep:meals';

export type UserMeal = Food & {
  cat: 'meal';
  source?: 'manual' | 'coach' | 'recipe-image' | 'scan';
  createdAt?: string;
};

function loadRaw(): UserMeal[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
}
function save(meals: UserMeal[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(KEY, JSON.stringify(meals));
}

function slug(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
}

export function addMeal(m: Omit<UserMeal, 'id' | 'cat' | 'createdAt'>): UserMeal {
  const meals = loadRaw();
  const id = `meal:${slug(m.name)}:${Date.now().toString(36)}`;
  const entry: UserMeal = {
    ...m,
    id,
    cat: 'meal',
    createdAt: new Date().toISOString(),
  };
  meals.push(entry);
  save(meals);
  window.dispatchEvent(new Event('sfprep-meals-changed'));
  return entry;
}
export function removeMeal(id: string) {
  save(loadRaw().filter(m => m.id !== id));
  window.dispatchEvent(new Event('sfprep-meals-changed'));
}
export function updateMeal(id: string, patch: Partial<UserMeal>) {
  save(loadRaw().map(m => m.id === id ? { ...m, ...patch } : m));
  window.dispatchEvent(new Event('sfprep-meals-changed'));
}

/**
 * React hook — re-renders on any change (local edits OR sync pulls).
 * Wire this at the top of the nutrition page so foodById includes user meals.
 */
export function useMeals(): UserMeal[] {
  const [meals, setMeals] = useState<UserMeal[]>([]);
  useEffect(() => {
    const refresh = () => setMeals(loadRaw());
    refresh();
    window.addEventListener('sfprep-meals-changed', refresh);
    window.addEventListener('sfprep-sync', refresh);   // pulled from server
    window.addEventListener('storage', refresh);        // other tab
    return () => {
      window.removeEventListener('sfprep-meals-changed', refresh);
      window.removeEventListener('sfprep-sync', refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);
  return meals;
}

export function searchMeals(meals: UserMeal[], q: string, limit = 10): UserMeal[] {
  const s = q.trim().toLowerCase();
  if (!s) return meals.slice(0, limit);
  return meals
    .filter(m => m.name.toLowerCase().includes(s))
    .slice(0, limit);
}
