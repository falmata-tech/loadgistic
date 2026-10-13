-- FEAT-FTR-001: six continuous truck-type rounds; Mixed Sunday uses those turns.
-- Saved days and the legacy global ledger are never rewritten or deleted.
select pg_advisory_xact_lock(8030180);

-- Retain the exact deployed 105/106/107 contracts for a reviewed rollback.
do $backup$
declare definition text;original_name text;backup_name text;
begin
  for original_name,backup_name in values
    ('generate_managed_featured_days_core()','generate_managed_featured_days_global_legacy()'),
    ('managed_featured_overview(actor_user_id uuid)','managed_featured_overview_global_legacy(actor_user_id uuid)')
  loop
    if to_regprocedure('public.'||replace(backup_name,'actor_user_id ','')) is not null then
      raise exception 'FEATURED_ROTATION_BACKUP_EXISTS';
    end if;
    definition:=pg_get_functiondef(to_regprocedure('public.'||replace(original_name,'actor_user_id ','')));
    if definition is null or strpos(definition,'CREATE OR REPLACE FUNCTION public.'||original_name)<>1 then
      raise exception 'FEATURED_ROTATION_BACKUP_CONTRACT';
    end if;
    execute replace(definition,'CREATE OR REPLACE FUNCTION public.'||original_name,
      'CREATE OR REPLACE FUNCTION public.'||backup_name);
  end loop;
end $backup$;
revoke all on function public.generate_managed_featured_days_global_legacy(),public.managed_featured_overview_global_legacy(uuid)
  from public,anon,authenticated,service_role;

create function public.featured_truck_primary_theme(configuration text)
returns text language sql immutable set search_path=public,pg_temp as $$
  select theme->>'key' from generate_series(0,5) day_offset
  cross join lateral public.featured_truck_theme('2026-10-12'::date+day_offset) theme
  where (theme->'configurations') ? configuration
$$;
revoke all on function public.featured_truck_primary_theme(text) from public,anon,authenticated,service_role;

-- Use the same public content exclusions as the safe provider projection (135).
create or replace function public.featured_eligible_truck_links(configurations text[])
returns table(vehicle_id uuid,driver_user_id uuid)
language sql stable security definer set search_path=public,pg_temp as $$
  select vehicle.id,link.driver_id from public.vehicles vehicle
  cross join lateral (select public.capacity_active_driver_id(vehicle.id) as driver_id) link
  join public.company_pages page on page.organization_id=vehicle.organization_id or page.provider_profile_id=vehicle.provider_profile_id
  left join public.organizations organization on organization.id=vehicle.organization_id
  left join public.provider_profiles provider on provider.id=vehicle.provider_profile_id
  where vehicle.active and vehicle.cargo_configuration=any(configurations) and link.driver_id is not null
    and page.published and page.base_region_code is not null
    and not coalesce(organization.content_hidden,provider.content_hidden,false)
    and not coalesce(organization.review_workspace,provider.review_workspace,false)
    and nullif(trim(coalesce(organization.city,provider.city)),'') is not null
    and coalesce(organization.city_place_ref,provider.city_place_ref) is not null
    and ((page.show_contact_phone and nullif(trim(page.contact_phone),'') is not null)
      or (page.show_contact_whatsapp and nullif(trim(page.contact_whatsapp),'') is not null)
      or (page.show_contact_email and nullif(trim(page.contact_email),'') is not null)
      or (page.show_contact_website and nullif(trim(page.contact_website),'') is not null))
$$;
revoke all on function public.featured_eligible_truck_links(text[]) from public,anon,authenticated;
grant execute on function public.featured_eligible_truck_links(text[]) to service_role;

create table public.featured_theme_rotation_selections (
  primary_theme_key text not null check(primary_theme_key in ('mini-trucks','cargo-vans','pickups','light-duty','medium-duty','heavy-trucks')),
  round_number bigint not null check(round_number>0),
  vehicle_id uuid not null,
  driver_user_id uuid not null,
  first_feature_date date not null,
  featured_day_id uuid not null,
  origin text not null default 'AUTO' check(origin in ('AUTO','LEGACY','RESERVED')),
  selected_at timestamptz not null default now(),
  primary key(primary_theme_key,round_number,vehicle_id,driver_user_id)
);
create index featured_theme_rotation_day_idx on public.featured_theme_rotation_selections(featured_day_id);
alter table public.featured_theme_rotation_selections enable row level security;
revoke all on public.featured_theme_rotation_selections from public,anon,authenticated,service_role;
grant select on public.featured_theme_rotation_selections to service_role;

