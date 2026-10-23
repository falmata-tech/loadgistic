-- FEAT-SHR-001 / FEAT-FLT-001 / NR-60: an employed driver may control
-- capacity only within the current employer/vehicle/permission scope.
begin;
select pg_advisory_xact_lock(8030180);
set local lock_timeout='5s';
set local statement_timeout='30s';
do $repair$
declare definition text;old_text text;new_text text;
begin
 if to_regprocedure('public.private_capacity_actor_controls_vehicle_pre180(uuid,uuid)') is not null
  then raise exception 'PERSONAL_FLEET_SHARING_BACKUP_EXISTS';end if;
 if to_regprocedure('public.fleet_driver_matches_scope(uuid,uuid,uuid)') is null
  then raise exception 'PERSONAL_FLEET_SCOPE_PREREQUISITE_REQUIRED';end if;
 definition:=pg_get_functiondef('public.private_capacity_actor_controls_vehicle(uuid,uuid)'::regprocedure);
 old_text:=$old$or actor.role::text='DRIVER' and vehicle.organization_id is not null
        and coalesce$old$;
 new_text:=$new$or actor.role::text='DRIVER'
        and public.fleet_driver_matches_scope(actor.id,vehicle.organization_id,vehicle.provider_profile_id)
        and coalesce$new$;
 if (length(definition)-length(replace(definition,old_text,'')))/length(old_text)<>1
  or strpos(definition,'assignment.driver_user_id=actor.id and assignment.vehicle_id=vehicle.id and assignment.active')=0
  or strpos(definition,'permission.can_manage_capacity')=0
  or strpos(definition,'actor.id=actor_user_id and actor.active')=0
  then raise exception 'PERSONAL_FLEET_SHARING_SOURCE_DRIFT';end if;
 execute replace(definition,'CREATE OR REPLACE FUNCTION public.private_capacity_actor_controls_vehicle(',
  'CREATE OR REPLACE FUNCTION public.private_capacity_actor_controls_vehicle_pre180(');
 execute replace(definition,old_text,new_text);
end $repair$;
revoke all on function public.private_capacity_actor_controls_vehicle_pre180(uuid,uuid)
 from public,anon,authenticated,service_role;
-- CREATE OR REPLACE preserves the original entrypoint owner/configuration/ACL.
notify pgrst,'reload schema';
commit;
