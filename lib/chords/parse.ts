export type ChordSymbol = {
  text: string;
  root: number;
  rootLetter: string; // the letter the root is written on: "B" for Bb, "F" for F#
  bass: number | null;
  intervals: number[];
  degrees: number[];
  flats: boolean;
  pitchClasses: number[];
};

const SHARPS = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const FLATS = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];

const ROOT_PC: Record<string, number> = {};
SHARPS.forEach((n, i) => (ROOT_PC[n] = i));
FLATS.forEach((n, i) => (ROOT_PC[n] = i));
ROOT_PC["Cb"] = 11;
ROOT_PC["Fb"] = 4;
ROOT_PC["E#"] = 5;
ROOT_PC["B#"] = 0;

// [semitone interval, diatonic degree]. The degree is what makes spelling
// correct: C9's seventh is the 7th degree, so it is spelled Bb, never A#.
type Tone = [number, number];
const QUALITY: Record<string, Tone[]> = {
  "": [[0, 1], [4, 3], [7, 5]],
  maj: [[0, 1], [4, 3], [7, 5]], M: [[0, 1], [4, 3], [7, 5]],
  m: [[0, 1], [3, 3], [7, 5]], min: [[0, 1], [3, 3], [7, 5]],
  dim: [[0, 1], [3, 3], [6, 5]], aug: [[0, 1], [4, 3], [8, 5]],
  "5": [[0, 1], [7, 5]],
  sus2: [[0, 1], [2, 2], [7, 5]], sus4: [[0, 1], [5, 4], [7, 5]], sus: [[0, 1], [5, 4], [7, 5]],
  "6": [[0, 1], [4, 3], [7, 5], [9, 6]], m6: [[0, 1], [3, 3], [7, 5], [9, 6]],
  "7": [[0, 1], [4, 3], [7, 5], [10, 7]], maj7: [[0, 1], [4, 3], [7, 5], [11, 7]], M7: [[0, 1], [4, 3], [7, 5], [11, 7]],
  m7: [[0, 1], [3, 3], [7, 5], [10, 7]], mMaj7: [[0, 1], [3, 3], [7, 5], [11, 7]], mmaj7: [[0, 1], [3, 3], [7, 5], [11, 7]],
  dim7: [[0, 1], [3, 3], [6, 5], [9, 7]], m7b5: [[0, 1], [3, 3], [6, 5], [10, 7]], "7sus4": [[0, 1], [5, 4], [7, 5], [10, 7]],
  add9: [[0, 1], [4, 3], [7, 5], [14, 9]], add11: [[0, 1], [4, 3], [7, 5], [17, 11]],
  "9": [[0, 1], [4, 3], [7, 5], [10, 7], [14, 9]], maj9: [[0, 1], [4, 3], [7, 5], [11, 7], [14, 9]],
  M9: [[0, 1], [4, 3], [7, 5], [11, 7], [14, 9]], m9: [[0, 1], [3, 3], [7, 5], [10, 7], [14, 9]],
  "11": [[0, 1], [4, 3], [7, 5], [10, 7], [14, 9], [17, 11]], m11: [[0, 1], [3, 3], [7, 5], [10, 7], [14, 9], [17, 11]],
  "13": [[0, 1], [4, 3], [7, 5], [10, 7], [14, 9], [21, 13]], m13: [[0, 1], [3, 3], [7, 5], [10, 7], [14, 9], [21, 13]],
  maj13: [[0, 1], [4, 3], [7, 5], [11, 7], [14, 9], [21, 13]], M13: [[0, 1], [4, 3], [7, 5], [11, 7], [14, 9], [21, 13]],
};

const LETTERS = ["C", "D", "E", "F", "G", "A", "B"];
const LETTER_PC: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

const mod12 = (n: number) => ((n % 12) + 12) % 12;

export function parseChord(token: string): ChordSymbol | null {
  const m = /^([A-G](?:#|b)?)([^/]*)(?:\/([A-G](?:#|b)?))?$/.exec(token.trim());
  if (!m) return null;
  const root = ROOT_PC[m[1]];
  if (root === undefined) return null;
  const quality = QUALITY[m[2]];
  if (quality === undefined) return null;
  let bass: number | null = null;
  if (m[3] !== undefined) {
    const b = ROOT_PC[m[3]];
    if (b === undefined) return null;
    bass = b;
  }
  return {
    text: token.trim(),
    root,
    rootLetter: m[1][0],
    bass,
    intervals: quality.map(([s]) => s),
    degrees: quality.map(([, d]) => d),
    flats: m[1].includes("b"),
    pitchClasses: quality.map(([s]) => mod12(root + s)),
  };
}

/** Spell a chord tone by its diatonic degree.
 *
 *  The root's LETTER comes from the token, never from its pitch class: Bb and
 *  A# are the same pitch but different letters, and deriving the letter from
 *  the number turns Bb major into Cbb-Ebb-Gbb. This is also why C9 gives Bb
 *  (7th degree) rather than A# (a chromatic 6th). */
export function spellTone(rootLetter: string, degree: number, pc: number): string {
  const base = LETTERS.indexOf(rootLetter);
  if (base === -1) return SHARPS[mod12(pc)];
  const letter = LETTERS[(base + degree - 1) % 7];
  let diff = mod12(pc) - LETTER_PC[letter];
  if (diff > 6) diff -= 12;
  if (diff < -6) diff += 12;
  if (diff === 0) return letter;
  if (diff > 0) return letter + "#".repeat(diff);
  return letter + "b".repeat(-diff);
}

export function noteName(pc: number, flats: boolean): string {
  return (flats ? FLATS : SHARPS)[mod12(pc)];
}
