// Spaced Repetition Engine with Leitner System
// Implements priority-weighted question selection based on performance

export interface QuestionPerformance {
  questionId: string;
  correctCount: number;
  totalAttempts: number;
  lastAttempted: string; // ISO date
  currentBox: number; // Leitner box (1-5)
  averageTimeSeconds: number;
}

export interface SpacedRepetitionState {
  performanceMap: Record<string, QuestionPerformance>;
  lastReviewDate: string;
}

// Calculate days since last attempt
const daysSince = (isoDate: string): number => {
  const ms = Date.now() - new Date(isoDate).getTime();
  return ms / (1000 * 60 * 60 * 24);
};

// Calculate priority score for a question
export const calculatePriority = (perf: QuestionPerformance): number => {
  const accuracy = perf.totalAttempts > 0 ? perf.correctCount / perf.totalAttempts : 0;
  const daysSinceReview = daysSince(perf.lastAttempted);
  const recencyWeight = Math.log(daysSinceReview + 1);
  
  // Higher priority for lower accuracy and longer time since review
  // Box also affects priority (lower boxes = higher priority)
  const boxMultiplier = (6 - perf.currentBox) / 5;
  return (1 - accuracy) * recencyWeight * boxMultiplier;
};

// Update performance after answering a question
export const updatePerformance = (
  state: SpacedRepetitionState,
  questionId: string,
  correct: boolean,
  timeSeconds: number
): SpacedRepetitionState => {
  const existing = state.performanceMap[questionId] || {
    questionId,
    correctCount: 0,
    totalAttempts: 0,
    lastAttempted: new Date().toISOString(),
    currentBox: 1,
    averageTimeSeconds: 0
  };
  
  // Update counts
  const newCorrectCount = existing.correctCount + (correct ? 1 : 0);
  const newTotalAttempts = existing.totalAttempts + 1;
  
  // Update average time
  const newAvgTime = (existing.averageTimeSeconds * existing.totalAttempts + timeSeconds) / newTotalAttempts;
  
  // Update Leitner box
  let newBox = existing.currentBox;
  if (correct) {
    // Move up a box (max 5)
    newBox = Math.min(5, existing.currentBox + 1);
  } else {
    // Drop back to box 1
    newBox = 1;
  }
  
  return {
    ...state,
    performanceMap: {
      ...state.performanceMap,
      [questionId]: {
        questionId,
        correctCount: newCorrectCount,
        totalAttempts: newTotalAttempts,
        lastAttempted: new Date().toISOString(),
        currentBox: newBox,
        averageTimeSeconds: newAvgTime
      }
    }
  };
};

// Select questions using weighted random sampling based on priority
export const selectQuestionsWeighted = <T extends { id: string }>(
  questions: T[],
  state: SpacedRepetitionState,
  count: number
): T[] => {
  // Calculate priorities
  const questionsWithPriority = questions.map(q => {
    const perf = state.performanceMap[q.id];
    const priority = perf ? calculatePriority(perf) : 1.0; // New questions get high priority
    return { question: q, priority };
  });
  
  // Sort by priority descending
  questionsWithPriority.sort((a, b) => b.priority - a.priority);
  
  // Weighted random sampling
  const selected: T[] = [];
  const totalPriority = questionsWithPriority.reduce((sum, q) => sum + q.priority, 0);
  
  while (selected.length < count && questionsWithPriority.length > 0) {
    let random = Math.random() * totalPriority;
    
    for (let i = 0; i < questionsWithPriority.length; i++) {
      random -= questionsWithPriority[i].priority;
      if (random <= 0) {
        selected.push(questionsWithPriority[i].question);
        // Remove selected question from pool
        questionsWithPriority.splice(i, 1);
        break;
      }
    }
  }
  
  return selected;
};

// Get questions due for review based on Leitner intervals
export const getQueuedQuestions = (
  state: SpacedRepetitionState,
  allQuestionIds: string[]
): string[] => {
  const intervals = {
    1: 1,   // Box 1: review after 1 day
    2: 3,   // Box 2: review after 3 days
    3: 7,   // Box 3: review after 1 week
    4: 14,  // Box 4: review after 2 weeks
    5: 30   // Box 5: review after 1 month
  };
  
  return allQuestionIds.filter(id => {
    const perf = state.performanceMap[id];
    if (!perf) return true; // New questions are always due
    
    const daysSinceReview = daysSince(perf.lastAttempted);
    const interval = intervals[perf.currentBox as keyof typeof intervals];
    return daysSinceReview >= interval;
  });
};

// Get performance statistics
export const getPerformanceStats = (state: SpacedRepetitionState) => {
  const performances = Object.values(state.performanceMap);
  
  if (performances.length === 0) {
    return {
      totalQuestions: 0,
      averageAccuracy: 0,
      boxDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
      averageTimeSeconds: 0,
      questionsPerBox: { 1: [], 2: [], 3: [], 4: [], 5: [] } as Record<number, string[]>
    };
  }
  
  const totalAttempts = performances.reduce((sum, p) => sum + p.totalAttempts, 0);
  const totalCorrect = performances.reduce((sum, p) => sum + p.correctCount, 0);
  const averageAccuracy = totalAttempts > 0 ? totalCorrect / totalAttempts : 0;
  
  const boxDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  const questionsPerBox: Record<number, string[]> = { 1: [], 2: [], 3: [], 4: [], 5: [] };
  
  performances.forEach(p => {
    boxDistribution[p.currentBox as keyof typeof boxDistribution]++;
    questionsPerBox[p.currentBox].push(p.questionId);
  });
  
  const totalTime = performances.reduce((sum, p) => sum + (p.averageTimeSeconds * p.totalAttempts), 0);
  const averageTimeSeconds = totalAttempts > 0 ? totalTime / totalAttempts : 0;
  
  return {
    totalQuestions: performances.length,
    averageAccuracy,
    boxDistribution,
    averageTimeSeconds,
    questionsPerBox
  };
};