begin;
do $test$
declare admin_id uuid; outsider uuid; route_id uuid; original_geometry text; result jsonb; detail jsonb;
begin
  select id into strict admin_id from profiles where email='admin@loadgistic.local';
  select id into strict outsider from profiles where email='transporter@loadgistic.local';
  select id,geometry into strict route_id,original_geometry from profile_routes order by id limit 1;
  update profile_routes set geometry='RADIUS',origin='AUDIT-GEOMETRY-AREA',destination='AUDIT-GEOMETRY-AREA' where id=route_id;
  select payload into strict result from managed_admin_operations_page(admin_id,'ROUTES','AUDIT-GEOMETRY-AREA',0,20) where payload->>'id'=route_id::text;
  if result->>'geometry' is distinct from 'RADIUS' then raise exception 'AREA_DISCRIMINATOR_MISSING';end if;
  if result ?| array['area_center_lat','area_center_lng','area_boundary_json','route_points_json'] then raise exception 'COORDINATES_EXPOSED';end if;
  detail:=managed_admin_operation_record(admin_id,'ROUTES',route_id,'PROFILE_ROUTE');
  if detail->>'geometry' is distinct from result->>'geometry' then raise exception 'DETAIL_GEOMETRY_MISMATCH';end if;
  update profile_routes set geometry='ROUTE',destination='AUDIT-GEOMETRY-DESTINATION' where id=route_id;
  select payload into strict result from managed_admin_operations_page(admin_id,'ROUTES','AUDIT-GEOMETRY-AREA',0,20) where payload->>'id'=route_id::text;
  if result->>'geometry' is distinct from 'ROUTE' or result->>'destination' is distinct from 'AUDIT-GEOMETRY-DESTINATION' then raise exception 'ROUTE_CHANGED';end if;
  begin perform managed_admin_operations_page(outsider,'ROUTES','',0,20);raise exception 'PROVIDER_ADMIN_ACCESS';
    exception when raise_exception then if sqlerrm<>'FORBIDDEN' then raise;end if;end;
  if has_function_privilege('authenticated','managed_admin_operations_page(uuid,text,text,integer,integer)','EXECUTE') then raise exception 'BROWSER_ACCESS';end if;
  raise notice 'PASS: area/route discriminator, detail agreement, bounded projection and provider/browser denial';
end $test$;
rollback;
