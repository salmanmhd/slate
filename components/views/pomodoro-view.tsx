'use client';

import React from 'react';
import { useMatrixStore } from '@/lib/store';
import { useSessionTimer } from '@/hooks/use-session-timer';
import { useIdleReveal } from '@/hooks/use-idle-reveal';
import { parseSessionInput, DEFAULT_SESSION_MINUTES } from '@/lib/duration-parser';
import { Play, Pause, RotateCcw, CornerDownLeft, Target } from 'lucide-react';

const SIZE = 240;
const CENTER = SIZE / 2;
const FACE = 96;
const TICK_OUTER = 104;

/** A pie slice from 12 o'clock sweeping clockwise. Shrinks as the block runs. */
function wedgePath(fraction: number): string {
  const angle = fraction * 2 * Math.PI;
  const x = CENTER + FACE * Math.sin(angle);
  const y = CENTER - FACE * Math.cos(angle);
  return `M ${CENTER} ${CENTER} L ${CENTER} ${CENTER - FACE} A ${FACE} ${FACE} 0 ${
    fraction > 0.5 ? 1 : 0
  } 1 ${x.toFixed(3)} ${y.toFixed(3)} Z`;
}

function minutesLeft(ms: number): string {
  const mins = Math.max(1, Math.ceil(ms / 60_000));
  return `${mins} ${mins === 1 ? 'minute' : 'minutes'} left`;
}

