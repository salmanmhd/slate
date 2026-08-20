'use client';

import * as React from 'react';
import { useMatrixStore, TimerContext } from '@/lib/store';

export interface SessionTimer {
  durationMs: number;
  remainingMs: number;
  isRunning: boolean;
  isFinished: boolean;
  /** Untouched and sitting at its full length — nothing worth showing yet. */
  isPristine: boolean;
  /** What the running block is called, once one is under way. */
  label: string | null;
  toggle: () => void;
  setDuration: (ms: number) => void;
  /** Begin a named block of a given length, replacing anything in flight. */
  startNamed: (label: string, minutes: number) => void;
  /** End the block early. It is still logged. */
  stop: () => void;
}

/**
 * A single work block: pick a length, start, pause.
 *
 * Progress is derived from an absolute deadline rather than by decrementing a
 * counter, so a backgrounded tab — where browsers throttle timers hard — still
 * reports the truth when you come back to it.
 *
 * `context` names whatever the block will be logged as; it is read at the
 * moment a block starts, never after.
 */
export function useSessionTimer(onComplete: () => void, context: TimerContext): SessionTimer {
  const timer = useMatrixStore((s) => s.timer);
  const startTimer = useMatrixStore((s) => s.startTimer);
  const pauseTimer = useMatrixStore((s) => s.pauseTimer);
  const finishTimer = useMatrixStore((s) => s.finishTimer);
  const stopTimer = useMatrixStore((s) => s.stopTimer);

  const { durationMs, deadline, remainingMs, finished, startedAt, label } = timer;
  const isRunning = deadline !== null;

  // Kept in a ref so the callbacks below stay referentially stable while the
  // clock ticks — callers use them as effect dependencies.
  const contextRef = React.useRef(context);
  React.useEffect(() => {
    contextRef.current = context;
  }, [context]);

  React.useEffect(() => {
    if (deadline === null) return;

    const tick = () => {
      const left = Math.max(0, deadline - Date.now());
      if (left === 0) {
        finishTimer();
        onComplete();
        return;
      }
      useMatrixStore.getState().setTimer({ remainingMs: left });
    };

    const id = window.setInterval(tick, 500);
    return () => window.clearInterval(id);
  }, [deadline, finishTimer, onComplete]);

  const toggle = React.useCallback(() => {
    if (useMatrixStore.getState().timer.deadline !== null) {
      pauseTimer();
      return;
    }
    startTimer(contextRef.current);
  }, [pauseTimer, startTimer]);

  const setDuration = React.useCallback(
    (ms: number) => {
      // Changing the length ends whatever was running — and logs it.
      stopTimer(ms);
    },
    [stopTimer]
  );

  const startNamed = React.useCallback(
    (name: string, minutes: number) => {
      // Typed by hand, so it belongs to no task — never inherit one.
      startTimer({ label: name, source: 'pomodoro' }, minutes * 60_000);
    },
    [startTimer]
  );

  const stop = React.useCallback(() => stopTimer(), [stopTimer]);

  return {
    durationMs,
    remainingMs,
    isRunning,
    isFinished: finished,
    isPristine: startedAt === null && !finished && remainingMs === durationMs,
    label,
    toggle,
    setDuration,
    startNamed,
    stop,
  };
}
