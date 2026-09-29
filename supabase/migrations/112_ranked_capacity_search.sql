-- FEAT-MKT-001 / FEAT-LST-001. Search only authorized available-capacity projections.
-- No search service, new exposed table, persisted copy of customer text or new extension.
create function public.capacity_text_score(term text, title text, details text default '')
returns double precision language plpgsql immutable set search_path=public,extensions,pg_temp as $$
declare q text:=lower(trim(regexp_replace(coalesce(term,''),'[[:space:]]+',' ','g')));
 heading text:=lower(coalesce(title,'')); body text:=lower(concat_ws(' ',title,details));
 token text; tokens text[]; best double precision; total double precision:=0;
begin
 if q='' then return 1;end if;
 if length(q)>120 then return 0;end if;
 tokens:=regexp_split_to_array(regexp_replace(q,'[^[:alnum:] ]',' ','g'),'[[:space:]]+');
 foreach token in array tokens loop
  if token='' then continue;end if;
  if position(token in body)>0 then total:=total+case when position(token in heading)>0 then 4 else 1 end;continue;end if;
  if length(token)<4 then return 0;end if;
  select max(extensions.similarity(token,word)) into best from regexp_split_to_table(body,'[^[:alnum:]]+') word;
  if coalesce(best,0)<0.45 then return 0;end if;
  total:=total+best*0.6;
 end loop;
 if total=0 then return 0;end if;
 return total + case when heading=q then 100 when left(heading,length(q))=q then 50 when position(q in heading)>0 then 25 when position(q in body)>0 then 10 else 0 end
  + ts_rank_cd(to_tsvector('simple',body),plainto_tsquery('simple',q));
end $$;

create function public.capacity_search_metadata(item jsonb) returns jsonb
language plpgsql stable security definer set search_path=public,extensions,pg_temp as $$
declare org uuid:=nullif(item->>'provider_organization_id','')::uuid; provider uuid:=nullif(item->>'provider_profile_id','')::uuid;
 truck uuid:=(item->>'vehicle_id')::uuid; driver uuid; driver_name text; city text; heading text; about text; services text; kind text;
 owner_docs jsonb; driver_docs jsonb; truck_docs jsonb; today date:=(now() at time zone 'Africa/Addis_Ababa')::date;
begin
 driver:=public.capacity_active_driver_id(truck);
 select nullif(split_part(trim(regexp_replace(p.full_name,'[[:space:]]+',' ','g')),' ',1),'') into driver_name from profiles p where p.id=driver and p.active;
 select coalesce(o.city,p.city),c.headline,c.about,c.services into city,heading,about,services
 from company_pages c left join organizations o on o.id=c.organization_id left join provider_profiles p on p.id=c.provider_profile_id
 where c.published and (c.organization_id=org or c.provider_profile_id=provider)
 and coalesce(o.public_visibility,p.public_visibility)='PUBLIC' limit 1;
 select coalesce(jsonb_agg(distinct r.verification_type),'[]') into owner_docs from verification_requests r
 where r.status='APPROVED' and (r.expires_on is null or r.expires_on>=today)
 and ((org is not null and r.subject_type='ORGANIZATION' and r.subject_id=org) or (provider is not null and r.subject_type='PROVIDER_PROFILE' and r.subject_id=provider));
 select coalesce(jsonb_agg(distinct r.verification_type),'[]') into driver_docs from verification_requests r
 where r.status='APPROVED' and (r.expires_on is null or r.expires_on>=today)
 and ((org is not null and r.subject_type='DRIVER' and r.subject_id=driver) or (provider is not null and r.subject_type='PROVIDER_PROFILE' and r.subject_id=provider));
 select coalesce(jsonb_agg(distinct r.verification_type),'[]') into truck_docs from verification_requests r
 where r.status='APPROVED' and (r.expires_on is null or r.expires_on>=today)
 and ((r.subject_type='VEHICLE' and r.subject_id=truck) or (r.verification_type='VEHICLE_AUTHORIZATION' and r.related_vehicle_id=truck
 and ((org is not null and r.subject_type='DRIVER' and r.subject_id=driver) or (provider is not null and r.subject_type='PROVIDER_PROFILE' and r.subject_id=provider))));
 kind:=case when org is not null then 'COMPANY' when exists(select 1 from vehicles v join verification_requests r on r.subject_type='VEHICLE' and r.subject_id=v.id
  where v.active and v.provider_profile_id=provider and r.status='APPROVED' and r.verification_type='VEHICLE_OWNERSHIP' and (r.expires_on is null or r.expires_on>=today)) then 'OWNER_OPERATOR' else 'SELF_MANAGED_DRIVER' end;
 return jsonb_build_object('city',city,'headline',heading,'about',about,'services',services,'kind',kind,
 'driver_name',driver_name,'driver_key',case when driver is not null then md5(driver::text) end,
 'owner_documents',owner_docs,'driver_documents',driver_docs,'truck_documents',truck_docs);
