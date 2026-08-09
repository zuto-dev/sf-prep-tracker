'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { WorkoutDay } from './components/WorkoutDay';
import { FOUNDATION_WEEKS, FOUNDATION_WEEK_COUNT } from './data/workouts';
import {
  canonicalTwoMileSeconds,
  FOUNDATION_DAYS,
  FOUNDATION_START,
  resolveFoundationWeekIndex,
  resolveStrictRuckGate,
} from './lib/sfre-program';
import {
  hydrateLifecycleStore,
  saveLifecycleStore,
  type LifecycleStore,
} from './lib/sfre-store';
import { pullSfprepSync, pushSfprepSync } from './lib/sfprep-sync';
import {
  countCompletedDays,
  describeMission,
  resolveHomeEventStatus,
} from './lib/home-dashboard';

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;
const DAY_SHORT: Record<(typeof DAYS)[number], string> = {
  monday: 'M', tuesday: 'T', wednesday: 'W', thursday: 'T', friday: 'F', saturday: 'S', sunday: 'S',
};
const DAY_FULL: Record<(typeof DAYS)[number], string> = {
  monday: 'Monday', tuesday: 'Tuesday', wednesday: 'Wednesday', thursday: 'Thursday',
  friday: 'Friday', saturday: 'Saturday', sunday: 'Sunday',
};

const PRIMARY_LINKS = [
  { href: '/', label: 'Train' },
  { href: '/standards', label: 'Standards' },
  { href: '/progress', label: 'Progress' },
  { href: '/nutrition', label: 'Fuel' },
];

const MORE_LINKS = [
  { href: '/mobility', label: 'Mobility' },
  { href: '/calendar', label: 'Calendar' },
  { href: '/study', label: 'Study' },
  { href: '/intel', label: 'Intel' },
  { href: '/pods', label: 'SF Pod' },
  { href: '/board-sim', label: 'Board' },
];

type View = 'home' | 'today' | 'program';
type CompletionByDay = Partial<Record<(typeof DAYS)[number], string[]>>;

function readCompletion(week: number): CompletionByDay {
  if (typeof window === 'undefined') return {};
  const result: CompletionByDay = {};
  for (const day of DAYS) {
    const key = `sfprep:log:foundation:${week}:${day}:completed`;
    try {
      const parsed = JSON.parse(window.localStorage.getItem(key) ?? '[]');
      result[day] = Array.isArray(parsed) ? parsed.filter(value => typeof value === 'string') : [];
    } catch {
      result[day] = [];
    }
  }
  return result;
}

function readCanonicalTwoMile(): number | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem('sfprep:standards');
    return canonicalTwoMileSeconds(raw ? JSON.parse(raw) : null);
  } catch {
    return null;
  }
}

