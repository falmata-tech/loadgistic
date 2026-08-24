-- BASE-BE-001 / FEAT-SHR-001 / ADR-041
-- Server-only Shared capacity application ports. Browser roles receive no
-- policy or function grant for grants, OTPs, deliveries, or private geometry.

create or replace function public.private_capacity_actor_controls_vehicle(
  actor_user_id uuid,
  target_vehicle_id uuid
)
returns boolean
language sql
stable
security definer
set search_path=public,pg_temp
as $$
  select exists(
    select 1
    from public.profiles actor
    join public.vehicles vehicle on vehicle.id=target_vehicle_id and vehicle.active
    where actor.id=actor_user_id and actor.active and (
      actor.role::text='TRANSPORTER' and vehicle.organization_id is not null and exists(
        select 1 from public.organization_members membership
        where membership.user_id=actor.id
          and membership.organization_id=vehicle.organization_id
          and membership.membership_role='OWNER'
      )
      or actor.role::text='DRIVER' and vehicle.provider_profile_id is not null and exists(
        select 1 from public.provider_profiles provider
        where provider.id=vehicle.provider_profile_id and provider.user_id=actor.id
      )
      or actor.role::text='DRIVER' and vehicle.organization_id is not null
        and coalesce((select permission.can_manage_capacity from public.driver_permissions permission where permission.user_id=actor.id),true)
        and exists(
          select 1 from public.driver_vehicle_assignments assignment
          where assignment.driver_user_id=actor.id and assignment.vehicle_id=vehicle.id and assignment.active
        )
    )
  )
$$;

create or replace function public.private_capacity_operations_actor(actor_user_id uuid)
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
      or actor.role::text='SUPPORT' and support.active and support.can_manage_operations
    )
  )
$$;

create or replace function public.private_capacity_network(actor_user_id uuid)
returns table(payload jsonb)
language sql
stable
security definer
set search_path=public,pg_temp
as $$
  select jsonb_build_object(
    'id',vehicle.id,
    'platform_number',vehicle.platform_number,
    'make',vehicle.make,
    'model',vehicle.model,
    'cargo_configuration',coalesce(vehicle.cargo_configuration,vehicle.category),
    'driver_user_id',coalesce(assignment.driver_user_id,provider.user_id),
    'driver_name',coalesce(driver.full_name,provider_user.full_name),
    'grants',coalesce(grants.records,'[]'::jsonb)
  ) as payload
  from public.vehicles vehicle
  left join public.provider_profiles provider on provider.id=vehicle.provider_profile_id
  left join public.profiles provider_user on provider_user.id=provider.user_id
  left join public.driver_vehicle_assignments assignment on assignment.vehicle_id=vehicle.id and assignment.active
  left join public.profiles driver on driver.id=assignment.driver_user_id
  left join lateral (
    select jsonb_agg(jsonb_build_object(
      'id',grant_record.id,
      'vehicle_id',grant_record.vehicle_id,
      'audience_type',grant_record.audience_type,
      'recipient_email',grant_record.recipient_email,
      'created_by',grant_record.created_by,
      'created_by_name',creator.full_name,
      'created_at',grant_record.created_at,
      'expires_at',grant_record.expires_at,
      'revoked_at',grant_record.revoked_at,
      'revoked_by',grant_record.revoked_by,
      'revoked_by_name',revoker.full_name
    ) order by grant_record.revoked_at is not null,grant_record.created_at desc) as records
    from public.capacity_access_grants grant_record
    join public.profiles creator on creator.id=grant_record.created_by
    left join public.profiles revoker on revoker.id=grant_record.revoked_by
    where grant_record.vehicle_id=vehicle.id
  ) grants on true
  where vehicle.active and public.private_capacity_actor_controls_vehicle(actor_user_id,vehicle.id)
  order by vehicle.platform_number nulls last,vehicle.id
$$;

create or replace function public.grant_private_capacity_access(
  actor_user_id uuid,
  target_vehicle_id uuid,
  normalized_recipient_email text,
  recipient_digest text
)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  existing public.capacity_access_grants%rowtype;
  created_id uuid:=gen_random_uuid();
  clean_email text:=lower(trim(normalized_recipient_email));
