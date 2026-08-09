'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { WorkoutDay } from './components/WorkoutDay';
import { SfreLifecycle } from './components/SfreLifecycle';
import { Nav } from './components/Nav';
import { FOUNDATION_WEEKS, FOUNDATION_WEEK_COUNT, type DayWorkout } from './data/workouts';
import {
  resolveFoundationWeekIndex,
  FOUNDATION_START,
  FOUNDATION_DAYS,
} from './lib/sfre-program';

const DAYS = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'] as const;
const DAY_LABELS: Record<string, string> = {
  monday: 'MON', tuesday: 'TUE', wednesday: 'WED', thursday: 'THU',
  friday: 'FRI', saturday: 'SAT', sunday: 'SUN',
};
const DAY_FULL: Record<string, string> = {
  monday: 'Monday', tuesday: 'Tuesday', wednesday: 'Wednesday', thursday: 'Thursday',
  friday: 'Friday', saturday: 'Saturday', sunday: 'Sunday',
};

// --- Session type detection from workout title ---
function getSessionType(title?: string): { type: string; intensity: string } {
  if (!title) return { type: 'REST', intensity: 'Recovery' };
  const t = title.toLowerCase();
  if (t.includes('rest')) return { type: 'REST', intensity: 'Recovery' };
  if (t.includes('speed') || t.includes('sprint') || t.includes('interval')) return { type: 'SPEED', intensity: 'High' };
  if (t.includes('tempo') || t.includes('time trial') || t.includes('test')) return { type: 'TEST', intensity: 'High' };
  if (t.includes('recovery')) return { type: 'RECOVERY', intensity: 'Low' };
  if (t.includes('ruck')) return { type: 'RUCK', intensity: 'Moderate' };
  if (t.includes('upper') || t.includes('lower') || t.includes('strength')) return { type: 'STRENGTH', intensity: 'Moderate' };
  if (t.includes('work capacity') || t.includes('pt test')) return { type: 'WORK CAP', intensity: 'High' };
  if (t.includes('easy') || t.includes('run')) return { type: 'RUN', intensity: 'Low' };
  return { type: 'TRAIN', intensity: 'Moderate' };
}

// --- Streak calculation from localStorage ---
function getStreak(): number {
  if (typeof window === 'undefined') return 0;
  const today = new Date();
  let streak = 0;
  for (let i = 0; i < 365; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    let found = false;
    for (let j = 0; j < window.localStorage.length; j++) {
      const k = window.localStorage.key(j);
      if (!k) continue;
      if (k.includes(`:${dateStr}`)) { found = true; break; }
    }
    if (found) {
      streak++;
    } else if (i > 0) {
      break;
    }
  }
  return streak;
}