function fmtTime(seconds: number | null): string {
  if (seconds == null) return 'Not logged';
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(Math.round(seconds % 60)).padStart(2, '0')}`;
}

function dateInputValue(iso: string | null): string {
  if (!iso) return '';
  const parsed = Date.parse(iso);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString().slice(0, 10) : '';
}

export default function Home() {
  const [today] = useState(() => new Date());
  const currentWeek = resolveFoundationWeekIndex(today);
  const [selectedWeek, setSelectedWeek] = useState(currentWeek);
  const [view, setView] = useState<View>('home');
  const [lifecycle, setLifecycle] = useState<LifecycleStore | null>(null);
  const [completionByDay, setCompletionByDay] = useState<CompletionByDay>({});
  const [twoMileSeconds, setTwoMileSeconds] = useState<number | null>(null);

  const todayKey = today.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase() as (typeof DAYS)[number];
  const currentWorkouts = FOUNDATION_WEEKS[currentWeek - 1];
  const selectedWorkouts = FOUNDATION_WEEKS[selectedWeek - 1];
  const todayWorkout = currentWorkouts[todayKey];
  const mission = describeMission(todayWorkout);
  const phase = currentWeek <= 6 ? 'Foundation' : currentWeek <= 13 ? 'Build' : currentWeek <= 22 ? 'SFRE Prep' : 'Taper';
  const dayOfProgram = Math.min(
    FOUNDATION_DAYS,
    Math.max(1, Math.floor((today.getTime() - FOUNDATION_START.getTime()) / (24 * 60 * 60 * 1000)) + 1),
  );

  useEffect(() => {
    let cancelled = false;
    void pullSfprepSync().finally(() => {
      if (cancelled) return;
      const storage = typeof window !== 'undefined' ? window.localStorage : null;
      setLifecycle(hydrateLifecycleStore(storage));
      setCompletionByDay(readCompletion(currentWeek));
      setTwoMileSeconds(readCanonicalTwoMile());
    });
    return () => { cancelled = true; };
  }, [currentWeek]);

  const completion = useMemo(
    () => countCompletedDays(currentWorkouts, completionByDay),
    [currentWorkouts, completionByDay],
  );
  const eventStatus = resolveHomeEventStatus(lifecycle?.confirmedSfreDate ?? null, today);
  const ruckGate = resolveStrictRuckGate(twoMileSeconds);
  const todayCompleted = completion.completedDays.includes(todayKey);
  const programProgress = Math.round((dayOfProgram / FOUNDATION_DAYS) * 100);

  const goHome = () => {
    setCompletionByDay(readCompletion(currentWeek));
    setTwoMileSeconds(readCanonicalTwoMile());
    setView('home');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const setConfirmedDate = (value: string) => {
    if (!lifecycle) return;
    const next: LifecycleStore = {
      ...lifecycle,
      confirmedSfreDate: value ? new Date(`${value}T00:00:00Z`).toISOString() : null,
    };
    setLifecycle(next);
    const storage = typeof window !== 'undefined' ? window.localStorage : null;
    saveLifecycleStore(next, storage);
    void pushSfprepSync();
  };

  if (view === 'today') {
    return (
      <Shell>
        <TopBar onBack={goHome} label="Today" />
        <section className="mb-5 border-b border-gray-900 pb-5">
          <p className="text-[10px] uppercase tracking-[0.2em] text-gray-600">{DAY_FULL[todayKey]} · Week {currentWeek}</p>
          <h1 className="mt-2 text-2xl font-light text-white">{mission.title}</h1>
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-[11px] uppercase tracking-[0.12em] text-gray-600">
            <span>{mission.type}</span>
            <span>{mission.intensity}</span>
            <span>{mission.dose}</span>
          </div>
        </section>
        <WorkoutDay
          day={todayKey}
          workout={todayWorkout}
          logKeyPrefix={`sfprep:log:foundation:${currentWeek}`}
          foundationWeek={currentWeek}
          defaultExpanded
        />
        <button
          onClick={goHome}
          className="mt-5 w-full border border-gray-800 py-3 text-[11px] font-bold uppercase tracking-[0.15em] text-gray-400 hover:border-gray-700 hover:text-white"
        >
          Return to Mission Control
        </button>
      </Shell>
    );
  }

  if (view === 'program') {
    return (
      <Shell>
        <TopBar onBack={goHome} label="Program" />
        <section className="mb-5 flex items-end justify-between border-b border-gray-900 pb-5">
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-gray-600">The Pipeline</p>
            <h1 className="mt-2 text-2xl font-light text-white">Week {selectedWeek} of {FOUNDATION_WEEK_COUNT}</h1>
          </div>
          <select
            aria-label="Select program week"
            value={selectedWeek}
            onChange={event => setSelectedWeek(Number(event.target.value))}
            className="border border-gray-800 bg-black px-3 py-2 text-xs text-gray-300 focus:border-blue-800 focus:outline-none"
          >
            {Array.from({ length: FOUNDATION_WEEK_COUNT }, (_, index) => (
              <option key={index + 1} value={index + 1}>Week {index + 1}</option>
            ))}
          </select>
        </section>
        <div className="space-y-2">
          {DAYS.map(day => (
            <WorkoutDay
              key={day}
              day={day}
              workout={selectedWorkouts[day]}
              logKeyPrefix={`sfprep:log:foundation:${selectedWeek}`}
              foundationWeek={selectedWeek}
            />
          ))}
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <header className="mb-7">
        <div className="flex items-center justify-between">
          <div className="flex items-baseline gap-3">
            <span className="text-sm font-bold tracking-[0.3em] text-gray-500">SF</span>
            <span className="text-sm font-bold tracking-[0.3em] text-white">PREP</span>
          </div>
          <details className="relative">
            <summary className="cursor-pointer list-none text-[10px] font-bold uppercase tracking-[0.15em] text-gray-600 hover:text-gray-300">More</summary>
            <div className="absolute right-0 z-20 mt-3 w-48 border border-gray-800 bg-[#0d0d0f] p-2 shadow-2xl">
              {MORE_LINKS.map(link => (
                <Link key={link.href} href={link.href} className="block px-3 py-2 text-xs text-gray-500 hover:bg-white/5 hover:text-white">
                  {link.label}
                </Link>
              ))}
            </div>
          </details>
        </div>
        <div className="mt-8">
          <p className="text-[10px] uppercase tracking-[0.2em] text-gray-600">Mission Control</p>
          <h1 className="mt-2 text-3xl font-light tracking-tight text-white">Today&apos;s work.</h1>
          <p className="mt-2 text-xs text-gray-600">Day {dayOfProgram} of {FOUNDATION_DAYS} · {phase} phase · Week {currentWeek}</p>
        </div>
      </header>

      <nav className="mb-6 grid grid-cols-4 gap-px bg-gray-900" aria-label="Primary navigation">
        {PRIMARY_LINKS.map(link => (
          <Link
            key={link.href}
            href={link.href}
            className={`bg-[#0d0d0f] px-2 py-3 text-center text-[10px] font-bold uppercase tracking-[0.1em] ${link.href === '/' ? 'text-blue-400' : 'text-gray-600 hover:text-white'}`}
          >
            {link.label}
          </Link>
        ))}
      </nav>

      <section className={`mb-4 border bg-[#0d0d0f] ${mission.intensity === 'High' ? 'border-red-950' : 'border-gray-900'}`}>
        <div className="border-b border-gray-900 px-5 py-4 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-600">Primary Mission</p>
            <p className="mt-1 text-[10px] uppercase tracking-[0.12em] text-gray-700">{mission.type} · {mission.intensity}</p>
          </div>
          <span className={`text-[10px] font-bold uppercase tracking-[0.12em] ${todayCompleted ? 'text-emerald-500' : mission.intensity === 'High' ? 'text-red-500' : 'text-gray-600'}`}>
            {todayCompleted ? 'Complete' : 'Open'}
          </span>
        </div>
        <div className="px-5 py-5">
          <h2 className="text-2xl font-light leading-tight text-white">{mission.title}</h2>
          <p className="mt-2 text-xs text-gray-600">{mission.dose}</p>
          <ol className="mt-5 space-y-3 border-t border-gray-900 pt-4">
            {todayWorkout.exercises.map((exercise, index) => (
              <li key={exercise.id} className="flex gap-3 text-xs">
                <span className="font-mono text-gray-700">{String(index + 1).padStart(2, '0')}</span>
                <div className="min-w-0">
                  <p className="text-gray-300">{exercise.name}</p>
                  <p className="mt-0.5 truncate text-[10px] text-gray-700">{exercise.duration ?? exercise.distance ?? exercise.reps ?? 'Complete as prescribed'}</p>
                </div>
              </li>
            ))}
          </ol>
          <button
            onClick={() => { setView('today'); window.scrollTo({ top: 0 }); }}
            className="mt-6 w-full bg-white py-3.5 text-[11px] font-black uppercase tracking-[0.18em] text-black hover:bg-gray-200"
          >
            {todayCompleted ? 'Review Session' : 'Start Training'}
          </button>
        </div>
      </section>

      <section className="mb-4 border border-gray-900 bg-[#0d0d0f] px-5 py-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-600">This Week</p>
            <p className="mt-1 text-xs text-gray-700">{completion.completed} of {completion.total} training days complete</p>
          </div>
          <p className="font-mono text-sm text-white">{Math.round((completion.completed / completion.total) * 100)}%</p>
        </div>
        <div className="grid grid-cols-7 gap-1">
          {DAYS.map(day => {
            const isToday = day === todayKey;
            const isDone = completion.completedDays.includes(day);
            return (
              <div key={day} className="text-center">
                <div className={`h-1 mb-2 ${isDone ? 'bg-emerald-500' : isToday ? 'bg-blue-500' : 'bg-gray-900'}`} />
                <span className={`text-[9px] font-bold ${isDone ? 'text-emerald-500' : isToday ? 'text-blue-400' : 'text-gray-700'}`}>{DAY_SHORT[day]}</span>
              </div>
            );
          })}
        </div>
      </section>

      <section className="mb-4 grid grid-cols-2 gap-px bg-gray-900">
        <div className="bg-[#0d0d0f] p-4">
          <p className="text-[9px] uppercase tracking-[0.16em] text-gray-700">Event</p>
          <p className={`mt-2 text-sm ${eventStatus.state === 'date-required' ? 'text-amber-500' : 'text-white'}`}>{eventStatus.label}</p>
          <p className="mt-1 text-[9px] leading-4 text-gray-700">{eventStatus.detail}</p>
          <input
            aria-label="Confirmed SFRE date"
            type="date"
            value={dateInputValue(lifecycle?.confirmedSfreDate ?? null)}
            onChange={event => setConfirmedDate(event.target.value)}
            className="mt-3 w-full border-b border-gray-800 bg-transparent pb-1 text-[10px] text-gray-500 focus:border-blue-700 focus:outline-none"
          />
        </div>
        <Link href="/standards" className="bg-[#0d0d0f] p-4 hover:bg-white/[0.02]">
          <p className="text-[9px] uppercase tracking-[0.16em] text-gray-700">Ruck Gate</p>
          <p className={`mt-2 text-sm ${ruckGate.cleared ? 'text-emerald-500' : 'text-amber-500'}`}>{ruckGate.cleared ? 'Cleared' : 'Locked'}</p>
          <p className="mt-1 text-[9px] leading-4 text-gray-700">2-mile {fmtTime(twoMileSeconds)} · target 16:00</p>
          <p className="mt-3 text-[9px] uppercase tracking-[0.12em] text-gray-600">View standards →</p>
        </Link>
      </section>

      <button
        onClick={() => { setSelectedWeek(currentWeek); setView('program'); window.scrollTo({ top: 0 }); }}
        className="mb-4 w-full border border-gray-900 bg-[#0d0d0f] p-4 text-left hover:border-gray-800"
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-600">Program</p>
            <p className="mt-1 text-sm text-white">SFRE Foundation · Week {currentWeek} of {FOUNDATION_WEEK_COUNT}</p>
          </div>
          <span className="text-xs text-gray-700">View →</span>
        </div>
        <div className="mt-4 h-1 bg-black">
          <div className="h-1 bg-blue-600" style={{ width: `${programProgress}%` }} />
        </div>
      </button>

      <footer className="pt-2 text-center text-[9px] uppercase tracking-[0.15em] text-gray-800">
        Foundation catalog is the prescription authority
      </footer>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-[#09090a] text-gray-200">
      <div className="mx-auto max-w-xl px-4 pt-7 pb-16">{children}</div>
    </main>
  );
}

function TopBar({ onBack, label }: { onBack: () => void; label: string }) {
  return (
    <div className="mb-7 flex items-center justify-between">
      <button onClick={onBack} className="text-[10px] font-bold uppercase tracking-[0.15em] text-gray-600 hover:text-white">← Mission Control</button>
      <span className="text-[10px] uppercase tracking-[0.18em] text-gray-700">{label}</span>
    </div>
  );
}
