-- FEAT-GPS-001 / FEAT-TRK-001. Preserve demo's owner -> device -> vehicle
-- lock order when a phone Capacity report races synthetic movement. The source
-- choice remains serialized under the vehicle lock acquired by the preserved
-- phone wrapper; rejected writes roll back in the same PostgreSQL transaction.
begin;
select pg_advisory_xact_lock(8030174);
set local lock_timeout='5s';
set local statement_timeout='30s';

do $guard$
declare definition text:=pg_get_functiondef('public.refresh_provider_capacity_location(uuid,jsonb)'::regprocedure);
 radius_wrapper text:=pg_get_functiondef('public.refresh_provider_capacity_location_pre_driver172(uuid,jsonb)'::regprocedure);
 phone_wrapper text:=pg_get_functiondef('public.refresh_provider_capacity_location_pre_radius163(uuid,jsonb)'::regprocedure);
 first_lock text:='perform 1 from public.vehicles where id=target_vehicle_id for update;';
 source_guard text:='coalesce((select source from public.telematics_location_sources where vehicle_id=target_vehicle_id),''MOBILE'')<>''MOBILE''';
 delegated text:='return public.refresh_provider_capacity_location_pre_driver172(actor_user_id,command);';
 radius_delegate text:='return public.refresh_provider_capacity_location_pre_radius163(actor_user_id,command);';
 demo_lock text:='perform public.note_real_location_device_use(actor_user_id,vehicle,';
 phone_vehicle_lock text:='perform 1 from vehicles where id=vehicle for update;';
begin
 if (length(definition)-length(replace(definition,first_lock,'')))/length(first_lock)<>1
  or (length(definition)-length(replace(definition,source_guard,'')))/length(source_guard)<>1
  or (length(definition)-length(replace(definition,delegated,'')))/length(delegated)<>1
  or not(strpos(definition,first_lock)<strpos(definition,source_guard)
   and strpos(definition,source_guard)<strpos(definition,delegated))
  or (length(radius_wrapper)-length(replace(radius_wrapper,radius_delegate,'')))/length(radius_delegate)<>1
  or (length(phone_wrapper)-length(replace(phone_wrapper,demo_lock,'')))/length(demo_lock)<>1
  or (length(phone_wrapper)-length(replace(phone_wrapper,phone_vehicle_lock,'')))/length(phone_vehicle_lock)<>1
  or strpos(phone_wrapper,demo_lock)>=strpos(phone_wrapper,phone_vehicle_lock)
  then raise exception 'CAPACITY_PHONE_LOCK_ORDER_ANCHOR_DRIFT';end if;
end $guard$;

create or replace function public.refresh_provider_capacity_location(actor_user_id uuid,command jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare target_vehicle_id uuid:=(command->>'vehicle_id')::uuid; result jsonb;
begin
 if target_vehicle_id is null or not exists(select 1 from public.vehicles where id=target_vehicle_id)
  then raise exception 'PHONE_LOCATION_UNAVAILABLE';end if;
 -- The preserved 163 radius wrapper delegates to the 157 phone wrapper, which
 -- takes demo owner/device locks before it locks the vehicle. A selected
 -- MANUAL/GPS source can make its intermediate writes
 -- ineligible, but the error below rolls back that entire delegated call.
 result:=public.refresh_provider_capacity_location_pre_driver172(actor_user_id,command);
 if coalesce((select source from public.telematics_location_sources where vehicle_id=target_vehicle_id),'MOBILE')<>'MOBILE'
  then raise exception 'PHONE_LOCATION_UNAVAILABLE';end if;
 return result;
end $$;

revoke all on function public.refresh_provider_capacity_location(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.refresh_provider_capacity_location(uuid,jsonb) to service_role;
commit;
