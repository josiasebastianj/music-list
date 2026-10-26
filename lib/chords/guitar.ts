import type { ChordSymbol } from "./parse.ts";

/** Frets for strings low E, A, D, G, B, high e. -1 = muted, 0 = open. */
export type Fingering = { name: string; frets: number[] };

// Movable shapes, frets relative to the barre. Slide up the neck to change root.
const E_FORM: Record<string, number[]> = {
  "": [0, 2, 2, 1, 0, 0], m: [0, 2, 2, 0, 0, 0], "5": [0, 2, 2, -1, -1, -1],
  sus2: [0, 2, 4, 4, 0, 0], sus4: [0, 2, 2, 2, 0, 0], aug: [0, 3, 2, 1, 1, 0],
  "6": [0, 2, 2, 1, 2, 0], m6: [0, 2, 2, 0, 2, 0],
  "7": [0, 2, 0, 1, 0, 0], maj7: [0, 2, 1, 1, 0, 0], m7: [0, 2, 0, 0, 0, 0], mMaj7: [0, 2, 1, 0, 0, 0],
  "7sus4": [0, 2, 0, 2, 0, 0], "7b5": [0, 1, 0, 1, -1, -1], "7#5": [0, 3, 0, 1, 1, 0],
  add2: [0, 2, 4, 1, 0, 0], add4: [0, 0, 2, 1, 0, 0], add9: [0, 2, 2, 1, 0, 2], madd9: [0, 2, 4, 0, 0, 0],
  "9": [0, 2, 0, 1, 0, 2], maj9: [0, 2, 1, 1, 0, 2], m9: [0, 2, 0, 0, 0, 2], "9sus4": [0, 2, 0, 2, 0, 2],
  "11": [0, 0, 0, 1, 0, 0], m11: [0, 0, 0, 0, 0, 0],
  "13": [0, 2, 0, 1, 2, 0], m13: [0, 2, 0, 0, 2, 0], maj13: [0, 2, 1, 1, 2, 0],
  "7b9": [0, 2, 0, 1, 3, 1], "7#9": [0, 2, 0, 1, 3, 3], "7#11": [0, 1, 0, 1, 0, 0],
  "maj7#11": [0, 1, 1, 1, 0, 0], "maj7#5": [0, 3, 1, 1, 1, 0], "6/9": [0, 2, 2, 1, 2, 2],
};
const A_FORM: Record<string, number[]> = {
  "": [-1, 0, 2, 2, 2, 0], m: [-1, 0, 2, 2, 1, 0], "5": [-1, 0, 2, 2, -1, -1],
  sus2: [-1, 0, 2, 2, 0, 0], sus4: [-1, 0, 2, 2, 3, 0], aug: [-1, 0, 3, 2, 2, 1],
  dim: [-1, 0, 1, 2, 1, -1], "6": [-1, 0, 2, 2, 2, 2], m6: [-1, 0, 2, 2, 1, 2],
  "7": [-1, 0, 2, 0, 2, 0], maj7: [-1, 0, 2, 1, 2, 0], m7: [-1, 0, 2, 0, 1, 0], mMaj7: [-1, 0, 2, 1, 1, 0],
  dim7: [-1, 0, 1, 2, 1, 2], m7b5: [-1, 0, 1, 0, 1, -1],
  "7sus4": [-1, 0, 2, 0, 3, 0], "7b5": [-1, 0, 1, 0, 2, -1], "7#5": [-1, 0, 3, 0, 2, 1],
  add2: [-1, 0, 2, 4, 2, 0], add4: [-1, 0, 0, 2, 2, 0], add9: [-1, 0, 2, 4, 2, 0], madd9: [-1, 0, 2, 4, 1, 0],
  "9": [-1, 0, 2, 4, 2, 3], maj9: [-1, 0, 2, 4, 2, 4], m9: [-1, 0, 2, 4, 1, 3], "9sus4": [-1, 0, 0, 0, 0, 0],
  "11": [-1, 0, 0, 0, 0, 0], m11: [-1, 0, 0, 0, 1, 0],
  "13": [-1, 0, 2, 0, 2, 2], m13: [-1, 0, 2, 0, 1, 2], maj13: [-1, 0, 2, 1, 2, 2],
  "7b9": [-1, 0, 2, 3, 2, 3], "7#11": [-1, 0, 1, 0, 2, 0], "maj7#11": [-1, 0, 1, 1, 2, 0], "maj7#5": [-1, 0, 3, 1, 2, 1],
};
// Open shapes the movable forms can't produce, keyed "rootPitchClass|quality".
const OPEN: Record<string, number[]> = {
  "0|": [-1, 3, 2, 0, 1, 0], "2|": [-1, -1, 0, 2, 3, 2], "7|": [3, 2, 0, 0, 0, 3],
  "2|m": [-1, -1, 0, 2, 3, 1], "0|7": [-1, 3, 2, 3, 1, 0], "7|7": [3, 2, 0, 0, 0, 1], "2|7": [-1, -1, 0, 2, 1, 2],
  "0|maj7": [-1, 3, 2, 0, 0, 0], "5|maj7": [-1, -1, 3, 2, 1, 0], "7|maj7": [3, 2, 0, 0, 0, 2], "2|maj7": [-1, -1, 0, 2, 2, 2],
  "2|sus2": [-1, -1, 0, 2, 3, 0], "2|sus4": [-1, -1, 0, 2, 3, 3], "2|m7": [-1, -1, 0, 2, 1, 1],
  "0|add9": [-1, 3, 2, 0, 3, 0], "7|6": [3, 2, 0, 0, 0, 0],
};
// Qualities that share another quality's guitar shape.
const SHAPE_OF: Record<string, string> = { add11: "add4" };