begin
  if not public.private_capacity_actor_controls_vehicle(actor_user_id,target_vehicle_id) then
    raise exception 'NOT_FOUND';
  end if;
  if clean_email='' or clean_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    or recipient_digest !~ '^[a-f0-9]{64}$' then
    raise exception 'INVALID_EMAIL';
  end if;
  select * into existing from public.capacity_access_grants grant_record
  where grant_record.vehicle_id=target_vehicle_id and grant_record.audience_type='EMAIL'
    and grant_record.recipient_email_digest=recipient_digest and grant_record.revoked_at is null
  for update;
  if found then
    return jsonb_build_object('id',existing.id,'vehicle_id',existing.vehicle_id,
      'audience_type',existing.audience_type,'recipient_email',existing.recipient_email,'created',false);
  end if;
  insert into public.capacity_access_grants(
    id,vehicle_id,audience_type,recipient_email,recipient_email_digest,created_by
  ) values(created_id,target_vehicle_id,'EMAIL',clean_email,recipient_digest,actor_user_id);
  insert into public.audit_logs(id,actor_user_id,action,entity_type,entity_id,details)
  values(gen_random_uuid(),actor_user_id,'PRIVATE_CAPACITY_GRANTED','capacity_access_grant',created_id,
    jsonb_build_object('vehicleId',target_vehicle_id,'audience','EMAIL'));
  return jsonb_build_object('id',created_id,'vehicle_id',target_vehicle_id,
    'audience_type','EMAIL','recipient_email',clean_email,'created',true);
exception when unique_violation then
  select * into existing from public.capacity_access_grants grant_record
  where grant_record.vehicle_id=target_vehicle_id and grant_record.audience_type='EMAIL'
    and grant_record.recipient_email_digest=recipient_digest and grant_record.revoked_at is null;
  return jsonb_build_object('id',existing.id,'vehicle_id',existing.vehicle_id,
    'audience_type',existing.audience_type,'recipient_email',existing.recipient_email,'created',false);
end;
$$;

create or replace function public.set_loadgistic_capacity_access(
  actor_user_id uuid,
  target_vehicle_id uuid,
  enabled boolean,
  platform_digest text
)
returns uuid
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  existing public.capacity_access_grants%rowtype;
  created_id uuid:=gen_random_uuid();
begin
  if not public.private_capacity_actor_controls_vehicle(actor_user_id,target_vehicle_id) then
    raise exception 'NOT_FOUND';
  end if;
  if platform_digest !~ '^[a-f0-9]{64}$' then raise exception 'INVALID_AUDIENCE'; end if;
  select * into existing from public.capacity_access_grants grant_record
  where grant_record.vehicle_id=target_vehicle_id and grant_record.audience_type='LOADGISTIC'
    and grant_record.recipient_email_digest=platform_digest and grant_record.revoked_at is null
  for update;
  if enabled and found then return existing.id; end if;
  if enabled then
    insert into public.capacity_access_grants(
      id,vehicle_id,audience_type,recipient_email,recipient_email_digest,created_by
    ) values(created_id,target_vehicle_id,'LOADGISTIC',null,platform_digest,actor_user_id);
    insert into public.audit_logs(id,actor_user_id,action,entity_type,entity_id,details)
    values(gen_random_uuid(),actor_user_id,'LOADGISTIC_CAPACITY_SHARED','capacity_access_grant',created_id,
      jsonb_build_object('vehicleId',target_vehicle_id));
    return created_id;
  end if;
  if found then
    update public.capacity_access_grants set revoked_at=now(),revoked_by=actor_user_id where id=existing.id;
    insert into public.audit_logs(id,actor_user_id,action,entity_type,entity_id,details)
    values(gen_random_uuid(),actor_user_id,'PRIVATE_CAPACITY_REVOKED','capacity_access_grant',existing.id,
      jsonb_build_object('vehicleId',target_vehicle_id,'audience','LOADGISTIC'));
    return existing.id;
  end if;
  return null;
exception when unique_violation then
  select id into created_id from public.capacity_access_grants grant_record
  where grant_record.vehicle_id=target_vehicle_id and grant_record.audience_type='LOADGISTIC'
    and grant_record.recipient_email_digest=platform_digest and grant_record.revoked_at is null;
  return created_id;
end;
$$;

