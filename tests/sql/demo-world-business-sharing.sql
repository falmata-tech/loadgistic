-- FEAT-SIM-002. Run against a disposable local clone with migration 190 installed.
-- Synthetic actors/workspaces are created here and every change is rolled back.
begin;
set local statement_timeout='90s';
create function pg_temp.assert_demo_share(ok boolean,label text) returns void
language plpgsql as $$begin if ok is not true then raise exception '%',label;end if;end$$;
create function pg_temp.expect_demo_share_denial(statement text,code text) returns void
language plpgsql as $$
begin
 begin execute statement;
 exception when others then
  if position(code in sqlerrm)>0 then return;end if;
  raise;
 end;
 raise exception 'EXPECTED_DEMO_SHARE_DENIAL:%',code;
end $$;

do $scenario$
#variable_conflict use_variable
declare provider_id uuid;broker_id uuid:=gen_random_uuid();real_id uuid:=gen_random_uuid();
 vehicle_id uuid:='2f22cc5a-d654-4405-98b7-9a1a9cf42fe3';
 workspace_id uuid;other_workspace_id uuid;result jsonb;
 grant_job bigint;grant_token uuid;revoke_job bigint;revoke_token uuid;
 grant_id uuid;grant_revision integer;capacity_id uuid;source_value text;status_value text;
 before_email_count integer;before_access_email_count integer;other_grant_revision_sum bigint;
