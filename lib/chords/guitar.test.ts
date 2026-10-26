import { test } from "node:test";
import assert from "node:assert/strict";
import { parseChord, QUALITY } from "./parse.ts";
import { guitarVoicings, tabString } from "./guitar.ts";

const STRINGS = [40, 45, 50, 55, 59, 64]; // MIDI of open E A D G B e
const ROOTS = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];
const tabs = (t: string) => guitarVoicings(parseChord(t)!).map((v) => tabString(v.frets));

test("open chords come first and match the familiar shapes", () => {
  assert.equal(tabs("C")[0], "x32010");
  assert.equal(tabs("G")[0], "320003");
  assert.equal(tabs("Am")[0], "x02210");
  assert.equal(tabs("E")[0], "022100");
  assert.equal(tabs("D7")[0], "xx0212");
});

test("barre shapes slide to the root", () => {
  assert.ok(tabs("F").includes("133211"));
  assert.ok(tabs("Bm").includes("x24432"));
  assert.ok(tabs("Bb").includes("x13331"));
});

// Every supported quality, on every root, must be playable and only sound chord tones,
// with the root (or slash bass) lowest.
test("every supported quality has a correct guitar shape on every root", () => {
  const bad: string[] = [];
  for (const quality of Object.keys(QUALITY)) {
    for (const root of ROOTS) {
      const token = root + quality;
      const chord = parseChord(token)!;
      const shapes = guitarVoicings(chord);
      if (shapes.length < 1) bad.push(`${token} has no guitar shape`);
      const allowed = new Set(chord.pitchClasses);
      for (const { frets } of shapes) {
        if (frets.length !== 6) bad.push(`${token} needs six strings`);
        if (Math.max(...frets) > 16) bad.push(`${token} ${frets} runs off the neck`);
        const notes = frets.map((f, i) => (f < 0 ? null : STRINGS[i] + f));
        const sounded = notes.filter((n): n is number => n !== null);
        if (sounded.length < 3 && quality !== "5") bad.push(`${token} ${frets} too few strings`);
        if (sounded.some((n) => !allowed.has(n % 12))) bad.push(`${token} ${frets} sounds a wrong note`);
        if (Math.min(...sounded) % 12 !== chord.root) bad.push(`${token} ${frets} root is not lowest`);
        const third = chord.intervals.some((i) => i === 2 || i === 3 || i === 4 || i === 5);
        if (third) {
          const present = sounded.some((n) => [2, 3, 4, 5].includes((n - chord.root + 120) % 12));
          if (!present) bad.push(`${token} ${frets} lacks its third`);
        }
      }
    }
  }
  assert.deepEqual(bad, []);
});

test("slash chords re-bass the shape", () => {
  for (const token of ["C/E", "C/G", "D/F#", "G/B", "Am/C", "Am/E", "F/A", "C/Bb", "C/D", "Dm7/G", "Em/B"]) {
    const chord = parseChord(token)!;
    const shapes = guitarVoicings(chord);
    assert.ok(shapes.length >= 1, `${token} has no guitar shape`);
    for (const { frets } of shapes) {
      const sounded = frets.map((f, i) => (f < 0 ? null : STRINGS[i] + f)).filter((n): n is number => n !== null);
      assert.equal(Math.min(...sounded) % 12, chord.bass, `${token} ${frets} bass is not lowest`);
    }
  }
  assert.equal(tabs("C/G")[0], "332010");
});
