begin;
create function pg_temp.expect_single_denial(command text,expected text) returns void language plpgsql as $$
begin
 begin execute command;exception when others then if sqlerrm=expected then return;end if;raise;end;
 raise exception 'EXPECTED_SINGLE_TRUCK_DENIAL: %',expected;
end $$;
do $test$
declare actor uuid:=gen_random_uuid();other_actor uuid:=gen_random_uuid();provider uuid:=gen_random_uuid();other_provider uuid:=gen_random_uuid();
 admin_id uuid;old_truck uuid;new_truck uuid;proof_id uuid;shipment uuid:=gen_random_uuid();command jsonb;change_command jsonb;
 before_capacities bigint;before_vehicles bigint;origin_ref text;destination_ref text;retired jsonb;projection jsonb;intent uuid;
begin
 select id into strict admin_id from public.profiles where active and role='ADMIN' limit 1;
 insert into auth.users(id,email,email_confirmed_at,raw_app_meta_data,raw_user_meta_data) values
 (actor,actor||'@example.test',now(),'{}','{}'),(other_actor,other_actor||'@example.test',now(),'{}','{}');
 update public.profiles set active=true,role='DRIVER' where id in(actor,other_actor);
 insert into public.provider_profiles(id,user_id,business_name,handle) values
 (provider,actor,'Single truck audit','single-'||actor),(other_provider,other_actor,'Other truck audit','single-'||other_actor);
 insert into public.applications(user_id,business_name,application_type,status) values(actor,'Historical model','OWNER_OPERATOR','APPROVED');
 perform set_config('request.jwt.claim.sub',actor::text,true);
 projection:=public.current_user_projection();
 if projection->>'provider_operating_model'<>'SELF_MANAGED_DRIVER' then raise exception 'LEGACY_IDENTITY_NOT_UNIFIED';end if;
 if not exists(select 1 from public.applications where user_id=actor and application_type='OWNER_OPERATOR') then raise exception 'SIGNUP_HISTORY_REWRITTEN';end if;
 command:='{"make":"Toyota","model":"Single audit","plate":"SINGLE-A","cargo_configuration":"Pickup truck","use_basis":"OWNED"}';
 perform pg_temp.expect_single_denial(format('select public.create_provider_vehicle(%L,%L)',actor,command-'use_basis'),'INVALID_VEHICLE_USE_BASIS');
 old_truck:=(public.create_provider_vehicle(actor,command)->>'id')::uuid;
 perform public.refresh_provider_capacity_location(actor,jsonb_build_object('vehicle_id',old_truck,'approximate_lat',9.03,'approximate_lng',38.74,'location_precision_km',20));
 perform public.grant_private_capacity_access(actor,old_truck,'old-contact@example.test',repeat('8',64));
 if not exists(select 1 from public.vehicles where id=old_truck and active and use_basis='OWNED') then raise exception 'TRUCK_USE_BASIS_NOT_SAVED';end if;
 perform public.update_provider_vehicle_details(actor,command||jsonb_build_object('vehicle_id',old_truck,'use_basis','PERMISSION'));
 if not exists(select 1 from public.vehicles where id=old_truck and active and use_basis='PERMISSION') then raise exception 'TRUCK_USE_BASIS_EDIT_NOT_SAVED';end if;
 perform public.update_provider_vehicle_details(actor,command||jsonb_build_object('vehicle_id',old_truck));
 perform pg_temp.expect_single_denial(format('select public.create_provider_vehicle(%L,%L)',actor,command),'SINGLE_TRUCK_LIMIT');
 begin
  insert into public.vehicles(provider_profile_id,label,category,make,model,plate,cargo_configuration,active) values(provider,'Direct bypass','Pickup truck','Toyota','Bypass','BYPASS','Pickup truck',true);
  raise exception 'DIRECT_SINGLE_TRUCK_BYPASS';
 exception when unique_violation then null;end;
 perform pg_temp.expect_single_denial(format('select public.fleet_owner_organization(%L)',actor),'FORBIDDEN');
 perform pg_temp.expect_single_denial(format('select public.update_fleet_driver_access(%L,%L)',actor,jsonb_build_object('driver_user_id',other_actor,'vehicle_id',old_truck)),'FORBIDDEN');
 perform pg_temp.expect_single_denial(format('select public.fleet_pending_invitations(%L)',actor),'FORBIDDEN');
 perform pg_temp.expect_single_denial(format('select public.update_provider_vehicle_details(%L,%L)',actor,jsonb_build_object('vehicle_id',old_truck,'make','Another','model','Single audit','plate','SINGLE-A','cargo_configuration','Pickup truck','use_basis','OWNED')),'TRUCK_CHANGE_REQUIRED');
 change_command:=command||jsonb_build_object('replace_vehicle_id',old_truck,'replacement_confirmed',true,'model','New audit','plate','SINGLE-B','use_basis','PERMISSION');
 perform pg_temp.expect_single_denial(format('select public.create_provider_vehicle(%L,%L)',actor,change_command-'replacement_confirmed'),'TRUCK_CHANGE_CONFIRMATION_REQUIRED');
 perform pg_temp.expect_single_denial(format('select public.create_provider_vehicle(%L,%L)',other_actor,change_command),'TRUCK_CHANGED');
 select count(*) into before_capacities from public.capacities where provider_profile_id=provider;
 select count(*) into before_vehicles from public.vehicles where provider_profile_id=provider;
 perform pg_temp.expect_single_denial(format('select public.create_provider_vehicle(%L,%L)',actor,change_command||'{"make":"x"}'),'INVALID_VEHICLE_MAKE');
 if not (select active from public.vehicles where id=old_truck) or
  (select count(*) from public.capacities where provider_profile_id=provider)<>before_capacities or
  (select count(*) from public.vehicles where provider_profile_id=provider)<>before_vehicles then raise exception 'PARTIAL_TRUCK_CHANGE';end if;
 proof_id:=public.submit_managed_verification(actor,jsonb_build_object('subject_type','VEHICLE','subject_id',old_truck,'verification_type','VEHICLE_OWNERSHIP',
  'document_name','Synthetic ownership','storage_path','supabase://verification/verification/single-truck.pdf','original_name','ownership.pdf','mime_type','application/pdf'));
 perform public.review_managed_verification(admin_id,proof_id,'APPROVED','Synthetic review');
 select id into strict origin_ref from public.place_catalog where normalized_name='addis ababa' limit 1;
 select id into strict destination_ref from public.place_catalog where normalized_name='adama' limit 1;
 perform public.create_provider_tracking_with_recipients(actor,jsonb_build_object('id',shipment,'code','LGX-'||upper(substr(replace(shipment::text,'-',''),1,8)),
  'vehicle_id',old_truck,'origin_place_ref',origin_ref,'destination_place_ref',destination_ref,'cargo_summary','Single truck audit cargo',
  'customer_email','single-owner@example.test','customer_email_digest',repeat('2',64),'additional_recipients','[]'::jsonb,'expected_delivery_date',(current_date+2)::text,
  'tracking_mode','STATUS_ONLY','tracking_code_hash',encode(gen_random_bytes(32),'hex'),'review_code_hash',encode(gen_random_bytes(32),'hex')));
 perform pg_temp.expect_single_denial(format('select public.create_provider_vehicle(%L,%L)',actor,change_command),'TRUCK_HAS_ACTIVE_TRACKING');
 if not (select active from public.vehicles where id=old_truck) then raise exception 'ACTIVE_JOB_TRUCK_RETIRED';end if;
 -- Fixture-only terminal status; no false user completion is exercised here.
 update public.provider_shipments set operational_status='CANCELLED' where id=shipment;
 new_truck:=(public.create_provider_vehicle(actor,change_command)->>'id')::uuid;
 if (select count(*) from public.vehicles where provider_profile_id=provider and active)<>1 or
  (select active from public.vehicles where id=old_truck) or not (select active from public.vehicles where id=new_truck)
  then raise exception 'CURRENT_TRUCK_NOT_REPLACED';end if;
 if (select use_basis from public.vehicles where id=new_truck)<>'PERMISSION' then raise exception 'PERMISSION_BASIS_LOST';end if;
 if exists(select 1 from public.capacities where vehicle_id=new_truck) or exists(select 1 from public.verification_requests where subject_id=new_truck)
  or exists(select 1 from public.capacity_access_grants where vehicle_id=new_truck)
  or exists(select 1 from public.vehicle_driver_locations where vehicle_id=new_truck) then raise exception 'OLD_TRUCK_DATA_TRANSFERRED';end if;
 if not exists(select 1 from public.vehicle_driver_locations where vehicle_id=old_truck)
  or not exists(select 1 from public.capacity_access_grants where vehicle_id=old_truck) then raise exception 'OLD_TRUCK_PRIVATE_HISTORY_REMOVED';end if;
 if not exists(select 1 from public.verification_requests where id=proof_id and subject_id=old_truck and status='APPROVED') or
  not exists(select 1 from public.provider_shipments where id=shipment and assigned_vehicle_id=old_truck) then raise exception 'OLD_TRUCK_HISTORY_CHANGED';end if;
 if public.managed_verification_file(actor,proof_id) is null or public.managed_verification_file(other_actor,proof_id) is not null then raise exception 'HISTORICAL_DOCUMENT_PRIVACY_CHANGED';end if;
 if (select coalesce(market_status,status::text) from public.capacities where vehicle_id=old_truck order by updated_at desc,id desc limit 1)<>'OFF_DUTY' then raise exception 'OLD_CAPACITY_NOT_OFF_DUTY';end if;
 retired:=public.retired_provider_vehicle_page(actor,0,10);
 if (retired->>'total')::integer<>1 then raise exception 'OLD_TRUCK_HISTORY_MISSING';end if;
 perform pg_temp.expect_single_denial(format('select public.create_provider_vehicle(%L,%L)',actor,change_command),'TRUCK_CHANGED');
 perform pg_temp.expect_single_denial(format('select public.set_vehicle_lifecycle(%L,%L,true,%L)',actor,old_truck,'Switch back silently'),'TRUCK_CHANGE_REQUIRED');
 perform pg_temp.expect_single_denial(format('select public.set_vehicle_lifecycle(%L,%L,true,%L)',admin_id,old_truck,'Administrative restore'),'SINGLE_TRUCK_LIMIT');
 -- Legacy aliases normalize before new provisioning without modifying old application rows.
 intent:=public.prepare_provider_signup_intent(repeat('9',64),'Single new','Single new provider','+251900000011','OWNER_OPERATOR',null,now()+interval '10 minutes');
 if (select application_type from public.provider_signup_intents where id=intent)<>'SELF_MANAGED_DRIVER' then raise exception 'LEGACY_SIGNUP_ALIAS_NOT_NORMALIZED';end if;
 if has_function_privilege('anon','public.create_provider_vehicle(uuid,jsonb)','EXECUTE') or
  has_function_privilege('authenticated','public.set_vehicle_lifecycle(uuid,uuid,boolean,text)','EXECUTE') then raise exception 'SINGLE_TRUCK_BROWSER_RPC_EXPOSED';end if;
 raise notice 'PASS: unified legacy identity, one active truck, ownership, atomic replacement/rollback, Tracking, history, stale/admin/foreign/driver denials';
end $test$;
rollback;
