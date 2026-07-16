// SECTION 7: Dynamic Progress Tracking & Predictive Modeling
// Ordinary Least Squares (OLS) trend modeling per the 2026-07-16 blueprint
// (SECTION 7.3) — projects the calendar date a performance target will be
// met based on the actual historical rate of adaptation.

export interface HistoryEntry {
  date: string; // YYYY-MM-DD
  value: number;
}

interface DataPoint {
  daysOffset: number;
  value: number;
}

export interface ForecastResult {
  expectedDays: number;
  r2: number;
  slope: number;
  dateString: string;
  insufficientData: boolean;
}

/**
 * Fits a linear regression line (y = mx + b) to forecast when a performance
 * target will be met, given a program start date and history of measurements.
 */
export function forecastTargetDate(
  history: HistoryEntry[],
  programStartDate: Date,
  targetValue: number,
  higherIsBetter: boolean,
): ForecastResult {
  const points: DataPoint[] = history.map(h => {
    const elapsedDays = Math.floor((new Date(h.date).getTime() - programStartDate.getTime()) / (1000 * 60 * 60 * 24));
    return { daysOffset: elapsedDays, value: h.value };
  });

  const n = points.length;
  if (n < 3) {
    return { expectedDays: 90, r2: 0, slope: 0, dateString: 'Insufficient data to generate prediction', insufficientData: true };
  }

  let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0, sumYY = 0;
  points.forEach(p => {
    sumX += p.daysOffset;
    sumY += p.value;
    sumXY += p.daysOffset * p.value;
    sumXX += p.daysOffset * p.daysOffset;
    sumYY += p.value * p.value;
  });

  const denomSlope = n * sumXX - sumX * sumX;
  if (denomSlope === 0) {
    return { expectedDays: 90, r2: 0, slope: 0, dateString: 'Insufficient variance to generate prediction', insufficientData: true };
  }

  const slope = (n * sumXY - sumX * sumY) / denomSlope;
  const intercept = (sumY - slope * sumX) / n;

  const num = n * sumXY - sumX * sumY;
  const den = (n * sumXX - sumX * sumX) * (n * sumYY - sumY * sumY);
  const r2 = den !== 0 ? (num * num) / den : 0;

  // Slope pointed the wrong direction relative to the goal — flat/regressing.
  const improving = higherIsBetter ? slope > 0 : slope < 0;
  if (slope === 0 || !improving) {
    return {
      expectedDays: -1,
      r2,
      slope,
      dateString: improving ? 'Flat trend — no projection available' : 'Trend moving away from target',
      insufficientData: false,
    };
  }

  const expectedDays = Math.round((targetValue - intercept) / slope);
  const targetDate = new Date(programStartDate.getTime());
  targetDate.setDate(targetDate.getDate() + expectedDays);

  return {
    expectedDays,
    r2,
    slope,
    dateString: targetDate.toISOString().slice(0, 10),
    insufficientData: false,
  };
}

/**
 * Simple multi-variable Pearson correlation coefficient between two aligned
 * series (e.g. ruck pace vs bodyweight), used to surface cross-metric
 * relationships in the UI ("as bodyweight drops, ruck pace improves").
 */
export function correlate(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  if (n < 3) return 0;
  const ax = a.slice(0, n), bx = b.slice(0, n);
  const meanA = ax.reduce((s, v) => s + v, 0) / n;
  const meanB = bx.reduce((s, v) => s + v, 0) / n;
  let num = 0, denA = 0, denB = 0;
  for (let i = 0; i < n; i++) {
    const da = ax[i] - meanA, db = bx[i] - meanB;
    num += da * db;
    denA += da * da;
    denB += db * db;
  }
  const den = Math.sqrt(denA * denB);
  return den === 0 ? 0 : num / den;
}
