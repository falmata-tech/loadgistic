-- FEAT-ENT/CAP/TRK/SIM-001. Smaller NEW reports, honest historical areas.
-- No customer fix, coordinate, source, lease or stored radius is backfilled.
begin;
select pg_advisory_xact_lock(8030163);
set local lock_timeout='5s';
set local statement_timeout='30s';
create table public.location_radius_policy(
 version integer primary key check(version=163),effective_at timestamptz not null
);
insert into public.location_radius_policy values(163,clock_timestamp());
alter table public.location_radius_policy enable row level security;
revoke all on public.location_radius_policy from public,anon,authenticated;
grant select on public.location_radius_policy to service_role;
create function public.location_radius_cutover() returns timestamptz
language sql stable security definer set search_path=public,pg_temp as $$select effective_at from location_radius_policy where version=163$$;

-- Guard normal command entry points as well as row writes. A saved broad point
-- may be preserved, but no fresh client fix can claim the retired wider choice.
alter function public.select_telematics_location_source(uuid,jsonb) rename to select_telematics_location_source_pre_radius163;
create function public.select_telematics_location_source(actor_user_id uuid,command jsonb) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$begin
 if coalesce((command->>'precisionKm')::integer,0) not in(1,3,5,10,20) then raise exception 'INVALID_TELEMATICS_INPUT';end if;
 return public.select_telematics_location_source_pre_radius163(actor_user_id,command);
exception when invalid_text_representation or numeric_value_out_of_range then raise exception 'INVALID_TELEMATICS_INPUT';end $$;
alter function public.refresh_provider_capacity_location(uuid,jsonb) rename to refresh_provider_capacity_location_pre_radius163;
create function public.refresh_provider_capacity_location(actor_user_id uuid,command jsonb) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$begin
 if coalesce((command->>'location_precision_km')::integer,0) not in(1,3,5,10,20) then raise exception 'INVALID_LOCATION_PRIVACY';end if;
 return public.refresh_provider_capacity_location_pre_radius163(actor_user_id,command);
exception when invalid_text_representation or numeric_value_out_of_range then raise exception 'INVALID_LOCATION_PRIVACY';end $$;
alter function public.publish_provider_capacity(uuid,jsonb) rename to publish_provider_capacity_pre_radius163;
create function public.publish_provider_capacity(actor_user_id uuid,command jsonb) returns uuid
language plpgsql security definer set search_path=public,pg_temp as $$begin
 if command->>'location_source'='DEVICE_OBSCURED' and coalesce((command->>'location_precision_km')::integer,0) not in(1,3,5,10,20) then raise exception 'INVALID_LOCATION_PRIVACY';end if;
 return public.publish_provider_capacity_pre_radius163(actor_user_id,command);
exception when invalid_text_representation or numeric_value_out_of_range then raise exception 'INVALID_LOCATION_PRIVACY';end $$;
alter function public.set_provider_assigned_vehicle_duty(uuid,jsonb) rename to set_provider_assigned_vehicle_duty_pre_radius163;
create function public.set_provider_assigned_vehicle_duty(actor_user_id uuid,command jsonb) returns uuid
language plpgsql security definer set search_path=public,pg_temp as $$begin
 if coalesce((command->>'on_duty')::boolean,false) and coalesce((select source from telematics_location_sources where vehicle_id=(command->>'vehicle_id')::uuid),'MOBILE')='MOBILE'
  and coalesce((command->>'location_precision_km')::integer,0) not in(1,3,5,10,20) then raise exception 'INVALID_LOCATION_PRIVACY';end if;
 return public.set_provider_assigned_vehicle_duty_pre_radius163(actor_user_id,command);
exception when invalid_text_representation or numeric_value_out_of_range then raise exception 'INVALID_LOCATION_PRIVACY';end $$;
alter function public.update_provider_tracking_location(uuid,uuid,jsonb) rename to update_provider_tracking_location_pre_radius163;
create function public.update_provider_tracking_location(actor_user_id uuid,target_shipment_id uuid,command jsonb) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$begin
 if coalesce((command->>'precision_km')::integer,0) not in(1,3,5,10) then raise exception 'TRACKING_DEVICE_LOCATION_REQUIRED';end if;
 return public.update_provider_tracking_location_pre_radius163(actor_user_id,target_shipment_id,command);
exception when invalid_text_representation or numeric_value_out_of_range then raise exception 'TRACKING_DEVICE_LOCATION_REQUIRED';end $$;
alter function public.update_provider_tracking_status(uuid,uuid,jsonb) rename to update_provider_tracking_status_pre_radius163;
create function public.update_provider_tracking_status(actor_user_id uuid,target_shipment_id uuid,command jsonb) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$begin
 if command->'location' is not null and command->'location'<>'null'::jsonb and coalesce((command->'location'->>'precision_km')::integer,0) not in(1,3,5,10) then raise exception 'TRACKING_DEVICE_LOCATION_REQUIRED';end if;
 return public.update_provider_tracking_status_pre_radius163(actor_user_id,target_shipment_id,command);
