'use client';

import { useEffect, useState } from 'react';
import { pullSfprepSync, pushSfprepSync } from '../lib/sfprep-sync';

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
  locked?: boolean;
  lockReason?: string;
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

export function Exercise({ exercise, logKeyBase, isCompleted, onToggleComplete, locked = false, lockReason }: ExerciseProps) {
  const [showVideo, setShowVideo] = useState(false);
  const [showLog, setShowLog] = useState(false);
  const [entry, setEntry] = useState<LogEntry>({ date: todayISO() });
  const [saved, setSaved] = useState<LogEntry | null>(null);

  const logKey = `${logKeyBase}:${entry.date}`;

  useEffect(() => {
    if (typeof window === 'undefined') return;
    void pullSfprepSync().finally(() => {
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
    });
  }, [logKey]);

  const save = () => {
    if (locked) return; // mechanically impossible to write a new log while locked
    if (typeof window === 'undefined') return;
    localStorage.setItem(logKey, JSON.stringify(entry));
    void pushSfprepSync();
    setSaved(entry);
    setShowLog(false);
  };

  return (
    <div className={`border p-3 ${isCompleted ? 'border-emerald-900/50 bg-emerald-950/10' : 'border-gray-900 bg-black/20'} ${locked ? 'opacity-75' : ''}`}>
      <div className="flex justify-between items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3">
            <button
              onClick={onToggleComplete}
              disabled={locked}
              aria-disabled={locked}
              aria-label={locked ? `toggle complete (locked: ${lockReason ?? 'session locked'})` : 'toggle complete'}
              title={locked ? lockReason : undefined}
              className={`w-6 h-6 shrink-0 border flex items-center justify-center ${
                locked
                  ? 'border-gray-700 bg-gray-800 cursor-not-allowed opacity-60'
                  : isCompleted ? 'bg-emerald-700 border-emerald-700' : 'border-gray-700 hover:border-gray-500'
              }`}
            >
              {isCompleted && !locked && (
                <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              )}
              {locked && (
                <svg className="w-3.5 h-3.5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              )}
            </button>
            <h3 className={`font-medium ${isCompleted && !locked ? 'line-through text-gray-500' : ''}`}>{exercise.name}</h3>
          </div>
          <div className="ml-9 mt-1 text-sm text-gray-400 flex flex-wrap gap-x-3">
            {exercise.sets ? <span>{exercise.sets} sets</span> : null}
            {exercise.reps ? <span>{exercise.reps} reps</span> : null}
            {exercise.duration ? <span>{exercise.duration}</span> : null}
            {exercise.distance ? <span>{exercise.distance}</span> : null}
            {exercise.weight ? <span>{exercise.weight}</span> : null}
          </div>
          {locked && (
            <p role="status" className="ml-9 mt-2 text-xs text-red-400">
              Locked{lockReason ? `: ${lockReason}` : ''}
            </p>
          )}
          {exercise.notes && (
            <p className="ml-9 mt-2 text-xs text-gray-500 italic">{exercise.notes}</p>
          )}
          {saved && (
            <div className="ml-9 mt-2 text-xs text-emerald-400">
              Logged {saved.date}: {[saved.sets && `${saved.sets}×`, saved.reps && `${saved.reps} reps`, saved.weight && saved.weight, saved.time && saved.time].filter(Boolean).join(' · ')}
              {saved.notes ? ` — ${saved.notes}` : ''}
            </div>
          )}
        </div>
        <div className="flex flex-col gap-1 shrink-0">
          {exercise.videoId && (
            <button
              onClick={() => setShowVideo(v => !v)}
              className="border border-gray-800 px-3 py-1 text-[10px] uppercase tracking-wider text-gray-500 hover:text-white"
            >
              {showVideo ? 'Hide' : 'Video'}
            </button>
          )}
          <button
            onClick={() => setShowLog(l => !l)}
            disabled={locked}
            aria-disabled={locked}
            title={locked ? lockReason : undefined}
            className={`border px-3 py-1 text-[10px] uppercase tracking-wider ${
              locked ? 'border-gray-900 text-gray-700 cursor-not-allowed' : 'border-gray-800 text-gray-500 hover:text-white'
            }`}
          >
            {showLog ? 'Close' : 'Log'}
          </button>
        </div>
      </div>

      {showLog && !locked && (
        <div className="mt-3 ml-9 p-3 bg-black/40 space-y-2 border border-gray-900">
          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs text-gray-400">
              Date
              <input type="date" value={entry.date} onChange={e => setEntry({...entry, date: e.target.value})}
                className="w-full bg-black text-gray-100 px-2 py-1 border border-gray-800 text-sm mt-1" />
            </label>
            <label className="text-xs text-gray-400">
              Sets
              <input value={entry.sets ?? ''} placeholder={exercise.sets?.toString() ?? ''}
                onChange={e => setEntry({...entry, sets: e.target.value})}
                className="w-full bg-black text-gray-100 px-2 py-1 border border-gray-800 text-sm mt-1" />
            </label>
            <label className="text-xs text-gray-400">
              Reps
              <input value={entry.reps ?? ''} placeholder={exercise.reps ?? ''}
                onChange={e => setEntry({...entry, reps: e.target.value})}
                className="w-full bg-black text-gray-100 px-2 py-1 border border-gray-800 text-sm mt-1" />
            </label>
            <label className="text-xs text-gray-400">
              Weight
              <input value={entry.weight ?? ''} placeholder={exercise.weight ?? 'lb'}
                onChange={e => setEntry({...entry, weight: e.target.value})}
                className="w-full bg-black text-gray-100 px-2 py-1 border border-gray-800 text-sm mt-1" />
            </label>
            <label className="text-xs text-gray-400 col-span-2">
              Time / Distance
              <input value={entry.time ?? ''} placeholder={exercise.duration ?? exercise.distance ?? ''}
                onChange={e => setEntry({...entry, time: e.target.value})}
                className="w-full bg-black text-gray-100 px-2 py-1 border border-gray-800 text-sm mt-1" />
            </label>
            <label className="text-xs text-gray-400 col-span-2">
              Notes
              <textarea value={entry.notes ?? ''} rows={2}
                onChange={e => setEntry({...entry, notes: e.target.value})}
                className="w-full bg-black text-gray-100 px-2 py-1 border border-gray-800 text-sm mt-1" />
            </label>
          </div>
          <div className="flex gap-2">
            <button onClick={save} className="bg-white px-3 py-1 text-sm text-black hover:bg-gray-200">Save</button>
            <button onClick={() => setShowLog(false)} className="border border-gray-800 px-3 py-1 text-sm text-gray-500 hover:text-white">Cancel</button>
          </div>
        </div>
      )}

      {showVideo && exercise.videoId && (
        <div className="mt-4 ml-9">
          <div className="relative" style={{ paddingBottom: '56.25%' }}>
            <iframe
              className="absolute top-0 left-0 w-full h-full"
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
