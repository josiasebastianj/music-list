import { test } from "node:test";
import assert from "node:assert/strict";
import {
  fromChordsAboveLyrics,
  guessKey,
  isChord,
  isChordProText,
  keyStep,
  lyricLines,
  normalizeSearch,
  parseChordPro,
  searchText,
  sectionLabels,
  transpose,
} from "./chordpro.ts";

const WAY_MAKER = [
  "{title: Way Maker}",
  "{artist: Sinach}",
  "{key: E}",
  "{start_of_grid: Intro}",
  "| E . . . | B . . . |",
  "{end_of_grid}",
  "{sov: Verse 1}",
  "You are [E]here, moving in our [B]midst",
  "{eov}",
  "{comment: Chorus}",
  "Way [E]maker [x2]",
].join("\n");

test("isChord accepts chords and rejects words and markers", () => {
  for (const c of ["E", "C#m", "Bb", "Ebm7", "Gmaj7", "Asus4", "Cadd9", "D/F#", "F#m7b5", "Bdim", "Caug", "E7"]) assert.ok(isChord(c), c);
  for (const w of ["N.C.", "x2", "|", ".", "Add", "Be", "Hello", "[E]", ""]) assert.ok(!isChord(w), w);
});

test("keyStep moves keys and spells them by key", () => {
  assert.equal(keyStep("B", 1), "C");
  assert.equal(keyStep("C", -1), "B");
  assert.equal(keyStep("E", -1), "Eb");
  assert.equal(keyStep("C", 1), "Db");
  assert.equal(keyStep("F", 1), "Gb");
  assert.equal(keyStep("C#m", 1), "Dm");
  assert.equal(keyStep("Am", 1), "Bbm");
  assert.equal(keyStep("Fm", 1), "F#m");
  assert.equal(keyStep("E", 0), "E");
  assert.equal(keyStep("H", 1), null);
  assert.equal(keyStep("", 1), null);
});

test("transpose uses flats in flat keys and rewrites {key}", () => {
  assert.equal(
    transpose("{key: E}\n[E]Way [B]maker, [C#m]miracle [A]worker", "E", "Eb"),
    "{key: Eb}\n[Eb]Way [Bb]maker, [Cm]miracle [Ab]worker",
  );
});

test("transpose handles slash chords, qualities and unknown tokens", () => {
  assert.equal(transpose("[D/F#]go [Gmaj7]on [Asus4]and [Cadd9]on [Bm7]now [N.C.]stop [x2]", "D", "E"), "[E/G#]go [Amaj7]on [Bsus4]and [Dadd9]on [C#m7]now [N.C.]stop [x2]");
});

test("transpose shifts grid lines, inside grid blocks and bare | lines", () => {
  const text = "{start_of_grid}\nE . . . D . . .\n{end_of_grid}\n| E . . . | D . . . |";
  assert.equal(transpose(text, "E", "F"), "{start_of_grid}\nF . . . Eb . . .\n{end_of_grid}\n| F . . . | Eb . . . |");
});

test("transpose returns the text unchanged for unknown or equal keys", () => {
  assert.equal(transpose(WAY_MAKER, "E", "H"), WAY_MAKER);
  assert.equal(transpose(WAY_MAKER, "?", "E"), WAY_MAKER);
  assert.equal(transpose(WAY_MAKER, "E", "E"), WAY_MAKER);
});

test("twelve steps up return the original", () => {
  const original = "{key: E}\n[E]Way [B]maker, [C#m]miracle [A]worker [G#m7]light [F#/A#]keeper\n| E . . . | B . . . |";
  let text = original;
  let key = "E";
  for (let i = 0; i < 12; i++) {
    const next = keyStep(key, 1)!;
    text = transpose(text, key, next);
    key = next;
  }
  assert.equal(key, "E");
  assert.equal(text, original);
});

test("parseChordPro reads directives, grids, sections and stray brackets", () => {
  const song = parseChordPro(WAY_MAKER);
  assert.equal(song.title, "Way Maker");
  assert.equal(song.artist, "Sinach");
  assert.equal(song.key, "E");
  assert.deepEqual(song.sections, [
    { label: "Intro", kind: "grid", lines: [{ type: "grid", cells: ["|", "E", ".", ".", ".", "|", "B", ".", ".", ".", "|"] }] },
    {
      label: "Verse 1",
      kind: "lyrics",
      lines: [{ type: "lyrics", segments: [{ text: "You are " }, { chord: "E", text: "here, moving in our " }, { chord: "B", text: "midst" }] }],
    },
    { label: "Chorus", kind: "lyrics", lines: [{ type: "lyrics", segments: [{ text: "Way " }, { chord: "E", text: "maker [x2]" }] }] },
  ]);
});

test("parseChordPro splits unlabelled text on blank lines and handles CRLF", () => {
  const song = parseChordPro("Line one\r\nLine two\r\n\r\nLine three");
  assert.deepEqual(song.sections.map((s) => s.lines.length), [2, 1]);
  assert.deepEqual(song.sections.map((s) => s.label), ["", ""]);
});

