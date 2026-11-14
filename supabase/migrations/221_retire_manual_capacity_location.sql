-- FEAT-GPS/CAP/MOB-001 / ADR-083. New location choices are Phone/GPS only.
-- Legacy Manual rows, dates, coordinates, audience and Tracking are untouched.
begin;
select pg_advisory_xact_lock(8030221);
set local lock_timeout='5s';
set local statement_timeout='30s';

-- Patch the installed leaves as well as public entry points. Private retained
-- implementations are not alternative ways to submit an obsolete command.
-- CREATE OR REPLACE retains each existing ACL and pinned search_path.
do $retire_manual_inputs$
declare function_name text;definition text;anchor text:=E'begin\n';guard text;
begin
 guard:=E'begin\n if command->>''source''=''MANUAL'' or command ?| array[''manualLatitude'',''manualLongitude'',''approximateLatitude'',''approximateLongitude'',''manual_latitude'',''manual_longitude''] then raise exception ''INVALID_TELEMATICS_INPUT'';end if;\n';
 foreach function_name in array array[
  'select_telematics_location_source','select_telematics_location_source_pre_driver172',
  'select_telematics_location_source_pre_radius163','select_driver_capacity_location_source'
 ] loop
  definition:=pg_get_functiondef(('public.'||function_name||'(uuid,jsonb)')::regprocedure);
  if (length(definition)-length(replace(definition,anchor,'')))/length(anchor)<>1
   then raise exception 'MANUAL_RETIREMENT_SOURCE_ANCHOR_DRIFT:%',function_name;end if;
  execute replace(definition,anchor,guard);
 end loop;

 -- A malformed old publication must fail before it can expire or insert a
 -- Capacity signal. Ordinary capacity edits may preserve an unchanged dated
 -- legacy report; they cannot accept new manual coordinates or freshness.
 guard:=E'begin\n if command->>''location_source'' in(''MANUAL'',''MANUAL_ADMIN'') or command ?| array[''manualLatitude'',''manualLongitude'',''approximateLatitude'',''approximateLongitude'',''manual_latitude'',''manual_longitude''] then raise exception ''INVALID_TELEMATICS_INPUT'';end if;\n';
 foreach function_name in array array[
  'publish_provider_capacity','publish_provider_capacity_pre_radius163',
  'publish_provider_capacity_pre_radius163_pre_space218'
 ] loop
  definition:=pg_get_functiondef(('public.'||function_name||'(uuid,jsonb)')::regprocedure);
  if (length(definition)-length(replace(definition,anchor,'')))/length(anchor)<>1
   then raise exception 'MANUAL_RETIREMENT_PUBLISH_ANCHOR_DRIFT:%',function_name;end if;
  execute replace(definition,anchor,guard);
 end loop;

 -- Going Off duty remains available. Reject obsolete input at every entry.
 foreach function_name in array array[
  'set_provider_assigned_vehicle_duty','set_provider_assigned_vehicle_duty_pre_radius163',
  'set_provider_assigned_vehicle_duty_pre_phone157'
 ] loop
  definition:=pg_get_functiondef(('public.'||function_name||'(uuid,jsonb)')::regprocedure);
  if (length(definition)-length(replace(definition,anchor,'')))/length(anchor)<>1
   then raise exception 'MANUAL_RETIREMENT_DUTY_ANCHOR_DRIFT:%',function_name;end if;
  execute replace(definition,anchor,guard);
 end loop;
end $retire_manual_inputs$;

do $retire_manual_writes$
declare definition text;anchor text;
begin
 -- A read resolver still returns historical provenance. Automated ingestion
 -- cannot use that resolver to materialize another manual location report.
 definition:=pg_get_functiondef('public.apply_telematics_capacity_location(uuid)'::regprocedure);
 anchor:='fix:=public.telematics_effective_location(target_vehicle_id);if fix is null then return false;end if;';
 if (length(definition)-length(replace(definition,anchor,'')))/length(anchor)<>1
  then raise exception 'MANUAL_RETIREMENT_APPLY_ANCHOR_DRIFT';end if;
 execute replace(definition,anchor,
  'fix:=public.telematics_effective_location(target_vehicle_id);if fix is null or fix->>''source''=''MANUAL_ADMIN'' then return false;end if;');

 definition:=pg_get_functiondef('public.capacity_location_editor(uuid,uuid)'::regprocedure);
 anchor:='''canSetManualLocation'',true';
 if (length(definition)-length(replace(definition,anchor,'')))/length(anchor)<>1
  then raise exception 'MANUAL_RETIREMENT_EDITOR_ANCHOR_DRIFT';end if;
 execute replace(definition,anchor,'''canSetManualLocation'',false');

 -- Check a retained source only after the existing locked current-driver
 -- authorization. A guessed foreign vehicle must not disclose its source.
 definition:=pg_get_functiondef('public.set_provider_assigned_vehicle_duty_pre_phone157(uuid,jsonb)'::regprocedure);
 anchor:='if on_duty and public.capacity_active_driver_id(vehicle.id) is distinct from actor_user_id then raise exception ''DRIVER_REQUIRED_FOR_CAPACITY''; end if;';
 if (length(definition)-length(replace(definition,anchor,'')))/length(anchor)<>1
  then raise exception 'MANUAL_RETIREMENT_DUTY_SOURCE_ANCHOR_DRIFT';end if;
 execute replace(definition,anchor,anchor||E'\n  if on_duty and (select s.source from public.telematics_location_sources s where s.vehicle_id=vehicle.id)=''MANUAL'' then raise exception ''LOCATION_SOURCE_PENDING'';end if;');
end $retire_manual_writes$;

commit;
