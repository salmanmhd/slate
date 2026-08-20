import { cn } from '@/lib/utils';

/**
 * The Slate mark: a solid tile with a 2×2 grid knocked out of it, the
 * top-left cell bright and the rest dimmed — the matrix with "do first" lit.
 * The same geometry is mirrored in `app/icon.svg` so the favicon and the
 * header logo are literally the same drawing.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" role="img" aria-label="Slate" className={cn('size-5', className)}>
      <rect width="32" height="32" rx="9" className="fill-foreground" />
      <g className="fill-background">
        <rect x="6.75" y="6.75" width="8" height="8" rx="2" />
        <rect x="17.25" y="6.75" width="8" height="8" rx="2" opacity="0.4" />
        <rect x="6.75" y="17.25" width="8" height="8" rx="2" opacity="0.4" />
        <rect x="17.25" y="17.25" width="8" height="8" rx="2" opacity="0.4" />
      </g>
    </svg>
  );
}