test("lyricLines drops chords and grid-only sections", () => {
  assert.deepEqual(lyricLines(parseChordPro(WAY_MAKER)), [
    { label: "Verse 1", lines: ["You are here, moving in our midst"] },
    { label: "Chorus", lines: ["Way maker [x2]"] },
  ]);
});

test("sectionLabels lists labelled sections in order", () => {
  assert.deepEqual(sectionLabels(WAY_MAKER), ["Intro", "Verse 1", "Chorus"]);
});

test("searchText and normalizeSearch agree on punctuation, case and accents", () => {
  assert.equal(searchText("Way Maker", WAY_MAKER), "way maker you are here moving in our midst way maker x2");
  assert.equal(searchText("Hosana", "[D]Ho-sa-na, Kau Raja-ku\n[G]Tuhan yang [A]mulia é"), "hosana ho sa na kau raja ku tuhan yang mulia é");
  assert.equal(normalizeSearch("  Moving, in OUR... midst! "), "moving in our midst");
  assert.ok(searchText("Way Maker", WAY_MAKER).includes(normalizeSearch("HERE, moving")));
});

test("isChordProText detects directives or chord marks only", () => {
  assert.ok(isChordProText("{title: X}\nhello"));
  assert.ok(isChordProText("You are [E]here"));
  assert.ok(!isChordProText("Hello [Chorus]\nworld"));
  assert.ok(!isChordProText("E    B\nYou are here"));
});

test("guessKey takes the first chord and keeps minor", () => {
  assert.equal(guessKey(parseChordPro(WAY_MAKER)), "E");
  assert.equal(guessKey(parseChordPro("Hello [C#m7]world [E]x")), "C#m");
  assert.equal(guessKey(parseChordPro("[Cmaj7]Hi")), "C");
  assert.equal(guessKey(parseChordPro("no chords here")), null);
});

test("fromChordsAboveLyrics converts a plain chord sheet", () => {
  const plain = ["Way Maker", "Key: E", "", "Intro", "E    B    C#m   A", "", "Verse 1:", "E               B", "You are here, moving in our midst"].join("\n");
  assert.equal(
    fromChordsAboveLyrics(plain, "file"),
    ["{title: Way Maker}", "{key: E}", "", "{comment: Intro}", "| E B C#m A |", "", "{comment: Verse 1}", "[E]You are here, mo[B]ving in our midst"].join("\n"),
  );
});

test("fromChordsAboveLyrics falls back to the filename and keeps bar lines", () => {
  assert.equal(fromChordsAboveLyrics("E       B\nYou are here", "way-maker"), "{title: way-maker}\n[E]You are [B]here");
  assert.equal(fromChordsAboveLyrics("Song\n| E . . . | D . . . |\nLa la", "f"), "{title: Song}\n| E . . . | D . . . |\nLa la");
});

test("fromChordsAboveLyrics handles CRLF, tabs and bracketed headings", () => {
  assert.equal(fromChordsAboveLyrics("Title\r\nE\r\nHello\r\n", "f"), "{title: Title}\n[E]Hello");
  assert.equal(fromChordsAboveLyrics("Song\nE\tD\nHello there world", "f"), "{title: Song}\n[E]Hello th[D]ere world");
  assert.equal(fromChordsAboveLyrics("Song\n[Chorus]\nD\nSing", "f"), "{title: Song}\n{comment: Chorus}\n[D]Sing");
});

test("a converted sheet parses back into sections", () => {
  const plain = ["Way Maker", "Intro", "E    B", "", "Verse 1:", "E       B", "You are here"].join("\n");
  const song = parseChordPro(fromChordsAboveLyrics(plain, "f"));
  assert.equal(song.title, "Way Maker");
  assert.deepEqual(song.sections.map((s) => s.label), ["Intro", "Verse 1"]);
});

test("fromChordsAboveLyrics keeps lyric lines ending in a colon", () => {
  assert.equal(fromChordsAboveLyrics("Song\nD\nAnd He said:\nG\nCome to me", "f"), "{title: Song}\n[D]And He said:\n[G]Come to me");
  assert.equal(fromChordsAboveLyrics("Song\nCoda:\nE  B\nLa la", "f"), "{title: Song}\n{comment: Coda}\n[E]La [B]la");
  assert.equal(fromChordsAboveLyrics("Song\nChorus:\nSing", "f"), "{title: Song}\n{comment: Chorus}\nSing");
  assert.equal(fromChordsAboveLyrics("Song\nLa la\nEnd:", "f"), "{title: Song}\nLa la\n{comment: End}");
});

test("parseChordPro skips tab blocks", () => {
  const song = parseChordPro("{sov: Verse}\nHello [E]world\n{sot}\ne|--0--|\nB|--1--|\n{eot}\nAgain");
  assert.deepEqual(lyricLines(song), [{ label: "Verse", lines: ["Hello world", "Again"] }]);
});
