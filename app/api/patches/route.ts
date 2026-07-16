import { NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import path from 'path';

const PATCH_FILE = path.join(process.cwd(), '.data', 'plan-d-patches.json');

// GET — return the approved Plan D adjustments (from suggestion approvals).
// Degrades gracefully to an empty list if the file doesn't exist yet.
export async function GET() {
  try {
    const raw = await readFile(PATCH_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    const patches = parsed && Array.isArray(parsed.patches) ? parsed.patches : [];
    // newest first
    patches.sort((a: { approved_at?: string }, b: { approved_at?: string }) =>
      String(b.approved_at || '').localeCompare(String(a.approved_at || '')),
    );
    return NextResponse.json({ patches });
  } catch {
    return NextResponse.json({ patches: [] });
  }
}
