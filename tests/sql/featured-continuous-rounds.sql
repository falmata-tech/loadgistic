-- FEAT-FTR-001 / NR-29. Disposable local PostgreSQL only; every change rolls back.
-- The first assertion is also a behavioral fail-before check against migration 136.
begin;
create temporary table featured_test_pairs(vehicle_id uuid primary key,driver_user_id uuid,primary_theme_key text,ordinal integer);
create function pg_temp.featured_test_candidate(org uuid,theme_key text,configuration text,ordinal_value integer)
returns uuid language plpgsql as $$
declare actor uuid:=gen_random_uuid();truck uuid:=gen_random_uuid();
begin
  insert into auth.users(id,email,raw_user_meta_data) values(actor,'featured-'||actor||'@example.test','{"full_name":"Synthetic Featured Driver"}');
  update public.profiles set role='DRIVER',active=true where id=actor;
  insert into public.drivers(organization_id,user_id,name,active) values(org,actor,'Synthetic Featured Driver',true);
  insert into public.organization_members(organization_id,user_id,membership_role) values(org,actor,'DRIVER');
  insert into public.vehicles(id,organization_id,label,category,cargo_configuration,active)
    values(truck,org,'Synthetic Featured truck','BOX',configuration,true);
  insert into public.driver_vehicle_assignments(driver_user_id,vehicle_id,active) values(actor,truck,true);
  insert into featured_test_pairs values(truck,actor,theme_key,ordinal_value);
  return truck;
end $$;
create function pg_temp.featured_test_manual_day(actor uuid,feature_day date,truck uuid default null)
returns uuid language plpgsql as $$
declare theme jsonb:=public.featured_truck_theme(feature_day);
begin
  return public.save_managed_featured_truck_day(actor,jsonb_build_object('feature_date',feature_day,
    'theme_key',theme->>'key','theme_label',theme->>'label','theme_configurations',theme->'configurations',
    'target_count',1,'truck_keys',case when truck is null then '[]'::jsonb else jsonb_build_array('vehicle:'||truck) end,
    'publish',false,'schedule_mode','AUTO','schedule_config',jsonb_build_object('dayStart','08:30','dayEnd','12:00',
      'targetCount',1,'sponsorBreakCount',4,'sponsorBreakMinutes',2)));
end $$;

do $test$
declare org uuid;admin_id uuid;today date:=(now() at time zone 'Africa/Addis_Ababa')::date;
  first_tuesday date:='2198-01-01';mixed_day date;test_day date;manual_id uuid;selected_truck uuid;selected_driver uuid;
  theme jsonb;configuration text;key text;pool_count integer;global_round bigint;result jsonb;overview jsonb;
  legacy_before jsonb;saved_before jsonb;saved_after jsonb;history_before jsonb;first_draw uuid[];second_draw uuid[];
  replacement uuid:=gen_random_uuid();new_round bigint;unseen_count integer;
