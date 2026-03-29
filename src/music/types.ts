/** A single musical note */
export interface Note {
  /** MIDI note number (0–127, e.g. 60 = middle C) */
  pitch: number;
  /** Duration in beats (1 = quarter note) */
  duration: number;
  /** Velocity / volume (0–127) */
  velocity: number;
  /** Start time in beats from the beginning of the track */
  startTime: number;
}

/** A complete generated music track */
export interface MusicTrack {
  /** Human-readable track name */
  name: string;
  /** Sequence of notes */
  notes: Note[];
  /** Tempo in beats-per-minute */
  tempo: number;
  /** Musical key and mode, e.g. "C_MAJOR" */
  scale: string;
  /** Total duration in beats */
  totalBeats: number;
  /** ISO 8601 creation timestamp */
  createdAt: string;
  /** Optional descriptive style tag */
  style: MusicStyle;
}

export type MusicStyle =
  | "ambient"
  | "electronic"
  | "jazz"
  | "classical"
  | "pop"
  | "experimental";

/** Parameters that guide the AI generator */
export interface GeneratorOptions {
  /** Desired musical style */
  style?: MusicStyle;
  /** Tempo in BPM (default: auto-selected by style) */
  tempo?: number;
  /** Scale name (default: "C_MAJOR") */
  scale?: string;
  /** Number of bars to generate (default: 8) */
  bars?: number;
  /** Track name (default: auto-generated) */
  name?: string;
}

/** Serialised form stored inside an XRPL NFT URI */
export interface MusicNFTMetadata {
  version: "1";
  track: MusicTrack;
  /** XRPL account address of the original creator */
  creator: string;
}
