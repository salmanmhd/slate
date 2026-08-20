'use client';

import React from 'react';
import { useMatrixStore } from '@/lib/store';
import { ExcusesLedger } from './excuses-ledger';
import { ContributionGrid } from './contribution-grid';
import { FocusAnalysis } from './focus-analysis';
import { SessionHistory } from './session-history';
import { QUADRANTS } from '@/components/quadrants';
import { TaskStatus } from '@/types/matrix';
import { LineChart } from 'lucide-react';

const QUADRANT_KEYS: Exclude<TaskStatus, 'inbox'>[] = [
  'do_first',
  'schedule',
  'delegate',
  'eliminate',
];

export function AnalyzerView() {
  const { tasks, logs, sessions, setActiveView } = useMatrixStore();

  const total = tasks.length;
  const completed = tasks.filter((t) => t.completionState === 'completed').length;
  const pending = tasks.filter((t) => t.completionState === 'pending').length;
  const completionPct = total > 0 ? Math.round((completed / total) * 100) : 0;

  const distribution = QUADRANT_KEYS.map((key) => {
    const count = tasks.filter((t) => t.status === key).length;
    return {
      key,
      meta: QUADRANTS[key],
      count,
      pct: total > 0 ? Math.round((count / total) * 100) : 0,
    };
  });

  const radius = 50;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (completionPct / 100) * circumference;

  if (total === 0 && logs.length === 0 && sessions.length === 0) {
    return (
      <div className="animate-rise mx-auto flex min-h-[calc(100vh-7rem)] max-w-sm flex-col items-center justify-center text-center">
        <div className="flex size-11 items-center justify-center rounded-2xl border border-border/60 bg-muted/40 text-muted-foreground">
          <LineChart className="size-5" />
        </div>
        <h2 className="font-heading mt-4 text-lg font-semibold tracking-tight text-foreground">
          Nothing to reflect on yet
        </h2>
        <button
          onClick={() => setActiveView('capture')}
          className="focus-ring mt-5 rounded-xl bg-foreground px-4 py-2 text-xs font-semibold text-background transition-transform hover:-translate-y-px"
        >
          Capture
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-300 space-y-5 pb-16">
      <ContributionGrid sessions={sessions} tasks={tasks} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Follow-through */}
        <div className="card-depth flex flex-col items-center rounded-2xl border border-border/80 bg-card p-6">
          <h3 className="self-start text-xs font-semibold text-foreground">Completed</h3>
          <div className="relative mt-5 size-32">
            <svg className="size-full -rotate-90" viewBox="0 0 120 120" aria-hidden>
              <circle cx="60" cy="60" r={radius} className="stroke-muted" strokeWidth="8" fill="none" />
              <circle
                cx="60"
                cy="60"
                r={radius}
                className="stroke-foreground/70"
                strokeWidth="8"
                strokeDasharray={circumference}
                strokeDashoffset={dashOffset}
                strokeLinecap="round"
                fill="none"
                style={{ transition: 'stroke-dashoffset 0.8s ease-out' }}
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="font-heading text-2xl font-bold tabular-nums text-foreground">
                {completionPct}%
              </span>
            </div>
          </div>
          <div className="mt-4 flex gap-5 text-xs text-muted-foreground">
            <span>
              <strong className="text-foreground tabular-nums">{completed}</strong> done
            </span>
            <span>
              <strong className="text-foreground tabular-nums">{pending}</strong> open
            </span>
            <span>
              <strong className="text-foreground tabular-nums">{logs.length}</strong> blocked
            </span>
          </div>
        </div>

        {/* Where the work sits */}
        <div className="card-depth rounded-2xl border border-border/80 bg-card p-6 lg:col-span-2">
          <h3 className="text-xs font-semibold text-foreground">Distribution</h3>

          <div className="mt-5 space-y-3.5">
            {distribution.map(({ key, meta, count, pct }) => (
              <div key={key} className="space-y-1.5">
                <div className="flex items-baseline justify-between text-xs">
                  <span className="flex items-center gap-1.5 font-medium text-foreground">
                    <meta.Icon className={`size-3 ${meta.text}`} />
                    {meta.title}
                  </span>
                  <span className="text-muted-foreground tabular-nums">
                    {count} · {pct}%
                  </span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className={`h-full rounded-full ${meta.dot} transition-all duration-500`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {sessions.length > 0 && <FocusAnalysis sessions={sessions} />}

      <SessionHistory sessions={sessions} />

      <ExcusesLedger logs={logs} />
    </div>
  );
}