// --- Days to ship ---
function getDaysToShip(): number {
  const estimatedShip = new Date(FOUNDATION_START);
  estimatedShip.setDate(estimatedShip.getDate() + 365);
  const now = new Date();
  return Math.max(0, Math.ceil((estimatedShip.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
}

// --- Weekly completion ---
function getWeeklyCompletion(week: number): { completed: number; total: number } {
  if (typeof window === 'undefined') return { completed: 0, total: 7 };
  const total = 7;
  let completed = 0;
  const weekStart = new Date(FOUNDATION_START);
  weekStart.setDate(weekStart.getDate() + (week - 1) * 7);
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    const dateStr = d.toISOString().slice(0, 10);
    for (let j = 0; j < window.localStorage.length; j++) {
      const k = window.localStorage.key(j);
      if (!k) continue;
      if (k.includes(`:${dateStr}`) && k.includes('completed')) { completed++; break; }
    }
  }
  return { completed, total };
}

const INTENSITY_STYLES: Record<string, string> = {
  'High': 'border-l-2 border-l-red-600/60',
  'Moderate': 'border-l-2 border-l-amber-600/60',
  'Low': 'border-l-2 border-l-gray-700',
  'Recovery': 'border-l-2 border-l-gray-800',
};

export default function Home() {
  const [week, setWeek] = useState<number>(() => resolveFoundationWeekIndex(new Date()));
  const [streak, setStreak] = useState(0);
  const [daysToShip, setDaysToShip] = useState(0);
  const [weeklyComp, setWeeklyComp] = useState({ completed: 0, total: 7 });
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setMounted(true);
      setStreak(getStreak());
      setDaysToShip(getDaysToShip());
      setWeeklyComp(getWeeklyCompletion(week));
    });
    return () => window.cancelAnimationFrame(frame);
  }, [week]);

  const workouts = FOUNDATION_WEEKS[week - 1];
  const logKeyPrefix = `sfprep:log:foundation:${week}`;

  const todayDow = new Date().toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
  const todayWorkout: DayWorkout | undefined = workouts?.[todayDow as keyof typeof workouts];
  const todaySession = getSessionType(todayWorkout?.title);
  const isRestDay = todaySession.type === 'REST';

  const phase = week <= 6 ? 'BASE' : week <= 9 ? 'BUILD' : 'PEAK';
  const dayOfProgram = Math.min(FOUNDATION_DAYS, Math.max(1, Math.floor((new Date().getTime() - FOUNDATION_START.getTime()) / (1000 * 60 * 60 * 24)) + 1));

  const weekPct = Math.round((weeklyComp.completed / weeklyComp.total) * 100);
  const circumference = 2 * Math.PI * 42;
  const dashOffset = circumference - (weekPct / 100) * circumference;

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
    <div className="min-h-screen bg-[#0a0a0b] text-gray-200">
      {/* Subtle top glow */}
      <div className="fixed inset-0 pointer-events-none" style={{
        background: 'linear-gradient(180deg, rgba(20,20,25,0.6) 0%, transparent 30vh)',
      }} />

      <div className="relative z-10">
        <div className="max-w-2xl mx-auto px-5 pt-8 pb-4">

          {/* === HEADER === */}
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-baseline gap-3">
              <span className="text-sm font-bold tracking-[0.3em] text-gray-400">SF</span>
              <span className="text-sm font-bold tracking-[0.3em] text-white">PREP</span>
            </div>
            <button
              onClick={exportLog}
              className="text-[10px] uppercase tracking-wider text-gray-600 hover:text-gray-400 transition-colors"
            >
              Export Log
            </button>
          </div>

          {/* === GREETING === */}
          <div className="mb-8">
            <h1 className="text-2xl font-light tracking-tight text-white">
              Stay Frosty.
            </h1>
            <p className="text-[11px] text-gray-600 mt-2 tracking-[0.15em] uppercase">
              Day {mounted ? dayOfProgram : '—'} / {FOUNDATION_DAYS} · Phase {phase} · Week {week}/{FOUNDATION_WEEK_COUNT}
            </p>
          </div>

          {/* === TOP METRICS ROW === */}
          <div className="grid grid-cols-2 gap-px bg-gray-900/50 rounded-lg overflow-hidden mb-6">
            {/* Days to Ship */}
            <div className="bg-[#0d0d0f] p-4">
              <div className="text-[10px] text-gray-600 uppercase tracking-[0.15em] mb-2">Days to Ship</div>
              <div className="text-3xl font-light text-white tabular-nums">
                {mounted ? daysToShip : '—'}
              </div>
              <div className="text-[10px] text-gray-700 mt-1">Est. SFRE window</div>
            </div>

            {/* Streak */}
            <div className="bg-[#0d0d0f] p-4">
              <div className="text-[10px] text-gray-600 uppercase tracking-[0.15em] mb-2">Streak</div>
              <div className="text-3xl font-light text-white tabular-nums">
                {mounted ? streak : 0}
              </div>
              <div className="text-[10px] text-gray-700 mt-1">
                {streak === 0 ? 'No active streak' : `${streak} day${streak !== 1 ? 's' : ''}`}
              </div>
            </div>
          </div>

          {/* === WEEKLY COMPLETION === */}
          <div className="bg-[#0d0d0f] rounded-lg p-5 mb-6 flex items-center gap-6">
            {/* Ring */}
            <div className="relative w-24 h-24 flex-shrink-0">
              <svg className="w-24 h-24 -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="42" fill="none" stroke="rgb(20,20,25)" strokeWidth="3" />
                <circle
                  cx="50" cy="50" r="42" fill="none"
                  stroke={weekPct === 100 ? 'rgb(16,185,129)' : 'rgb(59,130,246)'}
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeDasharray={circumference}
                  strokeDashoffset={mounted ? dashOffset : circumference}
                  style={{ transition: 'stroke-dashoffset 0.8s cubic-bezier(0.16,1,0.3,1)' }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-xl font-light text-white tabular-nums">{mounted ? weekPct : 0}%</span>
              </div>
            </div>
            {/* Day bar */}
            <div className="flex-1">
              <div className="text-[10px] text-gray-600 uppercase tracking-[0.15em] mb-3">This Week</div>
              <div className="flex gap-1">
                {DAYS.map((d) => {
                  const dayDate = new Date(FOUNDATION_START);
                  dayDate.setDate(dayDate.getDate() + (week - 1) * 7 + DAYS.indexOf(d));
                  const dateStr = dayDate.toISOString().slice(0, 10);
                  let done = false;
                  if (mounted) {
                    for (let j = 0; j < window.localStorage.length; j++) {
                      const k = window.localStorage.key(j);
                      if (k && k.includes(`${dateStr}`) && k.includes('completed')) { done = true; break; }
                    }
                  }
                  const isToday = d === todayDow;
                  return (
                    <div key={d} className="flex flex-col items-center gap-1.5">
                      <div
                        className={`w-7 h-7 flex items-center justify-center text-[9px] font-bold tracking-wider ${
                          done
                            ? 'bg-emerald-900/40 text-emerald-400 border border-emerald-800/50'
                            : isToday
                            ? 'bg-blue-950/50 text-blue-500 border border-blue-800/50'
                            : 'bg-black/40 text-gray-700 border border-gray-900'
                        }`}
                      >
                        {DAY_LABELS[d]}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="text-[10px] text-gray-700 mt-2.5 tracking-wider">
                {mounted ? `${weeklyComp.completed}/${weeklyComp.total}` : '0/7'} DAYS COMPLETE
              </div>
            </div>
          </div>

          {/* === TODAY'S MISSION === */}
          <Link href="#workout" className="block mb-6">
            <div className={`rounded-lg p-5 ${INTENSITY_STYLES[todaySession.intensity] || ''} bg-[#0d0d0f] border border-gray-900/50 hover:border-gray-800 transition-colors`}>
              <div className="flex items-center justify-between mb-3">
                <div className="text-[10px] text-gray-600 uppercase tracking-[0.15em]">Today&apos;s Mission</div>
                <div className={`text-[10px] font-bold tracking-wider px-2 py-0.5 ${
                  todaySession.intensity === 'High' ? 'text-red-500' :
                  todaySession.intensity === 'Moderate' ? 'text-amber-600' :
                  'text-gray-600'
                }`}>
                  {todaySession.intensity.toUpperCase()}
                </div>
              </div>
              <div className="mb-3">
                <div className="text-base font-medium text-white tracking-wide">
                  {isRestDay ? 'Rest Day' : todaySession.type}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {todayWorkout?.title || (isRestDay ? 'Active recovery optional' : 'Training session')}
                </div>
              </div>
              {!isRestDay && todayWorkout?.exercises && todayWorkout.exercises.length > 0 && (
                <div className="text-[10px] text-gray-700 tracking-wider uppercase mb-4">
                  {todayWorkout.exercises.length} Exercises · {todayWorkout.exercises.reduce((acc, e) => acc + (e.sets || 0), 0)} Sets
                </div>
              )}
              <div className={`flex items-center justify-center gap-2 py-2.5 text-xs font-medium tracking-[0.1em] uppercase ${
                isRestDay
                  ? 'bg-black/30 text-gray-600'
                  : 'bg-white/5 text-white border border-gray-800 hover:bg-white/10'
              } transition-colors`}>
                {isRestDay ? 'Recover' : 'Start Training'}
              </div>
              {!isRestDay && (
                <div className="text-[10px] text-gray-700 mt-2 text-center tracking-wider">
                  {DAY_FULL[todayDow]} · Week {week}
                </div>
              )}
            </div>
          </Link>

          {/* === PROGRAM BRIEF === */}
          <Link href="#weekly" className="block mb-6">
            <div className="bg-[#0d0d0f] rounded-lg p-4 border border-gray-900/50 flex items-center justify-between hover:border-gray-800 transition-colors">
              <div>
                <div className="text-[10px] text-gray-600 uppercase tracking-[0.15em] mb-1">Your Program</div>
                <div className="text-sm font-medium text-white">SFRE Foundation · Phase {phase}</div>
                <div className="text-[10px] text-gray-600 mt-0.5 tracking-wider">Week {week} of {FOUNDATION_WEEK_COUNT}</div>
              </div>
              <div className="text-gray-700 text-sm">→</div>
            </div>
          </Link>

          {/* Nav */}
          <div className="mb-6">
            <Nav />
          </div>

          {/* Lifecycle */}
          <div id="lifecycle">
            <SfreLifecycle />
          </div>

          {/* === WEEKLY SCHEDULE === */}
          <div id="weekly" className="mt-8">
            <div className="bg-[#0d0d0f] rounded-lg p-4 border border-gray-900/50 mb-4 flex items-center justify-between flex-wrap gap-4">
              <div>
                <h3 className="text-sm font-medium text-white tracking-wide">Week {week} Schedule</h3>
                <p className="text-[10px] text-gray-600 mt-0.5 tracking-wider uppercase">Select week to inspect</p>
              </div>
              <select value={week} onChange={e => setWeek(Number(e.target.value))}
                className="bg-black/40 text-white font-medium px-3 py-2 rounded text-xs border border-gray-800 focus:outline-none focus:ring-1 focus:ring-blue-600 cursor-pointer"
              >
                {Array.from({ length: FOUNDATION_WEEK_COUNT }, (_, i) => (
                  <option key={i + 1} value={i + 1}>Week {i + 1}</option>
                ))}
              </select>
            </div>

            {/* Day cards */}
            <div id="workout" className="space-y-3">
              {DAYS.map((d, i) => {
                const w = workouts?.[d as keyof typeof workouts];
                const s = getSessionType(w?.title);
                const isToday = d === todayDow;
                return (
                  <div key={d} className="animate-slide-in-left" style={{ animationDelay: `${i * 50}ms` }}>
                    {/* Day header bar */}
                    <div className={`flex items-center gap-3 px-4 py-2 border-t border-l border-r border-gray-900/50 rounded-t-lg ${
                      isToday ? 'bg-blue-950/20 border-blue-900/40' : 'bg-black/30'
                    }`}>
                      <span className={`text-[10px] font-bold tracking-[0.1em] ${isToday ? 'text-blue-500' : 'text-gray-500'}`}>
                        {DAY_FULL[d].toUpperCase()}
                      </span>
                      <span className="text-[9px] text-gray-700 tracking-wider uppercase ml-auto">{s.type}</span>
                      {isToday && <span className="text-[9px] text-blue-600 font-bold tracking-wider">TODAY</span>}
                    </div>
                    <WorkoutDay day={d} workout={w} logKeyPrefix={logKeyPrefix} foundationWeek={week} />
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Animations */}
      <style jsx global>{`
        @keyframes slide-in-left {
          from { opacity: 0; transform: translateX(-10px); }
          to { opacity: 1; transform: translateX(0); }
        }
        .animate-slide-in-left {
          animation: slide-in-left 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>
    </div>
  );
}
