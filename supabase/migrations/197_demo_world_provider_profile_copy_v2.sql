-- FEAT-SIM-001. Copy-only cutover for the exact synthetic Sheger page.
-- An unbound install is inert even if its fixture page still has v1 copy.
-- A bound target must first save the v2 baseline via the normal page command.
-- Historical v1 jobs and immutable receipts retain their original meaning.
begin;
select pg_advisory_xact_lock(8030195);
set local lock_timeout='5s';
set local statement_timeout='30s';

do $preflight$
begin
 if not exists(select 1 from public.demo_world_profile_control
  where id=1 and manifest_version=1 and not enabled)
  or not exists(select 1 from public.demo_world_control where id=1 and not enabled)
  or exists(select 1 from public.demo_world_profile_jobs where state<>'DONE')
  or exists(select 1 from public.demo_world_profile_jobs j
   where not exists(select 1 from public.demo_world_profile_receipts r
    where r.job_id=j.id and r.simulation_day=j.simulation_day and r.phase=j.phase))
  or exists(select 1 from public.demo_world_profile_jobs j
   where j.id=(select max(id) from public.demo_world_profile_jobs) and j.phase<>'RESTORE')
 then raise exception 'DEMO_PROFILE_V2_HISTORY_REFUSED';end if;
 if exists(select 1 from public.demo_world_profile_target where id=1)
  and not exists(select 1 from public.company_pages page
  join public.organizations provider on provider.id=page.organization_id
  where page.id='06b2d2f0-9914-4543-853b-72381b4999da'::uuid
   and provider.id='c36022ff-bf3e-432d-ae96-93d1537cf79e'::uuid
   and page.published
   and page.headline='Vehicle space across Addis Ababa'
   and page.about='Around Addis Ababa, Sheger Freight Network works with pickups, vans and box-body vehicles. Open a vehicle to see its latest space and working area.')
 then raise exception 'DEMO_PROFILE_V2_PAGE_REFUSED';end if;
 if exists(select 1 from public.demo_world_profile_target target
  where target.id=1 and not exists(select 1 from auth.users u
   join public.profiles p on p.id=u.id and p.active and p.role='TRANSPORTER'
   join public.organization_members member on member.user_id=u.id
    and member.organization_id=target.organization_id and member.membership_role='OWNER'
   where u.id=target.actor_id and u.deleted_at is null
    and u.raw_app_meta_data->>'fixture_source'='loadgistic'
    and u.raw_user_meta_data->>'fixture_key'='user-public-fleet-01'
    and (lower(u.email)='owner-01@providers.loadgistic.test'
     or lower(u.email)~'^falmatad97\+[a-z0-9][a-z0-9._-]{0,80}@gmail\.com$')))
 then raise exception 'DEMO_PROFILE_V2_ACTOR_REFUSED';end if;
 if exists(select 1 from public.demo_world_profile_receipts r
  join public.demo_world_profile_jobs j on j.id=r.job_id
  where r.before_hash is distinct from case when j.phase='SHOW_DEMO'
    then md5('Reliable freight capacity for growing Ethiopian trade'||E'\n'||'Sheger Freight Network coordinates current truck capacity and regular road-freight service for producers, distributors, and commercial customers.')
    else md5('Road freight across our active routes'||E'\n'||'Our fleet shares current vehicle capacity so brokers and cargo teams can find a suitable match and contact us directly.') end
   or r.after_hash is distinct from case when j.phase='SHOW_DEMO'
    then md5('Road freight across our active routes'||E'\n'||'Our fleet shares current vehicle capacity so brokers and cargo teams can find a suitable match and contact us directly.')
    else md5('Reliable freight capacity for growing Ethiopian trade'||E'\n'||'Sheger Freight Network coordinates current truck capacity and regular road-freight service for producers, distributors, and commercial customers.') end)
 then raise exception 'DEMO_PROFILE_V2_RECEIPT_REFUSED';end if;
end $preflight$;

alter table public.demo_world_profile_jobs
 add column copy_version integer not null default 1 check(copy_version in(1,2));
