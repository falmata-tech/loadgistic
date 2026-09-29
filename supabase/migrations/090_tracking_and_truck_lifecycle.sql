-- FEAT-FLT-001 / FEAT-TRK-001 / FEAT-ADM-001: governed recovery, never event rewrites.
alter table public.provider_shipments drop constraint provider_shipments_operational_status_check;
alter table public.provider_shipments add constraint provider_shipments_operational_status_check
 check(operational_status in ('CREATED','TO_PICKUP','LOADING','IN_TRANSIT','UNLOADING','COMPLETED','ISSUE','CANCELLED'));
alter table public.provider_shipments add column location_reset_at timestamptz;
create table public.provider_tracking_recoveries(
 id uuid primary key default gen_random_uuid(),shipment_id uuid not null references public.provider_shipments(id),
 actor_user_id uuid not null references public.profiles(id),action text not null check(action in ('CORRECT','REASSIGN','CANCEL')),
 reason text not null check(char_length(reason) between 5 and 500),before_state jsonb not null,after_state jsonb not null,
 created_at timestamptz not null default now()
);
create index provider_tracking_recoveries_history_idx on public.provider_tracking_recoveries(shipment_id,created_at desc,id);
alter table public.provider_tracking_recoveries enable row level security;
revoke all on public.provider_tracking_recoveries from public,anon,authenticated;
grant all on public.provider_tracking_recoveries to service_role;

create function public.lifecycle_actor_can_manage(actor_user_id uuid,owner_org uuid,owner_provider uuid)
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select public.managed_actor_has_permission(actor_user_id,'OPERATIONS') or exists(
  select 1 from profiles p where p.id=actor_user_id and p.active and (
   p.role='TRANSPORTER' and owner_org is not null and exists(select 1 from organization_members m
    where m.user_id=p.id and m.organization_id=owner_org and m.membership_role='OWNER')
   or p.role='DRIVER' and owner_provider is not null and exists(select 1 from provider_profiles provider
    where provider.id=owner_provider and provider.user_id=p.id)
  )
 );
$$;

