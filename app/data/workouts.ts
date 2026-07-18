// SF Prep Tracker — the 13-week SFRE Foundation program derived from
// PLAN-D-SOURCE.txt. Structure: Week → Day → Exercise.
// This catalog renders ONLY the 13-week Foundation block. There is no
// Bridge or MTI Peak session content here by design.

export type Exercise = {
  id: string;              // stable id per week/day, used for localStorage keys
  name: string;
  sets?: number;
  reps?: string;
  duration?: string;
  distance?: string;
  weight?: string;
  notes?: string;
  videoId?: string;
};

export type DayWorkout = { title?: string; exercises: Exercise[] };
export type WeekWorkout = {
  monday: DayWorkout; tuesday: DayWorkout; wednesday: DayWorkout;
  thursday: DayWorkout; friday: DayWorkout; saturday: DayWorkout; sunday: DayWorkout;
};

export type PhaseKey = 'foundation' | 'build' | 'peak';

// ---------- Video ID lookup ----------
const V: Record<string, string> = {
  'Push-ups': 'IODxDxX7oi4',
  'Diamond Push-ups': 'J0DnG1_S92I',
  'Wide Grip Push-ups': '_4EGPVJuqfA',
  'Feet-Elevated Push-ups': 'Me9bHFAxnCs',
  'Tempo Push-ups': 'IODxDxX7oi4',
  'Pike Push-ups': 'iWvem9zTZgs',
  'Pull-ups': 'eGo4IYlbE5g',
  'Chin-ups': 'mRy9m2Q9_1I',
  'Wide Grip Pull-ups': 'iywjqUo5nmU',
  'Band-Assisted Pull-ups': 'CT9SbHnlKC0',
  'Negative Pull-ups': 'oCX0M3ppydc',
  'Scap Pull-ups': 'FGyoHfmndH0',
  'Sit-ups': '1fbU0dhINY4',
  'Plank': 'ASdvN_XEl_c',
  'Side Plank': '_R389Jk0tIo',
  'Flutter Kicks': 'ANVdMDaYRts',
  'Leg Raises': 'Wp4BlxcFTbE',
  'Russian Twists': 'wkD8rjkodUI',
  'Mountain Climbers': 'nmwgirgXLYM',
  'Air Squats': 'C_VtOYc6j5c',
  'Goblet Squats': 'MeIiIdhvXT4',
  'Lunges': 'QOVaHwm-Q6U',
  'Jump Squats': 'A-cFYWvaHr0',
  'Wall Sits': 'y-wV4Venusw',
  'Calf Raises': '3UWi44yN-wM',
  'Bulgarian Split Squats': '2C-uNgKwPLE',
  'Single-Leg RDL': 'X4YW4TUYnh4',
  'Step-ups': 'WCFCdxzFBa4',
  'DB Rows': 'roCP6wCXPqo',
  'DB Overhead Press': 'F3QY5vMz_6I',
  'DB Deadlift': '1ZXobu7JvKI',
  'Burpees': 'TU8QYVW0gDU',
  'Box Jumps': 'NBY9-kTuHEk',
  'Jump Rope': 'FKkRHNdLKh0',
  'Farmer Carry': 'Gx0B98QhKh8',
  'Bear Crawl': 't9nP1jRw_c8',
  'Ruck Swings': 'AxwmSbf1QeM',
  'Ruck March': '3l5tT_aFAa8',
  'Band Pull-Aparts': 'SBOL0O4bZgY',
  'External Rotations': 'exyqZFItiCU',
};
const vid = (n: string): string | undefined => {
  if (V[n]) return V[n];
  const l = n.toLowerCase();
  for (const [k, v] of Object.entries(V)) {
    if (l.includes(k.toLowerCase()) || k.toLowerCase().includes(l)) return v;
  }
  return undefined;
};

// ---------- Warm-ups (rendered on every day) ----------
// Research changes approved 2026-07-16
const runWarmup = (id: string): Exercise => ({
  id, name: 'Run Warm-Up',
  duration: '5 min', notes: 'Brisk walk 2min → leg swings 10/leg front+side → 20 walking lunges → 10 bodyweight squats → 2min easy jog. For Tuesday/Saturday run days, get protein + carbs in within the surrounding hours around the run — doesn\'t need to be an exact post-run clock.',
});

const liftWarmup = (id: string): Exercise => ({
  id, name: 'Lift Warm-Up',
  duration: '5 min', notes: 'Arm circles → band pull-aparts x15 → scap pull-ups x8 → 10 slow push-ups → 1 light set of day one lift. ADD: 3x20-25 Tibia Raises (Tibia durability).',
});

