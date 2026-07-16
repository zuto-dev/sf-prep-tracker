# Nutrition Option C — Full Rebuild Specification

**Goal:** Replace the crowded Nutrition layout with a mobile-first command center while preserving `sfprep:nutrition`, saved meals, actual logging, sync, weekly rollup, coach, and supplements.

## Layout
1. **Hero / target strip:** one compact card for date, actual intake, protein remaining, calorie remaining, and training context.
2. **Primary action deck:** three recommended next moves displayed as tappable cards; one target meal-slot selector; one tap logs a suggestion.
3. **Meal timeline:** horizontal meal-slot selector (Breakfast / Lunch / Dinner / Snacks) that shows only the active slot and its log/search controls. This replaces four simultaneous cards on mobile.
4. **Secondary workspace:** tab bar for Today / Week / Meals / Tools. Tools contains collapsed coach and supplements; Today has no duplicate training controls.
5. **Visual system:** high contrast, large touch targets, one emerald execution accent, no dense wall of gray panels.

## Invariants
- Actual log remains `sfprep:nutrition`; no Calendar plan writes.
- Existing saved meals and generic foods remain searchable.
- Existing serving edit/remove behavior remains.
- No recipe/grocery or Discord changes.

## Acceptance
- Today is understandable above the fold on a phone.
- Training context appears once, not twice.
- A suggestion logs into the chosen slot in one tap.
- Only the chosen meal slot is expanded on Today; all four remain accessible.
- Week, meal library, coach, and supplements are reachable without data loss.
- Existing target migration continues to normalize obsolete 2800-cal foundation state.