create or replace function public.revoke_private_capacity_access(actor_user_id uuid,target_grant_id uuid)
returns boolean
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  grant_record public.capacity_access_grants%rowtype;
begin
  select * into grant_record from public.capacity_access_grants where id=target_grant_id for update;
  if not found or not public.private_capacity_actor_controls_vehicle(actor_user_id,grant_record.vehicle_id) then
    raise exception 'NOT_FOUND';
  end if;
  if grant_record.revoked_at is not null then return false; end if;
  update public.capacity_access_grants set revoked_at=now(),revoked_by=actor_user_id where id=grant_record.id;
  insert into public.audit_logs(id,actor_user_id,action,entity_type,entity_id,details)
  values(gen_random_uuid(),actor_user_id,'PRIVATE_CAPACITY_REVOKED','capacity_access_grant',grant_record.id,
    jsonb_build_object('vehicleId',grant_record.vehicle_id,'audience',grant_record.audience_type));
  return true;
end;
$$;

create or replace function public.request_shared_capacity_otp(
  challenge_id uuid,
  normalized_recipient_email text,
  recipient_digest text,
  challenge_code_digest text,
  challenge_expires_at timestamptz
)
returns boolean
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  eligible boolean;
begin
  if recipient_digest !~ '^[a-f0-9]{64}$' or challenge_code_digest='' then
    raise exception 'INVALID_OTP_REQUEST';
  end if;
  if challenge_expires_at<=now() or challenge_expires_at>now()+interval '10 minutes 5 seconds' then
    raise exception 'INVALID_OTP_EXPIRY';
  end if;
  select exists(
    select 1 from public.capacity_access_grants grant_record
    where grant_record.audience_type='EMAIL' and grant_record.recipient_email_digest=recipient_digest
      and grant_record.revoked_at is null and (grant_record.expires_at is null or grant_record.expires_at>now())
  ) into eligible;
  if not eligible then return false; end if;
  update public.shared_capacity_email_otps set superseded_at=now()
  where recipient_email_digest=recipient_digest and used_at is null and superseded_at is null and expires_at>now();
  insert into public.shared_capacity_email_otps(
    id,recipient_email,recipient_email_digest,code_digest,attempt_count,expires_at
  ) values(challenge_id,lower(trim(normalized_recipient_email)),recipient_digest,challenge_code_digest,0,challenge_expires_at);
  insert into public.access_email_deliveries(
    id,delivery_kind,entity_id,recipient_email,status,attempts,created_at,updated_at
  ) values(gen_random_uuid(),'SHARED_CAPACITY',challenge_id,lower(trim(normalized_recipient_email)),'QUEUED',0,now(),now());
  insert into public.audit_logs(id,action,entity_type,entity_id,details)
  values(gen_random_uuid(),'SHARED_CAPACITY_OTP_REQUESTED','shared_capacity_email_otp',challenge_id,
    jsonb_build_object('eligible',true));
  return true;
end;
$$;

create or replace function public.consume_shared_capacity_otp(recipient_digest text,submitted_code_digest text)
returns boolean
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  challenge public.shared_capacity_email_otps%rowtype;
  active_grant boolean;
begin
  select * into challenge from public.shared_capacity_email_otps candidate
  where candidate.recipient_email_digest=recipient_digest
    and candidate.used_at is null and candidate.superseded_at is null
  order by candidate.created_at desc limit 1 for update;
  if not found or challenge.expires_at<=now() or challenge.attempt_count>=5
    or challenge.code_digest<>submitted_code_digest then
    if found and challenge.used_at is null and challenge.superseded_at is null and challenge.attempt_count<5 then
      update public.shared_capacity_email_otps
      set attempt_count=least(5,attempt_count+1) where id=challenge.id;
    end if;
    insert into public.audit_logs(id,action,entity_type,entity_id,details)
    values(gen_random_uuid(),'PRIVATE_CAPACITY_ACCESS_DENIED','shared_capacity_email_otp',challenge.id,'{}'::jsonb);
    return false;
  end if;
  select exists(
    select 1 from public.capacity_access_grants grant_record
    where grant_record.audience_type='EMAIL' and grant_record.recipient_email_digest=recipient_digest
      and grant_record.revoked_at is null and (grant_record.expires_at is null or grant_record.expires_at>now())
  ) into active_grant;
  if not active_grant then
    insert into public.audit_logs(id,action,entity_type,entity_id,details)
    values(gen_random_uuid(),'PRIVATE_CAPACITY_ACCESS_DENIED','shared_capacity_email_otp',challenge.id,'{}'::jsonb);
    return false;
  end if;
  update public.shared_capacity_email_otps set used_at=now() where id=challenge.id and used_at is null;
  insert into public.audit_logs(id,action,entity_type,entity_id,details)
  values(gen_random_uuid(),'SHARED_CAPACITY_OTP_VERIFIED','shared_capacity_email_otp',challenge.id,'{}'::jsonb);
  return true;
