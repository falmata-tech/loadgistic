-- FEAT-SIM-001 / migration222. Disposable local rollback-only boundary test.
-- Auth rows deliberately have normal email-provider app metadata, never the
-- operator fixture marker. This does not replace the actual Auth signup journey.
begin;
do $$begin
 if current_setting('loadgistic.demo_isolated_test',true) is distinct from 'true'
  then raise exception 'ISOLATED_DEMO_TEST_CONTEXT_REQUIRED';end if;
end $$;

create function pg_temp.demo_customer_state(actor uuid,vehicle_ids uuid[])
returns jsonb language sql stable as $$
 select jsonb_build_object(
  'auth',(select to_jsonb(u) from auth.users u where u.id=actor),
  'profile',(select to_jsonb(p) from public.profiles p where p.id=actor),
  'providers',(select coalesce(jsonb_agg(to_jsonb(p) order by p.id),'[]') from public.provider_profiles p where p.user_id=actor),
  'members',(select coalesce(jsonb_agg(to_jsonb(m) order by m.id),'[]') from public.organization_members m where m.user_id=actor),
  'vehicles',(select coalesce(jsonb_agg(to_jsonb(v) order by v.id),'[]') from public.vehicles v where v.id=any(vehicle_ids)),
  'assignments',(select coalesce(jsonb_agg(to_jsonb(a) order by a.id),'[]') from public.driver_vehicle_assignments a where a.vehicle_id=any(vehicle_ids)),
  'sources',(select coalesce(jsonb_agg(to_jsonb(s) order by s.vehicle_id),'[]') from public.telematics_location_sources s where s.vehicle_id=any(vehicle_ids)),
  'sharing',(select coalesce(jsonb_agg(to_jsonb(s) order by s.vehicle_id),'[]') from public.vehicle_capacity_sharing s where s.vehicle_id=any(vehicle_ids)),
  'grants',(select coalesce(jsonb_agg(to_jsonb(g) order by g.id),'[]') from public.business_capacity_grants g where g.vehicle_id=any(vehicle_ids)),
  'phone_bindings',(select coalesce(jsonb_agg(to_jsonb(b) order by b.id),'[]') from public.phone_location_bindings b where b.vehicle_id=any(vehicle_ids)),
  'gps_assignments',(select coalesce(jsonb_agg(to_jsonb(a) order by a.id),'[]') from public.telematics_device_assignments a where a.vehicle_id=any(vehicle_ids)),
  'capacities',(select coalesce(jsonb_agg(to_jsonb(c) order by c.id),'[]') from public.capacities c where c.vehicle_id=any(vehicle_ids)),
  'phone_locations',(select coalesce(jsonb_agg(to_jsonb(l) order by l.vehicle_id),'[]') from public.vehicle_driver_locations l where l.vehicle_id=any(vehicle_ids)),
  'gps_locations',(select coalesce(jsonb_agg(to_jsonb(p) order by p.id),'[]') from public.telematics_positions p where p.vehicle_id=any(vehicle_ids)),
  'targets',(select coalesce(jsonb_agg(to_jsonb(t) order by t.vehicle_id),'[]') from public.demo_motion_targets t where t.vehicle_id=any(vehicle_ids)),
  'receipts',(select coalesce(jsonb_agg(to_jsonb(r) order by r.step_id),'[]') from public.demo_world_receipts r where r.vehicle_id=any(vehicle_ids))
 )
$$;
create function pg_temp.demo_customer_denied(statement text,expected text)
returns void language plpgsql as $$
begin
 begin execute statement;
 exception when others then
  if sqlerrm=expected then return;end if;
  raise exception 'DEMO_CUSTOMER_WRONG_DENIAL_EXPECTED_%_GOT_%',expected,sqlerrm;
 end;
 raise exception 'DEMO_CUSTOMER_DENIAL_MISSING_%',expected;
end $$;

do $test$
declare
 actor uuid:=gen_random_uuid();provider uuid:=gen_random_uuid();vehicle uuid;
 company constant uuid:='caf1d0db-4d8e-4ce9-a879-6c7b6017de3a';
 company_org constant uuid:='6727b198-d771-436a-9f1f-7bf27b8cea2f';
 owner_id uuid;owner_email text;owner_key text;before_state jsonb;marker jsonb;attempt integer;
