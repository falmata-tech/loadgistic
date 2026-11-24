-- FEAT-CAP-001 / FEAT-GEO-001. Synthetic, rollback-only.
begin;
set local search_path=public,extensions,pg_temp;
set local statement_timeout='90s';

create function pg_temp.journey_assert(ok boolean,label text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'JOURNEY244_ASSERT: %',label;end if;end $$;
create function pg_temp.journey_denied(command text,expected text) returns void language plpgsql as $$
begin
  begin execute command;exception when others then
    if sqlerrm=expected then return;end if;
    raise;
  end;
  raise exception 'JOURNEY244_DENIAL_MISSING: %',expected;
end $$;

do $test$
declare
 owner_id uuid:=gen_random_uuid();broker_id uuid:=gen_random_uuid();stranger_id uuid:=gen_random_uuid();
 provider_id uuid:=gen_random_uuid();vehicle_id uuid;workspace_id uuid;connection_id uuid;
 signal_id uuid;origin_ref text;destination_ref text;route_points jsonb;
 command jsonb;partial_command jsonb;private_digest text:=encode(gen_random_bytes(32),'hex');
 origin_lat numeric; origin_lng numeric; destination_lat numeric; destination_lng numeric;
 exact_query jsonb; endpoints jsonb; timed jsonb; result jsonb; connection jsonb;
 departure constant text:='2027-02-03T04:30:00.000Z';
 arrival constant text:='2027-02-03T08:00:00.000Z';
begin
 perform pg_temp.journey_assert(not has_function_privilege('anon',
  'public.capacity_journey_timestamp(text)','EXECUTE') and not has_function_privilege('authenticated',
  'public.capacity_journey_matches(text,jsonb,timestamptz,timestamptz,jsonb)','EXECUTE'),
  'helpers stay private');
  insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data)
 values(owner_id,'journey-owner-'||owner_id||'@example.invalid',now(),'{}'),
       (broker_id,'journey-broker-'||broker_id||'@example.invalid',now(),'{}'),
       (stranger_id,'journey-stranger-'||stranger_id||'@example.invalid',now(),'{}');
 update public.profiles set role='DRIVER',active=true,drives_truck=true where id=owner_id;
 update public.profiles set role='SHIPPER',active=true where id=broker_id;
 insert into public.provider_profiles(id,user_id,business_name,handle)
 values(provider_id,owner_id,'Journey test provider','journey244-'||substr(owner_id::text,1,12));
 insert into public.company_pages(provider_profile_id,published) values(provider_id,true);
 perform public.accept_content_policy(owner_id,'2026-10-09');
 vehicle_id:=(public.create_provider_vehicle(owner_id,jsonb_build_object(
  'make','Isuzu','model','Journey test','plate','JOURNEY-'||substr(owner_id::text,1,8),
  'cargo_configuration','Mini Box Truck','use_basis','OWNED'))->>'id')::uuid;
 perform public.update_fleet_driver_access(owner_id,jsonb_build_object(
  'driver_user_id',owner_id,'vehicle_id',vehicle_id,
  'can_manage_capacity',true,'can_manage_tracking',true));
 perform public.set_provider_vehicle_publication(owner_id,vehicle_id,'LIVE');
 select id into strict origin_ref from public.place_catalog where normalized_name='addis ababa' limit 1;
 select id into strict destination_ref from public.place_catalog where normalized_name='adama' limit 1;
 route_points:=jsonb_build_array(jsonb_build_object('place_ref',origin_ref),
  jsonb_build_object('place_ref',destination_ref));
 command:=jsonb_build_object('vehicle_id',vehicle_id,'status','EMPTY',
  'visibility','OPEN','sharing_mode','BOTH','availability_geometry','ROUTE',
  'accepted_loads','BOTH','current_route_places',route_points,
  'location_source','DEVICE_OBSCURED','approximate_lat',9.03,
  'approximate_lng',38.74,'location_precision_km',20);

 command:=command||jsonb_build_object('journey_start_at',departure,'journey_end_at',arrival);
 signal_id:=public.publish_provider_capacity(owner_id,command);
 select latitude,longitude into strict origin_lat,origin_lng from public.place_catalog where id=origin_ref;
 select latitude,longitude into strict destination_lat,destination_lng from public.place_catalog where id=destination_ref;
 endpoints:=jsonb_build_object('origin_lat',origin_lat,'origin_lng',origin_lng,
  'destination_lat',destination_lat,'destination_lng',destination_lng,'origin_radius_km',5,'destination_radius_km',5);
 timed:=jsonb_build_object('depart_after',departure,'arrive_by',arrival);
 exact_query:=endpoints||timed||jsonb_build_object('capacity_id',signal_id);
 select payload into strict result from public.public_capacity_page(exact_query);
 perform pg_temp.journey_assert(
  (result->>'journey_start_at')::timestamptz=departure::timestamptz
  and (result->>'journey_end_at')::timestamptz=arrival::timestamptz,
  'map publishes both dates and accepts exact filter boundaries');
 perform pg_temp.journey_assert(
  exists(select 1 from public.capacity_search_public_rows(exact_query))
  and exists(select 1 from public.capacity_search_public_profile_rows(exact_query)),
  'truck search and profile search apply same date-filtered route');
 perform pg_temp.journey_assert(
  exists(select 1 from public.public_capacity_clusters(exact_query||'{"viewport":[35,6,43,12]}'))
  and not exists(select 1 from public.public_capacity_clusters(
    exact_query||'{"viewport":[35,6,43,12],"arrive_by":"2027-02-03T07:59:00.000Z"}')),
  'cluster counts use the same timed eligibility');
 perform pg_temp.journey_assert(
  not exists(select 1 from public.public_capacity_page(exact_query||'{"depart_after":"2027-02-03T04:31:00.000Z"}'))
  and not exists(select 1 from public.capacity_search_public_rows(exact_query||'{"arrive_by":"2027-02-03T07:59:00.000Z"}')),
  'both boundaries exclude out-of-window routes');
 perform pg_temp.journey_assert(not exists(select 1 from public.public_capacity_page(
  (exact_query-'arrive_by')||jsonb_build_object('destination_lat',14,'destination_lng',43))),
  'a date match cannot rescue an endpoint mismatch');
 perform pg_temp.journey_denied(format('select public.publish_provider_capacity(%L,%L)',stranger_id,command),'FORBIDDEN');
 perform pg_temp.journey_denied(format('select public.publish_provider_capacity(%L,%L)',owner_id,
   command||'{"journey_end_at":"2027-02-03T04:29:00.000Z"}'::jsonb),'INVALID_CAPACITY_JOURNEY_RANGE');
 perform pg_temp.journey_denied(format('select public.publish_provider_capacity(%L,%L)',owner_id,
   command||'{"journey_end_at":"2027-02-30T04:29:00.000Z"}'::jsonb),'INVALID_CAPACITY_JOURNEY_TIME');
 perform pg_temp.journey_denied(format('select public.publish_provider_capacity(%L,%L)',owner_id,
   command||'{"availability_geometry":"RADIUS"}'::jsonb),'PLANNED_ROUTE_REQUIRED');
 partial_command:=(command-'journey_start_at'-'journey_end_at')
  ||'{"status":"PARTIAL","available_percent":45,"accepted_loads":"PTL"}'::jsonb;
 perform pg_temp.journey_denied(format('select public.publish_provider_capacity(%L,%L)',owner_id,
  partial_command-'current_route_places'),'CAPACITY_ROUTE_POINTS_REQUIRED');
 perform pg_temp.journey_denied(format('select public.publish_provider_capacity(%L,%L)',owner_id,
  partial_command||jsonb_build_object('current_route_places',jsonb_build_array(route_points->0))),
  'CAPACITY_ROUTE_POINTS_REQUIRED');
 perform pg_temp.journey_denied(format('select public.publish_provider_capacity(%L,%L)',owner_id,
  partial_command||jsonb_build_object('current_route_places',jsonb_build_array(route_points->0,route_points->0))),
  'CAPACITY_PLACE_DUPLICATE');
 perform pg_temp.journey_assert(exists(select 1 from public.public_capacity_page(exact_query)),
  'failed publication keeps the last saved signal and journey');
 workspace_id:=(public.business_workspace_create(broker_id,jsonb_build_object(
  'name','Journey broker','handle','journey-broker-'||substr(broker_id::text,1,8),'kind','BROKER'))->>'id')::uuid;
 connection:=public.request_account_connection(owner_id,'BUSINESS',workspace_id);
 connection_id:=(connection->>'id')::uuid;
 perform public.decide_account_connection(broker_id,connection_id,'ACCEPT');
 perform public.grant_account_capacity_access(owner_id,connection_id,vehicle_id);
 signal_id:=public.publish_provider_capacity(owner_id,(command-'journey_start_at'-'journey_end_at')
  ||'{"sharing_mode":"PRIVATE","visibility":"PRIVATE"}');
 exact_query:=endpoints||timed||jsonb_build_object('capacity_id',signal_id);
 perform pg_temp.journey_assert(not exists(select 1 from public.public_capacity_page(exact_query)),
  'private route absent from public results');
 select payload into strict result from public.business_capacity_rows(broker_id,workspace_id,null,null,30,exact_query)
  where payload->>'id'=signal_id::text;
 perform pg_temp.journey_assert((result->>'journey_start_at')::timestamptz=departure::timestamptz
  and (result->>'journey_end_at')::timestamptz=arrival::timestamptz,
  'authorized broker sees private timing after an older share-only write');
 perform pg_temp.journey_assert(not exists(select 1 from public.business_capacity_rows(
  stranger_id,workspace_id,null,null,30,exact_query)), 'unrelated account receives no business capacity or dates');
 perform public.decide_account_connection(owner_id,connection_id,'REVOKE');
 perform pg_temp.journey_assert(not exists(select 1 from public.business_capacity_rows(
  broker_id,workspace_id,null,null,30,exact_query)), 'revocation removes access to route dates');
 signal_id:=public.publish_provider_capacity(owner_id,command||'{"journey_start_at":null}');
 perform pg_temp.journey_assert((select journey_start_at is null and journey_end_at=arrival::timestamptz
  from public.capacities where id=signal_id),'each time can be cleared independently');
 signal_id:=public.publish_provider_capacity(owner_id,command-'journey_start_at'-'journey_end_at'
  || jsonb_build_object('current_route_places',jsonb_build_array(route_points->1,route_points->0)));
 perform pg_temp.journey_assert((select journey_start_at is null and journey_end_at is null
  from public.capacities where id=signal_id),'different route cannot inherit old times');
 perform pg_temp.journey_assert(not exists(select 1 from public.public_capacity_page(
  timed||jsonb_build_object('capacity_id',signal_id))),'undated route excluded from timed results');
 signal_id:=public.publish_provider_capacity(owner_id,partial_command);
 perform pg_temp.journey_assert((select market_status='PARTIAL' and available_percent=45
  and jsonb_array_length(current_route_points_json)=2 and journey_start_at is null and journey_end_at is null
  from public.capacities where id=signal_id),'Partial publishes with a valid route and optional dates');
end $test$;
rollback;
