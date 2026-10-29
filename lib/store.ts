import { create } from 'zustand';
import { get, set } from 'idb-keyval';
import { AccountabilityLog, AppView, BlockerCategory, CategoryFilter, CompletionState, PomodoroSession, Priority, SubTask, Task, TaskCategory, TaskStatus } from '@/types/matrix';
import { parseTaskInput } from './nlp-parser';
import { configureSync, flushSync, pullRemoteState, resetSync, scheduleSync } from './sync';

const TASKS_STORAGE_KEY = 'focus_matrix_tasks_v1';
const LOGS_STORAGE_KEY = 'focus_matrix_logs_v1';
const SESSIONS_STORAGE_KEY = 'focus_matrix_sessions_v1';
const TIMER_STORAGE_KEY = 'focus_matrix_timer_v1';
/** Set once this account's cache has been reconciled with the server at least once. */
const SYNCED_MARKER_KEY = 'focus_matrix_synced_v1';

/**
 * MongoDB is the source of truth now that accounts exist; IndexedDB is kept as
 * a per-user cache so the app opens instantly and keeps working offline.
 *
 * Keys are scoped by account — two people signing in on the same browser must
 * never see each other's cached tasks.
 */
let activeUserId: string | null = null;
const scopedKey = (base: string) => (activeUserId ? `${base}::${activeUserId}` : base);

/** A block older than this on restore is stale; it is dropped, never logged. */
const STALE_BLOCK_MS = 12 * 3600_000;
/** How far past its deadline a block may be found and still count as completed. */
const GRACE_MS = 10 * 60_000;

interface MatrixState {
  tasks: Task[];
  logs: AccountabilityLog[];
  isHydrated: boolean;
  activeView: AppView;
  /**
   * Which context you are working in. Session-only: a mode is about the hour
   * you are in, not a setting worth restoring days later.
   */
  activeCategory: CategoryFilter;
  setActiveCategory: (category: CategoryFilter) => void;
  setTaskCategory: (taskId: string, category: TaskCategory | undefined) => void;
  activeModalTaskId: string | null;
  /** Live text in the Capture field. Held here so a keystroke typed anywhere
   *  in the app can land in it without a copy-into-local-state round trip. */
  captureDraft: string;
  accountabilityModalTask: Task | null;
  accountabilityModalResolutionDefault?: 'rescheduled' | 'eliminated' | 'marked_failed';
  /** Set right after a stuck log, so the app can hand over one concrete next move. */
  stuckNextStep: StuckNextStep | null;
  closeStuckNextStep: () => void;

  /**
   * Session work timer. Held here rather than in FocusView so glancing at the
   * matrix mid-block does not kill a running timer. Deliberately not persisted —
   * a timer that survives a browser restart is a lie about when you sat down.
   */
  timer: TimerState;
  setTimer: (patch: Partial<TimerState>) => void;
  /** Start, or resume after a pause. The context is only read on a fresh start. */
  startTimer: (context: TimerContext, durationMs?: number) => void;
  pauseTimer: () => void;
  /** Ran to zero. */
  finishTimer: () => void;
  /** Cut short, or the length was changed mid-block. */
  stopTimer: (nextDurationMs?: number) => void;

  sessions: PomodoroSession[];
  recordSession: (outcome: 'completed' | 'abandoned') => void;

  /** Loads the signed-in account's data. Server first, local cache as fallback. */
  hydrate: (userId: string) => Promise<void>;
  /** Wipes in-memory state when the session ends, so nothing leaks to the next user. */
  resetForSignOut: () => void;
  setActiveView: (view: AppView) => void;
  setCaptureDraft: (val: string) => void;
  appendCaptureDraft: (char: string) => void;
  openTaskDetailModal: (taskId: string) => void;
  closeTaskDetailModal: () => void;

