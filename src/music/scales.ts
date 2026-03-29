/**
 * Musical scales expressed as MIDI note offsets from the root (C = 0).
 * Each array contains the semitone intervals in one octave.
 */
export const SCALE_INTERVALS: Record<string, number[]> = {
  C_MAJOR:      [0, 2, 4, 5, 7, 9, 11],
  A_MINOR:      [0, 2, 3, 5, 7, 8, 10],
  G_MAJOR:      [0, 2, 4, 5, 7, 9, 11],
  D_MINOR:      [0, 2, 3, 5, 7, 8, 10],
  F_MAJOR:      [0, 2, 4, 5, 7, 9, 11],
  E_MINOR:      [0, 2, 3, 5, 7, 8, 10],
  PENTATONIC:   [0, 2, 4, 7, 9],
  BLUES:        [0, 3, 5, 6, 7, 10],
  DORIAN:       [0, 2, 3, 5, 7, 9, 10],
  LYDIAN:       [0, 2, 4, 6, 7, 9, 11],
};

/** Root note MIDI values for common keys (octave 4) */
export const ROOT_NOTES: Record<string, number> = {
  C: 60, D: 62, E: 64, F: 65, G: 67, A: 69, B: 71,
};

/**
 * Build an array of MIDI note numbers spanning two octaves
 * for the given scale name.
 */
export function buildScaleNotes(scaleName: string, rootMidi = 60): number[] {
  const intervals = SCALE_INTERVALS[scaleName] ?? SCALE_INTERVALS["C_MAJOR"];
  const notes: number[] = [];
  for (let octave = 0; octave < 2; octave++) {
    for (const interval of intervals) {
      notes.push(rootMidi + octave * 12 + interval);
    }
  }
  return notes;
}

/** Return a list of all available scale names. */
export function availableScales(): string[] {
  return Object.keys(SCALE_INTERVALS);
}
