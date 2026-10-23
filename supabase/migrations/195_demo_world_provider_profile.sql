-- FEAT-SIM-001. One exact synthetic provider-page cycle. Installed inert.
-- Binding an existing fixture page and enabling the control are separate,
-- reviewed operations; this migration does neither.
begin;
select pg_advisory_xact_lock(8030195);
set local lock_timeout='5s';
set local statement_timeout='30s';

create table public.demo_world_profile_control (
 id integer primary key check(id=1),
 enabled boolean not null default false,
 activated_at timestamptz,
 last_dispatch_at timestamptz,
 manifest_version integer not null check(manifest_version=1),
 changed_at timestamptz not null default clock_timestamp(),
 check(not enabled or activated_at is not null)
);
insert into public.demo_world_profile_control(id,manifest_version) values(1,1);

-- The checked-in managed-market fixture names org-public-fleet-01 and its page.
-- The Auth UUID may differ between restores, so binding pins the current
-- fixture-marked actor while page and provider IDs remain exact.
create table public.demo_world_profile_target (
 id integer primary key check(id=1),
 actor_id uuid not null unique references public.profiles(id),
 organization_id uuid not null unique references public.organizations(id)
  check(organization_id='c36022ff-bf3e-432d-ae96-93d1537cf79e'::uuid),
 page_id uuid not null unique references public.company_pages(id)
  check(page_id='06b2d2f0-9914-4543-853b-72381b4999da'::uuid)
);

create function public.demo_world_profile_target_guard() returns trigger
language plpgsql security definer set search_path=pg_catalog,public,auth,pg_temp as $$
begin
 if tg_op<>'INSERT' then raise exception 'DEMO_PROFILE_TARGET_IMMUTABLE';end if;
 if not exists(select 1 from auth.users u
   join public.profiles p on p.id=u.id and p.active and p.role='TRANSPORTER'
   join public.organization_members member on member.user_id=u.id
    and member.membership_role='OWNER'
   join public.organizations provider on provider.id=member.organization_id
    and provider.type='TRANSPORT_COMPANY'
   join public.company_pages page on page.organization_id=provider.id
   where u.id=new.actor_id and u.deleted_at is null
    and u.raw_app_meta_data->>'fixture_source'='loadgistic'
    and u.raw_user_meta_data->>'fixture_key'='user-public-fleet-01'
    and (lower(u.email)='owner-01@providers.loadgistic.test'
      or lower(u.email)~'^falmatad97\+[a-z0-9][a-z0-9._-]{0,80}@gmail\.com$')
    and provider.id=new.organization_id and page.id=new.page_id
    and page.published and page.headline='Reliable freight capacity for growing Ethiopian trade'
    and page.about='Sheger Freight Network coordinates current truck capacity and regular road-freight service for producers, distributors, and commercial customers.'
    and page.contact_phone is not null and page.contact_whatsapp is not null
    and page.contact_email is not null and page.contact_website is not null)
 then raise exception 'DEMO_PROFILE_TARGET_REFUSED';end if;
 return new;
end $$;
create trigger demo_world_profile_target_guard before insert or update or delete
 on public.demo_world_profile_target for each row
 execute function public.demo_world_profile_target_guard();

