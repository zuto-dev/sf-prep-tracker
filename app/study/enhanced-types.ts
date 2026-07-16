// Enhanced types for the Full Infinite-Parametric Study Engine

import { ARQuestion } from './ar-question-bank';
import { SpacedRepetitionState } from './spaced-repetition';

// Enhanced study store with new fields
export interface EnhancedStudyStore {
  // Diagnostic scores
  arDiag?: number;
  mkDiag?: number;
  wkDiag?: number; // NEW: Word Knowledge diagnostic
  pcDiag?: number; // NEW: Paragraph Comprehension diagnostic
  
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
  startTime: number; // timestamp
  endTime: number; // timestamp
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