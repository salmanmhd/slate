'use client';

import React from 'react';
import { Task } from '@/types/matrix';
import { formatFriendlyDate } from '@/lib/nlp-parser';
import { useNow, isOverdue } from '@/hooks/use-now';
import { isDeferred, formatDeferLabel } from '@/lib/defer';
import { Calendar, AlertCircle, FileText, Moon } from 'lucide-react';

/**
 * The deadline / steps / notes strip under a task title.
 *
 * One source of truth for *what* a task shows, two presentations for where it
 * shows it: chips on the dense matrix cards, a quiet line of text on Capture's
 * airy list, where chips read as clutter.
 */
export function TaskMeta({
  task,
  accentDot,
  variant = 'chips',
}: {
  task: Task;
  accentDot?: string;
  variant?: 'chips' | 'line';
}) {
  const now = useNow();
  const overdue = isOverdue(task.parsedDate, now);
  const deferred = isDeferred(task, now);
  const subtasks = task.subtasks || [];
  const doneSubs = subtasks.filter((s) => s.completed).length;

  const hasAny =
    Boolean(task.parsedDate) || subtasks.length > 0 || Boolean(task.notes) || deferred;

  if (variant === 'line') {
    if (!hasAny) return null;

    const parts: React.ReactNode[] = [];
    if (deferred) {
      parts.push(
        <span key="defer">Later · {formatDeferLabel(task.deferUntil as string, now)}</span>
      );
    }
    if (task.parsedDate) {
      parts.push(
        <span key="date" className={overdue ? 'font-medium text-q-do-first' : undefined}>
          {formatFriendlyDate(task.parsedDate)}
        </span>
      );
    }
    if (subtasks.length > 0) {
      parts.push(
        <span key="steps">
          {doneSubs}/{subtasks.length} steps
        </span>
      );
    }
    if (task.notes) parts.push(<span key="notes">Notes</span>);

    return (
      <p className="mt-1 text-[11px] text-muted-foreground/60">
        {parts.map((part, i) => (
          <React.Fragment key={i}>
            {i > 0 && <span className="px-1.5 text-muted-foreground/30">·</span>}
            {part}
          </React.Fragment>
        ))}
      </p>
    );
  }

  if (!hasAny && !accentDot) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5 pt-0.5 text-[10px] text-muted-foreground">
      {accentDot && <span className={`size-1 rounded-full ${accentDot} opacity-70`} aria-hidden />}

      {deferred && (
        <span
          className="inline-flex items-center gap-0.5 rounded bg-muted px-1 py-px font-medium text-muted-foreground"
          title="Hidden from Focus until this time"
        >
          <Moon className="size-2.5" />
          {formatDeferLabel(task.deferUntil as string, now)}
        </span>
      )}

      {task.parsedDate && (
        <span
          className={`inline-flex items-center gap-0.5 rounded px-1 py-px font-medium ${
            overdue ? 'bg-q-do-first/10 text-q-do-first' : 'bg-muted text-muted-foreground'
          }`}
        >
          {overdue ? <AlertCircle className="size-2.5" /> : <Calendar className="size-2.5" />}
          {formatFriendlyDate(task.parsedDate)}
        </span>
      )}

      {subtasks.length > 0 && (
        <span className="rounded bg-muted px-1.5 py-px font-semibold tabular-nums text-muted-foreground">
          {doneSubs}/{subtasks.length}
        </span>
      )}

      {task.notes && <FileText className="size-2.5 text-muted-foreground/70" aria-label="Has notes" />}
    </div>
  );
}
