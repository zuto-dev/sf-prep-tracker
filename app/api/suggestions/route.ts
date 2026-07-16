import { NextResponse } from 'next/server';
import { readFile, writeFile, mkdir, rename } from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';

const DATA_DIR = path.join(process.cwd(), '.data');
const DATA_FILE = path.join(DATA_DIR, 'research-suggestions.json');
const TMP_FILE = path.join(DATA_DIR, 'research-suggestions.json.tmp');
const PATCH_FILE = path.join(DATA_DIR, 'plan-d-patches.json');
const PATCH_TMP = path.join(DATA_DIR, 'plan-d-patches.json.tmp');

type Status = 'pending' | 'accepted' | 'rejected';

type Suggestion = {
  id: string;
  title: string;
  description: string;
  source?: string;
  category?: string; // 'run' | 'ruck' | 'strength' | 'nutrition' | 'recovery' | 'other'
  action?: string;   // human-readable "what would change" — v1 is descriptive, not auto-applied
  status: Status;
  created_at: string;
  decided_at?: string;
};

type Store = { suggestions: Suggestion[] };

async function readStore(): Promise<Store> {
  try {
    const raw = await readFile(DATA_FILE, 'utf8');
    const parsed = JSON.parse(raw) as Store;
    if (parsed && Array.isArray(parsed.suggestions)) return parsed;
    return { suggestions: [] };
  } catch {
    return { suggestions: [] };
  }
}

async function writeStore(store: Store) {
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(TMP_FILE, JSON.stringify(store, null, 2), 'utf8');
  await rename(TMP_FILE, DATA_FILE);
}

// GET — list suggestions (newest first). Optional ?status=pending and ?category=nutrition filters.
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const category = searchParams.get('category');
    const store = await readStore();
    let list = [...store.suggestions].sort((a, b) => b.created_at.localeCompare(a.created_at));
    if (status) list = list.filter((s) => s.status === status);
    if (category) list = list.filter((s) => (s.category || 'other') === category);
    return NextResponse.json({ suggestions: list });
  } catch (error) {
    return NextResponse.json({ suggestions: [], error: String(error) }, { status: 500 });
  }
}

// POST — research crons push new findings. Dedupes on title+description.
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Partial<Suggestion> | { suggestions?: Partial<Suggestion>[] };
    const incoming: Partial<Suggestion>[] = Array.isArray((body as { suggestions?: Partial<Suggestion>[] }).suggestions)
      ? (body as { suggestions: Partial<Suggestion>[] }).suggestions
      : [body as Partial<Suggestion>];

    const VALID_CATEGORIES = new Set(['run', 'ruck', 'strength', 'nutrition', 'recovery', 'other']);
    const store = await readStore();
    let added = 0;
    for (const item of incoming) {
      const title = typeof item.title === 'string' ? item.title.trim() : '';
      const description = typeof item.description === 'string' ? item.description.trim() : '';
      if (!title || !description) continue;
      // Cap field sizes to prevent storage-space overflow from a runaway cron.
      if (title.length > 300 || description.length > 4000) continue;
      const dup = store.suggestions.some(
        (s) => s.title === title && s.description === description && s.status === 'pending',
      );
      if (dup) continue;
      const rawCategory = item.category ? String(item.category).toLowerCase() : 'other';
      store.suggestions.push({
        id: randomUUID(),
        title,
        description,
        source: item.source ? String(item.source).slice(0, 500) : undefined,
        category: VALID_CATEGORIES.has(rawCategory) ? rawCategory : 'other',
        action: item.action ? String(item.action).slice(0, 1000) : undefined,
        status: 'pending',
        created_at: new Date().toISOString(),
      });
      added++;
    }
    await writeStore(store);
    return NextResponse.json({ ok: true, added, total: store.suggestions.length });
  } catch (error) {
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
  }
}

// PATCH — approve or reject a suggestion. { id, action: 'approve' | 'reject' }
export async function PATCH(req: Request) {
  try {
    const body = (await req.json()) as { id?: string; action?: 'approve' | 'reject' };
    if (!body.id || (body.action !== 'approve' && body.action !== 'reject')) {
      return NextResponse.json({ ok: false, error: 'need id + action (approve|reject)' }, { status: 400 });
    }
    const store = await readStore();
    const s = store.suggestions.find((x) => x.id === body.id);
    if (!s) return NextResponse.json({ ok: false, error: 'not found' }, { status: 404 });
    s.status = body.action === 'approve' ? 'accepted' : 'rejected';
    s.decided_at = new Date().toISOString();
    await writeStore(store);

    // On approve, also append to the Plan D patch registry so the change
    // surfaces as an "Active Adjustment" on the Workouts page.
    if (body.action === 'approve') {
      try {
        let reg: { patches: Array<Record<string, unknown>> } = { patches: [] };
        try {
          const raw = await readFile(PATCH_FILE, 'utf8');
          const parsed = JSON.parse(raw);
          if (parsed && Array.isArray(parsed.patches)) reg = parsed;
        } catch { /* no registry yet */ }
        const already = reg.patches.some((p) => p.id === s.id);
        if (!already) {
          reg.patches.push({
            id: s.id,
            title: s.title,
            action: s.action || s.description,
            category: s.category || 'other',
            source: s.source,
            approved_at: s.decided_at,
          });
          await mkdir(DATA_DIR, { recursive: true });
          await writeFile(PATCH_TMP, JSON.stringify(reg, null, 2), 'utf8');
          await rename(PATCH_TMP, PATCH_FILE);
        }
      } catch { /* registry write is best-effort; approval already saved */ }
    }

    return NextResponse.json({ ok: true, id: s.id, status: s.status });
  } catch (error) {
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
  }
}
