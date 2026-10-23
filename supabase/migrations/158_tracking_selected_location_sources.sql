-- FEAT-TRK/ENT/SIM-001. Resolve the selected truck source independently of
-- Capacity publication. Recipient authority is enforced before any point leaves SQL.
begin;
-- The duty command must retain either kind of provider anchor. Its legacy
-- company-only INSERT lost the individual provider anchor when going Off duty.
do $duty_scope$
declare definition text;before_text text:='created_id,vehicle.organization_id,null,vehicle.id,';
begin
 definition:=pg_get_functiondef('public.set_provider_assigned_vehicle_duty_pre_phone157(uuid,jsonb)'::regprocedure);
 if (length(definition)-length(replace(definition,before_text,'')))/length(before_text)<>1 then raise exception 'DUTY_PROVIDER_SCOPE_DRIFT';end if;
 execute replace(definition,before_text,'created_id,vehicle.organization_id,vehicle.provider_profile_id,vehicle.id,');
end $duty_scope$;
select pg_advisory_xact_lock(8030158);

alter table public.provider_shipments add column tracking_precision_km integer
 check(tracking_precision_km in(1,3,5,10,20));
alter table public.provider_shipments alter column tracking_precision_km set default 10;

create function public.remember_tracking_location_precision() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if new.revoked_at is null and new.expires_at>clock_timestamp() then
  update provider_shipments set tracking_precision_km=new.privacy_km
   where id=new.shipment_id and assigned_driver_user_id=new.driver_user_id
   and tracking_mode='LOCATION_AND_STATUS' and operational_status not in('COMPLETED','CANCELLED');
 end if;
 return new;
end $$;
revoke all on function public.remember_tracking_location_precision() from public,anon,authenticated,service_role;
create trigger remember_tracking_location_precision after insert or update of privacy_km on public.tracking_device_leases
 for each row execute function public.remember_tracking_location_precision();

-- Internal resolver: no direct HTTP/PostgREST/service-role execution authority.
-- Callers must first authorize the provider or exact verified recipient.
create function public.tracking_selected_location(target_shipment_id uuid)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare shipment provider_shipments%rowtype;selected telematics_location_sources%rowtype;
 assignment telematics_device_assignments%rowtype;fix telematics_positions%rowtype;
 phone record;point jsonb;boundary timestamptz;radius integer;driver_started timestamptz;
