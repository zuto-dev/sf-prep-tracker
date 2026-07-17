import Link from 'next/link';
import { Nav } from '../components/Nav';

const phases = [
  {
    window: 'D-12 months · Identification',
    title: 'Know the candidate you are today',
    accent: 'blue',
    objective: 'Create an honest starting profile before selecting a program.',
    actions: [
      'Baseline run, ruck, strength, body-composition, recovery, and mobility profile.',
      'Name the highest-cost weaknesses: endurance, strength, body composition, coordination, navigation, or communication.',
      'Ask a trusted person for direct feedback on character and team behaviors; pick one behavior to practice weekly.',
      'Create a realistic calendar, nutrition direction, and skill-learning plan—do not start perpetual selection prep.',
    ],
    gate: 'You can state your primary physical weakness, one character behavior to improve, and the next 90-day plan.',
  },
  {
    window: 'D-12 to D-9 months · General physical preparedness',
    title: 'Build the engine without breaking it',
    accent: 'emerald',
    objective: 'Develop aerobic capacity, durable strength, movement quality, and sustainable lifestyle habits.',
    actions: [
      'Run 2–3 days each week; use low-impact conditioning to add aerobic volume without forcing impact.',
      'Strength train 3–4 days each week with full-body or upper/lower work; build what is genuinely missing.',
      'Ruck infrequently and walk-only; develop tolerance gradually rather than chase ruck times early.',
      'Resolve body-composition changes early so the final block can prioritize performance fueling.',
    ],
    gate: 'Training is repeatable, sleep and nutrition are stable, and your body is handling weekly volume without recurring flare-ups.',
  },
  {
    window: 'D-9 to D-6 months · Add speed and durable capacity',
    title: 'Turn a base into usable pace',
    accent: 'cyan',
    objective: 'Keep the aerobic base while gradually introducing faster running and more deliberate ruck practice.',
    actions: [
      'Use strides, pickups, or controlled hills before hard interval volume; speed exposure is not all-out sprinting.',
      'Shift lifting toward 3 focused sessions if endurance demand is rising; keep cross-training at least weekly.',
      'Ruck about every other week and prioritize fast, controlled walking mechanics—not ruck running.',
      'Journal training, recovery, and interpersonal pressure points; reassess the weak links identified in Phase 1.',
    ],
    gate: 'You can touch faster paces without injury, recover between sessions, and walk efficiently under load.',
  },
  {
    window: 'D-6 to D-3 months · Selection-specific transition',
    title: 'Make strength transferable',
    accent: 'amber',
    objective: 'Solidify running standards, maintain strength, and introduce work capacity that resembles selection demands.',
    actions: [
      'Run 3–4 days weekly as appropriate: tempo/repeats plus easy aerobic work; avoid trying to create a running base late.',
      'Use 2–3 efficient strength sessions and a weekly carry/sled/drag/strongman-style capacity session.',
      'Ruck weekly, walk hard, and only introduce brief controlled trots if your base and mechanics support them.',
      'Begin regular land-navigation practice through qualified instruction, orientering, or supervised field work.',
    ],
    gate: 'You have a reliable fast walking pace, no major running gap, and a practiced approach to navigation and team-style work.',
  },
  {
    window: 'D-3 months to D-10 days · Selection prep',
    title: 'Bias toward ruck endurance and execution',
    accent: 'orange',
    objective: 'Convert broad fitness into selection-specific endurance while protecting durability and decision quality.',
    actions: [
      'Use 2–3 rucks weekly as appropriate, while keeping intentional run quality and avoiding junk volume.',
      'Put strength in maintenance mode: two focused full-body sessions plus calisthenics/carry work.',
      'Fuel hard sessions, hydrate, sleep, and remove avoidable schedule friction so training quality stays high.',
      'Practice land navigation and operational habits; reduce distractions without abandoning family, work, or support systems.',
    ],
    gate: 'Your training is specific, your ruck/run plan is recoverable, and no single weakness is being ignored.',
  },
  {
    window: 'D-10 days to game time · Taper',
    title: 'Arrive fresh, not frantic',
    accent: 'rose',
    objective: 'Reduce fatigue while keeping familiar movement, sleep, nutrition, and stress-management routines.',
    actions: [
      'Cut training volume first; keep only small, familiar touches of pace, calisthenics, and load exposure.',
      'Do not introduce new footwear, mobility routines, diets, supplements, or training “hacks.”',
      'Prioritize sleep, simple familiar foods, calm routines, and outside-stress reduction.',
      'Expect doubt; do not answer anxiety with last-minute testing or extra fatigue.',
    ],
    gate: 'You feel rested, healthy, prepared, and you are following a known routine—not chasing last-minute fitness.',
  },
] as const;

