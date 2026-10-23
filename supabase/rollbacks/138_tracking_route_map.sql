-- Deploy the pre-route-map application first. Preserve route snapshots/history.
begin;
do $rollback$
declare name text;signature text;definition text;
begin
 for name,signature in values ('create_provider_tracking','uuid,jsonb'),('provider_tracking_detail','uuid,text'),
  ('provider_guest_tracking','uuid,text'),('tracking_recovery_context','uuid,uuid'),('recover_provider_tracking','uuid,uuid,jsonb')
 loop
  definition:=pg_get_functiondef(to_regprocedure('public.'||name||'_pre_route_map('||signature||')'));
  if definition is null then raise exception 'TRACKING_ROUTE_ROLLBACK_CONTRACT';end if;
  execute replace(definition,'FUNCTION public.'||name||'_pre_route_map(','FUNCTION public.'||name||'(');
  execute format('revoke all on function public.%I(%s) from public,anon,authenticated',name,signature);
  execute format('grant execute on function public.%I(%s) to service_role',name,signature);
 end loop;
end $rollback$;
revoke all on function public.tracking_route_projection(uuid),public.tracking_public_truck_summary(uuid) from public,anon,authenticated,service_role;
commit;
