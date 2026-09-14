-- FEAT-FTR-001: durable automatic rosters, protected manual days, no read-side writes.
alter table public.featured_provider_days add column selection_source text not null default 'MANUAL' check(selection_source in ('AUTO','MANUAL'));
alter table public.featured_provider_days alter column created_by drop not null;
alter table public.featured_provider_slots alter column created_by drop not null;

create function public.featured_truck_theme(feature_day date)
returns jsonb language sql immutable set search_path=public,pg_temp as $$
  select jsonb_build_object('key',theme.key,'label',theme.label,'configurations',theme.configurations)
  from (values
    (1,'mini-trucks','Mini trucks',array['Mini Open Body Truck','Mini Stake Body Truck','Mini Box Truck']),
    (2,'cargo-vans','Cargo vans',array['Cargo van']),
    (3,'pickups','Pickup trucks',array['Pickup truck','Pickup stake body']),
    (4,'light-duty','Light-duty trucks',array['Light Box Truck','Light Stake Body Truck']),
    (5,'medium-duty','Medium-duty trucks',array['Medium Box Truck','Medium Stake Body Truck']),
    (6,'heavy-trucks','Heavy trucks',array['Heavy Rigid Stake Body Truck','Heavy Rigid Stake Body Truck + Trailer','Tractor + Container Trailer','Tractor + Dry Van Trailer','Tractor + Heavy Equipment Trailer']),
    (7,'courier-cars','Courier cars',array['Courier car'])
  ) theme(weekday,key,label,configurations) where theme.weekday=extract(isodow from feature_day)
$$;

create function public.featured_eligible_truck_links(configurations text[])
returns table(vehicle_id uuid,driver_user_id uuid)
language sql stable security definer set search_path=public,pg_temp as $$
  select vehicle.id,link.driver_id from public.vehicles vehicle
  cross join lateral (select public.capacity_active_driver_id(vehicle.id) as driver_id) link
  join public.company_pages page on page.organization_id=vehicle.organization_id or page.provider_profile_id=vehicle.provider_profile_id
  left join public.organizations organization on organization.id=vehicle.organization_id
  left join public.provider_profiles provider on provider.id=vehicle.provider_profile_id
  where vehicle.active and vehicle.cargo_configuration=any(configurations) and link.driver_id is not null
    and page.published and page.base_region_code is not null
    and nullif(trim(coalesce(organization.city,provider.city)),'') is not null
    and coalesce(organization.city_place_ref,provider.city_place_ref) is not null
    and ((page.show_contact_phone and nullif(trim(page.contact_phone),'') is not null)
      or (page.show_contact_whatsapp and nullif(trim(page.contact_whatsapp),'') is not null)
      or (page.show_contact_email and nullif(trim(page.contact_email),'') is not null)
      or (page.show_contact_website and nullif(trim(page.contact_website),'') is not null))
$$;

create function public.generate_managed_featured_days()
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare controls public.platform_controls%rowtype;feature_day date;theme jsonb;configurations text[];
  chosen uuid[];chosen_vehicle uuid;saved_day_id uuid;position_value integer;vehicle_record record;
  created_count integer:=0;skipped_count integer:=0;empty_count integer:=0;
  today date:=(now() at time zone 'Africa/Addis_Ababa')::date;
