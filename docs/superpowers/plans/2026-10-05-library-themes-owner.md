# Library Pages, Themes, Rhythm/BPM & Event Owner Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give MDCHORD a three-section sidebar (Events, Library, Theme), a browsable, editable song library with rhythm, BPM and themes, one "Add songs" page (paste or upload, then preview, then save), and an owner field on events.

**Architecture:**
- **Database:** migration `005` adds `events.owner`, `songs.rhythm`/`bpm`, and the `themes` + `song_themes` tables. It also recreates `search_songs` and `get_shared_event` to return the new columns.
- **Logic:** pure helpers in `lib/chordpro.ts` (tempo/time parsing, BPM rules) and a new `lib/library.ts` (fields, validation, drafts), all covered by `node --test`.
- **UI:**
  - a `SectionLayout` (sidebar plus content) used by the Events, Library and Theme pages;
  - the chord rendering moves out of `SongTabs` into a `ChordSheet` component;
  - a `SongFields` form shared by the library editor and the add-songs preview cards.

**Tech Stack:** Next.js 16 (App Router, TypeScript), React 19, Supabase (`@supabase/ssr`, PostgREST embedding), Node 24 `node --test`.

**Spec:** `docs/superpowers/specs/2026-10-05-library-themes-owner-design.md`

## Global Constraints

- **Dependencies:** no new runtime or dev dependencies.
- **Database:** implementers never run SQL or write to Supabase. The user runs `supabase/migrations/005_library_details.sql` in the SQL Editor.
- **CSS:** append new rules at the end of `app/globals.css`. Don't edit existing rules. Reuse the variables `--text`, `--muted`, `--line`, `--line-strong`, `--surface`, `--surface-2`, `--accent`, `--accent-soft`, `--danger` and `--r-sm`.
- **Phone layout:** every page must work at ≤680px with no horizontal page scroll.
- **Rhythm:** optional text, ≤12 characters. The presets are exactly `["4/4", "3/4", "6/8", "2/4", "12/8"]`, offered through a `<datalist>`, and free text is allowed.
- **BPM:** optional integer, 20–300 inclusive. The database enforces it with `check (bpm between 20 and 300)`.
- **Missing migration 005:** errors that mention `owner`, `rhythm`, `bpm`, `themes` or `song_themes` together with "does not exist", "schema cache" or "could not find" must show `… — run supabase/migrations/005_library_details.sql in the Supabase SQL Editor.` Use `migrationHint` to add this.
- **Navigation links:** links between sections are plain `<a>` elements. That means full page loads, so the editor's `beforeunload` guard protects unsaved edits.
- **Version:** v3.2.0.
- **Untracked files:** never stage `music-list-2.3.0.html`, `mdchord.PNG` or `example/`.
- **Commits:** end each message with a blank line and the `Co-Authored-By:` line your harness specifies. Check `git branch --show-current` (it must be `features/chordlist`) before every commit.

## Review Focus

