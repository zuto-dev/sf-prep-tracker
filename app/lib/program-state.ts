export const PLAN_D_START = new Date('2026-07-06T00:00:00Z');
export const WEEKS_PER_PHASE = 26;
export const RUCK_GATE_SECONDS = 16 * 60;

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

export type StandardsSnapshot = {
  history?: Record<string, TwoMileHistoryPoint[]>;
} | null | undefined;

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
const PHASES: ProgramPhase[] = ['foundation', 'build', 'peak'];

export function getProgramPosition(date: Date, start: Date = PLAN_D_START): ProgramPosition {
  const elapsedDays = Math.max(0, Math.floor((date.getTime() - start.getTime()) / DAY_MS));
  const day = elapsedDays + 1;
  const globalWeek = Math.ceil(day / 7);
  const phaseIndex = Math.min(PHASES.length - 1, Math.floor((globalWeek - 1) / WEEKS_PER_PHASE));
  const phaseWeek = Math.min(WEEKS_PER_PHASE, globalWeek - phaseIndex * WEEKS_PER_PHASE);

  return { day, globalWeek, phase: PHASES[phaseIndex], phaseWeek };
}

function newestValid<T extends { date: string; value: number }>(entries: T[] | undefined): T | null {
  if (!entries) return null;
  return entries
    .filter(entry => Number.isFinite(entry.value) && Boolean(entry.date))
    .sort((a, b) => `${a.date}${'recordedAt' in a ? a.recordedAt || '' : ''}`.localeCompare(`${b.date}${'recordedAt' in b ? b.recordedAt || '' : ''}`))
    .at(-1) ?? null;
}

export function latestTwoMileSeconds(standards: StandardsSnapshot, progress: ProgressSnapshot): number | null {
  const standardsPoint = newestValid(standards?.history?.twoMileRun);
  if (standardsPoint) return standardsPoint.value;

  const progressPoint = newestValid(progress?.runPace);
  return progressPoint ? progressPoint.value * 60 : null;
}

export function resolveRuckReadiness(globalWeek: number, twoMileSeconds: number | null): RuckReadiness {
  const scheduled = globalWeek >= 7 && globalWeek % 2 === 1;
  if (!scheduled) {
    return { scheduled: false, status: 'not-scheduled', gateSeconds: RUCK_GATE_SECONDS, substitute: null };
  }
  if (twoMileSeconds === null || twoMileSeconds > RUCK_GATE_SECONDS) {
    return { scheduled: true, status: 'blocked', gateSeconds: RUCK_GATE_SECONDS, substitute: 'Easy Long Walk / Recovery' };
  }
  return { scheduled: true, status: 'cleared', gateSeconds: RUCK_GATE_SECONDS, substitute: null };
}
