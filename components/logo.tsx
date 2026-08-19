import { cn } from '@/lib/utils';

/**
 * The FocusMatrix mark: a solid rounded square with a knocked-out "F".
 * The same geometry is mirrored in `app/icon.svg` so the favicon and the
 * header logo are literally the same drawing.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      role="img"
      aria-label="FocusMatrix"
      className={cn('size-5', className)}
    >
      <rect width="32" height="32" rx="9" className="fill-foreground" />
      <g className="fill-background">
        <rect x="10.4" y="8" width="3.7" height="16" rx="1.2" />
        <rect x="10.4" y="8" width="11.2" height="3.7" rx="1.2" />
        <rect x="10.4" y="14.4" width="8.6" height="3.5" rx="1.2" />
      </g>
    </svg>
  );
}