begin
 if has_function_privilege('anon','public.capacity_owner_documents(uuid[],uuid[])','EXECUTE')
  or has_function_privilege('authenticated','public.capacity_owner_documents(uuid[],uuid[])','EXECUTE')
  or not has_function_privilege('service_role','public.capacity_owner_documents(uuid[],uuid[])','EXECUTE')
  then raise exception 'DEMO_ACCOUNT_PROJECTION_ACL_DRIFT';end if;
 insert into auth.users(id,email,email_confirmed_at,raw_app_meta_data,raw_user_meta_data)
 values(actor,actor||'@example.invalid',clock_timestamp(),'{"provider":"email","providers":["email"]}','{}');
 update public.profiles set role='DRIVER',active=true,drives_truck=true,full_name='Normal signup isolation test' where id=actor;
 insert into public.provider_profiles(id,user_id,business_name,handle)
 values(provider,actor,'Normal signup isolation test','normal-isolation-'||actor);
 perform public.accept_content_policy(actor,'2026-10-09');
 vehicle:=(public.create_provider_vehicle(actor,'{"make":"Isolation fixture","model":"Truck","plate":"SIM-222-REG","cargo_configuration":"Mini Box Truck","use_basis":"OWNED"}')->>'id')::uuid;
 perform public.update_fleet_driver_access(actor,jsonb_build_object('driver_user_id',actor,'vehicle_id',vehicle,'can_manage_capacity',true,'can_manage_tracking',true));
 for attempt in 1..2 loop
  if attempt=2 then update auth.users set raw_user_meta_data='{"fixture_source":"loadgistic","is_demo":true,"fixture_key":"user-driver"}' where id=actor;end if;
  before_state:=pg_temp.demo_customer_state(actor,array[vehicle]);
  perform pg_temp.demo_customer_denied(format('select public.configure_demo_motion_target(%L)',vehicle),'DEMO_TARGET_DENIED');
  perform pg_temp.demo_customer_denied(format('select public.start_demo_motion(%L,60,false)',vehicle),'DEMO_TARGET_DENIED');
  perform pg_temp.demo_customer_denied(format('select public.reserve_demo_gps_tick(%L,%L,1,9.03,38.75)',vehicle,gen_random_uuid()),'DEMO_TARGET_DENIED');
  perform pg_temp.demo_customer_denied(format('select public.report_demo_phone_location(%L,%L,1,9.03,38.75)',vehicle,gen_random_uuid()),'DEMO_TARGET_DENIED');
  marker:=public.capacity_owner_documents('{}'::uuid[],array[provider])->0;
  if marker->'account_is_demo' is distinct from 'false'::jsonb or marker ? 'raw_app_meta_data' or marker ? 'fixture_key'
   then raise exception 'NORMAL_ACCOUNT_DEMO_MARKER_FORGED';end if;
  if before_state is distinct from pg_temp.demo_customer_state(actor,array[vehicle])
   then raise exception 'NORMAL_ACCOUNT_SIMULATOR_CHANGED_STATE';end if;
 end loop;

 -- A real current owner of an exact allowlisted vehicle must also be denied.
 -- Copy the fixture email/key so the trusted operator marker is the difference.
 select member.user_id,u.email,u.raw_user_meta_data->>'fixture_key' into owner_id,owner_email,owner_key
 from public.organization_members member join auth.users u on u.id=member.user_id
 where member.organization_id=company_org and member.membership_role='OWNER';
 if owner_id is null then raise exception 'DEMO_ACCOUNT_COMPANY_FIXTURE_MISSING';end if;
 perform public.demo_motion_binding(company);
 marker:=public.capacity_owner_documents(array[company_org],'{}'::uuid[])->0;
 if marker->'account_is_demo' is distinct from 'true'::jsonb then raise exception 'TRUSTED_DEMO_ACCOUNT_NOT_MARKED';end if;
 if marker ? 'raw_app_meta_data' or marker ? 'fixture_key' or marker ? 'email'
  or not(marker ? 'documents') then raise exception 'DEMO_ACCOUNT_PROJECTION_PRIVATE_FIELD';end if;
 update auth.users set email=owner_id||'@original-owner.example.invalid' where id=owner_id;
 update auth.users set email=owner_email,raw_user_meta_data=jsonb_build_object('fixture_source','loadgistic','is_demo',true,'fixture_key',owner_key) where id=actor;
 update public.profiles set role='TRANSPORTER' where id=actor;
 update public.organization_members set user_id=actor where organization_id=company_org and membership_role='OWNER' and user_id=owner_id;
 before_state:=pg_temp.demo_customer_state(actor,array[vehicle,company]);
 perform pg_temp.demo_customer_denied(format('select public.configure_demo_motion_target(%L)',company),'DEMO_TARGET_DENIED');
 perform pg_temp.demo_customer_denied(format('select public.start_demo_motion(%L,60,false)',company),'DEMO_TARGET_DENIED');
 perform pg_temp.demo_customer_denied(format('select public.reserve_demo_gps_tick(%L,%L,1,9.03,38.75)',company,gen_random_uuid()),'DEMO_TARGET_DENIED');
 perform pg_temp.demo_customer_denied(format('select public.report_demo_phone_location(%L,%L,1,9.03,38.75)',company,gen_random_uuid()),'DEMO_TARGET_DENIED');
 marker:=public.capacity_owner_documents(array[company_org],'{}'::uuid[])->0;
 if marker->'account_is_demo' is distinct from 'false'::jsonb then raise exception 'TRANSFERRED_OWNER_MARKED_DEMO';end if;
 if before_state is distinct from pg_temp.demo_customer_state(actor,array[vehicle,company])
  then raise exception 'TRANSFERRED_NORMAL_OWNER_SIMULATOR_CHANGED_STATE';end if;
end $test$;
rollback;
