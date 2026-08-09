// Pure SFRE policy foundation — no browser/localStorage/react imports.
// Serializable types + pure resolvers only.

export const FOUNDATION_START = new Date('2026-07-06T00:00:00Z');
export const FOUNDATION_WEEKS = 23;
export const FOUNDATION_DAYS = 161;
export const MTI_PEAK_WINDOW_DAYS = 49;
export const STRICT_RUCK_GATE_SECONDS = 960;

const DAY_MS = 24 * 60 * 60 * 1000;

export type SfreLifecycleState = 'foundation' | 'bridge' | 'mti_peak' | 'post_event';

export type SfreLifecycleInput = {
  date: Date;
  foundationStart?: Date;
  confirmedEventDate?: Date | null;
};

/**
 * Pure lifecycle resolver. MTI peak becomes active only inside the 49 days
 * immediately preceding a *confirmed* event date — never speculative — and
 * this module never emits MTI session content, only the lifecycle state.
 */
export function resolveSfreLifecycle(input: SfreLifecycleInput): SfreLifecycleState {
  const foundationStart = input.foundationStart ?? FOUNDATION_START;
  const foundationEnd = new Date(foundationStart.getTime() + FOUNDATION_DAYS * DAY_MS);

  if (input.date.getTime() < foundationEnd.getTime()) {
    return 'foundation';
  }

  const confirmedEventDate = input.confirmedEventDate ?? null;
  if (confirmedEventDate) {
    if (input.date.getTime() >= confirmedEventDate.getTime()) {
      return 'post_event';
    }
    const mtiWindowStart = confirmedEventDate.getTime() - MTI_PEAK_WINDOW_DAYS * DAY_MS;
    if (input.date.getTime() >= mtiWindowStart) {
      return 'mti_peak';
    }
  }

  return 'bridge';
}

// --- Strict canonical two-mile gate source ---------------------------------

export type TwoMileHistoryPoint = {
  date: string;
  recordedAt?: string;
  value: number;
};

export type StandardsHistorySnapshot = {
  history?: {
    twoMileRun?: TwoMileHistoryPoint[];
  };
} | null | undefined;

/**
 * The ONLY valid source for a two-mile time is standards history.twoMileRun.
 * There is no generic-pace fallback here by design — that ambiguity lived in
 * the legacy program-state module and is intentionally not reproduced.
 */
export function canonicalTwoMileSeconds(standards: StandardsHistorySnapshot): number | null {
  const entries = standards?.history?.twoMileRun;
  if (!entries || entries.length === 0) return null;

  const valid = entries.filter(entry => Number.isFinite(entry.value) && Boolean(entry.date));
  if (valid.length === 0) return null;

  const newest = valid
    .slice()
    .sort((a, b) => `${a.date}${a.recordedAt ?? ''}`.localeCompare(`${b.date}${b.recordedAt ?? ''}`))
    .at(-1)!;

  return newest.value;
}

export type StrictRuckGateResult = {
  cleared: boolean;
  gateSeconds: number;
};

export function resolveStrictRuckGate(twoMileSeconds: number | null): StrictRuckGateResult {
  return {
    cleared: twoMileSeconds !== null && twoMileSeconds <= STRICT_RUCK_GATE_SECONDS,
    gateSeconds: STRICT_RUCK_GATE_SECONDS,
  };
}

// --- Day-aware Foundation nutrition ranges ----------------------------------

export type FoundationNutritionInput = {
  preset: 'foundation' | 'peak' | 'custom';
  isTrainingDay: boolean;
};

export type FoundationNutritionGuidance = {
  kcalRange: [number, number];
  proteinRangeG: [number, number];
  fatFloorG: number;
};

const TRAINING_DAY_GUIDANCE: FoundationNutritionGuidance = {
  kcalRange: [2400, 2500],
  proteinRangeG: [145, 150],
  fatFloorG: 50,
};

const REST_DAY_GUIDANCE: FoundationNutritionGuidance = {
  kcalRange: [2100, 2200],
  proteinRangeG: [145, 150],
  fatFloorG: 50,
};

