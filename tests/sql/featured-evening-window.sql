-- FEAT-FTR-001: direct command validation is authoritative, rollback-only.
begin;
create function pg_temp.expect_evening_error(statement text,expected text) returns void
language plpgsql as $$
begin
 begin execute statement;
 exception when others then if sqlerrm=expected then return;end if;raise;end;
 raise exception 'EXPECTED_EVENING_ERROR: %',expected;
end $$;
do $test$
declare admin_id uuid;other_id uuid;command jsonb;bad jsonb;before_days text;after_days text;
begin
 select id into strict admin_id from public.profiles where role='ADMIN' and active limit 1;
 select id into strict other_id from public.profiles where role='DRIVER' and active limit 1;
 command:='{"feature_date":"2198-11-20","theme_key":"evening-test","theme_label":"Evening test","theme_configurations":["Pickup truck"],"target_count":2,"truck_keys":["one","two"],"schedule_mode":"MANUAL","schedule_config":{"dayStart":"22:30","dayEnd":"23:59","targetCount":2,"sponsorBreakCount":4,"sponsorBreakMinutes":2},"manual_schedule":[{"providerKey":"one","startTime":"22:30","endTime":"22:40"},{"providerKey":"two","startTime":"22:40","endTime":"23:59"}]}';
 perform public.validate_featured_broadcast_command(command);
 select md5(coalesce(jsonb_agg(to_jsonb(d) order by d.id)::text,'[]')) into before_days from public.featured_provider_days d;
 bad:=jsonb_set(jsonb_set(command,'{manual_schedule,0,endTime}','"22:39"'),'{manual_schedule,1,startTime}','"22:39"');
 perform pg_temp.expect_evening_error(format('select public.validate_featured_broadcast_command(%L)',bad),'FEATURED_MANUAL_SCHEDULE_TOO_SHORT');
 perform pg_temp.expect_evening_error(format('select public.save_managed_featured_truck_day(%L,%L)',admin_id,bad),'FEATURED_MANUAL_SCHEDULE_TOO_SHORT');
 perform pg_temp.expect_evening_error(format('select public.save_managed_featured_truck_day(%L,%L)',other_id,bad),'FORBIDDEN');
 bad:=jsonb_set(command,'{manual_schedule,0,startTime}','"22:29"');
 perform pg_temp.expect_evening_error(format('select public.validate_featured_broadcast_command(%L)',bad),'FEATURED_MANUAL_SCHEDULE_OUTSIDE_SESSION');
 bad:=jsonb_set(command,'{manual_schedule,1,endTime}','"24:00"');
 perform pg_temp.expect_evening_error(format('select public.validate_featured_broadcast_command(%L)',bad),'FEATURED_MANUAL_SCHEDULE_INVALID');
 bad:=jsonb_set(command,'{manual_schedule,1,endTime}','"00:00"');
 perform pg_temp.expect_evening_error(format('select public.validate_featured_broadcast_command(%L)',bad),'FEATURED_MANUAL_SCHEDULE_INVALID');
 bad:=jsonb_set(command,'{manual_schedule,1,startTime}','"22:39"');
 perform pg_temp.expect_evening_error(format('select public.validate_featured_broadcast_command(%L)',bad),'FEATURED_MANUAL_SCHEDULE_OVERLAP');
 bad:=jsonb_set(command,'{schedule_config,dayStart}','"08:30"');
 perform pg_temp.expect_evening_error(format('select public.validate_featured_broadcast_command(%L)',bad),'FEATURED_SCHEDULE_WINDOW_INVALID');
 bad:=jsonb_set(command,'{truck_keys}','["1","2","3","4","5","6","7","8","9"]');
 perform pg_temp.expect_evening_error(format('select public.save_managed_featured_truck_day(%L,%L)',admin_id,bad),'FEATURED_TARGET_COUNT_INVALID');
 bad:=jsonb_set(command,'{schedule_config,sponsorBreakCount}','5');
 perform pg_temp.expect_evening_error(format('select public.validate_featured_broadcast_command(%L)',bad),'FEATURED_SPONSOR_BREAK_COUNT_INVALID');
 bad:=jsonb_set(command,'{schedule_config,sponsorBreakMinutes}','3');
 perform pg_temp.expect_evening_error(format('select public.validate_featured_broadcast_command(%L)',bad),'FEATURED_SPONSOR_BREAK_DURATION_INVALID');
 select md5(coalesce(jsonb_agg(to_jsonb(d) order by d.id)::text,'[]')) into after_days from public.featured_provider_days d;
 if after_days is distinct from before_days then raise exception 'INVALID_EVENING_COMMAND_CHANGED_SAVED_DAYS';end if;
 if has_function_privilege('anon','public.validate_featured_broadcast_command(jsonb)','EXECUTE')
  or has_function_privilege('authenticated','public.validate_featured_broadcast_command(jsonb)','EXECUTE')
  then raise exception 'EVENING_VALIDATOR_EXPOSED';end if;
 raise notice 'Evening bounds, ten-minute turns, sponsor limits, no partial writes and authority passed';
end $test$;
rollback;
