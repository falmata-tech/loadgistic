-- FEAT-CON-001: automatic Featured turns are provider-account turns, not
-- vehicle-type or driver turns. Existing saved days and old ledgers stay intact.
begin;
select pg_advisory_xact_lock(8030180);

create table public.featured_account_rotation_selections (
  round_number bigint not null check (round_number > 0),
  provider_key text not null check (provider_key ~ '^(organization|profile):[0-9a-f-]{36}$'),
  featured_day_id uuid not null references public.featured_provider_days(id) on delete cascade,
  first_feature_date date not null,
  origin text not null check (origin in ('AUTO','MANUAL','LEGACY')),
  selected_at timestamptz not null default now(),
  primary key (round_number,provider_key)
);
create index featured_account_rotation_day_idx on public.featured_account_rotation_selections(featured_day_id);
alter table public.featured_account_rotation_selections enable row level security;
revoke all on public.featured_account_rotation_selections from public,anon,authenticated,service_role;
grant select on public.featured_account_rotation_selections to service_role;

create table public.featured_account_manual_selections (
  featured_day_id uuid not null references public.featured_provider_days(id) on delete cascade,
  provider_key text not null check (provider_key ~ '^(organization|profile):[0-9a-f-]{36}$'),
  feature_date date not null,
  selected_at timestamptz not null default now(),
  primary key (featured_day_id,provider_key)
);
create index featured_account_manual_recent_idx on public.featured_account_manual_selections(provider_key,feature_date);
alter table public.featured_account_manual_selections enable row level security;
revoke all on public.featured_account_manual_selections from public,anon,authenticated,service_role;
grant select on public.featured_account_manual_selections to service_role;

-- Saved history is a reservation in the first account round. Multiple old
-- vehicle slots from one provider collapse to one account turn.
with saved as (
  select distinct on (provider_key) provider_key,day.id,day.feature_date,day.selection_source,
    coalesce(day.published_at,day.created_at) as selected_at
  from public.featured_provider_days day
  join public.featured_provider_slots slot on slot.day_id=day.id
  cross join lateral (select case when slot.provider_organization_id is not null
    then 'organization:'||slot.provider_organization_id::text
    else 'profile:'||slot.provider_profile_id::text end as provider_key) account
  where day.status='PUBLISHED'
  order by provider_key,day.feature_date,day.id
)
insert into public.featured_account_rotation_selections
  (round_number,provider_key,featured_day_id,first_feature_date,origin,selected_at)
select 1,provider_key,id,feature_date,'LEGACY',selected_at from saved;

-- The public candidate projection is the single account eligibility rule.
-- A representative current vehicle/driver pair satisfies the retained slot
-- schema, but changes to that pair do not create another account turn.
create function public.featured_eligible_account_links()
returns table(provider_key text,provider_organization_id uuid,provider_profile_id uuid,vehicle_id uuid,driver_user_id uuid)
language sql stable security definer set search_path=public,pg_temp as $$
  with regions as (
    select array_agg(distinct base_region_code) as codes
    from public.company_pages where base_region_code is not null
  ), accounts as (
    select candidate.payload
    from regions cross join lateral public.public_featured_provider_candidates(regions.codes) candidate(payload)
    where coalesce((candidate.payload->>'eligible')::boolean,false)
  ), configurations as (
    select array_agg(distinct cargo_configuration) as values
    from public.vehicles where active
  ), links as (
    select case when vehicle.organization_id is not null
      then 'organization:'||vehicle.organization_id::text
      else 'profile:'||vehicle.provider_profile_id::text end as provider_key,
      vehicle.organization_id,vehicle.provider_profile_id,vehicle.id as vehicle_id,
      link.driver_user_id
    from configurations
    cross join lateral public.featured_eligible_truck_links(configurations.values) link
    join public.vehicles vehicle on vehicle.id=link.vehicle_id
    join accounts on (accounts.payload->>'provider_organization_id')::uuid=vehicle.organization_id
      or (accounts.payload->>'provider_profile_id')::uuid=vehicle.provider_profile_id
  )
  select distinct on (links.provider_key) links.provider_key,links.organization_id,
    links.provider_profile_id,links.vehicle_id,links.driver_user_id
  from links order by links.provider_key,links.vehicle_id,links.driver_user_id
