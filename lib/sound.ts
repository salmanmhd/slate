/**
 * A short synthesised chime for finishing things — no audio files to ship.
 * Always a no-op where Web Audio is unavailable or the browser blocks it.
 */
let ctx: AudioContext | null = null;

function tone(audio: AudioContext, freq: number, start: number, length: number, gain: number) {
  const osc = audio.createOscillator();
  const amp = audio.createGain();
  osc.type = 'sine';
  osc.frequency.value = freq;
  amp.gain.setValueAtTime(0.0001, start);
  amp.gain.exponentialRampToValueAtTime(gain, start + 0.012);
  amp.gain.exponentialRampToValueAtTime(0.0001, start + length);
  osc.connect(amp).connect(audio.destination);
  osc.start(start);
  osc.stop(start + length + 0.02);
}

/** A step gets a single soft note; a whole task gets a rising pair. */
export function playCompleteSound(kind: 'step' | 'task' = 'task') {
  try {
    if (typeof window === 'undefined') return;
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;

    ctx ??= new Ctor();
    if (ctx.state === 'suspended') void ctx.resume();

    const t = ctx.currentTime;
    if (kind === 'step') {
      tone(ctx, 880, t, 0.18, 0.06);
    } else {
      tone(ctx, 659.25, t, 0.22, 0.08);
      tone(ctx, 987.77, t + 0.09, 0.34, 0.08);
    }
  } catch {
    /* sound is decoration — never let it break completion */
  }
}
