import * as chrono from 'chrono-node';
import { extractCategory } from './categories';
import { TaskCategory } from '@/types/matrix';

export interface NLPParseResult {
  cleanedContent: string;
  parsedDate: Date | null;
  rawDateText: string | null;
  formattedPreview: string | null;
  category: TaskCategory | null;
}

/**
 * Parses natural language input to extract due dates and clean task titles.
 * Examples:
 *  - "Finish Q3 budget report by this Friday 5pm" -> "Finish Q3 budget report" + Date
 *  - "Call Sarah tomorrow at 10am #urgent" -> "Call Sarah #urgent" + Date
 *  - "Deploy matrix updates next Tuesday" -> "Deploy matrix updates" + Date
 */
export function parseTaskInput(input: string): NLPParseResult {
  const raw = input.trim();
  if (!raw) {
    return {
      cleanedContent: '',
      parsedDate: null,
      rawDateText: null,
      formattedPreview: null,
      category: null,
    };
  }

  // Strip the category tag before chrono runs, so "#w" can never be read as
  // part of a date expression.
  const { category, rest } = extractCategory(raw);
  const trimmed = rest || raw;

  const parseResults = chrono.parse(trimmed, new Date(), { forwardDate: true });

  if (!parseResults || parseResults.length === 0) {
    return {
      cleanedContent: trimmed,
      parsedDate: null,
      rawDateText: null,
      formattedPreview: null,
      category,
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
    category,
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