1. **Typing a BPM digit by digit** ("1", "12", "120") must never reset the field. In the editor it's a number and in the library it's text. *(Task 5: `Fields.bpm` is text. Task 7: `TempoControl` keeps local text. Manual check in Task 7, Step 6.)*
2. **Deleting a theme used by many songs, or renaming one**, must leave no stale chips. The Library list and song pages show the current names. *(Task 3, manual Step 7. The database cascade is in Task 1's SQL.)*
3. **Opening any page before migration 005 has run** must show the "run 005" hint, not a cryptic error. *(Task 1 test: "migrationHint points at migration 005 only for its missing columns".)*
4. **A pasted sheet with `Tempo:`, `BPM:` and `Time:` lines** must prefill BPM and rhythm, and those lines must not appear as lyrics. *(Task 1 tests on `fromChordsAboveLyrics` and `songMeta`. Task 6 test "draftFrom reads a pasted chord sheet with tempo and time".)*
5. **Editing or deleting a library song that events already use** must leave those events unchanged, because they hold their own copy. *(Task 5, manual Step 9.)*

---

### Task 1: Migration 005 and data helpers

**Files:**
- Create: `supabase/migrations/005_library_details.sql`
- Modify: `lib/chordpro.ts` (add `RHYTHM_PRESETS`, `parseBpm`, `songMeta`; make the converter read Tempo/BPM/Time lines)
- Modify: `lib/chordpro.test.ts`
- Modify: `lib/event.ts` (`Song.rhythm` and `Song.bpm`, `SetlistEvent.owner`, `EventRow.owner`, `migrationHint`)
- Modify: `lib/event.test.ts`
- Modify: `lib/songContent.ts` (`fillFromContent` also fills rhythm and BPM)
- Modify: `components/AddSongDialog.tsx` (blank songs and imports carry rhythm and BPM)

**Interfaces:**
- Produces, from `lib/chordpro.ts`:
  - `RHYTHM_PRESETS: string[]`
  - `parseBpm(input: string): number | null`
  - `songMeta(text: string): { rhythm: string; bpm: number | null }`
- Produces, from `lib/event.ts`:
  - `Song` now includes `rhythm: string; bpm: number | null`
  - `SetlistEvent` now includes `owner: string`
  - `EventRow` now includes `owner?: string | null`
  - `migrationHint(message: string): string`
- Produces, in the database:
  - `events.owner`, `songs.rhythm`, `songs.bpm`
  - `themes(id, name, created_at)` and `song_themes(song_id, theme_id)`
  - `search_songs(q)` returning `(id, title, artist, song_key, rhythm, bpm, content)`
  - `get_shared_event(token)` returning `(event_name, event_date, owner, data, members)`

- [ ] **Step 1: Write the migration** `supabase/migrations/005_library_details.sql`

Copy it verbatim from spec §2.1, all of it from `-- events: who owns the event` to `notify pgrst, 'reload schema';`. That includes the `get_shared_event` block. Don't run it.

- [ ] **Step 2: Write the failing tests**

In `lib/chordpro.test.ts`, add `parseBpm` and `songMeta` to the import list from `"./chordpro.ts"`, then append:

```ts
test("parseBpm accepts whole numbers from 20 to 300", () => {
  assert.equal(parseBpm("72"), 72);
  assert.equal(parseBpm(" 20 "), 20);
  assert.equal(parseBpm("300"), 300);
  for (const bad of ["19", "301", "72.5", "fast", "", "-80"]) assert.equal(parseBpm(bad), null, bad);
});

test("songMeta reads {time} and {tempo}", () => {
  assert.deepEqual(songMeta("{title: X}\n{time: 3/4}\n{tempo: 72 bpm}\n[G]Hi"), { rhythm: "3/4", bpm: 72 });
  assert.deepEqual(songMeta("{tempo: 400}"), { rhythm: "", bpm: null });
  assert.deepEqual(songMeta("{tempo: slow}"), { rhythm: "", bpm: null });
  assert.deepEqual(songMeta("[G]No meta"), { rhythm: "", bpm: null });
});

test("fromChordsAboveLyrics turns Tempo/BPM/Time lines into directives", () => {
  assert.equal(fromChordsAboveLyrics("Song\nKey: G\nTempo: 72\nTime: 3 / 4\nG\nHello", "f"), "{title: Song}\n{key: G}\n{time: 3/4}\n{tempo: 72}\n[G]Hello");
  assert.equal(fromChordsAboveLyrics("Song\nBPM = 120\nG\nHello", "f"), "{title: Song}\n{tempo: 120}\n[G]Hello");
  assert.deepEqual(songMeta(fromChordsAboveLyrics("Song\nTempo: 72\nTime: 6/8\nG\nHi", "f")), { rhythm: "6/8", bpm: 72 });
});
```

In `lib/event.test.ts`, add `migrationHint` to the import from `"./event.ts"`. Then make three changes:

1. In the test `"eventFromRow handles missing or non-array data"`, add `owner: "",` to the expected object, right after `eventDate: "2026-10-04",`.
2. In the test `"eventFromRow keeps valid data unchanged"`, replace the `songs` line with:

```ts
  const songs = [{ id: "song-1", title: "Way Maker", baseKey: "E", rhythm: "3/4", bpm: 72, content: "[E]Way maker", librarySongId: "lib-1", sections: [{ id: "section-1", name: "Intro", color: "#93dfb2", note: "Soft\nkeys" }] }];
```

3. Append:

```ts
test("eventFromRow reads owner and cleans rhythm and bpm", () => {
  const event = eventFromRow({ event_name: null, event_date: null, owner: "Team A", data: { songs: [{ rhythm: "6/8", bpm: 120 }, { rhythm: 5, bpm: 72.5 }, { bpm: 900 }, {}] } });
  assert.equal(event.owner, "Team A");
  assert.deepEqual(event.songs.map((s) => [s.rhythm, s.bpm]), [["6/8", 120], ["", null], ["", null], ["", null]]);
  assert.equal(eventFromRow({ event_name: null, event_date: null, data: null }).owner, "");
});

test("migrationHint points at migration 005 only for its missing columns", () => {
  assert.match(migrationHint("column events.owner does not exist"), /005_library_details\.sql/);
  assert.match(migrationHint("Could not find the table 'public.themes' in the schema cache"), /005_library_details\.sql/);
  assert.equal(migrationHint("JWT expired"), "JWT expired");
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npm test`
Expected: FAIL. The error should say the module doesn't export `parseBpm` or `migrationHint`, or the `owner`, `rhythm` and `bpm` assertions should fail.

- [ ] **Step 4: Implement in `lib/chordpro.ts`**

After the existing `const KEY_LINE_RE = …;` line, add:

```ts
const TEMPO_LINE_RE = /^(?:tempo|bpm)\s*[:=]\s*(\d+)\s*(?:bpm)?\s*$/i;
const TIME_LINE_RE = /^time(?:\s*signature)?\s*[:=]\s*(\d+\s*\/\s*\d+)\s*$/i;
```

In `fromChordsAboveLyrics`, find the existing block that collects `key`, which ends with `});`. Directly after it, and before `let title = fallbackTitle;`, insert:

```ts
  let tempo = "";
  let time = "";
  lines.forEach((l, i) => {
    if (used.has(i)) return;
    const t = l.trim();
    const tm = TEMPO_LINE_RE.exec(t);
    if (tm && !tempo) {
      tempo = tm[1];
      used.add(i);
      return;
    }
    const ts = TIME_LINE_RE.exec(t);
    if (ts && !time) {
      time = ts[1].replace(/\s+/g, "");
      used.add(i);
    }
  });
```

Then replace

```ts
  if (withTitle && key) out.push(`{key: ${key}}`);
```

with

```ts
  if (withTitle && key) out.push(`{key: ${key}}`);
  if (withTitle && time) out.push(`{time: ${time}}`);
  if (withTitle && tempo) out.push(`{tempo: ${tempo}}`);
```

Append these to the end of the file:

```ts
export const RHYTHM_PRESETS = ["4/4", "3/4", "6/8", "2/4", "12/8"];

export function parseBpm(input: string): number | null {
  const t = input.trim();
  if (!/^\d+$/.test(t)) return null;
  const n = Number(t);
  return n >= 20 && n <= 300 ? n : null;
}

// {time: 3/4} → rhythm, {tempo: 72} → bpm (first number, 20–300)
export function songMeta(text: string): { rhythm: string; bpm: number | null } {
  let rhythm = "";
  let bpm: number | null = null;
  for (const raw of text.replace(/\r\n?/g, "\n").split("\n")) {
    const d = DIRECTIVE_RE.exec(raw.trim());
    if (!d) continue;
    const name = d[1].toLowerCase();
    const value = (d[2] ?? "").trim();
    if (name === "time" && !rhythm) rhythm = value.slice(0, 12);
    if (name === "tempo" && bpm === null) bpm = parseBpm((/\d+/.exec(value) ?? [""])[0]);
  }
  return { rhythm, bpm };
}
```

`DIRECTIVE_RE` is already defined near the top of the file.

- [ ] **Step 5: Implement in `lib/event.ts`**

Replace the `Song`, `SetlistEvent` and `EventRow` type lines with:

```ts
export type Song = { id: string; title: string; baseKey: string; rhythm: string; bpm: number | null; content: string; librarySongId?: string; sections: Section[] };
export type Member = { name: string; role: string };
export type SetlistEvent = { eventName: string; eventDate: string; owner: string; songs: Song[]; members: Member[] };
export type EventRow = { event_name: string | null; event_date: string | null; owner?: string | null; data: unknown; members?: unknown };
```

Keep exactly one `Member` line: delete the old one if it now appears twice.

After the `list` helper, add:

```ts
const cleanBpm = (value: unknown) => (typeof value === "number" && Number.isInteger(value) && value >= 20 && value <= 300 ? value : null);
```

In `normalizeSong`, add these two lines after `baseKey: str(song?.baseKey),`:

```ts
    rhythm: str(song?.rhythm).slice(0, 12),
    bpm: cleanBpm(song?.bpm),
```

In `eventFromRow`, add `owner: row.owner ?? "",` after `eventDate: row.event_date ?? "",`.

Append:

```ts
// Errors caused by migration 005 not having been run get a pointer to the fix.
export function migrationHint(message: string): string {
  return /(owner|rhythm|bpm|themes|song_themes)/i.test(message) && /(does not exist|schema cache|could not find)/i.test(message)
    ? `${message} — run supabase/migrations/005_library_details.sql in the Supabase SQL Editor.`
    : message;
}
```

- [ ] **Step 6: Update the places that build a `Song`**

In `lib/songContent.ts`, change the first import to `import { guessKey, parseChordPro, sectionLabels, songMeta } from "./chordpro";`. In `fillFromContent`, add `const meta = songMeta(content);` after `const parsed = parseChordPro(content);`, and add these lines after the `baseKey:` line:

```ts
    rhythm: song.rhythm.trim() ? song.rhythm : meta.rhythm,
    bpm: song.bpm ?? meta.bpm,
```

In `components/AddSongDialog.tsx`:
- Change the `Result` type to `type Result = { id: string; title: string; artist: string | null; song_key: string; rhythm?: string | null; bpm?: number | null; content: string };`.
- In `songFromLibrary`, add `rhythm: r.rhythm ?? "",` and `bpm: r.bpm ?? null,` after `baseKey: r.song_key,`.
- Replace the blank-song object `{ id: uid("song"), title: "", baseKey: "", content: "", sections: [] }` with `{ id: uid("song"), title: "", baseKey: "", rhythm: "", bpm: null, content: "", sections: [] }`.

- [ ] **Step 7: Run the tests and static checks**

Run: `npm test && npx tsc --noEmit && npm run lint`
Expected:
- all tests pass;
- tsc is clean. If tsc reports another place that builds a `Song` or `SetlistEvent` without the new fields, add `rhythm: "", bpm: null` or `owner: ""` there and note it in your report;
- lint shows only the existing `no-page-custom-font` warning.

- [ ] **Step 8: Commit**

```bash
git add supabase/migrations/005_library_details.sql lib/chordpro.ts lib/chordpro.test.ts lib/event.ts lib/event.test.ts lib/songContent.ts components/AddSongDialog.tsx
git commit -m "Add migration 005 and rhythm, BPM and owner to the data model"
```

---

### Task 2: Sidebar navigation, Events page owner, editor nav and Owner field

**Files:**
- Modify: `components/Icon.tsx` (add `calendar`, `music`, `tag`)
- Create: `components/SectionNav.tsx`
- Create: `components/SectionLayout.tsx`
- Modify: `app/dashboard/page.tsx`
- Modify: `components/EventEditor.tsx`
- Modify: `app/events/[id]/page.tsx`
- Modify: `proxy.ts`
- Modify: `app/globals.css` (append)

**Interfaces:**
- Consumes from Task 1: `migrationHint`, `SetlistEvent.owner`, and the `events.owner` column.
- Produces:
  - `type SectionId = "events" | "library" | "themes"`
  - `SectionNav({ current?: SectionId; compact?: boolean })`
  - `SectionLayout({ current: SectionId; actions?: ReactNode; children: ReactNode })`

- [ ] **Step 1: Icons.** In `components/Icon.tsx`, add these entries to `paths` after `users`:

```tsx
  calendar: <><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></>,
  music: <><path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" /></>,
  tag: <><path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z" /><circle cx="7.5" cy="7.5" r="1.5" /></>,
```

- [ ] **Step 2: Write `components/SectionNav.tsx`**

```tsx
import Icon, { type IconName } from "./Icon";

export type SectionId = "events" | "library" | "themes";

const LINKS: { id: SectionId; href: string; label: string; icon: IconName }[] = [
  { id: "events", href: "/dashboard", label: "Events", icon: "calendar" },
  { id: "library", href: "/library", label: "Library", icon: "music" },
  { id: "themes", href: "/themes", label: "Theme", icon: "tag" },
];

// Plain <a>: full page loads, so the editor's beforeunload guard covers unsaved edits.
export default function SectionNav({ current, compact = false }: { current?: SectionId; compact?: boolean }) {
  return (
    <nav className={`section-nav${compact ? " compact" : ""}`} aria-label="Sections">
      {LINKS.map((l) => (
        <a
          key={l.id}
          href={l.href}
          className={`section-nav-link${l.id === current ? " active" : ""}`}
          aria-current={l.id === current ? "page" : undefined}
          aria-label={compact ? l.label : undefined}
        >
          <Icon name={l.icon} />
          <span className="section-nav-label">{l.label}</span>
        </a>
      ))}
    </nav>
  );
}
```

- [ ] **Step 3: Write `components/SectionLayout.tsx`**

```tsx
import type { ReactNode } from "react";
import AppShell from "./AppShell";
import SectionNav, { type SectionId } from "./SectionNav";

export default function SectionLayout({ current, actions, children }: { current: SectionId; actions?: ReactNode; children: ReactNode }) {
  return (
    <AppShell actions={actions}>
      <div className="section-layout">
        <SectionNav current={current} />
        <div className="section-main">{children}</div>
      </div>
    </AppShell>
  );
}
```

- [ ] **Step 4: Events page** (`app/dashboard/page.tsx`)
  - Remove `import Link from "next/link";` and `import AppShell from "@/components/AppShell";`. Add `import SectionLayout from "@/components/SectionLayout";`. Change the event import to `import { formatEventDate, migrationHint } from "@/lib/event";`.
  - Change the select to `.select("id,event_name,event_date,owner,data,share_token,updated_at")`.
  - Replace `<AppShell actions={<><ThemeToggle /><LogoutButton /></>}>` and its closing `</AppShell>` with `<SectionLayout current="events" actions={<><ThemeToggle /><LogoutButton /></>}>` … `</SectionLayout>`.
  - Change the eyebrow text `DASHBOARD` to `EVENTS`.
  - Replace the `dash-head-actions` div (it holds the Upload songs link and `NewEventButton`) with `<NewEventButton />`.
  - Change the error line to `{error && <div className="share-banner error" role="alert">Could not load events: {migrationHint(error.message)}</div>}`.
  - Change the meta line to `<span className="dash-meta">{[formatEventDate(e.event_date ?? ""), songCount(e.data), e.owner ? `Owner: ${e.owner}` : ""].filter(Boolean).join(" · ")}</span>`.

- [ ] **Step 5: Event editor** (`components/EventEditor.tsx`)
  1. Add `import SectionNav from "./SectionNav";`. Change `import type { SetlistEvent, Song } from "@/lib/event";` to `import { migrationHint, type SetlistEvent, type Song } from "@/lib/event";`.
  2. In the non-read-only `actions` fragment, replace the whole `<Link className="btn" href="/dashboard" … >←<span className="btn-label"> Dashboard</span></Link>` element with `<SectionNav compact />`. Keep the `Link` import, because the share banner still uses it.
  3. In `save()`, add `owner: event.owner.trim() || null,` to the `.update({ … })` object right after `event_date: …,`. Change the generic error text to ``Could not save event: ${migrationHint(error.message)}``.
  4. In the sidebar's `event-block`, directly after the event-date block and before `<TeamDialog …/>`, add:

```tsx
            {!(readOnly && !event.owner.trim()) && (
              <input
                className="event-owner"
                value={event.owner}
                onChange={(e) => update({ ...event, owner: e.target.value })}
                readOnly={readOnly}
                aria-label="Event owner"
                placeholder="Owner"
              />
            )}
```

- [ ] **Step 6: Event page and proxy**
  - **`app/events/[id]/page.tsx`:**
    - Change the select to `.select("id,event_name,event_date,owner,data,members,share_token")`.
    - Import `migrationHint` from `@/lib/event`.
    - Change the thrown message to ``Could not load event: ${migrationHint(error.message)}``.
  - **`proxy.ts`:** add `|| path.startsWith("/themes")` to the guarded paths.

- [ ] **Step 7: Append the styles** to `app/globals.css`

```css
.section-layout{display:grid;grid-template-columns:200px minmax(0,1fr);flex:1;border:1px solid var(--line);border-top:0;border-radius:0 0 10px 10px;background:var(--surface);box-shadow:var(--shadow);overflow:hidden}
.section-nav{display:flex;flex-direction:column;gap:4px;padding:18px 12px;border-right:1px solid var(--line);background:var(--surface-2)}
.section-nav-link{display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:var(--r-sm);color:var(--text);font-weight:700;text-decoration:none}
.section-nav-link:hover{background:var(--surface)}
.section-nav-link.active{background:var(--accent-soft);color:var(--accent)}
.section-main{min-width:0;display:flex;flex-direction:column}
.section-main .dash{border:0;border-radius:0;box-shadow:none}
.section-nav.compact{flex-direction:row;gap:4px;padding:0;border:0;background:none}
.section-nav.compact .section-nav-link{padding:8px 10px;border:1px solid var(--line-strong);font-size:13px}
.event-owner{width:100%;padding:4px 0;border:0;background:transparent;color:var(--muted);font-size:14px;outline:none}
.event-owner:focus{color:var(--text)}
.eyebrow a{color:inherit;text-decoration:none}
@media(max-width:680px){.section-layout{grid-template-columns:1fr}.section-nav{flex-direction:row;padding:8px;border-right:0;border-bottom:1px solid var(--line)}.section-nav-link{flex:1;justify-content:center;padding:8px 6px}.section-nav.compact .section-nav-link{flex:none;padding:7px 8px}.section-nav.compact .section-nav-label{display:none}}
```

- [ ] **Step 8: Checks**

Run: `npm test && npx tsc --noEmit && npm run lint && npm run build`
Then run a read-only smoke test with `npm run start`:
- `curl -s -o /dev/null -w "%{http_code} %{redirect_url}"` against `/dashboard` and `/themes` must give 307 to `/login`;
- stop the server and confirm port 3000 is free.

- [ ] **Step 9: Commit**

```bash
git add components/Icon.tsx components/SectionNav.tsx components/SectionLayout.tsx app/dashboard/page.tsx components/EventEditor.tsx "app/events/[id]/page.tsx" proxy.ts app/globals.css
git commit -m "Add Events/Library/Theme sidebar, event owner and editor section links"
```

---

### Task 3: Theme page

**Files:**
- Create: `lib/library.ts`
- Create: `app/themes/page.tsx`
- Create: `app/themes/ThemeManager.tsx`
- Modify: `app/globals.css` (append)

**Interfaces:**
- Consumes:
  - from Task 2: `SectionLayout`;
  - from Task 1: `migrationHint`;
  - `LogoutButton` from `@/app/dashboard/DashboardButtons`.
- Produces, from `lib/library.ts`:
  - `type Theme = { id: string; name: string }`
  - `byName`, which sorts by name, case-insensitive

- [ ] **Step 1: Write `lib/library.ts`**

Later tasks extend this file.

```ts
export type Theme = { id: string; name: string };

export const byName = <T extends { name: string }>(a: T, b: T) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
```

- [ ] **Step 2: Write `app/themes/page.tsx`**

```tsx
import { redirect } from "next/navigation";
import { LogoutButton } from "@/app/dashboard/DashboardButtons";
import SectionLayout from "@/components/SectionLayout";
import ThemeToggle from "@/components/ThemeToggle";
import { migrationHint } from "@/lib/event";
import { byName } from "@/lib/library";
import { createClient } from "@/lib/supabase/server";
import ThemeManager from "./ThemeManager";

export default async function ThemesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data, error } = await supabase.from("themes").select("id,name,song_themes(count)");
  const themes = (data ?? [])
    .map((t: { id: string; name: string; song_themes: { count: number }[] | null }) => ({ id: t.id, name: t.name, songs: t.song_themes?.[0]?.count ?? 0 }))
    .sort(byName);

  return (
    <SectionLayout current="themes" actions={<><ThemeToggle /><LogoutButton /></>}>
      <main className="dash">
        <div className="dash-head">
          <div>
            <div className="eyebrow">THEME</div>
            <h1 className="dash-title">Themes</h1>
            <div className="dash-sub">Tag library songs by theme, like Easter, Communion or Praise.</div>
          </div>
        </div>
        {error ? (
          <div className="share-banner error" role="alert">Could not load themes: {migrationHint(error.message)}</div>
        ) : (
          <ThemeManager initial={themes} />
        )}
      </main>
    </SectionLayout>
  );
}
```

- [ ] **Step 3: Write `app/themes/ThemeManager.tsx`**

```tsx
"use client";

import { useState, type FormEvent } from "react";
import Icon from "@/components/Icon";
import { migrationHint } from "@/lib/event";
import { byName } from "@/lib/library";
import { createClient } from "@/lib/supabase/client";

type ThemeRow = { id: string; name: string; songs: number };

const errorText = (e: { code?: string; message: string }) => (e.code === "23505" ? "Theme already exists." : migrationHint(e.message));

export default function ThemeManager({ initial }: { initial: ThemeRow[] }) {
  const [themes, setThemes] = useState(initial);
  const [name, setName] = useState("");
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function add(e: FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    setBusy(true);
    const { data, error } = await createClient().from("themes").insert({ name: trimmed }).select("id,name").single();
    setBusy(false);
    if (error) return setError(errorText(error));
    setError(null);
    setName("");
    setThemes([...themes, { id: data.id, name: data.name, songs: 0 }].sort(byName));
  }

  async function rename(e: FormEvent) {
    e.preventDefault();
    if (!editing) return;
    const trimmed = editing.name.trim();
    if (!trimmed) return setError("A theme needs a name.");
    setBusy(true);
    const { error } = await createClient().from("themes").update({ name: trimmed }).eq("id", editing.id);
    setBusy(false);
    if (error) return setError(errorText(error));
    setError(null);
    setThemes(themes.map((t) => (t.id === editing.id ? { ...t, name: trimmed } : t)).sort(byName));
    setEditing(null);
  }

  async function remove(t: ThemeRow) {
    if (!confirm(`Delete "${t.name}"? It will be removed from ${t.songs} ${t.songs === 1 ? "song" : "songs"}.`)) return;
    setBusy(true);
    const { error } = await createClient().from("themes").delete().eq("id", t.id);
    setBusy(false);
    if (error) return setError(errorText(error));
    setError(null);
    setThemes(themes.filter((x) => x.id !== t.id));
  }

  return (
    <>
      <form className="theme-add" onSubmit={add}>
        <input className="team-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="New theme, e.g. Easter" aria-label="New theme name" maxLength={40} disabled={busy} />
        <button className="btn primary" type="submit" disabled={busy || !name.trim()}>
          <Icon name="plus" />
          Add
        </button>
      </form>
      {error && <p className="auth-message error" role="alert">{error}</p>}
      {themes.length === 0 ? (
        <div className="workspace-empty dash-empty">
          <div className="workspace-empty-inner">
            <div className="workspace-empty-title">No themes yet.</div>
            <div className="workspace-empty-copy">Add one above, then tag songs in the Library.</div>
          </div>
        </div>
      ) : (
        <ul className="dash-list">
          {themes.map((t) => (
            <li key={t.id} className="dash-item">
              {editing?.id === t.id ? (
                <form className="theme-edit" onSubmit={rename}>
                  <input className="team-input" value={editing.name} onChange={(e) => setEditing({ id: t.id, name: e.target.value })} aria-label={`New name for ${t.name}`} maxLength={40} autoFocus disabled={busy} />
                  <button className="btn primary compact" type="submit" disabled={busy}>Save</button>
                  <button className="btn compact" type="button" onClick={() => setEditing(null)} disabled={busy}>Cancel</button>
                </form>
              ) : (
                <>
                  <div className="dash-link">
                    <span className="dash-name">{t.name}</span>
                    <span className="dash-meta">{t.songs} {t.songs === 1 ? "song" : "songs"}</span>
                  </div>
                  <button className="icon-btn" type="button" title="Rename theme" aria-label={`Rename ${t.name}`} onClick={() => setEditing({ id: t.id, name: t.name })} disabled={busy}>
                    <Icon name="edit" />
                  </button>
                  <button className="icon-btn danger" type="button" title="Delete theme" aria-label={`Delete ${t.name}`} onClick={() => remove(t)} disabled={busy}>
                    <Icon name="trash" />
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
```

- [ ] **Step 4: Append the styles** to `app/globals.css`

```css
.theme-add{display:flex;gap:8px;margin:18px 0}
.theme-add .team-input{flex:1;min-width:0}
.theme-edit{display:flex;align-items:center;gap:8px;flex:1;padding:10px 0;min-width:0}
.theme-edit .team-input{flex:1;min-width:0}
```

- [ ] **Step 5: Checks**

Run: `npm test && npx tsc --noEmit && npm run lint && npm run build`
- The build lists `/themes`.
- If tsc rejects the typed `map` callback on the untyped Supabase result, cast the result instead, e.g. `(data ?? []) as { id: string; name: string; song_themes: { count: number }[] | null }[]`, and note it.

- [ ] **Step 6: Commit**

```bash
git add lib/library.ts app/themes app/globals.css
git commit -m "Add the Theme page: create, rename and delete themes"
```

- [ ] **Step 7: Manual check** (the user, after running `005`)

Add "Easter" and "easter"; the second is rejected with "Theme already exists". Rename a theme. Delete a theme that a song uses (after Task 5) and confirm it has gone from that song (Review Focus 2).

---

### Task 4: ChordSheet component and the Library list

**Files:**
- Create: `components/ChordSheet.tsx`
- Modify: `components/SongTabs.tsx` (render chords through `ChordSheet`)
- Modify: `lib/library.ts` (add `LibrarySong`, `songMetaLine`, `byTitle`)
- Create: `app/library/page.tsx`
- Create: `app/library/LibraryList.tsx`
- Modify: `app/globals.css` (append)

**Interfaces:**
- Consumes: `ParsedSong` and `normalizeSearch` from `lib/chordpro.ts`; `SectionLayout`; `Theme` and `byName`.
- Produces:
  - `ChordSheet({ parsed: ParsedSong })`
  - `type LibrarySong = { id: string; title: string; artist: string | null; song_key: string; rhythm: string | null; bpm: number | null; content: string; search_text: string; themes: Theme[] }`
  - `songMetaLine(s): string`
  - `byTitle`

- [ ] **Step 1: Write `components/ChordSheet.tsx`**

This is the Lyrics + Chords rendering moved out of `SongTabs`, with the same markup.

```tsx
import type { ParsedSong } from "@/lib/chordpro";

const NBSP = " ";

export default function ChordSheet({ parsed }: { parsed: ParsedSong }) {
  return (
    <>
      {parsed.sections.map((s, i) => (
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
      ))}
    </>
  );
}
```

- [ ] **Step 2: Use it in `components/SongTabs.tsx`**
  - Add `import ChordSheet from "./ChordSheet";`.
  - In the `tab === "chords"` branch, replace the whole `parsed.sections.map((s, i) => ( <section …> … </section> ))` expression, which sits between `) : hasLyrics ? (` and `) : (`, with `<ChordSheet parsed={parsed} />`.
  - Remove the `NBSP` constant if nothing else uses it; lint flags unused variables.

- [ ] **Step 3: Extend `lib/library.ts`** by appending:

```ts
export type LibrarySong = {
  id: string;
  title: string;
  artist: string | null;
  song_key: string;
  rhythm: string | null;
  bpm: number | null;
  content: string;
  search_text: string;
  themes: Theme[];
};

export const byTitle = <T extends { title: string }>(a: T, b: T) => a.title.localeCompare(b.title, undefined, { sensitivity: "base" });

export function songMetaLine(s: Pick<LibrarySong, "artist" | "song_key" | "rhythm" | "bpm">) {
  return [s.artist, s.song_key && `Key ${s.song_key}`, s.rhythm, s.bpm != null && `${s.bpm} BPM`].filter(Boolean).join(" · ");
}
```

- [ ] **Step 4: Write `app/library/page.tsx`**

```tsx
import { redirect } from "next/navigation";
import { LogoutButton } from "@/app/dashboard/DashboardButtons";
import Icon from "@/components/Icon";
import SectionLayout from "@/components/SectionLayout";
import ThemeToggle from "@/components/ThemeToggle";
import { migrationHint } from "@/lib/event";
import { byName, byTitle, type LibrarySong, type Theme } from "@/lib/library";
import { createClient } from "@/lib/supabase/server";
import LibraryList from "./LibraryList";

export default async function LibraryPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [songsRes, themesRes] = await Promise.all([
    supabase.from("songs").select("id,title,artist,song_key,rhythm,bpm,search_text,themes(id,name)"),
    supabase.from("themes").select("id,name"),
  ]);
  const error = songsRes.error ?? themesRes.error;
  const songs = ((songsRes.data ?? []) as Omit<LibrarySong, "content">[])
    .map((s) => ({ ...s, themes: [...(s.themes ?? [])].sort(byName) }))
    .sort(byTitle);
  const themes = ((themesRes.data ?? []) as Theme[]).sort(byName);

  return (
    <SectionLayout current="library" actions={<><ThemeToggle /><LogoutButton /></>}>
      <main className="dash">
        <div className="dash-head">
          <div>
            <div className="eyebrow">LIBRARY</div>
            <h1 className="dash-title">Songs</h1>
            <div className="dash-sub">{songs.length} {songs.length === 1 ? "song" : "songs"}, A–Z. Add a song once and use it in every event.</div>
          </div>
          <a className="btn primary" href="/library/new">
            <Icon name="plus" />
            Add songs
          </a>
        </div>
        {error ? (
          <div className="share-banner error" role="alert">Could not load the library: {migrationHint(error.message)}</div>
        ) : (
          <LibraryList songs={songs} themes={themes} />
        )}
      </main>
    </SectionLayout>
  );
}
```

- [ ] **Step 5: Write `app/library/LibraryList.tsx`**

```tsx
"use client";

import { useMemo, useState } from "react";
import { normalizeSearch } from "@/lib/chordpro";
import { songMetaLine, type LibrarySong, type Theme } from "@/lib/library";

type Row = Omit<LibrarySong, "content">;

export default function LibraryList({ songs, themes }: { songs: Row[]; themes: Theme[] }) {
  const [query, setQuery] = useState("");
  const [themeId, setThemeId] = useState("");
  const shown = useMemo(() => {
    const q = normalizeSearch(query);
    return songs.filter(
      (s) =>
        (!themeId || s.themes.some((t) => t.id === themeId)) &&
        (!q || `${normalizeSearch(`${s.title} ${s.artist ?? ""}`)} ${s.search_text}`.includes(q)),
    );
  }, [songs, query, themeId]);

  if (songs.length === 0) {
    return (
      <div className="workspace-empty dash-empty">
        <div className="workspace-empty-inner">
          <div className="workspace-empty-title">No songs yet.</div>
          <div className="workspace-empty-copy">Use <strong>Add songs</strong> to paste a chord sheet or upload files.</div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="lib-filters">
        <input className="team-input" type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Filter by title, artist or lyrics" aria-label="Filter songs" />
        <select className="team-input lib-theme-filter" value={themeId} onChange={(e) => setThemeId(e.target.value)} aria-label="Filter by theme">
          <option value="">All themes</option>
          {themes.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
      </div>
      {shown.length === 0 ? (
        <p className="lyrics-empty">No songs match.</p>
      ) : (
        <ul className="dash-list">
          {shown.map((s) => (
            <li key={s.id} className="dash-item">
              <a href={`/library/${s.id}`} className="dash-link">
                <span className="dash-name">{s.title}</span>
                <span className="dash-meta">{songMetaLine(s)}</span>
                {s.themes.length > 0 && (
                  <span className="theme-chips">
                    {s.themes.map((t) => (
                      <span key={t.id} className="theme-chip">{t.name}</span>
                    ))}
                  </span>
                )}
              </a>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
```

- [ ] **Step 6: Append the styles** to `app/globals.css`

```css
.lib-filters{display:flex;flex-wrap:wrap;gap:8px;margin:18px 0}
.lib-filters .team-input{flex:1 1 220px;min-width:0}
.lib-filters .lib-theme-filter{flex:0 1 200px}
.theme-chips{display:flex;flex-wrap:wrap;gap:6px;margin-top:4px}
.theme-chip{padding:2px 8px;border-radius:999px;background:var(--accent-soft);color:var(--accent);font-size:12px;font-weight:700}
```

- [ ] **Step 7: Checks**

Run: `npm test && npx tsc --noEmit && npm run lint && npm run build`. Expected: everything passes, and the build lists `/library`. Smoke test: `/library` without a session must give 307 to `/login`.

- [ ] **Step 8: Commit**

```bash
git add components/ChordSheet.tsx components/SongTabs.tsx lib/library.ts app/library/page.tsx app/library/LibraryList.tsx app/globals.css
git commit -m "Add the Library page with A–Z songs, filters and theme chips"
```

---

### Task 5: Song fields form and the library song page (view, edit, delete)

**Files:**
- Modify: `lib/library.ts` (add `Fields`, `fieldsFrom`, `validateFields`, `toSongRow`)
- Create: `lib/library.test.ts`
- Modify: `package.json` (`test` script)
- Create: `components/SongFields.tsx`
- Create: `app/library/[id]/page.tsx`
- Create: `app/library/[id]/LibrarySongView.tsx`
- Modify: `app/globals.css` (append)

**Interfaces:**
- Consumes:
  - from Task 1: `keyStep`, `parseBpm`, `searchText` and `RHYTHM_PRESETS`;
  - from Task 4: `ChordSheet`, `LibrarySong` and `songMetaLine`;
  - `SongTabs` and `sectionNotesFrom`.
- Produces:
  - `type Fields = { title: string; artist: string; key: string; rhythm: string; bpm: string; themeIds: string[] }`
  - `fieldsFrom(song: LibrarySong): Fields`
  - `validateFields(f: Fields): string | null`
  - `toSongRow(f: Fields, content: string)`, which returns `{ title, artist, song_key, rhythm, bpm, content, search_text }`
  - `SongFields({ idPrefix: string; value: Fields; themes: Theme[]; disabled?: boolean; onChange: (patch: Partial<Fields>) => void; keyHint?: string })`

- [ ] **Step 1: Write the failing tests**

Set the `test` script in `package.json` to:

```json
"test": "node --test lib/event.test.ts lib/chordpro.test.ts lib/library.test.ts"
```

Then create `lib/library.test.ts`:

```ts
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
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test`
Expected: FAIL. `library.ts` doesn't export `validateFields` or `toSongRow`.

- [ ] **Step 3: Extend `lib/library.ts`**

Add this at the top of the file. The `.ts` extension is what lets `node --test` load it, and `tsconfig` has `allowImportingTsExtensions`.

```ts
import { keyStep, parseBpm, searchText } from "./chordpro.ts";
```

Append:

```ts
export type Fields = { title: string; artist: string; key: string; rhythm: string; bpm: string; themeIds: string[] };

export function fieldsFrom(s: LibrarySong): Fields {
  return {
    title: s.title,
    artist: s.artist ?? "",
    key: s.song_key,
    rhythm: s.rhythm ?? "",
    bpm: s.bpm == null ? "" : String(s.bpm),
    themeIds: s.themes.map((t) => t.id),
  };
}

export function validateFields(f: Fields): string | null {
  if (!f.title.trim()) return "Add a title.";
  if (keyStep(f.key, 0) === null) return "Enter a key like G, Bb or F#m.";
  if (f.bpm.trim() && parseBpm(f.bpm) === null) return "BPM must be a whole number from 20 to 300.";
  if (f.rhythm.trim().length > 12) return "Rhythm is too long (12 characters max).";
  return null;
}

export function toSongRow(f: Fields, content: string) {
  const title = f.title.trim();
  return {
    title,
    artist: f.artist.trim() || null,
    song_key: f.key.trim(),
    rhythm: f.rhythm.trim() || null,
    bpm: parseBpm(f.bpm),
    content,
    search_text: searchText(title, content),
  };
}
```

- [ ] **Step 4: Run the tests**

Run: `npm test`
Expected: all pass. If importing `./chordpro.ts` with its extension breaks `npx tsc --noEmit` or `npm run build`, stop and report it rather than working around it.

- [ ] **Step 5: Write `components/SongFields.tsx`**

The BPM field holds text, so typing digit by digit never resets it (Review Focus 1).

```tsx
"use client";

import { RHYTHM_PRESETS } from "@/lib/chordpro";
import type { Fields, Theme } from "@/lib/library";

type Props = {
  idPrefix: string;
  value: Fields;
  themes: Theme[];
  disabled?: boolean;
  onChange: (patch: Partial<Fields>) => void;
  keyHint?: string;
};

export default function SongFields({ idPrefix, value, themes, disabled = false, onChange, keyHint }: Props) {
  const toggle = (id: string) =>
    onChange({ themeIds: value.themeIds.includes(id) ? value.themeIds.filter((t) => t !== id) : [...value.themeIds, id] });

  return (
    <div className="song-fields">
      <label className="field field-title">
        Title
        <input value={value.title} onChange={(e) => onChange({ title: e.target.value })} disabled={disabled} />
      </label>
      <label className="field field-title">
        Artist
        <input value={value.artist} onChange={(e) => onChange({ artist: e.target.value })} disabled={disabled} />
      </label>
      <label className="field">
        Key
        <input value={value.key} onChange={(e) => onChange({ key: e.target.value })} disabled={disabled} placeholder="G" />
        {keyHint && <span className="field-hint">{keyHint}</span>}
      </label>
      <label className="field">
        Rhythm
        <input list={`${idPrefix}-rhythms`} value={value.rhythm} maxLength={12} onChange={(e) => onChange({ rhythm: e.target.value })} disabled={disabled} placeholder="4/4" />
        <datalist id={`${idPrefix}-rhythms`}>
          {RHYTHM_PRESETS.map((r) => (
            <option key={r} value={r} />
          ))}
        </datalist>
      </label>
      <label className="field">
        BPM
        <input type="number" inputMode="numeric" min={20} max={300} step={1} value={value.bpm} onChange={(e) => onChange({ bpm: e.target.value })} disabled={disabled} placeholder="72" />
      </label>
      {themes.length > 0 ? (
        <fieldset className="field field-wide theme-picker" disabled={disabled}>
          <legend>Themes</legend>
          {themes.map((t) => (
            <label key={t.id} className={`theme-chip toggle${value.themeIds.includes(t.id) ? " on" : ""}`}>
              <input type="checkbox" className="sr-only" checked={value.themeIds.includes(t.id)} onChange={() => toggle(t.id)} />
              {t.name}
            </label>
          ))}
        </fieldset>
      ) : (
        <p className="field-hint field-wide">
          No themes yet. Add some on the <a href="/themes">Theme</a> page.
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 6: Write `app/library/[id]/page.tsx`**

```tsx
import { notFound, redirect } from "next/navigation";
import { LogoutButton } from "@/app/dashboard/DashboardButtons";
import SectionLayout from "@/components/SectionLayout";
import ThemeToggle from "@/components/ThemeToggle";
import { migrationHint } from "@/lib/event";
import { byName, type LibrarySong, type Theme } from "@/lib/library";
import { createClient } from "@/lib/supabase/server";
import LibrarySongView from "./LibrarySongView";

export default async function LibrarySongPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [songRes, themesRes] = await Promise.all([
    supabase.from("songs").select("id,title,artist,song_key,rhythm,bpm,content,search_text,themes(id,name)").eq("id", id).maybeSingle(),
    supabase.from("themes").select("id,name"),
  ]);
  // 22P02 = the id isn't a valid uuid: treat it like any unknown song
  if (songRes.error && songRes.error.code !== "22P02") throw new Error(`Could not load song: ${migrationHint(songRes.error.message)}`);
  if (!songRes.data) notFound();
  if (themesRes.error) throw new Error(`Could not load themes: ${migrationHint(themesRes.error.message)}`);

  const raw = songRes.data as LibrarySong;
  const song: LibrarySong = { ...raw, themes: [...(raw.themes ?? [])].sort(byName) };
  const themes = ((themesRes.data ?? []) as Theme[]).sort(byName);

  return (
    <SectionLayout current="library" actions={<><ThemeToggle /><LogoutButton /></>}>
      <main className="dash">
        <LibrarySongView initial={song} themes={themes} />
      </main>
    </SectionLayout>
  );
}
```

- [ ] **Step 7: Write `app/library/[id]/LibrarySongView.tsx`**

```tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import ChordSheet from "@/components/ChordSheet";
import Icon from "@/components/Icon";
import SongFields from "@/components/SongFields";
import SongTabs from "@/components/SongTabs";
import { parseChordPro } from "@/lib/chordpro";
import { migrationHint } from "@/lib/event";
import { byName, fieldsFrom, songMetaLine, toSongRow, validateFields, type Fields, type LibrarySong, type Theme } from "@/lib/library";
import { sectionNotesFrom } from "@/lib/songContent";
import { createClient } from "@/lib/supabase/client";

