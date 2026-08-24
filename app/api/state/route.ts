import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { loadUserState, sanitizeUserState, saveUserState } from '@/lib/db/user-data';

/** The Mongo driver is a Node library — it cannot run on the edge runtime. */
export const runtime = 'nodejs';
/** Per-user data behind a session cookie; nothing here is ever cacheable. */
export const dynamic = 'force-dynamic';

/** Well above a realistic snapshot, well below anything that could hurt Mongo. */
const MAX_BODY_BYTES = 8 * 1024 * 1024;

const unauthorized = () => NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

export async function GET() {
  const { userId } = await auth();
  if (!userId) return unauthorized();

  try {
    const state = await loadUserState(userId);
    return NextResponse.json(state);
  } catch (err) {
    console.error('[api/state] load failed:', err);
    return NextResponse.json({ error: 'Failed to load state' }, { status: 500 });
  }
}

/**
 * Accepts the client's full snapshot and makes the stored set match it. The
 * client is authoritative: it is the only writer for a given account, and it
 * already holds every task in memory, so a whole-snapshot write is both the
 * simplest and the most consistent thing to store.
 */
async function writeState(request: Request) {
  const { userId } = await auth();
  if (!userId) return unauthorized();

  const declaredLength = Number(request.headers.get('content-length') ?? 0);
  if (declaredLength > MAX_BODY_BYTES) {
    return NextResponse.json({ error: 'Payload too large' }, { status: 413 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  try {
    const state = sanitizeUserState(body);
    await saveUserState(userId, state);
    return NextResponse.json({
      ok: true,
      counts: {
        tasks: state.tasks.length,
        logs: state.logs.length,
        sessions: state.sessions.length,
      },
    });
  } catch (err) {
    console.error('[api/state] save failed:', err);
    return NextResponse.json({ error: 'Failed to save state' }, { status: 500 });
  }
}

export const PUT = writeState;
/** `navigator.sendBeacon` can only issue POSTs — this is the unload-time path. */
export const POST = writeState;
