-- BASE-BE-001 / FEAT-SHP-001 / FEAT-TRK-001 / FEAT-REV-001
-- Provider-owned Tracking, customer-safe guest access, email delivery, and
-- verified provider reviews. Every actor-id command is service-role-only;
-- browser roles retain default-deny RLS on all private aggregate tables.

alter table public.provider_shipments
  add column if not exists review_code_hash text;

create unique index if not exists provider_shipments_review_code_hash_unique
  on public.provider_shipments(review_code_hash)
  where review_code_hash is not null;

create or replace function public.provider_tracking_actor_scope(actor_user_id uuid)
returns table(
  actor_role text,
  organization_id uuid,
  provider_profile_id uuid,
  is_company_driver boolean,
  can_manage_tracking boolean,
  workspace_access boolean
)
language sql
stable
security definer
set search_path=public,pg_temp
as $$
  select
    profile.role::text,
    membership.organization_id,
    provider.id,
    profile.role::text='DRIVER' and membership.organization_id is not null,
    case
      when profile.role::text='TRANSPORTER' then true
      when profile.role::text='DRIVER' and provider.id is not null then true
      when profile.role::text='DRIVER' and membership.organization_id is not null
        then coalesce(permission.can_manage_tracking,true)
      else false
    end,
    exists(
      select 1
      from public.subscriptions subscription
      where (subscription.organization_id=membership.organization_id
          or subscription.provider_profile_id=provider.id)
        and (
          subscription.status='SPONSORED'
          or subscription.status in ('TRIAL','ACTIVE') and subscription.ends_at>now()
        )
    )
  from public.profiles profile
  left join lateral (
    select member.organization_id
    from public.organization_members member
    where member.user_id=profile.id
    order by case when member.membership_role='OWNER' then 0 else 1 end,member.id
    limit 1
  ) membership on true
  left join public.provider_profiles provider on provider.user_id=profile.id
  left join public.driver_permissions permission on permission.user_id=profile.id
  where profile.id=actor_user_id
    and profile.active
    and profile.role::text in ('TRANSPORTER','DRIVER')
$$;

create or replace function public.provider_tracking_actor_owns_shipment(
  actor_user_id uuid,
  target_shipment_id uuid
)
returns boolean
language sql
stable
security definer
set search_path=public,pg_temp
as $$
  select exists(
    select 1
    from public.provider_tracking_actor_scope(actor_user_id) actor
    join public.provider_shipments shipment on shipment.id=target_shipment_id
    where actor.workspace_access and actor.can_manage_tracking and (
      actor.actor_role='TRANSPORTER'
        and shipment.provider_organization_id=actor.organization_id
      or actor.actor_role='DRIVER' and actor.provider_profile_id is not null
        and shipment.provider_profile_id=actor.provider_profile_id
        and shipment.assigned_driver_user_id=actor_user_id
      or actor.is_company_driver
        and shipment.provider_organization_id=actor.organization_id
        and shipment.assigned_driver_user_id=actor_user_id
        and exists(
          select 1 from public.driver_vehicle_assignments assignment
          where assignment.driver_user_id=actor_user_id
            and assignment.vehicle_id=shipment.assigned_vehicle_id
            and assignment.active
        )
    )
  )
$$;

create or replace function public.provider_tracking_workspace(
  actor_user_id uuid,
  requested_limit integer default 50
)
returns jsonb
language plpgsql
stable
security definer
set search_path=public,pg_temp
as $$
declare
  actor record;
  vehicles jsonb:='[]'::jsonb;
  shipments jsonb:='[]'::jsonb;
  bounded_limit integer:=greatest(1,least(coalesce(requested_limit,50),100));
begin
  select * into actor from public.provider_tracking_actor_scope(actor_user_id);
  if not found then raise exception 'FORBIDDEN'; end if;
  if not actor.workspace_access then raise exception 'SUBSCRIPTION_ACCESS_REQUIRED'; end if;

  if actor.can_manage_tracking then
    select coalesce(jsonb_agg(jsonb_build_object(
      'id',vehicle.id,'label',vehicle.label,'category',vehicle.category,
      'make',vehicle.make,'model',vehicle.model,
      'cargo_configuration',vehicle.cargo_configuration,'plate',vehicle.plate,
      'platform_number',vehicle.platform_number,'active',vehicle.active
    ) order by vehicle.label,vehicle.id),'[]'::jsonb)
    into vehicles
    from public.vehicles vehicle
    where vehicle.active and (
      actor.actor_role='TRANSPORTER' and vehicle.organization_id=actor.organization_id
      or actor.actor_role='DRIVER' and actor.provider_profile_id is not null
        and vehicle.provider_profile_id=actor.provider_profile_id
      or actor.is_company_driver and vehicle.organization_id=actor.organization_id and exists(
        select 1 from public.driver_vehicle_assignments assignment
        where assignment.driver_user_id=actor_user_id
          and assignment.vehicle_id=vehicle.id and assignment.active
      )
    );

    with authorized as (
      select shipment.*,vehicle.platform_number,vehicle.make as vehicle_make,
        vehicle.model as vehicle_model,driver.full_name as driver_name
      from public.provider_shipments shipment
      join public.vehicles vehicle on vehicle.id=shipment.assigned_vehicle_id
      join public.profiles driver on driver.id=shipment.assigned_driver_user_id
      where public.provider_tracking_actor_owns_shipment(actor_user_id,shipment.id)
      order by shipment.updated_at desc,shipment.id desc
      limit bounded_limit
    )
    select coalesce(jsonb_agg(to_jsonb(authorized) order by authorized.updated_at desc,authorized.id desc),'[]'::jsonb)
    into shipments from authorized;
  end if;

  return jsonb_build_object(
    'vehicles',vehicles,
    'shipments',shipments,
    'access',jsonb_build_object(
      'kind',case when actor.is_company_driver then 'COMPANY' else 'SELF_MANAGED' end,
      'can_manage_tracking',actor.can_manage_tracking
    )
  );