end $$;

create function public.capacity_search_matches(item jsonb, query jsonb) returns boolean
language plpgsql stable security definer set search_path=public,extensions,pg_temp as $$
declare meta jsonb; required text; field text;
begin
 if not (nullif(query->>'q','') is not null or nullif(query->>'office_city','') is not null or nullif(query->>'owner_docs','') is not null
 or nullif(query->>'driver_docs','') is not null or nullif(query->>'truck_docs','') is not null) then return true;end if;
 meta:=public.capacity_search_metadata(item);
 if nullif(query->>'office_city','') is not null and public.capacity_text_score(query->>'office_city',meta->>'city')=0 then return false;end if;
 foreach field in array array['owner','driver','truck'] loop
  foreach required in array string_to_array(coalesce(query->>(field||'_docs'),''),',') loop
   if required<>'' and not (meta->(field||'_documents') ? required) then return false;end if;
  end loop;
 end loop;
 if nullif(query->>'q','') is null then return true;end if;
 -- Profile discovery searches published profile facts, never truck data or contacts.
 return public.capacity_text_score(query->>'q',concat_ws(' ',item->>'provider_name',item->>'provider_handle',meta->>'driver_name'),
 concat_ws(' ',meta->>'city',meta->>'headline',meta->>'about',meta->>'services'))>0;
end $$;