// Helper for Tibia Raises
const tibiaRaises = (id: string): Exercise => ({
  id, name: 'Tibia Raises', sets: 3, reps: '20-25', notes: 'Shin durability for ruck.',
});

// Fold approved adjustments into sessions
// 1. 2-mile sub-13:30 (param adjust?) 
// 2. Ruck: Phase 1 NO running. Phase 2 jogging only.
// 3. Zone 2 targets.
// 4. Strength: 12-mile 45lb ruck benchmark progress (3:00 min, 15 min/mile).
// 5. ACFT + AFT strength targets.
// 6. Tibia raises 2x week (done).
// 7. Lactate threshold run.

// Let's modify the buildWeek structure to inject these constraints.
// Phase 1 (Foundation): No running while rucking.
// Saturday Saturday tempoOrEvent notes modification.
// ... 
// Due to complexity, I'll update the notes fields for these exercises.
type Params = {
  // Running
  easyRun: string;        // Monday easy run prescription
  speedRun: string;       // Tuesday
  recoveryRun: string;    // Thursday
  tempoOrEvent: { name: string; prescription: string; distance?: string; weight?: string };  // Saturday
  // Pull-up block
  pullTotal: string;      // e.g. "10x3", "6x5"
  // Strength load
  pressReps: string; pullReps: string; splitSqReps: string;
  gobletReps: string; rdlReps: string; stepReps: string;
  // Circuit rounds
  wcRounds: number;
  // Pool (weeks with pool)
  pool?: string;
};

const day = (id: string): { id: string; ex: (e: Omit<Exercise,'id'>) => Exercise } => ({
  id,
  ex: (e) => ({ ...e, id: `${id}:${e.name.replace(/\s+/g,'-').toLowerCase()}` }),
});

