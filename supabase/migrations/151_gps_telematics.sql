-- FEAT-GPS-001 / ADR-080. Additive private device ownership and attributed capacity.
begin;
select pg_advisory_xact_lock(8030151);

create table public.telematics_gateways(
 id uuid primary key,label text not null check(length(label) between 2 and 100),
 token_digest text not null unique check(token_digest~'^[a-f0-9]{64}$'),
 synthetic_only boolean not null default false,active boolean not null default true,created_at timestamptz not null default clock_timestamp()
);
create table public.telematics_devices(
 id uuid primary key default gen_random_uuid(),gateway_id uuid not null references public.telematics_gateways(id),
 gateway_device_id bigint not null check(gateway_device_id>0),imei text not null unique check(imei~'^[0-9]{15}$' and imei<>repeat('0',15)),
 protocol text not null check(protocol in('gt06','teltonika','h02','jt808')),protocol_device_id text not null check(protocol_device_id~'^[A-Za-z0-9_-]{5,40}$'),
 organization_id uuid references public.organizations(id) on delete cascade,
 provider_profile_id uuid references public.provider_profiles(id) on delete cascade,
 label text not null check(length(trim(label)) between 2 and 100),model_profile text not null check(model_profile in('UNVERIFIED','SYNTHETIC_GT06')),
 synthetic boolean not null default false,active boolean not null default true,revision timestamptz not null default clock_timestamp(),last_seen_at timestamptz,
 check(num_nonnulls(organization_id,provider_profile_id)=1),check(model_profile<>'SYNTHETIC_GT06' or synthetic and protocol='gt06'),
 unique(gateway_id,gateway_device_id),unique(gateway_id,protocol,protocol_device_id)
);
create table public.telematics_device_assignments(
 id uuid primary key default gen_random_uuid(),device_id uuid not null references public.telematics_devices(id) on delete cascade,
 vehicle_id uuid not null references public.vehicles(id) on delete cascade,assigned_by uuid references public.profiles(id) on delete set null,
 assigned_at timestamptz not null default clock_timestamp(),ended_at timestamptz,check(ended_at is null or ended_at>=assigned_at)
);
create unique index telematics_current_device_idx on public.telematics_device_assignments(device_id) where ended_at is null;
create unique index telematics_current_vehicle_idx on public.telematics_device_assignments(vehicle_id) where ended_at is null;
create table public.telematics_location_sources(
 vehicle_id uuid primary key references public.vehicles(id) on delete cascade,source text not null check(source in('GPS','MOBILE','MANUAL')),
 precision_km integer not null check(precision_km in(1,3,5,10,20,40)),selected_by uuid references public.profiles(id) on delete set null,
 selected_at timestamptz not null default clock_timestamp(),revision timestamptz not null default clock_timestamp(),
 manual_latitude double precision,manual_longitude double precision,
 check((source='MANUAL')=(manual_latitude is not null and manual_longitude is not null)),
 check(manual_latitude between -90 and 90),check(manual_longitude between -180 and 180)
);
create table public.telematics_positions(
 id uuid primary key default gen_random_uuid(),gateway_id uuid not null references public.telematics_gateways(id),event_key text not null,
 payload_digest text not null,device_id uuid not null references public.telematics_devices(id) on delete cascade,
 assignment_id uuid references public.telematics_device_assignments(id) on delete set null,
 vehicle_id uuid references public.vehicles(id) on delete set null,
 observed_at timestamptz not null,received_at timestamptz not null,valid boolean not null,
 latitude double precision not null check(latitude between -90 and 90),longitude double precision not null check(longitude between -180 and 180),
 speed_kph double precision not null check(speed_kph between 0 and 300),course double precision check(course>=0 and course<360),
 attributes jsonb not null default '{}',created_at timestamptz not null default clock_timestamp(),unique(gateway_id,event_key)
);
create index telematics_device_fix_idx on public.telematics_positions(device_id,observed_at desc,id desc);
create index telematics_position_retention_idx on public.telematics_positions(created_at,id);
create table public.telematics_engine_stepups(
 id uuid primary key default gen_random_uuid(),owner_user_id uuid not null references public.profiles(id) on delete cascade,
 device_id uuid not null references public.telematics_devices(id) on delete cascade,assignment_id uuid not null references public.telematics_device_assignments(id) on delete cascade,
 vehicle_id uuid not null references public.vehicles(id) on delete cascade,command text not null check(command in('ENGINE_CUT','ENGINE_RESTORE')),
 expires_at timestamptz not null,consumed_at timestamptz,created_at timestamptz not null default clock_timestamp()
);
create table public.telematics_commands(
 id uuid primary key default gen_random_uuid(),device_id uuid not null references public.telematics_devices(id) on delete cascade,
 owner_user_id uuid references public.profiles(id) on delete set null,assignment_id uuid references public.telematics_device_assignments(id) on delete set null,
 vehicle_id uuid references public.vehicles(id) on delete set null,idempotency_key uuid not null,
 command text not null check(command in('LOCATE','REBOOT','REPORT_INTERVAL','ENGINE_CUT','ENGINE_RESTORE')),
 interval_seconds integer check(interval_seconds between 30 and 3600),
 state text not null check(state in('REQUESTED','DISPATCHING','DISPATCHED','ACKNOWLEDGED','FAILED','EXPIRED','UNKNOWN')),
 requested_at timestamptz not null default clock_timestamp(),expires_at timestamptz not null,lease_id uuid,lease_until timestamptz,
 dispatched_at timestamptz,acknowledged_at timestamptz,result_event_key text,failure_code text,
 unique(device_id,idempotency_key),unique(device_id,result_event_key),check((command='REPORT_INTERVAL')=(interval_seconds is not null))
);
create index telematics_command_queue_idx on public.telematics_commands(state,requested_at,id);
create table public.telematics_gateway_requests(
 gateway_id uuid not null references public.telematics_gateways(id),nonce uuid not null,body_digest text not null,
 issued_at timestamptz not null,created_at timestamptz not null default clock_timestamp(),primary key(gateway_id,nonce)
);

-- Extend only capacity provenance. Preserve the worldwide privacy/radius,
-- timestamp and non-null gates; shipment Tracking constraints are untouched.
alter table public.capacities drop constraint capacity_device_location_check;
alter table public.capacities add constraint capacity_device_location_check check(
 coalesce(market_status,status::text)='OFF_DUTY' or(
  location_source is not null and location_source in('DEVICE_OBSCURED','TELEMATICS','MANUAL_ADMIN')
  and location_updated_at is not null and location_lat is not null and location_lng is not null
  and location_lat between -90 and 90 and location_lng between -180 and 180
  and location_precision_km in(1,3,5,10,20,40)
 )
);

do $private$
declare name text;
begin
 foreach name in array array['telematics_gateways','telematics_devices','telematics_device_assignments','telematics_location_sources',
  'telematics_positions','telematics_engine_stepups','telematics_commands','telematics_gateway_requests'] loop
  execute format('alter table public.%I enable row level security',name);
  execute format('revoke all on public.%I from public,anon,authenticated',name);
  execute format('grant select,insert,update,delete on public.%I to service_role',name);
 end loop;
