import type { UserState } from '@/lib/db/user-data';
import type { BlockerCategory, Task } from '@/types/matrix';

export type DigestKind = 'morning' | 'plan' | 'evening' | 'weekly';
export const DIGEST_KINDS: DigestKind[] = ['morning', 'plan', 'evening', 'weekly'];

export interface Digest {
  subject: string;
  html: string;
}

const DAY_MS = 24 * 3600 * 1000;

/**
 * The cron runs in UTC, but "today" has to mean the user's day. One offset for
 * the whole app — Slate is single-timezone. Defaults to IST.
 */
const TZ_OFFSET_MS = Number(process.env.MAIL_TZ_OFFSET_MINUTES ?? 330) * 60_000;

/** Epoch ms of local midnight for the day `now` falls in, shifted by `days`. */
function localDayStart(now: number, days = 0): number {
  const local = now + TZ_OFFSET_MS;
  return local - (local % DAY_MS) - TZ_OFFSET_MS + days * DAY_MS;
}

const ts = (iso?: string | null) => (iso ? new Date(iso).getTime() : NaN);

const BLOCKER_LABEL: Record<BlockerCategory, string> = {
  underestimated_time: 'underestimated time',
  distracted_procrastination: 'distraction',
  scope_creep: 'scope creep',
  external_dependency: 'waiting on someone',
  low_energy_burnout: 'low energy',
  poor_clarity: 'unclear next step',
  other: 'something else',
};

/* ------------------------------------------------------------------ *
 * What the emails are about
 * ------------------------------------------------------------------ */

const isOpen = (t: Task) => t.completionState === 'pending' && t.status !== 'eliminate';

/**
 * A day's plan: open tasks due by the end of that day, plus Do First tasks
 * that aren't pushed past it. Inbox tasks don't count — unsorted isn't planned.
 */
function planFor(tasks: Task[], dayEnd: number): Task[] {
  return tasks
    .filter(isOpen)
    .filter((t) => t.status !== 'inbox')
    .filter((t) => !(ts(t.deferUntil) >= dayEnd))
    .filter((t) => ts(t.parsedDate) < dayEnd || t.status === 'do_first')
    .sort((a, b) => (ts(a.parsedDate) || Infinity) - (ts(b.parsedDate) || Infinity));
}

function overdue(tasks: Task[], now: number): Task[] {
  return tasks.filter(isOpen).filter((t) => ts(t.parsedDate) < now);
}

/* ------------------------------------------------------------------ *
 * HTML — inline styles only; mail clients ignore <style>.
 * ------------------------------------------------------------------ */

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function layout(heading: string, body: string, appUrl: string, cta: string): string {
  return `<!doctype html><html><body style="margin:0;background:#f4f4f2;font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#18181b">
<div style="max-width:520px;margin:0 auto;padding:32px 20px">
<p style="margin:0 0 20px;font-size:13px;font-weight:600;letter-spacing:.02em;color:#52525b">Slate</p>
<div style="background:#fff;border:1px solid #e4e4e7;border-radius:16px;padding:24px">
<h1 style="margin:0 0 14px;font-size:20px;line-height:1.3">${esc(heading)}</h1>
${body}
<a href="${esc(appUrl)}" style="display:inline-block;margin-top:20px;background:#18181b;color:#fff;text-decoration:none;font-size:14px;font-weight:600;padding:11px 18px;border-radius:10px">${esc(cta)}</a>
</div>
<p style="margin:16px 0 0;font-size:12px;color:#71717a">Sent by your Slate planner.</p>
</div></body></html>`;
}

const p = (text: string) => `<p style="margin:0 0 12px;font-size:14px;line-height:1.6;color:#3f3f46">${text}</p>`;
const label = (text: string) =>
  `<p style="margin:18px 0 6px;font-size:12px;font-weight:600;color:#71717a">${esc(text)}</p>`;

