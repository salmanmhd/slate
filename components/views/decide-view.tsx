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
import { CategorySwitcher, CategoryMark } from '@/components/category-switcher';
import { TaskMeta } from '@/components/task-meta';
import { useNow, isOverdue } from '@/hooks/use-now';
import { Calendar, Check, Circle, ChevronRight, Target, Maximize2, Minimize2, LayoutGrid } from 'lucide-react';

type Quadrant = Exclude<TaskStatus, 'inbox'>;
const QUADRANT_IDS: TaskStatus[] = ['inbox', 'do_first', 'schedule', 'delegate', 'eliminate'];

export function DecideView() {
  const { tasks, moveTask, reorderTasks, setActiveView, activeCategory, setTaskCategory } =
    useMatrixStore();

  const [activeTask, setActiveTask] = React.useState<Task | null>(null);
  const [hideInbox, setHideInbox] = React.useState(false);
  const [enlargedQuadrant, setEnlargedQuadrant] = React.useState<Quadrant | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // The inbox is always everything — an unsorted task must never be hidden by
  // a filter. The matrix is what narrows to the chosen context.
  const { byStatus, inboxTasks, sortedCount, totalOpen } = React.useMemo(() => {
    const open = tasks.filter((t) => t.completionState !== 'completed');
    const inMatrix = open.filter((t) => t.status !== 'inbox');
    const scoped =
      activeCategory === 'all' ? inMatrix : inMatrix.filter((t) => t.category === activeCategory);

    return {
      inboxTasks: open.filter((t) => t.status === 'inbox'),
      sortedCount: inMatrix.length,
      totalOpen: open.length,
      byStatus: {
        do_first: scoped.filter((t) => t.status === 'do_first'),
        schedule: scoped.filter((t) => t.status === 'schedule'),
        delegate: scoped.filter((t) => t.status === 'delegate'),
        eliminate: scoped.filter((t) => t.status === 'eliminate'),
      },
    };
  }, [tasks, activeCategory]);

  const handleDragStart = (e: DragStartEvent) => {
    const t = tasks.find((item) => item.id === e.active.id);
    if (t) setActiveTask(t);
  };

  /**
   * Sorting an untagged task into a filtered matrix would drop it straight out
   * of view. Filing it under the context you are working in is what you meant.
   * A task that already carries a different category keeps it — that was a
   * deliberate choice and is not ours to overwrite.
   */
  const adoptContext = (task: Task, target: TaskStatus) => {
    if (target === 'inbox') return;
    if (activeCategory === 'all' || task.category) return;
    setTaskCategory(task.id, activeCategory);
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
      if (dragged.status !== overId) {
        adoptContext(dragged, overId as TaskStatus);
        moveTask(activeId, overId as TaskStatus);
      }
      return;
    }

    const overTask = tasks.find((t) => t.id === overId);
    if (!overTask) return;
    if (dragged.status === overTask.status) {
      reorderTasks(activeId, overId, dragged.status);
    } else {
      adoptContext(dragged, overTask.status);
      moveTask(activeId, overTask.status);
    }
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-3 lg:h-[calc(100vh-6.25rem)]">
        {/* Context on the left, sorting progress and view mode on the right */}
        <div className="flex min-h-7 shrink-0 items-center justify-between gap-4 border-b border-border/60 px-1 pb-1.5">
          <CategorySwitcher />

          <div className="flex items-center gap-3">
            {/* Full page / Hide unorganised toggle */}
            <button
              type="button"
              onClick={() => setHideInbox((prev) => !prev)}
              className={`focus-ring inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-0.5 text-xs font-medium transition-colors ${
                hideInbox
                  ? 'border-border/80 bg-foreground text-background shadow-xs font-semibold'
                  : 'border-border/50 bg-card/60 text-muted-foreground hover:bg-card hover:text-foreground'
              }`}
              title={hideInbox ? 'Show Unorganised Tasks' : 'Hide Unorganised Tasks (Full Page)'}
              aria-label={hideInbox ? 'Show Unorganised Tasks' : 'Hide Unorganised Tasks (Full Page)'}
            >
              <INBOX_META.Icon className="size-3.5" />
              <span>{hideInbox ? 'Show Unorganised' : 'Full Page'}</span>
              {hideInbox && inboxTasks.length > 0 && (
                <span className="rounded-full bg-background/20 px-1.5 py-0.2 text-[10px] font-bold">
                  {inboxTasks.length}
                </span>
              )}
            </button>

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
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {sortedCount}/{totalOpen}
                  </span>
                </div>
              ))}
          </div>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-12">
          {/* Inbox — a pile you drag from */}
          {!hideInbox && (
            <section className="card-depth flex min-h-104 flex-col rounded-2xl border border-border/80 bg-card p-3 lg:col-span-4 lg:min-h-0 animate-fade">
              <div className="mb-2.5 flex shrink-0 items-center justify-between">
                <div className="flex items-center gap-2">
                  <INBOX_META.Icon className="size-3.5 text-muted-foreground" />
                  <h3 className="text-sm font-semibold text-foreground">{INBOX_META.title}</h3>
                </div>
                <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold tabular-nums text-muted-foreground">
                  {inboxTasks.length}
                </span>
              </div>

              <InboxList tasks={inboxTasks} />
            </section>
          )}

          {/* The matrix, with its axes stated once, or enlarged single quadrant */}
          <section
            className={`flex min-h-120 flex-col ${
              hideInbox ? 'lg:col-span-12' : 'lg:col-span-8'
            } lg:min-h-0 transition-all duration-300`}
          >
            {enlargedQuadrant ? (
              <div className="flex min-h-0 flex-1 flex-col animate-fade">
                {/* Switcher bar while a quadrant is enlarged */}
                <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2 border-b border-border/40 pb-2">
                  <div className="flex items-center gap-1 rounded-xl border border-border/50 bg-muted/30 p-1">
                    {QUADRANT_IDS.filter((id): id is Quadrant => id !== 'inbox').map((qId) => {
                      const qMeta = QUADRANTS[qId];
                      const isCurrent = enlargedQuadrant === qId;
                      const count = byStatus[qId].length;
                      return (
                        <button
                          key={qId}
                          type="button"
                          onClick={() => setEnlargedQuadrant(qId)}
                          className={`focus-ring flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                            isCurrent
                              ? 'border border-border/60 bg-card text-foreground shadow-xs font-semibold'
                              : 'border border-transparent text-muted-foreground hover:text-foreground'
                          }`}
                        >
                          <qMeta.Icon className={`size-3.5 ${qMeta.text}`} />
                          <span>{qMeta.title}</span>
                          <span className="text-[10px] tabular-nums text-muted-foreground">
                            ({count})
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  <button
                    type="button"
                    onClick={() => setEnlargedQuadrant(null)}
                    className="focus-ring inline-flex items-center gap-1.5 rounded-lg border border-border/50 bg-card px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:bg-muted/60"
                    title="Restore 2x2 grid"
                  >
                    <LayoutGrid className="size-3.5 text-muted-foreground" />
                    <span className="hidden sm:inline">Restore 2x2 Grid</span>
                  </button>
                </div>

                <div className="min-h-0 flex-1 flex flex-col">
                  <QuadrantPanel
                    status={enlargedQuadrant}
                    tasks={byStatus[enlargedQuadrant]}
                    isEnlarged={true}
                    onToggleEnlarge={() => setEnlargedQuadrant(null)}
                  />
                </div>
              </div>
            ) : (
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
                  <QuadrantPanel
                    status="do_first"
                    tasks={byStatus.do_first}
                    isEnlarged={false}
                    onToggleEnlarge={(q) => setEnlargedQuadrant(q)}
                  />
                  <QuadrantPanel
                    status="schedule"
                    tasks={byStatus.schedule}
                    isEnlarged={false}
                    onToggleEnlarge={(q) => setEnlargedQuadrant(q)}
                  />
                  <QuadrantPanel
                    status="delegate"
                    tasks={byStatus.delegate}
                    isEnlarged={false}
                    onToggleEnlarge={(q) => setEnlargedQuadrant(q)}
                  />
                  <QuadrantPanel
                    status="eliminate"
                    tasks={byStatus.eliminate}
                    isEnlarged={false}
                    onToggleEnlarge={(q) => setEnlargedQuadrant(q)}
                  />
                </div>
              </div>
            )}
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
      className={`flex items-center justify-center text-[10px] font-semibold tracking-[0.14em] text-muted-foreground uppercase ${
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
          <p className="text-xs text-muted-foreground">No unorganised tasks</p>
        </div>
      )}
    </div>
  );
}

function QuadrantPanel({
  status,
  tasks,
  isEnlarged = false,
  onToggleEnlarge,
}: {
  status: Quadrant;
  tasks: Task[];
  isEnlarged?: boolean;
  onToggleEnlarge?: (status: Quadrant) => void;
}) {
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
        ? 'border-border/50 bg-card/40 opacity-75 hover:opacity-100'
        : 'border-border/80 bg-card';

  return (
    <div
      ref={setNodeRef}
      className={`card-depth group/quadrant flex min-h-0 flex-1 flex-col rounded-2xl border p-2.5 transition-all duration-200 ${
        isOver
          ? 'scale-[1.015] border-foreground/40 bg-muted/30 opacity-100 ring-0'
          : `scale-100 ${resting}`
      } ${isEnlarged ? 'h-full' : ''}`}
    >
      <div className="mb-1.5 flex shrink-0 items-center gap-1.5 border-b border-border/50 pb-1.5">
        <meta.Icon className={`size-3.5 ${meta.text}`} />
        <h3
          className={`text-sm tracking-tight ${
            meta.weight === 'primary' ? 'font-bold text-foreground' : 'font-semibold text-foreground/80'
          }`}
          title={meta.hint}
        >
          {meta.title}
        </h3>
        <span className="text-xs font-medium tabular-nums text-muted-foreground">
          {tasks.length}
        </span>

        {onToggleEnlarge && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleEnlarge(status);
            }}
            className="focus-ring ml-auto rounded-md p-1 text-muted-foreground/50 opacity-0 transition-opacity group-hover/quadrant:opacity-100 focus-visible:opacity-100 hover:bg-muted hover:text-foreground"
            title={isEnlarged ? 'Restore 2x2 grid view' : `Enlarge ${meta.title}`}
            aria-label={isEnlarged ? 'Restore 2x2 grid view' : `Enlarge ${meta.title}`}
          >
            {isEnlarged ? <Minimize2 className="size-3.5" /> : <Maximize2 className="size-3.5" />}
          </button>
        )}
      </div>

      <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto pr-0.5">
        <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          {tasks.map((task) => (
            <TaskCard key={task.id} task={task} accentDot={meta.dot} />
          ))}
        </SortableContext>

        {tasks.length === 0 && (
          <div className="flex h-full min-h-24 items-center justify-center p-4 text-center">
            <p className="text-xs text-muted-foreground">
              Drop tasks here to {meta.title.toLowerCase()}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ──────── Task card ──────── */

function TaskCard({ task, accentDot }: { task: Task; accentDot?: string }) {
  const { openTaskDetailModal, toggleTaskCompletion, setTaskCategory, activeCategory } =
    useMatrixStore();
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
      className={`group relative flex cursor-grab flex-col gap-1 rounded-xl border bg-card px-2.5 py-2 shadow-xs transition-all hover:-translate-y-px hover:border-foreground/30 hover:shadow-sm active:cursor-grabbing ${
        isCompleted ? 'border-border/40 opacity-60' : overdue ? 'border-q-do-first/40' : 'border-border/80'
      }`}
    >
      <div className="flex items-start gap-2">
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={handleToggle}
          className="focus-ring mt-0.5 shrink-0 rounded-full text-muted-foreground/70 transition-colors hover:text-foreground"
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
          className={`flex-1 break-words text-[13px] leading-snug font-medium select-none ${
            isCompleted ? 'text-muted-foreground line-through' : 'text-foreground'
          }`}
          title={task.content}
        >
          {task.content}
        </p>

        {activeCategory === 'all' && (
          <span className="mt-0.5 flex shrink-0">
            <CategoryMark
              category={task.category}
              onCycle={(next) => setTaskCategory(task.id, next)}
            />
          </span>
        )}

        <ChevronRight className="mt-0.5 size-3 shrink-0 text-muted-foreground/30 transition-colors group-hover:text-muted-foreground" />
      </div>

      {blockedHint ? (
        <p className="pt-0.5 text-[10px] font-medium text-q-do-first">
          Finish its {subtasks.length - doneSubs} open{' '}
          {subtasks.length - doneSubs === 1 ? 'step' : 'steps'} first
        </p>
      ) : (
        <TaskMeta task={task} accentDot={accentDot} />
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
        <span className="break-words text-xs font-semibold text-foreground">{task.content}</span>
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
