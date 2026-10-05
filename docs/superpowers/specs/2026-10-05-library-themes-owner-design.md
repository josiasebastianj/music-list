# MDCHORD — Library Pages, Themes, Rhythm/BPM & Event Owner (Design)

**Date:** 2026-10-05
**Baseline:** `features/chordlist` @ `ecc040a` (v3.1.0: song library, Add Song search, song tabs, key ±, paste-to-ChordPro, MDCHORD branding)
**Target version:** v3.2.0

## 1. Goal

Turn the song library into a first-class part of the app, with its own navigation. Add the song details a worship team needs (rhythm, BPM, themes), and record who owns each event, because everyone shares one login in testing mode.

### Requirements (from the user)

1. `events` gets an **owner** field: free text saying who owns the event.
2. Library songs get **rhythm** (4/4, 3/4, …), **BPM**, and **themes** chosen from a new **Theme** table (`id`, `name`).
3. A **sidebar with three sections** replaces the "Upload songs" button:
   - **Events**: the event list.
   - **Library**: all songs, with lyrics and chords.
   - **Theme**: create, rename and delete themes.
4. The Library lists songs **alphabetically**.
5. New library songs come from **an uploaded file or free text**. The app shows a **preview**, and saves only after the user confirms. Saved songs are available to every event.
6. Library songs can be **viewed, edited and deleted**.
7. Song themes are stored in a **link table**. Deleting a theme removes it from every song automatically.
8. Importing a library song into an event **copies rhythm and BPM**, editable per event. Themes stay in the library.
9. **Navigation:**
   - The sidebar shows on the Events, Library and Theme pages.
   - Inside an open event it is replaced by compact Events / Library / Theme links in the top bar.
   - On phones it becomes a row of three tabs.

### Success criteria

1. The user can create a song from a pasted chord sheet or from files, see it rendered in the preview, adjust its details, and save it. It then appears in the Library A→Z and in every event's Add Song search.
2. Editing a library song's lyrics or chords updates its rendering and its search text. Deleting it removes it from the Library and from search, while events that already use it keep their copy.
3. Themes can be created, renamed and deleted. Deleting one removes it from all songs, with no errors and no stale chips.
4. An event's owner can be set in the editor and shows on the Events list and on share links.
5. An imported song shows its rhythm and BPM next to the key in the editor and on share links. Old events and songs load unchanged, with the new fields blank.
6. All new pages work at ≤680px with no horizontal page scroll.

### Decisions

| Topic | Decision |
|---|---|
| Add-song flow | One page, `/library/new`, with two inputs (Upload files / Paste text) feeding one preview list |
| Theme storage | Link table `song_themes`, with `on delete cascade` on both sides |
| Rhythm | Optional text. Presets 4/4, 3/4, 6/8, 2/4, 12/8, plus "Other…" (free text, ≤12 chars) |
| BPM | Optional integer, 20–300, enforced by a database check |
| Key on library songs | Editing it only relabels it ("the key the chords are written in"). There is no transposing in the library |
| Library Section Notes | Read-only on the library song page, generated from section headings (notes belong to events) |
| Access | Logged-in users can read and write songs, themes and links. Anonymous visitors get nothing |
| Old route | `/library/upload` redirects to `/library/new` |

### Out of scope

- Per-theme colours and theme ordering.
- Syncing library edits into events that already use the song.
- Song version history.
- Bulk edit or bulk delete in the Library.
- Real accounts; testing mode continues.

## 2. Data model

### 2.1 Migration — `supabase/migrations/005_library_details.sql` (run by the user in the SQL Editor)

