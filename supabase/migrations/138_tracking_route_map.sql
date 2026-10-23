-- FEAT-TRK-001: additive route snapshots and caller-authorized map projections.
begin;
alter table public.provider_shipments
 add column passing_place_ref text references public.place_catalog(id),
 add column passing text,
 add column passing_lat double precision,
 add column passing_lng double precision,
 add constraint provider_tracking_passing_snapshot check (
  (passing_place_ref is null and passing is null and passing_lat is null and passing_lng is null)
  or (passing_place_ref is not null and passing is not null and passing_lat is not null and passing_lng is not null
   and passing_lat between -90 and 90 and passing_lng between -180 and 180)
 );
comment on column public.provider_shipments.passing_place_ref is 'Required catalog city for new Tracking; NULL preserves genuine legacy two-city shipments.';

-- Keep the exact governed pre-migration definitions for a reviewed app rollback.
do $backup$
declare name text;signature text;definition text;
begin
 for name,signature in values ('create_provider_tracking','uuid,jsonb'),('provider_tracking_detail','uuid,text'),
  ('provider_guest_tracking','uuid,text'),('tracking_recovery_context','uuid,uuid'),('recover_provider_tracking','uuid,uuid,jsonb')
 loop
  if to_regprocedure('public.'||name||'_pre_route_map('||signature||')') is not null then raise exception 'TRACKING_ROUTE_BACKUP_EXISTS';end if;
  definition:=pg_get_functiondef(to_regprocedure('public.'||name||'('||signature||')'));
  if definition is null then raise exception 'TRACKING_ROUTE_BASE_CONTRACT';end if;
  execute replace(definition,'FUNCTION public.'||name||'(','FUNCTION public.'||name||'_pre_route_map(');
  execute format('revoke all on function public.%I(%s) from public,anon,authenticated,service_role',name||'_pre_route_map',signature);
 end loop;
end $backup$;

create function public.tracking_route_projection(target_shipment_id uuid) returns jsonb
language sql stable security definer set search_path=public,pg_temp as $$
 select jsonb_build_array(jsonb_build_object('placeRef',s.origin_place_ref,'label',s.origin,'coordinate',jsonb_build_array(s.origin_lng,s.origin_lat)))
  ||case when s.passing_place_ref is null then '[]'::jsonb else jsonb_build_array(jsonb_build_object('placeRef',s.passing_place_ref,'label',s.passing,'coordinate',jsonb_build_array(s.passing_lng,s.passing_lat))) end
  ||jsonb_build_array(jsonb_build_object('placeRef',s.destination_place_ref,'label',s.destination,'coordinate',jsonb_build_array(s.destination_lng,s.destination_lat)))
 from public.provider_shipments s where s.id=target_shipment_id
$$;

-- Mirror published identity/contact policy without requiring available capacity.
create function public.tracking_public_truck_summary(target_shipment_id uuid) returns jsonb
language sql stable security definer set search_path=public,pg_temp as $$
 select jsonb_build_object('platformNumber',v.platform_number,'make',v.make,'model',v.model,'configuration',v.cargo_configuration,
  'providerName',coalesce(o.name,p.business_name),'providerHandle',coalesce(o.handle,p.handle),
  'driverName',case when page.id is not null then driver_public.first_name end,
  'driverPhone',case when page.id is not null then coalesce(fleet_driver.phone,case when page.show_contact_phone then page.contact_phone end) end,
  'contactPhone',case when page.show_contact_phone then page.contact_phone end)
 from public.provider_shipments s join public.vehicles v on v.id=s.assigned_vehicle_id
 left join public.organizations o on o.id=s.provider_organization_id
 left join public.provider_profiles p on p.id=s.provider_profile_id
 left join public.profiles driver on driver.id=s.assigned_driver_user_id and driver.active
 left join lateral public.public_provider_driver_names(array[s.assigned_driver_user_id]) driver_public on true
 left join public.drivers fleet_driver on fleet_driver.user_id=driver.id and fleet_driver.active and fleet_driver.organization_id=s.provider_organization_id
 left join public.company_pages page on page.published and (page.organization_id=s.provider_organization_id or page.provider_profile_id=s.provider_profile_id)
 where s.id=target_shipment_id and public.capacity_public_policy_allows(v.id)
