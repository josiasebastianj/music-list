import type { ChordSymbol } from "./parse.ts";
import { noteName, spellTone } from "./parse.ts";

export const LOW = 60; // C4
export const HIGH = 84; // C6 — one key past B5 so a stacked 9th still fits
export const WINDOW = HIGH - LOW; // 24 semitones, 15 white keys

export type Voicing = { name: string; keys: number[] }; // absolute MIDI numbers

const NAMES = ["Root position", "1st inversion", "2nd inversion", "3rd inversion", "4th inversion", "5th inversion"];
const mod12 = (n: number) => ((n % 12) + 12) % 12;

function rotations(intervals: number[]): number[][] {
  const out: number[][] = [];
  for (let k = 0; k < intervals.length; k++) {
    const head = intervals.slice(k);
    const tail = intervals.slice(0, k).map((i) => i + 12);
    out.push([...head, ...tail].sort((a, b) => a - b));
  }
  return out;
}

/** Slash chord: the bass note is the lowest, chord tones stacked above it.
 *  A chord tone equal to the bass is not repeated. */
function bassFirst(chord: ChordSymbol): number[] | null {
  if (chord.bass === null) return null;
  const bassOffset = mod12(chord.bass - chord.root);
  const above = chord.pitchClasses
    .map((pc) => mod12(pc - chord.root))
    .filter((o) => o !== bassOffset)
    .map((o) => (o > bassOffset ? o : o + 12))
    .sort((a, b) => a - b);
  return [bassOffset, ...above];
}

/** Slide the shape by octaves until it sits inside the keyboard. Shapes are
 *  relative to the root, so the root's own height is added back in first. */
function fit(rootOffset: number, shape: number[]): number[] | null {
  const base = shape.map((o) => o + rootOffset).sort((a, b) => a - b);
  if (base[base.length - 1] - base[0] > WINDOW) return null;
  for (const shift of [12, 24, 0, 36, -12, 48, -24]) {
    const moved = base.map((o) => o + shift);
    if (moved[0] >= LOW && moved[moved.length - 1] <= HIGH) return moved;
  }
  return null;
}

export function voicings(chord: ChordSymbol): Voicing[] {
  const rootOffset = chord.root + LOW;
  const shapes: { name: string; offsets: number[] }[] = [];
  const slash = bassFirst(chord);
  if (slash) shapes.push({ name: "Bass note lowest", offsets: slash });
  rotations(chord.intervals).forEach((r, i) => {
    shapes.push({ name: NAMES[i] ?? `Inversion ${i}`, offsets: r });
  });

  const out: Voicing[] = [];
  const seen = new Set<string>();
  for (const s of shapes) {
    const keys = fit(rootOffset, s.offsets);
    if (!keys) continue;
    const id = keys.join(",");
    if (seen.has(id)) continue;
    seen.add(id);
    out.push({ name: s.name, keys });
    if (out.length === 4) break;
  }
  return out;
}

/** Note names for a voicing, lowest first. Each note is spelled by finding the
 *  chord tone whose pitch class it matches, so degrees drive the spelling. */
export function voicingNames(chord: ChordSymbol, v: Voicing): string[] {
  return v.keys.map((key) => {
    const pc = mod12(key);
    const idx = chord.pitchClasses.indexOf(pc);
    // Only a slash chord's bass can sit outside the chord tones.
    if (idx === -1) return chord.bassLetter && pc === chord.bass ? spellTone(chord.bassLetter, 1, pc) : noteName(pc, chord.flats);
    return spellTone(chord.rootLetter, chord.degrees[idx], pc);
  });
}
