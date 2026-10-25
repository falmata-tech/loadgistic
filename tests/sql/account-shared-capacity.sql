-- FEAT-CON-001. Own all synthetic rows and roll back every write.
begin;
create function pg_temp.assert_account_capacity(ok boolean,label text) returns void language plpgsql as $$
begin if ok is not true then raise exception '%',label;end if;end $$;
create function pg_temp.account_capacity_denied(statement text) returns void language plpgsql as $$
begin
 begin execute statement;exception when others then
  if position('ACCOUNT_CAPACITY_FORBIDDEN' in sqlerrm)>0 then return;end if;
  raise;
 end;
 raise exception 'EXPECTED_ACCOUNT_CAPACITY_DENIAL';
end $$;
do $test$
declare owner_id uuid:=gen_random_uuid();recipient_id uuid:=gen_random_uuid();foreign_id uuid:=gen_random_uuid();provider_id uuid:=gen_random_uuid();vehicle_id uuid;grant_id uuid;recipient_workspace uuid;foreign_workspace uuid;connection_id uuid;origin_ref text;destination_ref text;
 digest text:=encode(gen_random_bytes(32),'hex');saved jsonb;
begin
 insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data)
 values(owner_id,'owner-'||owner_id||'@example.invalid',now(),'{}'),
       (recipient_id,'recipient-'||recipient_id||'@example.invalid',now(),'{}'),
       (foreign_id,'foreign-'||foreign_id||'@example.invalid',now(),'{}');
 update public.profiles set role='DRIVER',active=true,drives_truck=true where id=owner_id;
 update public.profiles set role='SHIPPER',active=true where id in(recipient_id,foreign_id);
 insert into public.provider_profiles(id,user_id,business_name,handle)
 values(provider_id,owner_id,'Account capacity fixture','account199-'||substr(owner_id::text,1,12));
 insert into public.company_pages(provider_profile_id,published) values(provider_id,true);
 perform public.accept_content_policy(owner_id,'2026-10-09');
 vehicle_id:=(public.create_provider_vehicle(owner_id,'{"make":"Isuzu","model":"Account fixture","plate":"ACCOUNT-199","cargo_configuration":"Mini Box Truck","use_basis":"OWNED"}')->>'id')::uuid;
 perform public.update_fleet_driver_access(owner_id,jsonb_build_object('driver_user_id',owner_id,'vehicle_id',vehicle_id,'can_manage_capacity',true,'can_manage_tracking',true));
 perform public.set_provider_vehicle_publication(owner_id,vehicle_id,'LIVE');
 select id into strict origin_ref from public.place_catalog where normalized_name='addis ababa' limit 1;
 select id into strict destination_ref from public.place_catalog where normalized_name='adama' limit 1;
 perform public.publish_provider_capacity(owner_id,jsonb_build_object('vehicle_id',vehicle_id,'status','EMPTY','visibility','PRIVATE','sharing_mode','PRIVATE','availability_geometry','ROUTE','accepted_loads','FTL',
  'current_route_places',jsonb_build_array(jsonb_build_object('place_ref',origin_ref),jsonb_build_object('place_ref',destination_ref)),
  'location_source','DEVICE_OBSCURED','approximate_lat',9.03,'approximate_lng',38.74,'location_precision_km',20));
 recipient_workspace:=(public.business_workspace_create(recipient_id,jsonb_build_object('name','Synthetic recipient','handle','account-recipient-'||substr(recipient_id::text,1,8),'kind','BROKER'))->>'id')::uuid;
 foreign_workspace:=(public.business_workspace_create(foreign_id,jsonb_build_object('name','Synthetic foreign','handle','account-foreign-'||substr(foreign_id::text,1,8),'kind','SHIPPER'))->>'id')::uuid;
 perform pg_temp.assert_account_capacity((select count(*)=0 from public.account_capacity_filtered_page(recipient_id,digest)),'UNSHARED_CAPACITY_VISIBLE');
 saved:=public.request_account_connection(owner_id,'BUSINESS',recipient_workspace);
 connection_id:=(saved->>'id')::uuid;
 perform public.decide_account_connection(recipient_id,connection_id,'ACCEPT');
 saved:=public.grant_account_capacity_access(owner_id,connection_id,vehicle_id);
 grant_id:=(saved->>'id')::uuid;
 perform pg_temp.assert_account_capacity((select count(*)=1 from public.account_capacity_filtered_page(recipient_id,digest)),'ACCOUNT_GRANT_MISSING');
 perform pg_temp.assert_account_capacity((select count(*)=0 from public.account_capacity_filtered_page(foreign_id,digest)),'FOREIGN_ACCOUNT_INHERITED_GRANT');
 perform pg_temp.account_capacity_denied(format('select * from public.account_capacity_filtered_page(%L,%L)',recipient_id,'forged'));
 update auth.users set email_confirmed_at=null where id=recipient_id;
 perform pg_temp.account_capacity_denied(format('select * from public.account_capacity_filtered_page(%L,%L)',recipient_id,digest));
 update auth.users set email_confirmed_at=now() where id=recipient_id;
 perform public.revoke_account_capacity_access(owner_id,grant_id,1);
 perform pg_temp.assert_account_capacity((select count(*)=0 from public.account_capacity_filtered_page(recipient_id,digest)),'REVOKED_ACCOUNT_GRANT_VISIBLE');
 perform pg_temp.assert_account_capacity(not has_function_privilege('anon','public.account_capacity_filtered_page(uuid,text,timestamptz,uuid,integer,jsonb)','EXECUTE')
  and not has_function_privilege('authenticated','public.account_capacity_filtered_page(uuid,text,timestamptz,uuid,integer,jsonb)','EXECUTE'),'ACCOUNT_PROJECTION_BROWSER_EXECUTE');
 raise notice 'PASS: account Capacity follows registered broker grant, denies foreign/unconfirmed/malformed reads, revocation and direct browser execution';
end $test$;
rollback;
