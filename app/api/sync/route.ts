import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');
const STATE_FILE = path.join(DATA_DIR, 'sync-state.json');

async function ensureFile() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(STATE_FILE);
  } catch {
    await fs.writeFile(STATE_FILE, JSON.stringify({ keys: {}, updatedAt: null }));
  }
}

// GET /api/sync -> { keys: { 'sfprep:...': <value>, ... }, updatedAt }
export async function GET() {
  await ensureFile();
  const raw = await fs.readFile(STATE_FILE, 'utf-8');
  const data = JSON.parse(raw);
  return NextResponse.json(data, {
    headers: { 'Cache-Control': 'no-store' },
  });
}

// POST /api/sync  body: { keys: {...}, deviceId?: string }
// Merges: last-write-wins per key. Never deletes keys the server has but client doesn't send.
export async function POST(req: NextRequest) {
  await ensureFile();
  const body = await req.json();
  if (!body || typeof body.keys !== 'object') {
    return NextResponse.json({ error: 'missing keys' }, { status: 400 });
  }
  const raw = await fs.readFile(STATE_FILE, 'utf-8');
  const current = JSON.parse(raw);
  const merged = { ...(current.keys || {}), ...body.keys };
  const next = { keys: merged, updatedAt: new Date().toISOString(), lastDevice: body.deviceId || null };
  await fs.writeFile(STATE_FILE, JSON.stringify(next, null, 2));
  return NextResponse.json({ ok: true, updatedAt: next.updatedAt });
}
