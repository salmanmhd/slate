'use client';

import * as React from 'react';

/**
 * True while the user is active, false once the pointer has been still for
 * `delay`. Focus mode uses this to strip the screen back to the single task
 * and bring everything else back the moment you reach for it.
 */
export function useIdleReveal(delay = 2200): { revealed: boolean; wake: () => void } {
  const [revealed, setRevealed] = React.useState(true);
  const timerRef = React.useRef<number | undefined>(undefined);

  /** Bring the page back and restart the idle countdown. */
  const wake = React.useCallback(() => {
    setRevealed(true);
    window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => setRevealed(false), delay);
  }, [delay]);

  React.useEffect(() => {
    timerRef.current = window.setTimeout(() => setRevealed(false), delay);

    window.addEventListener('mousemove', wake, { passive: true });
    window.addEventListener('touchstart', wake, { passive: true });
    window.addEventListener('keydown', wake);

    return () => {
      window.clearTimeout(timerRef.current);
      window.removeEventListener('mousemove', wake);
      window.removeEventListener('touchstart', wake);
      window.removeEventListener('keydown', wake);
    };
  }, [delay, wake]);

  return { revealed, wake };
}