begin
  select id into strict admin_id from public.profiles where active and role='ADMIN' limit 1;
  select v.organization_id into strict org from public.featured_eligible_truck_links(array['Cargo van','Mini Box Truck','Pickup truck','Light Box Truck','Medium Box Truck','Heavy Rigid Stake Body Truck']) link
    join public.vehicles v on v.id=link.vehicle_id where v.organization_id is not null limit 1;
  -- CI imports ordinary rosters after137, so they are not migration-time inputs.
  -- verify-featured-bootstrap-local.mjs replays the exact approved seed against
  -- deliberate pre-seed legacy/reservation records, with missing-source negatives.
  update public.vehicles set active=false where active;
  for day_offset in 0..5 loop
    theme:=public.featured_truck_theme('2026-10-12'::date+day_offset);key:=theme->>'key';configuration:=theme->'configurations'->>0;
    pool_count:=case when key='cargo-vans' then 15 else 24 end;
    for ordinal_value in 1..pool_count loop
      perform pg_temp.featured_test_candidate(org,key,configuration,ordinal_value);
    end loop;
  end loop;
  update public.platform_controls set featured_mode='AUTO',featured_target_count=8 where singleton;
  select coalesce(max(round_number),1) into global_round from public.featured_rotation_selections;
  -- Reproduce the live failure: every type is exhausted except one mini pair.
  insert into public.featured_rotation_selections(round_number,vehicle_id,driver_user_id,first_feature_date,featured_day_id)
    select global_round,vehicle_id,driver_user_id,today-7,gen_random_uuid() from featured_test_pairs
    where primary_theme_key<>'mini-trucks' or ordinal<>1;
  select coalesce(jsonb_agg(to_jsonb(h) order by round_number,vehicle_id,driver_user_id),'[]'::jsonb) into legacy_before
    from public.featured_rotation_selections h;
  delete from public.featured_provider_days where feature_date between today and today+6;
  if to_regclass('public.featured_theme_rotation_selections') is not null then
    delete from public.featured_theme_rotation_selections;
    insert into public.featured_theme_rotation_selections(primary_theme_key,round_number,vehicle_id,driver_user_id,first_feature_date,featured_day_id,origin)
      select primary_theme_key,1,vehicle_id,driver_user_id,today-7,gen_random_uuid(),'LEGACY' from featured_test_pairs
      where primary_theme_key<>'mini-trucks' or ordinal<>1;
  end if;
  result:=public.generate_managed_featured_days();
  if result->>'ok'<>'true' or not exists(select 1 from public.featured_provider_days where feature_date=today and target_count=8 and status='PUBLISHED')
    then raise exception 'CONTINUOUS_TODAY_NOT_FILLED';end if;
  if (select coalesce(jsonb_agg(to_jsonb(h) order by round_number,vehicle_id,driver_user_id),'[]'::jsonb) from public.featured_rotation_selections h)
    is distinct from legacy_before then raise exception 'LEGACY_HISTORY_CHANGED';end if;
  if result->>'created'<>'7' or result->>'empty'<>'0' then raise exception 'EXHAUSTED_TYPES_LEFT_GAPS';end if;

  -- Advance the calendar for four weeks with retained days, unequal pools and
  -- protected Sunday drafts. This isolates the exact 15-van 8 + (7 + 1) boundary.
  first_tuesday:=first_tuesday+((2-extract(isodow from first_tuesday)::integer+7)%7);
  if exists(select 1 from public.featured_provider_days where feature_date between first_tuesday and first_tuesday+140) then raise exception 'TEST_DATES_OCCUPIED';end if;
  delete from public.featured_theme_rotation_selections;
  for week_offset in 0..4 loop
    perform pg_temp.featured_test_manual_day(admin_id,first_tuesday+5+week_offset*7);
  end loop;
  for date_offset in 0..27 loop
    perform public.generate_managed_featured_days_for_date(first_tuesday+date_offset);
  end loop;
  if exists(select 1 from generate_series(0,33) date_offset
    where extract(isodow from first_tuesday+date_offset)<>7 and not exists(
      select 1 from public.featured_provider_days d where d.feature_date=first_tuesday+date_offset and d.target_count=8 and d.status='PUBLISHED'))
    then raise exception 'ADVANCING_CALENDAR_LEFT_GAPS';end if;
  if (select count(*) from public.featured_theme_rotation_selections where primary_theme_key='cargo-vans' and round_number=1)<>15
    then raise exception 'VAN_ROUND_SKIPPED_PAIRS';end if;
  if (select count(*) from public.featured_theme_rotation_selections where primary_theme_key='cargo-vans' and round_number=1 and first_feature_date=first_tuesday+7)<>7
    or (select count(*) from public.featured_theme_rotation_selections where primary_theme_key='cargo-vans' and round_number=2 and first_feature_date=first_tuesday+7)<>1
    then raise exception 'VAN_ROLLOVER_NOT_SEVEN_THEN_ONE';end if;
  if exists(select 1 from public.featured_provider_slots s join public.featured_provider_days d on d.id=s.day_id
    join public.featured_theme_rotation_selections h on h.featured_day_id=d.id and h.vehicle_id=s.vehicle_id and h.driver_user_id=s.driver_user_id
    where d.feature_date=first_tuesday+7 and ((s.slot_position<8 and h.round_number<>1) or (s.slot_position=8 and h.round_number<>2)))
    then raise exception 'REPEAT_BEFORE_REMAINING_TURNS';end if;
  if exists(select s.day_id from public.featured_provider_slots s join public.featured_provider_days d on d.id=s.day_id
    where d.feature_date between first_tuesday and first_tuesday+33 group by s.day_id
    having count(*)<>count(distinct s.driver_user_id) or count(*)<>count(distinct s.vehicle_id)) then raise exception 'DUPLICATE_DAILY_DRIVER_OR_TRUCK';end if;
  if exists(select 1 from public.featured_provider_days d where d.feature_date between first_tuesday and first_tuesday+33 and d.selection_source='AUTO'
    and (d.target_count<>(select count(*) from public.featured_provider_slots s where s.day_id=d.id)
      or d.broadcast_start_time<>'08:30' or d.broadcast_end_time<>'12:00' or d.schedule_config_json->>'targetCount'<>d.target_count::text
      or d.schedule_config_json->>'sponsorBreakCount'<>'4' or d.schedule_config_json->>'sponsorBreakMinutes'<>'2')) then raise exception 'COUNT_OR_BROADCAST_CHANGED';end if;
  select jsonb_build_object('days',(select jsonb_agg(to_jsonb(d) order by d.id) from public.featured_provider_days d),
    'slots',(select jsonb_agg(to_jsonb(s) order by s.id) from public.featured_provider_slots s),
    'audit',(select jsonb_agg(to_jsonb(a) order by a.id) from public.audit_logs a where a.action like 'FEATURED_%')) into saved_before;
  select jsonb_agg(to_jsonb(h) order by primary_theme_key,round_number,vehicle_id,driver_user_id) into history_before from public.featured_theme_rotation_selections h;
  perform public.generate_managed_featured_days_for_date(first_tuesday+27);
  select jsonb_build_object('days',(select jsonb_agg(to_jsonb(d) order by d.id) from public.featured_provider_days d),
    'slots',(select jsonb_agg(to_jsonb(s) order by s.id) from public.featured_provider_slots s),
    'audit',(select jsonb_agg(to_jsonb(a) order by a.id) from public.audit_logs a where a.action like 'FEATURED_%')) into saved_after;
  if saved_before is distinct from saved_after or history_before is distinct from
    (select jsonb_agg(to_jsonb(h) order by primary_theme_key,round_number,vehicle_id,driver_user_id) from public.featured_theme_rotation_selections h)
    then raise exception 'RETRY_RESHUFFLED_OR_OVERWROTE_DAY';end if;
  if exists(select 1 from public.featured_provider_days d where d.feature_date between first_tuesday and first_tuesday+33
    and extract(isodow from d.feature_date)=7 and (d.status<>'DRAFT' or d.selection_source<>'MANUAL')) then raise exception 'MANUAL_DAY_OVERWRITTEN';end if;

  -- Sunday shares van turns: eight on Sunday, seven remaining before Tuesday's
  -- one new-round entry. No second mixed queue can mark those eight unseen.
  update public.vehicles set active=false where id in(select vehicle_id from featured_test_pairs where primary_theme_key<>'cargo-vans');
  delete from public.featured_theme_rotation_selections;
  mixed_day:=first_tuesday+68; -- Sunday, far from the retained four-week programme.
  perform public.generate_managed_featured_days_for_date(mixed_day);
  if (select count(*) from public.featured_theme_rotation_selections where primary_theme_key='cargo-vans' and round_number=1 and first_feature_date=mixed_day)<>8
    or (select count(*) from public.featured_theme_rotation_selections where primary_theme_key='cargo-vans' and round_number=1 and first_feature_date=mixed_day+2)<>7
    or (select count(*) from public.featured_theme_rotation_selections where primary_theme_key='cargo-vans' and round_number=2 and first_feature_date=mixed_day+2)<>1
    then raise exception 'MIXED_SUNDAY_DID_NOT_CONSUME_PRIMARY_TURNS';end if;
  overview:=public.managed_featured_overview(admin_id);
  if overview->>'rotation_policy'<>'PRIMARY_THEME' or overview->>'eligible'<>'15' or overview->>'remaining'<>'14'
    or (select count(*) from jsonb_object_keys(overview->'rounds'))<>6 then raise exception 'OVERVIEW_DOUBLE_COUNTS_MIXED_POOL';end if;

  -- Prefer an unseen van without a nearby reservation; proximity never blocks a
  -- real programme when the only eligible Driver already has a nearby slot.
  delete from public.featured_theme_rotation_selections;
  select vehicle_id,driver_user_id into selected_truck,selected_driver from featured_test_pairs where primary_theme_key='cargo-vans' and ordinal=1;
  update public.platform_controls set featured_target_count=1 where singleton;
  test_day:=mixed_day+14;
  manual_id:=pg_temp.featured_test_manual_day(admin_id,test_day-5,selected_truck);
  perform public.generate_managed_featured_days_for_date(test_day);
  if exists(select 1 from public.featured_provider_slots s join public.featured_provider_days d on d.id=s.day_id
    where d.feature_date=test_day and s.vehicle_id=selected_truck) then raise exception 'NEARBY_PREFERENCE_IGNORED';end if;
  update public.vehicles set active=false where id in(select vehicle_id from featured_test_pairs) and id<>selected_truck;
  delete from public.featured_theme_rotation_selections;
  test_day:=test_day+14;
  perform pg_temp.featured_test_manual_day(admin_id,test_day-5,selected_truck);
  update public.platform_controls set featured_target_count=8 where singleton;
  perform public.generate_managed_featured_days_for_date(test_day);
  if not exists(select 1 from public.featured_provider_days d join public.featured_provider_slots s on s.day_id=d.id
    where d.feature_date=test_day and d.target_count=1 and s.vehicle_id=selected_truck)
    then raise exception 'NEARBY_FALLBACK_OR_HONEST_SCARCITY_FAILED';end if;
  -- A later manual edit/delete does not erase a selected turn.
  select jsonb_agg(to_jsonb(h) order by primary_theme_key,round_number,vehicle_id,driver_user_id) into history_before from public.featured_theme_rotation_selections h;
  perform pg_temp.featured_test_manual_day(admin_id,test_day);
  delete from public.featured_provider_days where feature_date=test_day;
  if history_before is distinct from (select jsonb_agg(to_jsonb(h) order by primary_theme_key,round_number,vehicle_id,driver_user_id) from public.featured_theme_rotation_selections h)
    then raise exception 'MANUAL_EDIT_OR_DELETE_LOST_HISTORY';end if;

  -- No private/moderated/review identity is a public turn or a round blocker.
  update public.organizations set content_hidden=true where id=org;
  if exists(select 1 from public.featured_eligible_truck_links(array['Cargo van'])) then raise exception 'HIDDEN_CANDIDATE_ELIGIBLE';end if;
  result:=public.generate_managed_featured_days_for_date(test_day+14);
  if result->>'created'<>'0' or result->>'empty'<>'7' then raise exception 'HIDDEN_CANDIDATE_CONSUMED_TURN';end if;
  update public.organizations set content_hidden=false,review_workspace=true where id=org;
  if exists(select 1 from public.featured_eligible_truck_links(array['Cargo van'])) then raise exception 'REVIEW_CANDIDATE_ELIGIBLE';end if;
  update public.organizations set review_workspace=false where id=org;
  update public.profiles set active=false where id=selected_driver;
  if exists(select 1 from public.featured_eligible_truck_links(array['Cargo van'])) then raise exception 'INACTIVE_DRIVER_ELIGIBLE';end if;
  update public.profiles set active=true where id=selected_driver;
  update public.driver_vehicle_assignments set active=false where vehicle_id=selected_truck;
  if exists(select 1 from public.featured_eligible_truck_links(array['Cargo van'])) then raise exception 'UNASSIGNED_TRUCK_ELIGIBLE';end if;
  insert into auth.users(id,email,raw_user_meta_data) values(replacement,'replacement-'||replacement||'@example.test','{"full_name":"Synthetic replacement"}');
  update public.profiles set role='DRIVER',active=true where id=replacement;
  insert into public.drivers(organization_id,user_id,name,active) values(org,replacement,'Synthetic replacement',true);
  insert into public.organization_members(organization_id,user_id,membership_role) values(org,replacement,'DRIVER');
  insert into public.driver_vehicle_assignments(driver_user_id,vehicle_id,active) values(replacement,selected_truck,true);
  test_day:=test_day+28;
  perform public.generate_managed_featured_days_for_date(test_day);
  if not exists(select 1 from public.featured_theme_rotation_selections where vehicle_id=selected_truck and driver_user_id=replacement)
    then raise exception 'CHANGED_PAIR_EXCLUDED';end if;
  if not exists(select 1 from public.featured_theme_rotation_selections where vehicle_id=selected_truck and driver_user_id=selected_driver)
    then raise exception 'OLD_PAIR_HISTORY_LOST';end if;
  -- Inactive pairs cannot hold up completion of a smaller current pool.
  if not exists(select 1 from public.featured_provider_days where feature_date=test_day and target_count=1 and status='PUBLISHED')
    then raise exception 'INACTIVE_PAIRS_BLOCKED_ROLLOVER';end if;

  -- Distinct random seeds produce different saved draws, without deleting or
  -- reshuffling those published dates. Their dates are more than six days apart.
  update public.vehicles set active=true where id in(select vehicle_id from featured_test_pairs where primary_theme_key='cargo-vans');
  update public.platform_controls set featured_target_count=8 where singleton;
  delete from public.featured_theme_rotation_selections;
  test_day:=first_tuesday+154;
  perform setseed(0.125);perform public.generate_managed_featured_days_for_date(test_day);
  select array_agg(s.vehicle_id order by s.slot_position) into first_draw from public.featured_provider_slots s join public.featured_provider_days d on d.id=s.day_id where d.feature_date=test_day;
  delete from public.featured_theme_rotation_selections;
  perform setseed(0.75);perform public.generate_managed_featured_days_for_date(test_day+14);
  select array_agg(s.vehicle_id order by s.slot_position) into second_draw from public.featured_provider_slots s join public.featured_provider_days d on d.id=s.day_id where d.feature_date=test_day+14;
  if first_draw is not distinct from second_draw then raise exception 'DRAW_NOT_RANDOMIZED';end if;

  if not (select relrowsecurity from pg_class where oid='public.featured_theme_rotation_selections'::regclass)
    or has_table_privilege('anon','public.featured_theme_rotation_selections','SELECT,INSERT,UPDATE,DELETE')
    or has_table_privilege('authenticated','public.featured_theme_rotation_selections','SELECT,INSERT,UPDATE,DELETE')
    or has_table_privilege('service_role','public.featured_theme_rotation_selections','INSERT,UPDATE,DELETE')
    or has_table_privilege('anon','public.featured_rotation_selections','SELECT,INSERT,UPDATE,DELETE')
    or has_table_privilege('authenticated','public.featured_rotation_selections','SELECT,INSERT,UPDATE,DELETE') then raise exception 'ROTATION_HISTORY_ROLE_ACCESS';end if;
  foreach key in array array['public.generate_managed_featured_days_for_date(date)','public.generate_managed_featured_days_core()',
    'public.featured_truck_primary_theme(text)','public.generate_managed_featured_days_global_legacy()','public.managed_featured_overview_global_legacy(uuid)'] loop
    if has_function_privilege('anon',key,'EXECUTE') or has_function_privilege('authenticated',key,'EXECUTE')
      or has_function_privilege('service_role',key,'EXECUTE') then raise exception 'PRIVATE_ROTATION_FUNCTION_EXPOSED';end if;
  end loop;
  if has_function_privilege('anon','public.generate_managed_featured_days()','EXECUTE')
    or has_function_privilege('authenticated','public.generate_managed_featured_days()','EXECUTE') then raise exception 'BROWSER_GENERATION_ALLOWED';end if;
  begin perform public.managed_featured_overview(null);raise exception 'ANON_OVERVIEW_ALLOWED';
    exception when raise_exception then if sqlerrm<>'FORBIDDEN' then raise;end if;end;
  if (select coalesce(jsonb_agg(to_jsonb(h) order by round_number,vehicle_id,driver_user_id),'[]'::jsonb) from public.featured_rotation_selections h)
    is distinct from legacy_before then raise exception 'LEGACY_HISTORY_CHANGED';end if;
  raise notice 'PASS: live exhaustion counterexample, advancing four-week calendar, seven-then-one rollover, shared Mixed turns, nearby preference/fallback, scarcity, manual/retry/history, changed eligibility, random draws and RLS/ACL denial';
