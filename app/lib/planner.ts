export const PLAN_KEY = 'sfprep:plan' as const;
export const PLAN_VERSION = 1 as const;

export type MealSlot = 'breakfast' | 'lunch' | 'dinner' | 'snacks';
export type PlannedEntry = { foodId: string; servings: number };
export type PlannedDay = {
  meals: Record<MealSlot, PlannedEntry[]>;
  training?: string;
  study?: string;
  supplements: string[];
  note?: string;
};
export type WeeklyPlan = { version: typeof PLAN_VERSION; days: Record<string, PlannedDay> };
export type MacroFood = { id: string; name: string; kcal: number; p: number; c: number; f: number };
export type MacroTotals = { kcal: number; p: number; c: number; f: number };

const SLOTS: MealSlot[] = ['breakfast', 'lunch', 'dinner', 'snacks'];
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export type GroceryCategory = 'protein' | 'carb' | 'veg' | 'flavor' | 'fat';
export type GroceryItem = {
  category: GroceryCategory;
  name: string;
  quantity: number | null;
  unit: string;
  note?: string;
};
export type SundayPrepRecipe = {
  id: 'carnitas' | 'korean-beef';
  name: string;
  yieldNote: string;
  ingredients: GroceryItem[];
};

const asNeeded = (category: GroceryCategory, name: string): GroceryItem => ({
  category,
  name,
  quantity: null,
  unit: 'as needed',
  note: 'Plan D guide does not specify an amount',
});

// Source: Gbrain-personal/internal/references/fitness/plan-d-meal-plan.md §Sunday Cook.
// Quantities absent from that guide deliberately remain "as needed" rather than guessed.
export const SUNDAY_PREP_RECIPES: SundayPrepRecipe[] = [
  {
    id: 'carnitas',
    name: 'Pork Carnitas',
    yieldNote: 'Lunch batch for Monday–Friday',
    ingredients: [
      { category: 'protein', name: 'Pork shoulder', quantity: 3, unit: 'lb' },
      { category: 'flavor', name: 'Limes', quantity: 2, unit: 'whole', note: 'or substitute 1/2 cup orange juice' },
      asNeeded('flavor', 'Cumin'),
      asNeeded('flavor', 'Chili powder'),
      asNeeded('flavor', 'Garlic'),
      asNeeded('flavor', 'Salt'),
      { category: 'carb', name: 'Jasmine rice', quantity: 5, unit: 'cups' },
      { category: 'flavor', name: 'Salsa', quantity: null, unit: 'as needed' },
      { category: 'fat', name: 'Avocados', quantity: 3, unit: 'whole', note: 'weekly guide quantity' },
    ],
  },
  {
    id: 'korean-beef',
    name: 'Korean Gochujang Beef',
    yieldNote: 'Dinner batch; eat until it runs out',
    ingredients: [
      { category: 'protein', name: '93/7 ground beef or turkey', quantity: 1.5, unit: 'lb' },
      { category: 'flavor', name: 'Gochujang', quantity: 2, unit: 'tbsp' },
      { category: 'flavor', name: 'Soy sauce', quantity: 2, unit: 'tbsp' },
      { category: 'flavor', name: 'Honey', quantity: 1, unit: 'tbsp' },
      { category: 'flavor', name: 'Sesame oil', quantity: 1, unit: 'tsp' },
      asNeeded('flavor', 'Garlic'),
      asNeeded('flavor', 'Ginger'),
      { category: 'veg', name: 'Spinach or broccoli', quantity: null, unit: 'as needed', note: 'guide specifies spinach/broccoli without an amount' },
    ],
  },
];

export function emptyDay(): PlannedDay {
  return { meals: { breakfast: [], lunch: [], dinner: [], snacks: [] }, supplements: [] };
}

