-- FEAT-SIM-001. Expand the exact synthetic GPS cohort; no customer or demo row is seeded.
begin;
select pg_advisory_xact_lock(8030183);
set local lock_timeout='5s';
set local statement_timeout='30s';

create table public.demo_motion_fleet_allowlist(
 vehicle_id uuid primary key,
 organization_id uuid not null unique,
 owner_fixture_key text not null unique,
 owner_email text not null,
 driver_fixture_key text not null unique,
 driver_email text not null,
 imei text not null unique check(imei ~ '^9900000000000(0[5-9]|1[0-2])$'),
 route_lat double precision not null check(route_lat between -90 and 90),
 route_lng double precision not null check(route_lng between -180 and 180)
);
insert into public.demo_motion_fleet_allowlist values
 ('2020967a-92d3-4b1d-8f40-3c670dc97a50','c36022ff-bf3e-432d-ae96-93d1537cf79e','user-public-fleet-01','owner-01@providers.loadgistic.test','user-public-fleet-driver-014','driver-014@providers.loadgistic.test','990000000000005',9.015,38.704),
 ('19838ed9-c898-43dd-a6d5-5d4c26d0e92d','43db4203-8bec-4494-9ed2-0d9952c9e300','user-public-fleet-02','owner-02@providers.loadgistic.test','user-public-fleet-driver-018','driver-018@providers.loadgistic.test','990000000000006',8.500,39.212),
 ('2c449a7d-d26d-4eeb-aa64-7f4ba9f33c9d','b2bca706-2f47-4d28-bad0-a028d017413d','user-public-fleet-03','owner-03@providers.loadgistic.test','user-public-fleet-driver-037','driver-037@providers.loadgistic.test','990000000000007',11.459,37.303),
 ('0088dba7-04c7-425e-b5a9-64b721a753f0','8efdd114-47be-4e3d-bf11-b6bc24d2c511','user-public-fleet-04','owner-04@providers.loadgistic.test','user-public-fleet-driver-059','driver-059@providers.loadgistic.test','990000000000008',13.468,39.491),
 ('5bf57d7a-2159-45f9-9f90-3cdef5ed43d8','750641af-6014-4f80-9116-3e6f79e8104e','user-public-fleet-05','owner-05@providers.loadgistic.test','user-public-fleet-driver-073','driver-073@providers.loadgistic.test','990000000000009',11.783,41.014),
 ('0dc90cf6-7735-4ccc-b030-98a81c40ffd6','22dd3b30-0bc5-4fdf-810b-3aee3081ac19','user-public-fleet-06','owner-06@providers.loadgistic.test','user-public-fleet-driver-080','driver-080@providers.loadgistic.test','990000000000010',9.350,42.793),
 ('02c0a10d-3b4b-4b83-9f85-6272f8b6ce95','94cc36ee-eb4b-4bd5-b8af-2485fe9a64f5','user-public-fleet-07','owner-07@providers.loadgistic.test','user-public-fleet-driver-104','driver-104@providers.loadgistic.test','990000000000011',9.299,41.867),
 ('28b05503-eb24-4b78-8646-6a1813207813','97eafa4d-0c1f-462f-9f3b-acead2853909','user-public-fleet-08','owner-08@providers.loadgistic.test','user-public-fleet-driver-107','driver-107@providers.loadgistic.test','990000000000012',9.701,41.827);
alter table public.demo_motion_fleet_allowlist enable row level security;
revoke all on public.demo_motion_fleet_allowlist from public,anon,authenticated,service_role;

