-- Local fixture database only; every identity and business-state edit rolls back.
begin;
create function pg_temp.expect_account_security_denied(command text,expected text) returns void language plpgsql as $$
begin begin execute command;exception when others then if sqlerrm=expected then return;end if;raise;end;raise exception 'EXPECTED_DENIAL';end $$;
do $test$
declare actor uuid; admin_id uuid; provider uuid; snapshot jsonb; blockers jsonb; code text; role_name text; vehicle uuid;
begin
 select id into strict actor from profiles where email='driver@loadgistic.local';
 select id into strict admin_id from profiles where email='admin@loadgistic.local';
 select id into strict provider from provider_profiles where user_id=actor;
 snapshot:=(select to_jsonb(p)-array['email','active','account_deactivated_at','updated_at'] from profiles p where id=actor);
 update auth.users set email='security-sql-change@example.test' where id=actor;
 if (select email from profiles where id=actor)<>'security-sql-change@example.test' then raise exception 'CONFIRMED_EMAIL_NOT_SYNCED';end if;
 if (select to_jsonb(p)-array['email','active','account_deactivated_at','updated_at'] from profiles p where id=actor) is distinct from snapshot then raise exception 'EMAIL_CHANGED_AUTHORITY';end if;
 if exists(select 1 from audit_logs where actor_user_id=actor and action='ACCOUNT_EMAIL_CHANGED' and details<>'{}'::jsonb) then raise exception 'EMAIL_AUDIT_LEAK';end if;
 perform pg_temp.expect_account_security_denied(format('select deactivate_own_account(%L,%L)',actor,'DELETE'),'ACCOUNT_CONFIRMATION_REQUIRED');
 perform pg_temp.expect_account_security_denied(format('select deactivate_own_account(%L,%L)',admin_id,'DEACTIVATE'),'FORBIDDEN');
 update auth.users set last_sign_in_at=now()-interval '1 day' where id=actor;
 perform pg_temp.expect_account_security_denied(format('select deactivate_own_account(%L,%L)',actor,'DEACTIVATE'),'ACCOUNT_REAUTH_REQUIRED');
 update auth.users set last_sign_in_at=clock_timestamp() where id=actor;
 blockers:=account_deactivation_blockers(actor);
 if not(blockers?'ACTIVE_TRUCKS') then raise exception 'ACTIVE_TRUCK_BLOCKER_MISSING';end if;
 perform pg_temp.expect_account_security_denied(format('select deactivate_own_account(%L,%L)',actor,'DEACTIVATE'),'ACCOUNT_HAS_ACTIVE_WORK');
 update provider_shipments set operational_status='CANCELLED' where provider_profile_id=provider and operational_status not in ('COMPLETED','CANCELLED');
 select id into vehicle from vehicles where provider_profile_id=provider limit 1;
 update vehicles set active=false where provider_profile_id=provider;
 update driver_vehicle_assignments set active=false where driver_user_id=actor;
 update support_conversations set status='CLOSED' where customer_user_id=actor;
 if jsonb_array_length(account_deactivation_blockers(actor))<>0 then raise exception 'RESOLVED_WORK_STILL_BLOCKED';end if;
 perform deactivate_own_account(actor,'DEACTIVATE');
 if (select active from profiles where id=actor) or (select account_deactivated_at from profiles where id=actor) is null then raise exception 'ACCOUNT_NOT_DEACTIVATED';end if;
 if (select public_visibility from provider_profiles where id=provider)<>'PRIVATE' then raise exception 'DEACTIVATED_PUBLIC_PROFILE';end if;
 if not exists(select 1 from provider_profiles where id=provider) or not exists(select 1 from auth.users where id=actor) then raise exception 'HISTORY_OR_IDENTITY_DELETED';end if;
 perform pg_temp.expect_account_security_denied(format('update vehicles set active=true where id=%L',vehicle),'VEHICLE_OWNER_INACTIVE');
 perform pg_temp.expect_account_security_denied(format('select deactivate_own_account(%L,%L)',actor,'DEACTIVATE'),'FORBIDDEN');
 foreach role_name in array array['anon','authenticated'] loop
  foreach code in array array['account_deactivation_blockers(uuid)','deactivate_own_account(uuid,text)'] loop
   if has_function_privilege(role_name,'public.'||code,'EXECUTE') then raise exception 'DIRECT_ACCOUNT_SECURITY_RPC';end if;
  end loop;
 end loop;
 raise notice 'Account confirmed-email sync, fresh proof, blockers, retained closure and inactive-owner denial passed';
end $test$;
rollback;
