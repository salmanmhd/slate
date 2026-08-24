export interface DeferPreset {
  label: string;
  /** Resolved against a passed-in `now` so callers stay pure. */
  at: (now: number) => Date;
  /** Hidden when the moment it names has already gone by. */
  available: (now: number) => boolean;
}

const EVENING_HOUR = 20;
const MORNING_HOUR = 9;

function atHour(now: number, hour: number, dayOffset = 0): Date {
  const d = new Date(now);
  d.setDate(d.getDate() + dayOffset);
  d.setHours(hour, 0, 0, 0);
  return d;
}

/**
 * Quick ways to say "not now". Deliberately few — a snooze menu with a dozen
 * options is a decision you have to make while already avoiding a decision.
 */
export const DEFER_PRESETS: DeferPreset[] = [
  {
    label: '2h',
    at: (now) => new Date(now + 2 * 3600_000),
    available: () => true,
  },
  {
    label: 'Tonight',
    at: (now) => atHour(now, EVENING_HOUR),
    available: (now) => new Date(now).getHours() < EVENING_HOUR - 1,
  },
  {
    label: 'Tomorrow',
    at: (now) => atHour(now, MORNING_HOUR, 1),
    available: () => true,
  },
];

export function isDeferred(task: { deferUntil?: string }, now: number): boolean {
  if (!task.deferUntil) return false;
  const at = new Date(task.deferUntil).getTime();
  return !Number.isNaN(at) && at > now;
}

/** "8:00 PM" for today, "Tomorrow 9:00 AM" beyond it. */
export function formatDeferLabel(iso: string, now: number): string {
  const at = new Date(iso);
  const time = at.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const day = new Date(at);
  day.setHours(0, 0, 0, 0);

  const diff = Math.round((day.getTime() - today.getTime()) / 86_400_000);
  if (diff <= 0) return time;
  if (diff === 1) return `Tomorrow ${time}`;
  return `${at.toLocaleDateString([], { weekday: 'short' })} ${time}`;
}
