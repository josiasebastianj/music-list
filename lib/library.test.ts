import { test } from "node:test";
import assert from "node:assert/strict";
import { SAVED, byName, byTitle, draftFrom, draftStatus, isConfirmed, isReady, songMetaLine, toSongRow, validateFields, type Fields } from "./library.ts";

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

test("draftFrom reads a pasted chord sheet with tempo and time", () => {
  const d = draftFrom("Pasted text", "Way Maker\nKey: E\nTempo: 68\nTime: 4/4\n\nVerse 1:\nE       B\nYou are here", "");
  assert.equal(d.fields.title, "Way Maker");
  assert.equal(d.fields.key, "E");
  assert.equal(d.fields.rhythm, "4/4");
  assert.equal(d.fields.bpm, "68");
  assert.equal(d.keyConfirmed, true);
  assert.deepEqual(d.sections, ["Verse 1"]);
  assert.ok(!d.content.includes("Tempo"));
  assert.equal(draftStatus(d).text, "Ready");
});

test("draftFrom falls back to the file name and guesses a missing key", () => {
  const d = draftFrom("amazing.cho", "[G]Amazing [C]grace", "amazing");
  assert.equal(d.fields.title, "amazing");
  assert.equal(d.fields.key, "G");
  assert.equal(d.keyConfirmed, false);
  assert.equal(draftStatus(d).text, "Needs a key");
});

test("draftStatus reports unreadable, duplicate, title and bpm problems", () => {
  assert.equal(draftStatus(draftFrom("x", "{title: X}", "x")).text, "Couldn't read it");
  const ok = draftFrom("p", "Song\nKey: G\nG\nHi", "");
  assert.equal(draftStatus(ok).text, "Ready");
  assert.equal(draftStatus({ ...ok, duplicate: true }).text, "Already in library");
  assert.equal(draftStatus({ ...ok, fields: { ...ok.fields, title: "" } }).text, "Needs a title");
  assert.equal(draftStatus({ ...ok, fields: { ...ok.fields, bpm: "500" } }).text, "BPM must be a whole number from 20 to 300.");
  assert.equal(draftStatus({ ...ok, result: SAVED }).text, SAVED);
});

test("draftFrom defaults rhythm to 4/4 and leaves BPM empty", () => {
  const d = draftFrom("p", "Song\nKey: G\nG\nHi", "");
  assert.equal(d.fields.rhythm, "4/4");
  assert.equal(d.fields.bpm, "");
  assert.equal(draftFrom("p", "Song\nKey: G\nTime: 6/8\nG\nHi", "").fields.rhythm, "6/8");
});

test("a ready draft must be confirmed before it is saved", () => {
  const d = draftFrom("p", "Song\nKey: G\nG\nHi", "");
  assert.equal(d.confirmed, false);
  assert.ok(isReady(d));
  assert.ok(!isConfirmed(d));
  const c = { ...d, confirmed: true };
  assert.equal(draftStatus(c).text, "Confirmed");
  assert.ok(isConfirmed(c));
  assert.ok(!isReady(c));
  assert.equal(draftStatus({ ...c, fields: { ...c.fields, title: "" } }).text, "Needs a title");
  assert.equal(draftStatus({ ...c, result: SAVED }).text, SAVED);
});
