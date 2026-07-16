'use client';

import { useEffect, useMemo, useState } from 'react';
import { Nav } from '../components/Nav';
import { motion, AnimatePresence } from 'motion/react';
import { pullSfprepSync, pushSfprepSync } from '../lib/sfprep-sync';
import { AR_BANK, pickReviewSet, type ARQuestion } from './ar-question-bank';
import { calculateGTScore, calculateRequiredARForGT, TRACK_GT_REQUIREMENTS, estimateWeeksToTarget } from './psychometric-gt';
import { SpacedRepetitionState, updatePerformance, getPerformanceStats, calculatePriority } from './spaced-repetition';
import { EnhancedStudyStore, ErrorLogEntry, ReviewResult, TimedReviewState, QuestionTimingData } from './enhanced-types';
import { CheckCircle2, Circle, Timer, TrendingUp, Brain, AlertCircle, Zap, Target } from 'lucide-react';
import { useRouter } from 'next/navigation';

const STORAGE_KEY = 'sfprep:study';
const PLAN_START = '2026-07-13';
const TARGET_TIME_SECONDS = 222; // 3.7 minutes per question (AR CAT-ASVAB)

// ============================================================================
// Tracks — locked by AR diagnostic score
// ============================================================================
type Track = 'A' | 'B' | 'C';
const TRACK_DEFS: Record<Track, { arRange: string; program: string; weeks: number }> = {
  A: { arRange: 'AR ≥ 60%',    program: '8-week plan.',                             weeks: 8 },
  B: { arRange: 'AR 45–59%',   program: '10-week extended plan (extra drill wks).', weeks: 10 },
  C: { arRange: 'AR < 45%',    program: '12-week + no real test until 2×GT ≥ 110.', weeks: 12 },
};

type Session = { day: 'Mon' | 'Tue' | 'Wed' | 'Fri' | 'Sun'; layer: 'AR' | 'MK' | 'PC' | 'Review' | 'Drill'; core: string; peterson?: string };
type Week = { week: number; phase: 1 | 2 | 3; label: string; sessions: Session[] };

// TRACK A (8 wks) — original plan
const WEEKS_A: Week[] = [
  { week: 1, phase: 1, label: 'Foundation — untimed, choices-first', sessions: [
    { day: 'Mon', layer: 'AR', core: 'Strategy: read answer choices FIRST + estimate-vs-calculate intro. 5 easy word problems any type.' },
    { day: 'Wed', layer: 'MK', core: 'Fractions fluency. Finish w/ 5–10 AR fraction word problems.', peterson: 'Basic Arith Mod 1–2' },
    { day: 'Fri', layer: 'PC', core: 'PC Mod 1 + 10 min WK flashcards.' },
    { day: 'Sun', layer: 'Review', core: 'Mixed 40/40/20 + timed AR quiz + error log.' },
  ]},
  { week: 2, phase: 1, label: 'Translate words → math', sessions: [
    { day: 'Mon', layer: 'AR', core: 'Bar models + equation translation. Rate/time/distance.' },
    { day: 'Wed', layer: 'MK', core: 'Decimals + converting decimals↔fractions.', peterson: 'Basic Arith Mod 3–4' },
    { day: 'Fri', layer: 'PC', core: 'PC Mod 2 + WK.' },
    { day: 'Sun', layer: 'Review', core: 'Mixed + timed AR quiz + error log.' },
  ]},
  { week: 3, phase: 1, label: 'Eliminate + reasonableness', sessions: [
    { day: 'Mon', layer: 'AR', core: 'Eliminate 2 distractors + reasonableness check. Work problems.' },
    { day: 'Wed', layer: 'MK', core: 'Ratios & proportion.', peterson: 'Basic Arith Mod 5' },
    { day: 'Fri', layer: 'PC', core: 'PC Mod 3 + WK.' },
    { day: 'Sun', layer: 'Review', core: 'RETAKE AR diagnostic. Gate: must climb vs Wk 0.' },
  ]},
  { week: 4, phase: 2, label: 'Percents Type 1', sessions: [
    { day: 'Mon', layer: 'AR', core: 'Percents type 1 (find the part).' },
    { day: 'Wed', layer: 'MK', core: 'Percents + rates fluency.', peterson: 'Basic Arith Mod 6–7' },
    { day: 'Fri', layer: 'PC', core: 'PC Mod 4 + WK.' },
    { day: 'Sun', layer: 'Review', core: 'Mixed + timed AR quiz.' },
  ]},
  { week: 5, phase: 2, label: 'Percents Type 2 & Exponents', sessions: [
    { day: 'Mon', layer: 'AR', core: 'Percents type 2 (find the whole, percentage increase/decrease).' },
    { day: 'Wed', layer: 'MK', core: 'Exponents, roots, scientific notation.', peterson: 'Basic Algebra Mod 1' },
    { day: 'Fri', layer: 'PC', core: 'PC Mod 5 + WK.' },
    { day: 'Sun', layer: 'Review', core: 'Mixed + timed AR quiz.' },
  ]},
  { week: 6, phase: 2, label: 'Rates, Time & Shared Work', sessions: [
    { day: 'Mon', layer: 'AR', core: 'Shared work problems, advanced rate/time/distance.' },
    { day: 'Wed', layer: 'MK', core: 'Geometry basics (angles, lines, parallel lines).', peterson: 'Basic Geometry Mod 1' },
    { day: 'Fri', layer: 'PC', core: 'PC Mod 6 + WK.' },
    { day: 'Sun', layer: 'Review', core: 'Mixed + timed AR quiz.' },
  ]},
  { week: 7, phase: 3, label: 'Multi-Step Geometry & Algebra', sessions: [
    { day: 'Mon', layer: 'AR', core: 'Multi-step algebraic word problems (area, perimeter, volume interactions).' },
    { day: 'Wed', layer: 'MK', core: 'Algebraic equations and coordinate plane.', peterson: 'Basic Algebra Mod 2' },
    { day: 'Fri', layer: 'PC', core: 'PC Mod 7 + WK.' },
    { day: 'Sun', layer: 'Review', core: 'Mixed + timed AR quiz.' },
  ]},
  { week: 8, phase: 3, label: 'Final Peak & Pacing Gate', sessions: [
    { day: 'Mon', layer: 'AR', core: 'Final mock exam under strict 3.5 minutes per question pacing.' },
    { day: 'Wed', layer: 'MK', core: 'Advanced review of weaker algebraic equations.', peterson: 'Comprehensive Review' },
    { day: 'Fri', layer: 'PC', core: 'Full verbal Expression battery (WK + PC) retake.' },
    { day: 'Sun', layer: 'Review', core: 'Final GT diagnostic verification. Milestone check: GT ≥ 110.' },
  ]},
];

