'use client';

import React from 'react';
import { useMatrixStore } from '@/lib/store';
import { CATEGORIES, CATEGORY_BY_ID, nextCategory } from '@/lib/categories';
import { CategoryFilter, TaskCategory } from '@/types/matrix';

/** All / Work / Personal / Content. The context you are currently in. */
export function CategorySwitcher({ className = '' }: { className?: string }) {
  const { activeCategory, setActiveCategory } = useMatrixStore();

  const options: { id: CategoryFilter; label: string }[] = [
    { id: 'all', label: 'All' },
    ...CATEGORIES.map((c) => ({ id: c.id as CategoryFilter, label: c.label })),
  ];

  return (
    <div className={`flex items-center gap-1 ${className}`}>
      {options.map((opt) => {
        const isActive = activeCategory === opt.id;
        return (
          <button
            key={opt.id}
            onClick={() => setActiveCategory(opt.id)}
            aria-pressed={isActive}
            className={`focus-ring rounded-lg px-2 py-0.5 text-xs transition-colors ${
              isActive
                ? 'bg-muted font-semibold text-foreground'
                : 'text-muted-foreground/60 hover:text-foreground'
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * The per-task mark. Click cycles None → Work → Personal → Content → None,
 * which beats a popover for a four-state field and cannot be clipped by the
 * scrolling panels it lives in.
 */
export function CategoryMark({
  category,
  onCycle,
  alwaysVisible = false,
}: {
  category: TaskCategory | undefined;
  onCycle: (next: TaskCategory | undefined) => void;
  alwaysVisible?: boolean;
}) {
  const meta = category ? CATEGORY_BY_ID[category] : null;

  return (
    <button
      type="button"
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation();
        onCycle(nextCategory(category));
      }}
      title={meta ? `${meta.label} — click to change` : 'Set a category'}
      aria-label={meta ? `Category: ${meta.label}` : 'No category'}
      className={`focus-ring flex size-4 shrink-0 items-center justify-center rounded-full border text-[9px] font-bold transition-all ${
        meta
          ? 'border-transparent bg-muted text-muted-foreground hover:bg-foreground hover:text-background'
          : 'border-dashed border-muted-foreground/40 text-transparent hover:border-foreground hover:text-muted-foreground'
      } ${meta || alwaysVisible ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 focus-visible:opacity-100'}`}
    >
      {meta ? meta.short : '+'}
    </button>
  );
}
