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
import { Priority, SubTask, Task, TaskStatus } from '@/types/matrix';
import { formatFriendlyDate } from '@/lib/nlp-parser';
import {
  Calendar,
  Check,
  X,
  Circle,
  AlertCircle,
  Plus,
  Flame,
  Clock,
  UserCheck,
  Trash2,
  ListTodo,
  FileText,
  ChevronRight,
} from 'lucide-react';

const QUADRANT_META: Record<
  TaskStatus,
  {
    title: string;
    subtitle: string;
    icon: React.ReactNode;
  }
> = {
  inbox: {
    title: 'Inbox',
    subtitle: 'Unsorted stream',
    icon: <ListTodo className="size-3.5 text-muted-foreground" />,
  },
  do_first: {
    title: 'Do First',
    subtitle: 'Urgent & Important',
    icon: <Flame className="size-3.5 text-foreground/80" />,
  },
  schedule: {
    title: 'Schedule',
    subtitle: 'Important, Not Urgent',
    icon: <Clock className="size-3.5 text-foreground/80" />,
  },
  delegate: {
    title: 'Delegate',
    subtitle: 'Urgent, Not Important',
    icon: <UserCheck className="size-3.5 text-foreground/80" />,
  },
  eliminate: {
    title: 'Eliminate',
    subtitle: 'Neither',
    icon: <Trash2 className="size-3.5 text-foreground/80" />,
  },
};

export function DecideView() {
  const { tasks, moveTask, reorderTasks, addTask } = useMatrixStore();
  const [activeTask, setActiveTask] = React.useState<Task | null>(null);
  const [inboxInput, setInboxInput] = React.useState('');

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const inboxTasks = tasks.filter((t) => t.status === 'inbox' && t.completionState !== 'completed');
  const doFirstTasks = tasks.filter((t) => t.status === 'do_first' && t.completionState !== 'completed');
  const scheduleTasks = tasks.filter((t) => t.status === 'schedule' && t.completionState !== 'completed');
  const delegateTasks = tasks.filter((t) => t.status === 'delegate' && t.completionState !== 'completed');
  const eliminateTasks = tasks.filter((t) => t.status === 'eliminate' && t.completionState !== 'completed');

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
    const activeTk = tasks.find((t) => t.id === activeId);
    if (!activeTk) return;

    const statuses: TaskStatus[] = ['inbox', 'do_first', 'schedule', 'delegate', 'eliminate'];
    if (statuses.includes(overId as TaskStatus)) {
      if (activeTk.status !== overId) moveTask(activeId, overId as TaskStatus);
      return;
    }

    const overTk = tasks.find((t) => t.id === overId);
    if (overTk) {
      if (activeTk.status === overTk.status) {
        reorderTasks(activeId, overId, activeTk.status);
      } else {
        moveTask(activeId, overTk.status);
      }
    }
  };

  const handleQuickAddInbox = (e: React.FormEvent) => {
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
      <div className="flex h-[calc(100vh-4.75rem)] w-full flex-col gap-2">
        {/* Top Summary Bar */}
        <div className="flex shrink-0 items-center justify-between border-b border-border/60 pb-1.5 px-1">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold tracking-tight text-foreground">
              Eisenhower Matrix
            </h2>
            <span className="text-xs text-muted-foreground/60 hidden sm:inline">
              — Click any task to edit details & subtasks
            </span>
          </div>
          <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
            <span>Do First ({doFirstTasks.length})</span>
            <span>Schedule ({scheduleTasks.length})</span>
            <span>Delegate ({delegateTasks.length})</span>
            <span>Eliminate ({eliminateTasks.length})</span>
          </div>
        </div>

        {/* Workspace Layout */}
        <div className="flex-1 min-h-0 grid grid-cols-1 gap-4 lg:grid-cols-12">
          {/* Left: Inbox Stream (4 cols) */}
          <div className="lg:col-span-4 h-full min-h-0 flex flex-col rounded-2xl border border-border/80 bg-card p-3 shadow-xs card-depth">
            <div className="mb-2 flex shrink-0 items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="flex size-5 items-center justify-center rounded-md bg-muted text-muted-foreground">
                  <ListTodo className="size-3" />
                </span>
                <h3 className="text-xs font-semibold text-foreground">Inbox Stream</h3>
              </div>
              <span className="rounded-full bg-muted px-2 py-0.2 text-[10px] font-semibold text-muted-foreground">
                {inboxTasks.length}
              </span>
            </div>

            {/* Quick inline capture */}
            <form onSubmit={handleQuickAddInbox} className="mb-2 shrink-0">
              <div className="relative">
                <input
                  type="text"
                  value={inboxInput}
                  onChange={(e) => setInboxInput(e.target.value)}
                  placeholder="Quick add to inbox... (Enter)"
                  className="w-full rounded-xl border border-border/80 bg-background px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground/50 focus:border-foreground/30 focus:outline-none"
                />
                <button
                  type="submit"
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-0.5 text-muted-foreground/60 hover:text-foreground"
                  title="Add"
                >
                  <Plus className="size-3.5" />
                </button>
              </div>
            </form>

            <InboxDroppableSection tasks={inboxTasks} />
          </div>

          {/* Right: Matrix with Subtle Axis Labels (8 cols) */}
          <div className="lg:col-span-8 h-full min-h-0 flex flex-col">
            {/* Top Horizontal Axis: Subtle URGENT / NOT URGENT labels */}
            <div className="grid grid-cols-2 gap-3 shrink-0 mb-1 px-2">
              <div className="text-center text-[10px] font-semibold tracking-widest text-muted-foreground/70 uppercase">
                URGENT
              </div>
              <div className="text-center text-[10px] font-semibold tracking-widest text-muted-foreground/70 uppercase">
                NOT URGENT
              </div>
            </div>

            {/* 2x2 Matrix with Subtle Left/Row Axis Labels */}
            <div className="flex-1 min-h-0 grid grid-cols-2 grid-rows-2 gap-3">
              {/* Row 1: IMPORTANT */}
              <MatrixQuadrantContainer
                status="do_first"
                tasks={doFirstTasks}
                axisLabel="IMPORTANT"
              />
              <MatrixQuadrantContainer
                status="schedule"
                tasks={scheduleTasks}
                axisLabel="IMPORTANT"
              />

              {/* Row 2: NOT IMPORTANT */}
              <MatrixQuadrantContainer
                status="delegate"
                tasks={delegateTasks}
                axisLabel="NOT IMPORTANT"
              />
              <MatrixQuadrantContainer
                status="eliminate"
                tasks={eliminateTasks}
                axisLabel="NOT IMPORTANT"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Smooth Drag Overlay */}
      <DragOverlay dropAnimation={{ duration: 180, easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)' }}>
        {activeTask && <DraggableTaskOverlayCard task={activeTask} />}
      </DragOverlay>
    </DndContext>
  );
}