// TRACK B (10 wks)
const WEEKS_B: Week[] = [
  ...WEEKS_A.slice(0, 6),
  { week: 7, phase: 2, label: 'Ratios, Scales and Interest', sessions: [
    { day: 'Mon', layer: 'AR', core: 'Ratios, scale maps, and simple interest calculations.' },
    { day: 'Wed', layer: 'MK', core: 'Polygons, perimeter, and area calculations.', peterson: 'Basic Geometry Mod 2' },
    { day: 'Fri', layer: 'PC', core: 'PC Mod 7 + WK.' },
    { day: 'Sun', layer: 'Review', core: 'Mixed + timed AR quiz.' },
  ]},
  { week: 8, phase: 2, label: 'Combinatorics & Averages', sessions: [
    { day: 'Mon', layer: 'AR', core: 'Probability, combinations, and weighted averages word problems.' },
    { day: 'Wed', layer: 'MK', core: 'Averages, medians, and statistical representations.', peterson: 'Basic Stat Mod 1' },
    { day: 'Fri', layer: 'PC', core: 'PC Mod 8 + WK.' },
    { day: 'Sun', layer: 'Review', core: 'Mixed + timed AR quiz.' },
  ]},
  ...WEEKS_A.slice(6).map(w => ({ ...w, week: w.week + 2 })),
];

// TRACK C (12 wks)
const WEEKS_C: Week[] = [
  ...WEEKS_A.slice(0, 4),
  { week: 5, phase: 1, label: 'Advanced Equation Translation', sessions: [
    { day: 'Mon', layer: 'AR', core: 'Translating complex nested paragraphs into algebraic systems.' },
    { day: 'Wed', layer: 'MK', core: 'Linear equations with two variables.', peterson: 'Basic Algebra Mod 3' },
    { day: 'Fri', layer: 'PC', core: 'PC Mod 5 + WK.' },
    { day: 'Sun', layer: 'Review', core: 'Mixed + timed AR quiz.' },
  ]},
  { week: 6, phase: 2, label: 'Liquid Mixtures & Alloys', sessions: [
    { day: 'Mon', layer: 'AR', core: 'Mixture word problems and percentage concentrations.' },
    { day: 'Wed', layer: 'MK', core: 'Quadratic expressions and simple factoring.', peterson: 'Basic Algebra Mod 4' },
    { day: 'Fri', layer: 'PC', core: 'PC Mod 6 + WK.' },
    { day: 'Sun', layer: 'Review', core: 'Mixed + timed AR quiz.' },
  ]},
  ...WEEKS_B.slice(4).map(w => ({ ...w, week: w.week + 2 })),
];

// Select track based on AR score
function trackForAr(ar: number): 'A' | 'B' | 'C' {
  if (ar >= 60) return 'A';
  if (ar >= 45) return 'B';
  return 'C';
}

// Session state keys and Mastery gate keys
const SESSION_KEYS = ['Mon1', 'Mon2', 'Wed1', 'Wed2', 'Fri1', 'Fri2', 'Sun1', 'Sun2'];
const MASTERY_GATES = {
  'Fractions':         'Adds, subtracts, multiplies fractions correctly; knows LCM trick.',
  'Decimals':          'Converts decimals ↔ fractions; divides by decimals (0.05y = 1 → y = 20).',
  'Percents':          'Three types: find part, find whole, find rate (esp. % increase).',
  'Unit conversion':   'Imperial units: lb↔oz, ft↔in, gal↔qt. Time: decimal hours ↔ h:min.',
  'Ratios':            'Sets up proportion equations and cross-multiplies.',
  'Work rates':        'If A does X in T time, then Y takes... Combines worker rates.',
  'Mixture':           '25% solution + water → 10% solution requires what ratio?',
  'Exponents & roots': 'Basic rules (x²·x³ = x⁵), square roots, negative exponents.',
  'Algebraic setup':   'Word problem → equation correctly. Age, consecutive integers, coin.',
  'Probability':       'P(A) = favorable/total. AND vs OR. At least one = 1 − P(none).',
  'Distance = RT':     'When to add/subtract rates (same vs opposite direction).',
  'Scientific notion': '2.5 × 10³ = 2500; place value manipulation.',
  'Factorials/perms':  '5! = 120. Permutation vs combination formulas.',
};

// Main Store Interface
interface StudyStore extends EnhancedStudyStore {
  // Update methods
  setScores: (ar?: number, mk?: number, wk?: number, pc?: number) => void;
  toggleSession: (key: string) => void;
  toggleMastery: (key: string) => void;
  addError: (entry: ErrorLogEntry) => void;
  removeError: (id: string) => void;
  clearErrors: (missType: string) => void;
  addReviewResult: (result: ReviewResult) => void;
  updateSpacedRepetition: (state: SpacedRepetitionState) => void;
  addTimingData: (data: QuestionTimingData) => void;
}

