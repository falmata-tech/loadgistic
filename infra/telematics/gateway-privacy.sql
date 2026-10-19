-- Dedicated gateway only. Privacy erasure is the explicit narrow raw-history
-- exception: pinned Traccar6.3+ removes history FKs and has no event-delete API.
-- The janitor role cannot read raw tables or add/alter its administrator-owned scope.
begin;
create table if not exists loadgistic_bridge.retired_device_ids(device_id bigint primary key);
create or replace function loadgistic_bridge.retired_collection_guard()
returns trigger language plpgsql security definer set search_path=pg_catalog,loadgistic_bridge,pg_temp as $$
begin
 if new.deviceid is not null then
  perform pg_advisory_xact_lock(hashtextextended('loadgistic-retired-collection:'||new.deviceid::text,0));
  if exists(select 1 from loadgistic_bridge.retired_device_ids r where r.device_id=new.deviceid)
  then raise exception 'TELEMATICS_COLLECTION_RETIRED';end if;
 end if;
 return new;
end $$;
drop trigger if exists loadgistic_retired_position_guard on public.tc_positions;
create trigger loadgistic_retired_position_guard before insert on public.tc_positions
 for each row execute function loadgistic_bridge.retired_collection_guard();
drop trigger if exists loadgistic_retired_event_guard on public.tc_events;
create trigger loadgistic_retired_event_guard before insert on public.tc_events
 for each row execute function loadgistic_bridge.retired_collection_guard();
create table if not exists loadgistic_bridge.privacy_scope(
 gateway_id uuid not null,gateway_device_id bigint not null,hardware_digest text not null,
 primary key(gateway_id,gateway_device_id),check(hardware_digest~'^[a-f0-9]{64}$')
);
create table if not exists loadgistic_bridge.privacy_receipts(
 job_id uuid primary key,gateway_id uuid not null,purpose text not null check(purpose in('DISABLE','ERASE')),
 binding_digest text not null check(binding_digest~'^[a-f0-9]{64}$'),gateway_device_id bigint,hardware_digest text,
 state text not null default 'PREPARED' check(state in('PREPARED','VERIFIED')),
 created_at timestamptz not null default clock_timestamp(),verified_at timestamptz
);
create or replace function loadgistic_bridge.privacy_hardware_digest(job_data jsonb)
returns text language sql immutable set search_path=pg_catalog as $$
 select encode(sha256(convert_to(concat_ws(E'\n',job_data->>'gatewayId',job_data->>'gatewayDeviceId',
  job_data->>'imei',job_data->>'protocol',job_data->>'protocolDeviceId'),'UTF8')),'hex')
