import {
  SOF_PROFILES,
  TIER_META,
  evaluateSOFMetrics,
  latestPoint,
  type EventHistory,
  type ScoreTier,
} from './sof-standards.ts';

export type BenchmarkStatus = ScoreTier | 'not-logged';

export type BenchmarkPresentationRow = {
  key: string;
  label: string;
  unit: string;
  currentValue: number | null;
  currentDisplay: string;
  minimumDisplay: string;
  averageDisplay: string;
  eliteDisplay: string;
  status: BenchmarkStatus;
  statusLabel: string;
  score: number | null;
  gapDisplay: string;
};

function isTimeUnit(unit: string): boolean {
  return unit === 'sec';
}

export function formatBenchmarkValue(value: number, unit: string): string {
  if (!isTimeUnit(unit)) return `${value}`;
  const minutes = Math.floor(value / 60);
  const seconds = Math.round(value % 60);
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function nextTargetLabel(status: ScoreTier): string {
  if (status === 'below-minimum') return 'minimum';
  if (status === 'minimum') return 'average';
  if (status === 'average-select') return 'elite';
  return 'elite';
}

export function buildBenchmarkRows(
  profileKey: keyof typeof SOF_PROFILES,
  history: EventHistory,
): BenchmarkPresentationRow[] {
  const profile = SOF_PROFILES[profileKey] ?? SOF_PROFILES.sfas;

  return Object.entries(profile.events).map(([key, event]) => {
    const point = latestPoint(history, key);
    const minimumDisplay = formatBenchmarkValue(event.thresholds.minimum, event.unit);
    const averageDisplay = formatBenchmarkValue(event.thresholds.averageSelect, event.unit);
    const eliteDisplay = formatBenchmarkValue(event.thresholds.elite, event.unit);

    if (!point) {
      return {
        key,
        label: event.label,
        unit: event.unit,
        currentValue: null,
        currentDisplay: 'Not logged',
        minimumDisplay,
        averageDisplay,
        eliteDisplay,
        status: 'not-logged',
        statusLabel: 'Not Logged',
        score: null,
        gapDisplay: 'Log a result',
      };
    }

    const evaluation = evaluateSOFMetrics(profileKey, key, point.value);
    const gapDisplay = evaluation.tier === 'elite'
      ? 'Elite standard met'
      : `${formatBenchmarkValue(evaluation.nextTargetGap, event.unit)} to ${nextTargetLabel(evaluation.tier)}`;

    return {
      key,
      label: event.label,
      unit: event.unit,
      currentValue: point.value,
      currentDisplay: formatBenchmarkValue(point.value, event.unit),
      minimumDisplay,
      averageDisplay,
      eliteDisplay,
      status: evaluation.tier,
      statusLabel: TIER_META[evaluation.tier].label,
      score: evaluation.score,
      gapDisplay,
    };
  });
}

export function selectPrimaryWeakness(
  rows: BenchmarkPresentationRow[],
): BenchmarkPresentationRow | null {
  const logged = rows.filter(
    (row): row is BenchmarkPresentationRow & { score: number } => row.score !== null,
  );
  if (logged.length === 0) return null;
  return [...logged].sort((a, b) => a.score - b.score)[0];
}
