-- FEAT-SIM-001. Disabled-by-default local demo arbitration. No target is seeded.
-- Normal customers never acquire a demo record. Historical telemetry is retained.
begin;
select pg_advisory_xact_lock(8030156);
set local lock_timeout='5s';
set local statement_timeout='30s';

create table public.demo_motion_targets(
 vehicle_id uuid primary key references public.vehicles(id) on delete cascade,
 owner_user_id uuid not null references public.profiles(id) on delete cascade,
 driver_user_id uuid not null references public.profiles(id) on delete cascade,
 device_id uuid not null unique references public.telematics_devices(id) on delete cascade,
 binding_digest text not null check(binding_digest~'^[a-f0-9]{64}$'),
 source text not null check(source in('GPS','MOBILE')),
 state text not null default 'OFF' check(state in('OFF','RUNNING','REAL')),
 epoch bigint not null default 1 check(epoch>0),lease_id uuid,expires_at timestamptz,
 generation_started_at timestamptz not null default clock_timestamp(),
 last_observed_at timestamptz,takeover_at timestamptz,reason text not null default 'NOT_STARTED',
 updated_at timestamptz not null default clock_timestamp(),
 check((state='RUNNING')=(lease_id is not null and expires_at is not null)),
 check(vehicle_id in('caf1d0db-4d8e-4ce9-a879-6c7b6017de3a','2f22cc5a-d654-4405-98b7-9a1a9cf42fe3'))
);
create table public.demo_motion_gps_reports(
 vehicle_id uuid not null references public.demo_motion_targets(vehicle_id) on delete cascade,
 epoch bigint not null,lease_id uuid not null,observed_at timestamptz not null,
 latitude double precision not null,longitude double precision not null,
 upstream_event_key text,created_at timestamptz not null default clock_timestamp(),
 primary key(vehicle_id,epoch,observed_at)
);
create table public.demo_motion_request_nonces(
 nonce uuid primary key,created_at timestamptz not null default clock_timestamp()
);
-- Private per-fix provenance survives takeover; consumers may project only a
-- boolean. Current control mode alone never labels a previously published fix.
alter table public.telematics_positions add column demo_epoch bigint check(demo_epoch is null or demo_epoch>0);
alter table public.vehicle_driver_locations add column demo_epoch bigint check(demo_epoch is null or demo_epoch>0);
alter table public.capacities add column demo_epoch bigint check(demo_epoch is null or demo_epoch>0);
alter table public.demo_motion_targets enable row level security;
alter table public.demo_motion_gps_reports enable row level security;
alter table public.demo_motion_request_nonces enable row level security;
revoke all on public.demo_motion_targets,public.demo_motion_gps_reports,public.demo_motion_request_nonces from public,anon,authenticated,service_role;

