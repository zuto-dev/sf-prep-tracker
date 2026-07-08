'use client';

import { useState } from 'react';
import { Exercise } from './Exercise';
import type { DayWorkout } from '../data/workouts';

interface WorkoutDayProps {
  day: string;
  workout: DayWorkout;
  logKeyPrefix: string; // sfprep:log:foundation:1
}

export function WorkoutDay({ day, workout, logKeyPrefix }: WorkoutDayProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [completed, setCompleted] = useState<Set<string>>(new Set());

  const toggle = (id: string) => {
    setCompleted(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const total = workout.exercises.length;
  const progress = total ? (completed.size / total) * 100 : 0;

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <div className="cursor-pointer" onClick={() => setIsExpanded(v => !v)}>
        <div className="flex justify-between items-center mb-2">
          <div>
            <h2 className="text-xl font-semibold capitalize">{day}</h2>
            {workout.title && <p className="text-xs text-gray-400 mt-0.5">{workout.title}</p>}
          </div>
          <div className="flex items-center gap-4">
            <div className="text-sm text-gray-400">{completed.size} / {total}</div>
            <svg className={`w-6 h-6 transform transition-transform ${isExpanded ? 'rotate-180' : ''}`}
              fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
        <div className="w-full bg-gray-700 rounded-full h-2">
          <div className="bg-blue-600 h-2 rounded-full transition-all" style={{ width: `${progress}%` }} />
        </div>
      </div>

      {isExpanded && (
        <div className="mt-4 space-y-3">
          {workout.exercises.map((ex, idx) => {
            const id = ex.id ?? `${day}-${idx}`;
            return (
              <Exercise
                key={id}
                exercise={ex}
                logKeyBase={`${logKeyPrefix}:${day}:${id}`}
                isCompleted={completed.has(id)}
                onToggleComplete={() => toggle(id)}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
