'use client';

import React from 'react';
import { useMatrixStore } from '@/lib/store';
import { parseTaskInput, formatFriendlyDate } from '@/lib/nlp-parser';
import { extractBulkTasks } from '@/lib/bulk-parser';
import { CATEGORIES, CATEGORY_BY_ID } from '@/lib/categories';
import { CategoryMark } from '@/components/category-switcher';
import { TaskMeta } from '@/components/task-meta';
import { TaskCategory } from '@/types/matrix';
import { Calendar, X, ArrowRight, CornerDownLeft, PenLine, Layers, Check } from 'lucide-react';

export function CaptureView() {
  const {
    tasks,
    addTask,
    addBulkTasks,
    requestDeleteTask,
    setActiveView,
    openTaskDetailModal,
    setTaskCategory,
    captureDraft,
    setCaptureDraft,
  } = useMatrixStore();

  const [mode, setMode] = React.useState<'single' | 'bulk'>('single');
  const [bulkText, setBulkText] = React.useState('');
  const [bulkCategory, setBulkCategory] = React.useState<TaskCategory | undefined>(undefined);
  const [taskCustomCategories, setTaskCustomCategories] = React.useState<
    Record<number, TaskCategory | undefined>
  >({});

  const inputRef = React.useRef<HTMLInputElement>(null);
  const bulkInputRef = React.useRef<HTMLTextAreaElement>(null);

  const inboxTasks = tasks.filter((t) => t.status === 'inbox' && t.completionState !== 'completed');

  // Arriving here always means you are about to type — including when a
  // keystroke elsewhere in the app redirected you.
  React.useEffect(() => {
    if (mode === 'single') {
      inputRef.current?.focus();
    } else {
      bulkInputRef.current?.focus();
    }
  }, [mode]);

  const nlpPreview = React.useMemo(() => {
    if (!captureDraft.trim()) return null;
    return parseTaskInput(captureDraft);
  }, [captureDraft]);

  const bulkTasks = React.useMemo(() => extractBulkTasks(bulkText), [bulkText]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!captureDraft.trim()) return;

    addTask(captureDraft.trim(), 'inbox');
    setCaptureDraft('');
    inputRef.current?.focus();
  };

  const handleBulkSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (bulkTasks.length === 0) return;

    const items = bulkTasks.map((rawInput, idx) => ({
      rawInput,
      category:
        taskCustomCategories[idx] !== undefined ? taskCustomCategories[idx] : bulkCategory,
      customStatus: 'inbox' as const,
    }));

    addBulkTasks(items);
    setBulkText('');
    setTaskCustomCategories({});
    bulkInputRef.current?.focus();
  };

  const handleBulkKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      handleBulkSubmit();
    }
  };

  const removeTaskFromBulk = (indexToRemove: number) => {
    const updated = bulkTasks.filter((_, idx) => idx !== indexToRemove);
    setBulkText(updated.map((t) => `${t};`).join('\n'));
    setTaskCustomCategories((prev) => {
      const next: Record<number, TaskCategory | undefined> = {};
      let nextIdx = 0;
      for (let i = 0; i < bulkTasks.length; i++) {
        if (i === indexToRemove) continue;
        if (prev[i] !== undefined) {
          next[nextIdx] = prev[i];
        }
        nextIdx++;
      }
      return next;
    });
  };

  return (
    <div className="mx-auto w-full max-w-2xl pt-[12vh] pb-20">
      {/* Mode Switcher */}
      <div className="mb-5 flex items-center justify-between gap-3">
        {mode === 'bulk' ? (
          <span className="text-[11px] text-muted-foreground/60 hidden sm:inline">
            Separate tasks with newlines or semicolons (;)
          </span>
        ) : (
          <div aria-hidden />
        )}

        <div className="flex items-center gap-0.5 rounded-lg border border-border/40 bg-muted/25 p-0.5">
          <button
            type="button"
            onClick={() => {
              setMode('single');
              setTimeout(() => inputRef.current?.focus(), 0);
            }}
            className={`focus-ring flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium transition-colors ${
              mode === 'single'
                ? 'border border-border/60 bg-card text-foreground shadow-xs font-semibold'
                : 'border border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <PenLine className="size-3" />
            <span>Single</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('bulk');
              if (captureDraft.trim() && !bulkText) {
                setBulkText(captureDraft.trim());
              }
              setTimeout(() => bulkInputRef.current?.focus(), 0);
            }}
            className={`focus-ring flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium transition-colors ${
              mode === 'bulk'
                ? 'border border-border/60 bg-card text-foreground shadow-xs font-semibold'
                : 'border border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Layers className="size-3" />
            <span>Bulk Add</span>
          </button>
        </div>
      </div>

      {mode === 'single' ? (
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
              {captureDraft.includes(';') && (
                <button
                  type="button"
                  onClick={() => {
                    setBulkText(captureDraft);
                    setMode('bulk');
                  }}
                  className="rounded-lg bg-muted/60 px-2 py-0.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                >
                  Multiple items? Switch to Bulk Add
                </button>
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
      ) : (
        <div className="space-y-4">
          <div className="relative">
            <textarea
              ref={bulkInputRef}
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
              onKeyDown={handleBulkKeyDown}
              placeholder={`Paste or write multiple tasks...\n\nExample:\ncreate a new locaiton to test the user;\nif IP is changed, then we have to give the option to release;`}
              rows={4}
              aria-label="Bulk capture tasks"
              className="w-full resize-none border-b border-border/50 bg-transparent pb-3 text-lg leading-relaxed font-light tracking-tight text-foreground transition-colors placeholder:text-muted-foreground/30 focus:border-foreground/40 focus:outline-none sm:text-xl"
            />
          </div>

          {/* Controls: Category Selector and Action */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-muted-foreground">Category:</span>
              <div className="flex items-center gap-0.5 rounded-lg border border-border/40 bg-muted/30 p-0.5">
                <button
                  type="button"
                  onClick={() => {
                    setBulkCategory(undefined);
                    setTaskCustomCategories({});
                  }}
                  className={`focus-ring rounded-md px-2.5 py-0.5 text-xs font-medium transition-colors ${
                    bulkCategory === undefined
                      ? 'border border-border/60 bg-card text-foreground shadow-xs font-semibold'
                      : 'border border-transparent text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Auto / None
                </button>
                {CATEGORIES.map((cat) => {
                  const isSelected = bulkCategory === cat.id;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => {
                        setBulkCategory(cat.id);
                        setTaskCustomCategories({});
                      }}
                      className={`focus-ring rounded-md px-2.5 py-0.5 text-xs font-medium transition-colors ${
                        isSelected
                          ? 'border border-border/60 bg-card text-foreground shadow-xs font-semibold'
                          : 'border border-transparent text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {cat.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center gap-2">
              {bulkTasks.length > 0 && (
                <button
                  type="button"
                  onClick={() => handleBulkSubmit()}
                  className="focus-ring inline-flex items-center gap-1.5 rounded-lg bg-foreground px-3.5 py-1.5 text-xs font-semibold text-background shadow-xs transition-opacity hover:opacity-90"
                >
                  <Check className="size-3.5" />
                  <span>
                    Add {bulkTasks.length} {bulkTasks.length === 1 ? 'Task' : 'Tasks'}
                  </span>
                  <span className="opacity-60 text-[10px] hidden sm:inline">↵</span>
                </button>
              )}
            </div>
          </div>

          {/* Real-time Preview of Detected Tasks */}
          {bulkTasks.length > 0 && (
            <div className="rounded-xl border border-border/40 bg-muted/20 p-3 mt-3 animate-fade">
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-border/30 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">
                  {bulkTasks.length} {bulkTasks.length === 1 ? 'task' : 'tasks'} ready to add
                </span>
                <span className="text-[11px] text-muted-foreground/60 hidden sm:inline">
                  Press ⌘+Enter or Ctrl+Enter to save
                </span>
              </div>
              <ul className="divide-y divide-border/20 max-h-56 overflow-y-auto pr-1">
                {bulkTasks.map((taskText, idx) => {
                  const { cleanedContent, parsedDate, category } = parseTaskInput(taskText);
                  const effectiveCategory =
                    taskCustomCategories[idx] !== undefined
                      ? taskCustomCategories[idx]
                      : (bulkCategory ?? category ?? undefined);
                  return (
                    <li
                      key={idx}
                      className="flex items-center justify-between gap-3 py-2 text-xs group"
                    >
                      <div className="min-w-0 flex-1 flex items-center gap-2">
                        <span className="size-1.5 rounded-full bg-foreground/40 shrink-0" />
                        <span className="truncate text-foreground font-normal">
                          {cleanedContent || taskText}
                        </span>
                        {parsedDate && (
                          <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground shrink-0 bg-muted/50 px-1.5 py-0.5 rounded">
                            <Calendar className="size-2.5 text-foreground/70" />
                            {formatFriendlyDate(parsedDate)}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <CategoryMark
                          category={effectiveCategory}
                          alwaysVisible
                          onCycle={(next) => {
                            setTaskCustomCategories((prev) => ({ ...prev, [idx]: next }));
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => removeTaskFromBulk(idx)}
                          className="text-muted-foreground/40 hover:text-destructive transition-colors p-0.5 rounded"
                          title="Remove from list"
                        >
                          <X className="size-3" />
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      )}

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
                    className="focus-ring block w-full break-words rounded-md text-left text-[0.9375rem] leading-snug text-foreground transition-colors group-hover:text-foreground/70"
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
