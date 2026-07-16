'use client';

import { useEffect, useState } from 'react';
import { pullSfprepSync, pushSfprepSync } from '../lib/sfprep-sync';

type Sup = {
  id: string;
  name: string;
  dose: string;
  tier: 'buy' | 'optional';
  when: string;
  note?: string;
};

const CATALOG: Sup[] = [
  { id: 'whey',       name: 'Whey protein',        dose: '1.5 scoops',       tier: 'buy',      when: 'post-workout',            note: 'Closes daily protein gap. Not really a "supp" — food.' },
  { id: 'creatine',   name: 'Creatine monohydrate', dose: '5 g',              tier: 'buy',      when: 'any time (consistency)',  note: 'Best-proven supp in existence. Plain monohydrate only.' },
  { id: 'electro',    name: 'Electrolytes',        dose: '1 packet',         tier: 'buy',      when: 'soaked-shirt days + pre-Sat run', note: 'FL summer. 2% dehydration = measurable run-time loss.' },
  { id: 'd3',         name: 'Vitamin D3',          dose: '2,000 IU',         tier: 'buy',      when: 'daily w/ meal',           note: 'Bone loading + recovery insurance.' },
  { id: 'fishoil',    name: 'Fish oil',            dose: '1–2 g EPA/DHA',    tier: 'optional', when: 'daily w/ meal',           note: 'Joint insurance under rising ruck volume.' },
  { id: 'magnesium',  name: 'Magnesium glycinate', dose: '200–400 mg',       tier: 'optional', when: '30 min before bed',       note: 'ONLY if sleep is rough. Sleep is the #1 recovery drug.' },
];

const KEY = 'sfprep:sups';
type LogState = Record<string, Record<string, boolean>>;

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function daysAgo(n: number) {
  const d = new Date(); d.setDate(d.getDate() - n);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function load(): LogState {
  if (typeof window === 'undefined') return {};
  try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { return {}; }
}
function save(s: LogState) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(KEY, JSON.stringify(s));
  void pushSfprepSync();
}

export function SupsLog() {
  const [state, setState] = useState<LogState>({});
  const day = todayKey();

  useEffect(() => {
    void pullSfprepSync().finally(() => setState(load()));
  }, []);

  const toggle = (id: string) => {
    const dayState = { ...(state[day] || {}) };
    dayState[id] = !dayState[id];
    const next = { ...state, [day]: dayState };
    setState(next);
    save(next);
  };

  const takenToday = state[day] || {};
  const buyTier = CATALOG.filter(s => s.tier === 'buy');
  const buyCount = buyTier.filter(s => takenToday[s.id]).length;

  const compliance = (id: string) => {
    let hit = 0;
    for (let i = 0; i < 30; i++) if (state[daysAgo(i)]?.[id]) hit++;
    return Math.round((hit / 30) * 100);
  };
  const creatineStreak = (() => {
    let n = 0;
    for (let i = 0; i < 365; i++) {
      if (state[daysAgo(i)]?.creatine) n++; else if (i > 0) break;
    }
    return n;
  })();

  const Row = ({ sup, accent }: { sup: Sup; accent: 'buy' | 'optional' }) => {
    const taken = !!takenToday[sup.id];
    const pct = compliance(sup.id);
    const takenCls = accent === 'buy'
      ? 'bg-emerald-900/20 border-emerald-800'
      : 'bg-blue-900/20 border-blue-800';
    return (
      <label className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition ${
        taken ? takenCls : 'bg-gray-800/60 border-gray-700 hover:border-gray-600'
      }`}>
        <input type="checkbox" checked={taken} onChange={() => toggle(sup.id)} className="mt-1 w-4 h-4" />
        <div className="flex-1">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className={`font-semibold text-sm ${taken ? 'text-gray-400 line-through' : 'text-gray-100'}`}>
              {sup.name} <span className="text-gray-500 font-normal">· {sup.dose}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-500">{sup.when}</span>
              <span className={`text-xs font-mono px-2 py-0.5 rounded ${
                accent === 'optional' ? 'bg-gray-700 text-gray-400' :
                pct >= 80 ? 'bg-emerald-900/50 text-emerald-300' :
                pct >= 50 ? 'bg-amber-900/50 text-amber-300' :
                'bg-red-900/40 text-red-300'
              }`}>{pct}% / 30d</span>
            </div>
          </div>
          {sup.note && <div className="text-xs text-gray-400 mt-1">{sup.note}</div>}
        </div>
      </label>
    );
  };

  return (
    <div className="bg-gray-800 rounded-lg p-4 mt-6">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <h2 className="text-lg font-semibold text-gray-100">Supplements</h2>
        <div className="text-xs text-gray-400">
          <span className="text-emerald-400">{buyCount}/{buyTier.length} core today</span>
          {creatineStreak > 0 && <span className="ml-3 text-amber-400">🔥 creatine {creatineStreak}d</span>}
        </div>
      </div>

      <div className="text-xs text-gray-400 mb-3">
        Only 4 things worth buying. Consistency &gt; dose &gt; timing.
      </div>

      <div className="text-xs uppercase tracking-wide text-gray-500 mb-2 mt-2">Worth it</div>
      <div className="space-y-2 mb-4">
        {CATALOG.filter(s => s.tier === 'buy').map(sup => <Row key={sup.id} sup={sup} accent="buy" />)}
      </div>

      <div className="text-xs uppercase tracking-wide text-gray-500 mb-2">Optional</div>
      <div className="space-y-2 mb-4">
        {CATALOG.filter(s => s.tier === 'optional').map(sup => <Row key={sup.id} sup={sup} accent="optional" />)}
      </div>

      <details className="text-xs text-gray-500">
        <summary className="cursor-pointer text-gray-400 hover:text-gray-300">Skip — marketing tax</summary>
        <div className="mt-2 text-gray-500">
          Pre-workout (coffee + banana does the same) · BCAAs (pointless at 145g+ protein) · test boosters · greens powders · mass gainers · &quot;recovery&quot; blends · anything with a proprietary blend.
        </div>
      </details>
    </div>
  );
}
