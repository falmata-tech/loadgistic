-- FEAT-GPS-001 / FEAT-TRK-001. A new driving pair cannot inherit the former
-- driver's precise manual Capacity point; legacy GPS Tracking never falls back
-- to a phone merely because its old device was detached at backfill time.
begin;
select pg_advisory_xact_lock(8030173);
set local lock_timeout='5s';
set local statement_timeout='30s';

-- Migration 172's conservative legacy snapshot used the current assignment.
-- An already-ended GPS assignment has no live fix, not implicit phone consent.
-- These migrations are applied together before application traffic resumes.
lock table public.provider_shipments in access exclusive mode;
alter table public.provider_shipments disable trigger keep_agreed_tracking_location_source;
update public.provider_shipments shipment set tracking_location_source='GPS',tracking_gps_assignment_id=null
from public.telematics_location_sources selection
where shipment.assigned_vehicle_id=selection.vehicle_id and selection.source='GPS'
 and shipment.tracking_location_source='MOBILE'
 and shipment.operational_status not in('COMPLETED','CANCELLED')
 and not exists(select 1 from public.telematics_device_assignments assignment
  where assignment.vehicle_id=shipment.assigned_vehicle_id and assignment.ended_at is null);
alter table public.provider_shipments enable trigger keep_agreed_tracking_location_source;

do $manual_pair$ declare definition text;anchor text;replacement text;begin
 definition:=pg_get_functiondef('public.telematics_effective_location_pre_privacy154(uuid)'::regprocedure);
 anchor:='if selected.source=''MANUAL'' then';
 replacement:=anchor||E'\n  if selected.selected_at<coalesce(public.provider_capacity_pair_started_at(target_vehicle_id),''infinity''::timestamptz) then return null;end if;';
 if (length(definition)-length(replace(definition,anchor,'')))/length(anchor)<>1 then raise exception 'MANUAL_PAIR_LOCATION_ANCHOR_DRIFT';end if;
 execute replace(definition,anchor,replacement);
 definition:=pg_get_functiondef('public.capacity_location_editor(uuid,uuid)'::regprocedure);
 anchor:=$a$'manualPoint',case when selection.source='MANUAL' then$a$;
 replacement:=$a$'manualPoint',case when selection.source='MANUAL' and
   (public.fleet_actor_can_use_vehicle(actor_user_id,vehicle.id,true)
    or selection.selected_at>=coalesce(public.provider_capacity_pair_started_at(vehicle.id),'infinity'::timestamptz)) then$a$;
 if (length(definition)-length(replace(definition,anchor,'')))/length(anchor)<>1 then raise exception 'MANUAL_PAIR_EDITOR_ANCHOR_DRIFT';end if;
 execute replace(definition,anchor,replacement);
end $manual_pair$;
commit;