exception when invalid_text_representation or numeric_value_out_of_range then raise exception 'TRACKING_DEVICE_LOCATION_REQUIRED';end $$;
alter function public.issue_registered_tracking_device_lease(uuid,uuid,uuid,text,text,integer) rename to issue_registered_tracking_device_lease_pre_radius163;
create function public.issue_registered_tracking_device_lease(actor_user_id uuid,target_shipment_id uuid,target_device_id uuid,installation_secret_digest text,capability_digest text,privacy_radius integer) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$begin
 if privacy_radius is null or privacy_radius not in(1,3,5,10) then raise exception 'INVALID_TRACKING_DEVICE';end if;
 return public.issue_registered_tracking_device_lease_pre_radius163(actor_user_id,target_shipment_id,target_device_id,installation_secret_digest,capability_digest,privacy_radius);
end $$;
alter function public.assigned_location_tracking(uuid) rename to assigned_location_tracking_pre_radius163;
create function public.assigned_location_tracking(actor_user_id uuid) returns table(payload jsonb)
language sql stable security definer set search_path=public,pg_temp as $$
 select r.payload||jsonb_build_object('radius',least(10,coalesce((r.payload->>'radius')::integer,10)))
 from public.assigned_location_tracking_pre_radius163(actor_user_id) r
$$;

-- PostgreSQL's implicit parameter block has the function's CURRENT name.
-- Preserve existing explicit parameter qualification when retaining an old
-- implementation under its private name; public function callbacks stay public.
do $renamed_parameters$
declare old_name text;signature text;definition text;renamed text;
begin
 for old_name,signature in values
  ('select_telematics_location_source','uuid,jsonb'),('refresh_provider_capacity_location','uuid,jsonb'),
  ('publish_provider_capacity','uuid,jsonb'),('set_provider_assigned_vehicle_duty','uuid,jsonb'),
  ('update_provider_tracking_location','uuid,uuid,jsonb'),('update_provider_tracking_status','uuid,uuid,jsonb'),
  ('issue_registered_tracking_device_lease','uuid,uuid,uuid,text,text,integer'),('assigned_location_tracking','uuid')
 loop
  renamed:=old_name||'_pre_radius163';
  definition:=pg_get_functiondef(('public.'||renamed||'('||signature||')')::regprocedure);
  if strpos(definition,old_name||'.')>0 then execute replace(definition,old_name||'.',renamed||'.');end if;
 end loop;
end $renamed_parameters$;

-- Do not narrow an old GPS/manual fix or an already obscured phone point. Only
-- a new raw GPS observation or a deliberate manual re-save adopts the new cap.
do $resolvers$
declare definition text;before_text text;after_text text;
begin
 definition:=pg_get_functiondef('public.telematics_effective_location_pre_privacy154(uuid)'::regprocedure);
 before_text:='point:=public.telematics_obscure(fix.latitude,fix.longitude,selected.precision_km);';
 after_text:='point:=public.telematics_obscure(fix.latitude,fix.longitude,case when fix.observed_at>=public.location_radius_cutover() then least(selected.precision_km,20) else selected.precision_km end);';
 if(length(definition)-length(replace(definition,before_text,'')))/length(before_text)<>1 then raise exception 'CAPACITY_RADIUS_RESOLVER_DRIFT';end if;
 execute replace(definition,before_text,after_text);
 definition:=pg_get_functiondef('public.tracking_selected_location(uuid)'::regprocedure);
 before_text:='point:=public.telematics_obscure(selected.manual_latitude,selected.manual_longitude,radius);';
 after_text:='if selected.selected_at>=public.location_radius_cutover() then radius:=least(radius,10);end if; '||before_text;
 if(length(definition)-length(replace(definition,before_text,'')))/length(before_text)<>1 then raise exception 'TRACKING_MANUAL_RADIUS_RESOLVER_DRIFT';end if;
 definition:=replace(definition,before_text,after_text);
 before_text:='point:=public.telematics_obscure(fix.latitude,fix.longitude,radius);';
 after_text:='if fix.observed_at>=public.location_radius_cutover() then radius:=least(radius,10);end if; '||before_text;
 if(length(definition)-length(replace(definition,before_text,'')))/length(before_text)<>1 then raise exception 'TRACKING_GPS_RADIUS_RESOLVER_DRIFT';end if;
 definition:=replace(definition,before_text,after_text);
 before_text:='candidate.precision_km in(1,3,5,10,20)';
 after_text:='candidate.precision_km in(1,3,5,10,20) and (candidate.precision_km<=10 or candidate.observed_at<public.location_radius_cutover())';
 if(length(definition)-length(replace(definition,before_text,'')))/length(before_text)<>1 then raise exception 'TRACKING_PHONE_RADIUS_RESOLVER_DRIFT';end if;
 execute replace(definition,before_text,after_text);
 -- The private workspace default is a choice for the next capture, not a new
 -- label on an existing published location. Existing saved source radii stay.
 definition:=pg_get_functiondef('public.telematics_workspace_pre_phone157(uuid,integer)'::regprocedure);
 before_text:='coalesce(s.precision_km,20)';
 if(length(definition)-length(replace(definition,before_text,'')))/length(before_text)<>1 then raise exception 'FLEET_RADIUS_DEFAULT_DRIFT';end if;
 execute replace(definition,before_text,'coalesce(s.precision_km,10)');
 -- The isolated demo also generates a NEW raw phone capture. Cap all three
 -- copies together so its point and recorded radius remain the same fact.
 definition:=pg_get_functiondef('public.report_demo_phone_location(uuid,uuid,bigint,double precision,double precision)'::regprocedure);
 before_text:='(context->>''precisionKm'')::integer';
 if(length(definition)-length(replace(definition,before_text,'')))/length(before_text)<>3 then raise exception 'DEMO_NEW_RADIUS_DRIFT';end if;
 execute replace(definition,before_text,'least((context->>''precisionKm'')::integer,20)');
