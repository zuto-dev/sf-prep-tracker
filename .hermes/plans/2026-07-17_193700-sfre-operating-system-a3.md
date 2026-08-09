# SFRE Operating System (A3) — SPARC Implementation Plan

> **For Hermes:** Execute only after SPARC Phases 1–3 are gated. Use test-first, feature-branch work, and a separate production preview.

**Goal:** Replace the tracker’s invented 78-week calendar with a truthful, gate-driven SFRE operating system: Plan D foundation → controlled bridge → MTI’s exact 7-week SFRE peak after a confirmed event date.

**Architecture:** Retain the existing Next.js 16 App Router and localStorage-first sync. Centralize all training/nutrition/gate policy in a pure, tested program domain layer; UI reads decisions from that layer rather than recreating rules in each page. Treat MTI as a linked, user-owned final plan—not copied proprietary session content.

**Tech:** Next.js 16.2.10, React 19, TypeScript, existing node test runner, localStorage + existing `sfprep-sync`.

---

## Ground state

- Local and Tailscale production routes both returned HTTP 200 during Phase 0.
- `app/data/workouts.ts` currently emits a generic 78-week Foundation/Build/Peak program and schedules rucks from week 7; it is not the active 13-week Plan D source of truth.
- `app/lib/program-state.ts` already enforces the ≤16:00 two-mile readiness decision visually, but `Exercise.tsx` still permits a blocked ruck to be completed.
- Nutrition truth is split: active UI uses 2,400/180/240/80; Calendar hardcodes 2,800; dead `program-config.ts` contains stale 2,800/180/320/80.
- Current authoritative fitness doctrine: `~/Gbrain-personal/internal/references/fitness/plan-d-master-reference.md` and `plan-d-18x-foundation.md`.

## Product contract

### Lifecycle

1. **Foundation — 13 weeks:** actual Plan D only. Run gate is hard. Friday uses HRPU + sit-up assessment. Rucks do not appear as completable prescribed workouts unless gate is satisfied.
2. **Bridge — conditional / date-aware:** begins only after Foundation is complete and the run gate is sustained. It develops walking-only load tolerance before selection loads. No full MTI selection-session copy is stored.
3. **MTI SFRE peak — fixed 7 weeks:** unlocked only when user enters a confirmed SFRE date 7 weeks away. The tracker gives readiness/checklist/navigation support and links to the owned MTI plan; it does not reproduce the paid program.

### Data principles

- One policy module owns: phase, gates, nutrition range, tests, and recovery rules.
- Existing local histories are migrated, never erased. Custom nutrition values remain user-owned.
- No fabricated “official SFRE cutoff” claims. SFRE cards label targets as Plan D/MTI coaching targets; official sources remain separately cited where they exist.

## Acceptance criteria (Given / When / Then)

1. **Given** no ≤16:00 two-mile result is logged, **when** Foundation reaches a ruck date, **then** the ruck is replaced by the approved non-ruck substitute and cannot be marked complete.
2. **Given** a valid ≤16:00 two-mile result is logged, **when** the next scheduled foundation ruck arrives, **then** only the walking-only, progressive bridge prescription is enabled.
3. **Given** a user opens Nutrition or Calendar, **when** Foundation is selected, **then** the same day-aware targets appear everywhere: 2,400–2,500 training / 2,100–2,200 rest; 145–150g protein; ≥50g fat.
4. **Given** Friday assessment day, **when** the workout renders, **then** it specifies 2-minute hand-release push-ups, 5-minute rest, 2-minute sit-ups, and fasted weigh-in.
5. **Given** Phase 3 tempo work, **when** it renders, **then** only 3 miles are tempo; any 1–2-mile extension is explicitly easy.
6. **Given** a missed strength day, **when** the calendar offers adaptive guidance, **then** Thursday recovery is never converted to a make-up strength session.
7. **Given** an SFRE date is not set, **when** the user views the lifecycle, **then** the MTI peak is visibly locked with its exact date requirement.
8. **Given** an old local/synced nutrition snapshot, **when** the app upgrades, **then** logs and custom macro targets remain intact and the obsolete default is migrated safely.

## Edge cases

- No two-mile history or malformed time: lock ruck and show the exact action needed.
- Two-mile passes once but then worsening/recovery concern exists: show gate history and require a current, valid result policy—not a stale boolean.
- Custom macro target: never overwrite; show evidence-based Foundation recommendation alongside it.
- Confirmed SFRE date is less than or greater than 7 weeks away: calculate the next lifecycle action without inventing compressed/extended MTI programming.
- Old browser/device sync returns a stale snapshot: preserve event history and resolve versioned state deterministically.
- User changes bodyweight: update displayed load guidance, not historical measurements.

## Implementation sequence — Phase 4 only

### Task 1 — Lock source-backed policy as pure domain data
**Files:** Create `app/lib/sfre-program.ts`; test `app/lib/sfre-program.test.ts`; retire `app/lib/program-config.ts`.

