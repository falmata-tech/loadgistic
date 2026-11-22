-- Allow the exact authored example reports at simulator startup (FEAT-SIM-001).
-- Ordinary reports always have a different record ID and server-authored time.
begin;
select pg_advisory_xact_lock(8030243);
set local lock_timeout='5s';
set local statement_timeout='30s';
do $migration$
declare
  original text:=pg_get_functiondef('public.demo_world_execute_capacity_step(bigint,uuid)'::regprocedure);
  previous text:=$old$ elsif job.cycle_index<>0 or job.phase_index<>0 or current_capacity.available_percent_reported_at is not null
  then raise exception 'DEMO_WORLD_BOOTSTRAP_REFUSED';end if;$old$;
  requested text:=$new$ elsif job.cycle_index<>0 or job.phase_index<>0 or (
   current_capacity.available_percent_reported_at is not null and not exists (
    select 1 from (values
     ('independent-partial',array['0e8ebfe6-0793-437f-86fa-bd5a3694d6ae','c6daaa8f-dfe8-469d-b31c-75af9d6fc209']::uuid[],40,'2026-08-23T22:43:57.200Z'::timestamptz),
     ('fleet-01-partial',array['c2d4b824-04d4-4151-9120-a17555c7d8d2','52e0deed-30bd-4fd3-87d3-2a3b2cf34f2e']::uuid[],45,'2026-08-23T22:43:44.325Z'::timestamptz),
     ('fleet-02-partial',array['c91bf5af-c574-41f0-aaad-004ac0be6cf1','770fe695-9d11-470c-98a2-aa12bc1721c4']::uuid[],70,'2026-08-23T22:33:40.325Z'::timestamptz),
     ('fleet-04-partial',array['42a4fdff-8263-4660-a36a-a936b48a1a69','3bb76211-84bc-431c-a8d8-75eaca8e6c96']::uuid[],70,'2026-08-23T22:32:59.325Z'::timestamptz),
     ('fleet-06-partial',array['307a148e-226e-47a6-b1e8-47fe3a215467','03d3ba6c-cfd7-4cdc-bb82-10b8de5d2bf8']::uuid[],90,'2026-08-23T22:22:38.325Z'::timestamptz)
    ) seed(target_key,capacity_ids,percent,reported_at)
    where seed.target_key=job.target_key and current_capacity.id=any(seed.capacity_ids)
     and seed.percent=current_capacity.available_percent
     and seed.reported_at=current_capacity.available_percent_reported_at
     and current_capacity.available_percent_reported_by=current_capacity.updated_by
     and current_capacity.available_percent_reported_driver_id=driver_id
   ))
  then raise exception 'DEMO_WORLD_BOOTSTRAP_REFUSED';end if;$new$;
begin
  -- The local fixture and the hosted pilot have separate reviewed bindings.
  if md5(original) not in('7290b9e2629b1d3d804e5bee1d2ded47','f8752a6227767ca1f52563e729252a35')
    or (length(original)-length(replace(original,previous,'')))/length(previous)<>1
    then raise exception 'DEMO_WORLD243_BOOTSTRAP_DEFINITION_DRIFT';end if;
  execute replace(original,previous,requested);
end
$migration$;
commit;
