// Shared type for mobility library moves — extracted from app/mobility/page.tsx
// so both the page and the biomechanics engine can import it without a cycle.

export type Move = {
  name: string;
  target: string;
  time: string;         // clear time prescription
  how: string[];        // step-by-step
  cue: string;          // one-line focus
  videoId: string;      // YouTube 11-char ID
  tag: 'hips' | 'ankles' | 'knees' | 'posterior' | 'shoulders' | 't-spine';
};
