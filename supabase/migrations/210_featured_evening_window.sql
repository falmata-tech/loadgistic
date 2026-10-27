-- FEAT-FTR-001: same-date 22:30–23:59 EAT; preserve account selections/history.
begin;
select pg_advisory_xact_lock(8030180);
lock table public.featured_provider_days,public.featured_provider_slots in share row exclusive mode;

create or replace function public.validate_featured_broadcast_command(command jsonb) returns void
language plpgsql set search_path=public,pg_temp as $$
declare config jsonb:=command->'schedule_config';slots jsonb:=coalesce(command->'manual_schedule','[]'::jsonb);
 keys jsonb:=coalesce(command->'truck_keys','[]'::jsonb);item jsonb;idx integer:=0;
 start_min integer;end_min integer;cursor_min integer:=1350;breaks integer:=0;gap integer;
begin
 if config is null or jsonb_typeof(config)<>'object' or config->>'dayStart' is distinct from '22:30'
   or config->>'dayEnd' is distinct from '23:59' then raise exception 'FEATURED_SCHEDULE_WINDOW_INVALID';end if;
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
   if start_min<1350 or end_min>1439 then raise exception 'FEATURED_MANUAL_SCHEDULE_OUTSIDE_SESSION';end if;
   if end_min-start_min<10 then raise exception 'FEATURED_MANUAL_SCHEDULE_TOO_SHORT';end if;
   if start_min<cursor_min then raise exception 'FEATURED_MANUAL_SCHEDULE_OVERLAP';end if;
   gap:=start_min-cursor_min;if gap>0 then breaks:=breaks+1;end if;
   if gap>2 or breaks>4 then raise exception 'FEATURED_MANUAL_BREAK_INVALID';end if;
   cursor_min:=end_min;
  end loop;
  if jsonb_array_length(keys)>0 then
   gap:=1439-cursor_min;if gap>0 then breaks:=breaks+1;end if;
   if gap>2 or breaks>4 then raise exception 'FEATURED_MANUAL_BREAK_INVALID';end if;
  end if;
 end if;
end $$;
revoke all on function public.validate_featured_broadcast_command(jsonb) from public,anon,authenticated;
grant execute on function public.validate_featured_broadcast_command(jsonb) to service_role;

-- A curated timetable is not converted or redrawn by a timing migration.
do $review$
declare saved public.featured_provider_days%rowtype;keys jsonb;prepared jsonb;
begin
 for saved in select * from public.featured_provider_days
  where feature_date>=(now() at time zone 'Africa/Addis_Ababa')::date
  order by feature_date,id
 loop
  select coalesce(jsonb_agg('vehicle:'||s.vehicle_id::text order by s.slot_position),'[]'::jsonb)
   into keys from public.featured_provider_slots s where s.day_id=saved.id;
  prepared:=jsonb_build_object('target_count',saved.target_count,'truck_keys',keys,
   'schedule_mode',saved.schedule_mode,'manual_schedule',saved.manual_schedule_json,
   'schedule_config',case when saved.schedule_mode='AUTO'
    then saved.schedule_config_json||jsonb_build_object('dayStart','22:30','dayEnd','23:59')
    else saved.schedule_config_json end);
  begin
   if saved.schedule_mode='MANUAL' and (saved.broadcast_start_time<>'22:30'::time or saved.broadcast_end_time<>'23:59'::time)
    then raise exception 'FEATURED_SCHEDULE_WINDOW_INVALID';end if;
   perform public.validate_featured_broadcast_command(prepared);
  exception when others then
   if saved.schedule_mode='MANUAL' then
    raise exception 'FEATURED_FUTURE_MANUAL_REQUIRES_REVIEW: % / %',saved.feature_date,saved.id using detail=sqlerrm;
   else
    raise exception 'FEATURED_FUTURE_AUTO_REQUIRES_REVIEW: % / %',saved.feature_date,saved.id using detail=sqlerrm;
   end if;
  end;
 end loop;
end $review$;

-- Assert the final live 205 writer/generator fragments. Do not revive or rewrite
-- the revoked historical global generator retained by 137 for rollback.
do $patch$
declare definition text;before_text text;after_text text;signature text;
begin
 for signature,before_text,after_text in select * from (values
  ('public.save_managed_featured_truck_day(uuid,jsonb)',
   '''08:30''::time,''12:00''::time','''22:30''::time,''23:59''::time'),
  ('public.generate_managed_featured_days_for_date(date)',
   '''08:30'',''12:00'',''AUTO''','''22:30'',''23:59'',''AUTO'''),
  ('public.generate_managed_featured_days_for_date(date)',
   '''dayStart'',''08:30'',''dayEnd'',''12:00''','''dayStart'',''22:30'',''dayEnd'',''23:59''')
 ) patches(signature,before_text,after_text) loop
  definition:=pg_get_functiondef(signature::regprocedure);
  if strpos(definition,before_text)=0 or strpos(substr(definition,strpos(definition,before_text)+length(before_text)),before_text)>0 then
   raise exception 'FEATURED_EVENING_PATCH_PRECONDITION: %',signature;
  end if;
  execute replace(definition,before_text,after_text);
 end loop;
end $patch$;

alter table public.featured_provider_days
 alter column broadcast_start_time set default '22:30'::time,
 alter column broadcast_end_time set default '23:59'::time,
 alter column schedule_config_json set default '{"dayStart":"22:30","dayEnd":"23:59","targetCount":8,"sponsorBreakCount":4,"sponsorBreakMinutes":2}'::jsonb;

-- Only automatic timing fields change. Slot identities/order, sponsors, actual
-- TikTok state, publication state, manual choices and rotation ledgers stay put.
update public.featured_provider_days
 set broadcast_start_time='22:30',broadcast_end_time='23:59',
  schedule_config_json=schedule_config_json||jsonb_build_object('dayStart','22:30','dayEnd','23:59'),updated_at=now()
 where feature_date>=(now() at time zone 'Africa/Addis_Ababa')::date and schedule_mode='AUTO'
  and (broadcast_start_time<>'22:30'::time or broadcast_end_time<>'23:59'::time
   or schedule_config_json->>'dayStart' is distinct from '22:30'
   or schedule_config_json->>'dayEnd' is distinct from '23:59');
commit;
