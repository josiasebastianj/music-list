alter table public.events add column if not exists updated_at timestamptz not null default now();

create or replace function public.get_shared_event(token text)
returns table (event_name text, event_date date, data jsonb)
language sql stable security definer set search_path = public
as $$
  select e.event_name, e.event_date, e.data from public.events e where e.share_token = token;
$$;

grant execute on function public.get_shared_event(text) to anon, authenticated;