alter table public.demo_world_profile_jobs alter column copy_version set default 2;
alter table public.demo_world_profile_control drop constraint demo_world_profile_control_manifest_version_check;
alter table public.demo_world_profile_control add constraint demo_world_profile_control_manifest_version_check
 check(manifest_version in(1,2));
update public.demo_world_profile_control set manifest_version=2,changed_at=clock_timestamp()
 where id=1 and not enabled and manifest_version=1;

create function public.demo_world_profile_copy(version integer,alternate boolean)
returns jsonb language sql immutable set search_path=pg_catalog,public as $$
 select case
  when version=1 and not alternate then jsonb_build_object(
   'headline','Reliable freight capacity for growing Ethiopian trade',
   'about','Sheger Freight Network coordinates current truck capacity and regular road-freight service for producers, distributors, and commercial customers.')
  when version=2 and not alternate then jsonb_build_object(
   'headline','Vehicle space across Addis Ababa',
   'about','Around Addis Ababa, Sheger Freight Network works with pickups, vans and box-body vehicles. Open a vehicle to see its latest space and working area.')
  when version in(1,2) and alternate then jsonb_build_object(
   'headline','Road freight across our active routes',
   'about','Our fleet shares current vehicle capacity so brokers and cargo teams can find a suitable match and contact us directly.')
  else null end
$$;
revoke all on function public.demo_world_profile_copy(integer,boolean)
 from public,anon,authenticated,service_role;

create or replace function public.demo_world_profile_target_guard() returns trigger
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
    and page.published
    and page.headline='Vehicle space across Addis Ababa'
    and page.about='Around Addis Ababa, Sheger Freight Network works with pickups, vans and box-body vehicles. Open a vehicle to see its latest space and working area.'
    and page.contact_phone is not null and page.contact_whatsapp is not null
    and page.contact_email is not null and page.contact_website is not null)
 then raise exception 'DEMO_PROFILE_TARGET_REFUSED';end if;
 return new;
end $$;

