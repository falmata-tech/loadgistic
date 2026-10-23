-- Isolated fixture database; every test mutation rolls back.
begin;
do $test$
declare s_id uuid:=gen_random_uuid();driver_id uuid:=gen_random_uuid();admin_id uuid:=gen_random_uuid();outsider_id uuid:=gen_random_uuid();provider_id uuid:=gen_random_uuid();truck_id uuid;cities text[];e_id uuid:=gen_random_uuid();
  recipient_id uuid:=gen_random_uuid();digest text:=repeat('a',64);result jsonb;
begin
  insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data)
    select u,u||'@example.invalid',clock_timestamp(),'{}'::jsonb from unnest(array[driver_id,admin_id,outsider_id]) u;
  update profiles set role='DRIVER',active=true,drives_truck=true where id=driver_id;
  update profiles set role='ADMIN',active=true where id=admin_id;
  update profiles set role='TRANSPORTER',active=true where id=outsider_id;
  insert into provider_profiles(id,user_id,business_name,handle) values(provider_id,driver_id,'Synthetic proof provider','proof-'||driver_id);
  perform accept_content_policy(driver_id,'2026-10-09');
  truck_id:=(create_provider_vehicle(driver_id,'{"make":"Synthetic","model":"Proof test","plate":"PROOF-AUDIT","cargo_configuration":"Mini Box Truck","use_basis":"OWNED"}')->>'id')::uuid;
  perform update_fleet_driver_access(driver_id,jsonb_build_object('driver_user_id',driver_id,'vehicle_id',truck_id,'can_manage_capacity',true,'can_manage_tracking',true));
  select array_agg(id order by id) into cities from(select id from place_catalog order by id limit 3)c;
  perform create_provider_tracking_with_recipients(driver_id,jsonb_build_object('id',s_id,'code','LGX-'||upper(substr(replace(s_id::text,'-',''),1,8)),
    'vehicle_id',truck_id,'origin_place_ref',cities[1],'passing_place_ref',cities[2],'destination_place_ref',cities[3],'cargo_summary','Synthetic proof access',
    'customer_email','proof-owner@example.invalid','customer_email_digest',digest,'expected_delivery_date',(current_date+2)::text,
    'tracking_mode','LOCATION_AND_STATUS','tracking_code_hash',encode(gen_random_bytes(32),'hex'),'review_code_hash',encode(gen_random_bytes(32),'hex')));
  update provider_shipments set guest_expires_at=now()+interval '1 day' where id=s_id;
  insert into shipment_party_grants(shipment_id,party_role,code_hash,expires_at)
    values(s_id,'SHIPPER',gen_random_uuid()::text,now()+interval '1 day')
    on conflict(shipment_id,party_role) do update set revoked_at=null,expires_at=excluded.expires_at;
  insert into provider_shipment_events(id,shipment_id,status,event_type,created_by,proof_storage_path,proof_original_name,proof_mime_type)
    values(e_id,s_id,'LOADING','STATUS',driver_id,'supabase://shipment-proof/audit-placeholder.png','proof.png','image/png');
  select id into strict recipient_id from provider_tracking_recipients where shipment_id=s_id and recipient_role='OWNER';
  perform tracking_owner_sharing_command(s_id,digest,clock_timestamp(),jsonb_build_object('action','ADD_VIEWER','expectedRevision',0,'name','Synthetic viewer','email','proof-viewer@example.invalid','digest',repeat('d',64)));
  if provider_tracking_proof_file(null,s_id,e_id,repeat('d',64)) is not null then raise exception 'VIEWER_PROOF_LEAK';end if;
  result:=provider_guest_tracking_for_recipient(s_id,repeat('d',64));
  if result is null or exists(select 1 from jsonb_array_elements(result->'events') e where(e->>'has_proof')::boolean) then raise exception 'VIEWER_STATUS_OR_PROOF_BOUNDARY';end if;
  if provider_tracking_proof_file(driver_id,s_id,e_id,null) is null then raise exception 'OWNER_CANNOT_READ_PROOF';end if;
  if provider_tracking_proof_file(admin_id,s_id,e_id,null) is null then raise exception 'ADMIN_CANNOT_READ_PROOF';end if;
  if provider_tracking_proof_file(null,s_id,e_id,digest) is null then raise exception 'RECIPIENT_CANNOT_READ_PROOF';end if;
  if provider_tracking_proof_file(outsider_id,s_id,e_id,null) is not null then raise exception 'CROSS_TENANT_PROOF';end if;
  if provider_tracking_proof_file(null,s_id,e_id,null) is not null then raise exception 'ANONYMOUS_PROOF';end if;
  if provider_tracking_proof_file(null,s_id,e_id,repeat('b',64)) is not null then raise exception 'WRONG_RECIPIENT_PROOF';end if;
  if provider_tracking_proof_file(admin_id,gen_random_uuid(),e_id,null) is not null then raise exception 'CROSS_SHIPMENT_EVENT_PROOF';end if;
  if provider_tracking_proof_file(driver_id,s_id,gen_random_uuid(),null) is not null then raise exception 'UNKNOWN_EVENT_PROOF';end if;
  result:=provider_guest_tracking_for_recipient(s_id,digest);
  if result::text like '%supabase://%' or result::text like '%proof_storage_path%' then raise exception 'PROJECTION_LEAK';end if;
  if not exists(select 1 from jsonb_array_elements(result->'events') e where e->>'id'=e_id::text and (e->>'has_proof')::boolean) then raise exception 'PROOF_LINK_UNAVAILABLE';end if;
  update provider_tracking_recipients set revoked_at=now() where id=recipient_id;
  if provider_tracking_proof_file(null,s_id,e_id,digest) is not null then raise exception 'REVOKED_RECIPIENT_PROOF';end if;
  update provider_tracking_recipients set revoked_at=null where id=recipient_id;
  update provider_shipments set guest_expires_at=now()-interval '1 day' where id=s_id;
  if provider_tracking_proof_file(null,s_id,e_id,digest) is not null then raise exception 'EXPIRED_GUEST_PROOF';end if;
  if provider_tracking_proof_file(driver_id,s_id,e_id,null) is null then raise exception 'PROVIDER_HISTORY_LOST';end if;
  update profiles set active=false where id=driver_id;
  if provider_tracking_proof_file(driver_id,s_id,e_id,null) is not null then raise exception 'SUSPENDED_PROVIDER_PROOF';end if;
  if has_function_privilege('anon','public.provider_tracking_proof_file(uuid,uuid,uuid,text)','execute')
    or has_function_privilege('authenticated','public.provider_tracking_proof_file(uuid,uuid,uuid,text)','execute') then raise exception 'BROWSER_RPC_ACCESS';end if;
end;
$test$;
rollback;
