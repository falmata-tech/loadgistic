-- FEAT-SIM-001. Run only on the reviewed isolated LOCAL restore containing the
-- exact normal fixture/device bindings. All changes roll back.
begin;
do $$begin if current_setting('loadgistic.demo_isolated_test',true) is distinct from 'true' then
 raise exception 'ISOLATED_DEMO_TEST_CONTEXT_REQUIRED';end if;end $$;
create function pg_temp.demo_denied(statement text,expected text) returns void language plpgsql as $$
declare denied boolean:=false;
begin
 begin execute statement;exception when others then
  if sqlerrm<>expected then raise exception 'DEMO_EXPECTED_%_GOT_%',expected,sqlerrm;end if;denied:=true;
 end;
 if not denied then raise exception 'DEMO_DENIAL_MISSING_%',expected;end if;
end $$;
do $test$
declare company uuid:='caf1d0db-4d8e-4ce9-a879-6c7b6017de3a';personal uuid:='2f22cc5a-d654-4405-98b7-9a1a9cf42fe3';
 context jsonb;owner_id uuid;driver_id uuid;device_id uuid;gateway_digest text;lease jsonb;old_lease jsonb;sample jsonb;input jsonb;
 result jsonb;before_capacity jsonb;before_sources jsonb;before_users bigint;before_positions bigint;original_metadata jsonb;nonce uuid:=gen_random_uuid();