end;
$$;

create or replace function public.private_capacity_projection(
  requested_audience text,
  requested_digest text,
  actor_user_id uuid default null,
  cursor_updated_at timestamptz default null,
  cursor_id uuid default null,
  requested_page_size integer default 100
)
returns table(payload jsonb)
language sql
stable
security definer
set search_path=public,pg_temp
as $$
  with authorized as (
    select distinct grant_record.vehicle_id
    from public.capacity_access_grants grant_record
    where grant_record.audience_type=upper(requested_audience)
      and grant_record.recipient_email_digest=requested_digest
      and grant_record.revoked_at is null
      and (grant_record.expires_at is null or grant_record.expires_at>now())
      and (
        upper(requested_audience)='EMAIL' and actor_user_id is null
        or upper(requested_audience)='LOADGISTIC' and public.private_capacity_operations_actor(actor_user_id)
      )
  ), latest as (
    select capacity.*,row_number() over(partition by capacity.vehicle_id order by capacity.updated_at desc,capacity.id desc) as latest_position
    from public.capacities capacity join authorized on authorized.vehicle_id=capacity.vehicle_id
  )
  select jsonb_build_object(
    'id',capacity.id,'vehicle_id',capacity.vehicle_id,
    'provider_organization_id',capacity.provider_organization_id,'provider_profile_id',capacity.provider_profile_id,
    'status',coalesce(capacity.market_status,capacity.status::text),'updated_at',capacity.updated_at,
    'location_updated_at',capacity.location_updated_at,'location_area',capacity.location_area,
    'location_lat',capacity.location_lat,'location_lng',capacity.location_lng,
    'location_precision_km',capacity.location_precision_km,'work_radius_km',capacity.work_radius_km,
    'availability_geometry',capacity.availability_geometry,
    'current_route_origin',capacity.current_route_origin,'current_route_destination',capacity.current_route_destination,
    'current_origin_place_ref',capacity.current_origin_place_ref,'current_origin_lat',capacity.current_origin_lat,
    'current_origin_lng',capacity.current_origin_lng,'current_destination_place_ref',capacity.current_destination_place_ref,
    'current_destination_lat',capacity.current_destination_lat,'current_destination_lng',capacity.current_destination_lng,
    'current_route_points',capacity.current_route_points_json,
    'capacity_area_center_place_ref',capacity.capacity_area_center_place_ref,
    'capacity_area_center_label',capacity.capacity_area_center_label,
    'capacity_area_center_lat',capacity.capacity_area_center_lat,'capacity_area_center_lng',capacity.capacity_area_center_lng,
    'capacity_area_boundary',capacity.capacity_area_boundary_json,
    'accepts_full_load',capacity.accepts_full_load,'accepts_partial_load',capacity.accepts_partial_load,
    'accepts_multi_pick',capacity.accepts_multi_pick,'accepts_multi_drop',capacity.accepts_multi_drop
  ) || jsonb_build_object(
    'platform_number',vehicle.platform_number,'vehicle_make',vehicle.make,'vehicle_model',vehicle.model,
    'cargo_configuration',coalesce(vehicle.cargo_configuration,vehicle.category),
    'provider_name',coalesce(organization.name,provider.business_name),
    'provider_handle',coalesce(organization.handle,provider.handle),
    'assigned_driver_first_name',nullif(split_part(trim(coalesce(driver.full_name,provider_user.full_name,'')),' ',1),''),
    'assigned_driver_phone',coalesce(fleet_driver.phone,case when page.show_contact_phone then page.contact_phone end),
    'contact_phone',case when page.show_contact_phone then page.contact_phone end,
    'contact_whatsapp',case when page.show_contact_whatsapp then page.contact_whatsapp end,
    'contact_email',case when page.show_contact_email then page.contact_email end,
    'contact_website',case when page.show_contact_website then page.contact_website end,
    'review_count',coalesce(review.review_count,0),'average_rating',review.average_rating,
    'recurring_corridors',case when regular.id is null then '[]'::jsonb else jsonb_build_array(jsonb_build_object(
      'id',regular.id,'geometry',regular.geometry,'origin',regular.origin,'destination',regular.destination,
      'route_points',regular.route_points_json,'origin_place_ref',regular.origin_place_ref,
      'origin_lat',regular.origin_lat,'origin_lng',regular.origin_lng,
      'destination_place_ref',regular.destination_place_ref,'destination_lat',regular.destination_lat,
      'destination_lng',regular.destination_lng,'area_center_place_ref',regular.area_center_place_ref,
      'area_center_label',regular.area_center_label,'area_center_lat',regular.area_center_lat,
      'area_center_lng',regular.area_center_lng,'area_boundary',regular.area_boundary_json
    )) end,
    'provider_kind',case
      when capacity.provider_organization_id is not null then 'FLEET_TRANSPORTER'
      when exists(select 1 from public.verification_requests ownership
        where ownership.subject_type='VEHICLE' and ownership.subject_id=capacity.vehicle_id
          and ownership.verification_type='VEHICLE_OWNERSHIP' and ownership.status='APPROVED'
          and (ownership.expires_on is null or ownership.expires_on>=current_date)) then 'OWNER_OPERATOR'
      else 'SELF_MANAGED_DRIVER' end,
    'driver_documents',coalesce(driver_documents.records,'[]'::jsonb),
    'vehicle_documents',coalesce(vehicle_documents.records,'[]'::jsonb),
    'authorization_documents',coalesce(authorization_documents.records,'[]'::jsonb),
    'current_signal_visibility',case when capacity.visibility='OPEN' then 'PUBLIC_MARKET' else 'PRIVATE_NETWORK' end,
    'current_signal_geometry_visible',true
  ) as payload
  from latest capacity
  join public.vehicles vehicle on vehicle.id=capacity.vehicle_id and vehicle.active
  left join public.organizations organization on organization.id=capacity.provider_organization_id
  left join public.provider_profiles provider on provider.id=capacity.provider_profile_id
  left join public.profiles provider_user on provider_user.id=provider.user_id
  join public.company_pages page on page.published and (
    page.organization_id=capacity.provider_organization_id or page.provider_profile_id=capacity.provider_profile_id
  )
  left join lateral (
    select route.* from public.profile_routes route
    where route.organization_id=capacity.provider_organization_id or route.provider_profile_id=capacity.provider_profile_id
    order by route.created_at desc,route.id desc limit 1
  ) regular on true
  left join public.driver_vehicle_assignments assignment on assignment.vehicle_id=capacity.vehicle_id and assignment.active
  left join public.profiles driver on driver.id=assignment.driver_user_id
  left join public.drivers fleet_driver on fleet_driver.user_id=assignment.driver_user_id and fleet_driver.active
  left join lateral (
    select count(*)::integer as review_count,round(avg(provider_review.rating),1) as average_rating
    from public.provider_reviews provider_review
    where provider_review.status='PUBLISHED' and (
      provider_review.provider_organization_id=capacity.provider_organization_id
      or provider_review.provider_profile_id=capacity.provider_profile_id)
  ) review on true
  left join lateral (
    select jsonb_agg(jsonb_build_object('verification_type',request.verification_type,
      'reviewed_at',request.reviewed_at,'expires_on',request.expires_on)
      order by request.reviewed_at desc nulls last,request.submitted_at desc) as records
    from public.verification_requests request
    where request.status='APPROVED' and (
      (capacity.provider_organization_id is not null and request.subject_type='DRIVER' and request.subject_id=assignment.driver_user_id)
      or (capacity.provider_profile_id is not null and request.subject_type='PROVIDER_PROFILE' and request.subject_id=capacity.provider_profile_id))
  ) driver_documents on true
  left join lateral (
    select jsonb_agg(jsonb_build_object('verification_type',request.verification_type,
      'reviewed_at',request.reviewed_at,'expires_on',request.expires_on)
      order by request.reviewed_at desc nulls last,request.submitted_at desc) as records
    from public.verification_requests request
    where request.status='APPROVED' and request.subject_type='VEHICLE' and request.subject_id=capacity.vehicle_id
  ) vehicle_documents on true
  left join lateral (
    select jsonb_agg(jsonb_build_object('verification_type',request.verification_type,
      'reviewed_at',request.reviewed_at,'expires_on',request.expires_on,'related_vehicle_id',request.related_vehicle_id)
      order by request.reviewed_at desc nulls last,request.submitted_at desc) as records
    from public.verification_requests request
    where request.status='APPROVED' and request.verification_type='VEHICLE_AUTHORIZATION'
      and request.related_vehicle_id=capacity.vehicle_id and (
        (capacity.provider_organization_id is not null and request.subject_type='DRIVER' and request.subject_id=assignment.driver_user_id)
        or (capacity.provider_profile_id is not null and request.subject_type='PROVIDER_PROFILE' and request.subject_id=capacity.provider_profile_id))
  ) authorization_documents on true
  where capacity.latest_position=1
    and coalesce(capacity.market_status,capacity.status::text) in ('EMPTY','PARTIAL')
    and capacity.expires_at>now()
    and (provider.id is not null or organization.type='TRANSPORT_COMPANY')
    and (
      cursor_updated_at is null
      or capacity.updated_at<cursor_updated_at
      or capacity.updated_at=cursor_updated_at and capacity.id<cursor_id
    )
  order by capacity.updated_at desc,capacity.id desc
  limit greatest(2,least(coalesce(requested_page_size,100),100)+1)
