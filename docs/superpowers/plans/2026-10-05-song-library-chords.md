# Song Library, Lyrics & Chords Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a shared song library (bulk upload of ChordPro or plain chord sheets), lyric search in Add Song that imports a song's lyrics, chords and key into an event, three song tabs (Lyrics Only, Lyrics + Chords, Section Notes), and chord transposition with − and + key buttons.

**Architecture:** Songs are stored as ChordPro text, both in a new `songs` table and as an editable copy inside each event song (`events.data.songs[].content`). A dependency-free `lib/chordpro.ts` parses, converts, transposes and builds search text, and is unit-tested with `node --test`. The UI adds an upload page, an Add Song search dialog, a tabbed song view and a key control. Section Notes move into their own component so `EventEditor.tsx` stays under ~400 lines.

**Tech Stack:** Next.js 16 (App Router, TypeScript), React 19, Supabase (`@supabase/ssr`, Postgres `pg_trgm`), Node 24 `node --test`.

**Spec:** `docs/superpowers/specs/2026-10-05-song-library-chords-design.md`

## Global Constraints

- **Dependencies:** no new runtime or dev dependencies.
- **Stored format:** ChordPro is the stored format. Bar notation is a grid block (`{start_of_grid}` … `{end_of_grid}`) or any line starting with `|`.
- **Event key:** an event song's `content` is always written in its current `baseKey`. ± rewrites it with `transpose`.
- **Spelling:** flat keys (F, Bb, Eb, Ab, Db, Gb and Dm, Gm, Cm, Fm, Bbm, Ebm) spell chords with flats; all other keys use sharps.
- **Search:** needs at least 3 characters after normalisation. Normalisation means lowercase, with every run of non-letter, non-digit characters turned into one space. It must be identical in `lib/chordpro.ts` (`normalizeSearch`) and SQL (`[^[:alnum:]]+`).
- **CSS:** the v2.4.0 CSS in `app/globals.css` is never edited. New CSS is appended at the end and uses the existing variables (`--text`, `--muted`, `--line`, `--line-strong`, `--surface`, `--surface-2`, `--accent`, `--accent-soft`, `--danger`, `--r-sm`).
- **Phone width:** pages must work at ≤680px with no horizontal page scroll. Wide tables scroll inside their own wrapper.
- **localStorage:** `setlistApp_songTab` stores the last chosen tab. Every access is wrapped in try/catch.
- **Database changes:** Supabase SQL is never run by implementers. The user runs `supabase/migrations/004_song_library.sql` in the SQL Editor.
- **Commits:** end every message with a blank line followed by `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Never stage `music-list-2.3.0.html`.
- **Branch:** `features/chordlist`. Check `git branch --show-current` before each commit.

## Review Focus

1. **Long lyric lines with chords on a 375px phone.** Chords must stay above their syllable and lines wrap with no page scroll. *(Task 4, manual Step 9.)*
2. **Pressing ± many times in a row.** Chords must not drift. Twelve +1 steps return the original text. *(Task 1, test "twelve steps up return the original".)*
3. **Plain chord sheets saved on Windows or typed with tabs, with headings like `[Chorus]`.** They must convert with chords in the right columns. *(Task 1, tests for CRLF, tabs and bracketed headings.)*
4. **Lyrics with punctuation, capitals or accents (é, ü).** A search typed without them must still match. *(Task 1, `searchText` / `normalizeSearch` test with accents.)*
5. **The same song uploaded twice in one batch, or a song already in the library.** It must be reported as "Already in library" and skipped, and the other files must still save. *(Task 2, manual Step 8.)*

---

### Task 1: Chord engine

**Files:**
- Create: `lib/chordpro.ts`
- Create: `lib/chordpro.test.ts`
- Modify: `package.json` (the `test` script)

**Interfaces:**
- Consumes: nothing. It imports nothing, so `node --test` can load it directly.
- Produces (all exported from `lib/chordpro.ts`):
  - Types:
    - `type Segment = { chord?: string; text: string }`
    - `type ChordLine = { type: "lyrics"; segments: Segment[] } | { type: "grid"; cells: string[] }`
    - `type ParsedSection = { label: string; kind: "lyrics" | "grid"; lines: ChordLine[] }`
    - `type ParsedSong = { title: string; artist: string; key: string; sections: ParsedSection[] }`
  - Functions:
    - `isChord(token: string): boolean`
    - `keyStep(key: string, steps: number): string | null`
    - `transpose(text: string, from: string, to: string): string`
    - `parseChordPro(text: string): ParsedSong`
    - `lyricLines(song: ParsedSong): { label: string; lines: string[] }[]`
    - `sectionLabels(text: string): string[]`
    - `normalizeSearch(s: string): string`
    - `searchText(title: string, text: string): string`
    - `isChordProText(text: string): boolean`
    - `guessKey(song: ParsedSong): string | null`
    - `fromChordsAboveLyrics(text: string, fallbackTitle: string): string`

- [ ] **Step 1: Point `npm test` at both test files**

In `package.json`, change the `test` script to:

```json
"test": "node --test lib/event.test.ts lib/chordpro.test.ts"
```

- [ ] **Step 2: Write the failing tests** in `lib/chordpro.test.ts`

```ts
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
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npm test`
Expected: FAIL. The `chordpro.test.ts` file errors with `Cannot find module` … `lib/chordpro.ts`. The `event.test.ts` tests still pass.

- [ ] **Step 4: Write `lib/chordpro.ts`**

```ts
// ChordPro helpers: parse, convert plain "chords above lyrics" sheets, transpose, build search text.
// No imports, so `node --test` can load this file directly.

export type Segment = { chord?: string; text: string };
export type ChordLine = { type: "lyrics"; segments: Segment[] } | { type: "grid"; cells: string[] };
export type ParsedSection = { label: string; kind: "lyrics" | "grid"; lines: ChordLine[] };
export type ParsedSong = { title: string; artist: string; key: string; sections: ParsedSection[] };

const SHARPS = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const FLATS = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];
const NOTE_INDEX: Record<string, number> = { Cb: 11, Fb: 4, "E#": 5, "B#": 0 };
SHARPS.forEach((n, i) => (NOTE_INDEX[n] = i));
FLATS.forEach((n, i) => (NOTE_INDEX[n] = i));
const FLAT_MAJOR = new Set(["F", "Bb", "Eb", "Ab", "Db", "Gb"]);
const FLAT_MINOR = new Set(["Dm", "Gm", "Cm", "Fm", "Bbm", "Ebm"]);

const CHORD_RE = /^([A-G](?:#|b)?)((?:maj|min|dim|aug|sus|add|m|M|[0-9]|[#b+°ø()-])*)(?:\/([A-G](?:#|b)?))?$/;
const DIRECTIVE_RE = /^\{\s*([A-Za-z_]+)\s*(?::\s*(.*?))?\s*\}$/;

const mod12 = (n: number) => ((n % 12) + 12) % 12;

export function isChord(token: string) {
  return CHORD_RE.test(token);
}

function parseKey(key: string): { root: number; minor: boolean } | null {
  const m = /^([A-G](?:#|b)?)(m)?$/.exec(key.trim());
  if (!m || NOTE_INDEX[m[1]] === undefined) return null;
  return { root: NOTE_INDEX[m[1]], minor: !!m[2] };
}

function usesFlats(root: number, minor: boolean) {
  return minor ? FLAT_MINOR.has(FLATS[root] + "m") : FLAT_MAJOR.has(FLATS[root]);
}

export function keyStep(key: string, steps: number): string | null {
  const k = parseKey(key);
  if (!k) return null;
  const root = mod12(k.root + steps);
  return (usesFlats(root, k.minor) ? FLATS : SHARPS)[root] + (k.minor ? "m" : "");
}

function transposeChord(token: string, steps: number, flats: boolean) {
  const m = CHORD_RE.exec(token);
  if (!m) return token;
  const names = flats ? FLATS : SHARPS;
  const shift = (note: string) => names[mod12(NOTE_INDEX[note] + steps)];
  return shift(m[1]) + m[2] + (m[3] ? "/" + shift(m[3]) : "");
}

export function transpose(text: string, from: string, to: string): string {
  const f = parseKey(from);
  const t = parseKey(to);
  if (!f || !t || from.trim() === to.trim()) return text;
  const steps = t.root - f.root;
  const flats = usesFlats(t.root, t.minor);
  let inGrid = false;
  return text
    .split("\n")
    .map((line) => {
      const trimmed = line.trim();
      const d = DIRECTIVE_RE.exec(trimmed);
      if (d) {
        const name = d[1].toLowerCase();
        if (name === "key") return `{key: ${to.trim()}}`;
        if (name === "start_of_grid" || name === "sog") inGrid = true;
        if (name === "end_of_grid" || name === "eog") inGrid = false;
        return line;
      }
      if (inGrid || trimmed.startsWith("|")) return line.replace(/\S+/g, (tok) => transposeChord(tok, steps, flats));
      return line.replace(/\[([^\]]+)\]/g, (whole, chord: string) => (isChord(chord) ? `[${transposeChord(chord, steps, flats)}]` : whole));
    })
    .join("\n");
}

const SECTION_STARTS: Record<string, { kind: "lyrics" | "grid"; label: string }> = {
  start_of_verse: { kind: "lyrics", label: "Verse" },
  sov: { kind: "lyrics", label: "Verse" },
  start_of_chorus: { kind: "lyrics", label: "Chorus" },
  soc: { kind: "lyrics", label: "Chorus" },
  start_of_bridge: { kind: "lyrics", label: "Bridge" },
  sob: { kind: "lyrics", label: "Bridge" },
  start_of_grid: { kind: "grid", label: "" },
  sog: { kind: "grid", label: "" },
};
const SECTION_ENDS = new Set(["end_of_verse", "eov", "end_of_chorus", "eoc", "end_of_bridge", "eob", "end_of_grid", "eog"]);
const HEADING_DIRECTIVES = new Set(["comment", "c", "comment_italic", "ci"]);

function parseSegments(line: string): Segment[] {
  const segments: Segment[] = [];
  const add = (text: string) => {
    if (segments.length) segments[segments.length - 1].text += text;
    else if (text) segments.push({ text });
  };
  const re = /\[([^\]]*)\]/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(line))) {
    add(line.slice(last, m.index));
    if (isChord(m[1])) segments.push({ chord: m[1], text: "" });
    else add(m[0]);
    last = m.index + m[0].length;
  }
  add(line.slice(last));
  return segments;
}