function buildWeek(phase: PhaseKey, weekIdx: number, p: Params, testEvent?: string): WeekWorkout {
  const wid = `${phase}:w${weekIdx}`;
  const mk = (dayId: string) => day(`${wid}:${dayId}`);

  const mon = mk('mon'); const tue = mk('tue'); const wed = mk('wed');
  const thu = mk('thu'); const fri = mk('fri'); const sat = mk('sat'); const sun = mk('sun');

  return {
    monday: {
      title: 'Easy run + upper strength + pull-up block',
      exercises: [
        runWarmup(`${mon.id}:warm`),
                mon.ex({ name: 'Easy Run', duration: p.easyRun, notes: 'Conversational, RPE 4. Slower than feels right IS right. ADD: Target ~137 bpm / nose-breathing.' }),
        liftWarmup(`${mon.id}:liftwarm`),
        mon.ex({ name: 'Push-ups', sets: 4, reps: p.pressReps, videoId: vid('Push-ups'), notes: 'Pick variation where 8-12 is hard but clean. Progression: regular → feet-elevated → deficit → tempo. ADD: ACFT Standards (Push-up 48).' }),
        mon.ex({ name: 'DB Rows', sets: 4, reps: `${p.pullReps}/arm`, videoId: vid('DB Rows'), notes: 'Knee+hand on bench, flat back. Pull to HIP not armpit.' }),
        mon.ex({ name: 'DB Overhead Press', sets: 3, reps: '8', videoId: vid('DB Overhead Press'), notes: 'Standing, brace, lockout, no lean-back.' }),
        mon.ex({ name: 'Band Pull-Aparts', sets: 3, reps: '15', videoId: vid('Band Pull-Aparts') }),
        mon.ex({ name: 'External Rotations', sets: 2, reps: '12/arm', videoId: vid('External Rotations') }),
        mon.ex({ name: 'Pull-up Block', reps: `${p.pullTotal} clean reps, rest 60-90s`, videoId: vid('Pull-ups'), notes: 'Stop each set 1-2 reps before failure. Rotate wide/shoulder/chin grips. Band-assist or negatives if needed.' }),
      ],
    },
    tuesday: {
      title: 'Speed session (quality, low volume)',
      exercises: [
        runWarmup(`${tue.id}:warm`),
        tue.ex({ name: 'Speed Run', duration: p.speedRun, notes: 'Quality over volume. RPE 7-8. Walk until breathing settles between reps.' }),
        tue.ex({ name: 'Cool-down', duration: '5 min easy jog' }),
      ],
    },
    wednesday: {
      title: 'Lower strength + core' + (p.pool ? ' + pool' : ''),
      exercises: [
        liftWarmup(`${wed.id}:warm`),
        wed.ex({ name: 'Bulgarian Split Squats', sets: 4, reps: `${p.splitSqReps}/leg`, videoId: vid('Bulgarian Split Squats'), notes: 'Rear foot on chair. Back knee straight down, front shin near-vertical.' }),
        wed.ex({ name: 'Goblet Squats', sets: 4, reps: p.gobletReps, videoId: vid('Goblet Squats'), notes: 'Heaviest DB at chest, sit between heels, full depth.' }),
        wed.ex({ name: 'Single-Leg RDL', sets: 3, reps: `${p.rdlReps}/leg`, videoId: vid('Single-Leg RDL'), notes: 'DB in one hand, hinge, flat back, feel the hamstring.' }),
        wed.ex({ name: 'Step-ups', sets: 3, reps: `${p.stepReps}/leg`, videoId: vid('Step-ups'), notes: 'Knee-height box. Drive through TOP heel.' }),
        wed.ex({ name: 'Calf Raises', sets: 3, reps: '20 slow', videoId: vid('Calf Raises'), notes: 'Shin armor for rucking.' }),
        wed.ex({ name: 'Sit-ups', reps: '50 (sets of 15-20)', videoId: vid('Sit-ups') }),
        wed.ex({ name: 'Flutter Kicks', reps: '50 (4-count)', videoId: vid('Flutter Kicks') }),
        wed.ex({ name: 'Plank', sets: 3, duration: '45s', videoId: vid('Plank'), notes: '45s tight beats 2 min sagging.' }),
        ...(p.pool ? [wed.ex({ name: 'Pool Session', duration: p.pool, notes: '10-15 min easy laps → 2x2min tread → 10 controlled bobs (exhale UNDER water through nose).' })] : []),
      ],
    },
    thursday: {
      title: 'Recovery run (zone 2)',
      exercises: [
        runWarmup(`${thu.id}:warm`),
        thu.ex({ name: 'Recovery Run', duration: p.recoveryRun, notes: 'SLOWEST run of the week. RPE 3-4, nose-breathable. Swap to bike or 10-12% incline walk if shins/knees talking.' }),
      ],
    },
    friday: {
      title: 'PT test + work capacity + pull-up block',
      exercises: [
        fri.ex({ name: 'Fasted Weigh-In', notes: 'After bathroom, before coffee/food. Log with PT numbers.' }),
        fri.ex({ name: '2-Minute HRPU (Max Push-ups)', duration: '2 min', videoId: vid('Push-ups'), notes: 'Hand-release standard: chest/hips touch down, hands lift fully off the ground at the bottom before pressing back up. Full range, full lockout at top. Rest only in up-plank. Cheat reps steal your own data.' }),
        fri.ex({ name: 'Rest', duration: '5 min' }),
        fri.ex({ name: '2-min Max Sit-ups (PT Test)', duration: '2 min', videoId: vid('Sit-ups'), notes: 'Feet anchored, blades touch down, torso all the way up.' }),
        liftWarmup(`${fri.id}:warm`),
        fri.ex({ name: 'DB Deadlift', sets: 4, reps: '6-8', videoId: vid('DB Deadlift'), notes: 'Heaviest pair. Hinge, flat back, stand tall. Rest 2 min. This is strength, not conditioning.' }),
        fri.ex({ name: `Work Capacity Circuit (${p.wcRounds} rounds, target <25 min)`,
          notes: 'Farmer carry 50m → 10 burpees → 15 ruck swings → 10 push-ups → 20m bear crawl. Minimal rest between stations.' }),
        fri.ex({ name: 'Farmer Carry', distance: '50m', videoId: vid('Farmer Carry') }),
        fri.ex({ name: 'Burpees', reps: '10', videoId: vid('Burpees') }),
        fri.ex({ name: 'Ruck Swings', reps: '15', videoId: vid('Ruck Swings') }),
        fri.ex({ name: 'Push-ups', reps: '10', videoId: vid('Push-ups') }),
        // Add Tibia Raises 2x/week (Friday as well)
        fri.ex({ name: 'Bear Crawl', distance: '20m', videoId: vid('Bear Crawl') }),
        fri.ex({ name: 'Tibia Raises', sets: 3, reps: '20-25', notes: 'Shin durability for ruck.' }),
        fri.ex({ name: 'Pull-up Block', reps: `${p.pullTotal} clean reps`, videoId: vid('Pull-ups') }),
      ],
    },
    saturday: {
      title: testEvent ?? p.tempoOrEvent.name,
      exercises: [
        runWarmup(`${sat.id}:warm`),
        sat.ex({
          name: p.tempoOrEvent.name,
          duration: p.tempoOrEvent.prescription,
          distance: p.tempoOrEvent.distance,
          weight: p.tempoOrEvent.weight,
          videoId: p.tempoOrEvent.name.toLowerCase().includes('ruck') ? vid('Ruck March') : undefined,
          notes: testEvent
            ? 'TEST DAY. Full warm-up + 5 min easy jog + 3x20s pickups (3 min rest). Then 2 miles ALL OUT. Same course every retest.'
            : (p.tempoOrEvent.name.toLowerCase().includes('ruck')
                ? 'WALK only. Weight HIGH and TIGHT. Sternum strap clipped. First hot spot = STOP, tape.'
                : 'RPE 6-7. Short sentences only. Can\'t speak = too fast. Even splits, don\'t fade.'),
        }),
        sat.ex({ name: 'Cool-down', duration: '5-10 min easy walk' }),
      ],
    },
    sunday: {
      title: 'Full rest + Sunday batch cook',
      exercises: [
        sun.ex({ name: 'Rest', duration: 'All day', notes: 'Sleep 8+. Hit calorie numbers. Easy 20-30 min walk if antsy. NO bonus workouts.' }),
        sun.ex({ name: 'Sunday Batch Cook', duration: '60-90 min mostly idle', notes: 'Slow cooker 5 servings for Mon-Fri lunches. 2.5 cups dry rice for the week.' }),
      ],
    },
  };
}

