import { NextResponse } from 'next/server';
import { readFile, readdir } from 'fs/promises';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), '.data');
const SOURCES_DIR = path.join(DATA_DIR, 'notebooklm-sources');
const POINTER = path.join(DATA_DIR, 'notebooklm-pointer.json');

// The 12-topic series (mirror of notebooklm_episode.py) so the page can show
// upcoming/locked episodes even before their source doc is generated.
const TOPICS = [
  'GT mechanics — why AR is your only lever',
  'Estimate vs. calculate — read the choices first',
  'Translating word problems: rate/time/distance & work',
  'Percent problems — the three types',
  'Fractions, decimals, ratios — the mental models',
  'Rucking fundamentals — pace, weight, programming, injury prevention',
  'Land navigation basics — map, compass, terrain association',
  'The 18X pipeline — OSUT → Airborne → SFAS → Q Course',
  'SFAS — what happens and how you\u2019re evaluated',
  'Mental toughness for selection',
  'Recovery — sleep, nutrition, deload for two-a-days',
  'Time management — ASVAB study + PT + life',
];

export async function GET() {
  let nextPtr = 1;
  try {
    const p = JSON.parse(await readFile(POINTER, 'utf8'));
    nextPtr = typeof p.next === 'number' ? p.next : 1;
  } catch { /* no pointer yet */ }

  // Map generated source files by episode number (filename: episode-NN-*.md).
  const filesByEp: Record<number, { file: string; path: string }> = {};
  try {
    const files = await readdir(SOURCES_DIR);
    for (const f of files) {
      const m = f.match(/^episode-(\d+)/i);
      if (m) filesByEp[parseInt(m[1], 10)] = { file: f, path: path.join(SOURCES_DIR, f) };
    }
  } catch { /* dir not created yet */ }

  const episodes = TOPICS.map((title, i) => {
    const n = i + 1;
    const gen = filesByEp[n];
    return {
      n,
      title,
      status: gen ? 'ready' : (n < nextPtr ? 'ready' : n === nextPtr ? 'next' : 'locked'),
      file: gen?.file ?? null,
      path: gen?.path ?? null,
    };
  });

  return NextResponse.json({ episodes, nextPtr, total: TOPICS.length });
}