end $private$;

create function public.telematics_obscure(latitude double precision,longitude double precision,radius integer)
returns jsonb language plpgsql immutable set search_path=public,pg_temp as $$
declare bands bigint;row_no bigint;columns_count bigint;column_no bigint;lat_step double precision;south double precision;north double precision;
 near_equator double precision;lng_step double precision;wrapped double precision;
begin
 if latitude is null or longitude is null or radius is null or latitude not between -90 and 90 or longitude not between -180 and 180
 or radius not in(1,3,5,10,20,40) then raise exception 'INVALID_TELEMATICS_INPUT';end if;
 bands:=ceil(pi()/(radius*0.49/6371));lat_step:=pi()/bands;row_no:=least(bands-1,floor((radians(latitude)+pi()/2)/lat_step));
 south:=-pi()/2+row_no*lat_step;north:=south+lat_step;
 near_equator:=case when south<=0 and north>=0 then 0 else least(abs(south),abs(north)) end;
 columns_count:=greatest(1,ceil(2*pi()/(radius*0.49/(6371*greatest(1e-12,cos(near_equator))))));
 lng_step:=2*pi()/columns_count;wrapped:=longitude-360*floor((longitude+180)/360);
 column_no:=least(columns_count-1,floor((radians(wrapped)+pi())/lng_step));
 return jsonb_build_object('latitude',round(degrees((south+north)/2)::numeric,5),
  'longitude',round(degrees(-pi()+(((column_no+1)%columns_count)+0.5)*lng_step)::numeric,5),'precisionKm',radius);
end $$;

create function public.register_telematics_gateway(actor_user_id uuid,gateway_id uuid,gateway_label text,gateway_token_digest text,demo_only boolean default false)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if not exists(select 1 from profiles where id=actor_user_id and active and role='ADMIN') then raise exception 'FORBIDDEN';end if;
 if gateway_id is null or gateway_token_digest is null or gateway_label is null or gateway_token_digest !~ '^[a-f0-9]{64}$' or length(trim(gateway_label)) not between 2 and 100
  then raise exception 'INVALID_TELEMATICS_INPUT';end if;
 insert into telematics_gateways(id,label,token_digest,synthetic_only) values(gateway_id,trim(gateway_label),gateway_token_digest,demo_only);
 insert into audit_logs(actor_user_id,action,entity_type,entity_id,details) values(actor_user_id,'TELEMATICS_GATEWAY_REGISTERED','telematics_gateway',gateway_id,jsonb_build_object('syntheticOnly',demo_only));
 return gateway_id;
end $$;

