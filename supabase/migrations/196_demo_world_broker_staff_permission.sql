-- FEAT-SIM-001. Exact synthetic broker STAFF Capacity permission cycle.
-- This installs disabled and unbound; no account or invitation is created here.
begin;
select pg_advisory_xact_lock(8030196);
set local lock_timeout='5s';
set local statement_timeout='30s';

create table public.demo_world_team_control (
 id integer primary key check(id=1),
 enabled boolean not null default false,
 activated_at timestamptz,
 last_dispatch_at timestamptz,
 manifest_version integer not null check(manifest_version=1),
 check(not enabled or activated_at is not null)
);
insert into public.demo_world_team_control(id,manifest_version) values(1,1);

create table public.demo_world_team_target (
 id integer primary key check(id=1),
 workspace_id uuid not null unique references public.business_workspaces(id)
  check(workspace_id='1da45f19-a9fa-4c55-b08e-7c3b65b1aa7d'::uuid),
 owner_id uuid not null references public.profiles(id),
 staff_id uuid not null unique references public.profiles(id),
 bound_version bigint not null check(bound_version>0),
 bound_revision bigint not null check(bound_revision>0),
 check(owner_id<>staff_id)
);

create function public.demo_world_team_target_guard() returns trigger
language plpgsql security definer set search_path=pg_catalog,public,auth,pg_temp as $$
begin
 if tg_op<>'INSERT' then raise exception 'DEMO_TEAM_TARGET_IMMUTABLE';end if;
 if not exists(select 1 from public.business_workspaces w
  join public.business_workspace_members owner on owner.workspace_id=w.id
   and owner.user_id=new.owner_id and owner.role='OWNER' and owner.active
   and owner.can_view_capacity and owner.can_view_tracking
  join auth.users owner_auth on owner_auth.id=owner.user_id
  join public.profiles owner_profile on owner_profile.id=owner.user_id and owner_profile.active
  join public.business_workspace_members staff on staff.workspace_id=w.id
   and staff.user_id=new.staff_id and staff.role='STAFF' and staff.active
   and staff.can_view_capacity and staff.can_view_tracking
  join auth.users staff_auth on staff_auth.id=staff.user_id
  join public.profiles staff_profile on staff_profile.id=staff.user_id and staff_profile.active
  where w.id=new.workspace_id and w.active and w.kind='BROKER'
   and w.version=new.bound_version and staff.revision=new.bound_revision
   and owner_auth.deleted_at is null and owner_auth.email_confirmed_at is not null
   and owner_auth.raw_app_meta_data->>'fixture_source'='loadgistic'
   and owner_auth.raw_user_meta_data->>'fixture_key'='user-sim-broker'
   and lower(owner_auth.email)='broker-scenario@loadgistic.local'
   and staff_auth.deleted_at is null and staff_auth.email_confirmed_at is not null
   and staff_auth.raw_app_meta_data->>'fixture_source'='loadgistic'
   and staff_auth.raw_user_meta_data->>'fixture_key'='user-sim-broker-staff'
   and lower(staff_auth.email)='demo-broker-staff-196@loadgistic.local'
   and exists(select 1 from public.business_workspace_invitations invite
    where invite.workspace_id=w.id and invite.created_by=new.owner_id
     and invite.accepted_by=new.staff_id and invite.email=lower(staff_auth.email)
     and invite.role='STAFF' and invite.status='ACCEPTED'
     and invite.can_view_capacity and invite.can_view_tracking
     and invite.email_attempts=0 and invite.email_sent_at is null)
   and (select count(*) from public.business_workspace_members m
    where m.workspace_id=w.id and m.active)=2)
 then raise exception 'DEMO_TEAM_TARGET_REFUSED';end if;
 return new;
end $$;
create trigger demo_world_team_target_guard before insert or update or delete
 on public.demo_world_team_target for each row
 execute function public.demo_world_team_target_guard();

