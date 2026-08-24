import type { AnyBulkWriteOperation, Collection, Document } from 'mongodb';
import { getDb } from '@/lib/mongodb';
import type {
  AccountabilityLog,
  BlockerCategory,
  CompletionState,
  PomodoroSession,
  Priority,
  SubTask,
  Task,
  TaskCategory,
  TaskStatus,
} from '@/types/matrix';

/**
 * The shape every row shares. `_id` is a deterministic `userId:entityId`
 * string rather than an ObjectId, which makes each write an idempotent upsert.
 */
interface StoredDoc extends Document {
  _id: string;
  userId: string;
  order: number;
}

export interface UserState {
  tasks: Task[];
  logs: AccountabilityLog[];
  sessions: PomodoroSession[];
}

const COLLECTIONS = {
  tasks: 'tasks',
  logs: 'accountability_logs',
  sessions: 'sessions',
} as const;

/**
 * Upper bounds, enforced on write. They exist so a malformed or hostile client
 * cannot push an unbounded payload into the cluster — they sit far above what
 * real use produces.
 */
const LIMITS = { tasks: 5000, logs: 5000, sessions: 20000, subtasks: 200, text: 20000 };

/** Every stored entity is keyed by owner so one user can never read another's. */
const docId = (userId: string, id: string) => `${userId}:${id}`;

/* ------------------------------------------------------------------ *
 * Validation — the API body is untrusted, so each field is picked
 * explicitly by name and type. Anything unrecognised is dropped rather
 * than persisted.
 * ------------------------------------------------------------------ */

const TASK_STATUSES: TaskStatus[] = ['inbox', 'do_first', 'schedule', 'delegate', 'eliminate'];
const COMPLETION_STATES: CompletionState[] = ['pending', 'completed', 'failed'];
const PRIORITIES: Priority[] = ['high', 'normal', 'low'];
const TASK_CATEGORIES: TaskCategory[] = ['work', 'personal', 'content'];
const BLOCKER_CATEGORIES: BlockerCategory[] = [
  'underestimated_time',
  'distracted_procrastination',
  'scope_creep',
  'external_dependency',
  'low_energy_burnout',
  'poor_clarity',
  'other',
];
const RESOLUTIONS: AccountabilityLog['resolution'][] = [
  'rescheduled',
  'eliminated',
  'marked_failed',
];

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/** A string, truncated rather than rejected so a long note still saves. */
const str = (v: unknown): string | undefined =>
  typeof v === 'string' ? v.slice(0, LIMITS.text) : undefined;

const reqStr = (v: unknown): string | null => {
  const s = str(v);
  return s && s.length > 0 ? s : null;
};

const oneOf = <T extends string>(v: unknown, allowed: readonly T[]): T | undefined =>
  typeof v === 'string' && (allowed as readonly string[]).includes(v) ? (v as T) : undefined;

/** Non-negative finite number; anything else (NaN, Infinity, strings) is dropped. */
const num = (v: unknown): number | undefined =>
  typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : undefined;

const bool = (v: unknown): boolean => v === true;

/** Nullable date string. `null` is meaningful here — an explicitly cleared date. */
const nullableStr = (v: unknown): string | null | undefined => {
  if (v === null) return null;
  return str(v);
};

function sanitizeSubtask(raw: unknown): SubTask | null {
  if (!isRecord(raw)) return null;
  const id = reqStr(raw.id);
  if (!id) return null;
  return {
    id,
    content: str(raw.content) ?? '',
    completed: bool(raw.completed),
    priority: oneOf(raw.priority, PRIORITIES) ?? 'normal',
  };
}

function sanitizeTask(raw: unknown): Task | null {
  if (!isRecord(raw)) return null;
  const id = reqStr(raw.id);
  if (!id) return null;

  return {
    id,
    content: str(raw.content) ?? '',
    originalRawInput: str(raw.originalRawInput),
    parsedDate: nullableStr(raw.parsedDate) ?? null,
    deferUntil: str(raw.deferUntil),
    status: oneOf(raw.status, TASK_STATUSES) ?? 'inbox',
    category: oneOf(raw.category, TASK_CATEGORIES),
    completionState: oneOf(raw.completionState, COMPLETION_STATES) ?? 'pending',
    createdAt: str(raw.createdAt) ?? new Date().toISOString(),
    completedAt: str(raw.completedAt),
    failureReason: str(raw.failureReason),
    blockerCategory: oneOf(raw.blockerCategory, BLOCKER_CATEGORIES),
    subtasks: Array.isArray(raw.subtasks)
      ? raw.subtasks
          .slice(0, LIMITS.subtasks)
          .map(sanitizeSubtask)
          .filter((s): s is SubTask => s !== null)
      : [],
    notes: str(raw.notes) ?? '',
  };
}

