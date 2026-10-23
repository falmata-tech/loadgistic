-- FEAT-SIM-001. Hosted movement stays disabled until a separately reviewed
-- production operation enables this control and the matching app settings.
begin;
select pg_advisory_xact_lock(8030189);
set local lock_timeout='5s';
set local statement_timeout='30s';

create table public.demo_hosted_motion_control (
 id integer primary key check(id=1),
 enabled boolean not null default false,
 kill_switch boolean not null default true,
 manifest_version integer not null check(manifest_version=1),
 activated_at timestamptz,
 changed_at timestamptz not null default clock_timestamp(),
 check(not enabled or activated_at is not null)
);
insert into public.demo_hosted_motion_control(id,manifest_version) values(1,1);
alter table public.demo_hosted_motion_control enable row level security;
revoke all on public.demo_hosted_motion_control from public,anon,authenticated,service_role;

alter table public.demo_motion_targets add column hosted boolean not null default false;

-- A kill is serialized with every hosted reservation and with bridge ingest.
-- It stops only hosted leases; saved fixes/history and REAL takeover stay put.
create function public.demo_hosted_motion_revoke_leases()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if not new.enabled or new.kill_switch then
  update public.demo_motion_targets set state='OFF',epoch=epoch+1,
   lease_id=null,expires_at=null,reason='HOSTED_DISABLED',updated_at=clock_timestamp()
   where hosted and state='RUNNING';
 end if;
 return new;
end $$;
create trigger hosted_motion_control_changed after update of enabled,kill_switch
 on public.demo_hosted_motion_control for each row
 execute function public.demo_hosted_motion_revoke_leases();
revoke all on function public.demo_hosted_motion_revoke_leases() from public,anon,authenticated,service_role;

-- Preserve the installed definition and patch only three reviewed anchors.
-- Current 156/183 lease authority is otherwise unchanged. Control is locked
-- before owner/device/vehicle/target so kill and ticks share one lock order.
do $patch$
declare definition text;anchor text;
begin
 if to_regprocedure('public.demo_motion_lease_pre_hosted189(uuid,uuid,bigint,text)') is not null
  then raise exception 'DEMO_HOSTED_BACKUP_EXISTS';end if;
 definition:=pg_get_functiondef('public.demo_motion_lease(uuid,uuid,bigint,text)'::regprocedure);
 if md5(definition)<>'2ffcab8b2a3151323bb5c224f3f83407'
  then raise exception 'DEMO_HOSTED_LEASE_DRIFT';end if;
 execute replace(definition,'FUNCTION public.demo_motion_lease(','FUNCTION public.demo_motion_lease_pre_hosted189(');
 revoke all on function public.demo_motion_lease_pre_hosted189(uuid,uuid,bigint,text) from public,anon,authenticated,service_role;
 anchor:='declare context jsonb;saved demo_motion_targets%rowtype;';
 if(length(definition)-length(replace(definition,anchor,'')))/length(anchor)<>1 then raise exception 'DEMO_HOSTED_LEASE_DRIFT';end if;
 definition:=replace(definition,anchor,'declare context jsonb;saved demo_motion_targets%rowtype;hosted_enabled boolean;');
 anchor:='context:=public.demo_motion_binding(target_vehicle_id);';
 if(length(definition)-length(replace(definition,anchor,'')))/length(anchor)<>1 then raise exception 'DEMO_HOSTED_LEASE_DRIFT';end if;
 definition:=replace(definition,anchor,
  'select enabled and not kill_switch into hosted_enabled from public.demo_hosted_motion_control where id=1 for share;'||E'\n '||anchor);
 anchor:='select * into saved from demo_motion_targets where vehicle_id=target_vehicle_id for update;';
 if(length(definition)-length(replace(definition,anchor,'')))/length(anchor)<>1 then raise exception 'DEMO_HOSTED_LEASE_DRIFT';end if;
 definition:=replace(definition,anchor,anchor||E'\n '||
  'if found and saved.hosted and not coalesce(hosted_enabled,false) then raise exception ''DEMO_HOSTED_DISABLED'';end if;');
 execute definition;
end $patch$;