end;
$$;

create or replace function public.create_provider_tracking(
  actor_user_id uuid,
  command jsonb
)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  actor record;
  vehicle public.vehicles%rowtype;
  assigned_driver_id uuid;
  origin_place public.place_catalog%rowtype;
  destination_place public.place_catalog%rowtype;
  shipment_id uuid;
  shipment_code text:=upper(trim(coalesce(command->>'code','')));
  customer_email text:=lower(trim(coalesce(command->>'customer_email','')));
  cargo text:=trim(coalesce(command->>'cargo_summary',''));
  tracking_mode_value text:=upper(trim(coalesce(command->>'tracking_mode','STATUS_ONLY')));
  pickup_date date;
  delivery_date date;
  tracking_digest text:=trim(coalesce(command->>'tracking_code_hash',''));
  review_digest text:=trim(coalesce(command->>'review_code_hash',''));
  timestamp_value timestamptz:=clock_timestamp();
begin
  select * into actor from public.provider_tracking_actor_scope(actor_user_id);
  if not found or not actor.can_manage_tracking then raise exception 'FORBIDDEN'; end if;
  if not actor.workspace_access then raise exception 'SUBSCRIPTION_ACCESS_REQUIRED'; end if;

  begin shipment_id:=(command->>'id')::uuid;
  exception when invalid_text_representation then raise exception 'INVALID_TRACKING_INPUT'; end;
  if shipment_code!~'^LGX-[A-F0-9]{8}$' then raise exception 'INVALID_TRACKING_INPUT'; end if;
  if length(tracking_digest)<32 or length(review_digest)<32 then raise exception 'INVALID_TRACKING_INPUT'; end if;
  if customer_email!~'^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or length(customer_email)>254 then
    raise exception 'INVALID_EMAIL';
  end if;
  if length(cargo)<3 or length(cargo)>500 then raise exception 'INVALID_CARGO_SUMMARY'; end if;
  if tracking_mode_value not in ('STATUS_ONLY','LOCATION_AND_STATUS') then raise exception 'INVALID_TRACKING_MODE'; end if;

  select * into origin_place from public.place_catalog
  where id=nullif(trim(command->>'origin_place_ref'),'');
  if not found then raise exception 'LOCALITY_REQUIRED'; end if;
  select * into destination_place from public.place_catalog
  where id=nullif(trim(command->>'destination_place_ref'),'');
  if not found then raise exception 'LOCALITY_REQUIRED'; end if;
  if origin_place.id=destination_place.id then raise exception 'ROUTE_LOCATIONS_MUST_DIFFER'; end if;

  begin
    pickup_date:=nullif(trim(command->>'expected_pickup_date'),'')::date;
    delivery_date:=nullif(trim(command->>'expected_delivery_date'),'')::date;
  exception when invalid_datetime_format or datetime_field_overflow then
    raise exception 'INVALID_DELIVERY_DATE';
  end;
  if pickup_date is not null and delivery_date is not null and delivery_date<pickup_date then
    raise exception 'INVALID_DELIVERY_DATE';
  end if;

  begin
    select * into vehicle from public.vehicles
    where id=(command->>'vehicle_id')::uuid and active;
  exception when invalid_text_representation then raise exception 'INVALID_VEHICLE'; end;
  if not found or not (
    actor.actor_role='TRANSPORTER' and vehicle.organization_id=actor.organization_id
    or actor.actor_role='DRIVER' and actor.provider_profile_id is not null
      and vehicle.provider_profile_id=actor.provider_profile_id
    or actor.is_company_driver and vehicle.organization_id=actor.organization_id and exists(
      select 1 from public.driver_vehicle_assignments assignment
      where assignment.vehicle_id=vehicle.id and assignment.driver_user_id=actor_user_id and assignment.active
    )
  ) then raise exception 'INVALID_VEHICLE'; end if;

  if vehicle.provider_profile_id is not null then
    assigned_driver_id:=actor_user_id;
  else
    select assignment.driver_user_id into assigned_driver_id
    from public.driver_vehicle_assignments assignment
    where assignment.vehicle_id=vehicle.id and assignment.active
    order by assignment.assigned_at desc,assignment.id
    limit 1;
  end if;
  if assigned_driver_id is null then raise exception 'DRIVER_REQUIRED_FOR_SHIPMENT'; end if;
  if actor.is_company_driver and assigned_driver_id<>actor_user_id then raise exception 'FORBIDDEN'; end if;

  insert into public.provider_shipments(
    id,code,provider_organization_id,provider_profile_id,assigned_vehicle_id,
    assigned_driver_user_id,origin,origin_place_ref,origin_lat,origin_lng,
    destination,destination_place_ref,destination_lat,destination_lng,cargo_summary,
    shipper_email,receiver_email,expected_pickup_date,expected_delivery_date,
    tracking_mode,operational_status,created_by,created_at,updated_at,review_code_hash
  ) values (
    shipment_id,shipment_code,vehicle.organization_id,vehicle.provider_profile_id,vehicle.id,
    assigned_driver_id,
    concat_ws(', ',origin_place.name,
      case when origin_place.parent_name is not null and lower(origin_place.parent_name)<>lower(origin_place.name) then origin_place.parent_name end,
      coalesce(origin_place.country_name,'Ethiopia')),
    origin_place.id,origin_place.latitude,origin_place.longitude,
    concat_ws(', ',destination_place.name,
      case when destination_place.parent_name is not null and lower(destination_place.parent_name)<>lower(destination_place.name) then destination_place.parent_name end,
      coalesce(destination_place.country_name,'Ethiopia')),
    destination_place.id,destination_place.latitude,destination_place.longitude,cargo,
    customer_email,customer_email,pickup_date,delivery_date,
    tracking_mode_value::public.tracking_mode,'CREATED',actor_user_id,timestamp_value,timestamp_value,review_digest
  );

  insert into public.shipment_party_grants(id,shipment_id,party_role,code_hash,expires_at,revoked_at,created_at)
  values(gen_random_uuid(),shipment_id,'SHIPPER',tracking_digest,null,null,timestamp_value);
  insert into public.email_deliveries(
    id,shipment_id,party_role,delivery_kind,recipient_email,idempotency_key,status,
    attempts,last_error,next_attempt_at,sent_at,created_at,updated_at
  ) values (
    gen_random_uuid(),shipment_id,'SHIPPER','TRACKING_ACCESS',customer_email,
    'tracking-access:'||shipment_id::text,'PENDING',0,null,timestamp_value,null,timestamp_value,timestamp_value
  );
  insert into public.provider_shipment_events(
    id,shipment_id,status,event_type,note,created_by,created_at
  ) values (gen_random_uuid(),shipment_id,'CREATED','STATUS','Tracking session created',actor_user_id,timestamp_value);
  insert into public.audit_logs(id,actor_user_id,organization_id,action,entity_type,entity_id,details,created_at)
  values(gen_random_uuid(),actor_user_id,vehicle.organization_id,'PROVIDER_SHIPMENT_CREATED','provider_shipment',shipment_id,
    jsonb_build_object('vehicleId',vehicle.id,'assignedDriver',assigned_driver_id,'trackingMode',tracking_mode_value),timestamp_value);

  return jsonb_build_object('id',shipment_id,'code',shipment_code);
