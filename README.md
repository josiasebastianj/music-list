# setlist.app

**Version:** 3.0.0

setlist.app builds worship setlists. An Event holds Songs, and each Song holds Song Details (a name, a colour and a note). You can export a song as a PNG and share a read-only link to an event. You sign in with an account (email and password, or Google), and a dashboard lists your events.

It is a Next.js (TypeScript) app. Supabase provides the database and sign-in.

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

3. Run the two SQL files in `supabase/migrations/` from the Supabase **SQL Editor**, `001` now and `002` only at switch-over.

   Use the SQL Editor on purpose. It has no signed-in user, so `auth.uid()` is null when the `user_id` column default fills your existing rows. That is how old events keep `user_id = null`.

   **3a. Run `001_share_function.sql` now.** It only adds things, so v2.x keeps working.

   - `001_share_function.sql` adds the `updated_at` column and the `get_shared_event` function.
     Before you run it, check the column types:

     ```sql
     select column_name, data_type from information_schema.columns where table_name = 'events' and table_schema = 'public';
     ```

     The function has a `returns table (...)` clause. If `event_date` is not `date`, or `event_name` is not `text`, change the types in that clause to match.
   **3b. Run `002_auth_and_rls.sql` only at switch-over.** It ends v2.x saving and v2.x share views (see "Switching over from v2.x" below).

   - `002_auth_and_rls.sql` adds `user_id`, removes every existing policy on `events`, turns on Row Level Security and adds four owner-only policies.
     After you run it, check the policies:

     ```sql
     select policyname from pg_policies where tablename = 'events';
     ```

     You should see exactly four: `own select`, `own insert`, `own update` and `own delete`.

   **Order matters.** `001` only adds things, so the old v2.x page keeps working after it. `002` ends anonymous saving. Once it runs, the old v2.x page stops working: it can no longer save, and its share view stops too, because the open read policy is gone. Only this app works from then on. Run `002` when you are ready to switch over.

4. Set up sign-in. **For now the app is in testing mode:** everyone logs in with one shared password. There is no sign-up and no Google sign-in.

   - **Create the shared account:** Authentication > Users > Add user. Use the email from `SHARED_LOGIN_EMAIL`, set the shared password and tick "Auto confirm user".
   - **Block sign-ups:** Authentication > Sign In / Providers. Turn off "Allow new users to sign up", so nobody can create accounts through the API.
   - **What testers get:** every tester uses the same account, so they all see and edit the same events.
   - **Revoking access:** change the password in Supabase. Everyone, including you, has to log in again.

   **Later, for real accounts:** restore the email and Google `app/login/LoginForm.tsx` from git history, delete `app/login/actions.ts` and the `SHARED_LOGIN_EMAIL` variable, and turn sign-ups back on. Then set up:

   - **Email:** Authentication > Providers > Email. Turn it on and turn on "Confirm email".
   - **Email limit:** Supabase's built-in email sender only sends a few confirmation emails per hour. Set up custom SMTP (Authentication > SMTP Settings) before a team signs up, or stagger sign-ups.
   - **URLs:** Authentication > URL Configuration. Set Site URL to `http://localhost:3000` and add the Redirect URL `http://localhost:3000/auth/callback`.
   - **Google:** in Google Cloud Console, create an OAuth client ID (Web application). Set the authorised redirect URI to `https://<project-ref>.supabase.co/auth/v1/callback`. Then open Authentication > Providers > Google in Supabase, turn it on and paste the Client ID and Secret.

5. Start the dev server:

   ```bash
   npm run dev
   ```

   Open http://localhost:3000.

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
| `/dashboard` | logged in | Your events: new, open, delete, log out |
| `/events/[id]` | owner | The editor |
| `/share/[token]` | public | Read-only view of an event |

## Project layout

```
app/
  layout.tsx              html shell, inline theme script (no flash), footer
  globals.css             styles
  page.tsx                redirect logic (+ legacy ?share=)
  login/page.tsx
  auth/callback/route.ts
  dashboard/page.tsx      server: list; small client parts for New/Delete/Log out
  events/[id]/page.tsx    server: load row (RLS) -> notFound() or <EventEditor>
  share/[token]/page.tsx  server: rpc get_shared_event -> notFound() or <EventEditor readOnly>
components/
  EventEditor.tsx         sidebar + song workspace; edit and readOnly modes
  ThemeToggle.tsx
lib/
  event.ts                types (Event, Song, Section) + uid, safeColor, normalize*, colors
  event.test.ts           runnable check: node --test
  exportPng.ts            exportSongImage, wrapLines, roundRect, formatEventDate
  supabase/client.ts      browser client
  supabase/server.ts      server client (cookies)
proxy.ts
supabase/migrations/001_share_function.sql, 002_auth_and_rls.sql
.env.local.example        NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
```

The app also has `components/AppShell.tsx`, `components/Icon.tsx`, `app/login/LoginForm.tsx` and `app/dashboard/DashboardButtons.tsx`, which the tree above leaves out.

## Security model

- Row Level Security makes events owner-only. A signed-in user can read, change and delete only rows where `user_id = auth.uid()`.
- Share links go through the `get_shared_event(token)` function. It returns the name, date and data for one share token, and no id or owner. Anyone with the link can read that event, and nobody can change it.
- The app uses only the publishable key. Never put the `service_role` or secret key in this app.
- `proxy.ts` refreshes the session cookie and sends logged-out visitors to `/login`. That is a convenience. RLS is the security boundary.
- Events saved before v3.0.0 have `user_id = null`. Their share links still work, but nobody can edit them.

## Deploying

Deploy on Vercel.

1. Import the GitHub repo. Vercel detects Next.js.
2. Set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` and `SHARED_LOGIN_EMAIL` for Production and Preview, then deploy.
3. In Supabase, open Authentication > URL Configuration. Set Site URL to `https://<vercel-domain>` and add the Redirect URL `https://<vercel-domain>/auth/callback`. Keep the localhost entries for development.

### Switching over from v2.x

Share links already sent point at the old v2.x host. Before running `002`, replace the old host's page with a redirect stub, for example an `index.html` containing:

```html
<!doctype html><meta charset="utf-8"><script>location.replace("https://YOUR-VERCEL-DOMAIN/" + location.search + location.hash)</script>
```

`/?share=<token>` on the new app redirects to `/share/<token>`. If the old host is GitHub Pages serving this repo's `main` branch, merging v3.0.0 deletes the old `index.html`. In that case add the stub (with the real domain) to the branch GitHub Pages serves, before or at the merge. Vercel serves the Next.js app and ignores a root `index.html`.

## History

See `changelog/` for release notes. Older docs for v2.x are in `docs/`.
