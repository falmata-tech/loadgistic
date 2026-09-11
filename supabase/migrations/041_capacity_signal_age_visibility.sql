-- Empty and Partial are the provider's latest published market signal. Age is
-- presented separately from status; only an explicit Off Duty update removes
-- the truck from discovery. Historical expiries and their RLS boundary remain
-- unchanged. These fail-closed patches alter only the service-role projections
-- that already select the latest row for each vehicle.

do $migration$
declare
  definition text;
  patched text;
  old_fragment text:=E'    and capacity.expires_at>now()\n';
begin
  definition:=pg_get_functiondef(
    'public.public_capacity_page(jsonb,timestamptz,uuid,integer)'::regprocedure
  );
  if position(old_fragment in definition)=0 then
    raise exception 'PUBLIC_CAPACITY_EXPIRY_CONTRACT_NOT_FOUND';
  end if;
  patched:=replace(definition,old_fragment,'');
  if position(old_fragment in patched)>0 then
    raise exception 'PUBLIC_CAPACITY_EXPIRY_CONTRACT_NOT_REMOVED';
  end if;
  execute patched;
end;
$migration$;

do $migration$
declare
  definition text;
  patched text;
  old_fragment text:=E'    select count(distinct vehicle.id) filter(where vehicle.active)::integer as fleet_size,\n      count(distinct vehicle.id) filter(where vehicle.active and capacity.expires_at>now()\n        and coalesce(capacity.market_status,capacity.status::text) in (''EMPTY'',''PARTIAL''))::integer as active_capacity_count\n    from public.vehicles vehicle\n    left join public.capacities capacity on capacity.vehicle_id=vehicle.id';
  new_fragment text:=E'    select count(distinct vehicle.id) filter(where vehicle.active)::integer as fleet_size,\n      count(distinct vehicle.id) filter(where vehicle.active\n        and coalesce(capacity.market_status,capacity.status::text) in (''EMPTY'',''PARTIAL''))::integer as active_capacity_count\n    from public.vehicles vehicle\n    left join lateral (\n      select current_capacity.market_status,current_capacity.status\n      from public.capacities current_capacity\n      where current_capacity.vehicle_id=vehicle.id\n      order by current_capacity.updated_at desc,current_capacity.id desc\n      limit 1\n    ) capacity on true';
begin
  definition:=pg_get_functiondef(
    'public.public_featured_provider_candidates(text[])'::regprocedure
  );
  if position(old_fragment in definition)=0 then
    raise exception 'FEATURED_CAPACITY_EXPIRY_CONTRACT_NOT_FOUND';
  end if;
  patched:=replace(definition,old_fragment,new_fragment);
  if position(old_fragment in patched)>0 then
    raise exception 'FEATURED_CAPACITY_EXPIRY_CONTRACT_NOT_REMOVED';
  end if;
  execute patched;
end;
$migration$;

-- The projections remain service-role-only after replacement.
revoke all on function public.public_capacity_page(jsonb,timestamptz,uuid,integer)
  from public,anon,authenticated;
grant execute on function public.public_capacity_page(jsonb,timestamptz,uuid,integer)
  to service_role;

revoke all on function public.public_featured_provider_candidates(text[])
  from public,anon,authenticated;
grant execute on function public.public_featured_provider_candidates(text[])
  to service_role;
