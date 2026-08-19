'use client';

import React from 'react';
import { useMatrixStore } from '@/lib/store';
import { SubTask, Task, TaskStatus } from '@/types/matrix';
import { formatFriendlyDate } from '@/lib/nlp-parser';
import { QUADRANTS } from '@/components/quadrants';
import { useNow, isOverdue } from '@/hooks/use-now';
import { useIdleReveal } from '@/hooks/use-idle-reveal';
import confetti from 'canvas-confetti';
import { Check, Circle, Inbox, PenLine } from 'lucide-react';

/** Everything that is not the task itself hides while the pointer is still. */
const VEIL = 'transition-opacity duration-500 motion-reduce:transition-none';
const veil = (revealed: boolean) =>
  `${VEIL} ${revealed ? 'opacity-100' : 'pointer-events-none opacity-0'} focus-within:pointer-events-auto focus-within:opacity-100`;

/** Ranks the queue so the top card is always the defensible "next thing". */
function scoreTask(task: Task, now: number): number {
  const byQuadrant =
    task.status === 'do_first' ? 0 : task.status === 'schedule' ? 1000 : task.status === 'delegate' ? 2000 : 3000;

  let byDeadline = 500;
  if (task.parsedDate) {
    const diff = new Date(task.parsedDate).getTime() - now;
    byDeadline = diff < 0 ? -100 : Math.min(diff / (3600 * 1000), 999);
  }
  return byQuadrant + byDeadline;
}

/** High-priority steps float up; everything else keeps the order you dragged it into. */
function orderSteps(subtasks: SubTask[]): SubTask[] {
  const weight = (s: SubTask) => (s.priority === 'high' ? 0 : s.priority === 'low' ? 2 : 1);
  return subtasks
    .map((s, index) => ({ s, index }))
    .sort((a, b) => weight(a.s) - weight(b.s) || a.index - b.index)
    .map(({ s }) => s);
}