$$;

create or replace function public.pending_access_email_deliveries(requested_limit integer default 20)
returns table(payload jsonb)
language plpgsql
security definer
set search_path=public,pg_temp
as $$
begin
  return query
    with candidates as (
      select delivery.id
      from public.access_email_deliveries delivery
      where delivery.status in ('QUEUED','FAILED')
        and (delivery.next_attempt_at is null or delivery.next_attempt_at<=now())
        and delivery.attempts<6
      order by delivery.created_at,delivery.id
      for update skip locked
      limit greatest(1,least(coalesce(requested_limit,20),100))
    ), claimed as (
      update public.access_email_deliveries delivery
      set next_attempt_at=now()+interval '10 minutes',updated_at=now()
      from candidates where delivery.id=candidates.id
      returning delivery.*
    )
    select to_jsonb(claimed) from claimed
    order by claimed.created_at,claimed.id;
end
$$;

create or replace function public.record_access_email_delivery_attempt(
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
  delivery public.access_email_deliveries%rowtype;
  next_attempt_count integer;
begin
  select * into delivery from public.access_email_deliveries where id=delivery_id for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if delivery.status='SENT' then return true; end if;
  next_attempt_count:=delivery.attempts+1;
  update public.access_email_deliveries set
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

revoke all on function public.private_capacity_actor_controls_vehicle(uuid,uuid) from public,anon,authenticated;
revoke all on function public.private_capacity_operations_actor(uuid) from public,anon,authenticated;
revoke all on function public.private_capacity_network(uuid) from public,anon,authenticated;
revoke all on function public.grant_private_capacity_access(uuid,uuid,text,text) from public,anon,authenticated;
revoke all on function public.set_loadgistic_capacity_access(uuid,uuid,boolean,text) from public,anon,authenticated;
revoke all on function public.revoke_private_capacity_access(uuid,uuid) from public,anon,authenticated;
revoke all on function public.request_shared_capacity_otp(uuid,text,text,text,timestamptz) from public,anon,authenticated;
revoke all on function public.consume_shared_capacity_otp(text,text) from public,anon,authenticated;
revoke all on function public.private_capacity_projection(text,text,uuid,timestamptz,uuid,integer) from public,anon,authenticated;
revoke all on function public.pending_access_email_deliveries(integer) from public,anon,authenticated;
revoke all on function public.record_access_email_delivery_attempt(uuid,boolean,text) from public,anon,authenticated;

grant execute on function public.private_capacity_actor_controls_vehicle(uuid,uuid) to service_role;
grant execute on function public.private_capacity_operations_actor(uuid) to service_role;
grant execute on function public.private_capacity_network(uuid) to service_role;
grant execute on function public.grant_private_capacity_access(uuid,uuid,text,text) to service_role;
grant execute on function public.set_loadgistic_capacity_access(uuid,uuid,boolean,text) to service_role;
grant execute on function public.revoke_private_capacity_access(uuid,uuid) to service_role;
grant execute on function public.request_shared_capacity_otp(uuid,text,text,text,timestamptz) to service_role;
grant execute on function public.consume_shared_capacity_otp(text,text) to service_role;
grant execute on function public.private_capacity_projection(text,text,uuid,timestamptz,uuid,integer) to service_role;
grant execute on function public.pending_access_email_deliveries(integer) to service_role;
grant execute on function public.record_access_email_delivery_attempt(uuid,boolean,text) to service_role;

comment on function public.private_capacity_projection(text,text,uuid,timestamptz,uuid,integer) is
  'Returns one bounded cursor page of latest active trucks for a server-authorized email or Loadgistic audience. Grant and recipient records are never projected.';
