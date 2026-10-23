import { Flame, CalendarClock, UserCheck, Trash2, Inbox, LucideIcon } from 'lucide-react';
import { TaskStatus } from '@/types/matrix';

export interface QuadrantMeta {
  title: string;
  /** Tooltip only — never rendered as visible copy. */
  hint: string;
  Icon: LucideIcon;
  /** Tailwind classes bound to the --q-* tokens in globals.css. */
  text: string;
  dot: string;
  /** Top rule colour on the panel. */
  bar: string;
  /**
   * Visual weight on the board. "Do First" is where your eye should land;
   * "Drop" is deliberately receded so it never competes for attention.
   */
  weight: 'primary' | 'normal' | 'muted';
}

export const QUADRANTS: Record<Exclude<TaskStatus, 'inbox'>, QuadrantMeta> = {
  do_first: {
    title: 'Do First',
    hint: 'Urgent & important',
    Icon: Flame,
    text: 'text-q-do-first',
    dot: 'bg-q-do-first',
    bar: 'bg-q-do-first',
    weight: 'primary',
  },
  schedule: {
    title: 'Schedule',
    hint: 'Important, not urgent',
    Icon: CalendarClock,
    text: 'text-q-schedule',
    dot: 'bg-q-schedule',
    bar: 'bg-q-schedule',
    weight: 'normal',
  },
  delegate: {
    title: 'Delegate',
    hint: 'Urgent, not important',
    Icon: UserCheck,
    text: 'text-q-delegate',
    dot: 'bg-q-delegate',
    bar: 'bg-q-delegate',
    weight: 'normal',
  },
  eliminate: {
    title: 'Drop',
    hint: 'Neither urgent nor important',
    Icon: Trash2,
    text: 'text-q-eliminate',
    dot: 'bg-q-eliminate',
    bar: 'bg-q-eliminate',
    weight: 'muted',
  },
};

export const INBOX_META = {
  title: 'Unorganised Tasks',
  hint: 'Not yet decided',
  Icon: Inbox,
};
