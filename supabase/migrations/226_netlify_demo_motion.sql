-- FEAT-SIM-001: direct fictional movement, separate from decoded GT06 history.
begin;
set local lock_timeout='5s';
set local statement_timeout='60s';

alter table public.telematics_gateways add column synthetic_transport text not null default 'PROTOCOL'
 check(synthetic_transport in('PROTOCOL','NETLIFY_DEMO')),
 add constraint telematics_direct_demo_only226 check(synthetic_transport='PROTOCOL' or synthetic_only);
alter table public.telematics_positions add column synthetic_transport text not null default 'PROTOCOL'
 check(synthetic_transport in('PROTOCOL','NETLIFY_DEMO'));
create index telematics_positions_gateway_retention226 on public.telematics_positions(gateway_id,created_at,id);
alter table public.demo_hosted_motion_control add column netlify_enabled boolean not null default false;
alter table public.demo_motion_targets add column netlify_owned boolean not null default false;

create table public.demo_motion_netlify_window(
 id integer primary key check(id=1),run_id uuid,expires_at timestamptz,
 check((run_id is null)=(expires_at is null))
);
insert into public.demo_motion_netlify_window(id) values(1);
alter table public.demo_motion_netlify_window enable row level security;
revoke all on public.demo_motion_netlify_window from public,anon,authenticated,service_role;