const noop = () => {};

export default function LibrarySongView({ initial, themes }: { initial: LibrarySong; themes: Theme[] }) {
  const [song, setSong] = useState(initial);
  const [fields, setFields] = useState<Fields>(() => fieldsFrom(initial));
  const [content, setContent] = useState(initial.content);
  const [editing, setEditing] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const preview = useMemo(() => parseChordPro(content), [content]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  function change(patch: Partial<Fields>) {
    setFields({ ...fields, ...patch });
    setDirty(true);
  }

  function startEdit() {
    setFields(fieldsFrom(song));
    setContent(song.content);
    setError(null);
    setEditing(true);
  }

  function cancel() {
    if (dirty && !confirm("Discard your changes to this song?")) return;
    setEditing(false);
    setDirty(false);
    setError(null);
  }

  async function save() {
    const problem = validateFields(fields);
    if (problem) return setError(problem);
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const row = toSongRow(fields, content);
    const { error: saveError } = await supabase.from("songs").update(row).eq("id", song.id).select("id").single();
    if (saveError) {
      setBusy(false);
      return setError(saveError.code === "23505" ? "A song with this title and artist is already in the library." : `Could not save: ${migrationHint(saveError.message)}`);
    }
    const before = song.themes.map((t) => t.id);
    const removed = before.filter((id) => !fields.themeIds.includes(id));
    const added = fields.themeIds.filter((id) => !before.includes(id));
    let themeError: string | null = null;
    if (removed.length) {
      const { error } = await supabase.from("song_themes").delete().eq("song_id", song.id).in("theme_id", removed);
      if (error) themeError = error.message;
    }
    if (added.length) {
      const { error } = await supabase.from("song_themes").insert(added.map((theme_id) => ({ song_id: song.id, theme_id })));
      if (error) themeError = error.message;
    }
    setBusy(false);
    setSong({ ...song, ...row, themes: themes.filter((t) => fields.themeIds.includes(t.id)).sort(byName) });
    setDirty(false);
    setEditing(false);
    if (themeError) setError(`The song was saved, but its themes weren't updated: ${migrationHint(themeError)}`);
  }

  async function remove() {
    if (!confirm(`Delete "${song.title}" from the library? Events that already use it keep their copy.`)) return;
    setBusy(true);
    const { error } = await createClient().from("songs").delete().eq("id", song.id);
    if (error) {
      setBusy(false);
      return setError(`Could not delete: ${migrationHint(error.message)}`);
    }
    window.location.assign(new URL("/library", window.location.origin).href);
  }

  const asEventSong = { id: song.id, title: song.title, baseKey: song.song_key, rhythm: song.rhythm ?? "", bpm: song.bpm, content: song.content, sections: sectionNotesFrom(song.content) };

  return (
    <>
      <div className="dash-head">
        <div>
          <div className="eyebrow"><a href="/library">LIBRARY</a></div>
          <h1 className="dash-title">{song.title}</h1>
          <div className="dash-sub">{songMetaLine(song)}</div>
          {song.themes.length > 0 && (
            <div className="theme-chips">
              {song.themes.map((t) => (
                <span key={t.id} className="theme-chip">{t.name}</span>
              ))}
            </div>
          )}
        </div>
        {!editing && (
          <div className="dash-head-actions">
            <button className="btn" type="button" onClick={startEdit} disabled={busy}>
              <Icon name="edit" />
              Edit
            </button>
            <button className="btn danger" type="button" onClick={remove} disabled={busy}>
              <Icon name="trash" />
              Delete
            </button>
          </div>
        )}
      </div>
      {error && <p className="auth-message error" role="alert">{error}</p>}
      {editing ? (
        <div className="lib-editor">
          <SongFields idPrefix="edit" value={fields} themes={themes} disabled={busy} onChange={change} keyHint="The key the chords are written in. Changing it doesn't move the chords." />
          <label className="field field-wide">
            Lyrics and chords (ChordPro)
            <textarea
              className="chord-editor"
              value={content}
              onChange={(e) => {
                setContent(e.target.value);
                setDirty(true);
              }}
              spellCheck={false}
              disabled={busy}
            />
          </label>
          <div className="lib-preview">
            <div className="section-label">PREVIEW</div>
            <ChordSheet parsed={preview} />
          </div>
          <div className="upload-actions">
            <button className="btn primary" type="button" onClick={save} disabled={busy}>{busy ? "Saving…" : "Save"}</button>
            <button className="btn" type="button" onClick={cancel} disabled={busy}>Cancel</button>
          </div>
        </div>
      ) : (
        <SongTabs song={asEventSong} content={song.content} readOnly onContentChange={noop} onSectionsChange={noop} onSongChange={noop} />
      )}
    </>
  );
}
```

- [ ] **Step 8: Append the styles** to `app/globals.css`

```css
.song-fields{display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:10px 12px;margin:12px 0}
.field{display:flex;flex-direction:column;gap:4px;min-width:0;color:var(--muted);font-size:12px;font-weight:700}
.field input{min-width:0;padding:8px 10px;border:1px solid var(--line-strong);border-radius:6px;background:var(--surface);color:var(--text);font-size:14px;font-weight:400;outline:none}
.field input:focus{border-color:var(--accent)}
.field-title{grid-column:span 2}
.field-wide{grid-column:1/-1}
.field-hint{color:var(--muted);font-size:12px;font-weight:400}
.theme-picker{display:flex;flex-wrap:wrap;gap:6px;margin:0;padding:0;border:0}
.theme-picker legend{margin-bottom:6px;padding:0}
.theme-chip.toggle{border:1px solid var(--line-strong);background:var(--surface-2);color:var(--text);cursor:pointer}
.theme-chip.toggle.on{border-color:var(--accent);background:var(--accent-soft);color:var(--accent)}
.theme-chip.toggle:focus-within{outline:2px solid var(--accent);outline-offset:2px}
.lib-editor .chord-editor{min-height:280px}
.lib-preview{margin-top:16px;padding:16px;border:1px dashed var(--line-strong);border-radius:var(--r-sm)}
@media(max-width:680px){.field-title{grid-column:1/-1}}
```

- [ ] **Step 9: Checks, then commit**

Run: `npm test && npx tsc --noEmit && npm run lint && npm run build`. The build should list `/library/[id]`. Smoke test: `/library/00000000-0000-0000-0000-000000000000` without a session gives 307 to `/login`.

```bash
git add lib/library.ts lib/library.test.ts package.json components/SongFields.tsx "app/library/[id]" app/globals.css
git commit -m "Add the library song page: view, edit details and lyrics, delete"
```

Manual check for the user, after running `005`:
1. Open a song, edit its title, rhythm, BPM, themes and a chord, then Save. Reload and confirm the changes stayed.
2. Open an event that uses that song. It must be unchanged (Review Focus 5).
3. Delete the song from the library. The event still shows its copy.

---

### Task 6: Add songs page (paste or upload, then preview, then save)

**Files:**
- Modify: `lib/library.ts` (add `Draft`, `SAVED`, `identity`, `draftFrom`, `draftStatus`, `isReady`)
- Modify: `lib/library.test.ts`
- Create: `app/library/new/page.tsx`
- Create: `app/library/new/AddSongs.tsx`
- Modify: `app/library/upload/page.tsx` (redirect)
- Delete: `app/library/upload/UploadSongs.tsx`
- Modify: `components/AddSongDialog.tsx` (link to `/library/new`)
- Modify: `app/globals.css` (append)

**Interfaces:**
- Consumes:
  - from Task 1: `fromChordsAboveLyrics`, `guessKey`, `isChordProText`, `keyStep`, `parseChordPro` and `songMeta`;
  - from Task 5: `Fields`, `validateFields`, `toSongRow` and `SongFields`;
  - from Task 4: `ChordSheet`.
- Produces:
  - `type Draft = { label: string; fields: Fields; keyConfirmed: boolean; content: string; sections: string[]; unreadable: boolean; duplicate: boolean; result?: string }`
  - `draftFrom(label: string, raw: string, fallbackTitle: string): Draft`
  - `draftStatus(d: Draft): { text: string; ok: boolean }`
  - `isReady(d: Draft): boolean`
  - `identity(title: string, artist: string): string`
  - `SAVED`

- [ ] **Step 1: Write the failing tests**

In `lib/library.test.ts`, add `SAVED`, `draftFrom` and `draftStatus` to the import list from `"./library.ts"`. Then append:

```ts
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
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npm test`
Expected: FAIL, because `draftFrom` is not exported yet.

- [ ] **Step 3: Extend `lib/library.ts`**

Change the import line at the top to:

```ts
import { fromChordsAboveLyrics, guessKey, isChordProText, keyStep, parseBpm, parseChordPro, searchText, songMeta } from "./chordpro.ts";
```

Append:

```ts
export type Draft = {
  label: string;
  fields: Fields;
  keyConfirmed: boolean;
  content: string;
  sections: string[];
  unreadable: boolean;
  duplicate: boolean;
  result?: string;
};

export const SAVED = "Saved";

export const identity = (title: string, artist: string) => `${title.trim().toLowerCase()}\u0000${artist.trim().toLowerCase()}`;

// A pasted chord sheet or an uploaded file → a preview card. fallbackTitle: the file name ("" for pasted text).
export function draftFrom(label: string, raw: string, fallbackTitle: string): Draft {
  const text = raw.replace(/\r\n?/g, "\n");
  let content = isChordProText(text) ? text : fromChordsAboveLyrics(text, fallbackTitle);
  if (!parseChordPro(content).title.trim() && fallbackTitle) content = `{title: ${fallbackTitle}}\n${content}`;
  const parsed = parseChordPro(content);
  const meta = songMeta(content);
  return {
    label,
    fields: {
      title: parsed.title,
      artist: parsed.artist,
      key: parsed.key || guessKey(parsed) || "",
      rhythm: meta.rhythm,
      bpm: meta.bpm === null ? "" : String(meta.bpm),
      themeIds: [],
    },
    keyConfirmed: parsed.key !== "",
    content,
    sections: parsed.sections.map((s) => s.label).filter(Boolean),
    unreadable: !parsed.sections.some((s) => s.lines.length > 0),
    duplicate: false,
  };
}

export function draftStatus(d: Draft): { text: string; ok: boolean } {
  if (d.result) return { text: d.result, ok: d.result === SAVED };
  if (d.unreadable) return { text: "Couldn't read it", ok: false };
  if (d.duplicate) return { text: "Already in library", ok: false };
  if (!d.fields.title.trim()) return { text: "Needs a title", ok: false };
  if (!keyStep(d.fields.key, 0) || !d.keyConfirmed) return { text: "Needs a key", ok: false };
  const problem = validateFields(d.fields);
  if (problem) return { text: problem, ok: false };
  return { text: "Ready", ok: true };
}

export const isReady = (d: Draft) => draftStatus(d).text === "Ready";
```

`parseBpm` and `searchText` are still used by `toSongRow`, so keep them in the import.

- [ ] **Step 4: Run the tests**

Run: `npm test`
Expected: all pass.

- [ ] **Step 5: Write `app/library/new/page.tsx`**

```tsx
import { redirect } from "next/navigation";
import { LogoutButton } from "@/app/dashboard/DashboardButtons";
import SectionLayout from "@/components/SectionLayout";
import ThemeToggle from "@/components/ThemeToggle";
import { migrationHint } from "@/lib/event";
import { byName, type Theme } from "@/lib/library";
import { createClient } from "@/lib/supabase/server";
import AddSongs from "./AddSongs";

export default async function NewSongsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data, error } = await supabase.from("themes").select("id,name");

  return (
    <SectionLayout current="library" actions={<><ThemeToggle /><LogoutButton /></>}>
      <main className="dash">
        <div className="dash-head">
          <div>
            <div className="eyebrow"><a href="/library">LIBRARY</a></div>
            <h1 className="dash-title">Add songs</h1>
            <div className="dash-sub">Paste a chord sheet or upload ChordPro / text files. Check the preview, then save to the library.</div>
          </div>
        </div>
        {error && <div className="share-banner error" role="alert">Could not load themes: {migrationHint(error.message)}</div>}
        <AddSongs themes={((data ?? []) as Theme[]).sort(byName)} />
      </main>
    </SectionLayout>
  );
}
```

- [ ] **Step 6: Write `app/library/new/AddSongs.tsx`**

```tsx
"use client";

