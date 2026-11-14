-- FEAT-SIM-001/004. Hold historical Manual-dependent lanes at the DB boundary.
-- Preserve jobs, controls, receipts, permissions and valid historical replay.
-- A supported phone/GPS redesign requires a separately reviewed replacement.
begin;
select pg_advisory_xact_lock(8030223);
set local lock_timeout='5s';
set local statement_timeout='30s';

-- No claim may generate a job, update dispatch time, consume an attempt or lease
-- existing work while the lane is held, even if an old control remains enabled.
create or replace function public.demo_world_claim_handover(worker_id uuid)
returns table(job_id bigint,lease_token uuid)
language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
begin
 if worker_id is null or worker_id='00000000-0000-0000-0000-000000000000'::uuid
  then raise exception 'DEMO_HANDOVER_WORKER_REFUSED';end if;
 return;
end $$;
create or replace function public.demo_world_claim_duty(worker_id uuid)
returns table(job_id bigint,lease_token uuid)
language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
begin
 if worker_id is null or worker_id='00000000-0000-0000-0000-000000000000'::uuid
  then raise exception 'DEMO_DUTY_INPUT_REFUSED';end if;
 return;
end $$;

-- Keep each installed function's current actor, lease, ordering, privacy,
-- baseline and DONE receipt/replay guards, then refuse before its first write.
-- Exact one-anchor checks fail closed if an installed definition has drifted.
do $hold$
declare signature text;anchor text;expected_md5 text;definition text;patched text;
begin
 for signature,anchor,expected_md5 in select * from(values
  ('public.demo_world_execute_handover_job(bigint,uuid)',
   ' result:=public.demo_world_execute_atomic_handover();','035a3491c7b9ba63a6d71eaae8a3a1cc'),
  ('public.demo_world_execute_atomic_handover()',
   '  -- Every command below participates in this function''s single transaction.','819f5711838ce6f121f9f020382f7959'),
  ('public.demo_world_execute_duty(bigint,uuid)',
   ' source_id:=public.publish_provider_capacity(owner_id,next_command);','92d3580635ad9abb5dcde8d4c64b912c')
 ) changes(signature,anchor,expected_md5) loop
  definition:=pg_get_functiondef(signature::regprocedure);
  if md5(definition)<>expected_md5 or position('DEMO_MANUAL_LANE_HELD' in definition)>0
   or (length(definition)-length(replace(definition,anchor,'')))/length(anchor)<>1
   or not exists(select 1 from pg_proc p where p.oid=signature::regprocedure and p.prosecdef)
   or has_function_privilege('anon',signature,'EXECUTE')
   or has_function_privilege('authenticated',signature,'EXECUTE')
   then raise exception 'DEMO_MANUAL_HOLD_DEFINITION_DRIFT_%',signature;end if;
  patched:=replace(definition,anchor,
   ' raise exception ''DEMO_MANUAL_LANE_HELD''; -- No Manual-dependent simulator writes.'||E'\n'||anchor);
  execute patched;
 end loop;
end $hold$;

revoke all on function public.demo_world_claim_handover(uuid),public.demo_world_claim_duty(uuid),
 public.demo_world_execute_handover_job(bigint,uuid),public.demo_world_execute_duty(bigint,uuid)
 from public,anon,authenticated;
grant execute on function public.demo_world_claim_handover(uuid),public.demo_world_claim_duty(uuid),
 public.demo_world_execute_handover_job(bigint,uuid),public.demo_world_execute_duty(bigint,uuid)
 to service_role;
revoke all on function public.demo_world_execute_atomic_handover() from public,anon,authenticated,service_role;
commit;
