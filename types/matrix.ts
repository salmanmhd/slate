export type TaskStatus = 'inbox' | 'do_first' | 'schedule' | 'delegate' | 'eliminate';
export type CompletionState = 'pending' | 'completed' | 'failed';
export type Priority = 'high' | 'normal' | 'low';

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
  parsedDate: string | null;
  status: TaskStatus;
  completionState: CompletionState;
  createdAt: string;
  completedAt?: string;
  failureReason?: string;
  blockerCategory?: BlockerCategory;
  subtasks?: SubTask[];
  notes?: string;
}

export type AppView = 'capture' | 'decide' | 'focus' | 'reflect';

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