end $resolvers$;

create function public.enforce_new_location_radius() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if tg_table_name='capacities' then
  if new.location_updated_at>=public.location_radius_cutover() and new.location_source in('DEVICE_OBSCURED','TELEMATICS','MANUAL_ADMIN') and new.location_precision_km not in(1,3,5,10,20) then raise exception 'INVALID_LOCATION_PRIVACY';end if;
 elsif tg_table_name='vehicle_driver_locations' then
  if coalesce(new.observed_at,new.updated_at)>=public.location_radius_cutover() and new.precision_km not in(1,3,5,10,20) then raise exception 'INVALID_LOCATION_PRIVACY';end if;
 elsif tg_table_name='provider_shipment_events' then
  if new.location_source='DEVICE_OBSCURED' and coalesce(new.location_observed_at,new.created_at)>=public.location_radius_cutover() and new.location_precision_km not in(1,3,5,10) then raise exception 'TRACKING_DEVICE_LOCATION_REQUIRED';end if;
 elsif tg_table_name='tracking_device_leases' then
  if new.created_at>=public.location_radius_cutover() and new.privacy_km not in(1,3,5,10) then raise exception 'INVALID_TRACKING_DEVICE';end if;
 end if;
 return new;
end $$;
create trigger enforce_new_capacity_radius before insert or update of location_lat,location_lng,location_precision_km,location_updated_at,location_source on public.capacities for each row execute function public.enforce_new_location_radius();
create trigger enforce_new_phone_capacity_radius before insert or update of latitude,longitude,precision_km,updated_at,observed_at on public.vehicle_driver_locations for each row execute function public.enforce_new_location_radius();
create trigger enforce_new_tracking_radius before insert or update of location_lat,location_lng,location_precision_km,location_observed_at on public.provider_shipment_events for each row execute function public.enforce_new_location_radius();
create trigger enforce_new_tracking_lease_radius before insert or update of privacy_km,created_at on public.tracking_device_leases for each row execute function public.enforce_new_location_radius();

do $permissions$ declare fn regprocedure;begin
 foreach fn in array array[
 'public.location_radius_cutover()'::regprocedure,'public.enforce_new_location_radius()'::regprocedure,
 'public.select_telematics_location_source_pre_radius163(uuid,jsonb)'::regprocedure,'public.refresh_provider_capacity_location_pre_radius163(uuid,jsonb)'::regprocedure,
 'public.publish_provider_capacity_pre_radius163(uuid,jsonb)'::regprocedure,'public.set_provider_assigned_vehicle_duty_pre_radius163(uuid,jsonb)'::regprocedure,
 'public.update_provider_tracking_location_pre_radius163(uuid,uuid,jsonb)'::regprocedure,'public.update_provider_tracking_status_pre_radius163(uuid,uuid,jsonb)'::regprocedure,
 'public.issue_registered_tracking_device_lease_pre_radius163(uuid,uuid,uuid,text,text,integer)'::regprocedure,'public.assigned_location_tracking_pre_radius163(uuid)'::regprocedure
 ] loop execute format('revoke all on function %s from public,anon,authenticated,service_role',fn);end loop;
 foreach fn in array array[
 'public.select_telematics_location_source(uuid,jsonb)'::regprocedure,'public.refresh_provider_capacity_location(uuid,jsonb)'::regprocedure,
 'public.publish_provider_capacity(uuid,jsonb)'::regprocedure,'public.set_provider_assigned_vehicle_duty(uuid,jsonb)'::regprocedure,
 'public.update_provider_tracking_location(uuid,uuid,jsonb)'::regprocedure,'public.update_provider_tracking_status(uuid,uuid,jsonb)'::regprocedure,
 'public.issue_registered_tracking_device_lease(uuid,uuid,uuid,text,text,integer)'::regprocedure,'public.assigned_location_tracking(uuid)'::regprocedure
 ] loop execute format('revoke all on function %s from public,anon,authenticated',fn);execute format('grant execute on function %s to service_role',fn);end loop;
end $permissions$;
commit;