/**
 * Returns a range, never a single auto-applied number, and never mutates a
 * user's macro targets. Custom presets are user-owned and return null —
 * callers must not substitute guidance for a custom target.
 */
export function resolveFoundationNutritionGuidance(
  input: FoundationNutritionInput,
): FoundationNutritionGuidance | null {
  if (input.preset === 'custom') return null;
  return input.isTrainingDay ? TRAINING_DAY_GUIDANCE : REST_DAY_GUIDANCE;
}

// --- Bodyweight trend action -------------------------------------------------

export type BodyweightPoint = {
  date: string;
  value: number;
};

export type BodyweightTrendAction =
  | 'insufficient_data'
  | 'hold'
  | 'increase_100_150'
  | 'decrease_100_150';

const MIN_TREND_POINTS = 3;
const MIN_TREND_SPAN_DAYS = 21;
const HOLD_BAND_LBS = 0.5;

function toUtcDayMs(dateStr: string): number | null {
  const t = Date.parse(dateStr);
  return Number.isFinite(t) ? t : null;
}

export function resolveBodyweightTrend(points: BodyweightPoint[]): BodyweightTrendAction {
  const valid = points
    .filter(p => Boolean(p.date) && Number.isFinite(p.value) && toUtcDayMs(p.date) !== null)
    .map(p => ({ ...p, ms: toUtcDayMs(p.date)! }))
    .sort((a, b) => a.ms - b.ms);

  if (valid.length < MIN_TREND_POINTS) return 'insufficient_data';

  const spanDays = (valid.at(-1)!.ms - valid[0].ms) / DAY_MS;
  if (spanDays < MIN_TREND_SPAN_DAYS) return 'insufficient_data';

  const first = valid[0].value;
  const last = valid.at(-1)!.value;
  const delta = last - first;

  if (Math.abs(delta) <= HOLD_BAND_LBS) return 'hold';
  return delta < 0 ? 'increase_100_150' : 'decrease_100_150';
}

// --- Foundation week index ---------------------------------------------------

/**
 * One-based Foundation week (1..FOUNDATION_WEEKS), clamped at both ends.
 * This is the ONLY week-index resolver for the active 13-week Foundation
 * renderer — there is no 78-week global-week concept in this module.
 */
export function resolveFoundationWeekIndex(date: Date, foundationStart: Date = FOUNDATION_START): number {
  const elapsedDays = Math.max(0, Math.floor((date.getTime() - foundationStart.getTime()) / DAY_MS));
  const week = Math.floor(elapsedDays / 7) + 1;
  return Math.min(FOUNDATION_WEEKS, Math.max(1, week));
}

// --- Friday session prescription --------------------------------------------

export type FridayPrescriptionStep = {
  name: string;
  durationSeconds: number;
};

export type FridayPrescription = {
  kind: 'friday_pt_test';
  steps: FridayPrescriptionStep[];
};

/**
 * Friday is a fixed PT-test sequence: fasted weigh-in, 2-minute HRPU,
 * 5-minute rest, 2-minute sit-ups — always in that order.
 */
export function resolveFridayPrescription(): FridayPrescription {
  return {
    kind: 'friday_pt_test',
    steps: [
      { name: 'Fasted Weigh-In', durationSeconds: 0 },
      { name: '2-Minute HRPU (Max Push-ups)', durationSeconds: 120 },
      { name: 'Rest', durationSeconds: 300 },
      { name: '2-Minute Sit-ups', durationSeconds: 120 },
    ],
  };
}

// --- Thursday protected recovery ---------------------------------------------

export type ThursdayRecoveryPolicy = {
  protected: boolean;
  allowMakeupStrength: boolean;
};

/**
 * Thursday is protected recovery. It is NEVER a strength make-up day —
 * this is a fixed policy fact, not a derived one.
 */
export function resolveThursdayRecoveryPolicy(): ThursdayRecoveryPolicy {
  return { protected: true, allowMakeupStrength: false };
}

// --- Foundation week 10+ hard tempo cap --------------------------------------

export type FoundationTempoCap = {
  hardTempoCapMiles: number | null;
  extensionPolicy: 'none' | 'easy_only';
};

