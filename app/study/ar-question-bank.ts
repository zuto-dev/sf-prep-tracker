// AR question bank — hand-authored from Christian's actual miss patterns (2026-07-13 diagnostic, 50%).
// Tagged by miss-type so the /study page's "Review misses of type X" button can pull relevant retests.
// Every question mirrors a real ASVAB AR word-problem shape.

import { generateQuestionSet } from './parametric-generator';
import { SpacedRepetitionState, selectQuestionsWeighted, getQueuedQuestions } from './spaced-repetition';
import type { ARTopicSlug } from './lesson-types';

export type ARQuestion = {
  id: string;
  // Stable ID of the parametric template a generated question came from.
  // Undefined for hand-authored static questions. All performance tracking
  // aggregates against this key so parametric attempts don't orphan.
  templateId?: string;
  missType: 'translation' | 'setup' | 'arithmetic' | 'units' | 'distractor' | 'misread';
  subtype: string; // e.g. 'part-of-fraction', 'percent-increase', 'rate-time-distance'
  // Explicit topic — set on questions where the subtype-based fallback would
  // be ambiguous (e.g. 'division' can be distance or work depending on the
  // problem). If omitted, topicForQuestion() derives it from subtype.
  topic?: ARTopicSlug;
  prompt: string;
  choices: [string, string, string, string];
  correct: 0 | 1 | 2 | 3;
  explain: string;
};

// Subtype → topic mapping used when a question doesn't declare its topic
// explicitly. Kept as a plain table so it's obvious what maps where.
const SUBTYPE_TO_TOPIC: Record<string, ARTopicSlug> = {
  'part-of-fraction': 'fractions',
  'rate-time-distance': 'distance',
  'elapsed-time': 'units',
  'work': 'rate-work',
  'percent-increase': 'percentages',
  'percent-deduction': 'percentages',
  'percent-off': 'percentages',
  'percent-find-whole': 'percentages',
  'profit-per-item': 'algebra-word',
  'scale-ratio': 'ratios',
  'decimal-multiply': 'percentages',
  'coin-adding': 'algebra-word',
  'division': 'distance',                 // most 'division' questions are rate/mpg
  'division-with-remainder': 'distance',
  'tons-lb': 'units', 'pt-qt-gal': 'units', 'ft-in': 'units', 'yd-ft': 'units',
  'oz-lb': 'units', 'time-min-hr': 'units', 'km-mi': 'units', 'ft-in-fraction': 'units',
  'unit-mismatch': 'units',
  'magnitude': 'percentages',
  'find-whole-vs-part': 'percentages',
  'formula-plugin': 'algebra-word',       // overridden per-question where geometry/interest
  'scientific-notation': 'algebra-word',
  'exponent-rules': 'algebra-word',
  'probability': 'algebra-word',
  'factorial': 'algebra-word',
  'solve-decimal-coef': 'algebra-word',
  'polygon-angles': 'geometry',
  'cube-vol-sa': 'geometry',
  'radicals': 'algebra-word',
  'variable-rate': 'algebra-word',
  'concentration': 'mixture',
  'weighted-average': 'averages',
  'simple-average': 'averages',
  'simple-interest': 'interest',
  'compound-interest': 'interest',
  'area': 'geometry',
  'perimeter': 'geometry',
  'volume': 'geometry',
};

export const topicForQuestion = (q: Pick<ARQuestion, 'topic' | 'subtype'>): ARTopicSlug => {
  if (q.topic) return q.topic;
  return SUBTYPE_TO_TOPIC[q.subtype] ?? 'algebra-word';
};

// The key a question rolls up under in the spaced-repetition performanceMap.
// Static questions key on their own stable id; generated questions key on
// their template so every attempt against that template accumulates.
export const perfKeyFor = (q: Pick<ARQuestion, 'id' | 'templateId'>): string =>
  q.templateId ?? q.id;

