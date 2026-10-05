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
drop policy if exists "songs read" on public.songs;
drop policy if exists "songs insert" on public.songs;
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

-- make the API see the new table and function right away
notify pgrst, 'reload schema';
