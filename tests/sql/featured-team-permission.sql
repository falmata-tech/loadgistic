begin;
create function pg_temp.expect_featured_denied(command text) returns void language plpgsql as $$
begin
 begin execute command;exception when others then if sqlerrm='FORBIDDEN' then return;end if;raise;end;
 raise exception 'EXPECTED_FEATURED_DENIAL';
end $$;
do $test$
declare admin_id uuid;staff_id uuid:=gen_random_uuid();other_id uuid:=gen_random_uuid();uid uuid;result jsonb;prior_access text;command jsonb;vehicle_id_value uuid;old_configuration text;new_configuration text;day_value date;
begin
 select id into strict admin_id from profiles where active and role='ADMIN' limit 1;
 foreach uid in array array[staff_id,other_id] loop
  insert into auth.users(id,email) values(uid,uid::text||'@example.test');
  perform create_managed_support_agent(admin_id,uid,jsonb_build_object('name','Synthetic Featured staff','email',uid::text||'@example.test','max_open_conversations',3,'can_manage_support',false,'can_manage_featured',uid=staff_id));
 end loop;
 if not can_manage_featured(staff_id) or can_manage_featured(other_id) then raise exception 'CAPABILITY_DEFAULT_OR_GRANT';end if;
 result:=managed_featured_controls(staff_id);
 if result ? 'access_mode' or result ? 'updated_by' then raise exception 'UNRELATED_SETTING_EXPOSED';end if;
 perform managed_featured_overview(staff_id);
 perform managed_admin_featured_day(staff_id,current_date,'review',array[]::text[]);
 select access_mode into prior_access from platform_controls where singleton;
 perform save_managed_featured_controls(staff_id,'{"section":"FEATURED","mode":"MANUAL","target_count":3}');
 perform prepare_managed_featured_days(staff_id);
 if (select access_mode from platform_controls where singleton)<>prior_access then raise exception 'ACCESS_SETTING_CHANGED';end if;
 perform pg_temp.expect_featured_denied(format('select save_managed_featured_controls(%L,''{"section":"ACCESS","mode":"FREE","target_count":3}''::jsonb)',staff_id));
 perform pg_temp.expect_featured_denied(format('select managed_platform_controls(%L)',staff_id));
 perform pg_temp.expect_featured_denied(format('select save_managed_platform_controls(%L,''{"section":"ACCESS","mode":"FREE"}''::jsonb)',staff_id));
 perform pg_temp.expect_featured_denied(format('select brokerage_request_inbox(%L,''MINE'',''ALL'',1)',staff_id));
 perform pg_temp.expect_featured_denied(format('select managed_support_agent_page(%L,1,10)',staff_id));
 perform pg_temp.expect_featured_denied(format('select update_managed_support_agent(%L,%L,''{"active":true,"can_manage_featured":true}''::jsonb)',staff_id,other_id));
 foreach uid in array array[other_id,null::uuid] loop
  perform pg_temp.expect_featured_denied(format('select managed_featured_overview(%L)',uid));
  perform pg_temp.expect_featured_denied(format('select managed_featured_controls(%L)',uid));
  perform pg_temp.expect_featured_denied(format('select prepare_managed_featured_days(%L)',uid));
  perform pg_temp.expect_featured_denied(format('select save_managed_featured_truck_day(%L,''{}''::jsonb)',uid));
  perform pg_temp.expect_featured_denied(format('select save_managed_sponsorship(%L,''{}''::jsonb)',uid));
  perform pg_temp.expect_featured_denied(format('select disable_managed_sponsorship(%L,%L)',uid,gen_random_uuid()));
 end loop;

 -- Moving a saved truck to a different weekday type must flag that saved day.
 select s.vehicle_id,v.cargo_configuration,d.feature_date into vehicle_id_value,old_configuration,day_value
 from featured_provider_slots s join featured_provider_days d on d.id=s.day_id join vehicles v on v.id=s.vehicle_id
 where d.feature_date between (now() at time zone 'Africa/Addis_Ababa')::date and (now() at time zone 'Africa/Addis_Ababa')::date+6
 and (featured_truck_theme(d.feature_date)->'configurations') ? v.cargo_configuration
 -- Sunday's mixed theme also contains Monday's first type. Choose a saved day
 -- where the replacement really is outside that day's theme, not just another day.
 and not ((featured_truck_theme(d.feature_date)->'configurations') ? (featured_truck_theme(d.feature_date+1)->'configurations'->>0))
 limit 1;
 if vehicle_id_value is not null then
  new_configuration:=featured_truck_theme(day_value+1)->'configurations'->>0;
  update vehicles set cargo_configuration=new_configuration where id=vehicle_id_value;
  result:=managed_featured_overview(staff_id);
  if not exists(select 1 from jsonb_array_elements(result->'days') d where d->>'date'=day_value::text and (d->>'invalid')::integer>0) then raise exception 'CHANGED_TRUCK_TYPE_NOT_FLAGGED';end if;
  update vehicles set cargo_configuration=old_configuration where id=vehicle_id_value;
 end if;
 -- Independent responsibilities combine, and revoking Featured preserves others.
 perform update_managed_support_agent(admin_id,other_id,'{"active":true,"available":false,"max_open_conversations":3,"can_manage_support":true,"can_manage_brokerage":true,"can_manage_featured":true,"can_manage_billing":true,"can_manage_customers":true}');
 if not can_manage_featured(other_id) or not can_manage_brokerage(other_id) or not exists(select 1 from support_agent_profiles where user_id=other_id and can_manage_support and can_manage_billing and can_manage_customers) then raise exception 'COMBINED_CAPABILITIES_LOST';end if;
 perform update_managed_support_agent(admin_id,other_id,'{"active":true,"available":false,"max_open_conversations":3,"can_manage_support":true,"can_manage_brokerage":true,"can_manage_featured":false,"can_manage_billing":true,"can_manage_customers":true}');
 if can_manage_featured(other_id) or not can_manage_brokerage(other_id) or not exists(select 1 from support_agent_profiles where user_id=other_id and can_manage_support and can_manage_billing and can_manage_customers) then raise exception 'INDEPENDENT_REVOCATION_FAILED';end if;
 perform update_managed_support_agent(admin_id,staff_id,'{"active":true,"available":false,"max_open_conversations":3,"can_manage_support":false,"can_manage_featured":false}');
 perform pg_temp.expect_featured_denied(format('select prepare_managed_featured_days(%L)',staff_id));
 perform pg_temp.expect_featured_denied(format('select save_managed_featured_truck_day(%L,''{}''::jsonb)',staff_id));
 perform update_managed_support_agent(admin_id,staff_id,'{"active":true,"available":false,"max_open_conversations":3,"can_manage_support":false,"can_manage_featured":true}');
 update profiles set active=false where id=staff_id;
 perform pg_temp.expect_featured_denied(format('select prepare_managed_featured_days(%L)',staff_id));
 update profiles set active=true where id=staff_id;
 update support_agent_profiles set active=false where user_id=staff_id;
 perform pg_temp.expect_featured_denied(format('select prepare_managed_featured_days(%L)',staff_id));
 if not exists(select 1 from audit_logs where actor_user_id=admin_id and details::text like '%"featured": true%') then raise exception 'PERMISSION_NOT_AUDITED';end if;
 if has_function_privilege('authenticated','public.prepare_managed_featured_days(uuid)','execute')
 or has_function_privilege('anon','public.can_manage_featured(uuid)','execute')
 or has_function_privilege('authenticated','public.save_managed_featured_controls(uuid,jsonb)','execute') then raise exception 'BROWSER_FUNCTION_EXPOSED';end if;
 raise notice 'Featured default-off grant, isolated settings, revoke, suspension, audit and SQL permissions passed';
end $test$;
rollback;
