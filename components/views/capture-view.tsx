'use client';

import React from 'react';
import { useMatrixStore } from '@/lib/store';
import { parseTaskInput, formatFriendlyDate } from '@/lib/nlp-parser';
import {
  Calendar,
  X,
  ArrowRight,
  Sparkles,
} from 'lucide-react';

export function CaptureView() {
  const {
    tasks,
    addTask,
    deleteTask,
    setActiveView,
    initialCaptureInput,
    setInitialCaptureInput,
  } = useMatrixStore();

  const [inputValue, setInputValue] = React.useState('');
  const inputRef = React.useRef<HTMLInputElement>(null);

  const inboxTasks = tasks.filter((t) => t.status === 'inbox' && t.completionState !== 'completed');

  // Handle incoming type-to-capture character
  React.useEffect(() => {
    if (initialCaptureInput) {
      setInputValue((prev) => prev + initialCaptureInput);
      setInitialCaptureInput('');
    }
    inputRef.current?.focus();
  }, [initialCaptureInput, setInitialCaptureInput]);

  React.useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const nlpPreview = React.useMemo(() => {
    if (!inputValue.trim()) return null;
    return parseTaskInput(inputValue);
  }, [inputValue]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim()) return;

    addTask(inputValue.trim(), 'inbox');
    setInputValue('');
    inputRef.current?.focus();
  };

  return (
    <div className="mx-auto max-w-2xl pt-[12vh] pb-20">
      {/* Typewriter-Style Clean Dump Area */}
      <div className="space-y-4">
        <form onSubmit={handleSubmit} className="relative">
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Type anything and press Enter..."
            className="w-full bg-transparent text-2xl sm:text-3xl font-light text-foreground placeholder:text-muted-foreground/30 focus:outline-none tracking-tight leading-relaxed pb-3 border-b border-border/40 focus:border-foreground/30 transition-colors"
            autoComplete="off"
          />

          {/* Quiet NLP preview pill right below input */}
          <div className="mt-3 flex items-center justify-between min-h-[24px]">
            {nlpPreview?.formattedPreview ? (
              <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/60 px-2.5 py-1 rounded-lg">
                <Calendar className="size-3 text-foreground/70" />
                <span>Due {nlpPreview.formattedPreview}</span>
              </span>
            ) : (
              <div />
            )}

            {inputValue.trim() && (
              <button
                type="submit"
                className="text-xs font-semibold text-foreground/80 hover:text-foreground px-2 py-0.5 rounded-md hover:bg-muted/50 transition-colors"
              >
                Press Enter ↵
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Captured Inbox List */}
      {inboxTasks.length > 0 && (
        <div className="mt-14 space-y-3">
          <div className="flex items-center justify-between border-b border-border/40 pb-2 px-1">
            <span className="text-xs font-semibold text-muted-foreground tracking-wide uppercase">
              Inbox Backlog ({inboxTasks.length})
            </span>
            <button
              onClick={() => setActiveView('decide')}
              className="text-xs font-semibold text-foreground hover:underline underline-offset-4 flex items-center gap-1"
            >
              <span>Organize in Matrix</span>
              <ArrowRight className="size-3" />
            </button>
          </div>

          <div className="space-y-1">
            {inboxTasks.map((task) => {
              const subtasks = task.subtasks || [];
              return (
                <div
                  key={task.id}
                  className="group flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <span className="size-1.5 rounded-full bg-muted-foreground/40 shrink-0" />
                    <span className="text-sm text-foreground/90 truncate font-normal">
                      {task.content}
                    </span>
                    {task.parsedDate && (
                      <span className="text-[11px] text-muted-foreground/60 whitespace-nowrap">
                        {formatFriendlyDate(task.parsedDate)}
                      </span>
                    )}
                    {subtasks.length > 0 && (
                      <span className="text-[10px] text-muted-foreground/50 bg-muted px-1.5 py-0.2 rounded font-medium">
                        {subtasks.length} steps
                      </span>
                    )}
                  </div>

                  <button
                    onClick={() => deleteTask(task.id)}
                    className="opacity-0 group-hover:opacity-60 hover:!opacity-100 text-muted-foreground transition-opacity p-1"
                    title="Remove"
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Empty State */}
      {inboxTasks.length === 0 && (
        <div className="mt-20 text-center text-xs text-muted-foreground/40">
          <p>Inbox is clear. Start typing anytime to capture ideas.</p>
        </div>
      )}
    </div>
  );
}
