-- FEAT-MAT-001 / FEAT-MKT-001 / FEAT-CAP-001
-- Keep anonymous discovery public-only and make an explicit signal-geometry
-- filter govern the geographic evidence used for endpoint matching.

do $migration$
declare
  definition text;
  patched text;
  private_candidate text:=$fragment$  where (candidate.visibility='OPEN' or jsonb_array_length(candidate.recurring_corridors)>0)
$fragment$;
  public_candidate text:=$fragment$  where candidate.visibility='OPEN'
$fragment$;
  current_route text:=$fragment$candidate.visibility='OPEN' and candidate.availability_geometry='ROUTE'
          and public.capacity_route_$fragment$;
  gated_current_route text:=$fragment$(input.geometry is null or input.geometry='ROUTE') and candidate.visibility='OPEN' and candidate.availability_geometry='ROUTE'
          and public.capacity_route_$fragment$;
  regular_route_pair text:=$fragment$or exists(select 1 from jsonb_array_elements(candidate.recurring_corridors) signal
          where signal->>'geometry'='ROUTE' and public.capacity_route_matches$fragment$;
  gated_regular_route_pair text:=$fragment$or (input.geometry is null or input.geometry='ROUTE') and exists(select 1 from jsonb_array_elements(candidate.recurring_corridors) signal
          where signal->>'geometry'='ROUTE' and public.capacity_route_matches$fragment$;
  regular_route_point text:=$fragment$or exists(select 1 from jsonb_array_elements(candidate.recurring_corridors) signal where signal->>'geometry'='ROUTE'
          and public.capacity_route_point_matches$fragment$;
  gated_regular_route_point text:=$fragment$or (input.geometry is null or input.geometry='ROUTE') and exists(select 1 from jsonb_array_elements(candidate.recurring_corridors) signal where signal->>'geometry'='ROUTE'
          and public.capacity_route_point_matches$fragment$;
  current_area text:=$fragment$or coalesce(candidate.market_status,candidate.status::text)='EMPTY' and candidate.visibility='OPEN'
          and candidate.availability_geometry='RADIUS'$fragment$;
  gated_current_area text:=$fragment$or (input.geometry is null or input.geometry='RADIUS') and coalesce(candidate.market_status,candidate.status::text)='EMPTY' and candidate.visibility='OPEN'
          and candidate.availability_geometry='RADIUS'$fragment$;
  regular_area text:=$fragment$or coalesce(candidate.market_status,candidate.status::text)='EMPTY' and exists($fragment$;
  gated_regular_area text:=$fragment$or (input.geometry is null or input.geometry='RADIUS') and coalesce(candidate.market_status,candidate.status::text)='EMPTY' and exists($fragment$;
begin
  definition:=pg_get_functiondef(
    'public.public_capacity_page(jsonb,timestamptz,uuid,integer)'::regprocedure
  );

  if position(private_candidate in definition)=0
    or position(current_route in definition)=0
    or position(regular_route_pair in definition)=0
    or position(regular_route_point in definition)=0
    or position(current_area in definition)=0
    or position(regular_area in definition)=0
  then
    raise exception 'PUBLIC_CAPACITY_FILTER_CONTRACT_NOT_FOUND';
  end if;

  patched:=replace(definition,private_candidate,public_candidate);
  patched:=replace(patched,current_route,gated_current_route);
  patched:=replace(patched,regular_route_pair,gated_regular_route_pair);
  patched:=replace(patched,regular_route_point,gated_regular_route_point);
  patched:=replace(patched,current_area,gated_current_area);
  patched:=replace(patched,regular_area,gated_regular_area);

  if position(private_candidate in patched)>0
    or position(public_candidate in patched)=0
    or position(gated_current_route in patched)=0
    or position(gated_regular_route_pair in patched)=0
    or position(gated_regular_route_point in patched)=0
    or position(gated_current_area in patched)=0
    or position(gated_regular_area in patched)=0
  then
    raise exception 'PUBLIC_CAPACITY_FILTER_CONTRACT_NOT_REPLACED';
  end if;

  execute patched;
end;
$migration$;

revoke all on function public.public_capacity_page(jsonb,timestamptz,uuid,integer)
  from public,anon,authenticated;
grant execute on function public.public_capacity_page(jsonb,timestamptz,uuid,integer)
  to service_role;
