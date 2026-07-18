'use client';

/**
 * SFRE Board Simulator — live voice mock board via OpenAI Realtime (WebRTC).
 * Cadre persona (SGM Reyes) runs a cold board interview, interrupts, pushes
 * back, then calls submit_grade. Grades persist to sfprep:boardsim via the
 * existing sfprep-sync CRDT store.
 */

import { useEffect, useRef, useState } from 'react';
import { Nav } from '../components/Nav';
import { pullSfprepSync, pushSfprepSync } from '../lib/sfprep-sync';

const STORAGE_KEY = 'sfprep:boardsim';

type Grade = {
  ts: string;
  composure: number;
  content: number;
  delivery: number;
  overall: number;
  verdict: 'pass' | 'marginal' | 'not-ready';
  strengths: string[];
  improvements: string[];
};

type TranscriptLine = { role: 'cadre' | 'you'; text: string };

function loadGrades(): Grade[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
  } catch {
    return [];
  }
}

function saveGrade(g: Grade) {
  const all = [...loadGrades(), g];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  try {
    pushSfprepSync();
  } catch {
    /* sync best-effort */
  }
  return all;
}

const VERDICT_META: Record<Grade['verdict'], { label: string; cls: string }> = {
  pass: { label: 'PASS', cls: 'bg-green-700 text-green-100' },
  marginal: { label: 'MARGINAL', cls: 'bg-yellow-700 text-yellow-100' },
  'not-ready': { label: 'NOT READY', cls: 'bg-red-800 text-red-100' },
};

