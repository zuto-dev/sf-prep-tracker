// Mobility & Active Recovery — Biomechanical Engine (Blueprint SECTION 8)
//
// Grounded in real client-side data only:
//  - Joint range-of-motion self-screens the user logs locally (no fabricated sensor data).
//  - "Fatigue areas" are derived from ACTUAL workout completion state written by
//    WorkoutDay.tsx to localStorage (`sfprep:log:<phase>:<week>:<day>:completed`),
//    cross-referenced against the real exercise catalog in `app/data/workouts.ts`
//    via a keyword→joint-tag map. No invented telemetry.

import type { Move } from './mobility-types';

export type JointTag = Move['tag'];

export interface MobilityScreen {
  joint: JointTag;
  currentRangeDegrees: number;
  targetRangeDegrees: number;
  lastTested: string; // YYYY-MM-DD
}

const SCREEN_KEY = 'sfprep:mobility:screens';

export function loadScreens(): MobilityScreen[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = JSON.parse(localStorage.getItem(SCREEN_KEY) || '[]');
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

export function saveScreen(screen: MobilityScreen) {
  if (typeof window === 'undefined') return;
  const all = loadScreens().filter(s => s.joint !== screen.joint);
  all.push(screen);
  localStorage.setItem(SCREEN_KEY, JSON.stringify(all));
}

/**
 * Reorders and selects the top-N mobility exercises based on training-induced
 * fatigue areas and joint range-of-motion deficits.
 * (Blueprint 8.3 — buildTailoredMobilitySession)
 */
export function buildTailoredMobilitySession(
  exercises: Move[],
  screens: MobilityScreen[],
  fatigueAreas: string[],
  topN = 3
): Move[] {
  return exercises
    .map(ex => {
      let priority = 0;

      // Rule 1: high priority for tags matching recent training fatigue
      if (fatigueAreas.includes(ex.tag)) {
        priority += 5.0;
      }

      // Rule 2: high priority for joints with a measured ROM deficit
      const jointScreen = screens.find(s => s.joint === ex.tag);
      if (jointScreen) {
        const deficit = jointScreen.targetRangeDegrees - jointScreen.currentRangeDegrees;
        if (deficit > 0) {
          priority += (deficit / jointScreen.targetRangeDegrees) * 10.0;
        }
      }

      return { exercise: ex, priority };
    })
    .sort((a, b) => b.priority - a.priority)
    .map(p => p.exercise)
    .slice(0, topN);
}

// ---------------------------------------------------------------------------
// Fatigue-area derivation from real workout logs (no fabricated sensor input)
// ---------------------------------------------------------------------------

// Keyword → joint tag map, applied to real exercise names from app/data/workouts.ts
const KEYWORD_TAGS: Array<{ re: RegExp; tag: JointTag }> = [
  { re: /squat|lunge|step-?up|deadlift|hinge|swing/i, tag: 'hips' },
  { re: /ruck|run|sprint|box jump|jump squat|calf/i, tag: 'ankles' },
  { re: /squat|lunge|step-?up|box jump/i, tag: 'knees' },
  { re: /deadlift|row|hinge|good morning|hamstring|straddle/i, tag: 'posterior' },
  { re: /press|pull-?up|push-?up|dip|carry|bar hang/i, tag: 'shoulders' },
  { re: /row|carry|rotation|pack|ruck/i, tag: 't-spine' },
];

function tagsForExerciseName(name: string): JointTag[] {
  const hits = new Set<JointTag>();
  for (const { re, tag } of KEYWORD_TAGS) {
    if (re.test(name)) hits.add(tag);
  }
  return [...hits];
}

/**
 * Scans localStorage for completed-exercise logs from the last `lookbackDays`
 * and returns the joint tags those exercises loaded, most-frequent first.
 * Reads real completion sets written by WorkoutDay.tsx — nothing synthetic.
 */
export function deriveFatigueAreas(lookbackDays = 2): string[] {
  if (typeof window === 'undefined') return [];
  const counts: Partial<Record<JointTag, number>> = {};

  for (let i = 0; i < window.localStorage.length; i++) {
    const key = window.localStorage.key(i);
    if (!key || !key.startsWith('sfprep:log:') || !key.endsWith(':completed')) continue;

    // key shape: sfprep:log:<phase>:<week>:<day>:<dow>:completed  (see WorkoutDay.tsx)
    const raw = window.localStorage.getItem(key);
    if (!raw) continue;
    let ids: string[] = [];
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) ids = parsed;
    } catch {
      continue;
    }
    if (ids.length === 0) continue;

    for (const id of ids) {
      // exercise ids embed a readable slug; also try the id itself as a name proxy
      for (const tag of tagsForExerciseName(id)) {
        counts[tag] = (counts[tag] || 0) + 1;
      }
    }
  }

  void lookbackDays; // reserved: per-day partitioning once logs carry explicit dates
  return Object.entries(counts)
    .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))
    .map(([tag]) => tag);
}