export function FocusView() {
  const { tasks } = useMatrixStore();
  const now = useNow();
  const revealed = useIdleReveal();

  // Let the header recede with the rest of the page while you work.
  React.useEffect(() => {
    document.body.classList.toggle('focus-resting', !revealed);
    return () => document.body.classList.remove('focus-resting');
  }, [revealed]);

  const queue = React.useMemo(() => {
    const active = tasks.filter(
      (t) => t.completionState === 'pending' && t.status !== 'eliminate' && t.status !== 'inbox'
    );
    return [...active].sort((a, b) => scoreTask(a, now) - scoreTask(b, now));
  }, [tasks, now]);

  const currentTask = queue[0];
  const upNext = queue.slice(1, 4);

  if (!currentTask) return <FocusEmptyState />;

  return (
    <div className="mx-auto flex min-h-[calc(100vh-7rem)] w-full max-w-2xl flex-col justify-center py-10">
      <FocusCard key={currentTask.id} task={currentTask} revealed={revealed} />

      {upNext.length > 0 && (
        <ul className={`mt-16 space-y-1 border-t border-border/30 pt-4 ${veil(revealed)}`}>
          {upNext.map((t) => (
            <li key={t.id} className="flex items-center justify-between gap-3 text-xs text-muted-foreground/40">
              <span className="flex min-w-0 items-center gap-2">
                <span
                  className={`size-1 shrink-0 rounded-full ${
                    QUADRANTS[t.status as Exclude<TaskStatus, 'inbox'>]?.dot ?? 'bg-muted-foreground'
                  } opacity-60`}
                />
                <span className="truncate">{t.content}</span>
              </span>
              {t.parsedDate && (
                <span className="shrink-0 text-[10px]">{formatFriendlyDate(t.parsedDate)}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ──────── The single task on screen ──────── */

function FocusCard({ task, revealed }: { task: Task; revealed: boolean }) {
  const { toggleTaskCompletion, toggleSubtask, openTaskDetailModal, openAccountabilityModal } =
    useMatrixStore();

  const [showNotes, setShowNotes] = React.useState(false);

  const subtasks = React.useMemo(() => task.subtasks ?? [], [task.subtasks]);
  const ordered = React.useMemo(() => orderSteps(subtasks), [subtasks]);
  const remaining = ordered.filter((s) => !s.completed);
  const activeStep = remaining[0];

  const overdue = isOverdue(task.parsedDate, useNow());

  const celebrate = (particleCount: number) => {
    try {
      confetti({ particleCount, spread: 55, origin: { y: 0.55 }, ticks: 110, scalar: 0.8 });
    } catch {
      /* confetti is decoration — never let it break completion */
    }
  };

  const handleDone = () => {
    if (activeStep) {
      celebrate(remaining.length === 1 ? 40 : 18);
      toggleSubtask(task.id, activeStep.id);
      return;
    }
    celebrate(45);
    toggleTaskCompletion(task.id);
  };

  return (
    <div className="animate-rise space-y-7">
      {/* Deadline and which task this step belongs to */}
      <div className={`flex min-h-4 items-center gap-3 ${veil(revealed)}`}>
        {activeStep && (
          <button
            onClick={() => openTaskDetailModal(task.id)}
            className="focus-ring min-w-0 truncate rounded-md text-left text-xs text-muted-foreground/60 transition-colors hover:text-foreground"
            title="Open task"
          >
            {task.content}
          </button>
        )}
        {task.parsedDate && (
          <span
            className={`ml-auto shrink-0 text-[11px] ${
              overdue ? 'font-medium text-q-do-first' : 'text-muted-foreground/50'
            }`}
          >
            {formatFriendlyDate(task.parsedDate)}
          </span>
        )}
      </div>

      {activeStep && (
        <div className={`flex h-1 gap-1 ${veil(revealed)}`}>
          {ordered.map((s) => (
            <span
              key={s.id}
              className={`h-full flex-1 rounded-full transition-colors duration-300 ${
                s.completed ? 'bg-foreground/40' : s.id === activeStep.id ? 'bg-foreground/20' : 'bg-muted'
              }`}
            />
          ))}
        </div>
      )}

      {/* The one thing — the only element that never hides */}
      {activeStep ? (
        <h1 className="font-heading text-3xl leading-[1.15] font-semibold tracking-tight text-balance text-foreground sm:text-[2.6rem]">
          {activeStep.content}
        </h1>
      ) : (
        <button
          onClick={() => openTaskDetailModal(task.id)}
          className="focus-ring font-heading block w-full text-left text-3xl leading-[1.15] font-semibold tracking-tight text-balance text-foreground transition-colors hover:text-foreground/70 sm:text-[2.6rem]"
          title="Open task"
        >
          {task.content}
        </button>
      )}

      <div className={`flex items-center gap-4 ${veil(revealed)}`}>
        <button
          onClick={handleDone}
          className="focus-ring inline-flex items-center gap-2 rounded-xl bg-foreground px-5 py-2.5 text-sm font-semibold text-background opacity-35 transition-all hover:-translate-y-px hover:opacity-100 active:translate-y-0"
        >
          <Check className="size-4 stroke-[2.5]" />
          Done
        </button>

        <button
          onClick={() => openAccountabilityModal(task, 'rescheduled')}
          className="focus-ring rounded-md text-xs text-muted-foreground/50 transition-colors hover:text-foreground"
        >
          I&apos;m stuck
        </button>
      </div>

      {subtasks.length > 0 && (
        <ul className={`space-y-0.5 border-t border-border/30 pt-4 ${veil(revealed)}`}>
          {ordered.map((sub) => {
            const isActive = sub.id === activeStep?.id;
            return (
              <li key={sub.id}>
                <button
                  onClick={() => toggleSubtask(task.id, sub.id)}
                  className={`focus-ring flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-xs transition-colors ${
                    isActive
                      ? 'bg-muted/40 font-medium text-foreground/90'
                      : sub.completed
                        ? 'text-muted-foreground/30 line-through hover:text-muted-foreground/60'
                        : 'text-muted-foreground/60 hover:bg-muted/30 hover:text-foreground'
                  }`}
                >
                  {sub.completed ? (
                    <Check className="size-3 shrink-0 stroke-[2.5] text-muted-foreground/40" />
                  ) : (
                    <Circle
                      className={`size-3 shrink-0 ${isActive ? 'text-foreground/70' : 'text-muted-foreground/30'}`}
                      strokeWidth={1.5}
                    />
                  )}
                  <span className="truncate">{sub.content}</span>
                  {sub.priority === 'high' && !sub.completed && (
                    <span className="ml-auto size-1.5 shrink-0 rounded-full bg-q-do-first opacity-70" />
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {task.notes && (
        <div className={`border-t border-border/30 pt-4 ${veil(revealed)}`}>
          <button
            onClick={() => setShowNotes(!showNotes)}
            className="focus-ring rounded-md text-xs text-muted-foreground/50 transition-colors hover:text-foreground"
          >
            Notes
          </button>

          {showNotes && (
            <div className="mt-2 rounded-xl border border-border/40 bg-muted/20 p-3 text-xs leading-relaxed whitespace-pre-wrap text-foreground/70">
              {task.notes}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ──────── Empty states ──────── */

function FocusEmptyState() {
  const { tasks, setActiveView } = useMatrixStore();

  const unsorted = tasks.filter((t) => t.status === 'inbox' && t.completionState === 'pending').length;

  let icon = <PenLine className="size-5" />;
  let title = 'Nothing captured yet';
  let cta = { label: 'Capture', action: () => setActiveView('capture') };

  if (unsorted > 0) {
    icon = <Inbox className="size-5" />;
    title = `${unsorted} waiting to be sorted`;
    cta = { label: 'Sort', action: () => setActiveView('decide') };
  } else if (tasks.length > 0) {
    icon = <Check className="size-5" />;
    title = 'All clear';
  }

  return (
    <div className="animate-rise mx-auto flex min-h-[calc(100vh-7rem)] max-w-sm flex-col items-center justify-center text-center">
      <div className="flex size-11 items-center justify-center rounded-2xl border border-border/60 bg-muted/40 text-muted-foreground">
        {icon}
      </div>
      <h2 className="font-heading mt-4 text-lg font-semibold tracking-tight text-foreground">{title}</h2>
      <button
        onClick={cta.action}
        className="focus-ring mt-5 rounded-xl bg-foreground px-4 py-2 text-xs font-semibold text-background transition-transform hover:-translate-y-px"
      >
        {cta.label}
      </button>
    </div>
  );
}
