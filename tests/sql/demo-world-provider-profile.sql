-- FEAT-SIM-001. Rollback-only check on a disposable, fixture-loaded clone.
-- Migrations 195 and 197 are inert; bind the one checked-in synthetic page.
begin;
set local statement_timeout='90s';
create function pg_temp.assert_profile(ok boolean,label text) returns void
language plpgsql as $$begin if ok is not true then raise exception '%',label;end if;end$$;
create function pg_temp.expect_profile_denial(statement text,code text) returns void
language plpgsql as $$
begin
 begin execute statement;
 exception when others then
  if position(code in sqlerrm)>0 then return;end if;
  raise;
 end;
 raise exception 'EXPECTED_DEMO_PROFILE_DENIAL:%',code;
end $$;

do $scenario$
#variable_conflict use_variable
declare actor_id uuid;foreign_actor uuid;page_id uuid:='06b2d2f0-9914-4543-853b-72381b4999da';
 first_job bigint;first_lease uuid;second_job bigint;second_lease uuid;
 result jsonb;before_page jsonb;actor_meta jsonb;source_value text;capacity_id uuid;
 before_email_count bigint;before_access_count bigint;before_push_count bigint;
begin
 perform pg_temp.assert_profile(
  (select enabled=false from public.demo_world_profile_control where id=1)
  and (select count(*)=0 from public.demo_world_profile_target)
  and not has_table_privilege('anon','public.demo_world_profile_target','SELECT')
  and not has_table_privilege('authenticated','public.demo_world_profile_jobs','INSERT')
  and not has_table_privilege('service_role','public.demo_world_profile_target','INSERT')
  and not has_function_privilege('anon','public.demo_world_claim_profile(uuid)','EXECUTE')
  and not has_function_privilege('authenticated','public.demo_world_execute_profile(bigint,uuid)','EXECUTE')
  and has_function_privilege('service_role','public.demo_world_claim_profile(uuid)','EXECUTE'),
  'PROFILE_INSTALL_NOT_INERT');
 select id into strict actor_id from auth.users
 where raw_app_meta_data->>'fixture_source'='loadgistic'
  and raw_user_meta_data->>'fixture_key'='user-public-fleet-01';
 select id into strict foreign_actor from auth.users
 where raw_app_meta_data->>'fixture_source'='loadgistic'
  and raw_user_meta_data->>'fixture_key'='user-public-owner-02';
 before_page:=(select to_jsonb(page) from public.company_pages page where page.id=page_id);
 actor_meta:=(select raw_app_meta_data from auth.users where id=actor_id);
 perform pg_temp.assert_profile(before_page->>'headline'='Vehicle space across Addis Ababa'
  and before_page->>'about'='Around Addis Ababa, Sheger Freight Network works with pickups, vans and box-body vehicles. Open a vehicle to see its latest space and working area.'
  and before_page->>'published'='true','PROFILE_FIXTURE_BASELINE_DRIFT');
 perform pg_temp.assert_profile((select manifest_version=2 from public.demo_world_profile_control where id=1)
  and (select count(*)=0 from public.demo_world_profile_jobs where copy_version<>2),
  'PROFILE_COPY_VERSION_DRIFT');
 select id,location_source into capacity_id,source_value from public.capacities
 where vehicle_id='2f22cc5a-d654-4405-98b7-9a1a9cf42fe3'::uuid
 order by updated_at desc,id desc limit 1;
 select count(*) into before_email_count from public.email_deliveries;
 select count(*) into before_access_count from public.access_email_deliveries;
 select count(*) into before_push_count from public.native_push_outbox;
 perform pg_temp.assert_profile((select count(*)=0 from public.demo_world_claim_profile(gen_random_uuid())),
  'PROFILE_DISABLED_CLAIMED');
 perform pg_temp.expect_profile_denial(format(
  'insert into public.demo_world_profile_target values(1,%L,%L,%L)',
  foreign_actor,'c36022ff-bf3e-432d-ae96-93d1537cf79e',page_id),
  'DEMO_PROFILE_TARGET_REFUSED');
 insert into public.demo_world_profile_target values
  (1,actor_id,'c36022ff-bf3e-432d-ae96-93d1537cf79e',page_id);
 perform pg_temp.expect_profile_denial(
  'delete from public.demo_world_profile_target where id=1','DEMO_PROFILE_TARGET_IMMUTABLE');
 perform public.accept_content_policy(actor_id,'2026-10-09');
 update public.demo_world_profile_control set enabled=true,
  activated_at=(date_trunc('day',clock_timestamp() at time zone 'UTC')
   -interval '1 day'+interval '8 hours 59 minutes') at time zone 'UTC' where id=1;
 update public.demo_world_control set enabled=false where id=1;
 perform pg_temp.assert_profile((select count(*)=0 from public.demo_world_claim_profile(gen_random_uuid())),
  'PROFILE_GLOBAL_OFF_CLAIMED');
 perform pg_temp.assert_profile(public.demo_world_profile_status()->>'enabled'='false',
  'PROFILE_GLOBAL_OFF_STATUS_DRIFT');
 update public.demo_world_control set enabled=true,
  activated_at=coalesce(activated_at,clock_timestamp()) where id=1;
 select job_id,lease_token into first_job,first_lease
 from public.demo_world_claim_profile(gen_random_uuid());
 perform pg_temp.assert_profile(first_job is not null and
  (select phase='SHOW_DEMO' and copy_version=2 from public.demo_world_profile_jobs where id=first_job),
  'PROFILE_SHOW_NOT_CLAIMED');
 perform pg_temp.expect_profile_denial(format(
  'select public.demo_world_execute_profile(%s,%L)',first_job,gen_random_uuid()),
  'DEMO_PROFILE_LEASE_REFUSED');
 update public.demo_world_control set enabled=false where id=1;
 perform pg_temp.expect_profile_denial(format(
  'select public.demo_world_execute_profile(%s,%L)',first_job,first_lease),
  'DEMO_PROFILE_LEASE_REFUSED');
 update public.demo_world_control set enabled=true where id=1;
 update auth.users set raw_app_meta_data='{}'::jsonb where id=actor_id;
 perform pg_temp.expect_profile_denial(format(
  'select public.demo_world_execute_profile(%s,%L)',first_job,first_lease),
  'DEMO_PROFILE_ACTOR_REFUSED');
 update auth.users set raw_app_meta_data=actor_meta where id=actor_id;
 update public.company_pages set about='Drifted synthetic page' where id=page_id;
 perform pg_temp.expect_profile_denial(format(
  'select public.demo_world_execute_profile(%s,%L)',first_job,first_lease),
  'DEMO_PROFILE_STATE_CHANGED');
 perform pg_temp.assert_profile((select count(*)=0 from public.demo_world_profile_receipts),
  'DENIED_PROFILE_PHASE_MUTATED');
 update public.company_pages set about=before_page->>'about' where id=page_id;
 result:=public.demo_world_execute_profile(first_job,first_lease);
 perform pg_temp.assert_profile(result->>'result'='APPLIED' and result->>'phase'='SHOW_DEMO'
  and (public.public_provider_page_details('c36022ff-bf3e-432d-ae96-93d1537cf79e'::uuid,null)->>'headline')='Road freight across our active routes'
  and (public.public_provider_page_details('c36022ff-bf3e-432d-ae96-93d1537cf79e'::uuid,null)->>'about')='Our fleet shares current vehicle capacity so brokers and cargo teams can find a suitable match and contact us directly.',
  'PROFILE_SHOW_READBACK_FAILED');
 result:=public.demo_world_execute_profile(first_job,first_lease);
 perform pg_temp.assert_profile(result->>'result'='REPLAYED'
  and (select count(*)=1 from public.demo_world_profile_receipts),
  'PROFILE_SHOW_REPLAY_WRITTEN');
 select job_id,lease_token into second_job,second_lease
 from public.demo_world_claim_profile(gen_random_uuid());
 perform pg_temp.assert_profile(second_job is not null and
  (select phase='RESTORE' from public.demo_world_profile_jobs where id=second_job),
  'PROFILE_RESTORE_NOT_CLAIMED');
 result:=public.demo_world_execute_profile(second_job,second_lease);
 perform pg_temp.assert_profile(result->>'result'='APPLIED' and result->>'phase'='RESTORE'
  and (select count(*)=2 from public.demo_world_profile_receipts)
  and (select headline=before_page->>'headline' and about=before_page->>'about'
   from public.company_pages where id=page_id),
  'PROFILE_RESTORE_FAILED');
 perform pg_temp.assert_profile(
  (select to_jsonb(page)-'updated_at' from public.company_pages page where page.id=page_id)
   =before_page-'updated_at'
  and (select count(*)=before_email_count from public.email_deliveries)
  and (select count(*)=before_access_count from public.access_email_deliveries)
  and (select count(*)=before_push_count from public.native_push_outbox)
  and (select id=capacity_id and location_source=source_value from public.capacities
   where vehicle_id='2f22cc5a-d654-4405-98b7-9a1a9cf42fe3'::uuid
   order by updated_at desc,id desc limit 1),
  'PROFILE_ISOLATION_FAILED');
 result:=public.demo_world_execute_profile(second_job,second_lease);
 perform pg_temp.assert_profile(result->>'result'='REPLAYED','PROFILE_RESTORE_REPLAY_FAILED');
 update public.demo_world_profile_control set enabled=false where id=1;
 perform pg_temp.assert_profile((select count(*)=0 from public.demo_world_claim_profile(gen_random_uuid()))
  and (select count(*)=2 from public.demo_world_profile_receipts),'PROFILE_STOP_FAILED');
end $scenario$;
rollback;