1. Write failing tests for phase calculation, day-aware nutrition targets, HRPU Friday, tempo cap, and MTI peak-date lock.
2. Add typed `ProgramPhase`, `GateDecision`, `NutritionTarget`, and `ReadinessSnapshot`.
3. Implement pure functions with no browser access.
4. Run `npm test` and commit the policy layer alone.

### Task 2 — Make ruck gating mechanically enforceable
**Files:** Modify `app/lib/program-state.ts`, `app/lib/program-state.test.ts`, `app/components/WorkoutDay.tsx`, `app/components/Exercise.tsx`.

1. Write failing tests for blocked-completion state.
2. Have `WorkoutDay` pass a locked/ineligible exercise state to `Exercise`.
3. Prevent completed-state writes for a locked ruck; render the Plan D substitute instead.
4. Verify old completion logs remain viewable but do not count as prescribed completion.

### Task 3 — Replace generic program generation with lifecycle-driven sessions
**Files:** Modify/replace `app/data/workouts.ts`; create tests for the session generator.

1. Encode only Foundation’s 13-week Plan D sessions as direct site data.
2. Add explicit Friday HRPU assessment and protected Thursday metadata.
3. Cap Phase 3 tempo segment at 3 miles; extra distance must be tagged `easy`.
4. Make Bridge and MTI Peak planner states/checklists, not copied paid workouts.

### Task 4 — Unify nutrition and trend guidance
**Files:** Modify `app/lib/nutrition-execution.ts`, `app/lib/nutrition-execution.test.ts`, `app/nutrition/page.tsx`, `app/calendar/page.tsx`.

1. Add migration tests for legacy targets/custom targets.
2. Add a pure 3–4-week trend evaluator returning `hold`, `increase_100_150`, or `decrease_100_150`.
3. Remove hardcoded calorie values from Calendar.
4. Replace strict post-workout timing language with practical surrounding-hours guidance.

### Task 5 — Build the SFRE readiness surface
**Files:** Modify `app/standards/page.tsx`, `app/lib/sof-standards.ts`, `app/page.tsx`.

1. Add an SFRE Readiness view separate from SFAS official standards.
2. Surface current gate, next test, Foundation/Bridge/Peak state, and source labels.
3. Keep historical SFAS/SEAL/RASP/AFSOC profiles intact.

### Task 6 — Add lifecycle UX and migration transparency
**Files:** Create `app/components/SfreLifecycle.tsx`; modify Nav/home/calendar surfaces as required.

1. Show the three phases, gate criteria, and explicit MTI peak date lock.
2. Add a non-alarming migration/status note where user-owned state was preserved.
3. Ensure every lifecycle CTA lands on an existing route or section.

### Task 7 — Verify and preview

- `npm test`
- `npm run lint`
- `npm run build`
- Start isolated preview (separate worktree/port; do not disturb production).
- Browser-check `/`, `/calendar`, `/nutrition`, `/standards` on the preview, including locked and unlocked ruck states.
- Run a fresh-context code review before promotion.

## Phase 2 pseudocode summary

- The only valid ruck unlock is a current, validated `history.twoMileRun` value at or below 16:00. The existing `progress.runPace` fallback is not permitted to unlock load carriage because its semantics are ambiguous.
- A pure lifecycle resolver selects Foundation, Bridge, MTI peak, or post-event state from date, confirmed SFRE date, and standards history.
- A session resolver supplies HRPU Friday, protected Thursday recovery, capped tempo work, and either a locked-rack substitute or a cleared walking-only ruck.
- Nutrition uses a day-aware range plus a pure trend recommender; it never auto-changes user macros.
- MTI peak stays a linked/checklist state, with no proprietary session copy stored in the app.

## Explicit non-goals

- No database migration, auth change, or new dependency without a separate SPARC amendment.
- No reproduction of proprietary MTI session content.
- No automatic calorie adjustment or medical/nutrition diagnosis—the site recommends a small adjustment; the user decides.
- No replacing existing official multi-branch standards with invented SFRE “official” cutoffs.

## SPARC gate status

- **Phase 1 — Specification:** passed. Christian approved A3 as written.
- **Phase 2 — Pseudocode:** passed. State, gate, migration, nutrition, and linked-only MTI flows are documented.
- **Phase 3 — Architecture:** passed after fresh-context synergy review; the existing pace fallback, decorative-only completion gate, and sync contention were treated as non-deferrable build requirements.
- **Phase 4 — Implementation + preview:** passed. The isolated branch has 79 passing tests, a successful production build, browser-verified Home/Nutrition/Calendar/Standards flows, and an approved final integration review. The preview runs at `https://mac-mini.tail1ae0d0.ts.net:8446/`.
- **Phase 5 — Completion/deployment:** passed. Production is deployed on `refactor/ai-studio-integration` at `b7ecd72`; `https://mac-mini.tail1ae0d0.ts.net:8445/` returned HTTP 200 and independent post-deploy review approved release parity. The remote record is `release/sfre-operating-system` at `7518326`.

Locked defaults: local-first versioned state; Foundation only in the session renderer; Bridge and MTI as gated lifecycle/checklist states; separate Tailscale preview before production promotion.