-- Previous completed global rounds remain in their original ledger. Known turns
-- in its current round and protected future reservations seed each new round one.
-- Retain temporarily inactive/hidden pair history too: it cannot block a round
-- while ineligible, and returning eligibility must not silently erase its turn.
with known as (
  select history.vehicle_id,history.driver_user_id,public.featured_truck_primary_theme(vehicle.cargo_configuration) as primary_theme_key,
    history.first_feature_date,history.featured_day_id,history.selected_at,'LEGACY'::text as origin
  from public.featured_rotation_selections history join public.vehicles vehicle on vehicle.id=history.vehicle_id
  where history.round_number=(select coalesce(max(round_number),1) from public.featured_rotation_selections)
  union all
  select slot.vehicle_id,slot.driver_user_id,public.featured_truck_primary_theme(vehicle.cargo_configuration),
    day.feature_date,day.id,coalesce(day.published_at,day.created_at),'RESERVED'::text
  from public.featured_provider_slots slot join public.vehicles vehicle on vehicle.id=slot.vehicle_id
  join public.featured_provider_days day on day.id=slot.day_id
  where day.feature_date>=(now() at time zone 'Africa/Addis_Ababa')::date
)
insert into public.featured_theme_rotation_selections(primary_theme_key,round_number,vehicle_id,driver_user_id,first_feature_date,featured_day_id,selected_at,origin)
select distinct on(primary_theme_key,vehicle_id,driver_user_id)
  primary_theme_key,1,vehicle_id,driver_user_id,first_feature_date,featured_day_id,selected_at,origin
from known where primary_theme_key is not null
order by primary_theme_key,vehicle_id,driver_user_id,first_feature_date,featured_day_id;

-- The private date argument makes advancing-calendar regressions possible without
-- deleting saved days or allowing callers to choose the worker's production date.
create function public.generate_managed_featured_days_for_date(first_day date)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare controls public.platform_controls%rowtype;feature_day date;theme jsonb;configurations text[];
  all_configurations text[];eligible_pool jsonb;rounds jsonb;pair record;group_record record;
  saved_day_id uuid;position_value integer;day_limit integer;advanced integer;vehicle_record public.vehicles%rowtype;
  created_count integer:=0;skipped_count integer:=0;empty_count integer:=0;
