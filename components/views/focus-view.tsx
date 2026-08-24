'use client';

import React from 'react';
import { useMatrixStore } from '@/lib/store';
import { SubTask, Task, TaskStatus } from '@/types/matrix';
import { formatFriendlyDate } from '@/lib/nlp-parser';
import { useNow, isOverdue } from '@/hooks/use-now';
import { DEFER_PRESETS, isDeferred, formatDeferLabel } from '@/lib/defer';
import { useIdleReveal } from '@/hooks/use-idle-reveal';
import { useSessionTimer } from '@/hooks/use-session-timer';
import { FocusTimer } from '@/components/focus-timer';
import confetti from 'canvas-confetti';
import { CATEGORY_BY_ID } from '@/lib/categories';
import { Check, Inbox, PenLine, Layers, CalendarClock, Pencil } from 'lucide-react';

/** Everything that is not the task itself hides while the pointer is still. */
const VEIL = 'transition-opacity duration-500 motion-reduce:transition-none';
const veil = (revealed: boolean) =>
  `${VEIL} ${revealed ? 'opacity-100' : 'pointer-events-none opacity-0'} focus-within:pointer-events-auto focus-within:opacity-100`;

/**
 * Work the matrix top-left to bottom-right: clear Do First before Schedule,
 * Schedule before Delegate, and so on. Within a quadrant the task on top is
 * the one you dragged there, so manual order is the tiebreaker — not a score.
 */
const FOCUS_ORDER: TaskStatus[] = ['do_first', 'schedule', 'delegate', 'eliminate'];

/** High-priority steps float up; everything else keeps the order you dragged it into. */
function orderSteps(subtasks: SubTask[]): SubTask[] {
  const weight = (s: SubTask) => (s.priority === 'high' ? 0 : s.priority === 'low' ? 2 : 1);
  return subtasks
    .map((s, index) => ({ s, index }))
    .sort((a, b) => weight(a.s) - weight(b.s) || a.index - b.index)
    .map(({ s }) => s);
}

export function FocusView() {
  const { tasks, activeCategory, activeModalTaskId, accountabilityModalTask, setActiveView } =
    useMatrixStore();
  const now = useNow();
  const { revealed, wake } = useIdleReveal();

  // Let the header recede with the rest of the page while you work.
  React.useEffect(() => {
    document.body.classList.toggle('focus-resting', !revealed);
    return () => document.body.classList.remove('focus-resting');
  }, [revealed]);

  const { currentTask, nextAvailableAt } = React.useMemo(() => {
    // Strictly the context chosen on Decide: pick Work and only work surfaces,
    // even if that means nothing surfaces at all.
    const pending = tasks.filter(
      (t) =>
        t.completionState === 'pending' &&
        (activeCategory === 'all' || t.category === activeCategory)
    );

    // A deferral is the only thing that hides a task. A deadline says when it
    // must be *finished*, so it must never stop you starting early.
    const available = pending.filter((t) => !isDeferred(t, now));

    // Q1 → Q2 → Q3 → Q4, and within a quadrant an overdue task comes first;
    // everything else keeps the order you dragged it into. Written as a fold
    // rather than a loop with an early return, which the compiler cannot memo.
    const next = FOCUS_ORDER.reduce<Task | undefined>((found, status) => {
      if (found) return found;
      const inQuadrant = available.filter((t) => t.status === status);
      const overdue = inQuadrant.find(
        (t) => t.parsedDate && new Date(t.parsedDate).getTime() < now
      );
      return overdue ?? inQuadrant[0];
    }, undefined);

    // When nothing is available, say when the first thing wakes up.
    const wakes = pending
      .filter((t) => isDeferred(t, now))
      .map((t) => new Date(t.deferUntil as string).getTime())
      .sort((a, b) => a - b);

    return { currentTask: next, nextAvailableAt: wakes[0] ?? null };
  }, [tasks, activeCategory, now]);

  // A block started here is logged against whatever task is on screen.
  const timerContext = React.useMemo(
    () => ({
      label: currentTask?.content ?? 'Focus',
      taskId: currentTask?.id,
      source: 'focus' as const,
    }),
    [currentTask]
  );
  // A finished block brings the page back, so you notice on your next glance.
  const timer = useSessionTimer(wake, timerContext);
  const { isPristine, toggle } = timer;

  /**
   * Starting a block here hands you to the Timer page and its big clock.
   * Only on a *fresh* start — resuming after a pause leaves you where you are,
   * since being bounced across pages every time you unpause would be absurd.
   */
  const startAndJump = React.useCallback(() => {
    const wasIdle = useMatrixStore.getState().timer.startedAt === null;
    toggle();
    if (wasIdle) setActiveView('timer');
  }, [toggle, setActiveView]);

  const dialTimer = React.useMemo(
    () => ({ ...timer, toggle: startAndJump }),
    [timer, startAndJump]
  );

  // Space pauses and resumes — but only once a block is under way, so the key
  // is not quietly hijacked from someone who never starts a timer.
  React.useEffect(() => {
    if (isPristine || activeModalTaskId || accountabilityModalTask) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'Space' && e.key !== ' ') return;

      const target = e.target as HTMLElement | null;
      if (
        !target ||
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        // A focused button already treats Space as a click — let it.
        target.tagName === 'BUTTON' ||
        target.isContentEditable
      ) {
        return;
      }

      e.preventDefault();
      startAndJump();
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isPristine, startAndJump, activeModalTaskId, accountabilityModalTask]);

  if (!currentTask) return <FocusEmptyState nextAvailableAt={nextAvailableAt} now={now} />;

  return (
    <>
      <div className="mx-auto flex min-h-[calc(100vh-7rem)] w-full max-w-2xl flex-col justify-center py-10">
        <FocusCard key={currentTask.id} task={currentTask} revealed={revealed} />
      </div>
      <TodayStamp now={now} revealed={revealed} />
      <FocusTimer timer={dialTimer} revealed={revealed} />
    </>
  );
}

