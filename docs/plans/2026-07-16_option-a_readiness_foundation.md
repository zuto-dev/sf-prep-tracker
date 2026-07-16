# Option A — Readiness Foundation (SPARC)

## Ground state

The tracker already has real Plan D generation, local exercise logs, Nutrition, Study, Calendar, and a versioned sync path. It also has two competing sync implementations, Calendar reads several stale/mismatched storage shapes, and ruck scheduling is unlocked by calendar week instead of logged readiness. This cycle fixes those trust boundaries before a command-center UI is added.

## Scope

### In
1. One pure program/readiness domain for current day/week/phase and ruck gate decisions.
2. Ruck sessions shown in the current workout UI are blocked/substituted until a logged 2-mile result satisfies the configured gate.
3. Calendar derives workout/mobility/supplement completion from the shapes the live components actually write.
4. One canonical Foundation nutrition target used by Calendar.
5. Legacy global `/api/sync` mirror is removed from the app shell; versioned `sfprep-sync` remains.
6. Regression tests for the pure domain behavior and storage adapters touched by this cycle.

### Explicitly out of scope
- Authenticated multi-user storage / Supabase migration.
- New visual Today Command Center (next cycle, built on this foundation).
- Automated ruck-load changes or silently applying research adjustments.
- Rebuilding standards, pods, photo scan, or the Coach.

## Resolved defaults

- **Ruck gate:** a 2-mile result at or below 16:00 is required before the app presents a scheduled ruck; otherwise it substitutes the existing long-walk/recovery pattern and explains why. This preserves the user’s ruck-gated Plan D rule.
- **Metric source:** prefer Standards event history (`sfprep:standards`) for 2-mile seconds; fall back to Progress `runPace` minutes when Standards has no usable entry.
- **Ruck load:** do not change the existing physical progression automatically in this cycle. The UI labels the gate status; a later SFRE-specific load progression needs its own sourced, deliberate design.
- **Sync:** retain the Zod-validated versioned delta route and remove only the legacy shell-mounted mirror, without deleting legacy state files in this cycle.

## Acceptance criteria

### AC-1 — Canonical program position
**Given** Plan D started on 2026-07-06, **when** a date is evaluated, **then** the domain returns an exact one-based program day, week, phase, and in-phase week consistent everywhere.

### AC-2 — Ruck safety gate
**Given** a scheduled ruck week and no qualifying 2-mile result, **when** the workout screen opens, **then** the ruck is replaced by a clearly labeled aerobic substitute and the reason names the run gate.

### AC-3 — Qualified ruck
**Given** a scheduled ruck week and a logged 2-mile at or below 16:00, **when** the workout screen opens, **then** the prescribed ruck remains visible and the interface identifies the gate as passed.

### AC-4 — Calendar truth
**Given** exercise checkmarks, mobility checkmarks, nutrition entries, and supplements written by the live screens, **when** Calendar renders, **then** its daily indicators reflect those real records rather than stale shapes or misspelled keys.

### AC-5 — Target consistency
**Given** Foundation nutrition is selected, **when** Calendar displays a calorie target, **then** it uses the same 2,400 kcal target as Nutrition.

### AC-6 — One active sync engine
**Given** the app shell loads, **when** any page renders, **then** it does not initialize or poll the legacy `/api/sync` mirror; tracker pages continue using `/api/sfprep-sync`.

## Edge cases

1. No 2-mile history: ruck remains blocked, no guessed clearance.
2. Progress pace data is malformed or not numeric: ignore it and remain blocked.
3. A Standards history contains multiple 2-mile entries: use latest valid-date result.
4. A Calendar day contains legacy/malformed storage: show zero activity, do not throw.
5. A date before Plan D start: clamp to Day 1 / Week 1 rather than producing negative array access.

## Phase 2 pseudocode

```text
programPosition(date):
  elapsedDays = max(0, floor((date - PLAN_D_START) / dayMs))
  day = elapsedDays + 1
  globalWeek = ceil(day / 7)
  phaseIndex = min(2, floor((globalWeek - 1) / 26))
  return day, globalWeek, phase, phaseWeek

latestTwoMileSeconds(standards, metrics):
  latest standards.twoMileRun by valid date -> seconds
  else latest metrics.runPace -> minutes * 60
  else null

ruckReadiness(globalWeek, resultSeconds):
  scheduled = globalWeek >= 7 AND globalWeek odd
  if not scheduled: return not-scheduled
  if resultSeconds is null or resultSeconds > 960: return blocked, substitute long walk
  return cleared

calendarActivity(date, localStorage):
  workoutComplete = find any matching completed key with all expected IDs OR a completed marker
  mobilityCount = count true values under sfprep:mobility[date]
  supplements = parse sfprep:sups days[date]
  nutrition = canonical nutrition loader
```

## Architecture

- `app/lib/program-state.ts`: pure current-position, metric parsing, and ruck-readiness decisions. No React/localStorage dependencies beyond values passed into it.
- `app/lib/program-state.test.ts`: test-first unit coverage for every acceptance path.
- `app/page.tsx`: reads synced local data, selects actual current program week, and uses the gate decision to render a safe replacement for scheduled rucks.
- `app/calendar/page.tsx`: adapters only; reads the actual current key shapes and canonical nutrition targets.
- `app/layout.tsx`: removes legacy `SyncBoot` mount. Legacy files stay untouched/deprecated in this cycle to avoid destructive state deletion.

## Phase gates

- Phase 1: passed — scope, defaults, 6 Given/When/Then ACs, and 5 edge cases recorded.
- Phase 2/3: passed — pure module boundary and explicit data flow above.
- Phase 4: tests must demonstrate blocked, cleared, fallback, pre-start, and calendar adapter behavior before production edits.
- Phase 5: `npm test`, `npm run build`, live HTTP, and browser click-through must pass. No unrelated worktree changes will be staged or claimed.
