'use client';

import React from 'react';
import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCorners,
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
import { QUADRANTS, INBOX_META } from '@/components/quadrants';
import {
  X,
  Calendar as CalendarIcon,
  Clock,
  Trash2,
  FileText,
  Pencil,
  GripVertical,
  ChevronLeft,
  ChevronRight,
  Flame,
  Check,
  Circle,
} from 'lucide-react';
import {
  format,
  addMonths,
  subMonths,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isToday,
} from 'date-fns';

const PLACEMENTS: { status: TaskStatus; label: string; Icon: React.ElementType; text?: string }[] = [
  { status: 'inbox', label: INBOX_META.title, Icon: INBOX_META.Icon },
  ...(['do_first', 'schedule', 'delegate', 'eliminate'] as const).map((s) => ({
    status: s as TaskStatus,
    label: QUADRANTS[s].title,
    Icon: QUADRANTS[s].Icon,
    text: QUADRANTS[s].text,
  })),
];

export function TaskDetailModal() {
  const { tasks, activeModalTaskId } = useMatrixStore();
  const task = tasks.find((t) => t.id === activeModalTaskId);

  if (!task) return null;

  // Keyed on the task so draft title/notes start from that task's values
  // rather than being re-synced by an effect.
  return <TaskDetailContent key={task.id} task={task} />;
}

