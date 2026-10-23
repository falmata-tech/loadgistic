-- FEAT-VER/FLT-001 / NR-48: terminal document review cannot dead-end recovery.
-- Real commands, synthetic identities/documents, no source approval backfill.
begin;
create function pg_temp.authority_recovery_denied(command text,expected text)
returns void language plpgsql as $$
begin
 begin execute command;exception when others then if sqlerrm=expected then return;end if;raise;end;
 raise exception 'AUTHORITY_RECOVERY_DENIAL_MISSING';
end $$;
do $recovery$
declare owner_id uuid:=gen_random_uuid();foreign_owner uuid:=gen_random_uuid();employee uuid:=gen_random_uuid();
 provider uuid:=gen_random_uuid();foreign_provider uuid:=gen_random_uuid();admin_id uuid;truck uuid;source_id uuid;review_id uuid;
 replacement uuid;identity_replacement uuid;command jsonb;employee_source uuid;old_source jsonb;kind text;category text;
begin
 select id into strict admin_id from profiles where active and role='ADMIN' limit 1;
 insert into auth.users(id,email,email_confirmed_at,raw_app_meta_data,raw_user_meta_data) values
 (owner_id,owner_id||'@example.test',now(),'{}','{}'),(foreign_owner,foreign_owner||'@example.test',now(),'{}','{}'),
 (employee,employee||'@example.test',now(),'{}','{}');
 update profiles set active=true,role='DRIVER',drives_truck=true where id in(owner_id,foreign_owner);
 insert into provider_profiles(id,user_id,business_name,handle) values
 (provider,owner_id,'Synthetic authority recovery','recovery-'||owner_id),
 (foreign_provider,foreign_owner,'Synthetic foreign authority','recovery-'||foreign_owner);
 perform accept_content_policy(owner_id,'2026-10-09');perform accept_content_policy(foreign_owner,'2026-10-09');
 perform fleet_register_driver(owner_id,employee,jsonb_build_object('name','Synthetic recovery employee','email',employee||'@example.test','phone','+251900000148'));
 perform accept_content_policy(employee,'2026-10-09');
 foreach kind in array array['OWNERSHIP','PERMISSION','OPERATING_LICENCE'] loop
  category:=case kind when 'OWNERSHIP' then 'VEHICLE_OWNERSHIP' when 'PERMISSION' then 'VEHICLE_AUTHORIZATION' else 'VEHICLE_OPERATING_LICENSE' end;
  truck:=(create_provider_vehicle(owner_id,jsonb_build_object('make','Isuzu','model','Synthetic recovery','plate','RECOVERY-'||kind,
   'cargo_configuration','Mini Box Truck','use_basis',case when kind='OPERATING_LICENCE' then 'FINANCED' else 'OWNED' end))->>'id')::uuid;
  command:=jsonb_strip_nulls(jsonb_build_object('subject_type','VEHICLE','subject_id',truck,'verification_type',category,
   'document_name','Synthetic recovery evidence','storage_path','supabase://verification/verification/recovery.pdf',
   'original_name','recovery.pdf','mime_type','application/pdf','expires_on',case when kind<>'OWNERSHIP' then (current_date+30)::text end));
  source_id:=submit_managed_verification(owner_id,command);
  perform review_managed_verification(admin_id,source_id,'APPROVED','Synthetic source review.');
  review_id:=confirm_provider_vehicle_authority(admin_id,source_id,jsonb_strip_nulls(jsonb_build_object('fact_kind',kind,
   'holder_basis',case when kind='OPERATING_LICENCE' then 'FINANCED' end,'expires_on',case when kind<>'OWNERSHIP' then (current_date+30)::text end,
   'review_note','Synthetic exact provider fact.','context_revision',managed_provider_authority_review_context(admin_id,array[source_id])->0->>'contextRevision')));
  old_source:=(select to_jsonb(r) from verification_requests r where id=source_id);
  perform pg_temp.authority_recovery_denied(format('select submit_managed_verification(%L,%L)',owner_id,command),'VERIFICATION_ALREADY_SUBMITTED');
  perform revoke_provider_vehicle_authority(admin_id,review_id,'Synthetic authority revoked for replacement.');
  -- RED on the old duplicate guard: generic Approved still blocked a new title.
  replacement:=submit_managed_verification(owner_id,command||'{"document_name":"Synthetic replacement evidence"}');
  if not exists(select 1 from verification_requests where id=replacement and status='PENDING')
   or(select to_jsonb(r) from verification_requests r where id=source_id) is distinct from old_source
  then raise exception 'AUTHORITY_RECOVERY_CHANGED_TERMINAL_SOURCE';end if;
  perform pg_temp.authority_recovery_denied(format('select submit_managed_verification(%L,%L)',owner_id,command),'VERIFICATION_ALREADY_SUBMITTED');
  perform pg_temp.authority_recovery_denied(format('select submit_managed_verification(%L,%L)',foreign_owner,command),'FORBIDDEN');
  if kind='OWNERSHIP' then
   perform pg_temp.authority_recovery_denied(format('select submit_managed_verification(%L,%L)',employee,command),'FORBIDDEN');
   perform review_managed_verification(admin_id,replacement,'APPROVED','Synthetic replacement source review.');
   perform confirm_provider_vehicle_authority(admin_id,replacement,jsonb_build_object('fact_kind','OWNERSHIP',
    'review_note','Synthetic replacement title match.','context_revision',managed_provider_authority_review_context(admin_id,array[replacement])->0->>'contextRevision'));
   perform update_provider_vehicle_details(owner_id,jsonb_build_object('vehicle_id',truck,'make','Isuzu','model','Synthetic recovery',
    'plate','RECOVERY-CHANGED','cargo_configuration','Mini Box Truck','use_basis','OWNED'));
   if exists(select 1 from current_provider_vehicle_authority() a where a.vehicle_id=truck) then raise exception 'CHANGED_TRUCK_KEPT_AUTHORITY';end if;
   identity_replacement:=submit_managed_verification(owner_id,command||'{"document_name":"Synthetic changed-identity title"}');
   if not exists(select 1 from verification_requests where id=identity_replacement and status='PENDING') then raise exception 'CHANGED_IDENTITY_REPLACEMENT_NOT_PENDING';end if;
   perform pg_temp.authority_recovery_denied(format('select submit_managed_verification(%L,%L)',owner_id,command),'VERIFICATION_ALREADY_SUBMITTED');
  end if;
 end loop;
 -- Employed permission remains a Driver/Truck document, with its old duplicate
 -- rule. It can never become the employer's permission/ownership authority.
 perform update_fleet_driver_access(owner_id,jsonb_build_object('driver_user_id',employee,'vehicle_id',truck,'can_manage_capacity',true,'can_manage_tracking',true));
 command:=jsonb_build_object('subject_type','VEHICLE','subject_id',truck,'verification_type','VEHICLE_AUTHORIZATION','expires_on',(current_date+30)::text,
  'document_name','Synthetic employee permission','storage_path','supabase://verification/verification/employee-recovery.pdf','original_name','employee.pdf','mime_type','application/pdf');
 employee_source:=submit_managed_verification(employee,command);
 perform review_managed_verification(admin_id,employee_source,'APPROVED','Synthetic driver permission review.');
 if not exists(select 1 from verification_requests where id=employee_source and subject_type='DRIVER' and subject_id=employee and related_vehicle_id=truck)
 then raise exception 'RECOVERY_CHANGED_EMPLOYEE_PERMISSION_SUBJECT';end if;
 perform pg_temp.authority_recovery_denied(format('select submit_managed_verification(%L,%L)',employee,command),'VERIFICATION_ALREADY_SUBMITTED');
 if exists(select 1 from current_provider_vehicle_authority() a where a.vehicle_id=truck and a.fact_kind='PERMISSION') then raise exception 'EMPLOYEE_PERMISSION_BECAME_PROVIDER_AUTHORITY';end if;
 if has_function_privilege('anon','public.submit_managed_verification(uuid,jsonb)','EXECUTE')
  or has_function_privilege('authenticated','public.submit_managed_verification(uuid,jsonb)','EXECUTE') then raise exception 'AUTHORITY_RECOVERY_BROWSER_RPC';end if;
end $recovery$;
rollback;