exception
  when unique_violation then raise exception 'TRACKING_ALREADY_EXISTS';
end;
$$;

create or replace function public.provider_tracking_detail(
  actor_user_id uuid,
  shipment_lookup text
)
returns jsonb
language plpgsql
stable
security definer
set search_path=public,pg_temp
as $$
declare
  shipment public.provider_shipments%rowtype;
  result jsonb;
begin
  select candidate.* into shipment
  from public.provider_shipments candidate
  where (candidate.id::text=trim(shipment_lookup) or candidate.code=upper(trim(shipment_lookup)))
    and public.provider_tracking_actor_owns_shipment(actor_user_id,candidate.id)
  limit 1;
  if not found then return null; end if;

  select to_jsonb(shipment)-'review_code_hash'||jsonb_build_object(
    'platform_number',vehicle.platform_number,
    'vehicle_make',vehicle.make,
    'vehicle_model',vehicle.model,
    'driver_name',driver.full_name,
    'events',coalesce(events.records,'[]'::jsonb),
    'latest_location',location.record,
    'email_deliveries',coalesce(deliveries.records,'[]'::jsonb),
    'review',review.record,
    'guest_access_active',exists(
      select 1 from public.shipment_party_grants grant_record
      where grant_record.shipment_id=shipment.id and grant_record.party_role='SHIPPER'
        and grant_record.revoked_at is null
        and (grant_record.expires_at is null or grant_record.expires_at>now())
    )
  ) into result
  from public.vehicles vehicle
  join public.profiles driver on driver.id=shipment.assigned_driver_user_id
  left join lateral (
    select jsonb_agg(jsonb_build_object(
      'id',event.id,'status',event.status,'note',event.note,
      'has_proof',event.proof_storage_path is not null,'created_at',event.created_at
    ) order by event.created_at,event.id) as records
    from public.provider_shipment_events event
    where event.shipment_id=shipment.id and event.event_type='STATUS'
  ) events on true
  left join lateral (
    select jsonb_build_object(
      'location_area',event.location_area,'location_lat',event.location_lat,
      'location_lng',event.location_lng,'location_precision_km',event.location_precision_km,
      'created_at',event.created_at
    ) as record
    from public.provider_shipment_events event
    where event.shipment_id=shipment.id and event.location_source='DEVICE_OBSCURED'
    order by event.created_at desc,event.id desc limit 1
  ) location on true
  left join lateral (
    select jsonb_agg(jsonb_build_object(
      'party_role',delivery.party_role,'delivery_kind',delivery.delivery_kind,
      'status',delivery.status,'attempts',delivery.attempts,'last_error',delivery.last_error,
      'sent_at',delivery.sent_at,'updated_at',delivery.updated_at
    ) order by delivery.created_at,delivery.id) as records
    from public.email_deliveries delivery where delivery.shipment_id=shipment.id
  ) deliveries on true
  left join lateral (
    select to_jsonb(provider_review) as record
    from public.provider_reviews provider_review where provider_review.shipment_id=shipment.id
  ) review on true
  where vehicle.id=shipment.assigned_vehicle_id;
  return result;
end;
$$;

create or replace function public.update_provider_tracking_status(
  actor_user_id uuid,
  target_shipment_id uuid,
  command jsonb
)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  shipment public.provider_shipments%rowtype;
  next_status text:=upper(trim(coalesce(command->>'next_status','')));
  clean_note text:=left(trim(coalesce(command->>'note','')),1000);
  proof jsonb:=command->'proof';
  location jsonb:=command->'location';
  location_area text;
  location_lat double precision;
  location_lng double precision;
  location_precision integer;
  location_source text;
  timestamp_value timestamptz;
  guest_expiry timestamptz;
  is_complete boolean:=false;
