'use client';

import * as React from 'react';

/**
 * A clock the UI can read during render without being impure.
 *
 * Timestamps are bucketed to the minute so `getSnapshot` stays stable between
 * ticks, and every subscriber shares one interval. Overdue badges then correct
 * themselves while the tab sits open instead of waiting for a reload.
 */
const BUCKET_MS = 60_000;

const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | null = null;

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  if (!timer) {
    timer = setInterval(() => {
      listeners.forEach((listener) => listener());
    }, BUCKET_MS);
  }
  return () => {
    listeners.delete(onChange);
    if (listeners.size === 0 && timer) {
      clearInterval(timer);
      timer = null;
    }
  };
}

function getSnapshot(): number {
  return Math.floor(Date.now() / BUCKET_MS) * BUCKET_MS;
}

function getServerSnapshot(): number {
  return 0;
}

export function useNow(): number {
  return React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function isOverdue(date: string | null | undefined, now: number): boolean {
  if (!date) return false;
  const time = new Date(date).getTime();
  return !Number.isNaN(time) && time < now;
}
