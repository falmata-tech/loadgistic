-- FEAT-FLT-001 / FEAT-FTR-001; isolated local transaction, no retained mutations.
begin;
do $test$
declare owner_id uuid; vehicle_id uuid; result jsonb; config text; theme jsonb;
begin
  select m.user_id into strict owner_id from public.organization_members m
    join public.profiles p on p.id=m.user_id
    cross join lateral public.provider_capacity_actor_scope(m.user_id) scope
    where m.membership_role='OWNER' and p.role='TRANSPORTER' and p.active and scope.workspace_access limit 1;
  foreach config in array array['Courier car','Courier motorcycle'] loop
    begin
      perform public.create_provider_vehicle(owner_id,jsonb_build_object('make','Test','model','Retired','plate','RETIRED-TEST','cargo_configuration',config));
      raise exception 'RETIRED_INSERT_ACCEPTED';
    exception when raise_exception then if sqlerrm<>'INVALID_VEHICLE_CONFIGURATION' then raise;end if;end;
  end loop;
  result:=public.create_provider_vehicle(owner_id,'{"make":"Isuzu","model":"Test","plate":"FREIGHT-TEST","cargo_configuration":"Light Box Truck"}');
  vehicle_id:=(result->>'id')::uuid;
  if vehicle_id is null then raise exception 'FREIGHT_REGISTRATION_FAILED';end if;
  begin
    perform public.update_provider_vehicle_details(owner_id,jsonb_build_object('vehicle_id',vehicle_id,'make','Test','model','Retired','plate','FREIGHT-TEST','cargo_configuration','Courier car'));
    raise exception 'RETIRED_EDIT_ACCEPTED';
  exception when raise_exception then if sqlerrm<>'INVALID_VEHICLE_CONFIGURATION' then raise;end if;end;
  foreach config in array array['Courier car','Courier motorcycle'] loop
    begin update public.vehicles set cargo_configuration=config where id=vehicle_id;raise exception 'DIRECT_RETIRED_EDIT_ACCEPTED';
    exception when raise_exception then if sqlerrm<>'INVALID_VEHICLE_CONFIGURATION' then raise;end if;end;
  end loop;
  perform public.update_provider_vehicle_details(owner_id,jsonb_build_object('vehicle_id',vehicle_id,'make','Isuzu','model','Test','plate','FREIGHT-TEST','cargo_configuration','Cargo van'));
  if not exists(select 1 from public.vehicles where id=vehicle_id and cargo_configuration='Cargo van') then raise exception 'FREIGHT_EDIT_FAILED';end if;
  theme:=public.featured_truck_theme('2026-09-27');
  if theme->>'key'<>'mixed-trucks' or jsonb_array_length(theme->'configurations')<>15 or theme::text like '%Courier%' then raise exception 'SUNDAY_THEME_INVALID';end if;
  if public.featured_truck_theme('2026-09-24')->>'key'<>'light-duty' then raise exception 'WEEKDAY_CHANGED';end if;
  if has_function_privilege('anon','public.reject_retired_vehicle_configuration()','EXECUTE')
    or has_function_privilege('authenticated','public.reject_retired_vehicle_configuration()','EXECUTE')
    or has_function_privilege('anon','public.create_provider_vehicle(uuid,jsonb)','EXECUTE') then raise exception 'BROWSER_COMMAND_EXPOSED';end if;
end $test$;
rollback;
