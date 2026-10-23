-- FEAT-PRV-001 / FEAT-LST-001: bounded complete public fleet pages.
-- Existing rows and public capacity eligibility are unchanged.
create index if not exists vehicles_public_organization_page_idx
  on public.vehicles(organization_id,platform_number,id) where active;
create index if not exists vehicles_public_profile_page_idx
  on public.vehicles(provider_profile_id,platform_number,id) where active;

create function public.public_provider_fleet_page(
  requested_organization_id uuid default null, requested_provider_profile_id uuid default null,
  requested_page integer default 1
) returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare total integer; page_number integer; page_count integer; trucks jsonb; evidence jsonb;
  owner_user_id uuid; owner_operator boolean:=false; today date:=(now() at time zone 'Africa/Addis_Ababa')::date;
begin
  if (requested_organization_id is null)=(requested_provider_profile_id is null) then raise exception 'INVALID_PROVIDER_SCOPE';end if;
  if not exists(select 1 from company_pages p
    where p.published and (p.organization_id=requested_organization_id or p.provider_profile_id=requested_provider_profile_id)) then return null;end if;
  if requested_organization_id is not null and not exists(select 1 from organizations o
    where o.id=requested_organization_id and o.type='TRANSPORT_COMPANY') then return null;end if;
  select p.user_id into owner_user_id from provider_profiles p where p.id=requested_provider_profile_id;
  select count(*) into total from vehicles v where v.active
    and (v.organization_id=requested_organization_id or v.provider_profile_id=requested_provider_profile_id);
  page_count:=greatest(1,ceil(total/12.0)::integer);
  page_number:=least(page_count,greatest(1,coalesce(requested_page,1)));
  select coalesce(jsonb_agg(to_jsonb(row) order by row.platform_number,row.id),'[]'::jsonb) into trucks from (
    select v.id,v.platform_number,v.make,v.model,v.category,v.cargo_configuration
    from vehicles v where v.active
      and (v.organization_id=requested_organization_id or v.provider_profile_id=requested_provider_profile_id)
    order by v.platform_number,v.id offset (page_number-1)*12 limit 12
  ) row;
  -- Independent-provider identity and summary evidence must not change with page.
  if requested_provider_profile_id is not null then
    select exists(select 1 from vehicles v join verification_requests r on r.subject_type='VEHICLE' and r.subject_id=v.id
      where v.active and v.provider_profile_id=requested_provider_profile_id and r.status='APPROVED'
        and r.verification_type='VEHICLE_OWNERSHIP' and (r.expires_on is null or r.expires_on>=today)) into owner_operator;
    if owner_operator then
      select jsonb_build_object('vehicle_id',v.id,'platform_number',v.platform_number,'document',jsonb_build_object(
        'verification_type',r.verification_type,'reviewed_at',r.reviewed_at,'expires_on',r.expires_on,'related_vehicle_id',r.related_vehicle_id))
      into evidence from vehicles v join lateral (
        select r.* from verification_requests r where r.subject_type='VEHICLE' and r.subject_id=v.id
          and r.status='APPROVED' and r.verification_type='VEHICLE_OWNERSHIP'
        order by r.reviewed_at desc nulls last,r.id limit 1
      ) r on true
      where v.active and v.provider_profile_id=requested_provider_profile_id
      order by (r.expires_on is null or r.expires_on>=today) desc,r.reviewed_at desc nulls last,v.platform_number,v.id limit 1;
    else
      select jsonb_build_object('vehicle_id',v.id,'platform_number',v.platform_number,'document',case when r.id is null then null else jsonb_build_object(
        'verification_type',r.verification_type,'reviewed_at',r.reviewed_at,'expires_on',r.expires_on,'related_vehicle_id',r.related_vehicle_id) end)
      into evidence from vehicles v left join lateral (
        select r.* from verification_requests r where r.related_vehicle_id=v.id
          and r.verification_type='VEHICLE_AUTHORIZATION' and r.status='APPROVED'
          and ((r.subject_type='PROVIDER_PROFILE' and r.subject_id=requested_provider_profile_id)
            or (r.subject_type='DRIVER' and r.subject_id=owner_user_id))
        order by r.reviewed_at desc nulls last,r.id limit 1
      ) r on true
      where v.active and v.provider_profile_id=requested_provider_profile_id
      order by (r.id is not null and (r.expires_on is null or r.expires_on>=today)) desc,
        (r.id is not null) desc,r.reviewed_at desc nulls last,v.platform_number,v.id limit 1;
    end if;
  end if;
  return jsonb_build_object('items',trucks,'total',total,'page',page_number,'page_size',12,'page_count',page_count,
    'owner_operator',owner_operator,'evidence',evidence);
end $$;
revoke all on function public.public_provider_fleet_page(uuid,uuid,integer) from public,anon,authenticated;
grant execute on function public.public_provider_fleet_page(uuid,uuid,integer) to service_role;

-- Narrow before windowing, without copying/replacing any privacy or eligibility rule.
do $migration$
declare definition text; original text:=E'  from public.capacities capacity\n), candidates as (';
  replacement text:=E'  from public.capacities capacity\n  where not (query ? ''vehicle_ids'') or capacity.vehicle_id in (\n    select value::uuid from jsonb_array_elements_text(query->''vehicle_ids'')\n  )\n), candidates as (';
begin
  definition:=pg_get_functiondef('public.public_capacity_page(jsonb,timestamptz,uuid,integer)'::regprocedure);
  if length(definition)-length(replace(definition,original,''))<>length(original) then
    raise exception 'PUBLIC_CAPACITY_FLEET_CONTRACT_NOT_FOUND';
  end if;
  execute replace(definition,original,replacement);
end $migration$;