$$;
revoke all on function public.featured_eligible_account_links() from public,anon,authenticated;
grant execute on function public.featured_eligible_account_links() to service_role;

create or replace function public.generate_managed_featured_days_for_date(first_day date)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare controls public.platform_controls%rowtype; feature_day date; pool jsonb; choice record;
  vehicle_record public.vehicles%rowtype;
  saved_day_id uuid;position_value integer;day_limit integer;round_value bigint;
  created_count integer:=0;skipped_count integer:=0;empty_count integer:=0;
begin
  if first_day is null then raise exception 'FEATURED_DATE_INVALID';end if;
  if not pg_try_advisory_xact_lock(8030180) then return jsonb_build_object('created',0,'skipped',0,'empty',0);end if;
  select * into strict controls from public.platform_controls where singleton for share;
  if controls.featured_mode<>'AUTO' then return jsonb_build_object('created',0,'skipped',7,'empty',0);end if;
  select coalesce(jsonb_agg(to_jsonb(link) order by link.provider_key),'[]'::jsonb)
    into pool from public.featured_eligible_account_links() link;
  select coalesce(max(round_number),1) into round_value from public.featured_account_rotation_selections;
  -- Fixture and pilot imports may create a saved day after this migration.
  -- Reserve those account turns before preparing another day.
  insert into public.featured_account_rotation_selections
    (round_number,provider_key,featured_day_id,first_feature_date,origin,selected_at)
  select distinct on (account.provider_key) round_value,account.provider_key,day.id,
    day.feature_date,'LEGACY',coalesce(day.published_at,day.created_at)
  from public.featured_provider_days day
  join public.featured_provider_slots slot on slot.day_id=day.id
  cross join lateral (select case when slot.provider_organization_id is not null
    then 'organization:'||slot.provider_organization_id::text
    else 'profile:'||slot.provider_profile_id::text end as provider_key) account
  where day.status='PUBLISHED'
    and not exists(select 1 from public.featured_account_rotation_selections existing
      where existing.featured_day_id=day.id and existing.provider_key=account.provider_key)
  order by account.provider_key,day.feature_date desc,day.id desc
  on conflict(round_number,provider_key) do nothing;
  for offset_value in 0..6 loop
    feature_day:=first_day+offset_value;
    if exists(select 1 from public.featured_provider_days where feature_date=feature_day) then
      skipped_count:=skipped_count+1;continue;
    end if;
    day_limit:=least(controls.featured_target_count,jsonb_array_length(pool));
    if day_limit=0 then empty_count:=empty_count+1;continue;end if;
    insert into public.featured_provider_days
      (feature_date,base_place_ref,base_place_label,expo_group_key,expo_group_label,
       expo_region_codes,broadcast_start_time,broadcast_end_time,schedule_mode,
       schedule_config_json,manual_schedule_json,target_count,status,selection_source,published_at)
    values(feature_day,'featured:provider-accounts','Transport Providers','provider-accounts','Transport Providers',
      '[]'::jsonb,'08:30','12:00','AUTO',
      jsonb_build_object('dayStart','08:30','dayEnd','12:00','targetCount',day_limit,
        'sponsorBreakCount',4,'sponsorBreakMinutes',2),
      '[]'::jsonb,day_limit,'PUBLISHED','AUTO',now())
    on conflict(feature_date) do nothing returning id into saved_day_id;
    if saved_day_id is null then skipped_count:=skipped_count+1;continue;end if;
    position_value:=0;
    while position_value<day_limit loop
      select link.* into choice
      from jsonb_to_recordset(pool) as link(provider_key text,provider_organization_id uuid,
        provider_profile_id uuid,vehicle_id uuid,driver_user_id uuid)
      where not exists(select 1 from public.featured_provider_slots selected
        where selected.day_id=saved_day_id and
          ((link.provider_organization_id is not null and selected.provider_organization_id=link.provider_organization_id)
          or (link.provider_profile_id is not null and selected.provider_profile_id=link.provider_profile_id)))
        and not exists(select 1 from public.featured_account_rotation_selections history
          where history.round_number=round_value and history.provider_key=link.provider_key)
      order by exists(select 1 from public.featured_account_manual_selections manual
        where manual.provider_key=link.provider_key
          and manual.feature_date between feature_day-7 and feature_day+7),
        random(),link.provider_key limit 1;
      if not found then
        -- Every currently eligible account has had its turn in this round.
        -- The current day still cannot select the same account twice.
        round_value:=round_value+1;
        continue;
      end if;
      select * into vehicle_record from public.vehicles where id=choice.vehicle_id for share;
      if not found or not vehicle_record.active
        or vehicle_record.organization_id is distinct from choice.provider_organization_id
        or vehicle_record.provider_profile_id is distinct from choice.provider_profile_id
        or not public.capacity_public_policy_allows(choice.vehicle_id)
        or not public.provider_scope_can_publish(choice.provider_organization_id,choice.provider_profile_id)
        or not exists(select 1 from public.featured_eligible_truck_links(array[vehicle_record.cargo_configuration]) current_link
          where current_link.vehicle_id=choice.vehicle_id and current_link.driver_user_id=choice.driver_user_id)
      then raise exception 'FEATURED_ELIGIBILITY_CHANGED';end if;
      position_value:=position_value+1;
      insert into public.featured_provider_slots
        (day_id,slot_position,provider_organization_id,provider_profile_id,vehicle_id,driver_user_id)
      values(saved_day_id,position_value,choice.provider_organization_id,choice.provider_profile_id,
        choice.vehicle_id,choice.driver_user_id);
      insert into public.featured_account_rotation_selections
        (round_number,provider_key,featured_day_id,first_feature_date,origin)
      values(round_value,choice.provider_key,saved_day_id,feature_day,'AUTO');
    end loop;
    insert into public.audit_logs(action,entity_type,entity_id,details)
    values('FEATURED_DAY_AUTO_PUBLISHED','featured_provider_day',saved_day_id,
      jsonb_build_object('featureDate',feature_day,'providerCount',position_value,
        'requestedCount',controls.featured_target_count,'rotationPolicy','PROVIDER_ACCOUNT',
        'lastRound',round_value));
    created_count:=created_count+1;
  end loop;
  return jsonb_build_object('created',created_count,'skipped',skipped_count,'empty',empty_count);
