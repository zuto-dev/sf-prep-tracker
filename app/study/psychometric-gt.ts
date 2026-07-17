// Psychometric Standard Score GT Calculator
// Implements official ASVAB standard score conversions

import { GTCalculation } from './enhanced-types';

// Convert raw percentile to standard score (mean=50, SD=10)
// Based on normalized ASVAB distribution curves
export const percentileToStandardScore = (percentile: number): number => {
  const clamped = Math.max(1, Math.min(99, percentile));
  
  const lookupTable: [number, number][] = [
    [99, 73], [95, 66], [90, 63], [85, 60], [80, 58],
    [75, 57], [70, 55], [65, 54], [60, 53], [55, 51],
    [50, 50], [45, 49], [40, 47], [35, 46], [30, 45],
    [25, 43], [20, 42], [15, 40], [10, 37], [5, 34], [1, 27]
  ];

  // Exact match optimization
  const exact = lookupTable.find(([p]) => p === clamped);
  if (exact) return exact[1];

  // Find bounding intervals
  let upper = lookupTable[0];
  let lower = lookupTable[lookupTable.length - 1];

  for (let i = 0; i < lookupTable.length - 1; i++) {
    if (clamped <= lookupTable[i][0] && clamped >= lookupTable[i+1][0]) {
      upper = lookupTable[i];
      lower = lookupTable[i+1];
      break;
    }
  }

  // Linear Interpolation formula: y = y1 + ((x - x1) * (y2 - y1)) / (x2 - x1)
  const [x1, y1] = upper;
  const [x2, y2] = lower;
  return y1 + ((clamped - x1) * (y2 - y1)) / (x2 - x1);
};

// Calculate VE (Verbal Expression) standard score from WK + PC
export const calculateVEStandardScore = (wkPercentile: number, pcPercentile: number): number => {
  // VE uses a combined percentile: (2WK + PC) / 3
  const combinedPercentile = (2 * wkPercentile + pcPercentile) / 3;
  return percentileToStandardScore(combinedPercentile);
};

// Calculate GT score with all components
export const calculateGTScore = (
  arPercentile: number,
  wkPercentile?: number,
  pcPercentile?: number,
  mkPercentile?: number
): GTCalculation => {
  const wk = wkPercentile ?? 86;
  const pc = pcPercentile ?? 75;
  
  const veStandardScore = calculateVEStandardScore(wk, pc);
  const arStandardScore = percentileToStandardScore(arPercentile);
  
  const estimatedGT = Math.round(veStandardScore + arStandardScore);
  
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
  
  if (requiredARStandardScore >= 73) return 99;
  if (requiredARStandardScore <= 27) return 1;
  
  const lookupTable: [number, number][] = [
    [99, 73], [95, 66], [90, 63], [85, 60], [80, 58],
    [75, 57], [70, 55], [65, 54], [60, 53], [55, 51],
    [50, 50], [45, 49], [40, 47], [35, 46], [30, 45],
    [25, 43], [20, 42], [15, 40], [10, 37], [5, 34], [1, 27]
  ];

  // Inverse linear search optimization over the standard score curve
  for (let i = 0; i < lookupTable.length - 1; i++) {
    const [pUpper, sUpper] = lookupTable[i];
    const [pLower, sLower] = lookupTable[i+1];

    if (requiredARStandardScore <= sUpper && requiredARStandardScore >= sLower) {
      // Interpolate back to a percentile value
      return pUpper + ((requiredARStandardScore - sUpper) * (pLower - pUpper)) / (sLower - sUpper);
    }
  }
  
  return 50;
};

// Track-specific GT targets and requirements
export const TRACK_GT_REQUIREMENTS = {
  'A': { minGT: 110, description: 'SF/Ranger qualified' },
  'B': { minGT: 105, description: 'Most combat arms' },
  'C': { minGT: 100, description: 'Support roles' }
};

// Estimate weeks needed based on non-linear timeline velocity formula
export const estimateWeeksToTarget = (
  currentGT: number,
  targetGT: number,
  currentARPercentile: number
): number => {
  const pointsNeeded = targetGT - currentGT;
  if (pointsNeeded <= 0) return 0;
  
  // Base track weeks based on diagnostic score
  let baseTrackWeeks = 12;
  if (currentARPercentile >= 60) {
    baseTrackWeeks = 8;
  } else if (currentARPercentile >= 45) {
    baseTrackWeeks = 10;
  }

  // Target AR percentile to reach the target GT
  const targetARPercentile = calculateRequiredARForGT(targetGT, 86, 75);
  
  // Delta AR
  const deltaAR = targetARPercentile - currentARPercentile;
  
  // Ceiling Penalty: 1 / (1 - min(0.99, targetARPercentile / 100))
  const ceilingPenalty = 1 / (1 - Math.min(0.99, targetARPercentile / 100));
  
  // Estimated Weeks: Base Track Weeks + (max(0, deltaAR) * 0.15 * ln(ceilingPenalty))
  const estimatedWeeks = baseTrackWeeks + (Math.max(0, deltaAR) * 0.15 * Math.log(ceilingPenalty));
  
  return Math.ceil(estimatedWeeks);
};