-- FEAT-APP/IAM/FLT/PRV-001: real transactional commands, synthetic rollback.
begin;
create function pg_temp.driving_assert(value boolean,label text) returns void language plpgsql as $$
begin if value is distinct from true then raise exception 'DRIVING_ASSERT: %',label;end if;end $$;
create function pg_temp.driving_denied(command text,expected text) returns void language plpgsql as $$
begin
 begin execute command;exception when others then if sqlerrm=expected then return;end if;raise;end;
 raise exception 'DRIVING_DENIAL_MISSING: %',expected;
end $$;
do $test$
declare actor uuid;employee uuid:=gen_random_uuid();company boolean;driving boolean;token text;intent uuid;result jsonb;capabilities jsonb;truck uuid;other_actor uuid:=gen_random_uuid();provider uuid;
begin
 foreach company in array array[false,true] loop
  foreach driving in array array[false,true] loop
   actor:=gen_random_uuid();token:=md5(actor::text)||md5(actor::text||'signup');
   insert into auth.users(id,email,email_confirmed_at,raw_app_meta_data,raw_user_meta_data)
   values(actor,actor||'@example.test',now(),'{}','{}');
   intent:=prepare_provider_signup_identity(token,jsonb_build_object('firstName','Aster','lastName','PrivateFather148',
    'businessName',case when company then 'Synthetic provider148' else 'Aster' end,'phone','+251900000148',
    'applicationType',case when company then 'TRANSPORT_COMPANY' else 'SELF_MANAGED_DRIVER' end,'notes','',
    'drivesTruck',driving),now()+interval '15 minutes');
   result:=complete_eligible_provider_signup(actor,token);
   capabilities:=provider_account_capabilities(actor);
   perform pg_temp.driving_assert((capabilities->>'owns_provider_account')::boolean and(capabilities->>'can_manage_fleet')::boolean,'all_provider_owners_have_fleet');
   perform pg_temp.driving_assert((capabilities->>'drives_truck')::boolean=driving,'driving_choice_independent_of_business');
   perform pg_temp.driving_assert(capabilities->>'current_driven_vehicle_id' is null,'signup_has_no_fabricated_truck');
   perform pg_temp.driving_assert((select first_name='Aster' and last_name='PrivateFather148' from profiles where id=actor),'structured_private_identity_retained');
   perform pg_temp.driving_assert(public_person_first_name(actor)='Aster','public_name_is_first_only');
   perform pg_temp.driving_assert((select count(*)=1 from applications where user_id=actor),'one_signup_record');
   perform pg_temp.driving_assert(not exists(select 1 from subscriptions s where s.organization_id=(result->>'organizationId')::uuid or s.provider_profile_id=(result->>'providerProfileId')::uuid),'no_plan_reintroduced');
   perform accept_content_policy(actor,'2026-10-09');
   perform set_provider_driving_mode(actor,true);
   perform pg_temp.driving_assert(provider_owner_driver_enabled(actor),'owner_can_enable_driving');
   perform pg_temp.driving_assert((driver_portrait_workspace(actor)->>'public_id') is null,'actual_owner_portrait_workspace');
   perform update_own_account_details(actor,'{"firstName":"Aster","lastName":"PrivateFather148","phone":"","publicCallbackPhone":"+251900000148"}');
   perform pg_temp.driving_assert(public_person_callback_phone(actor)='+251900000148','owner_explicit_public_callback');
   truck:=(create_provider_vehicle(actor,'{"make":"Isuzu","model":"Synthetic148","plate":"DRIVING148","cargo_configuration":"Mini Box Truck","use_basis":"OWNED"}')->>'id')::uuid;
   perform update_fleet_driver_access(actor,jsonb_build_object('driver_user_id',actor,'vehicle_id',truck,'can_manage_capacity',true,'can_manage_tracking',true));
   perform pg_temp.driving_denied(format('select set_provider_driving_mode(%L,false)',actor),'DRIVER_ASSIGNED');
   perform pg_temp.driving_assert(capacity_active_driver_id(truck)=actor,'failed_mode_change_preserves_assignment');
   perform update_fleet_driver_access(actor,jsonb_build_object('driver_user_id',actor,'vehicle_id','','can_manage_capacity',true,'can_manage_tracking',true));
   perform set_provider_driving_mode(actor,false);
   perform pg_temp.driving_assert(not provider_owner_driver_enabled(actor) and provider_account_capabilities(actor)->>'current_driver_id' is null,'fleet_only_mode_has_no_current_driver');
   if not company then
    select id into provider from provider_profiles where user_id=actor;
    insert into auth.users(id,email,email_confirmed_at,raw_app_meta_data,raw_user_meta_data) values(employee,employee||'@example.test',now(),'{}','{}');
    perform fleet_register_driver(actor,employee,jsonb_build_object('name','Employee PrivateName148','email',employee||'@example.test','phone','+251900000149'));
    perform accept_content_policy(employee,'2026-10-09');
    perform pg_temp.driving_assert(not provider_owner_driver_enabled(employee),'nonowner_boolean_helper_does_not_throw');
    perform update_own_account_details(employee,'{"firstName":"Employee","lastName":"PrivateName148","phone":"","publicCallbackPhone":"+251900000149"}');
    perform pg_temp.driving_assert(public_person_callback_phone(employee)='+251900000149','personal_employer_employee_can_edit_own_callback');
    perform pg_temp.driving_denied(format('select set_provider_driving_mode(%L,true)',employee),'FORBIDDEN');
    employee:=gen_random_uuid();
   end if;
  end loop;
 end loop;
 insert into auth.users(id,email,email_confirmed_at,raw_app_meta_data,raw_user_meta_data) values(other_actor,other_actor||'@example.test',now(),'{}','{}');
 perform pg_temp.driving_denied(format('select prepare_provider_signup_identity(%L,%L,now()+interval ''15 minutes'')',repeat('b',64),'{"firstName":"Invalid","lastName":"","businessName":"Invalid","phone":"+251900000148","applicationType":"SELF_MANAGED_DRIVER","drivesTruck":"true"}'),'INVALID_DRIVING_MODE');
 perform pg_temp.driving_assert(not exists(select 1 from provider_signup_intents where token_digest=repeat('b',64)),'invalid_intent_has_no_partial_write');
 perform pg_temp.driving_assert(not has_function_privilege('authenticated','public.set_provider_driving_mode(uuid,boolean)','EXECUTE') and not has_function_privilege('anon','public.provider_owner_driver_enabled(uuid)','EXECUTE'),'browser_denial');
end $test$;
rollback;
