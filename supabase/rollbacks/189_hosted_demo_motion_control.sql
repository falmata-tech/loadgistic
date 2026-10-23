-- FEAT-SIM-001. Apply only after stopping the hosted worker, setting the
-- application kill switch, and disabling the database control. Never use this
-- to bypass a stuck hosted lease or to revive a real-device takeover.
begin;
select pg_advisory_xact_lock(8030189);
set local lock_timeout='5s';
set local statement_timeout='30s';

do $rollback$
declare definition text;
begin
 if not exists(select 1 from public.demo_hosted_motion_control
  where id=1 and not enabled and kill_switch)
  or exists(select 1 from public.demo_motion_targets where hosted and state='RUNNING')
  then raise exception 'DEMO_HOSTED_ROLLBACK_NOT_DISABLED';end if;
 if md5(pg_get_functiondef('public.demo_motion_lease(uuid,uuid,bigint,text)'::regprocedure))
   <>'a31a441128e3ec0a063ff89b65416520'
  or md5(pg_get_functiondef('public.demo_motion_lease_pre_hosted189(uuid,uuid,bigint,text)'::regprocedure))
   <>'410b2506acff5855721b7d44f29b0dcb'
  then raise exception 'DEMO_HOSTED_ROLLBACK_DRIFT';end if;
 definition:=pg_get_functiondef('public.demo_motion_lease_pre_hosted189(uuid,uuid,bigint,text)'::regprocedure);
 execute replace(definition,'FUNCTION public.demo_motion_lease_pre_hosted189(','FUNCTION public.demo_motion_lease(');
end $rollback$;

drop function public.hosted_demo_motion_command(uuid,uuid,jsonb);
drop function public.demo_motion_lease_pre_hosted189(uuid,uuid,bigint,text);
drop table public.demo_hosted_motion_control;
drop function public.demo_hosted_motion_revoke_leases();
alter table public.demo_motion_targets drop column hosted;
notify pgrst,'reload schema';
commit;