export const AR_BANK: ARQuestion[] = [
  // === TRANSLATION: part-of-fraction (Q3, Q16, Q23, Q29 misses) ===
  { id: 't1',  missType: 'translation', subtype: 'part-of-fraction',
    prompt: 'A quart of oil is what part of a gallon?',
    choices: ['1/2', '1/3', '1/4', '1/8'], correct: 2,
    explain: '4 quarts in a gallon, so 1 quart = 1/4 gallon.' },
  { id: 't2',  missType: 'translation', subtype: 'part-of-fraction',
    prompt: 'What is 3/8 of 64?',
    choices: ['16', '18', '21', '24'], correct: 3,
    explain: '(3/8) × 64 = 3 × 8 = 24.' },
  { id: 't3',  missType: 'translation', subtype: 'part-of-fraction',
    prompt: 'A worker spent 1/4 of an 8-hour day on paperwork. How many hours were left?',
    choices: ['2', '4', '6', '7'], correct: 2,
    explain: '1/4 × 8 = 2 hours on paperwork. 8 − 2 = 6 remaining.' },
  { id: 't4',  missType: 'translation', subtype: 'part-of-fraction',
    prompt: 'What part of a dozen is 9 items?',
    choices: ['1/2', '2/3', '3/4', '5/6'], correct: 2,
    explain: '9 out of 12 = 9/12 = 3/4.' },
  // === TRANSLATION: rate-time-distance ===
  { id: 't5',  missType: 'translation', subtype: 'rate-time-distance',
    prompt: 'A car travels 45 mph. How far does it go in 2.5 hours?',
    choices: ['90 mi', '105 mi', '112.5 mi', '135 mi'], correct: 2,
    explain: 'Distance = rate × time = 45 × 2.5 = 112.5 miles.' },
  { id: 't6',  missType: 'translation', subtype: 'rate-time-distance',
    prompt: 'A boat traveling at 6 mph covers 27 miles. How long did it take?',
    choices: ['4 hr', '4 hr 30 min', '4 hr 45 min', '5 hr'], correct: 1,
    explain: 'Time = 27 ÷ 6 = 4.5 hours = 4 hr 30 min.' },
  { id: 't7',  missType: 'translation', subtype: 'elapsed-time',
    prompt: 'From 9:45 PM Monday to 6:15 AM Tuesday is how many hours and minutes?',
    choices: ['7 hr 30 min', '8 hr', '8 hr 30 min', '9 hr'], correct: 2,
    explain: '9:45 PM → midnight = 2 hr 15 min. Midnight → 6:15 AM = 6 hr 15 min. Total = 8 hr 30 min.' },
  // === TRANSLATION: work problems ===
  { id: 't8',  missType: 'translation', subtype: 'work',
    prompt: 'If a printer prints 40 pages in 5 minutes, how long to print 200 pages?',
    choices: ['20 min', '25 min', '30 min', '40 min'], correct: 1,
    explain: 'Rate = 8 pages/min. 200 ÷ 8 = 25 minutes.' },

  // === SETUP: percent increase / decrease (Q7, Q17, Q30) ===
  { id: 's1',  missType: 'setup', subtype: 'percent-increase',
    prompt: 'A price rose from $40 to $48. What is the percent increase?',
    choices: ['16%', '17%', '20%', '25%'], correct: 2,
    explain: 'Change = $8. Divide by ORIGINAL: 8/40 = 0.20 = 20%. NEVER by the new price.' },
  { id: 's2',  missType: 'setup', subtype: 'percent-increase',
    prompt: 'Rent went from $800 to $860. Percent increase?',
    choices: ['6.5%', '7%', '7.5%', '8%'], correct: 2,
    explain: '60/800 = 0.075 = 7.5%. Divide change by ORIGINAL.' },
  { id: 's3',  missType: 'setup', subtype: 'percent-deduction',
    prompt: 'A $2,500 paycheck has 25% withheld. Net pay?',
    choices: ['$1,875', '$1,900', '$2,000', '$2,250'], correct: 0,
    explain: 'Net = 75% of gross. 2500 × 0.75 = $1,875. If 25% removed, KEEP 75% — do not subtract 25% from gross once (that gives the same but only for round math; use 100−pct = keep%).' },
  { id: 's4',  missType: 'setup', subtype: 'percent-off',
    prompt: 'A jacket lists at $80, marked down 30%. Sale price?',
    choices: ['$50', '$54', '$56', '$60'], correct: 2,
    explain: 'Keep 70%. 80 × 0.70 = $56.' },
  { id: 's5',  missType: 'setup', subtype: 'percent-find-whole',
    prompt: '12 is 15% of what number?',
    choices: ['60', '72', '80', '90'], correct: 2,
    explain: '12 / 0.15 = 80. When you know part + rate → find whole = part / rate.' },
  { id: 's6',  missType: 'setup', subtype: 'profit-per-item',
    prompt: 'A vendor buys shirts for $120 total, sells them for $220 making $10 profit per shirt. How many shirts?',
    choices: ['8', '10', '11', '12'], correct: 1,
    explain: 'Total profit = 220 − 120 = $100. Number of shirts = 100 / 10 = 10.' },
  { id: 's7',  missType: 'setup', subtype: 'profit-per-item',
    prompt: 'A trader bought lamps for $300. Sold them for $500, making $20 profit per lamp. How many lamps?',
    choices: ['8', '10', '12', '15'], correct: 1,
    explain: 'Profit = 500 − 300 = $200. Lamps = 200 / 20 = 10.' },
  { id: 's8',  missType: 'setup', subtype: 'scale-ratio',
    prompt: 'On a map, 1 inch = 50 miles. What length represents 225 miles?',
    choices: ['3.5 in', '4 in', '4.5 in', '5 in'], correct: 2,
    explain: 'Set up 1/50 = x/225. x = 225/50 = 4.5 inches.' },
  { id: 's9',  missType: 'setup', subtype: 'scale-ratio',
    prompt: 'A drawing uses 1/2 inch to represent 1 foot. What length represents 6 feet?',
    choices: ['2 in', '3 in', '4 in', '6 in'], correct: 1,
    explain: '(1/2) × 6 = 3 inches.' },

  // === ARITHMETIC: careless division/multiplication (Q5, Q10, Q19, Q21) ===
  { id: 'a1',  missType: 'arithmetic', subtype: 'division',
    prompt: 'A car gets 32 mpg. How many gallons for a 224-mile trip?',
    choices: ['6', '7', '8', '9'], correct: 1,
    explain: '224 / 32 = 7 gallons. Verify: 32 × 7 = 224. ✓' },
  { id: 'a2',  missType: 'arithmetic', subtype: 'division',
    prompt: 'A pipe fills a tank at 3 gal/min. How many minutes for 165 gallons?',
    choices: ['50', '55', '60', '65'], correct: 1,
    explain: '165 / 3 = 55 minutes.' },
  { id: 'a3',  missType: 'arithmetic', subtype: 'decimal-multiply',
    prompt: 'Insurance costs $32.40 per $1,000 of coverage. Yearly premium for $7,000?',
    choices: ['$196.20', '$212.80', '$226.80', '$240.00'], correct: 2,
    explain: '32.40 × 7 = 226.80. Break: 32 × 7 = 224, plus 0.40 × 7 = 2.80 → 226.80.' },
  { id: 'a4',  missType: 'arithmetic', subtype: 'coin-adding',
    prompt: 'You have 4 quarters, 6 dimes, 12 nickels, and 20 pennies. Total?',
    choices: ['$2.00', '$2.20', '$2.40', '$2.60'], correct: 2,
    explain: '4×0.25 = 1.00; 6×0.10 = 0.60; 12×0.05 = 0.60; 20×0.01 = 0.20. Sum = $2.40.' },
  { id: 'a5',  missType: 'arithmetic', subtype: 'division-with-remainder',
    prompt: 'If a boat travels 6 mph, how long to cover 21 miles?',
    choices: ['3 hr', '3 hr 15 min', '3 hr 30 min', '3 hr 45 min'], correct: 2,
    explain: '21 / 6 = 3.5 hr = 3 hr 30 min. Not 3h15m (that\'s 0.25, i.e. 21/6 would need to be 3.25).' },

  // === UNITS: imperial conversions (Q2, Q3) ===
  { id: 'u1',  missType: 'units', subtype: 'tons-lb',
    prompt: 'A truck load weighs 2.5 tons. How many pounds?',
    choices: ['2,500', '4,000', '5,000', '6,000'], correct: 2,
    explain: '1 ton = 2,000 lb. 2.5 × 2,000 = 5,000 lb.' },
  { id: 'u2',  missType: 'units', subtype: 'pt-qt-gal',
    prompt: 'How many pints in 3 gallons?',
    choices: ['12', '16', '24', '32'], correct: 2,
    explain: '1 gal = 4 qt = 8 pt. 3 × 8 = 24 pints.' },
  { id: 'u3',  missType: 'units', subtype: 'ft-in',
    prompt: 'A wire is 5.5 feet long. How many inches?',
    choices: ['60', '62', '66', '72'], correct: 2,
    explain: '5.5 × 12 = 66 inches.' },
  { id: 'u4',  missType: 'units', subtype: 'yd-ft',
    prompt: 'A room is 8 yards wide. Convert to feet.',
    choices: ['16 ft', '20 ft', '24 ft', '32 ft'], correct: 2,
    explain: '1 yd = 3 ft. 8 × 3 = 24 ft.' },
  { id: 'u5',  missType: 'units', subtype: 'oz-lb',
    prompt: 'How many ounces in 4 pounds?',
    choices: ['32', '48', '64', '80'], correct: 2,
    explain: '1 lb = 16 oz. 4 × 16 = 64 oz.' },
  { id: 'u6',  missType: 'units', subtype: 'time-min-hr',
    prompt: 'How many minutes are in 3.25 hours?',
    choices: ['185', '190', '195', '210'], correct: 2,
    explain: '3 × 60 = 180. 0.25 × 60 = 15. Total 195 min.' },
  { id: 'u7',  missType: 'units', subtype: 'km-mi',
    prompt: 'If 1 km ≈ 5/8 mile, about how many miles in 32 km?',
    choices: ['16', '18', '20', '24'], correct: 2,
    explain: '32 × 5/8 = 32 × 0.625 = 20 miles.' },
  { id: 'u8',  missType: 'units', subtype: 'ft-in-fraction',
    prompt: 'How many inches in 2 feet 3 inches?',
    choices: ['23', '25', '27', '30'], correct: 2,
    explain: '2 × 12 + 3 = 24 + 3 = 27 inches.' },

  // === DISTRACTOR / MISREAD extra bank (spec-required strategy practice) ===
  { id: 'd1',  missType: 'distractor', subtype: 'unit-mismatch',
    prompt: 'A rope is 60 inches. How many feet? (Choices deliberately include units traps.)',
    choices: ['5 in', '5 ft', '720 ft', '0.5 ft'], correct: 1,
    explain: '60 / 12 = 5 ft. "5 in" is the unit trap; the number is right but unit wrong.' },
  { id: 'd2',  missType: 'distractor', subtype: 'magnitude',
    prompt: 'A discount of 15% off $80 saves you how much?',
    choices: ['$1.20', '$12', '$68', '$120'], correct: 1,
    explain: '0.15 × 80 = $12. $1.20 is off by 10× (magnitude trap). $68 is the sale price, not savings.' },
  { id: 'd3',  missType: 'misread', subtype: 'find-whole-vs-part',
    prompt: '30% of a number is 60. What is the number?',
    choices: ['18', '90', '200', '180'], correct: 2,
    explain: 'Number = 60 / 0.30 = 200. If you read "30% of 60" you get 18 — that\'s the trap.' },

  // === MK BANK — added after 2026-07-13 MK diagnostic (46%) ===

  // Formula plug-in (Q4, Q22 pattern — the biggest MK gap)
  { id: 'mk1', missType: 'setup', subtype: 'formula-plugin', topic: 'interest',
    prompt: 'In I = P + PRT, find I when P = 800, R = 5%, T = 3.',
    choices: ['920', '840', '1200', '1400'], correct: 0,
    explain: 'I = 800 + (800 × 0.05 × 3) = 800 + 120 = 920. Compute PRT first, then add P.' },
  { id: 'mk2', missType: 'setup', subtype: 'formula-plugin', topic: 'geometry',
    prompt: 'In A = ½bh, find A when b = 12 and h = 5.',
    choices: ['17', '30', '60', '120'], correct: 1,
    explain: '½ × 12 × 5 = 30. Half of the base times the height.' },
  { id: 'mk3', missType: 'setup', subtype: 'formula-plugin',
    prompt: 'In F = (9/5)C + 32, convert C = 25° to Fahrenheit.',
    choices: ['57', '65', '77', '82'], correct: 2,
    explain: '(9/5)(25) + 32 = 45 + 32 = 77°F.' },

  // Scientific notation (Q6 pattern)
  { id: 'mk4', missType: 'setup', subtype: 'scientific-notation',
    prompt: '3.6 × 10³ =',
    choices: ['360', '3,600', '36,000', '360,000'], correct: 1,
    explain: '10³ = 1,000. 3.6 × 1,000 = 3,600. Move decimal 3 places right.' },
  { id: 'mk5', missType: 'setup', subtype: 'scientific-notation',
    prompt: '0.005 written in scientific notation is:',
    choices: ['5 × 10⁻³', '5 × 10³', '5 × 10⁻²', '0.5 × 10⁻²'], correct: 0,
    explain: 'Move decimal 3 places right to get 5 → exponent is −3.' },

  // Exponent rules (Q7 pattern)
  { id: 'mk6', missType: 'setup', subtype: 'exponent-rules',
    prompt: 'x⁴ × x³ =',
    choices: ['x⁷', 'x¹²', 'x¹', '2x⁷'], correct: 0,
    explain: 'Same base multiplied → ADD exponents. 4 + 3 = 7.' },
  { id: 'mk7', missType: 'setup', subtype: 'exponent-rules',
    prompt: '(x⁵) / (x²) =',
    choices: ['x⁷', 'x³', 'x²·⁵', 'x¹⁰'], correct: 1,
    explain: 'Same base divided → SUBTRACT exponents. 5 − 2 = 3.' },

  // Probability (Q9, Q26 pattern — rule fix)
  { id: 'mk8', missType: 'setup', subtype: 'probability',
    prompt: 'A jar has 4 red, 6 blue, and 10 green marbles. Pick one. P(blue) = ?',
    choices: ['1/6', '3/10', '1/5', '6/10'], correct: 1,
    explain: 'Total = 20. P(blue) = 6/20 = 3/10. Favorable / total.' },
  { id: 'mk9', missType: 'setup', subtype: 'probability',
    prompt: 'A deck has 52 cards; 13 are hearts. P(heart) on one draw?',
    choices: ['1/13', '1/4', '1/2', '13/52 same as 1/4'], correct: 1,
    explain: '13/52 = 1/4. Simplify.' },

  // Factorials (Q24 pattern — rule fix)
  { id: 'mk10', missType: 'setup', subtype: 'factorial',
    prompt: '5! =',
    choices: ['25', '60', '100', '120'], correct: 3,
    explain: '5! = 5 × 4 × 3 × 2 × 1 = 120.' },

  // Solving for variable (Q16 pattern)
  { id: 'mk11', missType: 'arithmetic', subtype: 'solve-decimal-coef',
    prompt: 'If 0.05y = 1, then y =',
    choices: ['0.02', '5', '20', '50'], correct: 2,
    explain: 'y = 1 / 0.05 = 20. Dividing by a decimal < 1 makes result BIGGER.' },
  { id: 'mk12', missType: 'arithmetic', subtype: 'solve-decimal-coef',
    prompt: 'If 0.2x = 15, then x =',
    choices: ['3', '30', '75', '300'], correct: 2,
    explain: 'x = 15 / 0.2 = 75.' },

  // Polygon interior angles (Q23 arithmetic slip)
  { id: 'mk13', missType: 'arithmetic', subtype: 'polygon-angles',
    prompt: 'Sum of interior angles of a hexagon (6 sides)?',
    choices: ['540°', '720°', '900°', '1,080°'], correct: 1,
    explain: '180 × (n − 2) = 180 × 4 = 720°. Compute (n−2) first.' },
  { id: 'mk14', missType: 'arithmetic', subtype: 'polygon-angles',
    prompt: 'Sum of interior angles of an octagon (8 sides)?',
    choices: ['900°', '1,080°', '1,260°', '1,440°'], correct: 1,
    explain: '180 × (8 − 2) = 180 × 6 = 1,080°.' },

  // Cube V ↔ SA (Q21)
  { id: 'mk15', missType: 'setup', subtype: 'cube-vol-sa',
    prompt: 'A cube has volume 64 in³. What is its surface area?',
    choices: ['48 in²', '64 in²', '96 in²', '128 in²'], correct: 2,
    explain: 'Side³ = 64 → side = 4. SA = 6 × 4² = 6 × 16 = 96 in².' },

  // Radical simplification (Q17)
  { id: 'mk16', missType: 'setup', subtype: 'radicals',
    prompt: '√50 simplified =',
    choices: ['5√2', '2√5', '25√2', '10'], correct: 0,
    explain: '50 = 25 × 2. √25 = 5. So √50 = 5√2. Pull out square factors.' },

  // Variable rate (Q25 — bridges MK/AR)
  { id: 'mk17', missType: 'translation', subtype: 'variable-rate',
    prompt: 'If K gallons flow in 1 second, how many gallons in M minutes?',
    choices: ['KM', 'K + 60M', '60KM', 'K/60M'], correct: 2,
    explain: '60 sec/min × M min = 60M seconds. Each sec = K gallons → 60KM.' },
  { id: 'mk18', missType: 'translation', subtype: 'variable-rate',
    prompt: 'A car uses G gallons per mile. How many gallons for D miles?',
    choices: ['G/D', 'D/G', 'GD', 'G + D'], correct: 2,
    explain: 'G gallons per 1 mile × D miles = GD gallons total.' },
];

