# setlist.app

**Version:** 3.0.0

setlist.app builds worship setlists. An Event holds Songs, and each Song holds Song Details (a name, a colour and a note). You can export a song as a PNG and share a read-only link to an event. A dashboard lists your events.

It is a Next.js (TypeScript) app. Supabase provides the database and sign-in.

## Current status

- **Testing mode.** Everyone logs in with one shared password to one shared Supabase account. There is no sign-up and no Google sign-in. All testers see and edit the same events. See "Switching to real accounts" to change this.
- **Database.** `001` and `002` have been run on the project's Supabase database. `003` (team members) must be run before the Team feature can save.
- **Hosting.** Not deployed to Vercel yet. Run it locally with `npm run dev`.
- **Branch.** The app is on `main` (merged from `revamp-nextjs` in pull request #1). The old single-file v2.4.0 page is gone from `main`, and since `002` removed its open access policies, it couldn't save anyway.

## Requirements

- Node 22.18 or newer
- A Supabase project

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy `.env.local.example` to `.env.local` and fill in your project's values:

   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - `SHARED_LOGIN_EMAIL`: the email of the shared tester account (see step 4). It stays on the server and is never sent to the browser.

3. Run the SQL files in `supabase/migrations/` from the Supabase **SQL Editor**, in order.

   Use the SQL Editor on purpose. It has no signed-in user, so `auth.uid()` is null when the `user_id` column default fills existing rows. That is how events from before v3.0.0 keep `user_id = null`.

   - **`001_share_function.sql`** adds the `updated_at` column and the `get_shared_event` function. Before you run it, check the column types:

     ```sql
     select column_name, data_type from information_schema.columns where table_name = 'events' and table_schema = 'public';
     ```

     The function has a `returns table (...)` clause. If `event_date` is not `date`, or `event_name` is not `text`, change the types in that clause to match. Afterwards, check that the function exists:

     ```sql
     select proname from pg_proc where proname = 'get_shared_event';
     ```

   - **`002_auth_and_rls.sql`** adds `user_id`, removes every existing policy on `events`, turns on Row Level Security and adds four owner-only policies. Afterwards, check the policies:

     ```sql
     select policyname, roles from pg_policies where tablename = 'events';
     ```

     You should see exactly four, all for `{authenticated}`: `own select`, `own insert`, `own update` and `own delete`.

   - **`003_event_members.sql`** adds the `members` column (a JSON list of `{name, role}`) and recreates `get_shared_event` so share links include the team. If you changed the types in `001`'s `returns table (...)`, make the same change here. Until it runs, saving an event fails with a missing `members` column error.

   If you are moving from a live v2.x site, read "Switching over from v2.x" before running `002`.

4. Set up the shared tester login (testing mode):

   - **Create the shared account:** Authentication > Users > Add user. Use the email from `SHARED_LOGIN_EMAIL`, set the shared password and tick "Auto confirm user".
   - **Block sign-ups:** Authentication > Sign In / Providers. Turn off "Allow new users to sign up", so nobody can create accounts through the API.
   - **Revoking access:** change the password in Supabase. Everyone, including you, has to log in again.

5. Start the dev server:

   ```bash
   npm run dev
   ```

   Open http://localhost:3000 and log in with the shared password.

## Using the app

- **Dashboard:** lists events (name, date, song count), newest first. Each row has **Edit** (or click the title), **Share** (copies the read-only link) and **Delete**. **New event** creates an empty event and opens it.
- **Editor:** add, reorder and delete songs and song details, cycle colours, export a song as PNG. **Team** (under the event date) opens a pop-up to add, edit and remove team members, each with a free-text name and role. **Save** stores the event. **Share** copies the read-only link. **← Dashboard** goes back. The browser warns before you leave with unsaved changes, including with the Back button.
- **Share link:** `/share/<token>` shows the event read-only to anyone with the link, without logging in, including the team list under **Team**. Old `/?share=<token>` links redirect there.

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Starts the dev server |
| `npm run build` | Builds for production |
| `npm run start` | Runs the production build |
| `npm run lint` | Runs ESLint |
| `npm test` | Runs `lib/event.test.ts` with Node's test runner |

On a fresh clone, `npx tsc --noEmit` needs `npm run dev`, `npm run build` or `npx next typegen` to have run first. `next-env.d.ts` and `.next/types` are generated and git-ignored.

## Routes

| Route | Access | Purpose |
|---|---|---|
| `/` | everyone | Redirects to `/dashboard` or `/login`. Old `/?share=<token>` links redirect to `/share/<token>`. |
| `/login` | logged out | Shared-password login (testing mode) |
| `/auth/callback` | - | Finishes Google sign-in and email confirmation (unused in testing mode) |
| `/dashboard` | logged in | Your events: new, edit, share, delete, log out |
| `/events/[id]` | owner | The editor |
| `/share/[token]` | public | Read-only view of an event |

## Project layout

```
app/
  layout.tsx                  html shell, inline theme script (no flash), fonts
  globals.css                 styles (v2.4.0 CSS + dashboard/login additions)
  page.tsx                    redirect logic (+ legacy ?share=)
  login/page.tsx              redirects to /dashboard when already logged in
  login/LoginForm.tsx         password-only form (testing mode)
  login/actions.ts            server action: signs in to the shared account
  auth/callback/route.ts      OAuth / email-confirmation code exchange (unused in testing mode)
  dashboard/page.tsx          server: lists events
  dashboard/DashboardButtons.tsx  New event, Share, Delete, Log out
  events/[id]/page.tsx        server: load row (RLS) -> 404, error page or <EventEditor>
  share/[token]/page.tsx      server: rpc get_shared_event -> 404, error page or <EventEditor readOnly>
components/
  AppShell.tsx                top bar, page frame, footer
  EventEditor.tsx             sidebar + song workspace; edit and read-only modes
  Icon.tsx                    SVG icons
  TeamDialog.tsx              Team button + pop-up (edit and read-only)
  ThemeToggle.tsx             light/dark switch
lib/
  event.ts                    types (Event, Song, Section, Member), eventFromRow, safeColor, colors, formatEventDate, randomShareToken
  event.test.ts               runnable check: node --test
  exportPng.ts                PNG export
  supabase/client.ts          browser client
  supabase/server.ts          server client (cookies)
proxy.ts                      session refresh + login redirect
supabase/migrations/          001_share_function.sql, 002_auth_and_rls.sql, 003_event_members.sql
.env.local.example            NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, SHARED_LOGIN_EMAIL
```

## Security model

- Row Level Security makes events owner-only. A signed-in user can read, change and delete only rows where `user_id = auth.uid()`. Logged-out visitors can't read the table at all.
- In testing mode, everyone shares one account, so everyone with the password can see and change every event that account owns. Sign-ups are turned off in Supabase.
- Share links go through the `get_shared_event(token)` function. It returns the name, date, data and team members for one share token, and no id or owner. Anyone with the link can read that event, and nobody can change it.
- The app uses only the publishable key. Never put the `service_role` or secret key in this app.
- `proxy.ts` refreshes the session cookie and sends logged-out visitors to `/login`. That is a convenience. RLS is the security boundary.
- Events saved before v3.0.0 have `user_id = null`. Their share links still work, but nobody can edit them, and they don't appear on the dashboard.

## Troubleshooting

- **"new row violates row-level security policy" when creating an event:** `002_auth_and_rls.sql` hasn't been run. The v2.3.0 policies only allow the `anon` role, and a logged-in user is `authenticated`. Run `002`.
- **Share links show an error page ("Could not find the function public.get_shared_event"):** the function doesn't exist. Run `003_event_members.sql` (it recreates the function and reloads the API).
- **Save fails with "Could not find the 'members' column":** `003_event_members.sql` hasn't been run.
- **"Wrong password." on login:** the password doesn't match the shared account, or `SHARED_LOGIN_EMAIL` doesn't match its email.
- **Dev console: "Encountered a script tag while rendering React component":** harmless. On 404 and error pages, Next re-renders the root layout in the browser during development, and React warns about the theme script, which already ran from the server HTML.

## Switching to real accounts

1. Restore the email and Google `app/login/LoginForm.tsx` from git history (commit `6617183`), delete `app/login/actions.ts` and the `SHARED_LOGIN_EMAIL` variable.
2. In Supabase, turn sign-ups back on and set up:
   - **Email:** Authentication > Providers > Email. Turn it on and turn on "Confirm email".
   - **Email limit:** Supabase's built-in email sender only sends a few confirmation emails per hour. Set up custom SMTP (Authentication > SMTP Settings) before a team signs up, or stagger sign-ups.
   - **URLs:** Authentication > URL Configuration. Set Site URL to `http://localhost:3000` and add the Redirect URL `http://localhost:3000/auth/callback`.
   - **Google:** in Google Cloud Console, create an OAuth client ID (Web application). Set the authorised redirect URI to `https://<project-ref>.supabase.co/auth/v1/callback`. Then open Authentication > Providers > Google in Supabase, turn it on and paste the Client ID and Secret.
3. Events owned by the shared account stay with it. Move them to a real account with an `update public.events set user_id = '<new user id>' where user_id = '<shared account id>';` in the SQL Editor if needed.

## Deploying

Deploy on Vercel.

1. Import the GitHub repo. Vercel detects Next.js.
2. Set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` and `SHARED_LOGIN_EMAIL` for Production and Preview, then deploy.
3. For real accounts only: in Supabase, open Authentication > URL Configuration. Set Site URL to `https://<vercel-domain>` and add the Redirect URL `https://<vercel-domain>/auth/callback`. Keep the localhost entries for development.

### Switching over from v2.x

Share links already sent point at the old v2.x host. Replace the old host's page with a redirect stub, for example an `index.html` containing:

```html
<!doctype html><meta charset="utf-8"><script>location.replace("https://YOUR-VERCEL-DOMAIN/" + location.search + location.hash)</script>
```

`/?share=<token>` on the new app redirects to `/share/<token>`. If the old host is GitHub Pages serving this repo's `main` branch, the old `index.html` is already gone (v3.0.0 is merged), so old links show GitHub's 404. Add the stub (with the real domain) to the branch GitHub Pages serves. Vercel serves the Next.js app and ignores a root `index.html`.

On this project, `002` has already run and v3.0.0 is merged, so old v2.x share links don't work until the stub points at the deployed app.

## History

See `changelog/` for release notes. Older docs for v2.x are in `docs/`. The v3.0.0 design spec and implementation plan are in `docs/superpowers/`.
