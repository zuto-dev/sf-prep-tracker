'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Nav } from '../components/Nav';
import { motion, AnimatePresence } from 'motion/react';
import {
  buildBookmarks,
  searchPodContent,
  formatClock,
  DEFAULT_DURATION_SECONDS,
  type Pod,
  type AudioTimestampBookmark,
} from '../lib/pods-engine';

const KEY = 'sfprep:pods:skills';

function loadSkillState(): Record<string, boolean> {
  if (typeof window === 'undefined') return {};
  try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { return {}; }
}
function saveSkillState(state: Record<string, boolean>) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(KEY, JSON.stringify(state));
}

export default function PodsPage() {
  const [pods, setPods] = useState<Pod[]>([]);
  const [skillState, setSkillState] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [activePod, setActivePod] = useState<Pod | null>(null);
  const [query, setQuery] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    fetch('/pods.json', { cache: 'no-store' })
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then((data: Pod[]) => setPods([...data].sort((a, b) => b.date.localeCompare(a.date))))
      .catch(e => setError(`Could not load pods.json (${e})`));
    setSkillState(loadSkillState());
  }, []);

  const toggleSkill = (podDate: string, idx: number) => {
    const key = `${podDate}:${idx}`;
    const next = { ...skillState, [key]: !skillState[key] };
    setSkillState(next);
    saveSkillState(next);
  };

  const totalSkills = pods.reduce((n, p) => n + p.skills.length, 0);
  const doneSkills = Object.values(skillState).filter(Boolean).length;

  const bookmarks: AudioTimestampBookmark[] = useMemo(
    () => (activePod ? buildBookmarks(activePod) : []),
    [activePod]
  );

  const searchHits = useMemo(
    () => (activePod && query.trim() ? searchPodContent(activePod, query, bookmarks) : []),
    [activePod, query, bookmarks]
  );

  const openPlayer = (pod: Pod) => {
    setActivePod(pod);
    setCurrentTime(0);
    setIsPlaying(false);
    setQuery('');
  };

  const seekTo = (seconds: number) => {
    setCurrentTime(seconds);
    if (audioRef.current) {
      audioRef.current.currentTime = seconds;
      if (activePod?.audio) {
        audioRef.current.play().catch(() => {});
        setIsPlaying(true);
      }
    }
  };

  const togglePlay = () => {
    if (!audioRef.current || !activePod?.audio) {
      // No real audio file for this episode — still track a virtual clock so
      // bookmark navigation + transcript scrubbing remain usable.
      setIsPlaying(p => !p);
      return;
    }
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().catch(() => {});
      setIsPlaying(true);
    }
  };

  // Virtual clock tick when there's no real <audio> element to drive currentTime
  // (keeps scrubbing/bookmark UX honest instead of faking file playback).
  useEffect(() => {
    if (!isPlaying || activePod?.audio) return;
    const id = setInterval(() => setCurrentTime(t => t + playbackRate), 1000);
    return () => clearInterval(id);
  }, [isPlaying, activePod, playbackRate]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = playbackRate;
  }, [playbackRate]);

  const duration = DEFAULT_DURATION_SECONDS;

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className="space-y-6 pb-28"
    >
      <Nav />

      {/* Main Stats Banner */}
      <div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="font-mono text-xs text-gray-500 tracking-widest uppercase">TACTICAL AUDIO</span>
          <h2 className="text-xl md:text-2xl font-bold font-display mt-0.5 text-white">
            SF Pod Debriefs
          </h2>
          <p className="text-gray-400 text-sm mt-1">
            Daily narrated debriefs · key takeaways · skills to practice.
          </p>
        </div>
        <div className="text-left sm:text-right shrink-0">
          <span className="text-[10px] font-mono text-gray-500 block uppercase tracking-wider">SKILLS MASTERY</span>
          <span className="text-xs bg-emerald-500/10 text-emerald-400 font-semibold px-2.5 py-0.5 rounded-full inline-flex items-center gap-1.5 mt-1 border border-emerald-500/25">
            <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
            {doneSkills}/{totalSkills} Checked
          </span>
        </div>
      </div>

      <div className="space-y-6">
        {error && (
          <div className="backdrop-blur-md bg-red-950/20 border border-red-700/50 text-red-200 px-5 py-4 rounded-2xl mb-4 text-sm">
            {error}. Cron writes to <code>~/fitness-tracker/public/pods.json</code>.
          </div>
        )}
        {!error && pods.length === 0 && (
          <div className="backdrop-blur-md bg-gray-900/60 border border-gray-800/50 rounded-2xl p-8 text-center text-gray-500 text-sm shadow-xl">
            No pod debriefs yet. First one lands tomorrow 6AM.
          </div>
        )}

        <div className="space-y-6">
          {pods.map((pod, i) => (
            <div key={pod.date}
              className="backdrop-blur-md bg-gray-900/60 border border-gray-800/50 rounded-2xl p-6 shadow-xl hover:border-blue-500/20 transition-all duration-300 animate-slide-in-left"
              style={{ animationDelay: `${i * 100}ms` }}
            >
              <div className="flex justify-between items-start flex-wrap gap-3 mb-4">
                <div>
                  <div className="text-xs font-bold text-blue-400 uppercase tracking-wider bg-blue-500/10 border border-blue-500/20 px-2.5 py-1 rounded-full inline-block">
                    Ep {pod.episode} · {pod.date} · {pod.bucket}
                  </div>
                  <h2 className="text-2xl font-black text-white mt-2">{pod.title}</h2>
                </div>
                <button
                  onClick={() => openPlayer(pod)}
                  className="relative group overflow-hidden bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 px-4 py-2 rounded-full text-xs font-bold text-white shadow-lg transition-all duration-300 hover:scale-105"
                >
                  <span className="relative z-10 flex items-center gap-1.5">
                    🎧 Open Narrated Debrief →
                  </span>
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -skew-x-12 animate-shine pointer-events-none" />
                </button>
              </div>

              <p className="text-gray-300 text-base leading-relaxed mb-6 bg-gray-950/40 p-4 rounded-xl border border-gray-850">{pod.summary}</p>

              <div className="grid md:grid-cols-2 gap-6 pt-4 border-t border-gray-800/50">
                <div className="bg-gray-850/20 p-5 rounded-2xl border border-gray-800/40">
                  <h3 className="text-base font-bold text-white mb-4 flex items-center gap-2">
                    <span className="text-lg">📋</span> Key Takeaways
                  </h3>
                  <ul className="space-y-3">
                    {pod.takeaways.map((t, idx) => (
                      <li key={idx} className="text-sm text-gray-300 flex gap-2.5 leading-relaxed">
                        <span className="text-blue-500 font-bold flex-shrink-0">▸</span>
                        <span>{t}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="bg-gray-850/20 p-5 rounded-2xl border border-gray-800/40">
                  <h3 className="text-base font-bold text-white mb-4 flex items-center gap-2">
                    <span className="text-lg">💡</span> Skills to Practice
                  </h3>
                  <ul className="space-y-4">
                    {pod.skills.map((s, idx) => {
                      const checked = !!skillState[`${pod.date}:${idx}`];
                      return (
                        <li key={idx} className="group">
                          <label className="flex gap-3 items-start cursor-pointer">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleSkill(pod.date, idx)}
                              className="mt-1 flex-shrink-0 w-5 h-5 rounded-lg border-gray-700 text-blue-600 focus:ring-blue-500 bg-gray-950 cursor-pointer"
                            />
                            <div className="text-sm">
                              <div className={`font-bold text-sm ${checked ? 'text-gray-500 line-through' : 'text-white'}`}>
                                {s.title}
                              </div>
                              <div className="text-gray-400 text-xs mt-1 leading-relaxed">{s.detail}</div>
                            </div>
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </div>

              {pod.homework && (
                <div className="mt-6 bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border border-emerald-500/30 rounded-2xl px-5 py-4 text-sm text-emerald-200 flex items-start gap-3">
                  <span className="text-lg mt-0.5">📝</span>
                  <div>
                    <strong className="font-bold text-emerald-400 text-base block mb-1">Homework Assignment:</strong>
                    <span className="text-sm text-gray-200">{pod.homework}</span>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Interactive Transcript / Content Explorer Modal */}
      {activePod && (
        <div
          className="fixed inset-0 z-40 flex items-start justify-center p-4 pt-16 bg-black/70 backdrop-blur-md animate-fade-in overflow-y-auto"
          onClick={() => setActivePod(null)}
        >
          <div
            className="max-w-4xl w-full bg-gray-900/80 backdrop-blur-xl border border-gray-700/50 rounded-3xl shadow-2xl overflow-hidden mb-40"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 p-6 border-b border-gray-800/60">
              <div>
                <div className="text-xs font-bold text-blue-400 uppercase tracking-wider">Ep {activePod.episode} · {activePod.date}</div>
                <h2 className="text-xl font-black text-white mt-1">{activePod.title}</h2>
              </div>
              <button onClick={() => setActivePod(null)} className="text-gray-400 hover:text-white text-2xl leading-none">×</button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <input
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="Search this episode's summary, takeaways, skills, homework..."
                  className="w-full bg-gray-950/60 border border-gray-800 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-gray-600 focus:border-blue-500/50 focus:outline-none"
                />
              </div>

              {query.trim() && (
                <div className="space-y-2">
                  <div className="text-xs uppercase font-bold tracking-wider text-gray-400">
                    {searchHits.length} match{searchHits.length === 1 ? '' : 'es'}
                  </div>
                  {searchHits.map((hit, idx) => (
                    <button
                      key={idx}
                      onClick={() => seekTo(hit.timestamp)}
                      className="w-full text-left bg-gray-950/40 hover:bg-blue-950/30 border border-gray-800/50 hover:border-blue-500/30 rounded-xl px-4 py-3 transition-colors"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] font-mono text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded">{formatClock(hit.timestamp)}</span>
                        <span className="text-[10px] uppercase text-gray-500 tracking-wider">{hit.field}</span>
                      </div>
                      <div className="text-sm text-gray-200">{hit.text}</div>
                    </button>
                  ))}
                  {searchHits.length === 0 && (
                    <div className="text-sm text-gray-500">No matches in this episode&apos;s content yet.</div>
                  )}
                </div>
              )}

              {!query.trim() && (
                <div>
                  <div className="text-xs uppercase font-bold tracking-wider text-gray-400 mb-2">Bookmarks (from key takeaways)</div>
                  <div className="space-y-2">
                    {bookmarks.map((b, idx) => (
                      <button
                        key={idx}
                        onClick={() => seekTo(b.seconds)}
                        className={`w-full text-left flex items-start gap-3 rounded-xl px-4 py-3 border transition-colors ${
                          Math.abs(currentTime - b.seconds) < 15
                            ? 'bg-blue-950/30 border-blue-500/40'
                            : 'bg-gray-950/40 border-gray-800/50 hover:border-gray-700'
                        }`}
                      >
                        <span className="text-[10px] font-mono text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded flex-shrink-0 mt-0.5">{formatClock(b.seconds)}</span>
                        <span className="text-sm text-gray-200">{b.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {activePod.source && (
                <div className="text-xs text-gray-500 pt-2 border-t border-gray-800/50">Source: {activePod.source}</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Persistent Bottom Audio Bar */}
      {activePod && (
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-black/60 backdrop-blur-md border-t border-gray-800 px-4 py-3">
          {activePod.audio && (
            <audio
              ref={audioRef}
              src={activePod.audio}
              onTimeUpdate={e => setCurrentTime(e.currentTarget.currentTime)}
              onLoadedMetadata={() => { 
                console.log('[Audio] Loaded metadata for:', activePod.audio);
                if (audioRef.current) audioRef.current.playbackRate = playbackRate; 
              }}
              onEnded={() => setIsPlaying(false)}
            />
          )}
          <div className="max-w-7xl mx-auto flex items-center gap-4">
            <button
              onClick={togglePlay}
              className="flex-shrink-0 w-11 h-11 rounded-full bg-blue-600 hover:bg-blue-500 flex items-center justify-center text-white shadow-lg transition-colors"
              aria-label={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? (
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M6 5h4v14H6zM14 5h4v14h-4z" /></svg>
              ) : (
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 ml-0.5"><path d="M8 5v14l11-7z" /></svg>
              )}
            </button>

            <div className="flex-1 min-w-0">
              <div className="text-xs font-bold text-white truncate">{activePod.title}</div>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[10px] font-mono text-gray-400 w-10">{formatClock(currentTime)}</span>
                <input
                  type="range"
                  min={0}
                  max={duration}
                  value={Math.min(currentTime, duration)}
                  onChange={e => seekTo(Number(e.target.value))}
                  className="flex-1 h-1.5 rounded-full accent-blue-500 bg-gray-800 cursor-pointer"
                />
                <span className="text-[10px] font-mono text-gray-400 w-10">{formatClock(duration)}</span>
              </div>
            </div>

            <div className="flex items-center gap-1 flex-shrink-0">
              {[0.75, 1, 1.25, 1.5, 2].map(rate => (
                <button
                  key={rate}
                  onClick={() => setPlaybackRate(rate)}
                  className={`text-[10px] font-mono px-2 py-1 rounded-md border transition-colors ${
                    playbackRate === rate ? 'bg-blue-600 border-blue-500 text-white' : 'bg-gray-900/60 border-gray-800 text-gray-400 hover:border-gray-700'
                  }`}
                >
                  {rate}x
                </button>
              ))}
            </div>

            <button onClick={() => setActivePod(null)} className="flex-shrink-0 text-gray-500 hover:text-white text-sm px-2">✕</button>
          </div>
        </div>
      )}

      <style jsx global>{`
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slide-in-left {
          from { opacity: 0; transform: translateX(-20px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes shine {
          from { transform: translateX(-100%) skewX(-12deg); }
          to { transform: translateX(200%) skewX(-12deg); }
        }
        .animate-fade-in {
          animation: fade-in 0.3s ease-out forwards;
        }
        .animate-slide-in-left {
          animation: slide-in-left 0.6s ease-out forwards;
        }
        .animate-shine {
          animation: shine 3s ease-in-out infinite;
        }
      `}</style>
    </motion.div>
  );
}
