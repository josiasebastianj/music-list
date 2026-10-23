-- v3.5.0: reference link (YouTube, Spotify, ...) for library songs. Safe to re-run.
alter table public.songs add column if not exists url text;

-- search also returns url, so adding a song to an event copies it (return columns change: drop and recreate)
drop function if exists public.search_songs(text);
create function public.search_songs(q text)
returns table (id uuid, title text, artist text, song_key text, rhythm text, bpm integer, url text, content text)
language sql stable set search_path = public
as $$
  with nq as (select trim(regexp_replace(lower(q), '[^[:alnum:]]+', ' ', 'g')) as v)
  select s.id, s.title, s.artist, s.song_key, s.rhythm, s.bpm, s.url, s.content
  from public.songs s, nq
  where length(nq.v) >= 3 and s.search_text like '%' || nq.v || '%'
  order by (lower(s.title) like '%' || nq.v || '%') desc, s.title
  limit 20;
$$;
grant execute on function public.search_songs(text) to authenticated;

notify pgrst, 'reload schema';
