-- FEAT-FTR-001: migration 137 primary-type policy; every fixture change rolls back.
-- The separate featured-continuous-rounds.sql suite advances four real weeks.
begin;
do $test$
declare configs text[];today date:=(now() at time zone 'Africa/Addis_Ababa')::date;
  result jsonb;snapshot jsonb;after_retry jsonb;round_value bigint;eligible_count integer;
  loops integer:=0;first_pair record;history_count integer;admin_id uuid;manual_id uuid;
  first_draw text[];second_draw text[];
  org uuid:=gen_random_uuid();owner_id uuid:=gen_random_uuid();driver_id uuid;truck_id uuid;qualifier uuid;source_id uuid;
  theme jsonb;test_configuration text;
begin
  -- A named synthetic fleet keeps this fairness regression independent of
  -- copied/seeded providers that may correctly be unqualified under146.
  select id into strict admin_id from public.profiles where active and role='ADMIN'limit 1;
  insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data)
    values(owner_id,'random-owner-'||owner_id||'@example.test',now(),'{"full_name":"Synthetic random Featured owner"}');
  update public.profiles set role='TRANSPORTER',active=true where id=owner_id;
  insert into public.organizations(id,name,handle,type,city,city_place_ref,public_visibility)
    values(org,'Synthetic random Featured fleet','random-featured-'||org,'TRANSPORT_COMPANY','Addis Ababa',
      (select id from public.place_catalog where normalized_name='addis ababa'limit 1),'PUBLIC');
  insert into public.organization_members(user_id,organization_id,membership_role)values(owner_id,org,'OWNER');
  insert into public.company_pages(organization_id,published,base_region_code,contact_phone,show_contact_phone)
    values(org,true,'ADDIS_ABABA','+251900000138',true);
  perform public.accept_content_policy(owner_id,'2026-10-09');
  for day_offset in 0..5 loop
    theme:=public.featured_truck_theme('2026-10-12'::date+day_offset);test_configuration:=theme->'configurations'->>0;
    for ordinal_value in 1..15 loop
      driver_id:=gen_random_uuid();truck_id:=gen_random_uuid();
      insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data)
        values(driver_id,'random-driver-'||driver_id||'@example.test',now(),'{"full_name":"Synthetic random Featured driver"}');
      update public.profiles set role='DRIVER',active=true where id=driver_id;
      insert into public.drivers(organization_id,user_id,name,active)values(org,driver_id,'Synthetic random Featured driver',true);
      insert into public.organization_members(organization_id,user_id,membership_role)values(org,driver_id,'DRIVER');
      insert into public.vehicles(id,organization_id,label,category,cargo_configuration,use_basis,active)
        values(truck_id,org,'Synthetic random Featured truck','BOX',test_configuration,'OWNED',true);
      insert into public.driver_vehicle_assignments(driver_user_id,vehicle_id,active)values(driver_id,truck_id,true);
      if qualifier is null then qualifier:=truck_id;end if;
    end loop;
  end loop;
  source_id:=public.submit_managed_verification(owner_id,jsonb_build_object('subject_type','VEHICLE','subject_id',qualifier,
    'verification_type','VEHICLE_OWNERSHIP','document_name','Fictional rollback random Featured title',
    'storage_path','supabase://verification/verification/fictional-random-featured-title.pdf','original_name','fixture.pdf','mime_type','application/pdf'));
  perform public.review_managed_verification(admin_id,source_id,'APPROVED','Fictional isolated fixture; no real ownership asserted.');
  perform public.confirm_provider_vehicle_authority(admin_id,source_id,jsonb_build_object('fact_kind','OWNERSHIP',
    'review_note','Fictional isolated fixture; matched this synthetic provider.',
    'context_revision',public.managed_provider_authority_review_context(admin_id,array[source_id])->0->>'contextRevision'));
  for truck_id in select id from public.vehicles where organization_id=org loop
    perform public.set_provider_vehicle_publication(owner_id,truck_id,'LIVE');
  end loop;
  select array_agg(distinct configuration) into configs from generate_series(0,6) day_offset
    cross join lateral jsonb_array_elements_text(public.featured_truck_theme(today+day_offset)->'configurations') configuration;
  select count(*) into eligible_count from public.featured_eligible_truck_links(configs);
  if eligible_count<13 then raise exception 'FEATURED_ROTATION_FIXTURE_TOO_SMALL';end if;
  delete from public.featured_provider_days where feature_date between today and today+6;
  delete from public.featured_theme_rotation_selections;
  update public.platform_controls set featured_mode='AUTO',featured_target_count=8 where singleton;

  perform setseed(0.125);
  result:=public.generate_managed_featured_days();
  if (result->>'created')::int<1 then raise exception 'NO_RANDOM_ROSTER';end if;
  if exists(select 1 from public.featured_provider_days d where d.feature_date between today and today+6
    and (d.target_count>8 or d.target_count<>(select count(*) from public.featured_provider_slots s where s.day_id=d.id)
    or (d.schedule_config_json->>'targetCount')::int<>d.target_count)) then raise exception 'ROSTER_COUNT_NOT_ACTUAL';end if;
  if exists(select 1 from public.featured_provider_days where selection_source='AUTO' and feature_date between today and today+6 and (broadcast_start_time<>'08:30' or broadcast_end_time<>'12:00' or schedule_config_json->>'sponsorBreakCount'<>'4' or schedule_config_json->>'sponsorBreakMinutes'<>'2')) then raise exception 'AUTOMATIC_BROADCAST_WINDOW';end if;
  if exists(select day_id from public.featured_provider_slots group by day_id having count(*)<>count(distinct driver_user_id)) then raise exception 'DUPLICATE_DAILY_DRIVER';end if;
  select array_agg(s.vehicle_id::text||':'||s.driver_user_id::text order by d.feature_date,s.slot_position) into first_draw
    from public.featured_provider_slots s join public.featured_provider_days d on d.id=s.day_id where d.feature_date between today and today+6;
  delete from public.featured_provider_days where feature_date between today and today+6;
  delete from public.featured_theme_rotation_selections;
  perform setseed(0.75);perform public.generate_managed_featured_days();
  select array_agg(s.vehicle_id::text||':'||s.driver_user_id::text order by d.feature_date,s.slot_position) into second_draw
    from public.featured_provider_slots s join public.featured_provider_days d on d.id=s.day_id where d.feature_date between today and today+6;
  if first_draw is not distinct from second_draw then raise exception 'DRAW_NOT_RANDOMIZED';end if;
  select jsonb_agg(to_jsonb(s) order by s.id) into snapshot from public.featured_provider_slots s;
  perform public.generate_managed_featured_days();
  select jsonb_agg(to_jsonb(s) order by s.id) into after_retry from public.featured_provider_slots s;
  if snapshot is distinct from after_retry then raise exception 'RETRY_RESHUFFLED';end if;

  -- Removing/curating a roster must not erase an already selected pair's turn.
  select count(*) into history_count from public.featured_theme_rotation_selections;
  -- Deactivating this pair must not revoke its fleet's sole qualification.
  select h.* into strict first_pair from public.featured_theme_rotation_selections h
    where not(public.provider_vehicle_authority_state(h.vehicle_id)->>'qualifiesProvider')::boolean
    order by h.first_feature_date,h.vehicle_id limit 1;
  delete from public.featured_provider_days where feature_date between today and today+6;
  if (select count(*) from public.featured_theme_rotation_selections)<>history_count then raise exception 'HISTORY_LOST';end if;

  -- Retry subsets in a rollback; the separate continuous-round suite advances real dates.
  loop
    perform public.generate_managed_featured_days();loops:=loops+1;
    select max(round_number) into round_value from public.featured_theme_rotation_selections;
    if round_value>1 then exit;end if;
    if loops>eligible_count then raise exception 'ROUND_NEVER_FINISHED';end if;
    delete from public.featured_provider_days where feature_date between today and today+6;
  end loop;
  if exists(select 1 from public.featured_eligible_truck_links(configs) e where exists(select 1 from public.featured_theme_rotation_selections restarted join public.vehicles v on v.id=e.vehicle_id
      where restarted.primary_theme_key=public.featured_truck_primary_theme(v.cargo_configuration) and restarted.round_number>1)
    and not exists(
    select 1 from public.featured_theme_rotation_selections h where h.round_number=1 and h.vehicle_id=e.vehicle_id and h.driver_user_id=e.driver_user_id
  )) then raise exception 'NEW_THEME_ROUND_BEFORE_EVERYONE_SELECTED';end if;
  if exists(select primary_theme_key,round_number,vehicle_id,driver_user_id from public.featured_theme_rotation_selections group by 1,2,3,4 having count(*)>1) then raise exception 'PAIR_REPEATED_WITHIN_ROUND';end if;

  -- A truck's historical pairing with another Driver cannot exclude its current pair.
  delete from public.featured_provider_days where feature_date between today and today+6;
  delete from public.featured_theme_rotation_selections;
  insert into public.featured_theme_rotation_selections(primary_theme_key,round_number,vehicle_id,driver_user_id,first_feature_date,featured_day_id)
    select public.featured_truck_primary_theme(v.cargo_configuration),1,e.vehicle_id,case when e.vehicle_id=first_pair.vehicle_id then gen_random_uuid() else e.driver_user_id end,today,gen_random_uuid()
    from public.featured_eligible_truck_links(configs) e join public.vehicles v on v.id=e.vehicle_id;
  perform public.generate_managed_featured_days();
  if not exists(select 1 from public.featured_theme_rotation_selections where round_number=1 and vehicle_id=first_pair.vehicle_id
    and driver_user_id=first_pair.driver_user_id) then raise exception 'CHANGED_PAIR_EXCLUDED';end if;

  -- An inactive pair cannot block completion; returning eligibility joins anew.
  delete from public.featured_provider_days where feature_date between today and today+6;
  delete from public.featured_theme_rotation_selections;
  insert into public.featured_theme_rotation_selections(primary_theme_key,round_number,vehicle_id,driver_user_id,first_feature_date,featured_day_id)
    select public.featured_truck_primary_theme(v.cargo_configuration),1,e.vehicle_id,e.driver_user_id,today,gen_random_uuid() from public.featured_eligible_truck_links(configs) e join public.vehicles v on v.id=e.vehicle_id
    where e.vehicle_id<>first_pair.vehicle_id;
  update public.vehicles set active=false where id=first_pair.vehicle_id;
  perform public.generate_managed_featured_days();
  if (select max(round_number) from public.featured_theme_rotation_selections)<2 then raise exception 'INACTIVE_PAIR_BLOCKED_ROUND';end if;
  update public.vehicles set active=true where id=first_pair.vehicle_id;
  if not exists(select 1 from public.featured_eligible_truck_links(configs) where vehicle_id=first_pair.vehicle_id) then raise exception 'RETURNING_PAIR_INELIGIBLE';end if;

  -- Saved manual days remain protected, including drafts; no read-side generation.
  select id into strict admin_id from public.profiles where active and role='ADMIN' limit 1;
  delete from public.featured_provider_days where feature_date=today;
  manual_id:=public.save_managed_featured_truck_day(admin_id,jsonb_build_object('feature_date',today,'target_count',3,
    'theme_key',public.featured_truck_theme(today)->>'key','theme_label',public.featured_truck_theme(today)->>'label',
    'theme_configurations',public.featured_truck_theme(today)->'configurations','truck_keys','[]'::jsonb,'publish',false,
    'schedule_config',jsonb_build_object('dayStart','08:30','dayEnd','12:00','targetCount',3,'sponsorBreakCount',4,'sponsorBreakMinutes',2)));
  perform public.generate_managed_featured_days();
  if not exists(select 1 from public.featured_provider_days where id=manual_id and status='DRAFT' and selection_source='MANUAL') then raise exception 'MANUAL_DAY_OVERWRITTEN';end if;

  if not (select relrowsecurity from pg_class where oid='public.featured_theme_rotation_selections'::regclass) then raise exception 'ROTATION_RLS_MISSING';end if;
  if has_table_privilege('anon','public.featured_theme_rotation_selections','SELECT,INSERT,UPDATE,DELETE')
    or has_table_privilege('authenticated','public.featured_theme_rotation_selections','SELECT,INSERT,UPDATE,DELETE')
    or has_function_privilege('authenticated','public.generate_managed_featured_days()','EXECUTE')
    or has_function_privilege('anon','public.generate_managed_featured_days()','EXECUTE') then raise exception 'ROTATION_BROWSER_ACCESS';end if;
  raise notice 'PASS: primary-type exact-pair rounds, exhaustion, actual count, retry stability, retained history, eligibility, manual preservation, RLS/ACL denial';
end $test$;
rollback;
