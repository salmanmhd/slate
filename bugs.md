# Bug log

## Resolved

### 1. Escape during inline edit could close the whole modal
- **Location**: `components/task-detail-modal.tsx`
- **Fix**: the title textarea and the notes textarea both call `e.stopPropagation()` on
  `Escape`, so the key cancels the edit (or blurs the field, saving notes) without reaching
  the window listener that closes the modal.

### 2. Focus mode ignored the manual subtask order
- **Location**: `components/views/focus-view.tsx`
- **Fix**: `orderSteps()` sorts by priority weight with the original array index as the
  tiebreaker, so steps of equal priority keep exactly the order you dragged them into, and
  only a step explicitly flagged high priority jumps the queue.

### 3. Type-to-capture fired on IME composition
- **Location**: `components/header.tsx`
- **Fix**: the handler bails on `e.isComposing` and on the `Process` key, alongside the
  existing modifier and editable-target guards.

### 4. Hidden `d` hotkey collided with typing
- **Location**: `components/theme-provider.tsx`
- **Fix**: an undocumented global `d` shortcut toggled the theme, and its listener ran
  before the capture handler — so typing a word containing "d" flipped the theme mid-capture.
  Removed; the header button is the only theme control.

### 5. `alert()` on completing a task with open steps
- **Location**: `components/views/decide-view.tsx`
- **Fix**: replaced with a transient inline message on the card naming how many steps are
  still open.
