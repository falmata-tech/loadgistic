-- FEAT-SIM-002. Inert exact-fixture broker Capacity sharing; no target is seeded here.
-- A separately reviewed fixture binding and activation are required.
begin;
select pg_advisory_xact_lock(8030190);
set local lock_timeout='5s';
set local statement_timeout='30s';

create table public.demo_world_business_share_control (
 id integer primary key check(id=1),
 enabled boolean not null default false,
 activated_at timestamptz,
 last_dispatch_at timestamptz,
 changed_at timestamptz not null default clock_timestamp(),
 check(not enabled or activated_at is not null)
);
insert into public.demo_world_business_share_control(id) values(1);

-- Only the fixture owner of this exact private vehicle can share it. A dedicated
-- fixture-marked broker workspace must be bound after the environment is reviewed.
create table public.demo_world_business_share_target (
 id integer primary key check(id=1),
 vehicle_id uuid not null unique references public.vehicles(id),
 workspace_id uuid not null unique references public.business_workspaces(id),
 actor_fixture_key text not null check(actor_fixture_key='user-driver'),
 broker_owner_fixture_key text not null check(broker_owner_fixture_key='user-sim-broker'),
 check(vehicle_id='2f22cc5a-d654-4405-98b7-9a1a9cf42fe3'::uuid)
);

create function public.demo_world_business_target_guard() returns trigger
language plpgsql security definer set search_path=pg_catalog,public,auth,pg_temp as $$
declare broker_owner_count integer;
begin
 if tg_op<>'INSERT' then raise exception 'DEMO_BUSINESS_TARGET_IMMUTABLE';end if;
 if not exists(select 1 from public.vehicles v join public.provider_profiles p
    on p.id=v.provider_profile_id join auth.users u on u.id=p.user_id
    where v.id=new.vehicle_id and v.active and v.publication_status='LIVE'
      and p.id='c640c548-ada2-4b9e-ac3c-235585525a6f'::uuid
      and u.raw_app_meta_data->>'fixture_source'='loadgistic'
      and u.raw_user_meta_data->>'fixture_key'=new.actor_fixture_key)
   or not exists(select 1 from public.vehicle_capacity_sharing s
      where s.vehicle_id=new.vehicle_id and s.mode='PRIVATE')
   or not exists(select 1 from public.business_workspaces w
      where w.id=new.workspace_id and w.active and w.kind='BROKER')
   then raise exception 'DEMO_BUSINESS_TARGET_REFUSED';end if;
 select count(*) into broker_owner_count from public.business_workspace_members m
 join auth.users u on u.id=m.user_id join public.profiles p on p.id=u.id
 where m.workspace_id=new.workspace_id and m.role='OWNER' and m.active
   and m.can_view_capacity and p.active and p.role='SHIPPER'
   and u.deleted_at is null and u.email_confirmed_at is not null
   and u.raw_app_meta_data->>'fixture_source'='loadgistic'
   and u.raw_user_meta_data->>'fixture_key'=new.broker_owner_fixture_key
   and lower(u.email)='broker-scenario@loadgistic.local';
 if broker_owner_count<>1 or exists(select 1 from public.business_workspace_members m
   left join auth.users u on u.id=m.user_id
   where m.workspace_id=new.workspace_id and m.active
    and (u.id is null or u.raw_app_meta_data->>'fixture_source' is distinct from 'loadgistic'))
   or exists(select 1 from public.business_capacity_grants g
    where g.vehicle_id=new.vehicle_id and g.workspace_id=new.workspace_id and g.revoked_at is null)
   then raise exception 'DEMO_BUSINESS_TARGET_REFUSED';end if;
 return new;
end $$;
create trigger demo_world_business_target_guard before insert or update or delete
 on public.demo_world_business_share_target for each row
 execute function public.demo_world_business_target_guard();

