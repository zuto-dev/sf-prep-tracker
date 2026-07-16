export type MacroTargets = { kcal: number; p: number; c: number; f: number };
export type NutritionPreset = 'foundation' | 'peak' | 'custom';
export type NutritionSnapshot = {
  targets: MacroTargets;
  preset: NutritionPreset;
};

export const FOUNDATION_TARGETS: MacroTargets = { kcal: 2400, p: 180, c: 240, f: 80 };
export const PEAK_TARGETS: MacroTargets = { kcal: 2200, p: 200, c: 180, f: 75 };
const LEGACY_FOUNDATION_TARGETS: MacroTargets = { kcal: 2800, p: 180, c: 320, f: 80 };

function sameTargets(a: MacroTargets, b: MacroTargets) {
  return a.kcal === b.kcal && a.p === b.p && a.c === b.c && a.f === b.f;
}

/** Only migrates the known obsolete foundation preset; custom values remain user-owned. */
export function normalizeNutritionStore<T extends NutritionSnapshot>(store: T): T {
  if (store.preset === 'foundation' && sameTargets(store.targets, LEGACY_FOUNDATION_TARGETS)) {
    return { ...store, targets: FOUNDATION_TARGETS };
  }
  return store;
}

export function macroGap(total: MacroTargets, target: MacroTargets): MacroTargets {
  return {
    kcal: Math.max(0, target.kcal - total.kcal),
    p: Math.max(0, target.p - total.p),
    c: Math.max(0, target.c - total.c),
    f: Math.max(0, target.f - total.f),
  };
}
