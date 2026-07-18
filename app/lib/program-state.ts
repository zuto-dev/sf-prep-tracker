// Compatibility adapter — DEPRECATED. All gate/lifecycle logic now lives in
// `sfre-program.ts`, which is the single canonical policy owner. This module
// only re-exports the equivalent pure functions/types under their legacy
// names so any remaining legacy imports keep compiling during the
// transition; it must never re-implement gate math independently.
//
// New code MUST import directly from `./sfre-program`.

import {
  FOUNDATION_START as PLAN_D_START,
  STRICT_RUCK_GATE_SECONDS as RUCK_GATE_SECONDS,
  canonicalTwoMileSeconds,
  resolveFoundationWeekIndex,
  resolveStrictRuckGate,
  type StandardsHistorySnapshot,
} from './sfre-program.ts';

export { PLAN_D_START, RUCK_GATE_SECONDS };

export type ProgramPhase = 'foundation' | 'build' | 'peak';

export type ProgramPosition = {
  day: number;
  globalWeek: number;
  phase: ProgramPhase;
  phaseWeek: number;
};

export type TwoMileHistoryPoint = {
  date: string;
  recordedAt?: string;
  value: number;
};

export type StandardsSnapshot = StandardsHistorySnapshot;

export type ProgressSnapshot = {
  runPace?: Array<{ date: string; value: number }>;
} | null | undefined;

export type RuckReadiness = {
  scheduled: boolean;
  status: 'not-scheduled' | 'blocked' | 'cleared';
  gateSeconds: number;
  substitute: 'Easy Long Walk / Recovery' | null;
};

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Legacy shape adapter over the canonical Foundation week index. The active
 * program is Foundation-only (13 weeks), so phase is always 'foundation' and
 * globalWeek/phaseWeek both mirror the canonical week index.
 */
export function getProgramPosition(date: Date, start: Date = PLAN_D_START): ProgramPosition {
  const elapsedDays = Math.max(0, Math.floor((date.getTime() - start.getTime()) / DAY_MS));
  const day = elapsedDays + 1;
  const week = resolveFoundationWeekIndex(date, start);
  return { day, globalWeek: week, phase: 'foundation', phaseWeek: week };
}

/**
 * Delegates to the canonical `canonicalTwoMileSeconds`. There is intentionally
 * NO fallback to a generic progress pace field — that ambiguity was the bug
 * this refactor removes. `_progress` is accepted only for call-site
 * compatibility and is never read.
 */
export function latestTwoMileSeconds(standards: StandardsSnapshot, _progress: ProgressSnapshot): number | null {
  return canonicalTwoMileSeconds(standards);
}

export function resolveRuckReadiness(globalWeek: number, twoMileSeconds: number | null): RuckReadiness {
  const scheduled = globalWeek >= 7 && globalWeek % 2 === 1;
  if (!scheduled) {
    return { scheduled: false, status: 'not-scheduled', gateSeconds: RUCK_GATE_SECONDS, substitute: null };
  }
  const gate = resolveStrictRuckGate(twoMileSeconds);
  if (!gate.cleared) {
    return { scheduled: true, status: 'blocked', gateSeconds: gate.gateSeconds, substitute: 'Easy Long Walk / Recovery' };
  }
  return { scheduled: true, status: 'cleared', gateSeconds: gate.gateSeconds, substitute: null };
}
