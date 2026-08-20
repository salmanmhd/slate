'use client';

import React from 'react';
import { useMatrixStore } from '@/lib/store';
import { parseTaskInput } from '@/lib/nlp-parser';
import { CATEGORY_BY_ID } from '@/lib/categories';
import { CategoryMark } from '@/components/category-switcher';
import { TaskMeta } from '@/components/task-meta';
import { Calendar, X, ArrowRight, CornerDownLeft } from 'lucide-react';

export function CaptureView() {
  const {
    tasks,
    addTask,
    requestDeleteTask,
    setActiveView,
    openTaskDetailModal,
    setTaskCategory,
    captureDraft,
    setCaptureDraft,
  } = useMatrixStore();

  const inputRef = React.useRef<HTMLInputElement>(null);

  const inboxTasks = tasks.filter((t) => t.status === 'inbox' && t.completionState !== 'completed');

  // Arriving here always means you are about to type — including when a
  // keystroke elsewhere in the app redirected you.
  React.useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const nlpPreview = React.useMemo(() => {
    if (!captureDraft.trim()) return null;
    return parseTaskInput(captureDraft);
  }, [captureDraft]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!captureDraft.trim()) return;

    // A freshly mounted row animates itself in — no extra state needed.
    addTask(captureDraft.trim(), 'inbox');
    setCaptureDraft('');
    inputRef.current?.focus();
  };

  return (
    <div className="mx-auto w-full max-w-2xl pt-[14vh] pb-20">
      <form onSubmit={handleSubmit}>
        <input
          ref={inputRef}
          type="text"
          value={captureDraft}
          onChange={(e) => setCaptureDraft(e.target.value)}
          placeholder="What's on your mind?"
          aria-label="Capture a task"
          className="w-full border-b border-border/50 bg-transparent pb-3 text-2xl leading-relaxed font-light tracking-tight text-foreground transition-colors placeholder:text-muted-foreground/30 focus:border-foreground/40 focus:outline-none sm:text-3xl"
          autoComplete="off"
        />

        <div className="mt-3 flex min-h-6 items-center justify-between gap-3">
          <div className="flex items-center gap-1.5">
            {nlpPreview?.formattedPreview && (
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-muted/60 px-2.5 py-1 text-xs text-muted-foreground">
                <Calendar className="size-3 text-foreground/70" />
                {nlpPreview.formattedPreview}
              </span>
            )}
            {nlpPreview?.category && (
              <span className="rounded-lg bg-muted/60 px-2.5 py-1 text-xs text-muted-foreground">
                {CATEGORY_BY_ID[nlpPreview.category].label}
              </span>
            )}
          </div>

          {captureDraft.trim() && (
            <button
              type="submit"
              className="focus-ring shrink-0 rounded-lg p-1 text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
              aria-label="Save"
            >
              <CornerDownLeft className="size-3.5" />
            </button>
          )}
        </div>
      </form>

      {inboxTasks.length > 0 && (
        <div className="mt-16">
          <div className="flex items-center justify-end border-b border-border/50 pb-2">
            <button
              onClick={() => setActiveView('decide')}
              className="focus-ring flex items-center gap-1.5 rounded-md px-1 text-xs font-semibold text-foreground transition-colors hover:text-foreground/60"
            >
              Sort
              <span className="tabular-nums text-muted-foreground">{inboxTasks.length}</span>
              <ArrowRight className="size-3" />
            </button>
          </div>

          {/* A list, not a board — this page is a writing surface, so rows are
              separated by hairlines rather than boxed into cards. */}
          <ul className="divide-y divide-border/40">
            {inboxTasks.map((task, index) => (
              <li
                key={task.id}
                className="animate-rise group flex items-start gap-3 py-3.5"
                style={{ animationDelay: `${Math.min(index, 8) * 35}ms` }}
              >
                <div className="min-w-0 flex-1">
                  <button
                    onClick={() => openTaskDetailModal(task.id)}
                    className="focus-ring block w-full truncate rounded-md text-left text-[0.9375rem] leading-snug text-foreground transition-colors group-hover:text-foreground/70"
                    title="Open details"
                  >
                    {task.content}
                  </button>
                  <TaskMeta task={task} variant="line" />
                </div>

                <div className="flex shrink-0 items-center gap-2 pt-0.5">
                  <CategoryMark
                    category={task.category}
                    onCycle={(next) => setTaskCategory(task.id, next)}
                  />
                  <button
                    onClick={() => requestDeleteTask(task.id)}
                    className="focus-ring rounded-md text-muted-foreground/40 opacity-0 transition-opacity group-hover:opacity-100 hover:text-destructive focus-visible:opacity-100"
                    title="Remove"
                    aria-label={`Remove ${task.content}`}
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
