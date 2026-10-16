# Choose What Export PNG Exports — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Export PNG opens a pop-up where the user picks Lyrics Only, Lyrics + Chords or Section Notes, and gets that PNG.

**Architecture:** `lib/exportPng.ts` gains a `version` argument (default `"notes"`, today's output), with shared header/footer/download code and two new body painters built from `parseChordPro`/`lyricLines`. Chord-row layout is a pure, Node-tested function. A small `components/ExportDialog.tsx` (native `<dialog>`) replaces the direct calls in `EventEditor`.

**Tech Stack:** Next.js 16, React 19, TypeScript, Canvas 2D, `node --test`.

**Spec:** `docs/superpowers/specs/2026-10-16-partial-export-design.md`

## Global Constraints

- Client-only: no DB, migration, save, share or library changes. No new dependencies.
- Section Notes PNG: same drawing and same file name `<Title>.png` as today (only exception: share-link viewer's switched key in the BASE KEY box).
- Exporting never calls `update()` / sets dirty.
- Canvas: 1200px wide, 2× scale, today's light/dark palettes, header and footer, minimum height 600px.
- File names: `<Title>.png` (notes), `<Title> - Lyrics.png`, `<Title> - Chords.png`, using today's `safeFilename` sanitising.
- Reuse `parseChordPro` / `lyricLines` from `lib/chordpro.ts`; no second parser.
- `lib/exportPng.ts` imports use `.ts` extensions so `node --test` loads it.
- Version 3.4.0.
- Every commit message ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

- Share link with a switched key → Chords PNG has transposed chords and BASE KEY shows the viewer's key (Task 3 manual check; data path pinned by passing `displayKey`/`displayContent`).
- One chord segment wider than the page (long unbroken lyric) → words wrap, nothing clipped (Task 1 test `oversize segment wraps words`).
- Title with `/ : ? *` → `exportFileName` sanitises before adding the suffix (Task 1 test `file names`).
- Grid lines (`| G . | C . |`) → shown in Chords PNG, absent in Lyrics PNG (Task 2 manual check; Lyrics path uses `lyricLines`, which already drops them — covered in `chordpro.test.ts`).
- Song with empty content → lyrics buttons disabled, Section Notes still exports (Task 3 manual check).

---

### Task 1: Pure layout helpers + tests

**Files:**
- Modify: `lib/exportPng.ts` (imports at line 1; add exports)
- Create: `lib/exportPng.test.ts`
- Modify: `package.json` (`test` script)

**Interfaces:**
- Produces:
  - `export type ExportVersion = "lyrics" | "chords" | "notes";`
  - `export type Placed = { x: number; text: string };`
  - `export function layoutChordLine(segments: Segment[], maxWidth: number, measure: (s: string) => number): { chords: Placed[]; lyrics: Placed[] }[]` — one entry per printed row pair; `x` is relative to the content's left edge.
  - `export function exportFileName(title: string, version: ExportVersion): string`

- [ ] **Step 1: Write the failing tests** in `lib/exportPng.test.ts` (style of `lib/chordpro.test.ts`; `const measure = (s: string) => s.length * 10`):
  - `places chords over their syllable`: `layoutChordLine([{ text: "A" }, { chord: "G", text: "mazing " }, { chord: "G7", text: "grace" }], 1000, measure)` → `[{ chords: [{ x: 10, text: "G" }, { x: 80, text: "G7" }], lyrics: [{ x: 0, text: "A" }, { x: 10, text: "mazing " }, { x: 80, text: "grace" }] }]`.
  - `chord wider than its text pushes the next segment`: `[{ chord: "Cmaj7", text: "a" }, { chord: "G", text: "b" }]` → second segment at `x: 60` (chord width 50 + one space 10).
  - `wraps between segments`: three segments of text `"aaaa "` (width 50), `maxWidth` 120 → 2 rows; the second row starts at `x: 0`.
  - `oversize segment wraps words`: `[{ chord: "D", text: "one two three four" }]`, `maxWidth` 80 → every lyric `text` has `measure(text) <= 80`, the joined lyric text (spaces normalised) equals `"one two three four"`, and only the first row has the chord `D`.
  - `file names`: `exportFileName("Amazing Grace", "notes") === "Amazing Grace.png"`, `"lyrics"` → `"Amazing Grace - Lyrics.png"`, `"chords"` → `"Amazing Grace - Chords.png"`, `exportFileName("AC/DC: Live?", "chords") === "AC-DC- Live- - Chords.png"`, `exportFileName("  ", "notes") === "song-structure.png"`.

- [ ] **Step 2: Add the test file to `package.json`** `test` script (append `lib/exportPng.test.ts`) and change `lib/exportPng.ts` imports to `./event.ts`, adding `import { type Segment } from "./chordpro.ts"`. Run `npm test`. Expected: FAIL (`layoutChordLine` / `exportFileName` not exported).

- [ ] **Step 3: Implement both functions in `lib/exportPng.ts`.** `exportFileName` reuses the existing `safeFilename` expression (move it out of `exportSongImage`; then `exportSongImage` calls `exportFileName(title, "notes")` for today's name). `layoutChordLine` algorithm:

  ```
  x = 0; row = new row
  for each segment:
    w = max(measure(text), chord ? measure(chord) + measure(" ") : 0)
    if x > 0 and x + w > maxWidth: push row, start new row, x = 0
    if w > maxWidth: split text into words; place as many as fit per row
      (chord only on the first piece), each extra piece starting a new row at x = 0
    else: place chord (if any) and text at x; x += w
  push last row
  ```

- [ ] **Step 4: Run `npm test`.** Expected: all tests PASS (old and new).

- [ ] **Step 5: Commit** `git add lib/exportPng.ts lib/exportPng.test.ts package.json && git commit -m "Add chord-row layout and export file names for PNG versions"`

---

### Task 2: Lyrics and Chords bodies in `exportSongImage`

**Files:**
- Modify: `lib/exportPng.ts:38-125` (`exportSongImage`)

**Interfaces:**
- Consumes: `layoutChordLine`, `exportFileName`, `ExportVersion` (Task 1); `parseChordPro`, `lyricLines` from `./chordpro.ts`.
- Produces: `export function exportSongImage(event: SetlistEvent, song: Song, dark: boolean, version: ExportVersion = "notes"): void` — draws from `song.baseKey` and `song.content` as given (the caller passes the viewer's key/content).

- [ ] **Step 1: Restructure without changing output.** Split into: header measure/draw (title, meta, BASE KEY box), a body step chosen by `version` that both measures its height and draws, footer, download. The `"notes"` body is today's code moved verbatim (same constants, same "SONG DETAILS" label). Keep it in one file; small inner closures are fine.

- [ ] **Step 2: Add the `"chords"` body.** Label "LYRICS + CHORDS" in the "SONG DETAILS" label's style. For each `parseChordPro(song.content).sections`: section label uppercase in the muted 800 14px style (skip if empty); grid lines as one row `cells.join(" ")`; lyric lines via `layoutChordLine(segments, cw, m.measureText-based measure)` → chord row (`700 20px "Courier New",monospace`, colour `palette.keyLine`) above lyric row (`500 20px "Courier New",monospace`, `palette.text`). Omit the chord row when a row pair has no chords. File name from `exportFileName(title, "chords")`.

- [ ] **Step 3: Add the `"lyrics"` body.** Label "LYRICS". For each `lyricLines(parseChordPro(song.content))` section: label as above, then each line wrapped with the existing `wrapLines` at `500 22px Inter,Arial,sans-serif`. File name from `exportFileName(title, "lyrics")`.

- [ ] **Step 4: Verify.** Run `npm test`, `npm run lint`, `npm run build`. Expected: all pass, no new warnings.

- [ ] **Step 5: Commit** `git commit -am "Draw Lyrics Only and Lyrics + Chords PNG versions"`

---

### Task 3: Export pop-up and wiring

**Files:**
- Create: `components/ExportDialog.tsx`
- Modify: `components/EventEditor.tsx:121-123` (`exportPng`), `:300`, `:316` (buttons)
- Modify: `app/globals.css` (after `.share-dialog-actions`, line ~155)

**Interfaces:**
- Consumes: `exportSongImage(event, song, dark, version)` (Task 2).
- Produces: `export default function ExportDialog({ hasLyrics, onPick }: { hasLyrics: boolean; onPick: (v: ExportVersion) => void }) ` rendering the **Export PNG** trigger button (same markup as today: `className="export-btn"`, `<Icon name="image" />Export PNG`) plus its `<dialog>`, following `TeamDialog.tsx`'s pattern (ref + `showModal()`, backdrop click closes, `share-dialog` classes).

- [ ] **Step 1: Build `ExportDialog`.** Title "Export PNG" (`share-dialog-title`), copy "Which version?" (`share-dialog-copy`), three buttons in order Lyrics Only / Lyrics + Chords / Section Notes (class `btn export-choice`, full width). Lyrics buttons `disabled={!hasLyrics}` and, when disabled, show a second line "No lyrics yet". Clicking a version: close the dialog, then `onPick(v)`. `share-dialog-actions` with a Cancel button carrying `autoFocus` (form `method="dialog"`). CSS: `.export-choice{width:100%;justify-content:flex-start}` plus a muted small style for the "No lyrics yet" line.

- [ ] **Step 2: Wire into `EventEditor`.** Replace both export buttons with `<ExportDialog hasLyrics={displayContent.trim() !== ""} onPick={exportPng} />` (keep the bottom one inside `{!readOnly && …}`). Change `exportPng(version: ExportVersion)` to call `exportSongImage(event, { ...song, baseKey: displayKey, content: displayContent }, dark, version)`. No `update()` call.

- [ ] **Step 3: Verify.** `npm run lint`, `npm run build` pass. Then `npm run dev` and check by hand, light and dark:
  - Editor: each version downloads, with the right file name; Esc, backdrop and Cancel close without downloading; Enter right after opening downloads nothing; Save button stays clean (not dirty) after export.
  - Section Notes PNG matches one exported from `main` for the same song.
  - Song with no lyrics: lyrics buttons disabled with "No lyrics yet".
  - Song with a grid section: bars appear in Chords PNG, not in Lyrics PNG.
  - Share link: switch key with −/+, export Lyrics + Chords → transposed chords and new key in BASE KEY.

- [ ] **Step 4: Commit** `git add components/ExportDialog.tsx components/EventEditor.tsx app/globals.css && git commit -m "Ask which version to export from Export PNG"`

---

### Task 4: Version, changelog, README

**Files:**
- Modify: `lib/event.ts:1` (`APP_VERSION = "3.4.0"`), `package.json` (`"version": "3.4.0"`)
- Create: `changelog/v3.4.0_changelog.md` — copy `changelog/v3.3.0_changelog.md`, add a v3.4.0 "Choose What to Export" entry as Current (summary: Export PNG asks Lyrics Only / Lyrics + Chords / Section Notes; file names; share links export the key you're viewing; no migration), demote v3.3.0 to Previous Releases.
- Modify: `README.md:86` — "export a song as PNG" → "export a song as PNG (pick Lyrics Only, Lyrics + Chords or Section Notes)"; line 5 likewise if it reads naturally.

- [ ] **Step 1: Make the edits above.**
- [ ] **Step 2: Run `npm test`, `npm run lint`, `npm run build`.** Expected: pass.
- [ ] **Step 3: Commit** `git commit -am "v3.4.0: changelog, README and version for export versions"` (add the new changelog file first).
