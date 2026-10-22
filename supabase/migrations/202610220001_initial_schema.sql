create extension if not exists pgcrypto;

create type public.app_role as enum ('user','developer','moderator','admin');
create type public.account_state as enum ('active','suspended','pending_deletion');
create type public.project_visibility as enum ('public','private');
create type public.project_status as enum ('draft','review','published','suspended','pending_deletion');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique check (username ~ '^[a-zA-Z0-9_]{3,24}$'),
  display_name text not null check (char_length(btrim(display_name)) between 1 and 32),
  role public.app_role not null default 'user',
  account_status public.account_state not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index profiles_display_name_unique on public.profiles (lower(btrim(display_name)));

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete restrict,
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' and char_length(slug) <= 80),
  title text not null check (char_length(title) between 1 and 100),
  description text not null default '' check (char_length(description) <= 10000),
  category text not null default '웹 프로젝트',
  version text not null default '1.0.0',
  visibility public.project_visibility not null default 'private',
  moderation_status public.project_status not null default 'draft',
  cover_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index projects_public_idx on public.projects(created_at desc) where visibility='public' and moderation_status='published';
create index projects_owner_idx on public.projects(owner_id, updated_at desc);

create or replace function public.touch_updated_at() returns trigger language plpgsql as $$ begin new.updated_at=now(); return new; end $$;
create trigger projects_touch_updated_at before update on public.projects for each row execute function public.touch_updated_at();
create table public.project_builds (
  id uuid primary key default gen_random_uuid(), project_id uuid not null references public.projects(id) on delete cascade,
  version text not null, build_type text not null check (build_type in ('html5','javascript','webgl','web_project','download')),
  launch_url text check (launch_url is null or (launch_url like 'https://%' and length(launch_url) <= 2048)),
  download_url text check (download_url is null or (download_url like 'https://%' and length(download_url) <= 2048)),
  storage_path text, created_at timestamptz not null default now(), check (launch_url is not null or download_url is not null or storage_path is not null)
);
create index project_builds_project_idx on public.project_builds(project_id, created_at desc);

create table public.favorites (
  user_id uuid not null references public.profiles(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  created_at timestamptz not null default now(), primary key(user_id, project_id)
);
create table public.play_history (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade, played_at timestamptz not null default now(),
  duration_seconds integer not null default 0 check(duration_seconds between 0 and 86400)
);
create index play_history_user_idx on public.play_history(user_id, played_at desc);
create table public.reports (
  id uuid primary key default gen_random_uuid(), reporter_id uuid not null references public.profiles(id) on delete restrict,
  project_id uuid not null references public.projects(id) on delete cascade, reason text not null check(char_length(reason) between 10 and 2000),
  status text not null default 'open' check(status in ('open','reviewing','resolved','dismissed')),
  created_at timestamptz not null default now(), reviewed_by uuid references public.profiles(id), reviewed_at timestamptz
);
create table public.security_events (
  id uuid primary key default gen_random_uuid(), actor_id uuid references public.profiles(id) on delete set null,
  event_type text not null check(char_length(event_type) <= 100), created_at timestamptz not null default now(), metadata jsonb not null default '{}'::jsonb
);
create table public.admin_audit_logs (
  id uuid primary key default gen_random_uuid(), actor_id uuid references public.profiles(id) on delete set null,
  action text not null, target_user_id uuid references public.profiles(id) on delete set null,
  result text not null, created_at timestamptz not null default now(), details jsonb not null default '{}'::jsonb
);

create or replace function public.bootstrap_profile() returns trigger language plpgsql security definer set search_path=public as $$
begin
  insert into public.profiles(id,username,display_name)
  values(new.id, lower(coalesce(new.raw_user_meta_data->>'username','')), coalesce(nullif(new.raw_user_meta_data->>'display_name',''), split_part(new.email,'@',1)));
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.bootstrap_profile();

create or replace function public.guard_profile_privileges() returns trigger language plpgsql set search_path=public as $$
begin
  if auth.uid() = old.id and (new.role is distinct from old.role or new.account_status is distinct from old.account_status or new.username is distinct from old.username or new.id is distinct from old.id) then
    raise exception 'protected profile fields cannot be changed by the account owner';
  end if;
  new.updated_at := now(); return new;
end $$;
create trigger guard_profile_update before update on public.profiles for each row execute function public.guard_profile_privileges();

create or replace function public.is_active_operator() returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.profiles where id=auth.uid() and role in ('admin','moderator') and account_status='active')
$$;
create or replace function public.is_active_user() returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.profiles where id=auth.uid() and account_status='active')
$$;

alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.project_builds enable row level security;
alter table public.favorites enable row level security;
alter table public.play_history enable row level security;
alter table public.reports enable row level security;
alter table public.security_events enable row level security;
alter table public.admin_audit_logs enable row level security;

create policy "profiles readable by self or operator" on public.profiles for select to authenticated using(id=auth.uid() or public.is_active_operator());
create policy "profile owner edits display name" on public.profiles for update to authenticated using(id=auth.uid() and public.is_active_user()) with check(id=auth.uid() and public.is_active_user());
create policy "published projects visible" on public.projects for select to anon, authenticated using((visibility='public' and moderation_status='published') or (owner_id=auth.uid() and public.is_active_user()) or public.is_active_operator());
create policy "active owner creates project" on public.projects for insert to authenticated with check(owner_id=auth.uid() and public.is_active_user() and moderation_status in ('draft','review') and visibility='private');
create policy "owner edits own project" on public.projects for update to authenticated using(owner_id=auth.uid() and public.is_active_user()) with check(owner_id=auth.uid() and public.is_active_user() and moderation_status in ('draft','review'));
create policy "owner deletes own unpublished project" on public.projects for delete to authenticated using(owner_id=auth.uid() and moderation_status in ('draft','review'));
create policy "builds visible with parent" on public.project_builds for select to anon, authenticated using(exists(select 1 from public.projects p where p.id=project_id and ((p.owner_id=auth.uid() and public.is_active_user()) or public.is_active_operator())));
create policy "active owners manage builds" on public.project_builds for all to authenticated using(exists(select 1 from public.projects p where p.id=project_id and p.owner_id=auth.uid() and public.is_active_user() and p.moderation_status in ('draft','review'))) with check(exists(select 1 from public.projects p where p.id=project_id and p.owner_id=auth.uid() and public.is_active_user() and p.moderation_status in ('draft','review')));
create policy "favorite owner manages" on public.favorites for all to authenticated using(user_id=auth.uid() and public.is_active_user()) with check(user_id=auth.uid() and public.is_active_user());
create policy "history owner reads" on public.play_history for select to authenticated using((user_id=auth.uid() and public.is_active_user()) or public.is_active_operator());
create policy "active member writes own history" on public.play_history for insert to authenticated with check(user_id=auth.uid() and public.is_active_user() and exists(select 1 from public.projects p where p.id=project_id and p.visibility='public' and p.moderation_status='published'));
create policy "reporter creates own report" on public.reports for insert to authenticated with check(reporter_id=auth.uid() and public.is_active_user());
create policy "reporter and operator read reports" on public.reports for select to authenticated using((reporter_id=auth.uid() and public.is_active_user()) or public.is_active_operator());
create policy "no client access to security events" on public.security_events for select to authenticated using(public.is_active_operator());
create policy "admin reads audit logs" on public.admin_audit_logs for select to authenticated using(exists(select 1 from public.profiles where id=auth.uid() and role='admin' and account_status='active'));
revoke all on public.security_events, public.admin_audit_logs from anon, authenticated;
grant select on public.security_events, public.admin_audit_logs to authenticated;
