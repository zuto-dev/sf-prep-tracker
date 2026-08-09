'use client';

import { useEffect, useRef, useState } from 'react';
import type { DayWorkout, Exercise } from '../data/workouts';

interface GuidedSessionProps {
  workout: DayWorkout;
  dayKey: string;
  logKeyPrefix: string;
  completedSet: Set<string>;
  onToggleComplete: (id: string) => void;
  onExit: () => void;
}

function parseDuration(duration?: string): number | null {
  if (!duration) return null;
  const minMatch = duration.match(/(\d+)\s*min/i);
  if (minMatch) return parseInt(minMatch[1]) * 60;
  const secMatch = duration.match(/(\d+)\s*sec/i);
  if (secMatch) return parseInt(secMatch[1]);
  return null;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}:${s.toString().padStart(2, '0')}` : `${s}s`;
}

type Phase = 'intro' | 'exercise' | 'rest' | 'done';

export function GuidedSession({ workout, dayKey, logKeyPrefix, completedSet, onToggleComplete, onExit }: GuidedSessionProps) {
  const exercises = workout.exercises;
  const total = exercises.length;
  const [index, setIndex] = useState(-1); // -1 = intro screen
  const [phase, setPhase] = useState<Phase>('intro');
  const [timer, setTimer] = useState(0);
  const [restTimer, setRestTimer] = useState(60);
  const [isPaused, setIsPaused] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const currentExercise: Exercise | null = index >= 0 && index < total ? exercises[index] : null;
  const exerciseId = currentExercise?.id ?? `${dayKey}-${index}`;
  const isCompleted = completedSet.has(exerciseId);
  const progress = total > 0 ? ((index + (phase === 'done' ? 1 : 0)) / total) * 100 : 0;

  // Timer for timed exercises
  useEffect(() => {
    if (phase !== 'exercise' || isPaused) {
      if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
      return;
    }
    const duration = currentExercise ? parseDuration(currentExercise.duration) : null;
    if (!duration) return;

    intervalRef.current = setInterval(() => {
      setTimer(t => {
        if (t + 1 >= duration) {
          if (intervalRef.current) clearInterval(intervalRef.current);
          return duration;
        }
        return t + 1;
      });
    }, 1000);

    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [phase, isPaused, index, currentExercise]);

  // Rest timer
  useEffect(() => {
    if (phase !== 'rest' || isPaused) {
      if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
      return;
    }
    intervalRef.current = setInterval(() => {
      setRestTimer(t => {
        if (t <= 1) {
          if (intervalRef.current) clearInterval(intervalRef.current);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [phase, isPaused]);

  function startSession() {
    setIndex(0);
    setPhase('exercise');
    setTimer(0);
    setRestTimer(60);
    setIsPaused(false);
  }

  function completeCurrent() {
    if (currentExercise) {
      onToggleComplete(exerciseId);
    }
    advance();
  }

  function advance() {
    if (index + 1 >= total) {
      setPhase('done');
      return;
    }
    setIndex(i => i + 1);
    setPhase('exercise');
    setTimer(0);
    setRestTimer(60);
  }

  function goRest() {
    setPhase('rest');
    setRestTimer(60);
  }

  function skipRest() {
    advance();
  }

  function goBack() {
    if (index > 0) {
      setIndex(i => i - 1);
      setPhase('exercise');
      setTimer(0);
    }
  }

  function restart() {
    setIndex(0);
    setPhase('exercise');
    setTimer(0);
    setRestTimer(60);
    setIsPaused(false);
  }

  const exerciseDuration = currentExercise ? parseDuration(currentExercise.duration) : null;
  const timerProgress = exerciseDuration ? (timer / exerciseDuration) * 100 : 0;
  const restProgress = ((60 - restTimer) / 60) * 100;

  // ─── Intro Screen ──────────────────────────────────
  if (phase === 'intro') {
    return (
      <div className="fixed inset-0 z-50 bg-[#0a0a0b] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-gray-900">
          <button onClick={onExit} className="text-[10px] uppercase tracking-[0.2em] text-gray-600 hover:text-white">
            ← Cancel
          </button>
          <span className="text-[10px] uppercase tracking-[0.2em] text-gray-600">Session Preview</span>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center px-6 max-w-md mx-auto w-full">
          <p className="text-[10px] uppercase tracking-[0.2em] text-gray-600 mb-2">{total} exercises</p>
          <h1 className="text-3xl font-light text-white text-center mb-6">
            {workout.title ?? dayKey}
          </h1>
          <div className="w-full space-y-1 mb-8">
            {exercises.map((ex, i) => (
              <div key={ex.id ?? i} className="flex items-center gap-3 text-xs py-1.5 border-b border-gray-900">
                <span className="font-mono text-gray-700 w-6">{(i + 1).toString().padStart(2, '0')}</span>
                <span className="text-gray-300 flex-1 truncate">{ex.name}</span>
                <span className="text-gray-700 text-[10px]">
                  {[ex.sets && `${ex.sets}×`, ex.reps, ex.duration, ex.distance].filter(Boolean).join(' · ')}
                </span>
              </div>
            ))}
          </div>
          <button
            onClick={startSession}
            className="w-full bg-white py-4 text-[11px] font-black uppercase tracking-[0.18em] text-black hover:bg-gray-200"
          >
            Start Session
          </button>
        </div>
      </div>
    );
  }

  // ─── Done Screen ───────────────────────────────────
  if (phase === 'done') {
    const completedCount = exercises.filter((ex, i) => completedSet.has(ex.id ?? `${dayKey}-${i}`)).length;
    return (
      <div className="fixed inset-0 z-50 bg-[#0a0a0b] flex flex-col">
        <div className="flex-1 flex flex-col items-center justify-center px-6 max-w-md mx-auto w-full">
          <p className="text-[10px] uppercase tracking-[0.2em] text-emerald-500 mb-2">Session Complete</p>
          <h1 className="text-4xl font-light text-white text-center mb-2">
            {completedCount} / {total}
          </h1>
          <p className="text-xs text-gray-600 mb-8">exercises completed</p>
          <div className="w-full space-y-3">
            <button
              onClick={onExit}
              className="w-full bg-white py-4 text-[11px] font-black uppercase tracking-[0.18em] text-black hover:bg-gray-200"
            >
              Done
            </button>
            <button
              onClick={restart}
              className="w-full border border-gray-900 py-3 text-[11px] uppercase tracking-[0.18em] text-gray-500 hover:text-white"
            >
              Redo Session
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── Rest Screen ───────────────────────────────────
  if (phase === 'rest') {
    return (
      <div className="fixed inset-0 z-50 bg-[#0a0a0b] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-gray-900">
          <button onClick={onExit} className="text-[10px] uppercase tracking-[0.2em] text-gray-600 hover:text-white">
            ← Exit
          </button>
          <span className="text-[10px] uppercase tracking-[0.2em] text-gray-600">
            Rest · {index + 1}/{total}
          </span>
          <button onClick={() => setIsPaused(p => !p)} className="text-[10px] uppercase tracking-[0.2em] text-gray-600 hover:text-white">
            {isPaused ? 'Resume' : 'Pause'}
          </button>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center px-6">
          <p className="text-[10px] uppercase tracking-[0.2em] text-gray-600 mb-4">Rest</p>
          <div className="relative w-32 h-32 mb-6">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="45" fill="none" stroke="#1a1a1c" strokeWidth="3" />
              <circle
                cx="50" cy="50" r="45" fill="none" stroke="#3b82f6" strokeWidth="3"
                strokeDasharray={`${restProgress * 2.827} 282.7`}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-4xl font-light font-mono text-white">{restTimer}</span>
            </div>
          </div>
          <p className="text-xs text-gray-600 mb-8 text-center">
            Next: {index + 1 < total ? exercises[index + 1].name : 'Done'}
          </p>
          <div className="w-full max-w-xs space-y-2">
            <button
              onClick={skipRest}
              className="w-full bg-white py-3.5 text-[11px] font-black uppercase tracking-[0.18em] text-black hover:bg-gray-200"
            >
              Skip Rest →
            </button>
            <button
              onClick={() => { setRestTimer(t => t + 30); }}
              className="w-full border border-gray-900 py-2 text-[10px] uppercase tracking-[0.18em] text-gray-500 hover:text-white"
            >
              +30s
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── Exercise Screen ───────────────────────────────
  return (
    <div className="fixed inset-0 z-50 bg-[#0a0a0b] flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between p-4 border-b border-gray-900">
        <button onClick={onExit} className="text-[10px] uppercase tracking-[0.2em] text-gray-600 hover:text-white">
          ← Exit
        </button>
        <span className="text-[10px] uppercase tracking-[0.2em] text-gray-600">
          {index + 1} / {total}
        </span>
        <button onClick={() => setIsPaused(p => !p)} className="text-[10px] uppercase tracking-[0.2em] text-gray-600 hover:text-white">
          {isPaused ? 'Resume' : 'Pause'}
        </button>
      </div>

      {/* Progress bar */}
      <div className="h-px bg-black">
        <div className="h-px bg-blue-600 transition-all duration-500" style={{ width: `${progress}%` }} />
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col px-6 max-w-md mx-auto w-full">
        {/* Timer (if timed exercise) */}
        {exerciseDuration && (
          <div className="pt-6 pb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] uppercase tracking-[0.2em] text-gray-600">
                {isPaused ? 'Paused' : timer >= exerciseDuration ? 'Time' : 'Time'}
              </span>
              <span className="font-mono text-sm text-white">
                {formatTime(timer)} / {formatTime(exerciseDuration)}
              </span>
            </div>
            <div className="w-full bg-black h-px">
              <div
                className={`h-px transition-all duration-1000 ${timer >= exerciseDuration ? 'bg-emerald-500' : 'bg-blue-600'}`}
                style={{ width: `${timerProgress}%` }}
              />
            </div>
          </div>
        )}

        {/* Exercise name */}
        <div className="flex-1 flex flex-col justify-center">
          <p className="text-[10px] uppercase tracking-[0.2em] text-gray-700 mb-2">
            Exercise {index + 1} of {total}
          </p>
          <h1 className="text-3xl font-light text-white mb-4">{currentExercise?.name}</h1>

          {/* Exercise details */}
          <div className="space-y-2 mb-6">
            {currentExercise?.sets && (
              <div className="flex justify-between border-b border-gray-900 py-2">
                <span className="text-xs uppercase tracking-wider text-gray-600">Sets</span>
                <span className="text-sm text-white">{currentExercise.sets}</span>
              </div>
            )}
            {currentExercise?.reps && (
              <div className="flex justify-between border-b border-gray-900 py-2">
                <span className="text-xs uppercase tracking-wider text-gray-600">Reps</span>
                <span className="text-sm text-white">{currentExercise.reps}</span>
              </div>
            )}
            {currentExercise?.weight && (
              <div className="flex justify-between border-b border-gray-900 py-2">
                <span className="text-xs uppercase tracking-wider text-gray-600">Weight</span>
                <span className="text-sm text-white">{currentExercise.weight}</span>
              </div>
            )}
            {currentExercise?.distance && (
              <div className="flex justify-between border-b border-gray-900 py-2">
                <span className="text-xs uppercase tracking-wider text-gray-600">Distance</span>
                <span className="text-sm text-white">{currentExercise.distance}</span>
              </div>
            )}
          </div>

          {/* Notes */}
          {currentExercise?.notes && (
            <div className="border border-gray-900 bg-[#0d0d0f] p-4 mb-6">
              <p className="text-xs text-gray-400 leading-relaxed">{currentExercise.notes}</p>
            </div>
          )}

          {/* Completed indicator */}
          {isCompleted && (
            <p className="text-[10px] uppercase tracking-[0.2em] text-emerald-500 mb-4">✓ Completed</p>
          )}
        </div>

        {/* Controls */}
        <div className="pb-8 space-y-2">
          <div className="flex gap-2">
            {index > 0 && (
              <button
                onClick={goBack}
                className="border border-gray-900 px-4 py-3.5 text-[11px] uppercase tracking-[0.18em] text-gray-500 hover:text-white"
              >
                ←
              </button>
            )}
            <button
              onClick={completeCurrent}
              className="flex-1 bg-white py-3.5 text-[11px] font-black uppercase tracking-[0.18em] text-black hover:bg-gray-200"
            >
              {isCompleted ? 'Next →' : 'Complete & Next →'}
            </button>
          </div>
          <div className="flex gap-2">
            {index + 1 < total && (
              <button
                onClick={goRest}
                className="flex-1 border border-gray-900 py-2.5 text-[10px] uppercase tracking-[0.18em] text-gray-500 hover:text-white"
              >
                Rest 60s
              </button>
            )}
            <button
              onClick={advance}
              className="flex-1 border border-gray-900 py-2.5 text-[10px] uppercase tracking-[0.18em] text-gray-500 hover:text-white"
            >
              Skip →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}