-- An ordinary gateway cannot impersonate a direct demo producer. The retained
-- leaf is private even to service_role; only security-definer ports call it.
alter function public.ingest_telematics_position(text,jsonb) rename to ingest_telematics_position_pre_netlify226;
revoke all on function public.ingest_telematics_position_pre_netlify226(text,jsonb) from public,anon,authenticated,service_role;
create function public.ingest_telematics_position(gateway_digest text,command jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if exists(select 1 from public.telematics_gateways g where g.token_digest=gateway_digest
  and g.synthetic_transport='NETLIFY_DEMO') then raise exception 'TELEMETRY_BINDING_DENIED';end if;
 return public.ingest_telematics_position_pre_netlify226(gateway_digest,command);
end $$;
revoke all on function public.ingest_telematics_position(text,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.ingest_telematics_position(text,jsonb) to service_role;

create function public.stop_netlify_demo_motion226()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if not new.netlify_enabled then
  update public.demo_motion_netlify_window set run_id=null,expires_at=null where id=1;
  update public.demo_motion_targets set state='OFF',epoch=epoch+1,lease_id=null,expires_at=null,
   reason='NETLIFY_DISABLED',updated_at=clock_timestamp() where netlify_owned and state='RUNNING';
 end if;
 return new;
end $$;
create trigger netlify_demo_motion_stopped226 after update of netlify_enabled
 on public.demo_hosted_motion_control for each row execute function public.stop_netlify_demo_motion226();
revoke all on function public.stop_netlify_demo_motion226() from public,anon,authenticated,service_role;

-- No actor, vehicle, source, device, ingest destination or mutation clock is
-- caller-selected. Application code derives report geometry from the catalog.
create function public.netlify_demo_motion_command(request_nonce uuid,run_id uuid,target_name text,command jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare action text;active boolean;window_row public.demo_motion_netlify_window%rowtype;
 target_id uuid;context jsonb;saved public.demo_motion_targets%rowtype;
 gateway public.telematics_gateways%rowtype;device public.telematics_devices%rowtype;
 result jsonb;reserved jsonb;position jsonb;report_event_key text;stamp timestamptz;captured timestamptz;lat double precision;lng double precision;
 maintenance record;claim_started_at timestamptz:=clock_timestamp();
begin
 if request_nonce is null or run_id is null or command is null or jsonb_typeof(command)<>'object'
  then raise exception 'DEMO_HOSTED_INPUT_DENIED';end if;
 action:=command->>'action';
 if action not in('CLAIM','PREPARE','REPORT') or action is null then raise exception 'DEMO_HOSTED_INPUT_DENIED';end if;
 select enabled and not kill_switch and netlify_enabled into active
  from public.demo_hosted_motion_control where id=1 for share;
 if not coalesce(active,false) then raise exception 'DEMO_HOSTED_DISABLED';end if;
 if action='CLAIM' then
  if target_name is not null or command<>jsonb_build_object('action','CLAIM') then raise exception 'DEMO_HOSTED_INPUT_DENIED';end if;
  perform public.authorize_demo_motion_request(request_nonce);
  select * into window_row from public.demo_motion_netlify_window where id=1 for update;
  if window_row.expires_at>clock_timestamp() then return jsonb_build_object('claimed',false);end if;
  -- Replace the retired bridge's bounded maintenance, retaining its existing
  -- 30-day policy. Real/protocol gateways are outside this direct-demo lane.
  for maintenance in select g.token_digest from public.telematics_gateways g
   where g.active and g.synthetic_only and g.synthetic_transport='NETLIFY_DEMO' order by g.id limit 10 loop
   perform public.prune_telematics_history(maintenance.token_digest);
  end loop;
  update public.demo_motion_netlify_window w set run_id=netlify_demo_motion_command.run_id,
   expires_at=claim_started_at+interval '55 seconds' where id=1 returning * into window_row;
  return jsonb_build_object('claimed',true,'expiresAt',window_row.expires_at);
 end if;
 select * into window_row from public.demo_motion_netlify_window where id=1 for share;
 if window_row.run_id is distinct from run_id or window_row.expires_at<=clock_timestamp()
  then raise exception 'DEMO_NETLIFY_WINDOW_DENIED';end if;
 select approved.vehicle_id into target_id from (values
  ('company-truck','caf1d0db-4d8e-4ce9-a879-6c7b6017de3a'::uuid),
  ('personal-truck','2f22cc5a-d654-4405-98b7-9a1a9cf42fe3'::uuid),
  ('fleet-01','2020967a-92d3-4b1d-8f40-3c670dc97a50'::uuid),
  ('fleet-02','19838ed9-c898-43dd-a6d5-5d4c26d0e92d'::uuid),
  ('fleet-03','2c449a7d-d26d-4eeb-aa64-7f4ba9f33c9d'::uuid),
  ('fleet-04','0088dba7-04c7-425e-b5a9-64b721a753f0'::uuid),
  ('fleet-05','5bf57d7a-2159-45f9-9f90-3cdef5ed43d8'::uuid),
  ('fleet-06','0dc90cf6-7735-4ccc-b030-98a81c40ffd6'::uuid),
  ('fleet-07','02c0a10d-3b4b-4b83-9f85-6272f8b6ce95'::uuid),
  ('fleet-08','28b05503-eb24-4b78-8646-6a1813207813'::uuid)
 ) approved(name,vehicle_id) where approved.name=target_name;
 if target_id is null then raise exception 'DEMO_TARGET_DENIED';end if;
 if action='PREPARE' and command<>jsonb_build_object('action','PREPARE')
  or action='REPORT' and ((select count(*) from jsonb_object_keys(command))<>6
   or not(command ?& array['action','latitude','longitude','speedKph','course','capturedAt'])) then raise exception 'DEMO_HOSTED_INPUT_DENIED';end if;
 perform public.authorize_demo_motion_request(request_nonce);
 -- Match existing owner -> device -> vehicle -> target lock order.
 context:=public.demo_motion_binding(target_id);
 select d.* into device from public.telematics_devices d where d.id=(context->>'deviceId')::uuid;
 select * into gateway from public.telematics_gateways g where g.id=device.gateway_id and g.active
  and g.synthetic_only and g.synthetic_transport='NETLIFY_DEMO';
 if not found or not device.synthetic then raise exception 'DEMO_TARGET_DENIED';end if;
 if action='PREPARE' then
  perform public.hosted_demo_motion_command(gen_random_uuid(),target_id,jsonb_build_object('action','CONFIGURE','target',target_name));
  select * into saved from public.demo_motion_targets where vehicle_id=target_id for update;
  if saved.state='REAL' then raise exception 'DEMO_REAL_DEVICE_TAKEOVER';end if;
  if saved.state='RUNNING' and saved.expires_at>clock_timestamp() then
   if not saved.netlify_owned then raise exception 'DEMO_RUNNER_ALREADY_ACTIVE';end if;
   perform public.demo_motion_lease(target_id,saved.lease_id,saved.epoch,saved.source);
  else
   perform public.hosted_demo_motion_command(gen_random_uuid(),target_id,jsonb_build_object('action','START','target',target_name,'seconds',900));
   update public.demo_motion_targets set netlify_owned=true where vehicle_id=target_id;
   select * into saved from public.demo_motion_targets where vehicle_id=target_id;
  end if;
  return jsonb_build_object('ready',true,'dueAt',greatest(coalesce(saved.last_observed_at+interval '30 seconds',
   saved.generation_started_at+interval '1100 milliseconds'),clock_timestamp()));
 end if;
 select * into saved from public.demo_motion_targets where vehicle_id=target_id for update;
 if not found or not saved.hosted or not saved.netlify_owned then raise exception 'DEMO_TARGET_DENIED';end if;
 perform public.demo_motion_lease(target_id,saved.lease_id,saved.epoch,saved.source);
 begin captured:=(command->>'capturedAt')::timestamptz;
 exception when others then raise exception 'DEMO_MOTION_REPORT_DENIED';end;
 if captured is null or abs(extract(epoch from(clock_timestamp()-captured)))>5
  then raise exception 'DEMO_MOTION_REPORT_DENIED';end if;
 if saved.last_observed_at>clock_timestamp()-interval '30 seconds' then
  return jsonb_build_object('recorded',false,'dueAt',saved.last_observed_at+interval '30 seconds');end if;
 if saved.source='MOBILE' then
  result:=public.hosted_demo_motion_command(gen_random_uuid(),target_id,jsonb_build_object('action','PHONE','target',target_name,
   'leaseId',saved.lease_id,'epoch',saved.epoch,'latitude',command->'latitude','longitude',command->'longitude'));
 elsif saved.source='GPS' then
  -- Capture time is generated by the application, not supplied by the worker.
  -- Keep the same lease, area and GT06 quantization limits, without claiming a
  -- decoded packet or relabelling a queued point with database arrival time.
  context:=public.demo_motion_lease(target_id,saved.lease_id,saved.epoch,'GPS');
  stamp:=date_trunc('second',captured);
  lat:=(command->>'latitude')::double precision;lng:=(command->>'longitude')::double precision;
  if lat is null or lng is null or abs(lat-coalesce((context->>'routeLat')::double precision,9.031))>0.05
   or abs(lng-coalesce((context->>'routeLng')::double precision,38.748))>0.05
   or stamp<=saved.generation_started_at or stamp<=coalesce(saved.last_observed_at,'-infinity'::timestamptz)
   then raise exception 'DEMO_REPORT_DENIED';end if;
  lat:=round(lat*1800000)/1800000;lng:=round(lng*1800000)/1800000;
  insert into public.demo_motion_gps_reports(vehicle_id,epoch,lease_id,observed_at,latitude,longitude)
   values(target_id,saved.epoch,saved.lease_id,stamp,lat,lng);
  update public.demo_motion_targets set last_observed_at=stamp where vehicle_id=target_id;
  reserved:=jsonb_build_object('observedAt',stamp,'latitude',lat,'longitude',lng);
  report_event_key:='netlify:'||request_nonce::text;
  position:=jsonb_build_object('eventKey',report_event_key,'gatewayDeviceId',device.gateway_device_id,
   'protocol',device.protocol,'protocolDeviceId',device.protocol_device_id,'observedAt',reserved->'observedAt',
   'receivedAt',clock_timestamp(),'valid',true,'latitude',reserved->'latitude','longitude',reserved->'longitude',
   'speedKph',command->'speedKph','course',command->'course','attributes','{}'::jsonb);
  result:=public.ingest_telematics_position_pre_netlify226(gateway.token_digest,position);
  if result->>'outcome' is distinct from 'ACCEPTED' then raise exception 'DEMO_REPORT_DENIED';end if;
  update public.telematics_positions p set synthetic_transport='NETLIFY_DEMO'
   where p.gateway_id=gateway.id and p.event_key=report_event_key;
 else raise exception 'DEMO_TARGET_DENIED';end if;
 select last_observed_at into stamp from public.demo_motion_targets where vehicle_id=target_id;
 return jsonb_build_object('recorded',true,'dueAt',stamp+interval '30 seconds','transport','NETLIFY_DEMO');
end $$;
revoke all on function public.netlify_demo_motion_command(uuid,uuid,text,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.netlify_demo_motion_command(uuid,uuid,text,jsonb) to service_role;

-- Owner-reviewed setup only. Existing demo identities/vehicles must already
-- exist. No signup, publication, source choice, consent or worker is created.
create function public.prepare_netlify_demo_gateway(actor_user_id uuid,requested_gateway_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare item record;vehicle public.vehicles%rowtype;owner_id uuid;driver_id uuid;
 device public.telematics_devices%rowtype;gateway public.telematics_gateways%rowtype;
 bindings jsonb:='[]'::jsonb;binding jsonb;created jsonb;assigned record;choices integer:=0;
begin
 if actor_user_id is null or requested_gateway_id is null or not exists(select 1 from public.profiles
  where id=actor_user_id and active and role='ADMIN') then raise exception 'FORBIDDEN';end if;
 perform 1 from public.demo_hosted_motion_control where id=1 and not enabled and kill_switch and not netlify_enabled for update;
 if not found or exists(select 1 from public.demo_motion_targets where state='RUNNING')
  then raise exception 'DEMO_PREPARATION_REQUIRES_STOPPED';end if;
 for item in
  select * from (values
   (1,'company-truck','caf1d0db-4d8e-4ce9-a879-6c7b6017de3a'::uuid,'990000000000001',
    '6727b198-d771-436a-9f1f-7bf27b8cea2f'::uuid,null::uuid,'user-transporter',array['user-company-driver','user-transporter'],'GPS'),
   (2,'personal-truck','2f22cc5a-d654-4405-98b7-9a1a9cf42fe3'::uuid,'990000000000002',
    null::uuid,'c640c548-ada2-4b9e-ac3c-235585525a6f'::uuid,'user-driver',array['user-driver'],'MOBILE')
  ) base(number,name,vehicle_id,imei,organization_id,provider_profile_id,owner_key,driver_keys,source)
  union all select 2+right(f.owner_fixture_key,2)::integer,'fleet-'||right(f.owner_fixture_key,2),f.vehicle_id,f.imei,
   f.organization_id,null::uuid,f.owner_fixture_key,array[f.driver_fixture_key],'GPS'
   from public.demo_motion_fleet_allowlist f
  order by number
 loop
  if not public.telematics_lock_owner_scope(item.organization_id,item.provider_profile_id) then raise exception 'DEMO_TARGET_DENIED';end if;
  select * into vehicle from public.vehicles where id=item.vehicle_id and active and publication_status='LIVE' for update;
  if not found or vehicle.organization_id is distinct from item.organization_id
   or vehicle.provider_profile_id is distinct from item.provider_profile_id then raise exception 'DEMO_TARGET_DENIED';end if;
  if item.organization_id is not null then
   if(select count(*) from public.organization_members where organization_id=item.organization_id and membership_role='OWNER')<>1
    then raise exception 'DEMO_TARGET_DENIED';end if;
   select user_id into owner_id from public.organization_members where organization_id=item.organization_id and membership_role='OWNER';
  else select user_id into owner_id from public.provider_profiles where id=item.provider_profile_id;end if;
  if not exists(select 1 from auth.users u join public.profiles p on p.id=u.id and p.active where u.id=owner_id
   and u.deleted_at is null and u.raw_app_meta_data->>'fixture_source'='loadgistic'
   and u.raw_user_meta_data->>'fixture_key'=item.owner_key) then raise exception 'DEMO_TARGET_DENIED';end if;
  if(select count(*) from public.driver_vehicle_assignments where vehicle_id=item.vehicle_id and active)<>1
   then raise exception 'DEMO_TARGET_DENIED';end if;
  select driver_user_id into driver_id from public.driver_vehicle_assignments where vehicle_id=item.vehicle_id and active;
  if not exists(select 1 from auth.users u join public.profiles p on p.id=u.id and p.active where u.id=driver_id
   and u.deleted_at is null and u.raw_app_meta_data->>'fixture_source'='loadgistic'
   and u.raw_user_meta_data->>'fixture_key'=any(item.driver_keys))
   or driver_id=owner_id and not public.provider_owner_driver_enabled(driver_id) then raise exception 'DEMO_TARGET_DENIED';end if;
  select * into device from public.telematics_devices where imei=item.imei;
  if found and (device.gateway_id<>requested_gateway_id or device.gateway_device_id<>item.number or not device.active
   or not device.synthetic or device.model_profile<>'SYNTHETIC_GT06' or device.protocol<>'gt06' or device.protocol_device_id<>item.imei
   or device.organization_id is distinct from item.organization_id or device.provider_profile_id is distinct from item.provider_profile_id)
   then raise exception 'DEMO_GATEWAY_BINDING_EXISTS';end if;
  bindings:=bindings||jsonb_build_array(to_jsonb(item)||jsonb_build_object('ownerId',owner_id));
 end loop;
 if jsonb_array_length(bindings)<>10 then raise exception 'DEMO_TARGET_DENIED';end if;
 select * into gateway from public.telematics_gateways where id=requested_gateway_id for update;
 if found then
  if not gateway.active or not gateway.synthetic_only or gateway.synthetic_transport<>'NETLIFY_DEMO'
   then raise exception 'DEMO_GATEWAY_BINDING_EXISTS';end if;
 else
  perform public.register_telematics_gateway(actor_user_id,requested_gateway_id,'Netlify fictional demo',
   encode(sha256(convert_to(gen_random_uuid()::text||gen_random_uuid()::text||gen_random_uuid()::text,'UTF8')),'hex'),true);
  update public.telematics_gateways set synthetic_transport='NETLIFY_DEMO' where id=requested_gateway_id;
 end if;
 for binding in select * from jsonb_array_elements(bindings) loop
  select * into device from public.telematics_devices where imei=binding->>'imei';
  if not found then
   created:=public.provision_telematics_device(actor_user_id,jsonb_strip_nulls(jsonb_build_object(
    'gatewayId',requested_gateway_id,'gatewayDeviceId',(binding->>'number')::integer,'imei',binding->>'imei',
    'protocol','gt06','protocolDeviceId',binding->>'imei','label','Fictional Netlify '||(binding->>'name'),
    'ownerOrganizationId',binding->'organization_id','ownerProviderProfileId',binding->'provider_profile_id',
    'synthetic',true,'modelProfile','SYNTHETIC_GT06')));
   select * into device from public.telematics_devices where id=(created->>'id')::uuid;
  end if;
  select a.* into assigned from public.telematics_device_assignments a where a.device_id=device.id and a.ended_at is null;
  if found and assigned.vehicle_id is distinct from (binding->>'vehicle_id')::uuid then raise exception 'DEMO_GATEWAY_BINDING_EXISTS';end if;
  if not found then perform public.assign_telematics_device((binding->>'ownerId')::uuid,
   jsonb_build_object('deviceId',device.id,'vehicleId',binding->'vehicle_id','expectedRevision',device.revision));end if;
  if not exists(select 1 from public.telematics_location_sources s where s.vehicle_id=(binding->>'vehicle_id')::uuid
   and s.source=binding->>'source') then choices:=choices+1;end if;
 end loop;
 return jsonb_build_object('gatewayId',requested_gateway_id,'deviceCount',10,'sourceChoicesRequired',choices,
  'enabled',false,'transport','NETLIFY_DEMO');
end $$;
revoke all on function public.prepare_netlify_demo_gateway(uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function public.prepare_netlify_demo_gateway(uuid,uuid) to service_role;
notify pgrst,'reload schema';
commit;