function TaskDetailContent({ task }: { task: Task }) {
  const {
    closeTaskDetailModal,
    editTaskContent,
    editTaskNotes,
    editTaskExactDate,
    deleteTask,
    moveTask,
    addSubtask,
    toggleSubtask,
    deleteSubtask,
    editSubtask,
    reorderSubtasks,
  } = useMatrixStore();

  const [title, setTitle] = React.useState(task.content);
  const [isEditingTitle, setIsEditingTitle] = React.useState(false);
  const [showDatePicker, setShowDatePicker] = React.useState(false);
  const [showNotes, setShowNotes] = React.useState(Boolean(task.notes));
  const [notes, setNotes] = React.useState(task.notes || '');
  const [newSubtask, setNewSubtask] = React.useState('');
  const subtaskInputRef = React.useRef<HTMLInputElement>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  React.useEffect(() => {
    const id = window.setTimeout(() => subtaskInputRef.current?.focus(), 80);
    return () => window.clearTimeout(id);
  }, []);

  // Typing anywhere in the modal goes to the subtask field — adding steps is
  // the main thing you come here to do.
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target || target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        return;
      }
      if (e.key === 'Escape') {
        closeTaskDetailModal();
        return;
      }
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey && !e.isComposing) {
        subtaskInputRef.current?.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [closeTaskDetailModal]);

  const subtasks = task.subtasks || [];
  const doneCount = subtasks.filter((s) => s.completed).length;

  const handleSaveTitle = () => {
    if (title.trim() && title.trim() !== task.content) {
      editTaskContent(task.id, title.trim());
    }
    setIsEditingTitle(false);
  };

  const handleAddSubtask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubtask.trim()) return;
    addSubtask(task.id, newSubtask.trim(), 'normal');
    setNewSubtask('');
  };

  const handleDragEndSubtask = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIndex = subtasks.findIndex((s) => s.id === active.id);
    const newIndex = subtasks.findIndex((s) => s.id === over.id);
    if (oldIndex !== -1 && newIndex !== -1) {
      reorderSubtasks(task.id, oldIndex, newIndex);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="fixed inset-0 bg-background/80 backdrop-blur-sm"
        onClick={closeTaskDetailModal}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Task details"
        className="animate-rise relative flex max-h-[88vh] w-full max-w-lg flex-col overflow-y-auto rounded-2xl border border-border/80 bg-card p-5 shadow-2xl"
      >
        {/* Where this task lives — the current one is named, the rest are one click away */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-0.5">
            {PLACEMENTS.map(({ status, label, Icon, text }) => {
              const isCurrent = task.status === status;
              return (
                <button
                  key={status}
                  onClick={() => moveTask(task.id, status)}
                  aria-pressed={isCurrent}
                  className={`focus-ring flex items-center gap-1.5 rounded-lg px-1.5 py-1 transition-colors ${
                    isCurrent
                      ? 'bg-muted text-foreground'
                      : 'text-muted-foreground/40 hover:bg-muted/50 hover:text-foreground'
                  }`}
                  title={`${label} — ${status === 'inbox' ? INBOX_META.hint : QUADRANTS[status as Exclude<TaskStatus, 'inbox'>].hint}`}
                  aria-label={label}
                >
                  <Icon className={`size-3.5 ${isCurrent && text ? text : ''}`} />
                  {isCurrent && <span className="text-[11px] font-semibold">{label}</span>}
                </button>
              );
            })}
          </div>

          <button
            onClick={closeTaskDetailModal}
            className="focus-ring shrink-0 rounded-lg p-1 text-muted-foreground/60 transition-colors hover:text-foreground"
            aria-label="Close"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Title */}
        <div className="mt-3">
          {isEditingTitle ? (
            <div className="space-y-2">
              <textarea
                autoFocus
                rows={2}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSaveTitle();
                  }
                  if (e.key === 'Escape') {
                    e.stopPropagation();
                    setTitle(task.content);
                    setIsEditingTitle(false);
                  }
                }}
                className="w-full resize-none rounded-xl border border-border/80 bg-background p-2.5 text-base font-semibold text-foreground focus:border-foreground/30 focus:outline-none"
              />
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => {
                    setTitle(task.content);
                    setIsEditingTitle(false);
                  }}
                  className="focus-ring rounded-md px-2 py-0.5 text-xs text-muted-foreground hover:text-foreground"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveTitle}
                  className="focus-ring rounded-lg bg-foreground px-3 py-1 text-xs font-semibold text-background"
                >
                  Save
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setIsEditingTitle(true)}
              className="focus-ring group flex w-full cursor-text items-start justify-between gap-2 rounded-lg p-1 text-left transition-colors hover:bg-muted/30"
              title="Click to edit"
            >
              <h2 className="font-heading text-lg leading-snug font-semibold text-foreground">
                {task.content}
              </h2>
              <Pencil className="mt-1 size-3.5 shrink-0 text-muted-foreground/30 transition-colors group-hover:text-muted-foreground" />
            </button>
          )}
        </div>

        {/* Deadline. The calendar expands inline — a floating popover would be
            clipped by this dialog's own scroll container. */}
        <div className="mt-4 border-b border-border/50 pb-4">
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setShowDatePicker(!showDatePicker)}
              aria-expanded={showDatePicker}
              className={`focus-ring flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs font-medium transition-colors ${
                task.parsedDate
                  ? 'border-foreground/20 bg-muted/60 text-foreground'
                  : 'border-border/60 text-muted-foreground hover:border-border hover:text-foreground'
              }`}
            >
              <CalendarIcon className="size-3.5" />
              {task.parsedDate ? formatFriendlyDate(task.parsedDate) : 'Deadline'}
            </button>

            {task.parsedDate && (
              <button
                type="button"
                onClick={() => editTaskExactDate(task.id, null)}
                className="focus-ring rounded-md text-xs text-muted-foreground/60 transition-colors hover:text-destructive"
              >
                Clear
              </button>
            )}
          </div>

          {showDatePicker && (
            <div className="mt-3 rounded-2xl border border-border/70 bg-background p-3.5">
              <CalendarPicker
                initialDate={task.parsedDate ? new Date(task.parsedDate) : new Date()}
                onSelectDate={(newDate) => {
                  editTaskExactDate(task.id, newDate.toISOString());
                  setShowDatePicker(false);
                }}
                onCancel={() => setShowDatePicker(false)}
              />
            </div>
          )}
        </div>

        {/* Steps */}
        <div className="mt-4 space-y-2.5">
          <div className="flex items-center gap-3">
            <span className="shrink-0 text-xs font-semibold text-foreground">Steps</span>
            {subtasks.length > 0 && (
              <>
                <div className="h-1 flex-1 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-foreground/70 transition-all duration-500"
                    style={{ width: `${Math.round((doneCount / subtasks.length) * 100)}%` }}
                  />
                </div>
                <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                  {doneCount}/{subtasks.length}
                </span>
              </>
            )}
          </div>

          {subtasks.length > 0 && (
            <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={handleDragEndSubtask}>
              <div className="max-h-52 space-y-1 overflow-y-auto pr-1">
                <SortableContext items={subtasks.map((s) => s.id)} strategy={verticalListSortingStrategy}>
                  {subtasks.map((sub) => (
                    <SubtaskRow
                      key={sub.id}
                      sub={sub}
                      onToggle={() => toggleSubtask(task.id, sub.id)}
                      onDelete={() => deleteSubtask(task.id, sub.id)}
                      onTogglePriority={() =>
                        editSubtask(task.id, sub.id, {
                          priority: (sub.priority === 'high' ? 'normal' : 'high') as Priority,
                        })
                      }
                    />
                  ))}
                </SortableContext>
              </div>
            </DndContext>
          )}

          <form onSubmit={handleAddSubtask} className="flex items-center gap-2">
            <input
              ref={subtaskInputRef}
              type="text"
              value={newSubtask}
              onChange={(e) => setNewSubtask(e.target.value)}
              placeholder="Add a step…"
              className="flex-1 rounded-xl border border-border/60 bg-background px-3 py-1.5 text-xs text-foreground transition-colors placeholder:text-muted-foreground/40 focus:border-foreground/30 focus:outline-none"
              autoComplete="off"
            />
            <button
              type="submit"
              disabled={!newSubtask.trim()}
              className="focus-ring rounded-xl bg-foreground px-3 py-1.5 text-xs font-semibold text-background transition-opacity hover:opacity-90 disabled:opacity-30"
            >
              Add
            </button>
          </form>
        </div>

        {/* Notes */}
        <div className="mt-4 space-y-2 border-t border-border/50 pt-3">
          <button
            type="button"
            onClick={() => setShowNotes(!showNotes)}
            className="focus-ring flex items-center gap-1.5 rounded-md text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <FileText className="size-3.5" />
            {showNotes ? 'Hide notes' : task.notes ? 'Notes' : 'Add notes'}
          </button>

          {showNotes && (
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onBlur={() => editTaskNotes(task.id, notes)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  e.stopPropagation();
                  e.currentTarget.blur();
                }
              }}
              placeholder="Notes"
              className="w-full resize-none rounded-xl border border-border/60 bg-background p-2.5 text-xs leading-relaxed text-foreground transition-colors placeholder:text-muted-foreground/40 focus:border-foreground/30 focus:outline-none"
            />
          )}
        </div>

        {/* Footer */}
        <div className="mt-4 flex items-center justify-between border-t border-border/50 pt-3">
          <button
            onClick={() => {
              deleteTask(task.id);
              closeTaskDetailModal();
            }}
            className="focus-ring flex items-center gap-1 rounded-md text-xs font-medium text-destructive/80 transition-colors hover:text-destructive"
          >
            <Trash2 className="size-3.5" />
            Delete
          </button>

          <button
            onClick={closeTaskDetailModal}
            className="focus-ring rounded-xl bg-foreground px-5 py-1.5 text-xs font-semibold text-background transition-opacity hover:opacity-90"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

