-- FEAT-GPS-001 / ADR-080. Own synthetic identities/devices; every write rolls back.
begin;
create function pg_temp.gps_denied(statement text,expected text) returns void language plpgsql as $$
declare denied boolean:=false;before_state jsonb;
begin
 select jsonb_build_object('devices',(select jsonb_agg(to_jsonb(d) order by id) from telematics_devices d),
  'positions',(select jsonb_agg(to_jsonb(p) order by id) from telematics_positions p),
  'commands',(select jsonb_agg(to_jsonb(c) order by id) from telematics_commands c),
  'audit',(select count(*) from audit_logs)) into before_state;
 begin execute statement;exception when others then if sqlerrm<>expected then raise;end if;denied:=true;end;
 if not denied then raise exception 'TELEMATICS_DENIAL_MISSING: %',expected;end if;
 if before_state is distinct from jsonb_build_object('devices',(select jsonb_agg(to_jsonb(d) order by id) from telematics_devices d),
  'positions',(select jsonb_agg(to_jsonb(p) order by id) from telematics_positions p),
  'commands',(select jsonb_agg(to_jsonb(c) order by id) from telematics_commands c),'audit',(select count(*) from audit_logs))
  then raise exception 'TELEMATICS_DENIAL_MUTATED_STATE: %',expected;end if;
end $$;
do $test$
declare owner_id uuid:=gen_random_uuid();other_owner uuid:=gen_random_uuid();employee uuid:=gen_random_uuid();admin_id uuid:=gen_random_uuid();
 org_id uuid:=gen_random_uuid();other_org uuid:=gen_random_uuid();gateway_id uuid:=gen_random_uuid();real_gateway uuid:=gen_random_uuid();
 digest text:=encode(extensions.digest(gen_random_uuid()::text,'sha256'),'hex');real_digest text:=encode(extensions.digest(gen_random_uuid()::text,'sha256'),'hex');
 truck uuid;other_truck uuid;replacement uuid;device uuid;real_device uuid;revision text;selection_revision text;capacity_id uuid;
 result jsonb;command jsonb;fix jsonb;rows jsonb;job jsonb;step jsonb;engine_command jsonb;published jsonb;old_assignment uuid;
 stamp timestamptz;nonce uuid:=gen_random_uuid();location_time timestamptz;
