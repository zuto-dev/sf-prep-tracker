import type { SyncDelta } from './sfprep-sync';

export type VersionedSyncStore = Record<string, SyncDelta>;
export type LegacySyncState = {
  keys?: Record<string, unknown>;
  updatedAt?: string | null;
};

const EXCLUDED_LEGACY_KEYS = new Set([
  'sfprep:_deviceId',
  'sfprep:_clientId',
  'sfprep:_syncmeta',
]);

function isSyncableKey(key: string): boolean {
  return key.startsWith('sfprep:') && !EXCLUDED_LEGACY_KEYS.has(key);
}

function serialize(value: unknown): string {
  return typeof value === 'string' ? value : JSON.stringify(value);
}

function validTimestamp(value: string | null | undefined, fallback: string): string {
  const timestamp = value ? new Date(value).getTime() : NaN;
  return Number.isFinite(timestamp) ? value as string : fallback;
}

/**
 * One-way migration from the retired flat sync mirror into the versioned store.
 * Existing versioned records win unconditionally, so current device data cannot
 * be overwritten by a stale legacy snapshot.
 */
export function mergeLegacySnapshot(
  current: VersionedSyncStore,
  legacy: LegacySyncState,
  migratedAt: string,
): { store: VersionedSyncStore; migratedKeys: string[] } {
  const store: VersionedSyncStore = { ...current };
  const migratedKeys: string[] = [];
  const clientUpdatedAt = validTimestamp(legacy.updatedAt, migratedAt);

  for (const [key, value] of Object.entries(legacy.keys ?? {})) {
    if (!isSyncableKey(key) || store[key]) continue;
    store[key] = {
      key,
      value: serialize(value),
      version: 1,
      clientUpdatedAt,
    };
    migratedKeys.push(key);
  }

  return { store, migratedKeys };
}