end $$;
revoke all on function public.generate_managed_featured_days_for_date(date) from public,anon,authenticated,service_role;

create or replace function public.managed_featured_overview(actor_user_id uuid)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare today date:=(now() at time zone 'Africa/Addis_Ababa')::date;round_value bigint;
  total integer;remaining integer;days jsonb;run_status jsonb;
begin
  if not public.can_manage_featured(actor_user_id) then raise exception 'FORBIDDEN';end if;
  select coalesce(max(round_number),1) into round_value from public.featured_account_rotation_selections;
  select count(*),count(*) filter(where not exists(
    select 1 from public.featured_account_rotation_selections history
    where history.round_number=round_value and history.provider_key=link.provider_key))
    into total,remaining from public.featured_eligible_account_links() link;
  select jsonb_agg(jsonb_build_object('date',today+offset_value,'theme','Transport Providers',
    'status',day.status,'source',day.selection_source,
    'selected',(select count(*) from public.featured_provider_slots slot where slot.day_id=day.id),
    'invalid',(select count(*) from public.featured_provider_slots slot where slot.day_id=day.id
      and not exists(select 1 from public.featured_eligible_account_links() eligible
        where eligible.provider_organization_id=slot.provider_organization_id
          or eligible.provider_profile_id=slot.provider_profile_id)),
    'eligible',total,'remaining',remaining,'rounds',jsonb_build_object('accounts',round_value))
    order by offset_value) into days
  from generate_series(0,6) offset_value
  left join public.featured_provider_days day on day.feature_date=today+offset_value;
  select to_jsonb(status)-'singleton' into run_status from public.featured_automation_status status where singleton;
  return jsonb_build_object('rotation_policy','PROVIDER_ACCOUNT','rounds',jsonb_build_object('accounts',round_value),
    'eligible',total,'remaining',remaining,'days',days,'run',run_status);