-- Once bound, normal team editing cannot add a real member to the demo
-- recipient. Existing members are checked during target binding and each grant.
create function public.demo_world_business_member_guard() returns trigger
language plpgsql security definer set search_path=pg_catalog,public,auth,pg_temp as $$
begin
 if new.active and exists(select 1 from public.demo_world_business_share_target t
  where t.workspace_id=new.workspace_id)
  and not exists(select 1 from auth.users u where u.id=new.user_id
   and u.raw_app_meta_data->>'fixture_source'='loadgistic')
  then raise exception 'DEMO_BUSINESS_REAL_MEMBER_REFUSED';end if;
 return new;
end $$;
create trigger demo_world_business_member_guard before insert or update
 on public.business_workspace_members for each row
 execute function public.demo_world_business_member_guard();

create table public.demo_world_business_share_jobs (
 id bigint generated always as identity primary key,
 simulation_day date not null,
 phase text not null check(phase in('GRANT','REVOKE')),
 scheduled_at timestamptz not null,
 state text not null default 'PENDING' check(state in('PENDING','LEASED','DONE')),
 lease_token uuid,
 leased_by uuid,
 lease_expires_at timestamptz,
 attempts integer not null default 0 check(attempts between 0 and 12),
 completed_at timestamptz,
 unique(simulation_day,phase),
 check((state='LEASED' and lease_token is not null and leased_by is not null and lease_expires_at is not null)
   or(state<>'LEASED' and leased_by is null and lease_expires_at is null))
);
create index demo_world_business_share_due_idx
 on public.demo_world_business_share_jobs(state,scheduled_at,id);

create table public.demo_world_business_share_receipts (
 job_id bigint primary key references public.demo_world_business_share_jobs(id),
 simulation_day date not null,
 phase text not null check(phase in('GRANT','REVOKE')),
 actor_id uuid not null references public.profiles(id),
 vehicle_id uuid not null references public.vehicles(id),
 workspace_id uuid not null references public.business_workspaces(id),
 grant_id uuid not null references public.business_capacity_grants(id),
 grant_revision integer not null check(grant_revision>0),
 applied_at timestamptz not null default clock_timestamp(),
 unique(simulation_day,phase)
);
create trigger demo_world_business_receipt_immutable before update or delete
 on public.demo_world_business_share_receipts for each row
 execute function public.demo_world_refuse_receipt_change();

alter table public.demo_world_business_share_control enable row level security;
alter table public.demo_world_business_share_target enable row level security;
alter table public.demo_world_business_share_jobs enable row level security;
alter table public.demo_world_business_share_receipts enable row level security;
revoke all on public.demo_world_business_share_control,public.demo_world_business_share_target,
 public.demo_world_business_share_jobs,public.demo_world_business_share_receipts
 from public,anon,authenticated,service_role;
revoke all on sequence public.demo_world_business_share_jobs_id_seq
 from public,anon,authenticated,service_role;

-- The dispatcher chooses no actor or recipient. It only claims a due phase
-- after explicit target binding and enablement, with no unbounded catch-up.
create function public.demo_world_claim_business_share(worker_id uuid)
returns table(job_id bigint,lease_token uuid)
language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare now_value timestamptz:=clock_timestamp();today date:=(clock_timestamp() at time zone 'UTC')::date;
 activation_time timestamptz;previous_dispatch timestamptz;
