import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { SpacedRepetitionState } from '@/app/study/spaced-repetition';
import { ErrorLogEntry, ReviewResult } from '@/app/study/enhanced-types';

const DATA_DIR = path.join(process.cwd(), '.data');
const STUDY_FILE = path.join(DATA_DIR, 'study-program.json');

interface StudyData {
  // Diagnostic scores
  arDiag?: number;
  mkDiag?: number;
  wkDiag?: number; // NEW
  pcDiag?: number; // NEW
  
  // Session states
  sessionState: Record<string, 'idle' | 'in-progress' | 'complete'>;
  
  // Mastery gates
  masteryChecks: Record<string, boolean>;
  
  // Error tracking
  errorLog: ErrorLogEntry[];
  reviewResults: ReviewResult[];
  
  // Section completion
  done: Record<string, number>;
  
  // NEW: Spaced repetition state
  spacedRepetition: SpacedRepetitionState;
  
  // NEW: Question timing history
  questionTimingHistory: Array<{
    questionId: string;
    startTime: number;
    endTime: number;
    timeSeconds: number;
    correct: boolean;
    sessionId: string;
  }>;
  
  // Metadata
  lastSync: string;
  week?: number;
}

async function ensureDataDir() {
  try {
    await fs.access(DATA_DIR);
  } catch {
    await fs.mkdir(DATA_DIR, { recursive: true });
  }
}

async function readData(): Promise<StudyData> {
  try {
    await ensureDataDir();
    const data = await fs.readFile(STUDY_FILE, 'utf-8');
    const parsed = JSON.parse(data);
    
    // Initialize new fields if missing
    return {
      ...parsed,
      spacedRepetition: parsed.spacedRepetition || {
        performanceMap: {},
        lastReviewDate: new Date().toISOString()
      },
      questionTimingHistory: parsed.questionTimingHistory || []
    };
  } catch {
    // Default data structure
    return {
      sessionState: {},
      masteryChecks: {},
      errorLog: [],
      reviewResults: [],
      done: {},
      spacedRepetition: {
        performanceMap: {},
        lastReviewDate: new Date().toISOString()
      },
      questionTimingHistory: [],
      lastSync: new Date().toISOString()
    };
  }
}

async function writeData(data: StudyData) {
  await ensureDataDir();
  await fs.writeFile(STUDY_FILE, JSON.stringify(data, null, 2));
}

export async function GET() {
  const data = await readData();
  return NextResponse.json(data);
}

export async function POST(req: Request) {
  const body = await req.json();
  const current = await readData();
  
  // Handle different patch operations
  if (body.patch === 'scores') {
    const updated: StudyData = {
      ...current,
      arDiag: body.arDiag ?? current.arDiag,
      mkDiag: body.mkDiag ?? current.mkDiag,
      wkDiag: body.wkDiag ?? current.wkDiag, // NEW
      pcDiag: body.pcDiag ?? current.pcDiag, // NEW
      lastSync: new Date().toISOString()
    };
    await writeData(updated);
    return NextResponse.json(updated);
  }
  
  if (body.patch === 'week') {
    const updated: StudyData = {
      ...current,
      week: body.week,
      lastSync: new Date().toISOString()
    };
    await writeData(updated);
    return NextResponse.json(updated);
  }
  
  if (body.patch === 'addError') {
    const updated: StudyData = {
      ...current,
      errorLog: [...current.errorLog, body.error],
      lastSync: new Date().toISOString()
    };
    await writeData(updated);
    return NextResponse.json(updated);
  }
  
  if (body.patch === 'removeError') {
    const updated: StudyData = {
      ...current,
      errorLog: current.errorLog.filter(e => e.id !== body.id),
      lastSync: new Date().toISOString()
    };
    await writeData(updated);
    return NextResponse.json(updated);
  }
  
  if (body.patch === 'milestone') {
    const updated: StudyData = {
      ...current,
      ...body.data,
      lastSync: new Date().toISOString()
    };
    await writeData(updated);
    return NextResponse.json(updated);
  }
  
  // NEW: Update spaced repetition state
  if (body.patch === 'spacedRepetition') {
    const updated: StudyData = {
      ...current,
      spacedRepetition: body.spacedRepetition,
      lastSync: new Date().toISOString()
    };
    await writeData(updated);
    return NextResponse.json(updated);
  }
  
  // NEW: Add timing data
  if (body.patch === 'addTiming') {
    const updated: StudyData = {
      ...current,
      questionTimingHistory: [...current.questionTimingHistory, body.timing],
      lastSync: new Date().toISOString()
    };
    await writeData(updated);
    return NextResponse.json(updated);
  }
  
  // Full replacement
  const updated: StudyData = {
    ...body,
    lastSync: new Date().toISOString()
  };
  await writeData(updated);
  return NextResponse.json(updated);
}