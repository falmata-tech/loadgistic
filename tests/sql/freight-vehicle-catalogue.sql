-- FEAT-CAP/FLT/FTR-001. Current seventeen-type catalogue; rollback-only fixtures.
begin;
create function pg_temp.expect_courier_denied(statement text,expected text) returns void language plpgsql as $$
begin
 begin execute statement;exception when others then if sqlerrm=expected then return;end if;raise;end;
 raise exception 'COURIER_EXPECTED_DENIAL_%',expected;
end $$;
do $test$
declare owner_id uuid;foreign_id uuid;employee_id uuid;vehicle_id uuid;result jsonb;config text;theme jsonb;payload jsonb;
 before_days text;before_slots text;signature text;role_name text;
begin
 select m.user_id into strict owner_id from public.organization_members m
  join public.profiles p on p.id=m.user_id cross join lateral public.provider_capacity_actor_scope(m.user_id) scope
  where m.membership_role='OWNER' and p.role='TRANSPORTER' and p.active and scope.workspace_access limit 1;
 select p.id into strict foreign_id from public.profiles p cross join lateral public.provider_capacity_actor_scope(p.id) scope
  where p.id<>owner_id and p.active and scope.workspace_access and not scope.is_company_driver
   and (scope.provider_profile_id is not null or exists(select 1 from public.organization_members m where m.user_id=p.id and m.membership_role='OWNER')) limit 1;
 select p.id into strict employee_id from public.profiles p cross join lateral public.provider_capacity_actor_scope(p.id) scope
  where p.active and scope.is_company_driver limit 1;
 select md5(coalesce(jsonb_agg(to_jsonb(d) order by d.id)::text,'')) into before_days from public.featured_provider_days d;
 select md5(coalesce(jsonb_agg(to_jsonb(s) order by s.id)::text,'')) into before_slots from public.featured_provider_slots s;
 foreach config in array array['Courier car','Courier motorcycle'] loop
  result:=public.create_provider_vehicle(owner_id,jsonb_build_object('make','Synthetic','model','Courier','plate','COURIER-TEST','cargo_configuration',config,'use_basis','OWNED'));
  vehicle_id:=(result->>'id')::uuid;
  if vehicle_id is null or result->>'cargo_configuration'<>config or result->>'publication_status'<>'DRAFT'
   or not exists(select 1 from public.vehicles where id=vehicle_id and cargo_configuration=config and publication_status='DRAFT' and not trailer_interchangeable and cardinality(supported_trailer_configurations)=0)
   then raise exception 'COURIER_REGISTRATION_NOT_EXACT_DRAFT';end if;
  -- A restored type does not bypass current-driver pairing or Live eligibility.
  if exists(select 1 from public.featured_eligible_truck_links(array[config]) link where link.vehicle_id=(result->>'id')::uuid) then raise exception 'UNASSIGNED_DRAFT_COURIER_FEATURED';end if;
  perform public.update_provider_vehicle_details(owner_id,jsonb_build_object('vehicle_id',vehicle_id,'make','Synthetic','model','Updated','plate','COURIER-TEST','cargo_configuration',config,'use_basis','PERMISSION'));
  if not exists(select 1 from public.vehicles where id=(result->>'id')::uuid and cargo_configuration=config and use_basis='PERMISSION') then raise exception 'COURIER_OWNER_EDIT_FAILED';end if;
  perform pg_temp.expect_courier_denied(format('select public.update_provider_vehicle_details(%L,%L::jsonb)',foreign_id,jsonb_build_object('vehicle_id',vehicle_id,'make','Foreign','model','Denied','plate','COURIER-TEST','cargo_configuration',config,'use_basis','OWNED')),'FORBIDDEN');
  perform pg_temp.expect_courier_denied(format('select public.create_provider_vehicle(%L,%L::jsonb)',employee_id,jsonb_build_object('make','Synthetic','model','Denied','plate','COURIER-TEST','cargo_configuration',config,'use_basis','OWNED')),'FORBIDDEN');
  perform pg_temp.expect_courier_denied(format('select public.set_provider_vehicle_attached_trailer(%L,%L::jsonb)',owner_id,jsonb_build_object('vehicle_id',vehicle_id,'cargo_configuration','Tractor + Container Trailer')),'NOT_INTERCHANGEABLE_TRACTOR');
  perform pg_temp.expect_courier_denied(format('select public.create_provider_vehicle(%L,%L::jsonb)',owner_id,jsonb_build_object('make','Synthetic','model','Denied','plate','COURIER-TEST','cargo_configuration',config,'use_basis','OWNED','trailer_interchangeable',true,'supported_trailer_configurations',jsonb_build_array('Tractor + Container Trailer'))),'INVALID_TRAILER_CONFIGURATION');
  payload:=jsonb_build_object('cargo_configuration',config,'status','EMPTY','updated_at',now(),'accepts_full_load',true,'accepts_partial_load',true);
  if public.capacity_payload_matches(payload,'{"vehicle_category":"Courier car,Courier motorcycle","status":"EMPTY","load_type":"PTL"}') is not true
   or public.capacity_payload_matches(payload,'{"vehicle_category":"Cargo van"}') is not false
   or public.capacity_payload_matches(payload,'{"vehicle_category":"Courier car,Courier motorcycle","status":"PARTIAL"}') is not false then raise exception 'COURIER_FILTER_COMPOSITION_FAILED';end if;
 end loop;
 perform pg_temp.expect_courier_denied(format('select public.create_provider_vehicle(%L,%L::jsonb)',owner_id,jsonb_build_object('make','Synthetic','model','Denied','plate','COURIER-TEST','cargo_configuration','Unlisted courier','use_basis','OWNED')),'INVALID_VEHICLE_CONFIGURATION');
 perform pg_temp.expect_courier_denied('select public.capacity_filter_values(''Courier car,Unknown'',''vehicle_category'')','INVALID_CAPACITY_FILTER');
 if public.capacity_filter_values('Courier motorcycle,Courier car,Courier car','vehicle_category')<>array['Courier car','Courier motorcycle'] then raise exception 'COURIER_FILTER_CANONICALIZATION_FAILED';end if;
 theme:=public.featured_truck_theme('2026-10-20');
 if theme->>'key'<>'cargo-vans' or theme->>'label'<>'Vans and couriers' or not (theme->'configurations' @> '["Courier car","Courier motorcycle","Cargo van"]') then raise exception 'TUESDAY_COURIER_THEME_INVALID';end if;
 theme:=public.featured_truck_theme('2026-10-25');
 if theme->>'key'<>'mixed-trucks' or jsonb_array_length(theme->'configurations')<>17 or not (theme->'configurations' @> '["Courier car","Courier motorcycle"]') then raise exception 'SUNDAY_COURIER_THEME_INVALID';end if;
 if public.featured_truck_theme('2026-10-22')->>'key'<>'light-duty' then raise exception 'OTHER_WEEKDAY_CHANGED';end if;
 if before_days is distinct from(select md5(coalesce(jsonb_agg(to_jsonb(d) order by d.id)::text,'')) from public.featured_provider_days d)
  or before_slots is distinct from(select md5(coalesce(jsonb_agg(to_jsonb(s) order by s.id)::text,'')) from public.featured_provider_slots s) then raise exception 'SAVED_FEATURED_ROSTER_CHANGED';end if;
 if to_regprocedure('public.reject_retired_vehicle_configuration()') is not null then raise exception 'OBSOLETE_COURIER_REJECTION_REMAINS';end if;
 foreach role_name in array array['anon','authenticated'] loop
  foreach signature in array array['public.create_provider_vehicle(uuid,jsonb)','public.update_provider_vehicle_details(uuid,jsonb)','public.capacity_filter_values(text,text)'] loop
   if has_function_privilege(role_name,signature,'execute') then raise exception 'BROWSER_COURIER_COMMAND_EXPOSED';end if;
  end loop;
 end loop;
 raise notice 'PASS: courier owner Add/Edit exact Draft types, foreign/employee/trailer/unknown denial, composed filters, Featured themes and saved rosters preserved';
end $test$;
rollback;