const TEMPO_CAP_START_WEEK = 10;
const TEMPO_CAP_MILES = 3;

/**
 * From Foundation week 10 onward the hard tempo portion of the Saturday
 * session is capped at 3 miles. Any distance beyond the cap must be
 * explicitly easy — never additional hard tempo volume.
 */
export function resolveFoundationTempoCap(foundationWeek: number): FoundationTempoCap {
  if (foundationWeek < TEMPO_CAP_START_WEEK) {
    return { hardTempoCapMiles: null, extensionPolicy: 'none' };
  }
  return { hardTempoCapMiles: TEMPO_CAP_MILES, extensionPolicy: 'easy_only' };
}

// --- Saturday ruck-or-substitute session decision ----------------------------

const SUBSTITUTE_SESSION = 'Easy Long Walk / Recovery' as const;

export type FoundationSaturdaySession =
  | { kind: 'not_scheduled' }
  | { kind: 'ruck_locked'; substitute: typeof SUBSTITUTE_SESSION; lockReason: string }
  | { kind: 'ruck_cleared'; mode: 'walking_only' };

function ruckScheduledForWeek(foundationWeek: number): boolean {
  return foundationWeek >= 7 && foundationWeek % 2 === 1;
}

function lockReasonFor(gate: StrictRuckGateResult): string {
  return `Ruck locked: two-mile gate requires \u2264 ${gate.gateSeconds}s. Standard not met.`;
}

/**
 * Pure Foundation Saturday session resolver. A scheduled ruck with an unmet
 * gate is REPLACED by the prescribed Easy Long Walk / Recovery substitute —
 * the original ruck decision is locked, not merely annotated. A cleared
 * ruck remains WALKING ONLY; this module never renders a running-ruck mode.
 */
export function resolveFoundationSaturdaySession(
  foundationWeek: number,
  twoMileSeconds: number | null,
): FoundationSaturdaySession {
  if (!ruckScheduledForWeek(foundationWeek)) {
    return { kind: 'not_scheduled' };
  }

  const gate = resolveStrictRuckGate(twoMileSeconds);
  if (!gate.cleared) {
    return { kind: 'ruck_locked', substitute: SUBSTITUTE_SESSION, lockReason: lockReasonFor(gate) };
  }
  return { kind: 'ruck_cleared', mode: 'walking_only' };
}

// --- Ruck completion lock -----------------------------------------------------

export type RuckLockState =
  | { locked: false }
  | { locked: true; reason: string; substitute: typeof SUBSTITUTE_SESSION };

/**
 * Whether a scheduled ruck session is mechanically locked for completion/log
 * writes. Unscheduled and cleared rucks are never locked; a scheduled ruck
 * with an unmet gate is always locked, and callers MUST honor this before
 * allowing a completion toggle or a log save.
 */
export function resolveRuckLockState(foundationWeek: number, twoMileSeconds: number | null): RuckLockState {
  const session = resolveFoundationSaturdaySession(foundationWeek, twoMileSeconds);
  if (session.kind !== 'ruck_locked') {
    return { locked: false };
  }
  return { locked: true, reason: session.lockReason, substitute: session.substitute };
}

/**
 * Smallest pure completion guard: given whether an exercise is locked,
 * returns whether toggling completion is allowed. UI components must gate
 * every completion toggle and log-save path through this (or the richer
 * resolveRuckLockState) rather than re-deriving eligibility inline.
 */
export function canToggleCompletion(locked: boolean): boolean {
  return !locked;
}

/**
 * Whether a given exercise, on a given day, is the actual Saturday ruck
 * prescription that resolveRuckLockState may lock. The ruck-lock policy is
 * specifically a Saturday-session decision — it must NOT match same-named
 * substrings on other days (e.g. Friday's "Ruck Swings" work-capacity
 * drill), which are unrelated exercises that merely share the word "ruck".
 * Callers MUST gate any lock/substitute UI through this (or an equally
 * day-scoped check) rather than matching on exercise name alone.
 */
export function isLockableRuckExercise(day: string, name: string): boolean {
  return day.toLowerCase() === 'saturday' && name.toLowerCase().includes('ruck');
}
