begin;
create function pg_temp.expect_retired(command text) returns void language plpgsql as $$
begin
 begin execute command;exception when others then if sqlerrm='BILLING_RETIRED' then return;end if;raise;end;
 raise exception 'EXPECTED_BILLING_RETIREMENT';
end $$;
do $test$
declare owner_id uuid:=gen_random_uuid();other_id uuid:=gen_random_uuid();admin_id uuid;provider_id uuid:=gen_random_uuid();scope record;intent_id uuid;result jsonb;before_subscriptions bigint;before_proofs bigint;
begin
 select id into strict admin_id from public.profiles where active and role='ADMIN' order by created_at limit 1;
 select count(*) into before_subscriptions from public.subscriptions;select count(*) into before_proofs from public.payment_proofs;
 insert into auth.users(id,email,email_confirmed_at,raw_app_meta_data,raw_user_meta_data) values(owner_id,owner_id||'@example.test',now(),'{}','{}'),(other_id,other_id||'@example.test',now(),'{}','{}');
 update public.profiles set active=true,role='DRIVER' where id=owner_id;
 insert into public.provider_profiles(id,user_id,business_name,handle) values(provider_id,owner_id,'No-plan regression','no-plan-'||owner_id);
 select * into strict scope from public.provider_capacity_actor_scope(owner_id);
 if not scope.workspace_access or not scope.can_manage_capacity then raise exception 'CAPACITY_WITHOUT_PLAN_DENIED';end if;
 select * into strict scope from public.provider_tracking_actor_scope(owner_id);
 if not scope.workspace_access or not scope.can_manage_tracking then raise exception 'TRACKING_WITHOUT_PLAN_DENIED';end if;
 select * into strict scope from public.provider_profile_actor_scope(owner_id);
 if not scope.workspace_access then raise exception 'PROFILE_WITHOUT_PLAN_DENIED';end if;
 perform set_config('request.jwt.claim.sub',owner_id::text,true);
 if not public.has_workspace_access() then raise exception 'RLS_WORKSPACE_WITHOUT_PLAN_DENIED';end if;
 update public.profiles set active=false where id=owner_id;
 if exists(select 1 from public.provider_capacity_actor_scope(owner_id)) or public.has_workspace_access() then raise exception 'INACTIVE_WORKSPACE_ALLOWED';end if;
 update public.profiles set active=true where id=owner_id;
 perform set_config('request.jwt.claim.sub',other_id::text,true);
 if public.has_workspace_access() then raise exception 'UNLINKED_WORKSPACE_ALLOWED';end if;
 perform pg_temp.expect_retired(format('select public.submit_managed_payment_proof(%L,''{}'')',owner_id));
 perform pg_temp.expect_retired(format('select public.review_managed_payment_proof(%L,%L,''APPROVED'')',admin_id,gen_random_uuid()));
 perform pg_temp.expect_retired(format('select public.save_managed_platform_controls(%L,''{"section":"ACCESS","mode":"TRIAL_PAYMENT","confirm":"ENABLE"}'')',admin_id));
 perform pg_temp.expect_retired(format('select public.managed_admin_record_command(%L,''SUBSCRIPTION'',%L,''{"action":"PAID"}'')',admin_id,gen_random_uuid()));
 -- Fresh signup works even with no active plan catalogue and creates no trial.
 update public.plans set active=false;
 intent_id:=public.prepare_provider_signup_intent(repeat('7',64),'No-plan signup','No-plan provider','+251900000088','SELF_MANAGED_DRIVER',null,now()+interval '10 minutes');
 result:=public.complete_eligible_provider_signup(other_id,repeat('7',64));
 if result->>'role'<>'DRIVER' or result->>'trialEndsAt' is not null then raise exception 'SIGNUP_WITHOUT_PLAN_INVALID';end if;
 if (select count(*) from public.subscriptions)<>before_subscriptions or (select count(*) from public.payment_proofs)<>before_proofs then raise exception 'HISTORICAL_BILLING_CHANGED';end if;
 if not (select workspace_access from public.provider_profile_actor_scope(other_id)) then raise exception 'NEW_SIGNUP_ACCESS_DENIED';end if;
 if not exists(select 1 from public.platform_controls where singleton and access_mode='FREE' and provider_billing_retired=true) then raise exception 'BILLING_RETIREMENT_CONTRACT_MISSING';end if;
 if has_function_privilege('anon','public.submit_managed_payment_proof(uuid,jsonb)','execute') or has_function_privilege('authenticated','public.review_managed_payment_proof(uuid,uuid,text)','execute') then raise exception 'BROWSER_BILLING_RPC_ALLOWED';end if;
 raise notice 'No-plan workspace/signup, inactive/unlinked denial, retired writes and retained billing history passed';
end $test$;
rollback;
