'use client';

// SF Pod Briefing Center + compact Knowledge Library (WS-5).
//
// Contract (do not relax without a spec change):
//   - On mount: pull the generic sfprep sync mirror, safely hydrate
//     `sfprep:knowledge` (never overwriting corrupt bytes — see
//     hydrateKnowledgeStore's own contract in knowledge-store.ts), read-only
//     fetch the existing `/pods.json`, run the legacy `sfprep:pods:skills`
//     migration ONLY once a valid nonempty pods array is available, then
//     reconcile the queue against the static curation overlay. Save +
//     push are only ever attempted when the original `sfprep:knowledge` raw
//     value was either missing or successfully JSON-parseable — a corrupt
//     raw value shows an explicit recovery/read-only banner and this page
//     never migrates/saves/pushes/mutates the key again until it's fixed.
//   - The legacy `sfprep:pods:skills` key is read-only here: it is read for
//     migration purposes only and is NEVER deleted or written to.
//   - A pod fetch failure preserves whatever in-memory/store state already
//     exists and shows a "content unavailable" message — it never clears
//     local storage keys.
//   - The Library is a compact, filterable/searchable row list built via
//     `deriveLibrary` (never a hand-rolled legacy card feed). Unknown /
//     uncurated content is never auto-promoted — the queue affordance on a
//     skill row is disabled unless `row.isActionable` (which itself mirrors
//     `canQueueAsPractice`, the single hard safety chokepoint).
//   - Episode rows open the approved, reusable `KnowledgeExplorerModal`.
//     This page never recreates a virtual audio/player clock and never
//     bypasses the Explorer's own `canQueueFromExplorer` gate — every
//     mutation-shaped action funnels through knowledge-engine's pure
//     mutation helpers, then `saveKnowledgeStore` + `pushSfprepSync`, and
//     only when persistence is safe (see above).
//   - No import/write of workouts/nutrition/standards/Intel data or any
//     API-suggestion/patch surface. No new packages.

import { useEffect, useMemo, useState } from 'react';
import { Nav } from '../components/Nav';
import { type Pod } from '../lib/pods-engine.ts';
import {
  hydrateKnowledgeStore,
  saveKnowledgeStore,
  defaultKnowledgeStore,
  KNOWLEDGE_STORAGE_KEY,
  type KnowledgeStore,
} from '../lib/knowledge-store.ts';
import {
  migrateLegacyCompletions,
  addToQueue,
  completeItem,
  deferItem,
  noteItem,
  reconcileQueue,
  podContentId,
  resolveCuration,
  type CurationStatus,
} from '../lib/knowledge-engine.ts';
import { CURATION_OVERLAY, getCurationRecord, type CurationDomain } from '../lib/knowledge-curation.ts';
import {
  deriveLibrary,
  deriveBriefing,
  type LibraryRow,
  type LibraryFilter,
  type ContentType,
  type LibrarySafetyLabel,
} from '../lib/knowledge-views.ts';
import { pullSfprepSync, pushSfprepSync } from '../lib/sfprep-sync.ts';
import { resolveFoundationWeekIndex, FOUNDATION_WEEKS } from '../lib/sfre-program.ts';
import { KnowledgeExplorerModal } from './KnowledgeExplorerModal.tsx';
import { resolveSfPodNarration, type SfPodNarration } from '../lib/sf-pod-narrations.ts';
import { ReadyToListen } from './ReadyToListen.tsx';

// Read-only migration source. Never written/deleted by this page.
const LEGACY_SKILLS_KEY = 'sfprep:pods:skills';

const DOMAIN_OPTIONS: CurationDomain[] = [
  'physical_conditioning',
  'water_survival',
  'land_navigation',
  'nutrition',
  'mindset_culture',
  'pipeline_path',
  'history_doctrine',
];

const SAFETY_OPTIONS: LibrarySafetyLabel[] = [
  'safe',
  'caution_physical_load',
  'restricted_prescriptive',
  'archived_not_actionable',
  'unclassified',
];

const CONTENT_TYPE_OPTIONS: ContentType[] = ['episode', 'skill'];

