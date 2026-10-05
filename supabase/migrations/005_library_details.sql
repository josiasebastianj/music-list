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
grant select, insert, update, delete on public.themes, public.song_themes to authenticated;

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