function sanitizeLog(raw: unknown): AccountabilityLog | null {
  if (!isRecord(raw)) return null;
  const id = reqStr(raw.id);
  const taskId = reqStr(raw.taskId);
  if (!id || !taskId) return null;

  return {
    id,
    taskId,
    taskTitle: str(raw.taskTitle) ?? '',
    category: oneOf(raw.category, BLOCKER_CATEGORIES) ?? 'other',
    reason: str(raw.reason) ?? '',
    loggedAt: str(raw.loggedAt) ?? new Date().toISOString(),
    statusAtFailure: oneOf(raw.statusAtFailure, TASK_STATUSES) ?? 'inbox',
    resolution: oneOf(raw.resolution, RESOLUTIONS) ?? 'marked_failed',
    originalDueDate: nullableStr(raw.originalDueDate),
    newDueDate: nullableStr(raw.newDueDate),
  };
}

function sanitizeSession(raw: unknown): PomodoroSession | null {
  if (!isRecord(raw)) return null;
  const id = reqStr(raw.id);
  const startedAt = reqStr(raw.startedAt);
  const endedAt = reqStr(raw.endedAt);
  if (!id || !startedAt || !endedAt) return null;

  return {
    id,
    label: str(raw.label) ?? '',
    taskId: str(raw.taskId),
    source: oneOf(raw.source, ['focus', 'pomodoro'] as const) ?? 'pomodoro',
    plannedMs: num(raw.plannedMs) ?? 0,
    startedAt,
    endedAt,
    workedMs: num(raw.workedMs) ?? 0,
    pausedMs: num(raw.pausedMs) ?? 0,
    pauseCount: num(raw.pauseCount) ?? 0,
    outcome: oneOf(raw.outcome, ['completed', 'abandoned'] as const) ?? 'abandoned',
  };
}

/** Drops duplicate ids — the first occurrence wins, matching the client arrays. */
function dedupeById<T extends { id: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of items) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    out.push(item);
  }
  return out;
}

/** Turns an untrusted request body into a state snapshot safe to persist. */
export function sanitizeUserState(body: unknown): UserState {
  const b = isRecord(body) ? body : {};
  const pick = <T extends { id: string }>(
    value: unknown,
    fn: (raw: unknown) => T | null,
    limit: number
  ): T[] =>
    Array.isArray(value)
      ? dedupeById(value.slice(0, limit).map(fn).filter((v): v is T => v !== null))
      : [];

  return {
    tasks: pick(b.tasks, sanitizeTask, LIMITS.tasks),
    logs: pick(b.logs, sanitizeLog, LIMITS.logs),
    sessions: pick(b.sessions, sanitizeSession, LIMITS.sessions),
  };
}

/* ------------------------------------------------------------------ *
 * Persistence
 * ------------------------------------------------------------------ */

let indexesReady: Promise<void> | null = null;

/**
 * Built once per process. `order` is part of the index because every read is an
 * ordered scan of a single user's rows — the client holds these as arrays whose
 * order carries meaning (matrix ordering, newest-first history).
 */
function ensureIndexes(): Promise<void> {
  indexesReady ??= (async () => {
    const db = await getDb();
    await Promise.all(
      Object.values(COLLECTIONS).map((name) =>
        db.collection(name).createIndex({ userId: 1, order: 1 })
      )
    );
  })().catch((err) => {
    // A failed build must not wedge the process into never trying again.
    indexesReady = null;
    throw err;
  });
  return indexesReady;
}

async function readOrdered<T>(collection: Collection<StoredDoc>, userId: string): Promise<T[]> {
  const docs = await collection
    .find({ userId }, { projection: { _id: 0, userId: 0, order: 0 } })
    .sort({ order: 1 })
    .toArray();
  return docs as T[];
}

/**
 * Replaces one collection's rows for a user with `items`, preserving array order
 * via an explicit `order` field. Rows whose id is no longer present are removed,
 * so the stored set mirrors the client snapshot exactly.
 */
async function replaceAll<T extends { id: string }>(
  collection: Collection<StoredDoc>,
  userId: string,
  items: T[]
): Promise<void> {
  if (items.length > 0) {
    const ops: AnyBulkWriteOperation<StoredDoc>[] = items.map((item, order) => ({
      replaceOne: {
        filter: { _id: docId(userId, item.id) },
        replacement: { userId, order, ...item },
        upsert: true,
      },
    }));
    await collection.bulkWrite(ops, { ordered: false });
  }

  await collection.deleteMany({
    userId,
    _id: { $nin: items.map((item) => docId(userId, item.id)) },
  });
}

export async function loadUserState(userId: string): Promise<UserState> {
  await ensureIndexes();
  const db = await getDb();
  const [tasks, logs, sessions] = await Promise.all([
    readOrdered<Task>(db.collection<StoredDoc>(COLLECTIONS.tasks), userId),
    readOrdered<AccountabilityLog>(db.collection<StoredDoc>(COLLECTIONS.logs), userId),
    readOrdered<PomodoroSession>(db.collection<StoredDoc>(COLLECTIONS.sessions), userId),
  ]);
  return { tasks, logs, sessions };
}

export async function saveUserState(userId: string, state: UserState): Promise<void> {
  await ensureIndexes();
  const db = await getDb();
  await Promise.all([
    replaceAll(db.collection<StoredDoc>(COLLECTIONS.tasks), userId, state.tasks),
    replaceAll(db.collection<StoredDoc>(COLLECTIONS.logs), userId, state.logs),
    replaceAll(db.collection<StoredDoc>(COLLECTIONS.sessions), userId, state.sessions),
  ]);
}
