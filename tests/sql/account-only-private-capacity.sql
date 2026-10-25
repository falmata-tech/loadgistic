-- FEAT-CON-001. Run after migration 207; no persistent fixture data.
begin;
do $test$
declare definition text;owner_id uuid:=gen_random_uuid();provider_id uuid:=gen_random_uuid();vehicle_id uuid;
 recipient_email text:='capacity-'||gen_random_uuid()||'@example.invalid';digest text:=encode(gen_random_bytes(32),'hex');
begin
 if exists(select 1 from public.capacity_access_grants where audience_type='EMAIL')
  or exists(select 1 from public.shared_capacity_email_otps)
  or exists(select 1 from public.access_email_deliveries where delivery_kind='SHARED_CAPACITY')
 then raise exception 'RETIRED_EMAIL_CAPACITY_DATA_REMAIN';end if;

 definition:=pg_get_functiondef('public.account_capacity_rows(uuid,text,timestamptz,uuid,integer,jsonb)'::regprocedure);
 if position('capacity_access_grants' in definition)>0 or position($phrase$recipient_kind='BUSINESS'$phrase$ in definition)=0
 then raise exception 'ACCOUNT_CAPACITY_EMAIL_OR_NON_BUSINESS_AUTHORITY';end if;

 definition:=pg_get_functiondef('public.business_capacity_rows(uuid,uuid,timestamptz,uuid,integer,jsonb)'::regprocedure);
 if position('capacity_access_grants' in definition)>0
 then raise exception 'BUSINESS_CAPACITY_EMAIL_AUTHORITY';end if;

 definition:=pg_get_functiondef('public.grant_account_capacity_access(uuid,uuid,uuid)'::regprocedure);
 if position($phrase$recipient_kind<>'BUSINESS'$phrase$ in definition)=0
 then raise exception 'NON_BUSINESS_ACCOUNT_SHARE_ALLOWED';end if;

 insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data)
 values(owner_id,'owner-'||owner_id||'@example.invalid',now(),'{}');
 update public.profiles set role='DRIVER',active=true,drives_truck=true where id=owner_id;
 insert into public.provider_profiles(id,user_id,business_name,handle)
 values(provider_id,owner_id,'Account-only fixture','account-only-'||substr(owner_id::text,1,12));
 insert into public.company_pages(provider_profile_id,published) values(provider_id,true);
 perform public.accept_content_policy(owner_id,'2026-10-09');
 vehicle_id:=(public.create_provider_vehicle(owner_id,'{"make":"Isuzu","model":"Capacity fixture","plate":"ACCOUNT-207","cargo_configuration":"Mini Box Truck","use_basis":"OWNED"}')->>'id')::uuid;
 perform public.update_fleet_driver_access(owner_id,jsonb_build_object('driver_user_id',owner_id,'vehicle_id',vehicle_id,'can_manage_capacity',true,'can_manage_tracking',true));
 perform public.set_provider_vehicle_publication(owner_id,vehicle_id,'LIVE');
 if public.capacity_sharing_allows(vehicle_id,'EMAIL',digest)
 then raise exception 'LEGACY_EMAIL_SHARING_POLICY_STILL_ENABLED';end if;
 begin
  perform public.grant_named_private_capacity_access(owner_id,vehicle_id,recipient_email,digest,'Synthetic recipient');
  raise exception 'NEW_EMAIL_SHARE_ALLOWED';
 exception when others then
  if sqlerrm<>'EMAIL_CAPACITY_RETIRED' then raise;end if;
 end;
 begin
  perform public.set_provider_capacity_sharing(owner_id,vehicle_id,'EXCLUSIVE',recipient_email,digest);
  raise exception 'NEW_EXCLUSIVE_EMAIL_POLICY_ALLOWED';
 exception when others then
  if sqlerrm<>'EMAIL_CAPACITY_RETIRED' then raise;end if;
 end;
 if public.request_shared_capacity_otp(gen_random_uuid(),recipient_email,digest,'retired-code',now()+interval '5 minutes')
 then raise exception 'EMAIL_CAPACITY_OTP_STILL_AVAILABLE';end if;
 if exists(select 1 from public.private_capacity_projection('EMAIL',digest,null,null,null,5))
 then raise exception 'EMAIL_CAPACITY_PROJECTION_STILL_AVAILABLE';end if;
end $test$;
rollback;