begin
  if not public.provider_tracking_actor_owns_shipment(actor_user_id,target_shipment_id) then
    raise exception 'NOT_FOUND';
  end if;
  select * into shipment from public.provider_shipments where id=target_shipment_id for update;
  if not found then raise exception 'NOT_FOUND'; end if;

  if not (
    shipment.operational_status='CREATED' and next_status in ('TO_PICKUP','LOADING','ISSUE')
    or shipment.operational_status='TO_PICKUP' and next_status in ('LOADING','ISSUE')
    or shipment.operational_status='LOADING' and next_status in ('IN_TRANSIT','ISSUE')
    or shipment.operational_status='IN_TRANSIT' and next_status in ('UNLOADING','ISSUE')
    or shipment.operational_status='UNLOADING' and next_status in ('COMPLETED','ISSUE')
    or shipment.operational_status='ISSUE' and next_status in ('TO_PICKUP','LOADING','IN_TRANSIT','UNLOADING')
  ) then raise exception 'INVALID_STATUS_TRANSITION'; end if;
  if next_status='ISSUE' and clean_note='' then raise exception 'ISSUE_NOTE_REQUIRED'; end if;

  if proof is not null and jsonb_typeof(proof)='object' and nullif(trim(proof->>'path'),'') is not null then
    if next_status not in ('LOADING','UNLOADING','ISSUE') then raise exception 'PROOF_NOT_ALLOWED_FOR_STATUS'; end if;
    if proof->>'path' not like 'supabase://shipment-proof/%'
      or proof->>'mime_type' not in ('image/jpeg','image/png','image/webp')
      or length(coalesce(proof->>'original_name','')) not between 1 and 160 then
      raise exception 'INVALID_PRIVATE_PROOF';
    end if;
  else
    proof:=null;
  end if;

  if shipment.tracking_mode='LOCATION_AND_STATUS' and next_status in ('TO_PICKUP','IN_TRANSIT') then
    if shipment.assigned_driver_user_id<>actor_user_id
      or not exists(select 1 from public.profiles actor where actor.id=actor_user_id and actor.active and actor.role::text='DRIVER') then
      raise exception 'ASSIGNED_DRIVER_LOCATION_REQUIRED';
    end if;
    if shipment.provider_organization_id is not null and not exists(
      select 1 from public.driver_vehicle_assignments assignment
      where assignment.driver_user_id=actor_user_id
        and assignment.vehicle_id=shipment.assigned_vehicle_id and assignment.active
    ) then raise exception 'ASSIGNED_DRIVER_LOCATION_REQUIRED'; end if;
    location_area:=left(trim(coalesce(location->>'area','')),120);
    location_source:=trim(coalesce(location->>'source',''));
    begin
      location_lat:=(location->>'lat')::double precision;
      location_lng:=(location->>'lng')::double precision;
      location_precision:=(location->>'precision_km')::integer;
    exception when invalid_text_representation or numeric_value_out_of_range then
      raise exception 'TRACKING_DEVICE_LOCATION_REQUIRED';
    end;
    if location_source<>'DEVICE_OBSCURED' or location_area=''
      or location_lat not between 3 and 15 or location_lng not between 32 and 49
      or location_precision not in (1,3,5,10,20,40) then
      raise exception 'TRACKING_DEVICE_LOCATION_REQUIRED';
    end if;
  end if;

  select greatest(clock_timestamp(),coalesce(max(event.created_at)+interval '1 millisecond',clock_timestamp()))
  into timestamp_value from public.provider_shipment_events event where event.shipment_id=shipment.id;
  is_complete:=next_status='COMPLETED';
  guest_expiry:=case when is_complete then timestamp_value+interval '30 days' else shipment.guest_expires_at end;

  update public.provider_shipments set
    operational_status=next_status,
    updated_at=timestamp_value,
    completed_at=case when is_complete then timestamp_value else completed_at end,
    guest_expires_at=case when is_complete then guest_expiry else guest_expires_at end
  where id=shipment.id;
  insert into public.provider_shipment_events(
    id,shipment_id,status,event_type,note,proof_storage_path,proof_original_name,proof_mime_type,
    location_area,location_lat,location_lng,location_precision_km,location_source,created_by,created_at
  ) values (
    gen_random_uuid(),shipment.id,next_status,'STATUS',nullif(clean_note,''),
    proof->>'path',proof->>'original_name',proof->>'mime_type',
    location_area,location_lat,location_lng,location_precision,location_source,actor_user_id,timestamp_value
  );

  if is_complete then
    update public.shipment_party_grants set expires_at=guest_expiry
    where shipment_id=shipment.id and revoked_at is null;
    insert into public.email_deliveries(
      id,shipment_id,party_role,delivery_kind,recipient_email,idempotency_key,status,
      attempts,last_error,next_attempt_at,sent_at,created_at,updated_at
    ) values (
      gen_random_uuid(),shipment.id,'SHIPPER','COMPLETION',shipment.shipper_email,
      'completion:'||shipment.id::text||':OWNER','PENDING',0,null,timestamp_value,null,timestamp_value,timestamp_value
    ) on conflict(idempotency_key) do nothing;
  end if;

  insert into public.audit_logs(id,actor_user_id,organization_id,action,entity_type,entity_id,details,created_at)
  values(gen_random_uuid(),actor_user_id,shipment.provider_organization_id,'PROVIDER_SHIPMENT_STATUS_UPDATED','provider_shipment',shipment.id,
    jsonb_build_object('from',shipment.operational_status,'to',next_status,'hasProof',proof is not null,
      'locationShared',location_source='DEVICE_OBSCURED','locationPrecisionKm',location_precision),timestamp_value);
  return jsonb_build_object('id',shipment.id,'status',next_status,'guestExpires',guest_expiry);
end;
$$;

create or replace function public.update_provider_tracking_location(
  actor_user_id uuid,
  target_shipment_id uuid,
  command jsonb
)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  shipment public.provider_shipments%rowtype;
  location_area text:=left(trim(coalesce(command->>'area','')),120);
  location_source text:=trim(coalesce(command->>'source',''));
  location_lat double precision;
  location_lng double precision;
  location_precision integer;
  latest_at timestamptz;
  timestamp_value timestamptz:=clock_timestamp();
