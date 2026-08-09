import type { DayWorkout, WeekWorkout } from '../data/workouts.ts';

const DAY_KEYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;
const DAY_MS = 24 * 60 * 60 * 1000;

export type MissionPresentation = {
  title: string;
  type: string;
  intensity: 'Low' | 'Moderate' | 'High' | 'Recovery';
  dose: string;
};

export type HomeEventStatus = {
  state: 'date-required' | 'countdown' | 'post-event';
  label: string;
  detail: string;
  daysUntilEvent: number | null;
};

function cleanTitle(title?: string): string {
  if (!title) return 'Rest Day';
  return title
    .replace(/\s*\((?:TEST|test)\)\s*/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function describeMission(workout: DayWorkout): MissionPresentation {
  const title = cleanTitle(workout.title);
  const lower = title.toLowerCase();
  const movementCount = workout.exercises.length;

  if (lower.includes('rest')) {
    return { title, type: 'Recovery', intensity: 'Recovery', dose: 'Recovery protocol' };
  }
  if (lower.includes('time trial') || lower.includes('test')) {
    return { title, type: 'Assessment', intensity: 'High', dose: `${movementCount} steps · Timed assessment` };
  }
  if (lower.includes('speed')) {
    return { title, type: 'Speed', intensity: 'High', dose: `${movementCount} movements · 1 session` };
  }
  if (lower.includes('ruck')) {
    return { title, type: 'Ruck', intensity: 'Moderate', dose: `${movementCount} movements · Walking only` };
  }
  if (lower.includes('recovery')) {
    return { title, type: 'Recovery', intensity: 'Low', dose: `${movementCount} movements · Easy effort` };
  }
  if (lower.includes('run') && (lower.includes('strength') || lower.includes('upper') || lower.includes('lower'))) {
    return { title, type: 'Run + Strength', intensity: 'Moderate', dose: `${movementCount} movements · 1 session` };
  }
  if (lower.includes('strength') || lower.includes('work capacity')) {
    return { title, type: 'Strength', intensity: 'Moderate', dose: `${movementCount} movements · 1 session` };
  }
  if (lower.includes('run') || lower.includes('tempo')) {
    return { title, type: 'Run', intensity: lower.includes('tempo') ? 'High' : 'Low', dose: `${movementCount} movements · 1 session` };
  }
  return { title, type: 'Training', intensity: 'Moderate', dose: `${movementCount} movements · 1 session` };
}

export function resolveHomeEventStatus(
  confirmedSfreDate: string | null,
  now: Date,
): HomeEventStatus {
  if (!confirmedSfreDate) {
    return {
      state: 'date-required',
      label: 'Event date not set',
      detail: 'Add it when your SFRE date is confirmed',
      daysUntilEvent: null,
    };
  }

  const event = new Date(confirmedSfreDate);
  if (!Number.isFinite(event.getTime())) {
    return {
      state: 'date-required',
      label: 'Event date not set',
      detail: 'Add it when your SFRE date is confirmed',
      daysUntilEvent: null,
    };
  }

  const daysUntilEvent = Math.ceil((event.getTime() - now.getTime()) / DAY_MS);
  const formatted = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(event);

  if (daysUntilEvent < 0) {
    return {
      state: 'post-event',
      label: 'SFRE date passed',
      detail: `Confirmed event date: ${formatted}`,
      daysUntilEvent,
    };
  }

  return {
    state: 'countdown',
    label: `${daysUntilEvent} days to SFRE`,
    detail: `Confirmed event date: ${formatted}`,
    daysUntilEvent,
  };
}

export function countCompletedDays(
  week: WeekWorkout,
  completionByDay: Partial<Record<(typeof DAY_KEYS)[number], string[]>>,
): { completed: number; total: number; completedDays: string[] } {
  const completedDays = DAY_KEYS.filter(day => {
    const requiredIds = week[day].exercises.map(exercise => exercise.id).filter(Boolean);
    const logged = new Set(completionByDay[day] ?? []);
    return requiredIds.length > 0 && requiredIds.every(id => logged.has(id));
  });

  return {
    completed: completedDays.length,
    total: DAY_KEYS.length,
    completedDays: [...completedDays],
  };
}