```sql
-- events: who owns the event (free text; everyone shares one login in testing mode)
alter table public.events add column if not exists owner text;

-- songs: rhythm and tempo
alter table public.songs add column if not exists rhythm text;
alter table public.songs add column if not exists bpm integer check (bpm between 20 and 300);

-- themes and the song ↔ theme link
create table if not exists public.themes (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  created_at timestamptz not null default now()
);
create unique index if not exists themes_name_unique on public.themes (lower(name));

create table if not exists public.song_themes (
  song_id uuid not null references public.songs on delete cascade,
  theme_id uuid not null references public.themes on delete cascade,
  primary key (song_id, theme_id)
);
create index if not exists song_themes_theme_idx on public.song_themes (theme_id);

-- access: logged-in users manage the library; anonymous visitors get nothing
alter table public.themes enable row level security;
alter table public.song_themes enable row level security;
drop policy if exists "songs update" on public.songs;
drop policy if exists "songs delete" on public.songs;
drop policy if exists "themes all" on public.themes;
drop policy if exists "song_themes all" on public.song_themes;
create policy "songs update" on public.songs for update to authenticated using (true) with check (true);
create policy "songs delete" on public.songs for delete to authenticated using (true);
create policy "themes all" on public.themes for all to authenticated using (true) with check (true);
create policy "song_themes all" on public.song_themes for all to authenticated using (true) with check (true);

-- share links also return the owner (return columns change: drop and recreate; keep the event_name/event_date types as in 003)
drop function if exists public.get_shared_event(text);
create function public.get_shared_event(token text)
returns table (event_name text, event_date date, owner text, data jsonb, members jsonb)
language sql stable security definer set search_path = public
as $$
  select e.event_name, e.event_date, e.owner, e.data, e.members from public.events e where e.share_token = token;
$$;
grant execute on function public.get_shared_event(text) to anon, authenticated;

-- search also returns rhythm and bpm, so importing can copy them (return columns change: drop and recreate)
drop function if exists public.search_songs(text);
create function public.search_songs(q text)
returns table (id uuid, title text, artist text, song_key text, rhythm text, bpm integer, content text)
language sql stable set search_path = public
as $$
  with nq as (select trim(regexp_replace(lower(q), '[^[:alnum:]]+', ' ', 'g')) as v)
  select s.id, s.title, s.artist, s.song_key, s.rhythm, s.bpm, s.content
  from public.songs s, nq
  where length(nq.v) >= 3 and s.search_text like '%' || nq.v || '%'
  order by (lower(s.title) like '%' || nq.v || '%') desc, s.title
  limit 20;
$$;
grant execute on function public.search_songs(text) to authenticated;

notify pgrst, 'reload schema';
```

The existing `songs read` and `songs insert` policies from `004` are unchanged. `004` must have run before `005`.

### 2.2 Event data (inside `events.data`, no column change)

```ts
type Song = {
  id: string; title: string; baseKey: string;
  rhythm: string;       // NEW — "" when unknown
  bpm: number | null;   // NEW — null when unknown; integer 20–300
  content: string; librarySongId?: string; sections: Section[];
};
type SetlistEvent = { eventName: string; eventDate: string; owner: string /* NEW, from events.owner */; songs: Song[]; members: Member[] };
```

- **Loading:** `eventFromRow` reads `owner` from the row (`""` when null). `normalizeSong` defaults `rhythm` to `""` and accepts `bpm` only if it is an integer from 20 to 300 (otherwise `null`).
- **Saving:** the editor writes `owner: event.owner.trim() || null`.
- **Share links:** `get_shared_event` is recreated in `005` (§2.1) to also return `owner`.

## 2.3 Helpers in `lib/chordpro.ts` (dependency-free, unit-tested)

