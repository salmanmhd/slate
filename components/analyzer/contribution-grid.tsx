'use client';

import React from 'react';
import { PomodoroSession, Task } from '@/types/matrix';
import { formatDuration } from '@/lib/duration-parser';
import { useNow } from '@/hooks/use-now';

const WEEKS = 53;
const WEEKDAY_LABELS = ['', 'Mon', '', 'Wed', '', 'Fri', ''];

/** Local calendar key. Built from date parts so DST cannot shift a day. */
function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`;
}

interface DayActivity {
  focusedMs: number;
  tasksDone: number;
}

/**
 * Intensity is driven by focused time, but a day where you finished tasks
 * without running the timer still lights up — the grid should never call a
 * working day empty just because the clock was not used.
 */
function levelFor(activity: DayActivity | undefined): number {
  if (!activity) return 0;
  const minutes = activity.focusedMs / 60_000;
  if (minutes >= 120) return 4;
  if (minutes >= 60) return 3;
  if (minutes >= 25) return 2;
  if (minutes >= 1) return 1;
  return activity.tasksDone > 0 ? 1 : 0;
}

const LEVEL_CLASS = ['gh-0', 'gh-1', 'gh-2', 'gh-3', 'gh-4'];

export function ContributionGrid({
  sessions,
  tasks,
}: {
  sessions: PomodoroSession[];
  tasks: Task[];
}) {
  const now = useNow();

  const { weeks, byDay, totalMs, activeDays, streak } = React.useMemo(() => {
    const map = new Map<string, DayActivity>();

    const bump = (key: string, patch: Partial<DayActivity>) => {
      const current = map.get(key) ?? { focusedMs: 0, tasksDone: 0 };
      map.set(key, {
        focusedMs: current.focusedMs + (patch.focusedMs ?? 0),
        tasksDone: current.tasksDone + (patch.tasksDone ?? 0),
      });
    };

    for (const s of sessions) {
      bump(dayKey(new Date(s.startedAt)), { focusedMs: s.workedMs });
    }
    for (const t of tasks) {
      if (t.completionState === 'completed' && t.completedAt) {
        bump(dayKey(new Date(t.completedAt)), { tasksDone: 1 });
      }
    }

    // The grid ends on the Saturday of the current week, as GitHub's does.
    const end = new Date(now);
    end.setHours(0, 0, 0, 0);
    end.setDate(end.getDate() + (6 - end.getDay()));

    const cursor = new Date(end);
    cursor.setDate(cursor.getDate() - (WEEKS * 7 - 1));

    const built: Date[][] = [];
    for (let w = 0; w < WEEKS; w += 1) {
      const column: Date[] = [];
      for (let d = 0; d < 7; d += 1) {
        column.push(new Date(cursor));
        cursor.setDate(cursor.getDate() + 1);
      }
      built.push(column);
    }

    let total = 0;
    let days = 0;
    for (const activity of map.values()) {
      total += activity.focusedMs;
      if (activity.focusedMs > 0 || activity.tasksDone > 0) days += 1;
    }

    // Consecutive active days ending today. Yesterday still counts, so the
    // streak does not evaporate before the day has been worked.
    const walker = new Date(now);
    walker.setHours(0, 0, 0, 0);
    let run = 0;
    if (!map.has(dayKey(walker))) walker.setDate(walker.getDate() - 1);
    while (map.has(dayKey(walker))) {
      run += 1;
      walker.setDate(walker.getDate() - 1);
    }

    return { weeks: built, byDay: map, totalMs: total, activeDays: days, streak: run };
  }, [sessions, tasks, now]);

  const todayKey = React.useMemo(() => dayKey(new Date(now)), [now]);
  const future = React.useMemo(() => {
    const d = new Date(now);
    d.setHours(23, 59, 59, 999);
    return d.getTime();
  }, [now]);

  // A label sits above the first column of each new month.
  const monthLabels = weeks.map((column, i) => {
    if (i === 0) return null;
    const first = column[0];
    const previous = weeks[i - 1][0];
    return first.getMonth() !== previous.getMonth()
      ? first.toLocaleDateString(undefined, { month: 'short' })
      : null;
  });

  return (
    <div className="card-depth rounded-2xl border border-border/80 bg-card p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3 className="text-xs font-semibold text-foreground">
          {formatDuration(totalMs)} focused over {activeDays} {activeDays === 1 ? 'day' : 'days'}
        </h3>
        {streak > 0 && (
          <span className="text-[11px] text-muted-foreground">
            {streak}-day streak
          </span>
        )}
      </div>

      {/* w-max keeps the natural width, mx-auto centres it when the card is
          wider than a year of tiles and collapses to 0 when it is not. */}
      <div className="mt-4 overflow-x-auto pb-1">
        <div className="mx-auto w-max">
          <div className="flex gap-1">
            {/* Weekday rail */}
            <div className="mt-3.75 flex shrink-0 flex-col gap-0.75 pr-1">
              {WEEKDAY_LABELS.map((label, i) => (
                <span
                  key={i}
                  className="flex h-2.75 items-center text-[9px] leading-none text-muted-foreground/50"
                >
                  {label}
                </span>
              ))}
            </div>

            <div>
              {/* Month rail */}
              <div className="mb-1 flex gap-0.75">
                {weeks.map((column, i) => (
                  <span
                    key={i}
                    className="w-2.75 text-[9px] whitespace-nowrap text-muted-foreground/60"
                  >
                    {monthLabels[i]}
                  </span>
                ))}
              </div>

              <div className="flex gap-0.75">
                {weeks.map((column, i) => (
                  <div key={i} className="flex flex-col gap-0.75">
                    {column.map((date) => {
                      const key = dayKey(date);
                      const isFuture = date.getTime() > future;
                      if (isFuture) {
                        return <span key={key} className="size-2.75" aria-hidden />;
                      }

                      const activity = byDay.get(key);
                      const level = levelFor(activity);
                      const parts = [
                        date.toLocaleDateString(undefined, {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        }),
                      ];
                      if (activity?.focusedMs) {
                        parts.push(`${formatDuration(activity.focusedMs)} focused`);
                      }
                      if (activity?.tasksDone) {
                        parts.push(
                          `${activity.tasksDone} ${activity.tasksDone === 1 ? 'task' : 'tasks'} done`
                        );
                      }
                      if (parts.length === 1) parts.push('nothing logged');

                      return (
                        <span
                          key={key}
                          title={parts.join(' · ')}
                          className={`size-2.75 rounded-xs transition-colors ${LEVEL_CLASS[level]} ${
                            key === todayKey ? 'ring-1 ring-foreground/50' : ''
                          }`}
                        />
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-3 flex items-center justify-end gap-1.5 text-[10px] text-muted-foreground/60">
            <span>Less</span>
            {LEVEL_CLASS.map((cls, i) => (
              <span key={i} className={`size-2.75 rounded-xs ${cls}`} />
            ))}
            <span>More</span>
          </div>
        </div>
      </div>
    </div>
  );
}
