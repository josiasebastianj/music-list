import { test } from "node:test";
import assert from "node:assert/strict";
import { noteName, parseChord, spellTone } from "./parse.ts";

const spelled = (token: string) => {
  const c = parseChord(token)!;
  return c.pitchClasses.map((pc, i) => spellTone(c.rootLetter, c.degrees[i], pc));
};

test("parseChord reads root, intervals and pitch classes", () => {
  assert.deepEqual(parseChord("C")!.intervals, [0, 4, 7]);
  assert.deepEqual(parseChord("Am")!.intervals, [0, 3, 7]);
  assert.deepEqual(parseChord("G7")!.intervals, [0, 4, 7, 10]);
  assert.deepEqual(parseChord("Cmaj7")!.intervals, [0, 4, 7, 11]);
  assert.deepEqual(parseChord("Csus4")!.intervals, [0, 5, 7]);
  assert.deepEqual(parseChord("Csus2")!.intervals, [0, 2, 7]);
  assert.deepEqual(parseChord("Cdim")!.intervals, [0, 3, 6]);
  assert.deepEqual(parseChord("Cdim7")!.intervals, [0, 3, 6, 9]);
  assert.deepEqual(parseChord("Caug")!.intervals, [0, 4, 8]);
  assert.deepEqual(parseChord("Cm7b5")!.intervals, [0, 3, 6, 10]);
  assert.deepEqual(parseChord("C7sus4")!.intervals, [0, 5, 7, 10]);
  assert.deepEqual(parseChord("G7")!.pitchClasses, [7, 11, 2, 5]);
  assert.deepEqual(parseChord("Dm7")!.pitchClasses, [2, 5, 9, 0]);
});

test("parseChord keeps compound intervals compound", () => {
  assert.deepEqual(parseChord("Cadd9")!.intervals, [0, 4, 7, 14]);
  assert.deepEqual(parseChord("C9")!.intervals, [0, 4, 7, 10, 14]);
  assert.deepEqual(parseChord("Cmaj13")!.intervals, [0, 4, 7, 11, 14, 21]);
  assert.deepEqual(parseChord("C11")!.intervals, [0, 4, 7, 10, 14, 17]);
});

test("parseChord reads accidentals, root letter and slash bass", () => {
  assert.equal(parseChord("F#")!.root, 6);
  assert.equal(parseChord("F#")!.rootLetter, "F");
  assert.equal(parseChord("Bb")!.root, 10);
  assert.equal(parseChord("Bb")!.rootLetter, "B");
  assert.equal(parseChord("Cb")!.root, 11);
  assert.equal(parseChord("B#")!.root, 0);
  assert.equal(parseChord("D/F#")!.bass, 6);
  assert.equal(parseChord("C/E")!.bass, 4);
  assert.equal(parseChord("Am/C")!.bass, 0);
  assert.equal(parseChord("C")!.bass, null);
});

test("parseChord rejects unsupported tokens", () => {
  for (const bad of ["", "N.C.", "x2", "[x2]", "|", ".", "H", "Cxyz", "Add", "Be", "Hello", "C/H"]) {
    assert.equal(parseChord(bad), null, bad);
  }
});

test("spelling follows the degree, so C9 gives Bb not A#", () => {
  assert.deepEqual(spelled("C"), ["C", "E", "G"]);
  assert.deepEqual(spelled("Am"), ["A", "C", "E"]);
  assert.deepEqual(spelled("G7"), ["G", "B", "D", "F"]);
  assert.deepEqual(spelled("C9"), ["C", "E", "G", "Bb", "D"]);
  assert.deepEqual(spelled("Cmaj13"), ["C", "E", "G", "B", "D", "A"]);
  assert.deepEqual(spelled("Cadd9"), ["C", "E", "G", "D"]);
  assert.deepEqual(spelled("Csus4"), ["C", "F", "G"]);
});

test("spelling follows the root's letter, so Bb major is not Cbb", () => {
  assert.deepEqual(spelled("Bb"), ["Bb", "D", "F"]);
  assert.deepEqual(spelled("Ab"), ["Ab", "C", "Eb"]);
  assert.deepEqual(spelled("Db"), ["Db", "F", "Ab"]);
  assert.deepEqual(spelled("Ebm7"), ["Eb", "Gb", "Bb", "Db"]);
  assert.deepEqual(spelled("Bbm9"), ["Bb", "Db", "F", "Ab", "C"]);
  assert.deepEqual(spelled("F#m"), ["F#", "A", "C#"]);
  assert.deepEqual(spelled("B"), ["B", "D#", "F#"]);
  assert.deepEqual(spelled("E7"), ["E", "G#", "B", "D"]);
  assert.deepEqual(spelled("F#m7b5"), ["F#", "A", "C", "E"]);
  assert.deepEqual(spelled("G#dim7"), ["G#", "B", "D", "F"]);
});

test("double flats appear only where theory requires them", () => {
  assert.deepEqual(spelled("Cdim7"), ["C", "Eb", "Gb", "Bbb"]);
});

test("noteName spells sharps or flats", () => {
  assert.equal(noteName(0, false), "C");
  assert.equal(noteName(1, false), "C#");
  assert.equal(noteName(1, true), "Db");
  assert.equal(noteName(10, true), "Bb");
});
