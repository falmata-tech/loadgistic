-- BASE-BE-001 / FEAT-MKT-001 / FEAT-CAP-001
-- Bounded, server-only public Truck Market projection. Private current
-- geometry is removed inside PostgreSQL before it can reach the application.

create index if not exists capacity_vehicle_cursor_idx
  on public.capacities(vehicle_id,updated_at desc,id desc);
create index if not exists capacity_public_cursor_idx
  on public.capacities(updated_at desc,id desc);
create index if not exists provider_reviews_org_published_idx
  on public.provider_reviews(provider_organization_id,rating)
  where status='PUBLISHED' and provider_organization_id is not null;
create index if not exists provider_reviews_profile_published_idx
  on public.provider_reviews(provider_profile_id,rating)
  where status='PUBLISHED' and provider_profile_id is not null;

create or replace function public.capacity_route_line(points jsonb)
returns geometry
language plpgsql
immutable
strict
set search_path=public,extensions,pg_temp
as $$
declare
  line geometry;
begin
  if jsonb_typeof(points)<>'array' or jsonb_array_length(points)<2 then return null; end if;
  select st_makeline(array_agg(st_setsrid(st_makepoint(
    (point.value->>'lng')::double precision,
    (point.value->>'lat')::double precision
  ),4326) order by point.position))
  into line
  from jsonb_array_elements(points) with ordinality point(value,position)
  where point.value ? 'lat' and point.value ? 'lng';
  if line is null or st_npoints(line)<2 then return null; end if;
  return line;
exception when others then
  return null;
end;
$$;

create or replace function public.capacity_area_polygon(points jsonb)
returns geometry
language plpgsql
immutable
strict
set search_path=public,extensions,pg_temp
as $$
declare
  polygon geometry;
begin
  if jsonb_typeof(points)<>'array' or jsonb_array_length(points)<3 then return null; end if;
  with parsed as (
    select array_agg(st_setsrid(st_makepoint(
      (point.value->>'lng')::double precision,
      (point.value->>'lat')::double precision
    ),4326) order by point.position) as vertices
    from jsonb_array_elements(points) with ordinality point(value,position)
    where point.value ? 'lat' and point.value ? 'lng'
  )
  select st_makepolygon(st_makeline(array_append(vertices,vertices[1]))) into polygon
  from parsed where array_length(vertices,1)>=3;
  if polygon is null or st_isempty(polygon) then return null; end if;
  return polygon;
exception when others then
  return null;
end;
$$;

create or replace function public.capacity_route_point_matches(
  points jsonb, point_lat double precision, point_lng double precision, radius_km double precision
)
returns boolean
language sql
immutable
set search_path=public,extensions,pg_temp
as $$
  select coalesce(st_dwithin(
    public.capacity_route_line(points)::geography,
    st_setsrid(st_makepoint(point_lng,point_lat),4326)::geography,
    greatest(1,least(coalesce(radius_km,50),500))*1000
  ),false)
$$;

create or replace function public.capacity_route_matches(
  points jsonb,
  origin_lat double precision,origin_lng double precision,
  destination_lat double precision,destination_lng double precision,
  origin_radius_km double precision,destination_radius_km double precision,
  direction_mode text
)
returns boolean
language plpgsql
immutable
set search_path=public,extensions,pg_temp
as $$
declare
  line geometry:=public.capacity_route_line(points);
  origin_point geometry:=st_setsrid(st_makepoint(origin_lng,origin_lat),4326);
  destination_point geometry:=st_setsrid(st_makepoint(destination_lng,destination_lat),4326);
begin
  if line is null then return false; end if;
  if not st_dwithin(line::geography,origin_point::geography,greatest(1,least(coalesce(origin_radius_km,50),500))*1000)
    or not st_dwithin(line::geography,destination_point::geography,greatest(1,least(coalesce(destination_radius_km,50),500))*1000)
  then return false; end if;
  return upper(coalesce(direction_mode,'DIRECT'))='EITHER'
    or st_linelocatepoint(line,origin_point)<=st_linelocatepoint(line,destination_point);
end;
$$;

create or replace function public.capacity_area_matches(
  points jsonb, point_lat double precision, point_lng double precision, radius_km double precision
)
returns boolean
language plpgsql
immutable
set search_path=public,extensions,pg_temp
as $$
declare
  polygon geometry:=public.capacity_area_polygon(points);
  selected_point geometry:=st_setsrid(st_makepoint(point_lng,point_lat),4326);
