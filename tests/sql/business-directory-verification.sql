-- FEAT-ENT/VER-001 / migrations169–170. Fresh synthetic actors, no SMTP or files.
-- Storage cleanup below acknowledges metadata only; it does not test a vendor.
begin;
create function pg_temp.assert_business_verification(ok boolean,label text) returns void language plpgsql as $$
begin if ok is not true then raise exception '%',label;end if;end$$;
create function pg_temp.business_verification_denied(statement text,expected text) returns void language plpgsql as $$
begin
 begin execute statement;exception when others then if sqlerrm=expected then return;end if;raise;end;
 raise exception 'BUSINESS_VERIFICATION_EXPECTED_DENIAL:%',expected;
end$$;
create function pg_temp.business_document_command(workspace uuid,kind text,suffix text) returns jsonb language sql as $$
 select jsonb_build_object('subject_type','BUSINESS_WORKSPACE','subject_id',workspace,'verification_type',kind,
  'document_name','Synthetic business proof '||suffix,'storage_path','supabase://verification/verification/business-'||suffix||'.pdf',
  'original_name','fictional-business.pdf','mime_type','application/pdf','expires_on',current_date+30)
$$;
create function pg_temp.business_directory_item(actor uuid,workspace uuid) returns jsonb language sql as $$
 select d.payload from public.provider_business_directory(actor,(select handle from public.business_workspaces where id=workspace),0,30)d where d.payload->>'id'=workspace::text
$$;
create function pg_temp.business_badge(workspace uuid,kind text) returns boolean language sql as $$
 select coalesce((select (d->>'verified')::boolean from jsonb_array_elements(public.business_document_badges(workspace))d where d->>'type'=kind),false)
$$;
create function pg_temp.business_change(actor uuid,workspace uuid,command jsonb) returns void language plpgsql as $$
begin
 perform public.business_workspace_command(actor,workspace,command||jsonb_build_object('expectedVersion',(select version from public.business_workspaces where id=workspace)));
end$$;

do $test$
declare
 owner_id uuid:=gen_random_uuid();staff_id uuid:=gen_random_uuid();foreign_id uuid:=gen_random_uuid();
 provider_id uuid:=gen_random_uuid();provider_profile uuid:=gen_random_uuid();reviewer_id uuid:=gen_random_uuid();
 nontrust_id uuid:=gen_random_uuid();admin_id uuid:=gen_random_uuid();guest_id uuid:=gen_random_uuid();held_owner uuid:=gen_random_uuid();uid uuid;
 workspace uuid;foreign_workspace uuid;held_workspace uuid;invitation uuid;
 initial_id uuid;replacement_id uuid;licence_id uuid;address_id uuid;stale_identity uuid;stale_name uuid;stale_address uuid;
 expired_id uuid;transfer_pending uuid;new_owner_id uuid;provider_request uuid;shared_request uuid;held_proof uuid;deletion_id uuid;
 command jsonb;result jsonb;item jsonb;center jsonb;history jsonb;provider_before jsonb;badge_count bigint;
 document_kind text;signature text;role_name text;token text:=replace(gen_random_uuid()::text,'-','');
 business_name text:='Synthetic company '||token;manager_first text:='Manager'||substr(token,1,8);
 private_last text:='PRIVATE_FATHER_'||token;private_note text:='PRIVATE_REVIEW_NOTE_'||token;
 audit_before bigint;authority_before bigint;
