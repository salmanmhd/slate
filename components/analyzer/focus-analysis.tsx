'use client';

import React from 'react';
import { PomodoroSession } from '@/types/matrix';
import { formatDuration } from '@/lib/duration-parser';
import { useNow } from '@/hooks/use-now';

function startOfDay(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/**
 * What the session history says about how you actually work: how much focused
 * time, how often blocks survive to the end, and how much of it you spend paused.
 */
export function FocusAnalysis({ sessions }: { sessions: PomodoroSession[] }) {
  const now = useNow();

  const stats = React.useMemo(() => {
    const today = startOfDay(now);
    const weekStart = today - 6 * 86_400_000;

    let workedToday = 0;
    let workedWeek = 0;
    let workedAll = 0;
    let pausedAll = 0;
    let completed = 0;
    let pauseCount = 0;

    // Focused minutes for each of the last seven days, oldest first.
    const days = Array.from({ length: 7 }, (_, i) => ({
      start: weekStart + i * 86_400_000,
      workedMs: 0,
    }));

    for (const s of sessions) {
      const started = new Date(s.startedAt).getTime();
      workedAll += s.workedMs;
      pausedAll += s.pausedMs;
      pauseCount += s.pauseCount;
      if (s.outcome === 'completed') completed += 1;

      if (started >= today) workedToday += s.workedMs;
      if (started >= weekStart) {
        workedWeek += s.workedMs;
        const bucket = days.find((d) => started >= d.start && started < d.start + 86_400_000);
        if (bucket) bucket.workedMs += s.workedMs;
      }
    }

    return {
      workedToday,
      workedWeek,
      workedAll,
      pausedAll,
      completed,
      total: sessions.length,
      pauseCount,
      days,
      avgMs: sessions.length ? workedAll / sessions.length : 0,
      completionPct: sessions.length ? Math.round((completed / sessions.length) * 100) : 0,
      // Average uninterrupted run: total focus split by how often you broke it.
      stretchMs: sessions.length ? workedAll / (pauseCount + sessions.length) : 0,
    };
  }, [sessions, now]);

  const peak = Math.max(...stats.days.map((d) => d.workedMs), 1);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <div className="card-depth rounded-2xl border border-border/80 bg-card p-6">
        <h3 className="text-xs font-semibold text-foreground">Focused time</h3>

        <p className="font-heading mt-4 text-3xl font-bold tabular-nums text-foreground">
          {formatDuration(stats.workedToday)}
        </p>
        <p className="mt-1 text-[11px] text-muted-foreground">today</p>

        <dl className="mt-5 space-y-1.5 text-xs">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Last 7 days</dt>
            <dd className="font-medium tabular-nums text-foreground">
              {formatDuration(stats.workedWeek)}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">All time</dt>
            <dd className="font-medium tabular-nums text-foreground">
              {formatDuration(stats.workedAll)}
            </dd>
          </div>
        </dl>
      </div>

      <div className="card-depth rounded-2xl border border-border/80 bg-card p-6">
        <h3 className="text-xs font-semibold text-foreground">Blocks</h3>

        <p className="font-heading mt-4 text-3xl font-bold tabular-nums text-foreground">
          {stats.completionPct}%
        </p>
        <p className="mt-1 text-[11px] text-muted-foreground">
          ran to the end ({stats.completed} of {stats.total})
        </p>

        <dl className="mt-5 space-y-1.5 text-xs">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Average block</dt>
            <dd className="font-medium tabular-nums text-foreground">
              {formatDuration(stats.avgMs)}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Unbroken stretch</dt>
            <dd className="font-medium tabular-nums text-foreground">
              {formatDuration(stats.stretchMs)}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Paused</dt>
            <dd className="font-medium tabular-nums text-foreground">
              {formatDuration(stats.pausedAll)}
            </dd>
          </div>
        </dl>
      </div>

      <div className="card-depth rounded-2xl border border-border/80 bg-card p-6">
        <h3 className="text-xs font-semibold text-foreground">Last 7 days</h3>

        <div className="mt-5 flex h-28 items-end gap-1.5">
          {stats.days.map((d) => {
            const minutes = Math.round(d.workedMs / 60_000);
            return (
              <div key={d.start} className="flex flex-1 flex-col items-center gap-1.5">
                <div className="flex w-full flex-1 items-end">
                  <div
                    className="w-full rounded-t bg-foreground/70 transition-all duration-500"
                    style={{ height: `${Math.max(d.workedMs ? 4 : 0, (d.workedMs / peak) * 100)}%` }}
                    title={`${minutes} min`}
                  />
                </div>
                <span className="text-[9px] text-muted-foreground/60">
                  {new Date(d.start).toLocaleDateString(undefined, { weekday: 'narrow' })}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