import { useState, type ChangeEvent, type DragEvent } from "react";
import ChordSheet from "@/components/ChordSheet";
import Icon from "@/components/Icon";
import SongFields from "@/components/SongFields";
import { keyStep, parseChordPro } from "@/lib/chordpro";
import { migrationHint } from "@/lib/event";
import { SAVED, draftFrom, draftStatus, identity, isReady, toSongRow, type Draft, type Fields, type Theme } from "@/lib/library";
import { createClient } from "@/lib/supabase/client";

const ACCEPT = ".cho,.chopro,.pro,.chordpro,.txt";

export default function AddSongs({ themes }: { themes: Theme[] }) {
  const [mode, setMode] = useState<"paste" | "files">("paste");
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [pasted, setPasted] = useState("");
  const [busy, setBusy] = useState(false);
  const [over, setOver] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function addDrafts(read: Draft[]) {
    if (!read.length) return;
    setMessage(null);
    const titles = [...new Set(read.map((d) => d.fields.title.trim()).filter(Boolean))];
    let existing: { title: string; artist: string | null }[] = [];
    if (titles.length) {
      const { data, error } = await createClient().from("songs").select("title,artist").in("title", titles);
      if (error) setMessage(`Couldn't check the library for duplicates: ${migrationHint(error.message)}. Duplicates will be skipped when saving.`);
      else existing = data ?? [];
    }
    setDrafts((current) => {
      const seen = new Set([...existing.map((s) => identity(s.title, s.artist ?? "")), ...current.map((d) => identity(d.fields.title, d.fields.artist))]);
      const marked = read.map((d) => {
        const id = identity(d.fields.title, d.fields.artist);
        const duplicate = !d.unreadable && seen.has(id);
        if (!d.unreadable) seen.add(id);
        return { ...d, duplicate };
      });
      return [...current, ...marked];
    });
  }

  async function onFiles(files: File[]) {
    const read = await Promise.all(files.map(async (f) => draftFrom(f.name, await f.text(), f.name.replace(/\.[^.]+$/, ""))));
    await addDrafts(read);
  }

  function onPick(e: ChangeEvent<HTMLInputElement>) {
    void onFiles([...(e.target.files ?? [])]);
    e.target.value = "";
  }

  function onDrop(e: DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    setOver(false);
    if (!busy) void onFiles([...e.dataTransfer.files]);
  }

  async function onPreview() {
    if (!pasted.trim()) return;
    await addDrafts([draftFrom("Pasted text", pasted, "")]);
    setPasted("");
  }

  const edit = (i: number, patch: Partial<Draft>) => setDrafts((current) => current.map((d, j) => (j === i ? { ...d, ...patch } : d)));

  const editFields = (i: number, patch: Partial<Fields>) =>
    setDrafts((current) =>
      current.map((d, j) =>
        j === i
          ? {
              ...d,
              fields: { ...d.fields, ...patch },
              ...("title" in patch || "artist" in patch ? { duplicate: false } : {}),
              ...("key" in patch ? { keyConfirmed: true } : {}),
            }
          : d,
      ),
    );

  const remove = (i: number) => setDrafts((current) => current.filter((_, j) => j !== i));

  async function save() {
    setBusy(true);
    setMessage(null);
    const supabase = createClient();
    const next = [...drafts];
    let added = 0;
    for (let i = 0; i < next.length; i++) {
      const d = next[i];
      if (!isReady(d)) continue;
      const { data, error } = await supabase.from("songs").insert(toSongRow(d.fields, d.content)).select("id").single();
      let result = SAVED;
      if (error) {
        result = error.code === "23505" ? "Already in library" : `Failed: ${migrationHint(error.message)}`;
      } else {
        added++;
        if (d.fields.themeIds.length) {
          const { error: themeError } = await supabase.from("song_themes").insert(d.fields.themeIds.map((theme_id) => ({ song_id: data.id, theme_id })));
          if (themeError) result = `Saved, but themes failed: ${migrationHint(themeError.message)}`;
        }
      }
      next[i] = { ...d, result };
      setDrafts([...next]);
    }
    setMessage(`Added ${added}, skipped ${next.length - added}.`);
    setBusy(false);
  }

  const ready = drafts.filter(isReady).length;

  return (
    <>
      <div className="song-tabs" role="tablist" aria-label="How to add songs">
        <button type="button" role="tab" aria-selected={mode === "paste"} className={`song-tab${mode === "paste" ? " active" : ""}`} onClick={() => setMode("paste")}>Paste text</button>
        <button type="button" role="tab" aria-selected={mode === "files"} className={`song-tab${mode === "files" ? " active" : ""}`} onClick={() => setMode("files")}>Upload files</button>
      </div>

      {mode === "paste" ? (
        <div className="paste-box">
          <textarea
            className="chord-editor"
            value={pasted}
            onChange={(e) => setPasted(e.target.value)}
            placeholder="Paste a chord sheet from the web (chords above the lyrics) or ChordPro text. The first line is used as the title."
            aria-label="Song text"
            spellCheck={false}
            disabled={busy}
          />
          <button className="btn primary" type="button" onClick={onPreview} disabled={busy || !pasted.trim()}>Preview</button>
        </div>
      ) : (
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
          <input type="file" multiple accept={ACCEPT} onChange={onPick} className="sr-only" aria-label="Choose song files" disabled={busy} />
        </label>
      )}

      {drafts.length > 0 && (
        <div className="draft-list">
          {drafts.map((d, i) => {
            const s = draftStatus(d);
            const locked = !!d.result || d.unreadable;
            return (
              <article key={i} className="draft-card">
                <header className="draft-head">
                  <strong className="draft-label">{d.label}</strong>
                  <span className={`upload-status ${s.ok ? "ok" : "bad"}`}>{s.text}</span>
                  {!d.result && (
                    <button className="icon-btn danger" type="button" title="Remove from this batch" aria-label={`Remove ${d.label}`} onClick={() => remove(i)} disabled={busy}>
                      <Icon name="trash" />
                    </button>
                  )}
                </header>
                {!d.unreadable && <SongFields idPrefix={`draft-${i}`} value={d.fields} themes={themes} disabled={locked || busy} onChange={(patch) => editFields(i, patch)} />}
                {!locked && !d.keyConfirmed && keyStep(d.fields.key, 0) && (
                  <button className="btn compact" type="button" disabled={busy} onClick={() => edit(i, { keyConfirmed: true })}>
                    Use {d.fields.key}
                  </button>
                )}
                <details className="draft-preview" open={!d.result}>
                  <summary>Preview</summary>
                  <ChordSheet parsed={parseChordPro(d.content)} />
                </details>
              </article>
            );
          })}
        </div>
      )}

      <div className="upload-actions">
        <button className="btn primary" type="button" onClick={save} disabled={busy || ready === 0}>
          {busy ? "Saving…" : `Save ${ready} ${ready === 1 ? "song" : "songs"}`}
        </button>
        {message && <span role="status">{message}</span>}
        {drafts.some((d) => d.result?.startsWith(SAVED)) && <a className="btn" href="/library">Back to Library</a>}
      </div>
    </>
  );
}
```

- [ ] **Step 7: Redirect the old route, and update the dialog link**

Replace `app/library/upload/page.tsx` with:

```tsx
import { redirect } from "next/navigation";

