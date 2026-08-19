'use client';

import React from 'react';
import { useMatrixStore } from '@/lib/store';
import { parseTaskInput, formatFriendlyDate } from '@/lib/nlp-parser';
import { Calendar, X, ArrowRight, CornerDownLeft } from 'lucide-react';

export function CaptureView() {
  const {
    tasks,
    addTask,
    deleteTask,
    setActiveView,
    openTaskDetailModal,
    captureDraft,
    setCaptureDraft,
  } = useMatrixStore();

  const [justAdded, setJustAdded] = React.useState<string | null>(null);
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

    const task = addTask(captureDraft.trim(), 'inbox');
    setCaptureDraft('');
    setJustAdded(task.id);
    window.setTimeout(() => setJustAdded((id) => (id === task.id ? null : id)), 1400);
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
          {nlpPreview?.formattedPreview ? (
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-muted/60 px-2.5 py-1 text-xs text-muted-foreground">
              <Calendar className="size-3 text-foreground/70" />
              {nlpPreview.formattedPreview}
            </span>
          ) : (
            <span />
          )}

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
        <div className="mt-14">
          <div className="flex items-center justify-between border-b border-border/50 px-1 pb-2">
            <span className="text-[11px] tabular-nums text-muted-foreground/70">
              {inboxTasks.length}
            </span>
            <button
              onClick={() => setActiveView('decide')}
              className="focus-ring flex items-center gap-1 rounded-md px-1 text-xs font-semibold text-foreground transition-colors hover:text-foreground/70"
            >
              Sort
              <ArrowRight className="size-3" />
            </button>
          </div>

          <ul className="mt-1">
            {inboxTasks.map((task) => (
              <li
                key={task.id}
                className={`group flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-muted/30 ${
                  justAdded === task.id ? 'animate-rise' : ''
                }`}
              >
                <button
                  onClick={() => openTaskDetailModal(task.id)}
                  className="focus-ring flex min-w-0 flex-1 items-center gap-3 rounded-md text-left"
                  title="Open details"
                >
                  <span className="size-1.5 shrink-0 rounded-full bg-muted-foreground/40" />
                  <span className="truncate text-sm text-foreground/90">{task.content}</span>
                  {task.parsedDate && (
                    <span className="shrink-0 text-[11px] whitespace-nowrap text-muted-foreground/60">
                      {formatFriendlyDate(task.parsedDate)}
                    </span>
                  )}
                </button>

                <button
                  onClick={() => deleteTask(task.id)}
                  className="focus-ring shrink-0 rounded-md p-1 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-60 hover:opacity-100! focus-visible:opacity-100"
                  title="Remove"
                  aria-label={`Remove ${task.content}`}
                >
                  <X className="size-3.5" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