/* ──────── Subtask row ──────── */

function SubtaskRow({
  sub,
  onToggle,
  onDelete,
  onTogglePriority,
}: {
  sub: SubTask;
  onToggle: () => void;
  onDelete: () => void;
  onTogglePriority: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: sub.id,
    data: { type: 'subtask', sub },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.25 : 1,
  };

  const isHigh = sub.priority === 'high';

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="group flex items-center gap-1.5 rounded-xl border border-border/50 bg-background px-2 py-1.5 text-xs transition-colors hover:border-foreground/30"
    >
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab p-0.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-40 hover:opacity-80! active:cursor-grabbing"
        title="Drag to reorder"
        aria-label="Reorder step"
      >
        <GripVertical className="size-3" />
      </button>

      <button
        onClick={onToggle}
        className="focus-ring shrink-0 rounded-full text-muted-foreground/50 transition-colors hover:text-foreground"
        title={sub.completed ? 'Mark as not done' : 'Mark done'}
        aria-label={sub.completed ? 'Mark as not done' : 'Mark done'}
      >
        {sub.completed ? (
          <span className="flex size-3.5 items-center justify-center rounded-full bg-foreground text-background">
            <Check className="size-2" strokeWidth={3} />
          </span>
        ) : (
          <Circle className="size-3.5" strokeWidth={1.5} />
        )}
      </button>

      <span
        className={`flex-1 truncate font-medium ${
          sub.completed ? 'text-muted-foreground/50 line-through' : 'text-foreground'
        }`}
      >
        {sub.content}
      </span>

      <button
        type="button"
        onClick={onTogglePriority}
        className={`focus-ring rounded p-1 transition-colors ${
          isHigh
            ? 'text-q-do-first'
            : 'text-muted-foreground/30 opacity-0 group-hover:opacity-100 hover:text-foreground'
        }`}
        title={isHigh ? 'High priority — do this step first' : 'Mark high priority'}
        aria-label="Toggle high priority"
      >
        <Flame className="size-3" fill={isHigh ? 'currentColor' : 'none'} />
      </button>

      <button
        type="button"
        onClick={onDelete}
        className="focus-ring rounded p-1 text-muted-foreground/30 opacity-0 transition-opacity group-hover:opacity-100 hover:text-destructive"
        title="Delete step"
        aria-label="Delete step"
      >
        <X className="size-3" />
      </button>
    </div>
  );
}

