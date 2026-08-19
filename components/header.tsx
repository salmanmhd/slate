'use client';

import React from 'react';
import { useMatrixStore } from '@/lib/store';
import { AppView } from '@/types/matrix';
import { useTheme } from 'next-themes';
import { parseTaskInput } from '@/lib/nlp-parser';
import {
  PenLine,
  Crosshair,
  Target,
  BarChart3,
  Moon,
  Sun,
  Calendar,
} from 'lucide-react';

export function Header() {
  const {
    activeView,
    setActiveView,
    tasks,
    addTask,
    setInitialCaptureInput,
    activeModalTaskId,
  } = useMatrixStore();

  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  const [globalInput, setGlobalInput] = React.useState('');
  const [showInput, setShowInput] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  // Strict 1, 2, 3, 4 tab navigation & Type-to-Capture
  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable ||
        e.metaKey ||
        e.ctrlKey ||
        e.altKey
      ) {
        return;
      }

      // If a modal is open, don't trigger global shortcuts or redirect to capture
      if (activeModalTaskId) {
        return;
      }

      // ONLY 1, 2, 3, 4 keys switch tabs
      if (e.key === '1') {
        e.preventDefault();
        setActiveView('capture');
        return;
      }
      if (e.key === '2') {
        e.preventDefault();
        setActiveView('decide');
        return;
      }
      if (e.key === '3') {
        e.preventDefault();
        setActiveView('focus');
        return;
      }
      if (e.key === '4') {
        e.preventDefault();
        setActiveView('reflect');
        return;
      }

      // If user types any letter/printable character:
      // If NOT currently in focus mode and NO modal is open, redirect to capture mode and preserve the typed character
      if (activeView !== 'focus' && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        setActiveView('capture');
        setInitialCaptureInput(e.key);
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [activeView, activeModalTaskId, setActiveView, setInitialCaptureInput]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!globalInput.trim()) return;
    addTask(globalInput.trim());
    setGlobalInput('');
    setShowInput(false);
  };

  const nlpPreview = React.useMemo(() => {
    if (!globalInput.trim()) return null;
    return parseTaskInput(globalInput);
  }, [globalInput]);

  const inboxCount = tasks.filter(
    (t) => t.status === 'inbox' && t.completionState === 'pending'
  ).length;

  const views: { id: AppView; icon: React.ReactNode; label: string; badge?: number }[] = [
    { id: 'capture', icon: <PenLine className="size-3.5" />, label: 'Capture' },
    {
      id: 'decide',
      icon: <Crosshair className="size-3.5" />,
      label: 'Decide',
      badge: inboxCount > 0 ? inboxCount : undefined,
    },
    { id: 'focus', icon: <Target className="size-3.5" />, label: 'Focus' },
    { id: 'reflect', icon: <BarChart3 className="size-3.5" />, label: 'Reflect' },
  ];

  // In Focus mode, header fades out to maximize single-task immersion
  const isFocusMode = activeView === 'focus';

  return (
    <header
      className={`sticky top-0 z-30 border-b border-border/60 bg-background/90 backdrop-blur-md transition-opacity duration-300 ${
        isFocusMode ? 'opacity-35 hover:opacity-100' : 'opacity-100'
      }`}
    >
      <div className="mx-auto flex h-12 max-w-[1600px] items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Left: Brand */}
        <div className="flex items-center gap-2">
          <div className="flex size-5 items-center justify-center rounded-md bg-foreground text-background font-bold text-xs">
            F
          </div>
          <span className="text-sm font-semibold tracking-tight text-foreground">
            FocusMatrix
          </span>
        </div>

        {/* Center: Mode Switcher (Clean, no shortcut tags shown) */}
        <nav className="flex items-center gap-1 rounded-xl bg-muted/40 p-1 border border-border/40">
          {views.map((v) => (
            <button
              key={v.id}
              onClick={() => setActiveView(v.id)}
              className={`relative flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-medium transition-all ${
                activeView === v.id
                  ? 'bg-card text-foreground shadow-xs border border-border/60'
                  : 'text-muted-foreground hover:text-foreground hover:bg-card/40'
              }`}
            >
              {v.icon}
              <span>{v.label}</span>
              {v.badge && (
                <span className="flex size-4 items-center justify-center rounded-full bg-foreground text-[9px] font-bold text-background ml-0.5">
                  {v.badge}
                </span>
              )}
            </button>
          ))}
        </nav>

        {/* Right: Theme Toggle */}
        <div className="flex items-center gap-1.5">
          {mounted && (
            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="rounded-lg border border-border/40 bg-card/40 p-1.5 text-muted-foreground hover:text-foreground transition-colors"
              title="Toggle theme"
            >
              {theme === 'dark' ? <Sun className="size-3.5" /> : <Moon className="size-3.5" />}
            </button>
          )}
        </div>
      </div>

      {/* Quick capture drawer */}
      {showInput && (
        <div className="border-t border-border/60 bg-card/95 px-6 py-2.5 backdrop-blur-md">
          <form onSubmit={handleSubmit} className="mx-auto max-w-xl flex items-center gap-2">
            <input
              ref={inputRef}
              type="text"
              value={globalInput}
              onChange={(e) => setGlobalInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  setGlobalInput('');
                  setShowInput(false);
                }
              }}
              placeholder="Quick capture anything... (Enter to save, Esc to close)"
              className="flex-1 bg-transparent text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none"
              autoComplete="off"
            />
            {nlpPreview?.formattedPreview && (
              <span className="flex items-center gap-1 text-[11px] text-muted-foreground whitespace-nowrap bg-muted px-2 py-0.5 rounded-md">
                <Calendar className="size-3" />
                {nlpPreview.formattedPreview}
              </span>
            )}
            <button
              type="button"
              onClick={() => {
                setGlobalInput('');
                setShowInput(false);
              }}
              className="text-[11px] text-muted-foreground hover:text-foreground px-1.5 py-0.5"
            >
              Cancel
            </button>
          </form>
        </div>
      )}
    </header>
  );
}
