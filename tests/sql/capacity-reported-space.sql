-- FEAT-CAP-001 / FEAT-MAT-001 / FEAT-MKT-001. Synthetic, rollback-only.
begin;
set local search_path=public,extensions,pg_temp;
set local statement_timeout='90s';

create function pg_temp.space_assert(ok boolean,label text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'SPACE218_ASSERT: %',label;end if;end $$;
create function pg_temp.space_denied(command text,expected text) returns void language plpgsql as $$
begin
  begin execute command;exception when others then
    if sqlerrm=expected then return;end if;
    raise;
  end;
  raise exception 'SPACE218_DENIAL_MISSING: %',expected;
end $$;

do $test$
declare
 owner_id uuid:=gen_random_uuid();broker_id uuid:=gen_random_uuid();
 provider_id uuid:=gen_random_uuid();vehicle_id uuid;workspace_id uuid;connection_id uuid;
 signal_id uuid;origin_ref text;destination_ref text;route_points jsonb;
 command jsonb;private_digest text:=encode(gen_random_bytes(32),'hex');
 report_time timestamptz;report_actor uuid;report_driver uuid;result jsonb;connection jsonb;
begin
 perform pg_temp.space_assert(not has_function_privilege('anon',
  'public.capacity_reported_available_percent(text,integer,timestamptz,uuid,uuid)','EXECUTE')
  and not has_function_privilege('authenticated',
  'public.capacity_min_available_percent(jsonb)','EXECUTE'),
  'internal_helpers_not_client_callable');
 perform pg_temp.space_assert(public.capacity_reported_available_percent('EMPTY',50,null,null,null)=100,
  'empty_is_derived_100');
 perform pg_temp.space_assert(public.capacity_reported_available_percent('PARTIAL',50,null,null,owner_id) is null,
  'legacy_partial_50_is_unknown');
 perform pg_temp.space_assert(public.capacity_reported_available_percent('OFF_DUTY',0,null,null,null) is null,
  'off_duty_is_not_an_offer');
 perform pg_temp.space_assert(public.capacity_reported_available_percent('PARTIAL',40,now(),owner_id,broker_id) is null
  and public.capacity_reported_available_percent('PARTIAL',40,now(),owner_id,owner_id)=40,
  'driver_change_invalidates_estimate');
 perform pg_temp.space_assert(public.capacity_min_available_percent('{}'::jsonb) is null
  and public.capacity_min_available_percent('{"min_available_percent":40}'::jsonb)=40,
  'minimum_filter_is_optional_and_bounded');
 perform pg_temp.space_denied(
  'select public.capacity_min_available_percent(''{"min_available_percent":0}''::jsonb)',
  'INVALID_CAPACITY_FILTER');

 insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data)
 values(owner_id,'space-owner-'||owner_id||'@example.invalid',now(),'{}'),
       (broker_id,'space-broker-'||broker_id||'@example.invalid',now(),'{}');
 update public.profiles set role='DRIVER',active=true,drives_truck=true where id=owner_id;
 update public.profiles set role='SHIPPER',active=true where id=broker_id;
 insert into public.provider_profiles(id,user_id,business_name,handle)
 values(provider_id,owner_id,'Space test provider','space218-'||substr(owner_id::text,1,12));
 insert into public.company_pages(provider_profile_id,published) values(provider_id,true);
 perform public.accept_content_policy(owner_id,'2026-10-09');
 vehicle_id:=(public.create_provider_vehicle(owner_id,jsonb_build_object(
  'make','Isuzu','model','Space test','plate','SPACE-'||substr(owner_id::text,1,8),
  'cargo_configuration','Mini Box Truck','use_basis','OWNED'))->>'id')::uuid;
 perform public.update_fleet_driver_access(owner_id,jsonb_build_object(
  'driver_user_id',owner_id,'vehicle_id',vehicle_id,
  'can_manage_capacity',true,'can_manage_tracking',true));
 perform public.set_provider_vehicle_publication(owner_id,vehicle_id,'LIVE');
 select id into strict origin_ref from public.place_catalog where normalized_name='addis ababa' limit 1;
 select id into strict destination_ref from public.place_catalog where normalized_name='adama' limit 1;
 route_points:=jsonb_build_array(jsonb_build_object('place_ref',origin_ref),
  jsonb_build_object('place_ref',destination_ref));
 command:=jsonb_build_object('vehicle_id',vehicle_id,'status','PARTIAL',
  'visibility','OPEN','sharing_mode','BOTH','availability_geometry','ROUTE',
  'accepted_loads','PTL','current_route_places',route_points,
  'location_source','DEVICE_OBSCURED','approximate_lat',9.03,
  'approximate_lng',38.74,'location_precision_km',20);

 -- Older clients have no percent key. Storage compatibility is not a claim.
 signal_id:=public.publish_provider_capacity(owner_id,command);
 perform pg_temp.space_assert((select available_percent=50 and available_percent_reported_at is null
  from public.capacities where id=signal_id),'legacy_partial_stays_unreported');
 perform pg_temp.space_assert((select payload->>'available_percent' is null
  from public.public_capacity_page(jsonb_build_object('capacity_id',signal_id))
  limit 1),'legacy_public_projection_hides_50');
 perform pg_temp.space_assert(not exists(select 1 from public.public_capacity_page(
  jsonb_build_object('capacity_id',signal_id,'min_available_percent',1))),
  'legacy_partial_does_not_match_minimum');

 workspace_id:=(public.business_workspace_create(broker_id,jsonb_build_object(
  'name','Synthetic space broker','handle','space-broker-'||substr(broker_id::text,1,8),
  'kind','BROKER'))->>'id')::uuid;
 connection:=public.request_account_connection(owner_id,'BUSINESS',workspace_id);
 connection_id:=(connection->>'id')::uuid;
 perform public.decide_account_connection(broker_id,connection_id,'ACCEPT');
 perform public.grant_account_capacity_access(owner_id,connection_id,vehicle_id);

 signal_id:=public.publish_provider_capacity(owner_id,command||jsonb_build_object(
  'available_percent',40,'available_percent_reported_at','2000-01-01T00:00:00Z',
  'available_percent_reported_by',broker_id));
 select available_percent_reported_at,available_percent_reported_by,
  available_percent_reported_driver_id into strict report_time,report_actor,report_driver
 from public.capacities where id=signal_id;
 perform pg_temp.space_assert(report_time is not null and report_time<>'2000-01-01T00:00:00Z'::timestamptz
  and report_actor=owner_id and report_driver=owner_id,'server_owns_report_provenance');
 perform pg_temp.space_assert((select available_percent=40 from public.capacities where id=signal_id),
  'partial_40_saved');
 select payload into result from public.public_capacity_page(
  jsonb_build_object('capacity_id',signal_id,'min_available_percent',40)) limit 1;
 perform pg_temp.space_assert(result->>'available_percent'='40'
  and result->>'available_percent_reported_at' is not null,'public_reports_only_explicit_40');
 perform pg_temp.space_assert(not exists(select 1 from public.public_capacity_page(
  jsonb_build_object('capacity_id',signal_id,'min_available_percent',41))),
  'public_minimum_41_excludes_40');
 perform pg_temp.space_assert((select count(*)=1 from public.capacity_search_public_rows(
  jsonb_build_object('capacity_id',signal_id,'min_available_percent',40))),
  'public_vehicle_search_matches_40');
 perform pg_temp.space_assert(not exists(select 1 from public.capacity_search_public_rows(
  jsonb_build_object('capacity_id',signal_id,'min_available_percent',41))),
  'public_vehicle_search_excludes_41');
 perform pg_temp.space_assert((public.capacity_search_results(
  jsonb_build_object('capacity_id',signal_id,'provider','space218-'||substr(owner_id::text,1,12),
   'min_available_percent',40),'PUBLIC',null,null,1)->>'total')::integer=1,
  'public_provider_search_matches_40');
 perform pg_temp.space_assert((public.capacity_search_results(
  jsonb_build_object('capacity_id',signal_id,'provider','space218-'||substr(owner_id::text,1,12),
   'min_available_percent',41),'PUBLIC',null,null,1)->>'total')::integer=0,
  'public_provider_search_excludes_41');
 perform pg_temp.space_assert((select coalesce(sum((payload->>'count')::integer),0)=1
  from public.public_capacity_clusters(jsonb_build_object('capacity_id',signal_id,
    'min_available_percent',40,'viewport',jsonb_build_array(37,8,40,10)))),
  'cluster_matches_public_page');
 select payload into result from public.account_capacity_filtered_page(
  broker_id,private_digest,null,null,12,
  jsonb_build_object('capacity_id',signal_id,'min_available_percent',40)) limit 1;
 perform pg_temp.space_assert(result->>'available_percent'='40',
  'authorized_private_account_matches_reported_40');
 perform pg_temp.space_assert(not exists(select 1 from public.account_capacity_filtered_page(
  broker_id,private_digest,null,null,12,
  jsonb_build_object('capacity_id',signal_id,'min_available_percent',41))),
  'private_minimum_41_excludes_40');
 perform pg_temp.space_assert((select count(*)=1 from public.business_capacity_filtered_page(
  broker_id,workspace_id,null,null,12,
  jsonb_build_object('capacity_id',signal_id,'min_available_percent',40))),
  'business_private_page_matches_40');
 perform pg_temp.space_assert(not exists(select 1 from public.business_capacity_filtered_page(
  broker_id,workspace_id,null,null,12,
  jsonb_build_object('capacity_id',signal_id,'min_available_percent',41))),
  'business_private_page_excludes_41');
 select capacity into strict result
 from jsonb_array_elements((public.provider_capacity_workspace(owner_id)->'capacities')) capacity
 where capacity->>'id'=signal_id::text;
 perform pg_temp.space_assert(result->>'available_percent'='40'
  and result->>'available_percent_reported_at' is not null,
  'workspace_projects_reported_40');

 -- An unrelated save by an old client and an unchanged new-client value keep age.
 signal_id:=public.publish_provider_capacity(owner_id,command);
 perform pg_temp.space_assert((select available_percent=40
  and available_percent_reported_at=report_time and available_percent_reported_by=owner_id
  from public.capacities where id=signal_id),'omitted_value_preserves_original_report');
 signal_id:=public.publish_provider_capacity(owner_id,command||'{"available_percent":40}'::jsonb);
 perform pg_temp.space_assert((select available_percent_reported_at=report_time
  from public.capacities where id=signal_id),'unchanged_value_does_not_refresh_age');

 -- Explicit clear leaves a compatible numeric storage value but no visible estimate.
 signal_id:=public.publish_provider_capacity(owner_id,command||'{"available_percent":null}'::jsonb);
 perform pg_temp.space_assert((select available_percent=50 and available_percent_reported_at is null
  from public.capacities where id=signal_id),'explicit_clear_hides_legacy_storage');
 perform pg_temp.space_assert(not exists(select 1 from public.account_capacity_filtered_page(
  broker_id,private_digest,null,null,12,
  jsonb_build_object('capacity_id',signal_id,'min_available_percent',1))),
  'private_minimum_excludes_cleared');

 perform pg_temp.space_denied(format(
  'select public.publish_provider_capacity(%L,%L::jsonb)',owner_id,
  (command||'{"available_percent":0}'::jsonb)::text),'INVALID_AVAILABLE_PERCENT');
 perform pg_temp.space_denied(format(
  'select public.publish_provider_capacity(%L,%L::jsonb)',owner_id,
  (command||'{"available_percent":100}'::jsonb)::text),'INVALID_AVAILABLE_PERCENT');
 perform pg_temp.space_denied(format(
  'select public.publish_provider_capacity(%L,%L::jsonb)',owner_id,
  (command||'{"available_percent":"40"}'::jsonb)::text),'INVALID_AVAILABLE_PERCENT');

 command:=command||'{"status":"EMPTY","accepted_loads":"BOTH"}'::jsonb;
 signal_id:=public.publish_provider_capacity(owner_id,command);
 perform pg_temp.space_assert((select available_percent=100 and available_percent_reported_at is null
  from public.capacities where id=signal_id),'empty_100_without_report');
 perform pg_temp.space_assert((select payload->>'available_percent'='100'
  from public.public_capacity_page(jsonb_build_object(
   'capacity_id',signal_id,'min_available_percent',100)) limit 1),
  'empty_matches_100');
 perform pg_temp.space_denied(format(
  'select public.publish_provider_capacity(%L,%L::jsonb)',owner_id,
  (command||'{"available_percent":40}'::jsonb)::text),'INVALID_AVAILABLE_PERCENT');

 -- A Private current signal can be discovered through a separate Preferred
 -- offer, but its space estimate must not leak to the public map or filter.
 perform public.add_provider_regular_capacity(owner_id,jsonb_build_object(
  'vehicle_id',vehicle_id,'expected_driver_id',owner_id,'geometry','ROUTE',
  'route_places',route_points));
 command:=command||'{"status":"PARTIAL","accepted_loads":"PTL",
  "visibility":"PRIVATE","sharing_mode":"PRIVATE","available_percent":65}'::jsonb;
 signal_id:=public.publish_provider_capacity(owner_id,command);
 select payload into result from public.public_capacity_page(
  jsonb_build_object('capacity_id',signal_id)) limit 1;
 perform pg_temp.space_assert(result is null or (result->>'available_percent' is null
  and result->>'available_percent_reported_at' is null),
  'private_current_percent_hidden_when_preferred_is_public');
 perform pg_temp.space_assert(not exists(select 1 from public.public_capacity_page(
  jsonb_build_object('capacity_id',signal_id,'min_available_percent',1))),
  'public_minimum_cannot_use_private_current_signal');
 select payload into result from public.account_capacity_filtered_page(
  broker_id,private_digest,null,null,12,
  jsonb_build_object('capacity_id',signal_id,'min_available_percent',60)) limit 1;
 perform pg_temp.space_assert(result->>'available_percent'='65',
  'authorized_private_grant_sees_private_report');
 raise notice 'PASS: available-space report, legacy unknown, server provenance, public/private filters and privacy';