create table public.demo_world_profile_jobs (
 id bigint generated always as identity primary key,
 simulation_day date not null,
 phase text not null check(phase in('SHOW_DEMO','RESTORE')),
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
create index demo_world_profile_jobs_due_idx
 on public.demo_world_profile_jobs(state,scheduled_at,id);

create table public.demo_world_profile_receipts (
 job_id bigint primary key references public.demo_world_profile_jobs(id),
 simulation_day date not null,
 phase text not null check(phase in('SHOW_DEMO','RESTORE')),
 actor_id uuid not null references public.profiles(id),
 page_id uuid not null references public.company_pages(id),
 before_hash text not null check(before_hash ~ '^[a-f0-9]{32}$'),
 after_hash text not null check(after_hash ~ '^[a-f0-9]{32}$'),
 applied_at timestamptz not null default clock_timestamp(),
 unique(simulation_day,phase)
);
create trigger demo_world_profile_receipt_immutable before update or delete
 on public.demo_world_profile_receipts for each row
 execute function public.demo_world_refuse_receipt_change();

alter table public.demo_world_profile_control enable row level security;
alter table public.demo_world_profile_target enable row level security;
alter table public.demo_world_profile_jobs enable row level security;
alter table public.demo_world_profile_receipts enable row level security;
revoke all on public.demo_world_profile_control,public.demo_world_profile_target,
 public.demo_world_profile_jobs,public.demo_world_profile_receipts
 from public,anon,authenticated,service_role;
revoke all on sequence public.demo_world_profile_jobs_id_seq
 from public,anon,authenticated,service_role;

-- The worker chooses neither actor nor content. Catch-up is bounded, and an
-- unfinished earlier phase blocks a later one.
create function public.demo_world_claim_profile(worker_id uuid)
returns table(job_id bigint,lease_token uuid)
language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare now_value timestamptz:=clock_timestamp();today date:=(clock_timestamp() at time zone 'UTC')::date;
 activation_time timestamptz;previous_dispatch timestamptz;
begin
 if worker_id is null or worker_id='00000000-0000-0000-0000-000000000000'::uuid
  then raise exception 'DEMO_PROFILE_INPUT_REFUSED';end if;
 select activated_at,last_dispatch_at into activation_time,previous_dispatch
 from public.demo_world_profile_control where id=1 and enabled;
 if activation_time is null then return;end if;
 if not exists(select 1 from public.demo_world_control where id=1 and enabled)
  then return;end if;
 if not exists(select 1 from public.demo_world_profile_target where id=1)
  then raise exception 'DEMO_PROFILE_TARGET_REFUSED';end if;
 if coalesce(previous_dispatch,activation_time)<now_value-interval '2 days'
  or exists(select 1 from public.demo_world_profile_jobs
   where state<>'DONE' and scheduled_at<now_value-interval '2 days')
 then raise exception 'DEMO_PROFILE_GAP_REVIEW_REQUIRED';end if;
 update public.demo_world_profile_control set last_dispatch_at=now_value where id=1;
 insert into public.demo_world_profile_jobs(simulation_day,phase,scheduled_at)
 select day_value::date,phase.phase,
  (day_value::timestamp at time zone 'UTC')+phase.minute_utc*interval '1 minute'
 from generate_series((today-1)::timestamp,today::timestamp,interval '1 day') day_value
 cross join(values('SHOW_DEMO',540),('RESTORE',900)) phase(phase,minute_utc)
 where (day_value::timestamp at time zone 'UTC')+interval '9 hours'>=activation_time
  and (day_value::timestamp at time zone 'UTC')+phase.minute_utc*interval '1 minute'<=now_value
 on conflict do nothing;
 return query
 with due as (
  select candidate.id from public.demo_world_profile_jobs candidate
  where candidate.scheduled_at<=now_value and candidate.attempts<12
   and(candidate.state='PENDING' or candidate.state='LEASED' and candidate.lease_expires_at<now_value)
   and not exists(select 1 from public.demo_world_profile_jobs prior
    where prior.scheduled_at<candidate.scheduled_at and prior.state<>'DONE')
  order by candidate.scheduled_at,candidate.id limit 1
  for update of candidate skip locked
 )
 update public.demo_world_profile_jobs selected
  set state='LEASED',lease_token=gen_random_uuid(),leased_by=worker_id,
   lease_expires_at=now_value+interval '2 minutes',attempts=selected.attempts+1
 from due where selected.id=due.id returning selected.id,selected.lease_token;
end $$;

-- The ordinary authorized page command, readback and receipt are one
-- transaction. A changed page, actor or other field aborts all three.
create function public.demo_world_execute_profile(job_id bigint,lease_token uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,auth,pg_temp as $$
declare job public.demo_world_profile_jobs%rowtype;
 target public.demo_world_profile_target%rowtype;
 before_page public.company_pages%rowtype;after_page public.company_pages%rowtype;
 old_headline text;old_about text;new_headline text;new_about text;
 saved_id uuid;before_hash text;after_hash text;projection jsonb;
 now_value timestamptz:=clock_timestamp();
begin
 if job_id is null or lease_token is null then raise exception 'DEMO_PROFILE_INPUT_REFUSED';end if;
 select * into job from public.demo_world_profile_jobs where id=job_id for update;
 if not found or job.lease_token is distinct from lease_token
  then raise exception 'DEMO_PROFILE_LEASE_REFUSED';end if;
 if job.state='DONE' then
  if not exists(select 1 from public.demo_world_profile_receipts receipt
   join public.demo_world_profile_target bound on bound.id=1
   where receipt.job_id=job.id and receipt.phase=job.phase
    and receipt.simulation_day=job.simulation_day and receipt.actor_id=bound.actor_id
    and receipt.page_id=bound.page_id
    and receipt.before_hash=case when job.phase='SHOW_DEMO'
      then md5('Reliable freight capacity for growing Ethiopian trade'||E'\n'||'Sheger Freight Network coordinates current truck capacity and regular road-freight service for producers, distributors, and commercial customers.')
      else md5('Road freight across our active routes'||E'\n'||'Our fleet shares current vehicle capacity so brokers and cargo teams can find a suitable match and contact us directly.') end
    and receipt.after_hash=case when job.phase='SHOW_DEMO'
      then md5('Road freight across our active routes'||E'\n'||'Our fleet shares current vehicle capacity so brokers and cargo teams can find a suitable match and contact us directly.')
      else md5('Reliable freight capacity for growing Ethiopian trade'||E'\n'||'Sheger Freight Network coordinates current truck capacity and regular road-freight service for producers, distributors, and commercial customers.') end)
   then raise exception 'DEMO_PROFILE_RECEIPT_DRIFT';end if;
  if not exists(select 1 from public.demo_world_profile_jobs later
    where later.scheduled_at>job.scheduled_at and later.state='DONE')
   and not exists(select 1 from public.demo_world_profile_target bound
    join public.company_pages page on page.id=bound.page_id
    where bound.id=1 and page.headline=case when job.phase='SHOW_DEMO'
      then 'Road freight across our active routes' else 'Reliable freight capacity for growing Ethiopian trade' end
     and page.about=case when job.phase='SHOW_DEMO'
      then 'Our fleet shares current vehicle capacity so brokers and cargo teams can find a suitable match and contact us directly.'
      else 'Sheger Freight Network coordinates current truck capacity and regular road-freight service for producers, distributors, and commercial customers.' end)
   then raise exception 'DEMO_PROFILE_RECEIPT_DRIFT';end if;
  return jsonb_build_object('result','REPLAYED');
 end if;
 if job.state<>'LEASED' or job.lease_expires_at<=now_value or job.scheduled_at>now_value
  or not exists(select 1 from public.demo_world_profile_control where id=1 and enabled)
  or not exists(select 1 from public.demo_world_control where id=1 and enabled)
 then raise exception 'DEMO_PROFILE_LEASE_REFUSED';end if;
 if exists(select 1 from public.demo_world_profile_jobs prior
  where prior.scheduled_at<job.scheduled_at and prior.state<>'DONE')
 then raise exception 'DEMO_PROFILE_ORDER_REFUSED';end if;
 if job.phase='RESTORE' and not exists(select 1 from public.demo_world_profile_receipts prior
  where prior.simulation_day=job.simulation_day and prior.phase='SHOW_DEMO')
 then raise exception 'DEMO_PROFILE_ORDER_REFUSED';end if;
 select * into target from public.demo_world_profile_target where id=1;
 if not found or target.organization_id<>'c36022ff-bf3e-432d-ae96-93d1537cf79e'::uuid
  or target.page_id<>'06b2d2f0-9914-4543-853b-72381b4999da'::uuid
 then raise exception 'DEMO_PROFILE_TARGET_REFUSED';end if;
 if not exists(select 1 from auth.users u
   join public.profiles p on p.id=u.id and p.active and p.role='TRANSPORTER'
   join public.organization_members member on member.user_id=u.id
    and member.membership_role='OWNER'
   join public.organizations provider on provider.id=member.organization_id
    and provider.type='TRANSPORT_COMPANY'
   where u.id=target.actor_id and u.deleted_at is null
    and u.raw_app_meta_data->>'fixture_source'='loadgistic'
    and u.raw_user_meta_data->>'fixture_key'='user-public-fleet-01'
    and (lower(u.email)='owner-01@providers.loadgistic.test'
      or lower(u.email)~'^falmatad97\+[a-z0-9][a-z0-9._-]{0,80}@gmail\.com$')
    and provider.id=target.organization_id)
 then raise exception 'DEMO_PROFILE_ACTOR_REFUSED';end if;
 select * into before_page from public.company_pages page
 where page.id=target.page_id and page.organization_id=target.organization_id
 for update;
 if not found or not before_page.published then raise exception 'DEMO_PROFILE_TARGET_REFUSED';end if;
 if job.phase='SHOW_DEMO' then
  old_headline:='Reliable freight capacity for growing Ethiopian trade';
  old_about:='Sheger Freight Network coordinates current truck capacity and regular road-freight service for producers, distributors, and commercial customers.';
  new_headline:='Road freight across our active routes';
  new_about:='Our fleet shares current vehicle capacity so brokers and cargo teams can find a suitable match and contact us directly.';
 else
  old_headline:='Road freight across our active routes';
  old_about:='Our fleet shares current vehicle capacity so brokers and cargo teams can find a suitable match and contact us directly.';
  new_headline:='Reliable freight capacity for growing Ethiopian trade';
  new_about:='Sheger Freight Network coordinates current truck capacity and regular road-freight service for producers, distributors, and commercial customers.';
 end if;
 if before_page.headline is distinct from old_headline or before_page.about is distinct from old_about
 then raise exception 'DEMO_PROFILE_STATE_CHANGED';end if;
 before_hash:=md5(old_headline||E'\n'||old_about);
 -- The normal company-page command treats omitted contacts as blank. Supply
 -- their existing values so this lane changes only the two intended fields.
 saved_id:=public.update_provider_profile_page(target.actor_id,jsonb_build_object(
  'headline',new_headline,'about',new_about,'published',true,
  'contact_phone',before_page.contact_phone,
  'contact_whatsapp',before_page.contact_whatsapp,
  'contact_email',before_page.contact_email,
  'contact_website',before_page.contact_website,
  'show_contact_phone',before_page.show_contact_phone,
  'show_contact_whatsapp',before_page.show_contact_whatsapp,
  'show_contact_email',before_page.show_contact_email,
  'show_contact_website',before_page.show_contact_website));
 select * into after_page from public.company_pages page where page.id=target.page_id;
 if saved_id is distinct from target.page_id or after_page.headline is distinct from new_headline
  or after_page.about is distinct from new_about or not after_page.published
  or (to_jsonb(after_page)-'headline'-'about'-'updated_at')
   is distinct from (to_jsonb(before_page)-'headline'-'about'-'updated_at')
 then raise exception 'DEMO_PROFILE_SAVE_DRIFT';end if;
 projection:=public.public_provider_page_details(target.organization_id,null);
 if projection->>'headline' is distinct from new_headline
  or projection->>'about' is distinct from new_about
 then raise exception 'DEMO_PROFILE_PROJECTION_DRIFT';end if;
 after_hash:=md5(new_headline||E'\n'||new_about);
 insert into public.demo_world_profile_receipts(job_id,simulation_day,phase,
  actor_id,page_id,before_hash,after_hash)
 values(job.id,job.simulation_day,job.phase,target.actor_id,target.page_id,before_hash,after_hash);
 update public.demo_world_profile_jobs set state='DONE',leased_by=null,
  lease_expires_at=null,completed_at=clock_timestamp() where id=job.id;
 return jsonb_build_object('result','APPLIED','phase',job.phase);
end $$;

create function public.demo_world_profile_status() returns jsonb
language sql volatile security definer set search_path=pg_catalog,public,pg_temp as $$
 select jsonb_build_object('enabled',coalesce(control.enabled,false)
   and exists(select 1 from public.demo_world_control where id=1 and enabled),
  'target_bound',exists(select 1 from public.demo_world_profile_target where id=1),
  'pending_count',(select count(*) from public.demo_world_profile_jobs
   where state<>'DONE' and scheduled_at<=clock_timestamp()),
  'exhausted_count',(select count(*) from public.demo_world_profile_jobs
   where state<>'DONE' and attempts>=12),
  'last_completed_phase',(select phase from public.demo_world_profile_jobs
   where state='DONE' order by completed_at desc,id desc limit 1))
 from public.demo_world_profile_control control where control.id=1
$$;

revoke all on function public.demo_world_profile_target_guard(),
 public.demo_world_claim_profile(uuid),public.demo_world_execute_profile(bigint,uuid),
 public.demo_world_profile_status() from public,anon,authenticated,service_role;
grant execute on function public.demo_world_claim_profile(uuid),
 public.demo_world_execute_profile(bigint,uuid),public.demo_world_profile_status()
 to service_role;
notify pgrst,'reload schema';
commit;