begin
 select id into strict provider_id from auth.users
 where raw_app_meta_data->>'fixture_source'='loadgistic'
  and raw_user_meta_data->>'fixture_key'='user-driver';
 perform pg_temp.assert_demo_share(
  not has_table_privilege('anon','public.demo_world_business_share_target','SELECT')
  and not has_table_privilege('authenticated','public.demo_world_business_share_target','INSERT')
  and not has_table_privilege('service_role','public.demo_world_business_share_target','INSERT')
  and not has_function_privilege('anon','public.demo_world_claim_business_share(uuid)','EXECUTE')
  and not has_function_privilege('authenticated','public.demo_world_execute_business_share(bigint,uuid)','EXECUTE')
  and has_function_privilege('service_role','public.demo_world_claim_business_share(uuid)','EXECUTE'),
  'DEMO_BUSINESS_ACL_DRIFT');
 perform pg_temp.assert_demo_share((select enabled=false from public.demo_world_business_share_control where id=1)
  and (select count(*)=0 from public.demo_world_business_share_target),'SCENARIO_NOT_INERT');
 perform pg_temp.assert_demo_share((select mode='PRIVATE' from public.vehicle_capacity_sharing s where s.vehicle_id=vehicle_id),
  'PROVIDER_NOT_PRIVATE');
 select id,status::text,location_source into capacity_id,status_value,source_value
 from public.capacities c where c.vehicle_id=vehicle_id order by updated_at desc,id desc limit 1;
 perform pg_temp.assert_demo_share(status_value in('EMPTY','PARTIAL'),'CAPACITY_MISSING');
 select count(*) into before_email_count from public.email_deliveries;
 select count(*) into before_access_email_count from public.access_email_deliveries;
 select coalesce(sum(revision),0) into other_grant_revision_sum
 from public.business_capacity_grants g where g.vehicle_id<>vehicle_id;

 insert into auth.users(id,email,email_confirmed_at,raw_app_meta_data,raw_user_meta_data)
 values(broker_id,'broker-scenario@loadgistic.local',clock_timestamp(),
  '{"fixture_source":"loadgistic"}'::jsonb,'{"fixture_key":"user-sim-broker"}'::jsonb),
 (real_id,'real-marker-absent@example.test',clock_timestamp(),'{}'::jsonb,'{}'::jsonb);
 update public.profiles set role='SHIPPER',active=true where id in(broker_id,real_id);
 workspace_id:=(public.business_workspace_create(broker_id,jsonb_build_object(
  'name','Scenario broker','handle','scenario-broker-190','kind','BROKER'))->>'id')::uuid;
 other_workspace_id:=(public.business_workspace_create(broker_id,jsonb_build_object(
  'name','Unrelated broker','handle','other-broker-190','kind','BROKER'))->>'id')::uuid;
 perform pg_temp.assert_demo_share(public.business_workspace_permission(broker_id,workspace_id,'CAPACITY'),
  'BROKER_PERMISSION_MISSING');

 insert into public.business_workspace_members(workspace_id,user_id,role,can_view_capacity)
 values(workspace_id,real_id,'STAFF',true);
 perform pg_temp.expect_demo_share_denial(format(
  'insert into public.demo_world_business_share_target values(1,%L,%L,%L,%L)',
  vehicle_id,workspace_id,'user-driver','user-sim-broker'),
  'DEMO_BUSINESS_TARGET_REFUSED');
 delete from public.business_workspace_members m where m.workspace_id=workspace_id and m.user_id=real_id;
 insert into public.demo_world_business_share_target
 values(1,vehicle_id,workspace_id,'user-driver','user-sim-broker');
 perform pg_temp.expect_demo_share_denial(format(
  'insert into public.business_workspace_members(workspace_id,user_id,role,can_view_capacity) values(%L,%L,%L,true)',
  workspace_id,real_id,'STAFF'),'DEMO_BUSINESS_REAL_MEMBER_REFUSED');
 perform pg_temp.expect_demo_share_denial(format(
  'update public.demo_world_business_share_target set workspace_id=%L where id=1',other_workspace_id),
  'DEMO_BUSINESS_TARGET_IMMUTABLE');
 perform pg_temp.assert_demo_share((select count(*)=0 from public.business_capacity_filtered_page(broker_id,workspace_id)
  feed where feed.payload->>'vehicle_id'=vehicle_id::text),'UNSHARED_CAPACITY_VISIBLE');

 update public.demo_world_business_share_control
 set enabled=true,activated_at=(date_trunc('day',clock_timestamp() at time zone 'UTC')
  -interval '1 day'+interval '8 hours 59 minutes') at time zone 'UTC' where id=1;
 select job_id,lease_token into grant_job,grant_token
 from public.demo_world_claim_business_share(gen_random_uuid());
 perform pg_temp.assert_demo_share(grant_job is not null and (select phase='GRANT'
  from public.demo_world_business_share_jobs where id=grant_job),'GRANT_NOT_CLAIMED');
 perform pg_temp.expect_demo_share_denial(format(
  'select public.demo_world_execute_business_share(%s,%L)',grant_job,gen_random_uuid()),
  'DEMO_BUSINESS_LEASE_REFUSED');
 update public.vehicle_capacity_sharing s set mode='PUBLIC' where s.vehicle_id=vehicle_id;
 perform pg_temp.expect_demo_share_denial(format(
  'select public.demo_world_execute_business_share(%s,%L)',grant_job,grant_token),
  'DEMO_BUSINESS_STATE_CHANGED');
 perform pg_temp.assert_demo_share((select count(*)=0 from public.demo_world_business_share_receipts)
  and (select count(*)=0 from public.business_capacity_grants g
   where g.vehicle_id=vehicle_id and g.workspace_id=workspace_id),
  'DENIED_GRANT_MUTATED');
 update public.vehicle_capacity_sharing s set mode='PRIVATE' where s.vehicle_id=vehicle_id;
 result:=public.demo_world_execute_business_share(grant_job,grant_token);
 perform pg_temp.assert_demo_share(result->>'result'='APPLIED' and result->>'phase'='GRANT',
  'GRANT_NOT_APPLIED');
 select r.grant_id,r.grant_revision into grant_id,grant_revision
 from public.demo_world_business_share_receipts r where r.job_id=grant_job;
 perform pg_temp.assert_demo_share(grant_id is not null and grant_revision=1,
  'GRANT_RECEIPT_MISSING');
 perform pg_temp.assert_demo_share((select count(*)=1 from public.business_capacity_filtered_page(broker_id,workspace_id)
  feed where feed.payload->>'vehicle_id'=vehicle_id::text),'BROKER_CAPACITY_NOT_VISIBLE');
 perform pg_temp.assert_demo_share((select count(*)=0 from public.business_capacity_filtered_page(broker_id,other_workspace_id)
  feed where feed.payload->>'vehicle_id'=vehicle_id::text),'OTHER_WORKSPACE_INHERITED_GRANT');
 perform pg_temp.expect_demo_share_denial(format(
  'insert into public.business_workspace_members(workspace_id,user_id,role,can_view_capacity) values(%L,%L,%L,true)',
  workspace_id,real_id,'STAFF'),'DEMO_BUSINESS_REAL_MEMBER_REFUSED');
 perform pg_temp.assert_demo_share((select mode='PRIVATE' from public.vehicle_capacity_sharing s where s.vehicle_id=vehicle_id)
  and (select id=capacity_id and status::text=status_value and location_source=source_value
   from public.capacities c where c.vehicle_id=vehicle_id order by updated_at desc,id desc limit 1),
  'CAPACITY_CHANGED_BY_GRANT');
 perform pg_temp.assert_demo_share((public.demo_world_execute_business_share(grant_job,grant_token)->>'result')='REPLAYED'
  and (select count(*)=1 from public.business_capacity_grants where id=grant_id and revoked_at is null),
  'GRANT_REPLAY_MUTATED');
 perform pg_temp.expect_demo_share_denial(format(
  'select public.grant_business_capacity_access(%L,%L,%L)',real_id,vehicle_id,workspace_id),
  'BUSINESS_FORBIDDEN');

 select job_id,lease_token into revoke_job,revoke_token
 from public.demo_world_claim_business_share(gen_random_uuid());
 perform pg_temp.assert_demo_share(revoke_job is not null and (select phase='REVOKE'
  from public.demo_world_business_share_jobs where id=revoke_job),'REVOKE_NOT_CLAIMED');
 update public.business_workspaces w set active=false where w.id=workspace_id;
 result:=public.demo_world_execute_business_share(revoke_job,revoke_token);
 perform pg_temp.assert_demo_share(result->>'result'='APPLIED' and result->>'phase'='REVOKE',
  'REVOKE_NOT_APPLIED');
 update public.business_workspaces w set active=true where w.id=workspace_id;
 perform pg_temp.assert_demo_share((select revoked_at is not null and revision=grant_revision+1
  from public.business_capacity_grants where id=grant_id),'GRANT_NOT_REVOKED');
 perform pg_temp.assert_demo_share((select count(*)=0 from public.business_capacity_filtered_page(broker_id,workspace_id)
  feed where feed.payload->>'vehicle_id'=vehicle_id::text),'REVOKED_CAPACITY_VISIBLE');
 perform pg_temp.assert_demo_share((public.demo_world_execute_business_share(revoke_job,revoke_token)->>'result')='REPLAYED'
  and (public.demo_world_execute_business_share(grant_job,grant_token)->>'result')='REPLAYED',
  'REPLAY_AFTER_REVOKE_FAILED');
 perform pg_temp.assert_demo_share((select count(*)=before_email_count from public.email_deliveries)
  and (select count(*)=before_access_email_count from public.access_email_deliveries),
  'DEMO_SHARE_QUEUED_EXTERNAL_EMAIL');
 perform pg_temp.assert_demo_share((select coalesce(sum(revision),0)=other_grant_revision_sum
   from public.business_capacity_grants g where g.vehicle_id<>vehicle_id),
   'UNRELATED_GRANT_CHANGED');
 raise notice 'PASS: exact demo broker grant/revoke, private feed isolation, real-member denial, ordinary command, atomic receipts, replay and no outbound email';
end $scenario$;
rollback;
