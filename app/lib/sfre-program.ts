// Pure SFRE policy foundation — no browser/localStorage/react imports.
// Serializable types + pure resolvers only.

export const FOUNDATION_START = new Date('2026-07-06T00:00:00Z');
export const FOUNDATION_WEEKS = 13;
export const FOUNDATION_DAYS = 91;
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