| Function | Contract |
|---|---|
| `songMeta(text): { rhythm: string; bpm: number \| null }` | Reads `{time: …}` into rhythm and `{tempo: …}` into bpm (the first number; `null` if it's not 20–300) from ChordPro directives. |
| `fromChordsAboveLyrics` (extended) | Lines `Tempo: 72`, `BPM: 72` and `Time: 3/4` (case-insensitive, `:` or `=`) are consumed like `Key:` and written as `{tempo: 72}` / `{time: 3/4}` directives. |
| `RHYTHM_PRESETS` | `["4/4", "3/4", "6/8", "2/4", "12/8"]` |
| `parseBpm(input: string): number \| null` | Trims the input. Returns an integer from 20 to 300, or `null`. |

## 3. Navigation and pages

### 3.1 Layout

- **`components/SectionNav.tsx`:** a list of links to **Events** (`/dashboard`), **Library** (`/library`) and **Theme** (`/themes`). It takes `current: "events" | "library" | "themes"` and marks it with `aria-current="page"`.
- **`components/SectionLayout.tsx`:** renders `AppShell` with a two-column body: the `SectionNav` sidebar on the left and the page content on the right. At ≤680px the sidebar becomes a horizontal row of three tabs under the header. The Events, Library and Theme pages use this layout.
- **Event editor and share pages:** no sidebar. In the editor (not on share links), the top bar gets compact **Events · Library · Theme** links, which are icon-only on phones. Leaving with unsaved edits uses the existing confirm and `beforeunload` guards. These links are plain `<a>` elements, so `beforeunload` covers them.
- **Removed:** the "Upload songs" button on the dashboard. `/library/upload` redirects to `/library/new`.
- **Proxy:** `proxy.ts` also guards `/themes`.

### 3.2 Events — `/dashboard`

This is the existing list inside `SectionLayout`. Each row shows its meta line (date · song count) and, when set, "Owner: …". **New event** stays.

### 3.3 Library — `/library`

- **List:** all songs, sorted by `lower(title)`, with title, artist, key, rhythm, BPM and theme chips. Each row links to `/library/[id]`.
- **Filtering:** a filter box matches title, artist and lyrics, using `normalizeSearch` against `search_text` on the client. A theme dropdown shows songs that have that theme.
- **Data:** loaded with `.select("id,title,artist,song_key,rhythm,bpm,search_text,themes(id,name)")`, which uses PostgREST's embedding through `song_themes`.
- **Actions:** **+ Add songs** links to `/library/new`.
- **Empty states:** "No songs yet. Add your first one." when the library is empty, and "No songs match." when the filter finds nothing.

### 3.4 Add songs — `/library/new`

**Input** (two tabs):
- **Upload files:** the existing drop zone and file picker. Multiple `.cho`, `.chopro`, `.pro`, `.chordpro` or `.txt` files.
- **Paste text:** a large textarea and a **Preview** button. The text goes through `convertPastedChords(text, true)`; when that returns `null`, the text is used as is (it's already ChordPro, or plain lyrics). The result is added to the preview list as a card named "Pasted text".

**Preview list:** one card per song. Each card has:
- the rendered **Lyrics + Chords** view (the same renderer as the song tabs), which can be collapsed;
- editable **title, artist, key, rhythm, BPM and themes**:
  - rhythm: a select of presets plus "Other…" with a text input;
  - BPM: a number input;
  - themes: a checkbox chip for each theme in the Theme table;
  - prefills: rhythm and BPM are prefilled from `songMeta`, and the key from `{key}` or `guessKey`, as today;
- a **status**, with the same rules as v3.1.0's upload preview. Possible statuses: Ready, Needs a key (with "Use E"), Needs a title, Already in library, Couldn't read it, Saved, Failed;
- a **Remove** button.

**Save:**
- **Save N songs** inserts the Ready cards one at a time. For each, it inserts the song (with `search_text`, rhythm and bpm), then its `song_themes` rows. A theme-link failure is shown on the card; the song itself stays saved.
- It then reports "Added X, skipped Y" and shows **Back to Library**.
- Nothing is saved before the click.
- Inputs are disabled while saving.

The v3.1.0 upload code (`UploadSongs.tsx`) is refactored into this page rather than duplicated.

### 3.5 Library song — `/library/[id]`

- **View:**
  - **Header:** title, artist, key, rhythm, BPM, theme chips.
  - **Tabs** (`SongTabs`, read-only):
    - **Lyrics Only**
    - **Lyrics + Chords**
    - **Section Notes**: shown read-only and generated from headings with `sectionNotesFrom`.
- **Edit:**
  - **Form:** the same fields as the preview card, plus the ChordPro textarea with a live rendered preview below it.
  - **Save:**
    - updates the `songs` row (title, artist, song_key, rhythm, bpm, content, and a rebuilt `search_text`);
    - replaces the song's `song_themes` rows by deleting the ones removed and inserting the ones added.
  - **Unsaved edits:** `beforeunload` warns when leaving with them, and **Cancel** asks for confirmation.
  - **Key hint:** "The key the chords are written in. Changing it doesn't move the chords."
- **Delete:** a confirmation: *"Delete "<title>" from the library? Events that already use it keep their copy."* After deleting, it redirects to `/library`.
- **Unknown id:** 404.

### 3.6 Themes — `/themes`

- **List:** themes A→Z, each with its number of songs (`themes` with `song_themes(count)`).
- **Add:** an input and **Add** button. A duplicate name (Postgres error `23505`) shows "Theme already exists". Empty names are rejected.
- **Rename:** inline, with Save and Cancel. The same duplicate handling applies.
- **Delete:** a confirmation: *"Delete "<name>"? It will be removed from N songs."*

### 3.7 Event editor additions

- **Owner field:** in the sidebar's event block under the date, with the placeholder "Owner". It's read-only text on share links and hidden there when empty.
- **Rhythm and BPM controls:** next to the `KeyControl` in the song header.
  - **Editor:** a compact rhythm select (presets plus Other) and a BPM number input.
  - **Share links:** small read-only badges ("3/4", "72 BPM"), shown only when set.
- **Add Song import:** copies `rhythm` and `bpm` from `search_songs`. A blank song has `rhythm: ""` and `bpm: null`.

## 4. Error handling

- **Database failures:** every save or delete failure shows the database's message next to the action, and typed input is kept.
- **Duplicates:** a duplicate song (same title and artist) or a duplicate theme name shows "already exists".
- **Missing `005`:** the error mentions a missing column or function such as `owner`, `rhythm`, `themes` or `song_themes`. Library, Themes and the editor show "Run supabase/migrations/005_library_details.sql in the Supabase SQL Editor." The README troubleshooting section gets the same message.
- **Unknown pages:** a library song id that doesn't exist gives a 404.

## 5. Testing

**Automated** (`node --test`):
- `songMeta`: covers directives, a missing value, an out-of-range BPM and a non-numeric BPM.
- `fromChordsAboveLyrics`: `Tempo:`, `BPM:` and `Time:` lines become directives and are not shown as lyrics.
- `parseBpm`: covers the edges 19, 20, 300 and 301, plus decimals and text.
- `eventFromRow`: `owner`, plus `rhythm` and `bpm` normalisation (an old event without these still loads).

**Static checks:** `tsc`, `lint`, `build`, and read-only curl redirects for the new routes.

**Manual** (the user, after running `005`):
1. Paste a chord sheet with `Tempo:` and `Time:` lines, preview it, pick themes, and save.
2. Upload two files, one of them a duplicate.
3. Edit a library song's text, key and themes, then delete a song.
4. Create, rename and delete a theme, checking that it disappears from songs.
5. Set an event owner and check it on the list and on the share link.
6. Import a song and check that rhythm and BPM show and can be edited.
7. Check every page at phone width.

## 6. Build phases

1. Migration `005` and the data helpers (`songMeta`, `parseBpm`, rhythm presets, the `rhythm`/`bpm`/`owner` fields in `lib/event.ts`), with tests.
2. `SectionNav` and `SectionLayout`; the Events page with owner; the editor's compact nav links and Owner field.
3. The Theme page.
4. The Library list and the library song page (view, edit, delete).
5. The Add-songs page (upload or paste → preview → save), refactored from the upload page, with the `/library/upload` redirect.
6. Rhythm and BPM in the editor and on share links, import copying, docs, and the v3.2.0 changelog.
