begin;
do $test$
declare actor uuid:=gen_random_uuid();owner_id uuid:=gen_random_uuid();outsider uuid:=gen_random_uuid();provider uuid:=gen_random_uuid();org uuid:=gen_random_uuid();denied boolean;
begin
 insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values(actor,'review-driver@example.test',now(),'{"full_name":"Review driver"}'),(owner_id,'review-owner@example.test',now(),'{"full_name":"Review owner"}'),(outsider,'review-outsider@example.test',now(),'{"full_name":"Unrelated user"}');
 insert into profiles(id,email,full_name,role,active) values(actor,'review-driver@example.test','Review driver','DRIVER',true),(owner_id,'review-owner@example.test','Review owner','TRANSPORTER',true),(outsider,'review-outsider@example.test','Unrelated user','DRIVER',true)
 on conflict(id) do update set role=excluded.role,active=true;
 insert into provider_profiles(id,user_id,business_name,handle,review_workspace,public_visibility) values(provider,actor,'Review synthetic provider','review-'||provider,true,'PUBLIC');
 if native_review_account_allowed(actor) then raise exception 'UNREGISTERED_REVIEW_ACCOUNT';end if;
 insert into app_review_accounts(user_id,provider_profile_id,expected_role) values(actor,provider,'DRIVER');
 if not native_review_account_allowed(actor) or(select public_visibility from provider_profiles where id=provider)<>'PRIVATE' then raise exception 'REVIEW_SCOPE_UNAVAILABLE';end if;
 update app_review_accounts set enabled=false where user_id=actor;
 if native_review_account_allowed(actor) then raise exception 'REVOKED_REVIEW_ALLOWED';end if;
 update app_review_accounts set enabled=true where user_id=actor;
 update profiles set role='ADMIN' where id=actor;
 if native_review_account_allowed(actor) then raise exception 'REVIEW_STAFF_ELEVATION';end if;
 update profiles set role='DRIVER' where id=actor;
 insert into organizations(id,name,handle,type,public_visibility) values(org,'Review synthetic fleet','review-fleet-'||org,'TRANSPORT_COMPANY','PRIVATE');
 insert into organization_members(organization_id,user_id,membership_role) values(org,owner_id,'OWNER');
 insert into app_review_accounts(user_id,organization_id,expected_role) values(owner_id,org,'TRANSPORTER');
 update organizations set review_workspace=true where id=org;
 if not native_review_account_allowed(owner_id) then raise exception 'SCOPED_REVIEW_OWNER_UNAVAILABLE';end if;
 denied:=false;begin insert into organization_members(organization_id,user_id,membership_role) values(org,outsider,'DRIVER');exception when others then if sqlerrm='REVIEW_WORKSPACE_ONLY' then denied:=true;else raise;end if;end;
 if not denied then raise exception 'REAL_USER_JOINED_REVIEW_FLEET';end if;
 if native_review_account_allowed(outsider) then raise exception 'ORDINARY_USER_REVIEW_ALLOWED';end if;
 if has_function_privilege('anon','public.native_review_account_allowed(uuid)','EXECUTE') or has_table_privilege('authenticated','public.app_review_accounts','INSERT') then raise exception 'BROWSER_REVIEW_REGISTRATION';end if;
 raise notice 'Review registration/private scope, revocation, staff-role denial and unrelated member isolation pass';
end $test$;
rollback;
