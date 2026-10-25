import { test } from "node:test";
import assert from "node:assert/strict";
import { parseChord } from "./parse.ts";
import { HIGH, LOW, voicings, voicingNames } from "./voicings.ts";

const CHORDS = ["C", "Am", "G7", "Cmaj7", "Dm7", "Csus4", "Csus2", "Cdim", "Cdim7", "Caug", "Cadd9", "Cm7b5", "C6", "C9", "C7sus4", "Cmaj13", "Bb", "Bbm9", "F#m7b5", "G#dim7", "D/F#", "C/E", "Am/C", "B", "E7", "Ebm7", "Ab", "Db", "G"];

test("every supported chord yields 1 to 4 voicings inside the keyboard", () => {
  for (const t of CHORDS) {
    const c = parseChord(t);
    assert.ok(c, `${t} must parse`);
    const vs = voicings(c);
    assert.ok(vs.length >= 1 && vs.length <= 4, `${t} -> ${vs.length}`);
    for (const v of vs) {
      assert.ok(v.keys.length >= 2, `${t} ${v.name} too few notes`);
      for (let i = 0; i < v.keys.length; i++) {
        assert.ok(v.keys[i] >= LOW && v.keys[i] <= HIGH, `${t} ${v.name} key ${v.keys[i]} outside ${LOW}-${HIGH}`);
        if (i > 0) assert.ok(v.keys[i] > v.keys[i - 1], `${t} ${v.name} keys not ascending: ${v.keys}`);
      }
      assert.ok(v.keys[v.keys.length - 1] - v.keys[0] <= HIGH - LOW, `${t} ${v.name} span too wide`);
    }
  }
});

test("voicings are never duplicated and carry distinct names", () => {
  for (const t of CHORDS) {
    const vs = voicings(parseChord(t)!);
    const ids = vs.map((v) => v.keys.join(","));
    assert.equal(new Set(ids).size, ids.length, `${t} duplicate voicing`);
    const names = vs.map((v) => v.name);
    assert.equal(new Set(names).size, names.length, `${t} duplicate name ${names}`);
  }
});

test("root position is first for a plain triad and spells root-first", () => {
  const c = parseChord("C")!;
  const vs = voicings(c);
  assert.equal(vs[0].name, "Root position");
  assert.deepEqual(voicingNames(c, vs[0]), ["C", "E", "G"]);
  const inversions = vs.slice(1).map((v) => voicingNames(c, v).join(" "));
  assert.deepEqual(inversions, ["E G C", "G C E"]);
});

test("a triad gives three voicings, a seventh gives four", () => {
  assert.equal(voicings(parseChord("C")!).length, 3);
  assert.equal(voicings(parseChord("Am")!).length, 3);
  assert.equal(voicings(parseChord("G7")!).length, 4);
  assert.equal(voicings(parseChord("Cmaj7")!).length, 4);
});

test("a slash chord offers the bass-note voicing as well as the inversions", () => {
  const c = parseChord("D/F#")!;
  const vs = voicings(c);
  const bass = vs.find((v) => v.name === "Bass note lowest");
  assert.ok(bass, "expected a bass-note voicing");
  assert.equal(bass!.keys[0] % 12, 6); // F# is the lowest note
  assert.deepEqual(voicingNames(c, bass!), ["F#", "A", "D"]);
  assert.ok(vs.some((v) => v.name === "Root position"), "root position must still be offered");
});

test("a slash chord whose bass is already the root does not repeat that note", () => {
  const c = parseChord("C/E")!;
  const bass = voicings(c).find((v) => v.name === "Bass note lowest")!;
  assert.deepEqual(voicingNames(c, bass), ["E", "G", "C"]);
  assert.equal(new Set(bass.keys.map((k) => k % 12)).size, 3);
});

test("compound intervals stack above the octave instead of inside it", () => {
  const c = parseChord("Cmaj13")!;
  const root = voicings(c)[0];
  // C E G B D A: the 9th (D) and 13th (A) sit above the seventh (B)
  assert.deepEqual(voicingNames(c, root), ["C", "E", "G", "B", "D", "A"]);
});

test("a 9th chord keeps its ninth above the octave in root position", () => {
  const c = parseChord("C9")!;
  assert.deepEqual(voicingNames(c, voicings(c)[0]), ["C", "E", "G", "Bb", "D"]);
});

test("voicing note names use the chord's spelling preference", () => {
  const c = parseChord("Bb")!;
  assert.deepEqual(voicingNames(c, voicings(c)[0]), ["Bb", "D", "F"]);
  const sharp = parseChord("F#m")!;
  assert.deepEqual(voicingNames(sharp, voicings(sharp)[0]), ["F#", "A", "C#"]);
});

test("every inversion is a different set of pitch classes only by ordering, never by content", () => {
  const c = parseChord("G7")!;
  const sets = voicings(c).map((v) => [...new Set(v.keys.map((k) => k % 12))].sort((a, b) => a - b).join(","));
  assert.equal(new Set(sets).size, 1, "all voicings must contain the same pitch classes");
});
