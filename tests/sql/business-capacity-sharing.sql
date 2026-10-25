-- FEAT-ENT/SHR/CAP-001. Normal command-created synthetic actors; full rollback.
begin;
create function pg_temp.assert_business_capacity(ok boolean,label text) returns void language plpgsql as $$begin if ok is not true then raise exception '%',label;end if;end$$;
create function pg_temp.capacity_business_denied(statement text,code text) returns void language plpgsql as $$begin begin execute statement;exception when others then if position(code in sqlerrm)>0 then return;end if;raise;end;raise exception 'EXPECTED_CAPACITY_DENIAL:%',code;end$$;
do $test$
declare provider_id uuid:=gen_random_uuid();owner_id uuid:=gen_random_uuid();staff_id uuid:=gen_random_uuid();foreign_id uuid:=gen_random_uuid();uid uuid;
 profile_id uuid:=gen_random_uuid();truck uuid;workspace uuid;other_workspace uuid;grant_id uuid;invitation uuid;
 origin_ref text;destination_ref text;version_value bigint;result jsonb;payload jsonb;capacity uuid;
 owner_email text:='owner-'||owner_id||'@example.invalid';digest text:=encode(gen_random_bytes(32),'hex');
begin
 foreach uid in array array[provider_id,owner_id,staff_id,foreign_id] loop
  insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values(uid,case when uid=owner_id then owner_email else uid||'@example.invalid' end,now(),'{}');
 end loop;
 update profiles set role='DRIVER',active=true,drives_truck=true,full_name='Synthetic Provider' where id=provider_id;
 update profiles set role='SHIPPER',active=true where id in(owner_id,staff_id,foreign_id);
 insert into provider_profiles(id,user_id,business_name,handle) values(profile_id,provider_id,'Capacity business fixture','capacity161-'||substr(provider_id::text,1,12));
 insert into company_pages(provider_profile_id,published) values(profile_id,true);
 perform accept_content_policy(provider_id,'2026-10-09');
 truck:=(create_provider_vehicle(provider_id,'{"make":"Isuzu","model":"Synthetic sharing","plate":"SHARING-161","cargo_configuration":"Mini Box Truck","use_basis":"OWNED"}')->>'id')::uuid;
 perform update_fleet_driver_access(provider_id,jsonb_build_object('driver_user_id',provider_id,'vehicle_id',truck,'can_manage_capacity',true,'can_manage_tracking',true));
 perform set_provider_vehicle_publication(provider_id,truck,'LIVE');
 select id into strict origin_ref from place_catalog where normalized_name='addis ababa' limit 1;
 select id into strict destination_ref from place_catalog where normalized_name='adama' limit 1;
 capacity:=publish_provider_capacity(provider_id,jsonb_build_object('vehicle_id',truck,'status','EMPTY','visibility','PRIVATE','sharing_mode','PRIVATE','availability_geometry','ROUTE','accepted_loads','FTL',
  'current_route_places',jsonb_build_array(jsonb_build_object('place_ref',origin_ref),jsonb_build_object('place_ref',destination_ref)),
  'location_source','DEVICE_OBSCURED','approximate_lat',9.03,'approximate_lng',38.74,'location_precision_km',20));
 workspace:=(business_workspace_create(owner_id,jsonb_build_object('name','Synthetic capacity broker','handle','capacity161-'||substr(owner_id::text,1,12),'kind','BROKER'))->>'id')::uuid;
 other_workspace:=(business_workspace_create(foreign_id,jsonb_build_object('name','Synthetic other shipper','handle','capacity161-'||substr(foreign_id::text,1,12),'kind','SHIPPER'))->>'id')::uuid;
 perform pg_temp.assert_business_capacity(jsonb_array_length(business_workspace_search(provider_id,'Synthetic capacity broker',10))=1,'UNREVIEWED_RECIPIENT_NOT_SEARCHABLE');
 perform pg_temp.assert_business_capacity((select count(*)=0 from business_capacity_filtered_page(owner_id,workspace)),'UNSHARED_TRUCK_VISIBLE');
 perform pg_temp.capacity_business_denied(format('select grant_business_capacity_access(%L,%L,%L)',foreign_id,truck,workspace),'BUSINESS_FORBIDDEN');
 result:=grant_business_capacity_access(provider_id,truck,workspace);grant_id:=(result->>'id')::uuid;
 perform pg_temp.assert_business_capacity((result->>'created')::boolean,'UNREVIEWED_BUSINESS_SHARE_DENIED');
 select p.payload into payload from business_capacity_filtered_page(owner_id,workspace) p;
 perform pg_temp.assert_business_capacity(payload->>'vehicle_id'=truck::text and payload->>'access_scope'='BUSINESS','TEAM_SHARE_MISSING');
 perform pg_temp.assert_business_capacity(payload->>'assigned_driver_first_name'='Synthetic' and payload->>'cargo_configuration'='Mini Box Truck','EXISTING_SAFE_PROJECTION_LOST');
 perform pg_temp.assert_business_capacity((select count(*)=0 from business_capacity_filtered_page(foreign_id,other_workspace)),'FOREIGN_TEAM_INHERITED_SHARE');
 perform pg_temp.capacity_business_denied(format('select * from business_capacity_filtered_page(%L,%L)',foreign_id,workspace),'BUSINESS_FORBIDDEN');
 perform pg_temp.assert_business_capacity((select count(*)=0 from business_capacity_filtered_page(owner_id,workspace,null,null,100,'{"vehicle_category":"Cargo van"}')),'TRUCK_FILTER_IGNORED');
 perform pg_temp.assert_business_capacity((select count(*)=1 from business_capacity_filtered_page(owner_id,workspace,null,null,100,'{"vehicle_category":"Cargo van,Mini Box Truck","status":"EMPTY,PARTIAL"}')),'MULTI_FILTER_MATCH_LOST');
 perform pg_temp.assert_business_capacity((business_capacity_search(owner_id,workspace,'Synthetic',1)->>'total')::integer=1,'BUSINESS_TRANSPORTER_SEARCH_MISSING');
 perform pg_temp.capacity_business_denied(format('select business_capacity_search(%L,%L,%L)',foreign_id,workspace,'Synthetic'),'BUSINESS_FORBIDDEN');
 -- Normal exact-email invitation acceptance grants only configured business work.
 result:=business_workspace_command(owner_id,workspace,jsonb_build_object('action','INVITE','expectedVersion',1,'email',staff_id||'@example.invalid','role','STAFF','capacity',true,'tracking',false));
 invitation:=(result->>'invitationId')::uuid;perform business_workspace_accept_invitation(staff_id,invitation);
 perform pg_temp.assert_business_capacity((select count(*)=1 from business_capacity_filtered_page(staff_id,workspace)),'NEW_AUTHORIZED_STAFF_MISSING_SHARE');
 version_value:=(select version from business_workspaces where id=workspace);
 perform business_workspace_command(owner_id,workspace,jsonb_build_object('action','UPDATE_MEMBER','expectedVersion',version_value,'userId',staff_id,'role','STAFF','capacity',false,'tracking',true,'active',true));
 perform pg_temp.capacity_business_denied(format('select * from business_capacity_filtered_page(%L,%L)',staff_id,workspace),'BUSINESS_FORBIDDEN');
 version_value:=(select version from business_workspaces where id=workspace);
 perform business_workspace_command(owner_id,workspace,jsonb_build_object('action','UPDATE_MEMBER','expectedVersion',version_value,'userId',staff_id,'role','STAFF','capacity',true,'tracking',false,'active',true));
 -- Revoking the publisher's business grant removes it for everyone immediately.
 perform revoke_business_capacity_access(provider_id,grant_id,1);
 perform pg_temp.assert_business_capacity((select count(*)=0 from business_capacity_filtered_page(owner_id,workspace)) and (select count(*)=0 from business_capacity_filtered_page(staff_id,workspace)),'REVOKED_TEAM_SHARE_RETAINED');
 perform pg_temp.capacity_business_denied(format('select grant_named_private_capacity_access(%L,%L,%L,%L,%L)',provider_id,truck,owner_email,digest,'Retired email share'),'EMAIL_CAPACITY_RETIRED');
 perform pg_temp.assert_business_capacity((select count(*)=0 from business_capacity_filtered_page(owner_id,workspace)) and (select count(*)=0 from business_capacity_filtered_page(staff_id,workspace)),'RETIRED_EMAIL_SHARE_VISIBLE');
 result:=grant_business_capacity_access(provider_id,truck,workspace);
 version_value:=(select version from business_workspaces where id=workspace);
 perform business_workspace_command(owner_id,workspace,jsonb_build_object('action','REMOVE_MEMBER','expectedVersion',version_value,'userId',staff_id));
 perform pg_temp.capacity_business_denied(format('select * from business_capacity_filtered_page(%L,%L)',staff_id,workspace),'BUSINESS_FORBIDDEN');
 perform pg_temp.assert_business_capacity(not has_table_privilege('anon','business_capacity_grants','SELECT') and not has_table_privilege('authenticated','business_capacity_grants','SELECT') and (select relrowsecurity from pg_class where oid='business_capacity_grants'::regclass),'BROWSER_TABLE_ACCESS');
 perform pg_temp.assert_business_capacity(not has_function_privilege('service_role','business_capacity_rows(uuid,uuid,timestamptz,uuid,integer,jsonb)','EXECUTE') and not has_function_privilege('authenticated','business_capacity_filtered_page(uuid,uuid,timestamptz,uuid,integer,jsonb)','EXECUTE'),'PROJECTION_BYPASS');
 raise notice 'PASS: unverified businesses remain discoverable/shareable; team shares, staff, filters, retired-email denial, revocation and ACL';
end $test$;
rollback;