function labelize(value: string): string {
  return value.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

/** Derives the owning episode's canonical content ID from any canonical ID (episode or skill). */
function ownerContentIdOf(id: string): string {
  const idx = id.indexOf(':skill:');
  return idx === -1 ? id : id.slice(0, idx);
}

function findPodByContentId(pods: Pod[], contentId: string): Pod | null {
  return pods.find(p => podContentId(p) === contentId) ?? null;
}

/** Safe, throw-free JSON.parse for the read-only legacy-migration source. */
function safeParseLegacy(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    // Not valid JSON — return the raw string itself (a non-plain-object,
    // non-null/undefined value) so migrateLegacyCompletions's own hard-
    // failure branch handles it (defers, no migratedAt) rather than this
    // page guessing at partial legacy data.
    return raw;
  }
}

export default function PodsPage() {
  const [pods, setPods] = useState<Pod[] | null>(null);
  const [podsError, setPodsError] = useState<string | null>(null);
  const [store, setStore] = useState<KnowledgeStore | null>(null);
  const [corrupt, setCorrupt] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeEpisodeId, setActiveEpisodeId] = useState<string | null>(null);

  const [textFilter, setTextFilter] = useState('');
  const [contentTypeFilter, setContentTypeFilter] = useState<'all' | ContentType>('all');
  const [domainFilter, setDomainFilter] = useState<'all' | CurationDomain>('all');
  const [safetyFilter, setSafetyFilter] = useState<'all' | LibrarySafetyLabel>('all');

  const [today] = useState(() => new Date());
  const foundationWeek = useMemo(() => resolveFoundationWeekIndex(today), [today]);

  // --- Bootstrap: sync -> hydrate -> fetch pods -> migrate -> reconcile -> save/push ---
  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      await pullSfprepSync().catch(() => {});
      if (cancelled || typeof window === 'undefined') return;

      const storage = window.localStorage;
      const rawKnowledge = storage.getItem(KNOWLEDGE_STORAGE_KEY);
      let corruptFlag = false;
      if (rawKnowledge !== null) {
        try {
          JSON.parse(rawKnowledge);
        } catch {
          corruptFlag = true;
        }
      }
      // hydrateKnowledgeStore never overwrites corrupt bytes (see its own
      // contract) — it's safe to call regardless of corruptFlag.
      const hydrated = hydrateKnowledgeStore(storage);
      if (cancelled) return;

      let podsData: Pod[] | null = null;
      try {
        const res = await fetch('/pods.json', { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data) && data.length > 0) {
            podsData = [...data].sort((a, b) => b.date.localeCompare(a.date));
          } else {
            setPodsError('No pod debriefs yet. First one lands tomorrow 6AM.');
          }
        } else {
          setPodsError(`Could not load pods.json (${res.status})`);
        }
      } catch (e) {
        setPodsError(`Could not load pods.json (${String(e)})`);
      }
      if (cancelled) return;

      let workingStore = hydrated;

      // Legacy migration: only after a valid nonempty pods array, and only
      // when the knowledge store itself was not corrupt.
      if (!corruptFlag && podsData && podsData.length > 0) {
        const legacyRawStr = storage.getItem(LEGACY_SKILLS_KEY);
        const legacyParsed = legacyRawStr === null ? undefined : safeParseLegacy(legacyRawStr);
        workingStore = migrateLegacyCompletions(workingStore, legacyParsed, podsData, new Date().toISOString());
      }

      // Reconcile the queue against the current curation overlay whenever
      // it's safe to do so.
      if (!corruptFlag) {
        workingStore = reconcileQueue(workingStore, CURATION_OVERLAY);
      }

      setPods(podsData);
      setStore(workingStore);
      setCorrupt(corruptFlag);
      setLoading(false);

      // Save/push only when the original raw was missing or successfully
      // JSON-parseable. A corrupt raw value is never migrated, saved, or
      // pushed — its bytes are left exactly as they were.
      if (!corruptFlag && workingStore !== hydrated) {
        saveKnowledgeStore(workingStore, storage);
        pushSfprepSync();
      }
    }

    bootstrap();
    return () => {
      cancelled = true;
    };
  }, []);

  const effectiveStore = store ?? defaultKnowledgeStore();

  const briefing = useMemo(
    () => deriveBriefing(effectiveStore, pods, CURATION_OVERLAY),
    [effectiveStore, pods],
  );

  const libraryFilter: LibraryFilter = useMemo(
    () => ({
      ...(textFilter.trim() ? { text: textFilter } : {}),
      ...(contentTypeFilter !== 'all' ? { contentType: contentTypeFilter } : {}),
      ...(domainFilter !== 'all' ? { domain: domainFilter } : {}),
      ...(safetyFilter !== 'all' ? { safetyStatus: safetyFilter } : {}),
    }),
    [textFilter, contentTypeFilter, domainFilter, safetyFilter],
  );

  const libraryRows: LibraryRow[] = useMemo(
    () => deriveLibrary(pods, effectiveStore, CURATION_OVERLAY, libraryFilter),
    [pods, effectiveStore, libraryFilter],
  );

  // --- Audio-first: resolve narration for the newest CURRENT pod only ----
  // `resolveSfPodNarration` is an exact {date,title} match against the
  // fixed known-current allowlist — unresolved/unknown pods return null
  // and the ReadyToListen hero never renders for them. `pods` is already
  // sorted newest-first at fetch time (see bootstrap above), so the first
  // pod with a non-null resolution is the newest resolved audio pod.
  const newestResolvedAudioPod = useMemo(() => {
    if (!pods) return null;
    for (const p of pods) {
      const narration = resolveSfPodNarration(p);
      if (narration) return { pod: p, narration };
    }
    return null;
  }, [pods]);


  // --- Persistence: pure mutation -> save -> push, gated on !corrupt -----
  function persist(next: KnowledgeStore) {
    if (corrupt || typeof window === 'undefined') return;
    setStore(next);
    saveKnowledgeStore(next, window.localStorage);
    pushSfprepSync();
  }

  function handleQueue(id: string, status: CurationStatus) {
    persist(addToQueue(effectiveStore, id, status));
  }
  function handleComplete(id: string) {
    persist(completeItem(effectiveStore, id, new Date().toISOString()));
  }
  function handleDefer(id: string) {
    persist(deferItem(effectiveStore, id));
  }
  function handleNote(id: string, text: string) {
    persist(noteItem(effectiveStore, id, text));
  }

  function openEpisode(contentIdValue: string) {
    setActiveEpisodeId(contentIdValue);
    persist({ ...effectiveStore, lastOpenedContentId: contentIdValue });
  }

  function openOwnerFor(id: string) {
    openEpisode(ownerContentIdOf(id));
  }

  const activePod = activeEpisodeId && pods ? findPodByContentId(pods, activeEpisodeId) : null;
  const activeCurationStatus: CurationStatus = activeEpisodeId
    ? resolveCuration(activeEpisodeId, CURATION_OVERLAY)
    : 'unclassified';
  const activeSafetyLabel = activeEpisodeId
    ? (getCurationRecord(activeEpisodeId)?.safetyStatus ?? 'unclassified')
    : 'unclassified';

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 text-gray-100 flex items-center justify-center">
        <div className="text-center">
          <svg className="animate-spin h-10 w-10 text-blue-500 mx-auto mb-4" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <p className="text-gray-400">Loading pod briefing center...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 pb-16">
      <div className="fixed inset-0 bg-gradient-to-br from-blue-950/20 via-gray-950 to-purple-950/20 pointer-events-none" />

      <div className="relative bg-gradient-to-b from-blue-950/40 to-transparent backdrop-blur-sm pb-8">
        <div className="max-w-6xl mx-auto p-4">
          <div className="mb-6 flex justify-between items-start flex-wrap gap-4">
            <div>
              <h1 className="text-4xl font-black bg-gradient-to-r from-white via-blue-300 to-purple-400 bg-clip-text text-transparent">
                SF Pod Briefing Center
              </h1>
              <p className="text-gray-400 mt-2 text-sm">
                Foundation Week {foundationWeek} of {FOUNDATION_WEEKS} · Reference-only knowledge library — never a
                training prescription.
              </p>
            </div>
          </div>
          <Nav />
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-4 -mt-6 relative z-10 space-y-6">
        {corrupt && (
          <div
            data-testid="knowledge-corrupt-banner"
            className="backdrop-blur-md bg-amber-950/30 border border-amber-700/50 text-amber-200 px-5 py-4 rounded-2xl text-sm"
          >
            <strong className="block mb-1">Recovery needed — read-only mode.</strong>
            Your saved knowledge progress (<code>{KNOWLEDGE_STORAGE_KEY}</code>) could not be read. To avoid losing
            data, nothing here will be migrated, saved, or synced until this is fixed manually. Your existing data
            has been left untouched.
          </div>
        )}

        {podsError && (
          <div className="backdrop-blur-md bg-red-950/20 border border-red-700/50 text-red-200 px-5 py-4 rounded-2xl text-sm">
            {podsError}. Your saved progress has been preserved.
          </div>
        )}

        {/* --- Ready to Listen: audio-first hero for the newest resolved narration --- */}
        {newestResolvedAudioPod && (
          <ReadyToListen
            pod={newestResolvedAudioPod.pod}
            narration={newestResolvedAudioPod.narration}
            onOpenNotes={() => openEpisode(podContentId(newestResolvedAudioPod.pod))}
          />
        )}

        {/* --- Briefing Center --- */}
        <div className="backdrop-blur-md bg-gray-900/60 border border-gray-800/50 rounded-2xl p-6 shadow-xl">
          <h2 className="text-lg font-bold text-white mb-1 flex items-center gap-2">📋 Briefing Center</h2>
          <p className="text-xs text-gray-500 mb-4">
            Foundation-safe items only. Reference-only — does not change your training prescription.
          </p>

          {briefing.active.length === 0 && (
            <p className="text-sm text-gray-500 mb-4">No active Foundation-safe items queued yet.</p>
          )}
          <ul className="space-y-2 mb-4">
            {briefing.active.map(item => (
              <li key={item.id}>
                <button
                  onClick={() => openOwnerFor(item.id)}
                  className="w-full text-left bg-gray-950/40 hover:bg-blue-950/30 border border-gray-800/50 hover:border-blue-500/30 rounded-xl px-4 py-3 transition-colors text-sm text-gray-200"
                >
                  <span className="text-[10px] uppercase tracking-wider text-blue-400 mr-2">{item.contentType}</span>
                  {item.title}
                </button>
              </li>
            ))}
          </ul>

          {briefing.continueLearning && (
            <button
              onClick={() => openOwnerFor(briefing.continueLearning!.id)}
              className="text-xs font-bold px-3 py-1.5 rounded-full bg-blue-600 hover:bg-blue-500 text-white"
            >
              Continue: {briefing.continueLearning.title}
            </button>
          )}
        </div>

        {/* --- Compact Knowledge Library --- */}
        <div className="backdrop-blur-md bg-gray-900/60 border border-gray-800/50 rounded-2xl p-6 shadow-xl">
          <h2 className="text-lg font-bold text-white mb-4">📚 Knowledge Library</h2>

          <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-2 mb-4">
            <input
              value={textFilter}
              onChange={e => setTextFilter(e.target.value)}
              placeholder="Search title, summary, skills..."
              className="bg-gray-950/60 border border-gray-800 rounded-xl px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:border-blue-500/50 focus:outline-none md:col-span-1"
            />
            <select
              value={contentTypeFilter}
              onChange={e => setContentTypeFilter(e.target.value as 'all' | ContentType)}
              className="bg-gray-950/60 border border-gray-800 rounded-xl px-3 py-2 text-sm text-white"
            >
              <option value="all">All types</option>
              {CONTENT_TYPE_OPTIONS.map(ct => (
                <option key={ct} value={ct}>
                  {labelize(ct)}
                </option>
              ))}
            </select>
            <select
              value={domainFilter}
              onChange={e => setDomainFilter(e.target.value as 'all' | CurationDomain)}
              className="bg-gray-950/60 border border-gray-800 rounded-xl px-3 py-2 text-sm text-white"
            >
              <option value="all">All domains</option>
              {DOMAIN_OPTIONS.map(d => (
                <option key={d} value={d}>
                  {labelize(d)}
                </option>
              ))}
            </select>
            <select
              value={safetyFilter}
              onChange={e => setSafetyFilter(e.target.value as 'all' | LibrarySafetyLabel)}
              className="bg-gray-950/60 border border-gray-800 rounded-xl px-3 py-2 text-sm text-white"
            >
              <option value="all">All safety statuses</option>
              {SAFETY_OPTIONS.map(s => (
                <option key={s} value={s}>
                  {labelize(s)}
                </option>
              ))}
            </select>
          </div>

          {libraryRows.length === 0 && (
            <p className="text-sm text-gray-500 py-6 text-center">No matching content. Adjust your filters.</p>
          )}

          <ul className="divide-y divide-gray-800/50">
            {libraryRows.map(row => (
              <li key={row.id} className="py-3 flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-blue-400 bg-blue-500/10 border border-blue-500/20 px-1.5 py-0.5 rounded-full">
                      {row.contentType}
                    </span>
                    <span className="text-[10px] uppercase font-bold tracking-wider text-amber-300 bg-amber-500/10 border border-amber-500/30 px-1.5 py-0.5 rounded-full">
                      {labelize(row.safetyStatus)}
                    </span>
                    <span className="text-[10px] uppercase tracking-wider text-gray-500">{labelize(row.status)}</span>
                    {row.completed && <span className="text-[10px] text-emerald-400">Completed</span>}
                    {row.deferred && <span className="text-[10px] text-gray-400">Deferred</span>}
                    {row.needsReview && <span className="text-[10px] text-red-400">Needs review</span>}
                  </div>
                  {row.contentType === 'episode' ? (
                    <button
                      onClick={() => openEpisode(row.id)}
                      className="text-left font-bold text-white hover:text-blue-300 mt-1"
                    >
                      {row.title}
                    </button>
                  ) : (
                    <div className="font-bold text-white mt-1">{row.title}</div>
                  )}
                  <div className="text-xs text-gray-500 mt-0.5">
                    {row.ownerTitle ? `From: ${row.ownerTitle}` : row.source ?? 'No source listed'}
                  </div>
                </div>

                {row.contentType === 'episode' && (
                  <button
                    onClick={() => openEpisode(row.id)}
                    className="text-xs font-bold px-2.5 py-1 rounded-full bg-blue-600 hover:bg-blue-500 text-white flex-shrink-0"
                  >
                    {pods?.some(p => resolveSfPodNarration(p) !== null && podContentId(p) === row.id)
                      ? 'Listen'
                      : 'Read notes'}
                  </button>
                )}

                {row.contentType === 'skill' && (
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button
                      onClick={() => handleQueue(row.id, row.status)}
                      disabled={corrupt || !row.isActionable}
                      title={row.isActionable ? undefined : 'Only foundation_safe content may be queued as practice'}
                      className="text-xs font-bold px-2.5 py-1 rounded-full bg-blue-600 hover:bg-blue-500 disabled:bg-gray-800 disabled:text-gray-500 disabled:cursor-not-allowed text-white"
                    >
                      Queue
                    </button>
                    <button
                      onClick={() => handleComplete(row.id)}
                      disabled={corrupt || row.completed}
                      className="text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-800 disabled:text-gray-500 text-white"
                    >
                      Complete
                    </button>
                    <button
                      onClick={() => handleDefer(row.id)}
                      disabled={corrupt || row.deferred}
                      className="text-xs font-bold px-2.5 py-1 rounded-full bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:text-gray-500 text-white"
                    >
                      Defer
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {activeEpisodeId && activePod && (
        <KnowledgeExplorerModal
          pod={activePod}
          contentId={activeEpisodeId}
          curationStatus={activeCurationStatus}
          safetyLabel={labelize(activeSafetyLabel)}
          isQueued={effectiveStore.queue.includes(activeEpisodeId)}
          isCompleted={activeEpisodeId in effectiveStore.completions}
          isDeferred={effectiveStore.deferred.includes(activeEpisodeId)}
          noteText={effectiveStore.notes[activeEpisodeId] ?? ''}
          onQueue={id => handleQueue(id, activeCurationStatus)}
          onComplete={handleComplete}
          onDefer={handleDefer}
          onNote={handleNote}
          onClose={() => setActiveEpisodeId(null)}
        />
      )}
    </div>
  );
}
