/**
 * Splits bulk task input by newlines and/or semicolons.
 * Handles:
 *  - Semicolon-separated tasks: "task 1; task 2; task 3;"
 *  - Newline-separated tasks
 *  - Mixed newlines with trailing semicolons
 *  - Strips leading bullet points (- , * , 1. , [ ] )
 *  - Filters out empty entries
 */
export function extractBulkTasks(input: string): string[] {
  if (!input || !input.trim()) return [];

  const lines = input.split(/\r?\n/);
  const tasks: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (trimmed.includes(';')) {
      const parts = trimmed.split(';');
      for (const part of parts) {
        const cleaned = cleanTaskLine(part);
        if (cleaned) {
          tasks.push(cleaned);
        }
      }
    } else {
      const cleaned = cleanTaskLine(trimmed);
      if (cleaned) {
        tasks.push(cleaned);
      }
    }
  }

  return tasks;
}

function cleanTaskLine(text: string): string {
  return text
    .trim()
    // Strip leading list bullets, e.g. "- ", "* ", "• ", "1. ", "1) ", "[ ] ", "[x] "
    .replace(/^(\s*[-*•]|\s*\[[\sxX]?\]|\s*\d+[\.)])\s+/u, '')
    // Strip trailing semicolons or commas
    .replace(/[;,]+$/g, '')
    .trim();
}
