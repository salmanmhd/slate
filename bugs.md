# Identified Bugs & Edge Cases

## Bug 1: Escape Key Bubble Closes Modal During Title/Notes Inline Edit
- **Severity**: Low / UX
- **Location**: `components/task-detail-modal.tsx`
- **Description**: When editing the task title or typing inside the notes textarea within the Task Detail Modal, pressing `Escape` cancels the title editing mode, but the keydown event simultaneously bubbles up to the modal window listener, closing the entire modal unexpectedly.
- **Steps to Reproduce**:
  1. Open any task in Decide mode to open the Task Detail Modal.
  2. Click on the title to enter edit mode.
  3. Press `Escape` to cancel title editing.
  4. Notice the whole modal closes instead of just exiting title edit mode.
- **Proposed Fix**: Add `e.stopPropagation()` in the title and notes textarea `onKeyDown` handlers when `e.key === 'Escape'`.

---

## Bug 2: Focus Mode Subtask Ordering vs Manual Drag Reorder
- **Severity**: Medium / Logic
- **Location**: `components/views/focus-view.tsx`
- **Description**: In the Task Detail Modal, subtasks can be manually reordered via drag-and-drop. However, in Focus Mode, `sortedIncomplete` sorts subtasks strictly by `PRIORITY_META.sortWeight` without preserving the user's manual reordered index when priorities are the same (`normal`).
- **Steps to Reproduce**:
  1. Add 3 subtasks with normal priority: "Step A", "Step B", "Step C".
  2. Drag "Step C" to the top in the task modal.
  3. Switch to Focus mode (press `3`).
  4. Notice the active step spotlight may still pick "Step A" if array order is overridden by sort comparisons.
- **Proposed Fix**: Ensure secondary sorting in Focus Mode preserves the subtask array index (`task.subtasks.indexOf(...)`) when priority weights are identical.

---

## Bug 3: `type-to-capture` Triggering on Browser Shortcut Combinations
- **Severity**: Low
- **Location**: `components/header.tsx`
- **Description**: While `e.ctrlKey`, `e.metaKey`, and `e.altKey` are checked, certain functional keys or browser input sequences (like dead keys or accented composition) might register `e.key.length === 1` and prematurely trigger capture mode redirection.
- **Proposed Fix**: Guard against input composition (`e.isComposing`) and ensure active element verification is strict.