/* ──────── Inbox Droppable Section ──────── */

function InboxDroppableSection({ tasks }: { tasks: Task[] }) {
  const { setNodeRef, isOver } = useDroppable({
    id: 'inbox',
    data: { type: 'quadrant', status: 'inbox' },
  });

  return (
    <div
      ref={setNodeRef}
      className={`flex-1 min-h-0 overflow-y-auto space-y-1.5 rounded-xl border p-2 transition-all ${
        isOver
          ? 'border-foreground/30 bg-muted/40 ring-2 ring-foreground/10'
          : 'border-border/50 bg-background/40'
      }`}
    >
      <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
        {tasks.map((task) => (
          <DecideTaskCard key={task.id} task={task} />
        ))}
      </SortableContext>

      {tasks.length === 0 && (
        <div className="flex h-full min-h-[160px] flex-col items-center justify-center rounded-lg border border-dashed border-border/40 text-center px-4">
          <ListTodo className="size-5 text-muted-foreground/30 mb-1.5" />
          <p className="text-xs font-medium text-muted-foreground">Inbox is clear</p>
          <p className="text-[10px] text-muted-foreground/50 mt-0.5">
            Type above or drag tasks here
          </p>
        </div>
      )}
    </div>
  );
}

/* ──────── Matrix Quadrant Container ──────── */

function MatrixQuadrantContainer({
  status,
  tasks,
  axisLabel,
}: {
  status: TaskStatus;
  tasks: Task[];
  axisLabel: string;
}) {
  const meta = QUADRANT_META[status];
  const { setNodeRef, isOver } = useDroppable({
    id: status,
    data: { type: 'quadrant', status },
  });

  return (
    <div
      ref={setNodeRef}
      className={`flex h-full min-h-0 flex-col rounded-2xl border border-border/80 bg-card p-3 shadow-xs card-depth transition-all ${
        isOver ? 'ring-2 ring-foreground/20 bg-muted/30 border-foreground/30' : ''
      }`}
    >
      {/* Header with subtle importance indicator */}
      <div className="flex shrink-0 items-center justify-between border-b border-border/50 pb-1.5 mb-1.5">
        <div className="flex items-center gap-1.5">
          <span className="flex size-4 items-center justify-center text-foreground/70">
            {meta.icon}
          </span>
          <h3 className="text-xs font-semibold text-foreground tracking-tight">
            {meta.title}
          </h3>
          <span className="text-[10px] text-muted-foreground font-medium">
            ({tasks.length})
          </span>
        </div>

        <span className="text-[9px] font-semibold text-muted-foreground/70 tracking-widest uppercase">
          {axisLabel}
        </span>
      </div>

      {/* Task List (internal scroll) */}
      <div className="flex-1 min-h-0 space-y-1.5 overflow-y-auto pr-0.5">
        <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          {tasks.map((task) => (
            <DecideTaskCard key={task.id} task={task} />
          ))}
        </SortableContext>

        {tasks.length === 0 && (
          <div className="flex h-full min-h-[70px] flex-col items-center justify-center rounded-xl border border-dashed border-border/30 text-center">
            <span className="text-[10px] text-muted-foreground/40 font-medium">Drop here</span>
          </div>
        )}
      </div>
    </div>
  );
}

