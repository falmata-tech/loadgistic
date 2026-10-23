-- FEAT-GPS-001 / FEAT-TRK-001. Capacity source is a driver's publishing
-- choice; an agreed shipment has its own immutable live-location source.
begin;
select pg_advisory_xact_lock(8030172);
set local lock_timeout='5s';
set local statement_timeout='30s';

alter table public.provider_shipments add column tracking_location_source text
 check(tracking_location_source in('GPS','MOBILE'));
alter table public.provider_shipments add column tracking_source_started_at timestamptz;
alter table public.provider_shipments add column tracking_gps_assignment_id uuid
 references public.telematics_device_assignments(id) on delete set null;

-- Preserve the current live source of unfinished agreements at cutover. A
-- manual Capacity point is not a live Tracking source; those shipments use
-- their existing phone reporting contract instead. No coordinates are copied.
update public.provider_shipments shipment set
 tracking_location_source=case when selection.source='GPS' and assignment.id is not null then 'GPS' else 'MOBILE' end,
 tracking_source_started_at=greatest(shipment.created_at,
  coalesce(shipment.location_reset_at,shipment.created_at),
  case when selection.source='GPS' and assignment.id is not null then selection.selected_at else shipment.created_at end),
 tracking_gps_assignment_id=case when selection.source='GPS' then assignment.id else null end
from public.vehicles vehicle
left join public.telematics_location_sources selection on selection.vehicle_id=vehicle.id
left join public.telematics_device_assignments assignment on assignment.vehicle_id=vehicle.id and assignment.ended_at is null
where vehicle.id=shipment.assigned_vehicle_id;
update public.provider_shipments set tracking_location_source='MOBILE',tracking_source_started_at=created_at
where tracking_location_source is null;
alter table public.provider_shipments alter column tracking_location_source set not null;
alter table public.provider_shipments alter column tracking_source_started_at set not null;
-- Erasure may clear a retired assignment ID after Tracking closes. A GPS
-- agreement with a cleared binding stays GPS but has no current location.
alter table public.provider_shipments add constraint tracking_gps_source_pair_check check(
 tracking_location_source='GPS' or tracking_gps_assignment_id is null);

create function public.remember_shipment_location_source() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
declare selected public.telematics_location_sources%rowtype;assignment public.telematics_device_assignments%rowtype;
begin
 -- This lock serializes source selection with agreement creation. An owner or
 -- driver changing Capacity after this point cannot rewrite this agreement.
 perform 1 from public.vehicles where id=new.assigned_vehicle_id and active for share;
 if not found then raise exception 'INVALID_VEHICLE';end if;
 select * into selected from public.telematics_location_sources where vehicle_id=new.assigned_vehicle_id;
 if selected.source='GPS' then
  select a.* into assignment from public.telematics_device_assignments a
   join public.telematics_devices d on d.id=a.device_id and d.active
   where a.vehicle_id=new.assigned_vehicle_id and a.ended_at is null;
 end if;
 new.tracking_location_source:=case when assignment.id is not null then 'GPS' else 'MOBILE' end;
 new.tracking_gps_assignment_id:=case when assignment.id is not null then assignment.id else null end;
 new.tracking_source_started_at:=greatest(coalesce(new.created_at,clock_timestamp()),
  case when assignment.id is not null then selected.selected_at else '-infinity'::timestamptz end);
 return new;
end $$;
revoke all on function public.remember_shipment_location_source() from public,anon,authenticated,service_role;
create trigger remember_shipment_location_source before insert on public.provider_shipments
 for each row execute function public.remember_shipment_location_source();