begin
 if worker_id is null or worker_id='00000000-0000-0000-0000-000000000000'::uuid
  then raise exception 'DEMO_BUSINESS_INPUT_REFUSED';end if;
 select activated_at,last_dispatch_at into activation_time,previous_dispatch
 from public.demo_world_business_share_control where id=1 and enabled;
 if activation_time is null then return;end if;
 if not exists(select 1 from public.demo_world_business_share_target where id=1)
  then raise exception 'DEMO_BUSINESS_TARGET_REFUSED';end if;
 if coalesce(previous_dispatch,activation_time)<now_value-interval '2 days'
  or exists(select 1 from public.demo_world_business_share_jobs
   where state<>'DONE' and scheduled_at<now_value-interval '2 days')
  then raise exception 'DEMO_BUSINESS_GAP_REVIEW_REQUIRED';end if;
 update public.demo_world_business_share_control set last_dispatch_at=now_value where id=1;
 insert into public.demo_world_business_share_jobs(simulation_day,phase,scheduled_at)
 select day_value::date,phase.phase,
  (day_value::timestamp at time zone 'UTC')+phase.minute_utc*interval '1 minute'
 from generate_series((today-1)::timestamp,today::timestamp,interval '1 day') day_value
 cross join(values('GRANT',540),('REVOKE',900)) phase(phase,minute_utc)
 where (day_value::timestamp at time zone 'UTC')+interval '9 hours'>=activation_time
  and (day_value::timestamp at time zone 'UTC')+phase.minute_utc*interval '1 minute'<=now_value
 on conflict do nothing;
 return query
 with due as (
  select candidate.id from public.demo_world_business_share_jobs candidate
  where candidate.scheduled_at<=now_value and candidate.attempts<12
   and(candidate.state='PENDING' or candidate.state='LEASED' and candidate.lease_expires_at<now_value)
   and not exists(select 1 from public.demo_world_business_share_jobs prior
    where prior.scheduled_at<candidate.scheduled_at and prior.state<>'DONE')
  order by candidate.scheduled_at,candidate.id limit 1
  for update of candidate skip locked
 )
 update public.demo_world_business_share_jobs selected
  set state='LEASED',lease_token=gen_random_uuid(),leased_by=worker_id,
   lease_expires_at=now_value+interval '2 minutes',attempts=selected.attempts+1
 from due where selected.id=due.id returning selected.id,selected.lease_token;
end $$;

