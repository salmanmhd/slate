export type TaskStatus = 'inbox' | 'do_first' | 'schedule' | 'delegate' | 'eliminate';
export type CompletionState = 'pending' | 'completed' | 'failed';
export type Priority = 'high' | 'normal' | 'low';

/** Which part of your life a task belongs to. Optional — capture stays frictionless. */
export type TaskCategory = 'work' | 'personal' | 'content';
/** The context you are working in. 'all' means no filtering. */
export type CategoryFilter = TaskCategory | 'all';

export type BlockerCategory =
  | 'underestimated_time'
  | 'distracted_procrastination'
  | 'scope_creep'
  | 'external_dependency'
  | 'low_energy_burnout'
  | 'poor_clarity'
  | 'other';

export interface BlockerMeta {
  id: BlockerCategory;
  label: string;
  description: string;
  icon: string;
  color: string;
}

export interface AccountabilityLog {
  id: string;
  taskId: string;
  taskTitle: string;
  category: BlockerCategory;
  reason: string;
  loggedAt: string;
  statusAtFailure: TaskStatus;
  resolution: 'rescheduled' | 'eliminated' | 'marked_failed';
  originalDueDate?: string | null;
  newDueDate?: string | null;
}

export interface SubTask {
  id: string;
  content: string;
  completed: boolean;
  priority: Priority;
}

export interface Task {
  id: string;
  content: string;
  originalRawInput?: string;
  /** Deadline — when it must be *finished*. Never hides a task from Focus. */
  parsedDate: string | null;
  /** "Not before" — while this is in the future, Focus skips the task. */
  deferUntil?: string;
  status: TaskStatus;
  category?: TaskCategory;
  completionState: CompletionState;
  createdAt: string;
  completedAt?: string;
  failureReason?: string;
  blockerCategory?: BlockerCategory;
  subtasks?: SubTask[];
  notes?: string;
}

export type AppView = 'capture' | 'decide' | 'focus' | 'timer' | 'reflect';

/** One work block, recorded when it ends. The unit of the focus history. */
export interface PomodoroSession {
  id: string;
  /** What you said you were doing. Free text, or the task title when started from Focus. */
  label: string;
  /** Present only when the block was started against a real task. */
  taskId?: string;
  source: 'focus' | 'pomodoro';
  plannedMs: number;
  startedAt: string;
  endedAt: string;
  /** Wall-clock time minus every pause — the honest number. */
  workedMs: number;
  pausedMs: number;
  pauseCount: number;
  /** 'completed' ran the clock to zero; 'abandoned' was cut short. */
  outcome: 'completed' | 'abandoned';
}

export interface MatrixQuadrantConfig {
  id: TaskStatus;
  title: string;
  subtitle: string;
  urgency: string;
  importance: string;
  badgeColor: string;
  bgGradient: string;
  borderColor: string;
  accentColor: string;
  iconName: string;
}