  // Task CRUD
  addTask: (rawInput: string, customStatus?: TaskStatus, initialSubtasks?: { content: string; priority: Priority }[], initialNotes?: string, explicitCategory?: TaskCategory) => Task;
  addBulkTasks: (items: Array<{ rawInput: string; customStatus?: TaskStatus; category?: TaskCategory; initialNotes?: string }>) => Task[];
  updateTask: (id: string, updates: Partial<Task>) => void;
  editTaskContent: (id: string, newContent: string) => void;
  editTaskNotes: (id: string, notes: string) => void;
  editTaskDate: (id: string, rawDateInput: string) => void;
  editTaskExactDate: (id: string, isoDate: string | null) => void;
  /** Push a task out of Focus until `until`. Its deadline is untouched. */
  deferTask: (id: string, until: string | null) => void;
  /**
   * Deletion is only reachable through a confirmation — there is deliberately
   * no unguarded delete for a caller to reach for.
   */
  pendingDeleteTaskId: string | null;
  requestDeleteTask: (id: string) => void;
  cancelDeleteTask: () => void;
  confirmDeleteTask: () => void;
  moveTask: (taskId: string, targetStatus: TaskStatus) => void;
  reorderTasks: (activeId: string, overId: string, status: TaskStatus) => void;
  toggleTaskCompletion: (taskId: string) => boolean;

  // Subtasks
  addSubtask: (taskId: string, content: string, priority?: Priority) => void;
  toggleSubtask: (taskId: string, subtaskId: string) => void;
  deleteSubtask: (taskId: string, subtaskId: string) => void;
  editSubtask: (taskId: string, subtaskId: string, updates: Partial<SubTask>) => void;
  reorderSubtasks: (taskId: string, fromIndex: number, toIndex: number) => void;
  /** "I can't do this step right now" — send it to the back of the queue. */
  deferSubtask: (taskId: string, subtaskId: string) => void;
  moveSubtaskPriority: (taskId: string, subtaskId: string, direction: 'up' | 'down') => void;

  // Accountability
  openAccountabilityModal: (task: Task, defaultResolution?: 'rescheduled' | 'eliminated' | 'marked_failed') => void;
  closeAccountabilityModal: () => void;
  recordAccountability: (
    taskId: string,
    category: BlockerCategory,
    reason: string,
    resolution: 'rescheduled' | 'eliminated' | 'marked_failed',
    newDueDate?: string | null
  ) => void;

  clearAllData: () => Promise<void>;
}

export interface StuckNextStep {
  taskId: string;
  category: BlockerCategory;
  resolution: 'rescheduled' | 'eliminated' | 'marked_failed';
  /** How many times this task has now been logged as stuck, this one included. */
  stuckCount: number;
}

export const TIMER_PRESETS_MIN = [10, 25, 50] as const;
const DEFAULT_TIMER_MS = 25 * 60_000;

export interface TimerContext {
  label: string;
  taskId?: string;
  source: 'focus' | 'pomodoro';
}

export interface TimerState {
  durationMs: number;
  /** Epoch ms at which the block ends. Non-null exactly while running. */
  deadline: number | null;
  /** Authoritative while paused; kept in step by the ticker while running. */
  remainingMs: number;
  finished: boolean;

  /* Bookkeeping for the session this timer will log when it ends. */
  label: string | null;
  taskId: string | null;
  source: 'focus' | 'pomodoro' | null;
  /** Epoch ms of the first start. Non-null means a session is in flight. */
  startedAt: number | null;
  pausedMs: number;
  pausedAt: number | null;
  pauseCount: number;
}

const INITIAL_TIMER: TimerState = {
  durationMs: DEFAULT_TIMER_MS,
  deadline: null,
  remainingMs: DEFAULT_TIMER_MS,
  finished: false,
  label: null,
  taskId: null,
  source: null,
  startedAt: null,
  pausedMs: 0,
  pausedAt: null,
  pauseCount: 0,
};

/**
 * Written on start/pause/finish/stop only — never on the 500ms tick. Progress
 * is rebuilt from the absolute deadline, so the ticks have nothing to save.
 */
const persistTimer = (timer: TimerState) => {
  if (typeof window === 'undefined') return;
  // Deliberately local-only: a running block belongs to the machine you sat
  // down at, so it is never synced to the account.
  set(scopedKey(TIMER_STORAGE_KEY), timer).catch((err) =>
    console.error('Failed to persist timer:', err)
  );
};