$$;
create or replace function loadgistic_bridge.prepare_privacy_job(job_data jsonb)
returns jsonb language plpgsql security definer set search_path=pg_catalog,loadgistic_bridge,pg_temp as $$
declare hardware_value text;receipt_value loadgistic_bridge.privacy_receipts%rowtype;device_value public.tc_devices%rowtype;
begin
 if jsonb_typeof(job_data) is distinct from 'object' or coalesce(job_data->>'purpose','') not in('DISABLE','ERASE')
  or coalesce(job_data->>'bindingDigest','')!~'^[a-f0-9]{64}$'
  or coalesce(job_data->>'imei','')!~'^[0-9]{15}$'
  or coalesce(job_data->>'protocol','') not in('gt06','teltonika','h02','jt808')
  or coalesce(job_data->>'protocolDeviceId','')!~'^[A-Za-z0-9:_-]{1,128}$'
  or coalesce(job_data->>'gatewayDeviceId','')!~'^[1-9][0-9]{0,15}$'
 then raise exception 'INVALID_PRIVACY_JOB';end if;
 -- Match insertion guards before retiring collection; wait for earlier inserts to commit.
 perform pg_advisory_xact_lock(hashtextextended('loadgistic-retired-collection:'||(job_data->>'gatewayDeviceId'),0));
 lock table public.tc_devices in share mode;
 hardware_value:=loadgistic_bridge.privacy_hardware_digest(job_data);
 select * into receipt_value from loadgistic_bridge.privacy_receipts r where r.job_id=(job_data->>'id')::uuid for update;
 if found then
  if receipt_value.gateway_id<>(job_data->>'gatewayId')::uuid or receipt_value.purpose<>job_data->>'purpose'
   or receipt_value.binding_digest<>job_data->>'bindingDigest' then raise exception 'PRIVACY_BINDING_CHANGED';end if;
  if receipt_value.state='VERIFIED' then return jsonb_build_object('state','VERIFIED');end if;
  if receipt_value.hardware_digest<>hardware_value or receipt_value.gateway_device_id<>(job_data->>'gatewayDeviceId')::bigint
   then raise exception 'PRIVACY_BINDING_CHANGED';end if;
 end if;
 perform 1 from loadgistic_bridge.privacy_scope s where s.gateway_id=(job_data->>'gatewayId')::uuid
  and s.gateway_device_id=(job_data->>'gatewayDeviceId')::bigint and s.hardware_digest=hardware_value for share;
 if not found then raise exception 'PRIVACY_SCOPE_DENIED';end if;
 select * into device_value from public.tc_devices d where d.id=(job_data->>'gatewayDeviceId')::bigint;
 if found then
  if device_value.uniqueid is distinct from job_data->>'protocolDeviceId'
   or device_value.attributes::jsonb->>'loadgistic.imei' is distinct from job_data->>'imei'
   or device_value.attributes::jsonb->>'loadgistic.protocol' is distinct from job_data->>'protocol'
  then raise exception 'PRIVACY_BINDING_CHANGED';end if;
  insert into loadgistic_bridge.privacy_receipts(job_id,gateway_id,purpose,binding_digest,gateway_device_id,hardware_digest)
   values((job_data->>'id')::uuid,(job_data->>'gatewayId')::uuid,job_data->>'purpose',job_data->>'bindingDigest',
    (job_data->>'gatewayDeviceId')::bigint,hardware_value) on conflict(job_id) do nothing;
  insert into loadgistic_bridge.retired_device_ids(device_id) values((job_data->>'gatewayDeviceId')::bigint) on conflict do nothing;
  return jsonb_build_object('state','PREPARED','devicePresent',true);
 end if;
 -- A missing/inaccessible API device is not proof. A durable exact pre-delete receipt is mandatory.
 if receipt_value.job_id is null or job_data->>'purpose'<>'ERASE' then raise exception 'PRIVACY_ABSENCE_UNVERIFIED';end if;
 insert into loadgistic_bridge.retired_device_ids(device_id) values((job_data->>'gatewayDeviceId')::bigint) on conflict do nothing;
 return jsonb_build_object('state','PREPARED','devicePresent',false);
