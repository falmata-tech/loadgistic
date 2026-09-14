-- Isolated local database only. Synthetic fixtures and assertions roll back.
begin;
do $test$
declare actor uuid:=gen_random_uuid(); provider uuid:=gen_random_uuid(); org uuid:=gen_random_uuid();
  vehicle uuid; last_vehicle uuid; evidence_vehicle uuid; row jsonb; result jsonb; first_summary jsonb;
  ids uuid[]; seen uuid[]:='{}'; i integer; n integer;
begin
  insert into auth.users(id,email,raw_user_meta_data,raw_app_meta_data) values(actor,'fleet-paging-sql@example.invalid','{}','{}');
  insert into profiles(id,email,full_name,role,active) values(actor,'fleet-paging-sql@example.invalid','Paging test','DRIVER',true)
    on conflict(id) do update set full_name='Paging test',role='DRIVER',active=true;
  insert into provider_profiles(id,user_id,business_name,handle,city) values(provider,actor,'Paging test','paging-sql-'||substr(provider::text,1,8),'Addis Ababa');
  insert into company_pages(provider_profile_id,published) values(provider,true);
  for i in 1..106 loop
    vehicle:=gen_random_uuid();
    insert into vehicles(id,provider_profile_id,platform_number,label,category,make,model,cargo_configuration,active,plate)
      values(vehicle,provider,'PAGING-'||lpad(i::text,3,'0'),'Paging test','TRUCK','Test','Paging','Heavy rigid',i<>106,'PRIVATE-PLATE');
    if i=101 then last_vehicle:=vehicle;end if;
    if i=100 then evidence_vehicle:=vehicle;end if;
    if i<>105 then
      insert into capacities(provider_profile_id,vehicle_id,status,available_percent,visibility,location_area,location_updated_at,
        location_lat,location_lng,location_precision_km,location_source,accepts_full_load,accepts_partial_load,
        updated_by,updated_at,expires_at,market_status,availability_geometry,work_radius_km,
        current_route_origin,current_route_destination,current_origin_lat,current_origin_lng,current_destination_lat,current_destination_lng,current_route_points_json)
      values(provider,vehicle,case when i=104 then 'OFF_DUTY'::capacity_status else 'EMPTY'::capacity_status end,case when i=104 then 0 else 100 end,
        case when i=102 then 'PRIVATE'::capacity_visibility when i=103 then 'SAVED_PARTNERS'::capacity_visibility else 'OPEN'::capacity_visibility end,
        'Around Addis Ababa',now(),9.03,38.74,20,'DEVICE_OBSCURED',true,false,actor,now()-i*interval '1 second',now()+interval '1 day',
        case when i=104 then 'OFF_DUTY' else 'EMPTY' end,'ROUTE',30,'Addis Ababa','Bishoftu',9.03,38.74,8.75,38.99,
        '[{"label":"Addis Ababa","lat":9.03,"lng":38.74},{"label":"Bishoftu","lat":8.75,"lng":38.99}]');
    end if;
  end loop;
  insert into verification_requests(subject_type,subject_id,verification_type,document_name,storage_path,original_name,mime_type,status,submitted_by)
    values('VEHICLE',evidence_vehicle,'VEHICLE_OWNERSHIP','Synthetic paging evidence','synthetic-paging-proof','fixture.txt','text/plain','APPROVED',actor);
  for i in 1..9 loop
    result:=public_provider_fleet_page(null,provider,i);
    if (result->>'total')::int<>105 or (result->>'page_count')::int<>9 then raise exception 'WRONG_TOTAL';end if;
    if jsonb_array_length(result->'items')>12 then raise exception 'UNBOUNDED_PAGE';end if;
    if not (result->>'owner_operator')::boolean then raise exception 'PAGE_CHANGED_PROVIDER_TYPE';end if;
    if i=1 then first_summary:=result->'evidence';elsif result->'evidence'<>first_summary then raise exception 'PAGE_CHANGED_EVIDENCE';end if;
    ids:='{}';
    for row in select value from jsonb_array_elements(result->'items') loop
      if (row->>'id')::uuid=any(seen) then raise exception 'DUPLICATE_TRUCK';end if;
      seen:=array_append(seen,(row->>'id')::uuid);ids:=array_append(ids,(row->>'id')::uuid);
      if row ? 'plate' or row ? 'provider_profile_id' then raise exception 'PRIVATE_VEHICLE_FIELDS';end if;
    end loop;
    if i=9 then
      select count(*) into n from public_capacity_page(jsonb_build_object('provider_profile_id',provider,'vehicle_ids',to_jsonb(ids)),null,null,12);
      if n<>5 then raise exception 'LAST_PAGE_PUBLIC_CAPACITY_COUNT: %',n;end if;
      if not exists(select 1 from public_capacity_page(jsonb_build_object('provider_profile_id',provider,'vehicle_ids',to_jsonb(ids)),null,null,12) c
        where c.payload->>'vehicle_id'=last_vehicle::text) then raise exception 'TRUCK_BEYOND_96_LOST';end if;
    end if;
  end loop;
  -- A newer expired approval cannot be replaced by an older unexpired badge.
  insert into verification_requests(subject_type,subject_id,verification_type,document_name,storage_path,original_name,mime_type,status,submitted_by,reviewed_at,expires_on)
    values('VEHICLE',evidence_vehicle,'VEHICLE_OWNERSHIP','Synthetic newer evidence','synthetic-paging-proof-new','fixture.txt','text/plain','APPROVED',actor,now(),current_date-1);
  result:=public_provider_fleet_page(null,provider,1);
  if result->'evidence'->'document'->>'expires_on' is distinct from (current_date-1)::text then raise exception 'OLDER_OWNERSHIP_BADGE_REVIVED';end if;
  if result->'evidence' is distinct from public_provider_fleet_page(null,provider,9)->'evidence' then raise exception 'EXPIRED_EVIDENCE_PAGE_DRIFT';end if;
  delete from verification_requests where subject_id=evidence_vehicle;
  insert into verification_requests(subject_type,subject_id,related_vehicle_id,verification_type,document_name,storage_path,original_name,mime_type,status,submitted_by,reviewed_at)
    values('PROVIDER_PROFILE',provider,last_vehicle,'VEHICLE_AUTHORIZATION','Synthetic authorization','synthetic-paging-authorization','fixture.txt','text/plain','APPROVED',actor,now()-interval '1 day');
  result:=public_provider_fleet_page(null,provider,1);
  if (result->>'owner_operator')::boolean or result->'evidence'->>'vehicle_id'<>last_vehicle::text then raise exception 'SELF_MANAGED_EVIDENCE_MISSING';end if;
  insert into verification_requests(subject_type,subject_id,related_vehicle_id,verification_type,document_name,storage_path,original_name,mime_type,status,submitted_by,reviewed_at,expires_on)
    values('DRIVER',actor,last_vehicle,'VEHICLE_AUTHORIZATION','Synthetic newer authorization','synthetic-paging-authorization-new','fixture.txt','text/plain','APPROVED',actor,now(),current_date-1);
  result:=public_provider_fleet_page(null,provider,9);
  if result->'evidence'->'document'->>'expires_on' is distinct from (current_date-1)::text then raise exception 'OLDER_AUTHORIZATION_BADGE_REVIVED';end if;
  if cardinality(seen)<>105 then raise exception 'INCOMPLETE_FLEET';end if;
  if public_provider_fleet_page(null,provider,2147483647)->>'page'<>'9' then raise exception 'PAGE_NOT_CLAMPED';end if;
  if public_provider_fleet_page(null,provider,-1)->>'page'<>'1' then raise exception 'NEGATIVE_PAGE';end if;
  if exists(select 1 from public_capacity_page(jsonb_build_object('vehicle_ids','[]'::jsonb),null,null,12)) then raise exception 'EMPTY_SCOPE_BROADENED';end if;
  update profiles set active=false where id=actor;
  if exists(select 1 from public_capacity_page(jsonb_build_object('provider_profile_id',provider,'vehicle_ids',to_jsonb(ids)),null,null,12)) then raise exception 'INACTIVE_DRIVER_CAPACITY';end if;
  update profiles set active=true where id=actor;
  update company_pages set published=false where provider_profile_id=provider;
  if public_provider_fleet_page(null,provider,1) is not null then raise exception 'UNPUBLISHED_FLEET';end if;
  if exists(select 1 from public_capacity_page(jsonb_build_object('provider_profile_id',provider,'vehicle_ids',to_jsonb(ids)),null,null,12)) then raise exception 'UNPUBLISHED_CAPACITY';end if;
  if public_provider_fleet_page(null,gen_random_uuid(),1) is not null then raise exception 'UNKNOWN_PROVIDER';end if;
  begin perform public_provider_fleet_page(org,provider,1);raise exception 'BOTH_SCOPES_ACCEPTED';exception when others then if sqlerrm<>'INVALID_PROVIDER_SCOPE' then raise;end if;end;
  begin perform public_provider_fleet_page(null,null,1);raise exception 'NO_SCOPE_ACCEPTED';exception when others then if sqlerrm<>'INVALID_PROVIDER_SCOPE' then raise;end if;end;
  insert into organizations(id,name,handle,type) values(org,'Company paging','paging-org-'||substr(org::text,1,8),'TRANSPORT_COMPANY');
  insert into company_pages(organization_id,published) values(org,true);
  result:=public_provider_fleet_page(org,null,1);
  if result->>'total'<>'0' or jsonb_array_length(result->'items')<>0 then raise exception 'CROSS_PROVIDER_OR_EMPTY_LEAK';end if;
  insert into vehicles(organization_id,label,category,make,model,cargo_configuration)
    select org,'Company truck','TRUCK','Test','Company','Heavy rigid' from generate_series(1,13);
  result:=public_provider_fleet_page(org,null,2);
  if result->>'total'<>'13' or jsonb_array_length(result->'items')<>1 then raise exception 'COMPANY_PAGING';end if;
  if (result->>'owner_operator')::boolean or result->'evidence'<>'null'::jsonb then raise exception 'COMPANY_EVIDENCE_LEAK';end if;
  if has_function_privilege('anon','public.public_provider_fleet_page(uuid,uuid,integer)','execute')
    or has_function_privilege('authenticated','public.public_provider_fleet_page(uuid,uuid,integer)','execute') then raise exception 'BROWSER_RPC_ACCESS';end if;
end $test$;
rollback;
