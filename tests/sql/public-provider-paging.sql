-- Isolated local database only. Synthetic fixtures and assertions roll back.
begin;
-- Exact relationship reviews are deliberate test commands on our own subjects.
-- No seeded document or provider receives an invented approval.
create function pg_temp.paging_review_fixture(owner_id uuid,truck_id uuid,reviewer_id uuid,fact text,expiry date default null)
returns uuid language plpgsql as $$
declare source_id uuid;context_revision text;review_command jsonb;
begin
  source_id:=public.submit_managed_verification(owner_id,jsonb_build_object('subject_type','VEHICLE','subject_id',truck_id,
    'verification_type',case when fact='OWNERSHIP' then 'VEHICLE_OWNERSHIP' else 'VEHICLE_AUTHORIZATION' end,
    'document_name','Private synthetic paging proof','storage_path','supabase://verification/verification/paging-private-proof-'||gen_random_uuid()||'.pdf',
    'original_name','paging.pdf','mime_type','application/pdf','expires_on',expiry));
  perform public.review_managed_verification(reviewer_id,source_id,'APPROVED','Reviewed synthetic paging evidence.');
  context_revision:=public.managed_provider_authority_review_context(reviewer_id,array[source_id])->0->>'contextRevision';
  review_command:=jsonb_build_object('fact_kind',fact,'expires_on',expiry,'review_note','Matched exact synthetic paging provider.','context_revision',context_revision);
  return public.confirm_provider_vehicle_authority(reviewer_id,source_id,review_command);
end $$;
do $test$
declare actor uuid:=gen_random_uuid(); provider uuid:=gen_random_uuid(); org uuid:=gen_random_uuid();company_owner uuid:=gen_random_uuid();
  vehicle uuid; last_vehicle uuid; evidence_vehicle uuid; row jsonb; result jsonb; first_summary jsonb;
  ids uuid[]; seen uuid[]:='{}';driver_ids uuid[]:='{}';fleet_driver uuid; i integer; n integer;
  admin_id uuid;qualifying_vehicle uuid;review_id uuid;replacement_review uuid;source_id uuid;older_source uuid;context_revision text;
