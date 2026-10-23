-- FEAT-ENT-001. Isolated synthetic transaction; no customer fixtures required.
begin;
create function pg_temp.assert_business(ok boolean,label text) returns void language plpgsql as $$begin if ok is not true then raise exception '%',label;end if;end$$;
create function pg_temp.business_denied(statement text,code text) returns void language plpgsql as $$
begin
 begin execute statement;exception when others then if position(code in sqlerrm)>0 then return;end if;raise;end;
 raise exception 'BUSINESS_EXPECTED_DENIAL:%',code;
end$$;
do $test$
declare
 owner_id uuid:=gen_random_uuid();staff_id uuid:=gen_random_uuid();foreign_id uuid:=gen_random_uuid();
 platform_id uuid:=gen_random_uuid();unverified_id uuid:=gen_random_uuid();pristine_id uuid:=gen_random_uuid();uid uuid;
 search_token text:='business-regression-'||gen_random_uuid();
 workspace uuid;other_workspace uuid;invitation uuid;admin_invitation uuid;result jsonb;lease jsonb;request_id uuid;before_profile jsonb;before_members jsonb;version_value bigint;record_row record;anchor_id uuid;recorded boolean;
begin
 foreach uid in array array[owner_id,staff_id,foreign_id,platform_id,pristine_id] loop
  insert into auth.users(id,email,email_confirmed_at,last_sign_in_at,raw_user_meta_data) values(uid,'synthetic-business-'||uid||'@example.test',now(),now(),'{}');
 end loop;
 insert into auth.users(id,email,raw_user_meta_data) values(unverified_id,'synthetic-business-'||unverified_id||'@example.test','{}');
 update public.profiles set active=true,role='TRANSPORTER' where id=owner_id;
 update public.profiles set active=true,role='DRIVER' where id in(staff_id,foreign_id);
 update public.profiles set active=true,role='ADMIN' where id=platform_id;
 before_profile:=(select to_jsonb(p) from public.profiles p where id=owner_id);
 result:=public.business_workspace_create(owner_id,jsonb_build_object('name',search_token||' First','handle','test-ent-'||substr(owner_id::text,1,12),'kind','BROKER'));
 workspace:=(result->>'id')::uuid;
 perform pg_temp.assert_business(result->>'actorRole'='CUSTOMER' and result->>'membershipRole'='OWNER','CREATION_CONTEXT_WRONG');
 perform pg_temp.assert_business((select to_jsonb(p) from public.profiles p where id=owner_id)=before_profile,'PROVIDER_IDENTITY_CHANGED');
 perform pg_temp.assert_business(public.business_workspace_permission(owner_id,workspace,'CAPACITY') and public.business_workspace_permission(owner_id,workspace,'OWNER'),'OWNER_ACCESS_MISSING');
 perform pg_temp.assert_business(not public.business_workspace_permission(foreign_id,workspace,'ACCESS'),'FOREIGN_BUSINESS_VISIBLE');
 other_workspace:=(public.business_workspace_create(foreign_id,jsonb_build_object('name',search_token||' Second','handle','test-ent-'||substr(foreign_id::text,1,12),'kind','RECEIVER'))->>'id')::uuid;
 perform pg_temp.business_denied(format('select public.business_workspace_select(%L,%L)',owner_id,other_workspace),'BUSINESS_FORBIDDEN');
 perform pg_temp.business_denied(format('select public.business_workspace_create(%L,''{"name":"Denied platform","handle":"denied-platform","kind":"BROKER"}'')',platform_id),'BUSINESS_IDENTITY_REQUIRED');
 perform pg_temp.business_denied(format('select public.business_workspace_create(%L,''{"name":"Unverified","handle":"unverified","kind":"BROKER"}'')',unverified_id),'BUSINESS_IDENTITY_REQUIRED');

 result:=public.business_workspace_command(owner_id,workspace,jsonb_build_object('action','INVITE','expectedVersion',1,'email','synthetic-business-'||staff_id||'@example.test','role','STAFF','capacity',true,'tracking',false));
 invitation:=(result->>'invitationId')::uuid;
 lease:=public.business_workspace_claim_invitation_email(owner_id,workspace,invitation);
 perform pg_temp.assert_business(lease->>'email'='synthetic-business-'||staff_id||'@example.test' and public.business_workspace_claim_invitation_email(owner_id,workspace,invitation) is null,'EMAIL_LEASE_DUPLICATED');
 perform pg_temp.assert_business(not public.business_workspace_record_invitation_email(owner_id,workspace,invitation,gen_random_uuid(),true),'FOREIGN_EMAIL_LEASE_ACCEPTED');
 perform pg_temp.assert_business(public.business_workspace_record_invitation_email(owner_id,workspace,invitation,(lease->>'lease')::uuid,false),'EMAIL_FAILURE_NOT_RECORDED');
 lease:=public.business_workspace_claim_invitation_email(owner_id,workspace,invitation);
 recorded:=public.business_workspace_record_invitation_email(owner_id,workspace,invitation,(lease->>'lease')::uuid,true);
 perform pg_temp.assert_business(recorded,'EMAIL_SUCCESS_NOT_RECORDED');
 lease:=public.business_workspace_claim_invitation_email(owner_id,workspace,invitation);
 perform pg_temp.assert_business(lease is null,'EMAIL_RESEND_COOLDOWN_FAILED');
 perform pg_temp.business_denied(format('select public.business_workspace_accept_invitation(%L,%L)',foreign_id,invitation),'BUSINESS_INVITATION_UNAVAILABLE');
 result:=public.business_workspace_accept_invitation(staff_id,invitation);
 perform pg_temp.assert_business(result->>'membershipRole'='STAFF' and (result->'permissions'->>'capacity')::boolean and not (result->'permissions'->>'tracking')::boolean,'INVITE_PERMISSIONS_WRONG');
 perform pg_temp.business_denied(format('select public.business_workspace_accept_invitation(%L,%L)',staff_id,invitation),'BUSINESS_INVITATION_UNAVAILABLE');
 perform pg_temp.assert_business(not public.business_workspace_permission(staff_id,workspace,'TEAM') and not public.business_workspace_permission(staff_id,workspace,'TRACKING'),'STAFF_ESCALATED');
 perform pg_temp.assert_business(not (public.business_workspace_directory(staff_id,workspace)->'members' @> '[{"email":"synthetic"}]') and not exists(select 1 from jsonb_array_elements(public.business_workspace_directory(staff_id,workspace)->'members') m where m ? 'email'),'STAFF_EMAIL_DIRECTORY_LEAK');
 version_value:=(select version from public.business_workspaces where id=workspace);
 perform pg_temp.business_denied(format('select public.business_workspace_command(%L,%L,%L)',staff_id,workspace,jsonb_build_object('action','ARCHIVE','expectedVersion',version_value)::text),'BUSINESS_FORBIDDEN');
 perform pg_temp.business_denied(format('select public.business_workspace_command(%L,%L,%L)',owner_id,workspace,jsonb_build_object('action','ARCHIVE','expectedVersion',1)::text),'BUSINESS_REVISION_CONFLICT');
 perform pg_temp.business_denied(format('select public.business_workspace_command(%L,%L,%L)',owner_id,workspace,jsonb_build_object('action','LEAVE','expectedVersion',version_value)::text),'BUSINESS_OWNER_HANDOVER_REQUIRED');
 perform pg_temp.business_denied(format('delete from public.profiles where id=%L',owner_id),'BUSINESS_OWNER_HANDOVER_REQUIRED');

 -- Exact current selection is removed together with membership, without touching
 -- the second business or the provider's original profile/organization anchors.
 perform public.business_workspace_command(owner_id,workspace,jsonb_build_object('action','REMOVE_MEMBER','expectedVersion',version_value,'userId',staff_id));
 perform pg_temp.assert_business(not public.business_workspace_permission(staff_id,workspace,'ACCESS'),'REMOVED_MEMBER_STILL_AUTHORIZED');
 perform pg_temp.assert_business(public.business_workspace_context(staff_id)->'selectedWorkspaceId'='null'::jsonb,'REMOVED_SELECTION_RETAINED');
 perform pg_temp.business_denied(format('select public.business_workspace_directory(%L,%L)',staff_id,workspace),'BUSINESS_FORBIDDEN');

 version_value:=(select version from public.business_workspaces where id=workspace);
 result:=public.business_workspace_command(owner_id,workspace,jsonb_build_object('action','INVITE','expectedVersion',version_value,'email','synthetic-business-'||pristine_id||'@example.test','role','ADMIN','capacity',true,'tracking',true));
 admin_invitation:=(result->>'invitationId')::uuid;
 update public.business_workspace_invitations set created_at=now()-interval '9 days',expires_at=now()-interval '2 days' where id=admin_invitation;
 perform pg_temp.business_denied(format('select public.business_workspace_accept_invitation(%L,%L)',pristine_id,admin_invitation),'BUSINESS_INVITATION_UNAVAILABLE');
 perform pg_temp.assert_business((select not active from public.profiles where id=pristine_id),'EXPIRED_INVITE_ACTIVATED_IDENTITY');
 update public.business_workspace_invitations set expires_at=now()+interval '2 days' where id=admin_invitation;
 perform public.accept_content_policy(pristine_id,'2026-10-09');
 perform public.business_workspace_accept_invitation(pristine_id,admin_invitation);
 perform pg_temp.assert_business((select role::text='SHIPPER' and active from public.profiles where id=pristine_id) and public.business_workspace_permission(pristine_id,workspace,'TEAM'),'PRISTINE_ACCEPT_NOT_CONTEXTUAL_CUSTOMER');
 perform pg_temp.assert_business(public.business_provider_signup_eligible(pristine_id) and public.managed_provider_signup_eligible(pristine_id),'CUSTOMER_CANNOT_DELIBERATELY_ADD_PROVIDER');
 perform pg_temp.assert_business(not public.business_provider_signup_eligible(platform_id) and not public.business_provider_signup_eligible(owner_id),'PLATFORM_OR_EXISTING_PROVIDER_CAN_REPROVISION');
 anchor_id:=gen_random_uuid();insert into public.organizations(id,name,handle,type) values(anchor_id,'Synthetic foreign anchor','foreign-anchor-'||substr(pristine_id::text,1,12),'TRANSPORT_COMPANY');
 insert into public.organization_members(user_id,organization_id,membership_role) values(pristine_id,anchor_id,'MEMBER');
 perform pg_temp.assert_business(not public.business_provider_signup_eligible(pristine_id),'FOREIGN_ORGANIZATION_ANCHOR_IGNORED');
 delete from public.organization_members where user_id=pristine_id and organization_id=anchor_id;
 perform public.require_content_policy(pristine_id);
 perform pg_temp.assert_business((public.support_member_actor(pristine_id)).id=pristine_id,'BUSINESS_SOFTWARE_SUPPORT_MISSING');
 version_value:=(select version from public.business_workspaces where id=workspace);
 perform public.business_workspace_command(owner_id,workspace,jsonb_build_object('action','TRANSFER_OWNERSHIP','expectedVersion',version_value,'userId',pristine_id));
 perform pg_temp.assert_business(public.business_workspace_permission(pristine_id,workspace,'OWNER') and not public.business_workspace_permission(owner_id,workspace,'OWNER'),'TRANSFER_NOT_ATOMIC');
 result:=public.business_workspace_select(owner_id,null);
 perform pg_temp.assert_business(result is null,'PROVIDER_RETURN_CLEAR_NOT_NULL');
 perform pg_temp.assert_business(public.business_workspace_context(owner_id)->'selectedWorkspaceId'='null'::jsonb,'PROVIDER_RETURN_TRAPPED');
 perform pg_temp.assert_business((select to_jsonb(p) from public.profiles p where id=owner_id)=before_profile,'PROVIDER_IDENTITY_REWRITTEN');
 -- Global suspension revokes access even though saved business membership exists.
 update public.profiles set active=false where id=owner_id;
 perform pg_temp.assert_business(not public.business_workspace_permission(owner_id,workspace,'ACCESS'),'GLOBAL_SUSPENSION_BYPASSED');
 update public.profiles set active=true where id=owner_id;

 result:=public.business_workspace_search(owner_id,search_token,20);
 perform pg_temp.assert_business(jsonb_array_length(result)=2 and not exists(select 1 from jsonb_array_elements(result) r where r ? 'email' or r ? 'members' or r ? 'userId'),'PUBLIC_BUSINESS_SEARCH_LEAK');
 request_id:=(public.request_account_deletion(pristine_id)->>'id')::uuid;
 result:=public.prepare_account_erasure(platform_id,request_id);
 perform pg_temp.assert_business(result->>'status'='HELD','LAST_OWNER_SOFT_ERASURE_NOT_HELD');
 perform pg_temp.assert_business((select retention_reason like 'Transfer ownership%' from public.account_deletion_requests where id=request_id),'LAST_OWNER_SOFT_ERASURE_REASON_MISSING');
 perform pg_temp.assert_business(public.business_workspace_permission(pristine_id,workspace,'ACCESS'),'HELD_OWNER_WORKSPACE_CHANGED');
 version_value:=(select version from public.business_workspaces where id=workspace);
 perform public.business_workspace_command(pristine_id,workspace,jsonb_build_object('action','ARCHIVE','expectedVersion',version_value));
 perform pg_temp.assert_business(not public.business_workspace_permission(pristine_id,workspace,'ACCESS') and public.business_workspace_permission(foreign_id,other_workspace,'ACCESS'),'ARCHIVE_SCOPE_WRONG');
 perform pg_temp.assert_business(jsonb_array_length(public.business_workspace_search(foreign_id,search_token,20))=1,'ARCHIVED_BUSINESS_SEARCHABLE');
 result:=public.prepare_account_erasure(platform_id,request_id);
 perform pg_temp.assert_business(result->>'status'='ERASING','ARCHIVED_CUSTOMER_ERASURE_NOT_STARTED');
 perform pg_temp.assert_business(not exists(select 1 from public.business_workspace_members where user_id=pristine_id and active),'ARCHIVED_CUSTOMER_ERASURE_NOT_OFFBOARDED');
 update auth.users set deleted_at=now() where id=pristine_id;
 result:=public.finish_account_erasure(platform_id,request_id);
 perform pg_temp.assert_business(result->>'status'='COMPLETED','CUSTOMER_ERASURE_NOT_COMPLETED');
 perform pg_temp.assert_business(not exists(select 1 from public.business_workspace_invitations where email='synthetic-business-'||pristine_id||'@example.test'),'CUSTOMER_INVITATION_CONTACT_RETAINED_AFTER_ERASURE');

 for record_row in select c.oid::regclass as name,c.relrowsecurity from pg_class c where c.oid in('public.business_workspaces'::regclass,'public.business_workspace_members'::regclass,'public.business_workspace_invitations'::regclass,'public.business_workspace_selections'::regclass,'public.business_workspace_audit'::regclass) loop
  perform pg_temp.assert_business(record_row.relrowsecurity and not has_table_privilege('anon',record_row.name,'SELECT') and not has_table_privilege('authenticated',record_row.name,'SELECT'),'BUSINESS_TABLE_BROWSER_ACCESS');
 end loop;
 for record_row in select p.oid::regprocedure as name from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'business_%' loop
  perform pg_temp.assert_business(not has_function_privilege('anon',record_row.name,'EXECUTE') and not has_function_privilege('authenticated',record_row.name,'EXECUTE'),'BUSINESS_RPC_BROWSER_ACCESS');
 end loop;
 raise notice 'PASS: customer workspace identity, exact membership, invitation expiry/email, last owner, revision, revocation, provider preservation, search and ACL';
end $test$;
rollback;
