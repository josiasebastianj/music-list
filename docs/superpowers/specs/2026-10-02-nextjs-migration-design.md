# setlist.app — Next.js Migration, Auth & Dashboard (Design)

**Date:** 2026-10-02
**Baseline:** v2.3.0 (`main` @ `02555e1`)
**Target version:** v3.0.0

## 1. Goal

Move setlist.app from a single `index.html` to a Next.js (TypeScript) project, keeping every v2.3.0 feature and look, and add:

- user accounts (email + password, and Google sign-in) via Supabase Auth;
- a dashboard where a signed-in user creates, opens and deletes their own events.

### Success criteria

1. Everything in v2.3.0 works the same in Next.js: Event → Songs → Song Details (name, color, note), add/delete/reorder songs and details, color cycling, PNG export (light and dark), theme toggle, read-only share view, phone-width layout.
2. Users can sign up and log in with email + password or Google, and see only their own events.
3. A user cannot read, change or delete another user's event.
4. Share links work while logged out, including links already sent in the old `?share=<token>` format.

### Decisions

| Topic | Decision |
|---|---|
| Hosting | Vercel |
| Language | TypeScript |
| Database / auth | Supabase (existing project), Supabase Auth |
| Login methods | Email + password, Google |
| Guest use | None: editing and the dashboard require login |
| Existing events | Left unowned: share links keep working, nobody can edit them |
| Styling | Current CSS moved to `globals.css` unchanged; no Tailwind/UI library |
| Edit links (`?edit=`) | Removed; ownership replaces them |

### Out of scope (add when needed)

- Password reset page (Supabase can send reset emails; the page is ~20 lines).
- Guest editing, collaborators/shared editing, event duplication, search/sorting on the dashboard.
- Browser end-to-end tests (add Playwright when the manual checklist gets tedious).
- Visual redesign.

## 2. Architecture

### Routes

| Route | Access | Purpose |
|---|---|---|
| `/` | everyone | Redirects to `/dashboard` (logged in) or `/login`. If the URL has `?share=<token>`, redirects to `/share/<token>` first. |
| `/login` | logged out | Email + password sign-in and sign-up, "Continue with Google". |
| `/auth/callback` | — | Exchanges the auth code (Google OAuth, email confirmation) for a session, then redirects to `/dashboard`. |
| `/dashboard` | logged in | Lists the user's events (name, date, song count, newest first). **New event**, open, **Delete** (with confirmation), **Log out**. |
| `/events/[id]` | owner | The editor. **Save** and **Share** (copies the read-only link). |
| `/share/[token]` | public | Read-only view of the event. |

