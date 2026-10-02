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