begin
  if polygon is null then return false; end if;
  return st_covers(polygon,selected_point)
    or st_dwithin(polygon::geography,selected_point::geography,greatest(1,least(coalesce(radius_km,50),500))*1000);
end;
$$;

create or replace function public.public_capacity_page(
  query jsonb default '{}'::jsonb,
  cursor_updated_at timestamptz default null,
  cursor_id uuid default null,
  requested_page_size integer default 14
)
returns table(payload jsonb)
language sql
stable
security definer
set search_path=public,extensions,pg_temp
as $$
with input as (
  select
    nullif(trim(query->>'capacity_id'),'')::uuid as capacity_id,
    nullif(trim(query->>'provider_organization_id'),'')::uuid as provider_organization_id,
    nullif(trim(query->>'provider_profile_id'),'')::uuid as provider_profile_id,
    lower(nullif(trim(query->>'provider'),'')) as provider_handle,
    upper(nullif(trim(query->>'status'),'')) as capacity_status,
    upper(nullif(trim(query->>'geometry'),'')) as geometry,
    nullif(trim(query->>'vehicle_category'),'') as vehicle_category,
    upper(nullif(trim(query->>'load_type'),'')) as load_type,
    upper(nullif(trim(query->>'stop_option'),'')) as stop_option,
    upper(nullif(trim(query->>'freshness'),'')) as freshness,
    lower(nullif(trim(query->>'q'),'')) as search_text,
    (query->>'origin_lat')::double precision as origin_lat,
    (query->>'origin_lng')::double precision as origin_lng,
    greatest(1,least(coalesce((query->>'origin_radius_km')::double precision,50),500)) as origin_radius_km,
    (query->>'destination_lat')::double precision as destination_lat,
    (query->>'destination_lng')::double precision as destination_lng,
    greatest(1,least(coalesce((query->>'destination_radius_km')::double precision,50),500)) as destination_radius_km,
    upper(coalesce(nullif(trim(query->>'direction_mode'),''),'DIRECT')) as direction_mode,
    (query->>'area_lat')::double precision as area_lat,
    (query->>'area_lng')::double precision as area_lng,
    greatest(1,least(coalesce((query->>'area_radius_km')::double precision,50),500)) as area_radius_km,
    (query->>'near_lat')::double precision as near_lat,
    (query->>'near_lng')::double precision as near_lng,
    case when (query->>'near_radius_km')::integer in (5,10,20,50,100)
      then (query->>'near_radius_km')::integer else 20 end as near_radius_km,
    greatest(12,least(coalesce(requested_page_size,14),16)) as page_size
), latest as (
  select capacity.*,row_number() over(partition by capacity.vehicle_id order by capacity.updated_at desc,capacity.id desc) as latest_position
  from public.capacities capacity
), candidates as (
  select
    capacity.*,vehicle.platform_number,vehicle.make as vehicle_make,vehicle.model as vehicle_model,
    coalesce(vehicle.cargo_configuration,vehicle.category) as cargo_configuration,
    coalesce(organization.name,provider.business_name) as provider_name,
    coalesce(organization.handle,provider.handle) as provider_handle,
    provider.user_id as profile_user_id,
    provider_user.full_name as profile_user_name,
    page.contact_phone as page_contact_phone,page.contact_whatsapp as page_contact_whatsapp,
    page.contact_email as page_contact_email,page.contact_website as page_contact_website,
    page.show_contact_phone,page.show_contact_whatsapp,page.show_contact_email,page.show_contact_website,
    case when regular.id is null then '[]'::jsonb else jsonb_build_array(jsonb_build_object(
      'id',regular.id,'geometry',regular.geometry,'origin',regular.origin,'destination',regular.destination,
      'route_points',regular.route_points_json,'origin_place_ref',regular.origin_place_ref,
      'origin_lat',regular.origin_lat,'origin_lng',regular.origin_lng,
      'destination_place_ref',regular.destination_place_ref,'destination_lat',regular.destination_lat,
      'destination_lng',regular.destination_lng,'area_center_place_ref',regular.area_center_place_ref,
      'area_center_label',regular.area_center_label,'area_center_lat',regular.area_center_lat,
      'area_center_lng',regular.area_center_lng,'area_boundary',regular.area_boundary_json
    )) end as recurring_corridors
  from latest capacity
  join public.vehicles vehicle on vehicle.id=capacity.vehicle_id
  left join public.organizations organization on organization.id=capacity.provider_organization_id
  left join public.provider_profiles provider on provider.id=capacity.provider_profile_id
  left join public.profiles provider_user on provider_user.id=provider.user_id
  join public.company_pages page on page.published and (
    page.organization_id=capacity.provider_organization_id or page.provider_profile_id=capacity.provider_profile_id
  )
  left join public.profile_routes regular on regular.organization_id=capacity.provider_organization_id
    or regular.provider_profile_id=capacity.provider_profile_id
  where capacity.latest_position=1 and vehicle.active
    and coalesce(capacity.market_status,capacity.status::text) in ('EMPTY','PARTIAL')
    and capacity.expires_at>now()
    and (provider.id is not null or organization.type='TRANSPORT_COMPANY')
), filtered as (
  select candidate.*,
    case when input.near_lat is not null and input.near_lng is not null and candidate.visibility='OPEN'
      and candidate.location_lat is not null and candidate.location_lng is not null
      then st_distance(
        st_setsrid(st_makepoint(input.near_lng,input.near_lat),4326)::geography,
        st_setsrid(st_makepoint(candidate.location_lng,candidate.location_lat),4326)::geography
      )/1000 end as near_center_distance_km
  from candidates candidate cross join input
  where (candidate.visibility='OPEN' or jsonb_array_length(candidate.recurring_corridors)>0)
    and (cursor_updated_at is null or candidate.updated_at<cursor_updated_at
      or (candidate.updated_at=cursor_updated_at and candidate.id<cursor_id))
    and (input.capacity_id is null or candidate.id=input.capacity_id)
    and (input.provider_organization_id is null or candidate.provider_organization_id=input.provider_organization_id)
    and (input.provider_profile_id is null or candidate.provider_profile_id=input.provider_profile_id)
    and (input.provider_handle is null or lower(candidate.provider_handle)=input.provider_handle)
    and (input.capacity_status is null or coalesce(candidate.market_status,candidate.status::text)=input.capacity_status)
    and (input.capacity_status is distinct from 'PARTIAL' or input.geometry is distinct from 'RADIUS')
    and (input.geometry is null or (
      candidate.visibility='OPEN' and candidate.availability_geometry=input.geometry
      or exists(select 1 from jsonb_array_elements(candidate.recurring_corridors) signal where signal->>'geometry'=input.geometry)
    ))
    and (input.vehicle_category is null or candidate.cargo_configuration=input.vehicle_category)
    and (input.load_type is null or candidate.visibility='OPEN' and (
      input.load_type='FTL' and candidate.accepts_full_load or input.load_type='PTL' and candidate.accepts_partial_load
    ))
    and (input.stop_option is null or candidate.visibility='OPEN' and (
      input.stop_option='MULTI_PICK' and candidate.accepts_multi_pick or input.stop_option='MULTI_DROP' and candidate.accepts_multi_drop
    ))
    and (input.freshness is null
      or input.freshness='FRESH' and candidate.updated_at>=now()-interval '12 hours'
      or input.freshness='UPDATE_NEEDED' and candidate.updated_at<now()-interval '12 hours')
    and (input.search_text is null
      or position(input.search_text in lower(coalesce(candidate.provider_name,'')))>0
      or position(input.search_text in lower(coalesce(candidate.platform_number,'')))>0
      or position(input.search_text in lower(coalesce(candidate.vehicle_make,'')))>0
      or position(input.search_text in lower(coalesce(candidate.vehicle_model,'')))>0
      or position(input.search_text in lower(coalesce(candidate.cargo_configuration,'')))>0
      or candidate.visibility='OPEN' and (
        position(input.search_text in lower(coalesce(candidate.location_area,'')))>0
        or position(input.search_text in lower(coalesce(candidate.capacity_area_center_label,'')))>0
        or position(input.search_text in lower(coalesce(candidate.current_route_points_json::text,'')))>0
        or position(input.search_text in lower(coalesce(candidate.capacity_area_boundary_json::text,'')))>0)
      or position(input.search_text in lower(candidate.recurring_corridors::text))>0)
    and (input.origin_lat is null and input.destination_lat is null or (
      input.origin_lat is not null and input.destination_lat is not null and (
        candidate.visibility='OPEN' and candidate.availability_geometry='ROUTE'
          and public.capacity_route_matches(candidate.current_route_points_json,input.origin_lat,input.origin_lng,
            input.destination_lat,input.destination_lng,input.origin_radius_km,input.destination_radius_km,input.direction_mode)
        or exists(select 1 from jsonb_array_elements(candidate.recurring_corridors) signal
          where signal->>'geometry'='ROUTE' and public.capacity_route_matches(signal->'route_points',input.origin_lat,input.origin_lng,
            input.destination_lat,input.destination_lng,input.origin_radius_km,input.destination_radius_km,'EITHER'))
        or coalesce(candidate.market_status,candidate.status::text)='EMPTY' and candidate.visibility='OPEN'
          and candidate.availability_geometry='RADIUS'
          and public.capacity_area_matches(candidate.capacity_area_boundary_json,input.origin_lat,input.origin_lng,input.origin_radius_km)
          and public.capacity_area_matches(candidate.capacity_area_boundary_json,input.destination_lat,input.destination_lng,input.destination_radius_km)
        or coalesce(candidate.market_status,candidate.status::text)='EMPTY' and exists(
          select 1 from jsonb_array_elements(candidate.recurring_corridors) signal where signal->>'geometry'='RADIUS'
            and public.capacity_area_matches(signal->'area_boundary',input.origin_lat,input.origin_lng,input.origin_radius_km)
            and public.capacity_area_matches(signal->'area_boundary',input.destination_lat,input.destination_lng,input.destination_radius_km))
      )
      or input.origin_lat is not null and input.destination_lat is null and (
        candidate.visibility='OPEN' and candidate.availability_geometry='ROUTE'
          and public.capacity_route_point_matches(candidate.current_route_points_json,input.origin_lat,input.origin_lng,input.origin_radius_km)
        or exists(select 1 from jsonb_array_elements(candidate.recurring_corridors) signal where signal->>'geometry'='ROUTE'
          and public.capacity_route_point_matches(signal->'route_points',input.origin_lat,input.origin_lng,input.origin_radius_km))
        or coalesce(candidate.market_status,candidate.status::text)='EMPTY' and candidate.visibility='OPEN'
          and candidate.availability_geometry='RADIUS'
          and public.capacity_area_matches(candidate.capacity_area_boundary_json,input.origin_lat,input.origin_lng,input.origin_radius_km)
        or coalesce(candidate.market_status,candidate.status::text)='EMPTY' and exists(
          select 1 from jsonb_array_elements(candidate.recurring_corridors) signal where signal->>'geometry'='RADIUS'
            and public.capacity_area_matches(signal->'area_boundary',input.origin_lat,input.origin_lng,input.origin_radius_km))
      )
      or input.destination_lat is not null and input.origin_lat is null and (
        candidate.visibility='OPEN' and candidate.availability_geometry='ROUTE'
          and public.capacity_route_point_matches(candidate.current_route_points_json,input.destination_lat,input.destination_lng,input.destination_radius_km)
        or exists(select 1 from jsonb_array_elements(candidate.recurring_corridors) signal where signal->>'geometry'='ROUTE'
          and public.capacity_route_point_matches(signal->'route_points',input.destination_lat,input.destination_lng,input.destination_radius_km))
        or coalesce(candidate.market_status,candidate.status::text)='EMPTY' and candidate.visibility='OPEN'
          and candidate.availability_geometry='RADIUS'
          and public.capacity_area_matches(candidate.capacity_area_boundary_json,input.destination_lat,input.destination_lng,input.destination_radius_km)
        or coalesce(candidate.market_status,candidate.status::text)='EMPTY' and exists(
          select 1 from jsonb_array_elements(candidate.recurring_corridors) signal where signal->>'geometry'='RADIUS'
            and public.capacity_area_matches(signal->'area_boundary',input.destination_lat,input.destination_lng,input.destination_radius_km))
      )))
    and (input.area_lat is null or coalesce(candidate.market_status,candidate.status::text)='EMPTY' and (
      candidate.visibility='OPEN' and candidate.availability_geometry='RADIUS'
        and public.capacity_area_matches(candidate.capacity_area_boundary_json,input.area_lat,input.area_lng,input.area_radius_km)
      or exists(select 1 from jsonb_array_elements(candidate.recurring_corridors) signal where signal->>'geometry'='RADIUS'
        and public.capacity_area_matches(signal->'area_boundary',input.area_lat,input.area_lng,input.area_radius_km))))
    and (input.near_lat is null or candidate.visibility='OPEN' and candidate.location_lat is not null and candidate.location_lng is not null
      and st_dwithin(
        st_setsrid(st_makepoint(input.near_lng,input.near_lat),4326)::geography,
        st_setsrid(st_makepoint(candidate.location_lng,candidate.location_lat),4326)::geography,
        (input.near_radius_km+coalesce(candidate.location_precision_km,20)+1)*1000))
), bounded_base as (
  select * from filtered order by updated_at desc,id desc limit (select page_size+1 from input)
), bounded as (
  select candidate.*,
    assignment.driver_user_id as assigned_driver_user_id,
    coalesce(driver_profile.full_name,candidate.profile_user_name) as assigned_driver_name,
    coalesce(fleet_driver.phone,case when candidate.show_contact_phone then candidate.page_contact_phone end) as assigned_driver_phone,
    case when candidate.show_contact_phone then candidate.page_contact_phone end as contact_phone,
    case when candidate.show_contact_whatsapp then candidate.page_contact_whatsapp end as contact_whatsapp,
    case when candidate.show_contact_email then candidate.page_contact_email end as contact_email,
    case when candidate.show_contact_website then candidate.page_contact_website end as contact_website,
    coalesce(review.review_count,0)::integer as review_count,review.average_rating,
    coalesce(driver_documents.records,'[]'::jsonb) as driver_documents,
    coalesce(vehicle_documents.records,'[]'::jsonb) as vehicle_documents,
    coalesce(authorization_documents.records,'[]'::jsonb) as authorization_documents,
    case
      when candidate.provider_organization_id is not null then 'FLEET_TRANSPORTER'
      when exists(select 1 from public.verification_requests ownership
        where ownership.subject_type='VEHICLE' and ownership.subject_id=candidate.vehicle_id
          and ownership.verification_type='VEHICLE_OWNERSHIP' and ownership.status='APPROVED'
          and (ownership.expires_on is null or ownership.expires_on>=current_date)) then 'OWNER_OPERATOR'
      else 'SELF_MANAGED_DRIVER'
    end as provider_kind
  from bounded_base candidate
  left join public.driver_vehicle_assignments assignment on assignment.vehicle_id=candidate.vehicle_id and assignment.active
  left join public.profiles driver_profile on driver_profile.id=assignment.driver_user_id
  left join public.drivers fleet_driver on fleet_driver.user_id=assignment.driver_user_id and fleet_driver.active
  left join lateral (
    select count(*)::integer as review_count,round(avg(provider_review.rating),1) as average_rating
    from public.provider_reviews provider_review
    where provider_review.status='PUBLISHED' and (
      provider_review.provider_organization_id=candidate.provider_organization_id
      or provider_review.provider_profile_id=candidate.provider_profile_id)
  ) review on true
  left join lateral (
    select jsonb_agg(jsonb_build_object('verification_type',request.verification_type,
      'reviewed_at',request.reviewed_at,'expires_on',request.expires_on)
      order by request.reviewed_at desc nulls last,request.submitted_at desc) as records
    from public.verification_requests request
    where request.status='APPROVED' and (
      (candidate.provider_organization_id is not null and request.subject_type='DRIVER' and request.subject_id=assignment.driver_user_id)
      or (candidate.provider_profile_id is not null and request.subject_type='PROVIDER_PROFILE' and request.subject_id=candidate.provider_profile_id))
  ) driver_documents on true
  left join lateral (
    select jsonb_agg(jsonb_build_object('verification_type',request.verification_type,
      'reviewed_at',request.reviewed_at,'expires_on',request.expires_on)
      order by request.reviewed_at desc nulls last,request.submitted_at desc) as records
    from public.verification_requests request
    where request.status='APPROVED' and request.subject_type='VEHICLE' and request.subject_id=candidate.vehicle_id
  ) vehicle_documents on true
  left join lateral (
    select jsonb_agg(jsonb_build_object('verification_type',request.verification_type,
      'reviewed_at',request.reviewed_at,'expires_on',request.expires_on,
      'related_vehicle_id',request.related_vehicle_id)
      order by request.reviewed_at desc nulls last,request.submitted_at desc) as records
    from public.verification_requests request
    where request.status='APPROVED' and request.verification_type='VEHICLE_AUTHORIZATION'
      and request.related_vehicle_id=candidate.vehicle_id and (
        (candidate.provider_organization_id is not null and request.subject_type='DRIVER' and request.subject_id=assignment.driver_user_id)
        or (candidate.provider_profile_id is not null and request.subject_type='PROVIDER_PROFILE' and request.subject_id=candidate.provider_profile_id))
  ) authorization_documents on true
)
select jsonb_build_object(
  'id',id,'vehicle_id',vehicle_id,'provider_organization_id',provider_organization_id,
  'provider_profile_id',provider_profile_id,'status',coalesce(market_status,status::text),
  'updated_at',updated_at,'location_updated_at',case when visibility='OPEN' then location_updated_at end,
  'location_area',case when visibility='OPEN' then location_area end,
  'location_lat',case when visibility='OPEN' then location_lat end,
  'location_lng',case when visibility='OPEN' then location_lng end,
  'location_precision_km',case when visibility='OPEN' then location_precision_km end,
  'work_radius_km',case when visibility='OPEN' then work_radius_km end,
  'availability_geometry',case when visibility='OPEN' then availability_geometry end,
  'current_route_origin',case when visibility='OPEN' then current_route_origin end,
  'current_route_destination',case when visibility='OPEN' then current_route_destination end,
  'current_origin_place_ref',case when visibility='OPEN' then current_origin_place_ref end,
  'current_origin_lat',case when visibility='OPEN' then current_origin_lat end,
  'current_origin_lng',case when visibility='OPEN' then current_origin_lng end,
  'current_destination_place_ref',case when visibility='OPEN' then current_destination_place_ref end,
  'current_destination_lat',case when visibility='OPEN' then current_destination_lat end,
  'current_destination_lng',case when visibility='OPEN' then current_destination_lng end,
  'current_route_points',case when visibility='OPEN' then current_route_points_json else '[]'::jsonb end
) || jsonb_build_object(
  'capacity_area_center_place_ref',case when visibility='OPEN' then capacity_area_center_place_ref end,
  'capacity_area_center_label',case when visibility='OPEN' then capacity_area_center_label end,
  'capacity_area_center_lat',case when visibility='OPEN' then capacity_area_center_lat end,
  'capacity_area_center_lng',case when visibility='OPEN' then capacity_area_center_lng end,
  'capacity_area_boundary',case when visibility='OPEN' then capacity_area_boundary_json else '[]'::jsonb end,
  'accepts_full_load',visibility='OPEN' and accepts_full_load,
  'accepts_partial_load',visibility='OPEN' and accepts_partial_load,
  'accepts_multi_pick',visibility='OPEN' and accepts_multi_pick,
  'accepts_multi_drop',visibility='OPEN' and accepts_multi_drop,
  'platform_number',platform_number,'vehicle_make',vehicle_make,'vehicle_model',vehicle_model,
  'cargo_configuration',cargo_configuration,'provider_name',provider_name,'provider_handle',provider_handle,
  'assigned_driver_first_name',nullif(split_part(trim(coalesce(assigned_driver_name,'')),' ',1),''),
  'assigned_driver_phone',assigned_driver_phone,'contact_phone',contact_phone,'contact_whatsapp',contact_whatsapp,
  'contact_email',contact_email,'contact_website',contact_website,'review_count',review_count,
  'average_rating',average_rating,'recurring_corridors',recurring_corridors,'provider_kind',provider_kind,
  'driver_documents',driver_documents,'vehicle_documents',vehicle_documents,
  'authorization_documents',authorization_documents,
  'current_signal_visibility',case when visibility='OPEN' then 'PUBLIC_MARKET' else 'PRIVATE_NETWORK' end,
  'current_signal_geometry_visible',visibility='OPEN','near_center_distance_km',near_center_distance_km
) as payload
from bounded order by updated_at desc,id desc
$$;

revoke all on function public.capacity_route_line(jsonb) from public,anon,authenticated;
revoke all on function public.capacity_area_polygon(jsonb) from public,anon,authenticated;
revoke all on function public.capacity_route_point_matches(jsonb,double precision,double precision,double precision) from public,anon,authenticated;
revoke all on function public.capacity_route_matches(jsonb,double precision,double precision,double precision,double precision,double precision,double precision,text) from public,anon,authenticated;
revoke all on function public.capacity_area_matches(jsonb,double precision,double precision,double precision) from public,anon,authenticated;
revoke all on function public.public_capacity_page(jsonb,timestamptz,uuid,integer) from public,anon,authenticated;

grant execute on function public.capacity_route_line(jsonb) to service_role;
grant execute on function public.capacity_area_polygon(jsonb) to service_role;
grant execute on function public.capacity_route_point_matches(jsonb,double precision,double precision,double precision) to service_role;
grant execute on function public.capacity_route_matches(jsonb,double precision,double precision,double precision,double precision,double precision,double precision,text) to service_role;
grant execute on function public.capacity_area_matches(jsonb,double precision,double precision,double precision) to service_role;
grant execute on function public.public_capacity_page(jsonb,timestamptz,uuid,integer) to service_role;