// Create store hook
function useStudyStore(): StudyStore {
  const [store, setStore] = useState<EnhancedStudyStore>({
    sessionState: {},
    masteryChecks: {},
    errorLog: [],
    reviewResults: [],
    done: {},
    spacedRepetition: { performanceMap: {}, lastReviewDate: new Date().toISOString() },
    questionTimingHistory: []
  });
  const router = useRouter();

  // Load from localStorage and sync with server
  useEffect(() => {
    const loadState = async () => {
        await pullSfprepSync();
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                setStore(parsed);
                console.log('Study state loaded:', parsed);
            } catch (e) {
                console.error('Failed to parse study state:', e);
            }
        } else {
            console.warn('No study state found in localStorage');
        }
    };
    loadState();
  }, []);

  // Save to localStorage and push to sync
  useEffect(() => {
    if (Object.keys(store.sessionState).length === 0 && store.errorLog.length === 0) return;
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
    console.log('Study state saved:', store);
    
    // Push to sync (debounced)
    const timer = setTimeout(() => {
      pushSfprepSync();
    }, 1000);
    
    return () => clearTimeout(timer);
  }, [store]);

  // Update methods
  const setScores = (ar?: number, mk?: number, wk?: number, pc?: number) => {
    setStore(prev => {
        const next = { ...prev, arDiag: ar, mkDiag: mk, wkDiag: wk, pcDiag: pc };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        pushSfprepSync();
        return next;
    });
  };

  const toggleSession = (key: string) => {
    setStore(prev => {
      const current = prev.sessionState[key] || 'idle';
      const next = current === 'idle' ? 'in-progress' : 
                  current === 'in-progress' ? 'complete' : 'idle';
      return {
        ...prev,
        sessionState: { ...prev.sessionState, [key]: next }
      };
    });
  };

  const toggleMastery = (key: string) => {
    setStore(prev => ({
      ...prev,
      masteryChecks: { ...prev.masteryChecks, [key]: !prev.masteryChecks[key] }
    }));
  };

  const addError = (entry: ErrorLogEntry) => {
    setStore(prev => ({
      ...prev,
      errorLog: [...prev.errorLog, entry]
    }));
  };

  const removeError = (id: string) => {
    setStore(prev => ({
      ...prev,
      errorLog: prev.errorLog.filter(e => e.id !== id)
    }));
  };

  const clearErrors = (missType: string) => {
    setStore(prev => ({
      ...prev,
      errorLog: prev.errorLog.map(e => 
        e.missType === missType ? { ...e, cleared: true } : e
      )
    }));
  };

  const addReviewResult = (result: ReviewResult) => {
    setStore(prev => ({
      ...prev,
      reviewResults: [...prev.reviewResults, result]
    }));
  };

  const updateSpacedRepetition = (state: SpacedRepetitionState) => {
    setStore(prev => ({
      ...prev,
      spacedRepetition: state
    }));
  };

  const addTimingData = (data: QuestionTimingData) => {
    setStore(prev => ({
      ...prev,
      questionTimingHistory: [...prev.questionTimingHistory, data]
    }));
  };

  return {
    ...store,
    setScores,
    toggleSession,
    toggleMastery,
    addError,
    removeError,
    clearErrors,
    addReviewResult,
    updateSpacedRepetition,
    addTimingData
  };
}

// Timer Component for Quiz
function QuestionTimer({ startTime, onTimeout }: { startTime: number; onTimeout: () => void }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      const seconds = (Date.now() - startTime) / 1000;
      setElapsed(seconds);
      
      if (seconds > TARGET_TIME_SECONDS) {
        onTimeout();
      }
    }, 100);

    return () => clearInterval(interval);
  }, [startTime, onTimeout]);

  const paceColor = elapsed < 180 ? 'text-green-400' : 
                   elapsed < TARGET_TIME_SECONDS ? 'text-yellow-400' : 'text-red-400';

  return (
    <div className={`flex items-center gap-2 ${paceColor}`}>
      <Timer className="w-4 h-4" />
      <span className="font-mono text-sm">
        {Math.floor(elapsed / 60)}:{String(Math.floor(elapsed % 60)).padStart(2, '0')}
      </span>
      {elapsed > TARGET_TIME_SECONDS && <AlertCircle className="w-4 h-4 animate-pulse" />}
    </div>
  );
}

