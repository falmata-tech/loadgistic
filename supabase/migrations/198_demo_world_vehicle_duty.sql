-- FEAT-SIM-004. One exact synthetic provider vehicle duty cycle. Installed OFF.
-- A worker cannot select a vehicle, actor, command or date.
begin;
select pg_advisory_xact_lock(8030198);
set local lock_timeout='5s';
set local statement_timeout='30s';

create table public.demo_world_duty_control (
 id integer primary key check(id=1),
 enabled boolean not null default false,
 activated_at timestamptz,
 last_dispatch_at timestamptz,
 manifest_version integer not null check(manifest_version=1),
 check(not enabled or activated_at is not null)
);
insert into public.demo_world_duty_control(id,manifest_version) values(1,1);

create table public.demo_world_duty_jobs (
 id bigint generated always as identity primary key,
 simulation_day date not null,
 phase text not null check(phase in('OFF_DUTY','RESTORE')),
 scheduled_at timestamptz not null,
 state text not null default 'PENDING' check(state in('PENDING','LEASED','DONE')),
 lease_token uuid,
 leased_by uuid,
 lease_expires_at timestamptz,
 attempts integer not null default 0 check(attempts between 0 and 12),
 completed_at timestamptz,
 unique(simulation_day,phase),
 check(scheduled_at=((simulation_day::timestamp+
   case phase when 'OFF_DUTY' then interval '10 hours 30 minutes'
   else interval '10 hours 50 minutes' end) at time zone 'UTC')),
 check((state='LEASED' and lease_token is not null and leased_by is not null and lease_expires_at is not null)
   or(state<>'LEASED' and leased_by is null and lease_expires_at is null))
);
create index demo_world_duty_jobs_due_idx on public.demo_world_duty_jobs(state,scheduled_at,id);

create table public.demo_world_duty_receipts (
 job_id bigint primary key references public.demo_world_duty_jobs(id),
 simulation_day date not null,
 phase text not null check(phase in('OFF_DUTY','RESTORE')),
 actor_id uuid not null references public.profiles(id),
 driver_id uuid not null references public.profiles(id),
 vehicle_id uuid not null references public.vehicles(id)
   check(vehicle_id='626ff53a-3c93-44c7-8afb-b175a84403c1'::uuid),
 baseline_capacity_id uuid not null references public.capacities(id),
 before_capacity_id uuid not null references public.capacities(id),
 after_capacity_id uuid not null references public.capacities(id),
 source_revision timestamptz not null,
 applied_at timestamptz not null default clock_timestamp(),
 unique(simulation_day,phase),
 check(before_capacity_id<>after_capacity_id)
);
create trigger demo_world_duty_receipt_immutable before update or delete
 on public.demo_world_duty_receipts for each row
 execute function public.demo_world_refuse_receipt_change();

alter table public.demo_world_duty_control enable row level security;
alter table public.demo_world_duty_jobs enable row level security;
alter table public.demo_world_duty_receipts enable row level security;
revoke all on public.demo_world_duty_control,public.demo_world_duty_jobs,
 public.demo_world_duty_receipts from public,anon,authenticated,service_role;
revoke all on sequence public.demo_world_duty_jobs_id_seq
 from public,anon,authenticated,service_role;

create function public.demo_world_claim_duty(worker_id uuid)
returns table(job_id bigint,lease_token uuid)
language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare now_value timestamptz:=clock_timestamp();today_utc date:=(clock_timestamp() at time zone 'UTC')::date;
 activation_time timestamptz;previous_dispatch timestamptz;
