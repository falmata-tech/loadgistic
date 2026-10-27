-- FEAT-FTR-001: rollback-only eight-account save with authoritative rejection.
begin;
create temporary table featured_save_fixture(
  feature_date date not null,actor_id uuid not null,vehicle_ids uuid[] not null,
  command jsonb not null,saved_id uuid
) on commit drop;
create function pg_temp.expect_featured_save_rejected(actor uuid,command jsonb) returns void
language plpgsql as $$
begin
  begin
    perform public.save_managed_featured_provider_day(actor,command);
  exception when others then
    if sqlerrm='FEATURED_PROVIDER_INELIGIBLE' then return;end if;
    raise;
  end;
  raise exception 'EXPECTED_FEATURED_PROVIDER_INELIGIBLE';
end $$;

do $test$
declare chosen uuid[];actor uuid;day date:='2198-11-21';command jsonb;
  saved uuid;baseline_sponsors bigint;baseline_rounds bigint;after_sponsors bigint;after_rounds bigint;
  bad jsonb;target uuid;active_assignments integer;
begin
  if exists(select 1 from public.featured_provider_days where feature_date between day and day+2)
    then raise exception 'FEATURED_SAVE_TEST_DATE_OCCUPIED';end if;
  select id into strict actor from public.profiles where active and role='ADMIN' limit 1;
  select array_agg(vehicle_id order by provider_key) into chosen from (
    select provider_key,vehicle_id from public.featured_eligible_account_links()
    where public.capacity_public_policy_allows(vehicle_id)
    order by provider_key limit 8) eligible;
  if cardinality(chosen)<>8 then raise exception 'FEATURED_SAVE_TEST_NEEDS_EIGHT_ACCOUNTS';end if;
  command:=jsonb_build_object('feature_date',day,'target_count',8,'truck_keys',
    (select jsonb_agg('vehicle:'||vehicle_id::text order by ordinality)
      from unnest(chosen) with ordinality selected(vehicle_id,ordinality)),
    'public_headline','Eight-account evening review',
    'public_introduction','A distinct saved introduction for the evening programme.',
    'schedule_mode','AUTO','schedule_config',jsonb_build_object(
      'dayStart','22:30','dayEnd','23:59','targetCount',8,
      'sponsorBreakCount',4,'sponsorBreakMinutes',2),
    'manual_schedule','[]'::jsonb,'publish',false);
  insert into featured_save_fixture values(day,actor,chosen,command,null);
  select count(*) into baseline_sponsors from public.sponsor_placements;
  saved:=public.save_managed_featured_provider_day(actor,command);
  update featured_save_fixture set saved_id=saved;
  if not exists(select 1 from public.featured_provider_days where id=saved and status='DRAFT'
    and broadcast_start_time='22:30' and broadcast_end_time='23:59')
    or (select count(*) from public.featured_provider_slots where day_id=saved)<>8
    or exists(select 1 from public.featured_account_manual_selections where featured_day_id=saved)
    or exists(select 1 from public.featured_account_rotation_selections where featured_day_id=saved)
    then raise exception 'FEATURED_EIGHT_DRAFT_INVALID';end if;
  command:=jsonb_set(command,'{publish}','true'::jsonb);
  if public.save_managed_featured_provider_day(actor,command)<>saved
    then raise exception 'FEATURED_PUBLISH_CHANGED_DAY_ID';end if;
  if not exists(select 1 from public.featured_provider_days where id=saved and status='PUBLISHED'
    and broadcast_start_time='22:30' and broadcast_end_time='23:59')
    or (select jsonb_agg('vehicle:'||vehicle_id::text order by slot_position)
      from public.featured_provider_slots where day_id=saved)<>command->'truck_keys'
    or (select count(*) from public.featured_account_manual_selections where featured_day_id=saved)<>8
    or (select count(distinct provider_key) from public.featured_account_manual_selections where featured_day_id=saved)<>8
    then raise exception 'FEATURED_EIGHT_PUBLISH_INVALID';end if;
  select count(*) into baseline_rounds from public.featured_account_rotation_selections;
  target:=chosen[1];
  bad:=jsonb_set(command,'{feature_date}',to_jsonb(day+1));
  update public.vehicles set active=false where id=target;
  perform pg_temp.expect_featured_save_rejected(actor,bad);
  update public.vehicles set active=true where id=target;
  bad:=jsonb_set(command,'{feature_date}',to_jsonb(day+2));
  update public.driver_vehicle_assignments set active=false where vehicle_id=target and active;
  get diagnostics active_assignments=row_count;
  if active_assignments<1 then raise exception 'FEATURED_TEST_ASSIGNMENT_MISSING';end if;
  perform pg_temp.expect_featured_save_rejected(actor,bad);
  if exists(select 1 from public.featured_provider_days where feature_date in (day+1,day+2))
    or exists(select 1 from public.audit_logs where action in ('FEATURED_DAY_SAVED','FEATURED_DAY_PUBLISHED')
      and details->>'featureDate' in ((day+1)::text,(day+2)::text))
    or (select count(*) from public.featured_account_rotation_selections)<>baseline_rounds
    or (select jsonb_agg('vehicle:'||vehicle_id::text order by slot_position)
      from public.featured_provider_slots where day_id=saved)<>command->'truck_keys'
    or (select count(*) from public.featured_account_manual_selections where featured_day_id=saved)<>8
    then raise exception 'FEATURED_REJECTED_SAVE_CHANGED_STATE';end if;
  select count(*) into after_sponsors from public.sponsor_placements;
  select count(*) into after_rounds from public.featured_account_rotation_selections;
  if after_sponsors<>baseline_sponsors or after_rounds<>baseline_rounds
    or has_function_privilege('anon','public.save_managed_featured_provider_day(uuid,jsonb)','EXECUTE')
    or has_function_privilege('authenticated','public.save_managed_featured_provider_day(uuid,jsonb)','EXECUTE')
    or not has_function_privilege('service_role','public.save_managed_featured_provider_day(uuid,jsonb)','EXECUTE')
    then raise exception 'FEATURED_SAVE_AUTHORITY_OR_SPONSORS_CHANGED';end if;
  raise notice 'Eight-account draft/publish, order, evening window, revoked vehicle/assignment, audit/rotation/sponsor state and grants passed';
end $test$;
rollback;