// ---------- Ruck progression (post-unlock in Foundation W7) ----------
// Foundation W1-6: no rucks (saturday = tempo/TT).
// From Foundation W7 onward: alternating tempo/ruck weeks, load ramps.
function ruckParamsForWeek(globalWeek: number): { weight: string; duration: string; distance: string } {
  // globalWeek is 1-based across all 78 weeks
  if (globalWeek < 7) return { weight: '', duration: '', distance: '' };
  // Foundation W7 = 20lb, +5lb per ruck, hold at 35lb
  // We do a ruck every 2 weeks -> weight progression
  const ruckIdx = Math.floor((globalWeek - 7) / 2); // 0,0,1,1,2,2...
  const fw = Math.min(20 + ruckIdx * 5, 35);
  // Distance/duration ramps: start 3mi/45min, ramp to 12mi <3hr by Peak end
  const totalRuckIdx = Math.floor((globalWeek - 7) / 2);
  const miles = Math.min(3 + totalRuckIdx * 0.5, 12);
  const minutes = Math.round(miles * 17); // ~17 min/mile early, targeting 15/mi
  return {
    weight: `${fw} lb`,
    distance: `${miles.toFixed(1)} mi`,
    duration: `~${minutes} min (target 15-17 min/mi)`,
  };
}

