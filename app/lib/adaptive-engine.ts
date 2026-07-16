// Adaptive Periodization Engine — Blueprint SECTION 2.3.
// Implements Acute-to-Chronic Workload Ratio (ACWR) based auto-adjustment.
// History is derived exclusively from REAL logged entries written by
// Exercise.tsx (`sfprep:log:<phase>:<week>:<day>:<exerciseId>:<YYYY-MM-DD>`).
// No fabricated/synthetic telemetry — days with no logs simply contribute
// zero volume, which is the honest signal.

export interface ExerciseSession {
  name: string;
  reps: number;
  sets: number;
  weightLbs: number;
}

export interface PerformanceMetric {
  date: string;       // YYYY-MM-DD
  sessionVolume: number;
  rpe: number;         // Rate of Perceived Exertion (1-10); 0 = not logged
}

export interface AdaptiveLoadResult {
  adjustedSession: ExerciseSession;
  acwr: number;
  recommendation: string;
}

const DATED_LOG_RE = /^sfprep:log:[^:]+:[^:]+:[^:]+:[^:]+:(\d{4}-\d{2}-\d{2})$/;

/** Pulls the first parseable number out of a free-text prescription string like "8-12" or "185 lb". */
export function parseLeadingNumber(v: string | undefined | null): number {
  if (!v) return 0;
  const m = String(v).match(/-?\d+(\.\d+)?/);
  return m ? parseFloat(m[0]) : 0;
}

interface LoggedExerciseEntry {
  date: string;
  sets?: string;
  reps?: string;
  weight?: string;
}

/**
 * Scans localStorage for every dated exercise log entry and rolls them up
 * into per-date session-volume metrics (sets * reps * weight, leniently
 * parsed). Real data only.
 */
export function deriveWorkoutHistory(lookbackDays = 35): PerformanceMetric[] {
  if (typeof window === 'undefined') return [];
  const byDate = new Map<string, number>();

  for (let i = 0; i < window.localStorage.length; i++) {
    const key = window.localStorage.key(i);
    if (!key) continue;
    const match = key.match(DATED_LOG_RE);
    if (!match) continue;
    const raw = window.localStorage.getItem(key);
    if (!raw) continue;
    let entry: LoggedExerciseEntry;
    try {
      entry = JSON.parse(raw);
    } catch {
      continue;
    }
    const date = entry.date || match[1];
    const sets = parseLeadingNumber(entry.sets) || 1;
    const reps = parseLeadingNumber(entry.reps) || 1;
    const weight = parseLeadingNumber(entry.weight);
    const volume = sets * reps * (weight || 1); // bodyweight work still counts as volume=sets*reps
    byDate.set(date, (byDate.get(date) || 0) + volume);
  }

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - lookbackDays);

  return Array.from(byDate.entries())
    .filter(([date]) => new Date(date) >= cutoff)
    .map(([date, sessionVolume]) => ({ date, sessionVolume, rpe: 0 }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Calculates Acute-to-Chronic Workload Ratio (ACWR) and proposes weight
 * adjustments to keep training in the 0.8-1.3 optimal zone.
 * (Blueprint SECTION 2.3, verbatim algorithm.)
 */
export function calculateAdaptiveLoad(
  history: PerformanceMetric[],
  currentSession: ExerciseSession,
  targetACWR = 1.1,
): AdaptiveLoadResult {
  void targetACWR; // reserved for future PID-style convergence; current impl uses banded thresholds
  const now = new Date();
  const getDaysAgo = (d: string) => Math.floor((now.getTime() - new Date(d).getTime()) / (1000 * 60 * 60 * 24));

  const acuteLoads = history.filter(h => getDaysAgo(h.date) <= 7).map(h => h.sessionVolume);
  const chronicLoads = history.filter(h => getDaysAgo(h.date) <= 28).map(h => h.sessionVolume);

  const acuteAvg = acuteLoads.length > 0 ? acuteLoads.reduce((a, b) => a + b, 0) / 7 : 0;
  const chronicAvg = chronicLoads.length > 0 ? chronicLoads.reduce((a, b) => a + b, 0) / 28 : 1; // avoid divide by zero

  const acwr = acuteAvg / chronicAvg;
  let multiplier = 1.0;
  let recommendation = 'Maintain current training intensity.';

  if (acwr > 1.5) {
    multiplier = 0.9; // 10% de-load to prevent injury
    recommendation = `ACWR is in the danger zone (${acwr.toFixed(2)}). De-loading current session by 10% to prevent overtraining.`;
  } else if (acwr < 0.8 && history.length >= 7) {
    multiplier = 1.05; // 5% progression bump
    recommendation = `Chronic load is strong. Safely increasing current session by 5% to stimulate adaptation.`;
  } else if (history.length < 7) {
    recommendation = 'Building baseline — log a full week of sessions to activate adaptive adjustments.';
  }

  return {
    adjustedSession: {
      ...currentSession,
      weightLbs: Math.round((currentSession.weightLbs * multiplier) / 5) * 5,
    },
    acwr,
    recommendation,
  };
}

export function acwrZone(acwr: number): 'danger' | 'low' | 'optimal' | 'building' {
  if (acwr === 0) return 'building';
  if (acwr > 1.5) return 'danger';
  if (acwr < 0.8) return 'low';
  return 'optimal';
}

export function acwrZoneColor(zone: ReturnType<typeof acwrZone>): { text: string; bg: string; border: string; glow: string } {
  switch (zone) {
    case 'danger':
      return { text: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/40', glow: 'shadow-red-500/20' };
    case 'low':
      return { text: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/40', glow: 'shadow-amber-500/20' };
    case 'building':
      return { text: 'text-gray-400', bg: 'bg-gray-500/10', border: 'border-gray-500/30', glow: 'shadow-gray-500/10' };
    default:
      return { text: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/40', glow: 'shadow-emerald-500/20' };
  }
}

/** Estimates a whole-day target/logged volume pair for a specific day-of-program log prefix. */
export function deriveDayVolume(logKeyPrefix: string, day: string): { loggedVolumeLbs: number; sessionsLogged: number } {
  if (typeof window === 'undefined') return { loggedVolumeLbs: 0, sessionsLogged: 0 };
  const prefix = `${logKeyPrefix}:${day}:`;
  let loggedVolumeLbs = 0;
  let sessionsLogged = 0;

  for (let i = 0; i < window.localStorage.length; i++) {
    const key = window.localStorage.key(i);
    if (!key || !key.startsWith(prefix) || key.endsWith(':completed')) continue;
    if (!DATED_LOG_RE.test(key)) continue;
    const raw = window.localStorage.getItem(key);
    if (!raw) continue;
    try {
      const entry: LoggedExerciseEntry = JSON.parse(raw);
      const sets = parseLeadingNumber(entry.sets) || 1;
      const reps = parseLeadingNumber(entry.reps) || 1;
      const weight = parseLeadingNumber(entry.weight);
      loggedVolumeLbs += sets * reps * (weight || 1);
      sessionsLogged += 1;
    } catch {
      // ignore malformed entry
    }
  }
  return { loggedVolumeLbs: Math.round(loggedVolumeLbs), sessionsLogged };
}