const OPEN_STRINGS = [4, 9, 2, 7, 11, 4]; // pitch classes of E A D G B e
const OPEN_MIDI = [40, 45, 50, 55, 59, 64];
const mod12 = (n: number) => ((n % 12) + 12) % 12;
const slide = (shape: number[], by: number) => shape.map((f) => (f < 0 ? f : f + by));

/** Put the slash bass lowest: reuse a string already sounding it, or move the bass onto
 *  an open/nearby fret and mute everything below. Null when no string reaches it. */
function withBass(frets: number[], bass: number): number[] | null {
  const fretted = frets.filter((f) => f > 0);
  const lo = fretted.length ? Math.min(...fretted) : 0;
  const hi = fretted.length ? Math.max(...fretted) : 0;
  for (let s = 0; s < 6; s++) {
    const f = mod12(bass - OPEN_STRINGS[s]);
    const sounding = frets[s] >= 0 && mod12(OPEN_STRINGS[s] + frets[s]) === bass;
    if (!sounding && !(f === 0 || (f >= lo - 1 && f <= hi + 1))) continue;
    const next = frets.map((x, i) => (i < s ? -1 : i === s ? (sounding ? frets[s] : f) : x));
    const pitches = next.map((x, i) => (x < 0 ? Infinity : OPEN_MIDI[i] + x));
    if (pitches[s] !== Math.min(...pitches)) continue; // a higher string sounds lower
    return next;
  }
  return null;
}

/** Up to three shapes: open, E-shape barre, A-shape barre. Slash chords re-bass those. */
export function guitarVoicings(chord: ChordSymbol): Fingering[] {
  const quality = SHAPE_OF[chord.quality] ?? chord.quality;
  const out: Fingering[] = [];
  const add = (name: string, frets: number[]) => {
    if (chord.bass !== null) {
      const moved = withBass(frets, chord.bass);
      if (!moved || moved.filter((f) => f >= 0).length < 3) return;
      frets = moved;
      name += ` /${chord.text.split("/")[1]}`;
    }
    if (!out.some((o) => o.frets.join() === frets.join())) out.push({ name, frets });
  };
  const open = OPEN[`${chord.root}|${quality}`];
  if (open) add("Open", open);
  const e = E_FORM[quality];
  if (e) {
    const f = mod12(chord.root - 4);
    add(f === 0 ? "Open" : `E shape, fret ${f}`, slide(e, f));
  }
  const a = A_FORM[quality];
  if (a) {
    const f = mod12(chord.root - 9);
    add(f === 0 ? "Open" : `A shape, fret ${f}`, slide(a, f));
  }
  return out.sort((x, y) => Number(y.name.startsWith("Open")) - Number(x.name.startsWith("Open"))).slice(0, 3);
}

/** "x32010"-style tab string, low E first; spaced when any fret is two digits. */
export const tabString = (frets: number[]) =>
  frets.map((f) => (f < 0 ? "x" : String(f))).join(frets.some((f) => f > 9) ? " " : "");
