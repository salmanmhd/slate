'use client';

import React from 'react';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCorners,
  useDroppable,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useMatrixStore } from '@/lib/store';
import { Task, TaskStatus } from '@/types/matrix';
import { formatFriendlyDate } from '@/lib/nlp-parser';
import { QUADRANTS, INBOX_META } from '@/components/quadrants';
import { useNow, isOverdue } from '@/hooks/use-now';
import {
  Calendar,
  Check,
  Circle,
  AlertCircle,
  Plus,
  FileText,
  ChevronRight,
  Target,
} from 'lucide-react';

type Quadrant = Exclude<TaskStatus, 'inbox'>;
const QUADRANT_IDS: TaskStatus[] = ['inbox', 'do_first', 'schedule', 'delegate', 'eliminate'];

export function DecideView() {
  const {
    tasks,
    moveTask,
    reorderTasks,
    addTask,
    setActiveView,
    activeModalTaskId,
    accountabilityModalTask,
  } = useMatrixStore();

  const [activeTask, setActiveTask] = React.useState<Task | null>(null);
  const [inboxInput, setInboxInput] = React.useState('');
  const quickAddRef = React.useRef<HTMLInputElement>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const byStatus = React.useMemo(() => {
    const open = tasks.filter((t) => t.completionState !== 'completed');
    return {
      inbox: open.filter((t) => t.status === 'inbox'),
      do_first: open.filter((t) => t.status === 'do_first'),
      schedule: open.filter((t) => t.status === 'schedule'),
      delegate: open.filter((t) => t.status === 'delegate'),
      eliminate: open.filter((t) => t.status === 'eliminate'),
    };
  }, [tasks]);

  const inboxTasks = byStatus.inbox;
  const sortedCount = tasks.filter(
    (t) => t.completionState !== 'completed' && t.status !== 'inbox'
  ).length;
  const totalOpen = sortedCount + inboxTasks.length;

  // Typing anywhere on this page lands in the quick-add field, so a stray
  // thought never costs you a click.
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
        e.isComposing
      ) {
        return;
      }
      if (activeModalTaskId || accountabilityModalTask) return;
      if (['1', '2', '3', '4'].includes(e.key)) return; // owned by the header

      if (e.key.length === 1) {
        e.preventDefault();
        setInboxInput((prev) => prev + e.key);
        quickAddRef.current?.focus();
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [activeModalTaskId, accountabilityModalTask]);

  const handleDragStart = (e: DragStartEvent) => {
    const t = tasks.find((item) => item.id === e.active.id);
    if (t) setActiveTask(t);
  };

  const handleDragEnd = (e: DragEndEvent) => {
    setActiveTask(null);
    const { active, over } = e;
    if (!over) return;

    const activeId = String(active.id);
    const overId = String(over.id);
    const dragged = tasks.find((t) => t.id === activeId);
    if (!dragged) return;

    if (QUADRANT_IDS.includes(overId as TaskStatus)) {
      if (dragged.status !== overId) moveTask(activeId, overId as TaskStatus);
      return;
    }

    const overTask = tasks.find((t) => t.id === overId);
    if (!overTask) return;
    if (dragged.status === overTask.status) {
      reorderTasks(activeId, overId, dragged.status);
    } else {
      moveTask(activeId, overTask.status);
    }
  };

  const handleQuickAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inboxInput.trim()) return;
    addTask(inboxInput.trim(), 'inbox');
    setInboxInput('');
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-3 lg:h-[calc(100vh-6.25rem)]">
        {/* Progress only — the nav already says where you are */}
        <div className="flex min-h-7 shrink-0 items-center justify-end border-b border-border/60 px-1 pb-1.5">
          {totalOpen > 0 &&
            (inboxTasks.length === 0 ? (
              <button
                onClick={() => setActiveView('focus')}
                className="focus-ring inline-flex items-center gap-1.5 rounded-lg px-2 py-0.5 text-xs font-semibold text-foreground transition-colors hover:bg-muted/60"
              >
                <Target className="size-3.5" />
                Start focusing
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <div className="h-1 w-24 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-foreground/70 transition-all duration-500"
                    style={{ width: `${Math.round((sortedCount / totalOpen) * 100)}%` }}
                  />
                </div>
                <span className="text-[11px] tabular-nums text-muted-foreground/70">
                  {sortedCount}/{totalOpen}
                </span>
              </div>
            ))}
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-12">
          {/* Inbox — a pile you drag from */}
          <section className="card-depth flex min-h-104 flex-col rounded-2xl border border-border/80 bg-card p-3 lg:col-span-4 lg:min-h-0">
            <div className="mb-2.5 flex shrink-0 items-center justify-between">
              <div className="flex items-center gap-2">
                <INBOX_META.Icon className="size-3.5 text-muted-foreground" />
                <h3 className="text-xs font-semibold text-foreground">{INBOX_META.title}</h3>
              </div>
              <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold tabular-nums text-muted-foreground">
                {inboxTasks.length}
              </span>
            </div>

            <InboxList tasks={inboxTasks} />

            <form onSubmit={handleQuickAdd} className="mt-2 shrink-0">
              <div className="relative">
                <input
                  ref={quickAddRef}
                  type="text"
                  value={inboxInput}
                  onChange={(e) => setInboxInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') {
                      setInboxInput('');
                      e.currentTarget.blur();
                    }
                  }}
                  placeholder="Add a task"
                  className="w-full rounded-xl border border-border/80 bg-background py-1.5 pr-8 pl-3 text-xs text-foreground transition-colors placeholder:text-muted-foreground/50 focus:border-foreground/30 focus:outline-none"
                  autoComplete="off"
                />
                <button
                  type="submit"
                  disabled={!inboxInput.trim()}
                  className="focus-ring absolute top-1/2 right-2 -translate-y-1/2 rounded-md p-0.5 text-muted-foreground/60 transition-colors hover:text-foreground disabled:opacity-30"
                  title="Add to inbox"
                >
                  <Plus className="size-3.5" />
                </button>
              </div>
            </form>
          </section>

          {/* The matrix, with its axes stated once */}
          <section className="flex min-h-120 flex-col lg:col-span-8 lg:min-h-0">
            <div className="grid min-h-0 flex-1 grid-cols-[1.25rem_1fr] grid-rows-[1.25rem_1fr] gap-x-1.5 gap-y-1">
              <div aria-hidden />
              <div className="grid grid-cols-2 gap-3">
                <AxisLabel>Urgent</AxisLabel>
                <AxisLabel>Not urgent</AxisLabel>
              </div>

              <div className="grid min-h-0 grid-rows-2 gap-3">
                <AxisLabel vertical>Important</AxisLabel>
                <AxisLabel vertical>Not important</AxisLabel>
              </div>

              <div className="grid min-h-0 grid-cols-2 grid-rows-2 gap-3">
                <QuadrantPanel status="do_first" tasks={byStatus.do_first} />
                <QuadrantPanel status="schedule" tasks={byStatus.schedule} />
                <QuadrantPanel status="delegate" tasks={byStatus.delegate} />
                <QuadrantPanel status="eliminate" tasks={byStatus.eliminate} />
              </div>
            </div>
          </section>
        </div>
      </div>

      <DragOverlay dropAnimation={{ duration: 180, easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)' }}>
        {activeTask && <DragPreview task={activeTask} />}
      </DragOverlay>
    </DndContext>
  );
}