create function public.remember_shipment_location_source_on_reassignment() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
declare selected public.telematics_location_sources%rowtype;assignment public.telematics_device_assignments%rowtype;
begin
 if new.assigned_vehicle_id is not distinct from old.assigned_vehicle_id
  and new.assigned_driver_user_id is not distinct from old.assigned_driver_user_id then return new;end if;
 -- A deliberate, audited shipment reassignment is a new live-source epoch.
 -- A routine Capacity choice or status update never enters this branch.
 perform 1 from public.vehicles where id=new.assigned_vehicle_id and active for share;
 if not found then raise exception 'INVALID_VEHICLE';end if;
 select * into selected from public.telematics_location_sources where vehicle_id=new.assigned_vehicle_id;
 if selected.source='GPS' then
  select a.* into assignment from public.telematics_device_assignments a
   join public.telematics_devices d on d.id=a.device_id and d.active
   where a.vehicle_id=new.assigned_vehicle_id and a.ended_at is null;
 end if;
 new.tracking_location_source:=case when assignment.id is not null then 'GPS' else 'MOBILE' end;
 new.tracking_gps_assignment_id:=case when assignment.id is not null then assignment.id else null end;
 new.tracking_source_started_at:=clock_timestamp();
 return new;
end $$;
revoke all on function public.remember_shipment_location_source_on_reassignment() from public,anon,authenticated,service_role;
create trigger remember_shipment_location_source_on_reassignment before update of assigned_vehicle_id,assigned_driver_user_id
 on public.provider_shipments for each row execute function public.remember_shipment_location_source_on_reassignment();

create function public.keep_agreed_tracking_location_source() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if new.assigned_vehicle_id is not distinct from old.assigned_vehicle_id
  and new.assigned_driver_user_id is not distinct from old.assigned_driver_user_id
  and (new.tracking_location_source is distinct from old.tracking_location_source
   or new.tracking_source_started_at is distinct from old.tracking_source_started_at
   or new.tracking_gps_assignment_id is distinct from old.tracking_gps_assignment_id)
  then raise exception 'TRACKING_SOURCE_LOCKED';end if;
 return new;
end $$;
revoke all on function public.keep_agreed_tracking_location_source() from public,anon,authenticated,service_role;
create trigger keep_agreed_tracking_location_source before update of tracking_location_source,tracking_source_started_at,tracking_gps_assignment_id
 on public.provider_shipments for each row execute function public.keep_agreed_tracking_location_source();

-- Service-only editor: public Capacity may be manual, but the exact editor
-- point is visible only to the current assigned driver or account owner.
create function public.capacity_location_editor(actor_user_id uuid,target_vehicle_id uuid)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare vehicle public.vehicles%rowtype;selection public.telematics_location_sources%rowtype;
 allowed boolean;
begin
 select * into vehicle from public.vehicles where id=target_vehicle_id and active;
 if not found then raise exception 'NOT_FOUND';end if;
 allowed:=public.fleet_actor_can_use_vehicle(actor_user_id,vehicle.id,true) or
  (public.capacity_active_driver_id(vehicle.id)=actor_user_id
   and public.fleet_actor_can_use_vehicle(actor_user_id,vehicle.id,false));
 if not allowed then raise exception 'NOT_FOUND';end if;
 select * into selection from public.telematics_location_sources where vehicle_id=vehicle.id;
 return jsonb_build_object('vehicleId',vehicle.id,'source',coalesce(selection.source,'MOBILE'),
  'precisionKm',coalesce(selection.precision_km,10),
  'revision',coalesce(selection.revision,'1970-01-01'::timestamptz),
  'manualPoint',case when selection.source='MANUAL' then
   jsonb_build_object('latitude',selection.manual_latitude,'longitude',selection.manual_longitude) else null end,
  'canSetManualLocation',true,'canSetPhoneLocation',true);
end $$;

