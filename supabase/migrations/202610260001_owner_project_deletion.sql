-- Allow an authenticated owner to permanently delete any of their own projects.
-- Related builds, favorites, reports, and play history cascade from projects.
drop policy if exists "owner deletes own unpublished project" on public.projects;
drop policy if exists "owners delete own projects" on public.projects;
create policy "owners delete own projects"
on public.projects for delete to authenticated
using (owner_id = auth.uid());

-- Let owners enumerate their own build files so the app can remove them before deleting a project.
drop policy if exists "owners list own game build files" on storage.objects;
create policy "owners list own game build files"
on storage.objects for select to authenticated
using (
  bucket_id = 'game-builds'
  and (storage.foldername(name))[1] = auth.uid()::text
);
