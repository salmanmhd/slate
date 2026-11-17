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
import { CopyTaskButton } from '@/components/copy-task-button';
import { InlineText } from '@/components/inline-text';
import { useNow, isOverdue } from '@/hooks/use-now';
import { isDeferred, formatDeferLabel } from '@/lib/defer';
import {
  Calendar,
  Check,
  Circle,
  ChevronRight,
  Target,
  Maximize2,
  Minimize2,
  Moon,
  FileText,
  PanelLeft,
  PanelLeftClose,
} from 'lucide-react';

type Quadrant = Exclude<TaskStatus, 'inbox'>;
const QUADRANT_IDS: TaskStatus[] = ['inbox', 'do_first', 'schedule', 'delegate', 'eliminate'];

export function DecideView() {
  const { tasks, moveTask, reorderTasks, setActiveView, activeCategory, setTaskCategory } =
    useMatrixStore();

  const [activeTask, setActiveTask] = React.useState<Task | null>(null);
  // Decided once, when the page opens: show the inbox only if something is in
  // it. Sorting the last task never makes it vanish underneath you — it stays
  // until the next visit, or until you toggle it yourself.
  const [hideInbox, setHideInbox] = React.useState(
    () => !tasks.some((t) => t.status === 'inbox' && t.completionState !== 'completed')
  );
  const [inboxWidth, setInboxWidth] = useInboxWidth();
  const [split, setSplit] = useMatrixSplit();
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
          <div className="flex min-w-0 flex-1 items-center gap-3">
            {/* Full page / Hide unorganised toggle */}
            <button
              type="button"
              onClick={() => setHideInbox((prev) => !prev)}
              className={`focus-ring relative inline-flex items-center rounded-md p-1.5 transition-colors ${
                hideInbox
                  ? 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
                  : 'bg-muted text-foreground'
              }`}
              title={hideInbox ? 'Show unorganised tasks' : 'Hide unorganised tasks'}
              aria-label={hideInbox ? 'Show unorganised tasks' : 'Hide unorganised tasks'}
              aria-pressed={!hideInbox}
            >
              {hideInbox ? <PanelLeft className="size-4" /> : <PanelLeftClose className="size-4" />}
              {hideInbox && inboxTasks.length > 0 && (
                <span className="absolute top-0.5 right-0.5 size-1.5 rounded-full bg-foreground" />
              )}
            </button>
            <CategorySwitcher />
          </div>

          <div className="flex items-center gap-3">
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

        <div
          className="flex min-h-0 flex-1 flex-col gap-4 lg:flex-row lg:gap-0"
          style={{ '--inbox-w': `${inboxWidth}px` } as React.CSSProperties}
        >
          {/* Inbox — a pile you drag from */}
          {!hideInbox && (
            <>
              <section className="card-depth flex min-h-80 shrink-0 flex-col rounded-2xl border border-border/80 bg-card p-2.5 lg:min-h-0 lg:w-[var(--inbox-w)] animate-fade">
                <div className="mb-2.5 flex shrink-0 items-center justify-between">
                  <h3 className="text-sm font-semibold text-foreground">{INBOX_META.title}</h3>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold tabular-nums text-muted-foreground">
                    {inboxTasks.length}
                  </span>
                </div>

                <InboxList tasks={inboxTasks} />
              </section>

              <InboxResizer width={inboxWidth} onChange={setInboxWidth} />
            </>
          )}

          {/* The matrix, with its axes stated once, or enlarged single quadrant */}
          <section className="flex min-h-120 min-w-0 flex-col lg:min-h-0 lg:flex-1">
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
                    className="focus-ring rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    title="Back to all four quadrants"
                    aria-label="Back to all four quadrants"
                  >
                    <Minimize2 className="size-3.5" />
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
                <div className="grid gap-3" style={{ gridTemplateColumns: `minmax(0, ${split.x}fr) minmax(0, ${100 - split.x}fr)` }}>
                  <AxisLabel>Urgent</AxisLabel>
                  <AxisLabel>Not urgent</AxisLabel>
                </div>

                <div className="grid min-h-0 gap-3" style={{ gridTemplateRows: `minmax(0, ${split.y}fr) minmax(0, ${100 - split.y}fr)` }}>
                  <AxisLabel vertical>Important</AxisLabel>
                  <AxisLabel vertical>Not important</AxisLabel>
                </div>

                <div
                  className="relative grid min-h-0 gap-3"
                  style={{
                    gridTemplateColumns: `minmax(0, ${split.x}fr) minmax(0, ${100 - split.x}fr)`,
                    gridTemplateRows: `minmax(0, ${split.y}fr) minmax(0, ${100 - split.y}fr)`,
                  }}
                >
                  <MatrixResizer split={split} onChange={setSplit} />
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

      <QuickAddModal />

      <DragOverlay dropAnimation={{ duration: 180, easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)' }}>
        {activeTask && <DragPreview task={activeTask} />}
      </DragOverlay>
    </DndContext>
  );
}

