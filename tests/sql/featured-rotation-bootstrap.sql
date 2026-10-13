-- FEAT-FTR-001 / NR-34: replay the actual migration137 seed in a rolled-back local transaction.
-- CI imports ordinary rosters AFTER migrations; these deliberate records instead
-- model the source rows present immediately BEFORE the one-time seed runs.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';
select pg_advisory_xact_lock(8030180);
create temporary table featured_bootstrap_cases(
  case_key text primary key,vehicle_id uuid,driver_user_id uuid,primary_theme_key text,
  expected_origin text,expected_date date,expected_day_id uuid,expected_selected_at timestamptz
);
create function pg_temp.featured_bootstrap_source_digest() returns jsonb language sql as $$
  select jsonb_build_object(
    'legacy',md5(coalesce((select jsonb_agg(to_jsonb(h) order by round_number,vehicle_id,driver_user_id)::text from public.featured_rotation_selections h),'[]')),
    'days',md5(coalesce((select jsonb_agg(to_jsonb(d) order by id)::text from public.featured_provider_days d),'[]')),
    'slots',md5(coalesce((select jsonb_agg(to_jsonb(s) order by id)::text from public.featured_provider_slots s),'[]')))
$$;
create temporary table featured_bootstrap_snapshot(source_digest jsonb);

do $fixtures$
declare org uuid:=gen_random_uuid();actor uuid;truck uuid;day_id uuid;legacy_day uuid;
  today date:=(now() at time zone 'Africa/Addis_Ababa')::date;future_day date;past_day date;
  current_round bigint;fixture_key text;configuration text;feature_day date;selected_at timestamptz:=now()-interval '2 hours';
begin
  insert into public.organizations(id,name,handle,type,content_hidden)
    values(org,'Synthetic bootstrap fixture','bootstrap-'||org,'TRANSPORT_COMPANY',true);
  select coalesce(max(round_number),1)+1 into current_round from public.featured_rotation_selections;
  select greatest(today+40000,coalesce(max(feature_date)+14,today+40000)) into future_day from public.featured_provider_days;
  past_day:=today-30;
  while exists(select 1 from public.featured_provider_days where feature_date=past_day) loop past_day:=past_day-1;end loop;
  foreach fixture_key in array array['legacy_current','legacy_duplicate','future_published','future_draft','past_only','older_round_only','unknown_theme'] loop
    actor:=gen_random_uuid();truck:=gen_random_uuid();
    configuration:=case fixture_key when 'future_published' then 'Mini Box Truck' when 'future_draft' then 'Pickup truck'
      when 'legacy_duplicate' then 'Medium Box Truck' when 'past_only' then 'Light Box Truck'
      when 'older_round_only' then 'Heavy Rigid Stake Body Truck' when 'unknown_theme' then null else 'Cargo van' end;
    insert into auth.users(id,email,raw_user_meta_data)
      values(actor,'bootstrap-'||actor||'@example.test','{"full_name":"Synthetic bootstrap driver"}');
    update public.profiles set role='DRIVER',active=false where id=actor;
    insert into public.vehicles(id,organization_id,label,category,cargo_configuration,active)
      values(truck,org,'Synthetic bootstrap truck','BOX',configuration,false);
    insert into featured_bootstrap_cases(case_key,vehicle_id,driver_user_id,primary_theme_key)
      values(fixture_key,truck,actor,public.featured_truck_primary_theme(configuration));
    if fixture_key in ('legacy_current','legacy_duplicate','older_round_only') then
      legacy_day:=gen_random_uuid();
      insert into public.featured_rotation_selections(round_number,vehicle_id,driver_user_id,first_feature_date,featured_day_id,selected_at)
        values(case when fixture_key='older_round_only' then current_round-1 else current_round end,truck,actor,today-10,legacy_day,selected_at);
      if fixture_key<>'older_round_only' then
        update featured_bootstrap_cases set expected_origin='LEGACY',expected_date=today-10,
          expected_day_id=legacy_day,expected_selected_at=selected_at where featured_bootstrap_cases.case_key=fixture_key;
      end if;
    end if;
    if fixture_key in ('legacy_duplicate','future_published','future_draft','past_only','unknown_theme') then
      feature_day:=case when fixture_key='past_only' then past_day else future_day end;
      future_day:=future_day+1;day_id:=gen_random_uuid();
      insert into public.featured_provider_days(id,feature_date,base_place_ref,base_place_label,expo_group_key,expo_group_label,
        expo_region_codes,broadcast_start_time,broadcast_end_time,schedule_mode,schedule_config_json,manual_schedule_json,
        target_count,status,selection_source,published_at,created_at)
        values(day_id,feature_day,'featured:bootstrap','Synthetic bootstrap','bootstrap','Synthetic bootstrap','[]',
          '08:30','12:00','AUTO','{"targetCount":1}','[]',1,
          case when fixture_key='future_published' then 'PUBLISHED' else 'DRAFT' end,'MANUAL',
          case when fixture_key='future_published' then selected_at else null end,selected_at);
      insert into public.featured_provider_slots(day_id,slot_position,provider_organization_id,vehicle_id,driver_user_id)
        values(day_id,1,org,truck,actor);
      if fixture_key in ('future_published','future_draft') then
        update featured_bootstrap_cases set expected_origin='RESERVED',expected_date=feature_day,
          expected_day_id=day_id,expected_selected_at=selected_at where featured_bootstrap_cases.case_key=fixture_key;
      end if;
    end if;
  end loop;
