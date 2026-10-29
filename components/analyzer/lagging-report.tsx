'use client';

import React from 'react';
import { useMatrixStore } from '@/lib/store';
import { AccountabilityLog, BlockerCategory, PomodoroSession, Task } from '@/types/matrix';
import { BLOCKER_CATEGORIES } from '@/lib/constants';
import { formatFriendlyDate } from '@/lib/nlp-parser';
import { format, isSameDay, startOfDay, subDays } from 'date-fns';

const DAY_MS = 24 * 3600 * 1000;

/** One line of advice per blocker — what to change next week, not a lecture. */
const BLOCKER_ADVICE: Record<BlockerCategory, string> = {
  poor_clarity: 'Before you start a task, write its first tiny step. Fuzzy tasks are where you stall most.',
  underestimated_time: 'Your tasks are bigger than they look. Split anything over an hour into steps before you commit to it.',
  scope_creep: 'You keep growing tasks while doing them. Park extras as new tasks and finish the small version first.',
  external_dependency: 'You wait on others a lot. Send the follow-up as the first step, not the last.',
  distracted_procrastination: 'Starting is the hard part. Commit to ten minutes, not the whole task.',
  low_energy_burnout: 'You stall when tired. Put your hardest task in your freshest hour, and plan lighter work for later.',
  other: 'Surprises keep landing. Leave some slack in each day instead of planning it full.',
};

interface Props {
  tasks: Task[];
  logs: AccountabilityLog[];
  sessions: PomodoroSession[];
}

