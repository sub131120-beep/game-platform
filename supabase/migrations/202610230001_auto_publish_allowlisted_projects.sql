-- Allow verified allowlisted creators to publish their own submitted projects immediately.
-- A project is created as private/review during upload and switched to public/published
-- only after all files and the project_builds row have been stored successfully.

drop policy if exists "allowlisted owner publishes projects" on public.projects;
create policy "allowlisted owner publishes projects"
on public.projects for update to authenticated
using (
  owner_id = auth.uid()
  and public.is_active_user()
  and public.can_upload_games()
  and visibility = 'private'
  and moderation_status in ('draft', 'review')
)
with check (
  owner_id = auth.uid()
  and public.is_active_user()
  and public.can_upload_games()
  and visibility = 'public'
  and moderation_status = 'published'
);

-- Publish existing pending submissions by allowlisted creators as part of this change.
update public.projects p
set visibility = 'public', moderation_status = 'published'
where p.visibility = 'private'
  and p.moderation_status = 'review'
  and exists (
    select 1
    from auth.users u
    join public.game_upload_allowlist allowed on allowed.email = lower(u.email)
    join public.profiles pr on pr.id = u.id and pr.account_status = 'active'
    where u.id = p.owner_id
      and u.email_confirmed_at is not null
  );