/* ──────── Resizable inbox ──────── */

const INBOX_WIDTH_KEY = 'slate:inbox-width';
const INBOX_WIDTH_DEFAULT = 300;
const INBOX_WIDTH_MIN = 220;
const INBOX_WIDTH_MAX = 560;

const clampInboxWidth = (n: number) =>
  Math.min(INBOX_WIDTH_MAX, Math.max(INBOX_WIDTH_MIN, Math.round(n)));

/** The inbox width, kept in this browser only — a layout preference, not account data. */
function useInboxWidth(): [number, (next: number) => void] {
  const [width, setWidth] = React.useState(() => {
    try {
      const saved = Number(window.localStorage.getItem(INBOX_WIDTH_KEY));
      return saved ? clampInboxWidth(saved) : INBOX_WIDTH_DEFAULT;
    } catch {
      return INBOX_WIDTH_DEFAULT;
    }
  });

  const update = React.useCallback((next: number) => {
    const clamped = clampInboxWidth(next);
    setWidth(clamped);
    try {
      window.localStorage.setItem(INBOX_WIDTH_KEY, String(clamped));
    } catch {
      /* private mode — the width just will not persist */
    }
  }, []);

  return [width, update];
}

/** A thin drag handle between the inbox and the matrix. Desktop only. */
function InboxResizer({ width, onChange }: { width: number; onChange: (next: number) => void }) {
  const drag = React.useRef<{ x: number; width: number } | null>(null);

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize unorganised panel"
      aria-valuenow={width}
      aria-valuemin={INBOX_WIDTH_MIN}
      aria-valuemax={INBOX_WIDTH_MAX}
      tabIndex={0}
      title="Drag to resize · double-click to reset"
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        drag.current = { x: e.clientX, width };
      }}
      onPointerMove={(e) => {
        if (drag.current) onChange(drag.current.width + e.clientX - drag.current.x);
      }}
      onPointerUp={() => {
        drag.current = null;
      }}
      onDoubleClick={() => onChange(INBOX_WIDTH_DEFAULT)}
      onKeyDown={(e) => {
        if (e.key === 'ArrowLeft') onChange(width - 16);
        if (e.key === 'ArrowRight') onChange(width + 16);
      }}
      className="group/resize focus-ring hidden w-4 shrink-0 cursor-col-resize touch-none items-center justify-center lg:flex"
    >
      <span className="h-10 w-0.5 rounded-full bg-border/0 transition-colors group-hover/resize:bg-foreground/30 group-focus-visible/resize:bg-foreground/30" />
    </div>
  );
}

/* ──────── Resizable matrix ──────── */

const MATRIX_SPLIT_KEY = 'slate:matrix-split';
const MATRIX_SPLIT_DEFAULT = { x: 50, y: 50 };
const clampSplit = (n: number) => Math.min(80, Math.max(20, Math.round(n)));

