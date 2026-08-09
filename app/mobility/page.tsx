'use client';

import { useEffect, useMemo, useState } from 'react';
import { TacticalPageHeader } from '../components/TacticalPageHeader';
import type { Move } from '../lib/mobility-types';
import {
  buildTailoredMobilitySession,
  deriveFatigueAreas,
  loadScreens,
  saveScreen,
  type MobilityScreen,
  type JointTag,
} from '../lib/mobility-engine';

export const MOVES: Move[] = [
  {
    name: '90/90 Hip Stretch',
    target: 'hip internal + external rotation',
    time: '2 min (1 min per side)',
    how: [
      'Sit on the floor, front leg bent 90° in front of you, back leg bent 90° out to your side.',
      'Keep both butt cheeks on the ground (or as close as possible).',
      'Hinge forward over the front shin, hold 20–30s, then sit tall and rotate to the OTHER side.',
      'Alternate sides — don\'t stay stuck in one position.',
    ],
    cue: 'You\'re teaching hips to rotate both ways — don\'t just melt into one side.',
    videoId: 't4Zz6-aG8Iw',
    tag: 'hips',
  },
  {
    name: 'Couch Stretch',
    target: 'hip flexors + quads',
    time: '90s per side',
    how: [
      'Kneel facing away from a couch, sofa, or wall.',
      'Place the shin/top of foot of the working leg UP against the couch/wall behind you.',
      'Step the other foot forward into a lunge, front knee stacked over ankle.',
      'Squeeze the glute of the back leg HARD for 6–8s. Release, sink hips forward.',
      'Repeat the glute-squeeze cycle 4–5x per side.',
    ],
    cue: 'Squeeze rear glute → THEN sink deeper. Passive holding does much less.',
    videoId: 'ulgAOykAgV4',
    tag: 'hips',
  },
  {
    name: 'Elevated Pigeon',
    target: 'glutes + external hip rotators',
    time: '90s per side',
    how: [
      'Set front shin across a couch, bed, or bench (elevated surface — that\'s the "elevated" part).',
      'Back leg extended long behind you, pointing straight back.',
      'Square your hips forward. Hinge chest toward the front shin.',
      'Breathe. Sink deeper on each exhale.',
    ],
    cue: 'Elevation is easier on the front knee than floor pigeon. Don\'t force depth.',
    videoId: 'qQfaW6MberU',
    tag: 'hips',
  },
  {
    name: 'Deep Squat Hold',
    target: 'ankles + hips',
    time: '2 min (break into 2× 60s if needed)',
    how: [
      'Feet shoulder-width, toes slightly out.',
      'Squat all the way down — heels stay on the floor.',
      'Elbows inside knees, hands together at chest to press knees outward gently.',
      'Chest up, breathe deep through the nose.',
      'Can\'t keep heels down? Put a 5-lb plate under each heel and work down over weeks.',
    ],
    cue: 'This is where rucking ankles are built. Own the bottom position.',
    videoId: 'b4D0jAQLtkY',
    tag: 'ankles',
  },
  {
    name: 'Seiza Sit',
    target: 'knees, quads, ankles (top of foot)',
    time: '2 min',
    how: [
      'Kneel on the floor, tops of feet flat, sit back onto your heels.',
      'Stay tall — don\'t collapse forward.',
      'Breathe. If knees complain, put a folded towel under your ankles or between calves and hamstrings.',
      'Progression: over weeks, remove the towel.',
    ],
    cue: 'Boring but crucial for knees under future ruck load.',
    videoId: 'ucXGQUEb2K4',
    tag: 'knees',
  },
  {
    name: 'Pancake Stretch',
    target: 'hamstrings + adductors + low back',
    time: '2 min',
    how: [
      'Sit on the floor, legs wide apart in a straddle (as wide as comfortable).',
      'Sit tall first — pelvis forward, chest up.',
      'Hinge from the hips (NOT rounding the back), walk hands forward.',
      'Relax into it. On each exhale, walk hands a touch further.',
    ],
    cue: 'Hinge from hips, not from the low back. If your back is rounding, you\'ve gone too far.',
    videoId: 'bs63okrxH8E',
    tag: 'posterior',
  },
  {
    name: 'Bar Hang',
    target: 'shoulders + grip + spinal decompression',
    time: 'Accumulate 90s (break into 2–3 hangs)',
    how: [
      'Jump up to a pull-up bar, hands shoulder-width, overhand grip.',
      'Let arms straighten fully. Shoulders relaxed (not shrugged, not actively packed).',
      'Just hang. Breathe.',
      'Hop off before your grip fails — this isn\'t max-effort grip work.',
    ],
    cue: 'Decompression, not endurance. Rest and reload if grip is failing.',
    videoId: 'fq9gDvNZQ2c',
    tag: 'shoulders',
  },
  {
    name: 'Thoracic Rotation (open book)',
    target: 't-spine (mid-back)',
    time: '8 reps per side',
    how: [
      'Lie on your side, knees stacked and bent 90°, arms extended in front of you at shoulder height (palms together).',
      'Keep knees pinned together. Rotate the TOP arm up and over — open like a book.',
      'Follow the hand with your eyes. Try to touch the opposite side of the floor with the back of your hand.',
      'Slow — 3s out, 2s hold, 3s back. 8 reps, then switch sides.',
    ],
    cue: 'Rotation comes from the mid-back, NOT the low back. Knees stay locked together.',
    videoId: 'YMswmjk7Qj4',
    tag: 't-spine',
  },
];