export default function UploadPage() {
  redirect("/library/new");
}
```

Then run `git rm app/library/upload/UploadSongs.tsx`.

In `components/AddSongDialog.tsx`, replace `<a className="btn" href="/library/upload">Upload songs</a>` with `<a className="btn" href="/library/new">Add to library</a>`.

- [ ] **Step 8: Append the styles** to `app/globals.css`

```css
.paste-box{display:flex;flex-direction:column;gap:10px;margin:16px 0}
.paste-box .chord-editor{min-height:220px}
.paste-box .btn{align-self:flex-start}
.draft-list{display:flex;flex-direction:column;gap:14px;margin-top:16px}
.draft-card{padding:14px 16px;border:1px solid var(--line);border-radius:var(--r-sm);background:var(--surface)}
.draft-head{display:flex;align-items:center;gap:10px}
.draft-label{flex:1;min-width:0;overflow-wrap:anywhere}
.draft-preview{margin-top:8px}
.draft-preview summary{margin-bottom:8px;color:var(--accent);font-weight:700;cursor:pointer}
```

- [ ] **Step 9: Checks**

Run: `npm test && npx tsc --noEmit && npm run lint && npm run build`
- The build lists `/library/new` and still lists `/library/upload`.
- Smoke test without a session: `/library/new` gives 307 to `/login`.
- `grep -rn "UploadSongs\|/library/upload" app components` shows only the redirect page.

- [ ] **Step 10: Commit**

```bash
git add lib/library.ts lib/library.test.ts app/library/new app/library/upload/page.tsx components/AddSongDialog.tsx app/globals.css
git commit -m "Add songs page: paste or upload, preview, then save with themes"
```

The `git rm` from Step 7 is already staged.

Manual check for the user:
1. Paste a chord sheet that has `Tempo:` and `Time:` lines. BPM and rhythm are prefilled, and the preview shows chords above the lyrics.
2. Pick themes and save.
3. Upload two files, one of them a duplicate. The duplicate is marked "Already in library".
4. **Back to Library** shows the new songs A–Z.

---

### Task 7: Rhythm and BPM in events and share links, docs, v3.2.0

**Files:**
- Create: `components/TempoControl.tsx`
- Modify: `components/EventEditor.tsx`
- Modify: `app/globals.css` (append)
- Modify: `lib/event.ts` (`APP_VERSION`), `package.json` (`version`)
- Modify: `README.md`
- Create: `changelog/v3.2.0_changelog.md`

**Interfaces:**
- Consumes: `Song.rhythm` and `Song.bpm` (Task 1); `RHYTHM_PRESETS` and `parseBpm` (Task 1).
- Produces: `TempoControl({ rhythm: string; bpm: number | null; readOnly: boolean; onChange: (patch: { rhythm?: string; bpm?: number | null }) => void })`.

- [ ] **Step 1: Write `components/TempoControl.tsx`**

The BPM field keeps the typed text locally, so typing "1", then "12", then "120" never resets it (Review Focus 1).

```tsx
"use client";

