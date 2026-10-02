-- Run once in the Supabase SQL editor. No meals or raw descriptions seed the database.
begin;

create table public.journals (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null check (jsonb_typeof(data) = 'object' and data ? 'version' and data->>'version' = '1' and octet_length(data::text) <= 5242880),
  revision bigint not null default 1 check (revision > 0),
  updated_at timestamptz not null default now()
);
alter table public.journals enable row level security;
revoke all on public.journals from anon, authenticated;
grant select, insert, update, delete on public.journals to authenticated;
create policy own_journal_select on public.journals for select to authenticated using ((select auth.uid()) = user_id);
create policy own_journal_insert on public.journals for insert to authenticated with check ((select auth.uid()) = user_id);
create policy own_journal_update on public.journals for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy own_journal_delete on public.journals for delete to authenticated using ((select auth.uid()) = user_id);

create function public.journal_revision() returns trigger language plpgsql set search_path = '' as $$
begin
  if TG_OP = 'INSERT' then new.revision := 1;
  else new.revision := old.revision + 1;
  end if;
  new.updated_at := clock_timestamp();
  return new;
end;
$$;
revoke all on function public.journal_revision() from public, anon, authenticated;
create trigger journal_revision before insert or update on public.journals for each row execute function public.journal_revision();

-- A single durable budget is shared by all Vercel functions and users of this personal app.
-- Only the trusted server can reserve attempts; the client cannot change the configured cap.
create schema if not exists portion_private;
revoke all on schema portion_private from public, anon, authenticated;
create table portion_private.parse_budget (
  id boolean primary key default true check (id),
  day date not null,
  attempts integer not null default 0,
  last_attempt timestamptz,
  lease uuid,
  lease_until timestamptz
);
revoke all on portion_private.parse_budget from public, anon, authenticated;
alter table portion_private.parse_budget enable row level security;

create function public.reserve_parse(p_daily_limit integer, p_interval_seconds integer, p_lease uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  b portion_private.parse_budget%rowtype;
  t timestamptz := clock_timestamp();
  d date := (t at time zone 'UTC')::date;
  wait_seconds integer;
begin
  if p_daily_limit is null or p_daily_limit < 0 or p_daily_limit > 1000 or p_interval_seconds is null or p_interval_seconds < 0 or p_interval_seconds > 3600 or p_lease is null then
    raise exception 'Invalid budget configuration';
  end if;
  insert into portion_private.parse_budget(id, day) values (true, d) on conflict (id) do nothing;
  select * into b from portion_private.parse_budget where id = true for update;
  t := clock_timestamp();
  d := (t at time zone 'UTC')::date;
  if b.day <> d then b.day := d; b.attempts := 0; end if;
  if b.attempts >= p_daily_limit then return jsonb_build_object('allowed', false, 'reason', 'daily'); end if;
  wait_seconds := greatest(0, ceil(extract(epoch from b.last_attempt + make_interval(secs => p_interval_seconds) - t))::integer);
  if b.lease_until > t then wait_seconds := greatest(wait_seconds, ceil(extract(epoch from b.lease_until - t))::integer); end if;
  if wait_seconds > 0 then return jsonb_build_object('allowed', false, 'reason', 'pacing', 'retryAfterSeconds', wait_seconds); end if;
  update portion_private.parse_budget set day = d, attempts = b.attempts + 1, last_attempt = t, lease = p_lease, lease_until = t + interval '60 seconds' where id = true;
  return jsonb_build_object('allowed', true, 'remaining', p_daily_limit - b.attempts - 1);
end;
$$;
create function public.release_parse(p_lease uuid) returns void language sql security definer set search_path = '' as $$
  update portion_private.parse_budget set lease = null, lease_until = null where id = true and lease = p_lease;
$$;
revoke all on function public.reserve_parse(integer, integer, uuid) from public, anon, authenticated;
revoke all on function public.release_parse(uuid) from public, anon, authenticated;
grant execute on function public.reserve_parse(integer, integer, uuid) to service_role;
grant execute on function public.release_parse(uuid) to service_role;
commit;