begin
  if not public.provider_tracking_actor_owns_shipment(actor_user_id,target_shipment_id) then
    raise exception 'NOT_FOUND';
  end if;
  select * into shipment from public.provider_shipments where id=target_shipment_id for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if shipment.assigned_driver_user_id<>actor_user_id then raise exception 'ASSIGNED_DRIVER_LOCATION_REQUIRED'; end if;
  if shipment.provider_organization_id is not null and not exists(
    select 1 from public.driver_vehicle_assignments assignment
    where assignment.driver_user_id=actor_user_id
      and assignment.vehicle_id=shipment.assigned_vehicle_id and assignment.active
  ) then raise exception 'ASSIGNED_DRIVER_LOCATION_REQUIRED'; end if;
  if shipment.tracking_mode<>'LOCATION_AND_STATUS' or shipment.operational_status not in ('TO_PICKUP','IN_TRANSIT') then
    raise exception 'TRACKING_LOCATION_NOT_ENABLED';
  end if;
  begin
    location_lat:=(command->>'lat')::double precision;
    location_lng:=(command->>'lng')::double precision;
    location_precision:=(command->>'precision_km')::integer;
  exception when invalid_text_representation or numeric_value_out_of_range then
    raise exception 'TRACKING_DEVICE_LOCATION_REQUIRED';
  end;
  if location_source<>'DEVICE_OBSCURED' or location_area=''
    or location_lat not between 3 and 15 or location_lng not between 32 and 49
    or location_precision not in (1,3,5,10,20,40) then
    raise exception 'TRACKING_DEVICE_LOCATION_REQUIRED';
  end if;
  select max(event.created_at) into latest_at
  from public.provider_shipment_events event
  where event.shipment_id=shipment.id and event.location_source='DEVICE_OBSCURED';
  if latest_at is not null and timestamp_value-latest_at<interval '10 minutes' then
    return jsonb_build_object('recorded',false,'reason','THROTTLED');
  end if;

  insert into public.provider_shipment_events(
    id,shipment_id,status,event_type,note,location_area,location_lat,location_lng,
    location_precision_km,location_source,created_by,created_at
  ) values (
    gen_random_uuid(),shipment.id,shipment.operational_status,'LOCATION','Approximate location refreshed',
    location_area,location_lat,location_lng,location_precision,location_source,actor_user_id,timestamp_value
  );
  update public.provider_shipments set updated_at=timestamp_value where id=shipment.id;
  insert into public.audit_logs(id,actor_user_id,organization_id,action,entity_type,entity_id,details,created_at)
  values(gen_random_uuid(),actor_user_id,shipment.provider_organization_id,'PROVIDER_SHIPMENT_LOCATION_UPDATED','provider_shipment',shipment.id,
    jsonb_build_object('status',shipment.operational_status,'locationPrecisionKm',location_precision),timestamp_value);
  return jsonb_build_object('recorded',true,'updatedAt',timestamp_value,
    'locationArea',location_area,'locationPrecisionKm',location_precision);
end;
$$;

create or replace function public.provider_tracking_guest_cleanup(requested_limit integer default 100)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  shipment_ids uuid[];
  current_shipment_id uuid;
begin
  select coalesce(array_agg(expired.id),'{}'::uuid[]) into shipment_ids
  from (
    select shipment.id from public.provider_shipments shipment
    where shipment.guest_expires_at is not null and shipment.guest_expires_at<=now()
      and (
        shipment.review_code_hash is not null
        or exists(select 1 from public.shipment_party_grants grant_record where grant_record.shipment_id=shipment.id)
        or exists(select 1 from public.email_deliveries delivery where delivery.shipment_id=shipment.id)
        or shipment.shipper_email not like 'expired+%@redacted.invalid'
        or shipment.receiver_email not like 'expired+%@redacted.invalid'
      )
    order by shipment.guest_expires_at,shipment.id
    limit greatest(1,least(coalesce(requested_limit,100),500))
    for update skip locked
  ) expired;
  if cardinality(shipment_ids)=0 then return jsonb_build_object('count',0,'shipmentIds','[]'::jsonb); end if;

  delete from public.shipment_party_grants where shipment_id=any(shipment_ids);
  delete from public.email_deliveries where shipment_id=any(shipment_ids);
  update public.provider_shipments set
    shipper_email='expired+'||id::text||'@redacted.invalid',
    receiver_email='expired+'||id::text||'@redacted.invalid',
    review_code_hash=null
  where id=any(shipment_ids);
  foreach current_shipment_id in array shipment_ids loop
    insert into public.audit_logs(id,action,entity_type,entity_id,details,created_at)
    values(gen_random_uuid(),'PROVIDER_TRACKING_GUEST_EXPIRED','provider_shipment',current_shipment_id,'{}'::jsonb,clock_timestamp());
  end loop;
  return jsonb_build_object('count',cardinality(shipment_ids),'shipmentIds',to_jsonb(shipment_ids));
end;
$$;

create or replace function public.unlock_provider_tracking(tracking_code_hash text)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  grant_record record;
begin
  perform public.provider_tracking_guest_cleanup(100);
  select grant_value.shipment_id,grant_value.party_role into grant_record
  from public.shipment_party_grants grant_value
  where grant_value.code_hash=trim(tracking_code_hash)
    and grant_value.revoked_at is null
    and (grant_value.expires_at is null or grant_value.expires_at>now())
  limit 1;
  if not found then raise exception 'INVALID_TRACKING_CODE'; end if;
  return jsonb_build_object('id',grant_record.shipment_id,'partyRole',grant_record.party_role);
end;
$$;

create or replace function public.provider_guest_tracking(
  target_shipment_id uuid,
  requested_party_role text
)
returns jsonb
language plpgsql
stable
security definer
set search_path=public,pg_temp
as $$
declare
  shipment public.provider_shipments%rowtype;
  result jsonb;
