# Next.js Migration, Auth & Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port setlist.app v2.4.0 (single `index.html`, phone-first redesign) to a Next.js 16 TypeScript app on Vercel, then add Supabase Auth (email + password, Google) and a per-user events dashboard.

**Architecture:** App Router pages load data on the server with `@supabase/ssr`; the editor is one client component that talks to Supabase directly. Row Level Security is the security boundary (owner-only access), and public share links go through a `security definer` SQL function that exposes only name, date and songs. Current CSS moves to `globals.css` unchanged.

**Tech Stack:** Next.js 16.3 (App Router, TypeScript, ESLint, no Tailwind), `@supabase/ssr` 0.12, `@supabase/supabase-js` 2, Node 24 (`node --test` with built-in TypeScript stripping), Vercel.

**Spec:** `docs/superpowers/specs/2026-10-02-nextjs-migration-design.md`

## Global Constraints

- Version: `3.0.0` (`APP_VERSION` in `lib/event.ts`, `package.json`, footer, PNG export).
- Env vars: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Never put the secret / `service_role` key in the app.
- No new runtime dependencies beyond `next`, `react`, `react-dom`, `@supabase/ssr`, `@supabase/supabase-js`. No Tailwind, no UI library, no test framework.
- Styling: v2.4.0 `<style>` block copied verbatim into `app/globals.css`, with only `body.view-only` → `.view-only`. New CSS (dashboard, login) is appended and uses the existing CSS variables.
- Footer text: `Author: josiasebastianj` and `Version: 3.0.0`. Tagline: `Simple. Organized. Ready for Worship.`
- Theme key in localStorage: `setlistApp_theme` (unchanged, so users keep their theme). With no stored value, the theme follows the device (`prefers-color-scheme`), as in v2.4.0.
- Fonts: the v2.4.0 Google Fonts `<link>` (Fraunces, Plus Jakarta Sans) unchanged; CSS uses `var(--serif)` / `var(--sans)`.
- Icons: the v2.4.0 SVG icons (sun, moon, plus, up, down, next, trash, image), never text glyphs.
- Layout must work at phone width (≤680px) with no horizontal scroll.
- Out of scope: password reset page, guest editing, collaborators, duplication, search, Playwright, redesign, Reset button (removed).

## Review Focus

1. **Leaving the editor through the in-app "← Dashboard" link with unsaved edits.** `beforeunload` doesn't fire on client-side navigation, so the link must ask before discarding edits (Task 5, Step 4).
2. **Saving after the session expired or for a row the user doesn't own.** RLS makes the update match 0 rows with no error; Save must report a failure and keep the edits (Task 3: `.select("id").single()` turns 0 rows into an error; manual check in Task 3, Step 8).
3. **Double clicks on Save or New event.** These must not create duplicate rows or race. Buttons are disabled while busy (Task 3, Task 5; manual check in Task 5, Step 7).
4. **Malformed or hostile `data` JSON in a row**, for example from an old version or a hand-edited row: wrong types, missing arrays, CSS injection in `color`. The editor must render it without crashing (Task 1 test).
5. **Share link for a deleted event, or a junk or garbled token.** This must show a 404, not crash (manual checks in Task 3, Step 8 and Task 7).

---

### Task 0: Branch from v2.4.0

`revamp-nextjs` is based on v2.1.0 (`b5428eb`) and lacks the v2.2.0–v2.4.0 work. Work on a new branch from `main`, carrying over the spec and plan commits.

- [ ] **Step 1: Create the branch and bring the docs**

```bash
git fetch origin
git switch -c nextjs-migration origin/main
git cherry-pick 62c1c16^..revamp-nextjs   # every spec/plan commit (docs/superpowers only)
```

If your human partner prefers to keep the name `revamp-nextjs`, they reset and force-push that branch themselves. Don't do that without their explicit say-so.

- [ ] **Step 2: Verify**

Run: `git log --oneline -5` → shows the spec/plan commits, then `c3ccf1f Redesign setlist UI for phone-first reading (v2.4.0)`.

---

### Task 1: Scaffold Next.js and the event data module

**Files:**
- Create (from scaffold): `package.json`, `tsconfig.json`, `next.config.ts`, `eslint.config.mjs`, `next-env.d.ts`, `app/` (temporary), `.gitignore` (merged)
- Create: `lib/event.ts`, `lib/event.test.ts`, `.env.local.example`

**Interfaces:**
- Produces (`lib/event.ts`):
  - `APP_VERSION: "3.0.0"`
  - `colors: string[]` (9 hex colors, order as in v2.4.0)
  - `type Section = { id: string; name: string; color: string; note: string }`
  - `type Song = { id: string; title: string; baseKey: string; sections: Section[] }`
  - `type SetlistEvent = { eventName: string; eventDate: string; songs: Song[] }`
  - `type EventRow = { event_name: string | null; event_date: string | null; data: unknown }`
  - `uid(prefix: string): string`
  - `safeColor(value: unknown): string`
  - `eventFromRow(row: EventRow): SetlistEvent`
  - `formatEventDate(date: string): string`
  - `randomShareToken(): string`

- [ ] **Step 1: Scaffold into a temp folder and copy in**

`create-next-app` refuses a non-empty folder, so scaffold next to the repo:

```bash
cd ..
npx create-next-app@16 setlist-scaffold --ts --app --eslint --no-tailwind --no-src-dir --import-alias "@/*" --use-npm --yes
cd music-list
cp ../setlist-scaffold/{package.json,package-lock.json,tsconfig.json,next.config.ts,eslint.config.mjs,next-env.d.ts} .
cp -r ../setlist-scaffold/app .
cat ../setlist-scaffold/.gitignore >> .gitignore 2>/dev/null || cp ../setlist-scaffold/.gitignore .gitignore
rm -rf ../setlist-scaffold
npm install
npm install @supabase/ssr @supabase/supabase-js
```

If the scaffold asks about the React Compiler or Turbopack, accept the defaults.

- [ ] **Step 2: Adjust config files**

In `package.json`, set `"name": "setlist-app"` and `"version": "3.0.0"`, and add to `"scripts"`:

```json
"test": "node --test lib/event.test.ts"
```

and add a top-level field:

```json
"engines": { "node": ">=22.18" }
```

In `tsconfig.json` `compilerOptions`, add (needed so the Node test can import `./event.ts` with its extension; `noEmit` is already true):

```json
"allowImportingTsExtensions": true
```

Append to `.gitignore` (the scaffold ignores `.env*`):

```
!.env.local.example
```

