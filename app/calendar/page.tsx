'use client';

import { useEffect, useState, useMemo } from 'react';
import { TacticalPageHeader } from '../components/TacticalPageHeader';
import { WeeklyPlanner } from '../components/WeeklyPlanner';
import { KnowledgeFocusCard } from '../components/KnowledgeFocusCard';
import { pullSfprepSync, pushSfprepSync } from '../lib/sfprep-sync';
import { FOODS, type Food } from '../data/foods';
import { type UserMeal } from '../data/meals';
import { deriveWorkoutHistory, calculateAdaptiveLoad, acwrZone, acwrZoneColor, deriveDayVolume } from '../lib/adaptive-engine';
import { evaluateSOFMetrics, SOF_PROFILES } from '../lib/sof-standards';
import { forecastTargetDate } from '../lib/progress-forecast';
import { getPerformanceStats } from '../study/spaced-repetition';
import { deriveFatigueAreas, buildTailoredMobilitySession } from '../lib/mobility-engine';
import { MOVES } from '../mobility/page';
import { FOUNDATION_TARGETS } from '../lib/nutrition-execution';
import { resolveFoundationNutritionGuidance } from '../lib/sfre-program';
// Architecture Amendment 3 (WS-7): Calendar reads the existing
// `sfprep:knowledge` store read-only via `normalizeKnowledgeStore` and
// resolves queued IDs to labels via `deriveKnowledgeFocusSnapshot` against a
// read-only same-origin fetch of the existing `/pods.json`. This page MUST
// NEVER import a KnowledgeStore mutation helper (addToQueue/completeItem/
// deferItem/noteItem/reconcileQueue) and MUST NEVER call pushSfprepSync for
// the knowledge store — see knowledge-source-contract.test.ts.
import { normalizeKnowledgeStore, type KnowledgeStore } from '../lib/knowledge-store';
import { deriveKnowledgeFocusSnapshot, type KnowledgeFocusSnapshot } from '../lib/knowledge-views';
import { CheckCircle2, AlertCircle, Timer, Dumbbell, Shield, BookOpen, Calendar, HelpCircle, Activity, Heart, ArrowUpRight, Flame, Target } from 'lucide-react';

type NutritionStore = {
  days: Record<string, {
    breakfast: Array<{ foodId: string; servings: number }>;
    lunch: Array<{ foodId: string; servings: number }>;
    dinner: Array<{ foodId: string; servings: number }>;
    snacks: Array<{ foodId: string; servings: number }>;
  }>;
  targets: { kcal: number; p: number; c: number; f: number };
  preset?: 'foundation' | 'peak' | 'custom';
};

type StudyStore = {
  track?: 'A' | 'B' | 'C' | 'D';
  done?: Record<string, number[]> | number[];
  arDiag?: number;
  mkDiag?: number;
  wkDiag?: number;
  pcDiag?: number;
  lastUpdate?: string;
  spacedRepetition?: any;
};

type WorkoutStore = {
  logs: Record<string, { completed: Array<{ exercise: string }> }>;
};

type MobilityStore = {
  days: Record<string, { stretches: string[] }>;
};

type SupplementStore = {
  days: Record<string, string[]>;
};

type MetricsStore = {
  runPace: Array<{ date: string; value: number }>;
  ruckPace: Array<{ date: string; value: number }>;
};

const PLAN_D_START = new Date('2026-07-06');
const ASVAB_START = new Date('2026-07-13');

const foodById = new Map<string, Food>();
function initFoodMap(base: Food[], userMeals: UserMeal[]) {
  foodById.clear();
  base.forEach(f => foodById.set(f.id, f));
  userMeals.forEach(m => foodById.set(m.id, m));
}

function computeMacros(entries: Array<{ foodId: string; servings: number }>) {
  return entries.reduce((acc, e) => {
    const food = foodById.get(e.foodId) || { kcal: 0, p: 0, c: 0, f: 0, name: 'Custom', id: e.foodId };
    acc.kcal += food.kcal * e.servings;
    acc.p += food.p * e.servings;
    acc.c += food.c * e.servings;
    acc.f += food.f * e.servings;
    return acc;
  }, { kcal: 0, p: 0, c: 0, f: 0 });
}

function getDaysSince(start: Date, current: Date = new Date()): number {
  const diffMs = current.getTime() - start.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1;
}

