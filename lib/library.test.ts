import { test } from "node:test";
import assert from "node:assert/strict";
import { byName, byTitle, songMetaLine, toSongRow, validateFields, type Fields } from "./library.ts";

const ok: Fields = { title: "Way Maker", artist: "Sinach", key: "E", rhythm: "4/4", bpm: "68", themeIds: [] };

test("validateFields accepts a complete song", () => {
  assert.equal(validateFields(ok), null);
  assert.equal(validateFields({ ...ok, artist: "", rhythm: "", bpm: "" }), null);
});

test("validateFields explains what's missing", () => {
  assert.equal(validateFields({ ...ok, title: "  " }), "Add a title.");
  assert.equal(validateFields({ ...ok, key: "H" }), "Enter a key like G, Bb or F#m.");
  assert.equal(validateFields({ ...ok, bpm: "12" }), "BPM must be a whole number from 20 to 300.");
  assert.equal(validateFields({ ...ok, rhythm: "1234567890123" }), "Rhythm is too long (12 characters max).");
});

test("toSongRow trims fields, empties to null and builds search text", () => {
  assert.deepEqual(toSongRow({ ...ok, title: " Way Maker ", artist: " ", rhythm: "", bpm: "" }, "[E]Way maker"), {
    title: "Way Maker",
    artist: null,
    song_key: "E",
    rhythm: null,
    bpm: null,
    content: "[E]Way maker",
    search_text: "way maker way maker",
  });
  assert.equal(toSongRow(ok, "[E]x").bpm, 68);
});

test("songMetaLine and sorting", () => {
  assert.equal(songMetaLine({ artist: "Sinach", song_key: "E", rhythm: "4/4", bpm: 68 }), "Sinach · Key E · 4/4 · 68 BPM");
  assert.equal(songMetaLine({ artist: null, song_key: "G", rhythm: null, bpm: null }), "Key G");
  assert.deepEqual([{ title: "b" }, { title: "A" }].sort(byTitle).map((s) => s.title), ["A", "b"]);
  assert.deepEqual([{ name: "easter" }, { name: "Advent" }].sort(byName).map((s) => s.name), ["Advent", "easter"]);
});
