-- FEAT-GPS/IAM/PLY/SEC-001. All identities/devices are synthetic; rollback only.
-- Receipt calls simulate the separately authenticated janitor, not upstream I/O.
begin;
create function pg_temp.privacy_denied(statement text,expected text) returns void language plpgsql as $$
begin
 begin execute statement;exception when others then if sqlerrm=expected then return;end if;raise;end;
 raise exception 'EXPECTED_TELEMATICS_PRIVACY_DENIAL';
end $$;

create function pg_temp.privacy_owner(admin_id uuid,gateway_id uuid,ingest_digest text,as_company boolean,hardware_id integer)
returns jsonb language plpgsql as $$
declare owner_id uuid:=gen_random_uuid();anchor uuid:=gen_random_uuid();truck uuid;device uuid;result jsonb;position jsonb;imei text:='99'||lpad(hardware_id::text,13,'0');stamp timestamptz;
begin
 insert into auth.users(id,email,email_confirmed_at,last_sign_in_at,raw_app_meta_data,raw_user_meta_data)
 values(owner_id,'falmatad97+gps-privacy-'||owner_id||'@gmail.com',now(),now(),'{"fixture_source":"loadgistic"}',
 jsonb_build_object('fixture_key',case when as_company then 'user-transporter' else 'user-driver' end));
 update profiles set active=true,role=case when as_company then 'TRANSPORTER'::public.user_role else 'DRIVER'::public.user_role end,drives_truck=true where id=owner_id;
 if as_company then
  insert into organizations(id,name,handle,type) values(anchor,'Synthetic privacy fleet','privacy-'||anchor,'TRANSPORT_COMPANY');
  insert into organization_members(organization_id,user_id,membership_role) values(anchor,owner_id,'OWNER');
 else insert into provider_profiles(id,user_id,business_name,handle) values(anchor,owner_id,'Synthetic privacy provider','privacy-'||anchor);end if;
 perform accept_content_policy(owner_id,'2026-10-09');
 truck:=(create_provider_vehicle(owner_id,jsonb_build_object('make','Synthetic','model','Privacy truck','plate','PRIVACY-'||hardware_id,
  'cargo_configuration','Mini Box Truck','use_basis','OWNED'))->>'id')::uuid;
 result:=provision_telematics_device(admin_id,jsonb_build_object('gatewayId',gateway_id,'gatewayDeviceId',hardware_id,'imei',imei,
  'protocol','gt06','protocolDeviceId',imei,'label','Synthetic privacy tracker','synthetic',true,'modelProfile','SYNTHETIC_GT06',
  case when as_company then 'ownerOrganizationId' else 'ownerProviderProfileId' end,anchor));device:=(result->>'id')::uuid;
 perform assign_telematics_device(owner_id,jsonb_build_object('deviceId',device,'vehicleId',truck,'expectedRevision',result->>'revision'));
 perform select_telematics_location_source(owner_id,jsonb_build_object('vehicleId',truck,'source','MANUAL','precisionKm',20,
  'manualLatitude',9.031,'manualLongitude',38.748,'expectedRevision','1970-01-01T00:00:00Z'));
 stamp:=clock_timestamp();position:=jsonb_build_object('eventKey','privacy:'||device,'gatewayDeviceId',hardware_id,'protocol','gt06','protocolDeviceId',imei,
  'observedAt',stamp,'receivedAt',stamp,'valid',true,'latitude',9.031,'longitude',38.748,'speedKph',0,'course',0,'attributes',jsonb_build_object('ignition',false));
 perform ingest_telematics_position(ingest_digest,position);
 perform request_telematics_command(owner_id,jsonb_build_object('deviceId',device,'command','LOCATE','idempotencyKey',gen_random_uuid()));
 return jsonb_build_object('owner',owner_id,'anchor',anchor,'truck',truck,'device',device,'position',position);
end $$;

create function pg_temp.privacy_snapshot(device_id uuid,truck_id uuid) returns jsonb language sql as $$
 select jsonb_build_object('device',(select to_jsonb(d) from telematics_devices d where d.id=$1),
  'positions',(select jsonb_agg(to_jsonb(p) order by p.id) from telematics_positions p where p.device_id=$1),
  'assignments',(select jsonb_agg(to_jsonb(a) order by a.id) from telematics_device_assignments a where a.device_id=$1),
  'commands',(select jsonb_agg(to_jsonb(c) order by c.id) from telematics_commands c where c.device_id=$1),
  'source',(select to_jsonb(s) from telematics_location_sources s where s.vehicle_id=$2));
$$;

