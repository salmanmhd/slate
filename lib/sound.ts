/**
 * Completion sounds, synthesised so there are no audio files to ship.
 *
 * A finished task is a small fanfare: a soft low thump you feel, a bright
 * rising arpeggio of bell tones, and a sparkle on top, all with a little echo.
 * A finished step is a quick pop and a single bright ping. Always a no-op where
 * Web Audio is unavailable or blocked.
 */
interface Chain {
  audio: AudioContext;
  /** Dry path: everything lands here and is compressed on the way out. */
  out: GainNode;
  /** Echo send: feeds the same output a few softer, darker repeats. */
  send: GainNode;
}

let chain: Chain | null = null;

function getChain(): Chain | null {
  if (typeof window === 'undefined') return null;
  if (chain) return chain;

  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;

  const audio = new Ctor();

  const compressor = audio.createDynamicsCompressor();
  compressor.threshold.value = -14;
  compressor.ratio.value = 4;
  compressor.connect(audio.destination);

  const out = audio.createGain();
  out.gain.value = 0.9;
  out.connect(compressor);

  const send = audio.createGain();
  send.gain.value = 0.28;
  const delay = audio.createDelay(0.5);
  delay.delayTime.value = 0.13;
  const feedback = audio.createGain();
  feedback.gain.value = 0.38;
  const tone = audio.createBiquadFilter();
  tone.type = 'lowpass';
  tone.frequency.value = 3200;
  send.connect(delay);
  delay.connect(tone);
  tone.connect(feedback);
  feedback.connect(delay);
  tone.connect(out);

  chain = { audio, out, send };
  return chain;
}

/** One enveloped oscillator, routed dry and into the echo. */
function voice(
  c: Chain,
  type: OscillatorType,
  freq: number,
  start: number,
  length: number,
  gain: number,
  opts: { glideTo?: number; echo?: boolean } = {}
) {
  const osc = c.audio.createOscillator();
  const amp = c.audio.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  if (opts.glideTo) osc.frequency.exponentialRampToValueAtTime(opts.glideTo, start + length);

  amp.gain.setValueAtTime(0.0001, start);
  amp.gain.exponentialRampToValueAtTime(gain, start + 0.006);
  amp.gain.exponentialRampToValueAtTime(0.0001, start + length);

  osc.connect(amp);
  amp.connect(c.out);
  if (opts.echo) amp.connect(c.send);
  osc.start(start);
  osc.stop(start + length + 0.03);
}

/** A struck-bell tone: the fundamental plus two quicker-fading overtones. */
function bell(c: Chain, freq: number, start: number, length: number, gain: number) {
  voice(c, 'sine', freq, start, length, gain, { echo: true });
  voice(c, 'sine', freq * 2, start, length * 0.55, gain * 0.35, { echo: true });
  voice(c, 'sine', freq * 2.76, start, length * 0.25, gain * 0.16);
}

export function playCompleteSound(kind: 'step' | 'task' = 'task') {
  try {
    const c = getChain();
    if (!c) return;
    if (c.audio.state === 'suspended') void c.audio.resume();

    const t = c.audio.currentTime + 0.01;

    if (kind === 'step') {
      // Pop, then a bright ping.
      voice(c, 'sine', 520, t, 0.07, 0.18, { glideTo: 220 });
      bell(c, 1318.51, t + 0.03, 0.55, 0.13); // E6
      bell(c, 1760, t + 0.1, 0.45, 0.07); // A6
      return;
    }

    // The thump you feel more than hear.
    voice(c, 'sine', 140, t, 0.32, 0.32, { glideTo: 48 });

    // A rising C-major arpeggio that lands and rings.
    const arpeggio = [523.25, 659.25, 783.99, 1046.5]; // C5 E5 G5 C6
    arpeggio.forEach((f, i) => bell(c, f, t + 0.04 + i * 0.075, i === 3 ? 1.5 : 0.7, 0.17));

    // The landing chord swells underneath the last note.
    const land = t + 0.04 + 3 * 0.075;
    voice(c, 'triangle', 523.25, land, 1.1, 0.09, { echo: true }); // C5
    voice(c, 'triangle', 659.25, land, 1.1, 0.07, { echo: true }); // E5
    voice(c, 'triangle', 783.99, land, 1.1, 0.07, { echo: true }); // G5

    // Sparkle on top.
    bell(c, 2093, land + 0.06, 0.6, 0.07); // C7
    bell(c, 3135.96, land + 0.13, 0.5, 0.05); // G7
  } catch {
    /* sound is decoration — never let it break completion */
  }
}
