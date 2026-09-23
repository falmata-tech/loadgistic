-- Disposable Loadgistic local fixtures only; all roster/history changes roll back.
begin;
do $test$
declare configs text[];today date:=(now() at time zone 'Africa/Addis_Ababa')::date;
  result jsonb;snapshot jsonb;after_retry jsonb;round_value bigint;eligible_count integer;
  loops integer:=0;first_pair record;history_count integer;admin_id uuid;manual_id uuid;
  first_draw text[];second_draw text[];
begin
  select array_agg(distinct configuration) into configs from generate_series(0,6) day_offset
    cross join lateral jsonb_array_elements_text(public.featured_truck_theme(today+day_offset)->'configurations') configuration;
  select count(*) into eligible_count from public.featured_eligible_truck_links(configs);
  if eligible_count<13 then raise exception 'FEATURED_ROTATION_FIXTURE_TOO_SMALL';end if;
  delete from public.featured_provider_days where feature_date between today and today+6;
  delete from public.featured_rotation_selections;
  update public.platform_controls set featured_mode='AUTO',featured_target_count=12 where singleton;

  perform setseed(0.125);
  result:=public.generate_managed_featured_days();
  if (result->>'created')::int<1 then raise exception 'NO_RANDOM_ROSTER';end if;
  if exists(select 1 from public.featured_provider_days d where d.feature_date between today and today+6
    and (d.target_count>12 or d.target_count<>(select count(*) from public.featured_provider_slots s where s.day_id=d.id)
    or (d.schedule_config_json->>'targetCount')::int<>d.target_count)) then raise exception 'ROSTER_COUNT_NOT_ACTUAL';end if;
  if exists(select day_id from public.featured_provider_slots group by day_id having count(*)<>count(distinct driver_user_id)) then raise exception 'DUPLICATE_DAILY_DRIVER';end if;
  select array_agg(s.vehicle_id::text||':'||s.driver_user_id::text order by d.feature_date,s.slot_position) into first_draw
    from public.featured_provider_slots s join public.featured_provider_days d on d.id=s.day_id where d.feature_date between today and today+6;
  delete from public.featured_provider_days where feature_date between today and today+6;
  delete from public.featured_rotation_selections;
  perform setseed(0.75);perform public.generate_managed_featured_days();
  select array_agg(s.vehicle_id::text||':'||s.driver_user_id::text order by d.feature_date,s.slot_position) into second_draw
    from public.featured_provider_slots s join public.featured_provider_days d on d.id=s.day_id where d.feature_date between today and today+6;
  if first_draw is not distinct from second_draw then raise exception 'DRAW_NOT_RANDOMIZED';end if;
  select jsonb_agg(to_jsonb(s) order by s.id) into snapshot from public.featured_provider_slots s;
  perform public.generate_managed_featured_days();
  select jsonb_agg(to_jsonb(s) order by s.id) into after_retry from public.featured_provider_slots s;
  if snapshot is distinct from after_retry then raise exception 'RETRY_RESHUFFLED';end if;

  -- Removing/curating a roster must not erase an already selected pair's turn.
  select count(*) into history_count from public.featured_rotation_selections;
  select * into strict first_pair from public.featured_rotation_selections order by first_feature_date,vehicle_id limit 1;
  delete from public.featured_provider_days where feature_date between today and today+6;
  if (select count(*) from public.featured_rotation_selections)<>history_count then raise exception 'HISTORY_LOST';end if;

  -- Simulate later weekly subsets in a rollback, retaining the selection ledger.
  loop
    perform public.generate_managed_featured_days();loops:=loops+1;
    select max(round_number) into round_value from public.featured_rotation_selections;
    if round_value>1 then exit;end if;
    if loops>eligible_count then raise exception 'ROUND_NEVER_FINISHED';end if;
    delete from public.featured_provider_days where feature_date between today and today+6;
  end loop;
  if exists(select 1 from public.featured_eligible_truck_links(configs) e where not exists(
    select 1 from public.featured_rotation_selections h where h.round_number=1 and h.vehicle_id=e.vehicle_id and h.driver_user_id=e.driver_user_id
  )) then raise exception 'NEW_ROUND_BEFORE_EVERYONE_SELECTED';end if;
  if exists(select round_number,vehicle_id,driver_user_id from public.featured_rotation_selections group by 1,2,3 having count(*)>1) then raise exception 'PAIR_REPEATED_WITHIN_ROUND';end if;

  -- A truck's historical pairing with another Driver cannot exclude its current pair.
  delete from public.featured_provider_days where feature_date between today and today+6;
  delete from public.featured_rotation_selections;
  insert into public.featured_rotation_selections(round_number,vehicle_id,driver_user_id,first_feature_date,featured_day_id)
    select 1,e.vehicle_id,case when e.vehicle_id=first_pair.vehicle_id then gen_random_uuid() else e.driver_user_id end,today,gen_random_uuid()
    from public.featured_eligible_truck_links(configs) e;
  perform public.generate_managed_featured_days();
  if not exists(select 1 from public.featured_rotation_selections where round_number=1 and vehicle_id=first_pair.vehicle_id
    and driver_user_id=first_pair.driver_user_id) then raise exception 'CHANGED_PAIR_EXCLUDED';end if;

  -- An inactive pair cannot block completion; returning eligibility joins anew.
  delete from public.featured_provider_days where feature_date between today and today+6;
  delete from public.featured_rotation_selections;
  insert into public.featured_rotation_selections(round_number,vehicle_id,driver_user_id,first_feature_date,featured_day_id)
    select 1,e.vehicle_id,e.driver_user_id,today,gen_random_uuid() from public.featured_eligible_truck_links(configs) e
    where e.vehicle_id<>first_pair.vehicle_id;
  update public.vehicles set active=false where id=first_pair.vehicle_id;
  perform public.generate_managed_featured_days();
  if (select max(round_number) from public.featured_rotation_selections)<2 then raise exception 'INACTIVE_PAIR_BLOCKED_ROUND';end if;
  update public.vehicles set active=true where id=first_pair.vehicle_id;
  if not exists(select 1 from public.featured_eligible_truck_links(configs) where vehicle_id=first_pair.vehicle_id) then raise exception 'RETURNING_PAIR_INELIGIBLE';end if;

  -- Saved manual days remain protected, including drafts; no read-side generation.
  select id into strict admin_id from public.profiles where email='admin@loadgistic.local';
  delete from public.featured_provider_days where feature_date=today;
  manual_id:=public.save_managed_featured_truck_day(admin_id,jsonb_build_object('feature_date',today,'target_count',3,
    'theme_key',public.featured_truck_theme(today)->>'key','theme_label',public.featured_truck_theme(today)->>'label',
    'theme_configurations',public.featured_truck_theme(today)->'configurations','truck_keys','[]'::jsonb,'publish',false,
    'schedule_config',jsonb_build_object('dayStart','07:30','dayEnd','09:00','targetCount',3,'sponsorBreakEvery',2,'sponsorBreakMinutes',2)));
  perform public.generate_managed_featured_days();
  if not exists(select 1 from public.featured_provider_days where id=manual_id and status='DRAFT' and selection_source='MANUAL') then raise exception 'MANUAL_DAY_OVERWRITTEN';end if;

  if not (select relrowsecurity from pg_class where oid='public.featured_rotation_selections'::regclass) then raise exception 'ROTATION_RLS_MISSING';end if;
  if has_table_privilege('anon','public.featured_rotation_selections','SELECT,INSERT,UPDATE,DELETE')
    or has_table_privilege('authenticated','public.featured_rotation_selections','SELECT,INSERT,UPDATE,DELETE')
    or has_function_privilege('authenticated','public.generate_managed_featured_days()','EXECUTE')
    or has_function_privilege('anon','public.generate_managed_featured_days()','EXECUTE') then raise exception 'ROTATION_BROWSER_ACCESS';end if;
  raise notice 'PASS: no-repeat exact-pair rounds, exhaustion, actual count, retry stability, retained history, eligibility, manual preservation, RLS/ACL denial';
end $test$;
rollback;
