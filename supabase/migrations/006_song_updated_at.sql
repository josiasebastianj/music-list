-- v3.3.0: "Last update" for library songs. Safe to re-run.
alter table public.songs add column if not exists updated_at timestamptz;
update public.songs set updated_at = created_at where updated_at is null;
alter table public.songs alter column updated_at set default now();
alter table public.songs alter column updated_at set not null;

create or replace function public.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists songs_touch_updated_at on public.songs;
create trigger songs_touch_updated_at before update on public.songs
  for each row execute function public.touch_updated_at();

notify pgrst, 'reload schema';