/* ──────── Today, quietly, in the corner ──────── */

function TodayStamp({ now, revealed }: { now: number; revealed: boolean }) {
  const label = new Date(now).toLocaleDateString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  return (
    <p className={`fixed bottom-6 left-6 z-20 text-[11px] text-muted-foreground/50 ${veil(revealed)}`}>
      {label}
    </p>
  );
}

/* ──────── The single task on screen ──────── */

function FocusCard({ task, revealed }: { task: Task; revealed: boolean }) {
  const {
    toggleTaskCompletion,
    toggleSubtask,
    deferSubtask,
    deferTask,
    openTaskDetailModal,
    openAccountabilityModal,
  } = useMatrixStore();

  const [showNotes, setShowNotes] = React.useState(false);
  const [showLater, setShowLater] = React.useState(false);
  const now = useNow();

  const subtasks = React.useMemo(() => task.subtasks ?? [], [task.subtasks]);
  const ordered = React.useMemo(() => orderSteps(subtasks), [subtasks]);
  const remaining = ordered.filter((s) => !s.completed);
  const activeStep = remaining[0];

  const overdue = isOverdue(task.parsedDate, now);

  /**
   * A step earns a small pop; finishing the whole task earns a proper burst.
   * The difference is the point — the reward has to scale with what you did.
   */
  const celebrate = (finishedTask: boolean) => {
    try {
      if (!finishedTask) {
        confetti({
          particleCount: 22,
          spread: 45,
          startVelocity: 22,
          origin: { y: 0.6 },
          ticks: 90,
          scalar: 0.75,
          disableForReducedMotion: true,
        });
        return;
      }

      const burst = { ticks: 180, scalar: 0.95, disableForReducedMotion: true };
      confetti({ ...burst, particleCount: 80, spread: 80, startVelocity: 42, origin: { x: 0.5, y: 0.62 } });
      confetti({ ...burst, particleCount: 45, spread: 60, angle: 55, startVelocity: 48, origin: { x: 0.08, y: 0.8 } });
      confetti({ ...burst, particleCount: 45, spread: 60, angle: 125, startVelocity: 48, origin: { x: 0.92, y: 0.8 } });
    } catch {
      /* confetti is decoration — never let it break completion */
    }
  };

  const complete = () => {
    if (activeStep) {
      celebrate(false);
      toggleSubtask(task.id, activeStep.id);
      return;
    }
    celebrate(true);
    toggleTaskCompletion(task.id);
  };

  return (
    <div className="animate-rise space-y-7">
      {/* Which task this step belongs to, and when it is due */}
      <div className={`flex min-h-4 items-center justify-center gap-3 ${veil(revealed)}`}>
        {activeStep && (
          <p className="min-w-0 truncate text-xs text-muted-foreground/60">{task.content}</p>
        )}
        {task.parsedDate && (
          <span
            className={`shrink-0 text-[11px] ${
              overdue ? 'font-medium text-q-do-first' : 'text-muted-foreground/50'
            }`}
          >
            {formatFriendlyDate(task.parsedDate)}
          </span>
        )}
      </div>

      {/* How far through the steps you are — the bar replaces the list */}
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

      {/* The task sits centred, edit surfacing on hover to the left and the
          tick to the right. Both reserve their space, so nothing shifts. */}
      <div className="group flex items-start gap-4">
        <button
          onClick={() => openTaskDetailModal(task.id)}
          className="focus-ring mt-1.5 flex size-6 shrink-0 items-center justify-center rounded-full text-muted-foreground/40 opacity-0 transition-all group-hover:opacity-100 hover:text-foreground focus-visible:opacity-100 sm:mt-2.5 sm:size-7"
          title="Edit task, steps and notes"
          aria-label="Edit task"
        >
          <Pencil className="size-4" />
        </button>

        <h1 className="font-heading flex-1 text-center text-3xl leading-[1.15] font-semibold tracking-tight text-balance text-foreground sm:text-[2.6rem]">
          {activeStep ? activeStep.content : task.content}
        </h1>

        <button
          onClick={complete}
          className="focus-ring group/check mt-1.5 shrink-0 rounded-full opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 sm:mt-2.5"
          title={activeStep ? 'Complete this step' : 'Complete this task'}
          aria-label={activeStep ? 'Complete this step' : 'Complete this task'}
        >
          <span className="flex size-6 items-center justify-center rounded-full border-2 border-muted-foreground/40 transition-colors group-hover/check:border-foreground group-hover/check:bg-foreground sm:size-7">
            <Check className="size-3.5 stroke-3 text-background opacity-0 transition-opacity group-hover/check:opacity-100" />
          </span>
        </button>
      </div>

      <div className={`flex flex-wrap items-center justify-center gap-4 ${veil(revealed)}`}>
        {/* Quick push, no form to fill in. The deadline stays where it is. */}
        {showLater ? (
          <span className="flex items-center gap-2.5">
            {DEFER_PRESETS.filter((p) => p.available(now)).map((preset) => (
              <button
                key={preset.label}
                onClick={() => {
                  deferTask(task.id, preset.at(now).toISOString());
                  setShowLater(false);
                }}
                className="focus-ring rounded-md text-xs font-medium text-foreground/70 transition-colors hover:text-foreground"
              >
                {preset.label}
              </button>
            ))}
            <button
              onClick={() => setShowLater(false)}
              className="focus-ring rounded-md text-xs text-muted-foreground/40 transition-colors hover:text-foreground"
            >
              Cancel
            </button>
          </span>
        ) : (
          <button
            onClick={() => setShowLater(true)}
            className="focus-ring rounded-md text-xs text-muted-foreground/50 transition-colors hover:text-foreground"
            title="Push this task out of Focus for a while"
          >
            Later
          </button>
        )}

        {/* Blocked on this one step, not the whole task */}
        {activeStep && remaining.length > 1 && (
          <button
            onClick={() => deferSubtask(task.id, activeStep.id)}
            className="focus-ring rounded-md text-xs text-muted-foreground/50 transition-colors hover:text-foreground"
            title="Send this step to the back and show the next one"
          >
            Skip step
          </button>
        )}

        <button
          onClick={() => openAccountabilityModal(task, 'rescheduled')}
          className="focus-ring rounded-md text-xs text-muted-foreground/50 transition-colors hover:text-foreground"
          title="Name what is blocking the whole task"
        >
          I&apos;m stuck
        </button>

        {task.notes && (
          <button
            onClick={() => setShowNotes(!showNotes)}
            className="focus-ring rounded-md text-xs text-muted-foreground/50 transition-colors hover:text-foreground"
          >
            Notes
          </button>
        )}
      </div>

      {task.notes && showNotes && (
        <div
          className={`rounded-xl border border-border/40 bg-muted/20 p-3 text-xs leading-relaxed whitespace-pre-wrap text-foreground/70 ${veil(revealed)}`}
        >
          {task.notes}
        </div>
      )}
    </div>
  );
}

