# Choose what Export PNG exports — design

Date: 2026-10-16 · Branch: `features/partial_export` (from `main` @ 8d58148, v3.3.0)

## Why

Each song in an event has three tabs: **Lyrics Only**, **Lyrics + Chords** and **Section Notes** (`components/SongTabs.tsx`). **Export PNG** only ever exports Section Notes (`lib/exportPng.ts`). Users want to send the team a lyrics sheet or a chord chart as an image, not just the section notes.

## Goals

- Clicking **Export PNG** asks which version to export: Lyrics Only, Lyrics + Chords or Section Notes.
- One click on a version downloads that PNG and closes the pop-up. A second version means opening the pop-up again. *(User's choice: option A of two mockups.)*
- The lyrics PNGs look like the tabs on screen and like today's export.

## Non-goals

- Exporting several versions in one click, PDF export, or exporting all songs at once.
- Exporting from the library song page (`app/library/[id]`). It has no Export button today.
- Any change to the database, migrations, saving, sharing, the library or the tabs themselves.

## Anti-goals (a failure even if it technically works)

- **Today's Section Notes PNG changes.** It must stay the same drawing with the same file name (`<Title>.png`). The only exception is a share-link viewer who switched the key: the BASE KEY box then shows their key (see "Which key").
- **A save or the dirty state is triggered.** Exporting must stay read-only.
- **The PNG shows different lyrics or chords than the tab.**

## Behaviour

### The pop-up

- Both **Export PNG** buttons in `components/EventEditor.tsx` open the same pop-up: the header one (editor and share link) and the bottom one (editor only).
- It's a native `<dialog>`, styled like the existing share fallback dialog (`share-dialog` classes). The title is "Export PNG" and the hint is "Which version?". There are three full-width buttons in tab order (Lyrics Only, Lyrics + Chords, Section Notes) and a **Cancel** button. Esc and clicking the backdrop also close it.
- **No lyrics:** when the song's content is empty (the same `content.trim() === ""` check `SongTabs` uses), the two lyrics buttons are disabled and show "No lyrics yet". Section Notes is always enabled. *(My call.)*
- The pop-up has no default focus on a version, so pressing Enter by accident doesn't download anything. *(My call.)*

### Which key

The export uses what the viewer is looking at. *(User's choice.)* On a share link, after a viewer switches the key, the Lyrics + Chords PNG uses the transposed chords (`displayContent`), and the BASE KEY box shows `displayKey`. In the editor, both are already the saved key and content. This applies to Section Notes too: on a share link, its BASE KEY box shows `displayKey`. In the editor that's identical to today. *(My call: one key per image, matching the screen.)*

### The PNGs

All three keep today's canvas setup: 1200px wide at 2× scale, light or dark palette from the current theme, the header (title up to 2 lines, "event • date", BASE KEY box) and the footer (MDCHORD · Author · Version). *(User's choice: layout A, one column.)*

| Version | Body | File name |
|---|---|---|
| Section Notes | Unchanged: "SONG DETAILS" label + section cards | `<Title>.png` (unchanged) |
| Lyrics + Chords | For each `parseChordPro(content).sections`: section label (uppercase, muted, like "SONG DETAILS"); each lyric line drawn as a chord row (monospace, accent colour) above a lyric row; grid lines drawn as one monospace row of cells joined by spaces; plain lines without chords drawn as a lyric row only | `<Title> - Chords.png` |
| Lyrics Only | For each `lyricLines(parsed)` section: label, then each line | `<Title> - Lyrics.png` |

- **Chord placement:** walk each line's `segments`. For each one, draw the chord at the current x and the text at the same x. Then advance x by the wider of the chord (plus one space) and the text. This is the same rule the `chord-seg` CSS uses on screen.
- **Long lines:** if a chord line is wider than the content width, it breaks between segments onto a new chord+lyric row pair. Lyrics-only lines use the existing `wrapLines`. *(My call.)*
- **Height:** the image is as tall as the song needs (measure first, then draw, like today). It keeps today's 600px minimum.
- **Fonts:** lyrics use `Inter,Arial,sans-serif` for Lyrics Only. Lyrics + Chords uses a monospace stack (`"Courier New",monospace`) for both rows, so the columns line up like the mockup. *(My call.)*

## Constraints / safety

- Client-only. No new dependencies.
- Reuse `parseChordPro` / `lyricLines` from `lib/chordpro.ts`. Don't write a second parser.
- Keep the existing export as is: lift the shared header, footer and download code into helpers in `lib/exportPng.ts`, and keep the Section Notes body exactly as today. A new `version` argument picks the body. Its default is `"notes"`, so the current call shape keeps today's output.
- The line-layout logic (segments → rows, wrapping) is a pure function that takes a `measure(text) => width` callback, so it can be unit-tested in Node without a canvas. Add one test file, `lib/exportPng.test.ts`, and add it to `npm test`.
- Version bump to 3.4.0 (`APP_VERSION`, `package.json`), a `changelog/v3.4.0_changelog.md`, and a README line about the picker.
- Add `.superpowers/` to `.gitignore` (brainstorm mockups).

## Settled after the builder check *(my calls)*

- **Passing what the viewer sees:** `EventEditor` calls the export with `{ ...song, baseKey: displayKey, content: displayContent }`. In the editor those equal the saved values, so nothing changes there.
- **Node tests:** `lib/exportPng.ts` imports `./event.ts` and `./chordpro.ts` with the extension, like `lib/library.ts`, so `node --test` can load it.
- **No default focus:** `autoFocus` on Cancel, because `showModal()` would otherwise focus Lyrics Only.
- **One segment wider than the page:** wrap the words inside that segment too (the chord stays on the first piece), so lyrics are never clipped.
- **Content with only directives or grid lines:** the lyrics buttons stay enabled (same check as the tabs). Lyrics Only then exports just the header and footer, which matches what the tab shows.

## Left to the builder

- The exact spacing, font sizes and colours of the lyrics body, within the "looks like today's export" rule.
- The component shape: an inline `<dialog>` in `EventEditor`, or a small `ExportDialog.tsx` next to `TeamDialog.tsx`.

## Done when

- `npm test`, `npm run lint` and `npm run build` pass.
- Checked by hand in light and dark: each version exports from the editor; a share link with a transposed key exports transposed chords; an empty song has the lyrics options disabled; Section Notes looks the same as before (compare with a PNG exported from `main`).
