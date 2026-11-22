-- Permit active users to delete only their own projects and list their own
-- build files for cleanup. Keep these policies safe to re-apply.
drop policy if exists "owner deletes own unpublished project" on public.projects;
drop policy if exists "owners delete own projects" on public.projects;
create policy "owners delete own projects"
on public.projects for delete to authenticated
using (owner_id = auth.uid() and public.is_active_user());

drop policy if exists "owners list own game build files" on storage.objects;
create policy "owners list own game build files"
on storage.objects for select to authenticated
using (
  bucket_id = 'game-builds'
  and (storage.foldername(name))[1] = auth.uid()::text
  and public.is_active_user()
);
