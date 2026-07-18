// Pure presentation helper for the SFRE lifecycle gate on Home + the
// SFRE Readiness surface on Standards. No browser/React imports — this
// module only derives display-state from resolveSfreLifecycle plus a
// confirmed event date, and never invents or copies MTI program content.

import { resolveSfreLifecycle, MTI_PEAK_WINDOW_DAYS, type SfreLifecycleState } from './sfre-program.ts';

const DAY_MS = 24 * 60 * 60 * 1000;

export type SfreDateState = 'date_required' | 'countdown' | 'active' | 'post_event';
export type SfreStageStatus = 'locked' | 'active' | 'complete' | 'upcoming';

export type SfreLifecyclePresentationInput = {
  date: Date;
  foundationStart: Date;
  confirmedSfreDate: string | null; // ISO, or null when not yet set
};

export type SfreLifecyclePresentation = {
  state: SfreLifecycleState;
  dateState: SfreDateState;
  daysUntilEvent: number | null;
  daysUntilPeakWindow: number | null;
  stages: {
    foundation: { label: string; status: SfreStageStatus };
    bridge: { label: string; status: SfreStageStatus };
    mtiPeak: { label: string; status: SfreStageStatus };
  };
};

function parseValidDate(iso: string | null): Date | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? new Date(t) : null;
}

function daysBetween(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / DAY_MS);
}

/**
 * Pure resolver combining resolveSfreLifecycle with a confirmed event date
 * into UI-ready stage statuses + a single date-state for the Home lifecycle
 * gate and the Standards SFRE Readiness card. Never throws — a malformed
 * confirmedSfreDate is treated identically to "no date set".
 */
export function resolveSfreLifecyclePresentation(
  input: SfreLifecyclePresentationInput,
): SfreLifecyclePresentation {
  const confirmedEventDate = parseValidDate(input.confirmedSfreDate);

  const state = resolveSfreLifecycle({
    date: input.date,
    foundationStart: input.foundationStart,
    confirmedEventDate,
  });

  let dateState: SfreDateState;
  if (!confirmedEventDate) {
    dateState = 'date_required';
  } else if (state === 'post_event') {
    dateState = 'post_event';
  } else if (state === 'mti_peak') {
    dateState = 'active';
  } else {
    dateState = 'countdown';
  }

  const daysUntilEvent = confirmedEventDate ? daysBetween(input.date, confirmedEventDate) : null;
  const daysUntilPeakWindow =
    confirmedEventDate && state !== 'mti_peak' && state !== 'post_event'
      ? daysBetween(input.date, new Date(confirmedEventDate.getTime() - MTI_PEAK_WINDOW_DAYS * DAY_MS))
      : null;

  const foundationStatus: SfreStageStatus = state === 'foundation' ? 'active' : 'complete';

  let bridgeStatus: SfreStageStatus;
  if (state === 'foundation') bridgeStatus = 'locked';
  else if (state === 'bridge') bridgeStatus = 'active';
  else bridgeStatus = 'complete'; // mti_peak or post_event

  let mtiPeakStatus: SfreStageStatus;
  if (!confirmedEventDate) mtiPeakStatus = 'locked';
  else if (state === 'mti_peak') mtiPeakStatus = 'active';
  else if (state === 'post_event') mtiPeakStatus = 'complete';
  else mtiPeakStatus = 'upcoming';

  return {
    state,
    dateState,
    daysUntilEvent,
    daysUntilPeakWindow,
    stages: {
      foundation: { label: 'Plan D Foundation (13 weeks)', status: foundationStatus },
      bridge: { label: 'Controlled Bridge', status: bridgeStatus },
      mtiPeak: { label: 'MTI SFRE Peak (7 weeks pre-event)', status: mtiPeakStatus },
    },
  };
}
