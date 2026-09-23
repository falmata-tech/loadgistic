-- FEAT-FTR-001: persisted random subsets, exact-pair no-repeat rounds.
-- This is selection history, intentionally retained if a roster or account is
-- later removed. Opaque IDs are snapshots, not cascading foreign-key relations.
create table public.featured_rotation_selections (
  round_number bigint not null check(round_number>0),
  vehicle_id uuid not null,
  driver_user_id uuid not null,
  first_feature_date date not null,
  featured_day_id uuid not null,
  selected_at timestamptz not null default now(),
  primary key(round_number,vehicle_id,driver_user_id)
);
create index featured_rotation_day_idx on public.featured_rotation_selections(featured_day_id);
alter table public.featured_rotation_selections enable row level security;
revoke all on table public.featured_rotation_selections from public,anon,authenticated,service_role;
grant select on table public.featured_rotation_selections to service_role;

-- Preserve known published pair appearances without changing any saved roster.
insert into public.featured_rotation_selections(round_number,vehicle_id,driver_user_id,first_feature_date,featured_day_id,selected_at)
select distinct on (slot.vehicle_id,slot.driver_user_id) 1,slot.vehicle_id,slot.driver_user_id,day.feature_date,day.id,coalesce(day.published_at,now())
from public.featured_provider_slots slot join public.featured_provider_days day on day.id=slot.day_id
where day.status='PUBLISHED' and slot.vehicle_id is not null and slot.driver_user_id is not null
order by slot.vehicle_id,slot.driver_user_id,day.feature_date,day.id;

create or replace function public.generate_managed_featured_days()
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare controls public.platform_controls%rowtype;feature_day date;theme jsonb;configurations text[];
  chosen jsonb;chosen_pair jsonb;chosen_vehicle uuid;chosen_driver uuid;saved_day_id uuid;position_value integer;vehicle_record record;
  current_round bigint;all_configurations text[];eligible_pool jsonb;
  created_count integer:=0;skipped_count integer:=0;empty_count integer:=0;
  today date:=(now() at time zone 'Africa/Addis_Ababa')::date;