begin
 foreach uid in array array[owner_id,staff_id,foreign_id,provider_id,reviewer_id,nontrust_id,admin_id,held_owner] loop
  insert into auth.users(id,email,email_confirmed_at,last_sign_in_at,raw_app_meta_data,raw_user_meta_data)
   values(uid,'business-verification-'||uid||'@example.test',now(),now(),'{}','{}');
 end loop;
 insert into auth.users(id,email,raw_user_meta_data) values(guest_id,'business-verification-'||guest_id||'@example.test','{}');
 update public.profiles set role='SHIPPER',active=true,first_name=manager_first,last_name=private_last,
  full_name=manager_first||' '||private_last where id=owner_id;
 update public.profiles set role='SHIPPER',active=true,first_name='NextManager',last_name='PRIVATE_NEXT_FATHER' where id in(staff_id,foreign_id,held_owner);
 update public.profiles set role='DRIVER',active=true,first_name='ProviderFirst',last_name='PRIVATE_PROVIDER_FATHER' where id=provider_id;
 update public.profiles set role='SUPPORT',active=true where id in(reviewer_id,nontrust_id);
 update public.profiles set role='ADMIN',active=true where id=admin_id;
 insert into public.support_agent_profiles(user_id,active,available,can_manage_support,can_manage_trust)
  values(reviewer_id,true,false,false,true),(nontrust_id,true,false,true,false);
 insert into public.provider_profiles(id,user_id,business_name,handle,public_visibility)
  values(provider_profile,provider_id,'Synthetic directory provider','dir-provider-'||substr(token,1,16),'PUBLIC');
 workspace:=(public.business_workspace_create(owner_id,jsonb_build_object('name',business_name,'handle','dir-business-'||substr(token,1,16),'kind','BROKER','city','Addis Ababa'))->>'id')::uuid;
 foreign_workspace:=(public.business_workspace_create(foreign_id,jsonb_build_object('name','Synthetic unrelated company','handle','dir-other-'||substr(token,1,16),'kind','SHIPPER'))->>'id')::uuid;
 invitation:=(public.business_workspace_command(owner_id,workspace,jsonb_build_object('action','INVITE','expectedVersion',1,
  'email','business-verification-'||staff_id||'@example.test','role','STAFF','capacity',true,'tracking',true))->>'invitationId')::uuid;
 perform public.business_workspace_accept_invitation(staff_id,invitation);

 -- A current provider may browse; a global role, customer team or guest may not.
 perform pg_temp.assert_business_verification(public.business_directory_provider(provider_id),'CURRENT_PROVIDER_DIRECTORY_MISSING');
 foreach uid in array array[owner_id,staff_id,foreign_id,reviewer_id,nontrust_id,admin_id,guest_id,null::uuid] loop
  perform pg_temp.business_verification_denied(format('select * from public.provider_business_directory(%L,'''',0,12)',uid),'FORBIDDEN');
 end loop;
 perform pg_temp.business_verification_denied(format('select * from public.provider_business_directory(%L,%L,0,12)',provider_id,repeat('x',121)),'INVALID_BUSINESS_INPUT');
 perform pg_temp.business_verification_denied(format('select * from public.provider_business_directory(%L,'''',0,31)',provider_id),'INVALID_BUSINESS_INPUT');
 item:=pg_temp.business_directory_item(provider_id,workspace);
 perform pg_temp.assert_business_verification(item->>'name'=business_name and item->>'managerName'=manager_first,'DIRECTORY_NAME_OR_FIRST_NAME_WRONG');
 perform pg_temp.assert_business_verification(jsonb_array_length(item->'documents')=3
  and not exists(select 1 from jsonb_array_elements(item->'documents')d where (d->>'verified')::boolean),'OPTIONAL_DOCUMENTS_REQUIRED_OR_DEFAULT_VERIFIED');
 perform pg_temp.assert_business_verification(item::text not like '%'||private_last||'%'
  and item::text not like '%'||owner_id::text||'%' and item::text !~ 'email|storage_path|identity_digest|submitted_by|review_note|last_name|full_name','DIRECTORY_PRIVATE_DATA_LEAK');
 perform pg_temp.assert_business_verification(exists(select 1 from public.provider_business_directory(provider_id,manager_first,0,30)d where d.payload->>'id'=workspace::text),'MANAGER_FIRST_NAME_NOT_SEARCHABLE');
 perform pg_temp.assert_business_verification(not exists(select 1 from public.provider_business_directory(provider_id,private_last,0,30)d where d.payload->>'id'=workspace::text),'PRIVATE_FATHER_NAME_SEARCHABLE');
 update public.profiles set active=false where id=provider_id;
 perform pg_temp.business_verification_denied(format('select * from public.provider_business_directory(%L,'''',0,12)',provider_id),'FORBIDDEN');
 update public.profiles set active=true where id=provider_id;

 -- Read-first owners get exactly three optional business subjects, never trucks.
 center:=public.business_verification_center(owner_id,workspace);
 perform pg_temp.assert_business_verification((center->>'canManage')::boolean and jsonb_array_length(center->'subjects')=1
  and center->'subjects'->0->>'subject_type'='BUSINESS_WORKSPACE'
  and center->'subjects'->0->'verification_types'='["IDENTITY","BUSINESS_LICENSE","BUSINESS_ADDRESS"]'::jsonb
  and center->'subjects'->0->'vehicles'='[]'::jsonb,'BUSINESS_DOCUMENT_SUBJECTS_WRONG');
 center:=public.business_verification_center(staff_id,workspace);
 perform pg_temp.assert_business_verification(not (center->>'canManage')::boolean and center->'subjects'='[]'::jsonb and center->'requests'='[]'::jsonb,'TEAMMATE_PRIVATE_PROOF_LEAK');
 perform pg_temp.business_verification_denied(format('select public.business_verification_center(%L,%L)',foreign_id,workspace),'FORBIDDEN');
 command:=pg_temp.business_document_command(workspace,'IDENTITY',token||'-first');
 foreach uid in array array[staff_id,foreign_id,provider_id,nontrust_id,guest_id] loop
  perform pg_temp.business_verification_denied(format('select public.submit_managed_verification(%L,%L::jsonb)',uid,command::text),'FORBIDDEN');
 end loop;
 foreach document_kind in array array['VEHICLE_OWNERSHIP','VEHICLE_AUTHORIZATION','VEHICLE_OPERATING_LICENSE','DRIVER_IDENTITY','UNKNOWN'] loop
  perform pg_temp.business_verification_denied(format('select public.submit_managed_verification(%L,%L::jsonb)',owner_id,
   (command||jsonb_build_object('verification_type',document_kind))::text),'INVALID_VERIFICATION_TYPE');
 end loop;
 perform pg_temp.business_verification_denied(format('select public.submit_managed_verification(%L,%L::jsonb)',owner_id,
  (command||jsonb_build_object('related_vehicle_id',gen_random_uuid()))::text),'INVALID_VERIFICATION_TYPE');
 perform pg_temp.business_verification_denied(format('select public.submit_managed_verification(%L,%L::jsonb)',owner_id,
  (command||jsonb_build_object('storage_path','https://foreign.example.test/proof.pdf'))::text),'VERIFICATION_DOCUMENT_REQUIRED');

 -- Real submit → Trust More information → a new replacement → approval.
 select count(*) into authority_before from public.provider_vehicle_authority_reviews;
 initial_id:=public.submit_managed_verification(owner_id,command);
 perform pg_temp.assert_business_verification(exists(select 1 from public.managed_verification_review_page(reviewer_id,'PENDING',token,0,50)d where d.payload->>'id'=initial_id::text),'TRUST_QUEUE_MISSING_SUBMISSION');
 foreach uid in array array[staff_id,foreign_id,provider_id,nontrust_id] loop
  perform pg_temp.assert_business_verification(public.managed_verification_file(uid,initial_id) is null,'FOREIGN_OR_TEAMMATE_FILE_ACCESS');
 end loop;
 perform pg_temp.assert_business_verification(public.managed_verification_file(owner_id,initial_id)->>'storage_path'=command->>'storage_path'
  and public.managed_verification_file(reviewer_id,initial_id) is not null,'AUTHORIZED_PRIVATE_FILE_UNAVAILABLE');
 perform pg_temp.business_verification_denied(format('select public.review_managed_verification(%L,%L,''APPROVED'',''Unauthorized reviewer.'')',nontrust_id,initial_id),'FORBIDDEN');
 perform public.review_managed_verification(reviewer_id,initial_id,'MORE_INFO','Please send a clearer fictional document.');
 replacement_id:=public.submit_managed_verification(owner_id,pg_temp.business_document_command(workspace,'IDENTITY',token||'-replacement'));
 perform pg_temp.assert_business_verification(replacement_id<>initial_id,'REPLACEMENT_OVERWROTE_HISTORY');
 perform public.review_managed_verification(reviewer_id,replacement_id,'APPROVED',private_note);
 perform pg_temp.assert_business_verification(pg_temp.business_badge(workspace,'IDENTITY'),'APPROVED_IDENTITY_BADGE_MISSING');
 perform pg_temp.assert_business_verification(exists(select 1 from public.verification_requests where id=initial_id and status='MORE_INFO')
  and exists(select 1 from public.verification_requests where id=replacement_id and status='APPROVED'),'DOCUMENT_HISTORY_REWRITTEN');
 perform pg_temp.business_verification_denied(format('select public.submit_managed_verification(%L,%L::jsonb)',owner_id,command::text),'VERIFICATION_ALREADY_SUBMITTED');
 perform pg_temp.business_verification_denied(format('select public.confirm_provider_vehicle_authority(%L,%L,''{"fact_kind":"OWNERSHIP","review_note":"A company ID is not a vehicle title."}''::jsonb)',reviewer_id,replacement_id),'AUTHORITY_SOURCE_MISMATCH');
 perform pg_temp.assert_business_verification((select count(*) from public.provider_vehicle_authority_reviews)=authority_before,'BUSINESS_DOCUMENT_CREATED_TRUCK_AUTHORITY');

 licence_id:=public.submit_managed_verification(owner_id,pg_temp.business_document_command(workspace,'BUSINESS_LICENSE',token||'-licence'));
 address_id:=public.submit_managed_verification(owner_id,pg_temp.business_document_command(workspace,'BUSINESS_ADDRESS',token||'-address'));
 perform public.review_managed_verification(reviewer_id,licence_id,'APPROVED','Fictional business licence checked.');
 perform public.review_managed_verification(reviewer_id,address_id,'APPROVED','Fictional business address checked.');
 perform pg_temp.assert_business_verification(exists(
  select 1 from jsonb_array_elements(public.business_workspace_search(provider_id,business_name,10)) as d(item)
  where d.item->>'id'=workspace::text
 ),'APPROVED_BUSINESS_RECIPIENT_SEARCH_MISSING');
 item:=pg_temp.business_directory_item(provider_id,workspace);
 perform pg_temp.assert_business_verification(item->>'name'=business_name and item->>'managerName'=manager_first,'DIRECTORY_NAME_OR_FIRST_NAME_WRONG');
 select count(*) into badge_count from jsonb_array_elements(item->'documents')d where (d->>'verified')::boolean;
 perform pg_temp.assert_business_verification(badge_count=3 and item::text not like '%'||private_note||'%' and item::text !~ 'supabase://|fictional-business.pdf|request_id|manager_user_id','DIRECTORY_BADGE_OR_FILE_PRIVACY_WRONG');
 -- Private identity changes, business rename/city changes and expiry immediately
 -- invalidate only the affected proof; stale forms cannot certify new facts.
 update public.profiles set last_name=private_last||'_CHANGED' where id=owner_id;
 perform pg_temp.assert_business_verification(not pg_temp.business_badge(workspace,'IDENTITY') and pg_temp.business_badge(workspace,'BUSINESS_LICENSE'),'STALE_MANAGER_IDENTITY_BADGE');
 stale_identity:=public.submit_managed_verification(owner_id,pg_temp.business_document_command(workspace,'IDENTITY',token||'-identity-stale'));
 update public.profiles set first_name=manager_first||'ChangedAgain' where id=owner_id;
 perform pg_temp.business_verification_denied(format('select public.review_managed_verification(%L,%L,''APPROVED'',''Stale identity form.'')',reviewer_id,stale_identity),'VERIFICATION_SUBJECT_CHANGED');
 update public.profiles set first_name=manager_first,last_name=private_last where id=owner_id;
 perform pg_temp.assert_business_verification(pg_temp.business_badge(workspace,'IDENTITY'),'UNCHANGED_IDENTITY_NOT_RESTORED');
 perform pg_temp.business_change(owner_id,workspace,jsonb_build_object('action','UPDATE_DETAILS','name',business_name||' Changed','city','Addis Ababa'));
 perform pg_temp.assert_business_verification(not pg_temp.business_badge(workspace,'BUSINESS_LICENSE') and not pg_temp.business_badge(workspace,'BUSINESS_ADDRESS') and pg_temp.business_badge(workspace,'IDENTITY'),'BUSINESS_RENAME_PROOF_SCOPE_WRONG');
 stale_name:=public.submit_managed_verification(owner_id,pg_temp.business_document_command(workspace,'BUSINESS_LICENSE',token||'-name-stale'));
 perform pg_temp.business_change(owner_id,workspace,jsonb_build_object('action','UPDATE_DETAILS','name',business_name,'city','Dire Dawa'));
 perform pg_temp.business_verification_denied(format('select public.review_managed_verification(%L,%L,''APPROVED'',''Stale business name.'')',reviewer_id,stale_name),'VERIFICATION_SUBJECT_CHANGED');
 stale_address:=public.submit_managed_verification(owner_id,pg_temp.business_document_command(workspace,'BUSINESS_ADDRESS',token||'-city-stale'));
 perform pg_temp.business_change(owner_id,workspace,jsonb_build_object('action','UPDATE_DETAILS','name',business_name,'city','Addis Ababa'));
 perform pg_temp.business_verification_denied(format('select public.review_managed_verification(%L,%L,''APPROVED'',''Stale business address.'')',reviewer_id,stale_address),'VERIFICATION_SUBJECT_CHANGED');
 update public.verification_requests set expires_on=current_date-1 where id=licence_id;
 perform pg_temp.assert_business_verification(not pg_temp.business_badge(workspace,'BUSINESS_LICENSE'),'EXPIRED_DOCUMENT_BADGE_RETAINED');
 perform pg_temp.assert_business_verification(pg_temp.business_directory_item(provider_id,workspace) is not null
  and not pg_temp.business_badge(workspace,'BUSINESS_LICENSE'),'EXPIRED_PROOF_REMOVED_BUSINESS_OR_BADGE_RETAINED');
 expired_id:=public.submit_managed_verification(owner_id,pg_temp.business_document_command(workspace,'BUSINESS_LICENSE',token||'-expiry-stale'));
 update public.verification_requests set expires_on=current_date-1 where id=expired_id;
 perform pg_temp.business_verification_denied(format('select public.review_managed_verification(%L,%L,''APPROVED'',''Expired pending document.'')',reviewer_id,expired_id),'VERIFICATION_SUBJECT_CHANGED');

 -- Transfer changes the identity beneficiary. The next owner never receives the
 -- former manager's ID file, even while managing ordinary company documents.
 perform public.review_managed_verification(reviewer_id,stale_identity,'REJECTED','The manager identity changed; submit new evidence.');
 update public.verification_requests set expires_on=current_date-1 where id=replacement_id;
 transfer_pending:=public.submit_managed_verification(owner_id,pg_temp.business_document_command(workspace,'IDENTITY',token||'-transfer-stale'));
 perform pg_temp.business_change(owner_id,workspace,jsonb_build_object('action','TRANSFER_OWNERSHIP','userId',staff_id));
 perform pg_temp.assert_business_verification(not pg_temp.business_badge(workspace,'IDENTITY'),'TRANSFER_INHERITED_MANAGER_ID');
 perform pg_temp.business_verification_denied(format('select public.review_managed_verification(%L,%L,''APPROVED'',''Former owner identity.'')',reviewer_id,transfer_pending),'VERIFICATION_SUBJECT_CHANGED');
 perform pg_temp.assert_business_verification(public.managed_verification_file(staff_id,transfer_pending) is null
  and public.managed_verification_file(owner_id,transfer_pending) is null and public.managed_verification_file(reviewer_id,transfer_pending) is not null,'OLD_MANAGER_ID_FILE_DISCLOSURE');
 center:=public.business_verification_center(staff_id,workspace);
 perform pg_temp.assert_business_verification(not exists(select 1 from jsonb_array_elements(center->'requests')r where r->>'id'=transfer_pending::text),'OLD_MANAGER_ID_IN_NEW_OWNER_LIST');
 perform pg_temp.assert_business_verification(public.managed_verification_file(staff_id,address_id) is not null,'NEW_OWNER_COMPANY_DOCUMENT_MISSING');
 new_owner_id:=public.submit_managed_verification(staff_id,pg_temp.business_document_command(workspace,'IDENTITY',token||'-new-owner'));
 perform public.review_managed_verification(reviewer_id,new_owner_id,'APPROVED','Current manager identity checked.');
 update public.profiles set active=false where id=staff_id;
 perform pg_temp.assert_business_verification(not pg_temp.business_badge(workspace,'IDENTITY') and pg_temp.business_directory_item(provider_id,workspace) is null,'INACTIVE_OWNER_DIRECTORY_OR_BADGE');
 perform pg_temp.business_verification_denied(format('select public.review_managed_verification(%L,%L,''APPROVED'',''Inactive business owner.'')',reviewer_id,transfer_pending),'VERIFICATION_SUBJECT_CHANGED');
 update public.profiles set active=true where id=staff_id;
 perform pg_temp.assert_business_verification(pg_temp.business_badge(workspace,'IDENTITY'),'CURRENT_OWNER_RESTORATION_LOST_VALID_PROOF');

 -- The pre-existing provider workflow remains live through the private delegate.
 command:=pg_temp.business_document_command(workspace,'IDENTITY',token||'-provider')||jsonb_build_object('subject_type','PROVIDER_PROFILE','subject_id',provider_profile);
 provider_request:=public.submit_managed_verification(provider_id,command);
 perform public.review_managed_verification(reviewer_id,provider_request,'MORE_INFO','Please clarify the fictional provider identity.');
 perform public.review_managed_verification(reviewer_id,provider_request,'APPROVED','Fictional provider identity checked.');
 provider_before:=(select to_jsonb(r) from public.verification_requests r where r.id=provider_request);
 perform pg_temp.assert_business_verification(public.managed_verification_file(provider_id,provider_request) is not null
  and public.managed_verification_file(foreign_id,provider_request) is null,'INHERITED_PROVIDER_FILE_WORKFLOW_CHANGED');
 select jsonb_agg(to_jsonb(r) order by r.id) into history from public.verification_requests r where r.subject_type='BUSINESS_WORKSPACE' and r.subject_id=workspace;
 select count(*) into audit_before from public.business_workspace_audit where workspace_id=workspace;
 perform pg_temp.business_change(staff_id,workspace,jsonb_build_object('action','ARCHIVE'));
 perform pg_temp.assert_business_verification(pg_temp.business_directory_item(provider_id,workspace) is null and not pg_temp.business_badge(workspace,'IDENTITY'),'ARCHIVED_BUSINESS_REMAINS_PUBLISHED');
 perform pg_temp.business_verification_denied(format('select public.review_managed_verification(%L,%L,''APPROVED'',''Archived company.'')',reviewer_id,transfer_pending),'VERIFICATION_SUBJECT_CHANGED');
 perform pg_temp.assert_business_verification((select jsonb_agg(to_jsonb(r) order by r.id) from public.verification_requests r where r.subject_type='BUSINESS_WORKSPACE' and r.subject_id=workspace)=history,'ARCHIVE_OR_DENIAL_REWROTE_PROOF_HISTORY');
 perform pg_temp.assert_business_verification((select to_jsonb(r) from public.verification_requests r where r.id=provider_request)=provider_before,'BUSINESS_WORKFLOW_MUTATED_PROVIDER_DOCUMENT');
 perform pg_temp.assert_business_verification((select count(*) from public.business_workspace_audit where workspace_id=workspace)>audit_before,'BUSINESS_AUDIT_MISSING');

 -- Archived-business and former-manager files join the established cleanup gate.
 deletion_id:=(public.request_account_deletion(owner_id)->>'id')::uuid;
 result:=public.prepare_account_erasure(admin_id,deletion_id);
 perform pg_temp.assert_business_verification(result->>'status'='ERASING','BUSINESS_ERASURE_PREPARE_FAILED');
 perform pg_temp.assert_business_verification(exists(select 1 from public.account_erasure_files f join public.verification_requests r on r.storage_path=f.storage_path
  where f.request_id=deletion_id and r.id=transfer_pending),'BUSINESS_ID_FILE_NOT_RESERVED_FOR_CLEANUP');
 perform pg_temp.business_verification_denied(format('select public.finish_account_erasure(%L,%L)',admin_id,deletion_id),'ERASURE_CLEANUP_INCOMPLETE');
 update public.account_erasure_files set removed_at=now() where request_id=deletion_id;
 update auth.users set deleted_at=now() where id=owner_id;
 result:=public.finish_account_erasure(admin_id,deletion_id);
 perform pg_temp.assert_business_verification(result->>'status'='COMPLETED'
  and not exists(select 1 from public.verification_requests where id=transfer_pending)
  and not exists(select 1 from public.business_verification_contexts where request_id=transfer_pending),'BUSINESS_PRIVATE_ERASURE_INCOMPLETE');
 perform pg_temp.assert_business_verification(exists(select 1 from public.verification_requests where id=new_owner_id)
  and (select to_jsonb(r) from public.verification_requests r where r.id=provider_request)=provider_before,'ERASURE_REMOVED_OTHER_OWNER_OR_PROVIDER_PROOF');
 perform pg_temp.assert_business_verification(exists(select 1 from public.business_workspace_audit where workspace_id=workspace),'ERASURE_DELETED_BUSINESS_AUDIT_HISTORY');

 -- A reused private path must be held for manual review, never queued for delete.
 held_workspace:=(public.business_workspace_create(held_owner,jsonb_build_object('name','Synthetic shared-path company','handle','dir-held-'||substr(token,1,16),'kind','RECEIVER'))->>'id')::uuid;
 held_proof:=public.submit_managed_verification(held_owner,pg_temp.business_document_command(held_workspace,'IDENTITY',token||'-shared-path'));
 command:=pg_temp.business_document_command(held_workspace,'DRIVER_IDENTITY',token||'-shared-path')||jsonb_build_object('subject_type','PROVIDER_PROFILE','subject_id',provider_profile);
 shared_request:=public.submit_managed_verification(provider_id,command);
 perform pg_temp.business_change(held_owner,held_workspace,jsonb_build_object('action','ARCHIVE'));
 deletion_id:=(public.request_account_deletion(held_owner)->>'id')::uuid;
 result:=public.prepare_account_erasure(admin_id,deletion_id);
 perform pg_temp.assert_business_verification(result->>'status'='HELD' and exists(select 1 from public.verification_requests where id=held_proof)
  and exists(select 1 from public.verification_requests where id=shared_request),'SHARED_BUSINESS_PROOF_NOT_HELD');
 perform pg_temp.assert_business_verification(not exists(select 1 from public.account_erasure_files f
  join public.verification_requests r on r.storage_path=f.storage_path where f.request_id=deletion_id and r.id=shared_request),'SHARED_PRIVATE_PATH_QUEUED_FOR_DELETE');

 -- No browser/table/private delegate can bypass the service adapter.
 foreach role_name in array array['anon','authenticated'] loop
  foreach signature in array array['public.provider_business_directory(uuid,text,integer,integer)','public.business_verification_center(uuid,uuid)',
   'public.submit_managed_verification(uuid,jsonb)','public.managed_verification_file(uuid,uuid)','public.review_managed_verification(uuid,uuid,text,text)',
   'public.ver_submit_pre170(uuid,jsonb)','public.ver_file_pre170(uuid,uuid)','public.ver_review_pre170(uuid,uuid,text,text)',
   'public.erase_prepare_pre170(uuid,uuid)','public.erase_finish_pre170(uuid,uuid)'] loop
   perform pg_temp.assert_business_verification(not has_function_privilege(role_name,signature,'EXECUTE'),'BROWSER_VERIFICATION_RPC_BYPASS:'||signature);
  end loop;
  perform pg_temp.assert_business_verification(not has_table_privilege(role_name,'public.business_verification_contexts','SELECT,INSERT,UPDATE,DELETE'),'BROWSER_BUSINESS_DOCUMENT_CONTEXT_TABLE');
 end loop;
 foreach signature in array array['public.business_directory_provider(uuid)','public.business_directory_manager(uuid)',
  'public.business_document_identity(uuid,text)','public.business_document_badges(uuid)',
  'public.ver_submit_pre170(uuid,jsonb)','public.ver_file_pre170(uuid,uuid)','public.ver_review_pre170(uuid,uuid,text,text)',
  'public.erase_prepare_pre170(uuid,uuid)','public.erase_finish_pre170(uuid,uuid)'] loop
  perform pg_temp.assert_business_verification(not has_function_privilege('service_role',signature,'EXECUTE'),'DIRECT_PRIVATE_DELEGATE_EXPOSED:'||signature);
 end loop;
 perform pg_temp.assert_business_verification(has_function_privilege('service_role','public.provider_business_directory(uuid,text,integer,integer)','EXECUTE')
  and has_function_privilege('service_role','public.business_verification_center(uuid,uuid)','EXECUTE'),'SERVICE_DIRECTORY_ADAPTER_UNAVAILABLE');
 raise notice 'PASS: businesses remain discoverable without documents; optional Trust review badges, private files, stale/transfer/expiry/archive states, provider compatibility, erasure cleanup/shared-path hold and browser ACLs';
end $test$;
rollback;
