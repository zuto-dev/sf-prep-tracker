'use client';

import { useEffect, useMemo, useState } from 'react';
import { WorkoutDay } from './components/WorkoutDay';
import { Nav } from './components/Nav';
import { PHASES, WEEKS_PER_PHASE, type PhaseKey } from './data/workouts';
import { pullSfprepSync } from './lib/sfprep-sync';
import { deriveWorkoutHistory, calculateAdaptiveLoad, acwrZone, acwrZoneColor } from './lib/adaptive-engine';

const DAYS = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'] as const;

type Patch = {
  id: string;
  title: string;
  action?: string;
  category?: string;
  source?: string;
  approved_at?: string;
};

const PATCH_CAT_COLOR: Record<string, { border: string; bg: string; text: string }> = {
  run: { border: 'border-blue-500', bg: 'bg-blue-500/10', text: 'text-blue-400' },
  ruck: { border: 'border-amber-500', bg: 'bg-amber-500/10', text: 'text-amber-400' },
  strength: { border: 'border-emerald-500', bg: 'bg-emerald-500/10', text: 'text-emerald-400' },
  nutrition: { border: 'border-purple-500', bg: 'bg-purple-500/10', text: 'text-purple-400' },
  recovery: { border: 'border-cyan-500', bg: 'bg-cyan-500/10', text: 'text-cyan-400' },
  other: { border: 'border-gray-500', bg: 'bg-gray-500/10', text: 'text-gray-400' },
};

function ActiveAdjustments() {
  const [patches, setPatches] = useState<Patch[]>([]);
  useEffect(() => {
    fetch('/api/patches')
      .then(r => r.json())
      .then(d => setPatches(Array.isArray(d.patches) ? d.patches : []))
      .catch(() => setPatches([]));
  }, []);
  
  if (!patches.length) return null;
  
  return (
    <div className="backdrop-blur-md bg-gray-900/60 rounded-2xl p-5 mb-8 border border-green-700/30 shadow-xl shadow-green-500/5 animate-fade-in">
      <h2 className="text-xl font-bold mb-1 flex items-center gap-2">
        <span>Active Adjustments</span>
        <span className="text-xs bg-green-500/20 text-green-400 font-semibold px-2.5 py-0.5 rounded-full">
          {patches.length} active
        </span>
      </h2>
      <p className="text-xs text-gray-400 mb-4">Research changes you approved. Fold these into the sessions below.</p>
      <div className="grid sm:grid-cols-2 gap-3">
        {patches.map((p, i) => {
          const colors = PATCH_CAT_COLOR[p.category || 'other'] || PATCH_CAT_COLOR.other;
          return (
            <div key={p.id} 
              className={`bg-gray-950/60 rounded-xl p-3 border-l-4 ${colors.border} transition-all duration-300 hover:scale-[1.02] animate-slide-in-left`}
              style={{ animationDelay: `${i * 100}ms` }}
            >
              <div className="text-sm font-semibold text-white">{p.title}</div>
              {p.action && <div className="text-xs text-gray-300 mt-1">{p.action}</div>}
              {p.category && (
                <span className={`inline-block text-[10px] uppercase font-bold tracking-wider mt-2 px-2 py-0.5 rounded ${colors.bg} ${colors.text}`}>
                  {p.category}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function Home() {
  const [phase, setPhase] = useState<PhaseKey>('foundation');
  const [week, setWeek] = useState(1);

  const workouts = PHASES[phase].weeks[week - 1];
  const logKeyPrefix = `sfprep:log:${phase}:${week}`;

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

  const phaseGlobalWeek = useMemo(() => {
    const idx = (['foundation','build','peak'] as const).indexOf(phase);
    return idx * WEEKS_PER_PHASE + week;
  }, [phase, week]);

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
                Plan D — 18 Month Program · <span className="text-blue-400 font-semibold">Global Week {phaseGlobalWeek}/78</span>
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
        <ActiveAdjustments />

        {/* Phase Selector - Glass cards */}
        <div className="bg-gray-900/60 backdrop-blur-md rounded-2xl p-5 border border-gray-800/50 shadow-xl mb-6">
          <label className="block text-xs uppercase tracking-wider text-gray-400 font-bold mb-3">Select Program Phase</label>
          <div className="flex gap-3 flex-wrap">
            {(['foundation','build','peak'] as PhaseKey[]).map((k, i) => (
              <button key={k} onClick={() => { setPhase(k); setWeek(1); }}
                className={`
                  relative px-5 py-3 rounded-xl text-sm font-bold transition-all duration-300 overflow-hidden flex-1 min-w-[200px] text-left border
                  ${phase === k 
                    ? 'bg-gradient-to-br from-blue-600 to-blue-700 text-white border-blue-500/50 shadow-lg shadow-blue-500/20 scale-105' 
                    : 'bg-gray-800/40 text-gray-300 hover:bg-gray-800/80 border-gray-700/50 hover:border-gray-600'
                  }
                `}
              >
                <div className="relative z-10">
                  <div className="text-base">{PHASES[k].label}</div>
                  <div className={`text-xs mt-1 ${phase === k ? 'text-blue-100' : 'text-gray-400'}`}>{PHASES[k].months}</div>
                </div>
                {phase === k && (
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -skew-x-12 animate-shine" />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Week Selector */}
        <div className="bg-gray-900/60 backdrop-blur-md rounded-2xl p-5 border border-gray-800/50 shadow-xl mb-8 flex items-center justify-between flex-wrap gap-4">
          <div>
            <h3 className="text-lg font-bold text-white">Current Week Schedule</h3>
            <p className="text-sm text-gray-400">Select which week of the {PHASES[phase].label} phase you are in</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-gray-300">Jump to:</span>
            <select value={week} onChange={e => setWeek(Number(e.target.value))}
              className="bg-gray-800 hover:bg-gray-700 text-white font-semibold px-4 py-2.5 rounded-xl text-sm border border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
            >
              {Array.from({ length: WEEKS_PER_PHASE }, (_, i) => (
                <option key={i + 1} value={i + 1}>Week {i + 1}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Daily Workouts */}
        <div className="space-y-4">
          {DAYS.map((d, i) => (
            <div key={d} className="animate-slide-in-left" style={{ animationDelay: `${i * 80}ms` }}>
              <WorkoutDay day={d} workout={workouts[d]} logKeyPrefix={logKeyPrefix} />
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