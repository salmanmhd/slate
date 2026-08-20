'use client';

import React from 'react';
import { PomodoroSession } from '@/types/matrix';
import { formatDuration } from '@/lib/duration-parser';
import { Target, Timer } from 'lucide-react';

function formatClock(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

function formatDay(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const day = new Date(d);
  day.setHours(0, 0, 0, 0);

  const diffDays = Math.round((today.getTime() - day.getTime()) / 86_400_000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  return d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
}

/** Every block you have run, newest first, grouped by day. */
export function SessionHistory({ sessions }: { sessions: PomodoroSession[] }) {
  const groups = React.useMemo(() => {
    const map = new Map<string, PomodoroSession[]>();
    for (const s of sessions) {
      const key = new Date(s.startedAt).toDateString();
      const list = map.get(key);
      if (list) list.push(s);
      else map.set(key, [s]);
    }
    return [...map.entries()];
  }, [sessions]);

  if (sessions.length === 0) {
    return (
      <div className="card-depth rounded-2xl border border-border/80 bg-card p-8 text-center">
        <p className="text-xs text-muted-foreground">No sessions yet</p>
      </div>
    );
  }

  return (
    <div className="card-depth rounded-2xl border border-border/80 bg-card">
      <div className="flex items-baseline gap-2 border-b border-border/50 px-5 py-4">
        <h3 className="text-xs font-semibold text-foreground">Sessions</h3>
        <span className="text-[11px] tabular-nums text-muted-foreground/70">{sessions.length}</span>
      </div>

      <div className="max-h-[28rem] overflow-y-auto">
        {groups.map(([day, list]) => {
          const dayTotal = list.reduce((sum, s) => sum + s.workedMs, 0);
          return (
            <section key={day}>
              <div className="sticky top-0 z-10 flex items-baseline justify-between border-b border-border/40 bg-card/95 px-5 py-2 backdrop-blur-sm">
                <span className="text-[11px] font-semibold text-foreground">
                  {formatDay(list[0].startedAt)}
                </span>
                <span className="text-[11px] tabular-nums text-muted-foreground">
                  {formatDuration(dayTotal)}
                </span>
              </div>

              <ul className="divide-y divide-border/30">
                {list.map((s) => (
                  <li key={s.id} className="flex items-start gap-3 px-5 py-3">
                    <span
                      className="mt-0.5 shrink-0 text-muted-foreground/50"
                      title={s.source === 'focus' ? 'Started from Focus' : 'Started from Timer'}
                    >
                      {s.source === 'focus' ? (
                        <Target className="size-3.5" />
                      ) : (
                        <Timer className="size-3.5" />
                      )}
                    </span>

                    <div className="min-w-0 flex-1">
                      <p
                        className={`truncate text-xs font-medium ${
                          s.outcome === 'completed' ? 'text-foreground' : 'text-muted-foreground'
                        }`}
                        title={s.label}
                      >
                        {s.label}
                      </p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground/60">
                        {formatClock(s.startedAt)}
                        <span className="px-1.5 text-muted-foreground/30">·</span>
                        {formatDuration(s.workedMs)} of {formatDuration(s.plannedMs)}
                        {s.pausedMs > 0 && (
                          <>
                            <span className="px-1.5 text-muted-foreground/30">·</span>
                            paused {formatDuration(s.pausedMs)}
                            {s.pauseCount > 1 ? ` ×${s.pauseCount}` : ''}
                          </>
                        )}
                      </p>
                    </div>

                    <span
                      className={`mt-0.5 shrink-0 rounded px-1.5 py-px text-[9px] font-semibold uppercase ${
                        s.outcome === 'completed'
                          ? 'bg-muted text-muted-foreground'
                          : 'bg-q-do-first/10 text-q-do-first'
                      }`}
                    >
                      {s.outcome === 'completed' ? 'Done' : 'Cut short'}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}
