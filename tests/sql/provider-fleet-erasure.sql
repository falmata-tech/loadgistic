-- FEAT-IAM/FLT/PLY-001: both closure modes preserve personal-employer safety.
begin;
create function pg_temp.expect_provider_closure_denied(command text,expected text)
returns void language plpgsql as $$
begin
 begin execute command;
 exception when others then if sqlerrm=expected then return;end if;raise;end;
 raise exception 'EXPECTED_PROVIDER_CLOSURE_DENIAL';
end $$;
do $test$
declare owner_id uuid:=gen_random_uuid();employee uuid:=gen_random_uuid();admin_id uuid:=gen_random_uuid();provider uuid:=gen_random_uuid();invitation uuid:=gen_random_uuid();request_id uuid;result jsonb;
begin
 insert into auth.users(id,email,email_confirmed_at,last_sign_in_at,raw_app_meta_data,raw_user_meta_data) values
 (owner_id,owner_id||'@example.test',now(),now(),'{}','{}'),(employee,employee||'@example.test',now(),now(),'{}','{}'),(admin_id,admin_id||'@example.test',now(),now(),'{}','{}');
 update profiles set active=true,role='DRIVER' where id=owner_id;
 update profiles set active=true,role='ADMIN' where id=admin_id;
 insert into provider_profiles(id,user_id,business_name,handle) values(provider,owner_id,'Synthetic erasure149','erase149-'||owner_id);
 perform accept_content_policy(owner_id,'2026-10-09');
 perform fleet_register_driver(owner_id,employee,jsonb_build_object('name','Synthetic employee149','email',employee||'@example.test','phone','+251900000149'));
 insert into fleet_driver_invitations(id,provider_profile_id,email,driver_name,phone,invited_by)
 values(invitation,provider,'private-invite149@example.test','Private invitation149','+251900000149',owner_id);
 request_id:=(request_account_deletion(owner_id)->>'id')::uuid;
 result:=prepare_account_erasure(admin_id,request_id);
 if result->>'status'<>'HELD' or not(select active from profiles where id=owner_id) or not(select active from profiles where id=employee)
 then raise exception 'PERSONAL_EMPLOYER_ERASED_WITH_ACTIVE_EMPLOYEE';end if;
 if account_deletion_status(owner_id)->>'retentionReason' is null then raise exception 'PERSONAL_EMPLOYER_HOLD_UNEXPLAINED';end if;
 perform fleet_remove_driver(owner_id,employee);
 result:=prepare_account_erasure(admin_id,request_id);
 if result->>'status'<>'ERASING' then raise exception 'RESOLVED_EMPLOYEE_HOLD_NOT_RELEASED';end if;
 update auth.users set deleted_at=now() where id=owner_id;
 result:=finish_account_erasure(admin_id,request_id);
 if result->>'status'<>'COMPLETED' or exists(select 1 from fleet_driver_invitations where id=invitation) then raise exception 'PERSONAL_INVITATION_CONTACT_RETAINED';end if;
 if not exists(select 1 from provider_profiles where id=provider and business_name='Deleted transporter')
 or not exists(select 1 from drivers where user_id=employee and provider_profile_id=provider) then raise exception 'PSEUDONYMOUS_FLEET_HISTORY_LOST';end if;
 if finish_account_erasure(admin_id,request_id)->>'status'<>'COMPLETED' then raise exception 'FLEET_ERASURE_REPLAY_FAILED';end if;
end $test$;
do $deactivation_test$
declare
 owner_id uuid:=gen_random_uuid();employee uuid:=gen_random_uuid();provider uuid:=gen_random_uuid();
 foreign_owner uuid:=gen_random_uuid();foreign_provider uuid:=gen_random_uuid();
 invitation uuid;foreign_invitation uuid;blockers jsonb;result jsonb;signature text;role_name text;