end $$;
revoke all on function public.managed_featured_overview(uuid) from public,anon,authenticated;
grant execute on function public.managed_featured_overview(uuid) to service_role;

-- Keep the established permissions, TikTok validation and schedule writer.
-- This wrapper verifies one representative vehicle per account and supplies
-- the complete current vehicle catalogue instead of a weekday type.
create function public.save_managed_featured_provider_day(actor_user_id uuid,command jsonb)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare key_value text;vehicle_value uuid;account_value text;selected_accounts text[]:=array[]::text[];
  vehicle_record public.vehicles%rowtype;
  configurations jsonb;day_id uuid;prepared jsonb;feature_day date;published boolean;
begin
  perform public.lock_featured_actor(actor_user_id);
  if jsonb_typeof(command->'truck_keys')<>'array' then raise exception 'FEATURED_TRUCK_INVALID';end if;
  for key_value in select value from jsonb_array_elements_text(command->'truck_keys') value loop
    begin vehicle_value:=replace(key_value,'vehicle:','')::uuid;
    exception when others then raise exception 'FEATURED_TRUCK_INVALID';end;
    if key_value<>'vehicle:'||vehicle_value::text then raise exception 'FEATURED_TRUCK_INVALID';end if;
    select * into vehicle_record from public.vehicles where id=vehicle_value and active;
    if not found then raise exception 'FEATURED_PROVIDER_INELIGIBLE';end if;
    select link.provider_key into account_value from public.featured_eligible_account_links() link
      where link.provider_organization_id=vehicle_record.organization_id
        or link.provider_profile_id=vehicle_record.provider_profile_id;
    if account_value is not null and (
      not public.capacity_public_policy_allows(vehicle_value)
      or not exists(select 1 from public.featured_eligible_truck_links(array[vehicle_record.cargo_configuration]) eligible
        where eligible.vehicle_id=vehicle_value)
    ) then account_value:=null;end if;
    if account_value is null then raise exception 'FEATURED_PROVIDER_INELIGIBLE';end if;
    if account_value=any(selected_accounts) then raise exception 'FEATURED_PROVIDER_DUPLICATE';end if;
    selected_accounts:=array_append(selected_accounts,account_value);
  end loop;
  select coalesce(jsonb_agg(configuration),'[]'::jsonb) into configurations
    from (select distinct cargo_configuration as configuration from public.vehicles where active) current_types;
  prepared:=command||jsonb_build_object('theme_key','provider-accounts',
    'theme_label','Transport Providers','theme_configurations',configurations);
  day_id:=public.save_managed_featured_truck_day(actor_user_id,prepared);
  select day.feature_date,day.status='PUBLISHED' into feature_day,published
    from public.featured_provider_days day where day.id=day_id;
  delete from public.featured_account_manual_selections where featured_day_id=day_id;
  if published then
    insert into public.featured_account_manual_selections(featured_day_id,provider_key,feature_date)
      select day_id,unnest(selected_accounts),feature_day;
    insert into public.featured_account_rotation_selections
      (round_number,provider_key,featured_day_id,first_feature_date,origin)
      select (select coalesce(max(round_number),1) from public.featured_account_rotation_selections),
        account,day_id,feature_day,'MANUAL'
      from unnest(selected_accounts) account
      on conflict(round_number,provider_key) do nothing;
  end if;
  return day_id;
end $$;
revoke all on function public.save_managed_featured_provider_day(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.save_managed_featured_provider_day(uuid,jsonb) to service_role;
commit;
