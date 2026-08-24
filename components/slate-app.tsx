'use client';

import React from 'react';
import { useAuth } from '@clerk/nextjs';
import { useMatrixStore } from '@/lib/store';
import { Header } from '@/components/header';
import { CaptureView } from '@/components/views/capture-view';
import { DecideView } from '@/components/views/decide-view';
import { FocusView } from '@/components/views/focus-view';
import { PomodoroView } from '@/components/views/pomodoro-view';
import { AnalyzerView } from '@/components/analyzer/analyzer-view';
import { AccountabilityDialog } from '@/components/accountability/accountability-dialog';
import { TaskDetailModal } from '@/components/task-detail-modal';
import { ConfirmDeleteDialog } from '@/components/confirm-delete-dialog';

export function SlateApp() {
  const { isLoaded, userId } = useAuth();
  const { isHydrated, hydrate, resetForSignOut, activeView } = useMatrixStore();

  /**
   * Data is loaded per account, so hydration waits for Clerk and re-runs if the
   * signed-in user changes. Signing out clears the store rather than leaving one
   * account's tasks on screen for the next.
   */
  React.useEffect(() => {
    if (!isLoaded) return;
    if (!userId) {
      resetForSignOut();
      return;
    }
    hydrate(userId);
  }, [isLoaded, userId, hydrate, resetForSignOut]);

  if (!isLoaded || !isHydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="size-4 rounded-full border-2 border-foreground/15 border-t-foreground/50 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <Header />
      <main className="flex-1 px-4 py-4 sm:px-6 lg:px-8">
        {/* Keyed so switching views cross-fades instead of snapping */}
        <div key={activeView} className="animate-fade">
          {activeView === 'capture' && <CaptureView />}
          {activeView === 'decide' && <DecideView />}
          {activeView === 'focus' && <FocusView />}
          {activeView === 'timer' && <PomodoroView />}
          {activeView === 'reflect' && <AnalyzerView />}
        </div>
      </main>
      <AccountabilityDialog />
      <TaskDetailModal />
      <ConfirmDeleteDialog />
    </div>
  );
}
