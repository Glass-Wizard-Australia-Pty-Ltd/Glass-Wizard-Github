/**
 * AI Music Generator
 *
 * Uses a first-order Markov chain trained on music-theory intervals to produce
 * melodic note sequences.  Rhythm patterns are drawn from a small vocabulary of
 * style-specific beat templates.  The result is a fully serialisable MusicTrack
 * that can be stored in an XRPL NFT URI.
 */

import { buildScaleNotes, availableScales } from "./scales";
import type { Note, MusicTrack, MusicStyle, GeneratorOptions } from "./types";

// ---------------------------------------------------------------------------
// Markov transition weights (index = interval step within scale, -3 … +3)
// ---------------------------------------------------------------------------
const INTERVAL_STEPS = [-3, -2, -1, 0, 1, 2, 3];

/** Transition probability weights per style */
const STYLE_TRANSITIONS: Record<MusicStyle, number[]> = {
  ambient:      [2, 4, 8, 6, 8, 4, 2],  // smooth, stepwise motion
  electronic:   [1, 2, 4, 10, 4, 2, 1], // mostly repeating + small steps
  jazz:         [4, 6, 8, 4, 8, 6, 4],  // wider leaps welcome
  classical:    [1, 3, 10, 5, 10, 3, 1],// stepwise preference
  pop:          [1, 2, 8, 8, 8, 2, 1],  // step-heavy, slight repeat
  experimental: [5, 5, 5, 5, 5, 5, 5],  // uniform
};

/** Rhythm duration templates (in beats) per style */
const STYLE_RHYTHMS: Record<MusicStyle, number[]> = {
  ambient:      [2, 2, 4, 1, 1],
  electronic:   [0.5, 0.5, 1, 1, 0.5, 0.5, 1],
  jazz:         [0.5, 1, 0.5, 1, 1, 0.5, 0.5, 1],
  classical:    [1, 0.5, 0.5, 2, 1, 1],
  pop:          [0.5, 0.5, 1, 1, 0.5, 0.5, 1, 1],
  experimental: [0.25, 0.75, 1.5, 0.5, 1, 2],
};

/** Default BPM per style */
const STYLE_TEMPO: Record<MusicStyle, number> = {
  ambient:      75,
  electronic:  128,
  jazz:        110,
  classical:    90,
  pop:         120,
  experimental: 95,
};

/** Adjectives used when auto-naming generated tracks */
const ADJECTIVES = [
  "Celestial", "Neon", "Crystal", "Lunar", "Stellar", "Prism",
  "Quantum", "Arcane", "Sonic", "Astral", "Vivid", "Fractal",
];

/** Nouns used when auto-naming generated tracks */
const NOUNS = [
  "Dream", "Wave", "Pulse", "Echo", "Vision", "Current",
  "Horizon", "Realm", "Spectrum", "Cascade", "Signal", "Mirage",
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Seeded pseudo-random number generator (Mulberry32) – deterministic output
 *  when the same seed is used, making tracks reproducible. */
function createRng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s += 0x6d2b79f5;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Weighted random selection from an array of items with matching weights. */
function weightedChoice<T>(items: T[], weights: number[], rng: () => number): T {
  const total = weights.reduce((a, b) => a + b, 0);
  let r = rng() * total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r <= 0) return items[i];
  }
  return items[items.length - 1];
}

/** Clamp a value between min and max (inclusive). */
function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generate a new AI-composed MusicTrack.
 *
 * @param options - Optional generation parameters.
 * @param seed    - Optional integer seed for reproducibility.
 */
export function generateTrack(options: GeneratorOptions = {}, seed?: number): MusicTrack {
  const effectiveSeed = seed ?? Math.floor(Math.random() * 0xffffffff);
  const rng = createRng(effectiveSeed);

  // Use the seeded RNG for any omitted options so tracks are fully deterministic
  const allStyles = Object.keys(STYLE_TEMPO) as MusicStyle[];
  const style: MusicStyle =
    options.style ?? allStyles[Math.floor(rng() * allStyles.length)];
  const allScales = availableScales();
  const scaleName =
    options.scale ?? allScales[Math.floor(rng() * allScales.length)];
  const tempo = options.tempo ?? STYLE_TEMPO[style];
  const bars = clamp(options.bars ?? 8, 2, 32);
  const beatsPerBar = 4;
  const totalBeats = bars * beatsPerBar;

  const scaleNotes = buildScaleNotes(scaleName);

  const transitions = STYLE_TRANSITIONS[style];
  const rhythmTemplate = STYLE_RHYTHMS[style];

  const notes: Note[] = [];
  let currentTime = 0;
  // Start somewhere in the middle of the scale (index 3–7)
  let scaleIndex = Math.floor(3 + rng() * 5);

  while (currentTime < totalBeats) {
    const duration = rhythmTemplate[Math.floor(rng() * rhythmTemplate.length)];
    const safeDuration = Math.min(duration, totalBeats - currentTime);
    if (safeDuration <= 0) break;

    const pitch = scaleNotes[clamp(scaleIndex, 0, scaleNotes.length - 1)];
    const velocity = Math.floor(60 + rng() * 40); // 60–100

    notes.push({ pitch, duration: safeDuration, velocity, startTime: currentTime });
    currentTime += safeDuration;

    // Markov: pick next interval step
    const step = weightedChoice(INTERVAL_STEPS, transitions, rng);
    scaleIndex = clamp(scaleIndex + step, 0, scaleNotes.length - 1);
  }

  const name = options.name ?? generateTrackName(style, rng);

  return {
    name,
    notes,
    tempo,
    scale: scaleName,
    totalBeats,
    createdAt: new Date().toISOString(),
    style,
  };
}

/** Serialise a MusicTrack to a compact JSON string (for NFT URI storage). */
export function serializeTrack(track: MusicTrack): string {
  return JSON.stringify(track);
}

/** Deserialise a MusicTrack from a JSON string. */
export function deserializeTrack(json: string): MusicTrack {
  return JSON.parse(json) as MusicTrack;
}

function generateTrackName(style: MusicStyle, rng: () => number): string {
  const adj = ADJECTIVES[Math.floor(rng() * ADJECTIVES.length)];
  const noun = NOUNS[Math.floor(rng() * NOUNS.length)];
  return `${adj} ${noun} (${style})`;
}
