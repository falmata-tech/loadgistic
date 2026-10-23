-- FEAT-FTR-001: 08:30–12:00 EAT, at most eight showcases and four short mentions.
-- Historical/manual days retain their saved timetable. No selection/history redraw.
create function public.validate_featured_broadcast_command(command jsonb) returns void
language plpgsql set search_path=public,pg_temp as $$
declare config jsonb:=command->'schedule_config';slots jsonb:=coalesce(command->'manual_schedule','[]'::jsonb);
 keys jsonb:=coalesce(command->'truck_keys','[]'::jsonb);item jsonb;idx integer:=0;
 start_min integer;end_min integer;cursor_min integer:=510;breaks integer:=0;gap integer;
begin
 if config is null or jsonb_typeof(config)<>'object' or config->>'dayStart' is distinct from '08:30'
   or config->>'dayEnd' is distinct from '12:00' then raise exception 'FEATURED_SCHEDULE_WINDOW_INVALID';end if;
 if coalesce(config->>'sponsorBreakCount','') !~ '^[0-4]$' then raise exception 'FEATURED_SPONSOR_BREAK_COUNT_INVALID';end if;
 if coalesce(config->>'sponsorBreakMinutes','') !~ '^[12]$' then raise exception 'FEATURED_SPONSOR_BREAK_DURATION_INVALID';end if;
 if coalesce(config->>'targetCount','') !~ '^[1-8]$' or config->>'targetCount' is distinct from command->>'target_count'
   or jsonb_typeof(keys)<>'array' or jsonb_array_length(keys)>8 then raise exception 'FEATURED_TARGET_COUNT_INVALID';end if;
 if upper(trim(coalesce(command->>'schedule_mode','AUTO')))='MANUAL' then
  if jsonb_typeof(slots)<>'array' or jsonb_array_length(slots)<>jsonb_array_length(keys)
    or (select count(distinct value->>'providerKey') from jsonb_array_elements(slots))<>jsonb_array_length(keys)
    then raise exception 'FEATURED_MANUAL_SCHEDULE_INCOMPLETE';end if;
  for idx in 0..jsonb_array_length(keys)-1 loop
   select value into item from jsonb_array_elements(slots) where value->>'providerKey'=keys->>idx;
   if item is null or coalesce(item->>'startTime','') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
     or coalesce(item->>'endTime','') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then raise exception 'FEATURED_MANUAL_SCHEDULE_INVALID';end if;
   start_min:=split_part(item->>'startTime',':',1)::integer*60+split_part(item->>'startTime',':',2)::integer;
   end_min:=split_part(item->>'endTime',':',1)::integer*60+split_part(item->>'endTime',':',2)::integer;
   if end_min<=start_min then raise exception 'FEATURED_MANUAL_SCHEDULE_INVALID';end if;
   if start_min<510 or end_min>720 then raise exception 'FEATURED_MANUAL_SCHEDULE_OUTSIDE_SESSION';end if;
   if start_min<cursor_min then raise exception 'FEATURED_MANUAL_SCHEDULE_OVERLAP';end if;
   gap:=start_min-cursor_min;if gap>0 then breaks:=breaks+1;end if;
   if gap>2 or breaks>4 then raise exception 'FEATURED_MANUAL_BREAK_INVALID';end if;
   cursor_min:=end_min;
  end loop;
  if jsonb_array_length(keys)>0 then
   gap:=720-cursor_min;if gap>0 then breaks:=breaks+1;end if;
   if gap>2 or breaks>4 then raise exception 'FEATURED_MANUAL_BREAK_INVALID';end if;
  end if;
 end if;
end $$;
revoke all on function public.validate_featured_broadcast_command(jsonb) from public,anon,authenticated;
grant execute on function public.validate_featured_broadcast_command(jsonb) to service_role;

-- Preserve later permission/locking fixes: patch only asserted current fragments.
do $patch$
declare definition text;before_text text;after_text text;signature text;
begin
 for signature,before_text,after_text in select * from (values
 ('public.save_managed_featured_controls(uuid,jsonb)','count_value not between 1 and 12','count_value not between 1 and 8'),
 ('public.save_managed_platform_controls(uuid,jsonb)','count_value not between 1 and 12','count_value not between 1 and 8'),
 ('public.save_managed_featured_truck_day(uuid,jsonb)','target_count_value not between 1 and 12','target_count_value is null or target_count_value not between 1 and 8'),
 ('public.save_managed_featured_truck_day(uuid,jsonb)','perform public.lock_featured_actor(actor_user_id);','perform public.lock_featured_actor(actor_user_id); perform public.validate_featured_broadcast_command(command);'),
 ('public.save_managed_featured_truck_day(uuid,jsonb)','''07:30''::time,''09:00''::time','''08:30''::time,''12:00''::time'),
 ('public.generate_managed_featured_days_core()','''07:30'',''09:00'',''AUTO'',jsonb_build_object(''dayStart'',''07:30'',''dayEnd'',''09:00'',''targetCount'',jsonb_array_length(chosen),''sponsorBreakEvery'',2,''sponsorBreakMinutes'',2)',
  '''08:30'',''12:00'',''AUTO'',jsonb_build_object(''dayStart'',''08:30'',''dayEnd'',''12:00'',''targetCount'',jsonb_array_length(chosen),''sponsorBreakCount'',4,''sponsorBreakMinutes'',2)')
 ) patches(signature,before_text,after_text) loop
  definition:=pg_get_functiondef(signature::regprocedure);
  if strpos(definition,before_text)=0 or strpos(substr(definition,strpos(definition,before_text)+length(before_text)),before_text)>0 then
   raise exception 'FEATURED_BROADCAST_PATCH_PRECONDITION: %',signature;
  end if;
  execute replace(definition,before_text,after_text);
 end loop;
end $patch$;

-- Serialize with selection and protect the exact saved rows from concurrent edits.
select pg_advisory_xact_lock(8030180);
lock table public.platform_controls,public.featured_provider_days,public.featured_provider_slots in share row exclusive mode;
do $$begin
 if exists(select 1 from public.featured_provider_days d where d.feature_date>(now() at time zone 'Africa/Addis_Ababa')::date
  and d.selection_source='AUTO' and d.schedule_mode='AUTO' and (d.target_count>8 or (select count(*) from public.featured_provider_slots s where s.day_id=d.id)>8))
 then raise exception 'FEATURED_FUTURE_ROSTER_REQUIRES_REVIEW';end if;
end $$;
update public.platform_controls set featured_target_count=least(featured_target_count,8) where singleton;
alter table public.platform_controls drop constraint platform_controls_featured_target_count_check,
 add constraint platform_controls_featured_target_count_check check(featured_target_count between 1 and 8);
update public.featured_provider_days set broadcast_start_time='08:30',broadcast_end_time='12:00',
 schedule_config_json=(schedule_config_json-'sponsorBreakEvery')||jsonb_build_object('dayStart','08:30','dayEnd','12:00','targetCount',target_count,'sponsorBreakCount',4,'sponsorBreakMinutes',2),updated_at=now()
 where feature_date>(now() at time zone 'Africa/Addis_Ababa')::date and selection_source='AUTO' and schedule_mode='AUTO';
