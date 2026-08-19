'use client';

import React from 'react';
import { useMatrixStore } from '@/lib/store';
import { ExcusesLedger } from './excuses-ledger';
import { Target, Layers } from 'lucide-react';

export function AnalyzerView() {
  const { tasks, logs } = useMatrixStore();

  const totalTasks = tasks.length;
  const completedTasks = tasks.filter((t) => t.completionState === 'completed').length;
  const pendingTasks = tasks.filter((t) => t.completionState === 'pending').length;
  const completionPct = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  const q1 = tasks.filter((t) => t.status === 'do_first').length;
  const q2 = tasks.filter((t) => t.status === 'schedule').length;
  const q3 = tasks.filter((t) => t.status === 'delegate').length;
  const q4 = tasks.filter((t) => t.status === 'eliminate').length;
  const q1Pct = totalTasks > 0 ? Math.round((q1 / totalTasks) * 100) : 0;
  const q2Pct = totalTasks > 0 ? Math.round((q2 / totalTasks) * 100) : 0;
  const q3Pct = totalTasks > 0 ? Math.round((q3 / totalTasks) * 100) : 0;
  const q4Pct = totalTasks > 0 ? Math.round((q4 / totalTasks) * 100) : 0;

  // Progress ring
  const radius = 50;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (completionPct / 100) * circumference;

  if (totalTasks === 0 && logs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <p className="text-sm text-muted-foreground">No data yet.</p>
        <p className="mt-1 text-xs text-muted-foreground/60">
          Add tasks and complete or log blockers to see analytics here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Metrics row */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* Completion ring */}
        <div className="rounded-xl border border-border/50 bg-card/30 p-6 flex flex-col items-center">
          <h3 className="self-start text-xs font-medium text-muted-foreground mb-4">Follow-through</h3>
          <div className="relative size-32">
            <svg className="size-full -rotate-90" viewBox="0 0 120 120">
              <circle cx="60" cy="60" r={radius} className="stroke-muted" strokeWidth="8" fill="none" />
              <circle
                cx="60"
                cy="60"
                r={radius}
                className="stroke-foreground/70"
                strokeWidth="8"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                fill="none"
                style={{ transition: 'stroke-dashoffset 0.8s ease-out' }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-bold text-foreground">{completionPct}%</span>
            </div>
          </div>
          <div className="mt-4 flex gap-6 text-xs text-muted-foreground">
            <span><strong className="text-foreground">{completedTasks}</strong> done</span>
            <span><strong className="text-foreground">{pendingTasks}</strong> pending</span>
            <span><strong className="text-foreground">{logs.length}</strong> logged</span>
          </div>
        </div>

        {/* Quadrant distribution */}
        <div className="rounded-xl border border-border/50 bg-card/30 p-6 lg:col-span-2">
          <h3 className="text-xs font-medium text-muted-foreground mb-5">Quadrant distribution</h3>
          <div className="space-y-4">
            {[
              { label: 'Do First', count: q1, pct: q1Pct, color: 'bg-rose-500' },
              { label: 'Schedule', count: q2, pct: q2Pct, color: 'bg-blue-500' },
              { label: 'Delegate', count: q3, pct: q3Pct, color: 'bg-amber-500' },
              { label: 'Eliminate', count: q4, pct: q4Pct, color: 'bg-zinc-400' },
            ].map((q) => (
              <div key={q.label} className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-foreground font-medium">{q.label}</span>
                  <span className="text-muted-foreground">{q.count} ({q.pct}%)</span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-muted">
                  <div
                    className={`h-full rounded-full ${q.color} transition-all duration-500`}
                    style={{ width: `${q.pct}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Excuses ledger */}
      <ExcusesLedger logs={logs} />
    </div>
  );
}
