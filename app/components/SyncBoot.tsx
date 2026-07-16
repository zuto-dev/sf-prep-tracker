'use client';

import { useEffect, useState } from 'react';
import { initSync, lastSyncTime, pushToServer, pullFromServer } from '../lib/sync';

export function SyncBoot() {
  const [status, setStatus] = useState<'init' | 'ok' | 'error'>('init');
  const [last, setLast] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    initSync();
    setStatus('ok');
    const t = setInterval(() => setLast(lastSyncTime()), 5000);
    return () => clearInterval(t);
  }, []);

  const manualSync = async () => {
    setBusy(true);
    await pushToServer();
    await pullFromServer();
    setLast(lastSyncTime());
    setBusy(false);
  };

  const fmtTime = (iso: string | null) => {
    if (!iso) return 'never';
    const d = new Date(iso);
    const now = new Date();
    const secs = Math.floor((now.getTime() - d.getTime()) / 1000);
    if (secs < 60) return `${secs}s ago`;
    if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <button
      onClick={manualSync}
      disabled={busy}
      title="Force sync now"
      className="fixed bottom-4 right-4 z-40 bg-gray-800/95 border border-gray-700 rounded-full pl-3 pr-4 py-2 text-xs text-gray-300 shadow-lg hover:bg-gray-700 flex items-center gap-2 backdrop-blur"
    >
      <span className={`w-2 h-2 rounded-full ${status === 'ok' ? (busy ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400') : 'bg-gray-500'}`} />
      <span>sync · {busy ? 'now...' : fmtTime(last)}</span>
    </button>
  );
}