begin
  -- One job at a time; parallel dispatches are harmless and retryable.
  if not pg_try_advisory_xact_lock(8030180) then return jsonb_build_object('created',0,'skipped',0,'empty',0); end if;
  select * into strict controls from public.platform_controls where singleton for share;
  if controls.featured_mode<>'AUTO' then return jsonb_build_object('created',0,'skipped',7,'empty',0); end if;
  for offset_value in 0..6 loop
    feature_day:=today+offset_value;
    if exists(select 1 from public.featured_provider_days where feature_date=feature_day) then skipped_count:=skipped_count+1;continue; end if;
    theme:=public.featured_truck_theme(feature_day);
    select array_agg(value) into configurations from jsonb_array_elements_text(theme->'configurations') value;
    with candidates as materialized (
      select link.vehicle_id,link.driver_user_id,vehicle.cargo_configuration,
        (select max(day.feature_date) from public.featured_provider_slots slot join public.featured_provider_days day on day.id=slot.day_id
          where slot.driver_user_id=link.driver_user_id and day.status='PUBLISHED' and day.feature_date<feature_day) as last_featured,
        row_number() over(partition by link.driver_user_id order by md5(link.vehicle_id::text||feature_day::text)) as driver_choice
      from public.featured_eligible_truck_links(configurations) link join public.vehicles vehicle on vehicle.id=link.vehicle_id
    ), balanced as (
      select *,row_number() over(partition by cargo_configuration order by last_featured nulls first,md5(driver_user_id::text||feature_day::text)) as configuration_position
      from candidates where driver_choice=1
    )
    select array_agg(vehicle_id order by configuration_position,array_position(configurations,cargo_configuration)) into chosen
    from (select * from balanced order by configuration_position,array_position(configurations,cargo_configuration) limit controls.featured_target_count) selected;
    if coalesce(cardinality(chosen),0)=0 then empty_count:=empty_count+1;continue; end if;
    saved_day_id:=null;
    insert into public.featured_provider_days(feature_date,base_place_ref,base_place_label,expo_group_key,expo_group_label,
      expo_region_codes,broadcast_start_time,broadcast_end_time,schedule_mode,schedule_config_json,manual_schedule_json,
      target_count,status,selection_source,published_at)
    values(feature_day,'featured:'||(theme->>'key'),theme->>'label',theme->>'key',theme->>'label','[]'::jsonb,
      '07:30','09:00','AUTO',jsonb_build_object('dayStart','07:30','dayEnd','09:00','targetCount',cardinality(chosen),'sponsorBreakEvery',2,'sponsorBreakMinutes',2),
      '[]'::jsonb,cardinality(chosen),'PUBLISHED','AUTO',now())
    on conflict(feature_date) do nothing returning id into saved_day_id;
    if saved_day_id is null then skipped_count:=skipped_count+1;continue; end if;
    position_value:=0;
    foreach chosen_vehicle in array chosen loop
      select * into strict vehicle_record from public.vehicles where id=chosen_vehicle;
      position_value:=position_value+1;
      insert into public.featured_provider_slots(day_id,slot_position,provider_organization_id,provider_profile_id,vehicle_id,driver_user_id)
        values(saved_day_id,position_value,vehicle_record.organization_id,vehicle_record.provider_profile_id,vehicle_record.id,public.capacity_active_driver_id(vehicle_record.id));
    end loop;
    insert into public.audit_logs(action,entity_type,entity_id,details)
      values('FEATURED_DAY_AUTO_PUBLISHED','featured_truck_day',saved_day_id,jsonb_build_object('featureDate',feature_day,'truckCount',cardinality(chosen),'requestedCount',controls.featured_target_count,'theme',theme->>'key'));
    created_count:=created_count+1;
  end loop;
  return jsonb_build_object('created',created_count,'skipped',skipped_count,'empty',empty_count);
end $$;

do $migration$
declare definition text;old_fragment text;
begin
  definition:=pg_get_functiondef('public.save_managed_featured_truck_day(uuid,jsonb)'::regprocedure);
  old_fragment:='if driver_value is null then raise exception ''FEATURED_DRIVER_REQUIRED''; end if;';
  if position(old_fragment in definition)=0 then raise exception 'FEATURED_DRIVER_CONTRACT_NOT_FOUND'; end if;
  definition:=replace(definition,old_fragment,'driver_value:=public.capacity_active_driver_id(vehicle_record.id);'||E'\n    '||old_fragment||E'\n    '||
    'if exists(select 1 from public.featured_provider_slots where day_id=saved_day_id and driver_user_id=driver_value) then raise exception ''FEATURED_DRIVER_DUPLICATE''; end if;');
  definition:=replace(definition,'return saved_day_id;', 'update public.featured_provider_days set selection_source=''MANUAL'' where id=saved_day_id;'||E'\n  return saved_day_id;');
  execute definition;
  -- Evidence remains optional for Featured; public identity/contact and Driver linkage remain required.
  definition:=pg_get_functiondef('public.public_featured_provider_candidates(text[])'::regprocedure);
  old_fragment:=substring(definition from 'and case when candidate.provider_organization_id is not null then[\s\S]*?end as eligible');
  if old_fragment is null then raise exception 'FEATURED_EVIDENCE_CONTRACT_NOT_FOUND'; end if;
  execute replace(definition,old_fragment,'as eligible');
end $migration$;

revoke all on function public.featured_truck_theme(date),public.featured_eligible_truck_links(text[]),public.generate_managed_featured_days() from public,anon,authenticated;
grant execute on function public.featured_eligible_truck_links(text[]),public.generate_managed_featured_days() to service_role;
