-- Server-only safe candidate projection for Daily Featured Transporters and Sponsors.

create or replace function public.public_featured_provider_candidates(requested_region_codes text[])
returns setof jsonb
language sql
stable
security definer
set search_path=''
as $$
with candidate as (
  select page.organization_id as provider_organization_id,page.provider_profile_id,
    profile.user_id as profile_user_id,coalesce(organization.name,profile.business_name) as provider_name,
    coalesce(organization.handle,profile.handle) as provider_handle,
    coalesce(organization.city,profile.city) as base_place_label,
    coalesce(organization.city_place_ref,profile.city_place_ref) as base_place_ref,page.base_region_code,
    page.headline,page.about,page.services,page.operating_regions,page.profile_image_preset,
    page.profile_image_path is not null as has_profile_image,page.profile_image_updated_at,
    page.published as page_published,
    ((page.show_contact_phone and nullif(trim(page.contact_phone),'') is not null)
      or (page.show_contact_whatsapp and nullif(trim(page.contact_whatsapp),'') is not null)
      or (page.show_contact_email and nullif(trim(page.contact_email),'') is not null)
      or (page.show_contact_website and nullif(trim(page.contact_website),'') is not null)) as has_public_contact
  from public.company_pages page
  left join public.organizations organization on organization.id=page.organization_id
  left join public.provider_profiles profile on profile.id=page.provider_profile_id
  where page.base_region_code=any(coalesce(requested_region_codes,array[]::text[]))
    and (profile.id is not null or organization.type='TRANSPORT_COMPANY')
), enriched as (
  select candidate.*,
    coalesce(fleet.fleet_size,0)::integer as fleet_size,
    coalesce(fleet.active_capacity_count,0)::integer as active_capacity_count,
    coalesce(review.review_count,0)::integer as review_count,review.average_rating,
    regular.signal as regular_signal,
    case when candidate.provider_organization_id is not null then 'FLEET_TRANSPORTER'
      when coalesce(evidence.has_ownership,false) then 'OWNER_OPERATOR'
      else 'SELF_MANAGED_DRIVER' end as provider_kind,
    candidate.page_published and candidate.has_public_contact
      and nullif(trim(candidate.base_place_label),'') is not null and candidate.base_place_ref is not null
      and candidate.base_region_code is not null
      and coalesce(fleet.fleet_size,0)>0
      and case when candidate.provider_organization_id is not null then
        coalesce(evidence.has_identity,false) and coalesce(evidence.has_business_license,false)
          and coalesce(evidence.has_business_address,false)
      else coalesce(evidence.has_identity,false) and coalesce(evidence.has_driver_identity,false)
        and (coalesce(evidence.has_ownership,false) or coalesce(evidence.has_authorization,false)) end as eligible
  from candidate
  left join lateral (
    select count(distinct vehicle.id) filter(where vehicle.active)::integer as fleet_size,
      count(distinct vehicle.id) filter(where vehicle.active and capacity.expires_at>now()
        and coalesce(capacity.market_status,capacity.status::text) in ('EMPTY','PARTIAL'))::integer as active_capacity_count
    from public.vehicles vehicle
    left join public.capacities capacity on capacity.vehicle_id=vehicle.id
    where vehicle.organization_id=candidate.provider_organization_id
      or vehicle.provider_profile_id=candidate.provider_profile_id
  ) fleet on true
  left join lateral (
    select count(*)::integer as review_count,round(avg(provider_review.rating),1) as average_rating
    from public.provider_reviews provider_review
    where provider_review.status='PUBLISHED' and (
      provider_review.provider_organization_id=candidate.provider_organization_id
      or provider_review.provider_profile_id=candidate.provider_profile_id)
  ) review on true
  left join lateral (
    select jsonb_build_object('geometry',route.geometry,'route_points',route.route_points_json,
      'area_center_label',route.area_center_label,'area_boundary',route.area_boundary_json) as signal
    from public.profile_routes route
    where route.organization_id=candidate.provider_organization_id
      or route.provider_profile_id=candidate.provider_profile_id
    order by route.created_at desc,route.id desc limit 1
  ) regular on true
  left join lateral (
    select
      exists(select 1 from public.verification_requests request where request.status='APPROVED'
        and request.verification_type='IDENTITY' and request.subject_type=case when candidate.provider_organization_id is not null then 'ORGANIZATION' else 'PROVIDER_PROFILE' end::public.verification_subject_type
        and request.subject_id=coalesce(candidate.provider_organization_id,candidate.provider_profile_id)
        and (request.expires_on is null or request.expires_on>=current_date)) as has_identity,
      exists(select 1 from public.verification_requests request where request.status='APPROVED'
        and request.subject_type='ORGANIZATION' and request.subject_id=candidate.provider_organization_id
        and request.verification_type='BUSINESS_LICENSE' and (request.expires_on is null or request.expires_on>=current_date)) as has_business_license,
      exists(select 1 from public.verification_requests request where request.status='APPROVED'
        and request.subject_type='ORGANIZATION' and request.subject_id=candidate.provider_organization_id
        and request.verification_type='BUSINESS_ADDRESS' and (request.expires_on is null or request.expires_on>=current_date)) as has_business_address,
      exists(select 1 from public.verification_requests request where request.status='APPROVED'
        and request.subject_type='PROVIDER_PROFILE' and request.subject_id=candidate.provider_profile_id
        and request.verification_type='DRIVER_IDENTITY' and (request.expires_on is null or request.expires_on>=current_date)) as has_driver_identity,
      exists(select 1 from public.vehicles vehicle join public.verification_requests request
        on request.subject_type='VEHICLE' and request.subject_id=vehicle.id
        where vehicle.active and vehicle.provider_profile_id=candidate.provider_profile_id
          and request.status='APPROVED' and request.verification_type='VEHICLE_OWNERSHIP'
          and (request.expires_on is null or request.expires_on>=current_date)) as has_ownership,
      exists(select 1 from public.vehicles vehicle join public.verification_requests request
        on request.related_vehicle_id=vehicle.id where vehicle.active and vehicle.provider_profile_id=candidate.provider_profile_id
          and request.status='APPROVED' and request.verification_type='VEHICLE_AUTHORIZATION'
          and (request.expires_on is null or request.expires_on>=current_date)
          and ((request.subject_type='PROVIDER_PROFILE' and request.subject_id=candidate.provider_profile_id)
            or (request.subject_type='DRIVER' and request.subject_id=candidate.profile_user_id))) as has_authorization
  ) evidence on true
)
select jsonb_build_object(
  'provider_organization_id',provider_organization_id,'provider_profile_id',provider_profile_id,
  'name',provider_name,'handle',provider_handle,'base_place',base_place_label,'base_region_code',base_region_code,
  'headline',headline,'about',about,'services',services,'operating_regions',operating_regions,
  'has_profile_image',has_profile_image,'profile_image_preset',profile_image_preset,
  'profile_image_updated_at',profile_image_updated_at,'provider_kind',provider_kind,
  'fleet_size',fleet_size,'active_capacity_count',active_capacity_count,'review_count',review_count,
  'average_rating',average_rating,'regular_signal',regular_signal,'eligible',eligible
)
from enriched order by provider_name
$$;

revoke all on function public.public_featured_provider_candidates(text[]) from public,anon,authenticated;
grant execute on function public.public_featured_provider_candidates(text[]) to service_role;
