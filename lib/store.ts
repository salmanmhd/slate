import { create } from 'zustand';
import { get, set } from 'idb-keyval';
import { AccountabilityLog, AppView, BlockerCategory, CompletionState, Priority, SubTask, Task, TaskStatus } from '@/types/matrix';
import { parseTaskInput } from './nlp-parser';

const TASKS_STORAGE_KEY = 'focus_matrix_tasks_v1';
const LOGS_STORAGE_KEY = 'focus_matrix_logs_v1';

interface MatrixState {
  tasks: Task[];
  logs: AccountabilityLog[];
  isHydrated: boolean;
  activeView: AppView;
  activeModalTaskId: string | null;
  initialCaptureInput: string;
  accountabilityModalTask: Task | null;
  accountabilityModalResolutionDefault?: 'rescheduled' | 'eliminated' | 'marked_failed';

  hydrate: () => Promise<void>;
  setActiveView: (view: AppView) => void;
  setInitialCaptureInput: (val: string) => void;
  openTaskDetailModal: (taskId: string) => void;
  closeTaskDetailModal: () => void;

  // Task CRUD
  addTask: (rawInput: string, customStatus?: TaskStatus, initialSubtasks?: { content: string; priority: Priority }[], initialNotes?: string) => Task;
  updateTask: (id: string, updates: Partial<Task>) => void;
  editTaskContent: (id: string, newContent: string) => void;
  editTaskNotes: (id: string, notes: string) => void;
  editTaskDate: (id: string, rawDateInput: string) => void;
  editTaskExactDate: (id: string, isoDate: string | null) => void;
  deleteTask: (id: string) => void;
  moveTask: (taskId: string, targetStatus: TaskStatus) => void;
  reorderTasks: (activeId: string, overId: string, status: TaskStatus) => void;
  toggleTaskCompletion: (taskId: string) => boolean;

  // Subtasks
  addSubtask: (taskId: string, content: string, priority?: Priority) => void;
  toggleSubtask: (taskId: string, subtaskId: string) => void;
  deleteSubtask: (taskId: string, subtaskId: string) => void;
  editSubtask: (taskId: string, subtaskId: string, updates: Partial<SubTask>) => void;
  reorderSubtasks: (taskId: string, fromIndex: number, toIndex: number) => void;
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

const persistData = async (tasks: Task[], logs: AccountabilityLog[]) => {
  if (typeof window === 'undefined') return;
  try {
    await set(TASKS_STORAGE_KEY, tasks);
    await set(LOGS_STORAGE_KEY, logs);
  } catch (err) {
    console.error('Failed to persist to IndexedDB:', err);
  }
};

export const useMatrixStore = create<MatrixState>((setStore, getStore) => ({
  tasks: [],
  logs: [],
  isHydrated: false,
  activeView: 'focus',
  activeModalTaskId: null,
  initialCaptureInput: '',
  accountabilityModalTask: null,
  accountabilityModalResolutionDefault: 'rescheduled',

  hydrate: async () => {
    if (typeof window === 'undefined') return;
    try {
      const storedTasks = await get<Task[]>(TASKS_STORAGE_KEY);
      const storedLogs = await get<AccountabilityLog[]>(LOGS_STORAGE_KEY);
      const sanitizedTasks = (storedTasks || []).map((t) => ({
        ...t,
        notes: t.notes || '',
        subtasks: (t.subtasks || []).map((s) => ({
          ...s,
          priority: s.priority || 'normal',
        })),
      }));
      setStore({
        tasks: sanitizedTasks,
        logs: storedLogs || [],
        isHydrated: true,
      });
    } catch (err) {
      console.error('Hydration error:', err);
      setStore({ tasks: [], logs: [], isHydrated: true });
    }
  },

  setActiveView: (view) => setStore({ activeView: view }),
  setInitialCaptureInput: (val) => setStore({ initialCaptureInput: val }),
  openTaskDetailModal: (taskId) => setStore({ activeModalTaskId: taskId }),
  closeTaskDetailModal: () => setStore({ activeModalTaskId: null }),

  addTask: (rawInput, customStatus, initialSubtasks, initialNotes) => {
    const { cleanedContent, parsedDate } = parseTaskInput(rawInput);
    const newTask: Task = {
      id: `task-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      content: cleanedContent || rawInput.trim(),
      originalRawInput: rawInput,
      parsedDate: parsedDate ? parsedDate.toISOString() : null,
      status: customStatus || 'inbox',
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

  updateTask: (id, updates) => {
    const nextTasks = getStore().tasks.map((t) => (t.id === id ? { ...t, ...updates } : t));
    setStore({ tasks: nextTasks });
    persistData(nextTasks, getStore().logs);
  },

  editTaskContent: (id, newContent) => {
    if (!newContent.trim()) return;
    const nextTasks = getStore().tasks.map((t) =>
      t.id === id ? { ...t, content: newContent.trim() } : t
    );
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

  deleteTask: (id) => {
    const nextTasks = getStore().tasks.filter((t) => t.id !== id);
    setStore({ tasks: nextTasks });
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
      updatedTasks = updatedTasks.map((t) =>
        t.id === taskId ? { ...t, parsedDate: newDueDate || new Date(Date.now() + 24 * 3600 * 1000).toISOString(), failureReason: reason, blockerCategory: category } : t
      );
    } else if (resolution === 'marked_failed') {
      updatedTasks = updatedTasks.map((t) =>
        t.id === taskId ? { ...t, completionState: 'failed' as CompletionState, failureReason: reason, blockerCategory: category } : t
      );
    }
    const nextLogs = [newLog, ...getStore().logs];
    setStore({ tasks: updatedTasks, logs: nextLogs, accountabilityModalTask: null });
    persistData(updatedTasks, nextLogs);
  },

  clearAllData: async () => {
    await persistData([], []);
    setStore({ tasks: [], logs: [] });
  },
}));