-- A queued Capacity phone report cannot leave a fresh private phone point
-- behind a manual selection or overwrite the public manual point. Shipment
-- Tracking reports use their separate agreement and are not routed here.
alter function public.refresh_provider_capacity_location(uuid,jsonb) rename to refresh_provider_capacity_location_pre_driver172;
create function public.refresh_provider_capacity_location(actor_user_id uuid,command jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare target_vehicle_id uuid:=(command->>'vehicle_id')::uuid;
begin
 perform 1 from public.vehicles where id=target_vehicle_id for update;
 if not found or coalesce((select source from public.telematics_location_sources where vehicle_id=target_vehicle_id),'MOBILE')<>'MOBILE'
  then raise exception 'PHONE_LOCATION_UNAVAILABLE';end if;
 return public.refresh_provider_capacity_location_pre_driver172(actor_user_id,command);
end $$;

create function public.select_driver_capacity_location_source(actor_user_id uuid,command jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
#variable_conflict use_variable
declare vehicle public.vehicles%rowtype;selected public.telematics_location_sources%rowtype;
 stamp timestamptz:=clock_timestamp();requested_source text:=command->>'source';radius integer;
begin
 if requested_source not in('MANUAL','MOBILE') or requested_source is null then raise exception 'FORBIDDEN';end if;
 select * into vehicle from public.vehicles where id=(command->>'vehicleId')::uuid and active for update;
 if not found or public.capacity_active_driver_id(vehicle.id) is distinct from actor_user_id
  or not public.fleet_actor_can_use_vehicle(actor_user_id,vehicle.id,false)
  then raise exception 'NOT_FOUND';end if;
 radius:=(command->>'precisionKm')::integer;
 if radius not in(1,3,5,10,20) or radius is null then raise exception 'INVALID_TELEMATICS_INPUT';end if;
 select * into selected from public.telematics_location_sources where vehicle_id=vehicle.id for update;
 if nullif(command->>'expectedRevision','')::timestamptz is distinct from coalesce(selected.revision,'1970-01-01'::timestamptz)
  then raise exception 'TELEMATICS_CHANGED';end if;
 if requested_source='MANUAL' and (command->>'manualLatitude' is null or command->>'manualLongitude' is null
  or (command->>'manualLatitude')::double precision not between -90 and 90
  or (command->>'manualLongitude')::double precision not between -180 and 180)
  then raise exception 'INVALID_TELEMATICS_INPUT';end if;
 if requested_source='MOBILE' and (command?'manualLatitude' or command?'manualLongitude')
  then raise exception 'INVALID_TELEMATICS_INPUT';end if;
 stamp:=greatest(stamp,coalesce(selected.revision+interval '1 microsecond',stamp));
 insert into public.telematics_location_sources(vehicle_id,source,precision_km,selected_by,selected_at,revision,manual_latitude,manual_longitude)
 values(vehicle.id,requested_source,radius,actor_user_id,stamp,stamp,
  case when requested_source='MANUAL' then (command->>'manualLatitude')::double precision end,
  case when requested_source='MANUAL' then (command->>'manualLongitude')::double precision end)
 on conflict(vehicle_id) do update set source=excluded.source,precision_km=excluded.precision_km,
  selected_by=excluded.selected_by,selected_at=excluded.selected_at,revision=excluded.revision,
  manual_latitude=excluded.manual_latitude,manual_longitude=excluded.manual_longitude;
 if requested_source='MANUAL' then perform public.apply_telematics_capacity_location(vehicle.id);end if;
 insert into public.audit_logs(actor_user_id,organization_id,action,entity_type,entity_id,details)
 values(actor_user_id,vehicle.organization_id,'TELEMATICS_LOCATION_SOURCE_SELECTED','vehicle',vehicle.id,
  jsonb_build_object('source',requested_source,'precisionKm',radius,'selectedBy','DRIVER'));
 return jsonb_build_object('vehicleId',vehicle.id,'source',requested_source,'revision',stamp);
exception when invalid_text_representation or numeric_value_out_of_range or datetime_field_overflow
 then raise exception 'INVALID_TELEMATICS_INPUT';
end $$;

-- Retain the existing owner path for GPS and device administration. A current
-- driver's MANUAL choice cannot be silently undone by that owner.
alter function public.select_telematics_location_source(uuid,jsonb) rename to select_telematics_location_source_pre_driver172;
create function public.select_telematics_location_source(actor_user_id uuid,command jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare vehicle public.vehicles%rowtype;selection public.telematics_location_sources%rowtype;
 target_vehicle_id uuid:=(command->>'vehicleId')::uuid;
begin
 -- Preserve the owner's existing account-then-vehicle lock order. The driver
 -- path needs only the vehicle lock and rechecks assignment afterwards.
 if public.fleet_actor_can_use_vehicle(actor_user_id,target_vehicle_id,true) then
  perform public.fleet_lock_provider_owner(actor_user_id);
  select * into vehicle from public.vehicles where id=target_vehicle_id and active for update;
  if not found or not public.fleet_actor_can_use_vehicle(actor_user_id,vehicle.id,true) then raise exception 'NOT_FOUND';end if;
  select * into selection from public.telematics_location_sources where vehicle_id=vehicle.id for update;
  if selection.source='MANUAL' and selection.selected_by is distinct from actor_user_id
   and selection.selected_by=public.capacity_active_driver_id(vehicle.id)
   then raise exception 'DRIVER_LOCATION_CHOICE_LOCKED';end if;
  return public.select_telematics_location_source_pre_driver172(actor_user_id,command);
 end if;
 return public.select_driver_capacity_location_source(actor_user_id,command);
end $$;

-- The recipient resolver reads only the source fixed for this agreement. In
-- particular it never returns a manual Capacity point as a live truck fix.
create or replace function public.tracking_selected_location(target_shipment_id uuid)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare shipment public.provider_shipments%rowtype;assignment public.telematics_device_assignments%rowtype;
 fix public.telematics_positions%rowtype;phone record;point jsonb;boundary timestamptz;
 radius integer;driver_started timestamptz;
begin
 select * into shipment from public.provider_shipments where id=target_shipment_id;
 if not found or shipment.tracking_mode<>'LOCATION_AND_STATUS'
  or shipment.operational_status in('COMPLETED','CANCELLED') then return null;end if;
 if not exists(select 1 from public.vehicles where id=shipment.assigned_vehicle_id and active)
  or public.capacity_active_driver_id(shipment.assigned_vehicle_id) is distinct from shipment.assigned_driver_user_id
  or not public.provider_tracking_actor_owns_shipment(shipment.assigned_driver_user_id,shipment.id)
  then return null;end if;
 select max(assigned_at) into driver_started from public.driver_vehicle_assignments
  where vehicle_id=shipment.assigned_vehicle_id and driver_user_id=shipment.assigned_driver_user_id and active;
 boundary:=greatest(coalesce(shipment.location_reset_at,'-infinity'::timestamptz),
  shipment.tracking_source_started_at,coalesce(driver_started,'-infinity'::timestamptz));
 radius:=coalesce(shipment.tracking_precision_km,10);
 if shipment.tracking_location_source='GPS' then
  select a.* into assignment from public.telematics_device_assignments a
   join public.telematics_devices d on d.id=a.device_id and d.active
   join public.vehicles v on v.id=a.vehicle_id and v.active
    and v.organization_id is not distinct from d.organization_id
    and v.provider_profile_id is not distinct from d.provider_profile_id
   where a.id=shipment.tracking_gps_assignment_id
    and a.vehicle_id=shipment.assigned_vehicle_id and a.ended_at is null;
  if not found then return null;end if;
  select p.* into fix from public.telematics_positions p
   where p.device_id=assignment.device_id and p.assignment_id=assignment.id
    and p.vehicle_id=shipment.assigned_vehicle_id and p.valid
    and p.observed_at>=greatest(boundary,assignment.assigned_at,shipment.created_at)
    and p.observed_at<=clock_timestamp() order by p.observed_at desc,p.id desc limit 1;
  if not found then return null;end if;
  if fix.observed_at>=public.location_radius_cutover() then radius:=least(radius,10);end if;
  point:=public.telematics_obscure(fix.latitude,fix.longitude,radius);
  return jsonb_build_object('location_lat',point->'latitude','location_lng',point->'longitude',
   'location_precision_km',radius,'location_area','Approximate location',
   'location_source','TELEMATICS','updated_at',fix.observed_at,'is_demo',fix.demo_epoch is not null);
 end if;
 -- Phone Tracking is independent of the selected Capacity source. Never
 -- narrow or re-obscure a previously obscured phone report.
 select candidate.* into phone from(
  select e.location_lat as latitude,e.location_lng as longitude,
   e.location_precision_km as precision_km,e.location_area as area,
   coalesce(e.location_observed_at,e.created_at) as observed_at,false as is_demo
   from public.provider_shipment_events e where e.shipment_id=shipment.id
   and e.created_by=shipment.assigned_driver_user_id and e.location_source='DEVICE_OBSCURED'
   and coalesce(e.location_observed_at,e.created_at)>=greatest(boundary,shipment.created_at)
   and coalesce(e.location_observed_at,e.created_at)<=clock_timestamp()
   and(e.phone_binding_id is null and not exists(select 1 from public.phone_location_bindings b
    where b.vehicle_id=shipment.assigned_vehicle_id and public.phone_location_binding_is_current(b.id))
    or exists(select 1 from public.phone_location_bindings b where b.id=e.phone_binding_id
     and b.vehicle_id=shipment.assigned_vehicle_id and b.actor_user_id=shipment.assigned_driver_user_id
     and public.phone_location_binding_is_current(b.id)))
  union all
  select p.latitude,p.longitude,p.precision_km,p.area,coalesce(p.observed_at,p.updated_at),p.demo_epoch is not null
   from public.vehicle_driver_locations p where p.vehicle_id=shipment.assigned_vehicle_id
   and p.driver_user_id=shipment.assigned_driver_user_id
   and coalesce(p.observed_at,p.updated_at)>=greatest(boundary,shipment.created_at)
   and coalesce(p.observed_at,p.updated_at)<=clock_timestamp()
   and(p.phone_binding_id is null and not exists(select 1 from public.phone_location_bindings b
    where b.vehicle_id=shipment.assigned_vehicle_id and public.phone_location_binding_is_current(b.id))
    or exists(select 1 from public.phone_location_bindings b where b.id=p.phone_binding_id
     and b.vehicle_id=shipment.assigned_vehicle_id and b.actor_user_id=shipment.assigned_driver_user_id
     and public.phone_location_binding_is_current(b.id)))
 ) candidate where candidate.precision_km in(1,3,5,10,20)
  and (candidate.precision_km<=10 or candidate.observed_at<public.location_radius_cutover())
  and candidate.latitude between -90 and 90 and candidate.longitude between -180 and 180
 order by candidate.observed_at desc limit 1;
 if not found then return null;end if;
 return jsonb_build_object('location_lat',phone.latitude,'location_lng',phone.longitude,
  'location_precision_km',phone.precision_km,'location_area',phone.area,
  'location_source','DEVICE_OBSCURED','updated_at',phone.observed_at,'is_demo',phone.is_demo);
end $$;
revoke all on function public.tracking_selected_location(uuid) from public,anon,authenticated,service_role;

-- Keep phone Tracking's installation/receipt/rate checks while removing only
-- its former dependence on the public Capacity source selector.
create function public.authorize_tracking_phone_location_report(actor_user_id uuid,target_vehicle_id uuid,target_shipment_id uuid,proof jsonb)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
#variable_conflict use_variable
declare binding public.phone_location_bindings%rowtype;observed timestamptz;report uuid;
 stamp timestamptz:=clock_timestamp();accuracy double precision;speed double precision;heading double precision;
begin
 if jsonb_typeof(proof) is distinct from 'object' then raise exception 'INVALID_PHONE_LOCATION';end if;
 perform 1 from public.vehicles where id=target_vehicle_id for update;
 if not exists(select 1 from public.provider_shipments s where s.id=target_shipment_id
  and s.assigned_vehicle_id=target_vehicle_id and s.assigned_driver_user_id=actor_user_id
  and s.tracking_mode='LOCATION_AND_STATUS' and s.tracking_location_source='MOBILE'
  and s.operational_status not in('COMPLETED','CANCELLED')
  and public.provider_tracking_actor_owns_shipment(actor_user_id,s.id)) then raise exception 'PHONE_LOCATION_UNAVAILABLE';end if;
 select b.* into binding from public.phone_location_bindings b
  join public.phone_location_installations i on i.id=b.installation_id
  where b.id=(proof->>'binding_id')::uuid and b.installation_id=(proof->>'installation_id')::uuid
   and i.secret_digest=proof->>'secret_digest' and b.revision=(proof->>'revision')::uuid
   and b.actor_user_id=actor_user_id and b.vehicle_id=target_vehicle_id for update of b;
 stamp:=clock_timestamp();
 if not found or not public.phone_location_binding_is_current(binding.id)
  or public.capacity_active_driver_id(target_vehicle_id) is distinct from actor_user_id
  then raise exception 'PHONE_LOCATION_UNAVAILABLE';end if;
 observed:=(proof->>'observed_at')::timestamptz;report:=(proof->>'report_id')::uuid;
 accuracy:=(proof->>'accuracy_m')::double precision;speed:=(proof->>'speed_kph')::double precision;heading:=(proof->>'heading_deg')::double precision;
 if accuracy is not null and not(accuracy between 0 and 40000) or speed is not null and not(speed between 0 and 300)
  or heading is not null and not(heading>=0 and heading<360) then raise exception 'INVALID_PHONE_LOCATION';end if;
 if observed is null or report is null or observed<stamp-interval '2 minutes' or observed>stamp+interval '30 seconds'
  or observed<binding.created_at-interval '1 second' or observed<coalesce(binding.last_observed_at,'-infinity'::timestamptz)
  or observed<(select s.tracking_source_started_at from public.provider_shipments s where s.id=target_shipment_id)
  then raise exception 'INVALID_PHONE_LOCATION';end if;
 insert into public.phone_location_report_receipts(binding_id,report_id,observed_at) values(binding.id,report,observed) on conflict do nothing;
 if not found then return null;end if;
 update public.phone_location_bindings set last_observed_at=observed,last_report_id=report,
  last_accuracy_m=accuracy,last_speed_kph=speed,last_heading_deg=heading,expires_at=stamp+interval '24 hours' where id=binding.id;
 update public.phone_location_installations set last_seen_at=stamp where id=binding.installation_id;
 return binding.id;
exception when invalid_text_representation or invalid_datetime_format or datetime_field_overflow or numeric_value_out_of_range
 then raise exception 'INVALID_PHONE_LOCATION';
end $$;

do $tracking_phone$ declare definition text;anchor text;replacement text;begin
 definition:=pg_get_functiondef('public.update_provider_tracking_location_pre_coherence162(uuid,uuid,jsonb)'::regprocedure);
 anchor:='authorize_phone_location_report(actor_user_id,vehicle,command->''phone_installation'')';
 replacement:='authorize_tracking_phone_location_report(actor_user_id,vehicle,target_shipment_id,command->''phone_installation'')';
 if (length(definition)-length(replace(definition,anchor,'')))/length(anchor)<>1 then raise exception 'TRACKING_PHONE_LOCATION_ANCHOR_DRIFT';end if;
 execute replace(definition,anchor,replacement);
 definition:=pg_get_functiondef('public.update_provider_tracking_status_pre_coherence162(uuid,uuid,jsonb)'::regprocedure);
 anchor:='authorize_phone_location_report(actor_user_id,vehicle,command->''location''->''phone_installation'')';
 replacement:='authorize_tracking_phone_location_report(actor_user_id,vehicle,target_shipment_id,command->''location''->''phone_installation'')';
 if (length(definition)-length(replace(definition,anchor,'')))/length(anchor)<>1 then raise exception 'TRACKING_STATUS_PHONE_ANCHOR_DRIFT';end if;
 execute replace(definition,anchor,replacement);
 definition:=pg_get_functiondef('public.issue_registered_tracking_device_lease_pre_radius163(uuid,uuid,uuid,text,text,integer)'::regprocedure);
 anchor:='coalesce((select source from telematics_location_sources where vehicle_id=vehicle),''MOBILE'')<>''MOBILE''';
 replacement:='coalesce((select tracking_location_source from provider_shipments where id=target_shipment_id),''MOBILE'')<>''MOBILE''';
 if (length(definition)-length(replace(definition,anchor,'')))/length(anchor)<>1 then raise exception 'TRACKING_LEASE_SOURCE_ANCHOR_DRIFT';end if;
 execute replace(definition,anchor,replacement);
 definition:=pg_get_functiondef('public.apply_registered_tracking_phone_point(uuid,uuid,uuid,timestamptz,jsonb)'::regprocedure);
 anchor:='or coalesce((select source from telematics_location_sources where vehicle_id=target_vehicle_id),''MOBILE'')<>''MOBILE''';
 if (length(definition)-length(replace(definition,anchor,'')))/length(anchor)<>1 then raise exception 'TRACKING_CAPACITY_PHONE_GUARD_DRIFT';end if;
 definition:=replace(definition,anchor,'');
 anchor:='result:=public.refresh_provider_capacity_location_pre_phone157(';
 replacement:='if coalesce((select source from telematics_location_sources where vehicle_id=target_vehicle_id),''MOBILE'')<>''MOBILE'' then return;end if; '||anchor;
 if (length(definition)-length(replace(definition,anchor,'')))/length(anchor)<>1 then raise exception 'TRACKING_CAPACITY_PHONE_REFRESH_DRIFT';end if;
 execute replace(definition,anchor,replacement);
 definition:=pg_get_functiondef('public.assigned_location_tracking(uuid)'::regprocedure);
 anchor:='from public.assigned_location_tracking_pre_radius163(actor_user_id) r';
 replacement:=anchor||E'\n where exists(select 1 from public.provider_shipments s where s.id=(r.payload->>''shipmentId'')::uuid and s.tracking_location_source=''MOBILE'')';
 if (length(definition)-length(replace(definition,anchor,'')))/length(anchor)<>1 then raise exception 'TRACKING_PHONE_TASK_ANCHOR_DRIFT';end if;
 execute replace(definition,anchor,replacement);
end $tracking_phone$;

-- Owner-only Fleet workspace can explain why switching sources is locked,
-- without exposing the driver's identity or raw point to public projections.
do $fleet_choice$ declare definition text;anchor text;replacement text;begin
 definition:=pg_get_functiondef('public.telematics_workspace_pre_phone157(uuid,integer)'::regprocedure);
 anchor:=$a$'manualPoint',case when s.source='MANUAL' then jsonb_build_object('latitude',s.manual_latitude,'longitude',s.manual_longitude) else null end$a$;
 replacement:=anchor||$a$,'driverSelectedManual',case when s.source='MANUAL'
   and s.selected_by=public.capacity_active_driver_id(v.id) and s.selected_by<>actor_user_id then true else false end$a$;
 if (length(definition)-length(replace(definition,anchor,'')))/length(anchor)<>1 then raise exception 'FLEET_DRIVER_MANUAL_CHOICE_ANCHOR_DRIFT';end if;
 execute replace(definition,anchor,replacement);
end $fleet_choice$;

revoke all on function public.capacity_location_editor(uuid,uuid),
 public.select_driver_capacity_location_source(uuid,jsonb),
 public.select_telematics_location_source_pre_driver172(uuid,jsonb),
 public.refresh_provider_capacity_location_pre_driver172(uuid,jsonb),
 public.authorize_tracking_phone_location_report(uuid,uuid,uuid,jsonb)
 from public,anon,authenticated,service_role;
revoke all on function public.select_telematics_location_source(uuid,jsonb) from public,anon,authenticated;
revoke all on function public.refresh_provider_capacity_location(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.capacity_location_editor(uuid,uuid),
 public.select_telematics_location_source(uuid,jsonb),
 public.refresh_provider_capacity_location(uuid,jsonb) to service_role;
commit;