-- One database transaction verifies the signed request nonce, checks the
-- independent kill row, executes exactly one command, and returns the result.
-- Service-role access does not expose any table or generic customer RPC.
create function public.hosted_demo_motion_command(request_nonce uuid,target_vehicle_id uuid,payload jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare active boolean;action text;expected_fields integer;result jsonb;lease_id uuid;epoch_value bigint;
begin
 if request_nonce is null or target_vehicle_id is null or payload is null or jsonb_typeof(payload)<>'object'
  then raise exception 'DEMO_HOSTED_INPUT_DENIED';end if;
 if not exists(select 1 from (values
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
 ) as approved(name,vehicle_id) where approved.name=payload->>'target' and approved.vehicle_id=target_vehicle_id)
  then raise exception 'DEMO_HOSTED_INPUT_DENIED';end if;
 action:=payload->>'action';
 expected_fields:=case action when 'CONFIGURE' then 2 when 'STATUS' then 2 when 'START' then 3
  when 'STOP' then 4 when 'GPS' then 6 when 'PHONE' then 6 else null end;
 if expected_fields is null or (select count(*) from jsonb_object_keys(payload))<>expected_fields
  then raise exception 'DEMO_HOSTED_INPUT_DENIED';end if;
 if action='START' and (jsonb_typeof(payload->'seconds') is distinct from 'number'
   or payload->>'seconds'!~'^[0-9]{1,4}$') then raise exception 'DEMO_HOSTED_INPUT_DENIED';end if;
 if action in('STOP','GPS','PHONE') then
  if jsonb_typeof(payload->'leaseId') is distinct from 'string' or payload->>'leaseId'!~
    '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
   or jsonb_typeof(payload->'epoch') is distinct from 'number' or payload->>'epoch'!~'^[1-9][0-9]{0,15}$'
   then raise exception 'DEMO_HOSTED_INPUT_DENIED';end if;
  lease_id:=(payload->>'leaseId')::uuid;epoch_value:=(payload->>'epoch')::bigint;
 end if;
 if action in('GPS','PHONE') and (jsonb_typeof(payload->'latitude') is distinct from 'number'
  or jsonb_typeof(payload->'longitude') is distinct from 'number') then raise exception 'DEMO_HOSTED_INPUT_DENIED';end if;
 select enabled and not kill_switch into active from public.demo_hosted_motion_control where id=1 for share;
 if not coalesce(active,false) then raise exception 'DEMO_HOSTED_DISABLED';end if;
 perform public.authorize_demo_motion_request(request_nonce);
 if action='CONFIGURE' then result:=public.configure_demo_motion_target(target_vehicle_id);
 elsif action='STATUS' then result:=public.demo_motion_status(target_vehicle_id);
 elsif action='START' then
  result:=public.start_demo_motion(target_vehicle_id,(payload->>'seconds')::integer,false);
  update public.demo_motion_targets target set hosted=true where target.vehicle_id=target_vehicle_id
   and target.state='RUNNING' and target.lease_id=(result->>'leaseId')::uuid;
  if not found then raise exception 'DEMO_HOSTED_INPUT_DENIED';end if;
 elsif action='STOP' then
  result:=public.stop_demo_motion(target_vehicle_id,lease_id,epoch_value);
 elsif action='GPS' then
  result:=public.reserve_demo_gps_tick(target_vehicle_id,lease_id,epoch_value,
   (payload->>'latitude')::double precision,(payload->>'longitude')::double precision);
 elsif action='PHONE' then
  result:=public.report_demo_phone_location(target_vehicle_id,lease_id,epoch_value,
   (payload->>'latitude')::double precision,(payload->>'longitude')::double precision);
 end if;
 if action in('STOP','GPS','PHONE') and not exists(select 1 from public.demo_motion_targets
  where vehicle_id=target_vehicle_id and hosted) then raise exception 'DEMO_HOSTED_INPUT_DENIED';end if;
 return result;
end $$;
revoke all on function public.hosted_demo_motion_command(uuid,uuid,jsonb)
 from public,anon,authenticated,service_role;
grant execute on function public.hosted_demo_motion_command(uuid,uuid,jsonb) to service_role;
notify pgrst,'reload schema';
commit;
