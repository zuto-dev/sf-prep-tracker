import assert from 'node:assert/strict';
import test from 'node:test';
import { FOUNDATION_TARGETS, normalizeNutritionStore } from './nutrition-execution.ts';

test('normalizeNutritionStore migrates the obsolete 2800-cal foundation preset without changing custom targets', () => {
  const migrated = normalizeNutritionStore({
    days: {},
    preset: 'foundation',
    targets: { kcal: 2800, p: 180, c: 320, f: 80 },
  });
  assert.deepEqual(migrated.targets, FOUNDATION_TARGETS);

  const custom = normalizeNutritionStore({
    days: {},
    preset: 'custom',
    targets: { kcal: 2650, p: 175, c: 290, f: 75 },
  });
  assert.deepEqual(custom.targets, { kcal: 2650, p: 175, c: 290, f: 75 });
});