begin
  if upper(trim(requested_party_role)) not in ('SHIPPER','RECEIVER') then return null; end if;
  select candidate.* into shipment
  from public.provider_shipments candidate
  where candidate.id=target_shipment_id and exists(
    select 1 from public.shipment_party_grants grant_record
    where grant_record.shipment_id=candidate.id
      and grant_record.party_role=upper(trim(requested_party_role))
      and grant_record.revoked_at is null
      and (grant_record.expires_at is null or grant_record.expires_at>now())
  );
  if not found then return null; end if;

  select jsonb_build_object(
    'id',shipment.id,'code',shipment.code,'origin',shipment.origin,
    'origin_lat',shipment.origin_lat,'origin_lng',shipment.origin_lng,
    'destination',shipment.destination,'destination_lat',shipment.destination_lat,
    'destination_lng',shipment.destination_lng,'cargo_summary',shipment.cargo_summary,
    'tracking_mode',shipment.tracking_mode,'operational_status',shipment.operational_status,
    'expected_pickup_date',shipment.expected_pickup_date,
    'expected_delivery_date',shipment.expected_delivery_date,
    'completed_at',shipment.completed_at,'guest_expires_at',shipment.guest_expires_at,
    'platform_number',vehicle.platform_number,'vehicle_make',vehicle.make,'vehicle_model',vehicle.model,
    'provider_name',coalesce(organization.name,provider.business_name),
    'provider_handle',coalesce(organization.handle,provider.handle),
    'events',coalesce(events.records,'[]'::jsonb),
    'current_location',case when shipment.tracking_mode='LOCATION_AND_STATUS'
      and shipment.operational_status in ('TO_PICKUP','IN_TRANSIT') then location.record else null end,
    'party_role',upper(trim(requested_party_role)),
    'can_review',upper(trim(requested_party_role))='SHIPPER'
      and shipment.operational_status='COMPLETED'
      and shipment.guest_expires_at>now()
      and not exists(select 1 from public.provider_reviews review where review.shipment_id=shipment.id),
    'review',case when upper(trim(requested_party_role))='SHIPPER' then review.record else null end
  ) into result
  from public.vehicles vehicle
  left join public.organizations organization on organization.id=shipment.provider_organization_id
  left join public.provider_profiles provider on provider.id=shipment.provider_profile_id
  left join lateral (
    select jsonb_agg(jsonb_build_object(
      'id',event.id,'status',event.status,'note',event.note,'created_at',event.created_at
    ) order by event.created_at,event.id) as records
    from public.provider_shipment_events event
    where event.shipment_id=shipment.id and event.event_type='STATUS'
  ) events on true
  left join lateral (
    select jsonb_build_object(
      'location_area',event.location_area,'location_lat',event.location_lat,
      'location_lng',event.location_lng,'location_precision_km',event.location_precision_km,
      'updated_at',event.created_at
    ) as record
    from public.provider_shipment_events event
    where event.shipment_id=shipment.id and event.location_source='DEVICE_OBSCURED'
    order by event.created_at desc,event.id desc limit 1
  ) location on true
  left join lateral (
    select jsonb_build_object(
      'rating',provider_review.rating,'note',provider_review.note,'status',provider_review.status,
      'dispute_status',provider_review.dispute_status,'created_at',provider_review.created_at
    ) as record
    from public.provider_reviews provider_review where provider_review.shipment_id=shipment.id
  ) review on true
  where vehicle.id=shipment.assigned_vehicle_id;
  return result;
end;
$$;

create or replace function public.unlock_provider_review(
  target_shipment_id uuid,
  supplied_code_hash text
)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
begin
  perform public.provider_tracking_guest_cleanup(100);
  if not exists(
    select 1 from public.provider_shipments shipment
    join public.shipment_party_grants grant_record
      on grant_record.shipment_id=shipment.id and grant_record.party_role='SHIPPER'
    where shipment.id=target_shipment_id and shipment.operational_status='COMPLETED'
      and shipment.guest_expires_at>now()
      and shipment.review_code_hash=trim(supplied_code_hash)
      and grant_record.revoked_at is null and grant_record.expires_at>now()
      and not exists(select 1 from public.provider_reviews review where review.shipment_id=shipment.id)
  ) then raise exception 'REVIEW_NOT_ALLOWED'; end if;
  return jsonb_build_object('id',target_shipment_id);
end;
$$;

create or replace function public.submit_provider_tracking_review(
  target_shipment_id uuid,
  requested_party_role text,
  requested_rating integer,
  requested_note text default null
)
returns uuid
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  shipment public.provider_shipments%rowtype;
  review_id uuid:=gen_random_uuid();
  clean_note text:=left(trim(coalesce(requested_note,'')),1000);
begin
  if upper(trim(requested_party_role))<>'SHIPPER' then raise exception 'REVIEW_NOT_ALLOWED'; end if;
  if requested_rating not between 1 and 5 then raise exception 'INVALID_RATING'; end if;
  select candidate.* into shipment from public.provider_shipments candidate
  where candidate.id=target_shipment_id and candidate.operational_status='COMPLETED'
    and candidate.guest_expires_at>now()
    and exists(
      select 1 from public.shipment_party_grants grant_record
      where grant_record.shipment_id=candidate.id and grant_record.party_role='SHIPPER'
        and grant_record.revoked_at is null and grant_record.expires_at>now()
    )
  for update;
  if not found then raise exception 'REVIEW_NOT_ALLOWED'; end if;
  if exists(select 1 from public.provider_reviews review where review.shipment_id=shipment.id) then
    raise exception 'REVIEW_ALREADY_SUBMITTED';
  end if;
  insert into public.provider_reviews(
    id,shipment_id,provider_organization_id,provider_profile_id,rating,note,
    status,dispute_status,created_at
  ) values (
    review_id,shipment.id,shipment.provider_organization_id,shipment.provider_profile_id,
    requested_rating,nullif(clean_note,''),'PUBLISHED','NONE',clock_timestamp()
  );
  insert into public.audit_logs(id,action,entity_type,entity_id,details,created_at)
  values(gen_random_uuid(),'PROVIDER_REVIEW_SUBMITTED','provider_review',review_id,
    jsonb_build_object('shipmentId',shipment.id,'rating',requested_rating),clock_timestamp());
  return review_id;