end $test$;

-- Fail after the first real slot AND its private turn have been inserted. The
-- unchanged 105 wrapper must roll back both, not just an isolated audit write.
create function pg_temp.featured_fail_second_slot() returns trigger language plpgsql as $$
begin
  if new.slot_position=2 then raise exception 'synthetic private failure after a saved slot';end if;
  return new;
end $$;
create trigger featured_test_partial_failure before insert on public.featured_provider_slots
  for each row execute function pg_temp.featured_fail_second_slot();
do $atomic$
declare today date:=(now() at time zone 'Africa/Addis_Ababa')::date;before_history jsonb;result jsonb;
begin
  delete from public.featured_provider_days where feature_date between today and today+6;
  select jsonb_agg(to_jsonb(h) order by primary_theme_key,round_number,vehicle_id,driver_user_id) into before_history
    from public.featured_theme_rotation_selections h;
  result:=public.generate_managed_featured_days();
  if result->>'ok'<>'false' or (select outcome from public.featured_automation_status where singleton)<>'FAILED'
    then raise exception 'PARTIAL_GENERATION_FAILURE_NOT_RECORDED';end if;
  if exists(select 1 from public.featured_provider_days where feature_date between today and today+6)
    or before_history is distinct from (select jsonb_agg(to_jsonb(h) order by primary_theme_key,round_number,vehicle_id,driver_user_id) from public.featured_theme_rotation_selections h)
    or result::text like '%private failure%' then raise exception 'PARTIAL_DAY_SLOT_HISTORY_OR_ERROR_RETAINED';end if;
  raise notice 'PASS: actual day/slot/theme-turn failure rolls back atomically and returns only safe status';
end $atomic$;
drop trigger featured_test_partial_failure on public.featured_provider_slots;

-- Exercise the installed privilege boundary, not only its catalog description.
set local role anon;
do $denial$
begin
  begin perform public.generate_managed_featured_days_for_date('2198-01-01');raise exception 'ANON_DATE_GENERATION_ALLOWED';
    exception when insufficient_privilege then null;end;
  begin perform 1 from public.featured_theme_rotation_selections;raise exception 'ANON_HISTORY_READ_ALLOWED';
    exception when insufficient_privilege then null;end;
end $denial$;
reset role;
set local role authenticated;
do $denial$
begin
  begin perform public.generate_managed_featured_days_for_date('2198-01-01');raise exception 'AUTHENTICATED_DATE_GENERATION_ALLOWED';
    exception when insufficient_privilege then null;end;
end $denial$;
reset role;
set local role service_role;
do $denial$
begin
  begin perform public.generate_managed_featured_days_for_date('2198-01-01');raise exception 'SERVICE_DATE_GENERATION_ALLOWED';
    exception when insufficient_privilege then null;end;
end $denial$;
reset role;
rollback;