/* ──────── Empty states ──────── */

function FocusEmptyState({
  nextAvailableAt,
  now,
}: {
  nextAvailableAt: number | null;
  now: number;
}) {
  const { tasks, setActiveView, activeCategory } = useMatrixStore();

  const pending = tasks.filter((t) => t.completionState === 'pending');
  const inContext =
    activeCategory === 'all' ? pending : pending.filter((t) => t.category === activeCategory);
  const unsorted = inContext.filter((t) => t.status === 'inbox').length;

  let icon = <PenLine className="size-5" />;
  let title = 'Nothing captured yet';
  let cta = { label: 'Capture', action: () => setActiveView('capture') };

  if (activeCategory !== 'all' && inContext.length === 0) {
    // The mode is empty. Say which mode, and point at the page that owns it.
    icon = <Layers className="size-5" />;
    title = `Nothing in ${CATEGORY_BY_ID[activeCategory].label}`;
    cta = { label: 'Open Decide', action: () => setActiveView('decide') };
  } else if (nextAvailableAt !== null) {
    // Work exists, but you pushed all of it later. Name the hour it comes
    // back rather than claiming you are finished.
    icon = <CalendarClock className="size-5" />;
    title = `Nothing until ${formatDeferLabel(new Date(nextAvailableAt).toISOString(), now)}`;
    cta = { label: 'Open Decide', action: () => setActiveView('decide') };
  } else if (unsorted > 0) {
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
