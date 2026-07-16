'use client';

import { useEffect, useMemo, useState } from 'react';
import { Exercise } from './Exercise';
import { pullSfprepSync, pushSfprepSync } from '../lib/sfprep-sync';
import { deriveWorkoutHistory, deriveDayVolume, calculateAdaptiveLoad, acwrZone, acwrZoneColor } from '../lib/adaptive-engine';
import { getProgramPosition, latestTwoMileSeconds, resolveRuckReadiness } from '../lib/program-state';
import type { DayWorkout } from '../data/workouts';

interface WorkoutDayProps {
  day: string;
  workout: DayWorkout;
  logKeyPrefix: string; // sfprep:log:foundation:1
}

function completedKey(day: string, logKeyPrefix: string) {
  return `${logKeyPrefix}:${day}:completed`;
}

function loadCompleted(key: string) {
  if (typeof window === 'undefined') return new Set<string>();
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return new Set<string>();
    const parsed = JSON.parse(raw) as string[];
    return new Set(Array.isArray(parsed) ? parsed.filter(v => typeof v === 'string') : []);
  } catch {
    return new Set<string>();
  }
}

export function WorkoutDay({ day, workout, logKeyPrefix }: WorkoutDayProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  const [adaptive, setAdaptive] = useState<{ acwr: number; recommendation: string } | null>(null);
  const [dayVolume, setDayVolume] = useState({ loggedVolumeLbs: 0, sessionsLogged: 0 });
  const key = completedKey(day, logKeyPrefix);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    void pullSfprepSync().finally(() => {
      setCompleted(loadCompleted(key));
      refreshAdaptive();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  function refreshAdaptive() {
    const history = deriveWorkoutHistory();
    const volume = deriveDayVolume(logKeyPrefix, day);
    setDayVolume(volume);
    const result = calculateAdaptiveLoad(history, { name: day, reps: 0, sets: 0, weightLbs: 100 });
    setAdaptive({ acwr: result.acwr, recommendation: result.recommendation });
  }

  const persistCompleted = (next: Set<string>) => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(key, JSON.stringify([...next]));
    void pushSfprepSync();
  };

  const toggle = (id: string) => {
    setCompleted(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      persistCompleted(next);
      return next;
    });
  };

  const total = workout.exercises.length;
  const progress = total ? (completed.size / total) * 100 : 0;
  const isComplete = total > 0 && completed.size === total;

  const zone = useMemo(() => acwrZone(adaptive?.acwr ?? 0), [adaptive]);
  const zoneColor = acwrZoneColor(zone);

  return (
    <div
      className={`
        relative overflow-hidden rounded-2xl border backdrop-blur-md transition-all duration-300
        bg-black/40 shadow-xl
        ${isComplete ? 'border-emerald-500/40 shadow-emerald-500/10' : 'border-gray-800/50 shadow-black/20 hover:border-gray-700/60'}
      `}
    >
      {/* Radial glow accent */}
      <div
        className={`pointer-events-none absolute -top-16 -right-16 w-64 h-64 rounded-full blur-3xl opacity-20 ${
          isComplete ? 'bg-emerald-500' : 'bg-blue-600'
        }`}
      />

      <div className="relative p-4">
        <div className="cursor-pointer" onClick={() => setIsExpanded(v => !v)}>
          <div className="flex justify-between items-center mb-2 flex-wrap gap-2">
            <div>
              <h2 className="text-xl font-semibold capitalize text-white flex items-center gap-2">
                {day}
                {isComplete && (
                  <span className="text-[10px] uppercase font-bold tracking-wider bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/30">
                    Complete
                  </span>
                )}
              </h2>
              {workout.title && <p className="text-xs text-gray-400 mt-0.5">{workout.title}</p>}
            </div>
            <div className="flex items-center gap-4">
              {adaptive && (
                <span
                  className={`hidden sm:inline-flex items-center gap-1.5 text-[10px] uppercase font-bold tracking-wider px-2.5 py-1 rounded-full border ${zoneColor.bg} ${zoneColor.text} ${zoneColor.border}`}
                  title={adaptive.recommendation}
                >
                  ACWR {adaptive.acwr.toFixed(2)}
                </span>
              )}
              <div className="text-sm text-gray-400 font-mono">{completed.size} / {total}</div>
              <svg className={`w-6 h-6 transform transition-transform text-gray-400 ${isExpanded ? 'rotate-180' : ''}`}
                fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
          <div className="w-full bg-gray-800/60 rounded-full h-2 overflow-hidden">
            <div
              className={`h-2 rounded-full transition-all duration-700 ease-out ${
                isComplete
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-400 shadow-[0_0_8px_rgba(16,185,129,0.6)]'
                  : 'bg-gradient-to-r from-blue-600 to-blue-400'
              }`}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {isExpanded && (
          <div className="mt-4 space-y-3">
            {adaptive && (
              <div className={`rounded-xl p-3 border text-xs ${zoneColor.bg} ${zoneColor.border} ${zoneColor.text}`}>
                <div className="flex justify-between items-center mb-1">
                  <span className="font-bold uppercase tracking-wider">Adaptive Load Engine</span>
                  <span className="font-mono">Logged {dayVolume.loggedVolumeLbs.toLocaleString()} lb · {dayVolume.sessionsLogged} sessions</span>
                </div>
                <p className="text-gray-300">{adaptive.recommendation}</p>
              </div>
            )}
            {workout.exercises.map((ex, idx) => {
              const id = ex.id ?? `${day}-${idx}`;
              const isRuck = ex.name.toLowerCase().includes('ruck');
              
              let ruckReadiness = null;
              if (isRuck) {
                // Get current program position
                const position = getProgramPosition(new Date());
                const globalWeek = position.globalWeek;
                
                // Get latest 2-mile time
                const standardsRaw = localStorage.getItem('sfprep:standards');
                const progressRaw = localStorage.getItem('sfprep:progress');
                const standards = standardsRaw ? JSON.parse(standardsRaw) : null;
                const progress = progressRaw ? JSON.parse(progressRaw) : null;
                const twoMileSeconds = latestTwoMileSeconds(standards, progress);
                
                // Check readiness
                const readiness = resolveRuckReadiness(globalWeek, twoMileSeconds);
                if (readiness.status === 'blocked') {
                  ruckReadiness = {
                    canRuck: false,
                    message: `Ruck blocked until 2-mile ≤ 16:00. Current: ${twoMileSeconds ? `${Math.floor(twoMileSeconds / 60)}:${(twoMileSeconds % 60).toString().padStart(2, '0')}` : 'not logged'}. Substitute: ${readiness.substitute}`
                  };
                }
              }
              
              return (
                <div key={id}>
                  {isRuck && ruckReadiness && !ruckReadiness.canRuck && (
                    <div className="rounded-xl p-3 mb-3 border text-xs bg-red-500/10 border-red-500/30 text-red-400">
                      <div className="flex items-center gap-2 mb-1">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        <span className="font-bold uppercase tracking-wider">Ruck Readiness Gate</span>
                      </div>
                      <p>{ruckReadiness.message}</p>
                    </div>
                  )}
                  <Exercise
                    key={id}
                    exercise={ex}
                    logKeyBase={`${logKeyPrefix}:${day}:${id}`}
                    isCompleted={completed.has(id)}
                    onToggleComplete={() => toggle(id)}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