CREATE OR REPLACE FUNCTION public.public_capacity_page(query jsonb DEFAULT '{}'::jsonb, cursor_updated_at timestamp with time zone DEFAULT NULL::timestamp with time zone, cursor_id uuid DEFAULT NULL::uuid, requested_page_size integer DEFAULT 14)
 RETURNS TABLE(payload jsonb)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
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
    null::text as search_text,
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
  where not (query ? 'vehicle_ids') or capacity.vehicle_id in (
    select value::uuid from jsonb_array_elements_text(query->'vehicle_ids')
  )
), candidates as (
  select
    capacity.*,regular.map_envelope as regular_map_envelope,vehicle.platform_number,vehicle.make as vehicle_make,vehicle.model as vehicle_model,
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
  where capacity.latest_position=1 and vehicle.active and public.capacity_active_driver_id(vehicle.id) is not null
    and coalesce(capacity.market_status,capacity.status::text) in ('EMPTY','PARTIAL')
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
  where public.capacity_search_matches(to_jsonb(candidate),query) and candidate.visibility='OPEN' and (not (query ? 'viewport') or candidate.map_envelope && public.capacity_viewport_envelope(query) or candidate.regular_map_envelope && public.capacity_viewport_envelope(query)) and public.capacity_viewport_matches(jsonb_build_object('location_lat',candidate.location_lat,'location_lng',candidate.location_lng,'location_precision_km',candidate.location_precision_km,'current_route_points',candidate.current_route_points_json,'capacity_area_boundary',candidate.capacity_area_boundary_json,'recurring_corridors',candidate.recurring_corridors),query)
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
        (input.geometry is null or input.geometry='ROUTE') and candidate.visibility='OPEN' and candidate.availability_geometry='ROUTE'
          and public.capacity_route_matches(candidate.current_route_points_json,input.origin_lat,input.origin_lng,
            input.destination_lat,input.destination_lng,input.origin_radius_km,input.destination_radius_km,input.direction_mode)
        or (input.geometry is null or input.geometry='ROUTE') and exists(select 1 from jsonb_array_elements(candidate.recurring_corridors) signal
          where signal->>'geometry'='ROUTE' and public.capacity_route_matches(signal->'route_points',input.origin_lat,input.origin_lng,
            input.destination_lat,input.destination_lng,input.origin_radius_km,input.destination_radius_km,'EITHER'))
        or (input.geometry is null or input.geometry='RADIUS') and coalesce(candidate.market_status,candidate.status::text)='EMPTY' and candidate.visibility='OPEN'
          and candidate.availability_geometry='RADIUS'
          and public.capacity_area_matches(candidate.capacity_area_boundary_json,input.origin_lat,input.origin_lng,input.origin_radius_km)
          and public.capacity_area_matches(candidate.capacity_area_boundary_json,input.destination_lat,input.destination_lng,input.destination_radius_km)
        or (input.geometry is null or input.geometry='RADIUS') and coalesce(candidate.market_status,candidate.status::text)='EMPTY' and exists(
          select 1 from jsonb_array_elements(candidate.recurring_corridors) signal where signal->>'geometry'='RADIUS'
            and public.capacity_area_matches(signal->'area_boundary',input.origin_lat,input.origin_lng,input.origin_radius_km)
            and public.capacity_area_matches(signal->'area_boundary',input.destination_lat,input.destination_lng,input.destination_radius_km))
      )
      or input.origin_lat is not null and input.destination_lat is null and (
        (input.geometry is null or input.geometry='ROUTE') and candidate.visibility='OPEN' and candidate.availability_geometry='ROUTE'
          and public.capacity_route_point_matches(candidate.current_route_points_json,input.origin_lat,input.origin_lng,input.origin_radius_km)
        or (input.geometry is null or input.geometry='ROUTE') and exists(select 1 from jsonb_array_elements(candidate.recurring_corridors) signal where signal->>'geometry'='ROUTE'
          and public.capacity_route_point_matches(signal->'route_points',input.origin_lat,input.origin_lng,input.origin_radius_km))
        or (input.geometry is null or input.geometry='RADIUS') and coalesce(candidate.market_status,candidate.status::text)='EMPTY' and candidate.visibility='OPEN'
          and candidate.availability_geometry='RADIUS'
          and public.capacity_area_matches(candidate.capacity_area_boundary_json,input.origin_lat,input.origin_lng,input.origin_radius_km)
        or (input.geometry is null or input.geometry='RADIUS') and coalesce(candidate.market_status,candidate.status::text)='EMPTY' and exists(
          select 1 from jsonb_array_elements(candidate.recurring_corridors) signal where signal->>'geometry'='RADIUS'
            and public.capacity_area_matches(signal->'area_boundary',input.origin_lat,input.origin_lng,input.origin_radius_km))
      )
      or input.destination_lat is not null and input.origin_lat is null and (
        (input.geometry is null or input.geometry='ROUTE') and candidate.visibility='OPEN' and candidate.availability_geometry='ROUTE'
          and public.capacity_route_point_matches(candidate.current_route_points_json,input.destination_lat,input.destination_lng,input.destination_radius_km)
        or (input.geometry is null or input.geometry='ROUTE') and exists(select 1 from jsonb_array_elements(candidate.recurring_corridors) signal where signal->>'geometry'='ROUTE'
          and public.capacity_route_point_matches(signal->'route_points',input.destination_lat,input.destination_lng,input.destination_radius_km))
        or (input.geometry is null or input.geometry='RADIUS') and coalesce(candidate.market_status,candidate.status::text)='EMPTY' and candidate.visibility='OPEN'
          and candidate.availability_geometry='RADIUS'
          and public.capacity_area_matches(candidate.capacity_area_boundary_json,input.destination_lat,input.destination_lng,input.destination_radius_km)
        or (input.geometry is null or input.geometry='RADIUS') and coalesce(candidate.market_status,candidate.status::text)='EMPTY' and exists(
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
$function$;

CREATE OR REPLACE FUNCTION public.private_capacity_filtered_page(requested_audience text, requested_digest text, actor_user_id uuid, cursor_updated_at timestamp with time zone, cursor_id uuid, requested_page_size integer, query jsonb)
 RETURNS TABLE(payload jsonb)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$with authorized_projection as (
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
  where capacity.latest_position=1 and (not (query ? 'viewport') or capacity.map_envelope && public.capacity_viewport_envelope(query) or regular.map_envelope && public.capacity_viewport_envelope(query)) and public.capacity_active_driver_id(vehicle.id) is not null
    and coalesce(capacity.market_status,capacity.status::text) in ('EMPTY','PARTIAL')
    and capacity.expires_at>now()
    and (provider.id is not null or organization.type='TRANSPORT_COMPANY')
    and (
      cursor_updated_at is null
      or capacity.updated_at<cursor_updated_at
      or capacity.updated_at=cursor_updated_at and capacity.id<cursor_id
    )
) select payload from authorized_projection where public.capacity_payload_matches(payload,query - 'q') and public.capacity_search_matches(payload,query) order by (payload->>'updated_at')::timestamptz desc,(payload->>'id')::uuid desc limit greatest(2,least(coalesce(requested_page_size,100),100)+1)$function$;

CREATE OR REPLACE FUNCTION public.capacity_search_public_rows(query jsonb DEFAULT '{}'::jsonb, cursor_updated_at timestamp with time zone DEFAULT NULL::timestamp with time zone, cursor_id uuid DEFAULT NULL::uuid, requested_page_size integer DEFAULT 14)
 RETURNS TABLE(payload jsonb)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
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
    null::text as search_text,
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
  where not (query ? 'vehicle_ids') or capacity.vehicle_id in (
    select value::uuid from jsonb_array_elements_text(query->'vehicle_ids')
  )
), candidates as (
  select
    capacity.*,regular.map_envelope as regular_map_envelope,vehicle.platform_number,vehicle.make as vehicle_make,vehicle.model as vehicle_model,
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
  where capacity.latest_position=1 and vehicle.active and public.capacity_active_driver_id(vehicle.id) is not null
    and coalesce(capacity.market_status,capacity.status::text) in ('EMPTY','PARTIAL')
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
  where public.capacity_search_matches(to_jsonb(candidate),query) and candidate.visibility='OPEN' and (not (query ? 'viewport') or candidate.map_envelope && public.capacity_viewport_envelope(query) or candidate.regular_map_envelope && public.capacity_viewport_envelope(query)) and public.capacity_viewport_matches(jsonb_build_object('location_lat',candidate.location_lat,'location_lng',candidate.location_lng,'location_precision_km',candidate.location_precision_km,'current_route_points',candidate.current_route_points_json,'capacity_area_boundary',candidate.capacity_area_boundary_json,'recurring_corridors',candidate.recurring_corridors),query)
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
        (input.geometry is null or input.geometry='ROUTE') and candidate.visibility='OPEN' and candidate.availability_geometry='ROUTE'
          and public.capacity_route_matches(candidate.current_route_points_json,input.origin_lat,input.origin_lng,
            input.destination_lat,input.destination_lng,input.origin_radius_km,input.destination_radius_km,input.direction_mode)
        or (input.geometry is null or input.geometry='ROUTE') and exists(select 1 from jsonb_array_elements(candidate.recurring_corridors) signal
          where signal->>'geometry'='ROUTE' and public.capacity_route_matches(signal->'route_points',input.origin_lat,input.origin_lng,
            input.destination_lat,input.destination_lng,input.origin_radius_km,input.destination_radius_km,'EITHER'))
        or (input.geometry is null or input.geometry='RADIUS') and coalesce(candidate.market_status,candidate.status::text)='EMPTY' and candidate.visibility='OPEN'
          and candidate.availability_geometry='RADIUS'
          and public.capacity_area_matches(candidate.capacity_area_boundary_json,input.origin_lat,input.origin_lng,input.origin_radius_km)
          and public.capacity_area_matches(candidate.capacity_area_boundary_json,input.destination_lat,input.destination_lng,input.destination_radius_km)
        or (input.geometry is null or input.geometry='RADIUS') and coalesce(candidate.market_status,candidate.status::text)='EMPTY' and exists(
          select 1 from jsonb_array_elements(candidate.recurring_corridors) signal where signal->>'geometry'='RADIUS'
            and public.capacity_area_matches(signal->'area_boundary',input.origin_lat,input.origin_lng,input.origin_radius_km)
            and public.capacity_area_matches(signal->'area_boundary',input.destination_lat,input.destination_lng,input.destination_radius_km))
      )
      or input.origin_lat is not null and input.destination_lat is null and (
        (input.geometry is null or input.geometry='ROUTE') and candidate.visibility='OPEN' and candidate.availability_geometry='ROUTE'
          and public.capacity_route_point_matches(candidate.current_route_points_json,input.origin_lat,input.origin_lng,input.origin_radius_km)
        or (input.geometry is null or input.geometry='ROUTE') and exists(select 1 from jsonb_array_elements(candidate.recurring_corridors) signal where signal->>'geometry'='ROUTE'
          and public.capacity_route_point_matches(signal->'route_points',input.origin_lat,input.origin_lng,input.origin_radius_km))
        or (input.geometry is null or input.geometry='RADIUS') and coalesce(candidate.market_status,candidate.status::text)='EMPTY' and candidate.visibility='OPEN'
          and candidate.availability_geometry='RADIUS'
          and public.capacity_area_matches(candidate.capacity_area_boundary_json,input.origin_lat,input.origin_lng,input.origin_radius_km)
        or (input.geometry is null or input.geometry='RADIUS') and coalesce(candidate.market_status,candidate.status::text)='EMPTY' and exists(
          select 1 from jsonb_array_elements(candidate.recurring_corridors) signal where signal->>'geometry'='RADIUS'
            and public.capacity_area_matches(signal->'area_boundary',input.origin_lat,input.origin_lng,input.origin_radius_km))
      )
      or input.destination_lat is not null and input.origin_lat is null and (
        (input.geometry is null or input.geometry='ROUTE') and candidate.visibility='OPEN' and candidate.availability_geometry='ROUTE'
          and public.capacity_route_point_matches(candidate.current_route_points_json,input.destination_lat,input.destination_lng,input.destination_radius_km)
        or (input.geometry is null or input.geometry='ROUTE') and exists(select 1 from jsonb_array_elements(candidate.recurring_corridors) signal where signal->>'geometry'='ROUTE'
          and public.capacity_route_point_matches(signal->'route_points',input.destination_lat,input.destination_lng,input.destination_radius_km))
        or (input.geometry is null or input.geometry='RADIUS') and coalesce(candidate.market_status,candidate.status::text)='EMPTY' and candidate.visibility='OPEN'
          and candidate.availability_geometry='RADIUS'
          and public.capacity_area_matches(candidate.capacity_area_boundary_json,input.destination_lat,input.destination_lng,input.destination_radius_km)
        or (input.geometry is null or input.geometry='RADIUS') and coalesce(candidate.market_status,candidate.status::text)='EMPTY' and exists(
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
  select * from filtered order by updated_at desc,id desc
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
$function$;
CREATE OR REPLACE FUNCTION public.capacity_search_private_rows(requested_audience text, requested_digest text, actor_user_id uuid, cursor_updated_at timestamp with time zone, cursor_id uuid, requested_page_size integer, query jsonb)
 RETURNS TABLE(payload jsonb)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$with authorized_projection as (
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
  where capacity.latest_position=1 and (not (query ? 'viewport') or capacity.map_envelope && public.capacity_viewport_envelope(query) or regular.map_envelope && public.capacity_viewport_envelope(query)) and public.capacity_active_driver_id(vehicle.id) is not null
    and coalesce(capacity.market_status,capacity.status::text) in ('EMPTY','PARTIAL')
    and capacity.expires_at>now()
    and (provider.id is not null or organization.type='TRANSPORT_COMPANY')
    and (
      cursor_updated_at is null
      or capacity.updated_at<cursor_updated_at
      or capacity.updated_at=cursor_updated_at and capacity.id<cursor_id
    )
) select payload from authorized_projection where public.capacity_payload_matches(payload,query - 'q') and public.capacity_search_matches(payload,query) order by (payload->>'updated_at')::timestamptz desc,(payload->>'id')::uuid desc$function$;

create function public.capacity_search_results(query jsonb, requested_audience text default 'PUBLIC', requested_digest text default null, actor_user_id uuid default null, requested_page integer default 1)
returns jsonb language plpgsql stable security definer set search_path=public,extensions,pg_temp as $$
declare answer jsonb; page_number integer:=greatest(1,least(coalesce(requested_page,1),10000));
begin
 if requested_audience not in ('PUBLIC','EMAIL','LOADGISTIC') or requested_audience is null then raise exception 'FORBIDDEN';end if;
 if length(coalesce(query->>'q',''))>120 then raise exception 'INVALID_SEARCH';end if;
 with capacity as materialized (
  select payload from public.capacity_search_public_rows(query - 'viewport',null,null,14) where requested_audience='PUBLIC'
  union all
  select payload from public.capacity_search_private_rows(requested_audience,requested_digest,actor_user_id,null,null,100,query - 'viewport') where requested_audience<>'PUBLIC'
 ), facts as materialized (
  select payload,public.capacity_search_metadata(payload) as meta from capacity
 ), entries as (
  select 'PROVIDER:'||(payload->>'provider_handle') as key,meta->>'kind' as kind,payload->>'provider_name' as title,meta->>'headline' as subtitle,concat_ws(' ',meta->>'about',meta->>'services') as description,payload->>'provider_handle' as identifier,
   payload->>'provider_handle' as handle,null::text as capacity_id,meta->>'city' as city,null::text as status,payload->>'provider_name' as owner,null::text as driver,meta->'owner_documents' as documents from facts
  union all
  select 'DRIVER:'||(meta->>'driver_key'),'COMPANY_DRIVER',meta->>'driver_name',payload->>'provider_name',null,null,payload->>'provider_handle',
   payload->>'id',meta->>'city',null,payload->>'provider_name',meta->>'driver_name',meta->'driver_documents' from facts
   where meta->>'kind'='COMPANY' and nullif(meta->>'driver_name','') is not null
 ), grouped as (
  select key,kind,title,subtitle,left(description,220) as description,identifier,handle,
    min(capacity_id) as capacity_id,city,status,owner,driver,documents,count(*) as matching_trucks,
    public.capacity_text_score(query->>'q',concat_ws(' ',title,identifier),concat_ws(' ',subtitle,description,city,owner,driver)) as score
  from entries
  group by key,kind,title,subtitle,description,identifier,handle,city,status,owner,driver,documents
 ), ordered as (
  select *,row_number() over(order by score desc,case kind when 'COMPANY' then 0 when 'OWNER_OPERATOR' then 1 when 'SELF_MANAGED_DRIVER' then 2 else 4 end,lower(title),key) as position from grouped
 ) select jsonb_build_object('items',coalesce((select jsonb_agg(to_jsonb(o)-'score'-'position' order by position) from ordered o where position>(page_number-1)*15 and position<=page_number*15),'[]'::jsonb),
  'total',(select count(*) from grouped),'page',page_number,'pageSize',15,'hasMore',(select count(*) from grouped)>page_number*15) into answer;
 return answer;
end $$;

-- Safe metadata helpers must not become browser RPCs. Existing roles stay unchanged.
revoke all on function public.capacity_text_score(text,text,text),public.capacity_search_metadata(jsonb),public.capacity_search_matches(jsonb,jsonb),
 public.capacity_search_public_rows(jsonb,timestamptz,uuid,integer),public.capacity_search_private_rows(text,text,uuid,timestamptz,uuid,integer,jsonb),
 public.capacity_search_results(jsonb,text,text,uuid,integer) from public,anon,authenticated;
grant execute on function public.capacity_text_score(text,text,text),public.capacity_search_metadata(jsonb),public.capacity_search_matches(jsonb,jsonb),
 public.capacity_search_public_rows(jsonb,timestamptz,uuid,integer),public.capacity_search_private_rows(text,text,uuid,timestamptz,uuid,integer,jsonb),
 public.capacity_search_results(jsonb,text,text,uuid,integer) to service_role;

-- Avoid JIT compilation overhead for this bounded interactive search query.
alter function public.capacity_search_results(jsonb,text,text,uuid,integer) set jit=off;
