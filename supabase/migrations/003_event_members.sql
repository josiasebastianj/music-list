-- team members per event: [{"name": "...", "role": "..."}]
alter table public.events add column if not exists members jsonb not null default '[]'::jsonb;

-- share links also return the team. A function's return columns can't be changed in place, so drop and recreate it.
-- Keep the event_name/event_date types matching your columns (same check as in 001).
drop function if exists public.get_shared_event(text);

create function public.get_shared_event(token text)
returns table (event_name text, event_date date, data jsonb, members jsonb)
language sql stable security definer set search_path = public
as $$
  select e.event_name, e.event_date, e.data, e.members from public.events e where e.share_token = token;
$$;

grant execute on function public.get_shared_event(text) to anon, authenticated;

-- make the API see the new column and function signature right away
notify pgrst, 'reload schema';
