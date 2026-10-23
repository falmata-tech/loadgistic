begin;
create function pg_temp.expect_featured_broadcast_denied(command text,expected text) returns void language plpgsql as $$
begin
  begin execute command; exception when others then if sqlerrm=expected then return; end if; raise; end;
  raise exception 'EXPECTED_FEATURED_BROADCAST_DENIAL: %',expected;
end $$;

do $test$
declare admin_id uuid;staff_id uuid:=gen_random_uuid();other_id uuid:=gen_random_uuid();date_value date;checked_date date;place_ref text;day_id uuid;result jsonb;started timestamptz;
begin
  select id into strict admin_id from public.profiles where active and role='ADMIN' limit 1;
  select id into strict place_ref from public.place_catalog limit 1;
  foreach checked_date in array array[current_date+40,current_date+50,current_date+60,current_date+70] loop
    if not exists(select 1 from public.featured_provider_days where feature_date in (checked_date,checked_date+1)) then
      date_value:=checked_date;
      exit;
    end if;
  end loop;
  if date_value is null then raise exception 'FEATURED_BROADCAST_TEST_DATE_ALREADY_USED'; end if;
  foreach other_id in array array[staff_id,other_id] loop
    insert into auth.users(id,email) values(other_id,other_id::text||'@example.test');
    perform public.create_managed_support_agent(admin_id,other_id,jsonb_build_object(
      'name','Synthetic TikTok review staff','email',other_id::text||'@example.test',
      'max_open_conversations',3,'can_manage_support',false,'can_manage_featured',other_id=staff_id));
  end loop;

  insert into public.featured_provider_days(feature_date,base_place_ref,base_place_label,expo_group_key,expo_group_label,
    expo_region_codes,public_headline,public_introduction,tiktok_url,status,created_by,published_by,published_at)
  values(date_value,place_ref,'Synthetic featured day','test','Synthetic featured day','[]'::jsonb,
    'Synthetic feature','Synthetic TikTok broadcast-state fixture.','https://www.tiktok.com/@loadgistic/live',
    'PUBLISHED',admin_id,admin_id,clock_timestamp()) returning id into day_id;

  if (select tiktok_broadcast_status from public.featured_provider_days where id=day_id)<>'SCHEDULED' then
    raise exception 'PUBLISHED_TIKTOK_LINK_NOT_SCHEDULED';
  end if;
  perform pg_temp.expect_featured_broadcast_denied(
    format('select public.set_managed_featured_tiktok_broadcast(%L,%L,''ENDED'')',staff_id,date_value),'FEATURED_BROADCAST_NOT_LIVE');
  result:=public.set_managed_featured_tiktok_broadcast(staff_id,date_value,'LIVE');
  if result->>'status'<>'LIVE' then raise exception 'STAFF_LIVE_COMMAND_FAILED'; end if;
  select tiktok_broadcast_started_at into started from public.featured_provider_days where id=day_id;
  if started is null or started>clock_timestamp() then raise exception 'LIVE_START_NOT_RECORDED'; end if;
  result:=public.set_managed_featured_tiktok_broadcast(staff_id,date_value,'LIVE');
  if (select tiktok_broadcast_started_at from public.featured_provider_days where id=day_id) is distinct from started then
    raise exception 'REPEATED_LIVE_COMMAND_RESET_START_TIME';
  end if;
  perform pg_temp.expect_featured_broadcast_denied(
    format('select public.set_managed_featured_tiktok_broadcast(%L,%L,''ENDED'')',other_id,date_value),'FORBIDDEN');
  perform pg_temp.expect_featured_broadcast_denied(
    format('select public.set_managed_featured_tiktok_broadcast(null,%L,''ENDED'')',date_value),'FORBIDDEN');

  perform public.set_managed_featured_tiktok_broadcast(staff_id,date_value,'ENDED');
  if (select tiktok_broadcast_status from public.featured_provider_days where id=day_id)<>'ENDED'
    or (select tiktok_broadcast_started_at from public.featured_provider_days where id=day_id) is distinct from started then
    raise exception 'END_LIVE_STATE_OR_HISTORY_FAILED';
  end if;
  perform pg_temp.expect_featured_broadcast_denied(
    format('select public.set_managed_featured_tiktok_broadcast(%L,%L,''LIVE'')',staff_id,date_value),'FEATURED_BROADCAST_ALREADY_ENDED');

  update public.featured_provider_days set tiktok_url=null where id=day_id;
  if (select tiktok_broadcast_status from public.featured_provider_days where id=day_id)<>'NOT_SCHEDULED'
    or (select tiktok_broadcast_started_at from public.featured_provider_days where id=day_id) is not null then
    raise exception 'REMOVED_TIKTOK_LINK_LEFT_STALE_STATE';
  end if;
  perform pg_temp.expect_featured_broadcast_denied(
    format('select public.set_managed_featured_tiktok_broadcast(%L,%L,''LIVE'')',staff_id,date_value),'FEATURED_TIKTOK_REQUIRED');

  insert into public.featured_provider_days(feature_date,base_place_ref,base_place_label,expo_group_key,expo_group_label,
    expo_region_codes,tiktok_url,status,created_by)
  values(date_value+1,place_ref,'Synthetic draft day','test','Synthetic draft day','[]'::jsonb,
    'https://www.tiktok.com/@loadgistic/live','DRAFT',admin_id);
  perform pg_temp.expect_featured_broadcast_denied(
    format('select public.set_managed_featured_tiktok_broadcast(%L,%L,''LIVE'')',staff_id,date_value+1),'FEATURED_DAY_NOT_PUBLISHED');
  perform pg_temp.expect_featured_broadcast_denied(
    format('select public.set_managed_featured_tiktok_broadcast(%L,%L,''UNKNOWN'')',staff_id,date_value),'FEATURED_BROADCAST_STATE_INVALID');

  if has_function_privilege('anon','public.set_managed_featured_tiktok_broadcast(uuid,date,text)','execute')
    or has_function_privilege('authenticated','public.set_managed_featured_tiktok_broadcast(uuid,date,text)','execute') then
    raise exception 'BROWSER_CAN_CALL_TIKTOK_ADMIN_FUNCTION';
  end if;
  if not exists(select 1 from public.audit_logs where entity_id=day_id and action='FEATURED_TIKTOK_BROADCAST_UPDATED') then
    raise exception 'LIVE_STATE_AUDIT_MISSING';
  end if;
  raise notice 'TikTok scheduled/live/ended state, permission denials, link removal and audit passed';
end $test$;
rollback;