/** Shared by live completion and by restoring a block that ended while away. */
const buildSession = (
  timer: TimerState,
  outcome: 'completed' | 'abandoned',
  endedAt: number
): PomodoroSession | null => {
  if (timer.startedAt === null || !timer.label) return null;

  const pausedMs = timer.pausedMs + (timer.pausedAt ? endedAt - timer.pausedAt : 0);
  // Wall clock minus every pause. Never trust the planned length.
  const workedMs = Math.max(0, endedAt - timer.startedAt - pausedMs);

  // A block barely begun is noise, not history.
  if (workedMs < 30_000 && outcome === 'abandoned') return null;

  return {
    id: `ses-${endedAt}-${Math.random().toString(36).substring(2, 7)}`,
    label: timer.label,
    taskId: timer.taskId ?? undefined,
    source: timer.source ?? 'pomodoro',
    plannedMs: timer.durationMs,
    startedAt: new Date(timer.startedAt).toISOString(),
    endedAt: new Date(endedAt).toISOString(),
    workedMs,
    pausedMs,
    pauseCount: timer.pauseCount,
    outcome,
  };
};

/**
 * Writes the local cache and queues a debounced push to the account. The cache
 * write is awaited so callers keep their existing guarantees; the server write
 * is fire-and-forget so no mutation ever waits on the network.
 */
const writeLocalCache = async (
  tasks: Task[],
  logs: AccountabilityLog[],
  sessions?: PomodoroSession[]
) => {
  if (typeof window === 'undefined') return;
  try {
    await set(scopedKey(TASKS_STORAGE_KEY), tasks);
    await set(scopedKey(LOGS_STORAGE_KEY), logs);
    if (sessions) await set(scopedKey(SESSIONS_STORAGE_KEY), sessions);
  } catch (err) {
    console.error('Failed to persist to IndexedDB:', err);
  }
};

/**
 * Writes the local cache and queues a debounced push to the account. The cache
 * write is awaited so callers keep their existing guarantees; the server write
 * is fire-and-forget, so no mutation ever waits on the network.
 */
const persistData = async (
  tasks: Task[],
  logs: AccountabilityLog[],
  sessions?: PomodoroSession[]
) => {
  await writeLocalCache(tasks, logs, sessions);
  if (activeUserId) scheduleSync();
};

