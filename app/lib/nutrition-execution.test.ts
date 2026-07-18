import assert from 'node:assert/strict';
import test from 'node:test';
import { FOUNDATION_TARGETS, LEGACY_FOUNDATION_TARGETS_2400, normalizeNutritionStore } from './nutrition-execution.ts';

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

test('normalizeNutritionStore migrates the older 2400/180/240/80 legacy foundation preset', () => {
  const migrated = normalizeNutritionStore({
    days: {},
    preset: 'foundation',
    targets: { ...LEGACY_FOUNDATION_TARGETS_2400 },
  });
  assert.deepEqual(migrated.targets, FOUNDATION_TARGETS);
});

test('normalizeNutritionStore leaves a custom store looking like the older legacy numbers fully untouched', () => {
  const customLookingLikeOlderLegacy = {
    days: {},
    preset: 'custom' as const,
    targets: { ...LEGACY_FOUNDATION_TARGETS_2400 },
  };
  const result = normalizeNutritionStore(customLookingLikeOlderLegacy);
  assert.deepEqual(result.targets, customLookingLikeOlderLegacy.targets);
  assert.equal(result.preset, 'custom');
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

test('FOUNDATION_TARGETS is the explicit evidence-range midpoint: 2450 kcal / 150g P / 325g C / 60g F', () => {
  assert.deepEqual(FOUNDATION_TARGETS, { kcal: 2450, p: 150, c: 325, f: 60 });
});