/* ──────── Decide Task Card (Click to Open Detail Modal) ──────── */

function DecideTaskCard({ task }: { task: Task }) {
  const {
    openTaskDetailModal,
    toggleTaskCompletion,
  } = useMatrixStore();

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: task.id,
    data: { type: 'task', task },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.25 : 1,
  };

  const isCompleted = task.completionState === 'completed';
  const isOverdue = task.parsedDate ? new Date(task.parsedDate).getTime() < Date.now() : false;
  const subtasks = task.subtasks || [];
  const completedSubs = subtasks.filter((s) => s.completed).length;

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    const success = toggleTaskCompletion(task.id);
    if (!success) {
      alert('Complete all subtasks before marking this task done.');
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => openTaskDetailModal(task.id)}
      className={`group relative flex flex-col gap-1 rounded-xl border bg-card px-2.5 py-2 shadow-xs transition-all cursor-grab active:cursor-grabbing hover:border-foreground/30 hover:shadow-sm ${
        isCompleted
          ? 'border-border/40 opacity-60'
          : isOverdue
          ? 'border-rose-500/30'
          : 'border-border/80'
      }`}
    >
      {/* Top row: Checkbox, Title */}
      <div className="flex items-start gap-2">
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={handleToggle}
          className="mt-0.5 shrink-0 text-muted-foreground/40 hover:text-foreground transition-colors"
          title={subtasks.some((s) => !s.completed) ? 'Complete subtasks first' : 'Toggle done'}
        >
          {isCompleted ? (
            <div className="flex size-3.5 items-center justify-center rounded-full bg-foreground text-background">
              <Check className="size-2" strokeWidth={3} />
            </div>
          ) : (
            <Circle className="size-3.5 hover:text-foreground" strokeWidth={1.5} />
          )}
        </button>

        {/* Content */}
        <p
          className={`flex-1 text-xs font-medium leading-snug select-none truncate ${
            isCompleted ? 'line-through text-muted-foreground' : 'text-foreground'
          }`}
          title={task.content}
        >
          {task.content}
        </p>

        <ChevronRight className="size-3 text-muted-foreground/30 group-hover:text-muted-foreground shrink-0 mt-0.5 transition-colors" />
      </div>

      {/* Bottom Metadata Bar */}
      <div className="flex items-center gap-1.5 pt-0.5 text-[10px] text-muted-foreground">
        {task.parsedDate && (
          <span
            className={`inline-flex items-center gap-0.5 rounded px-1 py-0.2 font-medium ${
              isOverdue
                ? 'bg-rose-500/10 text-rose-500'
                : 'bg-muted text-muted-foreground'
            }`}
          >
            {isOverdue ? <AlertCircle className="size-2.5" /> : <Calendar className="size-2.5" />}
            {formatFriendlyDate(task.parsedDate)}
          </span>
        )}
        {subtasks.length > 0 && (
          <span className="rounded bg-muted px-1.5 py-0.2 font-semibold text-muted-foreground">
            {completedSubs}/{subtasks.length} steps
          </span>
        )}
        {task.notes && (
          <span className="flex items-center gap-0.5 text-muted-foreground/70" title="Has notes">
            <FileText className="size-2.5" />
          </span>
        )}
      </div>
    </div>
  );
}

/* ──────── Drag Overlay Preview ──────── */

function DraggableTaskOverlayCard({ task }: { task: Task }) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-foreground/40 bg-card p-3 shadow-2xl ring-2 ring-foreground/20 rotate-1 backdrop-blur-md max-w-sm">
      <div className="flex items-center gap-2">
        <Circle className="size-3.5 text-muted-foreground/50" />
        <span className="text-xs font-semibold text-foreground truncate">{task.content}</span>
      </div>
      {task.parsedDate && (
        <span className="text-[10px] text-muted-foreground flex items-center gap-1">
          <Calendar className="size-2.5" />
          {formatFriendlyDate(task.parsedDate)}
        </span>
      )}
    </div>
  );
}