end $fixtures$;
insert into featured_bootstrap_snapshot select pg_temp.featured_bootstrap_source_digest();

-- Give the unchanged seed the same empty destination it has at installation.
-- The installed ledger and all source rows remain intact and are restored by rollback.
alter table public.featured_theme_rotation_selections rename to featured_theme_rotation_bootstrap_original;
create table public.featured_theme_rotation_selections(like public.featured_theme_rotation_bootstrap_original including all);
alter table public.featured_theme_rotation_selections enable row level security;
revoke all on public.featured_theme_rotation_selections from public,anon,authenticated,service_role;
grant select on public.featured_theme_rotation_selections to service_role;

-- ACTUAL_MIGRATION_137_SEED_BLOCK

do $assertions$
declare fixture record;seeded public.featured_theme_rotation_selections%rowtype;
begin
  for fixture in select * from featured_bootstrap_cases order by case_key loop
    select * into seeded from public.featured_theme_rotation_selections
      where vehicle_id=fixture.vehicle_id and driver_user_id=fixture.driver_user_id;
    if fixture.expected_origin is null then
      if found then raise exception 'OLDER_PAST_OR_UNKNOWN_TURN_BOOTSTRAPPED';end if;
    else
      if not found then
        if fixture.expected_origin='LEGACY' then raise exception 'LEGACY_TURNS_NOT_BOOTSTRAPPED';
        else raise exception 'FUTURE_RESERVATIONS_NOT_BOOTSTRAPPED';end if;
      end if;
      if seeded.round_number<>1 or seeded.primary_theme_key is distinct from fixture.primary_theme_key
        or seeded.origin is distinct from fixture.expected_origin or seeded.first_feature_date is distinct from fixture.expected_date
        or seeded.featured_day_id is distinct from fixture.expected_day_id or seeded.selected_at is distinct from fixture.expected_selected_at
        then raise exception 'BOOTSTRAP_PAIR_SNAPSHOT_CHANGED';end if;
      if (select count(*) from public.featured_theme_rotation_selections where vehicle_id=fixture.vehicle_id and driver_user_id=fixture.driver_user_id)<>1
        then raise exception 'BOOTSTRAP_DUPLICATE_PAIR';end if;
    end if;
  end loop;
  if pg_temp.featured_bootstrap_source_digest() is distinct from (select source_digest from featured_bootstrap_snapshot)
    then raise exception 'BOOTSTRAP_SOURCE_HISTORY_OR_ROSTER_CHANGED';end if;
  raise notice 'PASS: exact seed preserves current legacy, published/draft reservations, hidden/inactive history, earliest duplicates and source snapshots';
end $assertions$;
rollback;
