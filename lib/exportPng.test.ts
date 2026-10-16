import { test } from "node:test";
import assert from "node:assert/strict";
import { exportFileName, layoutChordLine } from "./exportPng.ts";

const measure = (s: string) => s.length * 10;

test("places chords over their syllable", () => {
  assert.deepEqual(
    layoutChordLine([{ text: "A" }, { chord: "G", text: "mazing " }, { chord: "G7", text: "grace" }], 1000, measure),
    [{
      chords: [{ x: 10, text: "G" }, { x: 80, text: "G7" }],
      lyrics: [{ x: 0, text: "A" }, { x: 10, text: "mazing " }, { x: 80, text: "grace" }],
    }],
  );
});

test("chord wider than its text pushes the next segment", () => {
  const rows = layoutChordLine([{ chord: "Cmaj7", text: "a" }, { chord: "G", text: "b" }], 1000, measure);
  assert.equal(rows[0].lyrics[1].x, 60);
});

test("wraps between segments", () => {
  const seg = { text: "aaaa " };
  const rows = layoutChordLine([seg, seg, seg], 120, measure);
  assert.equal(rows.length, 2);
  assert.equal(rows[1].lyrics[0].x, 0);
});

test("oversize segment wraps words", () => {
  const rows = layoutChordLine([{ chord: "D", text: "one two three four" }], 80, measure);
  const lyrics = rows.flatMap((r) => r.lyrics);
  assert.ok(rows.length > 1);
  for (const l of lyrics) assert.ok(measure(l.text) <= 80, l.text);
  assert.equal(lyrics.map((l) => l.text.trim()).join(" ").replace(/\s+/g, " "), "one two three four");
  assert.deepEqual(rows[0].chords, [{ x: 0, text: "D" }]);
  for (const r of rows.slice(1)) assert.equal(r.chords.length, 0);
});

test("file names", () => {
  assert.equal(exportFileName("Amazing Grace", "notes"), "Amazing Grace.png");
  assert.equal(exportFileName("Amazing Grace", "lyrics"), "Amazing Grace - Lyrics.png");
  assert.equal(exportFileName("Amazing Grace", "chords"), "Amazing Grace - Chords.png");
  assert.equal(exportFileName("AC/DC: Live?", "chords"), "AC-DC- Live- - Chords.png");
  assert.equal(exportFileName("  ", "notes"), "song-structure.png");
});
