// SF Prep global sync engine — Blueprint SECTION 1.3 ("Option C Rebuild").
//
// Replaces the naive last-push-wins localStorage mirror with a versioned,
// timestamped delta model and a Last-Write-Wins (LWW) conflict resolver, so
// that a phone push and a Mac-mini push racing each other no longer silently
// clobber one another. No backend datastore migration was in scope for this
// pass (no Supabase project is wired into this app yet — see AGENTS.md), so
// the server side of the LWW algorithm is implemented against the existing
// `.data/sfprep-sync.json` file store rather than the Postgres schema in
// SECTION 1.3; the delta/version/CRDT algorithm itself is unchanged and this
// module is the drop-in Supabase migration point (see api/sfprep-sync/route.ts).
//
// Public API is intentionally unchanged (`pullSfprepSync`, `pushSfprepSync`,
// `syncSfprepSyncNow`) so every existing caller (WorkoutDay, Exercise,
// calendar, nutrition, study pages) keeps working without modification.

import { z } from 'zod';

export const SF_PREP_SYNC_ROUTE = '/api/sfprep-sync';

// ---------------------------------------------------------------------------
// Schema — validated at the API boundary (Blueprint 1.2 #2: "No Schema Validation")
// ---------------------------------------------------------------------------

export const SyncDeltaSchema = z.object({
  key: z.string().regex(/^sfprep:[A-Za-z0-9:_-]+$/, 'invalid sfprep storage key'),
  value: z.string(),
  version: z.number().int().nonnegative(),
  clientUpdatedAt: z.string().datetime({ offset: true }).or(z.string().datetime()),
});

export const SyncPayloadSchema = z.object({
  clientId: z.string().min(1),
  deltas: z.array(SyncDeltaSchema).max(2000),
});

export type SyncDelta = z.infer<typeof SyncDeltaSchema>;
export type SyncPayload = z.infer<typeof SyncPayloadSchema>;

// Keys that participate in the sync mirror but must never themselves be
// treated as syncable program data (they ARE the sync engine's own bookkeeping).
const META_KEY = 'sfprep:_syncmeta';
const CLIENT_ID_KEY = 'sfprep:_clientId';
const EXCLUDED_KEYS = new Set([META_KEY, CLIENT_ID_KEY]);

type SyncMeta = Record<string, { version: number; hash: string; clientUpdatedAt: string }>;

function isBrowser() {
  return typeof window !== 'undefined';
}

function cheapHash(s: string): string {
  // Not cryptographic — just cheap change-detection so we don't burn a
  // version bump (and a wasted network delta) on a no-op re-save.
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return h.toString(36);
}

function getClientId(): string {
  if (!isBrowser()) return 'server';
  let id = window.localStorage.getItem(CLIENT_ID_KEY);
  if (!id) {
    id = (typeof crypto !== 'undefined' && 'randomUUID' in crypto)
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    window.localStorage.setItem(CLIENT_ID_KEY, id);
  }
  return id;
}

