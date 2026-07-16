// SECTION 6: Military Standards & Bi-Temporal Threshold Engine
// Multi-branch SOF profiles + tiered scoring, per the 2026-07-16 blueprint
// (SECTION 6.3). Sourced from official handbooks where noted; other branch
// numbers are public-domain published minimums/averages, not hardcoded to
// a single service the way the old page was.

export interface PerformanceThreshold {
  minimum: number;
  averageSelect: number;
  elite: number;
}

export interface SOFEventDef {
  label: string;
  unit: string;
  higherIsBetter: boolean;
  thresholds: PerformanceThreshold;
}

export interface SOFBranchProfile {
  branchName: string;
  shortLabel: string;
  source: string;
  events: Record<string, SOFEventDef>;
}

export const SOF_PROFILES: Record<string, SOFBranchProfile> = {
  sfas: {
    branchName: 'Army Special Forces Assessment & Selection (SFAS)',
    shortLabel: 'SFAS',
    source: 'USAJFKSWCS SFAS Preparation Handbook (25 June 2025)',
    events: {
      twoMileRun: { label: '2-Mile Run', unit: 'sec', higherIsBetter: false, thresholds: { minimum: 960, averageSelect: 810, elite: 720 } },
      pullUps: { label: 'Pull-ups', unit: 'reps', higherIsBetter: true, thresholds: { minimum: 6, averageSelect: 12, elite: 20 } },
      hrPushups: { label: 'HR Push-ups (2 min)', unit: 'reps', higherIsBetter: true, thresholds: { minimum: 30, averageSelect: 38, elite: 70 } },
    },
  },
  seal: {
    branchName: 'Navy SEAL Physical Screening Test (PST)',
    shortLabel: 'SEAL PST',
    source: 'NSW PST published standards',
    events: {
      swim500y: { label: '500yd Swim', unit: 'sec', higherIsBetter: false, thresholds: { minimum: 750, averageSelect: 540, elite: 480 } },
      pushUps: { label: 'Push-ups (2 min)', unit: 'reps', higherIsBetter: true, thresholds: { minimum: 50, averageSelect: 80, elite: 100 } },
      sitUps: { label: 'Sit-ups (2 min)', unit: 'reps', higherIsBetter: true, thresholds: { minimum: 50, averageSelect: 80, elite: 100 } },
      pullUps: { label: 'Pull-ups', unit: 'reps', higherIsBetter: true, thresholds: { minimum: 10, averageSelect: 15, elite: 20 } },
      oneHalfRun: { label: '1.5-Mile Run', unit: 'sec', higherIsBetter: false, thresholds: { minimum: 630, averageSelect: 570, elite: 540 } },
    },
  },
  raspRanger: {
    branchName: 'Ranger Assessment & Selection Program (RASP)',
    shortLabel: 'RASP',
    source: 'Published RASP APFT / RPFT minimums',
    events: {
      pushUps: { label: 'Push-ups (2 min)', unit: 'reps', higherIsBetter: true, thresholds: { minimum: 49, averageSelect: 65, elite: 85 } },
      situps: { label: 'Sit-ups (2 min)', unit: 'reps', higherIsBetter: true, thresholds: { minimum: 59, averageSelect: 75, elite: 90 } },
      twoMileRun: { label: '2-Mile Run', unit: 'sec', higherIsBetter: false, thresholds: { minimum: 780, averageSelect: 690, elite: 630 } },
      pullUps: { label: 'Pull-ups', unit: 'reps', higherIsBetter: true, thresholds: { minimum: 6, averageSelect: 12, elite: 18 } },
    },
  },
  afsoc: {
    branchName: 'Air Force Special Warfare (AFSOC PAST)',
    shortLabel: 'AFSOC',
    source: 'Published Special Warfare PAST minimums',
    events: {
      swim500m: { label: '500m Swim', unit: 'sec', higherIsBetter: false, thresholds: { minimum: 780, averageSelect: 660, elite: 570 } },
      pushUps: { label: 'Push-ups (2 min)', unit: 'reps', higherIsBetter: true, thresholds: { minimum: 60, averageSelect: 75, elite: 90 } },
      situps: { label: 'Sit-ups (2 min)', unit: 'reps', higherIsBetter: true, thresholds: { minimum: 60, averageSelect: 75, elite: 90 } },
      pullUps: { label: 'Pull-ups', unit: 'reps', higherIsBetter: true, thresholds: { minimum: 8, averageSelect: 12, elite: 20 } },
      run1_5mi: { label: '1.5-Mile Run', unit: 'sec', higherIsBetter: false, thresholds: { minimum: 660, averageSelect: 570, elite: 510 } },
    },
  },
};

export type ScoreTier = 'below-minimum' | 'minimum' | 'average-select' | 'elite';

export interface SOFEvaluation {
  tier: ScoreTier;
  score: number;
  nextTargetGap: number;
}

/**
 * Computes percentile-style score, scoring tier, and the exact numeric gap
 * to the next tier for any SOF branch event.
 */
export function evaluateSOFMetrics(
  profileKey: keyof typeof SOF_PROFILES,
  eventKey: string,
  userValue: number,
): SOFEvaluation {
  const event = SOF_PROFILES[profileKey]?.events[eventKey];
  if (!event) return { tier: 'below-minimum', score: 0, nextTargetGap: 0 };

  const { minimum, averageSelect, elite } = event.thresholds;
  const isBetter = event.higherIsBetter;

  let tier: ScoreTier = 'below-minimum';
  let nextTargetGap = 0;

  if (isBetter) {
    if (userValue >= elite) {
      tier = 'elite';
    } else if (userValue >= averageSelect) {
      tier = 'average-select';
      nextTargetGap = elite - userValue;
    } else if (userValue >= minimum) {
      tier = 'minimum';
      nextTargetGap = averageSelect - userValue;
    } else {
      nextTargetGap = minimum - userValue;
    }
  } else {
    if (userValue <= elite) {
      tier = 'elite';
    } else if (userValue <= averageSelect) {
      tier = 'average-select';
      nextTargetGap = userValue - elite;
    } else if (userValue <= minimum) {
      tier = 'minimum';
      nextTargetGap = userValue - averageSelect;
    } else {
      nextTargetGap = userValue - minimum;
    }
  }

  const score = isBetter
    ? Math.min(100, (userValue / elite) * 100)
    : Math.min(100, (minimum / Math.max(userValue, 1)) * 100);

  return { tier, score, nextTargetGap };
}

export const TIER_META: Record<ScoreTier, { label: string; color: string }> = {
  'below-minimum': { label: 'Below Minimum', color: 'text-red-400' },
  minimum: { label: 'Minimum', color: 'text-amber-400' },
  'average-select': { label: 'Average Select', color: 'text-emerald-400' },
  elite: { label: 'Elite', color: 'text-violet-300' },
};

// --- Bi-temporal history --------------------------------------------------

export interface HistoryPoint {
  date: string; // YYYY-MM-DD, valid-time this measurement represents
  recordedAt: string; // ISO timestamp, transaction-time it was logged
  value: number;
}

export type EventHistory = Record<string, HistoryPoint[]>; // eventKey -> points

/** Returns the most recent point (by date, then recordedAt) for an event. */
export function latestPoint(history: EventHistory, eventKey: string): HistoryPoint | undefined {
  const pts = history[eventKey];
  if (!pts || pts.length === 0) return undefined;
  return [...pts].sort((a, b) => (a.date + a.recordedAt).localeCompare(b.date + b.recordedAt)).at(-1);
}