import { useState } from "react";
import { RHYTHM_PRESETS, parseBpm } from "@/lib/chordpro";

type Props = {
  rhythm: string;
  bpm: number | null;
  readOnly: boolean;
  onChange: (patch: { rhythm?: string; bpm?: number | null }) => void;
};

export default function TempoControl({ rhythm, bpm, readOnly, onChange }: Props) {
  const [bpmText, setBpmText] = useState(bpm === null ? "" : String(bpm));

  if (readOnly) {
    if (!rhythm && bpm === null) return null;
    return (
      <div className="tempo-badges">
        {rhythm && <span className="tempo-badge">{rhythm}</span>}
        {bpm !== null && <span className="tempo-badge">{bpm} BPM</span>}
      </div>
    );
  }

  return (
    <div className="tempo-control">
      <label className="meta-field">
        <span>Time</span>
        <input list="tempo-rhythms" value={rhythm} maxLength={12} onChange={(e) => onChange({ rhythm: e.target.value })} placeholder="4/4" aria-label="Rhythm" />
      </label>
      <datalist id="tempo-rhythms">
        {RHYTHM_PRESETS.map((r) => (
          <option key={r} value={r} />
        ))}
      </datalist>
      <label className="meta-field">
        <span>BPM</span>
        <input
          type="number"
          inputMode="numeric"
          min={20}
          max={300}
          step={1}
          value={bpmText}
          onChange={(e) => {
            setBpmText(e.target.value);
            onChange({ bpm: parseBpm(e.target.value) });
          }}
          onBlur={() => setBpmText(bpm === null ? "" : String(bpm))}
          placeholder="—"
          aria-label="Beats per minute"
        />
      </label>
    </div>
  );
}
```

- [ ] **Step 2: Use it in `components/EventEditor.tsx`**
  1. Add `import TempoControl from "./TempoControl";`.
  2. In `header-song-actions`, read-only branch: replace the single `<KeyControl value={displayKey} readOnly … />` with:

```tsx
                      <>
                        <KeyControl value={displayKey} readOnly onStep={stepView} onReset={displayKey !== song.baseKey ? resetView : undefined} />
                        <TempoControl key={song.id} rhythm={song.rhythm} bpm={song.bpm} readOnly onChange={() => {}} />
                      </>
