-- FEAT-VER-001. Run against local Loadgistic only; all fixture writes roll back.
begin;
do $test$
declare owner_id uuid; outsider uuid; driver_id uuid:=gen_random_uuid(); org uuid; truck uuid; request_id uuid; admin_id uuid;
  command jsonb; center jsonb; result jsonb; doc jsonb; email_value text;
begin
  select p.id,m.organization_id into strict owner_id,org from profiles p join organization_members m on m.user_id=p.id
    where p.active and p.role='TRANSPORTER' and m.membership_role='OWNER' limit 1;
  select p.id into strict outsider from profiles p join organization_members m on m.user_id=p.id
    where p.active and p.role='TRANSPORTER' and m.organization_id<>org limit 1;
  select id into strict admin_id from profiles where active and role='ADMIN' limit 1;
  truck:=(create_provider_vehicle(owner_id,'{"make":"Isuzu","model":"Document test","plate":"DOC-TEST","cargo_configuration":"Mini Box Truck"}')->>'id')::uuid;
  center:=managed_verification_center(owner_id);
  if not exists(select 1 from jsonb_array_elements(center->'subjects') subject where subject->>'subject_type'='VEHICLE'
    and subject->>'subject_id'=truck::text and subject->'verification_types'='["VEHICLE_OWNERSHIP","VEHICLE_AUTHORIZATION"]'::jsonb) then raise exception 'TRUCK_CHOICES_MISSING';end if;
  if center::text like '%storage_path%' then raise exception 'PRIVATE_PATH_IN_CENTER';end if;
  command:=jsonb_build_object('subject_type','VEHICLE','subject_id',truck,'verification_type','VEHICLE_OWNERSHIP',
    'document_name','Private test document','storage_path','supabase://verification/verification/test.pdf','original_name','test.pdf','mime_type','application/pdf');
  begin perform submit_managed_verification(outsider,command);raise exception 'OTHER_FLEET_ALLOWED';exception when raise_exception then if sqlerrm<>'FORBIDDEN' then raise;end if;end;
  request_id:=submit_managed_verification(owner_id,command);
  begin perform submit_managed_verification(owner_id,command);raise exception 'DUPLICATE_ALLOWED';exception when raise_exception then if sqlerrm<>'VERIFICATION_ALREADY_SUBMITTED' then raise;end if;end;
  if managed_verification_file(outsider,request_id) is not null then raise exception 'OTHER_FLEET_FILE';end if;
  perform review_managed_verification(admin_id,request_id,'APPROVED','Local regression test');
  center:=managed_verification_center(owner_id);
  if not exists(select 1 from jsonb_array_elements(center->'subjects') subject, jsonb_array_elements(subject->'approved_documents') evidence
    where subject->>'subject_id'=truck::text and evidence->>'verification_type'='VEHICLE_OWNERSHIP') then raise exception 'APPROVAL_MISSING';end if;
  command:=command||jsonb_build_object('verification_type','VEHICLE_AUTHORIZATION');
  begin perform submit_managed_verification(owner_id,command);raise exception 'MISSING_EXPIRY_ALLOWED';exception when raise_exception then if sqlerrm<>'TRUCK_AUTHORIZATION_DETAILS_REQUIRED' then raise;end if;end;
  begin perform submit_managed_verification(owner_id,command||jsonb_build_object('expires_on',current_date));raise exception 'EXPIRED_ALLOWED';exception when raise_exception then if sqlerrm<>'TRUCK_AUTHORIZATION_DETAILS_REQUIRED' then raise;end if;end;
  begin perform submit_managed_verification(owner_id,command||jsonb_build_object('expires_on',current_date+30,'related_vehicle_id',gen_random_uuid()));raise exception 'DIFFERENT_TRUCK_ALLOWED';exception when raise_exception then if sqlerrm<>'FORBIDDEN' then raise;end if;end;
  email_value:='documents-'||driver_id||'@example.test';
  insert into auth.users(id,email,raw_app_meta_data,raw_user_meta_data) values(driver_id,email_value,'{}','{}');
  perform fleet_register_driver(owner_id,driver_id,jsonb_build_object('email',email_value,'name','Document test Driver','phone','+251900000001'));
  perform update_fleet_driver_access(owner_id,jsonb_build_object('driver_user_id',driver_id,'vehicle_id',truck,'can_manage_capacity',true,'can_manage_tracking',true));
  request_id:=submit_managed_verification(driver_id,command||jsonb_build_object('expires_on',current_date+30));
  if not exists(select 1 from verification_requests where id=request_id and subject_type='DRIVER' and subject_id=driver_id and related_vehicle_id=truck) then raise exception 'DRIVER_GRANTEE_LOST';end if;
  perform review_managed_verification(admin_id,request_id,'APPROVED','Local permission test');
  center:=managed_verification_center(owner_id);
  if not exists(select 1 from jsonb_array_elements(center->'subjects') subject,jsonb_array_elements(subject->'approved_documents') evidence
    where subject->>'subject_id'=truck::text and evidence->>'verification_type'='VEHICLE_AUTHORIZATION') then raise exception 'PAIRING_NOT_ON_TRUCK';end if;
  update driver_vehicle_assignments set active=false where driver_user_id=driver_id and vehicle_id=truck;
  center:=managed_verification_center(owner_id);
  if exists(select 1 from jsonb_array_elements(center->'subjects') subject,jsonb_array_elements(subject->'approved_documents') evidence
    where subject->>'subject_id'=truck::text and evidence->>'verification_type'='VEHICLE_AUTHORIZATION') then raise exception 'STALE_PAIRING_RETAINED';end if;
  begin perform submit_managed_verification(driver_id,command||jsonb_build_object('expires_on',current_date+60));raise exception 'STALE_DRIVER_ALLOWED';exception when raise_exception then if sqlerrm<>'FORBIDDEN' then raise;end if;end;
  result:=capacity_owner_documents(array[org],array[]::uuid[]);
  if result::text like '%storage_path%' or result::text like '%document_name%' or result::text like '%VEHICLE_OWNERSHIP%' or result::text like '%VEHICLE_AUTHORIZATION%' then raise exception 'OWNER_DOCUMENT_LEAK';end if;
  begin perform capacity_owner_documents(array_fill(org,array[101]),array[]::uuid[]);raise exception 'UNBOUNDED_QUERY';exception when raise_exception then if sqlerrm<>'INVALID_PAGE_SIZE' then raise;end if;end;
  update vehicles set active=false where id=truck;
  begin perform submit_managed_verification(owner_id,command||jsonb_build_object('expires_on',current_date+30));raise exception 'INACTIVE_TRUCK_ALLOWED';exception when raise_exception then if sqlerrm<>'FORBIDDEN' then raise;end if;end;
  if has_function_privilege('anon','public.capacity_owner_documents(uuid[],uuid[])','EXECUTE')
    or has_function_privilege('authenticated','public.managed_verification_controls_truck(uuid,uuid)','EXECUTE')
    or has_function_privilege('anon','public.submit_managed_verification(uuid,jsonb)','EXECUTE') then raise exception 'BROWSER_BYPASS';end if;
  raise notice 'PASS: truck alternatives, scoped submission, duplicate, expiry, private files, approval, Driver grantee, stale assignment, retired truck, bounded owner metadata, browser denial';
end $test$;
rollback;