const TAG_COLOR: Record<Move['tag'], string> = {
  hips:      'bg-emerald-900/40 text-emerald-300 border-emerald-800/60',
  ankles:    'bg-amber-900/40 text-amber-300 border-amber-800/60',
  knees:     'bg-blue-900/40 text-blue-300 border-blue-800/60',
  posterior: 'bg-purple-900/40 text-purple-300 border-purple-800/60',
  shoulders: 'bg-teal-900/40 text-teal-300 border-teal-800/60',
  't-spine': 'bg-rose-900/40 text-rose-300 border-rose-800/60',
};

// Anatomical viewer regions — simplified SVG hotspot map. Selecting a region
// filters the move list + surfaces the joint's logged ROM screen.
const ANATOMY_REGIONS: Array<{ tag: JointTag; label: string; cx: number; cy: number; r: number }> = [
  { tag: 't-spine',   label: 'T-Spine',   cx: 100, cy: 90,  r: 16 },
  { tag: 'shoulders', label: 'Shoulders', cx: 60,  cy: 78,  r: 14 },
  { tag: 'hips',      label: 'Hips',      cx: 100, cy: 190, r: 18 },
  { tag: 'posterior', label: 'Posterior', cx: 100, cy: 230, r: 16 },
  { tag: 'knees',     label: 'Knees',     cx: 100, cy: 290, r: 14 },
  { tag: 'ankles',    label: 'Ankles',    cx: 100, cy: 350, r: 12 },
];

const KEY = 'sfprep:mobility';

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function loadState(): Record<string, Record<number, boolean>> {
  if (typeof window === 'undefined') return {};
  try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { return {}; }
}
function saveState(state: Record<string, Record<number, boolean>>) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(KEY, JSON.stringify(state));
}

