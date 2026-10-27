-- Timed account bans are stored separately from permanent account status.
alter table public.profiles
  add column if not exists banned_until timestamptz;

create index if not exists profiles_active_ban_idx
  on public.profiles (banned_until)
  where banned_until is not null;

create or replace function public.is_active_operator()
returns boolean
language sql stable security definer set search_path=public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and role in ('admin','moderator')
      and account_status = 'active'
      and (banned_until is null or banned_until <= now())
  );
$$;

create or replace function public.is_active_user()
returns boolean
language sql stable security definer set search_path=public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and account_status = 'active'
      and (banned_until is null or banned_until <= now())
  );
$$;
