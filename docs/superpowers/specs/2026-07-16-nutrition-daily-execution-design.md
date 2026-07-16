# Nutrition Daily Execution Design

**Date:** 2026-07-16  
**Scope:** SF Prep Tracker `/nutrition` — Option A only

## Goal
Turn Nutrition into a fast daily execution surface that answers what to eat next, while preserving the existing actual food log, saved meals, weekly summary, and synced data model.

## Fixed targets
- **Foundation / recomp:** 2,400 kcal · 180g protein · 240g carbs · 80g fat.
- **Peak:** 2,200 kcal · 200g protein · 180g carbs · 75g fat.
- Custom targets remain editable.

## Page hierarchy
1. **Daily execution header** — date, selected target, actual calories/protein remaining, and a plain-language status.
2. **Next Move** — rest/run/strength/ruck context, macro gap, three saved-meal-first suggestions, and a one-click action that logs the chosen recommendation to a selected meal slot.
3. **Actual meal log** — compact Breakfast, Lunch, Dinner, Snacks cards. Saved meals rank before generic foods; individual foods remain searchable.
4. **Secondary tools** — collapsible meal coach and compact core-supplement checklist.
5. **Secondary tabs** — Week Summary and Meals library remain available without competing with the today workflow.

## Data and safety invariants
- Actual intake remains exclusively in `sfprep:nutrition`; Calendar planning stays separate in `sfprep:plan`.
- Every add action uses the existing nutrition save path and generic sync.
- No general-life scheduling, ingredient inference, new tracker, or change to the Discord Today-card.
- Existing meal logs and saved meals must render unchanged after the redesign.

## Acceptance checks
1. Foundation and Peak labels match the fixed targets above.
2. The first visible content states remaining calories/protein and the user can choose the training context.
3. A recommended saved meal can be added to a chosen meal slot in one action and updates actual totals.
4. Existing meal search, serving edits, removal, weekly summary, meal library, coach, and supplements continue to work.
5. Planner data is never read or written by Nutrition logging actions.
6. Production build, launchd restart, Funnel `/nutrition` 200, and browser click-through all pass.

## Explicitly deferred to Option C
- New data model / migration.
- Full visual rewrite of every tab.
- General diet or schedule planner.
- Recipe ingredient and grocery automation changes.