export function PomodoroView() {
  // A finished block brings the page back, so you notice on your next glance.
  const { revealed, wake } = useIdleReveal();
  const setActiveView = useMatrixStore((s) => s.setActiveView);
  // Read straight from the store — a second useSessionTimer would register a
  // second ticker against the same deadline.
  const timerLabel = useMatrixStore((s) => s.timer.label);
  const timerTaskId = useMatrixStore((s) => s.timer.taskId);
  const timerSource = useMatrixStore((s) => s.timer.source);

  // Repeating a block keeps its name *and* its task, so a block started from
  // Focus and run again here still lands against that task in the history.
  const context = React.useMemo(
    () => ({
      label: timerLabel ?? 'Pomodoro',
      taskId: timerTaskId ?? undefined,
      source: timerSource ?? ('pomodoro' as const),
    }),
    [timerLabel, timerTaskId, timerSource]
  );
  const timer = useSessionTimer(wake, context);
  const {
    remainingMs,
    durationMs,
    isRunning,
    isFinished,
    isPristine,
    label,
    toggle,
    startNamed,
    stop,
  } = timer;

  const [draft, setDraft] = React.useState('');
  const inputRef = React.useRef<HTMLInputElement>(null);

  // The input is only in the way once a block is under way. It comes back when
  // one finishes, so the next thing can be typed straight away.
  const showInput = isPristine || isFinished;

  const preview = React.useMemo(() => (draft.trim() ? parseSessionInput(draft) : null), [draft]);

  /**
   * Only strip the page back once a block is under way. Fading the input while
   * someone is still deciding what to type would be hostile.
   */
  const dimmed = !isPristine && !revealed;
  const veil = `transition-opacity duration-500 motion-reduce:transition-none focus-within:pointer-events-auto focus-within:opacity-100 ${
    dimmed ? 'pointer-events-none opacity-0' : 'opacity-100'
  }`;

  // Let the header recede with the rest of the page while the clock runs.
  React.useEffect(() => {
    document.body.classList.toggle('focus-resting', dimmed);
    return () => document.body.classList.remove('focus-resting');
  }, [dimmed]);

  React.useEffect(() => {
    if (showInput) inputRef.current?.focus();
  }, [showInput]);

  // Space pauses and resumes, once a block exists to pause.
  React.useEffect(() => {
    if (isPristine) return;

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
      toggle();
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isPristine, toggle]);

  const handleStart = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseSessionInput(draft);
    if (!parsed.label) return;
    startNamed(parsed.label, parsed.minutes);
    setDraft('');
    inputRef.current?.blur();
  };

  const fraction = isFinished ? 0 : durationMs > 0 ? Math.min(1, remainingMs / durationMs) : 0;

  return (
    <div className="mx-auto flex min-h-[calc(100vh-7rem)] w-full max-w-xl flex-col items-center justify-center gap-8 py-10">
      {/* Collapses to nothing while a block runs — a grid row transition so the
          clock glides into the space rather than snapping into it. */}
      <div
        className={`grid w-full transition-all duration-500 ease-out ${
          showInput ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
        }`}
      >
        <div className="overflow-hidden">
          <form onSubmit={handleStart}>
            <div className="relative">
              <input
                ref={inputRef}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                disabled={!showInput}
                placeholder="read 10 mins"
                aria-label="What are you working on, and for how long"
                className="w-full border-b border-border/60 bg-transparent pr-8 pb-2.5 text-center text-xl font-light tracking-tight text-foreground transition-colors placeholder:text-muted-foreground/30 focus:border-foreground/40 focus:outline-none"
                autoComplete="off"
              />
              {draft.trim() && (
                <button
                  type="submit"
                  className="focus-ring absolute right-0 bottom-3 rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground"
                  aria-label="Start"
                >
                  <CornerDownLeft className="size-4" />
                </button>
              )}
            </div>

            <p className="mt-2 h-4 text-center text-[11px] text-muted-foreground/60">
              {preview?.label
                ? `${preview.label} · ${preview.minutes} min${preview.matched ? '' : ' (default)'}`
                : ''}
            </p>
          </form>
        </div>
      </div>

      {/* The clock */}
      <button
        onClick={toggle}
        disabled={isPristine && !label}
        className={`focus-ring group relative rounded-full transition-transform duration-500 ease-out disabled:cursor-default ${
          showInput ? 'scale-100' : 'scale-110'
        }`}
        aria-label={isRunning ? 'Pause' : 'Start'}
        title={isRunning ? 'Pause (space)' : label ? 'Resume (space)' : 'Type a task above to begin'}
      >
        <svg
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          className={`size-72 sm:size-96 ${isFinished ? 'animate-pulse' : ''}`}
        >
          {/* Minute ticks — every fifth one longer, as on a real face */}
          {Array.from({ length: 60 }, (_, i) => {
            const major = i % 5 === 0;
            const angle = (i * 6 * Math.PI) / 180;
            const inner = major ? TICK_OUTER - 9 : TICK_OUTER - 4;
            return (
              <line
                key={i}
                x1={CENTER + inner * Math.sin(angle)}
                y1={CENTER - inner * Math.cos(angle)}
                x2={CENTER + TICK_OUTER * Math.sin(angle)}
                y2={CENTER - TICK_OUTER * Math.cos(angle)}
                className={major ? 'stroke-foreground/40' : 'stroke-foreground/15'}
                strokeWidth={major ? 2 : 1}
                strokeLinecap="round"
              />
            );
          })}

          <circle cx={CENTER} cy={CENTER} r={FACE} className="fill-muted/60" />

          {fraction > 0 &&
            (fraction >= 0.9999 ? (
              <circle cx={CENTER} cy={CENTER} r={FACE} className="fill-foreground/80" />
            ) : (
              <path d={wedgePath(fraction)} className="fill-foreground/80" />
            ))}
        </svg>

        {/* Only the transport glyph lives on the face, and only on hover */}
        <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span className="text-foreground/70 opacity-0 transition-opacity group-hover:opacity-100">
            {isRunning ? (
              <Pause className="size-7" fill="currentColor" />
            ) : (
              <Play className="size-7" fill="currentColor" />
            )}
          </span>
        </span>
      </button>

      {/* What is running, and how much of it is left */}
      <div className="flex min-h-14 flex-col items-center gap-1">
        {label &&
          !isPristine &&
          // A block tied to a real task offers the way back to it — the clock
          // alone gives you nothing to actually finish.
          (timerTaskId ? (
            <button
              onClick={() => setActiveView('focus')}
              className={`focus-ring max-w-sm truncate rounded-md text-center text-sm font-medium text-foreground hover:text-muted-foreground ${veil}`}
              title="Back to the task"
            >
              {label}
            </button>
          ) : (
            <p className={`max-w-sm truncate text-center text-sm font-medium text-foreground ${veil}`}>
              {label}
            </p>
          ))}

        {/* The clock and this line are the two things that never hide */}
        <p className="text-[11px] text-muted-foreground/60">
          {isPristine
            ? `${DEFAULT_SESSION_MINUTES} min unless you say otherwise`
            : isFinished
              ? 'Finished'
              : isRunning
                ? minutesLeft(remainingMs)
                : `Paused · ${minutesLeft(remainingMs)}`}
        </p>

        {!isPristine && (
          <div className={`mt-2 flex items-center gap-3 ${veil}`}>
            {timerTaskId && (
              <button
                onClick={() => setActiveView('focus')}
                className="focus-ring inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-muted-foreground/60 transition-colors hover:text-foreground"
              >
                <Target className="size-3" />
                Back to task
              </button>
            )}
            <button
              onClick={stop}
              className="focus-ring inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-muted-foreground/60 transition-colors hover:text-foreground"
              title="End this block and log it"
            >
              <RotateCcw className="size-3" />
              Reset
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
