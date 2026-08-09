'use client';

import { useCallback, useEffect, useState } from 'react';
import { TacticalPageHeader } from '../components/TacticalPageHeader';

type Status = 'pending' | 'accepted' | 'rejected';
type Finding = {
  id: string;
  title: string;
  description: string;
  source?: string;
  category?: string;
  action?: string;
  status: Status;
  created_at: string;
  decided_at?: string;
};

const CATEGORY: Record<string, { label: string; chip: string }> = {
  run: { label: 'RUN', chip: 'bg-blue-500/15 text-blue-300 border-blue-400/30' },
  ruck: { label: 'RUCK', chip: 'bg-amber-500/15 text-amber-300 border-amber-400/30' },
  strength: { label: 'STRENGTH', chip: 'bg-emerald-500/15 text-emerald-300 border-emerald-400/30' },
  nutrition: { label: 'NUTRITION', chip: 'bg-purple-500/15 text-purple-300 border-purple-400/30' },
  recovery: { label: 'RECOVERY', chip: 'bg-cyan-500/15 text-cyan-300 border-cyan-400/30' },
  other: { label: 'OTHER', chip: 'bg-gray-500/15 text-gray-300 border-gray-400/30' },
};

function formatDate(value: string) {
  const d = new Date(value);
  return Number.isNaN(d.valueOf()) ? 'Unknown date' : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function IntelPage() {
  const [findings, setFindings] = useState<Finding[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/suggestions', { cache: 'no-store' });
      if (!response.ok) throw new Error(`Inbox request failed (${response.status})`);
      const body = await response.json() as { suggestions?: Finding[] };
      setFindings(Array.isArray(body.suggestions) ? body.suggestions : []);
    } catch {
      setError('Could not load your research inbox. Your saved decisions are safe — retry when the tracker is back online.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const decide = async (finding: Finding, action: 'approve' | 'reject') => {
    setSaving(finding.id);
    setError('');
    try {
      const response = await fetch('/api/suggestions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: finding.id, action }),
      });
      if (!response.ok) throw new Error(`Decision request failed (${response.status})`);
      const body = await response.json() as { status?: Status };
      const status = body.status ?? (action === 'approve' ? 'accepted' : 'rejected');
      setFindings(current => current.map(item => item.id === finding.id
        ? { ...item, status, decided_at: new Date().toISOString() }
        : item));
    } catch {
      setError('Your decision did not save. Nothing changed — try again.');
    } finally {
      setSaving(null);
    }
  };

  const pending = findings.filter(f => f.status === 'pending');
  const history = findings.filter(f => f.status !== 'pending');

  return (
    <main className="min-h-screen bg-[#09090a] text-gray-100">
      <div className="max-w-5xl mx-auto p-4">
        <TacticalPageHeader
          eyebrow="Research Inbox"
          title="Decide what matters."
          description="Evidence-backed findings wait here for a deliberate Adopt or Not Now decision. Research never changes the Foundation prescription automatically."
          status={`${pending.length} waiting`}
        />

      <section className="space-y-6">
        <div className="rounded-2xl border border-blue-500/20 bg-blue-950/30 p-4">
          <p className="font-bold text-blue-200">How this works</p>
          <p className="mt-1 text-sm leading-relaxed text-gray-300">Research is advice, not an automatic program change. <b>Adopt</b> sends the practical action to your Workouts page as an Active Adjustment. <b>Not now</b> keeps a record without changing anything.</p>
        </div>

        {error && <div className="rounded-xl border border-red-500/40 bg-red-950/30 p-4 text-sm text-red-200 flex justify-between gap-4"><span>{error}</span><button onClick={() => void load()} className="font-bold underline">Retry</button></div>}

        <div className="flex items-baseline justify-between gap-4">
          <div><h2 className="text-2xl font-bold">Action Queue</h2><p className="text-sm text-gray-400">{pending.length ? `${pending.length} finding${pending.length === 1 ? '' : 's'} waiting on you` : 'Nothing waiting — you are caught up.'}</p></div>
          <button onClick={() => void load()} className="rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm font-semibold hover:bg-gray-800">Refresh</button>
        </div>

        {loading ? <div className="rounded-2xl border border-gray-800 bg-gray-900/60 p-8 text-center text-gray-400">Loading research inbox…</div> : pending.length === 0 ? (
          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-950/20 p-8 text-center"><div className="text-3xl">✓</div><p className="mt-2 font-bold text-emerald-300">All caught up.</p><p className="mt-1 text-sm text-gray-400">The next material finding will appear here automatically.</p></div>
        ) : <div className="space-y-4">{pending.map(finding => <FindingCard key={finding.id} finding={finding} saving={saving === finding.id} onDecide={decide} />)}</div>}

        {history.length > 0 && <details className="rounded-2xl border border-gray-800 bg-gray-900/50 p-5"><summary className="cursor-pointer font-bold">Decision history ({history.length})</summary><div className="mt-4 space-y-3">{history.map(finding => <FindingCard key={finding.id} finding={finding} history />)}</div></details>}
      </section>
      </div>
    </main>
  );
}

function FindingCard({ finding, saving = false, history = false, onDecide }: { finding: Finding; saving?: boolean; history?: boolean; onDecide?: (finding: Finding, action: 'approve' | 'reject') => void }) {
  const category = CATEGORY[finding.category || 'other'] || CATEGORY.other;
  const adopted = finding.status === 'accepted';
  return <article className="rounded-2xl border border-gray-800 bg-gray-900/70 p-5 shadow-xl">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><span className={`inline-block rounded-full border px-2 py-0.5 text-[10px] font-bold tracking-widest ${category.chip}`}>{category.label}</span><h3 className="mt-2 text-xl font-bold text-white">{finding.title}</h3><p className="mt-1 text-xs text-gray-500">Added {formatDate(finding.created_at)}</p></div>{history && <span className={`rounded-full px-3 py-1 text-xs font-bold ${adopted ? 'bg-emerald-500/15 text-emerald-300' : 'bg-gray-700 text-gray-300'}`}>{adopted ? 'ADOPTED' : 'NOT NOW'}</span>}</div>
    <div className="mt-4 border-l-2 border-blue-500/60 pl-4"><p className="text-xs font-bold uppercase tracking-wider text-blue-300">What this means for you</p><p className="mt-1 text-sm leading-relaxed text-gray-200">{finding.description}</p></div>
    {finding.action && <div className="mt-4 rounded-xl bg-gray-950/70 p-3"><p className="text-xs font-bold uppercase tracking-wider text-emerald-300">Proposed action</p><p className="mt-1 text-sm leading-relaxed text-gray-200">{finding.action}</p></div>}
    {finding.source && <details className="mt-4 text-sm text-gray-400"><summary className="cursor-pointer font-semibold text-gray-300">Evidence & sources</summary><p className="mt-2 leading-relaxed">{finding.source}</p></details>}
    {!history && onDecide && <div className="mt-5 flex flex-wrap gap-3"><button disabled={saving} onClick={() => onDecide(finding, 'approve')} className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-500 disabled:opacity-50">{saving ? 'Saving…' : 'Adopt to Plan'}</button><button disabled={saving} onClick={() => onDecide(finding, 'reject')} className="rounded-xl border border-gray-700 px-4 py-2 text-sm font-bold text-gray-200 hover:bg-gray-800 disabled:opacity-50">Not now</button></div>}
  </article>;
}
