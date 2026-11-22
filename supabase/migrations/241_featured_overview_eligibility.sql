-- FEAT-FTR-001. Reuse overview eligibility and scope each save's vehicle check.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';

create or replace function public.featured_eligible_truck_links_scoped(configurations text[],requested_vehicle_id uuid)
returns table(vehicle_id uuid,driver_user_id uuid)
language sql stable security definer set search_path=public,pg_temp as $$
  with listings as materialized (
    select vehicle.id,vehicle.organization_id,vehicle.provider_profile_id
    from public.vehicles vehicle
    join public.company_pages page on page.organization_id=vehicle.organization_id or page.provider_profile_id=vehicle.provider_profile_id
    left join public.organizations organization on organization.id=vehicle.organization_id
    left join public.provider_profiles provider on provider.id=vehicle.provider_profile_id
    where (requested_vehicle_id is null or vehicle.id=requested_vehicle_id)
      and vehicle.active and vehicle.publication_status='LIVE'
      and vehicle.cargo_configuration=any(configurations)
      and page.published and page.base_region_code is not null
      and not coalesce(organization.content_hidden,provider.content_hidden,false)
      and not coalesce(organization.review_workspace,provider.review_workspace,false)
      and nullif(trim(coalesce(organization.city,provider.city)),'') is not null
      and coalesce(organization.city_place_ref,provider.city_place_ref) is not null
      and ((page.show_contact_phone and nullif(trim(page.contact_phone),'') is not null)
        or (page.show_contact_whatsapp and nullif(trim(page.contact_whatsapp),'') is not null)
        or (page.show_contact_email and nullif(trim(page.contact_email),'') is not null)
        or (page.show_contact_website and nullif(trim(page.contact_website),'') is not null))
  ), owners as materialized (
    select distinct organization_id,provider_profile_id from listings
  ), eligible_owners as materialized (
    select owner.organization_id,owner.provider_profile_id
    from owners owner
    where public.provider_scope_can_publish(owner.organization_id,owner.provider_profile_id)
  ), candidates as materialized (
    select listing.id,public.capacity_active_driver_id(listing.id) as driver_id
    from listings listing
    join eligible_owners owner
      on owner.organization_id is not distinct from listing.organization_id
      and owner.provider_profile_id is not distinct from listing.provider_profile_id
  )
  select id,driver_id from candidates where driver_id is not null
$$;

create or replace function public.managed_featured_overview(actor_user_id uuid)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare
  today date:=(now() at time zone 'Africa/Addis_Ababa')::date;
  round_value bigint;
  total integer;
  remaining integer;
  days jsonb;
  run_status jsonb;
begin
  if not public.can_manage_featured(actor_user_id) then raise exception 'FORBIDDEN';end if;
  select coalesce(max(round_number),1) into round_value
    from public.featured_account_rotation_selections;

  with eligible as materialized (
    select provider_key,provider_organization_id,provider_profile_id
    from public.featured_eligible_account_links()
  ), account_counts as (
    select count(*) as total,count(*) filter(where not exists(
      select 1 from public.featured_account_rotation_selections history
      where history.round_number=round_value and history.provider_key=eligible.provider_key
    )) as remaining from eligible
  )
  select counts.total,counts.remaining,
    jsonb_agg(jsonb_build_object('date',today+offset_value,'theme','Transport Providers',
      'status',day.status,'source',day.selection_source,
      'selected',slots.selected,'invalid',slots.invalid,
      'eligible',counts.total,'remaining',counts.remaining,
      'rounds',jsonb_build_object('accounts',round_value)) order by offset_value)
    into total,remaining,days
  from account_counts counts
  cross join generate_series(0,6) offset_value
  left join public.featured_provider_days day on day.feature_date=today+offset_value
  cross join lateral (
    select count(*) as selected,count(*) filter(where not exists(
      select 1 from eligible
      where eligible.provider_organization_id=slot.provider_organization_id
        or eligible.provider_profile_id=slot.provider_profile_id
    )) as invalid
    from public.featured_provider_slots slot where slot.day_id=day.id
  ) slots
  group by counts.total,counts.remaining;

  select to_jsonb(status)-'singleton' into run_status
    from public.featured_automation_status status where singleton;
  return jsonb_build_object('rotation_policy','PROVIDER_ACCOUNT','rounds',jsonb_build_object('accounts',round_value),
    'eligible',total,'remaining',remaining,'days',days,'run',run_status);
end $$;

do $migration$
declare
  definition text:=pg_get_functiondef('public.save_managed_featured_provider_day(uuid,jsonb)'::regprocedure);
  recheck text:='public.featured_eligible_truck_links(array[vehicle_record.cargo_configuration]) eligible';
begin
  if (length(definition)-length(replace(definition,recheck,'')))/length(recheck)<>1 then
    raise exception 'FEATURED_SCOPED_SAVE_DEFINITION_DRIFT';
  end if;
  execute replace(definition,recheck,
    'public.featured_eligible_truck_links_scoped(array[vehicle_record.cargo_configuration],vehicle_value) eligible');
end $migration$;

commit;