export function emptyPlan(): WeeklyPlan {
  return { version: PLAN_VERSION, days: {} };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validEntry(value: unknown): value is PlannedEntry {
  return isRecord(value)
    && typeof value.foodId === 'string'
    && value.foodId.length > 0
    && typeof value.servings === 'number'
    && Number.isFinite(value.servings)
    && value.servings > 0;
}

function parseDay(value: unknown): PlannedDay | null {
  if (!isRecord(value) || !isRecord(value.meals) || !Array.isArray(value.supplements)) return null;
  const meals = {} as Record<MealSlot, PlannedEntry[]>;
  for (const slot of SLOTS) {
    const entries = value.meals[slot];
    if (!Array.isArray(entries) || !entries.every(validEntry)) return null;
    meals[slot] = entries.map(entry => ({ ...entry }));
  }
  const supplements = value.supplements.filter((item): item is string => typeof item === 'string');
  if (supplements.length !== value.supplements.length) return null;
  const text = (key: 'training' | 'study' | 'note') => value[key] === undefined || typeof value[key] === 'string' ? value[key] as string | undefined : null;
  const training = text('training');
  const study = text('study');
  const note = text('note');
  if (training === null || study === null || note === null) return null;
  return { meals, supplements, ...(training ? { training } : {}), ...(study ? { study } : {}), ...(note ? { note } : {}) };
}

export function parsePlan(raw: string | null | undefined): WeeklyPlan {
  if (!raw) return emptyPlan();
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed) || parsed.version !== PLAN_VERSION || !isRecord(parsed.days)) return emptyPlan();
    const days: Record<string, PlannedDay> = {};
    for (const [date, day] of Object.entries(parsed.days)) {
      // Preserve every valid day instead of letting one corrupt synced record
      // discard the rest of the user's week.
      if (!ISO_DATE.test(date)) continue;
      const normalized = parseDay(day);
      if (normalized) days[date] = normalized;
    }
    return { version: PLAN_VERSION, days };
  } catch {
    return emptyPlan();
  }
}

export function setPlannedEntry(plan: WeeklyPlan, date: string, slot: MealSlot, entry: PlannedEntry): WeeklyPlan {
  if (!ISO_DATE.test(date) || !validEntry(entry)) return plan;
  const day = plan.days[date] ?? emptyDay();
  const existing = day.meals[slot];
  const index = existing.findIndex(item => item.foodId === entry.foodId);
  const nextEntries = index === -1
    ? [...existing, { ...entry }]
    : existing.map((item, itemIndex) => itemIndex === index ? { ...entry } : item);
  return {
    ...plan,
    days: {
      ...plan.days,
      [date]: { ...day, meals: { ...day.meals, [slot]: nextEntries } },
    },
  };
}

export function setPlanText(plan: WeeklyPlan, date: string, field: 'training' | 'study' | 'note', value: string): WeeklyPlan {
  if (!ISO_DATE.test(date)) return plan;
  const day = plan.days[date] ?? emptyDay();
  return { ...plan, days: { ...plan.days, [date]: { ...day, [field]: value || undefined } } };
}

export function togglePlanSupplement(plan: WeeklyPlan, date: string, supplement: string): WeeklyPlan {
  if (!ISO_DATE.test(date) || !supplement.trim()) return plan;
  const day = plan.days[date] ?? emptyDay();
  const supplements = day.supplements.includes(supplement)
    ? day.supplements.filter(item => item !== supplement)
    : [...day.supplements, supplement];
  return { ...plan, days: { ...plan.days, [date]: { ...day, supplements } } };
}

export function forecastPlanMacros(plan: WeeklyPlan, date: string, foods: MacroFood[]): { totals: MacroTotals; unavailable: string[] } {
  const day = plan.days[date] ?? emptyDay();
  const byId = new Map(foods.map(food => [food.id, food]));
  const totals: MacroTotals = { kcal: 0, p: 0, c: 0, f: 0 };
  const unavailable: string[] = [];
  for (const slot of SLOTS) {
    for (const entry of day.meals[slot]) {
      const food = byId.get(entry.foodId);
      if (!food) {
        if (!unavailable.includes(entry.foodId)) unavailable.push(entry.foodId);
        continue;
      }
      totals.kcal += food.kcal * entry.servings;
      totals.p += food.p * entry.servings;
      totals.c += food.c * entry.servings;
      totals.f += food.f * entry.servings;
    }
  }
  return { totals, unavailable };
}

export function buildGroceryList(recipeIds: SundayPrepRecipe['id'][]): { recipes: SundayPrepRecipe[]; items: GroceryItem[] } {
  const recipes = SUNDAY_PREP_RECIPES.filter(recipe => recipeIds.includes(recipe.id));
  const consolidated = new Map<string, GroceryItem>();
  for (const recipe of recipes) {
    for (const ingredient of recipe.ingredients) {
      const key = `${ingredient.name.toLowerCase()}|${ingredient.unit.toLowerCase()}`;
      const existing = consolidated.get(key);
      if (!existing) {
        consolidated.set(key, { ...ingredient });
      } else if (existing.quantity !== null && ingredient.quantity !== null) {
        existing.quantity += ingredient.quantity;
      }
    }
  }
  return { recipes, items: [...consolidated.values()].sort((a, b) => a.name.localeCompare(b.name)) };
}