-- This helper only accepts the eight immutable fixture pairs above. A matching
-- IMEI alone cannot grant motion: owner, driver, vehicle, assignment, source and
-- publication are checked again on every lease/report.
create function public.demo_motion_binding_fleet(target_vehicle_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare allowed demo_motion_fleet_allowlist%rowtype;vehicle vehicles%rowtype;device telematics_devices%rowtype;
 selection telematics_location_sources%rowtype;owner_id uuid;driver_id uuid;driver_assignment uuid;device_assignment uuid;
 radius integer;capacity_visibility text;capacity_status text;result jsonb;
begin
 select * into allowed from demo_motion_fleet_allowlist where vehicle_id=target_vehicle_id;
 if not found then raise exception 'DEMO_TARGET_DENIED';end if;
 if not public.telematics_lock_owner_scope(allowed.organization_id,null) then raise exception 'DEMO_TARGET_DENIED';end if;
 if(select count(*) from organization_members where organization_id=allowed.organization_id and membership_role='OWNER')<>1
  then raise exception 'DEMO_TARGET_DENIED';end if;
 select user_id into owner_id from organization_members where organization_id=allowed.organization_id and membership_role='OWNER';
 if not exists(select 1 from auth.users u join profiles p on p.id=u.id and p.active and p.role='TRANSPORTER'
  where u.id=owner_id and u.deleted_at is null and u.raw_app_meta_data->>'fixture_source'='loadgistic'
   and u.raw_user_meta_data->>'fixture_key'=allowed.owner_fixture_key
   and(lower(u.email)=allowed.owner_email or lower(u.email)~'^falmatad97\+[a-z0-9][a-z0-9._-]{0,80}@gmail\.com$'))
  then raise exception 'DEMO_TARGET_DENIED';end if;
 select d.* into device from telematics_devices d join telematics_gateways g on g.id=d.gateway_id and g.active and g.synthetic_only
  where d.imei=allowed.imei and d.active and d.synthetic and d.protocol='gt06' and d.protocol_device_id=allowed.imei
   and d.model_profile='SYNTHETIC_GT06' and d.organization_id=allowed.organization_id and d.provider_profile_id is null for update of d;
 if not found then raise exception 'DEMO_TARGET_DENIED';end if;
 select * into vehicle from vehicles where id=target_vehicle_id and active and publication_status='LIVE' for update;
 if not found or vehicle.organization_id is distinct from allowed.organization_id or vehicle.provider_profile_id is not null
  then raise exception 'DEMO_TARGET_DENIED';end if;
 select id into device_assignment from telematics_device_assignments where device_id=device.id and vehicle_id=vehicle.id and ended_at is null;
 if device_assignment is null then raise exception 'DEMO_TARGET_DENIED';end if;
 if(select count(*) from driver_vehicle_assignments where vehicle_id=vehicle.id and active)<>1 then raise exception 'DEMO_TARGET_DENIED';end if;
 select driver_user_id,id into driver_id,driver_assignment from driver_vehicle_assignments where vehicle_id=vehicle.id and active;
 if not exists(select 1 from auth.users u join profiles p on p.id=u.id and p.active
  where u.id=driver_id and u.deleted_at is null and u.raw_app_meta_data->>'fixture_source'='loadgistic'
   and u.raw_user_meta_data->>'fixture_key'=allowed.driver_fixture_key
   and(lower(u.email)=allowed.driver_email or lower(u.email)~'^falmatad97\+[a-z0-9][a-z0-9._-]{0,80}@gmail\.com$'))
  then raise exception 'DEMO_TARGET_DENIED';end if;
 select * into selection from telematics_location_sources where vehicle_id=vehicle.id;
 if not found or selection.source<>'GPS' then raise exception 'DEMO_TARGET_DENIED';end if;
 select location_precision_km,visibility,coalesce(market_status,status::text)
  into radius,capacity_visibility,capacity_status from capacities where vehicle_id=vehicle.id order by updated_at desc,id desc limit 1;
 radius:=coalesce(selection.precision_km,radius);
 if capacity_visibility is distinct from 'OPEN' or capacity_status is null or capacity_status not in('EMPTY','PARTIAL')
  or radius is null or radius not in(1,3,5,10,20,40) then raise exception 'DEMO_TARGET_DENIED';end if;
 result:=jsonb_build_object('vehicleId',vehicle.id,'ownerId',owner_id,'driverId',driver_id,'driverAssignment',driver_assignment,
  'deviceId',device.id,'deviceAssignment',device_assignment,'deviceRevision',device.revision,'gatewayId',device.gateway_id,
  'source','GPS','sourceRevision',selection.revision,'precisionKm',radius,'routeLat',allowed.route_lat,'routeLng',allowed.route_lng);
 return result||jsonb_build_object('digest',encode(sha256(convert_to(result::text,'UTF8')),'hex'));
end $$;
revoke all on function public.demo_motion_binding_fleet(uuid) from public,anon,authenticated,service_role;

-- Patch only the known 156 function anchors. Unexpected catalog drift stops the
-- entire transaction; no partial allowlist or broadened check remains installed.
do $patch$
declare definition text;anchor text;replacement text;constraint_definition text;
begin
 select pg_get_constraintdef(c.oid) into constraint_definition from pg_constraint c
  where c.conrelid='public.demo_motion_targets'::regclass and c.conname='demo_motion_targets_vehicle_id_check';
 if constraint_definition is null or md5(constraint_definition)<>'5ff20d611b0bc6fe7776866095de1566'
  or position('caf1d0db-4d8e-4ce9-a879-6c7b6017de3a' in constraint_definition)=0
  or position('2f22cc5a-d654-4405-98b7-9a1a9cf42fe3' in constraint_definition)=0
  then raise exception 'DEMO_COHORT_CONSTRAINT_DRIFT';end if;
 alter table public.demo_motion_targets drop constraint demo_motion_targets_vehicle_id_check;
 alter table public.demo_motion_targets add constraint demo_motion_targets_vehicle_id_check check(vehicle_id in(
  'caf1d0db-4d8e-4ce9-a879-6c7b6017de3a','2f22cc5a-d654-4405-98b7-9a1a9cf42fe3',
  '2020967a-92d3-4b1d-8f40-3c670dc97a50','19838ed9-c898-43dd-a6d5-5d4c26d0e92d',
  '2c449a7d-d26d-4eeb-aa64-7f4ba9f33c9d','0088dba7-04c7-425e-b5a9-64b721a753f0',
  '5bf57d7a-2159-45f9-9f90-3cdef5ed43d8','0dc90cf6-7735-4ccc-b030-98a81c40ffd6',
  '02c0a10d-3b4b-4b83-9f85-6272f8b6ce95','28b05503-eb24-4b78-8646-6a1813207813'));
 definition:=pg_get_functiondef('public.demo_motion_binding(uuid)'::regprocedure);
 if md5(definition)<>'c99a40b7d03f6e605eed052e081e86c5' then raise exception 'DEMO_COHORT_BINDING_DRIFT';end if;
 anchor:='else raise exception ''DEMO_TARGET_DENIED'';end if;';
 if(length(definition)-length(replace(definition,anchor,'')))/length(anchor)<>1 then raise exception 'DEMO_COHORT_BINDING_DRIFT';end if;
 execute replace(definition,anchor,'else return public.demo_motion_binding_fleet(target_vehicle_id);end if;');
 definition:=pg_get_functiondef('public.reserve_demo_gps_tick(uuid,uuid,bigint,double precision,double precision)'::regprocedure);
 if md5(definition)<>'d5fab25ee0bdcd101b51fc13870cafa5' then raise exception 'DEMO_COHORT_ROUTE_DRIFT';end if;
 anchor:='abs(latitude-9.031)>0.05 or abs(longitude-38.748)>0.05';
 if(length(definition)-length(replace(definition,anchor,'')))/length(anchor)<>1 then raise exception 'DEMO_COHORT_ROUTE_DRIFT';end if;
 execute replace(definition,anchor,
  'abs(latitude-coalesce((context->>''routeLat'')::double precision,9.031))>0.05 or abs(longitude-coalesce((context->>''routeLng'')::double precision,38.748))>0.05');
 definition:=pg_get_functiondef('public.ingest_telematics_position(text,jsonb)'::regprocedure);
 if md5(definition)<>'aff8678408b4785318748eb080e49a79' then raise exception 'DEMO_COHORT_INGEST_DRIFT';end if;
 anchor:='device.imei in(''990000000000001'',''990000000000002'')';
 if(length(definition)-length(replace(definition,anchor,'')))/length(anchor)<>1 then raise exception 'DEMO_COHORT_INGEST_DRIFT';end if;
 replacement:='device.imei in(''990000000000001'',''990000000000002'',''990000000000005'',''990000000000006'',''990000000000007'',''990000000000008'',''990000000000009'',''990000000000010'',''990000000000011'',''990000000000012'')';
 execute replace(definition,anchor,replacement);
end $patch$;
notify pgrst,'reload schema';
commit;