export default function BoardSimPage() {
  const [status, setStatus] = useState<'idle' | 'connecting' | 'live' | 'graded' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<TranscriptLine[]>([]);
  const [grade, setGrade] = useState<Grade | null>(null);
  const [history, setHistory] = useState<Grade[]>([]);
  const [elapsed, setElapsed] = useState(0);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const gradedCallIds = useRef<Set<string>>(new Set());
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const transcriptEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    try {
      pullSfprepSync().catch(() => {});
    } catch {
      /* offline ok */
    }
    setHistory(loadGrades());
    return () => cleanup();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcript]);

  function cleanup() {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    dcRef.current?.close();
    pcRef.current?.close();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    dcRef.current = null;
    pcRef.current = null;
    streamRef.current = null;
  }

  function handleGradeCall(callId: string, argsJson: string) {
    if (gradedCallIds.current.has(callId)) return;
    gradedCallIds.current.add(callId);
    try {
      const args = JSON.parse(argsJson);
      const g: Grade = {
        ts: new Date().toISOString(),
        composure: Number(args.composure) || 0,
        content: Number(args.content) || 0,
        delivery: Number(args.delivery) || 0,
        overall: Number(args.overall) || 0,
        verdict: (['pass', 'marginal', 'not-ready'].includes(args.verdict) ? args.verdict : 'not-ready') as Grade['verdict'],
        strengths: Array.isArray(args.strengths) ? args.strengths.map(String) : [],
        improvements: Array.isArray(args.improvements) ? args.improvements.map(String) : [],
      };
      setGrade(g);
      setHistory(saveGrade(g));
      setStatus('graded');
      // Return tool output + unblock the model so it delivers the debrief.
      dcRef.current?.send(
        JSON.stringify({
          type: 'conversation.item.create',
          item: { type: 'function_call_output', call_id: callId, output: JSON.stringify({ recorded: true }) },
        }),
      );
      dcRef.current?.send(JSON.stringify({ type: 'response.create' }));
    } catch (e) {
      console.error('grade parse failed', e);
    }
  }

  function handleEvent(raw: string) {
    let msg: Record<string, unknown>;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }
    const type = msg.type as string;

    // Cadre speech transcript
    if (type === 'response.output_audio_transcript.done' || type === 'response.audio_transcript.done') {
      const text = (msg.transcript as string) ?? '';
      if (text.trim()) setTranscript((t) => [...t, { role: 'cadre', text }]);
    }
    // Your speech transcript
    if (type === 'conversation.item.input_audio_transcription.completed') {
      const text = (msg.transcript as string) ?? '';
      if (text.trim()) setTranscript((t) => [...t, { role: 'you', text }]);
    }
    // Function calls — ignore deltas entirely; parse complete args on done
    // events and dedupe by call_id (both event kinds can fire per call).
    if (type === 'response.function_call_arguments.done') {
      const m = msg as { call_id?: string; name?: string; arguments?: string };
      if (m.name === 'submit_grade' && m.call_id && m.arguments) handleGradeCall(m.call_id, m.arguments);
    }
    if (type === 'response.output_item.done') {
      const item = (msg as { item?: { type?: string; call_id?: string; name?: string; arguments?: string } }).item;
      if (item?.type === 'function_call' && item.name === 'submit_grade' && item.call_id && item.arguments) {
        handleGradeCall(item.call_id, item.arguments);
      }
    }
  }

  async function startBoard() {
    setStatus('connecting');
    setError(null);
    setTranscript([]);
    setGrade(null);
    setElapsed(0);
    gradedCallIds.current = new Set();
    try {
      const sessRes = await fetch('/api/board-sim/session', { method: 'POST' });
      if (!sessRes.ok) throw new Error(`session mint failed: ${await sessRes.text()}`);
      const { ephemeralKey, model } = await sessRes.json();

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const pc = new RTCPeerConnection();
      pcRef.current = pc;
      stream.getTracks().forEach((t) => pc.addTrack(t, stream));
      pc.ontrack = (e) => {
        if (audioRef.current) audioRef.current.srcObject = e.streams[0];
      };

      const dc = pc.createDataChannel('oai-events');
      dcRef.current = dc;
      dc.onmessage = (e) => handleEvent(e.data);
      dc.onopen = () => {
        // Kick off: cadre opens the board immediately, no "ready?" question.
        dc.send(
          JSON.stringify({
            type: 'response.create',
            response: {
              instructions:
                'The candidate just walked in and sat down. Open the board now with your one-line opener. Do not ask if he is ready.',
            },
          }),
        );
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      const sdpRes = await fetch(`https://api.openai.com/v1/realtime/calls?model=${encodeURIComponent(model)}`, {
        method: 'POST',
        body: offer.sdp,
        headers: { Authorization: `Bearer ${ephemeralKey}`, 'Content-Type': 'application/sdp' },
      });
      if (!sdpRes.ok) throw new Error(`SDP exchange failed: ${sdpRes.status}`);
      await pc.setRemoteDescription({ type: 'answer', sdp: await sdpRes.text() });

      setStatus('live');
      timerRef.current = setInterval(() => setElapsed((s) => s + 1), 1000);
    } catch (e) {
      cleanup();
      setError(e instanceof Error ? e.message : String(e));
      setStatus('error');
    }
  }

  function endBoard() {
    // Ask the cadre to wrap + grade rather than hard-killing the connection.
    if (dcRef.current?.readyState === 'open' && status === 'live') {
      dcRef.current.send(
        JSON.stringify({
          type: 'response.create',
          response: {
            instructions:
              'The candidate has requested to end the board. Dismiss him ("That\'s all we need"), call submit_grade NOW with your honest evaluation of what you saw (even if brief), then give the out-of-character debrief.',
          },
        }),
      );
    } else {
      cleanup();
      setStatus('idle');
    }
  }

  function hardStop() {
    cleanup();
    setStatus(grade ? 'graded' : 'idle');
  }

  const mm = String(Math.floor(elapsed / 60)).padStart(2, '0');
  const ss = String(elapsed % 60).padStart(2, '0');

  return (
    <main className="max-w-3xl mx-auto p-4 text-gray-100">
      <Nav />
      <audio ref={audioRef} autoPlay />
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold">🎙️ SFRE Board Simulator</h1>
        {status === 'live' && <span className="text-sm font-mono bg-red-900 text-red-100 px-2 py-1 rounded animate-pulse">● LIVE {mm}:{ss}</span>}
      </div>

      {status === 'idle' && (
        <div className="bg-gray-900 rounded-lg p-5 space-y-3">
          <p className="text-sm text-gray-300">
            Live-voice mock board. SGM Reyes (SF cadre persona) runs a real board interview — one question at a
            time, pushback, interruptions. 12–18 minutes. At the end you get graded on composure, content, and
            delivery, then a coaching debrief.
          </p>
          <p className="text-xs text-gray-500">
            Stand up. Answer out loud like it&apos;s real. Costs ~$0.30/min (~$4–5/session). Mic required.
          </p>
          <button onClick={startBoard} className="bg-green-700 hover:bg-green-600 px-5 py-2.5 rounded font-semibold">
            Enter the board
          </button>
        </div>
      )}

      {status === 'connecting' && <div className="bg-gray-900 rounded-lg p-5 text-sm text-gray-400">Connecting…</div>}

      {status === 'error' && (
        <div className="bg-red-950 border border-red-800 rounded-lg p-5 space-y-2">
          <p className="text-sm text-red-200">Failed: {error}</p>
          <button onClick={startBoard} className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded text-sm">Retry</button>
        </div>
      )}

      {(status === 'live' || status === 'graded') && (
        <div className="space-y-4">
          {status === 'live' && (
            <div className="flex gap-2">
              <button onClick={endBoard} className="bg-yellow-800 hover:bg-yellow-700 px-4 py-2 rounded text-sm">
                End board → get graded
              </button>
              <button onClick={hardStop} className="bg-gray-800 hover:bg-gray-700 px-4 py-2 rounded text-sm">
                Hard stop (no grade)
              </button>
            </div>
          )}
          <div className="bg-gray-900 rounded-lg p-4 max-h-96 overflow-y-auto space-y-2">
            {transcript.length === 0 && <p className="text-sm text-gray-500">Waiting for the board to open…</p>}
            {transcript.map((line, i) => (
              <p key={i} className="text-sm">
                <span className={line.role === 'cadre' ? 'text-amber-400 font-semibold' : 'text-blue-400 font-semibold'}>
                  {line.role === 'cadre' ? 'SGM Reyes' : 'You'}:
                </span>{' '}
                <span className="text-gray-200">{line.text}</span>
              </p>
            ))}
            <div ref={transcriptEndRef} />
          </div>
        </div>
      )}

      {grade && (
        <div className="mt-4 bg-gray-900 border border-gray-700 rounded-lg p-5 space-y-3">
          <div className="flex items-center gap-3">
            <span className={`px-3 py-1 rounded font-bold text-sm ${VERDICT_META[grade.verdict].cls}`}>{VERDICT_META[grade.verdict].label}</span>
            <span className="text-2xl font-bold">{grade.overall}/100</span>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center text-sm">
            {(['composure', 'content', 'delivery'] as const).map((k) => (
              <div key={k} className="bg-gray-800 rounded p-2">
                <div className="text-lg font-bold">{grade[k]}</div>
                <div className="text-xs text-gray-400 capitalize">{k}</div>
              </div>
            ))}
          </div>
          <div>
            <p className="text-xs font-semibold text-green-400 mb-1">STRENGTHS</p>
            {grade.strengths.map((s, i) => (<p key={i} className="text-sm text-gray-300">• {s}</p>))}
          </div>
          <div>
            <p className="text-xs font-semibold text-yellow-400 mb-1">FIX BEFORE NEXT BOARD</p>
            {grade.improvements.map((s, i) => (<p key={i} className="text-sm text-gray-300">• {s}</p>))}
          </div>
          <button onClick={() => { cleanup(); setStatus('idle'); }} className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded text-sm">
            Done
          </button>
        </div>
      )}

      {history.length > 0 && status === 'idle' && (
        <div className="mt-6">
          <h2 className="text-sm font-semibold text-gray-400 mb-2">PAST BOARDS ({history.length})</h2>
          <div className="space-y-1">
            {history.slice(-8).reverse().map((g, i) => (
              <div key={i} className="flex items-center gap-3 bg-gray-900 rounded px-3 py-2 text-sm">
                <span className={`px-2 py-0.5 rounded text-xs font-bold ${VERDICT_META[g.verdict].cls}`}>{VERDICT_META[g.verdict].label}</span>
                <span className="font-mono">{g.overall}/100</span>
                <span className="text-gray-500 text-xs">{new Date(g.ts).toLocaleDateString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}
