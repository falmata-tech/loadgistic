-- FEAT-SIM-001. Rollback-only v1-history -> v2 cycle on a disposable restore.
-- Requires two real v1 DONE receipts, an exact normal-command copy save, and 197.
begin;
set local statement_timeout='90s';
create function pg_temp.assert_profile_v2(ok boolean,label text) returns void
language plpgsql as $$begin if ok is not true then raise exception '%',label;end if;end$$;
create function pg_temp.expect_profile_v2_denial(statement text,code text) returns void
language plpgsql as $$
begin
 begin execute statement;
 exception when others then
  if position(code in sqlerrm)>0 then return;end if;
  raise;
 end;
 raise exception 'EXPECTED_PROFILE_V2_DENIAL:%',code;
end $$;
do $scenario$
declare original_page jsonb;original_receipts jsonb;actor uuid;
 first_id bigint;first_token uuid;second_id bigint;second_token uuid;
 next_day date;show_id bigint;show_token uuid;restore_id bigint;restore_token uuid;
 before_email bigint;before_access bigint;before_push bigint;result jsonb;
begin
 perform pg_temp.assert_profile_v2(
  (select manifest_version=2 and not enabled from public.demo_world_profile_control where id=1)
  and (select not enabled from public.demo_world_control where id=1)
  and (select count(*)=2 from public.demo_world_profile_jobs where state='DONE' and copy_version=1)
  and (select count(*)=2 from public.demo_world_profile_receipts)
  and (select count(*)=1 from public.demo_world_profile_target),
  'PROFILE_V1_HISTORY_MISSING');
 select actor_id into strict actor from public.demo_world_profile_target where id=1;
 select id,lease_token into strict first_id,first_token
 from public.demo_world_profile_jobs where phase='SHOW_DEMO' and copy_version=1;
 select id,lease_token,simulation_day+1 into strict second_id,second_token,next_day
 from public.demo_world_profile_jobs where phase='RESTORE' and copy_version=1;
 original_page:=(select to_jsonb(page) from public.company_pages page
  where page.id='06b2d2f0-9914-4543-853b-72381b4999da'::uuid);
 original_receipts:=(select jsonb_agg(to_jsonb(r) order by r.job_id)
  from public.demo_world_profile_receipts r);
 select count(*) into before_email from public.email_deliveries;
 select count(*) into before_access from public.access_email_deliveries;
 select count(*) into before_push from public.native_push_outbox;
 perform pg_temp.assert_profile_v2(original_page->>'headline'='Vehicle space across Addis Ababa'
  and original_page->>'about'='Around Addis Ababa, Sheger Freight Network works with pickups, vans and box-body vehicles. Open a vehicle to see its latest space and working area.',
  'PROFILE_V2_BASELINE_MISSING');
 result:=public.demo_world_execute_profile(first_id,first_token);
 perform pg_temp.assert_profile_v2(result->>'result'='REPLAYED','PROFILE_V1_SHOW_REPLAY_FAILED');
 result:=public.demo_world_execute_profile(second_id,second_token);
 perform pg_temp.assert_profile_v2(result->>'result'='REPLAYED','PROFILE_V1_RESTORE_REPLAY_FAILED');
 perform pg_temp.expect_profile_v2_denial(format(
  'update public.demo_world_profile_receipts set before_hash=%L where job_id=%s',
  md5('tamper'),first_id),'IMMUTABLE');
 perform pg_temp.assert_profile_v2((select count(*)=0 from public.demo_world_claim_profile(gen_random_uuid())),
  'PROFILE_V2_DISABLED_CLAIMED');
 insert into public.demo_world_profile_jobs(simulation_day,phase,scheduled_at)
 values(next_day,'SHOW_DEMO',clock_timestamp()-interval '2 minutes') returning id into show_id;
 insert into public.demo_world_profile_jobs(simulation_day,phase,scheduled_at)
 values(next_day,'RESTORE',clock_timestamp()-interval '1 minute') returning id into restore_id;
 perform pg_temp.assert_profile_v2((select count(*)=2 from public.demo_world_profile_jobs
   where simulation_day=next_day and copy_version=2),'PROFILE_V2_DEFAULT_DRIFT');
 update public.demo_world_profile_control set enabled=true,
  activated_at=coalesce(activated_at,clock_timestamp()-interval '3 minutes'),
  last_dispatch_at=clock_timestamp() where id=1;
 update public.demo_world_control set enabled=true,
  activated_at=coalesce(activated_at,clock_timestamp()) where id=1;
 select job_id,lease_token into strict show_id,show_token
 from public.demo_world_claim_profile(gen_random_uuid());
 perform pg_temp.assert_profile_v2(
  (select phase='SHOW_DEMO' and copy_version=2 from public.demo_world_profile_jobs where id=show_id),
  'PROFILE_V2_SHOW_NOT_CLAIMED');
 perform pg_temp.expect_profile_v2_denial(format(
  'select public.demo_world_execute_profile(%s,%L)',show_id,gen_random_uuid()),
  'DEMO_PROFILE_LEASE_REFUSED');
 update public.demo_world_control set enabled=false where id=1;
 perform pg_temp.expect_profile_v2_denial(format(
  'select public.demo_world_execute_profile(%s,%L)',show_id,show_token),
  'DEMO_PROFILE_LEASE_REFUSED');
 update public.demo_world_control set enabled=true where id=1;
 result:=public.demo_world_execute_profile(show_id,show_token);
 perform pg_temp.assert_profile_v2(result->>'result'='APPLIED'
  and (public.public_provider_page_details('c36022ff-bf3e-432d-ae96-93d1537cf79e'::uuid,null)->>'headline')='Road freight across our active routes',
  'PROFILE_V2_SHOW_FAILED');
 select job_id,lease_token into strict restore_id,restore_token
 from public.demo_world_claim_profile(gen_random_uuid());
 result:=public.demo_world_execute_profile(restore_id,restore_token);
 perform pg_temp.assert_profile_v2(result->>'result'='APPLIED'
  and (select count(*)=4 from public.demo_world_profile_receipts)
  and (select jsonb_agg(to_jsonb(r) order by r.job_id) from public.demo_world_profile_receipts r
   where r.job_id in(first_id,second_id))=original_receipts
  and (select to_jsonb(page)-'updated_at' = original_page-'updated_at'
   from public.company_pages page where page.id='06b2d2f0-9914-4543-853b-72381b4999da'::uuid)
  and (select count(*)=before_email from public.email_deliveries)
  and (select count(*)=before_access from public.access_email_deliveries)
  and (select count(*)=before_push from public.native_push_outbox),
  'PROFILE_V2_RESTORE_OR_ISOLATION_FAILED');
 result:=public.demo_world_execute_profile(restore_id,restore_token);
 perform pg_temp.assert_profile_v2(result->>'result'='REPLAYED','PROFILE_V2_RESTORE_REPLAY_FAILED');
 update public.demo_world_profile_control set enabled=false where id=1;
 update public.demo_world_control set enabled=false where id=1;
end $scenario$;
rollback;