exception when unique_violation then raise exception 'REVIEW_ALREADY_SUBMITTED';
end;
$$;

create or replace function public.dispute_provider_tracking_review(
  actor_user_id uuid,
  target_review_id uuid,
  requested_reason text
)
returns boolean
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  actor record;
  review public.provider_reviews%rowtype;
  clean_reason text:=left(trim(coalesce(requested_reason,'')),1000);
begin
  select * into actor from public.provider_tracking_actor_scope(actor_user_id);
  if not found or not actor.workspace_access or actor.is_company_driver then raise exception 'FORBIDDEN'; end if;
  select * into review from public.provider_reviews candidate
  where candidate.id=target_review_id and (
    actor.actor_role='TRANSPORTER' and candidate.provider_organization_id=actor.organization_id
    or actor.actor_role='DRIVER' and actor.provider_profile_id is not null
      and candidate.provider_profile_id=actor.provider_profile_id
  ) for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if review.rating>3 then raise exception 'REVIEW_DISPUTE_NOT_ALLOWED'; end if;
  if review.dispute_status<>'NONE' then raise exception 'REVIEW_ALREADY_DISPUTED'; end if;
  if length(clean_reason)<5 then raise exception 'REVIEW_DISPUTE_REASON_REQUIRED'; end if;
  update public.provider_reviews set dispute_status='PENDING',dispute_reason=clean_reason,
    disputed_at=clock_timestamp() where id=review.id;
  insert into public.audit_logs(id,actor_user_id,organization_id,action,entity_type,entity_id,details,created_at)
  values(gen_random_uuid(),actor_user_id,review.provider_organization_id,'PROVIDER_REVIEW_DISPUTED','provider_review',review.id,
    jsonb_build_object('rating',review.rating),clock_timestamp());
  return true;
end;
$$;