function getWeekNumber(dayNumber: number): number {
  return Math.ceil(dayNumber / 7);
}

/** Read-only, throw-safe JSON.parse used only for the WS-7 knowledge read path. */
function safeJsonParse(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export default function CalendarPage() {
  const [today] = useState(() => new Date().toISOString().slice(0, 10));
  const [nutrition, setNutrition] = useState<NutritionStore | null>(null);
  const [study, setStudy] = useState<StudyStore | null>(null);
  const [workouts, setWorkouts] = useState<WorkoutStore | null>(null);
  const [mobility, setMobility] = useState<MobilityStore | null>(null);
  const [sups, setSups] = useState<SupplementStore | null>(null);
  const [metrics, setMetrics] = useState<MetricsStore | null>(null);
  const [userMeals, setUserMeals] = useState<UserMeal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastSync, setLastSync] = useState<number | null>(null);

  // WS-7 (Architecture Amendment 3): read-only Knowledge Focus card state.
  // `knowledgeStore` is populated by normalizing (never mutating) whatever is
  // already in `sfprep:knowledge` after the existing pullSfprepSync() below;
  // `knowledgePods` is a read-only same-origin fetch of the existing
  // `/pods.json`, mirroring the Pods page's own fetch. Neither write to
  // storage, call a KnowledgeStore mutation helper, nor call
  // pushSfprepSync.
  const [knowledgeStore, setKnowledgeStore] = useState<KnowledgeStore | null>(null);
  const [knowledgePods, setKnowledgePods] = useState<unknown>(null);

  // HUD Selected Day Detail View
  const [selectedDayOffset, setSelectedDayOffset] = useState<number>(0);

  const [standardsAssessment, setStandardsAssessment] = useState<any>(null);

  // Load all stores via local localStorage sync
  useEffect(() => {
    async function load() {
      try {
        await pullSfprepSync();
        
        const rawNutrition = localStorage.getItem('sfprep:nutrition');
        if (rawNutrition) setNutrition(JSON.parse(rawNutrition));
        
        const rawStudy = localStorage.getItem('sfprep:study');
        if (rawStudy) setStudy(JSON.parse(rawStudy));
        
        const rawWorkouts = localStorage.getItem('sfprep:workouts');
        if (rawWorkouts) setWorkouts(JSON.parse(rawWorkouts));
        
        const rawMobility = localStorage.getItem('sfprep:mobility');
        if (rawMobility) setMobility(JSON.parse(rawMobility));
        
        const rawSupps = localStorage.getItem('sfprep:supps');
        if (rawSupps) setSups(JSON.parse(rawSupps));

        const rawMetrics = localStorage.getItem('sfprep:metrics');
        if (rawMetrics) setMetrics(JSON.parse(rawMetrics));
        
        const rawMeals = localStorage.getItem('sfprep:meals');
        if (rawMeals) {
          const parsedMeals: unknown = JSON.parse(rawMeals);
          // Current storage is a raw UserMeal array; retain the object fallback
          // for old browser snapshots without silently discarding saved meals.
          const meals = Array.isArray(parsedMeals)
            ? parsedMeals
            : (parsedMeals && typeof parsedMeals === 'object' && Array.isArray((parsedMeals as { meals?: unknown }).meals)
              ? (parsedMeals as { meals: UserMeal[] }).meals
              : []);
          setUserMeals(meals as UserMeal[]);
        }

        const rawRun = localStorage.getItem('sfprep:standards');
        if (rawRun) {
          const parsed = JSON.parse(rawRun);
          const twoMileSecs = parsed.two_mile_pr_sec;
          if (twoMileSecs) {
            setStandardsAssessment(evaluateSOFMetrics('sfas', 'twoMileRun', twoMileSecs));
          }
        }

        // WS-7: read-only knowledge store read, post-pullSfprepSync. This
        // reads and normalizes the existing `sfprep:knowledge` key — it
        // never writes back to storage and never touches a mutation helper.
        const rawKnowledge = localStorage.getItem('sfprep:knowledge');
        setKnowledgeStore(normalizeKnowledgeStore(rawKnowledge ? safeJsonParse(rawKnowledge) : null));
        
        setLastSync(Date.now());
        setIsLoading(false);
      } catch (e) {
        console.error('Failed to load calendar data:', e);
        setIsLoading(false);
      }
    }
    load();
  }, []);

  // WS-7: read-only same-origin fetch of the existing /pods.json, solely to
  // resolve queued knowledge IDs into human-readable labels. Mirrors the
  // Pods page's own fetch call; never writes, never mutates the knowledge
  // store, never posts anything back.
  useEffect(() => {
    let cancelled = false;
    fetch('/pods.json', { cache: 'no-store' })
      .then(r => (r.ok ? r.json() : null))
      .then(data => { if (!cancelled) setKnowledgePods(data); })
      .catch(() => { if (!cancelled) setKnowledgePods(null); });
    return () => { cancelled = true; };
  }, []);

  // Initialize food map with user meals
  useEffect(() => {
    initFoodMap(FOODS, userMeals);
  }, [userMeals]);

  const planDProgress = useMemo(() => {
    const currentDay = getDaysSince(PLAN_D_START);
    const currentWeek = getWeekNumber(currentDay);
    return { day: currentDay, week: currentWeek };
  }, []);

  // Generate the 7 days of the current week dynamically
  const weeklyTimeline = useMemo(() => {
    const timeline = [];
    const baseDate = new Date();
    // Shift base Date to the current Monday
    const currentDayOfWeek = baseDate.getDay(); // 0 is Sunday, 1 is Monday...
    const distanceToMonday = currentDayOfWeek === 0 ? -6 : 1 - currentDayOfWeek;
    baseDate.setDate(baseDate.getDate() + distanceToMonday);

    const weekdays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

    for (let i = 0; i < 7; i++) {
      const targetDate = new Date(baseDate);
      targetDate.setDate(baseDate.getDate() + i);
      const isoDateString = targetDate.toISOString().slice(0, 10);
      
      const dayNutrition = nutrition?.days?.[isoDateString] || { breakfast: [], lunch: [], dinner: [], snacks: [] };
      const allEntries = [...dayNutrition.breakfast, ...dayNutrition.lunch, ...dayNutrition.dinner, ...dayNutrition.snacks];
      const macros = computeMacros(allEntries);

      const isWorkoutLogged = workouts?.logs?.[isoDateString] || false;
      const stretchesCount = mobility?.days?.[isoDateString]?.stretches?.length || 0;
      
      const dayIndex = getDaysSince(PLAN_D_START, targetDate);
      const weekIndex = getWeekNumber(dayIndex);

      timeline.push({
        dayName: weekdays[i],
        isoDate: isoDateString,
        macros,
        workoutLogged: !!isWorkoutLogged,
        mobilityCount: stretchesCount,
        programDay: dayIndex,
        programWeek: weekIndex,
        isToday: isoDateString === today
      });
    }
    return timeline;
  }, [nutrition, workouts, mobility, today]);

  // Selected Day detailed compliance analytics
  const selectedDayData = useMemo(() => {
    const activeDay = weeklyTimeline[selectedDayOffset];
    if (!activeDay) return null;

    const dayNutrition = nutrition?.days?.[activeDay.isoDate] || { breakfast: [], lunch: [], dinner: [], snacks: [] };
    const allEntries = [...dayNutrition.breakfast, ...dayNutrition.lunch, ...dayNutrition.dinner, ...dayNutrition.snacks];
    const mealNames = allEntries.map(e => foodById.get(e.foodId)?.name || 'Custom');

    // Adaptive Engine calculation
    const workoutHistory = deriveWorkoutHistory();
    const loadAdjustment = calculateAdaptiveLoad(workoutHistory, { name: activeDay.dayName, reps: 0, sets: 0, weightLbs: 100 });
    const zone = acwrZone(loadAdjustment.acwr);
    const zoneColor = acwrZoneColor(zone);

    // Spaced repetition summary
    const studyStats = study?.spacedRepetition ? getPerformanceStats(study.spacedRepetition) : null;

    // Build personalized mobility picks
    const fatigue = deriveFatigueAreas();
    const screens = [{ joint: 'hips' as const, currentRangeDegrees: 45, targetRangeDegrees: 90, lastTested: today }];
    const mobilityPicks = buildTailoredMobilitySession(MOVES, screens, fatigue);

    return {
      ...activeDay,
      mealNames,
      loadAdjustment,
      acwrZone: zone,
      acwrZoneColor: zoneColor,
      studyStats,
      mobilityPicks
    };
  }, [weeklyTimeline, selectedDayOffset, nutrition, study, today]);

  // OLS Predictive Forecasting Card
  const progressForecasts = useMemo(() => {
    if (!metrics?.runPace?.length) return null;
    const target2MileTime = 13.5; // sub 13:30 min target (average select tier)
    return forecastTargetDate(metrics.runPace, PLAN_D_START, target2MileTime, false);
  }, [metrics]);

  // WS-7: pure read-only derivation of the Knowledge Focus snapshot from the
  // already-normalized store + the read-only pods.json fetch. Never
  // mutates knowledgeStore; falls back to a safe "unavailable" snapshot
  // (counts only, no raw IDs) until both pieces have loaded.
  const knowledgeFocusSnapshot: KnowledgeFocusSnapshot = useMemo(() => {
    if (!knowledgeStore) {
      return { available: false, activeCount: 0, reviewCount: 0 };
    }
    return deriveKnowledgeFocusSnapshot(knowledgeStore, knowledgePods);
  }, [knowledgeStore, knowledgePods]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-950 text-gray-100 flex items-center justify-center">
        <div className="text-center">
          <svg className="animate-spin h-10 w-10 text-blue-500 mx-auto mb-4" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <p className="text-gray-400">Aggregating training telemetry...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#09090a] text-gray-100">
      <div className="max-w-7xl mx-auto p-4">
        <TacticalPageHeader
          eyebrow="Week Plan"
          title="What happens next?"
          description="One week of training, meals, mobility, and study in a single operational view. Select a day to inspect its real logs."
          status={`Day ${planDProgress.day} · Week ${planDProgress.week}`}
        />
      </div>

      <div className="max-w-7xl mx-auto p-4 space-y-6">
        
        {/* Predictive & Standards Analytics Banners */}
        <div className="grid md:grid-cols-2 gap-4">
          {progressForecasts && (
            <div className="backdrop-blur-md bg-gray-900/40 border border-blue-500/20 rounded-2xl p-4 flex items-center gap-4 hover:border-blue-500/40 transition-colors">
              <div className="p-3 bg-blue-500/10 rounded-xl">
                <Flame className="w-6 h-6 text-blue-400" />
              </div>
              <div>
                <h4 className="text-xs uppercase tracking-wider text-gray-400 font-bold">Projected 2-Mile Target</h4>
                <p className="text-sm font-semibold mt-0.5 text-white">
                  Sub-13:30 2-Mile projection: <span className="text-blue-400 font-mono font-bold">{progressForecasts.dateString}</span>
                </p>
                <span className="text-[10px] text-gray-500">Trend confidence: {progressForecasts.r2.toFixed(2)}. Projection only.</span>
              </div>
            </div>
          )}

          {standardsAssessment && (
            <div className={`backdrop-blur-md bg-gray-900/40 border rounded-2xl p-4 flex items-center gap-4 hover:border-emerald-500/30 transition-colors ${
              standardsAssessment.tier === 'elite' ? 'border-emerald-500/30' : 'border-yellow-500/20'
            }`}>
              <div className="p-3 bg-emerald-500/10 rounded-xl">
                <Target className="w-6 h-6 text-emerald-400" />
              </div>
              <div>
                <h4 className="text-xs uppercase tracking-wider text-gray-400 font-bold">SOF Performance Evaluation</h4>
                <p className="text-sm font-semibold mt-0.5 text-white">
                  Running Standard: <span className="text-emerald-400 font-bold capitalize">{standardsAssessment.tier.replace('-', ' ')}</span>
                </p>
                <span className="text-[10px] text-gray-500">
                  {standardsAssessment.nextTargetGap > 0 
                    ? `Need to trim ${standardsAssessment.nextTargetGap}s to reach the next tier`
                    : 'Elite threshold maintained.'}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* The 7-Day Micro-HUD Matrix */}
        <div className="bg-gray-900/60 backdrop-blur-md border border-gray-800/50 rounded-2xl p-6 shadow-2xl">
          <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-blue-400" />
            This Week
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-7 gap-3">
            {weeklyTimeline.map((item, idx) => {
              const isSelected = idx === selectedDayOffset;
              const hasActivity = item.workoutLogged || item.macros.kcal > 0 || item.mobilityCount > 0;
              return (
                <button
                  key={item.isoDate}
                  onClick={() => setSelectedDayOffset(idx)}
                  className={`
                    relative text-left p-3.5 rounded-xl border flex flex-col justify-between h-36 transition-all duration-300
                    ${isSelected 
                      ? 'bg-gradient-to-b from-blue-600/20 to-purple-600/20 border-blue-500 shadow-lg shadow-blue-500/10 scale-105' 
                      : 'bg-gray-950/40 hover:bg-gray-900/40 border-gray-850 hover:border-gray-700/60'
                    }
                  `}
                >
                  <div>
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-bold uppercase text-gray-400">{item.dayName.slice(0, 3)}</span>
                      {item.isToday && <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-ping" />}
                    </div>
                    <div className="font-mono text-sm font-bold text-white mt-1">{item.isoDate.split('-')[2]}</div>
                  </div>

                  <div className="space-y-1.5 w-full">
                    {/* Activity visual markers */}
                    <div className="flex gap-1">
                      <div className={`h-1.5 flex-1 rounded-full ${item.workoutLogged ? 'bg-emerald-400 shadow-[0_0_4px_rgba(52,211,153,0.5)]' : 'bg-gray-800'}`} title="Workout" />
                      <div className={`h-1.5 flex-1 rounded-full ${item.macros.kcal > 0 ? 'bg-blue-400' : 'bg-gray-800'}`} title="Nutrition" />
                      <div className={`h-1.5 flex-1 rounded-full ${item.mobilityCount > 0 ? 'bg-purple-400' : 'bg-gray-800'}`} title="Mobility" />
                    </div>
                    <div className="text-[9px] text-gray-500 font-mono truncate">
                      {item.macros.kcal > 0 ? `${Math.round(item.macros.kcal)} cal` : 'no meals'}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <WeeklyPlanner
          days={weeklyTimeline}
          foods={[...FOODS, ...userMeals]}
          selectedDate={selectedDayData?.isoDate ?? today}
          onSelectDate={(date) => {
            const index = weeklyTimeline.findIndex(day => day.isoDate === date);
            if (index >= 0) setSelectedDayOffset(index);
          }}
        />

        {/* WS-7: read-only Knowledge Focus card (Architecture Amendment 3) */}
        <KnowledgeFocusCard snapshot={knowledgeFocusSnapshot} />

        {/* Selected Day compliance HUD */}
        {selectedDayData && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Left: Volume & Adaptation HUD */}
            <div className="backdrop-blur-md bg-gray-900/60 border border-gray-800/50 rounded-2xl p-5 space-y-4 hover:border-gray-750 transition-colors">
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <Dumbbell className="w-4 h-4 text-emerald-400" />
                Adaptive Load Analytics
              </h4>
              
              <div className="p-4 bg-gray-950/40 border border-gray-850 rounded-xl space-y-3">
                <div className="flex justify-between items-baseline">
                  <span className="text-xs text-gray-400 uppercase tracking-wider font-bold">Fatigue Index (ACWR)</span>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${selectedDayData.acwrZoneColor.bg} ${selectedDayData.acwrZoneColor.text} ${selectedDayData.acwrZoneColor.border}`}>
                    {selectedDayData.loadAdjustment.acwr.toFixed(2)}
                  </span>
                </div>
                <p className="text-sm leading-relaxed text-gray-300">{selectedDayData.loadAdjustment.recommendation}</p>
              </div>

              <div>
                <span className="text-[10px] text-gray-500 uppercase tracking-wider font-bold block mb-1">Target Workout day template</span>
                <div className="p-3 bg-gray-950/30 rounded-xl border border-gray-850 text-sm">
                  {selectedDayData.workoutLogged ? (
                    <p className="text-emerald-400 flex items-center gap-1.5 font-medium">
                      <CheckCircle2 className="w-4 h-4" /> Full Workout Volume Completed & Synced
                    </p>
                  ) : (
                    <p className="text-gray-400">Scheduled: Strength / Aerobic recovery logs</p>
                  )}
                </div>
              </div>
            </div>

            {/* Center: Nutrient timing Compliance */}
            <div className="backdrop-blur-md bg-gray-900/60 border border-gray-800/50 rounded-2xl p-5 space-y-4 hover:border-gray-750 transition-colors">
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <Activity className="w-4 h-4 text-blue-400" />
                Nutrient Intake & Fuels
              </h4>

              <div className="space-y-3">
                {(() => {
                  const activeTargetKcal = nutrition?.targets?.kcal ?? FOUNDATION_TARGETS.kcal;
                  const isFoundationPreset = (nutrition?.preset ?? 'foundation') === 'foundation';
                  const guidance = isFoundationPreset
                    ? resolveFoundationNutritionGuidance({ preset: 'foundation', isTrainingDay: selectedDayData.workoutLogged })
                    : null;
                  return (
                    <div>
                      <div className="flex justify-between text-xs mb-1.5">
                        <span className="text-gray-400">Calorie Target</span>
                        <span className="font-mono text-gray-200">{Math.round(selectedDayData.macros.kcal)} / {Math.round(activeTargetKcal)} kcal</span>
                      </div>
                      <div className="bg-gray-950/60 h-2.5 rounded-full overflow-hidden">
                        <div className="bg-gradient-to-r from-blue-500 to-purple-500 h-full transition-all duration-700"
                          style={{ width: `${Math.min(100, (selectedDayData.macros.kcal / activeTargetKcal) * 100)}%` }}
                        />
                      </div>
                      {guidance && (
                        <div className="mt-1.5 text-[10px] text-gray-500">
                          Foundation {selectedDayData.workoutLogged ? 'training-day' : 'rest-day'} range: {guidance.kcalRange[0]}–{guidance.kcalRange[1]} kcal · fat floor {guidance.fatFloorG}g+. Fixed target above is a midpoint, not this range.
                        </div>
                      )}
                    </div>
                  );
                })()}

                <div className="grid grid-cols-3 gap-2 text-center mt-4">
                  <div className="p-2 bg-gray-950/40 rounded-lg border border-gray-850">
                    <div className="text-[10px] text-gray-400">Protein</div>
                    <div className="font-mono font-bold text-sm text-green-400 mt-0.5">{Math.round(selectedDayData.macros.p)}g</div>
                  </div>
                  <div className="p-2 bg-gray-950/40 rounded-lg border border-gray-850">
                    <div className="text-[10px] text-gray-400">Carbs</div>
                    <div className="font-mono font-bold text-sm text-blue-400 mt-0.5">{Math.round(selectedDayData.macros.c)}g</div>
                  </div>
                  <div className="p-2 bg-gray-950/40 rounded-lg border border-gray-850">
                    <div className="text-[10px] text-gray-400">Fat</div>
                    <div className="font-mono font-bold text-sm text-orange-400 mt-0.5">{Math.round(selectedDayData.macros.f)}g</div>
                  </div>
                </div>

                {selectedDayData.mealNames.length > 0 ? (
                  <div className="pt-2">
                    <span className="text-[10px] text-gray-500 uppercase tracking-wider font-bold block mb-1">Logged Items</span>
                    <p className="text-xs text-gray-300 truncate">{selectedDayData.mealNames.join(' · ')}</p>
                  </div>
                ) : (
                  <div className="pt-2 text-center text-xs text-gray-500 italic">No food entries registered for this date.</div>
                )}
              </div>
            </div>

            {/* Right: Cognitive & Recovery */}
            <div className="backdrop-blur-md bg-gray-900/60 border border-gray-800/50 rounded-2xl p-5 space-y-4 hover:border-gray-750 transition-colors">
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-purple-400" />
                Adaptive Recovery & Study
              </h4>

              <div className="space-y-3">
                <div className="p-3 bg-gray-950/30 rounded-xl border border-gray-850">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-gray-400">Mobility Compliance</span>
                    <span className="text-purple-400 font-bold">{selectedDayData.mobilityCount} stretches</span>
                  </div>
                  {selectedDayData.mobilityPicks.length > 0 && (
                    <div className="mt-2 text-xs text-gray-400">
                      Top Pick: <span className="text-gray-200 font-semibold">{selectedDayData.mobilityPicks[0].name}</span> ({selectedDayData.mobilityPicks[0].time})
                    </div>
                  )}
                </div>

                <div className="p-3 bg-gray-950/30 rounded-xl border border-gray-850">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-gray-400">ASVAB Leitner Box Count</span>
                    <span className="text-green-400 font-bold font-mono">
                      {selectedDayData.studyStats?.totalQuestions || 0} active cards
                    </span>
                  </div>
                  <div className="mt-2 text-[10px] text-gray-500">Spaced repetition priority curves applied dynamically.</div>
                </div>
              </div>
            </div>

          </div>
        )}

      </div>
    </div>
  );
}