```

  3. Editor branch: directly after `<KeyControl value={song.baseKey} readOnly={false} … />`, add:

```tsx
                        <TempoControl key={song.id} rhythm={song.rhythm} bpm={song.bpm} readOnly={false} onChange={(patch) => updateSong(song.id, (s) => ({ ...s, ...patch }))} />
```

`key={song.id}` remounts the control when you switch songs, so the BPM text matches the selected song.

- [ ] **Step 3: Append the styles** to `app/globals.css`

```css
.tempo-control{display:inline-flex;gap:6px;margin-right:6px}
.meta-field{display:inline-flex;flex-direction:column;align-items:center;justify-content:center;min-height:56px;padding:4px 8px 6px;border:1.5px solid var(--line-strong);border-radius:12px}
.meta-field span{color:var(--muted);font-size:10px;font-weight:800;letter-spacing:.14em;text-transform:uppercase}
.meta-field input{width:56px;border:0;background:transparent;color:var(--text);font-size:16px;font-weight:800;text-align:center;outline:none}
.meta-field:focus-within{border-color:var(--accent)}
.tempo-badges{display:inline-flex;align-items:center;gap:6px;margin-right:6px}
.tempo-badge{padding:6px 10px;border:1px solid var(--line-strong);border-radius:999px;background:var(--surface-2);font-size:14px;font-weight:800}
```

- [ ] **Step 4: Version 3.2.0**

Set `APP_VERSION = "3.2.0"` in `lib/event.ts`, `"version": "3.2.0"` in `package.json`, and `**Version:** 3.2.0` in `README.md`.

- [ ] **Step 5: Docs**

**`README.md`.** Keep its style of short sentences and bullets:
1. **Current status:** replace the `003` and `Song library` lines with a line saying migrations `001`–`004` are needed, plus `005_library_details.sql` for owner, rhythm, BPM, themes and the library pages.
2. **Setup step 3:** after the `004` bullet, add a bullet for `005_library_details.sql`. It adds `events.owner`, `songs.rhythm`/`bpm`, the `themes` and `song_themes` tables, and update/delete for library songs, and it recreates `search_songs` and `get_shared_event`. It must run after `004`.
3. **Using the app:** replace the Upload songs bullet with these:
   - **Sidebar:** **Events**, **Library** and **Theme** on the list pages. Inside an event, the same three links are in the top bar.
   - **Events:** each event can have an **Owner** (free text, under the date), shown on the list and on share links.
   - **Library:** all songs A–Z, with a filter by title, artist or lyrics and a theme filter. Open a song to view it, **Edit** its details and lyrics or chords, or **Delete** it (events keep their copy).
   - **Add songs** (Library): paste a chord sheet or upload files, check each preview card (title, artist, key, rhythm, BPM, themes), then **Save**. `Tempo:`, `BPM:` and `Time:` lines prefill BPM and rhythm.
   - **Theme:** create, rename and delete themes. Deleting one removes it from every song.
   - **Rhythm and BPM in events:** imported songs bring their rhythm and BPM. Edit them next to the Key; share links show them as badges.
4. **Routes:** add rows for `/library` (logged in, the song list), `/library/new` (add songs), `/library/[id]` (one library song) and `/themes` (themes). Change `/library/upload` to "redirects to `/library/new`".
5. **Project layout:** add:
   - `app/library/page.tsx`, `LibraryList.tsx`, `new/page.tsx`, `new/AddSongs.tsx`, `[id]/page.tsx` and `[id]/LibrarySongView.tsx`;
   - `app/themes/page.tsx` and `ThemeManager.tsx`;
   - `components/ChordSheet.tsx`, `SectionLayout.tsx`, `SectionNav.tsx`, `SongFields.tsx` and `TempoControl.tsx`;
   - `lib/library.ts` and `lib/library.test.ts`;
   - `005_library_details.sql`;
   - and remove `library/upload/UploadSongs.tsx`.
6. **Troubleshooting:** add: `- **"… does not exist" or "… schema cache" errors that mention owner, rhythm, bpm, themes or song_themes:** run \`005_library_details.sql\`.`

