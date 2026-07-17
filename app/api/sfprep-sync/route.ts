import { NextResponse } from 'next/server';
import { readFile, writeFile, mkdir, rename } from 'fs/promises';
import path from 'path';
import { SyncPayloadSchema, resolveConflicts, type SyncDelta } from '../../lib/sfprep-sync';
import { mergeLegacySnapshot, type LegacySyncState } from '../../lib/sync-migration';

const DATA_DIR = path.join(process.cwd(), '.data');
const DATA_FILE = path.join(DATA_DIR, 'sfprep-sync.json');
const TMP_FILE = path.join(DATA_DIR, 'sfprep-sync.json.tmp');
const LEGACY_SYNC_FILE = path.join(process.cwd(), 'data', 'sync-state.json');

// Server-side store shape: one resolved delta per key (this file stands in
// for the `sync_deltas` Postgres table from Blueprint SECTION 1.3 until a
// Supabase project is wired into this app — see sfprep-sync.ts header note).
type DeltaStore = Record<string, SyncDelta>;

async function readStore(): Promise<DeltaStore> {
  try {
    const raw = await readFile(DATA_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    // Migration shim: pre-CRDT store was Record<string,string> (raw snapshot).
    // Detect and upgrade in-memory so old data isn't lost/rejected.
    const first = Object.values(parsed)[0] as unknown;
    if (first !== undefined && (typeof first === 'string')) {
      const now = new Date().toISOString();
      const migrated: DeltaStore = {};
      for (const [key, value] of Object.entries(parsed as Record<string, string>)) {
        migrated[key] = { key, value, version: 1, clientUpdatedAt: now };
      }
      return migrated;
    }
    return parsed as DeltaStore;
  } catch {
    return {};
  }
}

async function writeStore(store: DeltaStore) {
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(TMP_FILE, JSON.stringify(store, null, 2), 'utf8');
  await rename(TMP_FILE, DATA_FILE);
}

async function readLegacyState(): Promise<LegacySyncState> {
  try {
    const raw = await readFile(LEGACY_SYNC_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed as LegacySyncState : {};
  } catch {
    return {};
  }
}

async function readStoreWithLegacyMigration(): Promise<DeltaStore> {
  const current = await readStore();
  const legacy = await readLegacyState();
  const migrated = mergeLegacySnapshot(current, legacy, new Date().toISOString());
  if (migrated.migratedKeys.length > 0) await writeStore(migrated.store);
  return migrated.store;
}

function toSnapshot(store: DeltaStore): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, delta] of Object.entries(store)) out[key] = delta.value;
  return out;
}

export async function GET() {
  try {
    const store = await readStoreWithLegacyMigration();
    return NextResponse.json({
      snapshot: toSnapshot(store),
      deltas: Object.values(store),
    });
  } catch (error) {
    return NextResponse.json({ snapshot: {}, deltas: [], error: String(error) }, { status: 500 });
  }
}

// Deep-merge the sfprep:study key so a stale browser copy can't wipe
// server-seeded data (error log, diagnostic scores). For that one key we
// union errorLog by id and keep whichever scalar side has a real value.
// This runs AFTER LWW conflict resolution decides study's key/value/version
// winner, then patches the winning value's contents (not the version) so
// a genuinely stale write still can't nuke server-only diagnostic fields.
function mergeStudy(currentRaw: string | undefined, incomingRaw: string | undefined): string | undefined {
  if (!currentRaw) return incomingRaw;
  if (!incomingRaw) return currentRaw;
  try {
    const cur = JSON.parse(currentRaw);
    const inc = JSON.parse(incomingRaw);
    const byId = new Map<string, unknown>();
    for (const e of (inc.errorLog || [])) if (e && e.id) byId.set(e.id, e);
    for (const e of (cur.errorLog || [])) if (e && e.id) byId.set(e.id, e);
    const merged = {
      ...inc,
      ...cur,
      done: { ...(inc.done || {}), ...(cur.done || {}) },
      weekLog: { ...(inc.weekLog || {}), ...(cur.weekLog || {}) },
      masteryChecks: { ...(inc.masteryChecks || {}), ...(cur.masteryChecks || {}) },
      milestonesHit: { ...(inc.milestonesHit || {}), ...(cur.milestonesHit || {}) },
      errorLog: Array.from(byId.values()),
      arDiag: cur.arDiag ?? inc.arDiag,
      mkDiag: cur.mkDiag ?? inc.mkDiag,
    };
    return JSON.stringify(merged);
  } catch {
    return currentRaw || incomingRaw;
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = SyncPayloadSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: 'invalid sync payload', issues: parsed.error.flatten() },
        { status: 400 },
      );
    }
    const { deltas: incomingDeltas } = parsed.data;

    const store = await readStoreWithLegacyMigration();
    const localDeltas = Object.values(store);
    const resolved = resolveConflicts(localDeltas, incomingDeltas);

    const nextStore: DeltaStore = {};
    for (const d of resolved) nextStore[d.key] = d;

    // Study-key deep merge, applied on top of the LWW-resolved winner so a
    // stale-but-still-relevant browser copy can't clobber server-seeded
    // diagnostics (error log / mastery checks) even when its version lost.
    const currentStudy = store['sfprep:study']?.value;
    const incomingStudy = incomingDeltas.find(d => d.key === 'sfprep:study')?.value;
    if (currentStudy || incomingStudy) {
      const merged = mergeStudy(currentStudy, incomingStudy);
      if (merged && nextStore['sfprep:study']) {
        nextStore['sfprep:study'] = { ...nextStore['sfprep:study'], value: merged };
      }
    }

    await writeStore(nextStore);
    return NextResponse.json({ ok: true, keys: Object.keys(nextStore).length, deltas: Object.values(nextStore) });
  } catch (error) {
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
  }
}
