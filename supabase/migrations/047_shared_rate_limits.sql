-- BASE-DEP-001 / FEAT-IAM-001 / FEAT-APP-001 / FEAT-SHR-001 / FEAT-GST-001 / FEAT-SUP-001
-- Atomic, privacy-preserving abuse counters shared by every application
-- instance. Only the service role can consume or clean counters.

create table if not exists public.rate_limit_windows (
  key_digest text primary key check (key_digest ~ '^[a-f0-9]{64}$'),
  request_count integer not null check (request_count >= 1),
  reset_at timestamptz not null,
  updated_at timestamptz not null default clock_timestamp()
);

create index if not exists rate_limit_windows_expiry_idx
  on public.rate_limit_windows(reset_at,key_digest);

alter table public.rate_limit_windows enable row level security;
revoke all on table public.rate_limit_windows from public,anon,authenticated;
grant select,insert,update,delete on table public.rate_limit_windows to service_role;

create or replace function public.consume_rate_limit(
  requested_key_digest text,
  requested_limit integer,
  requested_window_seconds integer
)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  consumed public.rate_limit_windows%rowtype;
  consumed_at timestamptz:=clock_timestamp();
begin
  if requested_key_digest !~ '^[a-f0-9]{64}$'
    or requested_limit<1 or requested_limit>1000
    or requested_window_seconds<1 or requested_window_seconds>86400
  then raise exception 'INVALID_RATE_LIMIT_REQUEST'; end if;

  insert into public.rate_limit_windows(
    key_digest,request_count,reset_at,updated_at
  ) values(
    requested_key_digest,1,
    consumed_at+make_interval(secs=>requested_window_seconds),consumed_at
  )
  on conflict(key_digest) do update set
    request_count=case
      when public.rate_limit_windows.reset_at<=consumed_at then 1
      else public.rate_limit_windows.request_count+1
    end,
    reset_at=case
      when public.rate_limit_windows.reset_at<=consumed_at
        then consumed_at+make_interval(secs=>requested_window_seconds)
      else public.rate_limit_windows.reset_at
    end,
    updated_at=consumed_at
  returning * into consumed;

  return jsonb_build_object(
    'allowed',consumed.request_count<=requested_limit,
    'retry_after_seconds',case
      when consumed.request_count<=requested_limit then 0
      else greatest(1,ceil(extract(epoch from consumed.reset_at-consumed_at)))::integer
    end
  );
end;
$$;

revoke all on function public.consume_rate_limit(text,integer,integer)
  from public,anon,authenticated;
grant execute on function public.consume_rate_limit(text,integer,integer)
  to service_role;

create or replace function public.cleanup_rate_limit_windows(
  requested_limit integer default 500
)
returns integer
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  deleted_count integer:=0;
begin
  if requested_limit<1 or requested_limit>1000 then
    raise exception 'INVALID_RATE_LIMIT_CLEANUP';
  end if;
  with expired as (
    select candidate.key_digest
    from public.rate_limit_windows candidate
    where candidate.reset_at<=clock_timestamp()
    order by candidate.reset_at,candidate.key_digest
    limit requested_limit
    for update skip locked
  ), deleted as (
    delete from public.rate_limit_windows candidate
    using expired
    where candidate.key_digest=expired.key_digest
    returning candidate.key_digest
  )
  select count(*)::integer into deleted_count from deleted;
  return deleted_count;
end;
$$;

revoke all on function public.cleanup_rate_limit_windows(integer)
  from public,anon,authenticated;
grant execute on function public.cleanup_rate_limit_windows(integer)
  to service_role;

comment on table public.rate_limit_windows is
  'HMAC-digested, fixed-window request counters shared across serverless instances.';
comment on function public.consume_rate_limit(text,integer,integer) is
  'Atomically consumes a bounded request window and returns only allowed/retry state.';
comment on function public.cleanup_rate_limit_windows(integer) is
  'Deletes a bounded batch of expired request windows for scheduled maintenance.';
