'use client';

import { useEffect } from 'react';
import { pullSfprepSync, pushSfprepSync } from '../lib/sfprep-sync';

const PREFIX = 'sfprep:';
const EXCLUDED_KEYS = new Set(['sfprep:_clientId', 'sfprep:_syncmeta']);

/**
 * Single global transport for all SF Prep localStorage writes. Feature pages can
 * still call pushSfprepSync directly, but direct localStorage writers (workout,
 * progress, mobility, and meals) are caught here as well.
 */
export function VersionedSyncBoot() {
  useEffect(() => {
    const originalSetItem = window.localStorage.setItem.bind(window.localStorage);
    const originalRemoveItem = window.localStorage.removeItem.bind(window.localStorage);
    let pushTimer: number | undefined;
    let reloadQueued = false;

    const schedulePush = () => {
      if (pushTimer) window.clearTimeout(pushTimer);
      pushTimer = window.setTimeout(() => { void pushSfprepSync(); }, 800);
    };

    const shouldSync = (key: string) => key.startsWith(PREFIX) && !EXCLUDED_KEYS.has(key);

    window.localStorage.setItem = (key: string, value: string) => {
      originalSetItem(key, value);
      if (shouldSync(key)) schedulePush();
    };
    window.localStorage.removeItem = (key: string) => {
      originalRemoveItem(key);
      if (shouldSync(key)) schedulePush();
    };

    const pull = async (refreshActiveView: boolean) => {
      const changed = await pullSfprepSync();
      if (!changed) return;
      window.dispatchEvent(new Event('sfprep-sync'));
      if (refreshActiveView && !reloadQueued) {
        reloadQueued = true;
        window.location.reload();
      }
    };

    void (async () => {
      await pull(false);
      await pushSfprepSync();
    })();

    const interval = window.setInterval(() => { void pull(true); }, 30_000);
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') void pull(true);
      else void pushSfprepSync();
    };
    const onBeforeUnload = () => { void pushSfprepSync(); };
    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('beforeunload', onBeforeUnload);

    return () => {
      if (pushTimer) window.clearTimeout(pushTimer);
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('beforeunload', onBeforeUnload);
      window.localStorage.setItem = originalSetItem;
      window.localStorage.removeItem = originalRemoveItem;
    };
  }, []);

  return null;
}
