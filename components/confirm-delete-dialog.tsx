'use client';

import React from 'react';
import { useMatrixStore } from '@/lib/store';
import { Trash2 } from 'lucide-react';

export function ConfirmDeleteDialog() {
  const { tasks, pendingDeleteTaskId, cancelDeleteTask, confirmDeleteTask } = useMatrixStore();
  const cancelRef = React.useRef<HTMLButtonElement>(null);

  const task = tasks.find((t) => t.id === pendingDeleteTaskId);

  React.useEffect(() => {
    if (!task) return;
    // Escape cancels. Confirming stays a deliberate click — no Enter shortcut
    // on an action that cannot be undone.
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        cancelDeleteTask();
      }
    };
    window.addEventListener('keydown', onKey, true);
    const id = window.setTimeout(() => cancelRef.current?.focus(), 40);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      window.clearTimeout(id);
    };
  }, [task, cancelDeleteTask]);

  if (!task) return null;

  const stepCount = task.subtasks?.length ?? 0;

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-background/40 backdrop-blur-sm" onClick={cancelDeleteTask} />

      <div
        role="alertdialog"
        aria-modal="true"
        aria-label="Delete task"
        className="glass animate-rise relative w-full max-w-sm rounded-2xl p-5"
      >
        <div className="flex items-start gap-3">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
            <Trash2 className="size-4" />
          </span>
          <div className="min-w-0">
            <h2 className="font-heading text-sm font-semibold text-foreground">Delete this task?</h2>
            <p className="mt-1 truncate text-xs text-muted-foreground" title={task.content}>
              {task.content}
            </p>
            {stepCount > 0 && (
              <p className="mt-1 text-[11px] text-muted-foreground/70">
                {stepCount} {stepCount === 1 ? 'step' : 'steps'} will go with it.
              </p>
            )}
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            ref={cancelRef}
            onClick={cancelDeleteTask}
            className="focus-ring rounded-xl px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Keep
          </button>
          <button
            onClick={confirmDeleteTask}
            className="focus-ring rounded-xl bg-destructive px-4 py-1.5 text-xs font-semibold text-background transition-opacity hover:opacity-90"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
