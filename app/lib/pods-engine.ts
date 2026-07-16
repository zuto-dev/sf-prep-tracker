// Podcast Debriefs — Automated Syllabus Parser & Audio Engine (Blueprint SECTION 9)
//
// Grounded in real data: pods.json fields only. No transcript files exist on disk
// yet (no `transcriptMarkdownPath` cron output found in the repo), so
// `searchTranscript` operates over the REAL fields that do exist today —
// summary + takeaways + skills + homework — rather than fabricating transcript
// text. Bookmarks are derived from the real `takeaways` array (evenly spaced
// across the reported/estimated audio duration) so the UI has real, traceable
// anchors instead of invented timestamps.

export type Skill = { title: string; detail: string; done?: boolean };

export type Pod = {
  date: string;         // YYYY-MM-DD
  episode: number;
  title: string;
  bucket: string;
  audio?: string;
  summary: string;
  takeaways: string[];
  skills: Skill[];
  homework?: string;
  source?: string;
};

export interface AudioTimestampBookmark {
  seconds: number;
  label: string;
  relatedSkillKey?: string;
}

export interface TranscriptHit {
  text: string;
  timestamp: number;
  field: 'summary' | 'takeaway' | 'skill' | 'homework';
}

/** Default runtime estimate (seconds) when a pod has no audio duration metadata. */
export const DEFAULT_DURATION_SECONDS = 25 * 60;

/**
 * Builds bookmark markers from the REAL structured fields already present in
 * pods.json — one per takeaway, evenly distributed across the estimated
 * episode duration. This gives the audio bar real navigation points without
 * inventing transcript data that doesn't exist yet.
 */
export function buildBookmarks(pod: Pod, durationSeconds = DEFAULT_DURATION_SECONDS): AudioTimestampBookmark[] {
  const n = pod.takeaways.length;
  if (n === 0) return [];
  const step = durationSeconds / (n + 1);
  return pod.takeaways.map((t, i) => ({
    seconds: Math.round(step * (i + 1)),
    label: t.length > 60 ? `${t.slice(0, 57)}...` : t,
  }));
}

/**
 * Searches the real structured fields of a pod (summary/takeaways/skills/homework)
 * for a query string and returns matches mapped to the nearest bookmark timestamp.
 * This is the client-side stand-in for Blueprint 9.3's `searchTranscript` until a
 * real transcript file pipeline exists — same contract (text + timestamp), backed
 * by real content instead of a nonexistent markdown file.
 */
export function searchPodContent(pod: Pod, query: string, bookmarks: AudioTimestampBookmark[]): TranscriptHit[] {
  const q = query.trim();
  if (!q) return [];
  let re: RegExp;
  try {
    re = new RegExp(q, 'gi');
  } catch {
    return [];
  }

  const hits: TranscriptHit[] = [];
  const nearestBookmark = (idx: number, total: number) => {
    if (bookmarks.length === 0) return 0;
    const fraction = total > 1 ? idx / (total - 1) : 0;
    const target = Math.round(fraction * bookmarks[bookmarks.length - 1].seconds);
    return bookmarks.reduce((prev, curr) =>
      Math.abs(curr.seconds - target) < Math.abs(prev.seconds - target) ? curr : prev
    , bookmarks[0]).seconds;
  };

  if (re.test(pod.summary)) {
    hits.push({ text: pod.summary, timestamp: nearestBookmark(0, 1), field: 'summary' });
  }
  pod.takeaways.forEach((t, i) => {
    re.lastIndex = 0;
    if (re.test(t)) hits.push({ text: t, timestamp: nearestBookmark(i, pod.takeaways.length), field: 'takeaway' });
  });
  pod.skills.forEach((s, i) => {
    re.lastIndex = 0;
    if (re.test(`${s.title} ${s.detail}`)) {
      hits.push({ text: `${s.title} — ${s.detail}`, timestamp: nearestBookmark(i, pod.skills.length), field: 'skill' });
    }
  });
  if (pod.homework) {
    re.lastIndex = 0;
    if (re.test(pod.homework)) hits.push({ text: pod.homework, timestamp: nearestBookmark(0, 1), field: 'homework' });
  }

  return hits;
}

export function formatClock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, '0')}`;
}