begin
 insert into auth.users(id,email,email_confirmed_at,last_sign_in_at,raw_app_meta_data,raw_user_meta_data) values
 (owner_id,owner_id||'@example.test',now(),now(),'{}','{}'),
 (employee,employee||'@example.test',now(),now(),'{}','{}'),
 (foreign_owner,foreign_owner||'@example.test',now(),now(),'{}','{}');
 update profiles set active=true,role='DRIVER' where id in(owner_id,foreign_owner);
 insert into provider_profiles(id,user_id,business_name,handle) values
 (provider,owner_id,'Synthetic closure149','close149-'||owner_id),
 (foreign_provider,foreign_owner,'Synthetic foreign closure149','foreign149-'||foreign_owner);
 perform accept_content_policy(owner_id,'2026-10-09');
 perform accept_content_policy(foreign_owner,'2026-10-09');
 perform fleet_register_driver(owner_id,employee,jsonb_build_object('name','Synthetic closure employee149',
  'email',employee||'@example.test','phone','+251900000149'));

 -- An employee is active work even when no trucks or invitations exist.
 blockers:=account_deactivation_blockers(owner_id);
 if blockers<>'["ACTIVE_FLEET_MEMBERS"]'::jsonb then raise exception 'PERSONAL_EMPLOYEE_CLOSURE_BLOCKER_MISSING';end if;
 perform pg_temp.expect_provider_closure_denied(format('select deactivate_own_account(%L,%L)',owner_id,'DEACTIVATE'),'ACCOUNT_HAS_ACTIVE_WORK');
 if not(select active from profiles where id=owner_id) or not(select active from profiles where id=employee)
  or(select account_deactivated_at from profiles where id=owner_id) is not null
 then raise exception 'BLOCKED_EMPLOYER_CLOSURE_CHANGED_ACCESS';end if;

 invitation:=fleet_invite_driver(owner_id,jsonb_build_object('name','Synthetic pending employee149',
  'email','pending149-'||owner_id||'@example.test','phone','+251900000149'));
 foreign_invitation:=fleet_invite_driver(foreign_owner,jsonb_build_object('name','Synthetic foreign invitation149',
  'email','foreign149-'||foreign_owner||'@example.test','phone','+251900000149'));
 blockers:=account_deactivation_blockers(owner_id);
 if not(blockers?'ACTIVE_FLEET_MEMBERS' and blockers?'PENDING_INVITATIONS') or jsonb_array_length(blockers)<>2
 then raise exception 'COMBINED_PERSONAL_FLEET_CLOSURE_BLOCKERS_MISSING';end if;

 -- Offboarding preserves the employee record but cannot bypass a pending invite.
 perform fleet_remove_driver(owner_id,employee);
 if account_deactivation_blockers(owner_id)<>'["PENDING_INVITATIONS"]'::jsonb
 then raise exception 'PERSONAL_PENDING_INVITATION_CLOSURE_BLOCKER_MISSING';end if;
 perform pg_temp.expect_provider_closure_denied(format('select deactivate_own_account(%L,%L)',owner_id,'DEACTIVATE'),'ACCOUNT_HAS_ACTIVE_WORK');
 if not(select active from profiles where id=owner_id) then raise exception 'PENDING_INVITATION_CLOSED_EMPLOYER';end if;

 perform fleet_cancel_invitation(owner_id,invitation);
 if jsonb_array_length(account_deactivation_blockers(owner_id))<>0
 then raise exception 'RESOLVED_PERSONAL_FLEET_STILL_BLOCKS_CLOSURE';end if;
 -- A different provider's pending work must not become this actor's blocker.
 if account_deactivation_blockers(foreign_owner)<>'["PENDING_INVITATIONS"]'::jsonb
 then raise exception 'FOREIGN_PROVIDER_INVITATION_SCOPE_LOST';end if;
 update auth.users set last_sign_in_at=now()-interval '1 day' where id=owner_id;
 perform pg_temp.expect_provider_closure_denied(format('select deactivate_own_account(%L,%L)',owner_id,'DEACTIVATE'),'ACCOUNT_REAUTH_REQUIRED');
 update auth.users set last_sign_in_at=clock_timestamp() where id=owner_id;
 perform pg_temp.expect_provider_closure_denied(format('select deactivate_own_account(%L,%L)',owner_id,'DELETE'),'ACCOUNT_CONFIRMATION_REQUIRED');
 result:=deactivate_own_account(owner_id,'DEACTIVATE');
 if result->>'deactivated'<>'true' or(select active from profiles where id=owner_id)
  or(select account_deactivated_at from profiles where id=owner_id) is null
  or(select public_visibility from provider_profiles where id=provider)<>'PRIVATE'
 then raise exception 'RESOLVED_PERSONAL_FLEET_NOT_DEACTIVATED';end if;
 if not exists(select 1 from provider_profiles where id=provider and user_id=owner_id)
  or not exists(select 1 from auth.users where id=owner_id and deleted_at is null)
  or not exists(select 1 from drivers where user_id=employee and provider_profile_id=provider and not active and offboarded_at is not null)
  or not exists(select 1 from fleet_driver_invitations where id=invitation and provider_profile_id=provider and cancelled_at is not null)
 then raise exception 'DEACTIVATION_DELETED_PERSONAL_FLEET_HISTORY';end if;
 if not(select active from profiles where id=foreign_owner)
  or not exists(select 1 from fleet_driver_invitations where id=foreign_invitation and cancelled_at is null)
 then raise exception 'PERSONAL_CLOSURE_MUTATED_FOREIGN_PROVIDER';end if;
 if(select count(*) from audit_logs where actor_user_id=owner_id and action='ACCOUNT_DEACTIVATED' and details='{}'::jsonb)<>1
 then raise exception 'PERSONAL_CLOSURE_AUDIT_MISSING_OR_PRIVATE_DATA';end if;
 perform pg_temp.expect_provider_closure_denied(format('select deactivate_own_account(%L,%L)',owner_id,'DEACTIVATE'),'FORBIDDEN');
 perform pg_temp.expect_provider_closure_denied(format('select fleet_invite_driver(%L,%L::jsonb)',owner_id,
  jsonb_build_object('name','Synthetic late invitation149','email','late149@example.test','phone','+251900000149')),'FORBIDDEN');

 -- New function backups are owner-only; current service RPC boundaries stay intact.
 foreach signature in array array['account_deactivation_blockers(uuid)','deactivate_own_account(uuid,text)'] loop
  if not has_function_privilege('service_role','public.'||signature,'EXECUTE') then raise exception 'CLOSURE_SERVICE_RPC_LOST';end if;
  foreach role_name in array array['anon','authenticated'] loop
   if has_function_privilege(role_name,'public.'||signature,'EXECUTE') then raise exception 'DIRECT_PERSONAL_CLOSURE_RPC';end if;
  end loop;
 end loop;
 foreach signature in array array['prepare_account_erasure_pre_fleet149(uuid,uuid)','finish_account_erasure_pre_fleet149(uuid,uuid)',
  'account_deactivation_blockers_pre_fleet149(uuid)','deactivate_own_account_pre_fleet149(uuid,text)'] loop
  foreach role_name in array array['anon','authenticated','service_role'] loop
   if has_function_privilege(role_name,'public.'||signature,'EXECUTE') then raise exception 'PRIVATE_CLOSURE_BACKUP_EXPOSED';end if;
  end loop;
 end loop;
end $deactivation_test$;
rollback;