end $test$;

do $reassignment$
declare
 owner_id uuid:=gen_random_uuid();first_driver uuid:=gen_random_uuid();second_driver uuid:=gen_random_uuid();
 organization_id uuid:=gen_random_uuid();vehicle_id uuid;signal_id uuid;route_places jsonb;
 command jsonb;result jsonb;
begin
 insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values
 (owner_id,'space-fleet-'||owner_id||'@example.invalid',now(),'{}'),
 (first_driver,'space-driver-'||first_driver||'@example.invalid',now(),'{}'),
 (second_driver,'space-driver-'||second_driver||'@example.invalid',now(),'{}');
 update public.profiles set role='TRANSPORTER',active=true,drives_truck=false where id=owner_id;
 insert into public.organizations(id,name,handle,type)
 values(organization_id,'Synthetic space fleet','space-fleet-'||organization_id,'TRANSPORT_COMPANY');
 insert into public.organization_members(user_id,organization_id,membership_role)
 values(owner_id,organization_id,'OWNER');
 insert into public.company_pages(organization_id,published) values(organization_id,true);
 perform public.accept_content_policy(owner_id,'2026-10-09');
 perform public.fleet_register_driver(owner_id,first_driver,jsonb_build_object(
  'name','First space driver','email','space-driver-'||first_driver||'@example.invalid',
  'phone','+251900000011'));
 perform public.fleet_register_driver(owner_id,second_driver,jsonb_build_object(
  'name','Second space driver','email','space-driver-'||second_driver||'@example.invalid',
  'phone','+251900000012'));
 perform public.accept_content_policy(first_driver,'2026-10-09');
 perform public.accept_content_policy(second_driver,'2026-10-09');
 vehicle_id:=(public.create_provider_vehicle(owner_id,jsonb_build_object(
  'make','Isuzu','model','Space fleet','plate','SPACE-FLEET-'||substr(owner_id::text,1,8),
  'cargo_configuration','Mini Box Truck','use_basis','OWNED'))->>'id')::uuid;
 perform public.update_fleet_driver_access(owner_id,jsonb_build_object(
  'driver_user_id',first_driver,'vehicle_id',vehicle_id,
  'can_manage_capacity',true,'can_manage_tracking',true));
 perform public.set_provider_vehicle_publication(owner_id,vehicle_id,'LIVE');
 perform public.refresh_provider_capacity_location(first_driver,jsonb_build_object(
  'vehicle_id',vehicle_id,'approximate_lat',9.03,'approximate_lng',38.74,
  'location_precision_km',20));
 route_places:='[{"place_ref":"builtin:addis ababa"},{"place_ref":"builtin:adama"}]'::jsonb;
 command:=jsonb_build_object('vehicle_id',vehicle_id,'status','PARTIAL',
  'accepted_loads','PTL','availability_geometry','ROUTE','current_route_places',route_places,
  'location_source','PRESERVE_DRIVER','sharing_mode','BOTH');
 signal_id:=public.publish_provider_capacity(owner_id,command||'{"available_percent":40}'::jsonb);
 perform pg_temp.space_assert((select available_percent_reported_driver_id=first_driver
  from public.capacities where id=signal_id),'first_driver_reported_40');
 perform public.update_fleet_driver_access(owner_id,jsonb_build_object(
  'driver_user_id',second_driver,'vehicle_id',vehicle_id,
  'can_manage_capacity',true,'can_manage_tracking',true));
 perform pg_temp.space_assert(public.capacity_active_driver_id(vehicle_id)=second_driver,
  'second_driver_is_assigned');
 perform pg_temp.space_assert((select available_percent_reported_at is null
  and available_percent_reported_by is null from public.capacities where id=signal_id)
  and exists(select 1 from public.audit_logs where entity_id=signal_id
    and action='CAPACITY_SPACE_REPORT_INVALIDATED'
    and details->>'availablePercent'='40' and details->>'reportedAt' is not null),
  'assignment_clears_claim_and_audits_old_report');
 select payload into result from public.public_capacity_page(jsonb_build_object('capacity_id',signal_id)) limit 1;
 perform pg_temp.space_assert(result is null or (result->>'available_percent' is null
  and result->>'available_percent_reported_at' is null),'reassignment_hides_prior_report');
 perform pg_temp.space_assert(not exists(select 1 from public.public_capacity_page(
  jsonb_build_object('capacity_id',signal_id,'min_available_percent',1))),
  'reassignment_hides_filter_match');
 perform public.refresh_provider_capacity_location(second_driver,jsonb_build_object(
  'vehicle_id',vehicle_id,'approximate_lat',9.03,'approximate_lng',38.74,
  'location_precision_km',20));
 signal_id:=public.publish_provider_capacity(owner_id,command);
 perform pg_temp.space_assert((select available_percent=50 and available_percent_reported_at is null
  from public.capacities where id=signal_id),'new_driver_does_not_inherit_estimate');
 signal_id:=public.publish_provider_capacity(owner_id,command||'{"available_percent":60}'::jsonb);
 perform pg_temp.space_assert((select available_percent_reported_driver_id=second_driver
  and available_percent=60 from public.capacities where id=signal_id),
  'new_driver_can_report_new_estimate');
 update public.capacities set available_percent_reported_at='2000-01-01T00:00:00Z'
 where id=signal_id;
 perform pg_temp.space_assert((select available_percent_reported_at is null
  and available_percent_reported_by is null and available_percent_reported_driver_id is null
  from public.capacities where id=signal_id),
  'independent_timestamp_change_cannot_forge_provenance');
 signal_id:=public.publish_provider_capacity(owner_id,command||'{"available_percent":60}'::jsonb);
 update public.capacities set available_percent=61 where id=signal_id;
 perform pg_temp.space_assert((select available_percent_reported_at is null
  and available_percent_reported_by is null and available_percent_reported_driver_id is null
  from public.capacities where id=signal_id),
  'independent_percent_change_clears_provenance');
 signal_id:=public.publish_provider_capacity(owner_id,jsonb_build_object(
  'vehicle_id',vehicle_id,'status','OFF_DUTY'));
 perform pg_temp.space_assert((select available_percent=0 and available_percent_reported_at is null
  from public.capacities where id=signal_id),'off_duty_clears_estimate');
 signal_id:=public.publish_provider_capacity(owner_id,command);
 perform pg_temp.space_assert((select available_percent=50 and available_percent_reported_at is null
  from public.capacities where id=signal_id),'partial_after_off_duty_is_unknown');
 raise notice 'PASS: assigned-driver changes and duty changes invalidate available-space reports';
end $reassignment$;
rollback;
