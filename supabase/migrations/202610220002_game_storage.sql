-- Static HTML5 builds are served from a separate origin (Supabase Storage)
-- and run inside the app's sandboxed iframe.
insert into storage.buckets (id, name, public, file_size_limit)
values ('game-builds', 'game-builds', true, 52428800)
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit;

create policy "owners upload game build files"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'game-builds'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "owners delete game build files"
on storage.objects for delete to authenticated
using (
  bucket_id = 'game-builds'
  and (storage.foldername(name))[1] = auth.uid()::text
);
