# SF Prep Weekly Planner Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Add a persistent, synced training-first weekly planner and exact-quantity Sunday grocery list for Carnitas and Korean Beef.

**Architecture:** Keep planning in a new `sfprep:plan` key, separate from actual nutrition logs. Put plan parsing, macro forecasting, recipe ingredients, and grocery consolidation in a pure TypeScript module; add a thin browser adapter and an additive calendar panel.

**Tech Stack:** Next.js 16.2.10, React 19, TypeScript, Node 24 built-in test runner, existing generic `sfprep` sync route.

---

### Task 1: Create a pure planner domain module using RED → GREEN

**Objective:** Establish typed v1 plan data, validation, immutable edits, macro forecasting, and exact two-recipe grocery consolidation.

**Files:**
- Create: `app/lib/planner.ts`
- Create: `app/lib/planner.test.ts`

**Step 1: Write failing tests**
- Use `node --experimental-strip-types --test app/lib/planner.test.ts`.
- Cover valid plan normalization, malformed data fallback, forecast not mutating logged data, missing meal handling, and duplicate ingredient consolidation.

**Step 2: Verify RED**
- Run the command above; expected failure is missing `./planner.ts` exports.

**Step 3: Implement minimum domain API**
- Export `emptyPlan`, `parsePlan`, `setPlannedEntry`, `forecastPlanMacros`, `SUNDAY_PREP_RECIPES`, and `buildGroceryList`.
- Keep all functions deterministic and free from browser/React imports.

**Step 4: Verify GREEN**
- Re-run Node tests; expected all pass.

### Task 2: Add a browser-safe plan storage adapter

**Objective:** Persist only `sfprep:plan`, validate before use, and use the existing generic sync transport.

**Files:**
- Create: `app/lib/planner-client.ts`
- Modify: `app/lib/planner.test.ts`

**Steps:**
1. Add a failing test for tolerant parse behavior through the codec.
2. Implement `loadPlan` and `savePlan` with localStorage guards and `pushSfprepSync()`.
3. Do not alter `sfprep:nutrition` or the server sync route.
4. Re-run Node tests.

### Task 3: Add calendar planning and Sunday-prep panels

**Objective:** Let a user select a week day, assign saved meals per slot, see plan forecast vs. logged totals, set training/study/supplements/note, and view the two-recipe Sunday grocery list.

**Files:**
- Modify: `app/calendar/page.tsx`

**Steps:**
1. Read existing render tree fully before editing; preserve HUD telemetry.
2. Load `sfprep:plan` only after the existing sync pull completes.
3. Add the planner in an adjacent panel, avoiding changes to actual nutrition state.
4. Use saved meals as selectable values; show unavailable saved IDs safely.
5. Build and then interactively verify the Calendar UI.

### Task 4: Regression, production deployment, and live verification

**Files:**
- Modify only files from Tasks 1–3 if needed.

**Steps:**
1. Run Node planner tests.
2. Run `npm run build` and preserve actual exit code.
3. Restart only through `launchctl kickstart -k gui/$(id -u)/com.sfprep.fitness-tracker`.
4. Verify local and Funnel `/calendar` return 200.
5. Use a browser to assign a saved meal, verify forecast changes while actual logged totals do not, then reload and verify persistence.
