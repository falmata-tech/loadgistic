-- FEAT-SEC-001 / NR-66: fix authority lookup scope without materializing discovery facts.
-- Preserve existing authority predicates, function owners and execute privileges.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';
set local search_path=pg_catalog;

do $metadata$
declare signature text;target pg_catalog.pg_proc%rowtype;
begin
 select * into strict target from pg_catalog.pg_proc
 where oid='public.current_provider_vehicle_authority()'::pg_catalog.regprocedure;
 if target.proowner<>'postgres'::pg_catalog.regrole or target.prosecdef
  or target.provolatile<>'s' or target.prolang<>(select oid from pg_catalog.pg_language where lanname='sql')
  or target.proconfig is not null or pg_catalog.md5(target.prosrc)<>'746a9edefacb523e50e78228480a2bd4'
  or target.proacl is distinct from array['postgres=X/postgres'::pg_catalog.aclitem]
 then raise exception 'AUTHORITY_SEARCH_PATH_SOURCE_DRIFT';end if;
 foreach signature in array array['public.provider_scope_can_publish(uuid,uuid)',
  'public.provider_vehicle_authority_state(uuid)','public.provider_fleet_authority_summary(uuid,uuid)'] loop
  select * into strict target from pg_catalog.pg_proc where oid=signature::pg_catalog.regprocedure;
  if target.proowner<>'postgres'::pg_catalog.regrole or not target.prosecdef or target.provolatile<>'s'
   or target.prolang<>(select oid from pg_catalog.pg_language where lanname='sql')
   or target.proconfig is distinct from array['search_path=public, pg_temp']::text[]
   or target.proacl is distinct from array['postgres=X/postgres'::pg_catalog.aclitem]
  then raise exception 'AUTHORITY_DISCOVERY_CALLER_METADATA_DRIFT';end if;
 end loop;
end $metadata$;

set local search_path=pg_catalog;

create view public.current_provider_vehicle_authority_rows(review_id,source_request_id,vehicle_id,organization_id,provider_profile_id,fact_kind,holder_basis,reviewed_at,expires_on) with(security_invoker=true) as select a.id,a.source_request_id,a.vehicle_id,a.organization_id,a.provider_profile_id,a.fact_kind,a.holder_basis,a.reviewed_at,a.expires_on
 from public.provider_vehicle_authority_reviews a
 join public.verification_requests r on r.id=a.source_request_id and r.status='APPROVED'
 join public.vehicles v on v.id=a.vehicle_id and v.active
 where a.revoked_at is null and (a.expires_on is null or a.expires_on>=(pg_catalog.now() at time zone 'Africa/Addis_Ababa')::date)
 and (r.expires_on is null or r.expires_on>=(pg_catalog.now() at time zone 'Africa/Addis_Ababa')::date)
 and v.organization_id is not distinct from a.organization_id
 and v.provider_profile_id is not distinct from a.provider_profile_id
 and a.vehicle_identity_digest=public.provider_vehicle_authority_identity(v)
 and ((r.subject_type='VEHICLE' and r.subject_id=v.id)
   or (a.fact_kind='PERMISSION' and r.subject_type='PROVIDER_PROFILE' and r.subject_id=v.provider_profile_id and r.related_vehicle_id=v.id))
 and ((a.fact_kind='OWNERSHIP' and r.verification_type::text='VEHICLE_OWNERSHIP')
   or (a.fact_kind='PERMISSION' and r.verification_type::text='VEHICLE_AUTHORIZATION')
   or (a.fact_kind='OPERATING_LICENCE' and r.verification_type::text='VEHICLE_OPERATING_LICENSE' and a.holder_basis in ('OWNED','FINANCED')));

revoke all on public.current_provider_vehicle_authority_rows from public,anon,authenticated,service_role;

alter function public.current_provider_vehicle_authority() set search_path=pg_catalog;

do $guard$ begin if (select md5(prosrc) from pg_proc where oid='public.provider_scope_can_publish(uuid,uuid)'::regprocedure)<>'0acd71e59d9ec5ab8df086b9a9d99e06' then raise exception 'LOADGISTIC_181_CALLER_DRIFT';end if;end $guard$;

