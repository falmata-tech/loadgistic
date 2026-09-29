-- Isolated fixture database; every test mutation rolls back.
begin;
do $test$
declare s_id uuid;driver_id uuid;admin_id uuid;outsider_id uuid;e_id uuid:=gen_random_uuid();
  recipient_id uuid:=gen_random_uuid();digest text:=repeat('a',64);result jsonb;
begin
  select s.id,s.assigned_driver_user_id into strict s_id,driver_id
    from provider_shipments s join profiles p on p.id=s.assigned_driver_user_id
    where p.email='driver@loadgistic.local' and s.provider_profile_id is not null limit 1;
  select id into strict admin_id from profiles where email='admin@loadgistic.local';
  select id into strict outsider_id from profiles where email='transporter@loadgistic.local';
  update provider_shipments set guest_expires_at=now()+interval '1 day' where id=s_id;
  insert into shipment_party_grants(shipment_id,party_role,code_hash,expires_at)
    values(s_id,'SHIPPER',gen_random_uuid()::text,now()+interval '1 day')
    on conflict(shipment_id,party_role) do update set revoked_at=null,expires_at=excluded.expires_at;
  insert into provider_shipment_events(id,shipment_id,status,event_type,created_by,proof_storage_path,proof_original_name,proof_mime_type)
    values(e_id,s_id,'LOADING','STATUS',driver_id,'supabase://shipment-proof/audit-placeholder.png','proof.png','image/png');
  insert into provider_tracking_recipients(id,shipment_id,recipient_role,recipient_email,recipient_email_digest,created_by)
    values(recipient_id,s_id,'TRACKING_PARTY','proof-audit@example.test',digest,driver_id);
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
