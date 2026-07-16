'use client';

import { useEffect, useState } from 'react';
import { Play, Clipboard, Check, ChevronRight, Scale, Timer, Calendar, Plus, Save, X, Dumbbell } from 'lucide-react';

type ExerciseData = {
  id?: string;
  name: string;
  sets?: number;
  reps?: string;
  duration?: string;
  distance?: string;
  weight?: string;
  notes?: string;
  videoId?: string;
};

interface ExerciseProps {
  exercise: ExerciseData;
  logKeyBase: string;      // e.g. sfprep:log:foundation:1:monday:<exId>
  isCompleted: boolean;
  onToggleComplete: () => void;
}

type LogEntry = {
  date: string;
  sets?: string;
  reps?: string;
  weight?: string;
  time?: string;
  notes?: string;
};

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function Exercise({ exercise, logKeyBase, isCompleted, onToggleComplete }: ExerciseProps) {
  const [showVideo, setShowVideo] = useState(false);
  const [showLog, setShowLog] = useState(false);
  const [entry, setEntry] = useState<LogEntry>({ date: todayISO() });
  const [saved, setSaved] = useState<LogEntry | null>(null);

  const logKey = `${logKeyBase}:${entry.date}`;

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const raw = localStorage.getItem(logKey);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as LogEntry;
        setSaved(parsed);
        setEntry(parsed);
      } catch { /* ignore */ }
    } else {
      setSaved(null);
    }
  }, [logKey]);

  const save = () => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(logKey, JSON.stringify(entry));
    setSaved(entry);
    setShowLog(false);
  };

  return (
    <div
      className={`p-4 rounded-2xl border transition-all duration-300 relative ${
        isCompleted
          ? 'bg-gray-900/80 border-emerald-500/20 opacity-80'
          : 'bg-gray-900/40 border-gray-800/60 hover:bg-gray-900 hover:border-gray-800'
      }`}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Checkbox + Title + Stats */}
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <button
            onClick={onToggleComplete}
            className={`w-6 h-6 shrink-0 rounded-lg border-2 flex items-center justify-center transition-all cursor-pointer ${
              isCompleted
                ? 'bg-emerald-500 border-emerald-500 text-white shadow-[0_0_10px_rgba(16,185,129,0.3)]'
                : 'border-gray-700 hover:border-gray-500 text-transparent'
            }`}
            aria-label="toggle complete"
          >
            <Check className="w-3.5 h-3.5 stroke-[3]" />
          </button>
          
          <div className="flex-1 min-w-0">
            <h4 className={`font-bold text-sm md:text-base tracking-wide transition-colors ${
              isCompleted ? 'line-through text-gray-500' : 'text-gray-100'
            }`}>
              {exercise.name}
            </h4>

            {/* Target parameters */}
            <div className="mt-1.5 flex flex-wrap gap-2 text-xs font-mono">
              {exercise.sets && (
                <span className="flex items-center gap-1 bg-gray-950 text-gray-400 border border-gray-800 px-2 py-0.5 rounded-md">
                  <Dumbbell className="w-3 h-3 text-emerald-400" />
                  <span>{exercise.sets} Sets</span>
                </span>
              )}
              {exercise.reps && (
                <span className="flex items-center gap-1 bg-gray-950 text-gray-400 border border-gray-800 px-2 py-0.5 rounded-md">
                  <span className="text-emerald-400 font-bold">×</span>
                  <span>{exercise.reps} Reps</span>
                </span>
              )}
              {exercise.duration && (
                <span className="flex items-center gap-1 bg-gray-950 text-gray-400 border border-gray-800 px-2 py-0.5 rounded-md">
                  <Timer className="w-3 h-3 text-cyan-400" />
                  <span>{exercise.duration}</span>
                </span>
              )}
              {exercise.distance && (
                <span className="flex items-center gap-1 bg-gray-950 text-gray-400 border border-gray-800 px-2 py-0.5 rounded-md">
                  <Scale className="w-3 h-3 text-blue-400" />
                  <span>{exercise.distance}</span>
                </span>
              )}
              {exercise.weight && (
                <span className="flex items-center gap-1 bg-gray-950 text-gray-300 border border-gray-800 px-2 py-0.5 rounded-md font-bold">
                  <span>LOAD: {exercise.weight}</span>
                </span>
              )}
            </div>

            {exercise.notes && (
              <p className="mt-2 text-xs text-gray-500 italic leading-relaxed pl-1 border-l border-gray-800">
                {exercise.notes}
              </p>
            )}

            {/* Logged state readout */}
            {saved && (
              <div className="mt-2.5 flex items-center gap-2 text-xs text-emerald-400 font-mono bg-emerald-950/20 border border-emerald-500/20 px-3 py-1.5 rounded-xl self-start inline-flex">
                <Clipboard className="w-3.5 h-3.5 shrink-0" />
                <span>
                  Logged {saved.date}: {[
                    saved.sets && `${saved.sets} sets`,
                    saved.reps && `${saved.reps} reps`,
                    saved.weight && `${saved.weight} lb`,
                    saved.time && saved.time
                  ].filter(Boolean).join(' · ')}
                  {saved.notes ? ` — "${saved.notes}"` : ''}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex sm:flex-col items-center sm:items-stretch gap-1.5 self-end sm:self-center">
          {exercise.videoId && (
            <button
              onClick={() => setShowVideo(v => !v)}
              className={`flex items-center justify-center gap-1 px-3 py-1.5 rounded-xl text-xs font-mono font-medium transition-all cursor-pointer ${
                showVideo
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                  : 'bg-gray-950 hover:bg-gray-900 border border-gray-800 text-gray-400 hover:text-white'
              }`}
            >
              <Play className="w-3 h-3 shrink-0" />
              <span>{showVideo ? 'Hide Guide' : 'Guide'}</span>
            </button>
          )}
          <button
            onClick={() => setShowLog(l => !l)}
            className={`flex items-center justify-center gap-1 px-3 py-1.5 rounded-xl text-xs font-mono font-medium transition-all cursor-pointer ${
              showLog
                ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/20'
                : 'bg-gray-950 hover:bg-gray-900 border border-gray-800 text-gray-400 hover:text-white'
            }`}
          >
            <Clipboard className="w-3 h-3 shrink-0" />
            <span>{showLog ? 'Cancel' : 'Log'}</span>
          </button>
        </div>
      </div>

      {/* Logging form flyout */}
      {showLog && (
        <div className="mt-4 ml-0 sm:ml-9 p-4 bg-gray-950/60 rounded-2xl border border-gray-800/80 space-y-4">
          <div className="flex items-center gap-1 text-xs font-mono text-emerald-400">
            <Calendar className="w-3.5 h-3.5" />
            <span className="uppercase tracking-wider">LOG RECON DATA</span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div className="col-span-2 md:col-span-1">
              <label className="text-[10px] font-mono text-gray-500 uppercase block mb-1">Date</label>
              <input
                type="date"
                value={entry.date}
                onChange={e => setEntry({...entry, date: e.target.value})}
                className="w-full bg-gray-900 border border-gray-800 text-gray-100 px-3 py-2 rounded-xl text-sm font-mono focus:border-emerald-500/50 focus:outline-none transition-colors"
              />
            </div>
            <div>
              <label className="text-[10px] font-mono text-gray-500 uppercase block mb-1">Sets Achieved</label>
              <input
                value={entry.sets ?? ''}
                placeholder={exercise.sets?.toString() ?? 'e.g. 5'}
                onChange={e => setEntry({...entry, sets: e.target.value})}
                className="w-full bg-gray-900 border border-gray-800 text-gray-100 px-3 py-2 rounded-xl text-sm font-mono focus:border-emerald-500/50 focus:outline-none transition-colors"
              />
            </div>
            <div>
              <label className="text-[10px] font-mono text-gray-500 uppercase block mb-1">Reps/Set</label>
              <input
                value={entry.reps ?? ''}
                placeholder={exercise.reps ?? 'e.g. 10'}
                onChange={e => setEntry({...entry, reps: e.target.value})}
                className="w-full bg-gray-900 border border-gray-800 text-gray-100 px-3 py-2 rounded-xl text-sm font-mono focus:border-emerald-500/50 focus:outline-none transition-colors"
              />
            </div>
            <div>
              <label className="text-[10px] font-mono text-gray-500 uppercase block mb-1">Weight (lb)</label>
              <input
                value={entry.weight ?? ''}
                placeholder={exercise.weight ?? 'Bodyweight'}
                onChange={e => setEntry({...entry, weight: e.target.value})}
                className="w-full bg-gray-900 border border-gray-800 text-gray-100 px-3 py-2 rounded-xl text-sm font-mono focus:border-emerald-500/50 focus:outline-none transition-colors"
              />
            </div>
            <div className="col-span-2">
              <label className="text-[10px] font-mono text-gray-500 uppercase block mb-1">Time / Pace / Dist</label>
              <input
                value={entry.time ?? ''}
                placeholder={exercise.duration ?? exercise.distance ?? 'e.g. 15 mins'}
                onChange={e => setEntry({...entry, time: e.target.value})}
                className="w-full bg-gray-900 border border-gray-800 text-gray-100 px-3 py-2 rounded-xl text-sm font-mono focus:border-emerald-500/50 focus:outline-none transition-colors"
              />
            </div>
            <div className="col-span-2 md:col-span-3">
              <label className="text-[10px] font-mono text-gray-500 uppercase block mb-1">Performance Notes / Assessment</label>
              <textarea
                value={entry.notes ?? ''}
                rows={2}
                placeholder="RPE, speed, target heart rates..."
                onChange={e => setEntry({...entry, notes: e.target.value})}
                className="w-full bg-gray-900 border border-gray-800 text-gray-100 px-3 py-2 rounded-xl text-sm focus:border-emerald-500/50 focus:outline-none transition-colors"
              />
            </div>
          </div>

          <div className="flex gap-2 justify-end">
            <button
              onClick={() => setShowLog(false)}
              className="flex items-center gap-1.5 px-3 py-2 bg-gray-900 hover:bg-gray-850 text-gray-400 hover:text-white border border-gray-800 rounded-xl text-xs font-mono transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
              <span>Cancel</span>
            </button>
            <button
              onClick={save}
              className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-mono transition-colors shadow-md shadow-emerald-600/10 cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Save Record</span>
            </button>
          </div>
        </div>
      )}

      {/* Guide embed */}
      {showVideo && exercise.videoId && (
        <div className="mt-4 ml-0 sm:ml-9 overflow-hidden rounded-2xl border border-gray-800/80 bg-gray-950 shadow-inner">
          <div className="relative" style={{ paddingBottom: '56.25%' }}>
            <iframe
              className="absolute top-0 left-0 w-full h-full rounded-2xl"
              src={`https://www.youtube.com/embed/${exercise.videoId}`}
              title={exercise.name}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        </div>
      )}
    </div>
  );
}