// Enhanced Review Modal with Timing
function ReviewModal({
  review,
  onSubmit,
  store
}: {
  review: TimedReviewState;
  onSubmit: (review: TimedReviewState) => void;
  store: StudyStore;
}) {
  const [currentReview, setCurrentReview] = useState(review);
  const currentQ = currentReview.qs[currentReview.currentQuestionIndex];

  const selectAnswer = (idx: number) => {
    const now = Date.now();
    const updatedReview = {
      ...currentReview,
      answers: [...currentReview.answers],
      endTimes: [...currentReview.endTimes]
    };
    
    updatedReview.answers[currentReview.currentQuestionIndex] = idx;
    updatedReview.endTimes[currentReview.currentQuestionIndex] = now;

    if (currentReview.currentQuestionIndex < currentReview.qs.length - 1) {
      // Move to next question
      updatedReview.currentQuestionIndex++;
      updatedReview.startTimes[updatedReview.currentQuestionIndex] = now;
      setCurrentReview(updatedReview);
    } else {
      // Submit the review
      updatedReview.done = true;
      onSubmit(updatedReview);
    }
  };

  const handleTimeout = () => {
    // Auto-select wrong answer on timeout
    selectAnswer(-1);
  };

  if (!currentQ) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur">
      <div className="w-full max-w-2xl bg-gray-900/90 border border-blue-500/20 rounded-lg p-6">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-violet-400 bg-clip-text text-transparent">
            {currentReview.missType} Review - Q{currentReview.currentQuestionIndex + 1}/{currentReview.qs.length}
          </h3>
          <QuestionTimer 
            startTime={currentReview.startTimes[currentReview.currentQuestionIndex]} 
            onTimeout={handleTimeout}
          />
        </div>

        <div className="space-y-4">
          <p className="text-lg">{currentQ.prompt}</p>
          <div className="space-y-2">
            {currentQ.choices.map((choice, idx) => (
              <button
                key={idx}
                onClick={() => selectAnswer(idx)}
                className="w-full p-4 text-left bg-gray-800/50 hover:bg-blue-500/20 
                         border border-gray-700 hover:border-blue-500/50 rounded-lg 
                         transition-all duration-200"
              >
                <span className="text-gray-400 mr-3">
                  {String.fromCharCode(65 + idx)}
                </span>
                {choice}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-6 flex gap-2">
          {Array.from({ length: currentReview.qs.length }, (_, i) => (
            <div
              key={i}
              className={`h-2 flex-1 rounded-full transition-all ${
                i < currentReview.currentQuestionIndex ? 'bg-blue-500' :
                i === currentReview.currentQuestionIndex ? 'bg-blue-400 animate-pulse' :
                'bg-gray-700'
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// Review Results Modal
function ReviewResultsModal({
  review,
  onClose,
  store
}: {
  review: TimedReviewState & { score: number };
  onClose: () => void;
  store: StudyStore;
}) {
  const pct = review.score / review.qs.length;
  const passed = pct >= 0.8;
  
  const timingStats = review.qs.map((q, i) => ({
    time: (review.endTimes[i] - review.startTimes[i]) / 1000,
    correct: review.answers[i] === q.correct,
    overTime: (review.endTimes[i] - review.startTimes[i]) / 1000 > TARGET_TIME_SECONDS
  }));
  
  const avgTime = timingStats.reduce((sum, s) => sum + s.time, 0) / timingStats.length;
  const overTimeCount = timingStats.filter(s => s.overTime).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur">
      <div className="w-full max-w-3xl bg-gray-900/90 border border-blue-500/20 rounded-lg p-6">
        <h3 className="text-xl font-bold mb-4 bg-gradient-to-r from-blue-400 to-violet-400 bg-clip-text text-transparent">
          Review Results - {review.missType}
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div className={`p-4 rounded-lg border ${passed ? 'bg-green-500/10 border-green-500/20' : 'bg-red-500/10 border-red-500/20'}`}>
            <p className="text-sm text-gray-400">Score</p>
            <p className="text-2xl font-bold">{review.score}/{review.qs.length} ({Math.round(pct * 100)}%)</p>
            <p className="text-sm mt-2">
              {passed ? '✅ Passed! Errors cleared.' : '❌ Keep practicing (need 80%)'}
            </p>
          </div>

          <div className={`p-4 rounded-lg border ${avgTime <= TARGET_TIME_SECONDS ? 'bg-green-500/10 border-green-500/20' : 'bg-yellow-500/10 border-yellow-500/20'}`}>
            <p className="text-sm text-gray-400">Pacing</p>
            <p className="text-2xl font-bold">{avgTime.toFixed(1)}s avg</p>
            <p className="text-sm mt-2">
              {overTimeCount > 0 ? `⚠️ ${overTimeCount} questions over time` : '✅ Good pace!'}
            </p>
          </div>
        </div>

        <div className="space-y-4 max-h-96 overflow-y-auto">
          {review.qs.map((q, i) => {
            const correct = review.answers[i] === q.correct;
            const time = timingStats[i].time;
            const overTime = timingStats[i].overTime;
            
            return (
              <div key={i} className={`p-4 rounded-lg border ${correct ? 'bg-gray-800/50 border-gray-700' : 'bg-red-500/10 border-red-500/20'}`}>
                <div className="flex justify-between items-start mb-2">
                  <p className="font-medium">{q.prompt}</p>
                  <div className="flex items-center gap-2">
                    {correct ? (
                      <CheckCircle2 className="w-5 h-5 text-green-400" />
                    ) : (
                      <AlertCircle className="w-5 h-5 text-red-400" />
                    )}
                    <span className={`text-sm ${overTime ? 'text-red-400' : 'text-gray-400'}`}>
                      {time.toFixed(1)}s
                    </span>
                  </div>
                </div>
                
                {!correct && (
                  <div className="text-sm space-y-1">
                    <p className="text-red-400">
                      Your answer: {q.choices[review.answers[i]] || 'Timed out'}
                    </p>
                    <p className="text-green-400">
                      Correct: {q.choices[q.correct]}
                    </p>
                    <p className="text-gray-400 italic mt-2">{q.explain}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <button
          onClick={onClose}
          className="mt-6 w-full py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition-colors"
        >
          Close
        </button>
      </div>
    </div>
  );
}

export default function StudyPage() {
  const store = useStudyStore();
  const [review, setReview] = useState<TimedReviewState | null>(null);
  const [reviewResults, setReviewResults] = useState<(TimedReviewState & { score: number }) | null>(null);
  const [showDiagInput, setShowDiagInput] = useState(false);
  
  // Inline baseline inputs for when diagnostics are missing
  const [tempAr, setTempAr] = useState<string>('');
  const [tempMk, setTempMk] = useState<string>('');
  const [tempWk, setTempWk] = useState<string>('86');
  const [tempPc, setTempPc] = useState<string>('75');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Calculate GT scores
  const gtCalc = useMemo(() => {
    if (!store.arDiag) return null;
    return calculateGTScore(store.arDiag, store.mkDiag, store.wkDiag, store.pcDiag);
  }, [store.arDiag, store.mkDiag, store.wkDiag, store.pcDiag]);

  const track = store.arDiag ? trackForAr(store.arDiag) : null;
  const weeks = track === 'A' ? WEEKS_A : track === 'B' ? WEEKS_B : WEEKS_C;

  // Scan weeks to find the first incomplete session
  const activeSession = useMemo(() => {
    if (!track) return null;
    const allWeeks = track === 'A' ? WEEKS_A : track === 'B' ? WEEKS_B : WEEKS_C;
    for (const w of allWeeks) {
      for (const s of w.sessions) {
        const key = `W${w.week}${s.day}`;
        if (store.sessionState[key] !== 'complete') {
          return { week: w, session: s, key };
        }
      }
    }
    return null; // All completed!
  }, [track, store.sessionState]);
  // Get spaced repetition stats
  const spacedRepStats = getPerformanceStats(store.spacedRepetition);

  // Start review
  const startReview = (missType: ARQuestion['missType']) => {
    const questions = pickReviewSet(missType, 5, store.spacedRepetition, true);
    const now = Date.now();
    
    setReview({
      missType,
      qs: questions,
      answers: new Array(questions.length).fill(-1),
      done: false,
      startTimes: [now, ...new Array(questions.length - 1).fill(0)],
      endTimes: new Array(questions.length).fill(0),
      currentQuestionIndex: 0,
      totalStartTime: now
    });
  };

  // Submit review
  const submitReview = (submittedReview: TimedReviewState) => {
    const score = submittedReview.qs.reduce((n, q, i) => 
      n + (submittedReview.answers[i] === q.correct ? 1 : 0), 0
    );
    
    // Update spaced repetition for each question
    let updatedSpacedRep = store.spacedRepetition;
    submittedReview.qs.forEach((q, i) => {
      const correct = submittedReview.answers[i] === q.correct;
      const timeSeconds = (submittedReview.endTimes[i] - submittedReview.startTimes[i]) / 1000;
      
      updatedSpacedRep = updatePerformance(updatedSpacedRep, q.id, correct, timeSeconds);
      
      // Auto-log failed questions
      if (!correct && !q.id.startsWith('gen_')) { // Don't log generated questions
        const errorEntry: ErrorLogEntry = {
          id: `auto_${Date.now()}_${i}`,
          date: new Date().toISOString(),
          section: 'AR Review',
          missType: submittedReview.missType,
          note: `Auto-logged: ${q.prompt}`,
          questionId: q.id,
          chosenAnswer: submittedReview.answers[i] >= 0 ? q.choices[submittedReview.answers[i]] : 'Timed out',
          correctAnswer: q.choices[q.correct],
          timeSeconds,
          autoLogged: true
        };
        store.addError(errorEntry);
      }
      
      // Add timing data
      const timingData: QuestionTimingData = {
        questionId: q.id,
        startTime: submittedReview.startTimes[i],
        endTime: submittedReview.endTimes[i],
        timeSeconds,
        correct,
        sessionId: `review_${submittedReview.totalStartTime}`
      };
      store.addTimingData(timingData);
    });
    
    store.updateSpacedRepetition(updatedSpacedRep);
    
    // Calculate average time and timeout count
    const timings = submittedReview.qs.map((_, i) => 
      (submittedReview.endTimes[i] - submittedReview.startTimes[i]) / 1000
    );
    const avgTime = timings.reduce((sum, t) => sum + t, 0) / timings.length;
    const timedOutCount = timings.filter(t => t > TARGET_TIME_SECONDS).length;
    
    // Add review result
    const result: ReviewResult = {
      date: new Date().toISOString(),
      missType: submittedReview.missType,
      score,
      total: submittedReview.qs.length,
      avgTimeSeconds: avgTime,
      questionsTimedOut: timedOutCount,
      spacedRepetitionUpdated: true
    };
    store.addReviewResult(result);
    
    // Clear errors if passed
    if (score / submittedReview.qs.length >= 0.8) {
      store.clearErrors(submittedReview.missType);
    }
    
    setReviewResults({ ...submittedReview, score });
    setReview(null);
  };

  // Check if we have diagnostics
  if (!store.arDiag || !store.mkDiag) {
    const handleSaveDiagnostics = () => {
      const ar = Number(tempAr);
      const mk = Number(tempMk);
      const wk = Number(tempWk);
      const pc = Number(tempPc);

      if (!tempAr || isNaN(ar) || ar < 0 || ar > 100) {
        setErrorMsg('Please enter a valid Arithmetic Reasoning (AR) score between 0 and 100%.');
        return;
      }
      if (!tempMk || isNaN(mk) || mk < 0 || mk > 100) {
        setErrorMsg('Please enter a valid Mathematical Knowledge (MK) score between 0 and 100%.');
        return;
      }
      if (isNaN(wk) || wk < 0 || wk > 100) {
        setErrorMsg('Word Knowledge (WK) must be between 0 and 100%.');
        return;
      }
      if (isNaN(pc) || pc < 0 || pc > 100) {
        setErrorMsg('Paragraph Comprehension (PC) must be between 0 and 100%.');
        return;
      }

      setErrorMsg(null);
      store.setScores(ar, mk, wk, pc);
    };

    return (
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="space-y-6"
      >
        <Nav />
        <div className="max-w-xl mx-auto">
          <div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-6 md:p-8 shadow-2xl relative overflow-hidden">
            {/* Ambient Background Glow */}
            <div className="absolute -top-24 -left-24 w-48 h-48 bg-blue-600/10 rounded-full blur-3xl" />
            <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-violet-600/10 rounded-full blur-3xl" />

            <div className="text-center mb-6 relative">
              <div className="w-12 h-12 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mx-auto mb-3">
                <Brain className="w-6 h-6 text-blue-400" />
              </div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-violet-400 bg-clip-text text-transparent">
                ASVAB Baseline Required
              </h1>
              <p className="text-gray-400 text-sm mt-2 max-w-sm mx-auto">
                AR is 50% of your Special Forces GT score. Input your Peterson&apos;s diagnostic percentages to unlock the Parametric Engine.
              </p>
            </div>

            {errorMsg && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 mb-6 flex items-start gap-2.5 text-red-200 text-sm">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            <div className="space-y-4 relative">
              {/* AR Input */}
              <div className="bg-gray-900/50 p-4 rounded-xl border border-gray-800">
                <div className="flex justify-between items-center mb-2">
                  <label className="text-sm font-semibold text-gray-200">
                    Arithmetic Reasoning (AR) %
                  </label>
                  <a
                    href="https://learn.petersons.com/d2l/lms/quizzing/user/quiz_summary.d2l?ou=507327&qi=38954"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-400 hover:text-blue-300 underline transition-colors"
                  >
                    Take on Peterson&apos;s →
                  </a>
                </div>
                <input
                  type="number"
                  min={0}
                  max={100}
                  placeholder="Enter baseline percentage (e.g. 50)"
                  value={tempAr}
                  onChange={(e) => setTempAr(e.target.value)}
                  className="w-full px-3 py-2.5 bg-gray-950 border border-gray-800 hover:border-gray-700 focus:border-blue-500 focus:outline-none rounded-lg text-sm text-white placeholder-gray-600 transition-colors"
                />
              </div>

              {/* MK Input */}
              <div className="bg-gray-900/50 p-4 rounded-xl border border-gray-800">
                <div className="flex justify-between items-center mb-2">
                  <label className="text-sm font-semibold text-gray-200">
                    Mathematical Knowledge (MK) %
                  </label>
                  <a
                    href="https://learn.petersons.com/d2l/lms/quizzing/user/quiz_summary.d2l?ou=507327&qi=38957"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-400 hover:text-blue-300 underline transition-colors"
                  >
                    Take on Peterson&apos;s →
                  </a>
                </div>
                <input
                  type="number"
                  min={0}
                  max={100}
                  placeholder="Enter baseline percentage (e.g. 46)"
                  value={tempMk}
                  onChange={(e) => setTempMk(e.target.value)}
                  className="w-full px-3 py-2.5 bg-gray-950 border border-gray-800 hover:border-gray-700 focus:border-blue-500 focus:outline-none rounded-lg text-sm text-white placeholder-gray-600 transition-colors"
                />
              </div>

              {/* Advanced / Optional block */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-900/40 p-3 rounded-xl border border-gray-800/60">
                  <label className="text-xs text-gray-400 block mb-1">
                    Word Knowledge (WK) %
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={tempWk}
                    onChange={(e) => setTempWk(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-950 border border-gray-800 focus:border-blue-500 focus:outline-none rounded-lg text-xs text-white"
                  />
                </div>
                <div className="bg-gray-900/40 p-3 rounded-xl border border-gray-800/60">
                  <label className="text-xs text-gray-400 block mb-1">
                    Paragraph Comp (PC) %
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={tempPc}
                    onChange={(e) => setTempPc(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-950 border border-gray-800 focus:border-blue-500 focus:outline-none rounded-lg text-xs text-white"
                  />
                </div>
              </div>

              <button
                onClick={handleSaveDiagnostics}
                className="w-full py-3 mt-2 bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-500 hover:to-violet-500 text-white rounded-lg font-semibold text-sm transition-all duration-200 shadow-lg shadow-blue-950/20 active:scale-[0.98]"
              >
                Unlock Parametric Study Engine
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className="space-y-6"
    >
      <Nav />

      {/* Main Stats Banner */}
      <div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="font-mono text-xs text-gray-500 tracking-widest uppercase">COGNITIVE LAB</span>
          <h2 className="text-xl md:text-2xl font-bold font-display mt-0.5 text-white">
            ASVAB / GT Study Suite
          </h2>
          <p className="text-gray-400 text-sm mt-1">
            Peterson's diagnostic baseline percentages mapping to adaptive Leitner system.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <div className="bg-gray-950/40 border border-gray-800/80 px-4 py-2.5 rounded-xl text-center min-w-[100px]">
            <div className="text-[10px] text-gray-400 font-mono uppercase">ESTIMATED GT</div>
            <div className={`text-lg font-black font-mono ${gtCalc?.meetsTarget ? 'text-green-400' : 'text-yellow-400'}`}>
              {gtCalc?.estimatedGT ?? '—'}
            </div>
          </div>
          <div className="bg-gray-950/40 border border-gray-800/80 px-4 py-2.5 rounded-xl text-center min-w-[100px]">
            <div className="text-[10px] text-gray-400 font-mono uppercase">TO TARGET</div>
            <div className={`text-lg font-black font-mono ${gtCalc?.meetsTarget ? 'text-green-400' : 'text-orange-400'}`}>
              {gtCalc ? (gtCalc.meetsTarget ? '✓ Met' : `+${gtCalc.pointsToTarget}`) : '—'}
            </div>
          </div>
          <div className="bg-gray-950/40 border border-gray-800/80 px-4 py-2.5 rounded-xl text-center min-w-[100px]">
            <div className="text-[10px] text-gray-400 font-mono uppercase">TRACK</div>
            <div className="text-lg font-black font-mono text-blue-400">
              {track}
            </div>
          </div>
          <button
            onClick={() => setShowDiagInput(!showDiagInput)}
            className="px-4 py-2.5 bg-gray-850 hover:bg-gray-800 border border-gray-750 text-white rounded-xl text-xs font-mono transition-colors self-stretch flex items-center justify-center"
          >
            Update Scores
          </button>
        </div>
      </div>

      {/* Score Input Panel */}
      {showDiagInput && (
        <div className="p-5 bg-gray-900/40 border border-gray-800 rounded-2xl">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="text-xs text-gray-400 font-mono block mb-1">AR %</label>
              <input
                type="number"
                value={store.arDiag || ''}
                onChange={(e) => store.setScores(Number(e.target.value), store.mkDiag, store.wkDiag, store.pcDiag)}
                className="w-full px-3 py-2 bg-gray-950 border border-gray-850 hover:border-gray-750 focus:border-blue-500 focus:outline-none rounded-xl text-sm text-white"
              />
            </div>
            <div>
              <label className="text-xs text-gray-400 font-mono block mb-1">MK %</label>
              <input
                type="number"
                value={store.mkDiag || ''}
                onChange={(e) => store.setScores(store.arDiag, Number(e.target.value), store.wkDiag, store.pcDiag)}
                className="w-full px-3 py-2 bg-gray-950 border border-gray-850 hover:border-gray-750 focus:border-blue-500 focus:outline-none rounded-xl text-sm text-white"
              />
            </div>
            <div>
              <label className="text-xs text-gray-400 font-mono block mb-1">WK % (Word Knowledge)</label>
              <input
                type="number"
                value={store.wkDiag || ''}
                onChange={(e) => store.setScores(store.arDiag, store.mkDiag, Number(e.target.value), store.pcDiag)}
                placeholder="86"
                className="w-full px-3 py-2 bg-gray-950 border border-gray-850 hover:border-gray-750 focus:border-blue-500 focus:outline-none rounded-xl text-sm text-white"
              />
            </div>
            <div>
              <label className="text-xs text-gray-400 font-mono block mb-1">PC % (Paragraph Comp)</label>
              <input
                type="number"
                value={store.pcDiag || ''}
                onChange={(e) => store.setScores(store.arDiag, store.mkDiag, store.wkDiag, Number(e.target.value))}
                placeholder="75"
                className="w-full px-3 py-2 bg-gray-950 border border-gray-850 hover:border-gray-750 focus:border-blue-500 focus:outline-none rounded-xl text-sm text-white"
              />
            </div>
          </div>
          <div className="mt-3 text-xs font-mono text-gray-400">
            VE Standard Score: {gtCalc?.veStandardScore || '--'} | 
            AR Standard Score: {gtCalc?.arStandardScore || '--'}
          </div>
        </div>
      )}

      <div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">
            {/* RETARD-PROOF DAILY STUDY GUIDE */}
            {activeSession ? (
              <div className="bg-gradient-to-r from-blue-900/40 via-violet-900/30 to-black border-2 border-blue-500/30 rounded-2xl p-6 shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 px-3 py-1 bg-blue-500/20 text-blue-300 text-[10px] uppercase font-bold tracking-wider rounded-bl-xl border-l border-b border-blue-500/30">
                  Active Study Session
                </div>
                
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-blue-500/10 border border-blue-500/30 flex items-center justify-center">
                    <Target className="w-5 h-5 text-blue-400" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-white">
                      Week {activeSession.week.week} · {activeSession.session.day} Session
                    </h2>
                    <p className="text-xs text-gray-400">
                      Objective: <span className="text-gray-300 font-medium">{activeSession.week.label}</span>
                    </p>
                  </div>
                </div>

                <div className="bg-black/50 rounded-xl p-4 border border-gray-800 space-y-3.5 mb-5">
                  <div className="flex gap-2.5 items-start">
                    <div className="w-5 h-5 rounded-full bg-blue-600/20 border border-blue-500/30 text-[10px] flex items-center justify-center text-blue-300 font-bold shrink-0 mt-0.5">1</div>
                    <div>
                      <p className="text-xs font-semibold text-gray-300">CORE THEORY LESSON</p>
                      <p className="text-sm text-white font-medium mt-0.5">{activeSession.session.core}</p>
                    </div>
                  </div>

                  {activeSession.session.peterson && (
                    <div className="flex gap-2.5 items-start">
                      <div className="w-5 h-5 rounded-full bg-violet-600/20 border border-violet-500/30 text-[10px] flex items-center justify-center text-violet-300 font-bold shrink-0 mt-0.5">2</div>
                      <div>
                        <p className="text-xs font-semibold text-gray-300">PETERSON&apos;S MODULE TASK</p>
                        <p className="text-sm text-blue-400 font-medium mt-0.5">📚 Peterson&apos;s Module: {activeSession.session.peterson}</p>
                      </div>
                    </div>
                  )}

                  <div className="flex gap-2.5 items-start">
                    <div className="w-5 h-5 rounded-full bg-green-600/20 border border-green-500/30 text-[10px] flex items-center justify-center text-green-300 font-bold shrink-0 mt-0.5">
                      {activeSession.session.peterson ? '3' : '2'}
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-gray-300">DAILY PRACTICE DRILL</p>
                      <p className="text-sm text-gray-400 mt-0.5">
                        {activeSession.session.layer === 'AR' || activeSession.session.layer === 'MK'
                          ? 'Run a 5-question parametric drill to test your speed and accuracy.'
                          : 'Practice active reading and verbal comprehension cards.'}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
                  {(activeSession.session.layer === 'AR' || activeSession.session.layer === 'MK') && (
                    <button
                      onClick={() => startReview(activeSession.session.layer === 'AR' ? 'arithmetic' : 'setup')}
                      className="flex-1 py-3 px-4 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-md shadow-blue-950/20 active:scale-[0.98]"
                    >
                      <Zap className="w-4 h-4" />
                      START DRILL NOW
                    </button>
                  )}
                  
                  <button
                    onClick={() => store.toggleSession(activeSession.key)}
                    className="flex-1 py-3 px-4 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-500 hover:to-green-600 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-md shadow-green-950/20 active:scale-[0.98]"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    MARK COMPLETED & ADVANCE
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-green-900/10 border-2 border-green-500/20 rounded-2xl p-6 text-center">
                <CheckCircle2 className="w-12 h-12 text-green-400 mx-auto mb-2" />
                <h2 className="text-lg font-bold text-white">All Scheduled Sessions Completed!</h2>
                <p className="text-gray-400 text-sm mt-1">Excellent work. Keep drilling with parametric questions to sharpen your speed gate!</p>
              </div>
            )}

            {/* Week Schedule */}
            <div className="bg-gray-900/50 backdrop-blur rounded-xl border border-gray-800 p-6">
              <h2 className="text-xl font-bold mb-6 bg-gradient-to-r from-blue-400 to-violet-400 bg-clip-text text-transparent">
                Study Schedule - {TRACK_DEFS[track!].program}
              </h2>
              
              <div className="space-y-4">
                {weeks.slice(0, 4).map(week => (
                  <div key={week.week} className="bg-gray-800/50 rounded-lg p-4">
                    <h3 className="font-medium mb-2">Week {week.week}: {week.label}</h3>
                    <div className="space-y-2">
                      {week.sessions.map((session, idx) => (
                        <div key={idx} className="flex items-start gap-3">
                          <button
                            onClick={() => store.toggleSession(`W${week.week}${session.day}`)}
                            className="mt-0.5"
                          >
                            {store.sessionState[`W${week.week}${session.day}`] === 'complete' ? (
                              <CheckCircle2 className="w-5 h-5 text-green-400" />
                            ) : (
                              <Circle className="w-5 h-5 text-gray-600 hover:text-blue-400 transition-colors" />
                            )}
                          </button>
                          <div className="flex-1">
                            <p className="font-medium text-sm">{session.day} - {session.layer}</p>
                            <p className="text-sm text-gray-400">{session.core}</p>
                            {session.peterson && (
                              <p className="text-xs text-blue-400 mt-1">📚 {session.peterson}</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Mastery Gates */}
            <div className="bg-gray-900/50 backdrop-blur rounded-xl border border-gray-800 p-6">
              <h2 className="text-xl font-bold mb-6 bg-gradient-to-r from-green-400 to-emerald-400 bg-clip-text text-transparent">
                Mastery Gates
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {Object.entries(MASTERY_GATES).map(([key, desc]) => (
                  <button
                    key={key}
                    onClick={() => store.toggleMastery(key)}
                    className={`p-3 rounded-lg border text-left transition-all ${
                      store.masteryChecks[key]
                        ? 'bg-green-500/10 border-green-500/20'
                        : 'bg-gray-800/50 border-gray-700 hover:border-gray-600'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {store.masteryChecks[key] ? (
                        <CheckCircle2 className="w-5 h-5 text-green-400 mt-0.5" />
                      ) : (
                        <Circle className="w-5 h-5 text-gray-600 mt-0.5" />
                      )}
                      <div>
                        <p className="font-medium text-sm">{key}</p>
                        <p className="text-xs text-gray-400 mt-1">{desc}</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Error Log */}
            <div className="bg-gray-900/50 backdrop-blur rounded-xl border border-gray-800 p-6">
              <h2 className="text-xl font-bold mb-6 bg-gradient-to-r from-red-400 to-orange-400 bg-clip-text text-transparent">
                Error Log & Review
              </h2>
              
              <div className="mb-4 flex flex-wrap gap-2">
                {['translation', 'setup', 'arithmetic', 'units', 'distractor', 'misread'].map(type => {
                  const typeErrors = store.errorLog.filter(e => e.missType === type && !e.cleared);
                  return (
                    <button
                      key={type}
                      onClick={() => startReview(type as ARQuestion['missType'])}
                      disabled={typeErrors.length === 0}
                      className={`px-4 py-2 rounded-lg font-medium transition-all ${
                        typeErrors.length > 0
                          ? 'bg-red-500/20 hover:bg-red-500/30 border border-red-500/40'
                          : 'bg-gray-800/50 text-gray-600 cursor-not-allowed'
                      }`}
                    >
                      Review {type} ({typeErrors.length})
                    </button>
                  );
                })}
              </div>
              
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {store.errorLog.slice().reverse().slice(0, 10).map(error => (
                  <div
                    key={error.id}
                    className={`p-3 rounded-lg flex items-start gap-3 ${
                      error.cleared
                        ? 'bg-green-500/10 border border-green-500/20'
                        : 'bg-gray-800/50 border border-gray-700'
                    }`}
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs px-2 py-1 rounded ${
                          error.autoLogged ? 'bg-blue-500/20 text-blue-400' : 'bg-gray-700 text-gray-400'
                        }`}>
                          {error.missType}
                        </span>
                        {error.autoLogged && <Zap className="w-3 h-3 text-blue-400" />}
                        <span className="text-xs text-gray-500">
                          {new Date(error.date).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-sm mt-1">{error.note}</p>
                      {error.questionId && (
                        <div className="text-xs text-gray-400 mt-1">
                          {error.chosenAnswer && <p>Your answer: {error.chosenAnswer}</p>}
                          {error.correctAnswer && <p>Correct: {error.correctAnswer}</p>}
                          {error.timeSeconds && <p>Time: {error.timeSeconds.toFixed(1)}s</p>}
                        </div>
                      )}
                    </div>
                    {!error.cleared && (
                      <button
                        onClick={() => store.removeError(error.id)}
                        className="text-gray-500 hover:text-red-400 transition-colors"
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Spaced Repetition Stats */}
            <div className="bg-gray-900/50 backdrop-blur rounded-xl border border-gray-800 p-6">
              <h3 className="font-bold mb-4 bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                Spaced Repetition Stats
              </h3>
              
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-gray-400">Overall Accuracy</p>
                  <p className="text-2xl font-bold">
                    {(spacedRepStats.averageAccuracy * 100).toFixed(1)}%
                  </p>
                </div>
                
                <div>
                  <p className="text-sm text-gray-400 mb-2">Leitner Boxes</p>
                  <div className="space-y-1">
                    {[1, 2, 3, 4, 5].map(box => (
                      <div key={box} className="flex items-center gap-2">
                        <span className="text-xs text-gray-500 w-12">Box {box}</span>
                        <div className="flex-1 h-4 bg-gray-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-purple-600 to-pink-600"
                            style={{
                              width: `${
                                (spacedRepStats.boxDistribution[box as keyof typeof spacedRepStats.boxDistribution] /
                                  Math.max(1, spacedRepStats.totalQuestions)) *
                                100
                              }%`
                            }}
                          />
                        </div>
                        <span className="text-xs text-gray-400 w-8 text-right">
                          {spacedRepStats.boxDistribution[box as keyof typeof spacedRepStats.boxDistribution]}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
                
                <div>
                  <p className="text-sm text-gray-400">Average Time/Question</p>
                  <p className={`text-xl font-bold ${
                    spacedRepStats.averageTimeSeconds <= TARGET_TIME_SECONDS
                      ? 'text-green-400'
                      : 'text-orange-400'
                  }`}>
                    {spacedRepStats.averageTimeSeconds.toFixed(1)}s
                  </p>
                </div>
              </div>
            </div>

            {/* Recent Reviews */}
            <div className="bg-gray-900/50 backdrop-blur rounded-xl border border-gray-800 p-6">
              <h3 className="font-bold mb-4 bg-gradient-to-r from-cyan-400 to-teal-400 bg-clip-text text-transparent">
                Recent Reviews
              </h3>
              
              <div className="space-y-3">
                {store.reviewResults.slice(-5).reverse().map((result, idx) => {
                  const pct = result.score / result.total;
                  return (
                    <div key={idx} className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">{result.missType}</p>
                        <p className="text-xs text-gray-400">
                          {new Date(result.date).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className={`font-medium ${pct >= 0.8 ? 'text-green-400' : 'text-red-400'}`}>
                          {Math.round(pct * 100)}%
                        </p>
                        <p className="text-xs text-gray-400">
                          {result.avgTimeSeconds.toFixed(1)}s avg
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-gray-900/50 backdrop-blur rounded-xl border border-gray-800 p-6">
              <h3 className="font-bold mb-4">Quick Actions</h3>
              
              <div className="space-y-3">
                <button
                  onClick={() => startReview('arithmetic')}
                  className="w-full py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition-colors"
                >
                  Start Arithmetic Drill
                </button>
                
                <button
                  onClick={() => {
                    setShowDiagInput(true);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className="w-full py-3 bg-violet-600 hover:bg-violet-700 rounded-lg font-medium text-center transition-colors"
                >
                  Update/Retake Diagnostics
                </button>
                
                <button
                  onClick={() => {
                    const requiredAR = calculateRequiredARForGT(110, store.wkDiag || 86, store.pcDiag || 75);
                    alert(`To hit GT 110, you need AR ≥ ${requiredAR}%\\n\\nEstimated ${estimateWeeksToTarget(gtCalc?.estimatedGT || 100, 110, store.arDiag!)} weeks of focused practice.`);
                  }}
                  className="w-full py-3 bg-gray-700 hover:bg-gray-600 rounded-lg font-medium transition-colors"
                >
                  Calculate Path to GT 110
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Review Modal */}
      {review && !review.done && (
        <ReviewModal review={review} onSubmit={submitReview} store={store} />
      )}

      {/* Review Results Modal */}
      {reviewResults && (
        <ReviewResultsModal
          review={reviewResults}
          onClose={() => setReviewResults(null)}
          store={store}
        />
      )}
    </motion.div>
  );
}