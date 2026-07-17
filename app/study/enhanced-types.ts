// Enhanced types for the Full Infinite-Parametric Study Engine

import { ARQuestion } from './ar-question-bank';
import { SpacedRepetitionState } from './spaced-repetition';

// Test format governs the per-question timer benchmark. CAT-ASVAB (at MEPS)
// gives 3:42/question; MET (paper at satellite sites) gives 72s/question.
// Training against the wrong clock is a real failure mode; pin this early.
export type TestFormat = 'cat' | 'met';
export const BENCHMARK_SECONDS: Record<TestFormat, number> = { cat: 222, met: 72 };

// Enhanced study store with new fields
export interface EnhancedStudyStore {
  // Diagnostic scores
  arDiag?: number;
  mkDiag?: number;
  wkDiag?: number; // NEW: Word Knowledge diagnostic
  pcDiag?: number; // NEW: Paragraph Comprehension diagnostic

  // Test configuration
  testDate?: string;        // ISO date of the scheduled ASVAB
  testFormat?: TestFormat;  // Defaults to 'cat' if unset
  
  // Session tracking
  sessionState: Record<string, 'idle' | 'in-progress' | 'complete'>;
  
  // Mastery gates
  masteryChecks: Record<string, boolean>;
  
  // Error log with auto-logged entries
  errorLog: ErrorLogEntry[];
  
  // Review results with timing data
  reviewResults: ReviewResult[];
  
  // Section completion tracking
  done: Record<string, number>;
  
  // Spaced repetition state
  spacedRepetition: SpacedRepetitionState;
  
  // Question timing data
  questionTimingHistory: QuestionTimingData[];
}

// Enhanced error log entry with question reference
export interface ErrorLogEntry {
  id: string;
  date: string;
  section: string;
  missType: ARQuestion['missType'];
  note: string;
  cleared?: boolean;
  // NEW fields for auto-logging
  questionId?: string; // Reference to specific question
  chosenAnswer?: string;
  correctAnswer?: string;
  timeSeconds?: number; // Time spent on question
  autoLogged?: boolean; // Flag for auto vs manual entry
}

// Enhanced review result with timing
export interface ReviewResult {
  date: string;
  missType: string;
  score: number;
  total: number;
  // NEW fields
  avgTimeSeconds: number;
  questionsTimedOut: number; // Questions that took > 3.7 min
  spacedRepetitionUpdated: boolean;
}

// Question timing data
export interface QuestionTimingData {
  questionId: string;
  // Recorded at write-time so downstream aggregations don't need to look
  // the question back up (generated questions may not exist by then).
  missType?: string;
  startTime: number; // timestamp
  endTime: number;   // timestamp
  timeSeconds: number;
  correct: boolean;
  sessionId: string;
}

// Review state with timing
export interface TimedReviewState {
  missType: ARQuestion['missType'];
  qs: ARQuestion[];
  answers: number[];
  done: boolean;
  // NEW timing fields
  startTimes: number[]; // Per-question start timestamps
  endTimes: number[]; // Per-question end timestamps
  currentQuestionIndex: number;
  totalStartTime: number;
}

// GT calculation with psychometric conversion
export interface GTCalculation {
  wkScore: number;
  pcScore: number;
  veStandardScore: number;
  arScore: number;
  arStandardScore: number;
  estimatedGT: number;
  meetsTarget: boolean;
  pointsToTarget: number;
}

// Session metrics
export interface SessionMetrics {
  questionsAttempted: number;
  correctAnswers: number;
  avgTimePerQuestion: number;
  questionsOverTimeLimit: number;
  accuracy: number;
  estimatedGTProgress: number;
}