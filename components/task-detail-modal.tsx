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
import { Priority, SubTask, Task } from '@/types/matrix';
import { formatFriendlyDate } from '@/lib/nlp-parser';
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

export function TaskDetailModal() {
  const {
    tasks,
    activeModalTaskId,
    closeTaskDetailModal,
    editTaskContent,
    editTaskNotes,
    editTaskExactDate,
    deleteTask,
    addSubtask,
    deleteSubtask,
    editSubtask,
    reorderSubtasks,
  } = useMatrixStore();

  const task = tasks.find((t) => t.id === activeModalTaskId);

  const [title, setTitle] = React.useState('');
  const [isEditingTitle, setIsEditingTitle] = React.useState(false);
  const [showDatePicker, setShowDatePicker] = React.useState(false);
  const [showNotes, setShowNotes] = React.useState(false);
  const [notes, setNotes] = React.useState('');
  const [newSubtask, setNewSubtask] = React.useState('');
  const subtaskInputRef = React.useRef<HTMLInputElement>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  React.useEffect(() => {
    if (task) {
      setTitle(task.content);
      setNotes(task.notes || '');
      setShowNotes(Boolean(task.notes));
      setShowDatePicker(false);
      setIsEditingTitle(false);
      setNewSubtask('');
      setTimeout(() => subtaskInputRef.current?.focus(), 80);
    }
  }, [task]);

  // Handle typing inside modal to focus subtask input if not in title or notes
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        return;
      }
      if (e.key === 'Escape') {
        closeTaskDetailModal();
        return;
      }
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        subtaskInputRef.current?.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [closeTaskDetailModal]);

  if (!task || !activeModalTaskId) return null;

  const subtasks = task.subtasks || [];

  const handleSaveTitle = () => {
    if (title.trim() && title.trim() !== task.content) {
      editTaskContent(task.id, title.trim());
    }
    setIsEditingTitle(false);
  };

  const handleSaveNotes = () => {
    editTaskNotes(task.id, notes);
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

  const toggleHighPriority = (sub: SubTask) => {
    const nextPriority: Priority = sub.priority === 'high' ? 'normal' : 'high';
    editSubtask(task.id, sub.id, { priority: nextPriority });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-background/80 backdrop-blur-sm"
        onClick={closeTaskDetailModal}
      />

      {/* Minimalist Task Card */}
      <div className="relative w-full max-w-lg rounded-2xl border border-border/80 bg-card p-6 shadow-2xl space-y-5">
        {/* Header: Close Button */}
        <div className="flex items-center justify-end">
          <button
            onClick={closeTaskDetailModal}
            className="rounded-lg p-1 text-muted-foreground/60 hover:text-foreground transition-colors"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Task Title (Editable) */}
        <div>
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
                    setTitle(task.content);
                    setIsEditingTitle(false);
                  }
                }}
                className="w-full resize-none rounded-xl border border-border/80 bg-background p-2.5 text-base font-semibold text-foreground focus:outline-none"
              />
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setIsEditingTitle(false)}
                  className="text-xs text-muted-foreground hover:text-foreground px-2 py-0.5"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveTitle}
                  className="rounded-lg bg-foreground px-3 py-1 text-xs font-semibold text-background"
                >
                  Save
                </button>
              </div>
            </div>
          ) : (
            <div
              onClick={() => setIsEditingTitle(true)}
              className="group flex items-start justify-between gap-2 cursor-text rounded-lg p-1 hover:bg-muted/30 transition-colors"
              title="Click to edit title"
            >
              <h2 className="text-lg font-bold text-foreground leading-snug">
                {task.content}
              </h2>
              <Pencil className="size-3.5 text-muted-foreground/30 group-hover:text-muted-foreground shrink-0 mt-1" />
            </div>
          )}
        </div>

        {/* Minimal Deadline & Date/Time Picker */}
        <div className="relative border-b border-border/40 pb-4">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setShowDatePicker(!showDatePicker)}
              className={`flex items-center gap-2 text-xs font-medium rounded-xl px-3 py-1.5 border transition-all ${
                task.parsedDate
                  ? 'border-foreground/20 bg-muted/60 text-foreground'
                  : 'border-border/60 text-muted-foreground hover:text-foreground hover:border-border'
              }`}
            >
              <CalendarIcon className="size-3.5" />
              <span>{task.parsedDate ? formatFriendlyDate(task.parsedDate) : 'Set Deadline'}</span>
            </button>

            {task.parsedDate && (
              <button
                type="button"
                onClick={() => editTaskExactDate(task.id, null)}
                className="text-xs text-muted-foreground/60 hover:text-rose-500 transition-colors"
              >
                Clear deadline
              </button>
            )}
          </div>

          {/* Calendar Popover */}
          {showDatePicker && (
            <div className="absolute left-0 top-full mt-2 z-20 w-72 rounded-2xl border border-border/80 bg-card p-3.5 shadow-2xl card-depth">
              <CalendarPicker
                initialDate={task.parsedDate ? new Date(task.parsedDate) : new Date()}
                onSelectDate={(newDate) => {
                  editTaskExactDate(task.id, newDate.toISOString());
                  setShowDatePicker(false);
                }}
                onClose={() => setShowDatePicker(false)}
              />
            </div>
          )}
        </div>

        {/* Draggable Subtasks List (Clean, No Complete check, No Normal pills) */}
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs font-semibold text-foreground">
            <span>Subtasks ({subtasks.length})</span>
            {subtasks.length > 1 && (
              <span className="text-[11px] text-muted-foreground/50 font-normal">
                Drag to reorder
              </span>
            )}
          </div>

          {/* Subtask Draggable Context */}
          {subtasks.length > 0 && (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCorners}
              onDragEnd={handleDragEndSubtask}
            >
              <div className="space-y-1 max-h-52 overflow-y-auto pr-1">
                <SortableContext
                  items={subtasks.map((s) => s.id)}
                  strategy={verticalListSortingStrategy}
                >
                  {subtasks.map((sub) => (
                    <DraggableSubtaskItem
                      key={sub.id}
                      sub={sub}
                      onDelete={() => deleteSubtask(task.id, sub.id)}
                      onToggleHighPriority={() => toggleHighPriority(sub)}
                    />
                  ))}
                </SortableContext>
              </div>
            </DndContext>
          )}

          {/* Add Subtask Input */}
          <form onSubmit={handleAddSubtask} className="flex items-center gap-2">
            <input
              ref={subtaskInputRef}
              type="text"
              value={newSubtask}
              onChange={(e) => setNewSubtask(e.target.value)}
              placeholder="+ Add a subtask... (Enter)"
              className="flex-1 rounded-xl border border-border/60 bg-background px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-foreground/30"
            />
            <button
              type="submit"
              disabled={!newSubtask.trim()}
              className="rounded-xl bg-foreground px-3 py-1.5 text-xs font-semibold text-background hover:opacity-90 disabled:opacity-30 transition-opacity"
            >
              Add
            </button>
          </form>
        </div>

        {/* Notes (Button Toggle reveal) */}
        <div className="border-t border-border/40 pt-3 space-y-2">
          <button
            type="button"
            onClick={() => setShowNotes(!showNotes)}
            className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <FileText className="size-3.5" />
            <span>{showNotes ? 'Hide notes' : task.notes ? 'View Notes (Saved)' : '+ Add notes'}</span>
          </button>

          {showNotes && (
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onBlur={handleSaveNotes}
              placeholder="Add markdown notes, links, or instructions..."
              className="w-full rounded-xl border border-border/60 bg-background p-2.5 text-xs text-foreground placeholder:text-muted-foreground/40 focus:outline-none leading-relaxed"
            />
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between border-t border-border/40 pt-3">
          <button
            onClick={() => {
              deleteTask(task.id);
              closeTaskDetailModal();
            }}
            className="flex items-center gap-1 text-xs text-rose-500/80 hover:text-rose-500 font-medium transition-colors"
          >
            <Trash2 className="size-3.5" />
            <span>Delete Task</span>
          </button>

          <button
            onClick={closeTaskDetailModal}
            className="rounded-xl bg-foreground px-5 py-1.5 text-xs font-semibold text-background hover:opacity-90 transition-opacity"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

/* ──────── Draggable Subtask Item Component (Clean Line Item) ──────── */

function DraggableSubtaskItem({
  sub,
  onDelete,
  onToggleHighPriority,
}: {
  sub: SubTask;
  onDelete: () => void;
  onToggleHighPriority: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
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
      className="group flex items-center gap-2 rounded-xl border border-border/50 bg-background px-2.5 py-1.5 text-xs transition-all hover:border-foreground/30"
    >
      {/* Drag handle */}
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab opacity-0 group-hover:opacity-40 hover:!opacity-80 active:cursor-grabbing text-muted-foreground p-0.5"
        title="Drag to reorder"
      >
        <GripVertical className="size-3" />
      </button>

      {/* Subtask Text */}
      <span className="flex-1 truncate font-medium text-foreground">
        {sub.content}
      </span>

      {/* High Priority Flame Toggle */}
      <button
        type="button"
        onClick={onToggleHighPriority}
        className={`p-1 rounded transition-colors ${
          isHigh
            ? 'text-rose-500'
            : 'text-muted-foreground/30 opacity-0 group-hover:opacity-100 hover:text-foreground'
        }`}
        title={isHigh ? 'High priority' : 'Mark high priority'}
      >
        <Flame className="size-3" fill={isHigh ? 'currentColor' : 'none'} />
      </button>

      {/* Delete button */}
      <button
        type="button"
        onClick={onDelete}
        className="p-1 text-muted-foreground/30 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity"
        title="Delete subtask"
      >
        <X className="size-3" />
      </button>
    </div>
  );
}

/* ──────── Clean Interactive Calendar & Time Picker ──────── */

function CalendarPicker({
  initialDate,
  onSelectDate,
  onClose,
}: {
  initialDate: Date;
  onSelectDate: (date: Date) => void;
  onClose: () => void;
}) {
  const [currentMonth, setCurrentMonth] = React.useState(startOfMonth(initialDate));
  const [selectedDay, setSelectedDay] = React.useState(initialDate);
  const [selectedHour, setSelectedHour] = React.useState(format(initialDate, 'h'));
  const [selectedMinute, setSelectedMinute] = React.useState(format(initialDate, 'mm'));
  const [selectedPeriod, setSelectedPeriod] = React.useState<'AM' | 'PM'>(
    format(initialDate, 'a') as 'AM' | 'PM'
  );

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart);
  const endDate = endOfWeek(monthEnd);
  const days = eachDayOfInterval({ start: startDate, end: endDate });

  const handleApply = () => {
    let hours = parseInt(selectedHour, 10);
    if (selectedPeriod === 'PM' && hours < 12) hours += 12;
    if (selectedPeriod === 'AM' && hours === 12) hours = 0;

    const finalDate = new Date(selectedDay);
    finalDate.setHours(hours);
    finalDate.setMinutes(parseInt(selectedMinute, 10));
    finalDate.setSeconds(0);
    onSelectDate(finalDate);
  };

  return (
    <div className="space-y-3">
      {/* Month Navigation */}
      <div className="flex items-center justify-between text-xs font-semibold text-foreground px-1">
        <span>{format(currentMonth, 'MMMM yyyy')}</span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
            className="p-1 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
            className="p-1 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground"
          >
            <ChevronRight className="size-3.5" />
          </button>
        </div>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-semibold text-muted-foreground/60">
        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => (
          <div key={d}>{d}</div>
        ))}
      </div>

      {/* Calendar Days */}
      <div className="grid grid-cols-7 gap-1">
        {days.map((day) => {
          const isSelected = isSameDay(day, selectedDay);
          const isCurrentMonth = isSameMonth(day, currentMonth);

          return (
            <button
              key={day.toISOString()}
              type="button"
              onClick={() => setSelectedDay(day)}
              className={`size-7 rounded-lg text-xs font-medium transition-all ${
                isSelected
                  ? 'bg-foreground text-background font-bold'
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

      {/* Time Picker Controls */}
      <div className="border-t border-border/40 pt-2.5 flex items-center justify-between text-xs">
        <div className="flex items-center gap-1">
          <Clock className="size-3 text-muted-foreground" />
          {/* Hour Select */}
          <select
            value={selectedHour}
            onChange={(e) => setSelectedHour(e.target.value)}
            className="bg-muted rounded-md px-1 py-0.5 text-xs text-foreground focus:outline-none"
          >
            {Array.from({ length: 12 }, (_, i) => i + 1).map((h) => (
              <option key={h} value={String(h)}>
                {h}
              </option>
            ))}
          </select>
          <span>:</span>
          {/* Minute Select */}
          <select
            value={selectedMinute}
            onChange={(e) => setSelectedMinute(e.target.value)}
            className="bg-muted rounded-md px-1 py-0.5 text-xs text-foreground focus:outline-none"
          >
            {['00', '15', '30', '45'].map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
          {/* AM / PM Toggle */}
          <button
            type="button"
            onClick={() => setSelectedPeriod(selectedPeriod === 'AM' ? 'PM' : 'AM')}
            className="bg-muted rounded-md px-1.5 py-0.5 text-xs font-semibold text-foreground hover:bg-muted/80"
          >
            {selectedPeriod}
          </button>
        </div>

        <button
          type="button"
          onClick={handleApply}
          className="rounded-lg bg-foreground px-2.5 py-1 text-xs font-semibold text-background hover:opacity-90"
        >
          Apply
        </button>
      </div>
    </div>
  );
}