function list(tasks: Task[], meta?: (t: Task) => string, max = 8): string {
  const rows = tasks
    .slice(0, max)
    .map(
      (t) =>
        `<li style="padding:8px 0;border-bottom:1px solid #f0f0ee;font-size:14px">${esc(t.content)}${
          meta ? `<span style="color:#71717a"> · ${esc(meta(t))}</span>` : ''
        }</li>`
    )
    .join('');
  const more = tasks.length > max ? `<li style="padding:8px 0;font-size:13px;color:#71717a">+${tasks.length - max} more</li>` : '';
  return `<ul style="margin:0;padding:0;list-style:none">${rows}${more}</ul>`;
}

const fmtDate = (iso: string) =>
  new Date(ts(iso) + TZ_OFFSET_MS).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });

/* ------------------------------------------------------------------ *
 * The four emails. Each returns null when there is nothing worth saying —
 * an email you learn to ignore is worse than none.
 * ------------------------------------------------------------------ */

export function buildDigest(kind: DigestKind, state: UserState, appUrl: string, now = Date.now()): Digest | null {
  const { tasks, logs } = state;
  const todayStart = localDayStart(now);
  const todayEnd = localDayStart(now, 1);
  const tomorrowEnd = localDayStart(now, 2);

  if (kind === 'morning') {
    const today = planFor(tasks, todayEnd);
    const late = overdue(tasks, todayStart);
    if (today.length === 0) {
      return {
        subject: 'Nothing planned for today',
        html: layout(
          'Your day is a blank page',
          p('No tasks are lined up for today. Take two minutes now and pick the one thing that would make today count.'),
          appUrl,
          'Plan today'
        ),
      };
    }
    const first = today[0];
    return {
      subject: `Today: ${today.length} task${today.length === 1 ? '' : 's'} — start with “${first.content}”`,
      html: layout(
        'Good morning. Here’s today.',
        p(`Start with <strong>${esc(first.content)}</strong>. One thing at a time.`) +
          label('Today') +
          list(today, (t) => (t.parsedDate ? `due ${fmtDate(t.parsedDate)}` : 'do first')) +
          (late.length ? label(`Overdue (${late.length})`) + list(late, (t) => `was due ${fmtDate(t.parsedDate as string)}`, 5) : ''),
        appUrl,
        'Open Slate'
      ),
    };
  }

  if (kind === 'plan') {
    const tomorrow = planFor(tasks, tomorrowEnd);
    const lastWrite = Math.max(0, ...tasks.map((t) => ts(t.createdAt) || 0));
    const quiet = now - lastWrite > DAY_MS;
    if (tomorrow.length > 0 && !quiet) return null;

    const body =
      (quiet
        ? p('You haven’t written anything down in over a day. Clarity comes from writing — dump what’s on your mind, then sort it.')
        : '') +
      (tomorrow.length === 0
        ? p('Tomorrow has nothing planned yet. Pick it now while you still have the energy to think, so tomorrow-you just has to act.')
        : label('Tomorrow so far') + list(tomorrow));
    return {
      subject: tomorrow.length === 0 ? 'Plan tomorrow before the day ends' : 'You haven’t written anything today',
      html: layout(tomorrow.length === 0 ? 'Plan tomorrow now' : 'Write it down', body, appUrl, 'Plan in Slate'),
    };
  }

  if (kind === 'evening') {
    const doneToday = tasks.filter((t) => t.completionState === 'completed' && ts(t.completedAt) >= todayStart);
    const stuckToday = logs.filter((l) => ts(l.loggedAt) >= todayStart);
    const plannedToday = planFor(tasks, todayEnd);
    const tomorrow = planFor(tasks, tomorrowEnd);

    if (doneToday.length === 0 && stuckToday.length === 0 && plannedToday.length === 0 && tomorrow.length === 0) {
      return null;
    }

    let verdict: string;
    if (doneToday.length === 0 && plannedToday.length > 0) {
      verdict = `Nothing got finished today, and ${plannedToday.length} task${plannedToday.length === 1 ? ' is' : 's are'} still open. What got in the way? Mark them stuck so the pattern shows up in Reflect.`;
    } else if (plannedToday.length > 0) {
      verdict = `${doneToday.length} done, ${plannedToday.length} still open. Before you stop: move or mark the open ones, don’t just leave them.`;
    } else {
      verdict = `${doneToday.length} done and nothing left open. That’s a clean day.`;
    }

    return {
      subject: `Today: ${doneToday.length} done${stuckToday.length ? `, ${stuckToday.length} stuck` : ''} — reflect and plan tomorrow`,
      html: layout(
        'How did today go?',
        p(esc(verdict)) +
          (doneToday.length ? label('Done') + list(doneToday) : '') +
          (plannedToday.length ? label('Still open') + list(plannedToday) : '') +
          (stuckToday.length
            ? label('Got stuck') +
              `<ul style="margin:0;padding:0;list-style:none">${stuckToday
                .slice(0, 6)
                .map(
                  (l) =>
                    `<li style="padding:8px 0;border-bottom:1px solid #f0f0ee;font-size:14px">${esc(l.taskTitle)}<span style="color:#71717a"> · ${BLOCKER_LABEL[l.category]}</span></li>`
                )
                .join('')}</ul>`
            : '') +
          label('Tomorrow') +
          (tomorrow.length ? list(tomorrow) : p('Nothing planned yet — pick tomorrow’s top three now.')),
        appUrl,
        tomorrow.length ? 'Review in Slate' : 'Plan tomorrow'
      ),
    };
  }

  // weekly
  const weekStart = localDayStart(now, -6);
  const done = tasks.filter((t) => t.completionState === 'completed' && ts(t.completedAt) >= weekStart);
  const stuck = logs.filter((l) => ts(l.loggedAt) >= weekStart);
  if (done.length === 0 && stuck.length === 0) return null;

  const withDeadline = done.filter((t) => t.parsedDate);
  const onTime = withDeadline.filter((t) => ts(t.completedAt) <= ts(t.parsedDate)).length;

  const counts = new Map<BlockerCategory, number>();
  stuck.forEach((l) => counts.set(l.category, (counts.get(l.category) ?? 0) + 1));
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];

  const stuckByTask = new Map<string, number>();
  logs.forEach((l) => stuckByTask.set(l.taskId, (stuckByTask.get(l.taskId) ?? 0) + 1));
  const slipping = tasks
    .filter((t) => t.completionState === 'pending' && (stuckByTask.get(t.id) ?? 0) >= 2)
    .sort((a, b) => (stuckByTask.get(b.id) ?? 0) - (stuckByTask.get(a.id) ?? 0));

  const stat = (n: string, l: string) =>
    `<td style="padding:10px 12px;background:#f6f6f4;border-radius:10px;text-align:center"><div style="font-size:22px;font-weight:700">${n}</div><div style="font-size:12px;color:#71717a">${l}</div></td>`;

  return {
    subject: `Your week: ${done.length} done, ${stuck.length} stuck`,
    html: layout(
      'Your week in Slate',
      `<table role="presentation" style="width:100%;border-spacing:6px;margin:0 -6px 6px"><tr>${stat(String(done.length), 'done')}${stat(String(stuck.length), 'stuck')}${stat(
        withDeadline.length ? `${Math.round((onTime / withDeadline.length) * 100)}%` : '—',
        'on time'
      )}</tr></table>` +
        (top ? p(`Most of what slipped was <strong>${BLOCKER_LABEL[top[0]]}</strong> (${top[1]}×). That’s the one thing to fix next week.`) : '') +
        (slipping.length ? label('Keeps slipping — break it down, delegate, or drop it') + list(slipping, (t) => `stuck ${stuckByTask.get(t.id)}×`, 5) : '') +
        p('Open Reflect for the full picture, then plan the week’s first day.'),
      appUrl,
      'Open Reflect'
    ),
  };
}
