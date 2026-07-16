'use client';

import { useMemo, useState } from 'react';
import { WorkoutDay } from './components/WorkoutDay';
import { Nav } from './components/Nav';
import { PHASES, WEEKS_PER_PHASE, type PhaseKey } from './data/workouts';
import { motion, AnimatePresence } from 'motion/react';
import { Download, Dumbbell, ShieldAlert, Zap, Flame, Compass, ChevronLeft, ChevronRight, Award } from 'lucide-react';

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;

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
        try {
          out[k] = JSON.parse(localStorage.getItem(k) || 'null');
        } catch {
          out[k] = localStorage.getItem(k);
        }
      }
    }
    const blob = new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sfprep-log-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const phaseGlobalWeek = useMemo(() => {
    const idx = (['foundation', 'build', 'peak'] as const).indexOf(phase);
    return idx * WEEKS_PER_PHASE + week;
  }, [phase, week]);

  const phaseDetails = {
    foundation: {
      focus: 'Aerobic Base & Joint Integrity',
      desc: 'Build cardiovascular foundation, ligament resilience, and initial work capacity. Vital for injury prevention.',
      color: 'from-blue-600/20 to-cyan-600/5 border-blue-500/30 text-blue-400',
      icon: Compass,
      intensity: 'Low to Moderate (Aerobic focused)',
    },
    build: {
      focus: 'Strength & Metabolic Conditioning',
      desc: 'Escalate muscular endurance, rucking load, and lactate threshold. Transitioning to military-specific stress.',
      color: 'from-amber-600/20 to-orange-600/5 border-amber-500/30 text-amber-400',
      icon: Flame,
      intensity: 'Moderate to High (Power-Endurance)',
    },
    peak: {
      focus: 'Mission Readiness & Assessment',
      desc: 'Elite tactical simulations, maximum rucking capacity, and optimal PT score preparation. Peak output.',
      color: 'from-emerald-600/20 to-teal-600/5 border-emerald-500/30 text-emerald-400',
      icon: Award,
      intensity: 'High / Maximum (Combat Ready)',
    },
  };

  const currentDetails = phaseDetails[phase];

  const handlePrevWeek = () => {
    if (week > 1) {
      setWeek(w => w - 1);
    } else {
      // Go to previous phase if possible
      const phases: PhaseKey[] = ['foundation', 'build', 'peak'];
      const curIdx = phases.indexOf(phase);
      if (curIdx > 0) {
        setPhase(phases[curIdx - 1]);
        setWeek(WEEKS_PER_PHASE);
      }
    }
  };

  const handleNextWeek = () => {
    if (week < WEEKS_PER_PHASE) {
      setWeek(w => w + 1);
    } else {
      // Go to next phase if possible
      const phases: PhaseKey[] = ['foundation', 'build', 'peak'];
      const curIdx = phases.indexOf(phase);
      if (curIdx < 2) {
        setPhase(phases[curIdx + 1]);
        setWeek(1);
      }
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className="space-y-6"
    >
      <Nav />

      {/* Main Stats Banner */}
      <div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="font-mono text-xs text-gray-500 tracking-widest uppercase">TRAINING DASHBOARD</span>
          <h2 className="text-xl md:text-2xl font-bold font-display mt-0.5 text-white">
            Plan D — 18 Month Selection Protocol
          </h2>
          <p className="text-gray-400 text-sm mt-1">
            Global Week <span className="text-emerald-400 font-mono font-bold">{phaseGlobalWeek}</span> of 78
          </p>
        </div>
        <button
          onClick={exportLog}
          className="flex items-center gap-2 bg-gray-950 hover:bg-gray-900 text-gray-300 hover:text-white border border-gray-800 hover:border-gray-700 px-4 py-2.5 rounded-xl text-sm font-mono transition-all duration-200 shadow-lg shrink-0 self-start sm:self-auto group cursor-pointer"
        >
          <Download className="w-4 h-4 text-emerald-400 group-hover:scale-110 transition-transform" />
          <span>Export Logs (JSON)</span>
        </button>
      </div>

      {/* Phase Selection Bento */}
      <div className="grid gap-4 md:grid-cols-3">
        {(['foundation', 'build', 'peak'] as PhaseKey[]).map((k) => {
          const isSelected = phase === k;
          const details = phaseDetails[k];
          const IconComp = details.icon;
          return (
            <button
              key={k}
              onClick={() => {
                setPhase(k);
                setWeek(1);
              }}
              className={`text-left rounded-2xl p-5 border transition-all duration-300 relative overflow-hidden group cursor-pointer flex flex-col justify-between h-44 ${
                isSelected
                  ? `bg-gradient-to-br ${details.color} shadow-xl scale-[1.02]`
                  : 'bg-gray-900/30 border-gray-800 hover:border-gray-700 hover:bg-gray-900/50'
              }`}
            >
              <div className="flex justify-between items-start w-full">
                <div className={`p-2.5 rounded-xl bg-gray-950 border border-gray-800/80 ${isSelected ? 'text-emerald-400' : 'text-gray-400'}`}>
                  <IconComp className="w-5 h-5" />
                </div>
                <span className="font-mono text-[10px] text-gray-500 tracking-wider uppercase bg-gray-950/80 px-2 py-1 rounded border border-gray-800/80">
                  {PHASES[k].months}
                </span>
              </div>
              <div className="mt-4">
                <h3 className="font-bold font-display text-white text-lg capitalize">{PHASES[k].label}</h3>
                <p className="text-gray-400 text-xs mt-1 line-clamp-2 leading-relaxed">
                  {details.desc}
                </p>
              </div>
              {isSelected && (
                <div className="absolute right-0 bottom-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none" />
              )}
            </button>
          );
        })}
      </div>

      {/* Interactive Week Controller */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
        <div className="flex items-center justify-between gap-4 flex-wrap border-b border-gray-800 pb-4 mb-4">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-xl bg-gradient-to-br ${currentDetails.color.split(' ')[0]} border ${currentDetails.color.split(' ')[2]}`}>
              <Zap className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono uppercase text-gray-400">Current Scope</span>
                <span className="text-[10px] font-mono uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.5 rounded">
                  {currentDetails.intensity}
                </span>
              </div>
              <h4 className="text-lg font-bold text-white font-display">
                {PHASES[phase].label} — Week {week} <span className="text-gray-500 font-normal">of 26</span>
              </h4>
            </div>
          </div>

          {/* Quick Nav arrows */}
          <div className="flex items-center gap-2 bg-gray-950 p-1.5 rounded-xl border border-gray-800">
            <button
              onClick={handlePrevWeek}
              className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-900 transition-colors cursor-pointer"
              title="Previous Week"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="px-3 py-1 font-mono text-sm text-white border-x border-gray-800">
              WK {week}
            </div>
            <button
              onClick={handleNextWeek}
              className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-900 transition-colors cursor-pointer"
              title="Next Week"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Quick horizontal week list */}
        <div className="flex gap-1.5 overflow-x-auto pb-2 scrollbar-none">
          {Array.from({ length: WEEKS_PER_PHASE }, (_, i) => {
            const num = i + 1;
            const isCurrent = week === num;
            return (
              <button
                key={num}
                onClick={() => setWeek(num)}
                className={`w-10 h-10 rounded-xl flex items-center justify-center font-mono text-xs border shrink-0 transition-all cursor-pointer ${
                  isCurrent
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 font-bold'
                    : 'bg-gray-950 text-gray-400 border-gray-800/80 hover:border-gray-700 hover:text-white'
                }`}
              >
                {num}
              </button>
            );
          })}
        </div>
      </div>

      {/* Workout Days Listing */}
      <div className="space-y-4">
        <div className="flex items-center justify-between border-b border-gray-800/60 pb-2">
          <span className="font-mono text-xs text-gray-400 uppercase tracking-widest">WEEKLY PLAN</span>
          <span className="text-xs text-gray-500 font-mono">Plan D Progress saved automatically</span>
        </div>
        
        <AnimatePresence mode="popLayout">
          <motion.div
            key={`${phase}-${week}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
            className="grid gap-4"
          >
            {DAYS.map((d) => (
              <WorkoutDay
                key={d}
                day={d}
                workout={workouts[d]}
                logKeyPrefix={logKeyPrefix}
              />
            ))}
          </motion.div>
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

