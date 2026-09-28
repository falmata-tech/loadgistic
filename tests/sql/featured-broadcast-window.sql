begin;
create function pg_temp.expect_broadcast_error(command text,expected text) returns void language plpgsql as $$
begin
 begin execute command;exception when others then if sqlerrm=expected then return;end if;raise;end;
 raise exception 'EXPECTED_BROADCAST_ERROR: %',expected;
end $$;
do $test$
declare admin_id uuid;command jsonb;bad jsonb;result jsonb;draft uuid;
begin
 select id into strict admin_id from public.profiles where role='ADMIN' and active limit 1;
 command:='{"feature_date":"2198-11-19","theme_key":"test","theme_label":"Broadcast test","theme_configurations":["Pickup truck"],"target_count":1,"truck_keys":[],"schedule_mode":"AUTO","schedule_config":{"dayStart":"08:30","dayEnd":"12:00","targetCount":1,"sponsorBreakCount":4,"sponsorBreakMinutes":2}}';
 if exists(select 1 from public.featured_provider_days where feature_date='2198-11-19') then raise exception 'TEST_DATE_OCCUPIED';end if;
 draft:=public.save_managed_featured_truck_day(admin_id,command);
 if not exists(select 1 from public.featured_provider_days where id=draft and broadcast_start_time='08:30' and broadcast_end_time='12:00' and status='DRAFT' and selection_source='MANUAL') then raise exception 'NEW_DAY_WINDOW_NOT_SAVED';end if;
 bad:=jsonb_set(command,'{schedule_config,dayStart}','"07:30"');
 perform pg_temp.expect_broadcast_error(format('select public.save_managed_featured_truck_day(%L,%L)',admin_id,bad),'FEATURED_SCHEDULE_WINDOW_INVALID');
 bad:=jsonb_set(command,'{schedule_config,sponsorBreakCount}','5');
 perform pg_temp.expect_broadcast_error(format('select public.save_managed_featured_truck_day(%L,%L)',admin_id,bad),'FEATURED_SPONSOR_BREAK_COUNT_INVALID');
 bad:=jsonb_set(command,'{schedule_config,sponsorBreakMinutes}','3');
 perform pg_temp.expect_broadcast_error(format('select public.save_managed_featured_truck_day(%L,%L)',admin_id,bad),'FEATURED_SPONSOR_BREAK_DURATION_INVALID');
 perform pg_temp.expect_broadcast_error(format('select public.save_managed_featured_controls(%L,''{"section":"FEATURED","mode":"AUTO","target_count":9}''::jsonb)',admin_id),'INVALID_PLATFORM_CONTROLS');
 perform pg_temp.expect_broadcast_error(format('select public.save_managed_platform_controls(%L,''{"section":"FEATURED","mode":"AUTO","target_count":9}''::jsonb)',admin_id),'INVALID_PLATFORM_CONTROLS');
 command:=command||'{"truck_keys":["one"],"schedule_mode":"MANUAL","manual_schedule":[{"providerKey":"one","startTime":"08:32","endTime":"11:58"}]}';
 perform public.validate_featured_broadcast_command(command);
 bad:=jsonb_set(command,'{manual_schedule,0,endTime}','"11:57"');
 perform pg_temp.expect_broadcast_error(format('select public.validate_featured_broadcast_command(%L)',bad),'FEATURED_MANUAL_BREAK_INVALID');
 bad:=jsonb_set(bad,'{schedule_mode}','"manual"');
 perform pg_temp.expect_broadcast_error(format('select public.validate_featured_broadcast_command(%L)',bad),'FEATURED_MANUAL_BREAK_INVALID');
 bad:=jsonb_set(command,'{manual_schedule,0,startTime}','"08:33"');
 perform pg_temp.expect_broadcast_error(format('select public.validate_featured_broadcast_command(%L)',bad),'FEATURED_MANUAL_BREAK_INVALID');
 bad:=jsonb_set(command,'{manual_schedule,0,startTime}','"08:29"');
 perform pg_temp.expect_broadcast_error(format('select public.validate_featured_broadcast_command(%L)',bad),'FEATURED_MANUAL_SCHEDULE_OUTSIDE_SESSION');
 bad:=jsonb_set(command,'{manual_schedule,0,providerKey}','"other"');
 perform pg_temp.expect_broadcast_error(format('select public.validate_featured_broadcast_command(%L)',bad),'FEATURED_MANUAL_SCHEDULE_INVALID');
 if has_function_privilege('anon','public.validate_featured_broadcast_command(jsonb)','EXECUTE') or has_function_privilege('authenticated','public.validate_featured_broadcast_command(jsonb)','EXECUTE') then raise exception 'BROWSER_FUNCTION_EXPOSED';end if;
 raise notice 'Broadcast window, limits, draft persistence, manual gaps and role boundaries passed';
end $test$;
rollback;