export function parseChordPro(text: string): ParsedSong {
  const song: ParsedSong = { title: "", artist: "", key: "", sections: [] };
  const open = (label: string, kind: "lyrics" | "grid"): ParsedSection => {
    const section: ParsedSection = { label, kind, lines: [] };
    song.sections.push(section);
    return section;
  };
  let current: ParsedSection | null = null;
  let explicit = false; // opened by start_of_*: blank lines don't split it
  for (const raw of text.replace(/\r\n?/g, "\n").split("\n")) {
    const trimmed = raw.trim();
    const d = DIRECTIVE_RE.exec(trimmed);
    if (d) {
      const name = d[1].toLowerCase();
      const value = (d[2] ?? "").trim();
      if (name === "title" || name === "t") song.title = value;
      else if (name === "artist") song.artist = value;
      else if (name === "key") song.key = value;
      else if (SECTION_STARTS[name]) {
        current = open(value || SECTION_STARTS[name].label, SECTION_STARTS[name].kind);
        explicit = true;
      } else if (SECTION_ENDS.has(name)) {
        current = null;
        explicit = false;
      } else if (HEADING_DIRECTIVES.has(name) && value) {
        current = open(value, "lyrics");
        explicit = false;
      }
      continue;
    }
    if (!trimmed) {
      if (current && !explicit && !current.label && current.lines.length) current = null;
      continue;
    }
    if (!current) {
      current = open("", "lyrics");
      explicit = false;
    }
    if (current.kind === "grid" || trimmed.startsWith("|")) current.lines.push({ type: "grid", cells: trimmed.split(/\s+/) });
    else current.lines.push({ type: "lyrics", segments: parseSegments(trimmed) });
  }
  return song;
}

export function lyricLines(song: ParsedSong): { label: string; lines: string[] }[] {
  return song.sections
    .map((s) => ({
      label: s.label,
      lines: s.lines
        .flatMap((l) => (l.type === "lyrics" ? [l.segments.map((g) => g.text).join("").replace(/\s+/g, " ").trim()] : []))
        .filter(Boolean),
    }))
    .filter((s) => s.lines.length > 0);
}

export function sectionLabels(text: string): string[] {
  return parseChordPro(text).sections.map((s) => s.label).filter(Boolean);
}

export function normalizeSearch(s: string) {
  return s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

export function searchText(title: string, text: string) {
  return normalizeSearch([title, ...lyricLines(parseChordPro(text)).flatMap((s) => s.lines)].join(" "));
}

export function isChordProText(text: string) {
  if (text.split(/\r?\n/).some((l) => DIRECTIVE_RE.test(l.trim()))) return true;
  for (const m of text.matchAll(/\[([^\]\s]+)\]/g)) if (isChord(m[1])) return true;
  return false;
}

export function guessKey(song: ParsedSong): string | null {
  for (const s of song.sections) {
    for (const l of s.lines) {
      const chords = l.type === "lyrics" ? l.segments.flatMap((g) => (g.chord ? [g.chord] : [])) : l.cells.filter(isChord);
      if (chords.length) {
        const m = CHORD_RE.exec(chords[0])!;
        return m[1] + (/^m(?!aj)/.test(m[2]) ? "m" : "");
      }
    }
  }
  return null;
}