**`changelog/v3.2.0_changelog.md`.** Copy `changelog/v3.1.0_changelog.md` and move its "Current Release" v3.1.0 entry under "Previous Releases". Add at the top:

```markdown
## Current Release

### v3.2.0 — Library Pages, Themes, Rhythm & BPM

**Status:** Current

Brief summary:
- **Sidebar navigation** with **Events**, **Library** and **Theme**. Inside an event, the same links sit in the top bar.
- **Library page:** all songs A–Z with filters by text and theme. Each song has its own page to view, edit (details and lyrics/chords) or delete it.
- **Add songs page:** paste a chord sheet or upload files, preview every song, then save. Replaces the old Upload songs page (`/library/upload` redirects).
- **Themes:** a Theme page to create, rename and delete themes, and tag songs with them. Deleting a theme removes it from all songs.
- **Rhythm and BPM** on library songs, copied into events on import and editable next to the key. `Tempo:`/`Time:` lines in pasted or uploaded sheets fill them in.
- **Event owner:** a free-text owner per event, shown on the Events list and on share links.
- New migration: `supabase/migrations/005_library_details.sql`.
```

Add `v3.2.0 ↓ Library pages, themes, rhythm & BPM` to "Release Evolution" and `- **v3.2.0:** feature release; adds migration 005.` to "Versioning Notes".

- [ ] **Step 6: Checks**

Run: `npm test && npx tsc --noEmit && npm run lint && npm run build`. Then check that every path the README names exists: `ls app/library app/library/new "app/library/[id]" app/themes components lib supabase/migrations`.

Manual check for the user:
1. Import a song that has rhythm and BPM. Both show next to the Key.
2. Type a BPM digit by digit ("1", "12", "120"). The field never resets (Review Focus 1). An invalid value goes back to the saved one when the field loses focus.
3. Change rhythm and BPM, save, then reload.
4. Open the share link. The rhythm and BPM badges are shown, along with the owner.

- [ ] **Step 7: Commit**

```bash
git add components/TempoControl.tsx components/EventEditor.tsx app/globals.css lib/event.ts package.json README.md changelog/v3.2.0_changelog.md
git commit -m "Show rhythm and BPM in events and share links; docs for v3.2.0"
```