create or replace function public.provider_tracking_trust_actor(actor_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path=public,pg_temp
as $$
  select exists(
    select 1 from public.profiles actor
    left join public.support_agent_profiles support on support.user_id=actor.id
    where actor.id=actor_user_id and actor.active and (
      actor.role::text='ADMIN'
      or actor.role::text='SUPPORT' and support.active and support.can_manage_trust
    )
  )
$$;

create or replace function public.provider_review_moderation_queue(
  actor_user_id uuid,
  requested_status text default 'PENDING',
  requested_offset integer default 0,
  requested_limit integer default 12
)
returns table(payload jsonb,total_count bigint)
language sql
stable
security definer
set search_path=public,pg_temp
as $$
  with selected as (
    select review.*,shipment.code as shipment_code,shipment.cargo_summary,
      shipment.origin,shipment.destination,
      coalesce(organization.name,provider.business_name) as provider_name,
      coalesce(organization.handle,provider.handle) as provider_handle
    from public.provider_reviews review
    join public.provider_shipments shipment on shipment.id=review.shipment_id
    left join public.organizations organization on organization.id=review.provider_organization_id
    left join public.provider_profiles provider on provider.id=review.provider_profile_id
    where public.provider_tracking_trust_actor(actor_user_id)
      and review.dispute_status=upper(trim(requested_status))
  ), counted as (select count(*)::bigint as value from selected)
  select jsonb_build_object(
    'id',selected.id,'rating',selected.rating,'note',selected.note,
    'status',selected.dispute_status,'dispute_reason',selected.dispute_reason,
    'created_at',selected.created_at,'review_note',selected.review_note,
    'reviewed_at',selected.reviewed_at,'shipment_id',selected.shipment_id,
    'shipment_code',selected.shipment_code,'shipment_title',selected.cargo_summary,
    'origin',selected.origin,'destination',selected.destination,
    'reviewer_name','Verified customer owner','subject_name',selected.provider_name,
    'subject_handle',selected.provider_handle
  ),counted.value
  from selected cross join counted
  order by selected.created_at desc,selected.id desc
  offset greatest(0,coalesce(requested_offset,0))
  limit greatest(1,least(coalesce(requested_limit,12),100))
$$;

create or replace function public.resolve_provider_review_dispute(
  actor_user_id uuid,
  target_review_id uuid,
  requested_resolution text,
  requested_note text
)
returns boolean
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  review public.provider_reviews%rowtype;
  resolution text:=upper(trim(coalesce(requested_resolution,'')));
  clean_note text:=left(trim(coalesce(requested_note,'')),1000);
begin
  if not public.provider_tracking_trust_actor(actor_user_id) then raise exception 'FORBIDDEN'; end if;
  if resolution not in ('UPHELD','REMOVED') then raise exception 'INVALID_RATING_REVIEW_STATUS'; end if;
  if clean_note='' then raise exception 'RATING_REVIEW_NOTE_REQUIRED'; end if;
  select * into review from public.provider_reviews where id=target_review_id for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if review.dispute_status<>'PENDING' then raise exception 'RATING_ALREADY_REVIEWED'; end if;
  update public.provider_reviews set
    dispute_status=resolution,
    status=case when resolution='REMOVED' then 'REMOVED' else 'PUBLISHED' end,
    reviewed_by=actor_user_id,review_note=clean_note,reviewed_at=clock_timestamp()
  where id=review.id;
  insert into public.audit_logs(id,actor_user_id,action,entity_type,entity_id,details,created_at)
  values(gen_random_uuid(),actor_user_id,'PROVIDER_REVIEW_DISPUTE_RESOLVED','provider_review',review.id,
    jsonb_build_object('shipmentId',review.shipment_id,'resolution',resolution),clock_timestamp());
  return true;
end;
$$;

create or replace function public.pending_provider_tracking_email_deliveries(requested_limit integer default 20)
returns table(payload jsonb)
language plpgsql
security definer
set search_path=public,pg_temp
as $$
begin
  perform public.provider_tracking_guest_cleanup(100);
  return query
    with candidates as (
      select delivery.id
      from public.email_deliveries delivery
      where delivery.status in ('PENDING','FAILED')
        and (delivery.next_attempt_at is null or delivery.next_attempt_at<=now())
        and delivery.attempts<6
      order by delivery.created_at,delivery.id
      for update skip locked
      limit greatest(1,least(coalesce(requested_limit,20),100))
    ), claimed as (
      update public.email_deliveries delivery
      set next_attempt_at=now()+interval '10 minutes',updated_at=now()
      from candidates where delivery.id=candidates.id
      returning delivery.*
    )
    select to_jsonb(claimed)||jsonb_build_object(
      'code',shipment.code,'origin',shipment.origin,'destination',shipment.destination,
      'cargo_summary',shipment.cargo_summary,'operational_status',shipment.operational_status,
      'completed_at',shipment.completed_at,
      'provider_name',coalesce(organization.name,provider.business_name)
    )
    from claimed
    join public.provider_shipments shipment on shipment.id=claimed.shipment_id
    left join public.organizations organization on organization.id=shipment.provider_organization_id
    left join public.provider_profiles provider on provider.id=shipment.provider_profile_id
    order by claimed.created_at,claimed.id;
end;
$$;

create or replace function public.record_provider_tracking_email_attempt(
  delivery_id uuid,
  was_sent boolean,
  failure_message text default null
)
returns boolean
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  delivery public.email_deliveries%rowtype;
  next_attempt_count integer;
begin
  select * into delivery from public.email_deliveries where id=delivery_id for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if delivery.status='SENT' then return true; end if;
  next_attempt_count:=delivery.attempts+1;
  update public.email_deliveries set
    status=case when was_sent then 'SENT' else 'FAILED' end,
    attempts=next_attempt_count,
    last_error=case when was_sent then null else left(coalesce(failure_message,'DELIVERY_FAILED'),500) end,
    next_attempt_at=case when was_sent then null else now()+(least(24,power(2,next_attempt_count))::text||' hours')::interval end,
    sent_at=case when was_sent then now() else null end,
    updated_at=now()
  where id=delivery.id;
  return true;
end;
$$;

revoke all on function public.provider_tracking_actor_scope(uuid) from public,anon,authenticated;
revoke all on function public.provider_tracking_actor_owns_shipment(uuid,uuid) from public,anon,authenticated;
revoke all on function public.provider_tracking_workspace(uuid,integer) from public,anon,authenticated;
revoke all on function public.create_provider_tracking(uuid,jsonb) from public,anon,authenticated;
revoke all on function public.provider_tracking_detail(uuid,text) from public,anon,authenticated;
revoke all on function public.update_provider_tracking_status(uuid,uuid,jsonb) from public,anon,authenticated;
revoke all on function public.update_provider_tracking_location(uuid,uuid,jsonb) from public,anon,authenticated;
revoke all on function public.provider_tracking_guest_cleanup(integer) from public,anon,authenticated;
revoke all on function public.unlock_provider_tracking(text) from public,anon,authenticated;
revoke all on function public.provider_guest_tracking(uuid,text) from public,anon,authenticated;
revoke all on function public.unlock_provider_review(uuid,text) from public,anon,authenticated;
revoke all on function public.submit_provider_tracking_review(uuid,text,integer,text) from public,anon,authenticated;
revoke all on function public.dispute_provider_tracking_review(uuid,uuid,text) from public,anon,authenticated;
revoke all on function public.provider_tracking_trust_actor(uuid) from public,anon,authenticated;
revoke all on function public.provider_review_moderation_queue(uuid,text,integer,integer) from public,anon,authenticated;
revoke all on function public.resolve_provider_review_dispute(uuid,uuid,text,text) from public,anon,authenticated;
revoke all on function public.pending_provider_tracking_email_deliveries(integer) from public,anon,authenticated;
revoke all on function public.record_provider_tracking_email_attempt(uuid,boolean,text) from public,anon,authenticated;

grant execute on function public.provider_tracking_actor_scope(uuid) to service_role;
grant execute on function public.provider_tracking_actor_owns_shipment(uuid,uuid) to service_role;
grant execute on function public.provider_tracking_workspace(uuid,integer) to service_role;
grant execute on function public.create_provider_tracking(uuid,jsonb) to service_role;
grant execute on function public.provider_tracking_detail(uuid,text) to service_role;
grant execute on function public.update_provider_tracking_status(uuid,uuid,jsonb) to service_role;
grant execute on function public.update_provider_tracking_location(uuid,uuid,jsonb) to service_role;
grant execute on function public.provider_tracking_guest_cleanup(integer) to service_role;
grant execute on function public.unlock_provider_tracking(text) to service_role;
grant execute on function public.provider_guest_tracking(uuid,text) to service_role;
grant execute on function public.unlock_provider_review(uuid,text) to service_role;
grant execute on function public.submit_provider_tracking_review(uuid,text,integer,text) to service_role;
grant execute on function public.dispute_provider_tracking_review(uuid,uuid,text) to service_role;
grant execute on function public.provider_tracking_trust_actor(uuid) to service_role;
grant execute on function public.provider_review_moderation_queue(uuid,text,integer,integer) to service_role;
grant execute on function public.resolve_provider_review_dispute(uuid,uuid,text,text) to service_role;
grant execute on function public.pending_provider_tracking_email_deliveries(integer) to service_role;
grant execute on function public.record_provider_tracking_email_attempt(uuid,boolean,text) to service_role;

comment on function public.create_provider_tracking(uuid,jsonb) is
  'Atomically creates one provider-owned Tracking session, customer grant, access delivery, event, and audit row after repeated assignment authorization.';
comment on function public.provider_guest_tracking(uuid,text) is
  'Returns only customer-safe Tracking data after rechecking an active unexpired party grant; emails, digests, proof paths, and delivery failures are excluded.';
comment on function public.provider_tracking_guest_cleanup(integer) is
  'Redacts expired customer contacts and removes temporary guest grants/deliveries while preserving provider Tracking history and reviews.';
