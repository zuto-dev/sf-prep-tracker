'use client';

import { useEffect, useState } from 'react';

/**
 * Subscribe to sync events so components re-read localStorage
 * after the sync layer pulls fresh data from the server.
 * Returns a "revision" counter that bumps on every sync event.
 */
export function useSyncRev() {
  const [rev, setRev] = useState(0);
  useEffect(() => {
    const bump = () => setRev(r => r + 1);
    window.addEventListener('sfprep-sync', bump);
    return () => window.removeEventListener('sfprep-sync', bump);
  }, []);
  return rev;
}