export function LaggingReport({ tasks, logs, sessions }: Props) {
  const { openTaskDetailModal } = useMatrixStore();
  // Captured once per mount so the report is stable while you read it.
  const [now] = React.useState(() => Date.now());

  const report = React.useMemo(() => {
    const weekStart = startOfDay(subDays(now, 6)).getTime();
    const monthStart = now - 30 * DAY_MS;
    const inWeek = (iso?: string | null) => !!iso && new Date(iso).getTime() >= weekStart;

    const doneThisWeek = tasks.filter((t) => t.completionState === 'completed' && inWeek(t.completedAt));
    const stuckThisWeek = logs.filter((l) => inWeek(l.loggedAt));

    const withDeadline = doneThisWeek.filter((t) => t.parsedDate);
    const onTime = withDeadline.filter(
      (t) => new Date(t.completedAt as string).getTime() <= new Date(t.parsedDate as string).getTime()
    ).length;

    const overdue = tasks
      .filter(
        (t) =>
          t.completionState === 'pending' &&
          t.status !== 'eliminate' &&
          t.parsedDate &&
          new Date(t.parsedDate).getTime() < now
      )
      .sort((a, b) => (a.parsedDate as string).localeCompare(b.parsedDate as string));

    const days = Array.from({ length: 7 }, (_, i) => {
      const day = subDays(now, 6 - i);
      return {
        label: format(day, 'EEE'),
        isToday: i === 6,
        done: doneThisWeek.filter((t) => isSameDay(new Date(t.completedAt as string), day)).length,
        stuck: stuckThisWeek.filter((l) => isSameDay(new Date(l.loggedAt), day)).length,
      };
    });
    const dayMax = Math.max(1, ...days.map((d) => d.done + d.stuck));

    const recentLogs = logs.filter((l) => new Date(l.loggedAt).getTime() >= monthStart);
    const blockerCounts = new Map<BlockerCategory, number>();
    recentLogs.forEach((l) => blockerCounts.set(l.category, (blockerCounts.get(l.category) ?? 0) + 1));
    const blockers = [...blockerCounts.entries()]
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count);

    const stuckByTask = new Map<string, number>();
    logs.forEach((l) => stuckByTask.set(l.taskId, (stuckByTask.get(l.taskId) ?? 0) + 1));
    const repeat = tasks
      .filter((t) => t.completionState === 'pending' && (stuckByTask.get(t.id) ?? 0) >= 2)
      .map((t) => ({ task: t, count: stuckByTask.get(t.id) as number }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Focus time is supporting evidence: which tasks actually got attention.
    const minutesByTask = new Map<string, number>();
    sessions
      .filter((s) => s.taskId && inWeek(s.endedAt))
      .forEach((s) =>
        minutesByTask.set(s.taskId as string, (minutesByTask.get(s.taskId as string) ?? 0) + s.workedMs / 60_000)
      );
    const attention = [...minutesByTask.entries()]
      .map(([id, minutes]) => ({ task: tasks.find((t) => t.id === id), minutes: Math.round(minutes) }))
      .filter((a): a is { task: Task; minutes: number } => !!a.task && a.minutes > 0)
      .sort((a, b) => b.minutes - a.minutes)
      .slice(0, 5);

    return {
      done: doneThisWeek.length,
      stuck: stuckThisWeek.length,
      overdue,
      onTimePct: withDeadline.length ? Math.round((onTime / withDeadline.length) * 100) : null,
      days,
      dayMax,
      blockers,
      blockerTotal: recentLogs.length,
      repeat,
      attention,
    };
  }, [tasks, logs, sessions, now]);

  const topBlocker = report.blockers[0];

  return (
    <div className="space-y-4">
      {/* The headline: this week in four numbers */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Done this week" value={report.done} />
        <Stat label="Got stuck" value={report.stuck} tone={report.stuck > report.done ? 'warn' : undefined} />
        <Stat label="Overdue now" value={report.overdue.length} tone={report.overdue.length ? 'warn' : undefined} />
        <Stat
          label="Done on time"
          value={report.onTimePct === null ? '—' : `${report.onTimePct}%`}
          hint={report.onTimePct === null ? 'No deadlines met or missed yet' : 'Of tasks with a deadline'}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        {/* Day by day */}
        <section className="card-depth rounded-2xl border border-border/80 bg-card p-5 lg:col-span-3">
          <div className="flex items-baseline justify-between">
            <h3 className="text-xs font-semibold text-foreground">Last 7 days</h3>
            <span className="flex items-center gap-3 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1">
                <span className="size-2 rounded-sm bg-foreground/70" /> done
              </span>
              <span className="flex items-center gap-1">
                <span className="size-2 rounded-sm bg-amber-500/70" /> stuck
              </span>
            </span>
          </div>
          <div className="mt-4 flex h-36 items-end gap-2">
            {report.days.map((d) => (
              <div key={d.label} className="flex flex-1 flex-col items-center gap-1.5">
                <div className="flex w-full max-w-10 flex-1 flex-col justify-end gap-0.5">
                  {d.stuck > 0 && (
                    <div
                      className="w-full rounded-sm bg-amber-500/70"
                      style={{ height: `${(d.stuck / report.dayMax) * 100}%` }}
                      title={`${d.stuck} stuck`}
                    />
                  )}
                  {d.done > 0 && (
                    <div
                      className="w-full rounded-sm bg-foreground/70"
                      style={{ height: `${(d.done / report.dayMax) * 100}%` }}
                      title={`${d.done} done`}
                    />
                  )}
                  {d.done + d.stuck === 0 && <div className="h-0.5 w-full rounded-sm bg-muted" />}
                </div>
                <span
                  className={`text-[11px] tabular-nums ${d.isToday ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}
                >
                  {d.label}
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* Why */}
        <section className="card-depth rounded-2xl border border-border/80 bg-card p-5 lg:col-span-2">
          <h3 className="text-xs font-semibold text-foreground">Why things slipped</h3>
          <p className="mt-0.5 text-[11px] text-muted-foreground">Last 30 days</p>
          {report.blockers.length === 0 ? (
            <p className="mt-4 text-xs text-muted-foreground">
              Nothing logged as stuck. When a task stalls, mark it stuck so you can see the pattern here.
            </p>
          ) : (
            <>
              <div className="mt-3 space-y-2">
                {report.blockers.map(({ category, count }) => (
                  <div key={category}>
                    <div className="flex justify-between text-xs">
                      <span className="text-foreground">{BLOCKER_CATEGORIES[category].label}</span>
                      <span className="tabular-nums text-muted-foreground">{count}</span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-amber-500/70"
                        style={{ width: `${(count / report.blockerTotal) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
              <p className="mt-4 rounded-xl bg-amber-500/10 px-3 py-2 text-xs leading-relaxed text-amber-800 dark:text-amber-300">
                {BLOCKER_ADVICE[topBlocker.category]}
              </p>
            </>
          )}
        </section>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <TaskList
          title="Keeps slipping"
          empty="No task has been stuck more than once."
          items={report.repeat.map(({ task, count }) => ({ task, meta: `stuck ${count}×` }))}
          onOpen={openTaskDetailModal}
        />
        <TaskList
          title="Overdue"
          empty="Nothing past its deadline."
          items={report.overdue.slice(0, 5).map((task) => ({
            task,
            meta: `due ${formatFriendlyDate(task.parsedDate as string)}`,
          }))}
          onOpen={openTaskDetailModal}
        />
        <TaskList
          title="Where your focus went"
          empty="No focus blocks on a task this week."
          items={report.attention.map(({ task, minutes }) => ({
            task,
            meta: minutes >= 60 ? `${Math.floor(minutes / 60)}h ${minutes % 60}m` : `${minutes}m`,
          }))}
          onOpen={openTaskDetailModal}
        />
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: number | string;
  hint?: string;
  tone?: 'warn';
}) {
  return (
    <div className="card-depth rounded-2xl border border-border/80 bg-card p-4">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p
        className={`font-heading mt-1 text-2xl font-bold tabular-nums ${
          tone === 'warn' ? 'text-amber-700 dark:text-amber-400' : 'text-foreground'
        }`}
      >
        {value}
      </p>
      {hint && <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function TaskList({
  title,
  empty,
  items,
  onOpen,
}: {
  title: string;
  empty: string;
  items: { task: Task; meta: string }[];
  onOpen: (id: string) => void;
}) {
  return (
    <section className="card-depth rounded-2xl border border-border/80 bg-card p-5">
      <h3 className="text-xs font-semibold text-foreground">{title}</h3>
      {items.length === 0 ? (
        <p className="mt-3 text-xs text-muted-foreground">{empty}</p>
      ) : (
        <ul className="mt-2 divide-y divide-border/50">
          {items.map(({ task, meta }) => (
            <li key={task.id}>
              <button
                type="button"
                onClick={() => onOpen(task.id)}
                className="focus-ring flex w-full items-center justify-between gap-3 rounded-md py-2 text-left text-xs transition-colors hover:text-foreground"
              >
                <span className="truncate text-foreground">{task.content}</span>
                <span className="shrink-0 tabular-nums text-muted-foreground">{meta}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
