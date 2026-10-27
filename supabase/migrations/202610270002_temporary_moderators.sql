-- Temporary moderator access is granted only by permanent administrators.
alter table public.profiles
  add column if not exists moderator_until timestamptz;

create index if not exists profiles_temporary_moderator_idx
  on public.profiles (moderator_until)
  where moderator_until is not null;

-- Members may edit their display name, but never their own moderation fields.
create or replace function public.guard_profile_privileges()
returns trigger
language plpgsql set search_path=public
as $$
begin
  if auth.uid() = old.id and (
    new.role is distinct from old.role
    or new.account_status is distinct from old.account_status
    or new.username is distinct from old.username
    or new.id is distinct from old.id
    or new.banned_until is distinct from old.banned_until
    or new.moderator_until is distinct from old.moderator_until
  ) then
    raise exception 'protected profile fields cannot be changed by the account owner';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.is_active_operator()
returns boolean
language sql stable security definer set search_path=public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and account_status = 'active'
      and (banned_until is null or banned_until <= now())
      and (
        role in ('admin','moderator')
        or (moderator_until is not null and moderator_until > now())
      )
  );
$$;
