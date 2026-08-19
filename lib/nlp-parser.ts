import * as chrono from 'chrono-node';

export interface NLPParseResult {
  cleanedContent: string;
  parsedDate: Date | null;
  rawDateText: string | null;
  formattedPreview: string | null;
}

/**
 * Parses natural language input to extract due dates and clean task titles.
 * Examples:
 *  - "Finish Q3 budget report by this Friday 5pm" -> "Finish Q3 budget report" + Date
 *  - "Call Sarah tomorrow at 10am #urgent" -> "Call Sarah #urgent" + Date
 *  - "Deploy matrix updates next Tuesday" -> "Deploy matrix updates" + Date
 */
export function parseTaskInput(input: string): NLPParseResult {
  const trimmed = input.trim();
  if (!trimmed) {
    return {
      cleanedContent: '',
      parsedDate: null,
      rawDateText: null,
      formattedPreview: null,
    };
  }

  const parseResults = chrono.parse(trimmed, new Date(), { forwardDate: true });

  if (!parseResults || parseResults.length === 0) {
    return {
      cleanedContent: trimmed,
      parsedDate: null,
      rawDateText: null,
      formattedPreview: null,
    };
  }

  const firstResult = parseResults[0];
  const parsedDate = firstResult.start.date();
  const rawDateText = firstResult.text;

  // Remove the matched date text from the title
  let cleaned = trimmed.replace(rawDateText, '');

  // Clean up trailing/dangling prepositions (e.g. "by", "on", "at", "due", "before", "for")
  cleaned = cleaned
    .replace(/\b(due|by|on|at|before|for|until|due on|due by)\s*$/i, '')
    .replace(/\s+/g, ' ')
    .trim();

  // If the cleaning emptied the title entirely (e.g. user typed only "tomorrow"), restore raw text
  if (!cleaned) {
    cleaned = trimmed;
  }

  return {
    cleanedContent: cleaned,
    parsedDate,
    rawDateText,
    formattedPreview: parsedDate ? formatFriendlyDate(parsedDate) : null,
  };
}

export function formatFriendlyDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '';

  const now = new Date();
  const isToday =
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear();

  const tomorrow = new Date();
  tomorrow.setDate(now.getDate() + 1);
  const isTomorrow =
    d.getDate() === tomorrow.getDate() &&
    d.getMonth() === tomorrow.getMonth() &&
    d.getFullYear() === tomorrow.getFullYear();

  const hasTime = d.getHours() !== 0 || d.getMinutes() !== 0;
  const timeStr = hasTime
    ? d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    : '';

  if (isToday) {
    return timeStr ? `Today at ${timeStr}` : 'Today';
  }
  if (isTomorrow) {
    return timeStr ? `Tomorrow at ${timeStr}` : 'Tomorrow';
  }

  const diffDays = Math.round((d.getTime() - now.getTime()) / (1000 * 3600 * 24));
  if (diffDays > 1 && diffDays < 7) {
    const weekday = d.toLocaleDateString([], { weekday: 'short' });
    return timeStr ? `${weekday} at ${timeStr}` : weekday;
  }

  return d.toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
    ...(timeStr ? { hour: 'numeric', minute: '2-digit' } : {}),
  });
}
