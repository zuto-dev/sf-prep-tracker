// SECTION 4: Intelligent Nutrient-Timing & Inventory Engine
// Implements the Gaussian time-weight curve + context-aware scoring from the
// 2026-07-16 full-site remake blueprint (SECTION 4.3).

export type TrainingType = 'run' | 'ruck' | 'strength' | 'rest';

export type MacroGap = { kcal: number; p: number; c: number; f: number };

export type SuggestionContext = {
  currentTime: Date;
  trainingTime: Date | null; // null = no session scheduled today
  trainingType: TrainingType;
  macroGaps: MacroGap;
};

export type ScorableFood = { p: number; c: number; f: number; kcal?: number };

export type NutrientWindow = 'pre-workout' | 'post-workout' | 'night' | 'normal';

/**
 * Gaussian time-weight — how strongly a window's macro bias should apply
 * based on proximity to the target time. sigma controls how "wide" the
 * window's influence is (in hours).
 */
export function timeWeight(currentHrs: number, targetHrs: number, sigma = 1.0): number {
  const dt = currentHrs - targetHrs;
  return Math.exp(-(dt * dt) / (2 * sigma * sigma));
}

/** Hours between two Date objects (signed: positive = currentTime is later). */
function hoursBetween(a: Date, b: Date): number {
  return (a.getTime() - b.getTime()) / (1000 * 60 * 60);
}

/**
 * Classifies which nutrient-timing window the current moment falls into,
 * relative to the scheduled training session and estimated sleep time
 * (defaults to 22:30 local if not otherwise known).
 */
export function classifyWindow(context: SuggestionContext, sleepHour = 22.5): NutrientWindow {
  const { currentTime, trainingTime, trainingType } = context;
  const currentHour = currentTime.getHours() + currentTime.getMinutes() / 60;

  if (Math.abs(currentHour - sleepHour) <= 3 && currentHour > 12) {
    return 'night';
  }

  if (trainingTime && trainingType !== 'rest') {
    const hrsToTraining = hoursBetween(trainingTime, currentTime) * -1; // positive = training is in the future
    if (hrsToTraining > 0 && hrsToTraining <= 2) return 'pre-workout';
    const hrsSinceTraining = hoursBetween(currentTime, trainingTime);
    if (hrsSinceTraining >= 0 && hrsSinceTraining <= 2) return 'post-workout';
  }

  return 'normal';
}

/**
 * Rates a meal/food choice using pre/post workout nutrient-timing curves,
 * scaled by a Gaussian time-weight so the bias fades smoothly rather than
 * flipping on/off at a hard 2-hour boundary.
 */
export function scoreMealRecommendation(food: ScorableFood, context: SuggestionContext): number {
  const { macroGaps: gap, trainingTime, currentTime, trainingType } = context;

  let score = 0;

  // Base score: how well does this fit the absolute macro gaps?
  if (gap.p > 0 && food.p > 0) score += (food.p / gap.p) * 10;
  if (gap.c > 0 && food.c > 0) score += (food.c / gap.c) * 10;
  if (gap.f > 0 && food.f > 0) score += (food.f / gap.f) * 10;

  if (!trainingTime || trainingType === 'rest') {
    // NORMAL WINDOW — lean protein + healthy fats
    score += food.p * 1.5;
    score += food.f * 0.5;
    return score;
  }

  const currentHrs = currentTime.getHours() + currentTime.getMinutes() / 60;
  const trainingHrs = trainingTime.getHours() + trainingTime.getMinutes() / 60;
  const timeToTrainingHrs = trainingHrs - currentHrs;

  if (timeToTrainingHrs > 0 && timeToTrainingHrs <= 4) {
    // PRE-WORKOUT WINDOW: fast carbs, minimal fat. Weight peaks at 1hr out.
    const w = timeWeight(currentHrs, trainingHrs - 1, 1.0);
    if (trainingType === 'run' || trainingType === 'ruck') {
      score += food.c * 2.5 * w;
      score -= food.f * 4.0 * w;
    } else {
      score += food.c * 1.5 * w;
      score -= food.f * 2.0 * w;
    }
  } else if (timeToTrainingHrs < 0 && timeToTrainingHrs >= -4) {
    // POST-WORKOUT WINDOW: protein + carbs, weight peaks 1hr after.
    const w = timeWeight(currentHrs, trainingHrs + 1, 1.0);
    score += food.p * 3.0 * w;
    score += food.c * 1.5 * w;
    score -= food.f * 1.0 * w;
  } else {
    score += food.p * 1.5;
    score += food.f * 0.5;
  }

  return score;
}

export function windowLabel(win: NutrientWindow): string {
  switch (win) {
    case 'pre-workout': return 'Pre-workout window';
    case 'post-workout': return 'Post-workout window';
    case 'night': return 'Night / pre-sleep window';
    default: return 'Normal window';
  }
}

export function windowGuidance(win: NutrientWindow): string {
  switch (win) {
    case 'pre-workout':
      return 'High carb, low fat — fuel the session without cramping.';
    case 'post-workout':
      return 'High carb + high protein, minimal fat — fast recovery digestion.';
    case 'night':
      return 'Slow-digesting protein (casein/cottage cheese/greek yogurt), low simple carbs.';
    default:
      return 'Lean protein + healthy fats — steady, unhurried macros.';
  }
}
