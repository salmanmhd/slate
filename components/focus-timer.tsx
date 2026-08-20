'use client';

import React from 'react';
import { SessionTimer } from '@/hooks/use-session-timer';
import { TIMER_PRESETS_MIN } from '@/lib/store';
import { Play, Pause, Check } from 'lucide-react';

const CENTER = 18;
const RADIUS = 15;

/** Minutes only — a block timer is not a stopwatch, and ticking seconds nag. */
function minutesLeft(ms: number): string {
  return `${Math.max(1, Math.ceil(ms / 60_000))}m`;
}

/** A pie slice from 12 o'clock, sweeping clockwise. Depletes as the block runs. */
function Wedge({ fraction, className }: { fraction: number; className: string }) {
  if (fraction <= 0) return null;
  if (fraction >= 0.9999) {
    return <circle cx={CENTER} cy={CENTER} r={RADIUS} className={className} />;
  }
  const angle = fraction * 2 * Math.PI;
  const x = CENTER + RADIUS * Math.sin(angle);
  const y = CENTER - RADIUS * Math.cos(angle);
  return (
    <path
      d={`M ${CENTER} ${CENTER} L ${CENTER} ${CENTER - RADIUS} A ${RADIUS} ${RADIUS} 0 ${
        fraction > 0.5 ? 1 : 0
      } 1 ${x.toFixed(3)} ${y.toFixed(3)} Z`}
      className={className}
    />
  );
}

/**
 * Session work timer, parked in the corner of the Focus page so it never
 * competes with the task itself.
 */
export function FocusTimer({ timer, revealed }: { timer: SessionTimer; revealed: boolean }) {
  const { durationMs, remainingMs, isRunning, isFinished, isPristine, toggle, setDuration } = timer;
  const [custom, setCustom] = React.useState('');

  const isPaused = !isRunning && !isFinished && !isPristine;
  const fraction = isFinished ? 1 : durationMs > 0 ? remainingMs / durationMs : 0;

  // An untouched timer hides with the rest of the page; a live one stays
  // faintly lit so a glance is enough.
  const visibility = isPristine
    ? revealed
      ? 'opacity-100'
      : 'pointer-events-none opacity-0'
    : revealed
      ? 'opacity-100'
      : 'opacity-40';

  const applyCustom = (e: React.FormEvent) => {
    e.preventDefault();
    const minutes = parseInt(custom, 10);
    if (!Number.isFinite(minutes) || minutes < 1) return;
    setDuration(Math.min(minutes, 600) * 60_000);
    setCustom('');
  };

  const activePreset = TIMER_PRESETS_MIN.find((m) => m * 60_000 === durationMs);

  return (
    <div
      className={`group/timer fixed right-5 bottom-5 z-20 flex flex-col items-end gap-2 transition-opacity duration-500 motion-reduce:transition-none focus-within:pointer-events-auto focus-within:opacity-100 ${visibility}`}
    >
      {/* Length: three presets plus anything you type */}
      <div className="pointer-events-none flex items-center gap-2 opacity-0 transition-opacity duration-200 group-hover/timer:pointer-events-auto group-hover/timer:opacity-100 focus-within:pointer-events-auto focus-within:opacity-100">
        {TIMER_PRESETS_MIN.map((min) => (
          <button
            key={min}
            onClick={() => setDuration(min * 60_000)}
            className={`focus-ring rounded-md px-1 text-[11px] tabular-nums transition-colors ${
              activePreset === min
                ? 'font-semibold text-foreground'
                : 'text-muted-foreground/60 hover:text-foreground'
            }`}
            title={`${min} minute block`}
          >
            {min}
          </button>
        ))}

        <form onSubmit={applyCustom} className="flex items-center">
          <input
            type="number"
            min={1}
            max={600}
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            onBlur={applyCustom}
            placeholder={activePreset ? 'min' : String(Math.round(durationMs / 60_000))}
            aria-label="Minutes"
            className="w-9 border-b border-border/60 bg-transparent px-0.5 py-0.5 text-center text-[11px] tabular-nums text-foreground placeholder:text-muted-foreground/50 focus:border-foreground/40 focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          />
        </form>
      </div>

      {/* The dial. Clicking it — or pressing space — is play/pause. */}
      <button
        onClick={toggle}
        className="focus-ring group/dial flex items-center gap-3 rounded-2xl"
        aria-label={isRunning ? 'Pause timer' : 'Start timer'}
        title={
          isFinished
            ? 'Block complete — start another'
            : isRunning
              ? 'Pause (space)'
              : isPristine
                ? 'Start'
                : 'Resume (space)'
        }
      >
        <span className="relative flex size-20 items-center justify-center">
          {/* Remounts on every toggle, restarting the pulse — the feedback that
              a keyboard start/pause actually registered. */}
          {!isPristine && (
            <span
              key={String(isRunning)}
              aria-hidden
              className="animate-dial-ping pointer-events-none absolute inset-0 rounded-full bg-foreground/25"
            />
          )}

          <svg viewBox="0 0 36 36" className={`size-20 ${isFinished ? 'animate-pulse' : ''}`}>
            <circle cx={CENTER} cy={CENTER} r={RADIUS} className="fill-muted" />
            <Wedge
              fraction={fraction}
              className={
                isFinished ? 'fill-foreground' : isPaused ? 'fill-foreground/30' : 'fill-foreground/75'
              }
            />
          </svg>

          <span className="absolute inset-0 flex items-center justify-center">
            {isFinished ? (
              <Check className="size-6 stroke-3 text-background" />
            ) : isPaused ? (
              // Held visible: a paused block should look paused from across the room.
              <Play className="size-6 text-foreground/70" fill="currentColor" />
            ) : isRunning ? (
              <Pause
                className="size-6 text-background opacity-0 transition-opacity group-hover/dial:opacity-100"
                fill="currentColor"
              />
            ) : (
              <Play
                className="size-6 text-background opacity-0 transition-opacity group-hover/dial:opacity-100"
                fill="currentColor"
              />
            )}
          </span>
        </span>

        <span
          className={`text-base font-medium tabular-nums transition-colors ${
            isPaused ? 'text-muted-foreground' : 'text-foreground'
          }`}
        >
          {minutesLeft(isFinished ? durationMs : remainingMs)}
        </span>
      </button>
    </div>
  );
}
