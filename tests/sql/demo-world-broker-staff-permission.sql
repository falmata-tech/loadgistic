-- FEAT-SIM-001. Rollback-only exact synthetic broker STAFF permission cycle.
begin;
set local statement_timeout='90s';
create function pg_temp.assert_team(ok boolean,label text) returns void
language plpgsql as $$begin if ok is not true then raise exception '%',label;end if;end$$;
create function pg_temp.expect_team_denial(statement text,code text) returns void
language plpgsql as $$
begin
 begin execute statement;
 exception when others then
  if position(code in sqlerrm)>0 then return;end if;
  raise;
 end;
 raise exception 'EXPECTED_DEMO_TEAM_DENIAL:%',code;
end $$;

do $scenario$
#variable_conflict use_variable
declare scenario_workspace uuid:='1da45f19-a9fa-4c55-b08e-7c3b65b1aa7d';
 owner_id uuid;staff_id uuid;invite_id uuid;created_staff boolean:=false;
 first_job bigint;first_lease uuid;second_job bigint;second_lease uuid;
 result jsonb;old_app jsonb;before_emails bigint;before_access bigint;
 before_push bigint;before_grants bigint;baseline_version bigint;
begin
 perform pg_temp.assert_team(
  (select enabled=false from public.demo_world_team_control where id=1)
  and (select count(*)=0 from public.demo_world_team_target)
  and not has_table_privilege('anon','public.demo_world_team_target','SELECT')
  and not has_table_privilege('authenticated','public.demo_world_team_jobs','INSERT')
  and not has_table_privilege('service_role','public.demo_world_team_target','INSERT')
  and not has_function_privilege('anon','public.demo_world_claim_team(uuid)','EXECUTE')
  and not has_function_privilege('authenticated','public.demo_world_execute_team(bigint,uuid)','EXECUTE')
  and has_function_privilege('service_role','public.demo_world_claim_team(uuid)','EXECUTE'),
  'TEAM_INSTALL_NOT_INERT');
 select u.id into owner_id from auth.users u
 join public.business_workspace_members m on m.user_id=u.id
 where m.workspace_id=scenario_workspace and m.role='OWNER' and m.active
  and u.raw_app_meta_data->>'fixture_source'='loadgistic'
  and u.raw_user_meta_data->>'fixture_key'='user-sim-broker'
  and lower(u.email)='broker-scenario@loadgistic.local';
 if owner_id is null then
  perform pg_temp.assert_team(not exists(select 1 from public.business_workspaces
   where id=scenario_workspace),'TEAM_WORKSPACE_ID_OCCUPIED');
  owner_id:=gen_random_uuid();
  insert into auth.users(id,email,email_confirmed_at,raw_app_meta_data,raw_user_meta_data)
  values(owner_id,'broker-scenario@loadgistic.local',now(),
   '{"fixture_source":"loadgistic"}'::jsonb,
   '{"fixture_key":"user-sim-broker"}'::jsonb);
  update public.profiles set role='SHIPPER',active=true where id=owner_id;
  insert into public.business_workspaces(id,name,handle,kind)
  values(scenario_workspace,'Synthetic broker staff test','scenario-broker-196-ci','BROKER');
  insert into public.business_workspace_members(workspace_id,user_id,role,
   can_view_capacity,can_view_tracking)
  values(scenario_workspace,owner_id,'OWNER',true,true);
 end if;
 perform pg_temp.assert_team((select count(*) between 1 and 2 from public.business_workspace_members
  where workspace_id=scenario_workspace and active),'TEAM_BROKER_BASELINE_DRIFT');
 select version into baseline_version from public.business_workspaces where id=scenario_workspace;
 select count(*) into before_emails from public.email_deliveries;
 select count(*) into before_access from public.access_email_deliveries;
 select count(*) into before_push from public.native_push_outbox;
 select count(*) into before_grants from public.business_capacity_grants where workspace_id=scenario_workspace;
 select id into staff_id from auth.users where lower(email)='demo-broker-staff-196@loadgistic.local'
  and raw_app_meta_data->>'fixture_source'='loadgistic'
  and raw_user_meta_data->>'fixture_key'='user-sim-broker-staff' and deleted_at is null;
 if staff_id is null then
  created_staff:=true;
  staff_id:=gen_random_uuid();
  insert into auth.users(id,email,email_confirmed_at,raw_app_meta_data,raw_user_meta_data)
  values(staff_id,'demo-broker-staff-196@loadgistic.local',now(),
   '{"fixture_source":"loadgistic"}'::jsonb,
   '{"fixture_key":"user-sim-broker-staff"}'::jsonb);
  invite_id:=(public.business_workspace_command(owner_id,scenario_workspace,jsonb_build_object(
   'action','INVITE','expectedVersion',baseline_version,
   'email','demo-broker-staff-196@loadgistic.local','role','STAFF',
   'capacity',true,'tracking',true))->>'invitationId')::uuid;
  result:=public.business_workspace_accept_invitation(staff_id,invite_id);
 else
  select id into invite_id from public.business_workspace_invitations
  where workspace_id=scenario_workspace and created_by=owner_id and accepted_by=staff_id
   and email='demo-broker-staff-196@loadgistic.local' and status='ACCEPTED'
  order by accepted_at desc limit 1;
  result:=jsonb_build_object('membershipRole','STAFF');
 end if;
 perform pg_temp.assert_team(result->>'membershipRole'='STAFF'
  and public.business_workspace_permission(staff_id,scenario_workspace,'CAPACITY')
  and public.business_workspace_permission(staff_id,scenario_workspace,'TRACKING')
  and not public.business_workspace_permission(staff_id,scenario_workspace,'TEAM')
  and (select email_attempts=0 and email_sent_at is null and status='ACCEPTED'
   from public.business_workspace_invitations where id=invite_id),
  'TEAM_NORMAL_JOIN_FAILED');
 perform pg_temp.assert_team((select count(*)=0 from public.demo_world_claim_team(gen_random_uuid())),
  'TEAM_DISABLED_CLAIMED');
 old_app:=(select raw_app_meta_data from auth.users where id=staff_id);
 update auth.users set raw_app_meta_data='{}'::jsonb where id=staff_id;
 perform pg_temp.expect_team_denial(format(
  'insert into public.demo_world_team_target values(1,%L,%L,%L,%s,%s)',
  scenario_workspace,owner_id,staff_id,(select version from public.business_workspaces where id=scenario_workspace),
  (select revision from public.business_workspace_members
   where workspace_id=scenario_workspace and user_id=staff_id)),
  'DEMO_TEAM_TARGET_REFUSED');
 update auth.users set raw_app_meta_data=old_app where id=staff_id;
 insert into public.demo_world_team_target(id,workspace_id,owner_id,staff_id,bound_version,bound_revision)
 select 1,scenario_workspace,owner_id,staff_id,w.version,m.revision
 from public.business_workspaces w join public.business_workspace_members m
  on m.workspace_id=w.id and m.user_id=staff_id where w.id=scenario_workspace;
 perform pg_temp.expect_team_denial('delete from public.demo_world_team_target where id=1',
  'DEMO_TEAM_TARGET_IMMUTABLE');
 update public.demo_world_team_control set enabled=true,
  activated_at=(date_trunc('day',clock_timestamp() at time zone 'UTC')
   -interval '1 day'+interval '9 hours 59 minutes') at time zone 'UTC' where id=1;
 update public.demo_world_control set enabled=false where id=1;
 perform pg_temp.assert_team((select count(*)=0 from public.demo_world_claim_team(gen_random_uuid()))
  and public.demo_world_team_status()->>'enabled'='false','TEAM_GLOBAL_OFF_CLAIMED');
 update public.demo_world_control set enabled=true,
  activated_at=coalesce(activated_at,clock_timestamp()) where id=1;
 select job_id,lease_token into first_job,first_lease from public.demo_world_claim_team(gen_random_uuid());
 perform pg_temp.assert_team(first_job is not null and
  (select phase='CAPACITY_OFF' from public.demo_world_team_jobs where id=first_job),
  'TEAM_OFF_NOT_CLAIMED');
 perform pg_temp.expect_team_denial(format(
  'select public.demo_world_execute_team(%s,%L)',first_job,gen_random_uuid()),
  'DEMO_TEAM_LEASE_REFUSED');
 update public.demo_world_control set enabled=false where id=1;
 perform pg_temp.expect_team_denial(format(
  'select public.demo_world_execute_team(%s,%L)',first_job,first_lease),
  'DEMO_TEAM_LEASE_REFUSED');
 update public.demo_world_control set enabled=true where id=1;
 update auth.users set raw_app_meta_data='{}'::jsonb where id=staff_id;
 perform pg_temp.expect_team_denial(format(
  'select public.demo_world_execute_team(%s,%L)',first_job,first_lease),
  'DEMO_TEAM_ACTOR_REFUSED');
 update auth.users set raw_app_meta_data=old_app where id=staff_id;
 perform pg_temp.assert_team((select count(*)=0 from public.demo_world_team_receipts),
  'TEAM_DENIED_STEP_MUTATED');
 result:=public.demo_world_execute_team(first_job,first_lease);
 perform pg_temp.assert_team(result->>'result'='APPLIED'
  and result->>'phase'='CAPACITY_OFF'
  and not public.business_workspace_permission(staff_id,scenario_workspace,'CAPACITY')
  and public.business_workspace_permission(staff_id,scenario_workspace,'TRACKING')
  and public.business_workspace_permission(owner_id,scenario_workspace,'CAPACITY')
  and (select count(*)=1 from public.demo_world_team_receipts),
  'TEAM_OFF_READBACK_FAILED');
 result:=public.demo_world_execute_team(first_job,first_lease);
 perform pg_temp.assert_team(result->>'result'='REPLAYED'
  and (select count(*)=1 from public.demo_world_team_receipts),
  'TEAM_OFF_REPLAY_WRITTEN');
 select job_id,lease_token into second_job,second_lease
 from public.demo_world_claim_team(gen_random_uuid());
 perform pg_temp.assert_team(second_job is not null and
  (select phase='CAPACITY_ON' from public.demo_world_team_jobs where id=second_job),
  'TEAM_ON_NOT_CLAIMED');
 result:=public.demo_world_execute_team(second_job,second_lease);
 perform pg_temp.assert_team(result->>'result'='APPLIED'
  and result->>'phase'='CAPACITY_ON'
  and public.business_workspace_permission(staff_id,scenario_workspace,'CAPACITY')
  and public.business_workspace_permission(staff_id,scenario_workspace,'TRACKING')
  and public.business_workspace_permission(owner_id,scenario_workspace,'CAPACITY')
  and (select count(*)=2 from public.demo_world_team_receipts)
  and (select version=baseline_version+case when created_staff then 4 else 2 end
   from public.business_workspaces where id=scenario_workspace),
  'TEAM_ON_READBACK_FAILED');
 result:=public.demo_world_execute_team(second_job,second_lease);
 perform pg_temp.assert_team(result->>'result'='REPLAYED','TEAM_ON_REPLAY_FAILED');
 perform pg_temp.assert_team(
  (select count(*)=before_emails from public.email_deliveries)
  and (select count(*)=before_access from public.access_email_deliveries)
  and (select count(*)=before_push from public.native_push_outbox)
  and (select count(*)=before_grants from public.business_capacity_grants where workspace_id=scenario_workspace)
  and (select count(*)=0 from public.business_workspace_audit
   where workspace_id=scenario_workspace and subject_id=invite_id
    and action like 'INVITATION_EMAIL_%'),
  'TEAM_NOTIFICATION_OR_SHARING_DRIFT');
 update public.demo_world_team_control set enabled=false where id=1;
 perform pg_temp.assert_team((select count(*)=0 from public.demo_world_claim_team(gen_random_uuid())),
  'TEAM_STOP_FAILED');
end $scenario$;
rollback;
