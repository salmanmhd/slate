export interface SessionInput {
  /** What you are doing, with the duration phrase stripped out. */
  label: string;
  minutes: number;
  /** False when no duration was written and the default was used. */
  matched: boolean;
}

export const DEFAULT_SESSION_MINUTES = 25;
const MAX_SESSION_MINUTES = 600;

const DURATION = /(\d+(?:\.\d+)?)\s*(hours?|hrs?|h|minutes?|mins?|m)\b/i;

/**
 * Reads "read 10 mins" as ten minutes of reading.
 *
 * The duration can sit anywhere in the sentence; whatever is left becomes the
 * label. With no duration written, the default length is used rather than
 * refusing the input — starting is the point.
 */
export function parseSessionInput(
  input: string,
  fallbackMinutes = DEFAULT_SESSION_MINUTES
): SessionInput {
  const trimmed = input.trim();
  const match = trimmed.match(DURATION);

  if (!match) {
    return { label: trimmed, minutes: fallbackMinutes, matched: false };
  }

  const value = parseFloat(match[1]);
  const isHours = match[2].toLowerCase().startsWith('h');
  const minutes = Math.max(1, Math.min(Math.round(isHours ? value * 60 : value), MAX_SESSION_MINUTES));

  const label = trimmed
    .replace(match[0], ' ')
    // "read for 10 mins" leaves a dangling preposition behind.
    .replace(/\b(for|in|of)\s*$/i, '')
    .replace(/\s+/g, ' ')
    .trim();

  return { label, minutes, matched: true };
}

export function formatDuration(ms: number): string {
  const totalMinutes = Math.round(ms / 60_000);
  if (totalMinutes < 60) return `${totalMinutes}m`;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes ? `${hours}h ${minutes}m` : `${hours}h`;
}
