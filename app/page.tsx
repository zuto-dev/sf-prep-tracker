'use client';

import { useState } from 'react';
import { WorkoutDay } from './components/WorkoutDay';
import { SfreLifecycle } from './components/SfreLifecycle';
import { Nav } from './components/Nav';
import { FOUNDATION_WEEKS, FOUNDATION_WEEK_COUNT } from './data/workouts';
import { resolveFoundationWeekIndex } from './lib/sfre-program';

const DAYS = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'] as const;

export default function Home() {
  // The active user-facing planner is the 13-week SFRE Foundation program
  // only. There is no generic phase (Foundation/Build/Peak) selector — this
  // tracker never presents Bridge or MTI Peak session content. The current
  // date resolves the default week; a user may still inspect any Foundation
  // week via the selector below.
  const [week, setWeek] = useState<number>(() => resolveFoundationWeekIndex(new Date()));

  const workouts = FOUNDATION_WEEKS[week - 1];
  const logKeyPrefix = `sfprep:log:foundation:${week}`;

  const exportLog = () => {
    if (typeof window === 'undefined') return;
    const out: Record<string, unknown> = {};
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k) continue;
      if (k.startsWith('sfprep:')) {
        try { out[k] = JSON.parse(localStorage.getItem(k) || 'null'); }
        catch { out[k] = localStorage.getItem(k); }
      }
    }
    const blob = new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `sfprep-log-${new Date().toISOString().slice(0,10)}.json`;
    a.click(); URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      {/* Animated background gradient */}
      <div className="fixed inset-0 bg-gradient-to-br from-blue-950/20 via-gray-950 to-purple-950/20 pointer-events-none" />

      {/* Hero Section */}
      <div className="relative bg-gradient-to-b from-blue-950/40 to-transparent backdrop-blur-sm pb-8">
        <div className="max-w-7xl mx-auto p-4">
          <div className="mb-6 flex justify-between items-start flex-wrap gap-4 animate-fade-in">
            <div>
              <h1 className="text-5xl font-black bg-gradient-to-r from-white via-blue-300 to-purple-400 bg-clip-text text-transparent">
                SF Prep Tracker
              </h1>
              <p className="text-gray-400 mt-2 text-lg">
                SFRE Foundation · <span className="text-blue-400 font-semibold">Week {week}/{FOUNDATION_WEEK_COUNT}</span>
              </p>
            </div>
            <button onClick={exportLog}
              className="relative group overflow-hidden bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 px-5 py-2.5 rounded-full text-sm font-bold text-white shadow-lg shadow-emerald-900/30 transition-all duration-300 hover:scale-105 active:scale-95"
            >
              <span className="relative z-10 flex items-center gap-2">
                📥 Export Log JSON
              </span>
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -skew-x-12 animate-shine pointer-events-none" />
            </button>
          </div>

          <Nav />
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-4 -mt-6 relative z-10">
        <SfreLifecycle />

        {/* Week Selector */}
        <div className="bg-gray-900/60 backdrop-blur-md rounded-2xl p-5 border border-gray-800/50 shadow-xl mb-8 flex items-center justify-between flex-wrap gap-4">
          <div>
            <h3 className="text-lg font-bold text-white">Current Week Schedule</h3>
            <p className="text-sm text-gray-400">Select which week of the 13-week SFRE Foundation program to inspect</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-gray-300">Jump to:</span>
            <select value={week} onChange={e => setWeek(Number(e.target.value))}
              className="bg-gray-800 hover:bg-gray-700 text-white font-semibold px-4 py-2.5 rounded-xl text-sm border border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
            >
              {Array.from({ length: FOUNDATION_WEEK_COUNT }, (_, i) => (
                <option key={i + 1} value={i + 1}>Week {i + 1}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Daily Workouts */}
        <div className="space-y-4">
          {DAYS.map((d, i) => (
            <div key={d} className="animate-slide-in-left" style={{ animationDelay: `${i * 80}ms` }}>
              <WorkoutDay day={d} workout={workouts[d]} logKeyPrefix={logKeyPrefix} foundationWeek={week} />
            </div>
          ))}
        </div>
      </div>

      {/* Global CSS animations */}
      <style jsx global>{`
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slide-in-left {
          from { opacity: 0; transform: translateX(-25px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes shine {
          from { transform: translateX(-100%) skewX(-12deg); }
          to { transform: translateX(200%) skewX(-12deg); }
        }
        .animate-fade-in {
          animation: fade-in 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .animate-slide-in-left {
          animation: slide-in-left 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .animate-shine {
          animation: shine 3s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
