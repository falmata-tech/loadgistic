-- FEAT-SIM-001. Run inside a disposable database; every fixture write rolls back.
begin;
set local statement_timeout='20s';
create function pg_temp.expect_denied(statement text,expected text) returns void
 language plpgsql as $$
begin
 begin execute statement;raise exception 'EXPECTED_DENIAL_MISSING';
 exception when others then
  if sqlerrm<>expected then raise exception 'UNEXPECTED_DENIAL %',sqlerrm;end if;
 end;
end $$;

do $test$
declare target uuid:='caf1d0db-4d8e-4ce9-a879-6c7b6017de3a';
 other uuid:='2f22cc5a-d654-4405-98b7-9a1a9cf42fe3';
 lease jsonb;before_epoch bigint;before_reports bigint;later jsonb;first_nonce uuid:=gen_random_uuid();
begin
 if (select enabled or not kill_switch from public.demo_hosted_motion_control where id=1)
  then raise exception 'HOSTED_DEFAULT_NOT_OFF';end if;
 if has_function_privilege('anon','public.hosted_demo_motion_command(uuid,uuid,jsonb)','EXECUTE')
  or has_function_privilege('authenticated','public.hosted_demo_motion_command(uuid,uuid,jsonb)','EXECUTE')
  or has_table_privilege('service_role','public.demo_hosted_motion_control','UPDATE')
  then raise exception 'HOSTED_PERMISSION_LEAK';end if;
 perform pg_temp.expect_denied(format('select public.hosted_demo_motion_command(%L,%L,%L::jsonb)',
  gen_random_uuid(),target,'{"action":"STATUS","target":"company-truck"}'),'DEMO_HOSTED_DISABLED');
 update public.demo_hosted_motion_control set enabled=true,kill_switch=false,activated_at=clock_timestamp() where id=1;
 perform pg_temp.expect_denied(format('select public.hosted_demo_motion_command(%L,%L,%L::jsonb)',
  gen_random_uuid(),other,'{"action":"STATUS","target":"company-truck"}'),'DEMO_HOSTED_INPUT_DENIED');
 perform pg_temp.expect_denied(format('select public.hosted_demo_motion_command(%L,%L,%L::jsonb)',
  gen_random_uuid(),target,'{"action":"RESUME","target":"company-truck","seconds":60}'),'DEMO_HOSTED_INPUT_DENIED');
 perform pg_temp.expect_denied(format('select public.hosted_demo_motion_command(%L,%L,%L::jsonb)',
  gen_random_uuid(),target,'{"action":"STATUS","target":"company-truck","extra":true}'),'DEMO_HOSTED_INPUT_DENIED');
 perform pg_temp.expect_denied(format('select public.hosted_demo_motion_command(%L,%L,%L::jsonb)',
  gen_random_uuid(),target,'{"action":"STOP","target":"company-truck","epoch":1,"extra":true}'),'DEMO_HOSTED_INPUT_DENIED');
 perform public.hosted_demo_motion_command(first_nonce,target,'{"action":"STATUS","target":"company-truck"}');
 perform pg_temp.expect_denied(format('select public.hosted_demo_motion_command(%L,%L,%L::jsonb)',
  first_nonce,target,'{"action":"STATUS","target":"company-truck"}'),'DEMO_REQUEST_DENIED');

 perform public.hosted_demo_motion_command(gen_random_uuid(),target,'{"action":"CONFIGURE","target":"company-truck"}');
 lease:=public.hosted_demo_motion_command(gen_random_uuid(),target,'{"action":"START","target":"company-truck","seconds":60}');
 if lease->>'state'<>'RUNNING' or not exists(select 1 from public.demo_motion_targets
   where vehicle_id=target and hosted and state='RUNNING' and lease_id=(lease->>'leaseId')::uuid)
  then raise exception 'HOSTED_START_NOT_BOUND';end if;
 select epoch into before_epoch from public.demo_motion_targets where vehicle_id=target;
 select count(*) into before_reports from public.demo_motion_gps_reports where vehicle_id=target;
 update public.demo_hosted_motion_control set kill_switch=true,changed_at=clock_timestamp() where id=1;
 if not exists(select 1 from public.demo_motion_targets where vehicle_id=target and hosted and state='OFF'
  and lease_id is null and epoch=before_epoch+1) then raise exception 'HOSTED_KILL_DID_NOT_REVOKE';end if;
 perform pg_temp.expect_denied(format('select public.hosted_demo_motion_command(%L,%L,%L::jsonb)',
  gen_random_uuid(),target,'{"action":"START","target":"company-truck","seconds":60}'),'DEMO_HOSTED_DISABLED');
 perform pg_temp.expect_denied(format('select public.demo_motion_lease(%L,%L,%s,%L)',
  target,lease->>'leaseId',before_epoch,'GPS'),'DEMO_HOSTED_DISABLED');
 if (select count(*) from public.demo_motion_gps_reports where vehicle_id=target)<>before_reports
  then raise exception 'HOSTED_KILL_CHANGED_REPORTS';end if;

 update public.demo_hosted_motion_control set kill_switch=false,changed_at=clock_timestamp() where id=1;
 perform public.pause_demo_motion(target,'REAL_INSTALLATION');
 perform pg_temp.expect_denied(format('select public.hosted_demo_motion_command(%L,%L,%L::jsonb)',
  gen_random_uuid(),target,'{"action":"START","target":"company-truck","seconds":60}'),'DEMO_REAL_DEVICE_TAKEOVER');
 if not exists(select 1 from public.demo_motion_targets where vehicle_id=target and state='REAL')
  then raise exception 'HOSTED_REAL_TAKEOVER_NOT_STICKY';end if;
end $test$;
rollback;
