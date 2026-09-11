-- FEAT-CAP-001 / FEAT-MKT-001 / FEAT-SHR-001
-- Empty and Partial are last-published states. Freshness is communicated in the
-- projection; only an explicit Off Duty update removes active capacity.

create or replace function public.retain_active_capacity_until_off_duty()
returns trigger
language plpgsql
set search_path=public,pg_temp
as $$
begin
  if coalesce(new.market_status,new.status::text) in ('EMPTY','PARTIAL') then
    new.expires_at='infinity'::timestamptz;
  end if;
  return new;
end;
$$;

drop trigger if exists capacities_retain_active_signal on public.capacities;
create trigger capacities_retain_active_signal
before insert or update of status,market_status,expires_at on public.capacities
for each row execute function public.retain_active_capacity_until_off_duty();

update public.capacities
set expires_at='infinity'::timestamptz
where coalesce(market_status,status::text) in ('EMPTY','PARTIAL')
  and expires_at<>'infinity'::timestamptz;

revoke all on function public.retain_active_capacity_until_off_duty() from public,anon,authenticated;
grant execute on function public.retain_active_capacity_until_off_duty() to service_role;

comment on function public.retain_active_capacity_until_off_duty() is
  'Keeps the latest Empty or Partial signal discoverable until an authorized actor explicitly publishes Off Duty.';
