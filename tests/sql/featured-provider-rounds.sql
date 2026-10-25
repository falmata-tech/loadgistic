-- FEAT-CON-001: rollback-only account rotation, manual selection and saved-day
-- compatibility on the installed local or restored database.
begin;
do $test$
declare start_day date;day_value date;response jsonb;existing_days integer;existing_slots integer;
  eligible_count integer;round_low bigint;round_high bigint;round_item bigint;round_count integer;
  admin_id uuid;representative uuid;duplicate_vehicles text[];saved_id uuid;problem text;
  late_saved_id uuid;late_account record;current_round bigint;
begin
  select max(feature_date)+1 into start_day from public.featured_provider_days;
  if start_day is null then start_day:=(now() at time zone 'Africa/Addis_Ababa')::date+30;end if;
  select count(*) into existing_days from public.featured_provider_days where feature_date<start_day;
  select count(*) into existing_slots from public.featured_provider_slots slot
    join public.featured_provider_days day on day.id=slot.day_id where day.feature_date<start_day;
  select count(*) into eligible_count from public.featured_eligible_account_links();
  if eligible_count<8 then raise exception 'FEATURED_ACCOUNT_FIXTURE_TOO_SMALL: %',eligible_count;end if;
  update public.platform_controls set featured_mode='AUTO',featured_target_count=8 where singleton;
  for week_value in 0..3 loop
    day_value:=start_day+week_value*7;
    response:=public.generate_managed_featured_days_for_date(day_value);
    if response->>'created'<>'7' or response->>'empty'<>'0' then
      raise exception 'FEATURED_ACCOUNT_WEEK_GAP: %',response;
    end if;
  end loop;
  if (select count(*) from public.featured_provider_days where feature_date between start_day and start_day+27)<>28
    then raise exception 'FEATURED_ACCOUNT_DAY_GAP';end if;
  if exists(
    select 1 from public.featured_provider_days day
    left join public.featured_provider_slots slot on slot.day_id=day.id
    where day.feature_date between start_day and start_day+27
    group by day.id having count(slot.id)<>8
      or count(distinct coalesce(slot.provider_organization_id,slot.provider_profile_id))<>8
  ) then raise exception 'FEATURED_ACCOUNT_DUPLICATE_OR_SHORT_DAY';end if;
  if (select count(*) from public.featured_provider_days where feature_date<start_day)<>existing_days
    or (select count(*) from public.featured_provider_slots slot
      join public.featured_provider_days day on day.id=slot.day_id where day.feature_date<start_day)<>existing_slots
    then raise exception 'FEATURED_SAVED_DAY_CHANGED';end if;
  select min(round_number),max(round_number) into round_low,round_high
    from public.featured_account_rotation_selections where first_feature_date between start_day and start_day+27;
  if round_high-round_low<2 then raise exception 'FEATURED_ROUND_DID_NOT_ADVANCE';end if;
  for round_item in select generate_series(round_low+1,round_high-1) loop
    select count(*) into round_count from public.featured_account_rotation_selections
      where round_number=round_item;
    if round_count<>eligible_count then
      raise exception 'FEATURED_ROUND_REPEATED_BEFORE_COMPLETE: % % %',round_item,round_count,eligible_count;
    end if;
  end loop;
  select coalesce(max(round_number),1) into current_round
    from public.featured_account_rotation_selections;
  select link.* into late_account from public.featured_eligible_account_links() link
  where not exists(select 1 from public.featured_account_rotation_selections history
    where history.round_number=current_round and history.provider_key=link.provider_key)
  order by link.provider_key limit 1;
  if not found then raise exception 'FEATURED_LATE_SAVED_FIXTURE_MISSING';end if;
  insert into public.featured_provider_days
    (feature_date,base_place_ref,base_place_label,expo_group_key,expo_group_label,
     expo_region_codes,broadcast_start_time,broadcast_end_time,schedule_mode,
     schedule_config_json,manual_schedule_json,target_count,status,selection_source,published_at)
  values(start_day+30,'featured:provider-accounts','Transport Providers','provider-accounts','Transport Providers',
    '[]'::jsonb,'08:30','12:00','AUTO',
    '{"dayStart":"08:30","dayEnd":"12:00","targetCount":1,"sponsorBreakCount":0}'::jsonb,
    '[]'::jsonb,1,'PUBLISHED','AUTO',now()) returning id into late_saved_id;
  insert into public.featured_provider_slots
    (day_id,slot_position,provider_organization_id,provider_profile_id,vehicle_id,driver_user_id)
  values(late_saved_id,1,late_account.provider_organization_id,late_account.provider_profile_id,
    late_account.vehicle_id,late_account.driver_user_id);
  response:=public.generate_managed_featured_days_for_date(start_day+31);
  if not exists(select 1 from public.featured_account_rotation_selections
    where round_number=current_round and provider_key=late_account.provider_key
      and featured_day_id=late_saved_id)
    or exists(select 1 from public.featured_provider_days day
      join public.featured_provider_slots slot on slot.day_id=day.id
      where day.feature_date=start_day+31
        and (slot.provider_organization_id=late_account.provider_organization_id
          or slot.provider_profile_id=late_account.provider_profile_id))
    then raise exception 'FEATURED_LATE_SAVED_DAY_REPEATED ledger:% next_day:% round:% response:%',
      (select count(*) from public.featured_account_rotation_selections
        where round_number=current_round and provider_key=late_account.provider_key
          and featured_day_id=late_saved_id),
      (select count(*) from public.featured_provider_days day
        join public.featured_provider_slots slot on slot.day_id=day.id
        where day.feature_date=start_day+31
          and (slot.provider_organization_id=late_account.provider_organization_id
            or slot.provider_profile_id=late_account.provider_profile_id)),
      current_round,response;end if;
  select id into admin_id from public.profiles where active and role='ADMIN' limit 1;
  select vehicle_id into representative from public.featured_eligible_account_links() limit 1;
  if admin_id is null or representative is null then raise exception 'FEATURED_ADMIN_FIXTURE_MISSING';end if;
  day_value:=start_day+28;
  saved_id:=public.save_managed_featured_provider_day(admin_id,jsonb_build_object(
    'feature_date',day_value,'target_count',1,'truck_keys',jsonb_build_array('vehicle:'||representative::text),
    'schedule_mode','AUTO','schedule_config',jsonb_build_object('dayStart','08:30','dayEnd','12:00',
      'targetCount',1,'sponsorBreakCount',0,'sponsorBreakMinutes',2),
    'manual_schedule','[]'::jsonb,'publish',true
  ));
  if (select expo_group_key from public.featured_provider_days where id=saved_id)<>'provider-accounts'
    or (select count(*) from public.featured_provider_slots where day_id=saved_id)<>1
    or (select count(*) from public.featured_account_manual_selections where featured_day_id=saved_id)<>1
    then raise exception 'FEATURED_MANUAL_ACCOUNT_NOT_SAVED';end if;
  select array_agg('vehicle:'||vehicle_id::text order by vehicle_id) into duplicate_vehicles
  from (
    select vehicle.id as vehicle_id from public.vehicles vehicle
    join public.featured_eligible_truck_links((select array_agg(distinct cargo_configuration)
      from public.vehicles where active)) link on link.vehicle_id=vehicle.id
    where coalesce(vehicle.organization_id,vehicle.provider_profile_id)=(
      select coalesce(other.organization_id,other.provider_profile_id)
      from public.vehicles other
      join public.featured_eligible_truck_links((select array_agg(distinct cargo_configuration)
        from public.vehicles where active)) other_link on other_link.vehicle_id=other.id
      group by coalesce(other.organization_id,other.provider_profile_id)
      having count(*)>1 limit 1
    )
    order by vehicle.id limit 2
  ) pair;
  if cardinality(duplicate_vehicles)=2 then
    begin
      perform public.save_managed_featured_provider_day(admin_id,jsonb_build_object(
        'feature_date',day_value+1,'target_count',2,'truck_keys',to_jsonb(duplicate_vehicles),
        'schedule_mode','AUTO','schedule_config',jsonb_build_object('dayStart','08:30','dayEnd','12:00',
          'targetCount',2,'sponsorBreakCount',0,'sponsorBreakMinutes',2),'publish',true));
      raise exception 'FEATURED_DUPLICATE_ACCOUNT_ACCEPTED';
    exception when raise_exception then
      get stacked diagnostics problem=message_text;
      if problem<>'FEATURED_PROVIDER_DUPLICATE' then raise;end if;
    end;
  end if;
  if has_function_privilege('anon','public.featured_eligible_account_links()','EXECUTE')
    or has_function_privilege('authenticated','public.save_managed_featured_provider_day(uuid,jsonb)','EXECUTE')
    or has_table_privilege('authenticated','public.featured_account_rotation_selections','SELECT')
    then raise exception 'FEATURED_ACCOUNT_LEDGER_EXPOSED';end if;
end $test$;
rollback;