`proxy.ts` (Next.js 16's name for middleware) refreshes the Supabase session cookie on every request and redirects unauthenticated requests for `/dashboard` and `/events/*` to `/login`. Pages still check the user themselves; the proxy is a convenience, not the security boundary.

**New event:** inserts an empty row (`event_name` null, `data = {"songs": []}`, new `share_token`) and navigates to `/events/<id>`.

**Save:** updates `event_name`, `event_date`, `data`, `updated_at` for the row. Shows the existing "Saved" state on the button; errors show in the existing banner and edits stay on the page.

**Share:** copies `<origin>/share/<share_token>` to the clipboard with a toast. Fallback when the clipboard is blocked: the existing dialog with the link selected and the Ctrl+C / ⌘C hint.

**Unsaved changes:** the editor tracks a dirty flag; `beforeunload` warns when leaving with unsaved edits.

### Data access

The browser calls Supabase directly (`@supabase/ssr` browser client). Row Level Security is the security boundary, so there are no API routes. Server components (dashboard, editor page, share page) load data with the `@supabase/ssr` server client.

### Database migration — `supabase/migrations/001_auth_and_rls.sql`

```sql
alter table public.events
  add column if not exists user_id uuid references auth.users on delete cascade default auth.uid();

create index if not exists events_user_id_idx on public.events (user_id);

-- remove the v2.3.0 open policies
drop policy if exists "anon insert" on public.events;
drop policy if exists "anon update" on public.events;
drop policy if exists "anon select" on public.events;

alter table public.events enable row level security;

create policy "own select" on public.events for select to authenticated using (user_id = auth.uid());
create policy "own insert" on public.events for insert to authenticated with check (user_id = auth.uid());
create policy "own update" on public.events for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own delete" on public.events for delete to authenticated using (user_id = auth.uid());

-- public read by share token only, exposing no id or owner
create or replace function public.get_shared_event(token text)
returns table (event_name text, event_date date, data jsonb)
language sql stable security definer set search_path = public
as $$
  select e.event_name, e.event_date, e.data from public.events e where e.share_token = token;
$$;

grant execute on function public.get_shared_event(text) to anon, authenticated;
```

The return column types must match the existing `events` columns; check them in the Supabase table editor before running the migration. Existing rows keep `user_id = null`, so no policy matches them: they can't be edited, but `get_shared_event` still serves them.

Applied by pasting into the Supabase SQL Editor (no Supabase CLI needed).

## 3. Code structure

```
app/
  layout.tsx              html shell, inline theme script (no flash), footer
  globals.css             current <style> block, unchanged
  page.tsx                redirect logic (+ legacy ?share=)
  login/page.tsx
  auth/callback/route.ts
  dashboard/page.tsx      server: list; small client parts for New/Delete/Log out
  events/[id]/page.tsx    server: load row (RLS) → notFound() or <EventEditor>
  share/[token]/page.tsx  server: rpc get_shared_event → notFound() or <EventEditor readOnly>
components/
  EventEditor.tsx         sidebar + song workspace; edit and readOnly modes
  ThemeToggle.tsx
lib/
  event.ts                types (Event, Song, Section) + uid, safeColor, normalizeSections/Song/Event, colors
  event.test.ts           runnable check: node --test
  exportPng.ts            exportSongImage, wrapLines, roundRect, formatEventDate
  supabase/client.ts      browser client
  supabase/server.ts      server client (cookies)
proxy.ts
supabase/migrations/001_auth_and_rls.sql
.env.local.example        NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
```

### Mapping from `index.html`

| v2.3.0 | Next.js |
|---|---|
| `<style>` block | `app/globals.css` (verbatim; remove only dead selectors for removed elements) |
| `uid`, `safeColor`, `normalize*`, `colors`, `blankState` | `lib/event.ts` |
| `esc` | Not needed in React; kept inside `exportPng.ts` only if used there |
| `render`, `renderMain`, `renderDetail`, `renderSidebarOnly`, `viewHeader`, delegated listeners | `EventEditor` (one `useState` event object + `activeSongId`) |
| `addSong`, `deleteSong`, `moveSong`, `addDetail`, `moveDetail`, `deleteDetail`, `cycleDetailColor` | Functions inside `EventEditor` that return updated state |
| `exportSongImage`, `wrapLines`, `roundRect`, `formatEventDate` | `lib/exportPng.ts` |
| `getTheme`, `setTheme`, `initTheme`, `THEME_KEY` | `ThemeToggle` + inline script in `layout.tsx` |
| `saveEvent`, `loadFromUrl`, `loadEvent`, edit/share link helpers, save dialog | Replaced by the Save/Share flow and server-side page loading above |
| `persist`, `load`, `supabase-config.js`, CDN script | Removed; env vars instead |
| Reset button | Removed: the dashboard's **New event** replaces "start a new event" |

`EventEditor` starts as one file. Split out `SongWorkspace` / `DetailRow` if it passes ~400 lines.

## 4. Migration phases

Each phase is one or more commits that leave the app working.

1. **Scaffold + editor port.** `create-next-app` (TypeScript, App Router, ESLint, no Tailwind, no `src/`). Port CSS, `lib/event.ts`, `lib/exportPng.ts`, `EventEditor`, `ThemeToggle`, the share page and the editor page. At the end: v2.3.0 parity at `/events/[id]` and `/share/[token]` against the current (open-policy) database. Delete `index.html` and `supabase-config.js`.
2. **Auth + dashboard.** Run the SQL migration, add the Supabase clients, `proxy.ts`, `/login`, `/auth/callback`, `/dashboard`, ownership-aware editor loading, legacy `?share=` redirect.
3. **Deploy.** Vercel project + env vars; Google OAuth client (Google Cloud Console) and Supabase provider settings; Supabase Site URL and redirect URLs for production and `localhost:3000`; run the manual checklist on production.

The v2.3.0 GitHub Pages site (if still served) keeps working until phase 2's migration removes the open policies; after that it can no longer save. Cut over to Vercel right after phase 2.

## 5. Error handling

- Save/delete failure → existing banner with the Supabase message; local edits are kept.
- Missing, invalid or not-owned event, or unknown share token → `notFound()` (Next 404 page).
- Auth errors (wrong password, unconfirmed email, OAuth cancelled) → message on `/login`.
- Leaving the editor with unsaved edits → browser `beforeunload` prompt.

## 6. Testing

**Automated:** `lib/event.test.ts` with Node's built-in runner (`node --test`), checking that `normalizeEvent` turns malformed or hostile input into a valid event: missing fields get defaults, invalid colors fall back to `#8fc5ff`, non-array songs/sections become empty arrays. Run via `npm test`.

**Manual checklist** (run after phases 2 and 3):

1. Sign up with email + password (confirm email), log out, log in.
2. Sign in with Google.
3. New event → add songs and details → Save → reload: data persists.
4. Reorder songs and details, cycle colors, delete a detail and a song, Save → reload.
5. Export PNG in light and dark mode.
6. Share → open the link in a private window: read-only view, Export PNG works.
7. Open an old `?share=<token>` link → redirected and shown.
8. As a second user, open the first user's `/events/<id>` → 404; their events don't appear on the dashboard.
9. Delete an event from the dashboard → gone; its share link → 404.
10. Leave the editor with unsaved edits → browser warning.
11. Phone width (≤680px): editor, dashboard and login are usable, no horizontal scroll.