export const useMatrixStore = create<MatrixState>((setStore, getStore) => ({
  tasks: [],
  logs: [],
  isHydrated: false,
  activeView: 'focus',
  activeCategory: 'all',
  activeModalTaskId: null,
  captureDraft: '',
  accountabilityModalTask: null,
  accountabilityModalResolutionDefault: 'rescheduled',
  stuckNextStep: null,

  timer: INITIAL_TIMER,
  sessions: [],
  setTimer: (patch) => setStore({ timer: { ...getStore().timer, ...patch } }),

  startTimer: (context, durationMs) => {
    const timer = getStore().timer;
    const now = Date.now();
    const duration = durationMs ?? timer.durationMs;

    // Resuming an in-flight block: close the pause and keep its history.
    if (timer.startedAt !== null && durationMs === undefined) {
      const remaining = timer.remainingMs > 0 ? timer.remainingMs : duration;
      const next: TimerState = {
        ...timer,
        deadline: now + remaining,
        remainingMs: remaining,
        finished: false,
        pausedMs: timer.pausedMs + (timer.pausedAt ? now - timer.pausedAt : 0),
        pausedAt: null,
      };
      setStore({ timer: next });
      persistTimer(next);
      return;
    }

    // A fresh block. Anything still in flight is closed out first.
    if (timer.startedAt !== null) getStore().stopTimer();

    const next: TimerState = {
      ...INITIAL_TIMER,
      durationMs: duration,
      remainingMs: duration,
      deadline: now + duration,
      startedAt: now,
      label: context.label,
      taskId: context.taskId ?? null,
      source: context.source,
    };
    setStore({ timer: next });
    persistTimer(next);
  },

  pauseTimer: () => {
    const timer = getStore().timer;
    if (timer.deadline === null) return;
    const next: TimerState = {
      ...timer,
      remainingMs: Math.max(0, timer.deadline - Date.now()),
      deadline: null,
      pausedAt: Date.now(),
      pauseCount: timer.pauseCount + 1,
      finished: false,
    };
    setStore({ timer: next });
    persistTimer(next);
  },

  finishTimer: () => {
    const timer = getStore().timer;
    setStore({ timer: { ...timer, deadline: null, remainingMs: 0, finished: true } });
    getStore().recordSession('completed');

    // Close the session out. The label and finished flag stay for the UI, but
    // the bookkeeping must reset or the next block would count from this one's
    // start time and log a wildly inflated duration.
    const next: TimerState = {
      ...getStore().timer,
      startedAt: null,
      pausedMs: 0,
      pausedAt: null,
      pauseCount: 0,
    };
    setStore({ timer: next });
    persistTimer(next);
  },

  stopTimer: (nextDurationMs) => {
    const timer = getStore().timer;
    if (timer.startedAt !== null && !timer.finished) {
      getStore().recordSession('abandoned');
    }
    const duration = nextDurationMs ?? timer.durationMs;
    const next: TimerState = { ...INITIAL_TIMER, durationMs: duration, remainingMs: duration };
    setStore({ timer: next });
    persistTimer(next);
  },

  recordSession: (outcome) => {
    const session = buildSession(getStore().timer, outcome, Date.now());
    if (!session) return;

    const nextSessions = [session, ...getStore().sessions];
    setStore({ sessions: nextSessions });
    persistData(getStore().tasks, getStore().logs, nextSessions);
  },

  hydrate: async (userId) => {
    if (typeof window === 'undefined') return;

    activeUserId = userId;
    // The sync layer reads the live store rather than being handed a snapshot,
    // so a push always sends the newest state, not the state at queue time.
    configureSync(() => {
      const { tasks, logs, sessions } = getStore();
      return { tasks, logs, sessions };
    });

    try {
      let localTasks = await get<Task[]>(scopedKey(TASKS_STORAGE_KEY));
      let localLogs = await get<AccountabilityLog[]>(scopedKey(LOGS_STORAGE_KEY));
      let localSessions = await get<PomodoroSession[]>(scopedKey(SESSIONS_STORAGE_KEY));
      const storedTimer = await get<TimerState>(scopedKey(TIMER_STORAGE_KEY));
      const hasSyncedBefore = (await get<boolean>(scopedKey(SYNCED_MARKER_KEY))) === true;

      /**
       * Data captured before accounts existed sits under the old unscoped keys.
       * The first account to sign in on this browser adopts it, once — losing
       * someone's existing task list to a login would be indefensible.
       */
      if (!localTasks && !localLogs && !localSessions) {
        const legacyTasks = await get<Task[]>(TASKS_STORAGE_KEY);
        const legacyLogs = await get<AccountabilityLog[]>(LOGS_STORAGE_KEY);
        const legacySessions = await get<PomodoroSession[]>(SESSIONS_STORAGE_KEY);
        if (legacyTasks?.length || legacyLogs?.length || legacySessions?.length) {
          localTasks = legacyTasks;
          localLogs = legacyLogs;
          localSessions = legacySessions;
        }
      }

      /**
       * The account is authoritative. Local data only wins when the server has
       * nothing *and* this cache has never been pushed — otherwise an account
       * cleared on another device would be resurrected by a stale cache.
       */
      let remote: { tasks: Task[]; logs: AccountabilityLog[]; sessions: PomodoroSession[] } | null =
        null;
      try {
        remote = await pullRemoteState();
      } catch (err) {
        console.warn('Could not reach the server; opening from the local cache.', err);
      }

      const remoteIsEmpty =
        !remote || (!remote.tasks.length && !remote.logs.length && !remote.sessions.length);
      const localHasData = !!(localTasks?.length || localLogs?.length || localSessions?.length);
      /** Local data that the server has never seen — push it up after hydrating. */
      const needsInitialPush = !!remote && remoteIsEmpty && !hasSyncedBefore && localHasData;
      const useRemote = !!remote && !needsInitialPush;

      const sourceTasks = (useRemote ? remote!.tasks : localTasks) || [];
      const sourceLogs = (useRemote ? remote!.logs : localLogs) || [];
      const sourceSessions = (useRemote ? remote!.sessions : localSessions) || [];

      if (remote) {
        await set(scopedKey(SYNCED_MARKER_KEY), true).catch(() => {});
      }

      /**
       * A reload is not the same as stopping work, so a running block is
       * rebuilt from its absolute deadline and simply carries on.
       *
       * Blocks found already past their deadline are only credited if we are
       * still within the grace window — beyond that we have no idea whether
       * the time was actually worked, and inventing history would poison the
       * one number Reflect is built on.
       */
      const now = Date.now();
      let restoredTimer: TimerState = INITIAL_TIMER;
      let sessions = sourceSessions;
      let creditedOnRestore = false;

      if (storedTimer) {
        const idle: TimerState = {
          ...INITIAL_TIMER,
          durationMs: storedTimer.durationMs,
          remainingMs: storedTimer.durationMs,
        };

        if (storedTimer.startedAt === null) {
          restoredTimer = idle;
        } else if (now - storedTimer.startedAt > STALE_BLOCK_MS) {
          restoredTimer = idle;
        } else if (storedTimer.deadline === null) {
          restoredTimer = storedTimer; // paused; resume picks up the pause clock
        } else if (storedTimer.deadline > now) {
          restoredTimer = { ...storedTimer, remainingMs: storedTimer.deadline - now };
        } else if (now - storedTimer.deadline <= GRACE_MS) {
          const session = buildSession(storedTimer, 'completed', storedTimer.deadline);
          if (session) {
            sessions = [session, ...sessions];
            creditedOnRestore = true;
          }
          restoredTimer = {
            ...storedTimer,
            deadline: null,
            remainingMs: 0,
            finished: true,
            startedAt: null,
            pausedMs: 0,
            pausedAt: null,
            pauseCount: 0,
          };
        } else {
          restoredTimer = idle;
        }
      }
      const validCategories: TaskCategory[] = ['work', 'personal', 'content'];
      const sanitizedTasks = sourceTasks.map((t) => ({
        ...t,
        notes: t.notes || '',
        // Tasks saved before categories existed simply have none.
        category:
          t.category && validCategories.includes(t.category) ? t.category : undefined,
        deferUntil: typeof t.deferUntil === 'string' ? t.deferUntil : undefined,
        subtasks: (t.subtasks || []).map((s) => ({
          ...s,
          priority: s.priority || 'normal',
        })),
      }));
      setStore({
        tasks: sanitizedTasks,
        logs: sourceLogs,
        sessions,
        timer: restoredTimer,
        isHydrated: true,
        // Land where the user actually has something to do: an empty app opens
        // on the blank page you can type into, otherwise straight into Focus.
        activeView: sanitizedTasks.length === 0 ? 'capture' : 'focus',
      });

      // Persist the reconciled state so a second reload cannot credit the same
      // block twice.
      persistTimer(restoredTimer);

      if (needsInitialPush || creditedOnRestore) {
        // Either local data the account has never seen, or a block credited on
        // restore — both have to reach the server, not just the cache.
        persistData(sanitizedTasks, sourceLogs, sessions);
      } else if (useRemote) {
        // Refresh the cache from the server without provoking a pointless
        // write-back of data that just came from there.
        writeLocalCache(sanitizedTasks, sourceLogs, sessions);
      }
    } catch (err) {
      console.error('Hydration error:', err);
      setStore({ tasks: [], logs: [], sessions: [], isHydrated: true, activeView: 'capture' });
    }
  },

  setActiveView: (view) => setStore({ activeView: view }),

  setActiveCategory: (category) => setStore({ activeCategory: category }),

  setTaskCategory: (taskId, category) => {
    const nextTasks = getStore().tasks.map((t) => (t.id === taskId ? { ...t, category } : t));
    setStore({ tasks: nextTasks });
    persistData(nextTasks, getStore().logs);
  },
  setCaptureDraft: (val) => setStore({ captureDraft: val }),
  appendCaptureDraft: (char) => setStore({ captureDraft: getStore().captureDraft + char }),
  openTaskDetailModal: (taskId) => setStore({ activeModalTaskId: taskId }),
  closeTaskDetailModal: () => setStore({ activeModalTaskId: null }),

  addTask: (rawInput, customStatus, initialSubtasks, initialNotes, explicitCategory) => {
    // Category comes only from an explicit #tag or explicitCategory.
    const { cleanedContent, parsedDate, category } = parseTaskInput(rawInput);
    const newTask: Task = {
      id: `task-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      content: cleanedContent || rawInput.trim(),
      originalRawInput: rawInput,
      parsedDate: parsedDate ? parsedDate.toISOString() : null,
      status: customStatus || 'inbox',
      category: explicitCategory !== undefined ? explicitCategory : (category ?? undefined),
      completionState: 'pending',
      createdAt: new Date().toISOString(),
      notes: initialNotes || '',
      subtasks: initialSubtasks
        ? initialSubtasks.map((s) => ({
            id: `sub-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
            content: s.content,
            completed: false,
            priority: s.priority || 'normal',
          }))
        : [],
    };
    const nextTasks = [newTask, ...getStore().tasks];
    setStore({ tasks: nextTasks });
    persistData(nextTasks, getStore().logs);
    return newTask;
  },

  addBulkTasks: (items) => {
    if (items.length === 0) return [];
    const baseTime = Date.now();
    const newTasks: Task[] = items.map((item, index) => {
      const { cleanedContent, parsedDate, category: parsedCat } = parseTaskInput(item.rawInput);
      const createdAt = new Date(baseTime + index).toISOString();
      return {
        id: `task-${baseTime + index}-${Math.random().toString(36).substring(2, 7)}`,
        content: cleanedContent || item.rawInput.trim(),
        originalRawInput: item.rawInput,
        parsedDate: parsedDate ? parsedDate.toISOString() : null,
        status: item.customStatus || 'inbox',
        category: item.category !== undefined ? item.category : (parsedCat ?? undefined),
        completionState: 'pending',
        createdAt,
        notes: item.initialNotes || '',
        subtasks: [],
      };
    });

    const nextTasks = [...newTasks, ...getStore().tasks];
    setStore({ tasks: nextTasks });
    persistData(nextTasks, getStore().logs);
    return newTasks;
  },

  updateTask: (id, updates) => {
    const nextTasks = getStore().tasks.map((t) => (t.id === id ? { ...t, ...updates } : t));
    setStore({ tasks: nextTasks });
    persistData(nextTasks, getStore().logs);
  },

  editTaskContent: (id, newContent) => {
    if (!newContent.trim()) return;
    // Rewriting a title reads dates and #tags out of it, exactly as capture
    // does — typing "today 6pm" into the title should set the deadline.
    const { cleanedContent, parsedDate, category } = parseTaskInput(newContent);
    const nextTasks = getStore().tasks.map((t) => {
      if (t.id !== id) return t;
      return {
        ...t,
        content: cleanedContent || newContent.trim(),
        // Only overwrite when the new text actually carried one.
        parsedDate: parsedDate ? parsedDate.toISOString() : t.parsedDate,
        category: category ?? t.category,
      };
    });
    setStore({ tasks: nextTasks });
    persistData(nextTasks, getStore().logs);
  },

  editTaskNotes: (id, notes) => {
    const nextTasks = getStore().tasks.map((t) =>
      t.id === id ? { ...t, notes } : t
    );
    setStore({ tasks: nextTasks });
    persistData(nextTasks, getStore().logs);
  },

  editTaskDate: (id, rawDateInput) => {
    const { parsedDate } = parseTaskInput(rawDateInput);
    const nextTasks = getStore().tasks.map((t) =>
      t.id === id ? { ...t, parsedDate: parsedDate ? parsedDate.toISOString() : null } : t
    );
    setStore({ tasks: nextTasks });
    persistData(nextTasks, getStore().logs);
  },

  editTaskExactDate: (id, isoDate) => {
    const nextTasks = getStore().tasks.map((t) =>
      t.id === id ? { ...t, parsedDate: isoDate } : t
    );
    setStore({ tasks: nextTasks });
    persistData(nextTasks, getStore().logs);
  },

  deferTask: (id, until) => {
    const nextTasks = getStore().tasks.map((t) =>
      t.id === id ? { ...t, deferUntil: until ?? undefined } : t
    );
    setStore({ tasks: nextTasks });
    persistData(nextTasks, getStore().logs);
  },

  pendingDeleteTaskId: null,
  requestDeleteTask: (id) => setStore({ pendingDeleteTaskId: id }),
  cancelDeleteTask: () => setStore({ pendingDeleteTaskId: null }),

  confirmDeleteTask: () => {
    const id = getStore().pendingDeleteTaskId;
    if (!id) return;
    const nextTasks = getStore().tasks.filter((t) => t.id !== id);
    setStore({
      tasks: nextTasks,
      pendingDeleteTaskId: null,
      // The detail modal cannot outlive the task it is showing.
      activeModalTaskId: getStore().activeModalTaskId === id ? null : getStore().activeModalTaskId,
    });
    persistData(nextTasks, getStore().logs);
  },

  moveTask: (taskId, targetStatus) => {
    const nextTasks = getStore().tasks.map((t) =>
      t.id === taskId ? { ...t, status: targetStatus } : t
    );
    setStore({ tasks: nextTasks });
    persistData(nextTasks, getStore().logs);
  },

  reorderTasks: (activeId, overId, status) => {
    const allTasks = [...getStore().tasks];
    const statusTasks = allTasks.filter((t) => t.status === status);
    const otherTasks = allTasks.filter((t) => t.status !== status);
    const oldIndex = statusTasks.findIndex((t) => t.id === activeId);
    const newIndex = statusTasks.findIndex((t) => t.id === overId);
    if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return;
    const [movedItem] = statusTasks.splice(oldIndex, 1);
    statusTasks.splice(newIndex, 0, movedItem);
    const nextTasks = [...otherTasks, ...statusTasks];
    setStore({ tasks: nextTasks });
    persistData(nextTasks, getStore().logs);
  },

  toggleTaskCompletion: (taskId) => {
    const task = getStore().tasks.find((t) => t.id === taskId);
    if (!task) return false;

    if (task.completionState !== 'completed') {
      const hasIncompleteSubtasks = (task.subtasks || []).some((s) => !s.completed);
      if (hasIncompleteSubtasks) {
        return false;
      }
    }

    const nextState: CompletionState = task.completionState === 'completed' ? 'pending' : 'completed';
    const nextTasks = getStore().tasks.map((t) =>
      t.id === taskId
        ? { ...t, completionState: nextState, completedAt: nextState === 'completed' ? new Date().toISOString() : undefined }
        : t
    );
    setStore({ tasks: nextTasks });
    persistData(nextTasks, getStore().logs);
    return true;
  },

  // -- Subtasks --

  addSubtask: (taskId, content, priority = 'normal') => {
    const nextTasks = getStore().tasks.map((t) => {
      if (t.id !== taskId) return t;
      const sub: SubTask = {
        id: `sub-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
        content,
        completed: false,
        priority,
      };
      return { ...t, subtasks: [...(t.subtasks || []), sub] };
    });
    setStore({ tasks: nextTasks });
    persistData(nextTasks, getStore().logs);
  },

  toggleSubtask: (taskId, subtaskId) => {
    const nextTasks = getStore().tasks.map((t) => {
      if (t.id !== taskId) return t;
      return {
        ...t,
        subtasks: (t.subtasks || []).map((s) =>
          s.id === subtaskId ? { ...s, completed: !s.completed } : s
        ),
      };
    });
    setStore({ tasks: nextTasks });
    persistData(nextTasks, getStore().logs);
  },

  deleteSubtask: (taskId, subtaskId) => {
    const nextTasks = getStore().tasks.map((t) => {
      if (t.id !== taskId) return t;
      return { ...t, subtasks: (t.subtasks || []).filter((s) => s.id !== subtaskId) };
    });
    setStore({ tasks: nextTasks });
    persistData(nextTasks, getStore().logs);
  },

  editSubtask: (taskId, subtaskId, updates) => {
    const nextTasks = getStore().tasks.map((t) => {
      if (t.id !== taskId) return t;
      return {
        ...t,
        subtasks: (t.subtasks || []).map((s) =>
          s.id === subtaskId ? { ...s, ...updates } : s
        ),
      };
    });
    setStore({ tasks: nextTasks });
    persistData(nextTasks, getStore().logs);
  },

  reorderSubtasks: (taskId, fromIndex, toIndex) => {
    const nextTasks = getStore().tasks.map((t) => {
      if (t.id !== taskId || !t.subtasks) return t;
      const subs = [...t.subtasks];
      const [moved] = subs.splice(fromIndex, 1);
      subs.splice(toIndex, 0, moved);
      return { ...t, subtasks: subs };
    });
    setStore({ tasks: nextTasks });
    persistData(nextTasks, getStore().logs);
  },

  deferSubtask: (taskId, subtaskId) => {
    const nextTasks = getStore().tasks.map((t) => {
      if (t.id !== taskId || !t.subtasks) return t;
      const target = t.subtasks.find((s) => s.id === subtaskId);
      if (!target) return t;

      return {
        ...t,
        subtasks: [
          ...t.subtasks.filter((s) => s.id !== subtaskId),
          // Demote high priority too, or Focus would sort it straight back
          // to the front and the skip would appear to do nothing.
          { ...target, priority: target.priority === 'high' ? 'normal' : target.priority },
        ],
      };
    });
    setStore({ tasks: nextTasks });
    persistData(nextTasks, getStore().logs);
  },

  moveSubtaskPriority: (taskId, subtaskId, direction) => {
    const priorities: Priority[] = ['high', 'normal', 'low'];
    const nextTasks = getStore().tasks.map((t) => {
      if (t.id !== taskId || !t.subtasks) return t;
      return {
        ...t,
        subtasks: t.subtasks.map((s) => {
          if (s.id !== subtaskId) return s;
          const currentIndex = priorities.indexOf(s.priority || 'normal');
          const newIndex = direction === 'up' 
            ? Math.max(0, currentIndex - 1) 
            : Math.min(priorities.length - 1, currentIndex + 1);
          return { ...s, priority: priorities[newIndex] };
        }),
      };
    });
    setStore({ tasks: nextTasks });
    persistData(nextTasks, getStore().logs);
  },

  // -- Accountability --

  openAccountabilityModal: (task, defaultResolution = 'rescheduled') => {
    setStore({ accountabilityModalTask: task, accountabilityModalResolutionDefault: defaultResolution });
  },

  closeAccountabilityModal: () => {
    setStore({ accountabilityModalTask: null });
  },

  closeStuckNextStep: () => {
    setStore({ stuckNextStep: null });
  },

  recordAccountability: (taskId, category, reason, resolution, newDueDate) => {
    const task = getStore().tasks.find((t) => t.id === taskId);
    if (!task) return;

    const newLog: AccountabilityLog = {
      id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      taskId: task.id,
      taskTitle: task.content,
      category,
      reason,
      loggedAt: new Date().toISOString(),
      statusAtFailure: task.status,
      resolution,
      originalDueDate: task.parsedDate,
      newDueDate: newDueDate || null,
    };

    let updatedTasks = [...getStore().tasks];
    if (resolution === 'eliminated') {
      updatedTasks = updatedTasks.map((t) =>
        t.id === taskId ? { ...t, status: 'eliminate' as TaskStatus, completionState: 'failed' as CompletionState, failureReason: reason, blockerCategory: category } : t
      );
    } else if (resolution === 'rescheduled') {
      // Defers the task out of Focus and leaves the deadline alone. Writing the
      // new time into parsedDate would silently destroy a real deadline — a
      // task due Friday that you push to Tuesday is still due Friday.
      updatedTasks = updatedTasks.map((t) =>
        t.id === taskId
          ? {
              ...t,
              deferUntil: newDueDate || new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
              failureReason: reason,
              blockerCategory: category,
            }
          : t
      );
    } else if (resolution === 'marked_failed') {
      updatedTasks = updatedTasks.map((t) =>
        t.id === taskId ? { ...t, completionState: 'failed' as CompletionState, failureReason: reason, blockerCategory: category } : t
      );
    }
    const nextLogs = [newLog, ...getStore().logs];
    setStore({
      tasks: updatedTasks,
      logs: nextLogs,
      accountabilityModalTask: null,
      stuckNextStep: {
        taskId,
        category,
        resolution,
        stuckCount: nextLogs.filter((l) => l.taskId === taskId).length,
      },
    });
    persistData(updatedTasks, nextLogs);
  },

  clearAllData: async () => {
    setStore({ tasks: [], logs: [], sessions: [], timer: INITIAL_TIMER });
    await persistData([], [], []);
    persistTimer(INITIAL_TIMER);
    // Deleting everything is deliberate and one-way, so it does not wait on the
    // debounce — the account is emptied before this resolves.
    if (activeUserId) await flushSync();
  },

  resetForSignOut: () => {
    // Any queued push is dropped rather than sent: the next request would carry
    // whichever session is now active, and writing one account's tasks into
    // another is far worse than losing the last second of edits.
    resetSync();
    activeUserId = null;
    setStore({
      tasks: [],
      logs: [],
      sessions: [],
      timer: INITIAL_TIMER,
      isHydrated: false,
      activeModalTaskId: null,
      accountabilityModalTask: null,
      stuckNextStep: null,
      pendingDeleteTaskId: null,
      captureDraft: '',
    });
  },
}));
