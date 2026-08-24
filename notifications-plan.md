# Notifications — agreed plan (not built yet)

Parked for later. Everything below was decided; only the two open questions at
the bottom remain.

## The constraint that shapes it

Browser notifications **only fire while the app is open in a tab**. JavaScript
cannot run once the tab is closed — that needs a service worker, a push
subscription, and a server to push from, and this app is deliberately
local-first with no backend.

So the honest promise is *"Slate can tap you on the shoulder when it is open in
a background tab"*, not *"Slate reminds you when you are away"*. That still
covers the main case (working in another window with Slate behind it).

Second limitation: background tabs throttle timers to roughly once a minute, so
a notification can land up to ~60s late.

## Surface

**Header bell + dropdown panel**, beside the theme toggle. No sixth nav slot.
Unread dot on the bell, list grouped by day, click an item to jump to its task,
dismiss one, clear all, Escape and click-outside to close. Panel uses the
existing `.glass` material.

## Data

```ts
type NotificationKind = 'task_overdue' | 'task_due_soon' | 'block_stalled'

interface AppNotification {
  id: string
  kind: NotificationKind
  title: string
  body?: string
  createdAt: string
  readAt?: string
  taskId?: string
  dedupeKey: string
}
```

Persisted in IndexedDB beside tasks and sessions. **Pruned to 7 days on load**
so the list drains itself and never becomes another inbox to clear — which is
the exact overwhelm this app exists to fight.

`dedupeKey` is what prevents repeat-firing, and differs per trigger:

- overdue / due-soon → `taskId` + the deadline it fired for, so **rescheduling a
  task lets it fire again** against the new date
- stalled block → the `pausedAt` timestamp, unique per pause

## Triggers

One watcher hook, mounted once, riding the **existing minute-bucketed
`useNow()`** clock — no new interval.

| Trigger | Fires when | Guard |
| --- | --- | --- |
| Task overdue | `parsedDate` passes, task still pending | Skip `eliminate` and completed |
| Task due soon | Within 15 min of the deadline | Suppressed if already overdue |
| Block stalled | Paused 10+ min without resuming | Only if the pause is under 2h old |

That last guard matters: pause state now survives reload, so without it, opening
the app the morning after would announce a pause from yesterday.

## Browser notification behaviour

- Fired **only when `document.visibilityState === 'hidden'`** — no OS popup
  while you are looking straight at the app.
- Permission requested from **one explicit control**, never on page load.
- `denied` handled honestly: browsers will not let us re-prompt out of it, so
  the panel explains it must be changed in browser settings.
- `tag` set to the dedupe key so duplicates collapse rather than stack.
- Click → focus the window and navigate to the related task.

**Icon:** Chrome will not reliably render our SVG mark in a notification.
Generate a PNG via Next's `ImageResponse` (which also gets us a proper
apple-touch-icon); if that proves fragile, ship iconless rather than broken.

## Explicitly out of scope

Push (needs a server), daily digests, streak warnings, sound, and any
notification celebrating your own activity back at you. That is nagware and it
trains you to ignore the whole channel.

## Open questions

1. **Block-finished was dropped from the trigger list** while "block stalled"
   was kept. Those are both timer notifications, and block-finished is the gap
   this feature mainly existed to close — a finished pomodoro in a buried tab
   currently tells you nothing, while a *paused* one would. Confirm whether the
   omission was deliberate.
2. Are **15 min** (due soon) and **10 min** (stalled) the right thresholds?