create function public.set_vehicle_lifecycle(actor_user_id uuid,target_vehicle_id uuid,desired_active boolean,reason text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare vehicle vehicles%rowtype; stamp timestamptz:=clock_timestamp(); visibility_value capacity_visibility;
begin
 if desired_active is null or char_length(trim(coalesce(reason,''))) not between 5 and 500 then raise exception 'INVALID_LIFECYCLE_COMMAND';end if;
 select * into vehicle from vehicles where id=target_vehicle_id for update;
 if not found or not lifecycle_actor_can_manage(actor_user_id,vehicle.organization_id,vehicle.provider_profile_id) then raise exception 'NOT_FOUND';end if;
 if vehicle.active=desired_active then return jsonb_build_object('updated',false,'active',desired_active);end if;
 if not desired_active and exists(select 1 from provider_shipments where assigned_vehicle_id=vehicle.id
   and operational_status not in ('COMPLETED','CANCELLED')) then raise exception 'TRUCK_HAS_ACTIVE_TRACKING';end if;
 -- A fresh Off Duty snapshot prevents historical capacity from reappearing on restoration.
 select visibility into visibility_value from capacities where vehicle_id=vehicle.id order by updated_at desc,id desc limit 1;
 update capacities set expires_at=stamp where vehicle_id=vehicle.id and expires_at>stamp;
 insert into capacities(provider_organization_id,provider_profile_id,vehicle_id,status,market_status,available_percent,
   visibility,updated_by,updated_at,expires_at)
 values(vehicle.organization_id,vehicle.provider_profile_id,vehicle.id,'OFF_DUTY','OFF_DUTY',0,
   coalesce(visibility_value,'PRIVATE'::capacity_visibility),actor_user_id,stamp,stamp);
 update driver_vehicle_assignments set active=false where vehicle_id=vehicle.id and active;
 update vehicles set active=desired_active where id=vehicle.id;
 insert into audit_logs(actor_user_id,organization_id,action,entity_type,entity_id,details)
 values(actor_user_id,vehicle.organization_id,
  case when managed_actor_has_permission(actor_user_id,'OPERATIONS') then 'ADMIN_VEHICLE_STATUS_CHANGED' else 'PROVIDER_VEHICLE_STATUS_CHANGED' end,
  'vehicle',vehicle.id,jsonb_build_object('active',desired_active,'reason',trim(reason)));
 return jsonb_build_object('updated',true,'active',desired_active);
end $$;

create function public.retired_provider_vehicle_page(actor_user_id uuid,requested_offset integer default 0,requested_limit integer default 10)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare result jsonb;
begin
 if not exists(select 1 from profiles where id=actor_user_id and active and role in ('TRANSPORTER','DRIVER')) then raise exception 'FORBIDDEN';end if;
 with owned as (
 select v.id,v.platform_number,v.make,v.model,v.plate from vehicles v
 where not v.active and lifecycle_actor_can_manage(actor_user_id,v.organization_id,v.provider_profile_id)
 ), page as(select * from owned order by platform_number,id offset greatest(0,coalesce(requested_offset,0)) limit greatest(1,least(50,coalesce(requested_limit,10))))
 select jsonb_build_object('total',(select count(*) from owned),'items',coalesce((select jsonb_agg(page order by platform_number,id) from page),'[]'::jsonb)) into result;
 return result;
end $$;

create function public.tracking_recovery_context(actor_user_id uuid,target_shipment_id uuid)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare shipment provider_shipments%rowtype;
begin
 select * into shipment from provider_shipments where id=target_shipment_id;
 if not found or not lifecycle_actor_can_manage(actor_user_id,shipment.provider_organization_id,shipment.provider_profile_id) then return null;end if;
 return jsonb_build_object('id',shipment.id,'revision',shipment.updated_at,'status',shipment.operational_status,
  'cargo_summary',shipment.cargo_summary,'origin',shipment.origin,'origin_place_ref',shipment.origin_place_ref,
  'destination',shipment.destination,'destination_place_ref',shipment.destination_place_ref,
  'expected_pickup_date',shipment.expected_pickup_date,'expected_delivery_date',shipment.expected_delivery_date,
  'assigned_vehicle_id',shipment.assigned_vehicle_id,
  'assigned_vehicle_number',(select platform_number from vehicles where id=shipment.assigned_vehicle_id),
  'vehicles',coalesce((select jsonb_agg(v order by v.platform_number,v.id) from (
    select vehicle.id,vehicle.platform_number,vehicle.make,vehicle.model from vehicles vehicle
    join profiles driver on driver.id=capacity_active_driver_id(vehicle.id)
    left join driver_permissions permission on permission.user_id=driver.id
    where vehicle.active and vehicle.organization_id is not distinct from shipment.provider_organization_id
      and vehicle.provider_profile_id is not distinct from shipment.provider_profile_id
      and coalesce(permission.can_manage_tracking,true)
    order by vehicle.platform_number,vehicle.id limit 100
  )v),'[]'::jsonb));
end $$;

create function public.recover_provider_tracking(actor_user_id uuid,target_shipment_id uuid,command jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare shipment provider_shipments%rowtype; vehicle vehicles%rowtype; driver_id uuid;
 action_value text:=command->>'action'; reason_value text:=trim(coalesce(command->>'reason',''));
 stamp timestamptz:=clock_timestamp(); before_value jsonb; after_value jsonb; pickup date; delivery date;
 origin_place place_catalog%rowtype; destination_place place_catalog%rowtype; cargo text;
begin
 if jsonb_typeof(command)<>'object' or action_value is null or action_value not in ('CORRECT','REASSIGN','CANCEL')
  or char_length(reason_value) not between 5 and 500 then raise exception 'INVALID_LIFECYCLE_COMMAND';end if;
 if exists(select 1 from jsonb_object_keys(command) k where k not in ('action','reason','revision','cargo_summary','origin_place_ref','destination_place_ref','expected_pickup_date','expected_delivery_date','vehicle_id','confirm')) then raise exception 'INVALID_LIFECYCLE_COMMAND';end if;
 select * into shipment from provider_shipments where id=target_shipment_id for update;
 if not found or not lifecycle_actor_can_manage(actor_user_id,shipment.provider_organization_id,shipment.provider_profile_id) then raise exception 'NOT_FOUND';end if;
 if shipment.operational_status in ('COMPLETED','CANCELLED') then raise exception 'TRACKING_TERMINAL';end if;
 if nullif(command->>'revision','')::timestamptz is distinct from shipment.updated_at then raise exception 'TRACKING_CHANGED';end if;
 before_value:=jsonb_build_object('status',shipment.operational_status,'vehicle_id',shipment.assigned_vehicle_id,
  'driver_id',shipment.assigned_driver_user_id,'cargo_summary',shipment.cargo_summary,'origin_place_ref',shipment.origin_place_ref,
  'destination_place_ref',shipment.destination_place_ref,'pickup_date',shipment.expected_pickup_date,'delivery_date',shipment.expected_delivery_date);
 if action_value='CANCEL' then
  if command->>'confirm' is distinct from 'CANCEL' then raise exception 'LIFECYCLE_CONFIRMATION_REQUIRED';end if;
  update provider_shipments set operational_status='CANCELLED',guest_expires_at=stamp,location_reset_at=stamp,updated_at=stamp where id=shipment.id;
  update shipment_party_grants set revoked_at=stamp,expires_at=stamp where shipment_id=shipment.id;
  update provider_tracking_recipients set revoked_at=stamp,revoked_by=actor_user_id where shipment_id=shipment.id and revoked_at is null;
  update provider_tracking_email_otps set superseded_at=stamp where shipment_id=shipment.id and used_at is null;
 elsif action_value='REASSIGN' then
  select * into vehicle from vehicles where (id::text=trim(command->>'vehicle_id') or platform_number=trim(command->>'vehicle_id')) and active for update;
  if not found or vehicle.organization_id is distinct from shipment.provider_organization_id
   or vehicle.provider_profile_id is distinct from shipment.provider_profile_id then raise exception 'INVALID_VEHICLE';end if;
  driver_id:=capacity_active_driver_id(vehicle.id);
  if driver_id is null or exists(select 1 from driver_permissions where user_id=driver_id and not can_manage_tracking) then raise exception 'DRIVER_REQUIRED_FOR_SHIPMENT';end if;
  if vehicle.id=shipment.assigned_vehicle_id and driver_id=shipment.assigned_driver_user_id then raise exception 'TRACKING_ASSIGNMENT_UNCHANGED';end if;
  update provider_shipments set assigned_vehicle_id=vehicle.id,assigned_driver_user_id=driver_id,location_reset_at=stamp,updated_at=stamp where id=shipment.id;
 else
  cargo:=trim(coalesce(command->>'cargo_summary',''));
  if char_length(cargo) not between 3 and 500 then raise exception 'INVALID_CARGO_SUMMARY';end if;
  pickup:=nullif(command->>'expected_pickup_date','')::date;delivery:=nullif(command->>'expected_delivery_date','')::date;
  if pickup is not null and delivery is not null and delivery<pickup then raise exception 'INVALID_DELIVERY_DATE';end if;
  select * into origin_place from place_catalog where id=command->>'origin_place_ref';
  if not found then raise exception 'LOCALITY_REQUIRED';end if;
  select * into destination_place from place_catalog where id=command->>'destination_place_ref';
  if not found then raise exception 'LOCALITY_REQUIRED';end if;
  if origin_place.id=destination_place.id then raise exception 'ROUTE_LOCATIONS_MUST_DIFFER';end if;
  if shipment.operational_status not in ('CREATED','TO_PICKUP') and (origin_place.id<>shipment.origin_place_ref or destination_place.id<>shipment.destination_place_ref) then raise exception 'TRACKING_ROUTE_LOCKED';end if;
  update provider_shipments set cargo_summary=cargo,expected_pickup_date=pickup,expected_delivery_date=delivery,
   origin=concat_ws(', ',origin_place.name,origin_place.parent_name,coalesce(origin_place.country_name,'Ethiopia')),
   origin_place_ref=origin_place.id,origin_lat=origin_place.latitude,origin_lng=origin_place.longitude,
   destination=concat_ws(', ',destination_place.name,destination_place.parent_name,coalesce(destination_place.country_name,'Ethiopia')),
   destination_place_ref=destination_place.id,destination_lat=destination_place.latitude,destination_lng=destination_place.longitude,
   updated_at=stamp where id=shipment.id;
 end if;
 select jsonb_build_object('status',operational_status,'vehicle_id',assigned_vehicle_id,'driver_id',assigned_driver_user_id,
  'cargo_summary',cargo_summary,'origin_place_ref',origin_place_ref,'destination_place_ref',destination_place_ref,
  'pickup_date',expected_pickup_date,'delivery_date',expected_delivery_date) into after_value from provider_shipments where id=shipment.id;
 insert into provider_tracking_recoveries(shipment_id,actor_user_id,action,reason,before_state,after_state,created_at)
 values(shipment.id,actor_user_id,action_value,reason_value,before_value,after_value,stamp);
 insert into provider_shipment_events(shipment_id,status,event_type,note,created_by,created_at)
 values(shipment.id,after_value->>'status','STATUS',case action_value when 'CANCEL' then 'Tracking cancelled by the provider or authorized team'
  when 'REASSIGN' then 'Tracking truck or Driver reassigned' else 'Tracking details corrected' end,actor_user_id,stamp);
 insert into audit_logs(actor_user_id,organization_id,action,entity_type,entity_id,details,created_at)
 values(actor_user_id,shipment.provider_organization_id,'PROVIDER_TRACKING_RECOVERED','provider_shipment',shipment.id,
  jsonb_build_object('action',action_value,'reason',reason_value,'before',before_value,'after',after_value),stamp);
 return jsonb_build_object('updated',true,'status',after_value->>'status');
exception when invalid_datetime_format or datetime_field_overflow then raise exception 'INVALID_DELIVERY_DATE';
end $$;

-- Precisely extend existing projections and lock boundaries; reject unexpected source drift.
do $migration$
declare signature text; definition text; fragment text; replacement text;
begin
 foreach signature in array array['public.provider_tracking_detail(uuid,text)','public.provider_guest_tracking(uuid,text)','public.update_provider_tracking_location(uuid,uuid,jsonb)'] loop
  definition:=pg_get_functiondef(signature::regprocedure);
  fragment:='event.shipment_id=shipment.id and event.location_source=''DEVICE_OBSCURED''';
  if length(definition)-length(replace(definition,fragment,''))<>length(fragment) then raise exception 'TRACKING_LOCATION_BOUNDARY_NOT_FOUND: %',signature;end if;
  execute replace(definition,fragment,fragment||' and (shipment.location_reset_at is null or event.created_at>=shipment.location_reset_at)');
 end loop;
 foreach signature in array array['public.publish_provider_capacity(uuid,jsonb)','public.refresh_provider_capacity_location(uuid,jsonb)','public.set_provider_assigned_vehicle_duty(uuid,jsonb)'] loop
  definition:=pg_get_functiondef(signature::regprocedure);
  fragment:=case when signature like '%set_provider_assigned%' then 'and assignment.driver_user_id=actor_user_id;' else E'  );\n  if not found then raise exception ''INVALID_VEHICLE''; end if;' end;
  replacement:=case when signature like '%set_provider_assigned%' then 'and assignment.driver_user_id=actor_user_id for update of candidate;' else E'  ) for update of candidate;\n  if not found then raise exception ''INVALID_VEHICLE''; end if;' end;
  if length(definition)-length(replace(definition,fragment,''))<>length(fragment) then raise exception 'VEHICLE_LOCK_BOUNDARY_NOT_FOUND: %',signature;end if;
  execute replace(definition,fragment,replacement);
 end loop;
 foreach signature in array array['public.update_provider_tracking_status(uuid,uuid,jsonb)','public.update_provider_tracking_location(uuid,uuid,jsonb)'] loop
  definition:=pg_get_functiondef(signature::regprocedure);
  fragment:='select * into shipment from public.provider_shipments where id=target_shipment_id for update;';
  if position(fragment in definition)=0 then raise exception 'TRACKING_WRITE_LOCK_NOT_FOUND';end if;
  execute replace(definition,fragment,fragment||E'\n  if not public.provider_tracking_actor_owns_shipment(actor_user_id,target_shipment_id) then raise exception ''NOT_FOUND''; end if;');
 end loop;
 definition:=pg_get_functiondef('public.create_provider_tracking(uuid,jsonb)'::regprocedure);
 fragment:='where id=(command->>''vehicle_id'')::uuid and active;';
 if position(fragment in definition)=0 then raise exception 'TRACKING_CREATE_LOCK_NOT_FOUND';end if;
 execute replace(definition,fragment,'where id=(command->>''vehicle_id'')::uuid and active for update;');
 definition:=pg_get_functiondef('public.managed_admin_record_command(uuid,text,uuid,jsonb)'::regprocedure);
 fragment:='if selected_type=''VEHICLE'' and action_name=''SET_ACTIVE'' then';
 if position(fragment in definition)=0 then raise exception 'ADMIN_VEHICLE_LIFECYCLE_NOT_FOUND';end if;
 execute replace(definition,fragment,fragment||E'\n    if not public.managed_actor_has_permission(actor_user_id,''OPERATIONS'') then raise exception ''FORBIDDEN''; end if;\n    return public.set_vehicle_lifecycle(actor_user_id,record_id,active_value,coalesce(nullif(command->>''reason'',''''),''Administrative truck status change''));');
 foreach signature in array array['lifecycle_actor_can_manage(uuid,uuid,uuid)','set_vehicle_lifecycle(uuid,uuid,boolean,text)',
 'retired_provider_vehicle_page(uuid,integer,integer)','tracking_recovery_context(uuid,uuid)','recover_provider_tracking(uuid,uuid,jsonb)'] loop
  execute format('revoke all on function public.%s from public,anon,authenticated',signature);
  execute format('grant execute on function public.%s to service_role',signature);
 end loop;
end $migration$;
