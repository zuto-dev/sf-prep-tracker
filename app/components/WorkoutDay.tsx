'use client';

import { useEffect, useState } from 'react';
import { Exercise } from './Exercise';
import type { DayWorkout } from '../data/workouts';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronDown, Compass, Waves, Zap, Dumbbell, Award, Heart, Flame, CheckCircle2, Circle } from 'lucide-react';

interface WorkoutDayProps {
  day: string;
  workout: DayWorkout;
  logKeyPrefix: string; // sfprep:log:foundation:1
}

export function WorkoutDay({ day, workout, logKeyPrefix }: WorkoutDayProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [completed, setCompleted] = useState<Set<string>>(new Set());

  const compKey = `sfprep:completed-set:${logKeyPrefix}:${day}`;

  // Read state from localStorage on load
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const raw = localStorage.getItem(compKey);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as string[];
        setCompleted(new Set(parsed));
      } catch {
        setCompleted(new Set());
      }
    } else {
      setCompleted(new Set());
    }
  }, [compKey]);

  const toggle = (id: string) => {
    setCompleted(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      if (typeof window !== 'undefined') {
        localStorage.setItem(compKey, JSON.stringify(Array.from(next)));
      }
      return next;
    });
  };

  const total = workout.exercises.length;
  const progress = total ? (completed.size / total) * 100 : 0;
  const isFullyCompleted = total > 0 && completed.size === total;

  // Identify workout archetype
  const getCategory = (title: string = '') => {
    const t = title.toLowerCase();
    if (t.includes('ruck')) return { label: 'Ruck', color: 'bg-amber-500/10 text-amber-400 border-amber-500/25', icon: Compass };
    if (t.includes('swim') || t.includes('pool') || t.includes('water') || t.includes('laps')) return { label: 'Water Ops', color: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/25', icon: Waves };
    if (t.includes('run') || t.includes('track') || t.includes('interval') || t.includes('tempo') || t.includes('mile')) return { label: 'Conditioning', color: 'bg-blue-500/10 text-blue-400 border-blue-500/25', icon: Zap };
    if (t.includes('strength') || t.includes('lift') || t.includes('weight') || t.includes('bench') || t.includes('deadlift')) return { label: 'Strength', color: 'bg-violet-500/10 text-violet-400 border-violet-500/25', icon: Dumbbell };
    if (t.includes('pt') || t.includes('test') || t.includes('calisthenics') || t.includes('push') || t.includes('pull')) return { label: 'Calisthenics', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25', icon: Award };
    if (t.includes('rest') || t.includes('recovery') || t.includes('off') || !total) return { label: 'Recovery', color: 'bg-zinc-500/10 text-zinc-400 border-zinc-800', icon: Heart };
    return { label: 'Tactical', color: 'bg-red-500/10 text-red-400 border-red-500/25', icon: Flame };
  };

  const cat = getCategory(workout.title || (total === 0 ? 'Rest Day' : ''));
  const IconComponent = cat.icon;

  return (
    <div
      className={`border rounded-2xl transition-all duration-300 ${
        isFullyCompleted
          ? 'bg-emerald-950/10 border-emerald-500/20 shadow-[0_4px_20px_rgba(16,185,129,0.02)]'
          : isExpanded
          ? 'bg-gray-900 border-gray-800 shadow-xl'
          : 'bg-gray-900/40 border-gray-800/80 hover:bg-gray-900 hover:border-gray-700'
      }`}
    >
      <div
        className="p-4 md:p-5 cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-4 select-none"
        onClick={() => setIsExpanded(v => !v)}
      >
        {/* Day Header Info */}
        <div className="flex items-start gap-4">
          <div className={`p-3 rounded-xl border shrink-0 transition-colors ${
            isFullyCompleted ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-400' : 'bg-gray-950 border-gray-800 text-gray-400'
          }`}>
            <IconComponent className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-lg font-bold font-display capitalize text-white tracking-wide">
                {day}
              </h3>
              <span className={`text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded border ${cat.color}`}>
                {cat.label}
              </span>
              {isFullyCompleted && (
                <span className="flex items-center gap-1 text-[10px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>COMPLETE</span>
                </span>
              )}
            </div>
            <p className="text-gray-400 text-xs md:text-sm mt-1 font-sans leading-relaxed truncate max-w-md md:max-w-xl">
              {workout.title || (total === 0 ? 'Off-duty / Rest & Muscle recovery' : 'Tactical Workout')}
            </p>
          </div>
        </div>

        {/* Completion Ring / Progress Bars */}
        <div className="flex items-center justify-between md:justify-end gap-4 border-t border-gray-800/40 pt-3 md:pt-0 md:border-0 shrink-0">
          {total > 0 ? (
            <div className="flex items-center gap-3">
              <span className="font-mono text-xs text-gray-400">
                {completed.size} / {total} <span className="text-gray-600">Tasks</span>
              </span>
              <div className="w-24 md:w-32 bg-gray-950 rounded-full h-2 overflow-hidden border border-gray-800/60 relative">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    isFullyCompleted ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.3)]' : 'bg-blue-500'
                  }`}
                  style={{ width: `${progress}%` }}
                />
              </div>
              <span className={`font-mono text-xs w-8 text-right font-bold ${isFullyCompleted ? 'text-emerald-400' : 'text-gray-300'}`}>
                {Math.round(progress)}%
              </span>
            </div>
          ) : (
            <span className="font-mono text-xs text-gray-500 uppercase tracking-widest bg-gray-950 px-2.5 py-1 rounded border border-gray-800/80">
              REST LOCK
            </span>
          )}

          <ChevronDown className={`w-5 h-5 text-gray-500 transition-transform duration-300 shrink-0 ${isExpanded ? 'rotate-180' : ''}`} />
        </div>
      </div>

      {/* Exercises Expandable Panel */}
      <AnimatePresence initial={false}>
        {isExpanded && total > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className="overflow-hidden border-t border-gray-800"
          >
            <div className="p-4 md:p-5 space-y-3 bg-gray-950/40">
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
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

