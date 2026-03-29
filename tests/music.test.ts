/**
 * Unit tests for the AI music generator
 */

import { generateTrack, serializeTrack, deserializeTrack } from "../src/music/generator";
import { buildScaleNotes, availableScales } from "../src/music/scales";
import type { MusicTrack } from "../src/music/types";

// ── Scale helpers ────────────────────────────────────────────────────────────

describe("buildScaleNotes", () => {
  it("returns an array of MIDI note numbers", () => {
    const notes = buildScaleNotes("C_MAJOR");
    expect(Array.isArray(notes)).toBe(true);
    expect(notes.length).toBeGreaterThan(0);
  });

  it("all notes are valid MIDI values (0–127)", () => {
    const notes = buildScaleNotes("PENTATONIC");
    notes.forEach(n => {
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThanOrEqual(127);
    });
  });

  it("spans two octaves (14 notes for 7-note scales)", () => {
    const notes = buildScaleNotes("C_MAJOR");
    expect(notes.length).toBe(14); // 7 notes × 2 octaves
  });

  it("pentatonic spans two octaves (10 notes)", () => {
    const notes = buildScaleNotes("PENTATONIC");
    expect(notes.length).toBe(10);
  });

  it("root offset shifts notes up", () => {
    const c = buildScaleNotes("C_MAJOR", 60);
    const d = buildScaleNotes("C_MAJOR", 62);
    expect(d[0] - c[0]).toBe(2);
  });

  it("availableScales returns a non-empty list", () => {
    const scales = availableScales();
    expect(scales.length).toBeGreaterThan(0);
    expect(scales).toContain("C_MAJOR");
  });
});

// ── Track generation ─────────────────────────────────────────────────────────

describe("generateTrack", () => {
  it("returns a MusicTrack with all required fields", () => {
    const track = generateTrack();
    expect(track).toHaveProperty("name");
    expect(track).toHaveProperty("notes");
    expect(track).toHaveProperty("tempo");
    expect(track).toHaveProperty("scale");
    expect(track).toHaveProperty("totalBeats");
    expect(track).toHaveProperty("createdAt");
    expect(track).toHaveProperty("style");
  });

  it("respects the bars option", () => {
    const track = generateTrack({ bars: 4 });
    // 4 bars × 4 beats/bar = 16 total beats
    expect(track.totalBeats).toBe(16);
  });

  it("respects the tempo option", () => {
    const track = generateTrack({ tempo: 140 });
    expect(track.tempo).toBe(140);
  });

  it("respects the scale option", () => {
    const track = generateTrack({ scale: "BLUES" });
    expect(track.scale).toBe("BLUES");
  });

  it("respects the style option", () => {
    const track = generateTrack({ style: "jazz" });
    expect(track.style).toBe("jazz");
  });

  it("uses a custom name when provided", () => {
    const track = generateTrack({ name: "My Test Track" });
    expect(track.name).toBe("My Test Track");
  });

  it("produces notes within the generated totalBeats", () => {
    const track = generateTrack({ bars: 8 });
    track.notes.forEach(note => {
      expect(note.startTime).toBeGreaterThanOrEqual(0);
      expect(note.startTime + note.duration).toBeLessThanOrEqual(track.totalBeats + 0.001);
    });
  });

  it("all note pitches are valid MIDI values", () => {
    const track = generateTrack({ bars: 16 });
    track.notes.forEach(note => {
      expect(note.pitch).toBeGreaterThanOrEqual(0);
      expect(note.pitch).toBeLessThanOrEqual(127);
    });
  });

  it("all note velocities are in range 0–127", () => {
    const track = generateTrack({ bars: 8 });
    track.notes.forEach(note => {
      expect(note.velocity).toBeGreaterThanOrEqual(0);
      expect(note.velocity).toBeLessThanOrEqual(127);
    });
  });

  it("all note durations are positive", () => {
    const track = generateTrack({ bars: 8 });
    track.notes.forEach(note => {
      expect(note.duration).toBeGreaterThan(0);
    });
  });

  it("is deterministic when the same seed is used", () => {
    const a = generateTrack({ bars: 8, style: "electronic" }, 12345);
    const b = generateTrack({ bars: 8, style: "electronic" }, 12345);
    expect(a.notes).toEqual(b.notes);
    expect(a.name).toBe(b.name);
  });

  it("produces different results for different seeds", () => {
    const a = generateTrack({ bars: 8 }, 1);
    const b = generateTrack({ bars: 8 }, 2);
    // It's astronomically unlikely both are identical
    const aNotes = JSON.stringify(a.notes);
    const bNotes = JSON.stringify(b.notes);
    expect(aNotes).not.toBe(bNotes);
  });

  it("clamps bars to minimum of 2", () => {
    const track = generateTrack({ bars: 0 });
    expect(track.totalBeats).toBe(8); // 2 bars × 4 beats
  });

  it("clamps bars to maximum of 32", () => {
    const track = generateTrack({ bars: 100 });
    expect(track.totalBeats).toBe(128); // 32 bars × 4 beats
  });
});

// ── Serialisation ────────────────────────────────────────────────────────────

describe("serializeTrack / deserializeTrack", () => {
  it("roundtrips a track losslessly", () => {
    const original = generateTrack({ bars: 4 }, 99);
    const serialized = serializeTrack(original);
    const restored = deserializeTrack(serialized);
    expect(restored).toEqual(original);
  });

  it("serialized output is a non-empty string", () => {
    const track = generateTrack();
    const s = serializeTrack(track);
    expect(typeof s).toBe("string");
    expect(s.length).toBeGreaterThan(0);
  });

  it("serialized output is valid JSON", () => {
    const track = generateTrack();
    const s = serializeTrack(track);
    expect(() => JSON.parse(s)).not.toThrow();
  });

  it("deserializeTrack throws on invalid JSON", () => {
    expect(() => deserializeTrack("{not valid json")).toThrow();
  });
});

// ── Style coverage ────────────────────────────────────────────────────────────

describe("all styles generate valid tracks", () => {
  const styles = ["ambient", "electronic", "jazz", "classical", "pop", "experimental"] as const;
  styles.forEach(style => {
    it(`style: ${style}`, () => {
      const track = generateTrack({ style, bars: 4 });
      expect(track.style).toBe(style);
      expect(track.notes.length).toBeGreaterThan(0);
    });
  });
});
