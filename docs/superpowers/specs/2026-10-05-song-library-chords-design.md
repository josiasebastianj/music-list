# setlist.app — Song Library, Lyrics & Chords (Design)

**Date:** 2026-10-05
**Baseline:** v3.0.0 on `main` (Next.js, Supabase, testing-mode shared login, per-event team)
**Branch:** `features/chordlist`

## 1. Goal

Let a worship leader build a setlist by searching a few words of a song's lyrics, importing that song's lyrics, chords and key from a shared library, and letting the team read lyrics, or chords in the right key, without retyping anything.

### Requirements (from the user)

1. **Add Song** opens a search box. Searching part of the lyrics finds songs in a shared library. Picking one imports its lyrics, chords and base key into the event.
2. Each song in an event has three tabs: **Lyrics Only**, **Lyrics + Chords**, **Section Notes**.
3. Chords appear in bar notation (`| E . . . | D . . . |`) for instrumental parts and above the lyrics for sung parts, both within one song.
4. Raising or lowering the base key transposes the chords.
5. Songs reach the library by bulk upload of files through an upload page, available to all logged-in users for now.
6. An imported song is a full copy. The event's copy can be edited without touching the library.

### Success criteria

1. Uploading a folder of ChordPro or plain "chords above lyrics" files adds them to the library. Duplicates and unreadable files are reported and skipped, and the rest are saved.
2. Typing three or more characters from any lyric line (punctuation and case don't matter) finds the song.
3. Importing a song fills its title, key, lyrics/chords and one Section Note per song section.
4. Each − or + on the key moves every chord one semitone, with correct sharp/flat spelling for the new key. Transposing up 12 semitones returns the original text.
5. The three tabs work in the editor and on share links, at phone width, without horizontal page scroll.
6. Existing events and songs (without lyrics) keep working unchanged.

### Decisions

| Topic | Decision |
|---|---|
| Stored format | ChordPro text (one format for both chord styles) |
| Bar notation | ChordPro grid blocks: `{start_of_grid: Intro}` … `{end_of_grid}` |
| Plain-text uploads | Converted to ChordPro at upload time |
| Event copy | Full copy in `events.data.songs[].content`, editable per event |
| Key storage | An event song's `content` is always written in its current `baseKey`; ± rewrites it |
| Library editing | None in the app for now (Supabase table editor) |
| Library access | Read and insert for any logged-in user; nothing for anonymous visitors |
| Share-link transposing | Allowed, view-only, never saved |

### Out of scope (add when needed)

- Editing or deleting library songs in the app; versioning; syncing library fixes into events.
- Per-event arrangements (section order or repeats) beyond editing the copy's text.
- Chord diagrams, capo display, Nashville numbers, auto-scroll.
- Exporting lyrics or chord sheets as PNG or PDF (PNG export stays header + section notes).
- Importing from external sites or APIs.

## 2. Data model

### 2.1 Library table — `supabase/migrations/004_song_library.sql`

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

notify pgrst, 'reload schema';
```

- **`search_text`** is built in the browser at upload time by `searchText()` (§3). It is title + lyrics, lowercased, with chords, directives and grid lines removed and every run of non-letter, non-digit characters replaced by one space. The SQL query cleans up `q` the same way, so the two match.
- **Duplicate inserts:** these fail on the unique index. The upload page checks first (§4.2) and reports any that slip through.
- **Applying it:** the user runs this file in the Supabase SQL Editor, like the earlier migrations.

### 2.2 Event songs — still inside `events.data.songs` (no `events` column change)

```ts
type Song = {
  id: string;
  title: string;
  baseKey: string;          // current key; content is written in it
  content: string;          // NEW — ChordPro copy, editable; "" for songs without lyrics
  librarySongId?: string;   // NEW — informational: which library song it came from
  sections: Section[];      // unchanged — the Section Notes tab
};
```

- **Missing `content`:** `eventFromRow` normalises it to `""` and `librarySongId` to `undefined`, so old events load unchanged.
- **Share links:** `get_shared_event` already returns `data`, so share links get `content` with no SQL change.

## 3. Chord engine — `lib/chordpro.ts` (no dependencies, unit-tested)

| Function | Contract |
|---|---|
| `parseChordPro(text): ParsedSong` | Returns `{ title, artist, key, sections }`. Each section is `{ label, kind: "lyrics" \| "grid", lines }`. A lyrics line is a list of `{ chord?: string, text: string }` segments; a grid line is a list of cells (chords, `.`, `\|`). Section starts come from `{start_of_verse: Verse 1}`, `{start_of_chorus}`, `{start_of_bridge}`, `{start_of_grid: Intro}` (and the short forms `{sov}`, `{soc}`, `{sob}`, `{sog}`), and also from `{comment: Chorus}` lines used as headings. Lines outside any section go into an unlabelled section. Unknown directives are ignored. |
| `fromChordsAboveLyrics(text, fallbackTitle): string` | Converts plain text to ChordPro. A **chord line** is one where every token is a chord, `\|`, `.`, `-` or `x2`-style marker. A chord line followed by a lyric line is merged into `[C]` marks at the matching columns. A chord line containing `\|` (or a chord line with no lyric line after it) becomes a grid line. A line ending in `:` or matching a heading word (Intro, Verse, Pre-Chorus, Chorus, Bridge, Interlude, Outro, Tag, Ending, with an optional number) starts a section. The title is the first line that isn't a chord line or heading, falling back to `fallbackTitle` (the filename). |
| `isChordProText(text): boolean` | True when the text contains a `{…}` directive or a `[…]` mark that parses as a chord. Used to pick the parser on upload. |
| `transpose(text, from, to): string` | Shifts every chord in `[…]` marks and grid lines by the semitone distance between keys `from` and `to`, and rewrites `{key: …}`. Handles roots with `#`/`b`, qualities (`m`, `m7`, `maj7`, `sus4`, `add9`, `dim`, `aug`, `7`, `9`, …) and slash chords (`D/F#`). Spelling follows the target key: flat keys (F, Bb, Eb, Ab, Db, Gb and their relative minors) use flats, the rest use sharps. Unrecognised tokens (`N.C.`, `(x2)`, `/`) are left as written. If either key isn't recognised, returns `text` unchanged. |
| `keyStep(key, steps): string \| null` | The key `steps` semitones away, spelled by the same rule; `null` for an unknown key. Used by the ± buttons. |
| `searchText(title, text): string` | The normalised string stored in `songs.search_text` (§2.1). |
| `lyricLines(parsed): { label, lines: string[] }[]` | Lyrics without chords, skipping grid sections. Used by Lyrics Only and by search-result snippets. |
| `guessKey(parsed): string \| null` | The first chord's root, plus `m` if it's minor. Prefills a missing key in the upload preview. |

## 4. Screens and flows

### 4.1 Add Song (editor)

- **The dialog:** **+ Add Song** opens a dialog (existing `.share-dialog` styling) with a search box.
- **Searching:** after three or more characters and a 300 ms pause it calls `rpc("search_songs", { q })`. Results show title, artist, key and the first lyric line containing the search words (found with `lyricLines`), with the words highlighted. A newer search replaces an older pending one.
- **Picking a result** adds `{ id: uid("song"), title, baseKey: song_key, content, librarySongId, sections }`. The `sections` are one Section Note per parsed section label, in order, with empty notes and the palette colours, starting from the first palette colour. The new song becomes active and the event is marked unsaved.
- **Empty results** show "No songs found", an **Add blank song** button (today's behaviour) and an **Upload songs** link to `/library/upload`.
- **Errors:** a search error shows inline in the dialog, and the typed text stays.

### 4.2 Upload page — `/library/upload`

- **Access and links:** logged-in users only (the proxy also guards `/library`). The dashboard header links to it with **Upload songs**.
- **Choosing files:** a drop zone plus a file picker accept multiple `.cho`, `.chopro`, `.pro`, `.chordpro` or `.txt` files.
- **Reading:** each file is read in the browser. `isChordProText` picks ChordPro, or else `fromChordsAboveLyrics` converts it. Title, artist and key come from the directives. A missing key is prefilled with `guessKey` and marked **Needs a key** until confirmed.
- **Preview:** a table with one row per file showing the filename, editable title, artist and key, the sections found, and a status:
  - **Ready**
  - **Already in library**: the title + artist exists, checked with one `select` for all titles
  - **Needs a key**
  - **Couldn't read it**: no title, or no lyric or grid lines
- **Saving:** **Save N songs** inserts the Ready rows one at a time, so one failure doesn't block the rest, with `search_text` from `searchText`. It then shows "Added X, skipped Y" with reasons. Nothing is saved before that click.

### 4.3 Song workspace tabs (editor and share link)

- **Where the tabs sit:** a tab bar under the song header with **Lyrics Only | Lyrics + Chords | Section Notes**.
- **Lyrics Only:** section headings with lyric lines from `lyricLines`, in a large reading size. Grid sections are hidden.
- **Lyrics + Chords:** sections from `parseChordPro`.
  - **Lyric lines:** each segment is an inline block with the chord above its text, so lines wrap on phones without chords drifting.
  - **Grid lines:** shown as monospace rows of bars.
- **Section Notes:** today's song details UI, unchanged, including read-only mode.
- **Editing (editor only):** Lyrics + Chords has an **Edit** switch that shows the raw ChordPro in a monospace textarea. Changes mark the event unsaved, and switching back re-renders.
- **Default tab:** Lyrics + Chords when `content` isn't empty, otherwise Section Notes. The chosen tab is remembered per device in `localStorage` (`setlistApp_songTab`, wrapped in try/catch).
- **Songs without content:** the lyrics tabs show "No lyrics yet", and the editor adds a hint to use Edit or import a song.

### 4.4 Changing the key

- **Editor:** the Key field gets − and + buttons. A press does `next = keyStep(baseKey, ±1)`. If `next` isn't null, it sets `baseKey = next` and `content = transpose(content, baseKey, next)` and marks the event unsaved. Typing a key directly only changes `baseKey` and doesn't transpose. If the typed key isn't recognised, the buttons are disabled with an "Unknown key" title.
- **Share link:** the same ± buttons change a local, unsaved display key. Chords render from `transpose(content, baseKey, displayKey)`. A small **Reset** returns to the event's key.

## 5. Code structure (new and changed files)

```
lib/chordpro.ts              NEW  chord engine (§3)
lib/chordpro.test.ts         NEW  node --test cases
lib/event.ts                 Song gets content + librarySongId; eventFromRow normalises them
components/SongTabs.tsx      NEW  tab bar + Lyrics Only / Lyrics + Chords views (+ Edit textarea in editor)
components/AddSongDialog.tsx NEW  search dialog (§4.1)
components/EventEditor.tsx   uses AddSongDialog, SongTabs and the key ± buttons; Section Notes moves into a tab
app/library/upload/page.tsx  NEW  server: auth check → <UploadSongs>
app/library/upload/UploadSongs.tsx NEW  client: drop zone, preview, save
app/dashboard/page.tsx       "Upload songs" link
proxy.ts                     also guards /library
app/globals.css              appended styles for tabs, chord lines, grid rows, upload table
supabase/migrations/004_song_library.sql NEW (§2.1)
package.json                 test script also runs lib/chordpro.test.ts
```

`EventEditor.tsx` is at ~395 lines. The Section Notes markup moves into `SongTabs` so the editor doesn't grow past ~400.

## 6. Error handling

- **Search, upload and save failures:** shown where they happen (dialog, upload row, or the existing banner). Typed text and unsaved edits stay.
- **Unreadable or duplicate files:** marked per row; the other files still save.
- **Unrecognised chords or keys:** left as written. Transposing never throws.
- **Malformed `content`:** `parseChordPro` never throws. Unknown directives are ignored and stray brackets are kept as text.

## 7. Testing

**Automated** (`lib/chordpro.test.ts`, `node --test`):
- **Parsing:** directives, short forms, grid blocks, `{comment:}` headings, lines outside sections.
- **Transposing:**
  - sharp→flat keys (E→Eb writes `Eb`, `Bb`, not `D#`, `A#`);
  - slash chords;
  - qualities;
  - `N.C.`;
  - `{key:}` rewrite;
  - +12 round trip;
  - an unknown key returns the input unchanged.
- **`keyStep`:** steps across the octave boundary, and minor keys.
- **`fromChordsAboveLyrics`:**
  - chord columns merge into the right words;
  - bar lines become grids;
  - heading detection;
  - title fallback to the filename.
- **`searchText`:** the punctuation, case and chord stripping matches what the SQL does to the query.
- **`event.test.ts`:** `content` and `librarySongId` normalisation.

**Manual:**
1. Upload a mix of ChordPro and plain files, including a duplicate and an unreadable file.
2. Search by a lyric fragment and import the song.
3. Check the three tabs in the editor and on a share link at 375px.
4. Use ± through a full octave.
5. Edit the content and save.
6. Confirm old events still load.

## 8. Build phases

Each phase is one or more commits that leave the app working.

1. **Chord engine:** `lib/chordpro.ts` and its tests.
2. **Library:** migration `004`, the upload page and the dashboard link.
3. **Add Song:** search dialog and import; `Song.content` and `librarySongId`.
4. **Tabs and key:** `SongTabs`, the ± buttons, and share-link transposing.