const colorMap = {
  blue: 'border-blue-500/30 bg-blue-500/5 text-blue-300',
  emerald: 'border-emerald-500/30 bg-emerald-500/5 text-emerald-300',
  cyan: 'border-cyan-500/30 bg-cyan-500/5 text-cyan-300',
  amber: 'border-amber-500/30 bg-amber-500/5 text-amber-300',
  orange: 'border-orange-500/30 bg-orange-500/5 text-orange-300',
  rose: 'border-rose-500/30 bg-rose-500/5 text-rose-300',
};

export default function RoadmapPage() {
  return (
    <main>
      <Nav />
      <section className="mb-8 overflow-hidden rounded-3xl border border-emerald-500/20 bg-gradient-to-br from-emerald-950/60 via-gray-950 to-gray-900 p-6 shadow-2xl md:p-9">
        <p className="font-mono text-xs font-bold uppercase tracking-[0.22em] text-emerald-300">SFAS ROADMAP · 12 MONTHS</p>
        <h2 className="mt-3 max-w-3xl text-3xl font-black tracking-tight text-white md:text-5xl">Build capacity first. Make it specific later. Arrive fresh.</h2>
        <p className="mt-4 max-w-3xl text-sm leading-6 text-gray-300 md:text-base">A phased roadmap adapted from the Terminator Training Method’s one-year SFAS framework. Use it as a planning layer over Plan-D—not as a substitute for medical, coaching, or command guidance.</p>
        <div className="mt-6 flex flex-wrap gap-3 text-xs font-mono">
          <a className="rounded-lg border border-gray-700 bg-gray-900/70 px-3 py-2 text-gray-200 hover:border-emerald-400" href="https://www.youtube.com/watch?v=qSnwbIhJu2c" target="_blank" rel="noreferrer">SOURCE EPISODE ↗</a>
          <Link className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-emerald-300 hover:bg-emerald-500/20" href="/calendar">OPEN CALENDAR →</Link>
          <Link className="rounded-lg border border-gray-700 bg-gray-900/70 px-3 py-2 text-gray-200 hover:border-emerald-400" href="/standards">CHECK STANDARDS →</Link>
        </div>
      </section>

      <section className="space-y-4">
        {phases.map((phase, index) => (
          <article key={phase.window} className="relative overflow-hidden rounded-2xl border border-gray-800 bg-gray-900/60 p-5 shadow-xl md:p-6">
            <div className="absolute left-0 top-0 h-full w-1 bg-emerald-400/60" />
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div className="max-w-3xl">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-xs text-gray-500">0{index + 1}</span>
                  <span className={`rounded-full border px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-wider ${colorMap[phase.accent]}`}>{phase.window}</span>
                </div>
                <h3 className="mt-3 text-xl font-bold text-white md:text-2xl">{phase.title}</h3>
                <p className="mt-2 text-sm text-gray-400">{phase.objective}</p>
              </div>
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 text-xs text-emerald-100 md:w-72"><span className="font-mono font-bold text-emerald-400">READINESS GATE</span><p className="mt-1 leading-5">{phase.gate}</p></div>
            </div>
            <ul className="mt-5 grid gap-2 md:grid-cols-2">
              {phase.actions.map(action => <li key={action} className="rounded-xl border border-gray-800 bg-gray-950/50 px-3 py-2.5 text-sm leading-5 text-gray-300">✓ {action}</li>)}
            </ul>
          </article>
        ))}
      </section>
    </main>
  );
}