begin
 insert into auth.users(id,email,email_confirmed_at,last_sign_in_at,raw_app_meta_data,raw_user_meta_data) values
  (owner_id,'falmatad97+gps-owner-'||owner_id||'@gmail.com',now(),now(),'{"fixture_source":"loadgistic"}','{"fixture_key":"user-transporter"}'),
  (other_owner,'falmatad97+gps-other-'||other_owner||'@gmail.com',now(),now(),'{"fixture_source":"loadgistic"}','{"fixture_key":"user-transporter"}'),
  (employee,'gps-employee-'||employee||'@loadgistic.local',now(),now(),'{"fixture_source":"loadgistic"}','{}'),
  (admin_id,'gps-admin-'||admin_id||'@loadgistic.local',now(),now(),'{"fixture_source":"loadgistic"}','{}');
 update profiles set role='TRANSPORTER',active=true,drives_truck=true where id=owner_id;
 update profiles set role='TRANSPORTER',active=true,drives_truck=false where id=other_owner;
 update profiles set role='ADMIN',active=true where id=admin_id;
 insert into organizations(id,name,handle,type,city,city_place_ref,public_visibility) values
  (org_id,'Synthetic GPS owner','gps-'||org_id,'TRANSPORT_COMPANY','Addis Ababa',(select id from place_catalog where normalized_name='addis ababa' limit 1),'PUBLIC'),
  (other_org,'Synthetic other GPS owner','gps-'||other_org,'TRANSPORT_COMPANY','Addis Ababa',(select id from place_catalog where normalized_name='addis ababa' limit 1),'PUBLIC');
 insert into organization_members(user_id,organization_id,membership_role) values(owner_id,org_id,'OWNER'),(other_owner,other_org,'OWNER');
 insert into company_pages(organization_id,published,base_region_code,contact_phone,show_contact_phone)
 values(org_id,true,'ADDIS_ABABA','+251900000151',true);
 perform accept_content_policy(owner_id,'2026-10-09');perform accept_content_policy(other_owner,'2026-10-09');
 perform fleet_accept_invitation(employee,fleet_invite_driver(owner_id,jsonb_build_object('email','gps-employee-'||employee||'@loadgistic.local','name','Synthetic GPS employee','phone','+251900000152')));
 truck:=(create_provider_vehicle(owner_id,'{"make":"Synthetic","model":"GPS truck","plate":"GPS-151-ONE","cargo_configuration":"Mini Box Truck","use_basis":"OWNED"}')->>'id')::uuid;
 replacement:=(create_provider_vehicle(owner_id,'{"make":"Synthetic","model":"Replacement GPS truck","plate":"GPS-151-TWO","cargo_configuration":"Mini Box Truck","use_basis":"OWNED"}')->>'id')::uuid;
 other_truck:=(create_provider_vehicle(other_owner,'{"make":"Synthetic","model":"Other GPS truck","plate":"GPS-151-OTHER","cargo_configuration":"Mini Box Truck","use_basis":"OWNED"}')->>'id')::uuid;
 perform update_fleet_driver_access(owner_id,jsonb_build_object('driver_user_id',owner_id,'vehicle_id',truck,'can_manage_capacity',true,'can_manage_tracking',true));
 perform set_provider_vehicle_publication(owner_id,truck,'LIVE');
 command:=jsonb_build_object('vehicle_id',truck,'status','EMPTY','accepted_loads','BOTH','availability_geometry','ROUTE','visibility','OPEN',
  'location_source','DEVICE_OBSCURED','approximate_lat',9.03,'approximate_lng',38.76,'location_precision_km',20,
  'current_route_places',jsonb_build_array(jsonb_build_object('place_ref',(select id from place_catalog where name='Sebeta' limit 1)),jsonb_build_object('place_ref',(select id from place_catalog where name='Alem Gena' limit 1))));
 capacity_id:=publish_provider_capacity(owner_id,command);
 perform register_telematics_gateway(admin_id,gateway_id,'Synthetic test gateway',digest,true);
 perform register_telematics_gateway(admin_id,real_gateway,'Unverified real test gateway',real_digest,false);
 command:=jsonb_build_object('gatewayId',gateway_id,'gatewayDeviceId',151,'imei','990000000000151','protocol','gt06','protocolDeviceId','990000000000151',
  'ownerOrganizationId',org_id,'label','Synthetic test GPS','synthetic',true,'modelProfile','SYNTHETIC_GT06');
 perform pg_temp.gps_denied(format('select provision_telematics_device(%L,%L::jsonb)',owner_id,command),'FORBIDDEN');
 update auth.users set raw_app_meta_data='{}' where id=owner_id;
 perform pg_temp.gps_denied(format('select provision_telematics_device(%L,%L::jsonb)',admin_id,command),'DEVICE_OWNER_INVALID');
 update auth.users set raw_app_meta_data='{"fixture_source":"loadgistic"}',raw_user_meta_data='{"fixture_key":"unknown-customer"}' where id=owner_id;
 perform pg_temp.gps_denied(format('select provision_telematics_device(%L,%L::jsonb)',admin_id,command),'DEVICE_OWNER_INVALID');
 update auth.users set raw_user_meta_data='{"fixture_key":"user-transporter"}',email='gps-denied-'||owner_id||'@example.invalid' where id=owner_id;
 perform pg_temp.gps_denied(format('select provision_telematics_device(%L,%L::jsonb)',admin_id,command),'DEVICE_OWNER_INVALID');
 update auth.users set email='falmatad97+gps-owner-'||owner_id||'@gmail.com' where id=owner_id;
 result:=provision_telematics_device(admin_id,command);device:=(result->>'id')::uuid;revision:=result->>'revision';
 perform pg_temp.gps_denied(format('select provision_telematics_device(%L,%L::jsonb)',admin_id,command),'DEVICE_BINDING_CONFLICT');
 result:=provision_telematics_device(admin_id,command||jsonb_build_object('gatewayId',real_gateway,'gatewayDeviceId',152,'imei','990000000000152','protocolDeviceId','990000000000152','synthetic',false,'modelProfile','UNVERIFIED'));
 real_device:=(result->>'id')::uuid;
 command:=jsonb_build_object('deviceId',device,'vehicleId',truck,'expectedRevision',revision);
 perform pg_temp.gps_denied(format('select assign_telematics_device(%L,%L::jsonb)',other_owner,command),'NOT_FOUND');
 perform pg_temp.gps_denied(format('select assign_telematics_device(%L,%L::jsonb)',employee,command),'FORBIDDEN');
 perform pg_temp.gps_denied(format('select assign_telematics_device(%L,%L::jsonb)',owner_id,command||jsonb_build_object('vehicleId',other_truck)),'NOT_FOUND');
 result:=assign_telematics_device(owner_id,command);revision:=result->>'revision';
 perform pg_temp.gps_denied(format('select assign_telematics_device(%L,%L::jsonb)',owner_id,command),'TELEMATICS_CHANGED');
 select id into old_assignment from telematics_device_assignments where device_id=device and ended_at is null;
 result:=select_telematics_location_source(owner_id,jsonb_build_object('vehicleId',truck,'source','GPS','precisionKm',20,'expectedRevision','1970-01-01T00:00:00Z'));
 selection_revision:=result->>'revision';
 select payload into published from public_capacity_page(jsonb_build_object('capacity_id',capacity_id));
 if published->>'location_source' is distinct from 'DEVICE_OBSCURED' then raise exception 'PENDING_GPS_RELABELLED_PHONE';end if;
 stamp:=clock_timestamp();fix:=jsonb_build_object('eventKey','test:first','gatewayDeviceId',151,'protocol','gt06','protocolDeviceId','990000000000151',
  'observedAt',stamp,'receivedAt',stamp,'valid',true,'latitude',9.031,'longitude',38.748,'speedKph',0,'course',0,'attributes',jsonb_build_object('ignition',false,'battery',80,'alarm','vibration'));
 result:=ingest_telematics_position(digest,fix);
 if result->>'outcome' is distinct from 'ACCEPTED' then raise exception 'GPS_FIX_NOT_APPLIED';end if;
 if ingest_telematics_position(digest,fix)->>'outcome' is distinct from 'DUPLICATE' then raise exception 'GPS_REPLAY_NOT_IDEMPOTENT';end if;
 perform pg_temp.gps_denied(format('select ingest_telematics_position(%L,%L::jsonb)',digest,fix||'{"latitude":9.1}'),'TELEMETRY_EVENT_CONFLICT');
 perform pg_temp.gps_denied(format('select ingest_telematics_position(%L,%L::jsonb)',digest,fix||'{"gatewayDeviceId":999}'),'TELEMETRY_BINDING_DENIED');
 perform pg_temp.gps_denied(format('select ingest_telematics_position(%L,%L::jsonb)',digest,fix||jsonb_build_object('observedAt',stamp+interval '3 minutes')),'TELEMETRY_TIME_INVALID');
 result:=ingest_telematics_position(digest,fix||jsonb_build_object('eventKey','test:late','observedAt',stamp-interval '1 minute'));
 if result->>'outcome' is distinct from 'HISTORICAL' then raise exception 'LATE_FIX_APPLIED';end if;
 select payload into published from public_capacity_page(jsonb_build_object('capacity_id',capacity_id));
 if published->>'location_source' is distinct from 'TELEMATICS' or published::text like '%990000000000151%' or published ? 'speedKph' or published ? 'attributes'
  or exists(select 1 from capacities where id=capacity_id and location_lat=9.031 and location_lng=38.748) then raise exception 'PUBLIC_GPS_PRIVACY_BROKEN';end if;
 rows:=telematics_workspace(owner_id,1);
 if rows->'devices'->0->'position'->>'alarm' is distinct from 'vibration' then raise exception 'PRIVATE_ALARM_MISSING';end if;
 perform grant_private_capacity_access(owner_id,truck,'gps-recipient@example.invalid',repeat('d',64));
 select payload into rows from private_capacity_filtered_page('EMAIL',repeat('d',64),null,null,null,100,'{}') r where r.payload->>'vehicle_id'=truck::text;
 if rows is null or rows->>'location_source' is distinct from 'TELEMATICS' or rows::text like '%990000000000151%'
  or rows ? 'manualPoint' or rows ? 'speedKph' or rows ? 'attributes'
  or(rows->>'location_lat'='9.031' and rows->>'location_lng'='38.748') then raise exception 'RECIPIENT_GPS_PROVENANCE_OR_PRIVACY';end if;
 select payload into rows from capacity_search_private_rows('EMAIL',repeat('d',64),null,null,null,100,'{}') r where r.payload->>'vehicle_id'=truck::text;
 if rows is null or rows->>'location_source' is distinct from 'TELEMATICS' then raise exception 'RECIPIENT_SEARCH_GPS_SOURCE_MISSING';end if;
 if exists(select 1 from private_capacity_filtered_page('EMAIL',repeat('e',64),null,null,null,100,'{}') r where r.payload->>'vehicle_id'=truck::text)
  then raise exception 'UNAUTHORIZED_GPS_RECIPIENT_VISIBLE';end if;
 perform pg_temp.gps_denied(format('select telematics_workspace(%L,1)',employee),'FORBIDDEN');
 if jsonb_array_length(telematics_workspace(other_owner,1)->'devices')<>0 then raise exception 'CROSS_OWNER_DEVICE_VISIBLE';end if;
 command:=jsonb_build_object('deviceId',real_device,'command','LOCATE','idempotencyKey',gen_random_uuid());
 perform pg_temp.gps_denied(format('select request_telematics_command(%L,%L::jsonb)',owner_id,command),'DEVICE_COMMAND_UNSUPPORTED');
 perform pg_temp.gps_denied(format('select request_telematics_command(%L,%L::jsonb)',owner_id,command||'{"command":"ENGINE_CUT"}'),'ENGINE_CONTROL_UNAVAILABLE');
 command:=jsonb_build_object('deviceId',device,'command','LOCATE','idempotencyKey',gen_random_uuid());
 result:=request_telematics_command(owner_id,command);
 if request_telematics_command(owner_id,command)->>'id' is distinct from result->>'id' then raise exception 'COMMAND_REPLAY_DUPLICATED';end if;
 perform pg_temp.gps_denied(format('select request_telematics_command(%L,%L::jsonb)',owner_id,command||'{"command":"REBOOT"}'),'COMMAND_CHANGED');
 rows:=claim_telematics_commands(digest);if jsonb_array_length(rows)<>1 then raise exception 'COMMAND_NOT_CLAIMED';end if;job:=rows->0;
 result:=record_telematics_command_result(digest,jsonb_build_object('commandId',job->>'id','leaseId',job->>'leaseId','state','DISPATCHED'));
 if result->>'state' is distinct from 'DISPATCHED' then raise exception 'HTTP_DISPATCH_CALLED_ACK';end if;
 result:=record_telematics_command_result(digest,jsonb_build_object('commandId',job->>'id','leaseId',job->>'leaseId','state','ACKNOWLEDGED','correlated',true,'eventKey','test:ack'));
 if result->>'state' is distinct from 'ACKNOWLEDGED' then raise exception 'CORRELATED_ACK_MISSING';end if;
 step:=authorize_synthetic_engine_command(owner_id,jsonb_build_object('deviceId',device,'vehicleId',truck,'command','ENGINE_CUT'));
 engine_command:=jsonb_build_object('deviceId',device,'command','ENGINE_CUT','confirmed',true,'stepUpId',step->>'id','idempotencyKey',gen_random_uuid());
 perform request_telematics_command(owner_id,engine_command);
 perform pg_temp.gps_denied(format('select request_telematics_command(%L,%L::jsonb)',owner_id,engine_command||jsonb_build_object('idempotencyKey',gen_random_uuid())),'ENGINE_STEP_UP_REQUIRED');
 result:=assign_telematics_device(owner_id,jsonb_build_object('deviceId',device,'vehicleId',replacement,'expectedRevision',revision));
 if exists(select 1 from telematics_commands c where c.device_id=device and c.command='ENGINE_CUT' and c.state<>'FAILED') then raise exception 'MOVED_ENGINE_COMMAND_STILL_PENDING';end if;
 if public.telematics_effective_location(replacement) is not null then raise exception 'OLD_FIX_FOLLOWED_MOVED_DEVICE';end if;
 result:=ingest_telematics_position(digest,fix||jsonb_build_object('eventKey','test:old-epoch'));
 if exists(select 1 from telematics_positions where event_key='test:old-epoch' and vehicle_id is not null) then raise exception 'OLD_EPOCH_FIX_REASSIGNED';end if;
 result:=select_telematics_location_source(owner_id,jsonb_build_object('vehicleId',truck,'source','MANUAL','precisionKm',20,'manualLatitude',51.5,'manualLongitude',-0.1,'expectedRevision',selection_revision));
 select item->'selection'->'manualPoint' into rows from jsonb_array_elements(telematics_workspace(owner_id,1)->'vehicles') item where item->>'id'=truck::text;
 if rows is distinct from '{"latitude":51.5,"longitude":-0.1}'::jsonb then raise exception 'SAVED_PRIVATE_MANUAL_POINT_MISSING';end if;
 if exists(select 1 from jsonb_array_elements(telematics_workspace(other_owner,1)->'vehicles') item where item->>'id'=truck::text)
  then raise exception 'SAVED_MANUAL_POINT_CROSS_OWNER';end if;
 select payload into published from public_capacity_page(jsonb_build_object('capacity_id',capacity_id));
 if published::text like '%manualPoint%' or published::text like '%manual_latitude%'
  then raise exception 'SAVED_MANUAL_POINT_PUBLIC_LEAK';end if;
 select location_updated_at into location_time from capacities where id=capacity_id;
 perform pg_temp.gps_denied(format('select refresh_provider_capacity_location(%L,%L::jsonb)',owner_id,
  jsonb_build_object('vehicle_id',truck,'location_source','DEVICE_OBSCURED','approximate_lat',8.5,'approximate_lng',39.2,'location_precision_km',20)),'PHONE_LOCATION_UNAVAILABLE');
 if not exists(select 1 from capacities where id=capacity_id and location_source='MANUAL_ADMIN' and location_updated_at=location_time)
  then raise exception 'UNSELECTED_PHONE_OVERWROTE_MANUAL';end if;
 perform authorize_telematics_gateway_request(digest,nonce,repeat('a',64),clock_timestamp());
 perform pg_temp.gps_denied(format('select authorize_telematics_gateway_request(%L,%L,%L,clock_timestamp())',digest,nonce,repeat('a',64)),'GATEWAY_UNAVAILABLE');
 if exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname like 'telematics_%' and c.relkind='r' and not c.relrowsecurity)
  or has_function_privilege('authenticated','public.ingest_telematics_position(text,jsonb)','execute')
  or has_table_privilege('authenticated','public.telematics_positions','select') then raise exception 'TELEMATICS_PRIVATE_ACL_BROKEN';end if;
end $test$;
rollback;
