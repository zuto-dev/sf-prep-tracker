export type MacroTargets = { kcal: number; p: number; c: number; f: number };
export type NutritionPreset = 'foundation' | 'peak' | 'custom';
export type NutritionSnapshot = {
  targets: MacroTargets;
  preset: NutritionPreset;
};

// Foundation user-facing default is the explicit midpoint of the evidence
// ranges (see resolveFoundationNutritionGuidance in sfre-program.ts for the
// day-aware training/rest ranges this midpoint sits between):
//   kcal: mid(2100-2200 rest, 2400-2500 training) -> 2450
//   protein: mid(145-150) -> 150 (upper bound; protein is not split lower)
//   fat: evidence floor is >=50g; 60g gives sensible headroom above the floor
//   carbs: remainder that fills out the 2450 kcal target given p/f above
export const FOUNDATION_TARGETS: MacroTargets = { kcal: 2450, p: 150, c: 325, f: 60 };
export const PEAK_TARGETS: MacroTargets = { kcal: 2200, p: 200, c: 180, f: 75 };

// Known legacy Foundation defaults that may ONLY migrate when preset is
// 'foundation'. Custom stores that happen to hold these exact numbers are
// user-owned and must remain byte-for-byte untouched (see tests).
const LEGACY_FOUNDATION_TARGETS_2800: MacroTargets = { kcal: 2800, p: 180, c: 320, f: 80 };
export const LEGACY_FOUNDATION_TARGETS_2400: MacroTargets = { kcal: 2400, p: 180, c: 240, f: 80 };

function sameTargets(a: MacroTargets, b: MacroTargets) {
  return a.kcal === b.kcal && a.p === b.p && a.c === b.c && a.f === b.f;
}

/** Only migrates the known obsolete foundation presets; custom values remain user-owned. */
export function normalizeNutritionStore<T extends NutritionSnapshot>(store: T): T {
  if (store.preset === 'foundation') {
    if (sameTargets(store.targets, LEGACY_FOUNDATION_TARGETS_2800) || sameTargets(store.targets, LEGACY_FOUNDATION_TARGETS_2400)) {
      return { ...store, targets: FOUNDATION_TARGETS };
    }
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
