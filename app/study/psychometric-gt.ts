// Psychometric Standard Score GT Calculator
// Implements official ASVAB standard score conversions

import { GTCalculation } from './enhanced-types';

// Convert raw percentage to standard score (mean=50, SD=10)
// Based on normalized ASVAB distribution curves
const percentileToStandardScore = (percentile: number): number => {
  // Z-score lookup table for common percentiles
  const lookup: [number, number][] = [
    [99, 73], [95, 66], [90, 63], [85, 60], [80, 58],
    [75, 57], [70, 55], [65, 54], [60, 53], [55, 51],
    [50, 50], [45, 49], [40, 47], [35, 46], [30, 45],
    [25, 43], [20, 42], [15, 40], [10, 37], [5, 34], [1, 27]
  ];
  
  // Linear interpolation between points
  for (let i = 0; i < lookup.length - 1; i++) {
    const [p1, s1] = lookup[i];
    const [p2, s2] = lookup[i + 1];
    
    if (percentile >= p2 && percentile <= p1) {
      const ratio = (percentile - p2) / (p1 - p2);
      return s2 + ratio * (s1 - s2);
    }
  }
  
  // Edge cases
  if (percentile >= 99) return 73;
  if (percentile <= 1) return 27;
  
  return 50; // Default to mean
};

// Calculate VE (Verbal Expression) standard score from WK + PC
const calculateVEStandardScore = (wkPercentile: number, pcPercentile: number): number => {
  // VE uses a special formula: 2WK + PC raw scores, then converted
  // Since we have percentiles, we approximate with weighted average
  const combinedPercentile = (2 * wkPercentile + pcPercentile) / 3;
  return percentileToStandardScore(combinedPercentile);
};

// Calculate GT score with all components
// Named-object params so callers can't silently swap same-typed args.
export const calculateGTScore = (input: {
  ar: number;
  wk?: number;
  pc?: number;
  mk?: number;
}): GTCalculation => {
  const { ar: arPercentile, wk: wkPercentile, pc: pcPercentile } = input;
  // MK is captured for completeness but not used in GT (VE + AR only).
  // Default VE scores if not provided (as in current implementation)
  const wk = wkPercentile ?? 86;
  const pc = pcPercentile ?? 75;
  
  // Calculate standard scores
  const veStandardScore = calculateVEStandardScore(wk, pc);
  const arStandardScore = percentileToStandardScore(arPercentile);
  
  // GT = VE + AR
  const estimatedGT = Math.round(veStandardScore + arStandardScore);
  
  // Target check (110 for most special operations)
  const TARGET_GT = 110;
  const meetsTarget = estimatedGT >= TARGET_GT;
  const pointsToTarget = Math.max(0, TARGET_GT - estimatedGT);
  
  return {
    wkScore: wk,
    pcScore: pc,
    veStandardScore,
    arScore: arPercentile,
    arStandardScore,
    estimatedGT,
    meetsTarget,
    pointsToTarget
  };
};

// Calculate required AR score to hit GT target given current VE
export const calculateRequiredARForGT = (
  targetGT: number,
  wkPercentile: number,
  pcPercentile: number
): number => {
  const veStandardScore = calculateVEStandardScore(wkPercentile, pcPercentile);
  const requiredARStandardScore = targetGT - veStandardScore;
  
  // Convert standard score back to percentile
  // This is approximate inverse of percentileToStandardScore
  if (requiredARStandardScore >= 73) return 99;
  if (requiredARStandardScore <= 27) return 1;
  
  // Linear search for closest match
  for (let percentile = 99; percentile >= 1; percentile--) {
    const ss = percentileToStandardScore(percentile);
    if (ss <= requiredARStandardScore) {
      return percentile;
    }
  }
  
  return 50; // Default
};

// Track-specific GT targets and requirements
export const TRACK_GT_REQUIREMENTS = {
  'A': { minGT: 110, description: 'SF/Ranger qualified' },
  'B': { minGT: 105, description: 'Most combat arms' },
  'C': { minGT: 100, description: 'Support roles' }
};

// Estimate weeks needed based on current scores
export const estimateWeeksToTarget = (
  currentGT: number,
  targetGT: number,
  currentARPercentile: number
): number => {
  const pointsNeeded = targetGT - currentGT;
  if (pointsNeeded <= 0) return 0;
  
  // Empirical estimates: ~2-3 GT points per 10 percentile AR improvement
  // Harder gains at higher percentiles
  const percentileRoom = Math.max(0, 95 - currentARPercentile);
  const estimatedGTGain = percentileRoom * 0.25;
  
  if (estimatedGTGain >= pointsNeeded) {
    // Achievable with AR improvement alone
    // Estimate 2 weeks per 5 percentile points at lower levels
    // 3-4 weeks per 5 percentile points at higher levels
    const weeksPerFivePercentile = currentARPercentile < 70 ? 2 : 3.5;
    const percentilesNeeded = pointsNeeded / 0.25;
    return Math.ceil(percentilesNeeded / 5 * weeksPerFivePercentile);
  } else {
    // Would need VE improvement too
    return 16; // Full program
  }
};