'use client';

import React from 'react';
import { useMatrixStore } from '@/lib/store';
import { SubTask, Task } from '@/types/matrix';
import { formatFriendlyDate } from '@/lib/nlp-parser';
import confetti from 'canvas-confetti';
import {
  Check,
  FileText,
  Clock,
  Circle,
} from 'lucide-react';

export function FocusView() {
  const { tasks, setActiveView } = useMatrixStore();

  const activeTasks = tasks.filter(
    (t) => t.completionState === 'pending' && t.status !== 'eliminate' && t.status !== 'inbox'
  );

  const sorted = React.useMemo(() => {
    const now = Date.now();
    const score = (t: Task): number => {
      const sw = t.status === 'do_first' ? 0 : t.status === 'schedule' ? 1000 : t.status === 'delegate' ? 2000 : 3000;
      let dw = 500;
      if (t.parsedDate) {
        const diff = new Date(t.parsedDate).getTime() - now;
        dw = diff < 0 ? -100 : Math.min(diff / (3600 * 1000), 999);
      }
      return sw + dw;
    };
    return [...activeTasks].sort((a, b) => score(a) - score(b));
  }, [activeTasks]);

  const currentTask = sorted[0];
  const upNext = sorted.slice(1, 4);

  if (!currentTask) {
    return (
      <div className="flex flex-col items-center justify-center pt-[22vh] text-center max-w-sm mx-auto">
        <h3 className="text-sm font-semibold text-foreground">Nothing to focus on right now</h3>
        <p className="mt-1.5 text-xs text-muted-foreground/60 leading-relaxed">
          {tasks.some((t) => t.status === 'inbox' && t.completionState === 'pending') ? (
            <>
              You have unsorted items in your inbox.{' '}
              <button
                onClick={() => setActiveView('decide')}
                className="font-medium text-foreground underline underline-offset-2"
              >
                Sort in Matrix (2)
              </button>
            </>
          ) : (
            <>
              Capture a task to get started.{' '}
              <button
                onClick={() => setActiveView('capture')}
                className="font-medium text-foreground underline underline-offset-2"
              >
                Capture (1)
              </button>
            </>
          )}
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl pt-[12vh] pb-24">
      <FocusCard task={currentTask} />

      {/* Up Next List (Quiet, faded below) */}
      {upNext.length > 0 && (
        <div className="mt-24 border-t border-border/30 pt-6 opacity-30 hover:opacity-80 transition-opacity">
          <p className="text-[10px] font-semibold text-muted-foreground mb-2 uppercase tracking-widest">
            Up Next
          </p>
          <div className="space-y-1.5">
            {upNext.map((t) => (
              <div
                key={t.id}
                className="flex items-center justify-between text-xs text-muted-foreground py-0.5"
              >
                <span className="truncate flex-1">{t.content}</span>
                {t.parsedDate && (
                  <span className="text-[10px] text-muted-foreground/50 ml-2">
                    {formatFriendlyDate(t.parsedDate)}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ──────── Minimal Monochrome Focus Card ──────── */

function FocusCard({ task }: { task: Task }) {
  const { toggleTaskCompletion, toggleSubtask } = useMatrixStore();
  const [showNotes, setShowNotes] = React.useState(false);

  const subtasks = task.subtasks || [];
  const incompleteSubtasks = subtasks.filter((s) => !s.completed);
  const completedSubtasks = subtasks.filter((s) => s.completed);
  const hasSubtasks = subtasks.length > 0;
  const allSubtasksDone = hasSubtasks ? incompleteSubtasks.length === 0 : true;

  // Active step (the single next incomplete step to do)
  const activeStep = incompleteSubtasks[0];

  const handleCompleteMain = () => {
    if (!allSubtasksDone) return;
    try {
      confetti({ particleCount: 35, spread: 50, origin: { y: 0.5 }, colors: ['#000000', '#ffffff', '#888888'], ticks: 120 });
    } catch {}
    toggleTaskCompletion(task.id);
  };

  const handleCompleteStep = (stepId: string) => {
    try {
      confetti({ particleCount: 20, spread: 40, origin: { y: 0.5 }, ticks: 80 });
    } catch {}
    toggleSubtask(task.id, stepId);
  };

  return (
    <div className="space-y-8">
      {/* Top Header: Main Task centered, Deadline on the right */}
      <div className="relative flex items-center justify-center border-b border-border/20 pb-3 min-h-[28px]">
        {/* Main task centered */}
        <h2 className="text-sm font-medium text-muted-foreground text-center truncate max-w-sm px-4">
          {task.content}
        </h2>

        {/* Deadline on the right */}
        {task.parsedDate && (
          <div className="absolute right-0 top-0 flex items-center gap-1 text-[11px] text-muted-foreground/60">
            <Clock className="size-3" />
            <span>{formatFriendlyDate(task.parsedDate)}</span>
          </div>
        )}
      </div>

      {/* Main Focus Highlight Area */}
      {hasSubtasks && activeStep ? (
        /* If subtasks exist: Highlight the ACTIVE SUBTASK directly */
        <div className="space-y-6">
          <div className="space-y-3">
            <h1 className="text-3xl sm:text-4xl font-semibold text-foreground leading-tight tracking-tight">
              {activeStep.content}
            </h1>

            {/* Faded Complete Step button */}
            <div className="pt-2 flex items-center gap-3">
              <button
                onClick={() => handleCompleteStep(activeStep.id)}
                className="flex items-center gap-2 rounded-xl bg-foreground px-5 py-2 text-xs font-semibold text-background opacity-50 hover:opacity-100 transition-opacity cursor-pointer shadow-xs"
              >
                <Check className="size-3.5 stroke-[2.5]" />
                Complete step
              </button>

              <span className="text-[11px] text-muted-foreground/50">
                {completedSubtasks.length + 1} of {subtasks.length}
              </span>
            </div>
          </div>

          {/* Direct clean listing of all subtasks (no dropdowns or arrows needed) */}
          <div className="pt-4 space-y-1.5 border-t border-border/20">
            {subtasks.map((sub) => {
              const isActive = sub.id === activeStep.id;
              return (
                <div
                  key={sub.id}
                  onClick={() => !sub.completed && toggleSubtask(task.id, sub.id)}
                  className={`flex items-center gap-2 text-xs py-1 px-1.5 rounded-lg transition-colors cursor-pointer ${
                    isActive
                      ? 'font-semibold text-foreground bg-muted/40'
                      : sub.completed
                      ? 'text-muted-foreground/30 line-through'
                      : 'text-muted-foreground/60 hover:text-foreground'
                  }`}
                >
                  {sub.completed ? (
                    <Check className="size-3 text-muted-foreground/50 stroke-[2.5]" />
                  ) : (
                    <Circle className={`size-3 ${isActive ? 'text-foreground' : 'text-muted-foreground/40'}`} strokeWidth={1.5} />
                  )}
                  <span className="truncate">{sub.content}</span>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* If NO subtasks or all steps done: Main task is highlighted */
        <div className="space-y-6">
          <h1 className="text-3xl sm:text-4xl font-semibold text-foreground leading-tight tracking-tight">
            {task.content}
          </h1>

          {/* Faded Complete Task button */}
          <div className="pt-2 flex items-center gap-3">
            <button
              onClick={handleCompleteMain}
              className="flex items-center gap-2 rounded-xl bg-foreground px-5 py-2.5 text-xs font-semibold text-background opacity-50 hover:opacity-100 transition-opacity cursor-pointer shadow-xs"
            >
              <Check className="size-3.5 stroke-[2.5]" />
              Mark complete
            </button>
          </div>
        </div>
      )}

      {/* Task Notes Section */}
      {task.notes && (
        <div className="border-t border-border/20 pt-4">
          <button
            onClick={() => setShowNotes(!showNotes)}
            className="flex items-center gap-1.5 text-xs text-muted-foreground/50 hover:text-foreground transition-colors"
          >
            <FileText className="size-3" />
            <span>{showNotes ? 'Hide notes' : 'Notes'}</span>
          </button>

          {showNotes && (
            <div className="mt-2 rounded-xl bg-muted/20 p-3 text-xs text-foreground/80 leading-relaxed border border-border/30 whitespace-pre-wrap">
              {task.notes}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
