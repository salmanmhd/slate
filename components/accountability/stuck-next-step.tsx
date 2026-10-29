'use client';

import React from 'react';
import { useMatrixStore, StuckNextStep as StuckNextStepState } from '@/lib/store';
import { BlockerCategory, Task } from '@/types/matrix';
import { X } from 'lucide-react';

const QUICK_START_MS = 10 * 60_000;

/** What each blocker asks of you next. One move, not a menu. */
const PLAYBOOK: Record<
  BlockerCategory,
  { title: string; body: string; input?: 'step' | 'steps' | 'task'; placeholder?: string; cta?: string }
> = {
  poor_clarity: {
    title: 'Make the first step obvious',
    body: 'Fuzzy tasks stall. Write the smallest physical action that moves it — something you could start in under a minute.',
    input: 'step',
    placeholder: 'Open the doc and write three bullet points',
    cta: 'Add step',
  },
  underestimated_time: {
    title: 'Split it smaller',
    body: 'It was bigger than it looked. Break it into steps you could each finish in one sitting — one per line.',
    input: 'steps',
    placeholder: 'Draft the outline\nWrite section one\nReview and send',
    cta: 'Add steps',
  },
  scope_creep: {
    title: 'Park the extras',
    body: 'Keep this task small. Move the nice-to-haves into their own task so they stop blocking the core.',
    input: 'task',
    placeholder: 'Polish animations on the settings page',
    cta: 'Create task',
  },
  external_dependency: {
    title: 'Nudge whoever you are waiting on',
    body: 'Waiting is fine; waiting silently is not. Add the follow-up as the next step so it is the first thing you see.',
    input: 'step',
    placeholder: 'Message Ali about the API key',
    cta: 'Add step',
  },
  distracted_procrastination: {
    title: 'Start small, right now',
    body: 'Distraction wins when the task feels big. Ten minutes is enough to get back in — the clock is there to help, not to judge.',
  },
  low_energy_burnout: {
    title: 'Save it for fresh energy',
    body: 'It is moved out of Focus for now. Pick something lighter for the energy you have left, and come back to this when you are rested.',
  },
  other: {
    title: 'Logged',
    body: 'Things happen. It will be back in Focus when the new time comes round.',
  },
};

export function StuckNextStep() {
  const { stuckNextStep, tasks } = useMatrixStore();
  if (!stuckNextStep || stuckNextStep.resolution === 'eliminated') return null;

  const task = tasks.find((t) => t.id === stuckNextStep.taskId);
  if (!task) return null;

  // A failed task is closed; only the repeat-stuck choice still applies to it.
  if (stuckNextStep.resolution === 'marked_failed' && stuckNextStep.stuckCount < 3) return null;

  return <StuckNextStepPanel key={`${task.id}-${stuckNextStep.stuckCount}`} task={task} state={stuckNextStep} />;
}