Create `.env.local.example`:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxx
```

Create `.env.local` (git-ignored) with the real values from the old `supabase-config.js`:

```bash
git show origin/main:supabase-config.js
```

- [ ] **Step 3: Write the failing test** — `lib/event.test.ts`

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { colors, eventFromRow, randomShareToken, safeColor } from "./event.ts";

test("eventFromRow turns a malformed row into a valid event", () => {
  const event = eventFromRow({
    event_name: null,
    event_date: null,
    data: {
      songs: [
        { title: 5, baseKey: "G", sections: [{ name: "  Verse ", color: "red;background:url(x)" }, "junk"] },
        null,
      ],
    },
  });
  assert.equal(event.eventName, "");
  assert.equal(event.eventDate, "");
  assert.equal(event.songs.length, 2);
  const [song, empty] = event.songs;
  assert.equal(song.title, "");
  assert.equal(song.baseKey, "G");
  assert.ok(song.id.startsWith("song-"));
  assert.equal(song.sections[0].name, "Verse");
  assert.equal(song.sections[0].color, "#8fc5ff");
  assert.equal(song.sections[0].note, "");
  assert.equal(song.sections[1].color, colors[1]);
  assert.ok(song.sections[1].id.startsWith("section-"));
  assert.deepEqual(empty.sections, []);
});

test("eventFromRow handles missing or non-array data", () => {
  assert.deepEqual(eventFromRow({ event_name: "Sunday", event_date: "2026-10-04", data: null }), {
    eventName: "Sunday",
    eventDate: "2026-10-04",
    songs: [],
  });
  assert.deepEqual(eventFromRow({ event_name: null, event_date: null, data: { songs: "nope" } }).songs, []);
});

test("eventFromRow keeps valid data unchanged", () => {
  const songs = [{ id: "song-1", title: "Way Maker", baseKey: "E", sections: [{ id: "section-1", name: "Intro", color: "#93dfb2", note: "Soft\nkeys" }] }];
  assert.deepEqual(eventFromRow({ event_name: "A", event_date: "2026-10-04", data: { songs } }).songs, songs);
});

test("safeColor only accepts #rrggbb", () => {
  assert.equal(safeColor("#ABCdef"), "#ABCdef");
  assert.equal(safeColor("#fff"), "#8fc5ff");
  assert.equal(safeColor(undefined), "#8fc5ff");
});

test("randomShareToken is URL-safe and unique", () => {
  const a = randomShareToken();
  assert.match(a, /^[A-Za-z0-9_-]{24}$/);
  assert.notEqual(a, randomShareToken());
});
```

- [ ] **Step 4: Run the test to verify it fails**

Run: `npm test`
Expected: FAIL with `Cannot find module` … `lib/event.ts`.

- [ ] **Step 5: Write `lib/event.ts`**

```ts
export const APP_VERSION = "3.0.0";

export const colors = ["#8fc5ff", "#93dfb2", "#ffd37d", "#8edbe8", "#f3a5c6", "#f5c58a", "#c5a5f5", "#b6a9f5", "#9cdda9"];

export type Section = { id: string; name: string; color: string; note: string };
export type Song = { id: string; title: string; baseKey: string; sections: Section[] };
export type SetlistEvent = { eventName: string; eventDate: string; songs: Song[] };
export type EventRow = { event_name: string | null; event_date: string | null; data: unknown };

type Loose = { [key: string]: unknown } | null | undefined;
const str = (value: unknown) => (typeof value === "string" ? value : "");
const list = (value: unknown): Loose[] => (Array.isArray(value) ? value : []);

export function uid(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function safeColor(value: unknown) {
  const color = str(value).trim();
  return /^#[0-9a-fA-F]{6}$/.test(color) ? color : "#8fc5ff";
}

function normalizeSections(sections: unknown): Section[] {
  return list(sections).map((s, i) => ({
    id: str(s?.id) || uid("section"),
    name: str(s?.name).trim(),
    color: safeColor(s?.color || colors[i % colors.length]),
    note: str(s?.note),
  }));
}

function normalizeSong(song: Loose): Song {
  return { id: str(song?.id) || uid("song"), title: str(song?.title), baseKey: str(song?.baseKey), sections: normalizeSections(song?.sections) };
}

export function eventFromRow(row: EventRow): SetlistEvent {
  const data = row.data as Loose;
  return { eventName: row.event_name ?? "", eventDate: row.event_date ?? "", songs: list(data?.songs).map(normalizeSong) };
}

export function formatEventDate(date: string) {
  if (!date) return "";
  const d = new Date(date + "T00:00:00");
  if (Number.isNaN(d.getTime())) return date;
  return d.toLocaleDateString("en-US", { day: "2-digit", month: "long", year: "numeric" });
}

export function randomShareToken() {
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npm test`
Expected: `# pass 5`, `# fail 0`.