begin
  -- One job at a time; parallel dispatches are harmless and retryable.
  if not pg_try_advisory_xact_lock(8030180) then return jsonb_build_object('created',0,'skipped',0,'empty',0); end if;
  select * into strict controls from public.platform_controls where singleton for share;
  if controls.featured_mode<>'AUTO' then return jsonb_build_object('created',0,'skipped',7,'empty',0); end if;
  select coalesce(max(round_number),1) into current_round from public.featured_rotation_selections;
  select array_agg(distinct configuration) into all_configurations
    from generate_series(0,6) day_offset
    cross join lateral jsonb_array_elements_text(public.featured_truck_theme(today+day_offset)->'configurations') configuration;
  -- Snapshot eligibility once per locked job, then validate the selected subset
  -- again before publication. No repeated national candidate scan per day.
  select coalesce(jsonb_agg(jsonb_build_object('vehicle_id',link.vehicle_id,'driver_user_id',link.driver_user_id,
    'cargo_configuration',vehicle.cargo_configuration)),'[]'::jsonb) into eligible_pool
    from public.featured_eligible_truck_links(all_configurations) link join public.vehicles vehicle on vehicle.id=link.vehicle_id;
  for offset_value in 0..6 loop
    feature_day:=today+offset_value;
    if exists(select 1 from public.featured_provider_days where feature_date=feature_day) then skipped_count:=skipped_count+1;continue; end if;
    theme:=public.featured_truck_theme(feature_day);
    select array_agg(value) into configurations from jsonb_array_elements_text(theme->'configurations') value;
    -- A global round includes all currently eligible themes. A completed theme
    -- waits rather than repeating while another theme still has unseen pairs.
    if jsonb_array_length(eligible_pool)=0 then
      empty_count:=empty_count+1;continue;
    end if;
    if not exists(
      select 1 from jsonb_to_recordset(eligible_pool) as link(vehicle_id uuid,driver_user_id uuid,cargo_configuration text)
      where not exists(select 1 from public.featured_rotation_selections history
        where history.round_number=current_round and history.vehicle_id=link.vehicle_id and history.driver_user_id=link.driver_user_id)
    ) then current_round:=current_round+1; end if;
    with candidates as materialized (
      select link.vehicle_id,link.driver_user_id,random() as draw
      from jsonb_to_recordset(eligible_pool) as link(vehicle_id uuid,driver_user_id uuid,cargo_configuration text)
      where link.cargo_configuration=any(configurations) and not exists(select 1 from public.featured_rotation_selections history
        where history.round_number=current_round and history.vehicle_id=link.vehicle_id and history.driver_user_id=link.driver_user_id)
    ), distinct_drivers as (
      select *,row_number() over(partition by driver_user_id order by draw,vehicle_id) as driver_choice from candidates
    ), selected as (
      select * from distinct_drivers where driver_choice=1 order by draw,vehicle_id limit controls.featured_target_count
    )
    select jsonb_agg(jsonb_build_object('vehicle_id',vehicle_id,'driver_user_id',driver_user_id) order by draw,vehicle_id) into chosen from selected;
    if coalesce(jsonb_array_length(chosen),0)=0 then empty_count:=empty_count+1;continue; end if;
    perform 1 from public.vehicles where id in(select (value->>'vehicle_id')::uuid from jsonb_array_elements(chosen)) for share;
    if exists(select 1 from jsonb_to_recordset(chosen) selected(vehicle_id uuid,driver_user_id uuid)
      left join public.featured_eligible_truck_links(configurations) current_pair using(vehicle_id,driver_user_id)
      where current_pair.vehicle_id is null) then raise exception 'FEATURED_ELIGIBILITY_CHANGED';end if;
    saved_day_id:=null;
    insert into public.featured_provider_days(feature_date,base_place_ref,base_place_label,expo_group_key,expo_group_label,
      expo_region_codes,broadcast_start_time,broadcast_end_time,schedule_mode,schedule_config_json,manual_schedule_json,
      target_count,status,selection_source,published_at)
    values(feature_day,'featured:'||(theme->>'key'),theme->>'label',theme->>'key',theme->>'label','[]'::jsonb,
      '07:30','09:00','AUTO',jsonb_build_object('dayStart','07:30','dayEnd','09:00','targetCount',jsonb_array_length(chosen),'sponsorBreakEvery',2,'sponsorBreakMinutes',2),
      '[]'::jsonb,jsonb_array_length(chosen),'PUBLISHED','AUTO',now())
    on conflict(feature_date) do nothing returning id into saved_day_id;
    if saved_day_id is null then skipped_count:=skipped_count+1;continue; end if;
    position_value:=0;
    for chosen_pair in select value from jsonb_array_elements(chosen) loop
      chosen_vehicle:=(chosen_pair->>'vehicle_id')::uuid;
      chosen_driver:=(chosen_pair->>'driver_user_id')::uuid;
      select * into strict vehicle_record from public.vehicles where id=chosen_vehicle for share;
      if public.capacity_active_driver_id(chosen_vehicle) is distinct from chosen_driver
      then raise exception 'FEATURED_ELIGIBILITY_CHANGED';end if;
      position_value:=position_value+1;
      insert into public.featured_provider_slots(day_id,slot_position,provider_organization_id,provider_profile_id,vehicle_id,driver_user_id)
        values(saved_day_id,position_value,vehicle_record.organization_id,vehicle_record.provider_profile_id,vehicle_record.id,chosen_driver);
      insert into public.featured_rotation_selections(round_number,vehicle_id,driver_user_id,first_feature_date,featured_day_id)
        values(current_round,chosen_vehicle,chosen_driver,feature_day,saved_day_id);
    end loop;
    insert into public.audit_logs(action,entity_type,entity_id,details)
      values('FEATURED_DAY_AUTO_PUBLISHED','featured_truck_day',saved_day_id,jsonb_build_object('featureDate',feature_day,'truckCount',jsonb_array_length(chosen),'requestedCount',controls.featured_target_count,'theme',theme->>'key','rotationRound',current_round));
    created_count:=created_count+1;
  end loop;
  return jsonb_build_object('created',created_count,'skipped',skipped_count,'empty',empty_count);
end $$;

revoke all on function public.generate_managed_featured_days() from public,anon,authenticated;
grant execute on function public.generate_managed_featured_days() to service_role;
