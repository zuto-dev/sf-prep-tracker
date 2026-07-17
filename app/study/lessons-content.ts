// Full lesson content for the study curriculum. Prose here is the whole
// point of the page — it's what the user is here to learn.
//
// Every lesson follows the same beat: what it looks like on the ASVAB →
// the core insight → a fully worked example → the specific trap the test
// uses → any important variants. Kept as data (not JSX) so it's greppable,
// syncable, and the renderer can decide how to lay it out.

import type { Lesson, TopicMeta } from './lesson-types';

// ─────────────────────────────────────────────────────────────────────────
// Topic index — the curriculum. Order here is display order per section.
// ─────────────────────────────────────────────────────────────────────────

export const TOPIC_META: TopicMeta[] = [
  // Arithmetic Reasoning — foundation → advanced
  { slug: 'fractions',    title: 'Fractions & decimals',            subtitle: 'The foundation: add, subtract, multiply, divide, convert.',       section: 'ar', order: 1,  minutes: 8,  petersonRef: 'Mod 1.1' },
  { slug: 'averages',     title: 'Averages',                        subtitle: 'Simple mean, weighted mean, and finding a missing value.',       section: 'ar', order: 2,  minutes: 6,  petersonRef: 'Mod 2.4' },
  { slug: 'percentages',  title: 'Percentages — the three types',   subtitle: 'Find the part, the whole, or the rate. Percent change traps.',    section: 'ar', order: 3,  minutes: 10, petersonRef: 'Mod 3.1' },
  { slug: 'ratios',       title: 'Ratios & proportions',            subtitle: 'Set up an equation, cross-multiply, keep the units aligned.',     section: 'ar', order: 4,  minutes: 7,  petersonRef: 'Mod 3.3' },
  { slug: 'algebra-word', title: 'Algebra word problems',           subtitle: 'Translating English sentences into equations cleanly.',           section: 'ar', order: 5,  minutes: 9,  petersonRef: 'Mod 4.1' },
  { slug: 'distance',     title: 'Distance = rate × time',          subtitle: 'Meeting problems, opposing directions, chasing.',                 section: 'ar', order: 6,  minutes: 8,  petersonRef: 'Mod 4.2' },
  { slug: 'interest',     title: 'Interest & percent-change chains', subtitle: 'Simple vs compound. Why 10% up then 10% down isn\'t break-even.', section: 'ar', order: 7,  minutes: 7,  petersonRef: 'Mod 3.2' },
  { slug: 'geometry',     title: 'Geometry — area, perimeter, volume', subtitle: 'Rectangles, triangles, circles, boxes, cylinders, angle sums.', section: 'ar', order: 8,  minutes: 9,  petersonRef: 'Mod 5.1' },
  { slug: 'rate-work',    title: 'Rate & work',                     subtitle: 'When two things happen at the same time. Combining rates.',       section: 'ar', order: 9,  minutes: 8,  petersonRef: 'Mod 4.3' },
  { slug: 'mixture',      title: 'Mixture problems',                subtitle: 'Concentration × volume balancing. Solutions, alloys, blending.',  section: 'ar', order: 10, minutes: 7,  petersonRef: 'Mod 4.4' },
  { slug: 'units',        title: 'Unit conversion under pressure',  subtitle: 'Imperial and time units. Practiced until it\'s reflex.',           section: 'ar', order: 11, minutes: 6,  petersonRef: 'Mod 1.4' },

  // Word Knowledge strategies
  { slug: 'wk-decompose', title: 'Decompose the word', subtitle: 'Prefix + root + suffix carries 40% of the meaning for free.', section: 'wk', order: 1, minutes: 5 },
  { slug: 'wk-context',   title: 'Read the whole sentence first',  subtitle: 'Context replaces guessing on the vocab you don\'t know yet.',      section: 'wk', order: 2, minutes: 4 },
  { slug: 'wk-eliminate', title: 'Eliminate the two easy wrong answers', subtitle: 'There is almost always one absurd choice and one near-synonym trap.', section: 'wk', order: 3, minutes: 4 },
  { slug: 'wk-gut',       title: 'Trust your gut on 50/50 guesses', subtitle: 'First-instinct beats overthinking on words at the edge of recognition.', section: 'wk', order: 4, minutes: 3 },

  // Paragraph Comprehension strategies
  { slug: 'pc-question-first',  title: 'Read the question before the passage', subtitle: 'You skim smarter when you know what you\'re hunting for.', section: 'pc', order: 1, minutes: 4 },
  { slug: 'pc-passage-type',    title: 'Name the passage type in one word',    subtitle: 'Narrative, argument, description — each one has predictable questions.', section: 'pc', order: 2, minutes: 5 },
  { slug: 'pc-question-types',  title: 'The four question types and their traps', subtitle: 'Main idea, direct detail, inference, tone — each one is trapped differently.', section: 'pc', order: 3, minutes: 6 },

  // Test-day strategy
  { slug: 'td-format',    title: 'Know which test you\'re taking this week', subtitle: 'CAT-ASVAB at MEPS vs paper MET at satellites. Very different pacing.', section: 'test-day', order: 1, minutes: 4 },
  { slug: 'td-eliminate', title: 'Eliminate two, then guess — never leave blank', subtitle: 'CAT penalizes blank answers at the end of the section, hard.',   section: 'test-day', order: 2, minutes: 3 },
  { slug: 'td-picat',     title: 'Take the PiCAT if your recruiter offers it', subtitle: 'Same item bank as CAT, at home, un-timed — the closest thing to a real diagnostic.', section: 'test-day', order: 3, minutes: 3 },
  { slug: 'td-logistics', title: 'Morning of: eat, sleep, arrive early',    subtitle: 'You\'ll be at MEPS 4–6 hours. Details that cost points if you skip them.', section: 'test-day', order: 4, minutes: 3 },
];

export const TOPIC_META_BY_SLUG = Object.fromEntries(TOPIC_META.map(m => [m.slug, m])) as Record<string, TopicMeta>;

// ─────────────────────────────────────────────────────────────────────────
// Lesson content — one entry per topic in TOPIC_META.
// ─────────────────────────────────────────────────────────────────────────