begin
  if first_day is null then raise exception 'FEATURED_DATE_INVALID';end if;
  if not pg_try_advisory_xact_lock(8030180) then return jsonb_build_object('created',0,'skipped',0,'empty',0);end if;
  select * into strict controls from public.platform_controls where singleton for share;
  if controls.featured_mode<>'AUTO' then return jsonb_build_object('created',0,'skipped',7,'empty',0);end if;
  select array_agg(distinct configuration) into all_configurations from generate_series(0,5) day_offset
    cross join lateral jsonb_array_elements_text(public.featured_truck_theme('2026-10-12'::date+day_offset)->'configurations') configuration;
  select coalesce(jsonb_agg(jsonb_build_object('vehicle_id',link.vehicle_id,'driver_user_id',link.driver_user_id,
    'cargo_configuration',vehicle.cargo_configuration,'primary_theme_key',public.featured_truck_primary_theme(vehicle.cargo_configuration))),'[]'::jsonb)
    into eligible_pool from public.featured_eligible_truck_links(all_configurations) link
    join public.vehicles vehicle on vehicle.id=link.vehicle_id;
  select coalesce(jsonb_object_agg(groups.primary_theme_key,coalesce(history.round_number,1)),'{}'::jsonb) into rounds
    from (select distinct link.primary_theme_key from jsonb_to_recordset(eligible_pool) as link(primary_theme_key text)) groups
    left join (select primary_theme_key,max(round_number) as round_number from public.featured_theme_rotation_selections group by primary_theme_key) history using(primary_theme_key);
  for offset_value in 0..6 loop
    feature_day:=first_day+offset_value;
    if exists(select 1 from public.featured_provider_days where feature_date=feature_day) then skipped_count:=skipped_count+1;continue;end if;
    theme:=public.featured_truck_theme(feature_day);
    select array_agg(value) into configurations from jsonb_array_elements_text(theme->'configurations') value;
    select least(controls.featured_target_count,count(distinct link.driver_user_id)::integer) into day_limit
      from jsonb_to_recordset(eligible_pool) as link(driver_user_id uuid,cargo_configuration text)
      where link.cargo_configuration=any(configurations);
    if day_limit=0 then empty_count:=empty_count+1;continue;end if;
    saved_day_id:=null;
    insert into public.featured_provider_days(feature_date,base_place_ref,base_place_label,expo_group_key,expo_group_label,
      expo_region_codes,broadcast_start_time,broadcast_end_time,schedule_mode,schedule_config_json,manual_schedule_json,
      target_count,status,selection_source,published_at)
    values(feature_day,'featured:'||(theme->>'key'),theme->>'label',theme->>'key',theme->>'label','[]'::jsonb,
      '08:30','12:00','AUTO',jsonb_build_object('dayStart','08:30','dayEnd','12:00','targetCount',day_limit,'sponsorBreakCount',4,'sponsorBreakMinutes',2),
      '[]'::jsonb,day_limit,'PUBLISHED','AUTO',now())
    on conflict(feature_date) do nothing returning id into saved_day_id;
    if saved_day_id is null then skipped_count:=skipped_count+1;continue;end if;
    position_value:=0;
    while position_value<day_limit loop
      -- Unseen turns always precede a rollover. Nearby reservations are a
      -- preference within that set, never a reason to suppress a real roster.
      select link.* into pair from jsonb_to_recordset(eligible_pool)
        as link(vehicle_id uuid,driver_user_id uuid,cargo_configuration text,primary_theme_key text)
      where link.cargo_configuration=any(configurations)
        and not exists(select 1 from public.featured_provider_slots selected where selected.day_id=saved_day_id
          and (selected.vehicle_id=link.vehicle_id or selected.driver_user_id=link.driver_user_id))
        and not exists(select 1 from public.featured_theme_rotation_selections history
          where history.primary_theme_key=link.primary_theme_key and history.round_number=(rounds->>link.primary_theme_key)::bigint
            and history.vehicle_id=link.vehicle_id and history.driver_user_id=link.driver_user_id)
      order by exists(select 1 from public.featured_provider_slots nearby join public.featured_provider_days day on day.id=nearby.day_id
        where day.feature_date between feature_day-6 and feature_day+6 and day.id<>saved_day_id
          and (nearby.vehicle_id=link.vehicle_id or nearby.driver_user_id=link.driver_user_id)),random(),link.vehicle_id
      limit 1;
      if not found then
        advanced:=0;
        -- Only a completed primary type can restart. Sunday consumes exactly
        -- the same type rounds and never owns a second overlapping ledger.
        for group_record in select distinct link.primary_theme_key from jsonb_to_recordset(eligible_pool)
          as link(vehicle_id uuid,driver_user_id uuid,cargo_configuration text,primary_theme_key text)
        where link.cargo_configuration=any(configurations)
          and not exists(select 1 from public.featured_provider_slots selected where selected.day_id=saved_day_id
            and (selected.vehicle_id=link.vehicle_id or selected.driver_user_id=link.driver_user_id))
          and not exists(select 1 from jsonb_to_recordset(eligible_pool)
            as unseen(vehicle_id uuid,driver_user_id uuid,primary_theme_key text)
            where unseen.primary_theme_key=link.primary_theme_key and not exists(
              select 1 from public.featured_theme_rotation_selections history where history.primary_theme_key=unseen.primary_theme_key
                and history.round_number=(rounds->>unseen.primary_theme_key)::bigint
                and history.vehicle_id=unseen.vehicle_id and history.driver_user_id=unseen.driver_user_id))
        loop
          rounds:=jsonb_set(rounds,array[group_record.primary_theme_key],to_jsonb((rounds->>group_record.primary_theme_key)::bigint+1));
          advanced:=advanced+1;
        end loop;
        if advanced=0 then raise exception 'FEATURED_DISTINCT_DRIVER_ROTATION_CONFLICT';end if;
        continue;
      end if;
      select * into strict vehicle_record from public.vehicles where id=pair.vehicle_id for share;
      if not exists(select 1 from public.featured_eligible_truck_links(configurations) current_pair
        where current_pair.vehicle_id=pair.vehicle_id and current_pair.driver_user_id=pair.driver_user_id)
        or vehicle_record.cargo_configuration is distinct from pair.cargo_configuration
        then raise exception 'FEATURED_ELIGIBILITY_CHANGED';end if;
      position_value:=position_value+1;
      insert into public.featured_provider_slots(day_id,slot_position,provider_organization_id,provider_profile_id,vehicle_id,driver_user_id)
        values(saved_day_id,position_value,vehicle_record.organization_id,vehicle_record.provider_profile_id,pair.vehicle_id,pair.driver_user_id);
      insert into public.featured_theme_rotation_selections(primary_theme_key,round_number,vehicle_id,driver_user_id,first_feature_date,featured_day_id)
        values(pair.primary_theme_key,(rounds->>pair.primary_theme_key)::bigint,pair.vehicle_id,pair.driver_user_id,feature_day,saved_day_id);
    end loop;
    insert into public.audit_logs(action,entity_type,entity_id,details)
      values('FEATURED_DAY_AUTO_PUBLISHED','featured_truck_day',saved_day_id,jsonb_build_object('featureDate',feature_day,
        'truckCount',position_value,'requestedCount',controls.featured_target_count,'theme',theme->>'key','rotationPolicy','PRIMARY_THEME','rotationRounds',rounds));
    created_count:=created_count+1;
  end loop;
  return jsonb_build_object('created',created_count,'skipped',skipped_count,'empty',empty_count);