/* ──────── Calendar & time picker ──────── */

function CalendarPicker({
  initialDate,
  onSelectDate,
  onCancel,
}: {
  initialDate: Date;
  onSelectDate: (date: Date) => void;
  onCancel: () => void;
}) {
  const [currentMonth, setCurrentMonth] = React.useState(startOfMonth(initialDate));
  const [selectedDay, setSelectedDay] = React.useState(initialDate);
  const [selectedHour, setSelectedHour] = React.useState(format(initialDate, 'h'));
  const [selectedMinute, setSelectedMinute] = React.useState(
    ['00', '15', '30', '45'].includes(format(initialDate, 'mm')) ? format(initialDate, 'mm') : '00'
  );
  const [selectedPeriod, setSelectedPeriod] = React.useState<'AM' | 'PM'>(
    format(initialDate, 'a').toUpperCase() as 'AM' | 'PM'
  );

  const monthStart = startOfMonth(currentMonth);
  const days = eachDayOfInterval({
    start: startOfWeek(monthStart),
    end: endOfWeek(endOfMonth(monthStart)),
  });

  const handleApply = () => {
    let hours = parseInt(selectedHour, 10);
    if (selectedPeriod === 'PM' && hours < 12) hours += 12;
    if (selectedPeriod === 'AM' && hours === 12) hours = 0;

    const finalDate = new Date(selectedDay);
    finalDate.setHours(hours, parseInt(selectedMinute, 10), 0, 0);
    onSelectDate(finalDate);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between px-1 text-xs font-semibold text-foreground">
        <span>{format(currentMonth, 'MMMM yyyy')}</span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
            className="focus-ring rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Previous month"
          >
            <ChevronLeft className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
            className="focus-ring rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Next month"
          >
            <ChevronRight className="size-3.5" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-semibold text-muted-foreground/60">
        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => (
          <div key={d}>{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {days.map((day) => {
          const isSelected = isSameDay(day, selectedDay);
          const isCurrentMonth = isSameMonth(day, currentMonth);

          return (
            <button
              key={day.toISOString()}
              type="button"
              onClick={() => setSelectedDay(day)}
              className={`focus-ring size-7 rounded-lg text-xs font-medium transition-colors ${
                isSelected
                  ? 'bg-foreground font-bold text-background'
                  : isToday(day)
                    ? 'border border-foreground/30 text-foreground'
                    : isCurrentMonth
                      ? 'text-foreground/90 hover:bg-muted'
                      : 'text-muted-foreground/30 hover:bg-muted/40'
              }`}
            >
              {format(day, 'd')}
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-between border-t border-border/50 pt-2.5 text-xs">
        <div className="flex items-center gap-1">
          <Clock className="size-3 text-muted-foreground" />
          <select
            value={selectedHour}
            onChange={(e) => setSelectedHour(e.target.value)}
            aria-label="Hour"
            className="rounded-md bg-muted px-1 py-0.5 text-xs text-foreground focus:outline-none"
          >
            {Array.from({ length: 12 }, (_, i) => i + 1).map((h) => (
              <option key={h} value={String(h)}>
                {h}
              </option>
            ))}
          </select>
          <span>:</span>
          <select
            value={selectedMinute}
            onChange={(e) => setSelectedMinute(e.target.value)}
            aria-label="Minute"
            className="rounded-md bg-muted px-1 py-0.5 text-xs text-foreground focus:outline-none"
          >
            {['00', '15', '30', '45'].map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setSelectedPeriod(selectedPeriod === 'AM' ? 'PM' : 'AM')}
            className="focus-ring rounded-md bg-muted px-1.5 py-0.5 text-xs font-semibold text-foreground hover:bg-muted/80"
          >
            {selectedPeriod}
          </button>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onCancel}
            className="focus-ring rounded-lg px-2 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleApply}
            className="focus-ring rounded-lg bg-foreground px-2.5 py-1 text-xs font-semibold text-background hover:opacity-90"
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}