/** Where the quadrants meet, as percentages. Kept in this browser only, like the inbox width. */
function useMatrixSplit(): [{ x: number; y: number }, (next: { x: number; y: number }) => void] {
  const [split, setSplit] = React.useState(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem(MATRIX_SPLIT_KEY) ?? 'null');
      return saved && typeof saved.x === 'number' && typeof saved.y === 'number'
        ? { x: clampSplit(saved.x), y: clampSplit(saved.y) }
        : MATRIX_SPLIT_DEFAULT;
    } catch {
      return MATRIX_SPLIT_DEFAULT;
    }
  });

  const update = React.useCallback((next: { x: number; y: number }) => {
    const clamped = { x: clampSplit(next.x), y: clampSplit(next.y) };
    setSplit(clamped);
    try {
      window.localStorage.setItem(MATRIX_SPLIT_KEY, JSON.stringify(clamped));
    } catch {
      /* private mode — the split just will not persist */
    }
  }, []);

  return [split, update];
}

/**
 * One handle where the four quadrants meet. Dragging it moves both the
 * vertical and the horizontal divide at once. Desktop only.
 */
function MatrixResizer({
  split,
  onChange,
}: {
  split: { x: number; y: number };
  onChange: (next: { x: number; y: number }) => void;
}) {
  const dragging = React.useRef(false);

  const fromPointer = (e: React.PointerEvent<HTMLDivElement>) => {
    const grid = e.currentTarget.parentElement?.getBoundingClientRect();
    if (!grid) return;
    onChange({
      x: ((e.clientX - grid.left) / grid.width) * 100,
      y: ((e.clientY - grid.top) / grid.height) * 100,
    });
  };

  return (
    <div
      role="slider"
      aria-label="Resize quadrants"
      aria-valuenow={split.x}
      aria-valuetext={`${split.x}% by ${split.y}%`}
      tabIndex={0}
      title="Drag to resize the quadrants · double-click to reset"
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        dragging.current = true;
      }}
      onPointerMove={(e) => {
        if (dragging.current) fromPointer(e);
      }}
      onPointerUp={() => {
        dragging.current = false;
      }}
      onDoubleClick={() => onChange(MATRIX_SPLIT_DEFAULT)}
      onKeyDown={(e) => {
        if (e.key === 'ArrowLeft') onChange({ ...split, x: split.x - 2 });
        if (e.key === 'ArrowRight') onChange({ ...split, x: split.x + 2 });
        if (e.key === 'ArrowUp') onChange({ ...split, y: split.y - 2 });
        if (e.key === 'ArrowDown') onChange({ ...split, y: split.y + 2 });
      }}
      style={{ left: `${split.x}%`, top: `${split.y}%` }}
      className="group/split focus-ring absolute z-10 hidden size-6 -translate-x-1/2 -translate-y-1/2 cursor-move touch-none items-center justify-center rounded-full lg:flex"
    >
      <span className="size-2 rounded-full bg-border transition-all group-hover/split:size-3 group-hover/split:bg-foreground/40 group-focus-visible/split:bg-foreground/40" />
    </div>
  );
}

/* ──────── Axis labels ──────── */

/**
 * Typing anywhere on Decide opens this: one clean field, Enter adds to
 * Unorganised and keeps it open for the next one, Escape closes. Same parser
 * as Capture, so "call bank fri 3pm" still gets its deadline.
 */
function QuickAddModal() {
  const { quickAddDraft, closeQuickAdd, addTask, activeCategory } = useMatrixStore();
  if (quickAddDraft === null) return null;

  return (
    <QuickAddForm
      initial={quickAddDraft}
      onClose={closeQuickAdd}
      onAdd={(text) =>
        addTask(text, 'inbox', undefined, undefined, activeCategory === 'all' ? undefined : activeCategory)
      }
    />
  );
}