begin
 if worker_id is null or worker_id='00000000-0000-0000-0000-000000000000'::uuid
  then raise exception 'DEMO_DUTY_INPUT_REFUSED';end if;
 select activated_at,last_dispatch_at into activation_time,previous_dispatch
 from public.demo_world_duty_control where id=1 and enabled and manifest_version=1;
 if activation_time is null or not exists(select 1 from public.demo_world_control
   where id=1 and enabled and manifest_version=1) then return;end if;
 if coalesce(previous_dispatch,activation_time)<now_value-interval '2 days'
  or exists(select 1 from public.demo_world_duty_jobs
   where state<>'DONE' and scheduled_at<now_value-interval '2 days')
  then raise exception 'DEMO_DUTY_GAP_REVIEW_REQUIRED';end if;
 update public.demo_world_duty_control set last_dispatch_at=now_value where id=1;
 insert into public.demo_world_duty_jobs(simulation_day,phase,scheduled_at)
 select day_value::date,phase.name,
  (day_value::timestamp at time zone 'UTC')+phase.minute_utc*interval '1 minute'
 from generate_series((today_utc-1)::timestamp,today_utc::timestamp,interval '1 day') day_value
 cross join(values('OFF_DUTY',630),('RESTORE',650)) phase(name,minute_utc)
 where (day_value::timestamp at time zone 'UTC')+interval '630 minutes'>=activation_time
  and (day_value::timestamp at time zone 'UTC')+phase.minute_utc*interval '1 minute'<=now_value
 on conflict do nothing;
 return query
 with due as (
  select candidate.id from public.demo_world_duty_jobs candidate
  where candidate.scheduled_at<=now_value and candidate.attempts<12
   and(candidate.state='PENDING' or candidate.state='LEASED' and candidate.lease_expires_at<now_value)
   and not exists(select 1 from public.demo_world_duty_jobs prior
     where prior.scheduled_at<candidate.scheduled_at and prior.state<>'DONE')
  order by candidate.scheduled_at,candidate.id limit 1 for update of candidate skip locked
 )
 update public.demo_world_duty_jobs selected set state='LEASED',lease_token=gen_random_uuid(),
  leased_by=worker_id,lease_expires_at=now_value+interval '2 minutes',attempts=selected.attempts+1
 from due where selected.id=due.id returning selected.id,selected.lease_token;
end $$;

-- Exact fixture proof and current authority are repeated for every phase.
-- This helper is worker-internal and returns no contact data to the caller.
create function public.demo_world_duty_actor()
returns table(owner_id uuid,driver_id uuid)
language plpgsql security definer set search_path=pg_catalog,public,auth,pg_temp as $$
declare owner_count integer;driver_count integer;
begin
 select count(*),min(u.id::text)::uuid into owner_count,owner_id from auth.users u
 join public.profiles p on p.id=u.id and p.active and p.role='TRANSPORTER'
 join public.organization_members member on member.user_id=u.id
  and member.organization_id='c36022ff-bf3e-432d-ae96-93d1537cf79e'::uuid
  and member.membership_role='OWNER'
 where u.deleted_at is null and u.raw_app_meta_data->>'fixture_source'='loadgistic'
  and u.raw_user_meta_data->>'fixture_key'='user-public-fleet-01'
  and(lower(u.email)='owner-01@providers.loadgistic.test'
   or lower(u.email)~'^falmatad97\+[a-z0-9][a-z0-9._-]{0,80}@gmail\.com$');
 select count(*),min(u.id::text)::uuid into driver_count,driver_id from auth.users u
 join public.profiles p on p.id=u.id and p.active and p.role='DRIVER'
 join public.drivers d on d.user_id=u.id and d.active
  and d.organization_id='c36022ff-bf3e-432d-ae96-93d1537cf79e'::uuid
 where u.deleted_at is null and u.raw_app_meta_data->>'fixture_source'='loadgistic'
  and u.raw_user_meta_data->>'fixture_key'='user-public-fleet-driver-005'
  and(lower(u.email)='driver-005@providers.loadgistic.test'
   or lower(u.email)~'^falmatad97\+[a-z0-9][a-z0-9._-]{0,80}@gmail\.com$');
 if owner_count<>1 or driver_count<>1 then raise exception 'DEMO_DUTY_ACTOR_REFUSED';end if;
 return next;
end $$;