-- The ordinary business sharing command and this receipt commit atomically.
create function public.demo_world_execute_business_share(job_id bigint,lease_token uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,auth,pg_temp as $$
declare job public.demo_world_business_share_jobs%rowtype;
 target public.demo_world_business_share_target%rowtype;
 vehicle public.vehicles%rowtype;capacity public.capacities%rowtype;
 actor_id uuid;broker_owner_id uuid;actor_count integer;owner_count integer;
 grant_id uuid;grant_revision integer;result jsonb;grant_record public.business_capacity_grants%rowtype;
 now_value timestamptz:=clock_timestamp();
begin
 if job_id is null or lease_token is null then raise exception 'DEMO_BUSINESS_INPUT_REFUSED';end if;
 select * into job from public.demo_world_business_share_jobs where id=job_id for update;
 if not found or job.lease_token is distinct from lease_token
  then raise exception 'DEMO_BUSINESS_LEASE_REFUSED';end if;
 if job.state='DONE' then
  if not exists(select 1 from public.demo_world_business_share_receipts receipt
   join public.business_capacity_grants saved on saved.id=receipt.grant_id
   join public.demo_world_business_share_target bound on bound.id=1
   where receipt.job_id=job.id and receipt.phase=job.phase
    and receipt.simulation_day=job.simulation_day
    and receipt.vehicle_id=bound.vehicle_id and receipt.workspace_id=bound.workspace_id
    and saved.vehicle_id=receipt.vehicle_id and saved.workspace_id=receipt.workspace_id
    and saved.created_by=receipt.actor_id
    and ((job.phase='REVOKE' and saved.revoked_at is not null
       and saved.revision=receipt.grant_revision)
      or (job.phase='GRANT' and
       ((saved.revoked_at is null and saved.revision=receipt.grant_revision)
        or (saved.revoked_at is not null and exists(
         select 1 from public.demo_world_business_share_receipts later
         where later.simulation_day=job.simulation_day and later.phase='REVOKE'
          and later.grant_id=saved.id and later.grant_revision=saved.revision))))))
   then raise exception 'DEMO_BUSINESS_RECEIPT_DRIFT';end if;
  return jsonb_build_object('result','REPLAYED');
 end if;
 if job.state<>'LEASED' or job.lease_expires_at<=now_value or job.scheduled_at>now_value
  or not exists(select 1 from public.demo_world_business_share_control where id=1 and enabled)
  then raise exception 'DEMO_BUSINESS_LEASE_REFUSED';end if;
 if exists(select 1 from public.demo_world_business_share_jobs prior
  where prior.scheduled_at<job.scheduled_at and prior.state<>'DONE')
  then raise exception 'DEMO_BUSINESS_ORDER_REFUSED';end if;
 select * into target from public.demo_world_business_share_target where id=1;
 if not found then raise exception 'DEMO_BUSINESS_TARGET_REFUSED';end if;
 select * into vehicle from public.vehicles where id=target.vehicle_id for update;
 if not found or not vehicle.active or vehicle.publication_status<>'LIVE'
  or vehicle.provider_profile_id is distinct from 'c640c548-ada2-4b9e-ac3c-235585525a6f'::uuid
  then raise exception 'DEMO_BUSINESS_TARGET_REFUSED';end if;
 select count(*),(array_agg(u.id))[1] into actor_count,actor_id from auth.users u
 join public.profiles p on p.id=u.id and p.active and p.role='DRIVER'
 join public.provider_profiles provider on provider.user_id=u.id
   and provider.id=vehicle.provider_profile_id
 where u.deleted_at is null and u.raw_app_meta_data->>'fixture_source'='loadgistic'
   and u.raw_user_meta_data->>'fixture_key'=target.actor_fixture_key
   and (lower(u.email)='driver@loadgistic.local'
    or lower(u.email)~'^falmatad97\+[a-z0-9][a-z0-9._-]{0,80}@gmail\.com$');
 if actor_count<>1 or not public.private_capacity_actor_controls_vehicle(actor_id,vehicle.id)
  then raise exception 'DEMO_BUSINESS_ACTOR_REFUSED';end if;
 if job.phase='GRANT' then
  select count(*),(array_agg(u.id))[1] into owner_count,broker_owner_id
  from public.business_workspace_members member
  join public.business_workspaces workspace on workspace.id=member.workspace_id
  join auth.users u on u.id=member.user_id join public.profiles p on p.id=u.id
  where member.workspace_id=target.workspace_id and member.role='OWNER'
   and member.active and member.can_view_capacity and workspace.active and workspace.kind='BROKER'
   and p.active and p.role='SHIPPER' and u.deleted_at is null
   and u.email_confirmed_at is not null
   and u.raw_app_meta_data->>'fixture_source'='loadgistic'
   and u.raw_user_meta_data->>'fixture_key'=target.broker_owner_fixture_key
   and lower(u.email)='broker-scenario@loadgistic.local';
  if owner_count<>1 then raise exception 'DEMO_BUSINESS_RECIPIENT_REFUSED';end if;
  if exists(select 1 from public.business_workspace_members member
   left join auth.users u on u.id=member.user_id
   where member.workspace_id=target.workspace_id and member.active
    and (u.id is null or u.raw_app_meta_data->>'fixture_source' is distinct from 'loadgistic'))
   or public.capacity_sharing_mode(vehicle.id)<>'PRIVATE'
   or exists(select 1 from public.business_capacity_grants grant_row
    where grant_row.vehicle_id=vehicle.id and grant_row.workspace_id=target.workspace_id
     and grant_row.revoked_at is null)
   then raise exception 'DEMO_BUSINESS_STATE_CHANGED';end if;
  select * into capacity from public.capacities
   where vehicle_id=vehicle.id order by updated_at desc,id desc limit 1 for update;
  if not found or capacity.status::text not in('EMPTY','PARTIAL')
   or capacity.visibility::text<>'PRIVATE' or capacity.expires_at<=now_value
   then raise exception 'DEMO_BUSINESS_CAPACITY_UNAVAILABLE';end if;
  result:=public.grant_business_capacity_access(actor_id,vehicle.id,target.workspace_id);
  if result->>'created'<>'true' then raise exception 'DEMO_BUSINESS_GRANT_DRIFT';end if;
  grant_id:=(result->>'id')::uuid;grant_revision:=(result->>'revision')::integer;
  select * into grant_record from public.business_capacity_grants where id=grant_id;
  if not found or grant_record.vehicle_id<>vehicle.id or grant_record.workspace_id<>target.workspace_id
   or grant_record.created_by<>actor_id or grant_record.revoked_at is not null
   or public.capacity_sharing_mode(vehicle.id)<>'PRIVATE'
   or not exists(select 1 from public.business_capacity_filtered_page(broker_owner_id,target.workspace_id)
    feed where feed.payload->>'vehicle_id'=vehicle.id::text)
   then raise exception 'DEMO_BUSINESS_GRANT_DRIFT';end if;
 else
  select prior.grant_id,prior.grant_revision into grant_id,grant_revision
  from public.demo_world_business_share_receipts prior
  where prior.simulation_day=job.simulation_day and prior.phase='GRANT';
  if grant_id is null then raise exception 'DEMO_BUSINESS_ORDER_REFUSED';end if;
  select * into grant_record from public.business_capacity_grants where id=grant_id for update;
  if not found or grant_record.vehicle_id<>vehicle.id or grant_record.workspace_id<>target.workspace_id
   or grant_record.created_by<>actor_id or grant_record.revoked_at is not null
   or grant_record.revision<>grant_revision then raise exception 'DEMO_BUSINESS_GRANT_DRIFT';end if;
  result:=public.revoke_business_capacity_access(actor_id,grant_id,grant_revision);
  grant_revision:=(result->>'revision')::integer;
  if result->>'revoked'<>'true' or not exists(select 1 from public.business_capacity_grants g
   where g.id=grant_id and g.revoked_at is not null and g.revision=grant_revision)
   then raise exception 'DEMO_BUSINESS_REVOKE_DRIFT';end if;
 end if;
 insert into public.demo_world_business_share_receipts(job_id,simulation_day,phase,actor_id,
  vehicle_id,workspace_id,grant_id,grant_revision)
 values(job.id,job.simulation_day,job.phase,actor_id,vehicle.id,target.workspace_id,grant_id,grant_revision);
 update public.demo_world_business_share_jobs set state='DONE',leased_by=null,
  lease_expires_at=null,completed_at=clock_timestamp() where id=job.id;
 return jsonb_build_object('result','APPLIED','phase',job.phase);
end $$;

create function public.demo_world_business_share_status() returns jsonb
language sql volatile security definer set search_path=pg_catalog,public,pg_temp as $$
 select jsonb_build_object('enabled',coalesce(control.enabled,false),
  'target_bound',exists(select 1 from public.demo_world_business_share_target where id=1),
  'pending_count',(select count(*) from public.demo_world_business_share_jobs
    where state<>'DONE' and scheduled_at<=clock_timestamp()),
  'exhausted_count',(select count(*) from public.demo_world_business_share_jobs
    where state<>'DONE' and attempts>=12),
  'last_completed_phase',(select phase from public.demo_world_business_share_jobs
    where state='DONE' order by completed_at desc,id desc limit 1))
 from public.demo_world_business_share_control control where control.id=1
$$;

revoke all on function public.demo_world_business_target_guard(),
 public.demo_world_business_member_guard(),public.demo_world_claim_business_share(uuid),
 public.demo_world_execute_business_share(bigint,uuid),public.demo_world_business_share_status()
 from public,anon,authenticated,service_role;
grant execute on function public.demo_world_claim_business_share(uuid),
 public.demo_world_execute_business_share(bigint,uuid),public.demo_world_business_share_status()
 to service_role;
notify pgrst,'reload schema';
commit;