$$;
revoke all on function public.tracking_route_projection(uuid),public.tracking_public_truck_summary(uuid) from public,anon,authenticated,service_role;

create or replace function public.create_provider_tracking(actor_user_id uuid,command jsonb) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare city public.place_catalog%rowtype;origin_city public.place_catalog%rowtype;destination_city public.place_catalog%rowtype;result jsonb;
begin
 select * into city from public.place_catalog where id=nullif(trim(command->>'passing_place_ref'),'');
 if not found or city.latitude is null or city.longitude is null or city.latitude not between -90 and 90 or city.longitude not between -180 and 180 then raise exception 'LOCALITY_REQUIRED';end if;
 select * into origin_city from public.place_catalog where id=nullif(trim(command->>'origin_place_ref'),'');
 if not found or origin_city.latitude is null or origin_city.longitude is null or origin_city.latitude not between -90 and 90 or origin_city.longitude not between -180 and 180 then raise exception 'LOCALITY_REQUIRED';end if;
 select * into destination_city from public.place_catalog where id=nullif(trim(command->>'destination_place_ref'),'');
 if not found or destination_city.latitude is null or destination_city.longitude is null or destination_city.latitude not between -90 and 90 or destination_city.longitude not between -180 and 180 then raise exception 'LOCALITY_REQUIRED';end if;
 if city.id=origin_city.id or city.id=destination_city.id or origin_city.id=destination_city.id then raise exception 'ROUTE_LOCATIONS_MUST_DIFFER';end if;
 result:=public.create_provider_tracking_pre_route_map(actor_user_id,command);
 update public.provider_shipments set passing_place_ref=city.id,
  passing=concat_ws(', ',city.name,case when city.parent_name is not null and lower(city.parent_name)<>lower(city.name) then city.parent_name end,coalesce(city.country_name,'Ethiopia')),
  passing_lat=city.latitude,passing_lng=city.longitude where id=(result->>'id')::uuid;
 return result;
end $$;

create or replace function public.provider_tracking_detail(actor_user_id uuid,shipment_lookup text) returns jsonb
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare result jsonb;shipment_id uuid;
begin
 result:=public.provider_tracking_detail_pre_route_map(actor_user_id,shipment_lookup);
 if result is null then return null;end if;
 shipment_id:=(result->>'id')::uuid;
 return result||jsonb_build_object('route',public.tracking_route_projection(shipment_id),'public_truck_summary',public.tracking_public_truck_summary(shipment_id));
end $$;
create or replace function public.provider_guest_tracking(target_shipment_id uuid,requested_party_role text) returns jsonb
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare result jsonb;
begin
 result:=public.provider_guest_tracking_pre_route_map(target_shipment_id,requested_party_role);
 if result is null then return null;end if;
 return result||jsonb_build_object('route',public.tracking_route_projection(target_shipment_id),'public_truck_summary',public.tracking_public_truck_summary(target_shipment_id));
end $$;
create or replace function public.tracking_recovery_context(actor_user_id uuid,target_shipment_id uuid) returns jsonb
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare result jsonb;
begin
 result:=public.tracking_recovery_context_pre_route_map(actor_user_id,target_shipment_id);
 if result is null then return null;end if;
 return result||(select jsonb_build_object('passing',s.passing,'passing_place_ref',s.passing_place_ref) from public.provider_shipments s where s.id=target_shipment_id);