-- The claim function remains unchanged. Its job insert uses the column default
-- so all new jobs carry version 2; old jobs remain version 1.
create or replace function public.demo_world_execute_profile(job_id bigint,lease_token uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,auth,pg_temp as $$
declare job public.demo_world_profile_jobs%rowtype;
 target public.demo_world_profile_target%rowtype;
 before_page public.company_pages%rowtype;after_page public.company_pages%rowtype;
 baseline jsonb;alternate jsonb;old_copy jsonb;new_copy jsonb;
 saved_id uuid;projection jsonb;now_value timestamptz:=clock_timestamp();
begin
 if job_id is null or lease_token is null then raise exception 'DEMO_PROFILE_INPUT_REFUSED';end if;
 select * into job from public.demo_world_profile_jobs where id=job_id for update;
 if not found or job.lease_token is distinct from lease_token
  then raise exception 'DEMO_PROFILE_LEASE_REFUSED';end if;
 baseline:=public.demo_world_profile_copy(job.copy_version,false);
 alternate:=public.demo_world_profile_copy(job.copy_version,true);
 if baseline is null or alternate is null then raise exception 'DEMO_PROFILE_VERSION_REFUSED';end if;
 old_copy:=case when job.phase='SHOW_DEMO' then baseline else alternate end;
 new_copy:=case when job.phase='SHOW_DEMO' then alternate else baseline end;
 if job.state='DONE' then
  if not exists(select 1 from public.demo_world_profile_receipts receipt
   join public.demo_world_profile_target bound on bound.id=1
   where receipt.job_id=job.id and receipt.phase=job.phase
    and receipt.simulation_day=job.simulation_day and receipt.actor_id=bound.actor_id
    and receipt.page_id=bound.page_id
    and receipt.before_hash=md5((old_copy->>'headline')||E'\n'||(old_copy->>'about'))
    and receipt.after_hash=md5((new_copy->>'headline')||E'\n'||(new_copy->>'about')))
  then raise exception 'DEMO_PROFILE_RECEIPT_DRIFT';end if;
  if not exists(select 1 from public.demo_world_profile_jobs later
    where later.scheduled_at>job.scheduled_at and later.state='DONE')
   and not exists(select 1 from public.demo_world_profile_target bound
    join public.company_pages page on page.id=bound.page_id
    where bound.id=1 and (
     (page.headline=new_copy->>'headline' and page.about=new_copy->>'about')
     or (job.copy_version=1 and job.phase='RESTORE'
      and (select manifest_version=2 from public.demo_world_profile_control where id=1)
      and page.headline=public.demo_world_profile_copy(2,false)->>'headline'
      and page.about=public.demo_world_profile_copy(2,false)->>'about')))
  then raise exception 'DEMO_PROFILE_RECEIPT_DRIFT';end if;
  return jsonb_build_object('result','REPLAYED');
 end if;
 if job.copy_version<>2 or job.state<>'LEASED' or job.lease_expires_at<=now_value
  or job.scheduled_at>now_value
  or not exists(select 1 from public.demo_world_profile_control
   where id=1 and enabled and manifest_version=2)
  or not exists(select 1 from public.demo_world_control where id=1 and enabled)
 then raise exception 'DEMO_PROFILE_LEASE_REFUSED';end if;
 if exists(select 1 from public.demo_world_profile_jobs prior
  where prior.scheduled_at<job.scheduled_at and prior.state<>'DONE')
 then raise exception 'DEMO_PROFILE_ORDER_REFUSED';end if;
 if job.phase='RESTORE' and not exists(select 1 from public.demo_world_profile_receipts prior
  join public.demo_world_profile_jobs prior_job on prior_job.id=prior.job_id
  where prior.simulation_day=job.simulation_day and prior.phase='SHOW_DEMO'
   and prior_job.copy_version=job.copy_version)
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
 where page.id=target.page_id and page.organization_id=target.organization_id for update;
 if not found or not before_page.published then raise exception 'DEMO_PROFILE_TARGET_REFUSED';end if;
 if before_page.headline is distinct from old_copy->>'headline'
  or before_page.about is distinct from old_copy->>'about'
 then raise exception 'DEMO_PROFILE_STATE_CHANGED';end if;
 saved_id:=public.update_provider_profile_page(target.actor_id,jsonb_build_object(
  'headline',new_copy->>'headline','about',new_copy->>'about','published',true,
  'contact_phone',before_page.contact_phone,
  'contact_whatsapp',before_page.contact_whatsapp,
  'contact_email',before_page.contact_email,
  'contact_website',before_page.contact_website,
  'show_contact_phone',before_page.show_contact_phone,
  'show_contact_whatsapp',before_page.show_contact_whatsapp,
  'show_contact_email',before_page.show_contact_email,
  'show_contact_website',before_page.show_contact_website));
 select * into after_page from public.company_pages page where page.id=target.page_id;
 if saved_id is distinct from target.page_id
  or after_page.headline is distinct from new_copy->>'headline'
  or after_page.about is distinct from new_copy->>'about' or not after_page.published
  or (to_jsonb(after_page)-'headline'-'about'-'updated_at')
   is distinct from (to_jsonb(before_page)-'headline'-'about'-'updated_at')
 then raise exception 'DEMO_PROFILE_SAVE_DRIFT';end if;
 projection:=public.public_provider_page_details(target.organization_id,null);
 if projection->>'headline' is distinct from new_copy->>'headline'
  or projection->>'about' is distinct from new_copy->>'about'
 then raise exception 'DEMO_PROFILE_PROJECTION_DRIFT';end if;
 insert into public.demo_world_profile_receipts(job_id,simulation_day,phase,
  actor_id,page_id,before_hash,after_hash)
 values(job.id,job.simulation_day,job.phase,target.actor_id,target.page_id,
  md5((old_copy->>'headline')||E'\n'||(old_copy->>'about')),
  md5((new_copy->>'headline')||E'\n'||(new_copy->>'about')));
 update public.demo_world_profile_jobs set state='DONE',leased_by=null,
  lease_expires_at=null,completed_at=clock_timestamp() where id=job.id;
 return jsonb_build_object('result','APPLIED','phase',job.phase);
end $$;
revoke all on function public.demo_world_execute_profile(bigint,uuid)
 from public,anon,authenticated,service_role;
grant execute on function public.demo_world_execute_profile(bigint,uuid) to service_role;

notify pgrst,'reload schema';
commit;