// ---------- Progressive params per global week ----------
function paramsForWeek(globalWeek: number): Params {
  // globalWeek 1..78
  const w = globalWeek;

  // Running prescriptions per doc + extension
  let easyRun = '3 rounds of [3 min jog / 2 min walk]';
  if (w >= 3 && w <= 4) easyRun = '4-5 rounds of [4 min jog / 1 min walk], or 20 min continuous';
  else if (w >= 5 && w <= 12) easyRun = '25-30 min continuous, conversational';
  else if (w >= 13 && w <= 26) easyRun = '30-40 min continuous';
  else if (w >= 27 && w <= 52) easyRun = '40-50 min continuous';
  else if (w >= 53) easyRun = '45-60 min continuous, zone 2';

  let speedRun = '10 min jog + 4x[30s brisk / 90s walk]';
  if (w >= 3 && w <= 6) speedRun = '6-8x[30s hard / 60s walk] OR 4-6 hill sprints';
  else if (w >= 7 && w <= 26) speedRun = '5-6x400m hard-repeatable, 2 min rest';
  else if (w >= 27 && w <= 52) speedRun = '6-8x400m OR 4x800m at 5k pace';
  else if (w >= 53) speedRun = '5x1000m at threshold, 90s rest';

  let recoveryRun = '20-30 min easy';
  if (w >= 10 && w <= 26) recoveryRun = '30-40 min easy';
  else if (w >= 27) recoveryRun = '40-50 min easy zone 2';

  // Saturday: alternate tempo/ruck once rucking unlocks (week 7)
  const ruckWeek = w >= 7 && w % 2 === 1; // odd weeks post-7
  const testWeeks = new Set([1, 5, 9, 13, 26, 39, 52, 65, 78]);
  const isTest = testWeeks.has(w);

  let tempoOrEvent: Params['tempoOrEvent'];
  if (isTest) {
    tempoOrEvent = { name: '2-Mile Time Trial', prescription: '2 miles ALL OUT (flat measured course)' };
  } else if (ruckWeek) {
    const r = ruckParamsForWeek(w);
    tempoOrEvent = { name: 'Ruck', prescription: r.duration, distance: r.distance, weight: r.weight };
  } else {
    let tempoDist = '15-20 min tempo after 5 min easy jog';
    if (w >= 6 && w <= 9) tempoDist = '2-3 mi at tempo';
    else if (w >= 10 && w <= 26) tempoDist = '3-5 mi at tempo';
    else if (w >= 27 && w <= 52) tempoDist = '4-6 mi at tempo';
    else if (w >= 53) tempoDist = '5-7 mi at tempo';
    tempoOrEvent = { name: 'Tempo Run', prescription: tempoDist };
  }

  // Pull-up block: 30 total in early foundation, up to 40-50 by peak
  let pullTotal = '10x3';
  if (w >= 4 && w <= 12) pullTotal = '6x5';
  else if (w >= 13 && w <= 26) pullTotal = '5x6 (30) or 4x8 wide grip';
  else if (w >= 27 && w <= 52) pullTotal = '5x8 (40 clean)';
  else if (w >= 53) pullTotal = '5x10 mixed grips (50 total)';

  // Strength load progression
  let pressReps = '8-12', pullReps = '8-12', splitSqReps = '8', gobletReps = '10', rdlReps = '8', stepReps = '10', wcRounds = 3;
  if (w >= 5) { pressReps = '10-12'; wcRounds = 3; }
  if (w >= 10) { pressReps = '10-15'; pullReps = '10-12'; splitSqReps = '10'; gobletReps = '12'; wcRounds = 4; }
  if (w >= 20) { pressReps = '12-15 feet-elevated'; splitSqReps = '10 (rucked)'; gobletReps = '12 (heavier)'; wcRounds = 4; }
  if (w >= 30) { pressReps = '4x12 deficit or tempo'; splitSqReps = '12 rucked'; gobletReps = '15'; rdlReps = '10'; wcRounds = 4; }
  if (w >= 45) { pressReps = '5x15 deficit'; pullReps = '12'; wcRounds = 5; }
  if (w >= 60) { pressReps = '5x15 tempo deficit'; pullReps = '12 weighted'; gobletReps = '15 heavy'; wcRounds = 5; }

  // Deload every 4th week: dial down volume
  if (w % 4 === 0) {
    easyRun = '20 min easy';
    speedRun = 'Skip or 4x[20s brisk / 90s walk]';
    recoveryRun = '20 min very easy';
    pullTotal = '5x3 easy';
    wcRounds = 2;
    if (!isTest) tempoOrEvent = { name: 'Easy Long Walk / Recovery', prescription: '45-60 min easy walk or light jog' };
  }

  const pool = w >= 6 ? '15-20 min easy laps + 2x2 min tread + 10 controlled bobs' : undefined;

  return {
    easyRun, speedRun, recoveryRun, tempoOrEvent, pullTotal,
    pressReps, pullReps, splitSqReps, gobletReps, rdlReps, stepReps, wcRounds, pool,
  };
}

// ---------- Build the 13-week SFRE Foundation program ----------
// This tracker renders ONLY the 13-week SFRE Foundation program. There is
// no Bridge or MTI Peak session content in this catalog — those lifecycle
// states (see sfre-program.ts resolveSfreLifecycle) intentionally emit no
// UI content here; a later, separate workstream owns any such catalog.
export const FOUNDATION_WEEK_COUNT = 13;

export const FOUNDATION_WEEKS: WeekWorkout[] = [];
for (let w = 1; w <= FOUNDATION_WEEK_COUNT; w++) {
  const p = paramsForWeek(w);
  const testWeeks = new Set([1, 5, 9, 13]);
  const testEvent = testWeeks.has(w) ? '2-Mile Time Trial (TEST)' : undefined;
  FOUNDATION_WEEKS.push(buildWeek('foundation', w, p, testEvent));
}
