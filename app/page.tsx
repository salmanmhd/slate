'use client';

import React from 'react';
import { useMatrixStore } from '@/lib/store';
import { Header } from '@/components/header';
import { CaptureView } from '@/components/views/capture-view';
import { DecideView } from '@/components/views/decide-view';
import { FocusView } from '@/components/views/focus-view';
import { AnalyzerView } from '@/components/analyzer/analyzer-view';
import { AccountabilityDialog } from '@/components/accountability/accountability-dialog';
import { TaskDetailModal } from '@/components/task-detail-modal';

export default function FocusMatrixApp() {
  const { isHydrated, hydrate, activeView } = useMatrixStore();

  React.useEffect(() => {
    hydrate();
  }, [hydrate]);

  if (!isHydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="size-4 rounded-full border-2 border-foreground/15 border-t-foreground/50 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <Header />
      <main className="flex-1 px-4 py-3 sm:px-6 lg:px-8">
        {activeView === 'capture' && <CaptureView />}
        {activeView === 'decide' && <DecideView />}
        {activeView === 'focus' && <FocusView />}
        {activeView === 'reflect' && <AnalyzerView />}
      </main>
      <AccountabilityDialog />
      <TaskDetailModal />
    </div>
  );
}
