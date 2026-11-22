-- Let authenticated, allowlisted owners edit project metadata and publish a new build
-- without exposing direct edits to project visibility or moderation status.
create or replace function public.update_owned_project(
  p_project_id uuid,
  p_title text,
  p_slug text,
  p_description text,
  p_category text,
  p_version text,
  p_cover_url text,
  p_launch_url text default null,
  p_storage_path text default null,
  p_build_type text default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  project_owner uuid;
begin
  if auth.uid() is null or not public.is_active_user() or not public.can_upload_games() then
    raise exception 'active allowlisted creator required';
  end if;
  if nullif(btrim(p_cover_url), '') is not null and p_cover_url !~ '^https://[^[:space:]]+$' then
    raise exception 'cover image must use HTTPS';
  end if;

  select owner_id into project_owner
  from public.projects
  where id = p_project_id
  for update;

  if project_owner is distinct from auth.uid() then
    raise exception 'project owner required';
  end if;

  if p_launch_url is not null then
    if p_launch_url !~ '^https://[^[:space:]]+$' or length(p_launch_url) > 2048 then
      raise exception 'a valid HTTPS launch URL is required';
    end if;
    if p_build_type not in ('html5', 'javascript', 'webgl', 'web_project', 'download') then
      raise exception 'invalid build type';
    end if;
    if p_storage_path is not null and p_storage_path !~ ('^' || auth.uid()::text || '/' || p_project_id::text || '/versions/[0-9a-f-]+$') then
      raise exception 'invalid storage path';
    end if;

    insert into public.project_builds(project_id, version, build_type, launch_url, storage_path)
    values (p_project_id, p_version, p_build_type, p_launch_url, p_storage_path);
  elsif p_storage_path is not null or p_build_type is not null then
    raise exception 'build fields require a launch URL';
  end if;

  update public.projects
  set title = p_title,
      slug = p_slug,
      description = p_description,
      category = p_category,
      version = p_version,
      cover_url = nullif(btrim(p_cover_url), '')
  where id = p_project_id and owner_id = auth.uid();

  return found;
end;
$$;

revoke all on function public.update_owned_project(uuid, text, text, text, text, text, text, text, text, text) from public, anon;
grant execute on function public.update_owned_project(uuid, text, text, text, text, text, text, text, text, text) to authenticated;