function loadMeta(): SyncMeta {
  if (!isBrowser()) return {};
  try {
    const raw = window.localStorage.getItem(META_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function saveMeta(meta: SyncMeta) {
  if (!isBrowser()) return;
  window.localStorage.setItem(META_KEY, JSON.stringify(meta));
}

function snapshotLocalSfprep(): Record<string, string> {
  if (!isBrowser()) return {};
  const out: Record<string, string> = {};
  for (let i = 0; i < window.localStorage.length; i++) {
    const key = window.localStorage.key(i);
    if (!key || !key.startsWith('sfprep:') || EXCLUDED_KEYS.has(key)) continue;
    const value = window.localStorage.getItem(key);
    if (value !== null) out[key] = value;
  }
  return out;
}

/** Builds the versioned delta set for every locally-changed sfprep key since the last push. */
function buildLocalDeltas(): { deltas: SyncDelta[]; nextMeta: SyncMeta } {
  const snapshot = snapshotLocalSfprep();
  const meta = loadMeta();
  const nextMeta: SyncMeta = { ...meta };
  const deltas: SyncDelta[] = [];
  const now = new Date().toISOString();

  for (const [key, value] of Object.entries(snapshot)) {
    const hash = cheapHash(value);
    const existing = meta[key];
    if (existing && existing.hash === hash) {
      // Unchanged since last push — still report the delta so the server
      // has the full authoritative version, but don't bump the version.
      deltas.push({ key, value, version: existing.version, clientUpdatedAt: existing.clientUpdatedAt });
      continue;
    }
    const version = (existing?.version ?? 0) + 1;
    deltas.push({ key, value, version, clientUpdatedAt: now });
    nextMeta[key] = { version, hash, clientUpdatedAt: now };
  }

  return { deltas, nextMeta };
}

/**
 * Resolves state conflicts using client timestamps and monotonic versions.
 * (Blueprint SECTION 1.3, LWW Element-Set CRDT — verbatim algorithm.)
 */
export function resolveConflicts(localDeltas: SyncDelta[], incomingDeltas: SyncDelta[]): SyncDelta[] {
  const merged = new Map<string, SyncDelta>();

  // Load local state
  localDeltas.forEach(d => merged.set(d.key, d));

  // Merge incoming state with conflict resolution logic
  incomingDeltas.forEach(incoming => {
    const existing = merged.get(incoming.key);
    if (!existing) {
      merged.set(incoming.key, incoming);
      return;
    }

    // Rule 1: Monotonic version comparison
    if (incoming.version > existing.version) {
      merged.set(incoming.key, incoming);
      return;
    }

    // Rule 2: If versions match, use Last-Write-Wins (LWW) based on client timestamp
    if (incoming.version === existing.version) {
      const incomingTime = new Date(incoming.clientUpdatedAt).getTime();
      const existingTime = new Date(existing.clientUpdatedAt).getTime();
      if (incomingTime > existingTime) {
        merged.set(incoming.key, incoming);
      }
    }
  });

  return Array.from(merged.values());
}

function applyDeltas(deltas: SyncDelta[]) {
  if (!isBrowser()) return;
  const meta = loadMeta();
  for (const d of deltas) {
    const current = window.localStorage.getItem(d.key);
    if (current === d.value) {
      // Already in sync; just make sure meta reflects the resolved version.
      meta[d.key] = { version: d.version, hash: cheapHash(d.value), clientUpdatedAt: d.clientUpdatedAt };
      continue;
    }
    window.localStorage.setItem(d.key, d.value);
    meta[d.key] = { version: d.version, hash: cheapHash(d.value), clientUpdatedAt: d.clientUpdatedAt };
  }
  saveMeta(meta);
}

export async function pullSfprepSync(): Promise<boolean> {
  if (!isBrowser()) return false;
  try {
    const res = await fetch(SF_PREP_SYNC_ROUTE, { cache: 'no-store' });
    if (!res.ok) return false;
    const data = (await res.json()) as { deltas?: SyncDelta[]; snapshot?: Record<string, string> };

    if (Array.isArray(data.deltas) && data.deltas.length > 0) {
      const meta = loadMeta();
      const localDeltas: SyncDelta[] = Object.entries(meta).map(([key, m]) => ({
        key,
        value: window.localStorage.getItem(key) ?? '',
        version: m.version,
        clientUpdatedAt: m.clientUpdatedAt,
      }));
      const resolved = resolveConflicts(localDeltas, data.deltas);
      applyDeltas(resolved);
      return true;
    }

    // Legacy/empty-store fallback: flat snapshot with no version metadata yet.
    if (data.snapshot) {
      for (const [key, value] of Object.entries(data.snapshot)) {
        window.localStorage.setItem(key, value);
      }
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

export async function pushSfprepSync(): Promise<boolean> {
  if (!isBrowser()) return false;
  try {
    const { deltas, nextMeta } = buildLocalDeltas();
    const payload: SyncPayload = { clientId: getClientId(), deltas };
    // Client-side validation mirrors the server's Zod boundary so a malformed
    // localStorage entry fails fast instead of corrupting the server store.
    const parsed = SyncPayloadSchema.safeParse(payload);
    if (!parsed.success) {
      console.error('sfprep-sync: local payload failed validation', parsed.error.flatten());
      return false;
    }
    const res = await fetch(SF_PREP_SYNC_ROUTE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(parsed.data),
    });
    if (res.ok) saveMeta(nextMeta);
    return res.ok;
  } catch {
    return false;
  }
}

export function syncSfprepSyncNow() {
  void pullSfprepSync().then(() => pushSfprepSync());
}