create function public.provision_telematics_device(actor_user_id uuid,command jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare owner_org uuid:=nullif(provision_telematics_device.command->>'ownerOrganizationId','')::uuid;owner_profile uuid:=nullif(provision_telematics_device.command->>'ownerProviderProfileId','')::uuid;
 gateway telematics_gateways%rowtype;device telematics_devices%rowtype;owner_id uuid;synthetic_value boolean:=coalesce((provision_telematics_device.command->>'synthetic')::boolean,false);
begin
 if not exists(select 1 from profiles where id=actor_user_id and active and role='ADMIN') then raise exception 'FORBIDDEN';end if;
 if provision_telematics_device.command is null or jsonb_typeof(provision_telematics_device.command)<>'object' or num_nonnulls(owner_org,owner_profile)<>1
  or provision_telematics_device.command->>'imei' is null or provision_telematics_device.command->>'protocol' is null or provision_telematics_device.command->>'protocolDeviceId' is null or provision_telematics_device.command->>'label' is null
  or provision_telematics_device.command->>'imei' !~ '^[0-9]{15}$' or provision_telematics_device.command->>'imei'=repeat('0',15)
  or provision_telematics_device.command->>'protocol' not in('gt06','teltonika','h02','jt808') or provision_telematics_device.command->>'protocolDeviceId' !~ '^[A-Za-z0-9_-]{5,40}$'
  or length(trim(provision_telematics_device.command->>'label')) not between 2 and 100 or coalesce(provision_telematics_device.command->>'modelProfile','UNVERIFIED') not in('UNVERIFIED','SYNTHETIC_GT06')
  or coalesce((provision_telematics_device.command->>'gatewayDeviceId')::bigint,0)<=0 then raise exception 'INVALID_TELEMATICS_INPUT';end if;
 select * into gateway from telematics_gateways where id=(provision_telematics_device.command->>'gatewayId')::uuid and active for share;
 if not found then raise exception 'GATEWAY_UNAVAILABLE';end if;
 select p.id into owner_id from profiles p where p.active and(
  owner_org is not null and p.role='TRANSPORTER' and exists(select 1 from organization_members m join organizations o on o.id=m.organization_id
   where m.user_id=p.id and m.organization_id=owner_org and m.membership_role='OWNER' and o.type='TRANSPORT_COMPANY')
  or owner_profile is not null and p.role='DRIVER' and exists(select 1 from provider_profiles x where x.id=owner_profile and x.user_id=p.id));
 if owner_id is null then raise exception 'DEVICE_OWNER_INVALID';end if;
 if synthetic_value and(not gateway.synthetic_only or not exists(select 1 from auth.users u where u.id=owner_id
  and u.email like '%@loadgistic.local' and u.raw_app_meta_data->>'fixture_source'='loadgistic'))
  or gateway.synthetic_only<>synthetic_value or provision_telematics_device.command->>'modelProfile'='SYNTHETIC_GT06' and(not synthetic_value or provision_telematics_device.command->>'protocol'<>'gt06')
  then raise exception 'DEVICE_OWNER_INVALID';end if;
 begin
  insert into telematics_devices(gateway_id,gateway_device_id,imei,protocol,protocol_device_id,organization_id,provider_profile_id,label,model_profile,synthetic)
  values(gateway.id,(provision_telematics_device.command->>'gatewayDeviceId')::bigint,provision_telematics_device.command->>'imei',provision_telematics_device.command->>'protocol',provision_telematics_device.command->>'protocolDeviceId',owner_org,owner_profile,
   trim(provision_telematics_device.command->>'label'),coalesce(provision_telematics_device.command->>'modelProfile','UNVERIFIED'),synthetic_value) returning * into device;
 exception when unique_violation then raise exception 'DEVICE_BINDING_CONFLICT';end;
 insert into audit_logs(actor_user_id,organization_id,action,entity_type,entity_id,details)
 values(actor_user_id,owner_org,'TELEMATICS_DEVICE_PROVISIONED','telematics_device',device.id,jsonb_build_object('providerProfileId',owner_profile,'protocol',device.protocol,'synthetic',device.synthetic));
 return jsonb_build_object('id',device.id,'revision',device.revision);
end $$;

create function public.assign_telematics_device(actor_user_id uuid,command jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare scope record;device telematics_devices%rowtype;vehicle vehicles%rowtype;target_vehicle uuid:=nullif(assign_telematics_device.command->>'vehicleId','')::uuid;stamp timestamptz;
begin
 select * into scope from public.fleet_lock_provider_owner(actor_user_id);
 select * into device from telematics_devices where id=(assign_telematics_device.command->>'deviceId')::uuid and active for update;
 if not found or device.organization_id is distinct from scope.organization_id or device.provider_profile_id is distinct from scope.provider_profile_id then raise exception 'NOT_FOUND';end if;
 if nullif(assign_telematics_device.command->>'expectedRevision','')::timestamptz is distinct from device.revision then raise exception 'TELEMATICS_CHANGED';end if;
 if target_vehicle is not null then
  select * into vehicle from vehicles where id=target_vehicle and active for update;
  if not found or vehicle.organization_id is distinct from scope.organization_id or vehicle.provider_profile_id is distinct from scope.provider_profile_id then raise exception 'NOT_FOUND';end if;
  if exists(select 1 from telematics_device_assignments a where a.vehicle_id=target_vehicle and a.ended_at is null and a.device_id<>device.id)
   then raise exception 'DEVICE_BINDING_CONFLICT';end if;
 end if;
 stamp:=greatest(clock_timestamp(),device.revision+interval '1 microsecond');
 update telematics_device_assignments set ended_at=stamp where device_id=device.id and ended_at is null;
 if target_vehicle is not null then insert into telematics_device_assignments(device_id,vehicle_id,assigned_by,assigned_at) values(device.id,target_vehicle,actor_user_id,stamp);end if;
 update telematics_devices set revision=stamp where id=device.id;
 update telematics_commands set state='FAILED',failure_code='ASSIGNMENT_CHANGED' where device_id=device.id and state in('REQUESTED','DISPATCHING');
 insert into audit_logs(actor_user_id,organization_id,action,entity_type,entity_id,details)
 values(actor_user_id,scope.organization_id,'TELEMATICS_DEVICE_ASSIGNED','telematics_device',device.id,jsonb_build_object('vehicleId',target_vehicle,'providerProfileId',scope.provider_profile_id));
 return jsonb_build_object('id',device.id,'revision',stamp,'vehicleId',target_vehicle);
end $$;

create function public.telematics_effective_location(target_vehicle_id uuid)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare selected telematics_location_sources%rowtype;fix telematics_positions%rowtype;assignment telematics_device_assignments%rowtype;point jsonb;
begin
 select * into selected from telematics_location_sources where vehicle_id=target_vehicle_id;
 if not found or selected.source='MOBILE' then return null;end if;
 if selected.source='MANUAL' then
  point:=public.telematics_obscure(selected.manual_latitude,selected.manual_longitude,selected.precision_km);
  return point||jsonb_build_object('source','MANUAL_ADMIN','observedAt',selected.selected_at);
 end if;
 select a.* into assignment from telematics_device_assignments a join telematics_devices d on d.id=a.device_id and d.active
  join vehicles v on v.id=a.vehicle_id and v.active and v.organization_id is not distinct from d.organization_id and v.provider_profile_id is not distinct from d.provider_profile_id
 where a.vehicle_id=target_vehicle_id and a.ended_at is null;
 if not found then return null;end if;
 select p.* into fix from telematics_positions p where p.device_id=assignment.device_id and p.assignment_id=assignment.id and p.valid
  and p.observed_at>=greatest(assignment.assigned_at,selected.selected_at,coalesce(public.provider_capacity_pair_started_at(target_vehicle_id),'-infinity'::timestamptz))
  and p.observed_at<=clock_timestamp() order by p.observed_at desc,p.id desc limit 1;
 if not found then return null;end if;
 point:=public.telematics_obscure(fix.latitude,fix.longitude,selected.precision_km);
 return point||jsonb_build_object('source','TELEMATICS','observedAt',fix.observed_at);
end $$;

create function public.apply_telematics_capacity_location(target_vehicle_id uuid)
returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
declare fix jsonb;capacity_id uuid;old_time timestamptz;old_source text;
begin
 perform 1 from vehicles where id=target_vehicle_id and active for update;if not found then return false;end if;
 fix:=public.telematics_effective_location(target_vehicle_id);if fix is null then return false;end if;
 select c.id,c.location_updated_at,c.location_source into capacity_id,old_time,old_source from capacities c where c.vehicle_id=target_vehicle_id
  order by c.updated_at desc,c.id desc limit 1 for update;
 if capacity_id is null or (old_time is not null and (old_time>(fix->>'observedAt')::timestamptz
  or old_time=(fix->>'observedAt')::timestamptz and old_source=fix->>'source')) then return false;end if;
 update capacities set location_lat=(fix->>'latitude')::double precision,location_lng=(fix->>'longitude')::double precision,
  location_precision_km=(fix->>'precisionKm')::integer,location_updated_at=(fix->>'observedAt')::timestamptz,
  location_source=fix->>'source',location_area='Approximate location',location_place_ref=null where id=capacity_id;
 return true;
end $$;

create function public.select_telematics_location_source(actor_user_id uuid,command jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare scope record;vehicle vehicles%rowtype;selected telematics_location_sources%rowtype;stamp timestamptz:=clock_timestamp();source_value text:=select_telematics_location_source.command->>'source';
begin
 select * into scope from public.fleet_lock_provider_owner(actor_user_id);
 select * into vehicle from vehicles where id=(select_telematics_location_source.command->>'vehicleId')::uuid and active for update;
 if not found or vehicle.organization_id is distinct from scope.organization_id or vehicle.provider_profile_id is distinct from scope.provider_profile_id then raise exception 'NOT_FOUND';end if;
 if source_value is null or source_value not in('GPS','MOBILE','MANUAL') or coalesce((select_telematics_location_source.command->>'precisionKm')::integer,0) not in(1,3,5,10,20,40) then raise exception 'INVALID_TELEMATICS_INPUT';end if;
 select * into selected from telematics_location_sources where vehicle_id=vehicle.id for update;
 if nullif(select_telematics_location_source.command->>'expectedRevision','')::timestamptz is distinct from coalesce(selected.revision,'1970-01-01'::timestamptz) then raise exception 'TELEMATICS_CHANGED';end if;
 if source_value='GPS' and not exists(select 1 from telematics_device_assignments a join telematics_devices d on d.id=a.device_id and d.active
  where a.vehicle_id=vehicle.id and a.ended_at is null) then raise exception 'DEVICE_NOT_ASSIGNED';end if;
 if source_value='MANUAL' and(select_telematics_location_source.command->>'manualLatitude' is null or select_telematics_location_source.command->>'manualLongitude' is null
  or (select_telematics_location_source.command->>'manualLatitude')::double precision not between -90 and 90 or (select_telematics_location_source.command->>'manualLongitude')::double precision not between -180 and 180)
  then raise exception 'INVALID_TELEMATICS_INPUT';end if;
 if source_value<>'MANUAL' and(select_telematics_location_source.command ? 'manualLatitude' or select_telematics_location_source.command ? 'manualLongitude') then raise exception 'INVALID_TELEMATICS_INPUT';end if;
 stamp:=greatest(stamp,coalesce(selected.revision+interval '1 microsecond',stamp));
 insert into telematics_location_sources(vehicle_id,source,precision_km,selected_by,selected_at,revision,manual_latitude,manual_longitude)
 values(vehicle.id,source_value,(select_telematics_location_source.command->>'precisionKm')::integer,actor_user_id,stamp,stamp,
  case when source_value='MANUAL' then (select_telematics_location_source.command->>'manualLatitude')::double precision end,
  case when source_value='MANUAL' then (select_telematics_location_source.command->>'manualLongitude')::double precision end)
 on conflict(vehicle_id) do update set source=excluded.source,precision_km=excluded.precision_km,selected_by=excluded.selected_by,
  selected_at=excluded.selected_at,revision=excluded.revision,manual_latitude=excluded.manual_latitude,manual_longitude=excluded.manual_longitude;
 perform public.apply_telematics_capacity_location(vehicle.id);
 insert into audit_logs(actor_user_id,organization_id,action,entity_type,entity_id,details)
 values(actor_user_id,scope.organization_id,'TELEMATICS_LOCATION_SOURCE_SELECTED','vehicle',vehicle.id,jsonb_build_object('source',source_value,'precisionKm',(select_telematics_location_source.command->>'precisionKm')::integer));
 return jsonb_build_object('vehicleId',vehicle.id,'revision',stamp,'source',source_value);
end $$;

create function public.authorize_telematics_gateway_request(gateway_digest text,request_nonce uuid,request_body_digest text,request_issued_at timestamptz)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare gateway telematics_gateways%rowtype;
begin
 select * into gateway from telematics_gateways where token_digest=gateway_digest and active;
 if not found or request_nonce is null or request_body_digest is null or request_body_digest !~ '^[a-f0-9]{64}$' or request_issued_at is null
  or abs(extract(epoch from(clock_timestamp()-request_issued_at)))>120 then raise exception 'GATEWAY_UNAVAILABLE';end if;
 begin insert into telematics_gateway_requests(gateway_id,nonce,body_digest,issued_at) values(gateway.id,request_nonce,request_body_digest,request_issued_at);
 exception when unique_violation then raise exception 'GATEWAY_UNAVAILABLE';end;
 return gateway.id;
end $$;

create function public.ingest_telematics_position(gateway_digest text,command jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare gateway telematics_gateways%rowtype;device telematics_devices%rowtype;assignment telematics_device_assignments%rowtype;prior telematics_positions%rowtype;
 stamp timestamptz:=clock_timestamp();observed timestamptz;received timestamptz;position_id uuid;applied boolean:=false;
begin
 select * into gateway from telematics_gateways where token_digest=gateway_digest and active for share;
 if not found then raise exception 'GATEWAY_UNAVAILABLE';end if;
 if ingest_telematics_position.command is null or jsonb_typeof(ingest_telematics_position.command)<>'object' or ingest_telematics_position.command->>'eventKey' is null
  or ingest_telematics_position.command->>'protocol' is null or ingest_telematics_position.command->>'protocolDeviceId' is null or ingest_telematics_position.command->>'latitude' is null or ingest_telematics_position.command->>'longitude' is null or ingest_telematics_position.command->>'speedKph' is null
  or ingest_telematics_position.command->>'eventKey' !~ '^[A-Za-z0-9:_-]{1,120}$'
  or ingest_telematics_position.command->>'protocol' not in('gt06','teltonika','h02','jt808') or ingest_telematics_position.command->>'protocolDeviceId' !~ '^[A-Za-z0-9_-]{5,40}$'
  or jsonb_typeof(ingest_telematics_position.command->'valid') is distinct from 'boolean' or (ingest_telematics_position.command->>'latitude')::double precision not between -90 and 90
  or (ingest_telematics_position.command->>'longitude')::double precision not between -180 and 180 or (ingest_telematics_position.command->>'speedKph')::double precision not between 0 and 300
  or jsonb_typeof(ingest_telematics_position.command->'attributes') is distinct from 'object' then raise exception 'INVALID_TELEMATICS_INPUT';end if;
 if exists(select 1 from jsonb_object_keys(ingest_telematics_position.command->'attributes') k where k not in('ignition','battery','power','alarm')) then raise exception 'INVALID_TELEMATICS_INPUT';end if;
 if ingest_telematics_position.command->'attributes' ? 'ignition' and jsonb_typeof(ingest_telematics_position.command->'attributes'->'ignition') is distinct from 'boolean'
  or ingest_telematics_position.command->'attributes' ? 'battery' and (ingest_telematics_position.command->'attributes'->>'battery')::double precision not between 0 and 100
  or ingest_telematics_position.command->'attributes' ? 'power' and (ingest_telematics_position.command->'attributes'->>'power')::double precision not between 0 and 1000
  or ingest_telematics_position.command->'attributes' ? 'alarm' and ingest_telematics_position.command->'attributes'->>'alarm' not in('sos','powerCut','overspeed','vibration','lowBattery','tampering')
  then raise exception 'INVALID_TELEMATICS_INPUT';end if;
 observed:=(ingest_telematics_position.command->>'observedAt')::timestamptz;received:=(ingest_telematics_position.command->>'receivedAt')::timestamptz;
 if observed is null or received is null or observed>stamp+interval '2 minutes' or received>stamp+interval '2 minutes'
  or observed>received+interval '2 minutes' or observed<stamp-interval '30 days' or received<stamp-interval '30 days' then raise exception 'TELEMETRY_TIME_INVALID';end if;
 select * into device from telematics_devices where gateway_id=gateway.id and gateway_device_id=(ingest_telematics_position.command->>'gatewayDeviceId')::bigint
  and protocol=ingest_telematics_position.command->>'protocol' and protocol_device_id=ingest_telematics_position.command->>'protocolDeviceId' and active for update;
 if not found or gateway.synthetic_only<>device.synthetic then raise exception 'TELEMETRY_BINDING_DENIED';end if;
 -- Recheck the current provider, never revive a closed owner from gateway data.
 if not exists(select 1 from profiles p where p.active and(
  device.organization_id is not null and p.role='TRANSPORTER' and exists(select 1 from organization_members m where m.organization_id=device.organization_id and m.user_id=p.id and m.membership_role='OWNER')
  or device.provider_profile_id is not null and p.role='DRIVER' and exists(select 1 from provider_profiles x where x.id=device.provider_profile_id and x.user_id=p.id))) then raise exception 'DEVICE_OWNER_INVALID';end if;
 select * into prior from telematics_positions where gateway_id=gateway.id and event_key=ingest_telematics_position.command->>'eventKey';
 if found then
  if prior.payload_digest<>md5(ingest_telematics_position.command::text) or prior.device_id<>device.id then raise exception 'TELEMETRY_EVENT_CONFLICT';end if;
  return jsonb_build_object('outcome','DUPLICATE','applied',false);
 end if;
 select * into assignment from telematics_device_assignments where device_id=device.id and ended_at is null;
 if assignment.id is not null and observed<assignment.assigned_at then assignment:=null;end if;
 insert into telematics_positions(gateway_id,event_key,payload_digest,device_id,assignment_id,vehicle_id,observed_at,received_at,valid,latitude,longitude,speed_kph,course,attributes)
 values(gateway.id,ingest_telematics_position.command->>'eventKey',md5(ingest_telematics_position.command::text),device.id,assignment.id,assignment.vehicle_id,observed,received,(ingest_telematics_position.command->>'valid')::boolean,
  (ingest_telematics_position.command->>'latitude')::double precision,(ingest_telematics_position.command->>'longitude')::double precision,(ingest_telematics_position.command->>'speedKph')::double precision,
  nullif(ingest_telematics_position.command->>'course','')::double precision,ingest_telematics_position.command->'attributes') returning id into position_id;
 update telematics_devices set last_seen_at=greatest(coalesce(last_seen_at,'-infinity'::timestamptz),received) where id=device.id;
 if assignment.vehicle_id is not null and observed<=stamp and (ingest_telematics_position.command->>'valid')::boolean then applied:=public.apply_telematics_capacity_location(assignment.vehicle_id);end if;
 return jsonb_build_object('outcome',case when applied then 'ACCEPTED' else 'HISTORICAL' end,'applied',applied);
exception when invalid_text_representation or numeric_value_out_of_range or datetime_field_overflow then raise exception 'INVALID_TELEMATICS_INPUT';
end $$;

create function public.authorize_synthetic_engine_command(actor_user_id uuid,command jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare scope record;device telematics_devices%rowtype;assignment telematics_device_assignments%rowtype;step_id uuid;stamp timestamptz:=clock_timestamp();
begin
 select * into scope from public.fleet_lock_provider_owner(actor_user_id);
 select * into device from telematics_devices where id=(authorize_synthetic_engine_command.command->>'deviceId')::uuid and active for update;
 if not found or device.organization_id is distinct from scope.organization_id or device.provider_profile_id is distinct from scope.provider_profile_id then raise exception 'NOT_FOUND';end if;
 if not device.synthetic or device.model_profile<>'SYNTHETIC_GT06' then raise exception 'ENGINE_CONTROL_UNAVAILABLE';end if;
 if authorize_synthetic_engine_command.command->>'command' is null or authorize_synthetic_engine_command.command->>'command' not in('ENGINE_CUT','ENGINE_RESTORE')
  or not exists(select 1 from auth.users where id=actor_user_id and last_sign_in_at>=stamp-interval '5 minutes'
   and email like '%@loadgistic.local' and raw_app_meta_data->>'fixture_source'='loadgistic') then raise exception 'ENGINE_STEP_UP_REQUIRED';end if;
 select * into assignment from telematics_device_assignments where device_id=device.id and ended_at is null;
 if not found or assignment.vehicle_id is distinct from (authorize_synthetic_engine_command.command->>'vehicleId')::uuid then raise exception 'DEVICE_NOT_ASSIGNED';end if;
 insert into telematics_engine_stepups(owner_user_id,device_id,assignment_id,vehicle_id,command,expires_at)
 values(actor_user_id,device.id,assignment.id,assignment.vehicle_id,authorize_synthetic_engine_command.command->>'command',stamp+interval '30 seconds') returning id into step_id;
 insert into audit_logs(actor_user_id,organization_id,action,entity_type,entity_id,details)
 values(actor_user_id,scope.organization_id,'SYNTHETIC_ENGINE_STEP_UP_AUTHORIZED','telematics_device',device.id,jsonb_build_object('vehicleId',assignment.vehicle_id,'command',authorize_synthetic_engine_command.command->>'command'));
 return jsonb_build_object('id',step_id,'expiresAt',stamp+interval '30 seconds');
end $$;

create function public.telematics_engine_interlock(target_device_id uuid,target_assignment_id uuid)
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select exists(select 1 from telematics_devices d join telematics_device_assignments a on a.device_id=d.id and a.id=target_assignment_id and a.ended_at is null
 join lateral(select p.* from telematics_positions p where p.device_id=d.id and p.assignment_id=a.id and p.valid and p.observed_at<=clock_timestamp()
  order by p.observed_at desc,p.id desc limit 1)p on true
 where d.id=target_device_id and d.active and d.synthetic and d.model_profile='SYNTHETIC_GT06'
  and d.last_seen_at>=clock_timestamp()-interval '30 seconds' and p.observed_at>=clock_timestamp()-interval '30 seconds'
  and p.speed_kph=0 and p.attributes->'ignition'='false'::jsonb)
$$;

create function public.request_telematics_command(actor_user_id uuid,command jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare scope record;device telematics_devices%rowtype;assignment telematics_device_assignments%rowtype;prior telematics_commands%rowtype;
 step telematics_engine_stepups%rowtype;command_value text:=request_telematics_command.command->>'command';stamp timestamptz:=clock_timestamp();expiry timestamptz;
begin
 select * into scope from public.fleet_lock_provider_owner(actor_user_id);
 select * into device from telematics_devices where id=(request_telematics_command.command->>'deviceId')::uuid and active for update;
 if not found or device.organization_id is distinct from scope.organization_id or device.provider_profile_id is distinct from scope.provider_profile_id then raise exception 'NOT_FOUND';end if;
 if command_value is null or command_value not in('LOCATE','REBOOT','REPORT_INTERVAL','ENGINE_CUT','ENGINE_RESTORE')
  or request_telematics_command.command->>'idempotencyKey' is null or exists(select 1 from jsonb_object_keys(request_telematics_command.command) k where k not in('deviceId','command','intervalSeconds','idempotencyKey','confirmed','stepUpId')) then raise exception 'INVALID_TELEMATICS_INPUT';end if;
 if command_value like 'ENGINE_%' and(not device.synthetic or device.model_profile<>'SYNTHETIC_GT06') then raise exception 'ENGINE_CONTROL_UNAVAILABLE';end if;
 if not device.synthetic or device.model_profile<>'SYNTHETIC_GT06' then raise exception 'DEVICE_COMMAND_UNSUPPORTED';end if;
 if command_value='REPORT_INTERVAL' and coalesce((request_telematics_command.command->>'intervalSeconds')::integer,0) not between 30 and 3600
  or command_value<>'REPORT_INTERVAL' and request_telematics_command.command ? 'intervalSeconds' then raise exception 'INVALID_TELEMATICS_INPUT';end if;
 select * into prior from telematics_commands where device_id=device.id and idempotency_key=(request_telematics_command.command->>'idempotencyKey')::uuid;
 if found then
  if prior.command<>command_value or prior.interval_seconds is distinct from (request_telematics_command.command->>'intervalSeconds')::integer then raise exception 'COMMAND_CHANGED';end if;
  return jsonb_build_object('id',prior.id,'state',prior.state,'expiresAt',prior.expires_at);
 end if;
 if(select count(*) from telematics_commands where device_id=device.id and requested_at>=stamp-interval '1 minute')>=5 then raise exception 'COMMAND_RATE_LIMITED';end if;
 select * into assignment from telematics_device_assignments where device_id=device.id and ended_at is null;
 if not found then raise exception 'DEVICE_NOT_ASSIGNED';end if;
 expiry:=stamp+interval '2 minutes';
 if command_value like 'ENGINE_%' then
  select s.* into step from telematics_engine_stepups s where s.id=(request_telematics_command.command->>'stepUpId')::uuid and s.owner_user_id=actor_user_id
   and s.device_id=device.id and s.assignment_id=assignment.id and s.vehicle_id=assignment.vehicle_id and s.command=command_value and s.consumed_at is null and s.expires_at>stamp for update;
  if not found or request_telematics_command.command->'confirmed' is distinct from 'true'::jsonb then raise exception 'ENGINE_STEP_UP_REQUIRED';end if;
  if not public.telematics_engine_interlock(device.id,assignment.id) then raise exception 'ENGINE_INTERLOCK_DENIED';end if;
  expiry:=least(step.expires_at,stamp+interval '15 seconds');update telematics_engine_stepups set consumed_at=stamp where id=step.id;
 end if;
 insert into telematics_commands(device_id,owner_user_id,assignment_id,vehicle_id,idempotency_key,command,interval_seconds,state,requested_at,expires_at)
 values(device.id,actor_user_id,assignment.id,assignment.vehicle_id,(request_telematics_command.command->>'idempotencyKey')::uuid,command_value,(request_telematics_command.command->>'intervalSeconds')::integer,'REQUESTED',stamp,expiry) returning * into prior;
 insert into audit_logs(actor_user_id,organization_id,action,entity_type,entity_id,details)
 values(actor_user_id,scope.organization_id,'TELEMATICS_COMMAND_REQUESTED','telematics_command',prior.id,jsonb_build_object('deviceId',device.id,'command',command_value,'synthetic',device.synthetic));
 return jsonb_build_object('id',prior.id,'state',prior.state,'expiresAt',prior.expires_at);
end $$;

create function public.claim_telematics_commands(gateway_digest text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare gateway telematics_gateways%rowtype;job telematics_commands%rowtype;device telematics_devices%rowtype;stamp timestamptz:=clock_timestamp();jobs jsonb:='[]';lease uuid;
begin
 select * into gateway from telematics_gateways where token_digest=gateway_digest and active;
 if not found then raise exception 'GATEWAY_UNAVAILABLE';end if;
 -- Device-before-command lock order matches assignment and owner command ports.
 for device in select d.* from telematics_devices d where d.gateway_id=gateway.id
  and exists(select 1 from telematics_commands c where c.device_id=d.id and c.state in('REQUESTED','DISPATCHING','DISPATCHED'))
  order by d.id for update of d skip locked limit 10
 loop
  update telematics_commands set state='EXPIRED',failure_code='TTL_EXPIRED'
   where device_id=device.id and state='REQUESTED' and expires_at<=stamp;
  update telematics_commands set state='UNKNOWN',failure_code='DISPATCH_OUTCOME_UNKNOWN'
   where device_id=device.id and(state='DISPATCHING' and lease_until<=stamp or state='DISPATCHED' and expires_at<=stamp);
  if exists(select 1 from telematics_commands c where c.device_id=device.id and c.state='DISPATCHING') then continue;end if;
  select * into job from telematics_commands c where c.device_id=device.id and c.state='REQUESTED' and c.expires_at>stamp
   order by c.requested_at,c.id for update skip locked limit 1;
  if not found then continue;end if;
  if not device.active or not exists(select 1 from telematics_device_assignments a where a.id=job.assignment_id and a.device_id=device.id and a.vehicle_id=job.vehicle_id and a.ended_at is null)
   or not public.fleet_actor_can_use_vehicle(job.owner_user_id,job.vehicle_id,true) then
   update telematics_commands set state='FAILED',failure_code='AUTHORITY_CHANGED' where id=job.id;continue;
  end if;
  if job.command like 'ENGINE_%' and not public.telematics_engine_interlock(device.id,job.assignment_id) then
   update telematics_commands set state='FAILED',failure_code='ENGINE_INTERLOCK_DENIED' where id=job.id;continue;
  end if;
  if device.last_seen_at is null or device.last_seen_at<stamp-interval '30 seconds' then continue;end if;
  lease:=gen_random_uuid();update telematics_commands set state='DISPATCHING',lease_id=lease,lease_until=least(job.expires_at,stamp+interval '20 seconds') where id=job.id;
  jobs:=jobs||jsonb_build_array(jsonb_build_object('id',job.id,'deviceId',device.id,'gatewayDeviceId',device.gateway_device_id,
   'protocol',device.protocol,'protocolDeviceId',device.protocol_device_id,'modelProfile',device.model_profile,'synthetic',device.synthetic,
   'command',job.command,'intervalSeconds',job.interval_seconds,'leaseId',lease,'expiresAt',job.expires_at));
 end loop;
 return jobs;
end $$;

create function public.record_telematics_command_result(gateway_digest text,command jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare gateway telematics_gateways%rowtype;job telematics_commands%rowtype;device telematics_devices%rowtype;state_value text:=record_telematics_command_result.command->>'state';stamp timestamptz:=clock_timestamp();
begin
 select * into gateway from telematics_gateways where token_digest=gateway_digest and active;if not found then raise exception 'GATEWAY_UNAVAILABLE';end if;
 select c.* into job from telematics_commands c join telematics_devices d on d.id=c.device_id and d.gateway_id=gateway.id
  where c.id=(record_telematics_command_result.command->>'commandId')::uuid for update of c;
 if not found or job.lease_id is distinct from (record_telematics_command_result.command->>'leaseId')::uuid then raise exception 'COMMAND_CHANGED';end if;
 if state_value is null or state_value not in('DISPATCHED','ACKNOWLEDGED','FAILED','UNKNOWN') then raise exception 'INVALID_TELEMATICS_INPUT';end if;
 if job.state in('ACKNOWLEDGED','FAILED','EXPIRED','UNKNOWN') then return jsonb_build_object('id',job.id,'state',job.state);end if;
 select * into device from telematics_devices where id=job.device_id;
 if job.expires_at<=stamp or not exists(select 1 from telematics_device_assignments a where a.id=job.assignment_id and a.ended_at is null)
  or not public.fleet_actor_can_use_vehicle(job.owner_user_id,job.vehicle_id,true) then state_value:='UNKNOWN';end if;
 if state_value='ACKNOWLEDGED' and(not device.synthetic or device.model_profile<>'SYNTHETIC_GT06'
  or record_telematics_command_result.command->'correlated' is distinct from 'true'::jsonb or record_telematics_command_result.command->>'eventKey' is null
  or record_telematics_command_result.command->>'eventKey' !~ '^[A-Za-z0-9:_-]{1,120}$') then state_value:='UNKNOWN';end if;
 update telematics_commands set state=state_value,dispatched_at=case when state_value='DISPATCHED' then stamp else dispatched_at end,
  acknowledged_at=case when state_value='ACKNOWLEDGED' then stamp else acknowledged_at end,
  result_event_key=case when state_value='ACKNOWLEDGED' then record_telematics_command_result.command->>'eventKey' else result_event_key end where id=job.id;
 insert into audit_logs(action,entity_type,entity_id,details) values('TELEMATICS_COMMAND_RESULT','telematics_command',job.id,jsonb_build_object('state',state_value,'synthetic',device.synthetic));
 return jsonb_build_object('id',job.id,'state',state_value);
end $$;

create function public.telematics_workspace(actor_user_id uuid,requested_page integer default 1)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare scope record;admin boolean;total_count integer;page_no integer;device_rows jsonb;vehicle_rows jsonb;command_rows jsonb;
begin
 select exists(select 1 from profiles where id=actor_user_id and active and role='ADMIN') into admin;
 if not admin then select * into scope from public.fleet_provider_owner_scope(actor_user_id);
 else select null::uuid as organization_id,null::uuid as provider_profile_id into scope;end if;
 select count(*) into total_count from telematics_devices d where admin or(d.organization_id is not distinct from scope.organization_id and d.provider_profile_id is not distinct from scope.provider_profile_id);
 page_no:=least(greatest(1,ceil(total_count/20.0)::integer),greatest(1,coalesce(requested_page,1)));
 select coalesce(jsonb_agg(row order by row->>'label',row->>'id'),'[]') into device_rows from(
  select jsonb_build_object('id',d.id,'label',d.label,'imei',d.imei,'protocol',d.protocol,'protocolDeviceId',d.protocol_device_id,
   'gatewayDeviceId',d.gateway_device_id,'modelProfile',d.model_profile,'synthetic',d.synthetic,'active',d.active,'revision',d.revision,
   'vehicleId',(select a.vehicle_id from telematics_device_assignments a where a.device_id=d.id and a.ended_at is null),'lastSeenAt',d.last_seen_at,
   'connection',case when d.last_seen_at is null then 'UNKNOWN' when d.last_seen_at>=clock_timestamp()-interval '2 minutes' then 'ONLINE' else 'STALE' end,
   'capabilities',case when d.synthetic and d.model_profile='SYNTHETIC_GT06' then '["LOCATE","REBOOT","REPORT_INTERVAL","ENGINE_CUT","ENGINE_RESTORE"]'::jsonb else '[]'::jsonb end,
   'lastAlarm',(select p.attributes->>'alarm' from telematics_positions p where p.device_id=d.id and p.observed_at<=clock_timestamp()
    and p.attributes->>'alarm' in('sos','powerCut','overspeed','vibration','lowBattery','tampering') order by p.observed_at desc,p.id desc limit 1),
   'alarmAt',(select p.observed_at from telematics_positions p where p.device_id=d.id and p.observed_at<=clock_timestamp()
    and p.attributes->>'alarm' in('sos','powerCut','overspeed','vibration','lowBattery','tampering') order by p.observed_at desc,p.id desc limit 1),
   'position',(select jsonb_build_object('latitude',p.latitude,'longitude',p.longitude,'speedKph',p.speed_kph,'course',p.course,
    'ignition',p.attributes->'ignition','battery',p.attributes->'battery','power',p.attributes->'power','alarm',p.attributes->'alarm','observedAt',p.observed_at,'receivedAt',p.received_at)
    from telematics_positions p where p.device_id=d.id and p.valid and p.observed_at<=clock_timestamp() order by p.observed_at desc,p.id desc limit 1)) row
  from telematics_devices d where admin or(d.organization_id is not distinct from scope.organization_id and d.provider_profile_id is not distinct from scope.provider_profile_id)
  order by d.label,d.id offset(page_no-1)*20 limit 20
 ) rows;
 select coalesce(jsonb_agg(row order by row->>'label',row->>'id'),'[]') into vehicle_rows from(
  select jsonb_build_object('id',v.id,'label',concat_ws(' · ',v.platform_number,v.make,v.model),'selection',jsonb_build_object(
   'source',coalesce(s.source,'MOBILE'),'deviceId',(select a.device_id from telematics_device_assignments a where a.vehicle_id=v.id and a.ended_at is null),
   'revision',coalesce(s.revision,'1970-01-01'::timestamptz),'precisionKm',coalesce(s.precision_km,20),'selectedAt',coalesce(s.selected_at,'1970-01-01'::timestamptz)),
   'published',(select jsonb_build_object('source',case c.location_source when 'TELEMATICS' then 'GPS' when 'DEVICE_OBSCURED' then 'MOBILE' when 'MANUAL_ADMIN' then 'MANUAL' end,'updatedAt',c.location_updated_at)
    from capacities c where c.vehicle_id=v.id order by c.updated_at desc,c.id desc limit 1)) row
  from vehicles v left join telematics_location_sources s on s.vehicle_id=v.id where v.active and(admin or(v.organization_id is not distinct from scope.organization_id and v.provider_profile_id is not distinct from scope.provider_profile_id))
  order by v.platform_number,v.id limit 100
 )rows;
 select coalesce(jsonb_agg(row),'[]') into command_rows from(
  select jsonb_build_object('id',c.id,'deviceId',c.device_id,'command',c.command,'state',c.state,'requestedAt',c.requested_at,'expiresAt',c.expires_at) row
  from telematics_commands c join telematics_devices d on d.id=c.device_id where admin or(d.organization_id is not distinct from scope.organization_id and d.provider_profile_id is not distinct from scope.provider_profile_id)
  order by c.requested_at desc,c.id desc limit 50
 )rows;
 return jsonb_build_object('canManage',true,'devices',device_rows,'vehicles',vehicle_rows,'commands',command_rows,'page',page_no,'pageSize',20,'total',total_count,'pageCount',greatest(1,ceil(total_count/20.0)::integer));
end $$;

-- Preserve phone history and driver authorization; unselected phone input cannot
-- overwrite a GPS/manual published location. No Tracking function is changed.
do $phone_guard$
declare definition text;anchor text:='  where id=capacity.id;';
begin
 definition:=pg_get_functiondef('public.refresh_provider_capacity_location(uuid,jsonb)'::regprocedure);
 if(length(definition)-length(replace(definition,anchor,'')))/length(anchor)<>1 then raise exception 'TELEMATICS_PHONE_GUARD_DRIFT';end if;
 execute replace(definition,anchor,'  where id=capacity.id and coalesce((select s.source from public.telematics_location_sources s where s.vehicle_id=vehicle.id),''MOBILE'')=''MOBILE'';');
end $phone_guard$;

-- Owner capacity edits use the selected saved source. Keep every existing
-- publication, geometry, audience, active-driver and content-policy gate.
do $publish_source$
declare definition text;start_at integer;end_at integer;old_block text;new_block text;
begin
 definition:=pg_get_functiondef('public.publish_provider_capacity(uuid,jsonb)'::regprocedure);
 start_at:=strpos(definition,$anchor$    if assigned_driver=actor_user_id and coalesce(command->>'location_source','')<>'PRESERVE_DRIVER' then$anchor$);
 end_at:=strpos(definition,'    nearest_place:=public.provider_capacity_nearest_place(location_latitude,location_longitude);');
 if start_at<1 or end_at<=start_at then raise exception 'TELEMATICS_PUBLISH_SOURCE_DRIFT';end if;
 old_block:=substr(definition,start_at,end_at-start_at);
 new_block:=$new$    if coalesce((select source from public.telematics_location_sources where vehicle_id=vehicle.id),'MOBILE')<>'MOBILE' then
      effective_fix:=public.telematics_effective_location(vehicle.id);
      if effective_fix is null then raise exception 'LOCATION_SOURCE_PENDING';end if;
      location_latitude:=(effective_fix->>'latitude')::double precision;location_longitude:=(effective_fix->>'longitude')::double precision;
      location_precision:=(effective_fix->>'precisionKm')::integer;location_time:=(effective_fix->>'observedAt')::timestamptz;
      effective_source:=effective_fix->>'source';
    else
 $new$||old_block||E'\n    end if;\n';
 definition:=replace(definition,old_block,new_block);
 definition:=replace(definition,'  location_time timestamptz;','  location_time timestamptz; effective_fix jsonb; effective_source text;');
 definition:=replace(definition,$old$case when status_value='OFF_DUTY' then null else 'DEVICE_OBSCURED' end$old$,
  $new$case when status_value='OFF_DUTY' then null else coalesce(effective_source,'DEVICE_OBSCURED') end$new$);
 if strpos(definition,'effective_fix jsonb')=0 then raise exception 'TELEMATICS_PUBLISH_DECLARATION_DRIFT';end if;
 execute definition;
end $publish_source$;

-- Company drivers still use the existing duty permission and saved capacity.
-- Restoring duty must use the owner's selected source without relabelling it.
do $duty_source$
declare definition text;start_at integer;end_at integer;old_block text;
begin
 definition:=pg_get_functiondef('public.set_provider_assigned_vehicle_duty(uuid,jsonb)'::regprocedure);
 start_at:=strpos(definition,$a$    latitude_value:=(command->>'approximate_lat')::double precision;$a$);
 end_at:=strpos(definition,'    nearest_place:=public.provider_capacity_nearest_place(latitude_value,longitude_value);');
 if start_at<1 or end_at<=start_at then raise exception 'TELEMATICS_DUTY_SOURCE_DRIFT';end if;
 old_block:=substr(definition,start_at,end_at-start_at);
 definition:=replace(definition,old_block,$n$    if coalesce((select s.source from public.telematics_location_sources s where s.vehicle_id=vehicle.id),'MOBILE')<>'MOBILE' then
      effective_fix:=public.telematics_effective_location(vehicle.id);
      if effective_fix is null then raise exception 'LOCATION_SOURCE_PENDING';end if;
      latitude_value:=(effective_fix->>'latitude')::double precision;longitude_value:=(effective_fix->>'longitude')::double precision;
      precision_value:=(effective_fix->>'precisionKm')::integer;effective_source:=effective_fix->>'source';
    else
$n$||old_block||E'\n    end if;\n');
 definition:=replace(definition,'  nearest_place jsonb;','  nearest_place jsonb; effective_fix jsonb; effective_source text;');
 definition:=replace(definition,'case when on_duty then timestamp_value end',
  $n$case when on_duty then coalesce((effective_fix->>'observedAt')::timestamptz,timestamp_value) end$n$);
 definition:=replace(definition,$a$case when on_duty then 'DEVICE_OBSCURED' end$a$,
  $n$case when on_duty then coalesce(effective_source,'DEVICE_OBSCURED') end$n$);
 if strpos(definition,'effective_fix jsonb')=0 then raise exception 'TELEMATICS_DUTY_DECLARATION_DRIFT';end if;
 execute definition;
end $duty_source$;

-- Raw telemetry has a bounded retention period; immutable business audit stays.
-- The authenticated bridge invokes this small batch periodically, scoped to its gateway.
create function public.prune_telematics_history(gateway_digest text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare target_gateway uuid;position_count integer;request_count integer;
begin
 select id into target_gateway from telematics_gateways where token_digest=gateway_digest and active;
 if target_gateway is null then raise exception 'GATEWAY_UNAVAILABLE';end if;
 delete from telematics_positions where id in(select id from telematics_positions where gateway_id=target_gateway
  and created_at<clock_timestamp()-interval '30 days' order by created_at,id limit 1000);
 get diagnostics position_count=row_count;
 delete from telematics_gateway_requests where(gateway_id,nonce) in(select gateway_id,nonce from telematics_gateway_requests
  where gateway_id=target_gateway and created_at<clock_timestamp()-interval '1 day' order by created_at limit 1000);
 get diagnostics request_count=row_count;
 delete from telematics_engine_stepups where id in(select id from telematics_engine_stepups
  where device_id in(select id from telematics_devices where gateway_id=target_gateway)
  and expires_at<clock_timestamp()-interval '1 day' order by expires_at,id limit 1000);
 return jsonb_build_object('positions',position_count,'requests',request_count);
end $$;

-- Source reflects the exact capacity row already authorized by each read path.
-- App clients never receive requested source selection or private device data.
do $projections$
declare signature text;definition text;anchor text;replacement text;
begin
 foreach signature in array array['public.public_capacity_page(jsonb,timestamptz,uuid,integer)',
  'public.capacity_search_public_rows(jsonb,timestamptz,uuid,integer)',
  'public.private_capacity_filtered_page(text,text,uuid,timestamptz,uuid,integer,jsonb)',
  'public.capacity_search_private_rows(text,text,uuid,timestamptz,uuid,integer,jsonb)'] loop
  definition:=pg_get_functiondef(signature::regprocedure);
  if strpos(signature,'private')>0 then
   anchor:=$a$'platform_number',vehicle.platform_number$a$;
   replacement:=$r$'location_source',case when capacity.location_source in('TELEMATICS','DEVICE_OBSCURED','MANUAL_ADMIN') then capacity.location_source end,'platform_number',vehicle.platform_number$r$;
  else
   anchor:=$a$'id',id,'vehicle_id',vehicle_id$a$;
   replacement:=$r$'location_source',(select case when c.location_source in('TELEMATICS','DEVICE_OBSCURED','MANUAL_ADMIN') then c.location_source end from public.capacities c where c.id=bounded.id),'id',id,'vehicle_id',vehicle_id$r$;
  end if;
  if(length(definition)-length(replace(definition,anchor,'')))/length(anchor)<>1 then raise exception 'TELEMATICS_SOURCE_PROJECTION_DRIFT: %',signature;end if;
  execute replace(definition,anchor,replacement);
 end loop;
end $projections$;

-- Every new definer is server-only; internal helpers have no service RPC grant.
do $acl$
declare routine text;
begin
 foreach routine in array array['telematics_obscure(double precision,double precision,integer)','register_telematics_gateway(uuid,uuid,text,text,boolean)',
  'provision_telematics_device(uuid,jsonb)','assign_telematics_device(uuid,jsonb)','select_telematics_location_source(uuid,jsonb)',
  'authorize_telematics_gateway_request(text,uuid,text,timestamptz)','ingest_telematics_position(text,jsonb)',
  'authorize_synthetic_engine_command(uuid,jsonb)','request_telematics_command(uuid,jsonb)','claim_telematics_commands(text)',
  'record_telematics_command_result(text,jsonb)','prune_telematics_history(text)','telematics_workspace(uuid,integer)','telematics_effective_location(uuid)',
  'apply_telematics_capacity_location(uuid)','telematics_engine_interlock(uuid,uuid)'] loop
  execute format('revoke all on function public.%s from public,anon,authenticated,service_role',routine);
  if routine not in('telematics_obscure(double precision,double precision,integer)','telematics_effective_location(uuid)','apply_telematics_capacity_location(uuid)','telematics_engine_interlock(uuid,uuid)')
   then execute format('grant execute on function public.%s to service_role',routine);end if;
 end loop;
end $acl$;
notify pgrst,'reload schema';
commit;