end $$;
create or replace function loadgistic_bridge.verify_privacy_job(job_data jsonb)
returns jsonb language plpgsql security definer set search_path=pg_catalog,loadgistic_bridge,pg_temp as $$
declare prepared_value jsonb;device_value public.tc_devices%rowtype;target_id bigint:=(job_data->>'gatewayDeviceId')::bigint;removed_count integer;
begin
 prepared_value:=loadgistic_bridge.prepare_privacy_job(job_data);
 if prepared_value->>'state'='VERIFIED' then return prepared_value;end if;
 if not exists(select 1 from loadgistic_bridge.retired_device_ids r where r.device_id=target_id)
  or not exists(select 1 from pg_trigger t where t.tgrelid='public.tc_positions'::regclass
   and t.tgname='loadgistic_retired_position_guard' and t.tgenabled in('O','A')
   and t.tgfoid='loadgistic_bridge.retired_collection_guard()'::regprocedure and(t.tgtype::integer&7)=7)
  or not exists(select 1 from pg_trigger t where t.tgrelid='public.tc_events'::regclass
   and t.tgname='loadgistic_retired_event_guard' and t.tgenabled in('O','A')
   and t.tgfoid='loadgistic_bridge.retired_collection_guard()'::regprocedure and(t.tgtype::integer&7)=7)
 then raise exception 'PRIVACY_ABSENCE_UNVERIFIED';end if;
 if job_data->>'purpose'='DISABLE' then
  select * into device_value from public.tc_devices d where d.id=target_id;
  if not found or device_value.disabled is distinct from true then raise exception 'PRIVACY_DISABLE_UNVERIFIED';end if;
 else
  -- prepare holds the device table + per-device collection lock until this transaction ends.
  -- It requires an exact administrator scope and durable pre-delete proof when the device is gone.
  if exists(select 1 from public.tc_devices d where d.id=target_id or d.uniqueid=job_data->>'protocolDeviceId')
  then raise exception 'PRIVACY_ABSENCE_UNVERIFIED';end if;
  if exists(select 1 from loadgistic_bridge.outbox o where o.payload->>'deviceId'=target_id::text
   and o.payload->>'uniqueId' is distinct from job_data->>'protocolDeviceId')
  then raise exception 'PRIVACY_BINDING_CHANGED';end if;
  -- At most500 raw rows total per call. A larger history remains pending for another leased run.
  with doomed as(select e.id from public.tc_events e where e.deviceid=target_id order by e.id limit 500),
   removed as(delete from public.tc_events e using doomed d where e.id=d.id and e.deviceid=target_id returning e.id)
  select count(*) into removed_count from removed;
  with doomed as(select p.id from public.tc_positions p where p.deviceid=target_id order by p.id limit (500-removed_count))
  delete from public.tc_positions p using doomed d where p.id=d.id and p.deviceid=target_id;
  if exists(select 1 from public.tc_positions p where p.deviceid=target_id)
   or exists(select 1 from public.tc_events e where e.deviceid=target_id)
  then return jsonb_build_object('state','PENDING');end if;
  with doomed as(select o.id from loadgistic_bridge.outbox o where o.payload->>'deviceId'=target_id::text order by o.id limit 500)
  delete from loadgistic_bridge.outbox o using doomed d where o.id=d.id;
  with doomed as(select d.command_id from loadgistic_bridge.dispatches d where d.gateway_device_id=target_id order by d.command_id limit 500)
  delete from loadgistic_bridge.dispatches d using doomed r where d.command_id=r.command_id;
  if exists(select 1 from loadgistic_bridge.outbox o where o.payload->>'deviceId'=target_id::text)
   or exists(select 1 from loadgistic_bridge.dispatches d where d.gateway_device_id=target_id)
  then return jsonb_build_object('state','PENDING');end if;
  delete from loadgistic_bridge.privacy_scope s where s.gateway_id=(job_data->>'gatewayId')::uuid and s.gateway_device_id=target_id;
  -- Retain only hash/UUID audit receipts; clear the hardware linkage of earlier DISABLE jobs too.
  update loadgistic_bridge.privacy_receipts r set gateway_device_id=null,hardware_digest=null
   where r.gateway_id=(job_data->>'gatewayId')::uuid and r.gateway_device_id=target_id;
 end if;
 update loadgistic_bridge.privacy_receipts r set state='VERIFIED',verified_at=clock_timestamp() where r.job_id=(job_data->>'id')::uuid;
 return jsonb_build_object('state','VERIFIED');
end $$;
revoke all on loadgistic_bridge.privacy_scope,loadgistic_bridge.privacy_receipts,loadgistic_bridge.retired_device_ids from public,loadgistic_bridge,loadgistic_janitor;
revoke all on function loadgistic_bridge.retired_collection_guard(),loadgistic_bridge.privacy_hardware_digest(jsonb),loadgistic_bridge.prepare_privacy_job(jsonb),loadgistic_bridge.verify_privacy_job(jsonb) from public,loadgistic_bridge,loadgistic_janitor;
grant usage on schema loadgistic_bridge to loadgistic_janitor;
grant execute on function loadgistic_bridge.prepare_privacy_job(jsonb),loadgistic_bridge.verify_privacy_job(jsonb) to loadgistic_janitor;
commit;
