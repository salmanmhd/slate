import { TaskCategory } from '@/types/matrix';

export interface CategoryMeta {
  id: TaskCategory;
  label: string;
  /** One-letter mark used on task cards, where a full label would not fit. */
  short: string;
  /** Hashtags that assign this category while capturing. */
  tags: string[];
}

export const CATEGORIES: CategoryMeta[] = [
  { id: 'work', label: 'Work', short: 'W', tags: ['work', 'w', 'job', 'office'] },
  { id: 'personal', label: 'Personal', short: 'P', tags: ['personal', 'p', 'life', 'home'] },
  { id: 'content', label: 'Content', short: 'C', tags: ['content', 'c', 'create', 'creator'] },
];

export const CATEGORY_BY_ID: Record<TaskCategory, CategoryMeta> = CATEGORIES.reduce(
  (acc, meta) => ({ ...acc, [meta.id]: meta }),
  {} as Record<TaskCategory, CategoryMeta>
);

/** Cycles None → Work → Personal → Content → None, for one-click assignment. */
export function nextCategory(current: TaskCategory | undefined): TaskCategory | undefined {
  const order: (TaskCategory | undefined)[] = [undefined, 'work', 'personal', 'content'];
  return order[(order.indexOf(current) + 1) % order.length];
}

/**
 * Pulls the first recognised #tag out of raw input and returns the rest.
 * Unknown tags are left in the title — someone writing "#urgent" means it as
 * part of the task, not as a command.
 */
export function extractCategory(input: string): {
  category: TaskCategory | null;
  rest: string;
} {
  const matches = input.match(/#[\p{L}]+/gu) ?? [];

  for (const raw of matches) {
    const word = raw.slice(1).toLowerCase();
    const found = CATEGORIES.find((c) => c.tags.includes(word));
    if (found) {
      const rest = input.replace(raw, ' ').replace(/\s+/g, ' ').trim();
      return { category: found.id, rest };
    }
  }

  return { category: null, rest: input };
}