export const LESSONS: Lesson[] = [

  // ═══════════════════════════════════════════════════════════════════════
  // AR — Fractions & decimals
  // ═══════════════════════════════════════════════════════════════════════
  {
    slug: 'fractions',
    meta: TOPIC_META_BY_SLUG['fractions'],
    blocks: [
      { kind: 'h', text: 'What this looks like on the ASVAB' },
      { kind: 'p', text: 'Any question with a fraction phrase in it: <em>"1/4 of an 8-hour day"</em>, <em>"how many quarts in 3 gallons"</em>, <em>"3/8 of 64"</em>. Also anywhere the problem hides a fraction inside a division — <em>32.40 per $1,000</em> is really <em>32.40 ÷ 1000</em>. Fractions and decimals are the same object dressed differently, and the test moves between them freely.' },

      { kind: 'h', text: 'The core insight' },
      { kind: 'p', text: 'A fraction is a division waiting to happen. <strong>3/4 means 3 ÷ 4 = 0.75.</strong> When you convert between the two forms, you\'re just doing the division. That\'s the whole trick.' },
      { kind: 'p', text: 'To operate on fractions: <strong>multiply straight across</strong> (numerator × numerator, denominator × denominator). <strong>Divide by flipping</strong> the second fraction and multiplying. To <strong>add or subtract</strong>, get a common denominator first, then add just the tops.' },

      { kind: 'example', prompt: 'A worker spent 1/4 of an 8-hour day on paperwork. How many hours were left?', steps: [
        { label: 'Time on paperwork:', value: '1/4 × 8 = 2 hours' },
        { label: 'Time left:',         value: '8 − 2 = 6 hours' },
      ], answer: '6 hours' },

      { kind: 'trap', title: 'The trap the ASVAB uses here', text: 'The answer choices will include <span class="mono">2</span> (hours <em>spent</em>) right next to <span class="mono">6</span> (hours <em>left</em>). Miss the last three words of the question and you pick the trap. Always underline what the question is actually asking for before you compute.' },

      { kind: 'h', text: 'Decimal placement — the second biggest fraction trap' },
      { kind: 'p', text: 'Every question with a decimal has a distractor that\'s off by a factor of 10. If you see <em>$32.40 per $1,000 coverage, how much for $7,000?</em>, the answer is <strong>$226.80</strong>, and the trap will be <span class="mono">$22.68</span> or <span class="mono">$2,268</span>. Sanity-check every decimal answer against the size of the numbers involved.' },
      { kind: 'note', text: 'Rule of thumb: multiplying by a decimal less than 1 makes the answer <em>smaller</em>. Dividing by a decimal less than 1 makes it <em>bigger</em>. If you\'re surprised by the direction, you set it up wrong.' },

      { kind: 'h', text: 'Fractions of a unit (part-of-fraction) — a whole question type on its own' },
      { kind: 'p', text: 'The setup: <em>"A quart is what part of a gallon?"</em>, <em>"9 ounces is what part of a pound?"</em>. These are pure conversions dressed as fractions. Memorize the four everyday relationships and you get every one of these for free: <strong>4 quarts in a gallon</strong>, <strong>16 ounces in a pound</strong>, <strong>12 items in a dozen</strong>, <strong>60 minutes in an hour</strong>. A quart is 1/4. Nine ounces is 9/16.' },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════
  // AR — Averages
  // ═══════════════════════════════════════════════════════════════════════
  {
    slug: 'averages',
    meta: TOPIC_META_BY_SLUG['averages'],
    blocks: [
      { kind: 'h', text: 'What this looks like on the ASVAB' },
      { kind: 'p', text: 'Three shapes come up: <strong>simple average</strong> ("mean of these five numbers"), <strong>missing value</strong> ("four test scores averaged 82; what was the fifth?"), and <strong>weighted average</strong> ("the average of these two groups combined"). All three collapse to one sentence: <strong>sum ÷ count</strong>.' },

      { kind: 'h', text: 'The core insight' },
      { kind: 'p', text: 'Never solve the average directly for a missing-value question. Instead, work backwards from the sum: <strong>target average × count = the sum you need</strong>. Subtract the known values from that target sum, and the missing piece drops out.' },

      { kind: 'example', prompt: 'Four of your five test scores are 78, 85, 90, and 76. You need to average 82 across all five. What does the fifth score need to be?', steps: [
        { label: 'Target sum:',   value: '82 × 5 = 410' },
        { label: 'Known sum:',    value: '78 + 85 + 90 + 76 = 329' },
        { label: 'Missing score:', value: '410 − 329 = 81' },
      ], answer: '81' },

      { kind: 'trap', title: 'The trap the ASVAB uses here', text: 'The wrong answers will include <span class="mono">82</span> (they\'ll pretend the missing score just equals the target average) and <span class="mono">83</span> (average of the four known scores). The right answer is neither — it\'s whatever pulls the actual sum up to the target.' },

      { kind: 'h', text: 'Weighted averages — when the group sizes differ' },
      { kind: 'p', text: 'You cannot average two averages if the groups have different sizes. <em>Class A averaged 80 with 20 students; class B averaged 90 with 5 students.</em> The combined average is not 85. It\'s:' },
      { kind: 'example', prompt: 'Class A averaged 80 (20 students); class B averaged 90 (5 students). What did both classes average together?', steps: [
        { label: 'Sum A:',      value: '80 × 20 = 1600' },
        { label: 'Sum B:',      value: '90 × 5 = 450' },
        { label: 'Combined:',   value: '(1600 + 450) ÷ 25 = 2050 ÷ 25 = 82' },
      ], answer: '82' },
      { kind: 'note', text: 'Reflex check: the combined average always leans toward the bigger group. Class A was bigger, so 82 (closer to 80) is right; 85 (halfway) would only be right if the groups were the same size.' },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════
  // AR — Percentages
  // ═══════════════════════════════════════════════════════════════════════
  {
    slug: 'percentages',
    meta: TOPIC_META_BY_SLUG['percentages'],
    blocks: [
      { kind: 'h', text: 'What this looks like on the ASVAB' },
      { kind: 'p', text: 'More AR questions than any other topic. Three basic shapes: <strong>find the part</strong> ("what is 20% of 60?"), <strong>find the whole</strong> ("12 is 15% of what number?"), and <strong>find the rate</strong> ("12 is what percent of 60?"). Plus their applied cousins: markup, discount, tax, tip, percent increase, percent decrease.' },

      { kind: 'h', text: 'The core insight' },
      { kind: 'p', text: 'Every percent problem has exactly three parts: a <strong>part</strong>, a <strong>whole</strong>, and a <strong>rate</strong>. Two are given, and you find the third. Once you know which is which, one line of algebra finishes it.' },
      { kind: 'p', text: 'The formula: <strong>part = whole × rate</strong>. Solve it for whichever piece is missing. So <em>whole = part ÷ rate</em>, and <em>rate = part ÷ whole</em>. That\'s the entire topic.' },

      { kind: 'example', prompt: 'Type 1 — find the part. What is 20% of 60?', steps: [
        { label: 'Part = whole × rate:', value: '60 × 0.20 = 12' },
      ], answer: '12' },
      { kind: 'example', prompt: 'Type 2 — find the whole. 12 is 15% of what number?', steps: [
        { label: 'Whole = part ÷ rate:', value: '12 ÷ 0.15 = 80' },
      ], answer: '80' },
      { kind: 'example', prompt: 'Type 3 — find the rate. 12 is what percent of 60?', steps: [
        { label: 'Rate = part ÷ whole:', value: '12 ÷ 60 = 0.20 = 20%' },
      ], answer: '20%' },

      { kind: 'trap', title: 'The percent-increase trap (the one that gets everybody)', text: 'When a price goes from $40 to $48, the percent increase is <strong>8/40 = 20%</strong>, not <span class="mono">8/48</span>. <strong>Always divide the change by the ORIGINAL value.</strong> The wrong denominator will always be in the answer choices, waiting for you.' },

      { kind: 'h', text: 'Percent-off shortcut' },
      { kind: 'p', text: 'When something is <em>30% off</em>, the sale price is <strong>70% of the original</strong>. Don\'t compute the discount and subtract — go straight to the sale price: <span class="mono">80 × 0.70 = 56</span>. One multiplication instead of two.' },

      { kind: 'h', text: '"Percent MORE than" versus "percent OF"' },
      { kind: 'p', text: '<em>30% more than X</em> means <strong>1.30 × X</strong>, not <span class="mono">0.30 × X</span>. When someone earns "20% more than $50,000," they earn $60,000, not $10,000. The word <em>than</em> is what tells you to add the 100% back in.' },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════
  // AR — Ratios & proportions
  // ═══════════════════════════════════════════════════════════════════════
  {
    slug: 'ratios',
    meta: TOPIC_META_BY_SLUG['ratios'],
    blocks: [
      { kind: 'h', text: 'What this looks like on the ASVAB' },
      { kind: 'p', text: 'Scale problems (<em>"1 inch on the map = 50 miles"</em>), unit rates (<em>"$3.60 per pound; how much for 2.5 lb?"</em>), recipe scaling (<em>"the recipe serves 4; how much flour for 10?"</em>), and any question where a relationship stays constant while the numbers change.' },

      { kind: 'h', text: 'The core insight' },
      { kind: 'p', text: 'A proportion is just <strong>two equal fractions</strong>: <span class="mono">a/b = c/d</span>. Cross-multiply and you get <span class="mono">ad = bc</span>. That\'s the whole method — everything else is bookkeeping.' },
      { kind: 'p', text: 'The bookkeeping that actually matters: <strong>keep the same units in the same position on both sides</strong>. If inches are on top on the left, they\'d better be on top on the right. If you mix that up, you\'ll get an answer that\'s numerically wrong <em>and</em> in the wrong unit.' },

      { kind: 'example', prompt: 'On a map, 1 inch represents 50 miles. What length on the map represents 225 miles?', steps: [
        { label: 'Set up:',        value: '1 inch / 50 miles = x inches / 225 miles' },
        { label: 'Cross-multiply:', value: '1 × 225 = 50 × x' },
        { label: 'Solve:',          value: 'x = 225 / 50 = 4.5 inches' },
      ], answer: '4.5 inches' },

      { kind: 'trap', title: 'The units trap', text: 'The wrong-answer factory here inverts the ratio. If you set up <span class="mono">50/1 = 225/x</span>, you get <span class="mono">x = 4.5</span> too — <strong>but only because 4.5 happens to also work for the wrong setup</strong>. On harder problems, the inverted setup produces a wrong number that\'s always in the answer choices. The habit that saves you: write the units next to every number and check that they cancel.' },

      { kind: 'h', text: 'Three-term ratios' },
      { kind: 'p', text: 'When you see <em>"the ratio of A to B to C is 2:3:5"</em>, treat it the same way. If the total is 30, then each "part" is worth <span class="mono">30 ÷ (2+3+5) = 3</span>, so A = 6, B = 9, C = 15. The 2+3+5 = 10 sum-of-parts move is the key.' },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════
  // AR — Algebra word problems
  // ═══════════════════════════════════════════════════════════════════════
  {
    slug: 'algebra-word',
    meta: TOPIC_META_BY_SLUG['algebra-word'],
    blocks: [
      { kind: 'h', text: 'What this looks like on the ASVAB' },
      { kind: 'p', text: 'Any question where a sentence in English needs to become an equation in variables before you can solve it. <em>"The sum of two consecutive integers is 47."</em> <em>"Three more than twice a number is 17."</em> <em>"John is 3 years older than twice Mary\'s age."</em> The math is usually easy — the hard part is the translation.' },

      { kind: 'h', text: 'The core insight' },
      { kind: 'p', text: 'English-to-algebra has a small vocabulary. Learn these five and you can translate almost anything:' },
      { kind: 'list', items: [
        '"sum" or "more than" or "increased by" → <strong>+</strong>',
        '"difference" or "less than" or "decreased by" → <strong>−</strong>',
        '"of" or "product" or "times" → <strong>×</strong>',
        '"per" or "divided by" or "ratio" → <strong>÷</strong>',
        '"is" or "equals" or "gives" → <strong>=</strong>',
      ] },

      { kind: 'p', text: 'The other habit that matters: <strong>define your variable in one written sentence before you start</strong>. "Let x = the smaller integer." That sentence is what prevents the most common mistake, which is solving for the right variable and then answering with the wrong one.' },

      { kind: 'example', prompt: 'The sum of two consecutive integers is 47. What is the smaller integer?', steps: [
        { label: 'Define:',         value: 'Let x = smaller integer' },
        { label: 'Translate:',      value: 'x + (x + 1) = 47' },
        { label: 'Simplify:',        value: '2x + 1 = 47' },
        { label: 'Solve:',           value: '2x = 46, x = 23' },
      ], answer: '23' },

      { kind: 'trap', title: 'The "which value are they asking for" trap', text: 'The choices will include <span class="mono">24</span> (the larger integer, which is also right — just to the wrong question) and <span class="mono">23.5</span> (dividing 47 by 2 without thinking about consecutive-ness). Circle the question\'s actual ask before you start — "smaller integer" vs "larger integer" vs "sum" are all traps.' },

      { kind: 'h', text: '"Less than" reads backwards' },
      { kind: 'p', text: '"7 less than x" is <span class="mono">x − 7</span>, not <span class="mono">7 − x</span>. English puts the "less than" first, but math writes the number being subtracted last. Whenever you see "less than", flip the order in your head before writing the equation. This trip-up costs at least one AR question per test.' },

      { kind: 'h', text: 'Coin, age, and mixture problems all use the same trick' },
      { kind: 'p', text: 'Each of these classic word problems reduces to: <strong>define one variable, express everything else in terms of it, write one equation, solve.</strong> Coin problems: define the number of quarters as q, then express dimes in terms of q. Age problems: define one person\'s age as x, express the other person\'s in terms of x. Practice enough and the pattern becomes automatic.' },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════
  // AR — Distance = rate × time
  // ═══════════════════════════════════════════════════════════════════════
  {
    slug: 'distance',
    meta: TOPIC_META_BY_SLUG['distance'],
    blocks: [
      { kind: 'h', text: 'What this looks like on the ASVAB' },
      { kind: 'p', text: 'Any question with a speed. Simplest form: <em>"A car travels at 45 mph for 2.5 hours. How far?"</em> Harder: <em>"Two trains leave stations 400 miles apart heading toward each other at 60 and 40 mph. When do they meet?"</em> Even harder: <em>"A car leaves at 10 AM at 40 mph. Another leaves at noon at 60 mph. When does the second catch up?"</em>' },

      { kind: 'h', text: 'The core insight' },
      { kind: 'p', text: '<strong>D = R × T.</strong> That\'s it. Two of the three are always given; find the third. All the "harder" variants are just this equation set up twice — once for each object — with the relationship between them expressed as a constraint (they meet, or one catches up, or they end up 200 miles apart).' },

      { kind: 'example', prompt: 'A boat travels at 6 mph and covers 27 miles. How long did the trip take?', steps: [
        { label: 'Rearrange D = RT:', value: 'T = D / R' },
        { label: 'Plug in:',           value: 'T = 27 / 6' },
        { label: 'Solve:',              value: 'T = 4.5 hours = 4 hr 30 min' },
      ], answer: '4 hours 30 minutes' },

      { kind: 'trap', title: 'The units trap', text: 'The most common wrong answer for the boat problem is <span class="mono">4 hr 5 min</span> — someone reads 4.5 as "4 hours and 5 minutes" instead of "4 hours and 30 minutes". <strong>0.5 of an hour is 30 minutes, not 5.</strong> Any decimal hour is <em>×60</em> to get minutes.' },

      { kind: 'h', text: 'Two-object shape 1: they meet (rates add)' },
      { kind: 'p', text: 'When two things move <em>toward each other</em>, the gap closes at the <strong>sum</strong> of their rates. Two trains 400 miles apart at 60 and 40 mph close the gap at 100 mph, so they meet in <span class="mono">400 ÷ 100 = 4 hours</span>.' },

      { kind: 'h', text: 'Two-object shape 2: same direction (rates subtract)' },
      { kind: 'p', text: 'When one object <em>chases</em> another, only the difference in their speeds matters. If a car at 40 mph has a 2-hour head start (so it\'s 80 miles ahead), and a second car at 60 mph starts chasing, the gap closes at <strong>60 − 40 = 20 mph</strong>, so the second catches up in <span class="mono">80 ÷ 20 = 4 hours</span>.' },
      { kind: 'note', text: 'The check that catches most setup errors: <strong>if your answer is bigger than the head-start time itself</strong>, you probably added rates when you should have subtracted them (or vice versa). Reread the problem and check direction.' },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════
  // AR — Interest & percent-change chains
  // ═══════════════════════════════════════════════════════════════════════
  {
    slug: 'interest',
    meta: TOPIC_META_BY_SLUG['interest'],
    blocks: [
      { kind: 'h', text: 'What this looks like on the ASVAB' },
      { kind: 'p', text: 'Simple interest problems (<em>"$800 at 5% for 3 years"</em>), the occasional compound interest problem (rare on AR, more common on MK), and — the one most people mess up — <strong>sequences of percent changes</strong>. "A stock rose 20% then fell 20%. Where is it now?" is not "back where it started."' },

      { kind: 'h', text: 'The core formula: simple interest' },
      { kind: 'p', text: '<strong>I = P × R × T.</strong> Interest equals principal times rate times time. Rate is written as a decimal (5% = 0.05). Time is in the same unit as the rate — if the rate is annual, time is in years.' },

      { kind: 'example', prompt: 'How much interest does $800 earn at 5% simple annual interest over 3 years?', steps: [
        { label: 'Formula:',       value: 'I = P × R × T' },
        { label: 'Plug in:',        value: 'I = 800 × 0.05 × 3' },
        { label: 'Multiply left to right:', value: 'I = 40 × 3 = $120' },
      ], answer: '$120' },
      { kind: 'note', text: 'If the question asks for the <em>total in the account</em> after 3 years, that\'s <strong>P + I = 800 + 120 = $920</strong>. If it asks only for the <em>interest</em>, it\'s $120. Always underline which one they\'re asking for.' },

      { kind: 'h', text: 'The percent-chain trap (the biggest interest-adjacent miss)' },
      { kind: 'p', text: '<em>A stock rose 10% then fell 10%. What percent is it above or below its starting price?</em> The wrong instinct says "0% — they cancel." They don\'t.' },
      { kind: 'example', prompt: 'A stock at $100 rose 10%, then fell 10%. What is it worth now?', steps: [
        { label: 'After 10% rise:',   value: '100 × 1.10 = $110' },
        { label: 'After 10% fall:',    value: '110 × 0.90 = $99' },
        { label: 'Net change:',         value: 'down $1 = 1% below start' },
      ], answer: '$99, or 1% below starting price' },
      { kind: 'trap', title: 'Why percent changes never cancel', text: 'Because the second percent is applied to a <em>different base</em>. The 10% rise added $10 (to $100); the 10% fall subtracted $11 (from $110). They only look symmetric. <strong>Always multiply the factors: 1.10 × 0.90 = 0.99, which is 99%.</strong> This is one of the most consistent traps on the entire test.' },

      { kind: 'h', text: 'Compound interest (light version)' },
      { kind: 'p', text: 'AR rarely asks for the full compound formula (A = P(1+r)ⁿ). What it will ask: <em>"$1,000 at 10% annual compound interest for 2 years — how much interest?"</em> Compute year by year: Year 1 = 1000 × 1.10 = 1100. Year 2 = 1100 × 1.10 = 1210. Interest = 1210 − 1000 = $210. Simple interest would\'ve given you $200 — the extra $10 is the "interest on interest" that compound adds.' },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════
  // AR — Geometry
  // ═══════════════════════════════════════════════════════════════════════
  {
    slug: 'geometry',
    meta: TOPIC_META_BY_SLUG['geometry'],
    blocks: [
      { kind: 'h', text: 'What this looks like on the ASVAB' },
      { kind: 'p', text: 'Area, perimeter, and volume of the standard shapes: rectangles, triangles, circles, boxes, cylinders. Occasionally polygon angle sums or the Pythagorean theorem. Nothing exotic. What kills people is the memorization gap — if you don\'t have the six formulas locked in, you\'ll waste 90 seconds per question trying to reconstruct them.' },

      { kind: 'h', text: 'The six formulas you must have cold' },
      { kind: 'list', items: [
        'Rectangle: <strong>A = L × W</strong>,  <strong>P = 2L + 2W</strong>',
        'Triangle: <strong>A = ½ × base × height</strong>',
        'Circle: <strong>A = πr²</strong>,  <strong>C = 2πr</strong>  (or πd)',
        'Rectangular prism (box): <strong>V = L × W × H</strong>',
        'Cube: <strong>V = s³</strong>,  <strong>Surface area = 6s²</strong>',
        'Cylinder: <strong>V = πr² × h</strong>',
      ] },

      { kind: 'example', prompt: 'A cube has a volume of 64 cubic inches. What is its surface area?', steps: [
        { label: 'Find the side:',       value: 's³ = 64  →  s = ∛64 = 4 inches' },
        { label: 'Area of one face:',     value: 's² = 16 sq in' },
        { label: 'Total (6 faces):',       value: '6 × 16 = 96 sq in' },
      ], answer: '96 square inches' },

      { kind: 'trap', title: 'The radius-versus-diameter trap', text: 'When a circle question gives you the <em>diameter</em> (e.g., 10 cm), the <strong>radius is 5</strong>, not 10. Plugging the diameter into <span class="mono">πr²</span> gives you an answer 4× too big — and that wrong answer will always be in the choices. Circle "r =" at the top of your scratch work every time.' },

      { kind: 'h', text: 'Polygon interior angle sums' },
      { kind: 'p', text: 'For any polygon with n sides, the interior angles add up to <strong>(n − 2) × 180°</strong>. Triangle: (3−2) × 180 = 180. Quadrilateral: (4−2) × 180 = 360. Hexagon: (6−2) × 180 = 720. Compute (n−2) first, then multiply — that ordering makes the arithmetic quicker and harder to slip on.' },

      { kind: 'h', text: 'Composite shapes' },
      { kind: 'p', text: 'When a shape isn\'t one of the standard six, <strong>break it into pieces that are</strong>. An L-shape is two rectangles. A house-outline pentagon is a square plus a triangle. Compute each piece\'s area, add. There is no ASVAB geometry problem that requires more than the six formulas above once you decompose the shape.' },

      { kind: 'h', text: 'Pythagorean theorem (only when you see a right triangle)' },
      { kind: 'p', text: '<strong>a² + b² = c²</strong>, where c is the hypotenuse (the side opposite the right angle, always the longest side). Two of the three are given; find the third. Memorize the common triples so you can spot them instantly and skip the arithmetic: <strong>3-4-5</strong>, <strong>5-12-13</strong>, <strong>8-15-17</strong>, and any multiple of these (6-8-10, 9-12-15, etc).' },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════
  // AR — Rate & work
  // ═══════════════════════════════════════════════════════════════════════
  {
    slug: 'rate-work',
    meta: TOPIC_META_BY_SLUG['rate-work'],
    blocks: [
      { kind: 'h', text: 'What this looks like on the ASVAB' },
      { kind: 'p', text: 'Any question where <strong>two rates are running at the same time</strong> and you\'re asked how long the combined effort takes. Two workers painting a fence. Two pipes filling a tank while one drains. A printer running while another is turned on halfway through. If you see "per minute," "per hour," or "together," this is the shape.' },

      { kind: 'h', text: 'The core insight' },
      { kind: 'p', text: 'Rates that push the same direction <em>add</em>. Rates that push against each other <em>subtract</em>. Once you have the net rate, the rest is one division: <strong>time = total work ÷ net rate</strong>. Every rate/work question on the AR is a variation of that sentence.' },

      { kind: 'example', prompt: 'A tank fills through one valve at 3 gallons per minute and drains through a second valve at 1 gallon per minute. Both valves are open. How long to fill a 60-gallon tank?', steps: [
        { label: 'Fill rate:',   value: '+3 gal/min' },
        { label: 'Drain rate:',   value: '−1 gal/min',  comment: 'opposing → subtract' },
        { label: 'Net rate:',      value: '+2 gal/min' },
        { label: 'Time:',           value: '60 ÷ 2 = 30 min' },
      ], answer: '30 minutes' },

      { kind: 'trap', title: 'The trap the ASVAB uses here', text: 'The wrong answers will include <span class="mono">20 min</span> (ignoring the drain — 60 ÷ 3), <span class="mono">60 min</span> (treating the drain as if it fully cancels the fill), and <span class="mono">45 min</span> (averaging the rates instead of netting them). If you catch yourself computing 60 ÷ 3, stop — you forgot a valve.' },

      { kind: 'h', text: 'When both workers finish the same job (together-in-time)' },
      { kind: 'p', text: 'Different setup. If Alice does the job in 4 hours and Bob does the same job in 6 hours, don\'t average the times. Add the <em>fractions of the job per hour</em>: <span class="mono">1/4 + 1/6 = 3/12 + 2/12 = 5/12</span> of the job per hour together, so the job takes <span class="mono">12/5 = 2.4 hours</span>. Reflex check: <strong>combined time is always shorter than either alone</strong>. If your answer is 5 hours, you set it up wrong.' },
      { kind: 'note', text: 'Rule of thumb for two workers: the combined time is always <em>less than the faster worker alone</em>. If Alice can do it in 4 hours, together they finish in less than 4. This rule catches the vast majority of setup mistakes without any arithmetic.' },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════
  // AR — Mixture problems
  // ═══════════════════════════════════════════════════════════════════════
  {
    slug: 'mixture',
    meta: TOPIC_META_BY_SLUG['mixture'],
    blocks: [
      { kind: 'h', text: 'What this looks like on the ASVAB' },
      { kind: 'p', text: '<em>"A 25% salt solution is mixed with water to make a 10% salt solution."</em> <em>"An alloy is 40% copper; how much pure copper must be added to a 100 kg batch to make it 60% copper?"</em> Also blending problems: mixing $6/lb coffee with $4/lb coffee to get $5/lb. Same structure every time.' },

      { kind: 'h', text: 'The core insight' },
      { kind: 'p', text: 'Every mixture problem is about <strong>the amount of the "stuff"</strong> (salt, copper, expensive coffee), not about total volume. If a 20-gallon tank is 25% salt, it contains <span class="mono">0.25 × 20 = 5 gallons of pure salt</span>. That number — the salt content — stays constant when you add water and dilute. The concentration changes because the denominator (total volume) grows.' },
      { kind: 'p', text: 'Write the balance: <strong>(concentration × volume)₁ + (concentration × volume)₂ = (final concentration) × (total volume)</strong>. Water is 0% concentration. Pure copper is 100%.' },

      { kind: 'example', prompt: 'How many gallons of water must be added to 20 gallons of a 25% salt solution to make a 10% salt solution?', steps: [
        { label: 'Salt from strong batch:', value: '0.25 × 20 = 5 gal salt' },
        { label: 'Salt from water:',          value: '0 × x = 0' },
        { label: 'Total salt after mixing:',   value: '5 gal' },
        { label: 'Total volume after mixing:',  value: '20 + x' },
        { label: 'Set up:',                      value: '5 = 0.10 × (20 + x)' },
        { label: 'Solve:',                        value: '50 = 20 + x  →  x = 30' },
      ], answer: '30 gallons of water' },

      { kind: 'trap', title: 'The volume trap', text: 'The most common mistake: forgetting that <strong>adding water changes the total volume</strong>. If you keep the denominator at 20 gallons instead of (20 + x), you get x = 30 for the salt amount instead of the water amount, or some other nonsense. Write out the total-volume expression <em>before</em> you set up the equation, every time.' },

      { kind: 'h', text: 'Adding pure "stuff" to strengthen a mixture' },
      { kind: 'p', text: 'Same equation, reversed direction. <em>"How much pure copper must be added to 100 kg of a 40% copper alloy to make it 60% copper?"</em>' },
      { kind: 'example', prompt: 'How many kg of pure copper must be added to 100 kg of 40% copper alloy to make it 60% copper?', steps: [
        { label: 'Copper in original:',  value: '0.40 × 100 = 40 kg' },
        { label: 'Copper added:',          value: '1.00 × x = x kg' },
        { label: 'Set up:',                 value: '(40 + x) = 0.60 × (100 + x)' },
        { label: 'Expand:',                  value: '40 + x = 60 + 0.6x' },
        { label: 'Solve:',                    value: '0.4x = 20  →  x = 50 kg' },
      ], answer: '50 kg of pure copper' },

      { kind: 'h', text: 'Blending at different prices' },
      { kind: 'p', text: 'Same mechanism, dollars instead of concentrations. <em>"Mix $6/lb coffee with $4/lb coffee to get $5/lb — in what ratio?"</em> Since $5 is exactly halfway, it\'s a 1:1 ratio. If the target were $4.50 (closer to the $4 coffee), you\'d need <em>more</em> of the $4. Always sanity-check the direction: <strong>the answer weighs toward the price the target is closer to.</strong>' },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════
  // AR — Unit conversion
  // ═══════════════════════════════════════════════════════════════════════
  {
    slug: 'units',
    meta: TOPIC_META_BY_SLUG['units'],
    blocks: [
      { kind: 'h', text: 'What this looks like on the ASVAB' },
      { kind: 'p', text: 'Straight conversions dressed as word problems. <em>"2.5 tons is how many pounds?"</em> <em>"How many pints in 3 gallons?"</em> <em>"From 9:45 PM Monday to 6:15 AM Tuesday is how long?"</em> Individually trivial; collectively a huge time sink if you don\'t have the reflexes.' },

      { kind: 'h', text: 'The core insight' },
      { kind: 'p', text: 'Unit conversion is memorization plus multiplication. There is no clever technique — you know the ratio or you don\'t. Everything on this topic is downstream of the following list being <strong>burned into your head</strong>:' },
      { kind: 'list', items: [
        '<strong>Length:</strong> 12 in = 1 ft;  3 ft = 1 yd;  5,280 ft = 1 mi;  1 km ≈ 5/8 mile',
        '<strong>Weight:</strong> 16 oz = 1 lb;  2,000 lb = 1 ton',
        '<strong>Volume:</strong> 8 oz = 1 cup;  2 cups = 1 pint;  2 pints = 1 quart;  4 quarts = 1 gallon',
        '<strong>Time:</strong> 60 sec = 1 min;  60 min = 1 hour;  24 hr = 1 day;  7 days = 1 week',
      ] },

      { kind: 'example', prompt: 'How many pints in 3 gallons?', steps: [
        { label: 'Chain the conversions:', value: '1 gal = 4 qt;  1 qt = 2 pt  →  1 gal = 8 pt' },
        { label: 'Multiply:',                value: '3 × 8 = 24 pints' },
      ], answer: '24 pints' },

      { kind: 'trap', title: 'Time-across-midnight arithmetic', text: 'From 9:45 PM Monday to 6:15 AM Tuesday. Not one calculation — two. <strong>9:45 PM → midnight = 2 hr 15 min</strong>. <strong>Midnight → 6:15 AM = 6 hr 15 min</strong>. Sum: 8 hr 30 min. Skipping the midnight split is where the wrong-answer choices come from.' },

      { kind: 'h', text: 'Decimal hours vs hours-and-minutes' },
      { kind: 'p', text: '<strong>3.25 hours is 3 hours 15 minutes</strong>, not 3 hours 25 minutes. To convert decimals to minutes: multiply the decimal part by 60. 0.25 × 60 = 15. 0.75 × 60 = 45. The answer choices on any timing question will include both formats to catch you.' },
      { kind: 'note', text: 'The full drill for reflex: <span class="mono">0.10 hr = 6 min · 0.25 hr = 15 min · 0.33 hr ≈ 20 min · 0.50 hr = 30 min · 0.75 hr = 45 min · 0.90 hr = 54 min</span>. Memorize this row.' },

      { kind: 'h', text: 'When the answer choices include unit variants' },
      { kind: 'p', text: 'The ASVAB\'s favorite distractor on unit questions: the right number in the wrong unit. If the answer is "5 feet," a distractor will say "5 inches." Always write units on your answer before you look at the choices.' },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════
  // WK — Decompose the word
  // ═══════════════════════════════════════════════════════════════════════
  {
    slug: 'wk-decompose',
    meta: TOPIC_META_BY_SLUG['wk-decompose'],
    blocks: [
      { kind: 'p', text: 'You will see words on the ASVAB that you have never seen before. The Word Knowledge section is testing whether you can <strong>reconstruct meaning from parts you do recognize</strong>. Most English words worth testing are built from a Latin or Greek prefix, a root, and a suffix — decoding two of the three usually gets you within one answer choice of the right meaning.' },

      { kind: 'h', text: 'The high-value prefixes' },
      { kind: 'list', items: [
        '<strong>circum-</strong> (around) → circumnavigate, circumvent, circumference',
        '<strong>trans-</strong> (across) → transatlantic, transcribe, translucent',
        '<strong>mal-</strong> (bad) → malicious, malignant, malfeasance',
        '<strong>bene-</strong> (good) → benefit, benevolent, benign',
        '<strong>ante-</strong> (before) → antebellum, antecedent, anterior',
        '<strong>post-</strong> (after) → postscript, posthumous, postpone',
        '<strong>super-</strong> (above) → superficial, superimpose, supersede',
        '<strong>sub-</strong> (below/under) → subordinate, submerge, subterfuge',
      ] },

      { kind: 'h', text: 'How this actually works on a question' },
      { kind: 'p', text: '<em>"Circumvent"</em> — you may not know the word cold. But <strong>circum-</strong> means "around" and the root looks like "vent" (as in advent, prevent — coming or going). So circumvent means "to go around" — and if the choices include <em>avoid</em>, that\'s your answer. This kind of decomposition converts unknown words into 50/50 guesses at worst, and often into confident picks.' },

      { kind: 'note', text: 'Don\'t stop at just the prefix. The high-yield roots (spec = see, dic = say, port = carry, ject = throw) come up over and over and are worth a weekend of memorization on their own.' },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════
  // WK — Context
  // ═══════════════════════════════════════════════════════════════════════
  {
    slug: 'wk-context',
    meta: TOPIC_META_BY_SLUG['wk-context'],
    blocks: [
      { kind: 'p', text: 'Roughly half of Word Knowledge questions are <strong>vocabulary-in-context</strong> — the tested word appears inside a sentence, and you\'re asked what it means <em>as used</em>. If you skip past the sentence and look only at the bolded word, you\'re throwing away the biggest hint the test gives you.' },

      { kind: 'h', text: 'Read the whole sentence, out loud in your head' },
      { kind: 'p', text: 'The sentence context tells you two things the definition alone won\'t: the <strong>part of speech</strong> (noun vs verb vs adjective narrows the answers immediately) and the <strong>connotation</strong> (positive, negative, or neutral). A "notorious" reputation is a bad thing, whatever else the word means; that eliminates any positive-sounding answers on the spot.' },

      { kind: 'example', prompt: 'Example: "The general\'s <strong>ubiquitous</strong> presence at every base ceremony…" What does ubiquitous mean?', steps: [
        { label: 'Part of speech:', value: 'adjective (modifying "presence")' },
        { label: 'Connotation:',      value: 'about frequency / everywhere — every ceremony' },
        { label: 'Likely meaning:',    value: 'present everywhere, ever-present, constant' },
        { label: 'Correct answer:',     value: 'omnipresent / ever-present' },
      ], answer: 'omnipresent — meaning present or found everywhere' },

      { kind: 'note', text: 'When the sentence is short and gives you little context, the strategy shifts back to word decomposition. Context and decomposition are complementary tools — use whichever one the specific question is giving you material for.' },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════
  // WK — Eliminate
  // ═══════════════════════════════════════════════════════════════════════
  {
    slug: 'wk-eliminate',
    meta: TOPIC_META_BY_SLUG['wk-eliminate'],
    blocks: [
      { kind: 'p', text: 'Word Knowledge answer choices are engineered. There\'s almost always <strong>one absurd choice</strong> (obviously wrong on a second look) and <strong>one "near-synonym trap"</strong> (a real word that sounds similar to the answer but means something different). Eliminating those two turns every question into a 50/50 minimum, even on words you don\'t recognize at all.' },

      { kind: 'h', text: 'The two things to look for in the choices' },
      { kind: 'list', items: [
        '<strong>The absurd choice</strong>: a word whose part of speech or connotation is obviously wrong for the sentence. Drop it first.',
        '<strong>The near-synonym trap</strong>: a word that <em>sounds similar</em> to the tested word or that means "the opposite of a common misreading." <em>Precipitous</em> sounds like <em>precious</em>. <em>Enervated</em> sounds like <em>energized</em> — but means the opposite. These traps are the test\'s bread and butter.',
      ] },

      { kind: 'p', text: 'Once those are gone, you\'re left with two — the correct answer and one carefully-chosen distractor. Even a coin flip at that point is 50%, and you\'re usually not flipping a coin because one of the remaining two will feel closer to the sentence\'s tone.' },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════
  // WK — Gut
  // ═══════════════════════════════════════════════════════════════════════
  {
    slug: 'wk-gut',
    meta: TOPIC_META_BY_SLUG['wk-gut'],
    blocks: [
      { kind: 'p', text: 'When you\'ve eliminated the two easy wrong answers and you\'re staring at two options for a word you only half-know, <strong>go with your first instinct</strong> and move on. Every study of standardized-test guessing shows the same thing: first instinct beats overthinking. What overthinking does is talk you out of a right answer to pick a "safer-sounding" wrong one.' },

      { kind: 'h', text: 'The 15-second rule for WK' },
      { kind: 'p', text: 'If a Word Knowledge question is still hanging at 15 seconds, you\'re not going to know it in another 30. Pick the choice that "feels right" from the reduced set and move on. The AR section has questions worth 3+ minutes of your time; WK questions where you don\'t recognize the word are worth 15 seconds, tops. Time saved here is time spent in AR — which is where the points actually are.' },

      { kind: 'note', text: 'On CAT-ASVAB especially: <strong>never leave a WK question blank</strong>. The scoring penalty for a wrong guess is much smaller than the penalty for unanswered items at the end. Commit to something and move.' },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════
  // PC — Question first
  // ═══════════════════════════════════════════════════════════════════════
  {
    slug: 'pc-question-first',
    meta: TOPIC_META_BY_SLUG['pc-question-first'],
    blocks: [
      { kind: 'p', text: 'Paragraph Comprehension shows you a short passage and asks a question about it. The habit most people fall into is reading the passage carefully, then reading the question, then re-reading the passage to find the answer. <strong>Reverse that order.</strong> Read the question first, then skim the passage looking specifically for the thing it asked about. You\'ll finish each question in half the time.' },

      { kind: 'h', text: 'What "read the question first" actually means' },
      { kind: 'p', text: 'When you skim the question, you\'re trying to identify <strong>what kind of information you\'re hunting</strong>. Is it a specific fact (a name, a number, a date)? A main-idea question? A tone question? The answer changes how you read the passage. For a fact question, you\'re scanning; for a main-idea question, you\'re reading the first and last sentences carefully and skimming the middle.' },

      { kind: 'note', text: 'On the paper MET test where you can see the whole page, read <em>only</em> the question first, not the choices. The choices are traps designed after the passage; letting them into your head before you read biases your interpretation.' },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════
  // PC — Passage type
  // ═══════════════════════════════════════════════════════════════════════
  {
    slug: 'pc-passage-type',
    meta: TOPIC_META_BY_SLUG['pc-passage-type'],
    blocks: [
      { kind: 'p', text: 'PC passages come in a small number of predictable shapes. Naming the shape in one word before you dive in tells you what to look for and what kind of questions to expect.' },

      { kind: 'h', text: 'The four shapes you\'ll see' },
      { kind: 'list', items: [
        '<strong>Narrative</strong> — someone did something, in sequence. Questions test order of events and character motivation.',
        '<strong>Argument</strong> — the author has a point and is defending it. Questions test the author\'s conclusion and how the evidence supports it.',
        '<strong>Description</strong> — a factual account of a thing, place, or process. Questions test recall of specific details.',
        '<strong>Explanation</strong> — the passage explains how or why something works. Questions test cause-and-effect and process order.',
      ] },

      { kind: 'p', text: 'You can usually tell from the first sentence. "In 1863, a young officer…" is a narrative. "Despite common belief, X is actually…" is an argument. "The photosynthesis process begins when…" is an explanation. Once you\'ve named the shape, you know what the questions will ask.' },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════
  // PC — Question types
  // ═══════════════════════════════════════════════════════════════════════
  {
    slug: 'pc-question-types',
    meta: TOPIC_META_BY_SLUG['pc-question-types'],
    blocks: [
      { kind: 'p', text: 'Every PC question is one of four types, and each type is trapped in a different way. Learn to spot the type in the first three words of the question and you\'ll dodge most of them.' },

      { kind: 'h', text: '1. Main idea ("The passage is mainly about…")' },
      { kind: 'p', text: 'Wants the <strong>whole passage in one sentence</strong>. The trap: an answer that\'s true but too <em>narrow</em> — a supporting detail dressed up as a main idea. The right answer is always broad enough to include everything the passage said.' },

      { kind: 'h', text: '2. Direct detail ("According to the passage, X…")' },
      { kind: 'p', text: 'The answer is <strong>literally in the passage</strong>. Scan for the keyword and re-read the surrounding sentence. The trap: an answer that\'s <em>true in general</em> but not stated in <em>this</em> passage. "According to the passage" is the giveaway — if the passage doesn\'t say it, it\'s wrong even if it\'s common knowledge.' },

      { kind: 'h', text: '3. Inference ("The passage implies that…" or "Suggests…")' },
      { kind: 'p', text: 'The answer is <em>not directly stated</em> but is <strong>strongly supported</strong> by what is. The trap: an answer that\'s a bigger leap than the passage justifies. Correct inference answers are always cautious — one small step past what\'s literally written, not two or three steps.' },

      { kind: 'h', text: '4. Tone / attitude ("The author\'s tone is…")' },
      { kind: 'p', text: 'What the author <em>feels</em> about the subject — enthusiastic, skeptical, neutral, disapproving. The trap: extreme adjectives (<em>outraged</em>, <em>ecstatic</em>) when the passage was only mildly negative or positive. ASVAB tone answers skew toward moderate words. If two choices are moderate and two are extreme, the answer is almost always one of the moderates.' },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════
  // Test day — Format
  // ═══════════════════════════════════════════════════════════════════════
  {
    slug: 'td-format',
    meta: TOPIC_META_BY_SLUG['td-format'],
    blocks: [
      { kind: 'p', text: 'There are two versions of the ASVAB and their pacing is <strong>wildly different</strong>. Training against the wrong clock is one of the most common ways to underperform on test day. Find out which one you\'re taking, <em>this week</em>, from your recruiter — don\'t guess.' },

      { kind: 'h', text: 'CAT-ASVAB (at MEPS)' },
      { kind: 'p', text: 'The <strong>computer-adaptive</strong> version. About 16 AR questions in <strong>39 minutes</strong> — that\'s about 3:42 per question, which is generous. Adaptive means the questions get harder when you\'re getting them right and easier when you\'re missing. <strong>You cannot skip questions and you cannot go back to change an answer</strong>. Commit and move on.' },

      { kind: 'h', text: 'Paper MET (at satellite sites)' },
      { kind: 'p', text: 'Non-adaptive paper test. 30 AR questions in <strong>36 minutes</strong> — that\'s 72 seconds per question. Same content, three times faster pacing. You <em>can</em> skip and come back, but there\'s little time for it. Whoever is training against 3:42 per question is going to run out of time here.' },

      { kind: 'note', text: 'The single biggest question to ask your recruiter this week: <strong>"Am I taking CAT at MEPS or paper at a MET site?"</strong> The answer changes how you train every day between now and test day. Set the timer in this app to match.' },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════
  // Test day — Eliminate
  // ═══════════════════════════════════════════════════════════════════════
  {
    slug: 'td-eliminate',
    meta: TOPIC_META_BY_SLUG['td-eliminate'],
    blocks: [
      { kind: 'p', text: 'On CAT-ASVAB, <strong>never leave a question blank</strong>. The adaptive engine penalizes unanswered items at the end of the section more than it penalizes wrong answers throughout. Getting the last five questions wrong is much better than leaving them blank.' },

      { kind: 'h', text: 'The elimination technique' },
      { kind: 'p', text: 'When you\'re stuck, don\'t guess blindly. <strong>Cross out the two most obviously wrong choices first</strong>, then pick the better of the remaining two. A 50/50 educated guess is 50% right. A blind 1-of-4 is 25% right. Doubling your odds by eliminating two choices matters enormously when it happens 5–10 times per section.' },

      { kind: 'h', text: 'What "obviously wrong" looks like on AR' },
      { kind: 'list', items: [
        '<strong>Order-of-magnitude wrong</strong>: if the problem is about $80 discounted 15%, the discount can\'t be $120 or $1.20. Cross both.',
        '<strong>Wrong sign</strong>: if the price goes up, the answer isn\'t less than the original price. Cross the smaller options.',
        '<strong>Wrong unit</strong>: if the question asks for hours and one choice is in minutes, that\'s a trap. Cross it.',
      ] },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════
  // Test day — PiCAT
  // ═══════════════════════════════════════════════════════════════════════
  {
    slug: 'td-picat',
    meta: TOPIC_META_BY_SLUG['td-picat'],
    blocks: [
      { kind: 'p', text: '<strong>PiCAT is the same item bank as the CAT-ASVAB, taken at home, un-timed, for practice.</strong> Your recruiter can order it for you. It\'s the closest thing to a real diagnostic you can get without going to MEPS.' },

      { kind: 'h', text: 'Why to take it' },
      { kind: 'p', text: 'A practice test from a study book is a proxy. The PiCAT is <em>the actual test</em>. Score you get on the PiCAT is a very good predictor of the score you\'ll get at MEPS — much better than any practice book estimate. If you score above your target on the PiCAT, you have a real cushion. If you don\'t, you know exactly what you\'re working with.' },

      { kind: 'h', text: 'How to ask for it' },
      { kind: 'p', text: 'Say to your recruiter, by name: <strong>"Can I take the PiCAT before I schedule MEPS?"</strong> Most recruiters can order one; some are hesitant because a low PiCAT score triggers a verification test at MEPS. That\'s not a reason to avoid it — it\'s a reason to <strong>only take MEPS when your practice scores are consistently above your target</strong>.' },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════
  // Test day — Logistics
  // ═══════════════════════════════════════════════════════════════════════
  {
    slug: 'td-logistics',
    meta: TOPIC_META_BY_SLUG['td-logistics'],
    blocks: [
      { kind: 'p', text: 'You will be at MEPS for <strong>4 to 6 hours</strong>. The ASVAB is only the first part; there\'s a medical, paperwork, and waiting between everything. The logistical stuff below costs no additional prep and will cost you real points if you skip it.' },

      { kind: 'h', text: 'The night before' },
      { kind: 'list', items: [
        '<strong>Sleep the full night.</strong> 7–8 hours. Do not cram — every hour of sleep you cost yourself is worth more GT points than the material you\'d review anyway.',
        '<strong>Lay out your ID and paperwork.</strong> Whatever your recruiter told you to bring — set it by the door the night before.',
        '<strong>Don\'t drink alcohol.</strong> They may screen for it. Even if they don\'t, hangover-adjacent cognition costs you 5–10 GT points easily.',
      ] },

      { kind: 'h', text: 'The morning of' },
      { kind: 'list', items: [
        '<strong>Eat.</strong> Real breakfast — protein, carbs, some fat. You cannot recover from a hunger crash in the middle of the test.',
        '<strong>Hydrate, but don\'t overshoot.</strong> Water is required for cognition, but you don\'t want to be desperately searching for a bathroom during a section.',
        '<strong>Skip the second coffee.</strong> One is fine if you\'re used to it. A caffeine tremor makes you second-guess everything.',
        '<strong>Arrive 30 minutes early.</strong> Traffic, parking, security — buffer them all. Being late to MEPS reschedules the whole thing.',
      ] },

      { kind: 'note', text: 'One more thing: <strong>bring a book or something to occupy you during downtime</strong>. There will be hours of waiting. If you\'re bored and unstimulated by the time you start the test, you\'ll perform worse. Save the test itself for a rested, engaged brain.' },
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────────
// Lookup helpers
// ─────────────────────────────────────────────────────────────────────────

export const LESSON_BY_SLUG = Object.fromEntries(LESSONS.map(l => [l.slug, l])) as Record<string, Lesson>;

import type { ARTopicSlug, VerbalTopicSlug, TestDayTopicSlug } from './lesson-types';

// Narrow-typed section slices so callers get precise slug types back.
export const AR_TOPICS = TOPIC_META
  .filter(m => m.section === 'ar')
  .sort((a, b) => a.order - b.order) as (TopicMeta & { slug: ARTopicSlug })[];
export const WK_TOPICS = TOPIC_META
  .filter(m => m.section === 'wk')
  .sort((a, b) => a.order - b.order) as (TopicMeta & { slug: VerbalTopicSlug })[];
export const PC_TOPICS = TOPIC_META
  .filter(m => m.section === 'pc')
  .sort((a, b) => a.order - b.order) as (TopicMeta & { slug: VerbalTopicSlug })[];
export const TEST_DAY_TOPICS = TOPIC_META
  .filter(m => m.section === 'test-day')
  .sort((a, b) => a.order - b.order) as (TopicMeta & { slug: TestDayTopicSlug })[];
