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

test('normalizeNutritionStore never overwrites a malformed or non-legacy foundation store', () => {
  const malformed = {
    days: {},
    preset: 'foundation' as const,
    targets: { kcal: NaN, p: 180, c: 320, f: 80 },
  };
  assert.deepEqual(normalizeNutritionStore(malformed).targets, malformed.targets);

  const nonLegacyFoundation = {
    days: {},
    preset: 'foundation' as const,
    targets: { kcal: 2450, p: 148, c: 220, f: 60 },
  };
  assert.deepEqual(normalizeNutritionStore(nonLegacyFoundation).targets, nonLegacyFoundation.targets);
});

test('normalizeNutritionStore leaves a custom store fully untouched even if targets coincidentally match the legacy preset numbers', () => {
  const customLookingLikeLegacy = {
    days: {},
    preset: 'custom' as const,
    targets: { kcal: 2800, p: 180, c: 320, f: 80 },
  };
  const result = normalizeNutritionStore(customLookingLikeLegacy);
  assert.deepEqual(result.targets, customLookingLikeLegacy.targets);
  assert.equal(result.preset, 'custom');
});