end $$;
create or replace function public.recover_provider_tracking(actor_user_id uuid,target_shipment_id uuid,command jsonb) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare shipment public.provider_shipments%rowtype;city public.place_catalog%rowtype;origin_city public.place_catalog%rowtype;destination_city public.place_catalog%rowtype;passing_ref text;result jsonb;stamp timestamptz:=clock_timestamp();
begin
 select * into shipment from public.provider_shipments where id=target_shipment_id for update;
 if not found or not public.lifecycle_actor_can_manage(actor_user_id,shipment.provider_organization_id,shipment.provider_profile_id) then raise exception 'NOT_FOUND';end if;
 if command->>'action'='CORRECT' then
  select * into origin_city from public.place_catalog where id=nullif(trim(command->>'origin_place_ref'),'');
  if not found or origin_city.latitude is null or origin_city.longitude is null or origin_city.latitude not between -90 and 90 or origin_city.longitude not between -180 and 180 then raise exception 'LOCALITY_REQUIRED';end if;
  select * into destination_city from public.place_catalog where id=nullif(trim(command->>'destination_place_ref'),'');
  if not found or destination_city.latitude is null or destination_city.longitude is null or destination_city.latitude not between -90 and 90 or destination_city.longitude not between -180 and 180 then raise exception 'LOCALITY_REQUIRED';end if;
  if origin_city.id=destination_city.id then raise exception 'ROUTE_LOCATIONS_MUST_DIFFER';end if;
  passing_ref:=case when command?'passing_place_ref' then nullif(trim(command->>'passing_place_ref'),'') else shipment.passing_place_ref end;
  if passing_ref is null and shipment.passing_place_ref is not null then raise exception 'LOCALITY_REQUIRED';end if;
  if passing_ref is not null then
   select * into city from public.place_catalog where id=passing_ref;
   if not found or city.latitude is null or city.longitude is null or city.latitude not between -90 and 90 or city.longitude not between -180 and 180 then raise exception 'LOCALITY_REQUIRED';end if;
   if city.id=origin_city.id or city.id=destination_city.id then raise exception 'ROUTE_LOCATIONS_MUST_DIFFER';end if;
  end if;
  if shipment.operational_status not in ('CREATED','TO_PICKUP') and passing_ref is distinct from shipment.passing_place_ref then raise exception 'TRACKING_ROUTE_LOCKED';end if;
  command:=command||jsonb_build_object('origin_place_ref',origin_city.id,'destination_place_ref',destination_city.id);
 elsif command?'passing_place_ref' then raise exception 'INVALID_LIFECYCLE_COMMAND';end if;
 result:=public.recover_provider_tracking_pre_route_map(actor_user_id,target_shipment_id,command-'passing_place_ref');
 if command->>'action'='CORRECT' then
  update public.provider_shipments set passing_place_ref=passing_ref,
   passing=case when passing_ref is null then null else concat_ws(', ',city.name,case when city.parent_name is not null and lower(city.parent_name)<>lower(city.name) then city.parent_name end,coalesce(city.country_name,'Ethiopia')) end,
   passing_lat=case when passing_ref is null then null else city.latitude end,passing_lng=case when passing_ref is null then null else city.longitude end where id=target_shipment_id;
 end if;
 update public.provider_tracking_recoveries set before_state=before_state||jsonb_build_object('passing_place_ref',shipment.passing_place_ref),
  after_state=after_state||jsonb_build_object('passing_place_ref',case when command->>'action'='CORRECT' then passing_ref else shipment.passing_place_ref end)
 where shipment_id=target_shipment_id and public.provider_tracking_recoveries.actor_user_id=recover_provider_tracking.actor_user_id and created_at>=stamp;
 return result;
end $$;
revoke all on function public.create_provider_tracking(uuid,jsonb),public.provider_tracking_detail(uuid,text),public.provider_guest_tracking(uuid,text),
 public.tracking_recovery_context(uuid,uuid),public.recover_provider_tracking(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.create_provider_tracking(uuid,jsonb),public.provider_tracking_detail(uuid,text),public.provider_guest_tracking(uuid,text),
 public.tracking_recovery_context(uuid,uuid),public.recover_provider_tracking(uuid,uuid,jsonb) to service_role;
commit;
