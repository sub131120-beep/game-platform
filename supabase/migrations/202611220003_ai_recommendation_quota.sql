-- Authenticated users may request at most 10 AI recommendations per rolling hour.
create table if not exists public.ai_recommend_usage (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  window_started_at timestamptz not null default now(),
  request_count integer not null default 0 check (request_count >= 0)
);

alter table public.ai_recommend_usage enable row level security;
revoke all on public.ai_recommend_usage from anon, authenticated;
grant all on public.ai_recommend_usage to service_role;

create or replace function public.consume_ai_recommend_quota(p_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  within_limit boolean;
begin
  insert into public.ai_recommend_usage(user_id, window_started_at, request_count)
  values (p_user_id, now(), 1)
  on conflict (user_id) do update
    set window_started_at = case
          when public.ai_recommend_usage.window_started_at <= now() - interval '1 hour' then now()
          else public.ai_recommend_usage.window_started_at
        end,
        request_count = case
          when public.ai_recommend_usage.window_started_at <= now() - interval '1 hour' then 1
          else public.ai_recommend_usage.request_count + 1
        end
  returning request_count <= 10 into within_limit;
  return within_limit;
end;
$$;

revoke all on function public.consume_ai_recommend_quota(uuid) from public, anon, authenticated;
grant execute on function public.consume_ai_recommend_quota(uuid) to service_role;