function StuckNextStepPanel({ task, state }: { task: Task; state: StuckNextStepState }) {
  const {
    closeStuckNextStep,
    addSubtask,
    addTask,
    moveTask,
    deferTask,
    startTimer,
    setActiveView,
    openTaskDetailModal,
  } = useMatrixStore();

  const repeat = state.stuckCount >= 3;
  const [mode, setMode] = React.useState<'choose' | 'act'>(repeat ? 'choose' : 'act');
  const [category, setCategory] = React.useState<BlockerCategory>(state.category);
  const [draft, setDraft] = React.useState('');
  const [added, setAdded] = React.useState(false);
  const [error, setError] = React.useState('');

  const play = PLAYBOOK[category];

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeStuckNextStep();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [closeStuckNextStep]);

  const startNow = () => {
    deferTask(task.id, null);
    startTimer({ label: task.content, taskId: task.id, source: 'focus' }, QUICK_START_MS);
    closeStuckNextStep();
    setActiveView('timer');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const lines = draft
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length === 0) {
      setError('Write at least one line.');
      return;
    }
    if (play.input === 'task') {
      addTask(lines.join(' '), 'schedule', undefined, undefined, task.category);
    } else {
      const toAdd = play.input === 'step' ? [lines.join(' ')] : lines;
      toAdd.forEach((content) => addSubtask(task.id, content, play.input === 'step' ? 'high' : 'normal'));
    }
    setDraft('');
    setAdded(true);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-background/40 backdrop-blur-sm" onClick={closeStuckNextStep} />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Next step for a stuck task"
        className="glass animate-rise relative max-h-[88vh] w-full max-w-md overflow-y-auto rounded-2xl p-5"
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-medium text-muted-foreground">Next step · {task.content}</p>
            <h3 className="font-heading mt-1 text-base font-semibold text-foreground">
              {mode === 'choose' ? `Stuck ${state.stuckCount} times now` : play.title}
            </h3>
          </div>
          <button
            onClick={closeStuckNextStep}
            className="focus-ring shrink-0 rounded-lg p-1 text-muted-foreground/60 transition-colors hover:text-foreground"
            aria-label="Close"
          >
            <X className="size-4" />
          </button>
        </div>

        {mode === 'choose' ? (
          <>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Rescheduling it again won&apos;t change anything. Pick one of these instead.
            </p>
            <div className="mt-4 flex flex-col gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setCategory('underestimated_time');
                  setMode('act');
                }}
                className="focus-ring rounded-xl border border-border/60 px-3 py-2.5 text-left transition-colors hover:border-foreground/30"
              >
                <span className="block text-xs font-semibold text-foreground">Break it down</span>
                <span className="block text-[11px] text-muted-foreground">Split it into steps you can actually finish</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  moveTask(task.id, 'delegate');
                  closeStuckNextStep();
                }}
                className="focus-ring rounded-xl border border-border/60 px-3 py-2.5 text-left transition-colors hover:border-foreground/30"
              >
                <span className="block text-xs font-semibold text-foreground">Delegate it</span>
                <span className="block text-[11px] text-muted-foreground">Move it to Delegate and hand it off</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  moveTask(task.id, 'eliminate');
                  closeStuckNextStep();
                }}
                className="focus-ring rounded-xl border border-border/60 px-3 py-2.5 text-left transition-colors hover:border-destructive/40"
              >
                <span className="block text-xs font-semibold text-foreground">Drop it</span>
                <span className="block text-[11px] text-muted-foreground">If it mattered, it would have happened</span>
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="text-xs leading-relaxed text-muted-foreground">{play.body}</p>

            {play.input && !added && (
              <form onSubmit={handleSubmit} className="mt-4 space-y-2">
                <textarea
                  autoFocus
                  rows={play.input === 'steps' ? 4 : 2}
                  value={draft}
                  onChange={(e) => {
                    setDraft(e.target.value);
                    if (error) setError('');
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey && play.input !== 'steps') {
                      e.preventDefault();
                      e.currentTarget.form?.requestSubmit();
                    }
                  }}
                  placeholder={play.placeholder}
                  aria-label={play.title}
                  className="w-full resize-none rounded-xl border border-border/60 bg-background p-3 text-xs text-foreground transition-colors placeholder:text-muted-foreground/40 focus:border-foreground/30 focus:outline-none"
                />
                {error && <p className="text-[11px] text-destructive">{error}</p>}
                <div className="flex justify-end">
                  <button
                    type="submit"
                    className="focus-ring rounded-xl bg-foreground px-4 py-1.5 text-xs font-semibold text-background transition-opacity hover:opacity-90"
                  >
                    {play.cta}
                  </button>
                </div>
              </form>
            )}

            {added && (
              <p className="mt-4 rounded-xl bg-muted/60 px-3 py-2 text-xs text-foreground">
                {play.input === 'task' ? 'New task added to Schedule.' : 'Added to the task.'}
              </p>
            )}

            <div className="mt-4 flex flex-wrap items-center justify-end gap-2 border-t border-border/50 pt-3">
              {play.input && play.input !== 'task' && added && (
                <button
                  type="button"
                  onClick={() => {
                    closeStuckNextStep();
                    openTaskDetailModal(task.id);
                  }}
                  className="focus-ring rounded-xl px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                  Open task
                </button>
              )}
              {category === 'low_energy_burnout' ? (
                <button
                  type="button"
                  onClick={() => {
                    closeStuckNextStep();
                    setActiveView('focus');
                  }}
                  className="focus-ring rounded-xl bg-foreground px-4 py-1.5 text-xs font-semibold text-background transition-opacity hover:opacity-90"
                >
                  Pick something lighter
                </button>
              ) : category === 'other' || category === 'scope_creep' ? (
                <button
                  type="button"
                  onClick={closeStuckNextStep}
                  className="focus-ring rounded-xl bg-foreground px-4 py-1.5 text-xs font-semibold text-background transition-opacity hover:opacity-90"
                >
                  Done
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={closeStuckNextStep}
                    className="focus-ring rounded-xl px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                  >
                    Later
                  </button>
                  {(category === 'distracted_procrastination' || added) && (
                    <button
                      type="button"
                      onClick={startNow}
                      className="focus-ring rounded-xl bg-foreground px-4 py-1.5 text-xs font-semibold text-background transition-opacity hover:opacity-90"
                    >
                      Start 10 min now
                    </button>
                  )}
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