do $privacy$
<<privacy>>
declare admin_id uuid:=gen_random_uuid();gateway_id uuid:=gen_random_uuid();foreign_gateway uuid:=gen_random_uuid();
 ingest_digest text:=repeat('a',64);privacy_digest text:=repeat('b',64);foreign_privacy text:=repeat('c',64);nonce uuid:=gen_random_uuid();
 company jsonb;personal jsonb;other_owner jsonb;request_id uuid;result jsonb;job jsonb;receipt jsonb;before_state jsonb;signature text;role_name text;
 employee uuid:=gen_random_uuid();shipment uuid:=gen_random_uuid();origin_ref text;destination_ref text;passing_ref text;old_receipt jsonb;
begin
 insert into auth.users(id,email,email_confirmed_at,last_sign_in_at,raw_user_meta_data) values(admin_id,'privacy-admin-'||admin_id||'@example.test',now(),now(),'{}');
 update profiles set active=true,role='ADMIN' where id=admin_id;
 perform register_telematics_gateway(admin_id,gateway_id,'Synthetic privacy gateway',ingest_digest,true);
 perform register_telematics_gateway(admin_id,foreign_gateway,'Synthetic other privacy gateway',repeat('d',64),true);
 company:=pg_temp.privacy_owner(admin_id,gateway_id,ingest_digest,true,15401);
 personal:=pg_temp.privacy_owner(admin_id,gateway_id,ingest_digest,false,15402);
 other_owner:=pg_temp.privacy_owner(admin_id,foreign_gateway,repeat('d',64),true,15403);
 before_state:=pg_temp.privacy_snapshot((other_owner->>'device')::uuid,(other_owner->>'truck')::uuid);
 perform pg_temp.privacy_denied(format('select register_telematics_privacy_agent(%L,%L,%L)',company->>'owner',gateway_id,privacy_digest),'FORBIDDEN');
 perform pg_temp.privacy_denied(format('select register_telematics_privacy_agent(%L,%L,%L)',admin_id,gateway_id,ingest_digest),'PRIVACY_GATEWAY_UNAVAILABLE');
 perform pg_temp.privacy_denied(format('select register_telematics_privacy_agent(%L,%L,%L)',admin_id,gateway_id,repeat('d',64)),'PRIVACY_GATEWAY_UNAVAILABLE');
 perform register_telematics_privacy_agent(admin_id,gateway_id,privacy_digest);
 perform register_telematics_privacy_agent(admin_id,foreign_gateway,foreign_privacy);
 perform pg_temp.privacy_denied(format('select register_telematics_gateway(%L,%L,%L,%L,true)',admin_id,gen_random_uuid(),'Synthetic rejected digest reuse',privacy_digest),'PRIVACY_GATEWAY_UNAVAILABLE');
 perform pg_temp.privacy_denied(format('select claim_telematics_privacy_jobs(%L)',ingest_digest),'PRIVACY_GATEWAY_UNAVAILABLE');
 perform pg_temp.privacy_denied(format('select authorize_telematics_privacy_gateway_request(%L,%L,%L,clock_timestamp())',ingest_digest,nonce,repeat('e',64)),'PRIVACY_GATEWAY_UNAVAILABLE');
 perform authorize_telematics_privacy_gateway_request(privacy_digest,nonce,repeat('e',64),clock_timestamp());
 perform pg_temp.privacy_denied(format('select authorize_telematics_privacy_gateway_request(%L,%L,%L,clock_timestamp())',privacy_digest,nonce,repeat('e',64)),'PRIVACY_GATEWAY_UNAVAILABLE');

 -- One exact personal owner closure disables collection but keeps history.
 update vehicles set active=false where id=(personal->>'truck')::uuid;
 result:=deactivate_own_account((personal->>'owner')::uuid,'DEACTIVATE');
 if result->>'deactivated'<>'true' or exists(select 1 from telematics_devices where id=(personal->>'device')::uuid and active)
  or exists(select 1 from telematics_device_assignments where device_id=(personal->>'device')::uuid and ended_at is null)
  or not exists(select 1 from telematics_positions where device_id=(personal->>'device')::uuid)
  or not exists(select 1 from telematics_location_sources where vehicle_id=(personal->>'truck')::uuid and manual_latitude is not null)
  or exists(select 1 from telematics_commands where device_id=(personal->>'device')::uuid and state='REQUESTED')
 then raise exception 'CLOSURE_DID_NOT_DISABLE_OR_RETAIN_PRIVATE_HISTORY';end if;
 if telematics_effective_location((personal->>'truck')::uuid) is not null then raise exception 'CLOSED_MANUAL_LOCATION_STILL_EFFECTIVE';end if;
 perform pg_temp.privacy_denied(format('select ingest_telematics_position(%L,%L::jsonb)',ingest_digest,personal->'position'),'TELEMETRY_BINDING_DENIED');
 result:=claim_telematics_commands(ingest_digest);
 -- The still-active company may have its own normal job; never include closed owner.
 if exists(select 1 from jsonb_array_elements(result) item where item->>'deviceId'=personal->>'device') then raise exception 'CLOSED_DEVICE_COMMAND_CLAIMED';end if;
 job:=claim_telematics_privacy_jobs(privacy_digest)->0;
 if job->>'purpose'<>'DISABLE' or job->>'deviceId'<>personal->>'device' or job->>'requestId' is not null then raise exception 'CLOSURE_PRIVACY_JOB_SCOPE';end if;
 receipt:=jsonb_build_object('jobId',job->>'id','leaseId',job->>'leaseId','bindingDigest',job->>'bindingDigest','verified',true);
 perform pg_temp.privacy_denied(format('select complete_telematics_privacy_job(%L,%L::jsonb)',ingest_digest,receipt),'PRIVACY_GATEWAY_UNAVAILABLE');
 perform pg_temp.privacy_denied(format('select complete_telematics_privacy_job(%L,%L::jsonb)',foreign_privacy,receipt),'PRIVACY_JOB_CHANGED');
 perform pg_temp.privacy_denied(format('select complete_telematics_privacy_job(%L,%L::jsonb)',privacy_digest,receipt||jsonb_build_object('bindingDigest',repeat('f',64))),'PRIVACY_JOB_CHANGED');
 perform pg_temp.privacy_denied(format('select complete_telematics_privacy_job(%L,%L::jsonb)',privacy_digest,receipt||'{"verified":false}'),'INVALID_TELEMATICS_PRIVACY_INPUT');
 perform pg_temp.privacy_denied(format('select complete_telematics_privacy_job(%L,%L::jsonb)',privacy_digest,receipt-'leaseId'),'INVALID_TELEMATICS_PRIVACY_INPUT');
 perform pg_temp.privacy_denied(format('select complete_telematics_privacy_job(%L,%L::jsonb)',privacy_digest,receipt||'{"extra":true}'),'INVALID_TELEMATICS_PRIVACY_INPUT');
 perform complete_telematics_privacy_job(privacy_digest,receipt);
 perform complete_telematics_privacy_job(privacy_digest,receipt);
 if(select count(*) from audit_logs where entity_id=(job->>'id')::uuid and action='TELEMATICS_PRIVACY_VERIFIED')<>1 then raise exception 'PRIVACY_RECEIPT_REPLAY_DUPLICATED_AUDIT';end if;

 -- Own company erasure requires its upstream receipt before local destruction.
 request_id:=(request_account_deletion((company->>'owner')::uuid)->>'id')::uuid;
 result:=prepare_account_erasure(admin_id,request_id);
 if result->>'status'<>'ERASING' then raise exception 'GPS_ERASURE_DID_NOT_PREPARE';end if;
 perform prepare_account_erasure(admin_id,request_id);
 if(select count(*) from telematics_privacy_jobs j where j.request_id=privacy.request_id)<>1 then raise exception 'GPS_ERASURE_RETRY_DUPLICATED_JOBS';end if;
 update auth.users set deleted_at=now() where id=(company->>'owner')::uuid;
 result:=finish_account_erasure(admin_id,request_id);
 if result->>'status'<>'ERASING' or not exists(select 1 from telematics_positions where device_id=(company->>'device')::uuid)
  or not exists(select 1 from telematics_location_sources where vehicle_id=(company->>'truck')::uuid and manual_latitude is not null)
 then raise exception 'UNVERIFIED_UPSTREAM_ERASURE_REPORTED_COMPLETE';end if;
 job:=claim_telematics_privacy_jobs(privacy_digest)->0;
 if job->>'purpose'<>'ERASE' or job->>'requestId'<>request_id::text or job->>'deviceId'<>company->>'device' then raise exception 'ERASURE_PRIVACY_JOB_SCOPE';end if;
 receipt:=jsonb_build_object('jobId',job->>'id','leaseId',job->>'leaseId','bindingDigest',job->>'bindingDigest','verified',true);
 perform pg_temp.privacy_denied(format('select complete_telematics_privacy_job(%L,%L::jsonb)',privacy_digest,receipt||jsonb_build_object('leaseId',gen_random_uuid())),'PRIVACY_JOB_CHANGED');
 update telematics_privacy_jobs set lease_until=clock_timestamp()-interval '1 second' where id=(job->>'id')::uuid;
 perform pg_temp.privacy_denied(format('select complete_telematics_privacy_job(%L,%L::jsonb)',privacy_digest,receipt),'PRIVACY_JOB_CHANGED');
 old_receipt:=receipt;
 job:=claim_telematics_privacy_jobs(privacy_digest)->0;
 receipt:=jsonb_build_object('jobId',job->>'id','leaseId',job->>'leaseId','bindingDigest',job->>'bindingDigest','verified',true);
 perform pg_temp.privacy_denied(format('select complete_telematics_privacy_job(%L,%L::jsonb)',privacy_digest,old_receipt),'PRIVACY_JOB_CHANGED');
 -- A changed immutable hardware binding cannot use an old upstream receipt.
 update telematics_devices set protocol_device_id=protocol_device_id||'x' where id=(company->>'device')::uuid;
 perform pg_temp.privacy_denied(format('select complete_telematics_privacy_job(%L,%L::jsonb)',privacy_digest,receipt),'PRIVACY_JOB_CHANGED');
 update telematics_devices set protocol_device_id=left(protocol_device_id,length(protocol_device_id)-1) where id=(company->>'device')::uuid;
 perform complete_telematics_privacy_job(privacy_digest,receipt);
 result:=finish_account_erasure(admin_id,request_id);
 if result->>'status'<>'COMPLETED' or exists(select 1 from telematics_devices where id=(company->>'device')::uuid)
  or exists(select 1 from telematics_positions where device_id=(company->>'device')::uuid)
  or exists(select 1 from telematics_location_sources where vehicle_id=(company->>'truck')::uuid)
  or exists(select 1 from telematics_privacy_jobs j where j.request_id=privacy.request_id and(gateway_device_id is not null or imei is not null or protocol_device_id is not null or local_erased_at is null))
 then raise exception 'VERIFIED_GPS_PRIVATE_DATA_NOT_ERASED';end if;
 if finish_account_erasure(admin_id,request_id)->>'status'<>'COMPLETED' then raise exception 'GPS_ERASURE_REPLAY_FAILED';end if;
 perform complete_telematics_privacy_job(privacy_digest,receipt);
 -- A closed personal provider can subsequently request real deletion. Disable
 -- retained history is then erased only after a separate ERASE receipt.
 request_id:=(request_account_deletion((personal->>'owner')::uuid)->>'id')::uuid;
 result:=prepare_account_erasure(admin_id,request_id);
 if result->>'status'<>'ERASING' then raise exception 'PERSONAL_GPS_ERASURE_NOT_PREPARED';end if;
 update auth.users set deleted_at=now() where id=(personal->>'owner')::uuid;
 if finish_account_erasure(admin_id,request_id)->>'status'<>'ERASING' then raise exception 'PERSONAL_ERASURE_SKIPPED_UPSTREAM';end if;
 job:=claim_telematics_privacy_jobs(privacy_digest)->0;
 if job->>'purpose'<>'ERASE' or job->>'deviceId'<>personal->>'device' then raise exception 'PERSONAL_ERASE_JOB_SCOPE';end if;
 receipt:=jsonb_build_object('jobId',job->>'id','leaseId',job->>'leaseId','bindingDigest',job->>'bindingDigest','verified',true);
 perform complete_telematics_privacy_job(privacy_digest,receipt);
 result:=finish_account_erasure(admin_id,request_id);
 if result->>'status'<>'COMPLETED'
  or exists(select 1 from telematics_devices where id=(personal->>'device')::uuid)
  or exists(select 1 from telematics_positions where device_id=(personal->>'device')::uuid)
  or exists(select 1 from telematics_location_sources where vehicle_id=(personal->>'truck')::uuid)
 then raise exception 'PERSONAL_GPS_HISTORY_NOT_ERASED';end if;

 -- An unfinished shipment keeps the existing hold. Preparing this request
 -- must not retire its GPS bindings, history, manual source or pending work.
 perform update_fleet_driver_access((other_owner->>'owner')::uuid,jsonb_build_object('driver_user_id',other_owner->>'owner',
  'vehicle_id',other_owner->>'truck','can_manage_capacity',true,'can_manage_tracking',true));
 perform set_provider_vehicle_publication((other_owner->>'owner')::uuid,(other_owner->>'truck')::uuid,'LIVE');
 select id into origin_ref from place_catalog where normalized_name='addis ababa' limit 1;
 select id into destination_ref from place_catalog where normalized_name='adama' limit 1;
 select id into passing_ref from place_catalog where id not in(origin_ref,destination_ref) order by id limit 1;
 perform create_provider_tracking_with_recipients((other_owner->>'owner')::uuid,jsonb_build_object('id',shipment,
  'code','LGX-'||upper(substr(replace(shipment::text,'-',''),1,8)),'vehicle_id',other_owner->>'truck',
  'origin_place_ref',origin_ref,'destination_place_ref',destination_ref,'passing_place_ref',passing_ref,
  'cargo_summary','Synthetic privacy hold cargo','customer_email','synthetic-privacy-owner@example.test',
  'customer_email_digest',repeat('7',64),'additional_recipients','[]'::jsonb,'expected_delivery_date',(current_date+2)::text,
  'tracking_mode','STATUS_ONLY','tracking_code_hash',repeat('8',64),'review_code_hash',repeat('9',64)));
 request_id:=(request_account_deletion((other_owner->>'owner')::uuid)->>'id')::uuid;
 result:=prepare_account_erasure(admin_id,request_id);
 if result->>'status'<>'HELD' or exists(select 1 from telematics_privacy_jobs where subject_user_id=(other_owner->>'owner')::uuid)
  or before_state is distinct from pg_temp.privacy_snapshot((other_owner->>'device')::uuid,(other_owner->>'truck')::uuid)
 then raise exception 'HELD_TRACKING_MUTATED_GPS';end if;

 -- Employee-only deletion has no employer-owned hardware scope. Use the
 -- real invitation/acceptance commands; no borrowed staff or seeded data.
 insert into auth.users(id,email,email_confirmed_at,last_sign_in_at,raw_user_meta_data)
 values(employee,'privacy-employee-'||employee||'@example.test',now(),now(),'{}');
 perform fleet_accept_invitation(employee,fleet_invite_driver((other_owner->>'owner')::uuid,jsonb_build_object(
  'email','privacy-employee-'||employee||'@example.test','name','Synthetic privacy employee','phone','+251900000154')));
 perform accept_content_policy(employee,'2026-10-09');
 request_id:=(request_account_deletion(employee)->>'id')::uuid;
 result:=prepare_account_erasure(admin_id,request_id);
 if result->>'status'<>'ERASING' or exists(select 1 from telematics_privacy_jobs where subject_user_id=employee)
 then raise exception 'EMPLOYEE_ERASURE_CLAIMED_EMPLOYER_GPS';end if;
 update auth.users set deleted_at=now() where id=employee;
 result:=finish_account_erasure(admin_id,request_id);
 if result->>'status'<>'COMPLETED'
  or before_state is distinct from pg_temp.privacy_snapshot((other_owner->>'device')::uuid,(other_owner->>'truck')::uuid)
  or not exists(select 1 from provider_shipments where id=shipment and operational_status='CREATED')
 then raise exception 'EMPLOYEE_ERASURE_CHANGED_EMPLOYER_HISTORY';end if;

 foreach signature in array array['claim_telematics_privacy_jobs(text)','complete_telematics_privacy_job(text,jsonb)',
  'authorize_telematics_privacy_gateway_request(text,uuid,text,timestamptz)','register_telematics_privacy_agent(uuid,uuid,text)'] loop
  if not has_function_privilege('service_role','public.'||signature,'EXECUTE') then raise exception 'PRIVACY_SERVICE_PORT_MISSING';end if;
  foreach role_name in array array['anon','authenticated'] loop if has_function_privilege(role_name,'public.'||signature,'EXECUTE') then raise exception 'DIRECT_PRIVACY_PORT_EXPOSED';end if;end loop;
 end loop;
 foreach signature in array array['prepare_account_erasure_pre_privacy154(uuid,uuid)','finish_account_erasure_pre_privacy154(uuid,uuid)',
  'deactivate_own_account_pre_privacy154(uuid,text)','provision_telematics_device_pre_privacy154(uuid,jsonb)',
  'ingest_telematics_position_pre_privacy154(text,jsonb)','telematics_effective_location_pre_privacy154(uuid)',
  'telematics_lock_owner_scope(uuid,uuid)','queue_telematics_account_privacy(uuid,uuid,text)','require_distinct_telematics_privacy_credentials()'] loop
  foreach role_name in array array['anon','authenticated','service_role'] loop
   if has_function_privilege(role_name,'public.'||signature,'EXECUTE') then raise exception 'PRIVATE_GPS_PRIVACY_HELPER_EXPOSED';end if;
  end loop;
 end loop;
 if not(select relrowsecurity from pg_class where oid='public.telematics_privacy_jobs'::regclass)
  or has_table_privilege('authenticated','public.telematics_privacy_jobs','SELECT') then raise exception 'PRIVACY_JOB_PRIVATE_ACL';end if;
end $privacy$;
rollback;