create table public.demo_world_team_jobs (
 id bigint generated always as identity primary key,
 simulation_day date not null,
 phase text not null check(phase in('CAPACITY_OFF','CAPACITY_ON')),
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
create index demo_world_team_jobs_due_idx on public.demo_world_team_jobs(state,scheduled_at,id);

create table public.demo_world_team_receipts (
 job_id bigint primary key references public.demo_world_team_jobs(id),
 simulation_day date not null,
 phase text not null check(phase in('CAPACITY_OFF','CAPACITY_ON')),
 workspace_id uuid not null references public.business_workspaces(id),
 owner_id uuid not null references public.profiles(id),
 staff_id uuid not null references public.profiles(id),
 before_version bigint not null,
 after_version bigint not null,
 before_revision bigint not null,
 after_revision bigint not null,
 applied_at timestamptz not null default clock_timestamp(),
 unique(simulation_day,phase),
 check(after_version=before_version+1 and after_revision=before_revision+1)
);
create trigger demo_world_team_receipt_immutable before update or delete
 on public.demo_world_team_receipts for each row
 execute function public.demo_world_refuse_receipt_change();

alter table public.demo_world_team_control enable row level security;
alter table public.demo_world_team_target enable row level security;
alter table public.demo_world_team_jobs enable row level security;
alter table public.demo_world_team_receipts enable row level security;
revoke all on public.demo_world_team_control,public.demo_world_team_target,
 public.demo_world_team_jobs,public.demo_world_team_receipts
 from public,anon,authenticated,service_role;
revoke all on sequence public.demo_world_team_jobs_id_seq
 from public,anon,authenticated,service_role;

create function public.demo_world_claim_team(worker_id uuid)
returns table(job_id bigint,lease_token uuid)
language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare now_value timestamptz:=clock_timestamp();today date:=(clock_timestamp() at time zone 'UTC')::date;
 activation_time timestamptz;previous_dispatch timestamptz;
begin
 if worker_id is null or worker_id='00000000-0000-0000-0000-000000000000'::uuid
 then raise exception 'DEMO_TEAM_INPUT_REFUSED';end if;
 select activated_at,last_dispatch_at into activation_time,previous_dispatch
 from public.demo_world_team_control where id=1 and enabled;
 if activation_time is null or not exists(select 1 from public.demo_world_control
  where id=1 and enabled and manifest_version=1) then return;end if;
 if not exists(select 1 from public.demo_world_team_target where id=1)
 then raise exception 'DEMO_TEAM_TARGET_REFUSED';end if;
 if coalesce(previous_dispatch,activation_time)<now_value-interval '2 days'
  or exists(select 1 from public.demo_world_team_jobs
   where state<>'DONE' and scheduled_at<now_value-interval '2 days')
 then raise exception 'DEMO_TEAM_GAP_REVIEW_REQUIRED';end if;
 update public.demo_world_team_control set last_dispatch_at=now_value where id=1;
 insert into public.demo_world_team_jobs(simulation_day,phase,scheduled_at)
 select day_value::date,phase.phase,
  (day_value::timestamp at time zone 'UTC')+phase.minute_utc*interval '1 minute'
 from generate_series((today-1)::timestamp,today::timestamp,interval '1 day') day_value
 cross join(values('CAPACITY_OFF',600),('CAPACITY_ON',840)) phase(phase,minute_utc)
 where (day_value::timestamp at time zone 'UTC')+interval '10 hours'>=activation_time
  and (day_value::timestamp at time zone 'UTC')+phase.minute_utc*interval '1 minute'<=now_value
 on conflict do nothing;
 return query
 with due as (
  select candidate.id from public.demo_world_team_jobs candidate
  where candidate.scheduled_at<=now_value and candidate.attempts<12
   and(candidate.state='PENDING' or candidate.state='LEASED' and candidate.lease_expires_at<now_value)
   and not exists(select 1 from public.demo_world_team_jobs prior
    where prior.scheduled_at<candidate.scheduled_at and prior.state<>'DONE')
  order by candidate.scheduled_at,candidate.id limit 1
  for update of candidate skip locked
 )
 update public.demo_world_team_jobs selected
  set state='LEASED',lease_token=gen_random_uuid(),leased_by=worker_id,
   lease_expires_at=now_value+interval '2 minutes',attempts=selected.attempts+1
 from due where selected.id=due.id returning selected.id,selected.lease_token;
end $$;

create function public.demo_world_execute_team(job_id bigint,lease_token uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,auth,pg_temp as $$
#variable_conflict use_variable
declare job public.demo_world_team_jobs%rowtype;
 target public.demo_world_team_target%rowtype;
 business public.business_workspaces%rowtype;
 member public.business_workspace_members%rowtype;
 prior public.demo_world_team_receipts%rowtype;
 saved jsonb; now_value timestamptz:=clock_timestamp();
 expected_capacity boolean;next_capacity boolean;
begin
 if job_id is null or lease_token is null then raise exception 'DEMO_TEAM_INPUT_REFUSED';end if;
 select * into job from public.demo_world_team_jobs where id=job_id for update;
 if not found or job.lease_token is distinct from lease_token
 then raise exception 'DEMO_TEAM_LEASE_REFUSED';end if;
 if job.state='DONE' then
  if not exists(select 1 from public.demo_world_team_receipts receipt
   join public.demo_world_team_target bound on bound.id=1
   where receipt.job_id=job.id and receipt.phase=job.phase
    and receipt.simulation_day=job.simulation_day
    and receipt.workspace_id=bound.workspace_id
    and receipt.owner_id=bound.owner_id and receipt.staff_id=bound.staff_id)
  then raise exception 'DEMO_TEAM_RECEIPT_DRIFT';end if;
  if not exists(select 1 from public.demo_world_team_jobs later
    where later.scheduled_at>job.scheduled_at and later.state='DONE')
   and not exists(select 1 from public.demo_world_team_receipts receipt
    join public.business_workspaces w on w.id=receipt.workspace_id
    join public.business_workspace_members m on m.workspace_id=w.id and m.user_id=receipt.staff_id
    where receipt.job_id=job.id and w.version=receipt.after_version
     and m.revision=receipt.after_revision and m.active and m.role='STAFF'
     and m.can_view_tracking and m.can_view_capacity=(job.phase='CAPACITY_ON'))
  then raise exception 'DEMO_TEAM_RECEIPT_DRIFT';end if;
  return jsonb_build_object('result','REPLAYED');
 end if;
 if job.state<>'LEASED' or job.lease_expires_at<=now_value or job.scheduled_at>now_value
  or not exists(select 1 from public.demo_world_team_control where id=1 and enabled)
  or not exists(select 1 from public.demo_world_control where id=1 and enabled and manifest_version=1)
 then raise exception 'DEMO_TEAM_LEASE_REFUSED';end if;
 if exists(select 1 from public.demo_world_team_jobs prior_job
   where prior_job.scheduled_at<job.scheduled_at and prior_job.state<>'DONE')
 then raise exception 'DEMO_TEAM_ORDER_REFUSED';end if;
 if job.phase='CAPACITY_ON' and not exists(select 1 from public.demo_world_team_receipts earlier
  where earlier.simulation_day=job.simulation_day and earlier.phase='CAPACITY_OFF')
 then raise exception 'DEMO_TEAM_ORDER_REFUSED';end if;
 select * into target from public.demo_world_team_target where id=1;
 if not found or target.workspace_id<>'1da45f19-a9fa-4c55-b08e-7c3b65b1aa7d'::uuid
 then raise exception 'DEMO_TEAM_TARGET_REFUSED';end if;
 select * into business from public.business_workspaces where id=target.workspace_id for update;
 select * into member from public.business_workspace_members
  where workspace_id=target.workspace_id and user_id=target.staff_id for update;
 if not business.active or business.kind<>'BROKER' or not member.active
  or member.role<>'STAFF' or not member.can_view_tracking
  or not public.business_workspace_permission(target.owner_id,target.workspace_id,'OWNER')
  or not public.business_workspace_permission(target.staff_id,target.workspace_id,'TRACKING')
  or (select count(*) from public.business_workspace_members m
   where m.workspace_id=target.workspace_id and m.active)<>2
  or not exists(select 1 from auth.users u where u.id=target.owner_id
   and u.deleted_at is null and u.email_confirmed_at is not null
   and u.raw_app_meta_data->>'fixture_source'='loadgistic'
   and u.raw_user_meta_data->>'fixture_key'='user-sim-broker'
   and lower(u.email)='broker-scenario@loadgistic.local')
  or not exists(select 1 from auth.users u where u.id=target.staff_id
   and u.deleted_at is null and u.email_confirmed_at is not null
   and u.raw_app_meta_data->>'fixture_source'='loadgistic'
   and u.raw_user_meta_data->>'fixture_key'='user-sim-broker-staff'
   and lower(u.email)='demo-broker-staff-196@loadgistic.local')
 then raise exception 'DEMO_TEAM_ACTOR_REFUSED';end if;
 select receipt.* into prior from public.demo_world_team_receipts receipt
 join public.demo_world_team_jobs completed on completed.id=receipt.job_id
 where completed.scheduled_at<job.scheduled_at
 order by completed.scheduled_at desc,completed.id desc limit 1;
 if business.version<>coalesce(prior.after_version,target.bound_version)
  or member.revision<>coalesce(prior.after_revision,target.bound_revision)
 then raise exception 'DEMO_TEAM_STATE_CHANGED';end if;
 expected_capacity:=(job.phase='CAPACITY_OFF');
 next_capacity:=not expected_capacity;
 if member.can_view_capacity is distinct from expected_capacity
 then raise exception 'DEMO_TEAM_STATE_CHANGED';end if;
 saved:=public.business_workspace_command(target.owner_id,target.workspace_id,
  jsonb_build_object('action','UPDATE_MEMBER','expectedVersion',business.version,
   'userId',target.staff_id,'role','STAFF','capacity',next_capacity,
   'tracking',true,'active',true));
 if (saved->>'version')::bigint<>business.version+1
  or not exists(select 1 from public.business_workspace_members m
   where m.workspace_id=target.workspace_id and m.user_id=target.staff_id
    and m.revision=member.revision+1 and m.active and m.role='STAFF'
    and m.can_view_capacity=next_capacity and m.can_view_tracking)
  or not public.business_workspace_permission(target.owner_id,target.workspace_id,'CAPACITY')
 then raise exception 'DEMO_TEAM_READBACK_FAILED';end if;
 insert into public.demo_world_team_receipts(job_id,simulation_day,phase,workspace_id,
  owner_id,staff_id,before_version,after_version,before_revision,after_revision)
 values(job.id,job.simulation_day,job.phase,target.workspace_id,target.owner_id,
  target.staff_id,business.version,business.version+1,member.revision,member.revision+1);
 update public.demo_world_team_jobs set state='DONE',leased_by=null,
  lease_expires_at=null,completed_at=clock_timestamp() where id=job.id;
 return jsonb_build_object('result','APPLIED','phase',job.phase);
end $$;

create function public.demo_world_team_status() returns jsonb
language sql volatile security definer set search_path=pg_catalog,public,pg_temp as $$
 select jsonb_build_object('enabled',coalesce(control.enabled,false)
   and exists(select 1 from public.demo_world_control where id=1 and enabled and manifest_version=1),
  'target_bound',exists(select 1 from public.demo_world_team_target where id=1),
  'pending_count',(select count(*) from public.demo_world_team_jobs
   where state<>'DONE' and scheduled_at<=clock_timestamp()),
  'exhausted_count',(select count(*) from public.demo_world_team_jobs
   where state<>'DONE' and attempts>=12),
  'last_completed_phase',(select phase from public.demo_world_team_jobs
   where state='DONE' order by completed_at desc,id desc limit 1))
 from public.demo_world_team_control control where control.id=1
$$;

revoke all on function public.demo_world_team_target_guard(),
 public.demo_world_claim_team(uuid),public.demo_world_execute_team(bigint,uuid),
 public.demo_world_team_status() from public,anon,authenticated,service_role;
grant execute on function public.demo_world_claim_team(uuid),
 public.demo_world_execute_team(bigint,uuid),public.demo_world_team_status()
 to service_role;
notify pgrst,'reload schema';
commit;