// Helper: pull N questions filtered by topic OR missType, using spaced
// repetition when available. Topic filter is the lesson-page path; missType
// is the legacy error-log-review path.
export function pickReviewSet(
  filter: { missType: ARQuestion['missType'] } | { topic: ARTopicSlug },
  n = 5,
  spacedRepState?: SpacedRepetitionState,
  useParametric = true
): ARQuestion[] {
  const parametricCount = useParametric ? Math.ceil(n * 0.8) : 0;
  const staticCount = n - parametricCount;
  const questions: ARQuestion[] = [];

  // Get parametric questions
  if (parametricCount > 0) {
    const parametricQuestions = 'topic' in filter
      ? generateQuestionSet({ topic: filter.topic }, parametricCount)
      : generateQuestionSet({ missType: filter.missType }, parametricCount);
    questions.push(...parametricQuestions);
  }

  // Get static questions
  if (staticCount > 0) {
    const staticPool = 'topic' in filter
      ? AR_BANK.filter(q => topicForQuestion(q) === filter.topic)
      : AR_BANK.filter(q => q.missType === filter.missType);

    if (spacedRepState && staticPool.length > 0) {
      // Leitner pre-filter: only questions that are actually due for review.
      // If that empties the pool (rare, but happens right after a heavy
      // session), fall back to the full pool so drills never stall.
      const dueIds = new Set(getQueuedQuestions(spacedRepState, staticPool.map(q => q.id)));
      const duePool = staticPool.filter(q => dueIds.has(q.id));
      const pool = duePool.length >= staticCount ? duePool : staticPool;
      const selected = selectQuestionsWeighted(pool, spacedRepState, staticCount);
      questions.push(...selected);
    } else {
      const shuffled = [...staticPool].sort(() => Math.random() - 0.5);
      questions.push(...shuffled.slice(0, Math.min(staticCount, shuffled.length)));
    }
  }
  
  // Shuffle the combined set
  return questions.sort(() => Math.random() - 0.5).slice(0, n);
}
