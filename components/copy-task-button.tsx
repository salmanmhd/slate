'use client';

import React from 'react';
import { Check, Copy } from 'lucide-react';
import { Task } from '@/types/matrix';

/** The task on the first line, its steps beneath as a checklist. */
export function taskToText(task: Task): string {
  const steps = (task.subtasks ?? []).map((s) => `- [${s.completed ? 'x' : ' '}] ${s.content}`);
  return [task.content, ...steps].join('\n');
}

/**
 * A quiet copy affordance. It has no visibility of its own — the caller reveals
 * it on hover through `className`. After a copy it swaps to a tick for a moment.
 */
export function CopyTaskButton({ task, className = '' }: { task: Task; className?: string }) {
  const [copied, setCopied] = React.useState(false);
  const timer = React.useRef<number | undefined>(undefined);

  React.useEffect(() => () => window.clearTimeout(timer.current), []);

  const copy = async (e: React.MouseEvent) => {
    // The button lives inside draggable, clickable cards.
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(taskToText(task));
    } catch {
      return;
    }
    setCopied(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setCopied(false), 1500);
  };

  const label = copied ? 'Copied' : 'Copy task and steps';

  return (
    <button
      type="button"
      onPointerDown={(e) => e.stopPropagation()}
      onClick={copy}
      className={`focus-ring relative inline-flex shrink-0 rounded-md text-muted-foreground/50 transition-colors hover:text-foreground focus-visible:opacity-100 ${
        copied ? 'opacity-100!' : ''
      } ${className}`}
      title={label}
      aria-label={label}
    >
      {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
      {/* Floats, so the label never nudges the layout around it */}
      <span
        role="status"
        className={
          copied
            ? 'absolute top-full right-0 z-10 mt-0.5 rounded bg-foreground px-1.5 py-0.5 text-[10px] font-medium whitespace-nowrap text-background'
            : 'sr-only'
        }
      >
        {copied ? 'Copied' : ''}
      </span>
    </button>
  );
}