/* ──────── Axis labels ──────── */

function AxisLabel({ children, vertical }: { children: React.ReactNode; vertical?: boolean }) {
  return (
    <div
      className={`flex items-center justify-center text-[9px] font-semibold tracking-[0.14em] text-muted-foreground/60 uppercase ${
        vertical ? '[writing-mode:vertical-rl] rotate-180' : ''
      }`}
    >
      {children}
    </div>
  );
}

/* ──────── Inbox list ──────── */

function InboxList({ tasks }: { tasks: Task[] }) {
  const { setNodeRef, isOver } = useDroppable({
    id: 'inbox',
    data: { type: 'quadrant', status: 'inbox' },
  });

  return (
    <div
      ref={setNodeRef}
      className={`min-h-0 flex-1 space-y-1.5 overflow-y-auto rounded-xl border p-2 transition-colors ${
        isOver ? 'border-foreground/30 bg-muted/40' : 'border-border/50 bg-background/40'
      }`}
    >
      <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
        {tasks.map((task) => (
          <TaskCard key={task.id} task={task} />
        ))}
      </SortableContext>

      {tasks.length === 0 && (
        <div className="flex h-full min-h-20 items-center justify-center gap-2">
          <Check className="size-3.5 text-muted-foreground/40" />
          <p className="text-xs text-muted-foreground/60">Inbox clear</p>
        </div>
      )}
    </div>
  );
}

/* ──────── Quadrant panel ──────── */

function QuadrantPanel({ status, tasks }: { status: Quadrant; tasks: Task[] }) {
  const meta = QUADRANTS[status];
  const { setNodeRef, isOver } = useDroppable({
    id: status,
    data: { type: 'quadrant', status },
  });

  // Weight, not words, tells you where your attention belongs.
  const resting =
    meta.weight === 'primary'
      ? 'border-q-do-first/35 bg-card ring-1 ring-q-do-first/15'
      : meta.weight === 'muted'
        ? 'border-border/50 bg-card/40 opacity-55 hover:opacity-100'
        : 'border-border/80 bg-card';

  return (
    <div
      ref={setNodeRef}
      className={`card-depth flex min-h-0 flex-col rounded-2xl border p-2.5 transition-all ${
        isOver ? 'border-foreground/40 bg-muted/30 opacity-100 ring-0' : resting
      }`}
    >
      <div className="mb-1.5 flex shrink-0 items-center gap-1.5 border-b border-border/50 pb-1.5">
        <meta.Icon className={`size-3.5 ${meta.text}`} />
        <h3
          className={`text-xs tracking-tight ${
            meta.weight === 'primary' ? 'font-bold text-foreground' : 'font-semibold text-foreground/80'
          }`}
          title={meta.hint}
        >
          {meta.title}
        </h3>
        <span className="ml-auto text-[10px] font-medium tabular-nums text-muted-foreground">
          {tasks.length}
        </span>
      </div>

      <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto pr-0.5">
        <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          {tasks.map((task) => (
            <TaskCard key={task.id} task={task} accentDot={meta.dot} />
          ))}
        </SortableContext>
      </div>
    </div>
  );
}

