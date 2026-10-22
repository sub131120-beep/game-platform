-- Public creator cards expose only fields that are safe for anonymous visitors.
-- Email, account state, role and user IDs remain private.
create or replace function public.get_public_creator(p_username text)
returns table(id uuid, username text, display_name text, published_projects bigint, play_count bigint)
language sql
stable
security definer
set search_path = public
as $$
  select pr.id,
         pr.username,
         pr.display_name,
         count(distinct p.id)::bigint,
         count(h.id)::bigint
  from public.profiles pr
  join public.projects p on p.owner_id = pr.id
    and p.visibility = 'public' and p.moderation_status = 'published'
  left join public.play_history h on h.project_id = p.id
  where pr.username = lower(btrim(p_username))
  group by pr.id, pr.username, pr.display_name
$$;
revoke all on function public.get_public_creator(text) from public;
grant execute on function public.get_public_creator(text) to anon, authenticated;

create or replace function public.get_project_creator(p_project_id uuid)
returns table(username text, display_name text)
language sql
stable
security definer
set search_path = public
as $$
  select pr.username, pr.display_name
  from public.profiles pr
  join public.projects p on p.owner_id = pr.id
  where p.id = p_project_id
    and p.visibility = 'public' and p.moderation_status = 'published'
$$;
revoke all on function public.get_project_creator(uuid) from public;
grant execute on function public.get_project_creator(uuid) to anon, authenticated;

create index if not exists reports_status_created_idx on public.reports(status, created_at desc);
create index if not exists admin_audit_logs_created_idx on public.admin_audit_logs(created_at desc);
