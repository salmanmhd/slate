'use client';

import * as React from 'react';

/**
 * True while the user is active, false once the pointer has been still for
 * `delay`. Focus mode uses this to strip the screen back to the single task
 * and bring everything else back the moment you reach for it.
 */
export function useIdleReveal(delay = 2200): boolean {
  const [revealed, setRevealed] = React.useState(true);

  React.useEffect(() => {
    let timer = window.setTimeout(() => setRevealed(false), delay);

    const wake = () => {
      setRevealed(true);
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setRevealed(false), delay);
    };

    window.addEventListener('mousemove', wake, { passive: true });
    window.addEventListener('touchstart', wake, { passive: true });
    window.addEventListener('keydown', wake);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('mousemove', wake);
      window.removeEventListener('touchstart', wake);
      window.removeEventListener('keydown', wake);
    };
  }, [delay]);

  return revealed;
}