/* ──────── Task card ──────── */

function TaskCard({ task, accentDot }: { task: Task; accentDot?: string }) {
  const { openTaskDetailModal, toggleTaskCompletion } = useMatrixStore();
  const [blockedHint, setBlockedHint] = React.useState(false);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    data: { type: 'task', task },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.25 : 1,
  };

  const isCompleted = task.completionState === 'completed';
  const overdue = isOverdue(task.parsedDate, useNow());
  const subtasks = task.subtasks || [];
  const doneSubs = subtasks.filter((s) => s.completed).length;
  const hasOpenSteps = doneSubs < subtasks.length;

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!toggleTaskCompletion(task.id)) {
      setBlockedHint(true);
      window.setTimeout(() => setBlockedHint(false), 2200);
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => openTaskDetailModal(task.id)}
      className={`group relative flex cursor-grab flex-col gap-1 rounded-xl border bg-card px-2.5 py-2 shadow-xs transition-colors hover:border-foreground/30 active:cursor-grabbing ${
        isCompleted ? 'border-border/40 opacity-60' : overdue ? 'border-q-do-first/40' : 'border-border/80'
      }`}
    >
      <div className="flex items-start gap-2">
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={handleToggle}
          className="focus-ring mt-0.5 shrink-0 rounded-full text-muted-foreground/40 transition-colors hover:text-foreground"
          title={hasOpenSteps ? 'Finish the steps first' : 'Mark done'}
          aria-label={hasOpenSteps ? 'Finish the steps first' : 'Mark done'}
        >
          {isCompleted ? (
            <span className="flex size-3.5 items-center justify-center rounded-full bg-foreground text-background">
              <Check className="size-2" strokeWidth={3} />
            </span>
          ) : (
            <Circle className="size-3.5" strokeWidth={1.5} />
          )}
        </button>

        <p
          className={`flex-1 truncate text-xs leading-snug font-medium select-none ${
            isCompleted ? 'text-muted-foreground line-through' : 'text-foreground'
          }`}
          title={task.content}
        >
          {task.content}
        </p>

        <ChevronRight className="mt-0.5 size-3 shrink-0 text-muted-foreground/30 transition-colors group-hover:text-muted-foreground" />
      </div>

      {(task.parsedDate || subtasks.length > 0 || task.notes || blockedHint) && (
        <div className="flex flex-wrap items-center gap-1.5 pt-0.5 text-[10px] text-muted-foreground">
          {accentDot && !blockedHint && (
            <span className={`size-1 rounded-full ${accentDot} opacity-70`} aria-hidden />
          )}

          {blockedHint ? (
            <span className="font-medium text-q-do-first">
              Finish its {subtasks.length - doneSubs} open{' '}
              {subtasks.length - doneSubs === 1 ? 'step' : 'steps'} first
            </span>
          ) : (
            <>
              {task.parsedDate && (
                <span
                  className={`inline-flex items-center gap-0.5 rounded px-1 py-px font-medium ${
                    overdue ? 'bg-q-do-first/10 text-q-do-first' : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {overdue ? <AlertCircle className="size-2.5" /> : <Calendar className="size-2.5" />}
                  {formatFriendlyDate(task.parsedDate)}
                </span>
              )}
              {subtasks.length > 0 && (
                <span className="rounded bg-muted px-1.5 py-px font-semibold tabular-nums text-muted-foreground">
                  {doneSubs}/{subtasks.length}
                </span>
              )}
              {task.notes && <FileText className="size-2.5 text-muted-foreground/70" aria-label="Has notes" />}
            </>
          )}
        </div>
      )}
    </div>
  );
}

/* ──────── Drag preview ──────── */

function DragPreview({ task }: { task: Task }) {
  return (
    <div className="flex max-w-sm rotate-1 flex-col gap-1 rounded-xl border border-foreground/40 bg-card p-3 shadow-2xl">
      <div className="flex items-center gap-2">
        <Circle className="size-3.5 shrink-0 text-muted-foreground/50" />
        <span className="truncate text-xs font-semibold text-foreground">{task.content}</span>
      </div>
      {task.parsedDate && (
        <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
          <Calendar className="size-2.5" />
          {formatFriendlyDate(task.parsedDate)}
        </span>
      )}
    </div>
  );
}