function QuickAddForm({
  initial,
  onClose,
  onAdd,
}: {
  initial: string;
  onClose: () => void;
  onAdd: (text: string) => void;
}) {
  const [value, setValue] = React.useState(initial);
  const [added, setAdded] = React.useState(0);

  const submit = () => {
    if (!value.trim()) return;
    onAdd(value.trim());
    setValue('');
    setAdded((n) => n + 1);
  };

  // No box, no border: just your words in the middle of a faded page.
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
      <div className="fixed inset-0 bg-background/85 backdrop-blur-md" onClick={onClose} />
      <div role="dialog" aria-modal="true" aria-label="Add a task" className="animate-rise relative w-full max-w-2xl text-center">
        <textarea
          autoFocus
          rows={1}
          value={value}
          ref={(el) => {
            if (!el) return;
            el.style.height = 'auto';
            el.style.height = `${el.scrollHeight}px`;
          }}
          onFocus={(e) => {
            const end = e.currentTarget.value.length;
            e.currentTarget.setSelectionRange(end, end);
          }}
          onChange={(e) => setValue(e.target.value.replace(/\n/g, ' '))}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              submit();
            }
            if (e.key === 'Escape') {
              e.stopPropagation();
              onClose();
            }
          }}
          placeholder="Add a task…"
          aria-label="Task"
          className="w-full resize-none overflow-hidden border-0 bg-transparent text-center font-heading text-2xl leading-snug font-semibold text-foreground placeholder:text-muted-foreground/40 focus:outline-none sm:text-3xl"
        />
        <p className="mt-4 text-xs text-muted-foreground">
          {added > 0 ? `${added} added to Unorganised · ` : ''}Enter to add · Esc to close
        </p>
      </div>
    </div>
  );
}

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
      className={`min-h-0 flex-1 overflow-y-auto rounded-xl border p-1 transition-colors ${
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
            className={`focus-ring ml-auto rounded-md p-1 text-muted-foreground/50 opacity-0 transition-opacity group-hover/quadrant:opacity-100 focus-visible:opacity-100 hover:bg-muted hover:text-foreground`}
            title={isEnlarged ? 'Restore 2x2 grid view' : `Enlarge ${meta.title}`}
            aria-label={isEnlarged ? 'Restore 2x2 grid view' : `Enlarge ${meta.title}`}
          >
            {isEnlarged ? <Minimize2 className="size-3.5" /> : <Maximize2 className="size-3.5" />}
          </button>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto pr-0.5">
        <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          {tasks.map((task) => (
            <TaskCard key={task.id} task={task} accentDot={meta.dot} showSteps={isEnlarged} />
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

function TaskCard({
  task,
  accentDot,
  showSteps = false,
}: {
  task: Task;
  accentDot?: string;
  showSteps?: boolean;
}) {
  const {
    openTaskDetailModal,
    toggleTaskCompletion,
    toggleSubtask,
    setTaskCategory,
    activeCategory,
    logs,
  } = useMatrixStore();
  const [blockedHint, setBlockedHint] = React.useState(false);
  const now = useNow();

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
  const overdue = isOverdue(task.parsedDate, now);
  const deferred = isDeferred(task, now);
  const subtasks = task.subtasks || [];
  const doneSubs = subtasks.filter((s) => s.completed).length;
  const hasOpenSteps = doneSubs < subtasks.length;
  const stuckCount = logs.filter((l) => l.taskId === task.id).length;

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!toggleTaskCompletion(task.id)) {
      setBlockedHint(true);
      window.setTimeout(() => setBlockedHint(false), 2200);
    }
  };

  // One line per task: title on the left, the same facts in the same columns
  // on the right, so a full quadrant scans like a list instead of a pile.
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => openTaskDetailModal(task.id)}
      className={`group relative cursor-grab rounded-xl px-2.5 py-2.5 transition-colors hover:bg-muted/40 active:cursor-grabbing ${
        isCompleted ? 'opacity-60' : ''
      }`}
    >
      <div className="flex items-start gap-3">
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
          className={`min-w-0 flex-1 break-words whitespace-pre-wrap leading-relaxed select-none ${
            showSteps ? 'text-[15px]' : 'text-sm'
          } ${isCompleted ? 'text-muted-foreground line-through' : 'text-foreground/90'}`}
          title={task.content}
        >
          {/* A reading column: long tasks wrap into short lines instead of one endless one */}
          <span className="block max-w-3xl">
            <InlineText text={task.content} tone="soft" />
          {stuckCount > 0 && (
            <span
              className="ml-1.5 inline-block size-1.5 rounded-full bg-amber-500 align-middle"
              title={`Stuck ${stuckCount}×`}
              aria-label={`Stuck ${stuckCount} times`}
            />
          )}
          </span>
        </p>

        {task.notes && (
          <FileText className="mt-1 size-3 shrink-0 text-muted-foreground/40" aria-label="Has notes" />
        )}

        {activeCategory === 'all' && (
          <CategoryMark category={task.category} onCycle={(next) => setTaskCategory(task.id, next)} />
        )}

        {subtasks.length > 0 && (
          <span className="mt-0.5 w-8 shrink-0 text-right text-[11px] tabular-nums text-muted-foreground/60">
            {doneSubs}/{subtasks.length}
          </span>
        )}

        {(task.parsedDate || deferred) && (
          <span
            className={`mt-0.5 shrink-0 text-right text-[11px] whitespace-nowrap ${
              overdue ? 'font-semibold text-q-do-first' : 'text-muted-foreground/60'
            }`}
            title={deferred ? 'Hidden from Focus until this time' : undefined}
          >
            {task.parsedDate ? (
              formatFriendlyDate(task.parsedDate)
            ) : (
              <span className="inline-flex items-center gap-0.5">
                <Moon className="size-2.5" />
                {formatDeferLabel(task.deferUntil as string, now)}
              </span>
            )}
          </span>
        )}

        {accentDot && (
          <span
            className={`mt-2 size-1 shrink-0 rounded-full ${accentDot} opacity-0 transition-opacity group-hover:opacity-70`}
            aria-hidden
          />
        )}

        <CopyTaskButton task={task} className="opacity-0 group-hover:opacity-100" />

        <ChevronRight className="mt-1 size-3 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
      </div>

      {/* Enlarged quadrants have the room, so the steps come out of hiding */}
      {showSteps && subtasks.length > 0 && (
        <ul className="mt-2 max-w-3xl space-y-1.5 pl-6.5">
          {subtasks.map((sub) => (
            <li key={sub.id} className="flex items-start gap-1.5">
              <button
                type="button"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  toggleSubtask(task.id, sub.id);
                }}
                className="focus-ring mt-0.5 shrink-0 rounded-full text-muted-foreground/60 transition-colors hover:text-foreground"
                title={sub.completed ? 'Mark as not done' : 'Mark done'}
                aria-label={sub.completed ? 'Mark as not done' : 'Mark done'}
              >
                {sub.completed ? (
                  <span className="flex size-3 items-center justify-center rounded-full bg-foreground text-background">
                    <Check className="size-2" strokeWidth={3} />
                  </span>
                ) : (
                  <Circle className="size-3" strokeWidth={1.5} />
                )}
              </button>
              <span
                className={`min-w-0 flex-1 break-words text-[13px] leading-relaxed select-none ${
                  sub.completed ? 'text-muted-foreground/50 line-through' : 'text-muted-foreground'
                }`}
              >
                <InlineText text={sub.content} tone="soft" />
              </span>
            </li>
          ))}
        </ul>
      )}

      {blockedHint && (
        <p className="pt-0.5 pl-5.5 text-[10px] font-medium text-q-do-first">
          Finish its {subtasks.length - doneSubs} open{' '}
          {subtasks.length - doneSubs === 1 ? 'step' : 'steps'} first
        </p>
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
