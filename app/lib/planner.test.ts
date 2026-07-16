import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildGroceryList,
  emptyPlan,
  forecastPlanMacros,
  parsePlan,
  setPlannedEntry,
} from './planner.ts';

const foods = [
  { id: 'carnitas-bowl', name: 'Carnitas Bowl', kcal: 620, p: 32, c: 55, f: 28 },
  { id: 'korean-beef', name: 'Korean Beef Bowl', kcal: 530, p: 40, c: 48, f: 18 },
];

test('parsePlan accepts a valid v1 plan and rejects malformed data safely', () => {
  const plan = setPlannedEntry(emptyPlan(), '2026-07-20', 'lunch', { foodId: 'carnitas-bowl', servings: 1 });
  assert.deepEqual(parsePlan(JSON.stringify(plan)), plan);
  assert.deepEqual(parsePlan('{not-json'), emptyPlan());
  assert.deepEqual(parsePlan(JSON.stringify({ version: 99, days: {} })), emptyPlan());

  const mixed = {
    version: 1,
    days: {
      '2026-07-20': plan.days['2026-07-20'],
      '2026-07-21': { meals: { breakfast: [{ foodId: 'bad', servings: 0 }], lunch: [], dinner: [], snacks: [] }, supplements: [] },
    },
  };
  assert.deepEqual(parsePlan(JSON.stringify(mixed)), plan);
});

test('forecastPlanMacros calculates planned macros without changing the plan', () => {
  const plan = setPlannedEntry(emptyPlan(), '2026-07-20', 'lunch', { foodId: 'carnitas-bowl', servings: 1.5 });
  const before = JSON.stringify(plan);
  const result = forecastPlanMacros(plan, '2026-07-20', foods);
  assert.deepEqual(result.totals, { kcal: 930, p: 48, c: 82.5, f: 42 });
  assert.deepEqual(result.unavailable, []);
  assert.equal(JSON.stringify(plan), before);
});

test('forecastPlanMacros preserves an unavailable removed meal ID without inventing macros', () => {
  const plan = setPlannedEntry(emptyPlan(), '2026-07-20', 'dinner', { foodId: 'removed-meal', servings: 1 });
  const result = forecastPlanMacros(plan, '2026-07-20', foods);
  assert.deepEqual(result.totals, { kcal: 0, p: 0, c: 0, f: 0 });
  assert.deepEqual(result.unavailable, ['removed-meal']);
});

test('buildGroceryList consolidates the Plan D guide quantities across both Sunday recipes', () => {
  const grocery = buildGroceryList(['carnitas', 'korean-beef']);
  assert.deepEqual(grocery.recipes.map(recipe => recipe.id), ['carnitas', 'korean-beef']);
  assert.deepEqual(
    grocery.items.find(item => item.name === 'Jasmine rice'),
    { category: 'carb', name: 'Jasmine rice', quantity: 5, unit: 'cups' },
  );
  assert.deepEqual(
    grocery.items.find(item => item.name === '93/7 ground beef or turkey'),
    { category: 'protein', name: '93/7 ground beef or turkey', quantity: 1.5, unit: 'lb' },
  );
  assert.deepEqual(
    grocery.items.find(item => item.name === 'Cumin'),
    { category: 'flavor', name: 'Cumin', quantity: null, unit: 'as needed', note: 'Plan D guide does not specify an amount' },
  );
});
