-- FEAT-SIM-001. Inert durable handover lane, distinct from daily Capacity jobs.
-- No scheduled caller is installed by this migration. Control stays disabled.
begin;
select pg_advisory_xact_lock(8030188);
set local lock_timeout='5s';
set local statement_timeout='30s';

create table public.demo_world_handover_jobs (
 id bigint generated always as identity primary key,
 simulation_day date not null unique,
 scheduled_at timestamptz not null,
 state text not null default 'PENDING' check(state in('PENDING','LEASED','DONE')),
 lease_token uuid,
 leased_by uuid,
 lease_expires_at timestamptz,
 attempts integer not null default 0 check(attempts between 0 and 12),
 completed_at timestamptz,
 check((state='LEASED' and lease_token is not null and leased_by is not null and lease_expires_at is not null)
   or (state<>'LEASED' and leased_by is null and lease_expires_at is null)),
 check(scheduled_at=((simulation_day::timestamp+interval '11 hours') at time zone 'UTC'))
);
create index demo_world_handover_due_idx on public.demo_world_handover_jobs(state,scheduled_at,id);
alter table public.demo_world_handover_jobs enable row level security;
revoke all on public.demo_world_handover_jobs from public,anon,authenticated,service_role;
revoke all on sequence public.demo_world_handover_jobs_id_seq from public,anon,authenticated,service_role;

create function public.demo_world_handover_slot(at_time timestamptz)
returns boolean language sql immutable set search_path=pg_catalog as $$
 select at_time is not null
   and (at_time at time zone 'UTC')::date>=date '2026-10-26'
   and mod((at_time at time zone 'UTC')::date-date '2026-10-26',14)=0
   and (at_time at time zone 'UTC')::time>=time '11:00';
$$;
revoke all on function public.demo_world_handover_slot(timestamptz)
 from public,anon,authenticated,service_role;

-- The worker supplies only its own identity, not an account, vehicle, date or
-- command. Every second Monday at 11:00 UTC is the only eligible slot.
create function public.demo_world_claim_handover(worker_id uuid)
returns table(job_id bigint,lease_token uuid)
language plpgsql security definer set search_path=public,pg_temp as $$
declare now_value timestamptz:=clock_timestamp();today_utc date:=(clock_timestamp() at time zone 'UTC')::date;
 due_at timestamptz:=((clock_timestamp() at time zone 'UTC')::date::timestamp+interval '11 hours') at time zone 'UTC';
 activation_time timestamptz;
begin
 if worker_id is null or worker_id='00000000-0000-0000-0000-000000000000'::uuid
   then raise exception 'DEMO_HANDOVER_WORKER_REFUSED';end if;
 select activated_at into activation_time from public.demo_world_control
   where id=1 and enabled and manifest_version=1;
 if activation_time is null then return;end if;
 if not public.demo_world_handover_slot(now_value) or activation_time>due_at then return;end if;
 insert into public.demo_world_handover_jobs(simulation_day,scheduled_at)
   values(today_utc,due_at) on conflict(simulation_day) do nothing;
 return query
 with due as (
   select job.id from public.demo_world_handover_jobs job
   where job.simulation_day=today_utc and job.scheduled_at<=now_value
     and job.attempts<12 and (job.state='PENDING'
       or job.state='LEASED' and job.lease_expires_at<now_value)
   order by job.id limit 1 for update of job skip locked
 )
 update public.demo_world_handover_jobs selected
   set state='LEASED',lease_token=gen_random_uuid(),leased_by=worker_id,
     lease_expires_at=now_value+interval '2 minutes',attempts=selected.attempts+1
 from due where selected.id=due.id returning selected.id,selected.lease_token;
end $$;

-- Calling the exact handover and completing its job are one transaction. A
-- failure restores the lease state; the next claim can retry after expiry.
create function public.demo_world_execute_handover_job(job_id bigint,lease_token uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare job public.demo_world_handover_jobs%rowtype;result jsonb;
begin
 select * into job from public.demo_world_handover_jobs where id=job_id for update;
 if not found or job.lease_token is distinct from lease_token or lease_token is null
   then raise exception 'DEMO_HANDOVER_LEASE_REFUSED';end if;
 if job.state='DONE' then
   if not exists(select 1 from public.demo_world_handover_receipts receipt
     where receipt.simulation_day=job.simulation_day)
     then raise exception 'DEMO_HANDOVER_RECEIPT_DRIFT';end if;
   return jsonb_build_object('completed',true,'replayed',true);
 end if;
 if job.state<>'LEASED' or job.lease_expires_at<=clock_timestamp()
   or job.simulation_day is distinct from (clock_timestamp() at time zone 'UTC')::date
   or not exists(select 1 from public.demo_world_control where id=1 and enabled and manifest_version=1)
   then raise exception 'DEMO_HANDOVER_LEASE_REFUSED';end if;
 result:=public.demo_world_execute_atomic_handover();
 if result->>'simulationDay'<>job.simulation_day::text
   or not exists(select 1 from public.demo_world_handover_receipts receipt
     where receipt.simulation_day=job.simulation_day)
   then raise exception 'DEMO_HANDOVER_RECEIPT_DRIFT';end if;
 update public.demo_world_handover_jobs set state='DONE',leased_by=null,
   lease_expires_at=null,completed_at=clock_timestamp() where id=job.id;
 return jsonb_build_object('completed',true,'replayed',coalesce((result->>'replayed')::boolean,false));
end $$;

create function public.demo_world_handover_status()
returns jsonb language sql stable security definer set search_path=public,pg_temp as $$
 select jsonb_build_object('enabled',coalesce(control.enabled,false),
   'pending_count',(select count(*) from public.demo_world_handover_jobs where state<>'DONE'),
   'last_completed_day',(select max(simulation_day) from public.demo_world_handover_jobs where state='DONE'),
   'next_scheduled_day',date '2026-10-26'+
     ((greatest(0,(clock_timestamp() at time zone 'UTC')::date-date '2026-10-26')+13)/14)*14)
 from public.demo_world_control control where id=1;
$$;

revoke all on function public.demo_world_claim_handover(uuid),
 public.demo_world_execute_handover_job(bigint,uuid),public.demo_world_handover_status()
 from public,anon,authenticated,service_role;
revoke all on function public.demo_world_execute_atomic_handover() from service_role;
grant execute on function public.demo_world_claim_handover(uuid),
 public.demo_world_execute_handover_job(bigint,uuid),public.demo_world_handover_status()
 to service_role;
commit;