begin
 select * into shipment from provider_shipments where id=target_shipment_id;
 if not found or shipment.tracking_mode<>'LOCATION_AND_STATUS'
  or shipment.operational_status in('COMPLETED','CANCELLED') then return null;end if;
 if not exists(select 1 from vehicles where id=shipment.assigned_vehicle_id and active)
  or public.capacity_active_driver_id(shipment.assigned_vehicle_id) is distinct from shipment.assigned_driver_user_id
  or not public.provider_tracking_actor_owns_shipment(shipment.assigned_driver_user_id,shipment.id)
  then return null;end if;
 select max(assigned_at) into driver_started from driver_vehicle_assignments
  where vehicle_id=shipment.assigned_vehicle_id and driver_user_id=shipment.assigned_driver_user_id and active;
 select * into selected from telematics_location_sources where vehicle_id=shipment.assigned_vehicle_id;
 boundary:=greatest(coalesce(shipment.location_reset_at,'-infinity'::timestamptz),
  coalesce(selected.selected_at,'-infinity'::timestamptz),coalesce(driver_started,'-infinity'::timestamptz));
 radius:=coalesce(shipment.tracking_precision_km,10);
 if selected.source='MANUAL' then
  if selected.selected_at<greatest(coalesce(shipment.location_reset_at,'-infinity'::timestamptz),
   coalesce(driver_started,'-infinity'::timestamptz)) then return null;end if;
  point:=public.telematics_obscure(selected.manual_latitude,selected.manual_longitude,radius);
  return jsonb_build_object('location_lat',point->'latitude','location_lng',point->'longitude',
   'location_precision_km',radius,'location_area','Approximate location',
   'location_source','MANUAL_ADMIN','updated_at',selected.selected_at);
 elsif selected.source='GPS' then
  select a.* into assignment from telematics_device_assignments a
   join telematics_devices d on d.id=a.device_id and d.active
   join vehicles v on v.id=a.vehicle_id and v.active
    and v.organization_id is not distinct from d.organization_id
    and v.provider_profile_id is not distinct from d.provider_profile_id
   where a.vehicle_id=shipment.assigned_vehicle_id and a.ended_at is null;
  if not found then return null;end if;
  select p.* into fix from telematics_positions p
   where p.device_id=assignment.device_id and p.assignment_id=assignment.id
   and p.vehicle_id=shipment.assigned_vehicle_id and p.valid
   and p.observed_at>=greatest(boundary,assignment.assigned_at,shipment.created_at)
   and p.observed_at<=clock_timestamp() order by p.observed_at desc,p.id desc limit 1;
  if not found then return null;end if;
  point:=public.telematics_obscure(fix.latitude,fix.longitude,radius);
  return jsonb_build_object('location_lat',point->'latitude','location_lng',point->'longitude',
   'location_precision_km',radius,'location_area','Approximate location',
   'location_source','TELEMATICS','updated_at',fix.observed_at,'is_demo',fix.demo_epoch is not null);
 end if;
 -- MOBILE: preserve the already-obscured phone radius. Never make an older
 -- broad phone report appear more precise by changing metadata or obscuring twice.
 select candidate.* into phone from(
  select e.location_lat as latitude,e.location_lng as longitude,
   e.location_precision_km as precision_km,e.location_area as area,
   coalesce(e.location_observed_at,e.created_at) as observed_at,false as is_demo
   from provider_shipment_events e where e.shipment_id=shipment.id
   and e.created_by=shipment.assigned_driver_user_id and e.location_source='DEVICE_OBSCURED'
   and coalesce(e.location_observed_at,e.created_at)>=greatest(boundary,shipment.created_at)
   and coalesce(e.location_observed_at,e.created_at)<=clock_timestamp()
   and(e.phone_binding_id is null and not exists(select 1 from phone_location_bindings b
    where b.vehicle_id=shipment.assigned_vehicle_id and public.phone_location_binding_is_current(b.id))
    or exists(select 1 from phone_location_bindings b where b.id=e.phone_binding_id
     and b.vehicle_id=shipment.assigned_vehicle_id and b.actor_user_id=shipment.assigned_driver_user_id
     and public.phone_location_binding_is_current(b.id)))
  union all
  select p.latitude,p.longitude,p.precision_km,p.area,coalesce(p.observed_at,p.updated_at),p.demo_epoch is not null from vehicle_driver_locations p
   where p.vehicle_id=shipment.assigned_vehicle_id and p.driver_user_id=shipment.assigned_driver_user_id
   and coalesce(p.observed_at,p.updated_at)>=greatest(boundary,shipment.created_at)
   and coalesce(p.observed_at,p.updated_at)<=clock_timestamp()
   and(p.phone_binding_id is null and not exists(select 1 from phone_location_bindings b
    where b.vehicle_id=shipment.assigned_vehicle_id and public.phone_location_binding_is_current(b.id))
    or exists(select 1 from phone_location_bindings b where b.id=p.phone_binding_id
     and b.vehicle_id=shipment.assigned_vehicle_id and b.actor_user_id=shipment.assigned_driver_user_id
     and public.phone_location_binding_is_current(b.id)))
 ) candidate where candidate.precision_km in(1,3,5,10,20)
  and candidate.latitude between -90 and 90 and candidate.longitude between -180 and 180
 order by candidate.observed_at desc limit 1;
 if not found then return null;end if;
 return jsonb_build_object('location_lat',phone.latitude,'location_lng',phone.longitude,
  'location_precision_km',phone.precision_km,'location_area',phone.area,
  'location_source','DEVICE_OBSCURED','updated_at',phone.observed_at,'is_demo',phone.is_demo);
end $$;
revoke all on function public.tracking_selected_location(uuid) from public,anon,authenticated,service_role;

create or replace function public.provider_tracking_detail(actor_user_id uuid,shipment_lookup text) returns jsonb
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare result jsonb;shipment_id uuid;
begin
 result:=public.provider_tracking_detail_pre_route_map(actor_user_id,shipment_lookup);
 if result is null then return null;end if;
 shipment_id:=(result->>'id')::uuid;
 return result||jsonb_build_object('route',public.tracking_route_projection(shipment_id),
  'public_truck_summary',public.tracking_public_truck_summary(shipment_id),
  'latest_location',public.tracking_selected_location(shipment_id),'can_view_location',true);
end $$;

