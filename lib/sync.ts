import type { AccountabilityLog, PomodoroSession, Task } from '@/types/matrix';

/** The unit of sync: everything the server keeps for the signed-in user. */
export interface RemoteState {
  tasks: Task[];
  logs: AccountabilityLog[];
  sessions: PomodoroSession[];
}

const ENDPOINT = '/api/state';

/** Long enough that a burst of edits collapses into one write, short enough
 *  that closing the tab a second later still catches the flush. */
const DEBOUNCE_MS = 800;

export async function pullRemoteState(): Promise<RemoteState> {
  const res = await fetch(ENDPOINT, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Failed to load state (${res.status})`);
  const data = (await res.json()) as Partial<RemoteState>;
  return {
    tasks: data.tasks ?? [],
    logs: data.logs ?? [],
    sessions: data.sessions ?? [],
  };
}

export async function pushRemoteState(state: RemoteState): Promise<void> {
  const res = await fetch(ENDPOINT, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(state),
  });
  if (!res.ok) throw new Error(`Failed to save state (${res.status})`);
}

/* ------------------------------------------------------------------ *
 * Debounced background sync
 *
 * The store stays local-first: every mutation lands in memory and
 * IndexedDB immediately, and the server catches up a moment later. A
 * failed push is not surfaced as an error the user must handle — the
 * local copy is intact and the next mutation retries.
 * ------------------------------------------------------------------ */

type SnapshotFn = () => RemoteState | null;

let snapshot: SnapshotFn = () => null;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let inFlight: Promise<void> | null = null;
/** A mutation that arrived while a push was already running. */
let dirtyDuringFlight = false;
let listenersBound = false;

/** Points the sync layer at the live store state. Called once, on hydrate. */
export function configureSync(fn: SnapshotFn) {
  snapshot = fn;
  bindUnloadFlush();
}

export function resetSync() {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = null;
  dirtyDuringFlight = false;
  snapshot = () => null;
}

async function push(): Promise<void> {
  const state = snapshot();
  if (!state) return;

  try {
    await pushRemoteState(state);
  } catch (err) {
    // Local data is still correct; the next edit (or reload) will resync.
    console.warn('Background sync failed, will retry on next change:', err);
  }
}

async function runPush(): Promise<void> {
  do {
    dirtyDuringFlight = false;
    await push();
    // Anything that changed mid-push has to go out too, or it would sit
    // unsent until the user happens to edit again.
  } while (dirtyDuringFlight);
}

/** Queue a push. Repeated calls collapse into a single write. */
export function scheduleSync() {
  if (typeof window === 'undefined') return;

  if (inFlight) {
    dirtyDuringFlight = true;
    return;
  }

  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    inFlight = runPush().finally(() => {
      inFlight = null;
    });
  }, DEBOUNCE_MS);
}

/** Push immediately and wait for it — used by destructive, one-shot actions. */
export async function flushSync(): Promise<void> {
  if (typeof window === 'undefined') return;
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
  if (inFlight) await inFlight;
  await runPush();
}

/**
 * A tab closed mid-debounce would otherwise drop the last edit. `sendBeacon`
 * survives unload where `fetch` does not; the API accepts POST for exactly
 * this reason.
 */
function bindUnloadFlush() {
  if (listenersBound || typeof window === 'undefined') return;
  listenersBound = true;

  const flushOnHide = () => {
    // Only worth a beacon if a debounced write is still outstanding.
    if (!debounceTimer && !dirtyDuringFlight) return;
    const state = snapshot();
    if (!state) return;

    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }

    try {
      const blob = new Blob([JSON.stringify(state)], { type: 'application/json' });
      navigator.sendBeacon(ENDPOINT, blob);
    } catch {
      // Nothing useful to do during unload.
    }
  };

  window.addEventListener('pagehide', flushOnHide);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushOnHide();
  });
}