export default function MobilityPage() {
  const [state, setState] = useState<Record<string, Record<number, boolean>>>({});
  const [activeRegion, setActiveRegion] = useState<JointTag | null>(null);
  const [screens, setScreens] = useState<MobilityScreen[]>([]);
  const [fatigueAreas, setFatigueAreas] = useState<string[]>([]);
  const [modalIdx, setModalIdx] = useState<number | null>(null);
  const [screenDraft, setScreenDraft] = useState<{ current: string; target: string }>({ current: '', target: '' });
  const day = todayKey();

  useEffect(() => {
    setState(loadState());
    setScreens(loadScreens());
    setFatigueAreas(deriveFatigueAreas());
  }, []);

  const toggle = (idx: number) => {
    const dayState = { ...(state[day] || {}) };
    dayState[idx] = !dayState[idx];
    const next = { ...state, [day]: dayState };
    setState(next);
    saveState(next);
  };

  const dayState = state[day] || {};
  const done = Object.values(dayState).filter(Boolean).length;

  const streak = (() => {
    let n = 0;
    for (let i = 0; i < 30; i++) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const k = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      const complete = Object.values(state[k] || {}).filter(Boolean).length >= MOVES.length;
      if (complete) n++; else if (i > 0) break;
    }
    return n;
  })();

  // Blueprint 8.3: intelligent tailored session engine, derived from REAL
  // completion logs (deriveFatigueAreas) + REAL user-entered ROM screens.
  const tailoredSession = useMemo(
    () => buildTailoredMobilitySession(MOVES, screens, fatigueAreas, 3),
    [screens, fatigueAreas]
  );

  const visibleMoves = activeRegion ? MOVES.filter(m => m.tag === activeRegion) : MOVES;

  const screenForActive = activeRegion ? screens.find(s => s.joint === activeRegion) : undefined;

  const submitScreen = () => {
    if (!activeRegion) return;
    const current = parseFloat(screenDraft.current);
    const target = parseFloat(screenDraft.target);
    if (Number.isNaN(current) || Number.isNaN(target)) return;
    const screen: MobilityScreen = { joint: activeRegion, currentRangeDegrees: current, targetRangeDegrees: target, lastTested: day };
    saveScreen(screen);
    setScreens(loadScreens());
    setScreenDraft({ current: '', target: '' });
  };

  const modalMove = modalIdx !== null ? MOVES[modalIdx] : null;

  return (
    <div className="min-h-screen bg-[#09090a] text-gray-100">
      <div className="max-w-6xl mx-auto p-4">
        <TacticalPageHeader
          eyebrow="Recovery"
          title="Move better today."
          description="A short mobility block for the joints tactical training punishes first. Complete the priority moves, then leave."
          status={`${done}/${MOVES.length} complete`}
        />
      </div>

      <div className="max-w-6xl mx-auto p-4 space-y-6">
        {/* Info card */}
        <div className="backdrop-blur-md bg-gray-900/60 rounded-2xl p-5 border border-gray-800/50 shadow-xl text-sm leading-relaxed text-gray-300">
          <h3 className="text-base font-bold text-white mb-2 flex items-center gap-2 flex-wrap">
            <span>Why this exists</span>
            <span className="text-xs bg-emerald-500/20 text-emerald-400 font-semibold px-2.5 py-0.5 rounded-full">
              {done}/{MOVES.length} complete today
            </span>
            {streak > 0 && (
              <span className="text-xs bg-amber-500/20 text-amber-400 font-semibold px-2.5 py-0.5 rounded-full">
                {streak}d streak
              </span>
            )}
          </h3>
          The main sessions have short pre-workout warm-ups (5 min).
          This is separate — a daily block for the areas tactical athletes actually lose: hips (rucking), ankles (running/land nav),
          t-spine (pack weight), shoulders (pull-ups + presses). Do it in one shot before bed, or scatter it through the day.
          <strong className="text-emerald-400 block mt-2">Consistency matters more than intensity — 5 min every day beats 30 min once a week.</strong>
        </div>

        <div className="grid lg:grid-cols-[280px_1fr] gap-6">
          {/* Anatomical Viewer + Tailored Session panel */}
          <div className="space-y-6">
            <div className="backdrop-blur-md bg-gray-900/60 rounded-2xl border border-gray-800/50 shadow-xl p-5">
              <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                <span>Body Map</span>
              </h3>
              <svg viewBox="0 0 200 400" className="w-full max-w-[200px] mx-auto">
                <ellipse cx="100" cy="40" rx="22" ry="26" fill="none" stroke="#475569" strokeWidth="2" />
                <path d="M100 66 L100 260" stroke="#475569" strokeWidth="3" fill="none" />
                <path d="M100 90 L40 130 M100 90 L160 130" stroke="#475569" strokeWidth="3" fill="none" />
                <path d="M100 200 L60 320 M100 200 L140 320" stroke="#475569" strokeWidth="3" fill="none" />
                {ANATOMY_REGIONS.map(region => {
                  const isActive = activeRegion === region.tag;
                  return (
                    <g key={region.tag} onClick={() => setActiveRegion(isActive ? null : region.tag)} className="cursor-pointer">
                      <circle
                        cx={region.cx} cy={region.cy} r={region.r}
                        className={`transition-all duration-300 ${isActive ? 'fill-blue-500/70 stroke-blue-300' : 'fill-gray-700/60 stroke-gray-600 hover:fill-blue-800/50'}`}
                        strokeWidth="2"
                      />
                    </g>
                  );
                })}
              </svg>
              <div className="mt-3 flex flex-wrap gap-1.5 justify-center">
                {ANATOMY_REGIONS.map(region => (
                  <button
                    key={region.tag}
                    onClick={() => setActiveRegion(activeRegion === region.tag ? null : region.tag)}
                    className={`text-[10px] uppercase font-bold tracking-wider px-2 py-1 rounded-full border transition-colors ${
                      activeRegion === region.tag ? TAG_COLOR[region.tag] : 'bg-gray-950/40 text-gray-500 border-gray-800/50 hover:border-gray-700'
                    }`}
                  >
                    {region.label}
                  </button>
                ))}
              </div>

              {activeRegion && (
                <div className="mt-4 pt-4 border-t border-gray-800/60 space-y-3 animate-fade-in">
                  <div className="text-xs uppercase font-bold tracking-wider text-gray-400">ROM Self-Screen — {activeRegion}</div>
                  {screenForActive && (
                    <div className="text-xs text-gray-300 bg-gray-950/40 rounded-lg p-2 border border-gray-800/40">
                      Current: <span className="text-white font-bold">{screenForActive.currentRangeDegrees}°</span> / Target: <span className="text-emerald-400 font-bold">{screenForActive.targetRangeDegrees}°</span>
                      <div className="text-gray-500 mt-0.5">Last tested {screenForActive.lastTested}</div>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <input
                      type="number" placeholder="Current °" value={screenDraft.current}
                      onChange={e => setScreenDraft(d => ({ ...d, current: e.target.value }))}
                      className="w-full bg-gray-950/60 border border-gray-800 rounded-lg px-2 py-1.5 text-xs text-white placeholder:text-gray-600"
                    />
                    <input
                      type="number" placeholder="Target °" value={screenDraft.target}
                      onChange={e => setScreenDraft(d => ({ ...d, target: e.target.value }))}
                      className="w-full bg-gray-950/60 border border-gray-800 rounded-lg px-2 py-1.5 text-xs text-white placeholder:text-gray-600"
                    />
                  </div>
                  <button
                    onClick={submitScreen}
                    className="w-full bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold py-2 rounded-lg transition-colors"
                  >
                    Log Screen
                  </button>
                </div>
              )}
            </div>

            {/* Tailored session engine output */}
            <div className="backdrop-blur-md bg-gray-900/60 rounded-2xl border border-gray-800/50 shadow-xl p-5">
              <h3 className="text-sm font-bold text-white mb-1 flex items-center gap-2">
                <span>Today&apos;s Priority Picks</span>
              </h3>
              <p className="text-xs text-gray-500 mb-3">
                Ranked by recent training fatigue{fatigueAreas.length > 0 ? ` (${fatigueAreas.slice(0,3).join(', ')})` : ''} + logged ROM deficits.
              </p>
              <div className="space-y-2">
                {tailoredSession.map(m => (
                  <button
                    key={m.name}
                    onClick={() => setModalIdx(MOVES.findIndex(x => x.name === m.name))}
                    className="w-full text-left bg-gray-950/40 hover:bg-gray-950/70 border border-gray-800/50 rounded-xl px-3 py-2 transition-colors"
                  >
                    <div className="text-sm font-bold text-white">{m.name}</div>
                    <span className={`text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded-full border ${TAG_COLOR[m.tag]}`}>{m.tag}</span>
                  </button>
                ))}
                {tailoredSession.length === 0 && (
                  <div className="text-xs text-gray-500">Log a workout or ROM screen to get tailored picks.</div>
                )}
              </div>
            </div>
          </div>

          {/* Moves List */}
          <div className="space-y-4">
            {activeRegion && (
              <div className="text-xs text-gray-400 flex items-center gap-2">
                Filtering by <span className={`px-2 py-0.5 rounded-full border ${TAG_COLOR[activeRegion]}`}>{activeRegion}</span>
                <button onClick={() => setActiveRegion(null)} className="text-blue-400 hover:underline">clear</button>
              </div>
            )}
            {visibleMoves.map((m) => {
              const i = MOVES.indexOf(m);
              const checked = !!dayState[i];
              return (
                <div key={i}
                  className={`
                    backdrop-blur-md rounded-2xl border transition-all duration-300 overflow-hidden shadow-lg
                    ${checked
                      ? 'bg-emerald-950/20 border-emerald-500/30'
                      : 'bg-gray-900/60 border-gray-800/50 hover:border-gray-700/60'
                    }
                  `}
                >
                  <div className="flex items-start gap-4 p-5">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggle(i)}
                      className="mt-1 flex-shrink-0 w-5 h-5 rounded-lg border-gray-700 text-blue-600 focus:ring-blue-500 bg-gray-950 cursor-pointer"
                    />
                    <div className="flex-1 min-w-0" onClick={() => setModalIdx(i)} role="button">
                      <div className="flex items-center justify-between gap-3 flex-wrap">
                        <div className={`text-lg font-bold ${checked ? 'text-gray-500 line-through' : 'text-white group-hover:text-blue-300'}`}>
                          {i+1}. {m.name}
                        </div>
                        <div className="flex gap-2.5 items-center">
                          <span className={`text-[10px] uppercase font-bold tracking-wider px-2.5 py-0.5 rounded-full border ${TAG_COLOR[m.tag]}`}>{m.tag}</span>
                          <span className="text-xs text-gray-400 font-mono bg-gray-950/40 px-2 py-0.5 rounded-lg border border-gray-800/40">{m.time}</span>
                        </div>
                      </div>
                      <div className="text-sm text-gray-300 mt-1.5">
                        <span className="text-gray-500 font-bold uppercase text-xs tracking-wider mr-1.5">Target:</span> {m.target}
                      </div>
                      <div className="text-xs text-blue-400 mt-2 font-semibold hover:underline">Tap for instructions + video</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Glassmorphic Overlay Video Modal */}
      {modalMove && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fade-in"
          onClick={() => setModalIdx(null)}
        >
          <div
            className="max-w-3xl w-full bg-gray-900/80 backdrop-blur-xl border border-gray-700/50 rounded-3xl shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 p-6 border-b border-gray-800/60">
              <div>
                <div className={`inline-block text-[10px] uppercase font-bold tracking-wider px-2.5 py-0.5 rounded-full border mb-2 ${TAG_COLOR[modalMove.tag]}`}>{modalMove.tag}</div>
                <h2 className="text-2xl font-black text-white">{modalMove.name}</h2>
                <div className="text-sm text-gray-400 mt-1">{modalMove.target} · <span className="font-mono text-blue-300">{modalMove.time}</span></div>
              </div>
              <button onClick={() => setModalIdx(null)} className="text-gray-400 hover:text-white text-2xl leading-none">×</button>
            </div>

            <div className="grid md:grid-cols-2 gap-6 p-6">
              <div className="rounded-2xl overflow-hidden border border-gray-800/60 bg-black shadow-xl aspect-video">
                <iframe
                  className="w-full h-full"
                  src={`https://www.youtube.com/embed/${modalMove.videoId}`}
                  title={`${modalMove.name} demo`}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>

              <div className="space-y-4">
                <div>
                  <div className="text-xs uppercase font-bold tracking-wider text-gray-400 mb-2">Step-by-Step Guide</div>
                  <ol className="text-sm text-gray-300 space-y-2 list-decimal list-inside leading-relaxed">
                    {modalMove.how.map((step, si) => (
                      <li key={si} className="marker:text-blue-400"><span className="ml-1">{step}</span></li>
                    ))}
                  </ol>
                </div>
                <div className="bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border-l-4 border-emerald-500 p-4 rounded-r-xl">
                  <div className="text-xs uppercase font-bold tracking-wider text-emerald-400 mb-1">Focus Cue</div>
                  <div className="text-sm text-gray-200 font-medium">{modalMove.cue}</div>
                </div>
                <button
                  onClick={() => { toggle(MOVES.indexOf(modalMove)); }}
                  className={`w-full text-sm font-bold py-2.5 rounded-xl transition-colors ${
                    dayState[MOVES.indexOf(modalMove)] ? 'bg-emerald-600/30 text-emerald-300 border border-emerald-500/40' : 'bg-blue-600 hover:bg-blue-500 text-white'
                  }`}
                >
                  {dayState[MOVES.indexOf(modalMove)] ? '✓ Marked complete' : 'Mark complete'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .animate-fade-in {
          animation: fade-in 0.3s ease-out forwards;
        }
      `}</style>
    </div>
  );
}
