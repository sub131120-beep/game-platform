-- Only verified accounts on this private email allowlist may submit or upload games.
create table public.game_upload_allowlist (
  email text primary key check (email = lower(btrim(email))),
  added_at timestamptz not null default now()
);
alter table public.game_upload_allowlist enable row level security;
revoke all on public.game_upload_allowlist from public, anon, authenticated;

create or replace function public.can_upload_games()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from auth.users u
    join public.game_upload_allowlist allowed on allowed.email = lower(u.email)
    where u.id = auth.uid()
      and u.email_confirmed_at is not null
      and public.is_active_user()
  );
$$;
revoke all on function public.can_upload_games() from public, anon;
grant execute on function public.can_upload_games() to authenticated;

drop policy "active owner creates project" on public.projects;
create policy "allowlisted active owner creates project"
on public.projects for insert to authenticated
with check (
  owner_id = auth.uid()
  and public.is_active_user()
  and public.can_upload_games()
  and moderation_status in ('draft','review')
  and visibility = 'private'
);

drop policy "active owners manage builds" on public.project_builds;
create policy "allowlisted owner creates builds"
on public.project_builds for insert to authenticated
with check (
  public.can_upload_games()
  and exists (
    select 1 from public.projects p
    where p.id = project_id and p.owner_id = auth.uid()
      and public.is_active_user() and p.moderation_status in ('draft','review')
  )
);
create policy "active owner updates draft builds"
on public.project_builds for update to authenticated
using (exists (
  select 1 from public.projects p
  where p.id = project_id and p.owner_id = auth.uid()
    and public.is_active_user() and p.moderation_status in ('draft','review')
))
with check (exists (
  select 1 from public.projects p
  where p.id = project_id and p.owner_id = auth.uid()
    and public.is_active_user() and p.moderation_status in ('draft','review')
));
create policy "active owner deletes draft builds"
on public.project_builds for delete to authenticated
using (exists (
  select 1 from public.projects p
  where p.id = project_id and p.owner_id = auth.uid()
    and public.is_active_user() and p.moderation_status in ('draft','review')
));

drop policy "owners upload game build files" on storage.objects;
create policy "allowlisted owners upload game build files"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'game-builds'
  and (storage.foldername(name))[1] = auth.uid()::text
  and public.can_upload_games()
);