CREATE OR REPLACE FUNCTION public.provider_scope_can_publish(target_organization_id uuid, target_provider_profile_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
 select (target_organization_id is null)<>(target_provider_profile_id is null)
 and (exists(select 1 from public.organizations o
    join public.organization_members m on m.organization_id=o.id and m.membership_role='OWNER'
    join public.profiles p on p.id=m.user_id and p.active and p.role='TRANSPORTER'
    join auth.users u on u.id=p.id and u.deleted_at is null
    where o.id=target_organization_id and o.type='TRANSPORT_COMPANY')
  or exists(select 1 from public.provider_profiles owner
    join public.profiles p on p.id=owner.user_id and p.active and p.role='DRIVER'
    join auth.users u on u.id=p.id and u.deleted_at is null
    where owner.id=target_provider_profile_id))
 and (exists(select 1 from public.current_provider_vehicle_authority_rows a
  where a.organization_id is not distinct from target_organization_id and a.provider_profile_id is not distinct from target_provider_profile_id
  and (a.fact_kind='OWNERSHIP' or a.fact_kind='OPERATING_LICENCE' and a.holder_basis in ('OWNED','FINANCED')))
  or (select count(*) from public.vehicles v where v.active and v.publication_status='LIVE'
    and(v.organization_id=target_organization_id or v.provider_profile_id=target_provider_profile_id))<=1)
$function$
;

do $guard$ begin if (select md5(prosrc) from pg_proc where oid='public.provider_vehicle_authority_state(uuid)'::regprocedure)<>'bd4c3d658f4aaa61bea7044a4aaa2da2' then raise exception 'LOADGISTIC_181_CALLER_DRIFT';end if;end $guard$;

CREATE OR REPLACE FUNCTION public.provider_vehicle_authority_state(target_vehicle_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
 with latest as (
  select distinct on(a.fact_kind) a.* from public.current_provider_vehicle_authority_rows a where a.vehicle_id=target_vehicle_id
  order by a.fact_kind,a.reviewed_at desc,a.review_id desc
 ) select jsonb_build_object(
  'ownership',jsonb_build_object('verified',exists(select 1 from latest where fact_kind='OWNERSHIP'),
   'reviewedAt',(select reviewed_at from latest where fact_kind='OWNERSHIP'),'expiresOn',(select expires_on from latest where fact_kind='OWNERSHIP')),
  'permission',jsonb_build_object('verified',exists(select 1 from latest where fact_kind='PERMISSION'),
   'reviewedAt',(select reviewed_at from latest where fact_kind='PERMISSION'),'expiresOn',(select expires_on from latest where fact_kind='PERMISSION')),
  'operatingLicence',jsonb_build_object('verified',exists(select 1 from latest where fact_kind='OPERATING_LICENCE'),
   'holderBasis',(select holder_basis from latest where fact_kind='OPERATING_LICENCE'),
   'reviewedAt',(select reviewed_at from latest where fact_kind='OPERATING_LICENCE'),'expiresOn',(select expires_on from latest where fact_kind='OPERATING_LICENCE')),
  'qualifiesProvider',exists(select 1 from latest where fact_kind='OWNERSHIP' or fact_kind='OPERATING_LICENCE' and holder_basis in ('OWNED','FINANCED')))
$function$
;

do $guard$ begin if (select md5(prosrc) from pg_proc where oid='public.provider_fleet_authority_summary(uuid,uuid)'::regprocedure)<>'36714632210048e94072dd001ad73165' then raise exception 'LOADGISTIC_181_CALLER_DRIFT';end if;end $guard$;

CREATE OR REPLACE FUNCTION public.provider_fleet_authority_summary(target_organization_id uuid, target_provider_profile_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
 with fleet as (
  select v.id from public.vehicles v where v.active and v.publication_status='LIVE'
   and v.organization_id is not distinct from target_organization_id and v.provider_profile_id is not distinct from target_provider_profile_id
   and public.provider_scope_can_publish(v.organization_id,v.provider_profile_id)
   and public.capacity_public_policy_allows(v.id)
   and exists(select 1 from public.company_pages page where page.published and(page.organization_id=v.organization_id or page.provider_profile_id=v.provider_profile_id))
   and(exists(select 1 from public.organizations owner where owner.id=v.organization_id and owner.public_visibility='PUBLIC')
    or exists(select 1 from public.provider_profiles owner where owner.id=v.provider_profile_id and owner.public_visibility='PUBLIC'))
 ), facts as (
  select f.id,bool_or(a.fact_kind='OWNERSHIP') as owned,
   bool_or(a.fact_kind='OPERATING_LICENCE' and a.holder_basis='FINANCED') as financed,
   bool_or(a.fact_kind='PERMISSION') as permission,bool_or(a.fact_kind='OPERATING_LICENCE') as licence
  from fleet f left join public.current_provider_vehicle_authority_rows a on a.vehicle_id=f.id group by f.id
 ) select jsonb_build_object('total',count(*),'ownershipVerified',count(*) filter(where owned),
  'financedVerified',count(*) filter(where not coalesce(owned,false) and financed),
  'permissionVerified',count(*) filter(where not coalesce(owned,false) and not coalesce(licence,false) and permission),
  'notYetVerified',count(*) filter(where not coalesce(owned,false) and not coalesce(licence,false) and not coalesce(permission,false)),
  'operatingLicenceVerified',count(*) filter(where not coalesce(owned,false) and licence)) from facts
$function$
;

do $parity$ begin if exists((select * from public.current_provider_vehicle_authority() except all select * from public.current_provider_vehicle_authority_rows) union all (select * from public.current_provider_vehicle_authority_rows except all select * from public.current_provider_vehicle_authority())) then raise exception 'LOADGISTIC_181_VIEW_PARITY_FAILED';end if;end $parity$;


-- Reuse the existing per-provider and per-vehicle query materialization.
do $guard$ begin
 if (select md5(prosrc) from pg_proc where oid='public.capacity_search_public_profile_rows(jsonb,timestamptz,uuid,integer)'::regprocedure)<>'d66c54fa82ca2e85c50f9d109a77f6bc'
 then raise exception 'LOADGISTIC_181_PROFILE_SCOPE_DRIFT';end if;
end $guard$;
CREATE OR REPLACE FUNCTION public.capacity_search_public_profile_rows(query jsonb DEFAULT '{}'::jsonb, cursor_updated_at timestamp with time zone DEFAULT NULL::timestamp with time zone, cursor_id uuid DEFAULT NULL::uuid, requested_page_size integer DEFAULT 14)
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
    public.capacity_filter_values(query->>'status','status') as capacity_status,
    upper(nullif(trim(query->>'geometry'),'')) as geometry,
    public.capacity_filter_values(query->>'vehicle_category','vehicle_category') as vehicle_category,
    public.capacity_filter_values(query->>'load_type','load_type') as load_type,
    public.capacity_filter_values(query->>'stop_option','stop_option') as stop_option,
    public.capacity_filter_values(query->>'freshness','freshness') as freshness,
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
), driver_scoped as materialized (
   select latest.*,public.capacity_active_driver_id(latest.vehicle_id) as active_driver_id
   from latest where latest.latest_position=1
  ), driver_named as materialized (
   select scoped.*,coalesce(nullif(public.normalize_personal_name(driver_profile.first_name),''),
    nullif(split_part(public.normalize_personal_name(driver_profile.full_name),' ',1),'')) as active_driver_name
   from driver_scoped scoped left join public.profiles driver_profile
    on driver_profile.id=scoped.active_driver_id and driver_profile.active
  ), provider_refs as materialized (
   select distinct provider_organization_id as organization_id,provider_profile_id as profile_id
   from driver_named
  ), provider_names as materialized (
   select refs.organization_id,refs.profile_id,
    public.provider_public_account_name(refs.organization_id,refs.profile_id) as provider_name
   from provider_refs refs
  ), vehicle_provider_refs181 as materialized (
   select distinct vehicle.organization_id,vehicle.provider_profile_id
   from driver_named capacity join public.vehicles vehicle on vehicle.id=capacity.vehicle_id
   where capacity.latest_position=1
  ), publishable_provider_scopes181 as materialized (
   select refs.organization_id,refs.provider_profile_id,
    public.provider_scope_can_publish(refs.organization_id,refs.provider_profile_id) as can_publish
   from vehicle_provider_refs181 refs
  ), candidates as (
  select
    capacity.*,regular.map_envelope as regular_map_envelope,vehicle.platform_number,vehicle.make as vehicle_make,vehicle.model as vehicle_model,
    coalesce(vehicle.cargo_configuration,vehicle.category) as cargo_configuration,
    provider_names.provider_name as provider_name,
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
  from driver_named capacity
  join public.vehicles vehicle on vehicle.id=capacity.vehicle_id
  join publishable_provider_scopes181 publishable
   on publishable.organization_id is not distinct from vehicle.organization_id
   and publishable.provider_profile_id is not distinct from vehicle.provider_profile_id
   left join provider_names on provider_names.organization_id is not distinct from capacity.provider_organization_id
    and provider_names.profile_id is not distinct from capacity.provider_profile_id
  left join public.organizations organization on organization.id=capacity.provider_organization_id
  left join public.provider_profiles provider on provider.id=capacity.provider_profile_id
  left join public.profiles provider_user on provider_user.id=provider.user_id
  join public.company_pages page on page.published and (
    page.organization_id=capacity.provider_organization_id or page.provider_profile_id=capacity.provider_profile_id
  )
  left join public.profile_routes regular on regular.assigned_vehicle_id=capacity.vehicle_id
    and regular.assigned_driver_user_id=capacity.active_driver_id
    and (regular.organization_id=capacity.provider_organization_id or regular.provider_profile_id=capacity.provider_profile_id)
  where capacity.latest_position=1 and vehicle.publication_status='LIVE'
 and publishable.can_publish and vehicle.active
    and not exists(select 1 from public.organizations blocked where blocked.id=vehicle.organization_id and (blocked.content_hidden or blocked.review_workspace))
    and not exists(select 1 from public.provider_profiles blocked where blocked.id=vehicle.provider_profile_id and (blocked.content_hidden or blocked.review_workspace)) and capacity.active_driver_id is not null
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
  where public.capacity_search_matches(to_jsonb(candidate),query) and candidate.visibility='OPEN' and public.capacity_sharing_mode(candidate.vehicle_id) in ('PUBLIC','BOTH') and (not (query ? 'viewport') or candidate.map_envelope && public.capacity_viewport_envelope(query) or candidate.regular_map_envelope && public.capacity_viewport_envelope(query)) and public.capacity_viewport_matches(jsonb_build_object('location_lat',candidate.location_lat,'location_lng',candidate.location_lng,'location_precision_km',candidate.location_precision_km,'current_route_points',candidate.current_route_points_json,'capacity_area_boundary',candidate.capacity_area_boundary_json,'recurring_corridors',candidate.recurring_corridors),query)
    and (cursor_updated_at is null or candidate.updated_at<cursor_updated_at
      or (candidate.updated_at=cursor_updated_at and candidate.id<cursor_id))
    and (input.capacity_id is null or candidate.id=input.capacity_id)
    and (input.provider_organization_id is null or candidate.provider_organization_id=input.provider_organization_id)
    and (input.provider_profile_id is null or candidate.provider_profile_id=input.provider_profile_id)
    and (input.provider_handle is null or lower(candidate.provider_handle)=input.provider_handle)
    and (input.capacity_status is null or coalesce(candidate.market_status,candidate.status::text)=any(input.capacity_status))
    and (coalesce(candidate.market_status,candidate.status::text) is distinct from 'PARTIAL' or input.geometry is distinct from 'RADIUS')
    and (input.geometry is null or (
      candidate.visibility='OPEN' and candidate.availability_geometry=input.geometry
      or exists(select 1 from jsonb_array_elements(candidate.recurring_corridors) signal where signal->>'geometry'=input.geometry)
    ))
    and (input.vehicle_category is null or candidate.cargo_configuration=any(input.vehicle_category))
    and (input.load_type is null or candidate.visibility='OPEN' and (
      'FTL'=any(input.load_type) and candidate.accepts_full_load or 'PTL'=any(input.load_type) and candidate.accepts_partial_load
    ))
    and (input.stop_option is null or candidate.visibility='OPEN' and (
      'MULTI_PICK'=any(input.stop_option) and candidate.accepts_multi_pick or 'MULTI_DROP'=any(input.stop_option) and candidate.accepts_multi_drop
    ))
    and (input.freshness is null
      or 'FRESH'=any(input.freshness) and candidate.updated_at>=now()-interval '12 hours'
      or 'UPDATE_NEEDED'=any(input.freshness) and candidate.updated_at<now()-interval '12 hours')
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
) select jsonb_build_object('id',id,'vehicle_id',vehicle_id,
   'provider_organization_id',provider_organization_id,'provider_profile_id',provider_profile_id,
   'provider_name',provider_name,'provider_handle',provider_handle,
   'active_driver_id',active_driver_id,'active_driver_name',active_driver_name) as payload
  from filtered order by updated_at desc,id desc
$function$
;

do $cluster_driver_cache181$
declare before_proc pg_catalog.pg_proc%rowtype;after_proc pg_catalog.pg_proc%rowtype;
 definition text;before_definition text;old_text text;new_text text;
begin
 select * into strict before_proc from pg_catalog.pg_proc
 where oid='public.public_capacity_clusters(jsonb,timestamptz,uuid,integer)'::pg_catalog.regprocedure;
 if pg_catalog.md5(before_proc.prosrc)<>'ec1dd89a42bc7d1fb5501a61cf1ce52c'
  or before_proc.proowner<>'postgres'::pg_catalog.regrole or not before_proc.prosecdef
  or before_proc.provolatile<>'s' or before_proc.proconfig is distinct from array['search_path=public, extensions, pg_temp']::text[]
  or before_proc.proacl::text is distinct from '{postgres=X/postgres,service_role=X/postgres}'
 then raise exception 'CLUSTER_181_EXACT_SOURCE_METADATA_REQUIRED';end if;
 definition:=pg_catalog.pg_get_functiondef(before_proc.oid);before_definition:=definition;
 if position('_cluster_driver_id181' in definition)>0
  or (length(definition)-length(replace(definition,'public.capacity_active_driver_id(','')))/length('public.capacity_active_driver_id(')<>2
 then raise exception 'CLUSTER_181_ORIGINAL_DRIVER_RESOLUTION_REQUIRED';end if;
 for old_text,new_text in values
  ($before$), candidates as ($before$,$after$), driver_scoped_cluster181 as materialized (
  select latest.*,public.capacity_active_driver_id(latest.vehicle_id) as _cluster_driver_id181
  from latest where latest.latest_position=1
 ), candidates as ($after$),
  ($before$from latest capacity$before$,$after$from driver_scoped_cluster181 capacity$after$),
  ($before$public.capacity_active_driver_id(vehicle.id)$before$,$after$capacity._cluster_driver_id181$after$),
  ($before$public.capacity_active_driver_id(capacity.vehicle_id)$before$,$after$capacity._cluster_driver_id181$after$)
 loop
  if (length(definition)-length(replace(definition,old_text,'')))/length(old_text)<>1
   then raise exception 'CLUSTER_181_EXACT_ANCHOR_REQUIRED';end if;
  definition:=replace(definition,old_text,new_text);
 end loop;
 if (length(definition)-length(replace(definition,'public.capacity_active_driver_id(','')))/length('public.capacity_active_driver_id(')<>1
  or position('public.capacity_active_driver_id(latest.vehicle_id)' in definition)=0
  or split_part(definition,'), filtered as (',2) is distinct from split_part(before_definition,'), filtered as (',2)
 then raise exception 'CLUSTER_181_ONLY_CACHE_TRANSFORM_REQUIRED';end if;
 execute definition;
 select * into strict after_proc from pg_catalog.pg_proc where oid=before_proc.oid;
 if (to_jsonb(after_proc)-'prosrc') is distinct from (to_jsonb(before_proc)-'prosrc')
  or pg_catalog.md5(after_proc.prosrc)<>'f39ea32acc93a886d7483f39054057bf'
 then raise exception 'CLUSTER_181_METADATA_OR_BODY_DRIFT';end if;
end $cluster_driver_cache181$;

commit;