create function public.demo_world_execute_duty(job_id bigint,lease_token uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,auth,pg_temp as $$
declare job public.demo_world_duty_jobs%rowtype;
 prior public.demo_world_duty_receipts%rowtype;
 vehicle public.vehicles%rowtype;source public.telematics_location_sources%rowtype;
 current_capacity public.capacities%rowtype;baseline public.capacities%rowtype;
 saved public.capacities%rowtype;owner_id uuid;driver_id uuid;source_id uuid;
 next_command jsonb;now_value timestamptz:=clock_timestamp();
begin
 if job_id is null or lease_token is null then raise exception 'DEMO_DUTY_INPUT_REFUSED';end if;
 select * into job from public.demo_world_duty_jobs where id=job_id for update;
 if not found or job.lease_token is distinct from lease_token
  then raise exception 'DEMO_DUTY_LEASE_REFUSED';end if;
 if job.state='DONE' then
  if not exists(select 1 from public.demo_world_duty_receipts receipt
   where receipt.job_id=job.id and receipt.phase=job.phase
    and receipt.simulation_day=job.simulation_day
    and receipt.vehicle_id='626ff53a-3c93-44c7-8afb-b175a84403c1'::uuid)
   then raise exception 'DEMO_DUTY_RECEIPT_DRIFT';end if;
  return jsonb_build_object('result','REPLAYED','phase',job.phase);
 end if;
 if job.state<>'LEASED' or job.lease_expires_at<=now_value or job.scheduled_at>now_value
  or not exists(select 1 from public.demo_world_duty_control where id=1 and enabled and manifest_version=1)
  or not exists(select 1 from public.demo_world_control where id=1 and enabled and manifest_version=1)
  then raise exception 'DEMO_DUTY_LEASE_REFUSED';end if;
 if exists(select 1 from public.demo_world_duty_jobs earlier
   where earlier.scheduled_at<job.scheduled_at and earlier.state<>'DONE')
  then raise exception 'DEMO_DUTY_ORDER_REFUSED';end if;
 if job.phase='RESTORE' then
  select * into prior from public.demo_world_duty_receipts
  where simulation_day=job.simulation_day and phase='OFF_DUTY';
  if not found then raise exception 'DEMO_DUTY_ORDER_REFUSED';end if;
 end if;
 select * into vehicle from public.vehicles
  where id='626ff53a-3c93-44c7-8afb-b175a84403c1'::uuid for update;
 if not found or not vehicle.active or vehicle.publication_status<>'LIVE'
  or vehicle.organization_id<>'c36022ff-bf3e-432d-ae96-93d1537cf79e'::uuid
  or vehicle.provider_profile_id is not null or vehicle.platform_number<>'LG-TRK-F0105'
  or vehicle.cargo_configuration<>'Cargo van'
  then raise exception 'DEMO_DUTY_TARGET_REFUSED';end if;
 select actor.owner_id,actor.driver_id into owner_id,driver_id
  from public.demo_world_duty_actor() actor;
 if (select count(*) from public.driver_vehicle_assignments assignment
   where assignment.vehicle_id=vehicle.id and assignment.active)<>1
  or not exists(select 1 from public.driver_vehicle_assignments assignment
   where assignment.vehicle_id=vehicle.id and assignment.driver_user_id=driver_id and assignment.active)
  then raise exception 'DEMO_DUTY_ASSIGNMENT_REFUSED';end if;
 if exists(select 1 from public.provider_shipments shipment
    where shipment.operational_status not in('COMPLETED','CANCELLED')
     and(shipment.assigned_vehicle_id=vehicle.id or shipment.assigned_driver_user_id=driver_id))
  then raise exception 'DEMO_DUTY_ACTIVE_TRACKING';end if;
 if exists(select 1 from public.featured_provider_slots slot
    join public.featured_provider_days day on day.id=slot.day_id
    where day.feature_date>=(now_value at time zone 'UTC')::date
     and(slot.vehicle_id=vehicle.id or slot.driver_user_id=driver_id))
  then raise exception 'DEMO_DUTY_SAVED_FEATURED';end if;
 if exists(select 1 from public.telematics_device_assignments binding
    where binding.vehicle_id=vehicle.id and binding.ended_at is null)
  or exists(select 1 from public.phone_location_bindings binding
    where binding.vehicle_id=vehicle.id and binding.revoked_at is null)
  or exists(select 1 from public.demo_motion_targets motion where motion.vehicle_id=vehicle.id)
  or exists(select 1 from public.demo_world_targets target where target.vehicle_id=vehicle.id)
  or public.real_location_device_in_use(vehicle.id)
  then raise exception 'DEMO_DUTY_DEVICE_REFUSED';end if;
 select * into source from public.telematics_location_sources
  where vehicle_id=vehicle.id for update;
 if not found or source.source<>'MANUAL' or source.precision_km not in(1,3,5,10,20)
  or source.revision is null then raise exception 'DEMO_DUTY_SOURCE_REFUSED';end if;
 if public.capacity_sharing_mode(vehicle.id)<>'PUBLIC' or
  (select count(*) from public.vehicle_capacity_sharing sharing
   where sharing.vehicle_id=vehicle.id and sharing.mode='PUBLIC'
     and sharing.exclusive_email is null and sharing.exclusive_digest is null)<>1
  or exists(select 1 from public.capacity_access_grants grant_row
    where grant_row.vehicle_id=vehicle.id and grant_row.revoked_at is null)
  or exists(select 1 from public.business_capacity_grants grant_row
    where grant_row.vehicle_id=vehicle.id and grant_row.revoked_at is null)
  then raise exception 'DEMO_DUTY_SHARING_REFUSED';end if;
 select * into current_capacity from public.capacities
  where vehicle_id=vehicle.id order by updated_at desc,id desc limit 1 for update;
 if not found then raise exception 'DEMO_DUTY_CAPACITY_REFUSED';end if;
 if job.phase='OFF_DUTY' then
  if current_capacity.market_status<>'EMPTY' or current_capacity.status<>'EMPTY'
   or current_capacity.visibility<>'OPEN' or current_capacity.availability_geometry<>'ROUTE'
   or current_capacity.location_source<>'MANUAL_ADMIN'
   or current_capacity.location_precision_km<>source.precision_km
   or current_capacity.location_lat is null or current_capacity.location_lng is null
   or current_capacity.expires_at<=now_value or current_capacity.photo_storage_path is not null
   or not current_capacity.accepts_full_load or current_capacity.accepts_partial_load
   or jsonb_typeof(current_capacity.current_route_points_json)<>'array'
   or jsonb_array_length(current_capacity.current_route_points_json)<2
   then raise exception 'DEMO_DUTY_CAPACITY_REFUSED';end if;
  baseline:=current_capacity;
  if (select count(*) from public.vehicles alternative
     join lateral(select * from public.capacities c where c.vehicle_id=alternative.id
      order by c.updated_at desc,c.id desc limit 1) signal on true
     where alternative.id<>vehicle.id and alternative.active and alternative.publication_status='LIVE'
       and alternative.cargo_configuration=vehicle.cargo_configuration
       and signal.market_status='EMPTY' and signal.visibility='OPEN'
       and signal.expires_at>now_value and signal.location_lat is not null
       and signal.location_lng is not null
       and public.capacity_sharing_mode(alternative.id) in('PUBLIC','BOTH'))<2
   then raise exception 'DEMO_DUTY_BASELINE_REFUSED';end if;
  next_command:=jsonb_build_object('vehicle_id',vehicle.id,'status','OFF_DUTY',
   'visibility','OPEN','sharing_mode','PUBLIC');
 else
  if current_capacity.id<>prior.after_capacity_id or current_capacity.status<>'OFF_DUTY'
   or current_capacity.market_status<>'OFF_DUTY' or current_capacity.updated_by<>prior.actor_id
   or owner_id<>prior.actor_id or driver_id<>prior.driver_id
   or source.revision<>prior.source_revision
   then raise exception 'DEMO_DUTY_RESTORE_DRIFT';end if;
  select * into baseline from public.capacities where id=prior.baseline_capacity_id;
  if not found or baseline.vehicle_id<>vehicle.id or baseline.status<>'EMPTY'
   or baseline.visibility<>'OPEN' or baseline.availability_geometry<>'ROUTE'
   or baseline.location_source<>'MANUAL_ADMIN'
   or not baseline.accepts_full_load or baseline.accepts_partial_load
   or jsonb_typeof(baseline.current_route_points_json)<>'array'
   or jsonb_array_length(baseline.current_route_points_json)<2
   then raise exception 'DEMO_DUTY_BASELINE_DRIFT';end if;
  next_command:=jsonb_build_object('vehicle_id',vehicle.id,'status','EMPTY',
   'visibility','OPEN','sharing_mode','PUBLIC','accepted_loads','FTL',
   'availability_geometry','ROUTE','location_source','PRESERVE_DRIVER',
   'current_route_places',baseline.current_route_points_json,
   'accepts_multi_pick',coalesce(baseline.accepts_multi_pick,false),
   'accepts_multi_drop',coalesce(baseline.accepts_multi_drop,false));
 end if;
 source_id:=public.publish_provider_capacity(owner_id,next_command);
 select * into saved from public.capacities where id=source_id;
 if not found or saved.vehicle_id<>vehicle.id or saved.updated_by<>owner_id
  or saved.visibility<>'OPEN' or public.capacity_sharing_mode(vehicle.id)<>'PUBLIC'
  or (job.phase='OFF_DUTY' and(saved.status<>'OFF_DUTY' or saved.location_source is not null))
  or (job.phase='RESTORE' and(saved.status<>'EMPTY' or saved.location_source<>'MANUAL_ADMIN'
    or not saved.accepts_full_load or saved.accepts_partial_load
    or public.demo_world_route_refs(saved.current_route_points_json)
      is distinct from public.demo_world_route_refs(baseline.current_route_points_json)))
  then raise exception 'DEMO_DUTY_READBACK_DRIFT';end if;
 insert into public.demo_world_duty_receipts(job_id,simulation_day,phase,actor_id,driver_id,
  vehicle_id,baseline_capacity_id,before_capacity_id,after_capacity_id,source_revision)
 values(job.id,job.simulation_day,job.phase,owner_id,driver_id,vehicle.id,
  baseline.id,current_capacity.id,saved.id,source.revision);
 update public.demo_world_duty_jobs set state='DONE',leased_by=null,lease_expires_at=null,
  completed_at=clock_timestamp() where id=job.id;
 return jsonb_build_object('result','APPLIED','phase',job.phase);
end $$;

create function public.demo_world_duty_status() returns jsonb
language sql stable security definer set search_path=pg_catalog,public,pg_temp as $$
 select jsonb_build_object(
  'enabled',coalesce(control.enabled,false),
  'pending_count',(select count(*) from public.demo_world_duty_jobs job where job.state<>'DONE'),
  'exhausted_count',(select count(*) from public.demo_world_duty_jobs job
    where job.state<>'DONE' and job.attempts>=12),
  'last_completed_phase',(select job.phase from public.demo_world_duty_jobs job
    where job.state='DONE' order by job.scheduled_at desc limit 1))
 from public.demo_world_duty_control control where control.id=1
$$;

revoke all on function public.demo_world_claim_duty(uuid),public.demo_world_duty_actor(),
 public.demo_world_execute_duty(bigint,uuid),public.demo_world_duty_status()
 from public,anon,authenticated,service_role;
grant execute on function public.demo_world_claim_duty(uuid),
 public.demo_world_execute_duty(bigint,uuid),public.demo_world_duty_status()
 to service_role;
notify pgrst,'reload schema';
commit;