Run: `npx tsc --noEmit`
Expected: no output (exit 0).

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json tsconfig.json next.config.ts eslint.config.mjs next-env.d.ts .gitignore .env.local.example app lib
git commit -m "Scaffold Next.js app and port event data model with tests"
```

---

### Task 2: App shell, styles and theme

**Files:**
- Create: `app/globals.css` (replace scaffold's), `components/Icon.tsx`, `components/AppShell.tsx`, `components/ThemeToggle.tsx`
- Modify: `app/layout.tsx` (replace), `app/page.tsx` (replace, temporary)
- Delete: `app/page.module.css`, `public/*.svg` (scaffold assets)

**Interfaces:**
- Consumes: `APP_VERSION` from `lib/event.ts`.
- Produces:
  - `AppShell({ actions?: ReactNode; className?: string; children: ReactNode })`: renders `.app` > topbar (brand + `.top-actions` holding `actions`) > children > footer. Works in server and client components (no hooks).
  - `ThemeToggle()`: client button that toggles `document.documentElement.dataset.theme` and saves `setlistApp_theme`.
  - `Icon({ name: IconName })` with `IconName = "sun" | "moon" | "plus" | "up" | "down" | "next" | "trash" | "image"`: renders `<svg class="ico" aria-hidden>`.

- [ ] **Step 1: Copy the v2.4.0 CSS verbatim**

```bash
git show origin/main:index.html | awk '/<style>/{f=1;next}/<\/style>/{f=0}f' | sed 's/body\.view-only/.view-only/g' > app/globals.css
rm -f app/page.module.css public/*.svg
```

Check: `grep -c "view-only" app/globals.css` shows ≥3, and `grep -c "body.view-only" app/globals.css` shows 0.

- [ ] **Step 2: Append dashboard and login styles to `app/globals.css`**

```css
.dash,.auth-card{flex:1;border:1px solid var(--line);border-top:0;border-radius:0 0 10px 10px;background:var(--surface);box-shadow:var(--shadow);padding:30px 34px}
.dash-head{display:flex;align-items:flex-end;justify-content:space-between;gap:16px;padding-bottom:22px;border-bottom:1px solid var(--line)}
.dash-title,.auth-title{margin:4px 0 0;font-family:var(--serif);font-size:32px;font-weight:700;letter-spacing:-.5px}
.dash-sub{color:var(--muted);font-size:13px;margin-top:4px;overflow-wrap:anywhere}
.dash-list{list-style:none;margin:0;padding:0}
.dash-item{display:flex;align-items:center;gap:12px;border-bottom:1px solid var(--line)}
.dash-link{flex:1;min-width:0;display:flex;flex-direction:column;gap:4px;padding:16px 4px;color:var(--text);text-decoration:none}
.dash-link:hover .dash-name{color:var(--accent)}
.dash-name{font-weight:700;font-size:16px;overflow-wrap:anywhere}
.dash-meta{color:var(--muted);font-size:13px}
.dash-empty{min-height:320px}
.auth-card{flex:0 1 auto;max-width:440px;width:100%;margin:40px auto 0;display:flex;flex-direction:column;gap:14px;border-top:1px solid var(--line);border-radius:10px}
.auth-form{display:flex;flex-direction:column;gap:12px}
.auth-form label{display:flex;flex-direction:column;gap:6px;font-size:13px;font-weight:700;color:var(--muted)}
.auth-form input{padding:10px 12px;border:1px solid var(--line-strong);border-radius:7px;background:var(--surface);color:var(--text);font-weight:400;outline:none}
.auth-form input:focus{border-color:var(--accent)}
.auth-divider{text-align:center;color:var(--muted);font-size:12px}
.auth-switch{border:0;background:none;color:var(--accent);font-size:13px;padding:4px}
.auth-message{margin:0;padding:10px 12px;border-radius:7px;background:var(--accent-soft);font-size:13px;overflow-wrap:anywhere}
.auth-message.error{background:var(--danger-soft);color:var(--danger)}
@media(max-width:680px){.dash,.auth-card{padding:20px 16px}.dash-head{flex-direction:column;align-items:stretch}.dash-title,.auth-title{font-size:26px}}
```

- [ ] **Step 3: Write `app/layout.tsx`**

The inline script sets the theme before the first paint (stored choice, else the device preference, like v2.4.0's `initTheme`), so there is no flash. The font `<link>` is copied from v2.4.0.

```tsx
import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "setlist.app",
  description: "Simple. Organized. Ready for Worship.",
};

const themeScript = `(function(){var t=null;try{t=localStorage.getItem("setlistApp_theme")}catch(e){}document.documentElement.dataset.theme=t||(matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light")})()`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600;9..144,700&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
```

- [ ] **Step 4: Write `components/Icon.tsx`** (paths copied from the v2.4.0 sprite)

```tsx
const paths = {
  sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>,
  moon: <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />,
  plus: <path d="M12 5v14M5 12h14" />,
  up: <path d="m18 15-6-6-6 6" />,
  down: <path d="m6 9 6 6 6-6" />,
  next: <path d="m9 18 6-6-6-6" />,
  trash: <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6" />,
  image: <><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="9" cy="9" r="2" /><path d="m21 15-5-5L5 21" /></>,
};

export type IconName = keyof typeof paths;

export default function Icon({ name }: { name: IconName }) {
  return (
    <svg className="ico" viewBox="0 0 24 24" aria-hidden="true">
      {paths[name]}
    </svg>
  );
}
```

- [ ] **Step 5: Write `components/AppShell.tsx`**

```tsx
import type { ReactNode } from "react";
import { APP_VERSION } from "@/lib/event";

export default function AppShell({ actions, className = "", children }: { actions?: ReactNode; className?: string; children: ReactNode }) {
  return (
    <div className={`app ${className}`.trim()}>
      <header className="app-topbar">
        <div className="brand">
          <div className="brand-name">setlist<span>.app</span></div>
          <div className="brand-divider" />
          <div className="brand-tagline">Simple. Organized. Ready for Worship.</div>
        </div>
        <div className="top-actions">{actions}</div>
      </header>
      {children}
      <footer className="app-footer" aria-label="Application information">
        <div className="app-footer-brand">setlist<span>.app</span></div>
        <div className="app-footer-meta">
          <span>Author: josiasebastianj</span>
          <span>Version: {APP_VERSION}</span>
        </div>
      </footer>
    </div>
  );
}
```

- [ ] **Step 6: Write `components/ThemeToggle.tsx`**

The initial state reads the attribute the layout script already set. The server renders "light", so the icon and label use `suppressHydrationWarning`.

```tsx
"use client";

import { useState } from "react";
import Icon from "./Icon";

type Theme = "light" | "dark";
const current = (): Theme => (typeof document !== "undefined" && document.documentElement.dataset.theme === "dark" ? "dark" : "light");

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(current);

  function toggle() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem("setlistApp_theme", next);
    } catch {
      // storage blocked (private mode): the theme still applies for this page
    }
    setTheme(next);
  }

  return (
    <button className="theme-top-toggle" type="button" aria-label="Switch theme" onClick={toggle}>
      <span className="theme-icon" suppressHydrationWarning><Icon name={theme === "dark" ? "moon" : "sun"} /></span>
      <span suppressHydrationWarning>{theme === "dark" ? "Dark Mode" : "Light Mode"}</span>
    </button>
  );
}
```

- [ ] **Step 7: Temporary `app/page.tsx`** (replaced in Task 3 and Task 5)

```tsx
import AppShell from "@/components/AppShell";
import ThemeToggle from "@/components/ThemeToggle";

export default function Home() {
  return (
    <AppShell actions={<ThemeToggle />}>
      <main className="dash">Migration in progress.</main>
    </AppShell>
  );
}
```

- [ ] **Step 8: Verify**

Run: `npm run lint` → no errors. Run `npx tsc --noEmit` → no output.
Run: `npm run dev` and open http://localhost:3000.
Expected:
- The page shows the v2.4.0 header (Fraunces "setlist" with the accent-coloured ".app", the tagline, and a sun or moon icon toggle). The footer shows "Version: 3.0.0".
- With no saved choice, the theme follows the OS setting. Clicking the toggle switches theme; after a reload the choice sticks, with no flash.
- At 375px width there is no horizontal scroll.

- [ ] **Step 9: Commit**

```bash
git add -A app components public
git commit -m "Add app shell, v2.4.0 styles, icons and theme toggle"
```

---

### Task 3: Port the editor and the share view

**Files:**
- Create: `supabase/migrations/001_share_function.sql`, `lib/supabase/client.ts`, `lib/supabase/server.ts`, `lib/exportPng.ts`, `components/EventEditor.tsx`, `app/events/[id]/page.tsx`, `app/share/[token]/page.tsx`
- Modify: `app/page.tsx` (legacy `?share=` redirect)
- Delete: `index.html`, `supabase-config.js`

**Interfaces:**
- Consumes: everything in `lib/event.ts`; `AppShell`, `ThemeToggle`.
- Produces:
  - `createClient()` from `@/lib/supabase/client`: browser Supabase client (sync).
  - `createClient()` from `@/lib/supabase/server`: `Promise` of a server Supabase client bound to request cookies.
  - `exportSongImage(event: SetlistEvent, song: Song, dark: boolean): void`
  - `EventEditor({ initial: SetlistEvent; eventId?: string; shareToken?: string | null; readOnly?: boolean })`
  - SQL: column `events.updated_at timestamptz`, function `get_shared_event(token text) returns table (event_name text, event_date date, data jsonb)`.

- [ ] **Step 1: Additive database migration** — `supabase/migrations/001_share_function.sql`

First check the column types in the Supabase SQL Editor:

```sql
select column_name, data_type from information_schema.columns where table_name = 'events';
```

If `event_date` is not `date` (or `event_name` is not `text`), change the `returns table (...)` types below to match.

```sql
alter table public.events add column if not exists updated_at timestamptz not null default now();

create or replace function public.get_shared_event(token text)
returns table (event_name text, event_date date, data jsonb)
language sql stable security definer set search_path = public
as $$
  select e.event_name, e.event_date, e.data from public.events e where e.share_token = token;
$$;

grant execute on function public.get_shared_event(text) to anon, authenticated;
```

Run it in the Supabase SQL Editor. It's additive, so the live v2.4.0 page keeps working.

- [ ] **Step 2: Supabase clients**

`lib/supabase/client.ts`:

```ts
import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!);
}
```

`lib/supabase/server.ts`:

```ts
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Called from a Server Component, where cookies are read-only; proxy.ts refreshes the session instead.
        }
      },
    },
  });
}
```

- [ ] **Step 3: Port the PNG export** — `lib/exportPng.ts`

This is the v2.4.0 code (unchanged since v2.3.0 apart from the version) with `state` → `event` and `getTheme()` → `dark`. The layout numbers are unchanged.

```ts
import { APP_VERSION, formatEventDate, safeColor, type SetlistEvent, type Song } from "./event";

function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const out: string[] = [];
  for (const p of String(text || "").split(/\r?\n/)) {
    if (!p.trim()) { out.push(""); continue; }
    let line = "";
    for (const word of p.trim().split(/\s+/)) {
      const test = line ? line + " " + word : word;
      if (ctx.measureText(test).width <= maxWidth) line = test;
      else if (line) { out.push(line); line = word; }
      else {
        let chunk = "";
        for (const ch of word) {
          const testChunk = chunk + ch;
          if (ctx.measureText(testChunk).width > maxWidth && chunk) { out.push(chunk); chunk = ch; }
          else chunk = testChunk;
        }
        line = chunk;
      }
    }
    if (line) out.push(line);
  }
  return out.length ? out : [""];
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

export function exportSongImage(event: SetlistEvent, song: Song, dark: boolean) {
  const scale = 2, width = 1200, pad = 60, cw = width - pad * 2, gap = 14;
  const title = song.title.trim() || "Song Title", baseKey = song.baseKey.trim(), eventName = event.eventName.trim(), eventDate = formatEventDate(event.eventDate), sections = song.sections;
  const palette = dark
    ? { bg1: "#132131", bg2: "#07111b", text: "#f1f5f9", muted: "#9aa8b7", line: "#2b4055", surface: "#0d1823", keyLine: "#4d8dff" }
    : { bg1: "#fbfaf6", bg2: "#f2f0e9", text: "#17202b", muted: "#6b7480", line: "#d8d6cf", surface: "#fcfbf7", keyLine: "#7aaeff" };

  const m = document.createElement("canvas").getContext("2d")!;
  const keyW = 190, keyH = 112, keyGap = 28, titleW = cw - keyW - keyGap;
  m.font = "700 54px Georgia,serif";
  const titleLines = wrapLines(m, title, titleW).slice(0, 2), titleLineH = 62, headerTop = pad;
  const titleAscent = m.measureText("Hg").actualBoundingBoxAscent || 48;
  const titleTop = headerTop + titleAscent;
  const titleBottom = titleTop + (titleLines.length - 1) * titleLineH + (m.measureText("Hg").actualBoundingBoxDescent || 10);
  const metaText = [eventName, eventDate].filter(Boolean).join(" • "), metaTop = titleBottom + 4, metaLineH = 30;
  const subtitleTop = metaTop + (metaText ? metaLineH + 8 : 0);
  const headerBottom = Math.max(headerTop + keyH, subtitleTop + 24) + 28, songDetailsLabelY = headerBottom + 2, leftW = 240, rightW = cw - leftW - 34;

  const measure = (s: Song["sections"][number]) => {
    m.font = "700 22px Inter,Arial,sans-serif";
    const nameLines = wrapLines(m, s.name || "Untitled", leftW - 54).slice(0, 2);
    m.font = "500 20px Inter,Arial,sans-serif";
    const note = s.note.trim(), noteLines = note ? wrapLines(m, note, rightW - 34) : [];
    const nameHeight = 42 + (nameLines.length - 1) * 29, noteHeight = noteLines.length ? 42 + (noteLines.length - 1) * 30 : 42;
    return { nameLines, noteLines, h: Math.max(72, Math.max(nameHeight, noteHeight) + 24) };
  };

  let total = songDetailsLabelY + 34;
  sections.forEach((s) => { total += measure(s).h + gap; });
  total += 70 + pad;

  const c = document.createElement("canvas");
  c.width = width * scale;
  c.height = Math.max(600, total) * scale;
  const ctx = c.getContext("2d")!;
  ctx.scale(scale, scale);
  const H = c.height / scale;
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, palette.bg1); bg.addColorStop(0.55, palette.bg2); bg.addColorStop(1, dark ? "#07111b" : "#eeeae1");
  ctx.fillStyle = bg; ctx.fillRect(0, 0, width, H);

  ctx.fillStyle = palette.text; ctx.font = "700 54px Georgia,serif";
  titleLines.forEach((line, i) => ctx.fillText(line, pad, titleTop + i * titleLineH));
  if (metaText) { ctx.fillStyle = palette.muted; ctx.font = "700 22px Inter,Arial,sans-serif"; ctx.fillText(metaText, pad, metaTop + 21); }
  ctx.strokeStyle = palette.line; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(pad, headerBottom); ctx.lineTo(pad + cw, headerBottom); ctx.stroke();

  const keyX = width - pad - keyW, keyY = headerTop, keyText = baseKey || "—";
  ctx.fillStyle = palette.surface; ctx.strokeStyle = baseKey ? palette.keyLine : palette.line; ctx.lineWidth = 1.5;
  roundRect(ctx, keyX, keyY, keyW, keyH, 14); ctx.fill(); ctx.stroke();
  ctx.fillStyle = palette.muted; ctx.font = "800 12px Inter,Arial,sans-serif"; ctx.fillText("BASE KEY", keyX + 20, keyY + 25);
  ctx.fillStyle = palette.text; ctx.font = "900 52px Inter,Arial,sans-serif";
  ctx.fillText(keyText, keyX + keyW / 2 - ctx.measureText(keyText).width / 2, keyY + 82);

  let y = songDetailsLabelY + 30;
  ctx.fillStyle = palette.muted; ctx.font = "800 14px Inter,Arial,sans-serif"; ctx.fillText("SONG DETAILS", pad, y);
  y += 28;
  sections.forEach((s) => {
    const accent = safeColor(s.color), { nameLines, noteLines, h } = measure(s);
    ctx.fillStyle = palette.surface; ctx.strokeStyle = accent + "99"; ctx.lineWidth = 1;
    roundRect(ctx, pad, y, cw, h, 10); ctx.fill(); ctx.stroke();
    ctx.fillStyle = accent; ctx.fillRect(pad, y, 7, h);
    ctx.beginPath(); ctx.arc(pad + 34, y + 36, 7, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = palette.text; ctx.font = "700 22px Inter,Arial,sans-serif";
    nameLines.forEach((line, i) => ctx.fillText(line, pad + 52, y + 42 + i * 29));
    ctx.strokeStyle = palette.line; ctx.beginPath(); ctx.moveTo(pad + leftW, y + 18); ctx.lineTo(pad + leftW, y + h - 18); ctx.stroke();
    if (noteLines.length) {
      ctx.fillStyle = palette.text; ctx.font = "500 20px Inter,Arial,sans-serif";
      noteLines.forEach((line, i) => ctx.fillText(line, pad + leftW + 24, y + 42 + i * 30));
    }
    y += h + gap;
  });

  const footerY = y + 10;
  ctx.strokeStyle = palette.line; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(pad, footerY); ctx.lineTo(pad + cw, footerY); ctx.stroke();
  ctx.fillStyle = palette.muted; ctx.font = "500 15px Inter,Arial,sans-serif";
  ctx.fillText("setlist.app", pad, footerY + 27);
  ctx.fillText("Author: josiasebastianj", pad + 120, footerY + 27);
  ctx.fillText("Version: " + APP_VERSION, pad + 360, footerY + 27);

  const link = document.createElement("a");
  const safeFilename = title.replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, " ").trim() || "song-structure";
  link.download = safeFilename + ".png";
  link.href = c.toDataURL("image/png");
  link.click();
}
```

`measure()` replaces v2.3.0's duplicated measuring code in the height pass and the draw pass. It only touches the scratch context `m`, so the drawing fonts on `ctx` are unchanged.

- [ ] **Step 4: Write `components/EventEditor.tsx`**

```tsx
"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import AppShell from "./AppShell";
import Icon from "./Icon";
import ThemeToggle from "./ThemeToggle";
import { colors, safeColor, uid, type Section, type SetlistEvent, type Song } from "@/lib/event";
import { exportSongImage } from "@/lib/exportPng";
import { createClient } from "@/lib/supabase/client";

type Props = { initial: SetlistEvent; eventId?: string; shareToken?: string | null; readOnly?: boolean };

const songNumber = (i: number) => String(i + 1).padStart(2, "0");
const tagColor = (color: string) => ({ "--tag-color": safeColor(color) }) as CSSProperties;

export default function EventEditor({ initial, eventId, shareToken = null, readOnly = false }: Props) {
  const [event, setEvent] = useState(initial);
  const [activeSongId, setActiveSongId] = useState<string | null>(initial.songs[0]?.id ?? null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState<"idle" | "saving" | "saved">("idle");
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [fallbackUrl, setFallbackUrl] = useState<string | null>(null);
  const focusId = useRef<string | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
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

  function update(next: SetlistEvent) {
    setEvent(next);
    setDirty(true);
  }
  function updateSong(id: string, fn: (s: Song) => Song) {
    update({ ...event, songs: event.songs.map((s) => (s.id === id ? fn(s) : s)) });
  }
  function updateSections(fn: (sections: Section[]) => Section[]) {
    if (song) updateSong(song.id, (s) => ({ ...s, sections: fn(s.sections) }));
  }
  function swap<T>(items: T[], i: number, j: number) {
    if (j < 0 || j >= items.length) return items;
    const copy = [...items];
    [copy[i], copy[j]] = [copy[j], copy[i]];
    return copy;
  }

  function addSong() {
    const s: Song = { id: uid("song"), title: "", baseKey: "", sections: [] };
    update({ ...event, songs: [...event.songs, s] });
    setActiveSongId(s.id);
    focusId.current = s.id;
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
  function addDetail() {
    if (!song) return;
    const section: Section = { id: uid("section"), name: "", color: colors[song.sections.length % colors.length], note: "" };
    updateSections((sections) => [...sections, section]);
    focusId.current = section.id;
  }
  function setSection(i: number, patch: Partial<Section>) {
    updateSections((sections) => sections.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  }
  function deleteDetail(i: number) {
    if (!song) return;
    if (!confirm(`Delete "${song.sections[i].name.trim() || "this song detail"}"?`)) return;
    updateSections((sections) => sections.filter((_, j) => j !== i));
  }
  function cycleColor(i: number) {
    if (!song) return;
    const current = safeColor(song.sections[i].color).toLowerCase();
    setSection(i, { color: colors[(colors.findIndex((c) => c.toLowerCase() === current) + 1) % colors.length] });
  }
  function exportPng() {
    if (song) exportSongImage(event, song, document.documentElement.dataset.theme === "dark");
  }

  async function save() {
    if (!eventId) return;
    setSaving("saving");
    const { error } = await createClient()
      .from("events")
      .update({ event_name: event.eventName.trim() || null, event_date: event.eventDate || null, data: { songs: event.songs }, updated_at: new Date().toISOString() })
      .eq("id", eventId)
      .select("id")
      .single();
    if (error) {
      setSaving("idle");
      setError(`Could not save event: ${error.message}`);
      return;
    }
    setError(null);
    setDirty(false);
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
          </div>
          <nav className="song-nav" aria-label="Songs">
            <div className="nav-heading">
              <div className="nav-heading-title">SONGS</div>
              {!readOnly && (
                <button className="btn primary compact" type="button" onClick={addSong}>
                  <Icon name="plus" />
                  Add Song
                </button>
              )}
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
                      <div className="key-badge" title="Base key" aria-label={`Base key ${song.baseKey.trim() || "not set"}`}>
                        <span aria-hidden="true">Key</span>
                        <strong aria-hidden="true">{song.baseKey.trim() || "—"}</strong>
                      </div>
                    ) : (
                      <>
                        <label className="key-field">
                          <span>Key</span>
                          <input
                            className="key-input"
                            value={song.baseKey}
                            onChange={(e) => updateSong(song.id, (s) => ({ ...s, baseKey: e.target.value }))}
                            placeholder="—"
                            aria-label="Base key"
                          />
                        </label>
                        <button className="icon-btn" type="button" title="Move song up" aria-label="Move song up" disabled={index === 0} onClick={() => moveSong(-1)}><Icon name="up" /></button>
                        <button className="icon-btn" type="button" title="Move song down" aria-label="Move song down" disabled={index === event.songs.length - 1} onClick={() => moveSong(1)}><Icon name="down" /></button>
                        <button className="icon-btn danger" type="button" title="Delete song" aria-label="Delete song" onClick={deleteSong}><Icon name="trash" /></button>
                      </>
                    )}
                    <button className="export-btn" type="button" onClick={exportPng}><Icon name="image" />Export PNG</button>
                  </div>
                </div>
              </div>

              <div className="main-content">
                <div className="section-label">SONG DETAILS</div>
                <div className="details">
                  {song.sections.length === 0 ? (
                    <div className="empty-detail">{readOnly ? "This song has no details yet." : "No song details yet. Add a section to start building this song."}</div>
                  ) : (
                    song.sections.map((section, i) =>
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
                            <button className="icon-btn" type="button" title="Move up" aria-label="Move song detail up" disabled={i === 0} onClick={() => updateSections((s) => swap(s, i, i - 1))}><Icon name="up" /></button>
                            <button className="icon-btn" type="button" title="Move down" aria-label="Move song detail down" disabled={i === song.sections.length - 1} onClick={() => updateSections((s) => swap(s, i, i + 1))}><Icon name="down" /></button>
                            <button className="icon-btn danger" type="button" title="Delete song detail" aria-label="Delete song detail" onClick={() => deleteDetail(i)}><Icon name="trash" /></button>
                          </div>
                        </div>
                      ),
                    )
                  )}
                </div>
                {!readOnly && (
                  <button className="btn add-detail" type="button" onClick={addDetail}><Icon name="plus" />Add Song Detail</button>
                )}
              </div>

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

Each detail card's colour rail comes from `--tag-color` on the row (v2.4.0), and the v2.4.0 CSS hides empty read-only notes (`.view-detail-note:empty`). "Open my setlist" goes to `/`, which redirects to the dashboard or the login page.

- [ ] **Step 5: Pages**

`app/events/[id]/page.tsx` (RLS decides visibility, so a not-owned or unknown id returns no row):

```tsx
import { notFound } from "next/navigation";
import EventEditor from "@/components/EventEditor";
import { eventFromRow } from "@/lib/event";
import { createClient } from "@/lib/supabase/server";

export default async function EventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from("events").select("id,event_name,event_date,data,share_token").eq("id", id).maybeSingle();
  if (!data) notFound();
  return <EventEditor initial={eventFromRow(data)} eventId={data.id} shareToken={data.share_token} />;
}
```

`app/share/[token]/page.tsx`:

```tsx
import { notFound } from "next/navigation";
import EventEditor from "@/components/EventEditor";
import { eventFromRow } from "@/lib/event";
import { createClient } from "@/lib/supabase/server";

export default async function SharePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_shared_event", { token }).maybeSingle();
  if (!data) notFound();
  return <EventEditor initial={eventFromRow(data)} readOnly />;
}
```

`app/page.tsx` (replace the temporary page; the `else` branch is replaced in Task 5):

```tsx
import { redirect } from "next/navigation";
import AppShell from "@/components/AppShell";
import ThemeToggle from "@/components/ThemeToggle";

export default async function Home({ searchParams }: { searchParams: Promise<{ share?: string }> }) {
  const { share } = await searchParams;
  if (share) redirect(`/share/${encodeURIComponent(share)}`);
  return (
    <AppShell actions={<ThemeToggle />}>
      <main className="dash">Open an event at /events/&lt;id&gt;.</main>
    </AppShell>
  );
}
```

- [ ] **Step 6: Remove the old app**

```bash
git rm index.html supabase-config.js
```

- [ ] **Step 7: Static checks**

Run: `npm test && npx tsc --noEmit && npm run lint && npm run build`
Expected: tests pass, no type or lint errors, and the build lists the routes `/`, `/events/[id]`, `/share/[token]`.

- [ ] **Step 8: Manual parity check** (`npm run dev`, against the still-open v2.3.0 policies; compare with v2.4.0's page from `git show origin/main:index.html > /tmp/v240.html`)

Get an event `id` and `share_token` from the Supabase table editor (`events`).

1. Open `/events/<id>`. The data loads and the layout matches v2.4.0: cards with colour rails, the KEY box, icon buttons, and row tools on hover on desktop.
2. Add a song and details. The new title or detail field is focused. Reorder songs and details, cycle colours, delete a detail and a song (each asks to confirm).
3. Click Save. The button shows "Saving…", then "Saved". Reload: the changes are kept.
4. Make an edit and try to close the tab. The browser warns about unsaved changes.
5. Export PNG in light mode and in dark mode. The images match v2.4.0 output.
6. Click Share. A toast says "Share link copied to clipboard". Open the copied link in a private window: it's read-only, and the Export PNG button in its header works.
7. Open `/?share=<token>`. It redirects to `/share/<token>`.
8. Open `/share/garbage` and `/events/not-a-uuid`. Both show a 404.
9. Make Save fail. In DevTools > Network, set "Offline" and click Save: an error banner appears and the edits stay on the page. Go back online and Save: it succeeds and the banner disappears.
10. At 375px width there is no page-level horizontal scroll in the editor or the share view. The song chips scroll sideways, and selecting a song keeps its chip in view.

- [ ] **Step 9: Commit**

```bash
git add -A supabase lib components app
git commit -m "Port editor, PNG export and share view to Next.js"
```

---

### Task 4: Owner-only access and login

**Files:**
- Create: `supabase/migrations/002_auth_and_rls.sql`, `proxy.ts`, `app/login/page.tsx`, `app/login/LoginForm.tsx`, `app/auth/callback/route.ts`

**Interfaces:**
- Consumes: both `createClient()` helpers, `AppShell`, `ThemeToggle`.
- Produces: an authenticated session in cookies; `/login?error=<message>` contract (the callback redirects there with a message); `events.user_id` defaulting to `auth.uid()`.

- [ ] **Step 1: Configure Supabase Auth (dashboard)**

- **Email:** Authentication > Providers > Email: enabled, "Confirm email" on.
- **Redirect URLs:** Authentication > URL Configuration: Site URL `http://localhost:3000` (changed to production in Task 7). Add the Redirect URL `http://localhost:3000/auth/callback`.
- **Google:** in Google Cloud Console, create an OAuth client ID (Web application) with the authorised redirect URI `https://<project-ref>.supabase.co/auth/v1/callback`. Then go to Authentication > Providers > Google, enable it and paste the Client ID and Secret.

- [ ] **Step 2: Migration** — `supabase/migrations/002_auth_and_rls.sql`

Running this ends anonymous saving. The old v2.4.0 page can then only show share links (it reads the table directly, so its share view stops working too). From here on, only the Next.js app works.

```sql
alter table public.events
  add column if not exists user_id uuid references auth.users on delete cascade default auth.uid();

create index if not exists events_user_id_idx on public.events (user_id);

drop policy if exists "anon insert" on public.events;
drop policy if exists "anon update" on public.events;
drop policy if exists "anon select" on public.events;

alter table public.events enable row level security;

create policy "own select" on public.events for select to authenticated using (user_id = auth.uid());
create policy "own insert" on public.events for insert to authenticated with check (user_id = auth.uid());
create policy "own update" on public.events for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own delete" on public.events for delete to authenticated using (user_id = auth.uid());
```

Run it in the SQL Editor, then list the policies: `select policyname from pg_policies where tablename = 'events';` should show exactly the four `own *` policies. If the v2.3.0 policies had different names, drop them by the names shown.

- [ ] **Step 3: `proxy.ts`** (repo root)

```ts
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const { data: { user } } = await supabase.auth.getUser();
  const path = request.nextUrl.pathname;
  if (!user && (path.startsWith("/dashboard") || path.startsWith("/events"))) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
```

- [ ] **Step 4: `app/auth/callback/route.ts`**

```ts
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}/dashboard`);
  }
  const message = searchParams.get("error_description") ?? "Sign-in link expired or was opened in another browser. If you just confirmed your email, log in below.";
  return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(message)}`);
}
```

- [ ] **Step 5: `app/login/page.tsx`**

```tsx
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import LoginForm from "./LoginForm";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) redirect("/dashboard");
  const { error } = await searchParams;
  return <LoginForm initialError={error ?? null} />;
}
```

- [ ] **Step 6: `app/login/LoginForm.tsx`**

```tsx
"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import AppShell from "@/components/AppShell";
import ThemeToggle from "@/components/ThemeToggle";
import { createClient } from "@/lib/supabase/client";

type Message = { text: string; error: boolean } | null;

export default function LoginForm({ initialError }: { initialError: string | null }) {
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<Message>(initialError ? { text: initialError, error: true } : null);
  const callback = () => `${location.origin}/auth/callback`;

  function done() {
    router.push("/dashboard");
    router.refresh();
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    const supabase = createClient();
    if (mode === "signin") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setMessage({ text: error.message, error: true });
        setBusy(false);
        return;
      }
      return done();
    }
    const { data, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: callback() } });
    setBusy(false);
    if (error) return setMessage({ text: error.message, error: true });
    if (data.session) return done();
    setMessage({ text: "Check your email to confirm your account, then log in.", error: false });
  }

  async function google() {
    const { error } = await createClient().auth.signInWithOAuth({ provider: "google", options: { redirectTo: callback() } });
    if (error) setMessage({ text: error.message, error: true });
  }

  return (
    <AppShell actions={<ThemeToggle />}>
      <main className="auth-card">
        <h1 className="auth-title">{mode === "signin" ? "Log in" : "Create account"}</h1>
        {message && <p className={`auth-message${message.error ? " error" : ""}`} role="status">{message.text}</p>}
        <form className="auth-form" onSubmit={submit}>
          <label>
            Email
            <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label>
            Password
            <input
              type="password"
              required
              minLength={6}
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          <button className="btn primary" type="submit" disabled={busy}>
            {busy ? "Please wait…" : mode === "signin" ? "Log in" : "Sign up"}
          </button>
        </form>
        <div className="auth-divider">or</div>
        <button className="btn" type="button" onClick={google}>Continue with Google</button>
        <button
          className="auth-switch"
          type="button"
          onClick={() => {
            setMode(mode === "signin" ? "signup" : "signin");
            setMessage(null);
          }}
        >
          {mode === "signin" ? "No account? Sign up" : "Have an account? Log in"}
        </button>
      </main>
    </AppShell>
  );
}
```

- [ ] **Step 7: Verify**

Run: `npx tsc --noEmit && npm run lint && npm run build`. Expected: no errors, and the routes include `/login` and `/auth/callback` plus the proxy.

Manual (`npm run dev`):
1. While logged out, open `/events/<any-id>`. It redirects to `/login`.
2. Sign up with a new email: "Check your email…" appears. Click the email link: you land on `/dashboard`, which is a 404 until Task 5, so the expected result is a URL of `/dashboard`.
3. Go to `/login` again. It redirects to `/dashboard` because you're logged in.
4. In a private window, log in with a wrong password: an error message appears. Log in with the right password: you're sent to `/dashboard`.
5. Use "Continue with Google": Google consent, then `/dashboard`.
6. Open `/share/<old token>` while logged out. It still renders (served by the share function).

- [ ] **Step 8: Commit**

```bash
git add supabase proxy.ts app/login app/auth
git commit -m "Add Supabase Auth login, session proxy and owner-only RLS"
```

---

### Task 5: Dashboard

**Files:**
- Create: `app/dashboard/page.tsx`, `app/dashboard/DashboardButtons.tsx`
- Modify: `app/page.tsx` (final redirect logic), `components/EventEditor.tsx` (add the "← Dashboard" link)

**Interfaces:**
- Consumes: `createClient()` (both), `randomShareToken`, `formatEventDate`, `AppShell`, `ThemeToggle`.
- Produces: `NewEventButton()`, `DeleteEventButton({ id: string; name: string })`, `LogoutButton()`.

- [ ] **Step 1: `app/dashboard/DashboardButtons.tsx`**

```tsx
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Icon from "@/components/Icon";
import { randomShareToken } from "@/lib/event";
import { createClient } from "@/lib/supabase/client";

export function NewEventButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function create() {
    setBusy(true);
    const id = crypto.randomUUID();
    const { error } = await createClient().from("events").insert({ id, data: { songs: [] }, share_token: randomShareToken() });
    if (error) {
      setBusy(false);
      alert(`Could not create event: ${error.message}`);
      return;
    }
    router.push(`/events/${id}`);
  }

  return (
    <button className="btn primary" type="button" onClick={create} disabled={busy}>
      {busy ? "Creating…" : <><Icon name="plus" />New event</>}
    </button>
  );
}

export function DeleteEventButton({ id, name }: { id: string; name: string }) {
  const router = useRouter();

  async function remove() {
    if (!confirm(`Delete "${name}"? Its share link will stop working.`)) return;
    const { error } = await createClient().from("events").delete().eq("id", id);
    if (error) {
      alert(`Could not delete event: ${error.message}`);
      return;
    }
    router.refresh();
  }

  return (
    <button className="icon-btn danger" type="button" title="Delete event" aria-label={`Delete ${name}`} onClick={remove}>
      <Icon name="trash" />
    </button>
  );
}

export function LogoutButton() {
  const router = useRouter();

  async function logout() {
    await createClient().auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <button className="btn" type="button" onClick={logout}>
      Log out
    </button>
  );
}
```

- [ ] **Step 2: `app/dashboard/page.tsx`**

```tsx
import Link from "next/link";
import { redirect } from "next/navigation";
import AppShell from "@/components/AppShell";
import ThemeToggle from "@/components/ThemeToggle";
import { formatEventDate } from "@/lib/event";
import { createClient } from "@/lib/supabase/server";
import { DeleteEventButton, LogoutButton, NewEventButton } from "./DashboardButtons";

function songCount(data: unknown) {
  const songs = (data as { songs?: unknown } | null)?.songs;
  const n = Array.isArray(songs) ? songs.length : 0;
  return `${n} ${n === 1 ? "song" : "songs"}`;
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: events, error } = await supabase
    .from("events")
    .select("id,event_name,event_date,data,updated_at")
    .order("updated_at", { ascending: false });

  return (
    <AppShell actions={<><ThemeToggle /><LogoutButton /></>}>
      <main className="dash">
        <div className="dash-head">
          <div>
            <div className="eyebrow">DASHBOARD</div>
            <h1 className="dash-title">Your events</h1>
            <div className="dash-sub">{user.email}</div>
          </div>
          <NewEventButton />
        </div>
        {error && <div className="share-banner error" role="alert">Could not load events: {error.message}</div>}
        {events && events.length > 0 ? (
          <ul className="dash-list">
            {events.map((e) => {
              const name = e.event_name || "Untitled Event";
              return (
                <li key={e.id} className="dash-item">
                  <Link href={`/events/${e.id}`} className="dash-link">
                    <span className="dash-name">{name}</span>
                    <span className="dash-meta">{[formatEventDate(e.event_date ?? ""), songCount(e.data)].filter(Boolean).join(" · ")}</span>
                  </Link>
                  <DeleteEventButton id={e.id} name={name} />
                </li>
              );
            })}
          </ul>
        ) : (
          !error && (
            <div className="workspace-empty dash-empty">
              <div className="workspace-empty-inner">
                <div className="workspace-empty-title">No events yet.</div>
                <div className="workspace-empty-copy">Use <strong>New event</strong> to build your first setlist.</div>
              </div>
            </div>
          )
        )}
      </main>
    </AppShell>
  );
}
```

- [ ] **Step 3: Final `app/page.tsx`**

```tsx
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function Home({ searchParams }: { searchParams: Promise<{ share?: string }> }) {
  const { share } = await searchParams;
  if (share) redirect(`/share/${encodeURIComponent(share)}`);
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  redirect(user ? "/dashboard" : "/login");
}
```

- [ ] **Step 4: "← Dashboard" link in the editor** (Review Focus 1)

In `components/EventEditor.tsx` (`Link` is already imported), put this first in the non-read-only `actions` fragment, before the Save button:

```tsx
      <Link
        className="btn"
        href="/dashboard"
        onClick={(e) => {
          if (dirty && !confirm("Leave without saving your changes?")) e.preventDefault();
        }}
      >
        ← Dashboard
      </Link>
```

Check that `.btn` styles look right on an `<a>`. If the link shows an underline or the wrong colour, append `a.btn{display:inline-flex;align-items:center;text-decoration:none}` to `app/globals.css`.

- [ ] **Step 5: Static checks**

Run: `npm test && npx tsc --noEmit && npm run lint && npm run build` → all pass.

- [ ] **Step 6: Commit**

```bash
git add app components
git commit -m "Add events dashboard with create, open, delete and logout"
```

- [ ] **Step 7: Manual checklist** (spec §6, items 1–11)

Run every item in the spec's manual checklist on `npm run dev`. In addition:
- **Double click:** double-click "New event". Exactly one new event is created (Review Focus 3).
- **Dashboard link with unsaved edits:** edit something, then click "← Dashboard". It asks first, and Cancel keeps you on the page with your edits (Review Focus 1).
- **Second user:** while logged in as user B, open user A's `/events/<id>`. It shows a 404, and Save can't be reached (Review Focus 2).

Fix anything that fails, then commit the fixes.

---

### Task 6: Docs and changelog

**Files:**
- Modify: `README.md`
- Create: `changelog/v3.0.0_changelog.md`

- [ ] **Step 1: Rewrite `README.md`**

Replace the single-file and JSON content with these sections. Keep the wording short:

1. **What it is:** one paragraph. Build worship setlists: Event → Songs → Song Details, PNG export, share read-only links. Accounts and a dashboard.
2. **Requirements:** Node 22.18 or newer, and a Supabase project.
3. **Setup:**
   - `npm install`
   - copy `.env.local.example` to `.env.local` and fill it in
   - run `supabase/migrations/001_share_function.sql`, then `002_auth_and_rls.sql`, in the Supabase SQL Editor
   - set up the Email and Google providers and the redirect URLs (as in Task 4, Step 1)
   - `npm run dev`
4. **Scripts:** `dev`, `build`, `start`, `lint`, `test`.
5. **Project layout:** the tree from spec §3.
6. **Security model:** RLS makes events owner-only; share links go through `get_shared_event`; never use the `service_role` key in the app.
7. **Deploying:** Vercel, with the env vars and Supabase URL configuration from Task 7.

- [ ] **Step 2: `changelog/v3.0.0_changelog.md`**

Copy `changelog/v2.3.0_changelog.md`. Change the old "Current Release" heading to a v2.3.0 entry under "Previous Releases". `main` has no v2.4.0 changelog, so add a v2.4.0 entry above v2.3.0 that summarises commit `c3ccf1f`: phone-first "stage-ready" restyle, Fraunces + Plus Jakarta Sans, amber accent, theme follows the device, scrolling song chips, SVG icons, colour-rail cards, no logic changes. Then add at the top:

```markdown
## Current Release

### v3.0.0 — Next.js, Accounts & Dashboard

**Status:** Current

Brief summary:
- Rebuilt setlist.app as a Next.js (TypeScript) app hosted on Vercel. The look and the editor features are unchanged.
- Added accounts with Supabase Auth: email + password (with email confirmation) and Google sign-in.
- Added a **Dashboard** listing your events (name, date, song count) with **New event**, open and **Delete**.
- Events are private to their owner (Row Level Security). Share links (`/share/<token>`) stay public and read-only, and old `?share=<token>` links redirect to them.
- The editor has **← Dashboard**, **Save** and **Share** (copies the read-only link). It warns before you leave with unsaved changes.
- Removed `?edit=` links, the "Event saved" popup and the Reset button: ownership and **New event** replace them.
- Events saved before v3.0.0 have no owner. Their share links keep working, but they can no longer be edited.
```

Add `v2.4.0 ↓ Phone-first stage-ready redesign` and `v3.0.0 ↓ Next.js rebuild, accounts, dashboard` to the "Release Evolution" block, and add to the Versioning Notes:

```markdown
- **v3.0.0:** major release: new framework, accounts, and URL structure.
```

- [ ] **Step 3: Commit**

```bash
git add README.md changelog/v3.0.0_changelog.md
git commit -m "Document v3.0.0 setup, security model and changelog"
```

---

### Task 7: Deploy to Vercel

These steps happen in your human partner's accounts. Do them with them, not for them.

- [ ] **Step 1: Push the branch**

`git push -u origin nextjs-migration`

- [ ] **Step 2: Create the Vercel project**

Import the GitHub repo in Vercel (framework is detected as Next.js). Set the env vars `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` for Production and Preview. Deploy.

- [ ] **Step 3: Point Supabase at production**

In Authentication > URL Configuration, set Site URL to `https://<vercel-domain>` and add the Redirect URL `https://<vercel-domain>/auth/callback`. Keep the localhost entry for development.

- [ ] **Step 4: Production checklist**

On the production URL, run spec §6 items 1, 2, 3, 6, 7, 8 and 9. Also open an old v2.x share link rewritten to the new host (`https://<vercel-domain>/?share=<token>`): it shows the event.

- [ ] **Step 5: Merge**

Once production passes, open a PR from `nextjs-migration` into `main` (or merge, following your human partner's usual flow), then tag `v3.0.0`.