end $$;
revoke all on function public.generate_managed_featured_days_for_date(date) from public,anon,authenticated,service_role;

-- Keep the existing status/failure wrapper and staff entry point unchanged.
create or replace function public.generate_managed_featured_days_core()
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
begin
  return public.generate_managed_featured_days_for_date((now() at time zone 'Africa/Addis_Ababa')::date);
end $$;
revoke all on function public.generate_managed_featured_days_core() from public,anon,authenticated,service_role;

create or replace function public.managed_featured_overview(actor_user_id uuid)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare today date:=(now() at time zone 'Africa/Addis_Ababa')::date;configs text[];pool jsonb;rounds jsonb;
  total integer;remaining integer;days jsonb;run_status jsonb;
begin
  if not public.can_manage_featured(actor_user_id) then raise exception 'FORBIDDEN';end if;
  select array_agg(distinct configuration) into configs from generate_series(0,5) offset_value
    cross join lateral jsonb_array_elements_text(public.featured_truck_theme('2026-10-12'::date+offset_value)->'configurations') configuration;
  select jsonb_object_agg(theme->>'key',coalesce(history.round_number,1)) into rounds
    from generate_series(0,5) offset_value cross join lateral public.featured_truck_theme('2026-10-12'::date+offset_value) theme
    left join (select primary_theme_key,max(round_number) as round_number from public.featured_theme_rotation_selections group by primary_theme_key) history
      on history.primary_theme_key=theme->>'key';
  select coalesce(jsonb_agg(jsonb_build_object('vehicle_id',e.vehicle_id,'driver_user_id',e.driver_user_id,'configuration',v.cargo_configuration,
    'primary_theme_key',public.featured_truck_primary_theme(v.cargo_configuration),
    'remaining',not exists(select 1 from public.featured_theme_rotation_selections h
      where h.primary_theme_key=public.featured_truck_primary_theme(v.cargo_configuration)
        and h.round_number=(rounds->>h.primary_theme_key)::bigint and h.vehicle_id=e.vehicle_id and h.driver_user_id=e.driver_user_id))),'[]'::jsonb)
    into pool from public.featured_eligible_truck_links(configs) e join public.vehicles v on v.id=e.vehicle_id;
  select count(*),count(*) filter(where (value->>'remaining')::boolean) into total,remaining from jsonb_array_elements(pool);
  select jsonb_agg(jsonb_build_object('date',today+offset_value,'theme',theme->>'label','status',d.status,'source',d.selection_source,
    'selected',(select count(*) from public.featured_provider_slots s where s.day_id=d.id),
    'invalid',(select count(*) from public.featured_provider_slots s where s.day_id=d.id and not exists(
      select 1 from jsonb_array_elements(pool) pair where pair->>'vehicle_id'=s.vehicle_id::text and pair->>'driver_user_id'=s.driver_user_id::text
        and (theme->'configurations') ? (pair->>'configuration'))),
    'eligible',(select count(*) from jsonb_array_elements(pool) pair where (theme->'configurations') ? (pair->>'configuration')),
    'remaining',(select count(*) from jsonb_array_elements(pool) pair where (theme->'configurations') ? (pair->>'configuration') and (pair->>'remaining')::boolean),
    'rounds',case when theme->>'key'='mixed-trucks' then rounds else jsonb_build_object(theme->>'key',rounds->(theme->>'key')) end
  ) order by offset_value) into days
    from generate_series(0,6) offset_value cross join lateral public.featured_truck_theme(today+offset_value) theme
    left join public.featured_provider_days d on d.feature_date=today+offset_value;
  select to_jsonb(s)-'singleton' into run_status from public.featured_automation_status s where singleton;
  return jsonb_build_object('rotation_policy','PRIMARY_THEME','rounds',rounds,'eligible',total,'remaining',remaining,'days',days,'run',run_status);
end $$;
revoke all on function public.managed_featured_overview(uuid) from public,anon,authenticated;
grant execute on function public.managed_featured_overview(uuid) to service_role;