begin
  select id into strict admin_id from profiles where active and role='ADMIN' order by id limit 1;
  insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data,raw_app_meta_data) values(actor,'fleet-paging-sql@example.invalid',clock_timestamp(),'{}','{}');
  insert into profiles(id,email,full_name,role,active) values(actor,'fleet-paging-sql@example.invalid','Paging test','DRIVER',true)
    on conflict(id) do update set full_name='Paging test',role='DRIVER',active=true;
  update profiles set drives_truck=true where id=actor;
  insert into provider_profiles(id,user_id,business_name,handle,city,public_visibility) values(provider,actor,'Paging test','paging-sql-'||substr(provider::text,1,8),'Addis Ababa','PUBLIC');
  insert into company_pages(provider_profile_id,published) values(provider,true);
  perform accept_content_policy(actor,'2026-10-09');
  -- Provider kinds share the same public authority contract and paging rules.
  insert into organizations(id,name,handle,type,public_visibility) values(org,'Large paging fleet','large-paging-'||org,'TRANSPORT_COMPANY','PUBLIC');
  insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data,raw_app_meta_data)
   values(company_owner,company_owner||'@example.invalid',clock_timestamp(),'{}','{}');
  update profiles set role='TRANSPORTER',active=true,drives_truck=false where id=company_owner;
  insert into organization_members(organization_id,user_id,membership_role) values(org,company_owner,'OWNER');
  insert into company_pages(organization_id,published) values(org,true);
  perform accept_content_policy(company_owner,'2026-10-09');
  for i in 1..106 loop
    vehicle:=gen_random_uuid();
    insert into vehicles(id,organization_id,platform_number,label,category,make,model,cargo_configuration,active,plate,use_basis)
      values(vehicle,org,'PAGING-'||lpad(i::text,3,'0'),'Paging test','TRUCK','Test','Paging','Heavy rigid',i<>106,'PRIVATE-PLATE','OWNED');
    if i=1 then
      qualifying_vehicle:=vehicle;
      perform pg_temp.paging_review_fixture(company_owner,vehicle,admin_id,'OWNERSHIP');
    end if;
    -- The retired106 fixture stays Draft, unassigned and without a new signal.
    if i<>106 then
      perform set_provider_vehicle_publication(company_owner,vehicle,'LIVE');
      fleet_driver:=gen_random_uuid();driver_ids:=array_append(driver_ids,fleet_driver);
      insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data,raw_app_meta_data)
        values(fleet_driver,fleet_driver||'@example.invalid',clock_timestamp(),'{}','{}');
      perform fleet_accept_invitation(fleet_driver,fleet_invite_driver(company_owner,jsonb_build_object(
        'email',fleet_driver||'@example.invalid','name','Paging driver','phone','+251900000001')));
      perform accept_content_policy(fleet_driver,'2026-10-09');
      perform update_fleet_driver_access(company_owner,jsonb_build_object('driver_user_id',fleet_driver,'vehicle_id',vehicle,
        'can_manage_capacity',true,'can_manage_tracking',true));
    end if;
    insert into vehicle_capacity_sharing(vehicle_id,mode) values(vehicle,case when i in(102,103) then 'PRIVATE' else 'PUBLIC' end);
    if i=101 then last_vehicle:=vehicle;end if;
    if i=100 then evidence_vehicle:=vehicle;end if;
    if i not in(105,106) then
      insert into capacities(provider_organization_id,vehicle_id,status,available_percent,visibility,location_area,location_updated_at,
        location_lat,location_lng,location_precision_km,location_source,accepts_full_load,accepts_partial_load,
        updated_by,updated_at,expires_at,market_status,availability_geometry,work_radius_km,
        current_route_origin,current_route_destination,current_origin_lat,current_origin_lng,current_destination_lat,current_destination_lng,current_route_points_json)
      values(org,vehicle,case when i=104 then 'OFF_DUTY'::capacity_status else 'EMPTY'::capacity_status end,case when i=104 then 0 else 100 end,
        case when i=102 then 'PRIVATE'::capacity_visibility when i=103 then 'SAVED_PARTNERS'::capacity_visibility else 'OPEN'::capacity_visibility end,
        'Around Addis Ababa',clock_timestamp(),9.03,38.74,20,'DEVICE_OBSCURED',true,false,fleet_driver,clock_timestamp(),now()+interval '1 day',
        case when i=104 then 'OFF_DUTY' else 'EMPTY' end,'ROUTE',30,'Addis Ababa','Bishoftu',9.03,38.74,8.75,38.99,
        '[{"label":"Addis Ababa","lat":9.03,"lng":38.74},{"label":"Bishoftu","lat":8.75,"lng":38.99}]');
    end if;
  end loop;
  for i in 1..9 loop
    result:=public_provider_fleet_page(org,null,i);
    if (result->>'total')::int<>105 or (result->>'page_count')::int<>9 then raise exception 'WRONG_TOTAL';end if;
    if jsonb_array_length(result->'items')>12 then raise exception 'UNBOUNDED_PAGE';end if;
    if result->'authority_summary'->>'ownershipVerified' is distinct from '1' or result->'authority_summary'->>'notYetVerified' is distinct from '104'
      then raise exception 'PAGE_CHANGED_PROVIDER_TYPE';end if;
    if i=1 then first_summary:=result->'authority_summary';elsif result->'authority_summary' is distinct from first_summary then raise exception 'PAGE_CHANGED_EVIDENCE';end if;
    ids:='{}';
    for row in select value from jsonb_array_elements(result->'items') loop
      if (row->>'id')::uuid=any(seen) then raise exception 'DUPLICATE_TRUCK';end if;
      seen:=array_append(seen,(row->>'id')::uuid);ids:=array_append(ids,(row->>'id')::uuid);
      if row ? 'plate' or row ? 'provider_profile_id' then raise exception 'PRIVATE_VEHICLE_FIELDS';end if;
      if (row->'authority'->'ownership'->>'verified')::boolean is distinct from ((row->>'id')::uuid=qualifying_vehicle)
        then raise exception 'QUALIFIER_BADGE_INHERITED_BY_OTHER_TRUCK';end if;
      if row::text like '%paging-private-proof%' or row::text like '%Private synthetic paging proof%'
        then raise exception 'PRIVATE_AUTHORITY_SOURCE_EXPOSED';end if;
    end loop;
    if i=9 then
      select count(*) into n from public_capacity_page(jsonb_build_object('provider_organization_id',org,'vehicle_ids',to_jsonb(ids)),null,null,12);
      if n<>5 then raise exception 'LAST_PAGE_PUBLIC_CAPACITY_COUNT: %',n;end if;
      if not exists(select 1 from public_capacity_page(jsonb_build_object('provider_organization_id',org,'vehicle_ids',to_jsonb(ids)),null,null,12) c
        where c.payload->>'vehicle_id'=last_vehicle::text) then raise exception 'TRUCK_BEYOND_96_LOST';end if;
    end if;
  end loop;
  -- Keep exact ownership/use-permission precedence on a single Live truck.
  evidence_vehicle:=gen_random_uuid();last_vehicle:=evidence_vehicle;
  insert into vehicles(id,provider_profile_id,platform_number,label,category,make,model,cargo_configuration,plate,use_basis)
   values(evidence_vehicle,provider,'PAGING-INDEPENDENT','Single paging driver','TRUCK','Test','Single','Heavy rigid','PRIVATE-SINGLE','OWNED');
  perform update_fleet_driver_access(actor,jsonb_build_object('driver_user_id',actor,'vehicle_id',evidence_vehicle,'can_manage_capacity',true,'can_manage_tracking',true));
  perform set_provider_vehicle_publication(actor,evidence_vehicle,'LIVE');
  source_id:=submit_managed_verification(actor,jsonb_build_object('subject_type','VEHICLE','subject_id',evidence_vehicle,
    'verification_type','VEHICLE_OWNERSHIP','document_name','Private synthetic paging title',
    'storage_path','supabase://verification/verification/paging-private-proof-original.pdf','original_name','paging.pdf','mime_type','application/pdf'));
  perform review_managed_verification(admin_id,source_id,'APPROVED','Reviewed synthetic personal title.');
  result:=public_provider_fleet_page(null,provider,1);
  if result->'authority_summary'->>'ownershipVerified' is distinct from '0' or (result->'items'->0->'authority'->'ownership'->>'verified')::boolean is distinct from false
    then raise exception 'GENERIC_APPROVAL_PROMOTED_OWNERSHIP';end if;
  context_revision:=managed_provider_authority_review_context(admin_id,array[source_id])->0->>'contextRevision';
  review_id:=confirm_provider_vehicle_authority(admin_id,source_id,jsonb_build_object('fact_kind','OWNERSHIP',
    'review_note','Matched exact synthetic personal title.','context_revision',context_revision));
  result:=public_provider_fleet_page(null,provider,1);
  if result->>'total'<>'1' or result->'authority_summary'->>'ownershipVerified' is distinct from '1'
    or (result->'items'->0->'authority'->'ownership'->>'verified')::boolean is distinct from true then raise exception 'SINGLE_TRUCK_OWNERSHIP_EVIDENCE_MISSING';end if;
  -- Superseded reviews are deliberately revoked, not erased. Expiring the
  -- replacement source must not revive the retained older Approved document.
  older_source:=source_id;
  perform revoke_provider_vehicle_authority(admin_id,review_id,'Replaced synthetic title review.');
  replacement_review:=pg_temp.paging_review_fixture(actor,evidence_vehicle,admin_id,'OWNERSHIP',current_date+30);
  select source_request_id into strict source_id from provider_vehicle_authority_reviews where id=replacement_review;
  update verification_requests set expires_on=current_date-1 where id=source_id;
  result:=public_provider_fleet_page(null,provider,1);
  if result->'authority_summary'->>'ownershipVerified' is distinct from '0' or result->'authority_summary'->>'notYetVerified' is distinct from '1'
    or (result->'items'->0->'authority'->'ownership'->>'verified')::boolean is distinct from false
    or not exists(select 1 from verification_requests where id=older_source and status='APPROVED') then raise exception 'OLDER_OWNERSHIP_BADGE_REVIVED';end if;
  if result->'authority_summary' is distinct from public_provider_fleet_page(null,provider,9)->'authority_summary' then raise exception 'EXPIRED_EVIDENCE_PAGE_DRIFT';end if;
  review_id:=pg_temp.paging_review_fixture(actor,evidence_vehicle,admin_id,'PERMISSION',current_date+30);
  result:=public_provider_fleet_page(null,provider,1);
  if result->'authority_summary'->>'permissionVerified' is distinct from '1' or result->'authority_summary'->>'ownershipVerified' is distinct from '0'
    or (result->'items'->0->'authority'->'permission'->>'verified')::boolean is distinct from true
    or (result->'items'->0->'authority'->>'qualifiesProvider')::boolean is distinct from false then raise exception 'SELF_MANAGED_EVIDENCE_MISSING';end if;
  select source_request_id into strict older_source from provider_vehicle_authority_reviews where id=review_id;
  perform revoke_provider_vehicle_authority(admin_id,review_id,'Replaced synthetic permission review.');
  replacement_review:=pg_temp.paging_review_fixture(actor,evidence_vehicle,admin_id,'PERMISSION',current_date+30);
  select source_request_id into strict source_id from provider_vehicle_authority_reviews where id=replacement_review;
  update verification_requests set expires_on=current_date-1 where id=source_id;
  result:=public_provider_fleet_page(null,provider,9);
  if result->'authority_summary'->>'permissionVerified' is distinct from '0' or result->'authority_summary'->>'notYetVerified' is distinct from '1'
    or (result->'items'->0->'authority'->'permission'->>'verified')::boolean is distinct from false
    or not exists(select 1 from verification_requests where id=older_source and status='APPROVED') then raise exception 'OLDER_AUTHORIZATION_BADGE_REVIVED';end if;
  -- A Driver's separate permission source never certifies the provider itself.
  source_id:=submit_managed_verification(actor,jsonb_build_object('subject_type','DRIVER','subject_id',actor,
    'related_vehicle_id',evidence_vehicle,'verification_type','VEHICLE_AUTHORIZATION','expires_on',current_date+30,
    'document_name','Private synthetic Driver permission','storage_path','supabase://verification/verification/paging-private-proof-driver.pdf',
    'original_name','driver.pdf','mime_type','application/pdf'));
  perform review_managed_verification(admin_id,source_id,'APPROVED','Reviewed synthetic Driver permission.');
  begin
    perform confirm_provider_vehicle_authority(admin_id,source_id,jsonb_build_object('fact_kind','PERMISSION','expires_on',current_date+30,
      'review_note','Driver evidence cannot certify the provider.'));
    raise exception 'DRIVER_PERMISSION_PROMOTED_PROVIDER';
  exception when raise_exception then if sqlerrm<>'AUTHORITY_SOURCE_MISMATCH' then raise;end if;end;
  result:=public_provider_fleet_page(null,provider,1);
  if result->'authority_summary'->>'permissionVerified' is distinct from '0' then raise exception 'DRIVER_PERMISSION_COUNTED_FOR_PROVIDER';end if;
  if cardinality(seen)<>105 then raise exception 'INCOMPLETE_FLEET';end if;
  if public_provider_fleet_page(org,null,2147483647)->>'page'<>'9' then raise exception 'PAGE_NOT_CLAMPED';end if;
  if public_provider_fleet_page(null,provider,-1)->>'page'<>'1' then raise exception 'NEGATIVE_PAGE';end if;
  if exists(select 1 from public_capacity_page(jsonb_build_object('vehicle_ids','[]'::jsonb),null,null,12)) then raise exception 'EMPTY_SCOPE_BROADENED';end if;
  update profiles set active=false where id=any(driver_ids);
  if exists(select 1 from public_capacity_page(jsonb_build_object('provider_organization_id',org,'vehicle_ids',to_jsonb(ids)),null,null,12)) then raise exception 'INACTIVE_DRIVER_CAPACITY';end if;
  update profiles set active=true where id=any(driver_ids);
  update company_pages set published=false where provider_profile_id=provider;
  if public_provider_fleet_page(null,provider,1) is not null then raise exception 'UNPUBLISHED_FLEET';end if;
  if exists(select 1 from public_capacity_page(jsonb_build_object('provider_profile_id',provider,'vehicle_ids',to_jsonb(ids)),null,null,12)) then raise exception 'UNPUBLISHED_CAPACITY';end if;
  if public_provider_fleet_page(null,gen_random_uuid(),1) is not null then raise exception 'UNKNOWN_PROVIDER';end if;
  begin perform public_provider_fleet_page(org,provider,1);raise exception 'BOTH_SCOPES_ACCEPTED';exception when others then if sqlerrm<>'INVALID_PROVIDER_SCOPE' then raise;end if;end;
  begin perform public_provider_fleet_page(null,null,1);raise exception 'NO_SCOPE_ACCEPTED';exception when others then if sqlerrm<>'INVALID_PROVIDER_SCOPE' then raise;end if;end;
  org:=gen_random_uuid();company_owner:=gen_random_uuid();
  insert into organizations(id,name,handle,type,public_visibility) values(org,'Company paging','paging-org-'||substr(org::text,1,8),'TRANSPORT_COMPANY','PUBLIC');
  -- Migration 092 requires a real active owner before creating active trucks.
  insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data,raw_app_meta_data)
    values(company_owner,'company-paging-sql@example.invalid',clock_timestamp(),'{}','{}');
  insert into profiles(id,email,full_name,role,active)
    values(company_owner,'company-paging-sql@example.invalid','Company paging owner','TRANSPORTER',true)
    on conflict(id) do update set full_name='Company paging owner',role='TRANSPORTER',active=true;
  insert into organization_members(organization_id,user_id,membership_role) values(org,company_owner,'OWNER');
  insert into company_pages(organization_id,published) values(org,true);
  perform accept_content_policy(company_owner,'2026-10-09');
  result:=public_provider_fleet_page(org,null,1);
  if result->>'total'<>'0' or jsonb_array_length(result->'items')<>0 then raise exception 'CROSS_PROVIDER_OR_EMPTY_LEAK';end if;
  for i in 1..13 loop
    insert into vehicles(organization_id,label,category,make,model,cargo_configuration,use_basis)
      values(org,'Company truck','TRUCK','Test','Company','Heavy rigid','OWNED') returning id into vehicle;
    if i=1 then qualifying_vehicle:=vehicle;perform pg_temp.paging_review_fixture(company_owner,vehicle,admin_id,'OWNERSHIP');end if;
    perform set_provider_vehicle_publication(company_owner,vehicle,'LIVE');
  end loop;
  result:=public_provider_fleet_page(org,null,2);
  if result->>'total'<>'13' or jsonb_array_length(result->'items')<>1 then raise exception 'COMPANY_PAGING';end if;
  if result->'authority_summary'->>'ownershipVerified' is distinct from '1' or result->'authority_summary'->>'permissionVerified' is distinct from '0'
    or result->'authority_summary'->>'notYetVerified' is distinct from '12' or result::text like '%paging-private-proof%'
    or exists(select 1 from jsonb_array_elements(result->'items') truck
      where (truck->'authority'->'ownership'->>'verified')::boolean and truck->>'id'<>qualifying_vehicle::text)
    then raise exception 'COMPANY_EVIDENCE_LEAK';end if;
  if has_function_privilege('anon','public.public_provider_fleet_page(uuid,uuid,integer)','execute')
    or has_function_privilege('authenticated','public.public_provider_fleet_page(uuid,uuid,integer)','execute') then raise exception 'BROWSER_RPC_ACCESS';end if;
end $test$;
rollback;
