// Lesson data model for the Study curriculum.
// Content lives in ./lessons-content.ts; pages render via ./lessons/[slug]/page.tsx.

// Eleven AR topics ordered foundation → advanced. These are the only topics
// the curriculum overview surfaces; MK-flavored questions get mapped onto
// their nearest AR neighbor for drill purposes, since GT is VE + AR only.
export type ARTopicSlug =
  | 'fractions'      // fractions & decimals — the foundation
  | 'averages'       // simple / weighted mean, missing value
  | 'percentages'    // three types: find part, find whole, find rate
  | 'ratios'         // ratios, proportions, scale
  | 'algebra-word'   // translating sentences to equations
  | 'distance'       // distance = rate × time (meeting/opposing)
  | 'interest'       // simple & compound; percent change chains
  | 'geometry'       // area, perimeter, volume, angles
  | 'rate-work'      // combined rates: adding, subtracting, together
  | 'mixture'        // concentration × volume balancing
  | 'units';         // imperial + time conversions under pressure

export type VerbalTopicSlug =
  | 'wk-decompose' | 'wk-context' | 'wk-eliminate' | 'wk-gut'
  | 'pc-question-first' | 'pc-passage-type' | 'pc-question-types';

export type TestDayTopicSlug =
  | 'td-format' | 'td-eliminate' | 'td-picat' | 'td-logistics';

export type TopicSlug = ARTopicSlug | VerbalTopicSlug | TestDayTopicSlug;

// One line about what this topic looks like on the test, shown on cards.
export type TopicMeta = {
  slug: TopicSlug;
  title: string;
  subtitle: string;             // one-liner shown on the curriculum card
  section: 'ar' | 'wk' | 'pc' | 'test-day';
  order: number;                // display order within its section
  minutes: number;              // estimated read time for the lesson
  petersonRef?: string;         // e.g. "Mod 4.3"
};

// A lesson is a sequence of typed blocks. Rendering is switched on `kind`.
export type LessonBlock =
  | { kind: 'p'; text: string }                    // paragraph; may contain <strong>/<em> markers
  | { kind: 'h'; text: string }                    // sub-heading in the flow ("What this looks like…")
  | { kind: 'example'; prompt: string; steps: WorkedStep[]; answer: string }
  | { kind: 'trap'; title?: string; text: string }
  | { kind: 'note'; text: string }                 // side-note / rule-of-thumb, muted
  | { kind: 'list'; items: string[]; ordered?: boolean };

export type WorkedStep = {
  label: string;         // "Fill rate:" — left column
  value: string;         // "+3 gal/min" — right column
  comment?: string;      // italic aside — "opposing → subtract"
};

export type Lesson = {
  slug: TopicSlug;
  meta: TopicMeta;
  blocks: LessonBlock[];
};
