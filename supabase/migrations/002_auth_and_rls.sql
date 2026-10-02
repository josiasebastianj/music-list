alter table public.events
  add column if not exists user_id uuid references auth.users on delete cascade default auth.uid();

create index if not exists events_user_id_idx on public.events (user_id);

-- remove every existing policy (the v2.3.0 open ones, whatever their names) before adding the owner-only set
do $$
declare p record;
begin
  for p in select policyname from pg_policies where schemaname = 'public' and tablename = 'events' loop
    execute format('drop policy %I on public.events', p.policyname);
  end loop;
end $$;

alter table public.events enable row level security;

create policy "own select" on public.events for select to authenticated using (user_id = auth.uid());
create policy "own insert" on public.events for insert to authenticated with check (user_id = auth.uid());
create policy "own update" on public.events for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own delete" on public.events for delete to authenticated using (user_id = auth.uid());