begin
 select count(*) into before_users from profiles;
 select jsonb_agg(to_jsonb(s) order by vehicle_id) into before_sources from telematics_location_sources s;
 -- This transaction starts from disabled arbitration, never resets user data.
 delete from demo_motion_targets;
 perform pg_temp.demo_denied(format('select configure_demo_motion_target(%L)',gen_random_uuid()),'DEMO_TARGET_DENIED');
 perform pg_temp.demo_denied(format('select start_demo_motion(%L,60,false)',company),'DEMO_TARGET_NOT_CONFIGURED');
 context:=public.demo_motion_binding(company);owner_id:=(context->>'ownerId')::uuid;driver_id:=(context->>'driverId')::uuid;device_id:=(context->>'deviceId')::uuid;
 if context->>'source'<>'GPS' then raise exception 'ISOLATED_COMPANY_FIXTURE_MUST_ALREADY_SELECT_GPS';end if;
 result:=configure_demo_motion_target(company);if result->>'state'<>'OFF' then raise exception 'DEMO_MUST_DEFAULT_OFF';end if;
 lease:=start_demo_motion(company,60,false);
 perform pg_temp.demo_denied(format('select start_demo_motion(%L,60,false)',company),'DEMO_RUNNER_ALREADY_ACTIVE');
 perform pg_temp.demo_denied(format('select reserve_demo_gps_tick(%L,%L,%s,9.031,38.748)',company,gen_random_uuid(),lease->>'epoch'),'DEMO_REPORT_DENIED');
 -- Reserve a current protocol sample under the current generation. No simulator
 -- process or gateway is invoked by this SQL transaction.
 update demo_motion_targets set generation_started_at=clock_timestamp()-interval '2 seconds' where vehicle_id=company;
 sample:=reserve_demo_gps_tick(company,(lease->>'leaseId')::uuid,(lease->>'epoch')::bigint,9.031,38.748);
 select g.token_digest into gateway_digest from telematics_gateways g join telematics_devices d on d.gateway_id=g.id where d.id=device_id;
 select jsonb_build_object('eventKey','demo-test:'||gen_random_uuid(),'gatewayDeviceId',d.gateway_device_id,'protocol',d.protocol,'protocolDeviceId',d.protocol_device_id,
  'observedAt',sample->>'observedAt','receivedAt',clock_timestamp(),'valid',true,'latitude',(sample->>'latitude')::double precision,
  'longitude',(sample->>'longitude')::double precision,'speedKph',20,'course',0,'attributes',jsonb_build_object('ignition',true)) into input
  from telematics_devices d where d.id=device_id;
 result:=ingest_telematics_position(gateway_digest,input);
 if result->>'outcome' not in('ACCEPTED','HISTORICAL') then raise exception 'DEMO_GPS_NOT_RECORDED';end if;
 if not exists(select 1 from telematics_positions where event_key=input->>'eventKey' and demo_epoch=(lease->>'epoch')::bigint) then raise exception 'DEMO_GPS_PROVENANCE_MISSING';end if;
 result:=ingest_telematics_position(gateway_digest,input);if result->>'outcome'<>'DUPLICATE' then raise exception 'DEMO_DUPLICATE_FAILED';end if;
 -- Altered immutable fixture metadata is not a simulator target even if its
 -- email/vehicle/device remain the same.
 select raw_app_meta_data into original_metadata from auth.users where id=owner_id;
 update auth.users set raw_app_meta_data='{}' where id=owner_id;
 perform pg_temp.demo_denied(format('select reserve_demo_gps_tick(%L,%L,%s,9.031,38.748)',company,lease->>'leaseId',lease->>'epoch'),'DEMO_TARGET_DENIED');
 update auth.users set raw_app_meta_data=original_metadata where id=owner_id;
 -- Takeover is sticky; an old command and queued decoded sample are both denied.
 result:=note_real_location_device_use(driver_id,company,gen_random_uuid());
 if result->>'state'<>'REAL' then raise exception 'REAL_TAKEOVER_MISSING';end if;
 perform pg_temp.demo_denied(format('select reserve_demo_gps_tick(%L,%L,%s,9.031,38.748)',company,lease->>'leaseId',lease->>'epoch'),'DEMO_REPORT_DENIED');
 select count(*) into before_positions from telematics_positions;
 perform pg_temp.demo_denied(format('select ingest_telematics_position(%L,%L::jsonb)',gateway_digest,input),'TELEMETRY_BINDING_DENIED');
 if(select count(*) from telematics_positions)<>before_positions then raise exception 'QUEUED_GPS_MUTATED';end if;
 result:=stop_demo_motion(company,(lease->>'leaseId')::uuid,(lease->>'epoch')::bigint);if result->>'state'<>'REAL' then raise exception 'STOP_CLEARED_REAL';end if;
 perform pg_temp.demo_denied(format('select start_demo_motion(%L,60,false)',company),'DEMO_REAL_DEVICE_TAKEOVER');
 -- No phone binding exists in this isolated fixture.157's helper, if installed,
 -- must independently confirm that before explicit resume.
 old_lease:=lease;lease:=start_demo_motion(company,60,true);
 if(lease->>'epoch')::bigint<=(old_lease->>'epoch')::bigint then raise exception 'DEMO_RESUME_REUSED_EPOCH';end if;
 perform pg_temp.demo_denied(format('select reserve_demo_gps_tick(%L,%L,%s,9.031,38.748)',company,old_lease->>'leaseId',old_lease->>'epoch'),'DEMO_REPORT_DENIED');
 perform pg_temp.demo_denied(format('select ingest_telematics_position(%L,%L::jsonb)',gateway_digest,input),'TELEMETRY_BINDING_DENIED');
 result:=stop_demo_motion(company,(old_lease->>'leaseId')::uuid,(old_lease->>'epoch')::bigint);if result->>'state'<>'RUNNING' then raise exception 'OLD_RUNNER_STOPPED_NEW_LEASE';end if;
 -- Manual edits remain dated/static and cannot be resumed as movement.
 update telematics_location_sources set source='MANUAL',manual_latitude=9.03,manual_longitude=38.75,revision=clock_timestamp() where vehicle_id=company;
 if(demo_motion_status(company)->>'state')<>'REAL' then raise exception 'SOURCE_CHANGE_DID_NOT_PAUSE';end if;
 perform pg_temp.demo_denied(format('select start_demo_motion(%L,60,true)',company),'DEMO_MANUAL_SOURCE_STATIC');

 context:=public.demo_motion_binding(personal);
 if context->>'source'<>'MOBILE' then raise exception 'ISOLATED_PERSONAL_FIXTURE_MUST_ALREADY_SELECT_PHONE';end if;
 result:=configure_demo_motion_target(personal);lease:=start_demo_motion(personal,60,false);
 select to_jsonb(c) into before_capacity from capacities c where vehicle_id=personal order by updated_at desc,id desc limit 1;
 result:=report_demo_phone_location(personal,(lease->>'leaseId')::uuid,(lease->>'epoch')::bigint,9.03,38.76);
 if result->>'recorded'<>'true' then raise exception 'DEMO_PHONE_NOT_RECORDED';end if;
 if not exists(select 1 from vehicle_driver_locations where vehicle_id=personal and demo_epoch=(lease->>'epoch')::bigint) then raise exception 'DEMO_PHONE_PROVENANCE_MISSING';end if;
 if not exists(select 1 from capacities where vehicle_id=personal and demo_epoch=(lease->>'epoch')::bigint
  and location_precision_km=(before_capacity->>'location_precision_km')::integer) then raise exception 'DEMO_PHONE_RADIUS_OR_PROVENANCE_CHANGED';end if;
 perform pg_temp.demo_denied(format('select report_demo_phone_location(%L,%L,%s,30,30)',personal,lease->>'leaseId',lease->>'epoch'),'DEMO_REPORT_DENIED');
 update demo_motion_targets set expires_at=clock_timestamp()-interval '1 second' where vehicle_id=personal;
 perform pg_temp.demo_denied(format('select report_demo_phone_location(%L,%L,%s,9.03,38.76)',personal,lease->>'leaseId',lease->>'epoch'),'DEMO_REPORT_DENIED');
 if(select count(*) from profiles)<>before_users then raise exception 'DEMO_CREATED_CUSTOMER';end if;
 perform authorize_demo_motion_request(nonce);
 perform pg_temp.demo_denied(format('select authorize_demo_motion_request(%L)',nonce),'DEMO_REQUEST_DENIED');
 -- New control authority and raw epochs have no direct visitor/member grants.
 if has_function_privilege('anon','public.start_demo_motion(uuid,integer,boolean)','EXECUTE')
  or has_function_privilege('authenticated','public.report_demo_phone_location(uuid,uuid,bigint,double precision,double precision)','EXECUTE')
  or has_function_privilege('service_role','public.demo_motion_binding(uuid)','EXECUTE')
  or has_function_privilege('service_role','public.ingest_telematics_position_pre_demo156(text,jsonb)','EXECUTE')
  or has_table_privilege('authenticated','public.demo_motion_targets','SELECT') then raise exception 'DEMO_AUTHORITY_EXPOSED';end if;
end $test$;
rollback;