const HEADING_RE = /^(intro|verse|pre-?chorus|chorus|bridge|interlude|instrumental|outro|tag|ending|refrain|reff?)(\s*\d+)?\.?$/i;
const KEY_LINE_RE = /^key\s*[:=]\s*([A-G](?:#|b)?m?)\s*$/i;
const MARKER_RE = /^(\|+|\.|-|\/|\(?x\d+\)?)$/i;

function expandTabs(line: string) {
  let out = "";
  for (const ch of line) out += ch === "\t" ? " ".repeat(8 - (out.length % 8)) : ch;
  return out;
}

function headingLabel(trimmed: string): string | null {
  const inner = trimmed.replace(/^[[(](.*)[\])]$/, "$1").trim();
  if (HEADING_RE.test(inner)) return inner.replace(/\.$/, "");
  if (inner.endsWith(":") && inner.length <= 40 && !inner.slice(0, -1).includes(":")) return inner.slice(0, -1).trim();
  return null;
}

function isChordLine(line: string) {
  const tokens = line.trim().split(/\s+/).filter(Boolean);
  return tokens.length > 0 && tokens.some(isChord) && tokens.every((t) => isChord(t) || MARKER_RE.test(t));
}

function mergeChords(chordLine: string, lyricLine: string) {
  let lyric = lyricLine;
  const marks = [...chordLine.matchAll(/\S+/g)].filter((m) => isChord(m[0]));
  for (const m of marks.reverse()) {
    const col = m.index!;
    if (lyric.length < col) lyric = lyric.padEnd(col);
    lyric = lyric.slice(0, col) + `[${m[0]}]` + lyric.slice(col);
  }
  return lyric.trimEnd();
}

function gridLine(trimmed: string) {
  return trimmed.includes("|") ? trimmed.replace(/\s+/g, " ") : `| ${trimmed.split(/\s+/).join(" ")} |`;
}

export function fromChordsAboveLyrics(text: string, fallbackTitle: string): string {
  const lines = text.replace(/\r\n?/g, "\n").split("\n").map((l) => expandTabs(l).trimEnd());
  const used = new Set<number>();
  let key = "";
  lines.forEach((l, i) => {
    const m = KEY_LINE_RE.exec(l.trim());
    if (m && !key) {
      key = m[1];
      used.add(i);
    }
  });
  let title = fallbackTitle;
  const first = lines.findIndex((l, i) => !used.has(i) && l.trim() !== "");
  if (first >= 0 && !isChordLine(lines[first]) && headingLabel(lines[first].trim()) === null) {
    title = lines[first].trim();
    used.add(first);
  }
  const out = [`{title: ${title}}`];
  if (key) out.push(`{key: ${key}}`);
  for (let i = 0; i < lines.length; i++) {
    if (used.has(i)) continue;
    const line = lines[i];
    const trimmed = line.trim();
    if (!trimmed) {
      out.push("");
      continue;
    }
    const label = headingLabel(trimmed);
    if (label !== null) {
      out.push(`{comment: ${label}}`);
      continue;
    }
    if (isChordLine(line)) {
      const next = lines[i + 1];
      if (!trimmed.includes("|") && next !== undefined && !used.has(i + 1) && next.trim() && !isChordLine(next) && headingLabel(next.trim()) === null) {
        out.push(mergeChords(line, next));
        i++;
        continue;
      }
      out.push(gridLine(trimmed));
      continue;
    }
    out.push(trimmed);
  }
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm test`
Expected: all tests pass (the `event.test.ts` tests plus the 18 new ones), `# fail 0`.

If a test fails, fix `lib/chordpro.ts`, not the test. The test values are the spec's contract. The one exception: if a test contradicts the spec, stop and report it.

- [ ] **Step 6: Static checks**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors. The only allowed lint output is the existing `@next/next/no-page-custom-font` warning in `app/layout.tsx`.

- [ ] **Step 7: Commit**

```bash
git add lib/chordpro.ts lib/chordpro.test.ts package.json
git commit -m "Add ChordPro engine: parse, convert, transpose, search text

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Song library table and upload page

**Files:**
- Create: `supabase/migrations/004_song_library.sql`
- Create: `app/library/upload/page.tsx`
- Create: `app/library/upload/UploadSongs.tsx`
- Modify: `proxy.ts` (also guard `/library`)
- Modify: `app/dashboard/page.tsx` (Upload songs link)
- Modify: `app/globals.css` (append upload styles)

**Interfaces:**
- Consumes from Task 1: `fromChordsAboveLyrics`, `guessKey`, `isChordProText`, `keyStep`, `parseChordPro` and `searchText` from `@/lib/chordpro`.
- Consumes from earlier work:
  - `createClient()` from `@/lib/supabase/client` (browser) and `@/lib/supabase/server` (server, async);
  - `AppShell`, `ThemeToggle` and `Icon` (names include `plus`).
- Produces:
  - **The `songs` table:** `id uuid, title text, artist text null, song_key text, content text, search_text text, created_by uuid, created_at timestamptz`.
  - **The `search_songs(q text)` function:** returns `(id uuid, title text, artist text, song_key text, content text)`, at most 20 rows. Task 3 calls it.
  - **The route `/library/upload`.**

- [ ] **Step 1: Write the migration** `supabase/migrations/004_song_library.sql`

```sql
create extension if not exists pg_trgm;

create table if not exists public.songs (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) > 0),
  artist text,
  song_key text not null,
  content text not null,
  search_text text not null,
  created_by uuid references auth.users on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

-- one song per title + artist, ignoring case
create unique index if not exists songs_title_artist_unique on public.songs (lower(title), lower(coalesce(artist, '')));
-- fast "contains" search on normalised title + lyrics
create index if not exists songs_search_trgm on public.songs using gin (search_text gin_trgm_ops);

alter table public.songs enable row level security;
drop policy if exists "songs read" on public.songs;
drop policy if exists "songs insert" on public.songs;
create policy "songs read" on public.songs for select to authenticated using (true);
create policy "songs insert" on public.songs for insert to authenticated with check (created_by = auth.uid());

-- search by any part of the title or lyrics; runs with the caller's rights, so RLS applies
create or replace function public.search_songs(q text)
returns table (id uuid, title text, artist text, song_key text, content text)
language sql stable set search_path = public
as $$
  with nq as (select trim(regexp_replace(lower(q), '[^[:alnum:]]+', ' ', 'g')) as v)
  select s.id, s.title, s.artist, s.song_key, s.content
  from public.songs s, nq
  where length(nq.v) >= 3 and s.search_text like '%' || nq.v || '%'
  order by (lower(s.title) like '%' || nq.v || '%') desc, s.title
  limit 20;
$$;

grant execute on function public.search_songs(text) to authenticated;

-- make the API see the new table and function right away
notify pgrst, 'reload schema';
```

Don't run it; the user runs it in the Supabase SQL Editor.

- [ ] **Step 2: Guard `/library` in `proxy.ts`**

Replace

```ts
  if (!user && (path.startsWith("/dashboard") || path.startsWith("/events"))) {
```

with

```ts
  if (!user && (path.startsWith("/dashboard") || path.startsWith("/events") || path.startsWith("/library"))) {
```

- [ ] **Step 3: Write `app/library/upload/page.tsx`**

```tsx
import Link from "next/link";
import { redirect } from "next/navigation";
import AppShell from "@/components/AppShell";
import ThemeToggle from "@/components/ThemeToggle";
import { createClient } from "@/lib/supabase/server";
import UploadSongs from "./UploadSongs";

export default async function UploadPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <AppShell
      actions={
        <>
          <Link className="btn" href="/dashboard" aria-label="Dashboard">
            ←<span className="btn-label"> Dashboard</span>
          </Link>
          <ThemeToggle />
        </>
      }
    >
      <main className="dash">
        <div className="dash-head">
          <div>
            <div className="eyebrow">LIBRARY</div>
            <h1 className="dash-title">Upload songs</h1>
            <div className="dash-sub">ChordPro (.cho, .chopro, .pro, .chordpro) or plain text with chords above the lyrics (.txt).</div>
          </div>
        </div>
        <UploadSongs />
      </main>
    </AppShell>
  );
}
```

- [ ] **Step 4: Write `app/library/upload/UploadSongs.tsx`**

```tsx
"use client";

import { useState, type ChangeEvent, type DragEvent } from "react";
import Icon from "@/components/Icon";
import { fromChordsAboveLyrics, guessKey, isChordProText, keyStep, parseChordPro, searchText } from "@/lib/chordpro";
import { createClient } from "@/lib/supabase/client";

type Row = {
  file: string;
  title: string;
  artist: string;
  key: string;
  keyConfirmed: boolean;
  content: string;
  sections: string[];
  unreadable: boolean;
  duplicate: boolean;
  result?: string;
};

const SAVED = "Saved";
const ACCEPT = ".cho,.chopro,.pro,.chordpro,.txt";
const identity = (title: string, artist: string) => `${title.trim().toLowerCase()}\u0000${artist.trim().toLowerCase()}`;

async function readSong(file: File): Promise<Row> {
  const text = await file.text();
  const content = isChordProText(text) ? text : fromChordsAboveLyrics(text, file.name.replace(/\.[^.]+$/, ""));
  const parsed = parseChordPro(content);
  return {
    file: file.name,
    title: parsed.title,
    artist: parsed.artist,
    key: parsed.key || guessKey(parsed) || "",
    keyConfirmed: parsed.key !== "",
    content,
    sections: parsed.sections.map((s) => s.label).filter(Boolean),
    unreadable: !parsed.title.trim() || !parsed.sections.some((s) => s.lines.length > 0),
    duplicate: false,
  };
}

function status(r: Row): { text: string; ok: boolean } {
  if (r.result) return { text: r.result, ok: r.result === SAVED };
  if (r.unreadable) return { text: "Couldn't read it", ok: false };
  if (r.duplicate) return { text: "Already in library", ok: false };
  if (!r.title.trim()) return { text: "Needs a title", ok: false };
  if (!keyStep(r.key, 0) || !r.keyConfirmed) return { text: "Needs a key", ok: false };
  return { text: "Ready", ok: true };
}

const isReady = (r: Row) => !r.result && status(r).text === "Ready";

export default function UploadSongs() {
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);
  const [over, setOver] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function addFiles(files: File[]) {
    if (!files.length) return;
    setMessage(null);
    const read = await Promise.all(files.map(readSong));
    const titles = [...new Set(read.map((r) => r.title.trim()).filter(Boolean))];
    let existing: { title: string; artist: string | null }[] = [];
    if (titles.length) {
      const { data, error } = await createClient().from("songs").select("title,artist").in("title", titles);
      if (error) setMessage(`Couldn't check the library for duplicates: ${error.message}. Duplicates will be skipped when saving.`);
      else existing = data ?? [];
    }
    const seen = new Set(existing.map((s) => identity(s.title, s.artist ?? "")));
    rows.forEach((r) => seen.add(identity(r.title, r.artist)));
    const marked = read.map((r) => {
      const id = identity(r.title, r.artist);
      const duplicate = !r.unreadable && seen.has(id);
      seen.add(id);
      return { ...r, duplicate };
    });
    setRows((current) => [...current, ...marked]);
  }

  function onPick(e: ChangeEvent<HTMLInputElement>) {
    void addFiles([...(e.target.files ?? [])]);
    e.target.value = "";
  }

  function onDrop(e: DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    setOver(false);
    void addFiles([...e.dataTransfer.files]);
  }

  const edit = (i: number, patch: Partial<Row>) => setRows((current) => current.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  async function save() {
    setBusy(true);
    setMessage(null);
    const supabase = createClient();
    const next = [...rows];
    for (let i = 0; i < next.length; i++) {
      const r = next[i];
      if (!isReady(r)) continue;
      const { error } = await supabase.from("songs").insert({
        title: r.title.trim(),
        artist: r.artist.trim() || null,
        song_key: r.key.trim(),
        content: r.content,
        search_text: searchText(r.title, r.content),
      });
      next[i] = { ...r, result: error ? (error.code === "23505" ? "Already in library" : `Failed: ${error.message}`) : SAVED };
      setRows([...next]);
    }
    const added = next.filter((r) => r.result === SAVED).length;
    setMessage(`Added ${added}, skipped ${next.length - added}.`);
    setBusy(false);
  }

  const ready = rows.filter(isReady).length;

  return (
    <>
      <label
        className={`upload-drop${over ? " over" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={onDrop}
      >
        <Icon name="plus" />
        <strong>Drop song files here, or click to choose</strong>
        <span>.cho, .chopro, .pro, .chordpro or .txt — several at once</span>
        <input type="file" multiple accept={ACCEPT} onChange={onPick} hidden />
      </label>

      {rows.length > 0 && (
        <div className="upload-table-wrap">
          <table className="upload-table">
            <thead>
              <tr>
                <th>File</th>
                <th>Title</th>
                <th>Artist</th>
                <th>Key</th>
                <th>Sections</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const s = status(r);
                const locked = !!r.result || r.unreadable;
                return (
                  <tr key={i}>
                    <td>{r.file}</td>
                    <td>
                      <input value={r.title} disabled={locked} onChange={(e) => edit(i, { title: e.target.value, duplicate: false })} aria-label={`Title for ${r.file}`} />
                    </td>
                    <td>
                      <input value={r.artist} disabled={locked} onChange={(e) => edit(i, { artist: e.target.value, duplicate: false })} aria-label={`Artist for ${r.file}`} />
                    </td>
                    <td>
                      <input value={r.key} disabled={locked} onChange={(e) => edit(i, { key: e.target.value, keyConfirmed: true })} aria-label={`Key for ${r.file}`} />
                      {!locked && !r.keyConfirmed && keyStep(r.key, 0) && (
                        <button className="btn compact" type="button" onClick={() => edit(i, { keyConfirmed: true })}>
                          Use {r.key}
                        </button>
                      )}
                    </td>
                    <td>{r.sections.join(", ") || "—"}</td>
                    <td className={`upload-status ${s.ok ? "ok" : "bad"}`}>{s.text}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="upload-actions">
        <button className="btn primary" type="button" onClick={save} disabled={busy || ready === 0}>
          {busy ? "Saving…" : `Save ${ready} ${ready === 1 ? "song" : "songs"}`}
        </button>
        {message && <span role="status">{message}</span>}
      </div>
    </>
  );
}
```

- [ ] **Step 5: Add the dashboard link** in `app/dashboard/page.tsx`

Add `import Link from "next/link";` at the top. Then replace the single line `          <NewEventButton />` (inside `.dash-head`) with:

```tsx
          <div className="dash-head-actions">
            <Link className="btn" href="/library/upload">Upload songs</Link>
            <NewEventButton />
          </div>
```

- [ ] **Step 6: Append the styles** to the end of `app/globals.css`

```css
.dash-head-actions{display:flex;gap:8px;flex-wrap:wrap}
.upload-drop{display:flex;flex-direction:column;align-items:center;gap:6px;margin:20px 0;padding:28px 16px;border:2px dashed var(--line-strong);border-radius:var(--r-sm);color:var(--muted);text-align:center;cursor:pointer}
.upload-drop.over,.upload-drop:hover{border-color:var(--accent);color:var(--text)}
.upload-table-wrap{overflow-x:auto}
.upload-table{width:100%;border-collapse:collapse;font-size:14px}
.upload-table th,.upload-table td{padding:8px 6px;border-bottom:1px solid var(--line);text-align:left;vertical-align:top}
.upload-table input{width:100%;min-width:90px;padding:6px 8px;border:1px solid var(--line-strong);border-radius:6px;background:var(--surface);color:var(--text)}
.upload-table .btn{margin-top:6px}
.upload-status{font-weight:700;white-space:nowrap}
.upload-status.ok{color:var(--accent)}
.upload-status.bad{color:var(--danger)}
.upload-actions{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-top:16px}
```

- [ ] **Step 7: Static checks and build**

Run: `npm test && npx tsc --noEmit && npm run lint && npm run build`
Expected: everything passes, and the build lists `/library/upload`.

Smoke test, read-only: start `npm run start` in the background, then run `curl -s -o /dev/null -w "%{http_code} %{redirect_url}" http://localhost:3000/library/upload`. Expected: a 307 redirect to `/login`, because there is no session. Stop the server and confirm port 3000 is free.

- [ ] **Step 8: Manual check (the user, after running `004` in Supabase)**

1. In the dashboard, click **Upload songs**.
2. Drop in a ChordPro file, a plain chords-above-lyrics `.txt`, a copy of the same ChordPro file, and a file with no lyrics. Expected statuses: Ready, Ready or Needs a key (fix with **Use E**), Already in library, Couldn't read it.
3. Click **Save**. Expected: "Added 2, skipped 2".
4. Upload one of the saved files again. Expected: Already in library.

- [ ] **Step 9: Commit**

```bash
git add supabase/migrations/004_song_library.sql proxy.ts app/library app/dashboard/page.tsx app/globals.css
git commit -m "Add song library table, search function and upload page

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Song content in events and the Add Song search dialog

**Files:**
- Modify: `lib/event.ts` (`Song` gains `content` and `librarySongId`)
- Modify: `lib/event.test.ts`
- Create: `components/AddSongDialog.tsx`
- Modify: `components/EventEditor.tsx` (`addSong` and the nav button)
- Modify: `app/globals.css` (append search-result styles)

**Interfaces:**
- Consumes from Task 1: `lyricLines`, `normalizeSearch`, `parseChordPro` and `sectionLabels`.
- Consumes from Task 2: the RPC `search_songs` (`{ q: string }`), which returns `{ id, title, artist, song_key, content }[]`.
- Produces:
  - `Song = { id: string; title: string; baseKey: string; content: string; librarySongId?: string; sections: Section[] }`
  - the default export `AddSongDialog({ onAdd: (song: Song) => void })`, which renders the **Add Song** button and its dialog.

- [ ] **Step 1: Write the failing tests** in `lib/event.test.ts`

In the existing test `"eventFromRow keeps valid data unchanged"`, add `content: "[E]Way maker", librarySongId: "lib-1"` to the song object in `songs`. That keeps the round trip complete:

```ts
  const songs = [{ id: "song-1", title: "Way Maker", baseKey: "E", content: "[E]Way maker", librarySongId: "lib-1", sections: [{ id: "section-1", name: "Intro", color: "#93dfb2", note: "Soft\nkeys" }] }];
```

Append a new test:

```ts
test("eventFromRow gives old songs empty content and no library id", () => {
  const event = eventFromRow({ event_name: null, event_date: null, data: { songs: [{ id: "s1", title: "Old", baseKey: "G", sections: [] }, { content: 5, librarySongId: 7 }] } });
  assert.equal(event.songs[0].content, "");
  assert.ok(!("librarySongId" in event.songs[0]));
  assert.equal(event.songs[1].content, "");
  assert.ok(!("librarySongId" in event.songs[1]));
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npm test`
Expected: FAIL. "keeps valid data unchanged" loses `content` and `librarySongId`, and the new test fails on `content` being `undefined`.

- [ ] **Step 3: Update `lib/event.ts`**

Replace the `Song` type with:

```ts
export type Song = { id: string; title: string; baseKey: string; content: string; librarySongId?: string; sections: Section[] };
```

Replace `normalizeSong` with:

```ts
function normalizeSong(song: Loose): Song {
  const librarySongId = str(song?.librarySongId);
  return {
    id: str(song?.id) || uid("song"),
    title: str(song?.title),
    baseKey: str(song?.baseKey),
    content: str(song?.content),
    ...(librarySongId ? { librarySongId } : {}),
    sections: normalizeSections(song?.sections),
  };
}
```

- [ ] **Step 4: Run the tests**

Run: `npm test`
Expected: all pass. `npx tsc --noEmit` now fails in `components/EventEditor.tsx`, where `addSong` builds a `Song` without `content`. The next steps fix that.

- [ ] **Step 5: Write `components/AddSongDialog.tsx`**

```tsx
"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Icon from "./Icon";
import { lyricLines, normalizeSearch, parseChordPro, sectionLabels } from "@/lib/chordpro";
import { colors, uid, type Song } from "@/lib/event";
import { createClient } from "@/lib/supabase/client";

type Result = { id: string; title: string; artist: string | null; song_key: string; content: string };

function songFromLibrary(r: Result): Song {
  return {
    id: uid("song"),
    title: r.title,
    baseKey: r.song_key,
    content: r.content,
    librarySongId: r.id,
    sections: sectionLabels(r.content).map((name, i) => ({ id: uid("section"), name, color: colors[i % colors.length], note: "" })),
  };
}

function snippet(content: string, query: string) {
  const nq = normalizeSearch(query);
  const lines = lyricLines(parseChordPro(content)).flatMap((s) => s.lines);
  return lines.find((l) => normalizeSearch(l).includes(nq)) ?? lines[0] ?? "";
}

function highlight(text: string, query: string): ReactNode {
  const words = normalizeSearch(query).split(" ").filter((w) => w.length >= 2);
  if (!words.length) return text;
  const re = new RegExp(`(${words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "giu");
  return text.split(re).map((part, i) => (i % 2 ? <mark key={i}>{part}</mark> : part));
}

export default function AddSongDialog({ onAdd }: { onAdd: (song: Song) => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Result[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const searching = normalizeSearch(query).length >= 3;

  useEffect(() => {
    if (normalizeSearch(query).length < 3) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      setLoading(true);
      const { data, error } = await createClient().rpc("search_songs", { q: query });
      if (cancelled) return;
      setLoading(false);
      setError(error ? `Search failed: ${error.message}` : null);
      setResults(error ? [] : ((data ?? []) as Result[]));
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  function close() {
    dialogRef.current?.close();
  }

  function pick(song: Song) {
    onAdd(song);
    close();
  }

  return (
    <>
      <button className="btn primary compact" type="button" onClick={() => dialogRef.current?.showModal()}>
        <Icon name="plus" />
        Add Song
      </button>
      <dialog
        ref={dialogRef}
        className="share-dialog"
        aria-labelledby="addSongTitle"
        onClose={() => {
          setQuery("");
          setResults(null);
          setError(null);
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget) close();
        }}
      >
        <div className="share-dialog-inner">
          <div className="share-dialog-title" id="addSongTitle">Add Song</div>
          <input
            className="team-input"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search a line of the lyrics or the title"
            aria-label="Search songs"
          />
          {!searching && <p className="share-dialog-copy">Type at least 3 letters.</p>}
          {searching && error && <p className="share-dialog-hint">{error}</p>}
          {searching && !error && results === null && <p className="share-dialog-copy">Searching…</p>}
          {searching && results && results.length > 0 && (
            <ul className="song-results">
              {results.map((r) => (
                <li key={r.id}>
                  <button type="button" className="song-result" onClick={() => pick(songFromLibrary(r))}>
                    <span className="song-result-title">{r.title}</span>
                    <span className="song-result-meta">{[r.artist, `Key ${r.song_key}`].filter(Boolean).join(" · ")}</span>
                    <span className="song-result-snippet">{highlight(snippet(r.content, query), query)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {searching && results && results.length === 0 && !error && !loading && <p className="share-dialog-copy">No songs found.</p>}
          <div className="share-dialog-actions">
            <a className="btn" href="/library/upload">Upload songs</a>
            <button className="btn" type="button" onClick={() => pick({ id: uid("song"), title: "", baseKey: "", content: "", sections: [] })}>
              Add blank song
            </button>
            <button className="btn" type="button" onClick={close}>Cancel</button>
          </div>
        </div>
      </dialog>
    </>
  );
}
```

- [ ] **Step 6: Wire it into `components/EventEditor.tsx`**

1. Add `import AddSongDialog from "./AddSongDialog";` after the `AppShell` import.
2. Replace the whole `addSong` function with:

```tsx
  function addSong(s: Song) {
    update({ ...event, songs: [...event.songs, s] });
    setActiveSongId(s.id);
    if (!s.title) focusId.current = s.id;
  }
```

3. In the nav heading, replace

```tsx
              {!readOnly && (
                <button className="btn primary compact" type="button" onClick={addSong}>
                  <Icon name="plus" />
                  Add Song
                </button>
              )}
```

with

```tsx
              {!readOnly && <AddSongDialog onAdd={addSong} />}
```

- [ ] **Step 7: Append the result styles** to the end of `app/globals.css`

```css
.song-results{list-style:none;margin:0;padding:0;max-height:50vh;overflow-y:auto}
.song-result{display:flex;flex-direction:column;gap:2px;width:100%;padding:10px 8px;border:0;border-bottom:1px solid var(--line);background:none;color:var(--text);text-align:left}
.song-result:hover{background:var(--surface-2)}
.song-result-title{font-weight:700;overflow-wrap:anywhere}
.song-result-meta{color:var(--muted);font-size:13px}
.song-result-snippet{color:var(--muted);font-size:13px;overflow-wrap:anywhere}
.song-result mark{background:var(--accent-soft);color:var(--text);border-radius:3px}
```

- [ ] **Step 8: Static checks and build**

Run: `npm test && npx tsc --noEmit && npm run lint && npm run build`
Expected: everything passes. `npx tsc` is clean, because `addSong` now takes a full `Song`.

- [ ] **Step 9: Commit**

```bash
git add lib/event.ts lib/event.test.ts components/AddSongDialog.tsx components/EventEditor.tsx app/globals.css
git commit -m "Search the song library from Add Song and import lyrics, chords and key

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Song tabs, Section Notes component and key ± buttons

**Files:**
- Create: `components/SectionNotes.tsx` (the Section Notes markup moved out of the editor)
- Create: `components/SongTabs.tsx`
- Create: `components/KeyControl.tsx`
- Modify: `components/Icon.tsx` (add `minus`)
- Modify: `components/EventEditor.tsx` (replaced in full below)
- Modify: `app/globals.css` (append tab, lyrics, chord and key styles)

**Interfaces:**
- Consumes:
  - from Task 1: `keyStep`, `transpose`, `parseChordPro` and `lyricLines`;
  - from Task 3: `Song.content` and `AddSongDialog`;
  - existing: `TeamDialog`, `AppShell`, `ThemeToggle`, `Icon` and `exportSongImage`.
- Produces:
  - `SectionNotes({ sections: Section[]; readOnly: boolean; onChange: (sections: Section[]) => void })`
  - `SongTabs({ song: Song; content: string; readOnly: boolean; onContentChange: (content: string) => void; onSectionsChange: (sections: Section[]) => void })`
  - `KeyControl({ value: string; readOnly: boolean; onStep: (steps: number) => void; onType?: (value: string) => void; onReset?: () => void })`

- [ ] **Step 1: Add the `minus` icon** in `components/Icon.tsx`

After the `plus` entry, add:

```tsx
  minus: <path d="M5 12h14" />,
```

- [ ] **Step 2: Write `components/SectionNotes.tsx`**

The markup and behaviour are moved unchanged from `EventEditor.tsx`. Only the "SONG DETAILS" label is dropped, since the tab name replaces it.

```tsx
"use client";

import { useEffect, useRef, type CSSProperties } from "react";
import Icon from "./Icon";
import { colors, safeColor, uid, type Section } from "@/lib/event";

type Props = { sections: Section[]; readOnly: boolean; onChange: (sections: Section[]) => void };

const tagColor = (color: string) => ({ "--tag-color": safeColor(color) }) as CSSProperties;

function swap<T>(items: T[], i: number, j: number) {
  if (j < 0 || j >= items.length) return items;
  const copy = [...items];
  [copy[i], copy[j]] = [copy[j], copy[i]];
  return copy;
}

export default function SectionNotes({ sections, readOnly, onChange }: Props) {
  const focusId = useRef<string | null>(null);

  useEffect(() => {
    const id = focusId.current;
    if (!id) return;
    focusId.current = null;
    const el = document.querySelector<HTMLInputElement>(`[data-focus="${CSS.escape(id)}"]`);
    el?.focus();
    el?.select();
  });

  const setSection = (i: number, patch: Partial<Section>) => onChange(sections.map((s, j) => (j === i ? { ...s, ...patch } : s)));

  function add() {
    const section: Section = { id: uid("section"), name: "", color: colors[sections.length % colors.length], note: "" };
    onChange([...sections, section]);
    focusId.current = section.id;
  }

  function remove(i: number) {
    if (!confirm(`Delete "${sections[i].name.trim() || "this song detail"}"?`)) return;
    onChange(sections.filter((_, j) => j !== i));
  }

  function cycleColor(i: number) {
    const current = safeColor(sections[i].color).toLowerCase();
    setSection(i, { color: colors[(colors.findIndex((c) => c.toLowerCase() === current) + 1) % colors.length] });
  }

  return (
    <>
      <div className="details">
        {sections.length === 0 ? (
          <div className="empty-detail">{readOnly ? "This song has no details yet." : "No song details yet. Add a section to start building this song."}</div>
        ) : (
          sections.map((section, i) =>
            readOnly ? (
              <div className="detail-row" key={section.id} style={tagColor(section.color)}>
                <div className="detail-name-wrap">
                  <span className="color-dot static" style={tagColor(section.color)} aria-hidden="true" />
                  <div className="view-detail-name">{section.name.trim() || "Untitled"}</div>
                </div>
                <div className="view-detail-note">{section.note}</div>
              </div>
            ) : (
              <div className="detail-row" key={section.id} style={tagColor(section.color)}>
                <div className="detail-name-wrap">
                  <button className="color-dot" type="button" style={tagColor(section.color)} title="Change section color" aria-label="Change section color" onClick={() => cycleColor(i)} />
                  <input
                    className="detail-name-input"
                    data-focus={section.id}
                    value={section.name}
                    onChange={(e) => setSection(i, { name: e.target.value })}
                    aria-label="Song detail name"
                    placeholder="Song detail name"
                  />
                </div>
                <textarea
                  className="detail-note"
                  rows={1}
                  value={section.note}
                  onChange={(e) => setSection(i, { note: e.target.value })}
                  aria-label={`Notes for ${section.name || "song detail"}`}
                  placeholder="Add notes..."
                />
                <div className="detail-tools">
                  <button className="icon-btn" type="button" title="Move up" aria-label="Move song detail up" disabled={i === 0} onClick={() => onChange(swap(sections, i, i - 1))}><Icon name="up" /></button>
                  <button className="icon-btn" type="button" title="Move down" aria-label="Move song detail down" disabled={i === sections.length - 1} onClick={() => onChange(swap(sections, i, i + 1))}><Icon name="down" /></button>
                  <button className="icon-btn danger" type="button" title="Delete song detail" aria-label="Delete song detail" onClick={() => remove(i)}><Icon name="trash" /></button>
                </div>
              </div>
            ),
          )
        )}
      </div>
      {!readOnly && (
        <button className="btn add-detail" type="button" onClick={add}><Icon name="plus" />Add Song Detail</button>
      )}
    </>
  );
}
```

- [ ] **Step 3: Write `components/SongTabs.tsx`**

```tsx
"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import SectionNotes from "./SectionNotes";
import { lyricLines, parseChordPro } from "@/lib/chordpro";
import type { Section, Song } from "@/lib/event";

type Tab = "lyrics" | "chords" | "notes";
type Props = {
  song: Song;
  content: string; // what to show: song.content, or a view-only transposition on share links
  readOnly: boolean;
  onContentChange: (content: string) => void;
  onSectionsChange: (sections: Section[]) => void;
};

const TABS: { id: Tab; label: string }[] = [
  { id: "lyrics", label: "Lyrics Only" },
  { id: "chords", label: "Lyrics + Chords" },
  { id: "notes", label: "Section Notes" },
];
const TAB_KEY = "setlistApp_songTab";
const NBSP = " ";

function readTab(): Tab | null {
  try {
    const v = localStorage.getItem(TAB_KEY);
    return v === "lyrics" || v === "chords" || v === "notes" ? v : null;
  } catch {
    return null;
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}

export default function SongTabs({ song, content, readOnly, onContentChange, onSectionsChange }: Props) {
  const stored = useSyncExternalStore(subscribe, readTab, () => null);
  const [picked, setPicked] = useState<Tab | null>(null);
  const [editing, setEditing] = useState(false);
  const parsed = useMemo(() => parseChordPro(content), [content]);
  const hasLyrics = content.trim() !== "";
  const tab: Tab = picked ?? stored ?? (hasLyrics ? "chords" : "notes");

  function choose(t: Tab) {
    setPicked(t);
    try {
      localStorage.setItem(TAB_KEY, t);
    } catch {
      // storage blocked (private mode): the choice lasts for this page only
    }
  }

  const empty = (
    <p className="lyrics-empty">
      No lyrics yet.{!readOnly && " Use Edit on the Lyrics + Chords tab to paste ChordPro, or add the song from the library."}
    </p>
  );

  return (
    <div className="main-content">
      <div className="song-tabs" role="tablist" aria-label="Song views">
        {TABS.map((t) => (
          <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} className={`song-tab${tab === t.id ? " active" : ""}`} onClick={() => choose(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "notes" && <SectionNotes sections={song.sections} readOnly={readOnly} onChange={onSectionsChange} />}

      {tab === "lyrics" &&
        (hasLyrics
          ? lyricLines(parsed).map((s, i) => (
              <section key={i} className="lyrics-section">
                {s.label && <h3 className="lyrics-label">{s.label}</h3>}
                {s.lines.map((line, j) => (
                  <p key={j} className="lyrics-line">{line}</p>
                ))}
              </section>
            ))
          : empty)}

      {tab === "chords" && (
        <>
          {!readOnly && (
            <div className="lyrics-toolbar">
              <button className="btn compact" type="button" aria-pressed={editing} onClick={() => setEditing(!editing)}>
                {editing ? "Done editing" : "Edit"}
              </button>
            </div>
          )}
          {editing && !readOnly ? (
            <textarea className="chord-editor" value={content} onChange={(e) => onContentChange(e.target.value)} aria-label="Lyrics and chords (ChordPro)" spellCheck={false} />
          ) : hasLyrics ? (
            parsed.sections.map((s, i) => (
              <section key={i} className="lyrics-section">
                {s.label && <h3 className="lyrics-label">{s.label}</h3>}
                {s.lines.map((line, j) =>
                  line.type === "grid" ? (
                    <div key={j} className="chord-grid">{line.cells.join(" ")}</div>
                  ) : line.segments.some((g) => g.chord) ? (
                    <div key={j} className="chord-line">
                      {line.segments.map((g, k) => (
                        <span key={k} className="chord-seg">
                          <span className="chord">{g.chord ?? NBSP}</span>
                          <span className="chord-text">{g.text || NBSP}</span>
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p key={j} className="lyrics-line chord-plain">{line.segments.map((g) => g.text).join("")}</p>
                  ),
                )}
              </section>
            ))
          ) : (
            empty
          )}
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Write `components/KeyControl.tsx`**

```tsx
"use client";

import Icon from "./Icon";
import { keyStep } from "@/lib/chordpro";

type Props = {
  value: string;
  readOnly: boolean;
  onStep: (steps: number) => void;
  onType?: (value: string) => void;
  onReset?: () => void;
};

export default function KeyControl({ value, readOnly, onStep, onType, onReset }: Props) {
  const known = keyStep(value, 0) !== null;
  return (
    <div className="key-control">
      <button className="icon-btn" type="button" aria-label="Lower key" title={known ? "Lower key" : "Unknown key"} disabled={!known} onClick={() => onStep(-1)}>
        <Icon name="minus" />
      </button>
      {readOnly ? (
        <div className="key-badge" title="Key" aria-label={`Key ${value.trim() || "not set"}`}>
          <span aria-hidden="true">Key</span>
          <strong aria-hidden="true">{value.trim() || "—"}</strong>
        </div>
      ) : (
        <label className="key-field">
          <span>Key</span>
          <input className="key-input" value={value} onChange={(e) => onType?.(e.target.value)} placeholder="—" aria-label="Base key" />
        </label>
      )}
      <button className="icon-btn" type="button" aria-label="Raise key" title={known ? "Raise key" : "Unknown key"} disabled={!known} onClick={() => onStep(1)}>
        <Icon name="plus" />
      </button>
      {onReset && (
        <button className="btn compact" type="button" onClick={onReset}>Reset</button>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Replace `components/EventEditor.tsx` in full**

```tsx
"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import AddSongDialog from "./AddSongDialog";
import AppShell from "./AppShell";
import Icon from "./Icon";
import KeyControl from "./KeyControl";
import SongTabs from "./SongTabs";
import TeamDialog from "./TeamDialog";
import ThemeToggle from "./ThemeToggle";
import { keyStep, transpose } from "@/lib/chordpro";
import type { SetlistEvent, Song } from "@/lib/event";
import { exportSongImage } from "@/lib/exportPng";
import { createClient } from "@/lib/supabase/client";

type Props = { initial: SetlistEvent; eventId?: string; shareToken?: string | null; readOnly?: boolean };

const songNumber = (i: number) => String(i + 1).padStart(2, "0");

function swap<T>(items: T[], i: number, j: number) {
  if (j < 0 || j >= items.length) return items;
  const copy = [...items];
  [copy[i], copy[j]] = [copy[j], copy[i]];
  return copy;
}

export default function EventEditor({ initial, eventId, shareToken = null, readOnly = false }: Props) {
  const [event, setEvent] = useState(initial);
  const [activeSongId, setActiveSongId] = useState<string | null>(initial.songs[0]?.id ?? null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState<"idle" | "saving" | "saved">("idle");
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [fallbackUrl, setFallbackUrl] = useState<string | null>(null);
  const [viewKeys, setViewKeys] = useState<Record<string, string>>({}); // share links: per-song display key, never saved
  const focusId = useRef<string | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const revision = useRef(0);

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    if (fallbackUrl) dialogRef.current?.showModal();
  }, [fallbackUrl]);

  useEffect(() => {
    // phone layout: keep the active song chip visible in the horizontal strip (v2.4.0)
    document.querySelector(".song-nav-item.active")?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [activeSongId]);

  useEffect(() => {
    const id = focusId.current;
    if (!id) return;
    focusId.current = null;
    const el = document.querySelector<HTMLInputElement>(`[data-focus="${CSS.escape(id)}"]`);
    el?.focus();
    el?.select();
  });

  const song = event.songs.find((s) => s.id === activeSongId) ?? event.songs[0] ?? null;
  const index = song ? event.songs.indexOf(song) : -1;
  const displayKey = song ? (viewKeys[song.id] ?? song.baseKey) : "";
  const displayContent = song && readOnly && displayKey !== song.baseKey ? transpose(song.content, song.baseKey, displayKey) : (song?.content ?? "");

  function update(next: SetlistEvent) {
    revision.current++;
    setEvent(next);
    setDirty(true);
  }
  function updateSong(id: string, fn: (s: Song) => Song) {
    update({ ...event, songs: event.songs.map((s) => (s.id === id ? fn(s) : s)) });
  }

  function addSong(s: Song) {
    update({ ...event, songs: [...event.songs, s] });
    setActiveSongId(s.id);
    if (!s.title) focusId.current = s.id;
  }
  function deleteSong() {
    if (!song) return;
    if (!confirm(`Delete "${song.title.trim() || `Song ${index + 1}`}" and all of its song details?`)) return;
    const songs = event.songs.filter((s) => s.id !== song.id);
    update({ ...event, songs });
    setActiveSongId((songs[index] ?? songs[index - 1])?.id ?? null);
  }
  function moveSong(direction: number) {
    update({ ...event, songs: swap(event.songs, index, index + direction) });
  }
  function stepKey(steps: number) {
    if (!song) return;
    const next = keyStep(song.baseKey, steps);
    if (next) updateSong(song.id, (s) => ({ ...s, baseKey: next, content: transpose(s.content, s.baseKey, next) }));
  }
  function stepView(steps: number) {
    if (!song) return;
    const next = keyStep(displayKey, steps);
    if (next) setViewKeys({ ...viewKeys, [song.id]: next });
  }
  function resetView() {
    if (song) setViewKeys(Object.fromEntries(Object.entries(viewKeys).filter(([id]) => id !== song.id)));
  }
  function exportPng() {
    if (song) exportSongImage(event, song, document.documentElement.dataset.theme === "dark");
  }

  async function save() {
    if (!eventId) return;
    const savedRevision = revision.current;
    setSaving("saving");
    const { error } = await createClient()
      .from("events")
      .update({ event_name: event.eventName.trim() || null, event_date: event.eventDate || null, data: { songs: event.songs }, members: event.members, updated_at: new Date().toISOString() })
      .eq("id", eventId)
      .select("id")
      .single();
    if (error) {
      setSaving("idle");
      setError(
        error.code === "PGRST116"
          ? "You're signed out, or this event isn't yours. Log in again in another tab, then press Save — your changes are still here."
          : `Could not save event: ${error.message}`,
      );
      return;
    }
    setError(null);
    if (revision.current === savedRevision) setDirty(false);
    setSaving("saved");
    setTimeout(() => setSaving("idle"), 1800);
  }

  async function share() {
    if (!shareToken) return;
    const url = `${location.origin}/share/${encodeURIComponent(shareToken)}`;
    try {
      await navigator.clipboard.writeText(url);
      setToast("Share link copied to clipboard");
    } catch {
      setFallbackUrl(url);
    }
  }

  const actions = readOnly ? (
    <ThemeToggle />
  ) : (
    <>
      <Link
        className="btn"
        href="/dashboard"
        aria-label="Dashboard"
        onClick={(e) => {
          if (dirty && !confirm("Leave without saving your changes?")) e.preventDefault();
        }}
      >
        ←<span className="btn-label"> Dashboard</span>
      </Link>
      <button className="btn primary" type="button" onClick={save} disabled={saving === "saving"}>
        {saving === "saving" ? "Saving…" : saving === "saved" ? "Saved" : "Save"}
      </button>
      <button className="btn" type="button" onClick={share} disabled={!shareToken} title="Copy a read-only link to this event">
        Share
      </button>
      <ThemeToggle />
    </>
  );

  return (
    <AppShell actions={actions} className={readOnly ? "view-only" : ""}>
      {readOnly && (
        <div className="share-banner" role="status">
          <span>Viewing a shared setlist · read-only</span>
          <Link href="/">Open my setlist</Link>
        </div>
      )}
      {error && (
        <div className="share-banner error" role="alert">
          <span>{error}</span>
        </div>
      )}

      <div className="workspace">
        <aside className="sidebar">
          <div className="event-block">
            <div className="eyebrow">EVENT</div>
            <input
              className="event-name"
              value={event.eventName}
              onChange={(e) => update({ ...event, eventName: e.target.value })}
              readOnly={readOnly}
              aria-label="Event name"
              placeholder={readOnly ? "Untitled Event" : "Event Name"}
            />
            {!(readOnly && !event.eventDate) && (
              <input
                className="event-date"
                type="date"
                value={event.eventDate}
                onChange={(e) => update({ ...event, eventDate: e.target.value })}
                readOnly={readOnly}
                aria-label="Event date"
              />
            )}
            <TeamDialog members={event.members} readOnly={readOnly} onChange={(members) => update({ ...event, members })} />
          </div>
          <nav className="song-nav" aria-label="Songs">
            <div className="nav-heading">
              <div className="nav-heading-title">SONGS</div>
              {!readOnly && <AddSongDialog onAdd={addSong} />}
            </div>
            <div className="song-list">
              {event.songs.length === 0 ? (
                <div className="empty-nav">
                  {readOnly ? "This shared event has no songs." : <>No songs yet.<br />Use <strong>+ Add Song</strong> to start.</>}
                </div>
              ) : (
                event.songs.map((s, i) => (
                  <button
                    key={s.id}
                    type="button"
                    className={`song-nav-item${s.id === song?.id ? " active" : ""}`}
                    aria-current={s.id === song?.id}
                    onClick={() => setActiveSongId(s.id)}
                  >
                    <span className="song-nav-number">{songNumber(i)}</span>
                    <span className="song-nav-title">{s.title.trim() || "Untitled Song"}</span>
                    <span className="song-nav-key">{s.baseKey.trim() || "—"}</span>
                    <span className="song-nav-arrow"><Icon name="next" /></span>
                  </button>
                ))
              )}
            </div>
          </nav>
          <div className="sidebar-footer">
            <div>
              {event.songs.length} {event.songs.length === 1 ? "song" : "songs"}
            </div>
          </div>
        </aside>

        <main className="main">
          {!song ? (
            <div className="workspace-empty">
              <div className="workspace-empty-inner">
                <div className="workspace-empty-title">{readOnly ? "No songs in this setlist." : "Your setlist starts here."}</div>
                <div className="workspace-empty-copy">
                  {readOnly ? "The person who shared this event hasn't added any songs yet." : "Add a song from the sidebar to create your first Song Workspace."}
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="main-header">
                <div className="main-heading">
                  {readOnly ? (
                    <h1 className="view-title">{song.title.trim() || "Untitled Song"}</h1>
                  ) : (
                    <input
                      className="song-title"
                      data-focus={song.id}
                      value={song.title}
                      onChange={(e) => updateSong(song.id, (s) => ({ ...s, title: e.target.value }))}
                      placeholder="Song Title"
                      aria-label="Song title"
                    />
                  )}
                  <div className="header-song-actions">
                    {readOnly ? (
                      <KeyControl value={displayKey} readOnly onStep={stepView} onReset={displayKey !== song.baseKey ? resetView : undefined} />
                    ) : (
                      <>
                        <KeyControl value={song.baseKey} readOnly={false} onStep={stepKey} onType={(v) => updateSong(song.id, (s) => ({ ...s, baseKey: v }))} />
                        <button className="icon-btn" type="button" title="Move song up" aria-label="Move song up" disabled={index === 0} onClick={() => moveSong(-1)}><Icon name="up" /></button>
                        <button className="icon-btn" type="button" title="Move song down" aria-label="Move song down" disabled={index === event.songs.length - 1} onClick={() => moveSong(1)}><Icon name="down" /></button>
                        <button className="icon-btn danger" type="button" title="Delete song" aria-label="Delete song" onClick={deleteSong}><Icon name="trash" /></button>
                      </>
                    )}
                    <button className="export-btn" type="button" onClick={exportPng}><Icon name="image" />Export PNG</button>
                  </div>
                </div>
              </div>

              <SongTabs
                song={song}
                content={displayContent}
                readOnly={readOnly}
                onContentChange={(content) => updateSong(song.id, (s) => ({ ...s, content }))}
                onSectionsChange={(sections) => updateSong(song.id, (s) => ({ ...s, sections }))}
              />

              <div className="main-bottom">
                <div className="song-position">Song {songNumber(index)} of {event.songs.length}</div>
                {!readOnly && <button className="export-btn" type="button" onClick={exportPng}><Icon name="image" />Export PNG</button>}
              </div>
            </>
          )}
        </main>
      </div>

      <dialog
        ref={dialogRef}
        className="share-dialog"
        aria-labelledby="shareDialogTitle"
        onClose={() => setFallbackUrl(null)}
        onClick={(e) => { if (e.target === e.currentTarget) e.currentTarget.close(); }}
      >
        <form method="dialog" className="share-dialog-inner">
          <div className="share-dialog-title" id="shareDialogTitle">Share link</div>
          <p className="share-dialog-hint">Couldn&apos;t access the clipboard. Copy the link below with Ctrl+C (or ⌘C).</p>
          <input className="share-dialog-url" type="text" readOnly value={fallbackUrl ?? ""} aria-label="Shareable link" onFocus={(e) => e.currentTarget.select()} autoFocus />
          <div className="share-dialog-actions">
            <button className="btn" type="submit">Close</button>
          </div>
        </form>
      </dialog>
      <div className={`toast${toast ? " show" : ""}`} role="status" aria-live="polite">{toast}</div>
    </AppShell>
  );
}
```

- [ ] **Step 6: Append the styles** to the end of `app/globals.css`

```css
.key-control{display:inline-flex;align-items:center;gap:4px;margin-right:6px}
.key-control .key-field,.key-control .key-badge{margin-right:0}
.song-tabs{display:flex;gap:4px;margin-bottom:16px;border-bottom:1px solid var(--line);overflow-x:auto}
.song-tab{padding:10px 14px;border:0;border-bottom:2px solid transparent;background:none;color:var(--muted);font-size:14px;font-weight:700;white-space:nowrap}
.song-tab.active{color:var(--text);border-bottom-color:var(--accent)}
.lyrics-toolbar{display:flex;justify-content:flex-end;margin-bottom:8px}
.lyrics-section{margin:0 0 22px}
.lyrics-label{margin:0 0 6px;font-size:12px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:var(--accent)}
.lyrics-line{margin:0 0 4px;font-size:20px;line-height:1.5;overflow-wrap:anywhere}
.lyrics-line.chord-plain{font-size:18px;line-height:1.4}
.lyrics-empty{color:var(--muted)}
.chord-line{display:flex;flex-wrap:wrap;align-items:flex-end;margin:0 0 6px}
.chord-seg{display:inline-flex;flex-direction:column;min-width:0}
.chord{min-height:1.3em;font-size:15px;font-weight:800;color:var(--accent);white-space:pre}
.chord-text{font-size:18px;line-height:1.4;white-space:pre-wrap;overflow-wrap:anywhere}
.chord-grid{margin:0 0 6px;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:16px;font-weight:700;color:var(--accent);white-space:pre-wrap;overflow-wrap:anywhere}
.chord-editor{width:100%;min-height:360px;padding:12px;border:1px solid var(--line-strong);border-radius:var(--r-sm);background:var(--surface);color:var(--text);font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:14px;line-height:1.5;outline:none}
.chord-editor:focus{border-color:var(--accent)}
```

- [ ] **Step 7: Static checks and build**

Run: `wc -l components/EventEditor.tsx` (expected: under 400), then `npm test && npx tsc --noEmit && npm run lint && npm run build`.
Expected: everything passes. Lint shows only the existing font warning, with no unused imports.

- [ ] **Step 8: Commit**

```bash
git add components/SectionNotes.tsx components/SongTabs.tsx components/KeyControl.tsx components/Icon.tsx components/EventEditor.tsx app/globals.css
git commit -m "Add Lyrics Only / Lyrics + Chords / Section Notes tabs and key transposition

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 9: Manual check (the user, in a browser)**

1. Import a song with Add Song. The tabs show **Lyrics + Chords** first, the grid Intro shows as bars, and Section Notes lists the song's sections.
2. Press + twelve times. The chords cycle through and return to the original, and flat keys show flats.
3. Use **Edit**, change a chord, click **Done editing**, then Save and reload. The change is kept.
4. Open the share link. All three tabs are read-only, ± changes only your view, and **Reset** returns to the event's key.
5. At 375px width: long lyric lines wrap with chords staying above their words, and there is no horizontal page scroll (Review Focus 1).
6. Open an event from before this change. Its songs open on Section Notes, and the lyrics tabs say "No lyrics yet".

---

### Task 5: Docs and version 3.1.0

**Files:**
- Modify: `lib/event.ts` (`APP_VERSION`), `package.json` (`version`)
- Modify: `README.md`
- Create: `changelog/v3.1.0_changelog.md`

- [ ] **Step 1: Bump the version**

In `lib/event.ts`, set `export const APP_VERSION = "3.1.0";`. In `package.json`, set `"version": "3.1.0"`. Also change `**Version:** 3.0.0` to `**Version:** 3.1.0` at the top of `README.md`.

- [ ] **Step 2: Update `README.md`**

Make these edits, keeping the existing style of short sentences and bullets:

1. **Current status:** add a bullet: `- **Song library.** Run \`004_song_library.sql\` before using Upload songs or the Add Song search.`
2. **Setup step 3:** add a bullet after `003`: `- **\`004_song_library.sql\`** creates the shared \`songs\` table, a fast search index (\`pg_trgm\`) and the \`search_songs\` function. Logged-in users can search and add songs. Editing or deleting library songs is done in the Supabase table editor.`
3. **Using the app:**
   - Replace the Editor bullet's first sentence with: `- **Editor:** **+ Add Song** opens a search. Type at least 3 letters of the title or any lyric line, then pick a song to import its lyrics, chords and key. **Add blank song** adds an empty one.`
   - Add bullet: `- **Song tabs:** **Lyrics Only** (large lyrics, no chords), **Lyrics + Chords** (chords above the words, instrumental bars as \`| E . . . |\`; **Edit** shows the ChordPro text), **Section Notes** (the song details).`
   - Add bullet: `- **Key:** − and + move the song one semitone and rewrite its chords. On a share link they change only your view; **Reset** returns to the event's key.`
   - Add bullet: `- **Upload songs** (dashboard): drop ChordPro (\`.cho\`, \`.chopro\`, \`.pro\`, \`.chordpro\`) or plain chords-above-lyrics \`.txt\` files, check the preview, then save. Duplicates (same title and artist) and unreadable files are skipped.`
4. **Routes table:** add the row `| \`/library/upload\` | logged in | Upload songs to the library |`.
5. **Project layout:**
   - Add `  library/upload/page.tsx       server: auth check -> <UploadSongs>` and `  library/upload/UploadSongs.tsx  drop zone, preview, save` under `app/`.
   - Add `AddSongDialog.tsx`, `KeyControl.tsx`, `SectionNotes.tsx` and `SongTabs.tsx` under `components/`, with one-line descriptions.
   - Add `chordpro.ts` and `chordpro.test.ts` under `lib/`.
   - Add `004_song_library.sql` to the migrations line.
6. **Troubleshooting:** add:
   - `- **Add Song search says "Could not find the function public.search_songs" or Upload fails on a missing \`songs\` table:** run \`004_song_library.sql\`.`
   - `- **A plain-text song uploads with chords in the wrong place:** the converter reads a line of only chords as chords for the line below, by column. Use spaces, not a proportional-font layout, or upload ChordPro.`

- [ ] **Step 3: Write `changelog/v3.1.0_changelog.md`**

Copy `changelog/v3.0.0_changelog.md`. Move its "Current Release" v3.0.0 entry under "Previous Releases". Add at the top:

```markdown
## Current Release

### v3.1.0 — Song Library, Lyrics & Chords

**Status:** Current

Brief summary:
- Added a shared **song library** (`songs` table, `supabase/migrations/004_song_library.sql`) with fast search by any part of the title or lyrics.
- Added **Upload songs**: bulk upload of ChordPro or plain "chords above lyrics" text files, with a preview that flags duplicates, missing keys and unreadable files before saving.
- **Add Song** now searches the library and imports a song's lyrics, chords and key into the event as an editable copy. Section Notes are pre-filled with the song's sections. **Add blank song** keeps the old behaviour.
- Each song has three tabs: **Lyrics Only**, **Lyrics + Chords** (chords above the words, instrumental bars as `| E . . . |`) and **Section Notes**.
- **− / +** on the key transposes the chords (flats in flat keys). On share links it changes only the viewer's display.
- Songs are stored as ChordPro. Events and songs from before v3.1.0 keep working (no lyrics yet).
```

Add `v3.1.0 ↓ Song library, lyrics & chords` to the "Release Evolution" block, and add `- **v3.1.0:** feature release; adds the songs table (migration 004).` to Versioning Notes.

- [ ] **Step 4: Verify and commit**

Run: `npm test && npx tsc --noEmit && npm run lint && npm run build`. Also check that every path named in the README exists: `ls app/library/upload components lib supabase/migrations`.

```bash
git add lib/event.ts package.json README.md changelog/v3.1.0_changelog.md
git commit -m "Document song library and bump version to 3.1.0

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