-- Exact fixture keys/relationships, not mailbox discovery. Locks follow existing
-- owner scope/profile -> device -> vehicle -> demo row order. Scope locks protect
-- closure; vehicle locks serialize ordinary source/assignment changes and ticks.
create function public.demo_motion_binding(target_vehicle_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare vehicle vehicles%rowtype;device telematics_devices%rowtype;selection telematics_location_sources%rowtype;
 owner_id uuid;driver_id uuid;driver_assignment uuid;device_assignment uuid;owner_key text;driver_keys text[];
 expected_imei text;expected_org uuid;expected_provider uuid;radius integer;result jsonb;
begin
 if target_vehicle_id='caf1d0db-4d8e-4ce9-a879-6c7b6017de3a' then
  expected_org:='6727b198-d771-436a-9f1f-7bf27b8cea2f';owner_key:='user-transporter';
  driver_keys:=array['user-company-driver','user-transporter'];expected_imei:='990000000000001';
 elsif target_vehicle_id='2f22cc5a-d654-4405-98b7-9a1a9cf42fe3' then
  expected_provider:='c640c548-ada2-4b9e-ac3c-235585525a6f';owner_key:='user-driver';
  driver_keys:=array['user-driver'];expected_imei:='990000000000002';
 else raise exception 'DEMO_TARGET_DENIED';end if;
 if not public.telematics_lock_owner_scope(expected_org,expected_provider) then raise exception 'DEMO_TARGET_DENIED';end if;
 if expected_org is not null then
  if(select count(*) from organization_members where organization_id=expected_org and membership_role='OWNER')<>1 then raise exception 'DEMO_TARGET_DENIED';end if;
  select user_id into owner_id from organization_members where organization_id=expected_org and membership_role='OWNER';
 else select user_id into owner_id from provider_profiles where id=expected_provider;end if;
 if not exists(select 1 from auth.users u join profiles p on p.id=u.id and p.active where u.id=owner_id and u.deleted_at is null
  and u.raw_app_meta_data->>'fixture_source'='loadgistic' and u.raw_user_meta_data->>'fixture_key'=owner_key
  and(lower(u.email)=case owner_key when 'user-transporter' then 'transporter@loadgistic.local' else 'driver@loadgistic.local' end
   or lower(u.email)~'^falmatad97\+[a-z0-9][a-z0-9._-]{0,80}@gmail\.com$')) then raise exception 'DEMO_TARGET_DENIED';end if;
 select d.* into device from telematics_devices d join telematics_gateways g on g.id=d.gateway_id and g.active and g.synthetic_only
  where d.imei=expected_imei and d.active and d.synthetic and d.protocol='gt06' and d.protocol_device_id=expected_imei
   and d.model_profile='SYNTHETIC_GT06' and d.organization_id is not distinct from expected_org
   and d.provider_profile_id is not distinct from expected_provider for update of d;
 if not found then raise exception 'DEMO_TARGET_DENIED';end if;
 select * into vehicle from vehicles where id=target_vehicle_id and active for update;
 if not found or vehicle.organization_id is distinct from expected_org or vehicle.provider_profile_id is distinct from expected_provider
  then raise exception 'DEMO_TARGET_DENIED';end if;
 select a.id into device_assignment from telematics_device_assignments a where a.device_id=device.id and a.vehicle_id=vehicle.id and a.ended_at is null;
 if device_assignment is null then raise exception 'DEMO_TARGET_DENIED';end if;
 if(select count(*) from driver_vehicle_assignments where vehicle_id=vehicle.id and active)<>1 then raise exception 'DEMO_TARGET_DENIED';end if;
 select a.driver_user_id,a.id into driver_id,driver_assignment from driver_vehicle_assignments a where a.vehicle_id=vehicle.id and a.active;
 if not exists(select 1 from auth.users u join profiles p on p.id=u.id and p.active where u.id=driver_id and u.deleted_at is null
  and u.raw_app_meta_data->>'fixture_source'='loadgistic' and u.raw_user_meta_data->>'fixture_key'=any(driver_keys)
  and(lower(u.email) in('company-driver@loadgistic.local','driver@loadgistic.local','transporter@loadgistic.local')
   or lower(u.email)~'^falmatad97\+[a-z0-9][a-z0-9._-]{0,80}@gmail\.com$')) then raise exception 'DEMO_TARGET_DENIED';end if;
 if driver_id=owner_id and not public.provider_owner_driver_enabled(driver_id) then raise exception 'DEMO_TARGET_DENIED';end if;
 select * into selection from telematics_location_sources where vehicle_id=vehicle.id;
 if selection.source='MANUAL' then raise exception 'DEMO_MANUAL_SOURCE_STATIC';end if;
 select location_precision_km into radius from capacities where vehicle_id=vehicle.id order by updated_at desc,id desc limit 1;
 radius:=coalesce(selection.precision_km,radius);
 if radius is null or radius not in(1,3,5,10,20,40) then raise exception 'DEMO_TARGET_DENIED';end if;
 result:=jsonb_build_object('vehicleId',vehicle.id,'ownerId',owner_id,'driverId',driver_id,'driverAssignment',driver_assignment,
  'deviceId',device.id,'deviceAssignment',device_assignment,'deviceRevision',device.revision,'gatewayId',device.gateway_id,
  'source',coalesce(selection.source,'MOBILE'),'sourceRevision',coalesce(selection.revision,'1970-01-01'::timestamptz),'precisionKm',radius);
 return result||jsonb_build_object('digest',encode(sha256(convert_to(result::text,'UTF8')),'hex'));
end $$;

create function public.configure_demo_motion_target(target_vehicle_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare context jsonb;saved demo_motion_targets%rowtype;
begin
 context:=public.demo_motion_binding(target_vehicle_id);
 select * into saved from demo_motion_targets where vehicle_id=target_vehicle_id for update;
 if found then
  -- Reconfiguration never clears a real takeover or steals a live runner.
  return jsonb_build_object('state',saved.state,'epoch',saved.epoch,'configured',true);
 end if;
 insert into demo_motion_targets(vehicle_id,owner_user_id,driver_user_id,device_id,binding_digest,source)
 values(target_vehicle_id,(context->>'ownerId')::uuid,(context->>'driverId')::uuid,(context->>'deviceId')::uuid,context->>'digest',context->>'source');
 return jsonb_build_object('state','OFF','epoch',1,'configured',true);
end $$;

create function public.pause_demo_motion(target_vehicle_id uuid,pause_reason text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare saved demo_motion_targets%rowtype;
begin
 select * into saved from demo_motion_targets where vehicle_id=target_vehicle_id for update;
 if not found then return jsonb_build_object('demo',false);end if;
 if saved.state<>'REAL' then
  update demo_motion_targets set state='REAL',epoch=epoch+1,lease_id=null,expires_at=null,takeover_at=clock_timestamp(),
   reason=pause_reason,updated_at=clock_timestamp() where vehicle_id=target_vehicle_id returning * into saved;
 end if;
 return jsonb_build_object('demo',true,'state',saved.state,'epoch',saved.epoch);
end $$;

create function public.note_real_location_device_use(actor_user_id uuid,target_vehicle_id uuid,installation_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare vehicle vehicles%rowtype;device_uuid uuid;
begin
 if installation_id is null or not exists(select 1 from profiles p join auth.users u on u.id=p.id and u.deleted_at is null
  where p.id=actor_user_id and p.active and(p.role='DRIVER' or public.provider_owner_driver_enabled(p.id)))
  or not exists(select 1 from driver_vehicle_assignments a join vehicles v on v.id=a.vehicle_id and v.active
   where a.vehicle_id=target_vehicle_id and a.driver_user_id=actor_user_id and a.active)
  then raise exception 'FORBIDDEN';end if;
 -- Acquire the same lock order as demo ticks only for an existing synthetic
 -- target. Customer enrollment has no demo row and no demo location write.
 if exists(select 1 from demo_motion_targets where vehicle_id=target_vehicle_id) then
  select * into vehicle from vehicles where id=target_vehicle_id;
  if not public.telematics_lock_owner_scope(vehicle.organization_id,vehicle.provider_profile_id) then raise exception 'FORBIDDEN';end if;
  select device_id into device_uuid from demo_motion_targets where vehicle_id=target_vehicle_id;
  perform 1 from telematics_devices where id=device_uuid for update;
  perform 1 from vehicles where id=target_vehicle_id and active for update;
  if not found or not exists(select 1 from driver_vehicle_assignments where vehicle_id=target_vehicle_id and driver_user_id=actor_user_id and active)
   then raise exception 'FORBIDDEN';end if;
  return public.pause_demo_motion(target_vehicle_id,'REAL_INSTALLATION');
 end if;
 return jsonb_build_object('demo',false);
end $$;

create function public.start_demo_motion(target_vehicle_id uuid,requested_seconds integer,explicit_resume boolean default false)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare context jsonb;saved demo_motion_targets%rowtype;in_use boolean:=true;stamp timestamptz:=clock_timestamp();
begin
 if requested_seconds is null or requested_seconds not between 10 and 3600 then raise exception 'DEMO_DURATION_INVALID';end if;
 context:=public.demo_motion_binding(target_vehicle_id);
 select * into saved from demo_motion_targets where vehicle_id=target_vehicle_id for update;
 if not found then raise exception 'DEMO_TARGET_NOT_CONFIGURED';end if;
 if saved.state='RUNNING' and saved.expires_at>stamp then raise exception 'DEMO_RUNNER_ALREADY_ACTIVE';end if;
 if saved.state='REAL' and not explicit_resume then raise exception 'DEMO_REAL_DEVICE_TAKEOVER';end if;
 -- Migration157 supplies the current installation authority check. Fail closed
 -- for resuming a real takeover before that dependency is installed.
 if to_regprocedure('public.real_location_device_in_use(uuid)') is not null then
  execute 'select public.real_location_device_in_use($1)' into in_use using target_vehicle_id;
 elsif saved.state<>'REAL' then in_use:=false;end if;
 if in_use then raise exception 'DEMO_REAL_DEVICE_IN_USE';end if;
 update demo_motion_targets set owner_user_id=(context->>'ownerId')::uuid,driver_user_id=(context->>'driverId')::uuid,
  device_id=(context->>'deviceId')::uuid,binding_digest=context->>'digest',source=context->>'source',state='RUNNING',epoch=epoch+1,
  lease_id=gen_random_uuid(),expires_at=stamp+make_interval(secs=>requested_seconds),generation_started_at=stamp,
  last_observed_at=null,reason='EXPLICIT_START',updated_at=stamp where vehicle_id=target_vehicle_id returning * into saved;
 delete from demo_motion_gps_reports where(vehicle_id,epoch,observed_at) in(select vehicle_id,epoch,observed_at from demo_motion_gps_reports
  where created_at<stamp-interval '1 day' order by created_at limit 1000);
 return jsonb_build_object('state',saved.state,'epoch',saved.epoch,'leaseId',saved.lease_id,'expiresAt',saved.expires_at,'source',saved.source);
end $$;

create function public.demo_motion_lease(target_vehicle_id uuid,expected_lease_id uuid,expected_epoch bigint,expected_source text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare context jsonb;saved demo_motion_targets%rowtype;
begin
 context:=public.demo_motion_binding(target_vehicle_id);
 select * into saved from demo_motion_targets where vehicle_id=target_vehicle_id for update;
 if not found or saved.state<>'RUNNING' or saved.lease_id is distinct from expected_lease_id or saved.epoch is distinct from expected_epoch
  or saved.expires_at<=clock_timestamp() or saved.source<>expected_source or context->>'source'<>expected_source
  or context->>'digest'<>saved.binding_digest then raise exception 'DEMO_REPORT_DENIED';end if;
 return context||jsonb_build_object('generationStartedAt',saved.generation_started_at,'lastObservedAt',saved.last_observed_at);
end $$;

create function public.stop_demo_motion(target_vehicle_id uuid,expected_lease_id uuid,expected_epoch bigint)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare saved demo_motion_targets%rowtype;
begin
 -- Stopping does not revive a deleted/reassigned fixture or reset any source.
 perform 1 from vehicles where id=target_vehicle_id for update;
 select * into saved from demo_motion_targets where vehicle_id=target_vehicle_id for update;
 if not found then raise exception 'DEMO_TARGET_NOT_CONFIGURED';end if;
 if saved.state='RUNNING' and saved.lease_id=expected_lease_id and saved.epoch=expected_epoch then
  update demo_motion_targets set state='OFF',epoch=epoch+1,lease_id=null,expires_at=null,reason='OPERATOR_STOP',updated_at=clock_timestamp()
   where vehicle_id=target_vehicle_id returning * into saved;
 end if;
 return jsonb_build_object('state',saved.state,'epoch',saved.epoch);
end $$;

create function public.demo_motion_status(target_vehicle_id uuid)
returns jsonb language sql stable security definer set search_path=public,pg_temp as $$
 select coalesce((select jsonb_build_object('configured',true,'state',case when state='RUNNING' and expires_at<=clock_timestamp() then 'EXPIRED' else state end,
  'epoch',epoch,'expiresAt',expires_at,'source',source,'reason',reason,'lastObservedAt',last_observed_at)
  from demo_motion_targets where vehicle_id=target_vehicle_id),'{}'::jsonb)
$$;

create function public.reserve_demo_gps_tick(target_vehicle_id uuid,expected_lease_id uuid,expected_epoch bigint,latitude double precision,longitude double precision)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare context jsonb;stamp timestamptz:=date_trunc('second',clock_timestamp());lat double precision;lng double precision;
begin
 context:=public.demo_motion_lease(target_vehicle_id,expected_lease_id,expected_epoch,'GPS');
 if latitude is null or longitude is null or abs(latitude-9.031)>0.05 or abs(longitude-38.748)>0.05
  or stamp<=(context->>'generationStartedAt')::timestamptz or stamp<=coalesce((context->>'lastObservedAt')::timestamptz,'-infinity')
  then raise exception 'DEMO_REPORT_DENIED';end if;
 lat:=round(latitude*1800000)/1800000;lng:=round(longitude*1800000)/1800000;
 insert into demo_motion_gps_reports(vehicle_id,epoch,lease_id,observed_at,latitude,longitude)
 values(target_vehicle_id,expected_epoch,expected_lease_id,stamp,lat,lng);
 update demo_motion_targets set last_observed_at=stamp where vehicle_id=target_vehicle_id;
 return jsonb_build_object('observedAt',stamp,'latitude',lat,'longitude',lng);
end $$;

create function public.report_demo_phone_location(target_vehicle_id uuid,expected_lease_id uuid,expected_epoch bigint,latitude double precision,longitude double precision)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare context jsonb;scope record;capacity capacities%rowtype;point jsonb;nearest jsonb;stamp timestamptz:=clock_timestamp();
begin
 context:=public.demo_motion_lease(target_vehicle_id,expected_lease_id,expected_epoch,'MOBILE');
 if latitude is null or longitude is null or abs(latitude-9.03)>0.1 or abs(longitude-38.76)>0.1 then raise exception 'DEMO_REPORT_DENIED';end if;
 select * into scope from public.provider_capacity_actor_scope((context->>'driverId')::uuid);
 if not found or not scope.workspace_access or scope.is_company_driver and not scope.can_manage_capacity then raise exception 'DEMO_REPORT_DENIED';end if;
 if not exists(select 1 from vehicles where id=target_vehicle_id and active and publication_status='LIVE') then raise exception 'DEMO_REPORT_DENIED';end if;
 select * into capacity from capacities where vehicle_id=target_vehicle_id order by updated_at desc,id desc limit 1 for update;
 if not found or coalesce(capacity.market_status,capacity.status::text) not in('EMPTY','PARTIAL')
  or stamp<=coalesce(capacity.location_updated_at,'-infinity') then raise exception 'DEMO_REPORT_DENIED';end if;
 point:=public.telematics_obscure(latitude,longitude,(context->>'precisionKm')::integer);
 nearest:=public.provider_capacity_nearest_place((point->>'latitude')::double precision,(point->>'longitude')::double precision);
 insert into vehicle_driver_locations(vehicle_id,driver_user_id,latitude,longitude,precision_km,area,place_ref,updated_at,demo_epoch)
 values(target_vehicle_id,(context->>'driverId')::uuid,(point->>'latitude')::double precision,(point->>'longitude')::double precision,
  (context->>'precisionKm')::integer,case when nearest is null then 'Approximate location' else 'Around '||(nearest->>'place_label') end,
  nearest->>'place_ref',stamp,expected_epoch)
 on conflict(vehicle_id) do update set driver_user_id=excluded.driver_user_id,latitude=excluded.latitude,longitude=excluded.longitude,
  precision_km=excluded.precision_km,area=excluded.area,place_ref=excluded.place_ref,updated_at=excluded.updated_at,demo_epoch=excluded.demo_epoch;
 if exists(select 1 from pg_attribute where attrelid='public.vehicle_driver_locations'::regclass and attname='phone_binding_id' and not attisdropped) then
  execute 'update public.vehicle_driver_locations set phone_binding_id=null,observed_at=$2 where vehicle_id=$1' using target_vehicle_id,stamp;
 end if;
 update capacities set location_lat=(point->>'latitude')::double precision,location_lng=(point->>'longitude')::double precision,
  location_precision_km=(context->>'precisionKm')::integer,location_updated_at=stamp,location_source='DEVICE_OBSCURED',
  location_area=case when nearest is null then 'Approximate location' else 'Around '||(nearest->>'place_label') end,
  location_place_ref=nearest->>'place_ref' where id=capacity.id;
 update demo_motion_targets set last_observed_at=stamp,updated_at=stamp where vehicle_id=target_vehicle_id;
 return jsonb_build_object('recorded',true,'source','MOBILE','observedAt',stamp,'demo',true);
end $$;

create function public.authorize_demo_motion_request(request_nonce uuid)
returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if request_nonce is null then raise exception 'DEMO_REQUEST_DENIED';end if;
 insert into demo_motion_request_nonces(nonce) values(request_nonce);
 delete from demo_motion_request_nonces where nonce in(select nonce from demo_motion_request_nonces where created_at<clock_timestamp()-interval '10 minutes' order by created_at limit 1000);
 return true;
exception when unique_violation then raise exception 'DEMO_REQUEST_DENIED';end $$;

-- Preserve exact old implementations/ACLs for reviewed rollback; never expose a
-- pre-arbitration RPC as an alternate callable service-role route.
do $backups$
declare signature text;name text;copy_name text;definition text;
begin
 foreach signature in array array['public.ingest_telematics_position(text,jsonb)','public.refresh_provider_capacity_location(uuid,jsonb)'] loop
  name:=split_part(split_part(signature,'(',1),'.',2);copy_name:=name||'_pre_demo156';definition:=pg_get_functiondef(signature::regprocedure);
  if to_regprocedure(replace(signature,name||'(',copy_name||'(')) is not null then raise exception 'DEMO_ARBITRATION_BACKUP_EXISTS';end if;
  execute replace(replace(definition,'CREATE OR REPLACE FUNCTION public.'||name||'(','CREATE OR REPLACE FUNCTION public.'||copy_name||'('),name||'.',copy_name||'.');
  execute format('revoke all on function %s from public,anon,authenticated,service_role',replace(signature,name||'(',copy_name||'('));
  execute format('comment on function %s is %L',replace(signature,name||'(',copy_name||'('),jsonb_build_object('migration',156,'signature',signature,'before_md5',md5(definition))::text);
 end loop;
end $backups$;

create or replace function public.ingest_telematics_position(gateway_digest text,command jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare device telematics_devices%rowtype;saved demo_motion_targets%rowtype;reservation demo_motion_gps_reports%rowtype;result jsonb;
begin
 select d.* into device from telematics_devices d join telematics_gateways g on g.id=d.gateway_id and g.active
  where g.token_digest=gateway_digest and d.gateway_device_id=(command->>'gatewayDeviceId')::bigint
   and d.protocol=command->>'protocol' and d.protocol_device_id=command->>'protocolDeviceId' and d.active;
 if found and device.synthetic and device.imei in('990000000000001','990000000000002') then
  select * into saved from demo_motion_targets where device_id=device.id;
  if not found then raise exception 'TELEMETRY_BINDING_DENIED';end if;
  begin
   perform public.demo_motion_lease(saved.vehicle_id,saved.lease_id,saved.epoch,'GPS');
  exception when others then raise exception 'TELEMETRY_BINDING_DENIED';end;
  select * into reservation from demo_motion_gps_reports r where r.vehicle_id=saved.vehicle_id and r.epoch=saved.epoch
   and r.lease_id=saved.lease_id and r.observed_at=(command->>'observedAt')::timestamptz
   and abs(r.latitude-(command->>'latitude')::double precision)<0.000001
   and abs(r.longitude-(command->>'longitude')::double precision)<0.000001 for update;
  if not found or reservation.upstream_event_key is not null and reservation.upstream_event_key<>command->>'eventKey'
   then raise exception 'TELEMETRY_BINDING_DENIED';end if;
  result:=public.ingest_telematics_position_pre_demo156(gateway_digest,command);
  update telematics_positions set demo_epoch=saved.epoch where gateway_id=device.gateway_id and event_key=command->>'eventKey' and device_id=device.id;
  if(result->>'applied')::boolean then
   update capacities set demo_epoch=saved.epoch where vehicle_id=saved.vehicle_id and location_source='TELEMATICS'
    and location_updated_at=(command->>'observedAt')::timestamptz;
  end if;
  update demo_motion_gps_reports set upstream_event_key=command->>'eventKey'
   where vehicle_id=reservation.vehicle_id and epoch=reservation.epoch and observed_at=reservation.observed_at;
  return result;
 end if;
 return public.ingest_telematics_position_pre_demo156(gateway_digest,command);
end $$;

-- Insert only after the ordinary refresh has validated the actor, exact truck,
-- active capacity and coordinates. Real refresh and demo ticks share vehicle lock.
do $real_phone$
declare definition text;anchor text:='  update public.capacities set';replacement text;
begin
 definition:=pg_get_functiondef('public.refresh_provider_capacity_location(uuid,jsonb)'::regprocedure);
 if(length(definition)-length(replace(definition,anchor,'')))/length(anchor)<>1 then raise exception 'DEMO_PHONE_GUARD_DRIFT';end if;
 replacement:=$guard$  perform 1 from public.vehicles where id=vehicle.id for update;
  perform public.pause_demo_motion(vehicle.id,'REAL_PHONE_REPORT');
  update public.vehicle_driver_locations set demo_epoch=null where vehicle_id=vehicle.id;
  update public.capacities set demo_epoch=null where vehicle_id=vehicle.id and location_source='DEVICE_OBSCURED';
  update public.capacities set$guard$;
 execute replace(definition,anchor,replacement);
end $real_phone$;

create function public.pause_demo_on_source_assignment_change()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if tg_table_name='telematics_location_sources' then
  if tg_op='INSERT' or new.revision is distinct from old.revision then perform public.pause_demo_motion(new.vehicle_id,'SOURCE_CHANGED');end if;
 elsif tg_table_name='driver_vehicle_assignments' then
  if tg_op='DELETE' then perform public.pause_demo_motion(old.vehicle_id,'DRIVER_ASSIGNMENT_CHANGED');
  elsif tg_op='INSERT' or new.active is distinct from old.active or new.vehicle_id is distinct from old.vehicle_id or new.driver_user_id is distinct from old.driver_user_id then
   perform public.pause_demo_motion(new.vehicle_id,'DRIVER_ASSIGNMENT_CHANGED');
   if tg_op='UPDATE' and old.vehicle_id<>new.vehicle_id then perform public.pause_demo_motion(old.vehicle_id,'DRIVER_ASSIGNMENT_CHANGED');end if;
  end if;
 else
  if tg_op='DELETE' then perform public.pause_demo_motion(old.vehicle_id,'GPS_ASSIGNMENT_CHANGED');
  elsif tg_op='INSERT' or new.ended_at is distinct from old.ended_at or new.vehicle_id is distinct from old.vehicle_id then
   perform public.pause_demo_motion(new.vehicle_id,'GPS_ASSIGNMENT_CHANGED');
   if tg_op='UPDATE' and old.vehicle_id<>new.vehicle_id then perform public.pause_demo_motion(old.vehicle_id,'GPS_ASSIGNMENT_CHANGED');end if;
  end if;
 end if;
 return null;
end $$;
create trigger demo_source_changed after insert or update on public.telematics_location_sources for each row execute function public.pause_demo_on_source_assignment_change();
create trigger demo_driver_changed after insert or update or delete on public.driver_vehicle_assignments for each row execute function public.pause_demo_on_source_assignment_change();
create trigger demo_gps_changed after insert or update or delete on public.telematics_device_assignments for each row execute function public.pause_demo_on_source_assignment_change();

create function public.capacity_demo_fix_provenance()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
 new.demo_epoch:=null;
 if new.location_source='DEVICE_OBSCURED' then
  select r.demo_epoch into new.demo_epoch from vehicle_driver_locations r where r.vehicle_id=new.vehicle_id
   and r.updated_at=new.location_updated_at and r.latitude=new.location_lat and r.longitude=new.location_lng
   and r.precision_km=new.location_precision_km;
 elsif new.location_source='TELEMATICS' then
  select p.demo_epoch into new.demo_epoch from telematics_positions p join telematics_device_assignments a on a.id=p.assignment_id
   and a.vehicle_id=new.vehicle_id and a.ended_at is null
   cross join lateral(select public.telematics_obscure(p.latitude,p.longitude,new.location_precision_km) as value) point
   where p.vehicle_id=new.vehicle_id and p.observed_at=new.location_updated_at and p.valid and p.demo_epoch is not null
    and(point.value->>'latitude')::double precision=new.location_lat and(point.value->>'longitude')::double precision=new.location_lng
   order by p.id desc limit 1;
 end if;
 return new;
end $$;
create trigger capacity_demo_fix before insert or update of location_source,location_lat,location_lng,location_updated_at,location_precision_km,vehicle_id
 on public.capacities for each row execute function public.capacity_demo_fix_provenance();

-- Actual saved-fix boolean only. Private epochs and installation/device IDs are
-- never added to a marketplace projection. Fail if prior projection shape drifts.
do $demo_projection$
declare signature text;definition text;anchor text;replacement text;
begin
 foreach signature in array array['public.public_capacity_page(jsonb,timestamptz,uuid,integer)',
  'public.capacity_search_public_rows(jsonb,timestamptz,uuid,integer)',
  'public.private_capacity_filtered_page(text,text,uuid,timestamptz,uuid,integer,jsonb)',
  'public.capacity_search_private_rows(text,text,uuid,timestamptz,uuid,integer,jsonb)'] loop
  definition:=pg_get_functiondef(signature::regprocedure);
  if strpos(signature,'private')>0 then
   anchor:=$a$'location_source',case when capacity.location_source$a$;
   replacement:=$r$'location_is_demo',capacity.demo_epoch is not null,'location_source',case when capacity.location_source$r$;
  else
   anchor:=$a$'location_source',(select case when c.location_source$a$;
   replacement:=$r$'location_is_demo',(select c.demo_epoch is not null from public.capacities c where c.id=bounded.id),'location_source',(select case when c.location_source$r$;
  end if;
  if(length(definition)-length(replace(definition,anchor,'')))/length(anchor)<>1 then raise exception 'DEMO_SOURCE_PROJECTION_DRIFT';end if;
  execute replace(definition,anchor,replacement);
 end loop;
end $demo_projection$;

do $workspace_provenance$
declare definition text;anchor text:=$a$'lat',report.latitude,'lng',report.longitude$a$;
begin
 definition:=pg_get_functiondef('public.provider_capacity_workspace(uuid)'::regprocedure);
 if(length(definition)-length(replace(definition,anchor,'')))/length(anchor)<>1 then raise exception 'DEMO_WORKSPACE_PROJECTION_DRIFT';end if;
 execute replace(definition,anchor,$r$'location_is_demo',report.demo_epoch is not null,'lat',report.latitude,'lng',report.longitude$r$);
end $workspace_provenance$;

do $acl$
declare signature text;
begin
 foreach signature in array array['demo_motion_binding(uuid)','pause_demo_motion(uuid,text)','demo_motion_lease(uuid,uuid,bigint,text)',
  'pause_demo_on_source_assignment_change()','capacity_demo_fix_provenance()','configure_demo_motion_target(uuid)','note_real_location_device_use(uuid,uuid,uuid)',
  'start_demo_motion(uuid,integer,boolean)','stop_demo_motion(uuid,uuid,bigint)','demo_motion_status(uuid)',
  'reserve_demo_gps_tick(uuid,uuid,bigint,double precision,double precision)',
  'report_demo_phone_location(uuid,uuid,bigint,double precision,double precision)','authorize_demo_motion_request(uuid)'] loop
  execute 'revoke all on function public.'||signature||' from public,anon,authenticated,service_role';
 end loop;
 foreach signature in array array['configure_demo_motion_target(uuid)','note_real_location_device_use(uuid,uuid,uuid)',
  'start_demo_motion(uuid,integer,boolean)','stop_demo_motion(uuid,uuid,bigint)','demo_motion_status(uuid)',
  'reserve_demo_gps_tick(uuid,uuid,bigint,double precision,double precision)',
  'report_demo_phone_location(uuid,uuid,bigint,double precision,double precision)','authorize_demo_motion_request(uuid)'] loop
  execute 'grant execute on function public.'||signature||' to service_role';
 end loop;
end $acl$;
notify pgrst,'reload schema';
commit;
