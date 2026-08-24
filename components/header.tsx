'use client';

import React from 'react';
import { UserButton } from '@clerk/nextjs';
import { useMatrixStore } from '@/lib/store';
import { AppView } from '@/types/matrix';
import { useTheme } from 'next-themes';
import { LogoMark } from '@/components/logo';
import { PenLine, LayoutGrid, Target, Timer, LineChart, Moon, Sun } from 'lucide-react';

const VIEWS: { id: AppView; icon: React.ReactNode; label: string; key: string }[] = [
  { id: 'capture', icon: <PenLine className="size-3.5" />, label: 'Capture', key: '1' },
  { id: 'decide', icon: <LayoutGrid className="size-3.5" />, label: 'Decide', key: '2' },
  { id: 'focus', icon: <Target className="size-3.5" />, label: 'Focus', key: '3' },
  { id: 'timer', icon: <Timer className="size-3.5" />, label: 'Timer', key: '4' },
  { id: 'reflect', icon: <LineChart className="size-3.5" />, label: 'Reflect', key: '5' },
];

export function Header() {
  const {
    activeView,
    setActiveView,
    tasks,
    appendCaptureDraft,
    activeModalTaskId,
    accountabilityModalTask,
  } = useMatrixStore();

  const { resolvedTheme, setTheme } = useTheme();

  // 1–4 switch views. Any other printable key jumps straight into Capture with
  // that character already typed — so a thought never has to wait for a click.
  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        !target ||
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable ||
        e.metaKey ||
        e.ctrlKey ||
        e.altKey ||
        e.isComposing ||
        e.key === 'Process'
      ) {
        return;
      }

      // A modal owns the keyboard while it is open.
      if (activeModalTaskId || accountabilityModalTask) return;
      // The timer page owns Space; don't let it also type into Capture.
      if (activeView === 'timer' && (e.code === 'Space' || e.key === ' ')) return;

      const view = VIEWS.find((v) => v.key === e.key);
      if (view) {
        e.preventDefault();
        setActiveView(view.id);
        return;
      }

      // Focus is the only typing-proof page. Everywhere else, a keystroke means
      // a thought worth catching, so it lands in Capture.
      if (activeView === 'focus') return;

      if (e.key.length === 1) {
        e.preventDefault();
        setActiveView('capture');
        appendCaptureDraft(e.key);
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [activeView, activeModalTaskId, accountabilityModalTask, setActiveView, appendCaptureDraft]);

  // The inbox is never filtered, so this counts everything unsorted.
  const inboxCount = tasks.filter(
    (t) => t.status === 'inbox' && t.completionState === 'pending'
  ).length;

  // In Focus the chrome recedes so a single task owns the screen; it comes
  // back the moment you reach for it.
  const isFocusMode = activeView === 'focus';

  return (
    <header
      className={`sticky top-0 z-30 border-b border-border/60 bg-background/85 backdrop-blur-md transition-opacity duration-300 ${
        isFocusMode ? 'opacity-55 hover:opacity-100 focus-within:opacity-100' : 'opacity-100'
      }`}
    >
      <div className="mx-auto flex h-13 max-w-[1600px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        {/* Brand */}
        <div className="flex items-center gap-2">
          <LogoMark className="size-5" />
          <span className="hidden text-sm font-semibold tracking-tight text-foreground sm:inline">
            Slate
          </span>
        </div>

        {/* Mode switcher — shortcut hints surface on hover, not by default */}
        <nav
          aria-label="Views"
          className="group/nav flex items-center gap-0.5 rounded-xl border border-border/50 bg-muted/40 p-1"
        >
          {VIEWS.map((v) => {
            const isActive = activeView === v.id;
            return (
              <button
                key={v.id}
                onClick={() => setActiveView(v.id)}
                aria-current={isActive ? 'page' : undefined}
                title={`${v.label} · press ${v.key}`}
                className={`focus-ring relative flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition-colors sm:px-3 ${
                  isActive
                    ? 'border border-border/60 bg-card text-foreground shadow-xs'
                    : 'border border-transparent text-muted-foreground hover:bg-card/50 hover:text-foreground'
                }`}
              >
                {v.icon}
                <span className="hidden sm:inline">{v.label}</span>
                <span className="kbd ml-0.5 hidden opacity-0 transition-opacity group-hover/nav:opacity-100 lg:inline-flex">
                  {v.key}
                </span>
                {v.id === 'decide' && inboxCount > 0 && (
                  <span
                    className="ml-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-foreground px-1 text-[9px] font-bold text-background"
                    title={`${inboxCount} unsorted`}
                  >
                    {inboxCount}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="flex items-center gap-2">
          {/* Theme — icons swap via the .dark class so there is no mount flicker */}
          <button
            onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
            className="focus-ring rounded-lg border border-border/50 bg-card/40 p-1.5 text-muted-foreground transition-colors hover:text-foreground"
            title="Toggle theme"
            aria-label="Toggle theme"
          >
            <Moon className="size-3.5 dark:hidden" />
            <Sun className="hidden size-3.5 dark:block" />
          </button>

          {/* Account. Sized to sit level with the theme button, not tower over it. */}
          <UserButton appearance={{ elements: { avatarBox: 'size-7' } }} />
        </div>
      </div>
    </header>
  );
}
