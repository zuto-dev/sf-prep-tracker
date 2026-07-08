'use client';

import { useMemo, useState } from 'react';
import { WorkoutDay } from './components/WorkoutDay';
import { Nav } from './components/Nav';
import { PHASES, WEEKS_PER_PHASE, type PhaseKey } from './data/workouts';

const DAYS = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'] as const;

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
    <div className="min-h-screen p-4 max-w-7xl mx-auto">
      <div className="mb-6 flex justify-between items-start flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold mb-1">SF Prep Tracker</h1>
          <p className="text-gray-400 text-sm">Plan D — 18 Month Program · Global Week {phaseGlobalWeek}/78</p>
        </div>
        <button onClick={exportLog} className="bg-emerald-700 hover:bg-emerald-600 px-3 py-2 rounded text-sm">
          Export Log JSON
        </button>
      </div>

      <Nav />

      <div className="flex gap-2 mb-4 flex-wrap">
        {(['foundation','build','peak'] as PhaseKey[]).map(k => (
          <button key={k} onClick={() => { setPhase(k); setWeek(1); }}
            className={`px-4 py-2 rounded text-sm ${phase === k ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'}`}>
            {PHASES[k].label} <span className="text-xs opacity-70">({PHASES[k].months})</span>
          </button>
        ))}
      </div>

      <div className="mb-6">
        <label className="block text-xs text-gray-400 mb-2">Week (1–{WEEKS_PER_PHASE})</label>
        <select value={week} onChange={e => setWeek(Number(e.target.value))}
          className="bg-gray-800 text-white px-3 py-2 rounded text-sm">
          {Array.from({ length: WEEKS_PER_PHASE }, (_, i) => (
            <option key={i + 1} value={i + 1}>Week {i + 1}</option>
          ))}
        </select>
      </div>

      <div className="space-y-4">
        {DAYS.map(d => (
          <WorkoutDay key={d} day={d} workout={workouts[d]} logKeyPrefix={logKeyPrefix} />
        ))}
      </div>
    </div>
  );
}
