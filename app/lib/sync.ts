'use client';

// Client-side sync layer that mirrors localStorage <-> /api/sync
// Strategy:
//   - On boot: fetch server state, merge into localStorage (server wins for any key that exists on server)
//   - On any localStorage write to sfprep:* keys: debounced POST to /api/sync
//   - Poll /api/sync every 30s for changes from the other device

const PREFIX = 'sfprep:';
const DEVICE_KEY = 'sfprep:_deviceId';
let syncTimer: ReturnType<typeof setTimeout> | null = null;
let pollTimer: ReturnType<typeof setInterval> | null = null;
let listenersInstalled = false;
let lastServerUpdatedAt: string | null = null;

function deviceId(): string {
  let id = localStorage.getItem(DEVICE_KEY);
  if (!id) {
    id = `${navigator.platform || 'device'}-${Math.random().toString(36).slice(2, 8)}`;
    localStorage.setItem(DEVICE_KEY, id);
  }
  return id;
}

function snapshotLocalKeys(): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k || !k.startsWith(PREFIX) || k === DEVICE_KEY) continue;
    const v = localStorage.getItem(k);
    if (v == null) continue;
    try { out[k] = JSON.parse(v); } catch { out[k] = v; }
  }
  return out;
}

function applyServerKeys(keys: Record<string, unknown>): boolean {
  let changed = false;
  for (const [k, v] of Object.entries(keys)) {
    if (!k.startsWith(PREFIX)) continue;
    const serialized = typeof v === 'string' ? v : JSON.stringify(v);
    const existing = localStorage.getItem(k);
    if (existing !== serialized) {
      localStorage.setItem(k, serialized);
      changed = true;
    }
  }
  return changed;
}

export async function pullFromServer(): Promise<boolean> {
  try {
    const r = await fetch('/api/sync', { cache: 'no-store' });
    if (!r.ok) return false;
    const data = await r.json();
    if (!data || typeof data.keys !== 'object') return false;
    lastServerUpdatedAt = data.updatedAt || null;
    const changed = applyServerKeys(data.keys);
    if (changed) {
      // Notify components that localStorage changed from an external source
      window.dispatchEvent(new Event('sfprep-sync'));
    }
    return changed;
  } catch {
    return false;
  }
}

export async function pushToServer(): Promise<void> {
  try {
    const keys = snapshotLocalKeys();
    await fetch('/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keys, deviceId: deviceId() }),
    });
  } catch {
    // silent
  }
}

function schedulePush() {
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(() => { pushToServer(); }, 800);
}

export function initSync() {
  if (typeof window === 'undefined' || listenersInstalled) return;
  listenersInstalled = true;

  // Intercept setItem / removeItem on sfprep:* keys
  const origSet = localStorage.setItem.bind(localStorage);
  const origRemove = localStorage.removeItem.bind(localStorage);
  localStorage.setItem = (key: string, value: string) => {
    origSet(key, value);
    if (key.startsWith(PREFIX) && key !== DEVICE_KEY) schedulePush();
  };
  localStorage.removeItem = (key: string) => {
    origRemove(key);
    if (key.startsWith(PREFIX) && key !== DEVICE_KEY) schedulePush();
  };

  // Initial pull, then push local changes, then poll every 30s
  (async () => {
    await pullFromServer();
    await pushToServer();
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = setInterval(() => { pullFromServer(); }, 30000);
  })();

  // Push before tab closes
  window.addEventListener('beforeunload', () => { pushToServer(); });
  // Push when tab regains focus (best effort)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') pullFromServer();
    else pushToServer();
  });
}

export function lastSyncTime(): string | null {
  return lastServerUpdatedAt;
}