-- A party role alone is not identity. The exact-recipient wrapper below restores
-- a position only after verifying an active OWNER recipient and grant.
create or replace function public.provider_guest_tracking(target_shipment_id uuid,requested_party_role text) returns jsonb
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare result jsonb;
begin
 result:=public.provider_guest_tracking_pre_route_map(target_shipment_id,requested_party_role);
 if result is null then return null;end if;
 return (result-'latest_location')||jsonb_build_object('provider_name',(
  select coalesce(o.name,public.public_person_first_name(p.user_id)) from provider_shipments s
  left join organizations o on o.id=s.provider_organization_id
  left join provider_profiles p on p.id=s.provider_profile_id where s.id=target_shipment_id),
  'route',public.tracking_route_projection(target_shipment_id),
  'public_truck_summary',public.tracking_public_truck_summary(target_shipment_id),
  'current_location',null,'can_view_location',false);
end $$;

create or replace function public.provider_guest_tracking_for_recipient(target_shipment_id uuid,requested_recipient_digest text)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare recipient_role text;result jsonb;is_owner boolean;
begin
 select party.recipient_role into recipient_role
  from provider_tracking_recipients party join shipment_party_grants g
   on g.shipment_id=party.shipment_id and g.party_role='SHIPPER'
  join provider_shipments shipment on shipment.id=party.shipment_id
  where party.shipment_id=target_shipment_id and party.recipient_email_digest=requested_recipient_digest
   and party.revoked_at is null and g.revoked_at is null
   and(g.expires_at is null or g.expires_at>clock_timestamp())
   and(shipment.guest_expires_at is null or shipment.guest_expires_at>clock_timestamp())
  order by party.created_at desc,party.id limit 1;
 if not found then return null;end if;
 result:=public.provider_guest_tracking(target_shipment_id,'SHIPPER');
 if result is null then return null;end if;
 is_owner:=recipient_role='OWNER';
 result:=result||jsonb_build_object('recipient_role',recipient_role,
  'party_role',case when is_owner then 'SHIPPER' else 'RECEIVER' end,
  'can_view_location',is_owner,
  'current_location',case when is_owner then public.tracking_selected_location(target_shipment_id) else null end,
  'can_review',is_owner and coalesce((result->>'can_review')::boolean,false),
  'review',case when is_owner then result->'review' else null end,
  'can_approve',is_owner and result->>'operational_status'='UNLOADING'
   and exists(select 1 from provider_shipment_events e where e.shipment_id=target_shipment_id and e.status='UNLOADING' and e.proof_storage_path is not null)
   and exists(select 1 from provider_shipment_events e where e.shipment_id=target_shipment_id and e.status='LOADING' and e.proof_storage_path is not null));
 result:=jsonb_set(result,'{events}',coalesce((
  select jsonb_agg((entry.value-'proof_storage_path'-'proof_url')||jsonb_build_object('has_proof',
   is_owner and exists(select 1 from provider_shipment_events event
    where event.id=(entry.value->>'id')::uuid and event.shipment_id=target_shipment_id
     and event.proof_storage_path is not null)) order by entry.ordinality)
  from jsonb_array_elements(result->'events') with ordinality entry(value,ordinality)
 ),'[]'::jsonb));
 return result;
end $$;

do $proof_boundary$
declare definition text;anchor text:='authorized:=public.provider_guest_tracking_for_recipient(target_shipment_id,requested_recipient_digest) is not null;';
begin
 definition:=pg_get_functiondef('public.provider_tracking_proof_file(uuid,uuid,uuid,text)'::regprocedure);
 if (length(definition)-length(replace(definition,anchor,'')))/length(anchor)<>1 then raise exception 'TRACKING_PROOF_FUNCTION_DRIFT';end if;
 execute replace(definition,anchor,$replacement$authorized:=coalesce(public.provider_guest_tracking_for_recipient(target_shipment_id,requested_recipient_digest)->>'recipient_role'='OWNER',false);$replacement$);
end $proof_boundary$;

revoke all on function public.provider_tracking_detail(uuid,text),public.provider_guest_tracking(uuid,text),
 public.provider_guest_tracking_for_recipient(uuid,text) from public,anon,authenticated;
grant execute on function public.provider_tracking_detail(uuid,text),public.provider_guest_tracking(uuid,text),
 public.provider_guest_tracking_for_recipient(uuid,text) to service_role;
commit;
